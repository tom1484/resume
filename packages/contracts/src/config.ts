// §6 Config / settings layer — DB-backed, Zod-validated, CRUD'd, UI-mapped.
//
// Every non-secret config is a DB row, Zod-validated, exposed via CRUD, mapped to
// a dashboard tab. Services read it at runtime via a best-effort pull.
//
// §6.1 Secrets boundary (binding): secrets stay in env/.env, NEVER DB, never
// UI-editable: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
// POSTGRES_*/DATABASE_URL, REVIEW_BASIC_AUTH. The config CRUD never reads/writes
// secrets; the dashboard has no field for them.
import { z } from 'zod';
import { Constraint, Preference } from './scoring.js';

// JobSpy's accepted `job_type` values (jobspy_search.py passes it straight to
// scrape_jobs). Tightened from a bare z.string() so the UI can offer a dropdown
// and a bad value is rejected at the write boundary. The Python mirror
// (services/discovery/.../config.py) keeps the same default ('internship') and
// only passes the value through — no Python enforcement needed.
export const JobType = z.enum([
  'fulltime',
  'parttime',
  'internship',
  'contract',
]);
export type JobType = z.infer<typeof JobType>;

// --- LLM (per-stage model + tuning) ---
export const LlmConfig = z
  .object({
    models: z
      .object({
        parse: z.string().default('claude-haiku-4-5'),
        fit: z.string().default('claude-haiku-4-5'),
        tailor: z.string().default('claude-sonnet-4-6'),
        tailorDream: z.string().default('claude-opus-4-8'),
        verify: z.string().default('claude-haiku-4-5'),
      })
      // `.prefault({})` (spec wrote `.default({})`): Zod v4 `.default` wants the
      // OUTPUT type (all fields required); `.prefault({})` parses `{}` →
      // fully-defaulted output, matching the spec's intent. Applies to every
      // `.default({})`-on-all-defaulted-object below.
      .prefault({}),
    scoreThreshold: z.number().min(0).max(1).default(0.65),
    weights: z
      .object({
        keyword: z.number(),
        llmFit: z.number(),
        structural: z.number(),
      })
      .default({ keyword: 0.5, llmFit: 0.3, structural: 0.2 }),
    batchSize: z.number().int().min(1).default(10),
    pollIntervalMs: z.number().int().min(1000).default(60000),
    jdTruncation: z
      .object({
        parse: z.number().default(24000),
        fit: z.number().default(6000),
        tailor: z.number().default(16000),
      })
      .prefault({}),
  })
  .strict();
export type LlmConfig = z.infer<typeof LlmConfig>;

// --- Scheduler (in-process, DB-driven) ---
export const ScheduleConfig = z
  .object({
    discovery: z
      .object({
        enabled: z.boolean().default(true),
        // cron expression evaluated in `tz`; the in-process scheduler reads this
        // each tick so a UI edit takes effect next tick with NO restart.
        cron: z.string().default('0 9 * * *'),
        tz: z.string().default('Asia/Taipei'),
        mode: z.enum(['boards', 'jobspy', 'all']).default('all'),
      })
      .prefault({}),
    // poll loop cadence already in LlmConfig.pollIntervalMs; scheduler owns it too.
  })
  .strict();
export type ScheduleConfig = z.infer<typeof ScheduleConfig>;

// --- Discovery searches + companies ---
export const DiscoverySearch = z
  .object({
    name: z.string(),
    term: z.string(),
    enabled: z.boolean().default(true),
    // NOTE: the JobSpy site list comes from DiscoveryConfig.sites.
  })
  .strict();
export type DiscoverySearch = z.infer<typeof DiscoverySearch>;

export const DiscoveryCompany = z
  .object({
    name: z.string(),
    flags: z.array(z.enum(['dream', 'startup', 'return-path'])).default([]),
    board: z
      .object({
        provider: z.enum(['greenhouse', 'lever', 'ashby']),
        slug: z.string(),
      })
      .nullable(),
    enabled: z.boolean().default(true),
  })
  .strict();
