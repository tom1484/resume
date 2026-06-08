// Manual: tailor + verify a single job by id (or the top scored job).
// Usage: node src/tailor-one.js [jobId]
import { pool, query } from './db.js';
import { migrate } from './migrate.js';
import { tailorJob } from './tailorJob.js';

await migrate();
const id = process.argv[2];
const { rows } = id
  ? await query('SELECT * FROM jobs WHERE id=$1', [id])
  : await query("SELECT * FROM jobs WHERE status='scored' ORDER BY score DESC LIMIT 1");
if (!rows.length) {
  console.error('no job found');
  await pool.end();
  process.exit(1);
}
const result = await tailorJob(rows[0]);
console.log(`tailored ${rows[0].id}: ${result.overlay.patches.length} patches kept, ${result.dropped} dropped (${result.model})`);
await pool.end();
