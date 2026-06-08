// API runtime entrypoint. v2 ownership change: the API applies DB migrations at
// startup (the pipeline no longer does), then serves the routes + static SPAs.
import { getPool } from './pool.js';
import { runMigrations } from '../migrations/run.js';
import { createApp } from './app.js';

const pool = getPool();

async function main(): Promise<void> {
  // Migrations run at startup, exactly once each, idempotent (§ deliverable 2).
  await runMigrations(pool);
  const app = createApp({ pool, logger: true });
  await app.listen({ host: '0.0.0.0', port: 8080 });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
