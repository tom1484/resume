// Long-running worker: cycle() forever, sleeping LlmConfig.pollIntervalMs
// between cycles. The pipeline NO LONGER runs migrations — the API owns them
// (v2 split); the schema (incl. the config table) is assumed to exist.
import { pool } from './db.js';
import { getConfig } from './config.js';
import { cycle } from './cycle.js';

async function main() {
  const cfg0 = await getConfig('llm');
  console.log(
    `poller up: batch=${cfg0.batchSize} every ${cfg0.pollIntervalMs}ms, threshold=${cfg0.scoreThreshold} (config-driven)`
  );
  for (;;) {
    let pollMs = cfg0.pollIntervalMs;
    try {
      await cycle();
    } catch (err) {
      console.error('cycle failed:', (err as Error).message);
    }
    // Re-read poll cadence each loop so a UI edit takes effect without restart.
    try {
      pollMs = (await getConfig('llm')).pollIntervalMs;
    } catch {
      /* keep last */
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
