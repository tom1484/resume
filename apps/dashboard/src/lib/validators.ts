// Lightweight, presentational field validators for the config pages. These run
// live as the user types (inline error / warning) and COMPLEMENT — never replace
// — the authoritative on-save `parseConfig` (contracts Zod) + SaveBar flow.

// --- cron ---------------------------------------------------------------------
// Mirrors the scheduler's matcher (services/discovery/src/discovery/cron.py):
// 5 fields (minute hour day-of-month month day-of-week); each field supports
// `*`, an int, `a-b` ranges, `a,b` lists, and `*/n` / `a-b/n` steps. We add
// bound-checking the Python parser skips, so the UI flags a cron that would
// silently never fire.
const CRON_FIELDS = [
  { name: 'minute', lo: 0, hi: 59 },
  { name: 'hour', lo: 0, hi: 23 },
  { name: 'day-of-month', lo: 1, hi: 31 },
  { name: 'month', lo: 1, hi: 12 },
  { name: 'day-of-week', lo: 0, hi: 7 },
] as const;

const INT = /^\d+$/;

function validateCronField(
  spec: string,
  lo: number,
  hi: number,
  name: string
): string | undefined {
  for (const part of spec.split(',')) {
    if (part === '') return `${name}: empty term`;
    let range = part;
    if (part.includes('/')) {
      const bits = part.split('/');
      if (bits.length !== 2 || !INT.test(bits[1]) || Number(bits[1]) < 1)
        return `${name}: step must be a positive integer in "${part}"`;
      range = bits[0];
    }
    let start: number;
    let end: number;
    if (range === '*') {
      start = lo;
      end = hi;
    } else if (range.includes('-')) {
      const ab = range.split('-');
      if (ab.length !== 2 || !INT.test(ab[0]) || !INT.test(ab[1]))
        return `${name}: bad range "${range}"`;
      start = Number(ab[0]);
      end = Number(ab[1]);
      if (start > end) return `${name}: range start > end in "${range}"`;
    } else {
      if (!INT.test(range))
        return `${name}: "${range}" is not a number, range, or *`;
      start = end = Number(range);
    }
    if (start < lo || end > hi) return `${name}: out of range (${lo}-${hi})`;
  }
  return undefined;
}

/** Returns a human-readable error, or undefined when the cron is valid. */
export function validateCron(expr: string): string | undefined {
  const trimmed = expr.trim();
  if (!trimmed) return 'cron expression is required';
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5)
    return `cron must have 5 fields (min hour day-of-month month day-of-week), got ${fields.length}`;
  for (let i = 0; i < CRON_FIELDS.length; i++) {
    const f = CRON_FIELDS[i];
    const err = validateCronField(fields[i], f.lo, f.hi, f.name);
    if (err) return err;
  }
  return undefined;
}

// --- timezone -----------------------------------------------------------------
/**
 * True iff `tz` is a valid IANA time zone. Uses Intl.DateTimeFormat, which
 * throws RangeError on an unknown zone — works even where
 * Intl.supportedValuesOf is unavailable.
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// --- scoring weights ----------------------------------------------------------
/**
 * Advisory only: the contract does NOT require the weights to sum to 1, but a
 * sum far from 1 is almost always a mistake. Returns a soft warning or undefined.
 */
export function weightsSumWarning(w: {
  keyword: number;
  llmFit: number;
  structural: number;
}): string | undefined {
  const sum = (w.keyword ?? 0) + (w.llmFit ?? 0) + (w.structural ?? 0);
  if (Math.abs(sum - 1) > 0.01)
    return `weights sum to ${sum.toFixed(2)} (expected ≈ 1.00)`;
  return undefined;
}
