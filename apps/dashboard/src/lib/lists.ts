// Runtime-derived option lists for config dropdowns. (Claude model IDs come from
// `KNOWN_MODELS` in @resume/contracts — not duplicated here.)

const TZ_FALLBACK: readonly string[] = [
  'UTC',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
];

let tzCache: readonly string[] | null = null;

/**
 * The full IANA time-zone list for the timezone combobox (~420 entries), via
 * Intl.supportedValuesOf. Memoized; falls back to a small static list where the
 * API is unavailable (older runtimes / restricted ICU).
 */
export function timeZones(): readonly string[] {
  if (tzCache) return tzCache;
  try {
    const supported = (
      Intl as typeof Intl & {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf?.('timeZone');
    const base = supported && supported.length ? supported : TZ_FALLBACK;
    // supportedValuesOf lists 'Etc/UTC' but not the bare 'UTC' alias, which is a
    // valid zone people expect to pick — surface it at the top.
    tzCache = base.includes('UTC') ? base : ['UTC', ...base];
  } catch {
    tzCache = TZ_FALLBACK;
  }
  return tzCache;
}

/**
 * Curated Indeed country names for the JobSpy `country` dropdown (JobSpy accepts
 * a country NAME used only for Indeed). The field stays free-text in the
 * contract; the UI offers these plus a custom-entry escape hatch.
 */
export const JOBSPY_COUNTRIES: readonly string[] = [
  'USA',
  'United States',
  'Canada',
  'UK',
  'Australia',
  'India',
  'Germany',
  'Netherlands',
  'Ireland',
  'Singapore',
];
