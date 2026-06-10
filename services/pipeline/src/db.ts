// Postgres pool + query helper. The API owns migrations; the pipeline does not
// run them. We assume the schema (incl. the `config (ns text pk,
// value jsonb)` table) already exists.
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: readonly unknown[]) =>
  pool.query(text, params as unknown[]);
