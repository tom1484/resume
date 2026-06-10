// §6 getConfig(ns) — the construction TODO from contracts/config.ts.
//
// Best-effort read of the `config` table ({ ns text PRIMARY KEY, value jsonb })
// → parseConfig(ns, value) with schema-default fallback on ANY error: a DB hiccup
// (no DB, missing row, malformed jsonb) yields the last-good value, or the schema
// default if we have never read it — never crash.
//
// Read at the top of each pipeline cycle / scheduler tick / on demand. Every
// non-secret setting (models, threshold, batch, poll interval, weights,
// JD-truncation) comes from here, via LlmConfig, etc.
import {
  parseConfig,
  configDefault,
  type ConfigNamespace,
  type ConfigValue,
} from '@resume/contracts';
import { query } from './db.js';

// Last-good cache per namespace: a transient DB failure falls back to the most
// recent successfully-parsed value (or the schema default if never read).
const lastGood = new Map<ConfigNamespace, unknown>();

/**
 * Best-effort config read. Returns the parsed-and-validated config for `ns`,
 * falling back to last-good then schema default on any DB/parse failure.
 */
export async function getConfig<NS extends ConfigNamespace>(
  ns: NS
): Promise<ConfigValue<NS>> {
  try {
    const { rows } = await query(
      'SELECT value FROM config WHERE ns = $1 LIMIT 1',
      [ns]
    );
    if (rows.length) {
      const parsed = parseConfig(ns, rows[0].value);
      if (parsed.success) {
        lastGood.set(ns, parsed.data);
        return parsed.data;
      }
      // Row exists but fails validation: keep last-good / default rather than
      // crash the cycle on a bad UI write.
      console.warn(
        `config[${ns}] failed validation, using fallback:`,
        parsed.error.issues.map((i) => `${i.path.join('/')} ${i.message}`).join('; ')
      );
    }
  } catch (err) {
    // No DB / table / connection — fall back silently (refreshResume semantics).
    console.warn(`config[${ns}] read failed, using fallback:`, (err as Error).message);
  }
  if (lastGood.has(ns)) return lastGood.get(ns) as ConfigValue<NS>;
  return configDefault(ns);
}

/** Reset the last-good cache (tests). */
export function _resetConfigCache() {
  lastGood.clear();
}
