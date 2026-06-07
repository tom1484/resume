// One-shot: migrate, run a single cycle, exit. For manual runs and evals.
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { cycle } from './cycle.js';

await migrate();
await cycle();
await pool.end();
