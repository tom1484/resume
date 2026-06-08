// Migration runner test (mock pool, no live Postgres). Confirms filename-order
// application, schema_migrations tracking, idempotency, and that 005_config is
// present in the real migrations dir.
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../migrations/run.js';
import { MockPool } from './mockPool.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations'
);

describe('runMigrations', () => {
  it('applies every pending *.sql in filename order, tracked + idempotent', async () => {
    const applied = new Set<string>();
    const pool = new MockPool();
    pool.on('SELECT 1 FROM schema_migrations WHERE name', (params) => {
      const name = params[0] as string;
      return applied.has(name)
        ? { rows: [{ '?column?': 1 }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    });
    pool.on('INSERT INTO schema_migrations', (params) => {
      applied.add(params[0] as string);
      return { rows: [], rowCount: 1 };
    });

    const first = await runMigrations(pool, migrationsDir);
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(first).toEqual(files); // applied in filename order
    expect(files).toContain('005_config.sql'); // ADD'd
    expect(files.slice(0, 4)).toEqual([
      '001_init.sql',
      '002_overlay_and_labels.sql',
      '003_seed_answers.sql',
      '004_resume_versions.sql',
    ]); // 001–004 not renumbered

    // second run = no-ops (idempotent)
    const second = await runMigrations(pool, migrationsDir);
    expect(second).toEqual([]);
  });

  it('005_config creates the config table with the right shape', async () => {
    const fs = await import('node:fs');
    const sql = fs.readFileSync(join(migrationsDir, '005_config.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS config/);
    expect(sql).toMatch(/ns\s+text PRIMARY KEY/);
    expect(sql).toMatch(/value\s+jsonb NOT NULL/);
    expect(sql).toMatch(/updated_at\s+timestamptz NOT NULL DEFAULT now\(\)/);
  });
});
