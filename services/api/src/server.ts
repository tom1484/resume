// API runtime entrypoint. The API owns DB migrations: it applies them at
// startup, then serves the routes + static SPAs.
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
   
  console.error(err);
  process.exit(1);
});
