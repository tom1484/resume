// Best-effort config reader (CONTRACTS.md §6.2): one `config` row per namespace,
// value jsonb validated by the matching @resume/contracts Zod. Reads are
// best-effort — a DB hiccup or a malformed/absent row falls back to the schema
// default (best-effort, like refreshResume(): never crash on config).
//
// The pipeline/scheduler agents read config the same way at runtime; this module
// is the API's copy of that helper (it owns config CRUD).
import {
  CONFIG_NAMESPACES,
  configDefault,
  parseConfig,
  type ConfigNamespace,
  type ConfigValue,
} from '@resume/contracts';
import type { Queryable } from './pool.js';

export const CONFIG_NS = Object.keys(CONFIG_NAMESPACES) as ConfigNamespace[];

/** Type guard: is `ns` a known config namespace? (validate `:ns` route param). */
export function isConfigNs(ns: string): ns is ConfigNamespace {
  return Object.prototype.hasOwnProperty.call(CONFIG_NAMESPACES, ns);
}

/**
 * Read a namespace's config value: DB row → Zod parse → on any failure, the
 * schema default. Never throws (returns the default), so callers can read config
 * inline without a try/catch.
 */
export async function getConfig<NS extends ConfigNamespace>(
  db: Queryable,
  ns: NS
): Promise<ConfigValue<NS>> {
  try {
    const { rows } = await db.query('SELECT value FROM config WHERE ns = $1', [
      ns,
    ]);
    if (!rows.length) return configDefault(ns);
    const parsed = parseConfig(ns, rows[0]?.value);
    return parsed.success ? parsed.data : configDefault(ns);
  } catch {
    return configDefault(ns);
  }
}