export type DiscoveryCompany = z.infer<typeof DiscoveryCompany>;

export const DiscoveryConfig = z
  .object({
    sites: z.array(z.enum(['indeed', 'linkedin'])).default(['indeed']),
    jobspyDefaults: z
      .object({
        resultsWanted: z.number().int().default(25),
        hoursOld: z.number().int().default(72),
        jobType: JobType.default('internship'),
        country: z.string().default('USA'),
        location: z.string().default('United States'),
      })
      .prefault({}),
    titleInclude: z
      .array(z.string())
      .default(['intern', 'internship', 'co-op', 'coop']),
    exclude: z
      .object({
        title: z
          .array(z.string())
          .default([
            'senior',
            'staff',
            'principal',
            'manager',
            'director',
            'phd',
          ]),
        jd: z
          .array(z.string())
          .default([
            'US citizenship',
            'US citizen',
            'security clearance',
            'ITAR',
            'EAR99',
            'export control',
            'unpaid',
          ]),
      })
      .prefault({}),
    searches: z.array(DiscoverySearch).default([]),
    companies: z.array(DiscoveryCompany).default([]),
  })
  .strict();
export type DiscoveryConfig = z.infer<typeof DiscoveryConfig>;

// --- Constraints / Preferences (§5.2) ---
export const ConstraintsConfig = z.array(Constraint).default([]);
export type ConstraintsConfig = z.infer<typeof ConstraintsConfig>;

export const PreferencesConfig = z.array(Preference).default([]);
export type PreferencesConfig = z.infer<typeof PreferencesConfig>;

// --- Namespace → schema map (§6.3). One DB row per namespace (config table, 005);
//     value jsonb validated by the matching Zod on write. The answers config is a
//     separate table (§7), not a config namespace. ---
export const CONFIG_NAMESPACES = {
  llm: LlmConfig,
  schedule: ScheduleConfig,
  discovery: DiscoveryConfig,
  constraints: ConstraintsConfig,
  preferences: PreferencesConfig,
} as const;

export type ConfigNamespace = keyof typeof CONFIG_NAMESPACES;

/** Inferred value type for a given config namespace. */
export type ConfigValue<NS extends ConfigNamespace> = z.infer<
  (typeof CONFIG_NAMESPACES)[NS]
>;

/**
 * Validate a raw config value against its namespace schema. Throws on an unknown
 * namespace; otherwise returns the Zod safeParse result (the caller decides the
 * fallback). The actual DB read is the API agent's job — getConfig() layers a
 * best-effort DB fetch + schema-default fallback (DB hiccup → last-good/defaults,
 * never crash) on top of this.
 */
export function parseConfig<NS extends ConfigNamespace>(
  ns: NS,
  value: unknown
): z.ZodSafeParseResult<ConfigValue<NS>> {
  const schema = CONFIG_NAMESPACES[ns];
  if (!schema) throw new Error(`unknown config namespace: ${String(ns)}`);
  return schema.safeParse(value) as z.ZodSafeParseResult<ConfigValue<NS>>;
}

/**
 * Schema-default value for a namespace. Object namespaces (llm/schedule/
 * discovery) have all-defaulted fields, so `parse({})` yields the full default;
 * the list namespaces (constraints/preferences) are `z.array().default([])`, so
 * `parse([])` yields `[]`. This is the getConfig() fallback.
 */
export function configDefault<NS extends ConfigNamespace>(
  ns: NS
): ConfigValue<NS> {
  const seed: unknown = ns === 'constraints' || ns === 'preferences' ? [] : {};
  return CONFIG_NAMESPACES[ns].parse(seed) as ConfigValue<NS>;
}

// TODO(construction): getConfig(ns) — the best-effort DB read + last-good cache +
// schema-default fallback — is the API/pipeline agent's job (§6.2). This module
// owns only the types + parseConfig/configDefault helpers.
