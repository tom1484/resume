// Long-running worker: migrations at startup, then cycle() forever.
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { cycle, POLL_MS, BATCH, THRESHOLD } from './cycle.js';

async function main() {
  await migrate();
  console.log(`poller up: batch=${BATCH} every ${POLL_MS}ms, threshold=${THRESHOLD}`);
  for (;;) {
    try {
      await cycle();
    } catch (err) {
      console.error('cycle failed:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
