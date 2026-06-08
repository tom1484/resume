// Shared pg Pool. DATABASE_URL holds the Postgres creds — a SECRET, stays in env
// (§6.1), never DB/UI. Exported as a thin wrapper so tests can inject a mock
// pool (createApp/runMigrations take a Queryable; nothing here requires a live DB
// at import time).
import pg from 'pg';

/** The narrow surface the API + migration runner need from a pg pool/client. */
export interface Queryable {
  query: (
    text: string,
    params?: readonly unknown[]
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

/** A pool that can also hand out single clients (the migration runner needs a
 *  dedicated client to run BEGIN/COMMIT on one connection). */
export interface PoolLike extends Queryable {
  connect: () => Promise<PoolClient>;
  end?: () => Promise<void>;
}

export interface PoolClient extends Queryable {
  release: () => void;
}

let singleton: pg.Pool | null = null;

/** Lazily construct the process-wide pool from DATABASE_URL. */
export function getPool(): pg.Pool {
  if (!singleton) {
    singleton = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return singleton;
}
