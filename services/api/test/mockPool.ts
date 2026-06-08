// A tiny in-memory mock of the pg Pool surface (.query / .connect) for unit
// tests — NO live Postgres (DB integration is the integrator's job at merge).
// Tests register handlers keyed by a substring of the SQL; the first match
// returns its rows. A captured call log lets tests assert what was written.
import type { PoolLike, PoolClient } from '../src/pool.js';

export interface QueryCall {
  sql: string;
  params: readonly unknown[];
}

type Responder = (
  params: readonly unknown[],
  call: QueryCall
) => { rows: Record<string, unknown>[]; rowCount: number | null };

export class MockPool implements PoolLike {
  readonly calls: QueryCall[] = [];
  private readonly handlers: { match: string; respond: Responder }[] = [];
  private fallback: Responder = () => ({ rows: [], rowCount: 0 });

  /** Register a responder for SQL containing `match` (first registered wins). */
  on(match: string, respond: Responder | Record<string, unknown>[]): this {
    const fn: Responder =
      typeof respond === 'function'
        ? respond
        : () => ({ rows: respond, rowCount: respond.length });
    this.handlers.push({ match, respond: fn });
    return this;
  }

  /** Default responder when no `on()` matches. */
  setFallback(respond: Responder): this {
    this.fallback = respond;
    return this;
  }

  async query(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> {
    const call: QueryCall = { sql, params };
    this.calls.push(call);
    const norm = sql.replace(/\s+/g, ' ');
    for (const h of this.handlers) {
      if (norm.includes(h.match)) return h.respond(params, call);
    }
    return this.fallback(params, call);
  }

  async connect(): Promise<PoolClient> {
    const self = this;
    return {
      query: (sql: string, params?: readonly unknown[]) =>
        self.query(sql, params),
      release: () => {},
    };
  }

  /** Find the first captured call whose SQL contains `match`. */
  find(match: string): QueryCall | undefined {
    const m = match.replace(/\s+/g, ' ');
    return this.calls.find((c) => c.sql.replace(/\s+/g, ' ').includes(m));
  }
}
