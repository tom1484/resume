// One-shot: run a single cycle, exit. For manual runs and evals. No migration
// (API owns migrations); the schema is assumed to exist.
import { pool } from './db.js';
import { cycle } from './cycle.js';

await cycle();
await pool.end();
