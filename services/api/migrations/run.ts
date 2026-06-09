// DB migration runner (ported from v1 services/pipeline/src/migrate.js).
// OWNERSHIP MOVE (v2): the API applies migrations at startup; the pipeline no
// longer runs them. Applies migrations/*.sql in filename order, exactly once
// each, tracked in schema_migrations. Idempotent — safe to run on every boot.
//
// At runtime the compiled output lives at dist/migrations/run.js, but the *.sql
// files are NOT compiled by tsc — they stay in services/api/migrations/. So the
// SQL dir is resolved relative to this module's source location and overridable
// via MIGRATIONS_DIR (the Docker image copies the .sql files next to dist/).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolLike } from '../src/pool.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Where the .sql files live. Default: this module's directory (the source tree
 *  in dev; the image lays the .sql files alongside dist/migrations). Override
 *  with MIGRATIONS_DIR for the container layout. */
function migrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  // `here` is the source dir in dev (services/api/migrations) and dist/migrations
  // in the built image. The .sql files are NOT compiled by tsc, so the image
  // copies them next to dist/migrations (see Dockerfile). If they aren't beside
  // the compiled runner, fall back to the source migrations dir (two levels up
  // from dist/migrations → services/api/migrations).
  if (existsSync(join(here, '001_init.sql'))) return here;
  const sourceFallback = join(here, '..', '..', 'migrations');
  if (existsSync(join(sourceFallback, '001_init.sql'))) return sourceFallback;
  return here;
}

/**
 * Apply every pending migrations/*.sql in filename order inside its own
 * transaction, recording each in schema_migrations. Accepts any PoolLike so
 * tests pass a mock pool (no live Postgres needed).
 */
export async function runMigrations(
  pool: PoolLike,
  dir: string = migrationsDir()
): Promise<string[]> {
  const applied: string[] = [];
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [file]
      );
      if ((rowCount ?? 0) > 0) continue;
       
      console.log(`applying ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          file,
        ]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
     
    console.log('migrations up to date');
    return applied;
  } finally {
    client.release();
  }
}

// CLI entrypoint: `node dist/migrations/run.js`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { getPool } = await import('../src/pool.js');
  const pool = getPool();
  runMigrations(pool)
    .then(() => pool.end())
    .catch((err) => {
       
      console.error(err);
      process.exit(1);
    });
}
