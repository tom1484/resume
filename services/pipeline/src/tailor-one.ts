// Manual: tailor + verify a single job by id (or the top scored job).
// Usage: node dist/src/tailor-one.js [jobId]   (no migration — API owns it)
import { pool, query } from './db.js';
import { getConfig } from './config.js';
import { tailorJob } from './tailorJob.js';
import type { Job } from './types.js';

const id = process.argv[2];
const { rows } = id
  ? await query('SELECT * FROM jobs WHERE id=$1', [id])
  : await query("SELECT * FROM jobs WHERE status='scored' ORDER BY score DESC LIMIT 1");
if (!rows.length) {
  console.error('no job found');
  await pool.end();
  process.exit(1);
}
const cfg = await getConfig('llm');
const job = rows[0] as Job;
const result = await tailorJob(job, cfg);
console.log(
  `tailored ${job.id}: ${result.overlay.patches.length} patches kept, ${result.dropped} dropped (${result.model})`
);
await pool.end();
