// One-time v1→v2 data migration (CONTRACTS.md §12). Reads an EXPORT of the live
// stack (never the live DB), transforms every record to the v2 §2/§4/§5/§11
// shapes, validates each with the @resume/contracts Zod, QUARANTINES + logs
// non-conformers (never silently drops, §12.3), and — unless --dry-run — writes
// the result to the target DB.
//
// SAFETY: this script NEVER touches a live DB on its own. The integrator runs it
// at cutover against a fresh v2 DB; by default it is --dry-run and writes nothing
// (DATABASE_URL must be present AND --apply passed to mutate). It reuses the
// frozen reshapers (resumeV1ToV2 / masterV1ToV2) verbatim.
//
// Usage:
//   node dist/scripts/migrate-v1-to-v2.js --export <dir> [--dry-run] [--apply] [--out <file>]
//   (default is --dry-run; pass --apply to actually write to DATABASE_URL.)
//
// EXPORT directory shape (the integrator assembles this from the live stack;
// the two YAMLs are pre-converted to JSON to keep this script dependency-light):
//   <dir>/resume_version.json   latest resume_versions.data (v1 JSON-Resume+x- doc)
//   <dir>/jobs.json             jobs[] rows (incl. overlay/parsed/score_breakdown/audit)
//   <dir>/answers.json          answers[] rows (KEEP as-is)            [optional]
//   <dir>/master.json           v1 master bank (incl. metrics)          [optional, file-based: NOT seeded to DB]
//   <dir>/discovery.json        { searches:[], companies:[], sites?, jobspyDefaults?, ... } (parsed YAMLs) [optional]
//   <dir>/env.json              { models?, scoreThreshold?, batchSize?, pollIntervalMs?, cron?, tz?, mode?, sites? } (compose/.env non-secrets) [optional]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ResumeDoc,
  Overlay,
  Audit,
  JdSchema,
  ScoreBreakdown,
  Answer,
  MasterBank,
  overlayProblems,
  parseConfig,
  type ConfigNamespace,
} from '@resume/contracts';
// Run via Node's native TS type-stripping (see package.json migrate-v1-to-v2 +
// tsconfig.scripts.json), so the frozen root reshapers are imported with `.ts`
// extensions — Node does NOT rewrite `.js`→`.ts` for type-stripped sources.
import { migrateResumeV1ToV2 } from '../../../scripts/migrate/resumeV1ToV2.ts';
import { migrateMasterV1ToV2 } from '../../../scripts/migrate/masterV1ToV2.ts';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
interface Args {
  exportDir: string;
  dryRun: boolean;
  apply: boolean;
  out: string | null;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { exportDir: '', dryRun: true, apply: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--export') a.exportDir = argv[++i] ?? '';
    else if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--apply') a.apply = true;
    else if (arg === '--out') a.out = argv[++i] ?? null;
  }
  // --apply turns off the dry-run default; otherwise we stay dry.
  if (a.apply) a.dryRun = false;
  return a;
}

// ---------------------------------------------------------------------------
// Report scaffolding (quarantine, never drop — §12.3)
// ---------------------------------------------------------------------------
interface Quarantined {
  kind: string;
  id?: string;
  problems: string[];
}
interface Report {
  resume: { migrated: boolean; problems: string[] };
  jobs: {
    total: number;
    overlaysKept: number;
    overlaysDropped: number;
    parsedNulled: number;
    scoreBreakdownNulled: number;
    auditNulled: number;
  };
  answers: { total: number; kept: number };
  config: { namespaces: string[] };
  quarantine: Quarantined[];
}

function readJson<T>(dir: string, name: string): T | null {
  const p = join(dir, name);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

const problemsOf = (
  issues: readonly { path: readonly PropertyKey[]; message: string }[]
): string[] =>
  issues.map((i) => `${i.path.map(String).join('/')} ${i.message}`);

// ---------------------------------------------------------------------------
// Step transforms (each returns the transformed value or quarantines)
// ---------------------------------------------------------------------------

/** §12.2 step 1 — résumé reshape via the frozen reshaper (validates internally). */
function migrateResume(
  oldDoc: unknown,
  q: Quarantined[]
): unknown | null {
  try {
    return migrateResumeV1ToV2(oldDoc); // throws (ResumeDoc.parse) on non-conformance
  } catch (err) {
    q.push({
      kind: 'resume',
      problems: [err instanceof Error ? err.message : String(err)],
    });
    return null;
  }
}

interface V1Job {
  id?: string;
  overlay?: unknown;
  parsed?: unknown;
  score_breakdown?: unknown;
  audit?: unknown;
  [k: string]: unknown;
}

/** §12.2 steps 3+4 — per-job overlay/parsed/score_breakdown/audit re-validation.
 *  Paths stay valid (slot-preservation), so overlays generally re-validate; any
 *  that don't are DROPPED (nulled) + logged so the job can be re-tailored. The
 *  job ROW + id + dedupe key are always KEPT. */
function migrateJob(
  job: V1Job,
  migratedResume: unknown,
  q: Quarantined[],
  counters: Report['jobs']
): V1Job {
  const out: V1Job = { ...job };
  const id = job.id ?? '(unknown)';

  // overlay: normalize groundedIn refs to bare <id> (§11), then re-validate with
  // Overlay Zod + overlayProblems against the migrated résumé.
  if (job.overlay != null) {
    const normalized = normalizeGroundedIn(job.overlay);
    const parsed = Overlay.safeParse(normalized);
    const probs = parsed.success
      ? overlayProblems(parsed.data, migratedResume)
      : problemsOf(parsed.error.issues);
    if (parsed.success && probs.length === 0) {
      out.overlay = parsed.data;
      counters.overlaysKept++;
    } else {
      out.overlay = null;
      counters.overlaysDropped++;
      q.push({ kind: 'job.overlay', id, problems: probs });
    }
  }

  // parsed → JdSchema
  if (job.parsed != null) {
    const p = JdSchema.safeParse(job.parsed);
    if (p.success) out.parsed = p.data;
    else {
      out.parsed = null;
      counters.parsedNulled++;
      q.push({ kind: 'job.parsed', id, problems: problemsOf(p.error.issues) });
    }
  }

  // score_breakdown → ScoreBreakdown (synthesize constraintsFired from old
  // freetext where present; else []).
  if (job.score_breakdown != null) {
    const sb = ScoreBreakdown.safeParse(
      coerceScoreBreakdown(job.score_breakdown)
    );
    if (sb.success) out.score_breakdown = sb.data;
    else {
      out.score_breakdown = null;
      counters.scoreBreakdownNulled++;
      q.push({
        kind: 'job.score_breakdown',
        id,
        problems: problemsOf(sb.error.issues),
      });
    }
  }

  // audit → Audit
  if (job.audit != null) {
    const au = Audit.safeParse(job.audit);
    if (au.success) out.audit = au.data;
    else {
      out.audit = null;
      counters.auditNulled++;
      q.push({ kind: 'job.audit', id, problems: problemsOf(au.error.issues) });
    }
  }

  return out;
}

/** §11 flag: standardize groundedIn refs on bare <id> (strip any `master:`). */
function normalizeGroundedIn(overlay: unknown): unknown {
  if (!overlay || typeof overlay !== 'object') return overlay;
  const o = JSON.parse(JSON.stringify(overlay)) as {
    audit?: { claims?: { groundedIn?: string[] }[] };
  };
  const strip = (refs?: string[]): string[] | undefined =>
    refs?.map((r) => (r.startsWith('master:') ? r.slice('master:'.length) : r));
  if (o.audit?.claims) {
    for (const c of o.audit.claims) if (c.groundedIn) c.groundedIn = strip(c.groundedIn);
  }
  return o;
}

/** Best-effort coercion of the v1 untyped score_breakdown blob to the v2 shape.
 *  Missing arrays default empty; old freetext `structuralReasons` is preserved
 *  as constraintsFired only when it already carries ids — otherwise []. */
function coerceScoreBreakdown(raw: unknown): unknown {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    keyword: typeof r.keyword === 'number' ? r.keyword : 0,
    missingTerms: Array.isArray(r.missingTerms) ? r.missingTerms : [],
    llmFit: typeof r.llmFit === 'number' ? r.llmFit : 0,
    rationale: typeof r.rationale === 'string' ? r.rationale : '',
    redFlags: Array.isArray(r.redFlags) ? r.redFlags : [],
    structural: typeof r.structural === 'number' ? r.structural : 0,
    constraintsFired: Array.isArray(r.constraintsFired) ? r.constraintsFired : [],
    preferencesApplied: Array.isArray(r.preferencesApplied)
      ? r.preferencesApplied
      : [],
    weights:
      r.weights && typeof r.weights === 'object'
        ? r.weights
        : { keyword: 0.5, llmFit: 0.3, structural: 0.2 },
  };
}

// ---------------------------------------------------------------------------
// §12.2 step 5 — config seeding
// ---------------------------------------------------------------------------

/** The three F-1 seed constraints (§5.2 mapping table). */
const SEED_CONSTRAINTS = [
  {
    id: 'f1-no-citizenship',
    label: 'must accept F-1 (no citizenship/clearance)',
    field: 'citizenshipOrClearanceRequired',
    test: { kind: 'isTrue' },
    effect: { kind: 'hard' },
    enabled: true,
  },
  {
    id: 'f1-seniority',
    label: 'internship-level only',
    field: 'seniority',
    test: { kind: 'notIn', values: ['intern', 'entry', 'unspecified'] },
    effect: { kind: 'penalty', amount: 0.6 },
    enabled: true,
  },
  {
    id: 'f1-sponsorship',
    label: 'penalize no-sponsorship roles',
    field: 'sponsorshipAvailable',
    test: { kind: 'equals', value: 'no' },
    effect: { kind: 'penalty', amount: 0.4 },
    enabled: true,
  },
];

/** The one lifted preference (the v1 profile.js:51 anchor). */
const SEED_PREFERENCES = [
  {
    id: 'summer-2027-robotics',
    text: 'Summer 2027 robotics/embedded internships; F-1/CPT (no sponsorship for the internship).',
    priority: 8,
    enabled: true,
  },
];

interface DiscoveryExport {
  searches?: unknown[];
  companies?: unknown[];
  sites?: unknown[];
  jobspyDefaults?: unknown;
  titleInclude?: unknown[];
  exclude?: unknown;
}
interface EnvExport {
  models?: Record<string, string>;
  scoreThreshold?: number;
  weights?: { keyword: number; llmFit: number; structural: number };
  batchSize?: number;
  pollIntervalMs?: number;
  jdTruncation?: { parse?: number; fit?: number; tailor?: number };
  cron?: string;
  tz?: string;
  mode?: 'boards' | 'jobspy' | 'all';
  sites?: ('indeed' | 'linkedin')[];
}

/** Seed every config namespace, validating each with parseConfig. Drops dead
 *  discovery keys (keywords/locations/defaults.sites) by only forwarding the live
 *  fields the v2 DiscoveryConfig knows. */
function buildConfig(
  discovery: DiscoveryExport | null,
  env: EnvExport | null,
  q: Quarantined[]
): { ns: ConfigNamespace; value: unknown }[] {
  const out: { ns: ConfigNamespace; value: unknown }[] = [];

  const push = (ns: ConfigNamespace, raw: unknown): void => {
    const parsed = parseConfig(ns, raw);
    if (parsed.success) out.push({ ns, value: parsed.data });
    else q.push({ kind: `config.${ns}`, problems: problemsOf(parsed.error.issues) });
  };

  // discovery: forward only the live v2 fields (drop searches[].keywords,
  // locations, defaults.sites — §10 dead). searches/companies pass through the
  // per-item Zod via parseConfig.
  const disc: Record<string, unknown> = {};
  if (discovery?.sites) disc.sites = discovery.sites;
  else if (env?.sites) disc.sites = env.sites; // JOBSPY_SITES env wins (§10)
  if (discovery?.jobspyDefaults) disc.jobspyDefaults = discovery.jobspyDefaults;
  if (discovery?.titleInclude) disc.titleInclude = discovery.titleInclude;
  if (discovery?.exclude) disc.exclude = discovery.exclude;
  if (discovery?.searches)
    disc.searches = discovery.searches.map((s) => stripDeadSearchKeys(s));
  if (discovery?.companies) disc.companies = discovery.companies;
  push('discovery', disc);

  // llm from compose/.env non-secrets (schema defaults fill the rest).
  const llm: Record<string, unknown> = {};
  if (env?.models) llm.models = env.models;
  if (env?.scoreThreshold != null) llm.scoreThreshold = env.scoreThreshold;
  if (env?.weights) llm.weights = env.weights;
  if (env?.batchSize != null) llm.batchSize = env.batchSize;
  if (env?.pollIntervalMs != null) llm.pollIntervalMs = env.pollIntervalMs;
  if (env?.jdTruncation) llm.jdTruncation = env.jdTruncation;
  push('llm', llm);

  // schedule from crontab/TZ defaults.
  const schedule: Record<string, unknown> = {
    discovery: {
      ...(env?.cron ? { cron: env.cron } : {}),
      ...(env?.tz ? { tz: env.tz } : {}),
      ...(env?.mode ? { mode: env.mode } : {}),
    },
  };
  push('schedule', schedule);

  // constraints + preferences seeds (§5.2).
  push('constraints', SEED_CONSTRAINTS);
  push('preferences', SEED_PREFERENCES);

  return out;
}

/** Drop the dead per-search keys (keywords) — keep name/term/enabled (§10). */
function stripDeadSearchKeys(s: unknown): unknown {
  if (!s || typeof s !== 'object') return s;
  const { name, term, enabled } = s as {
    name?: unknown;
    term?: unknown;
    enabled?: unknown;
  };
  return {
    name,
    term,
    ...(enabled !== undefined ? { enabled } : {}),
  };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
export interface MigrationResult {
  report: Report;
  migratedResume: unknown | null;
  migratedJobs: V1Job[];
  answers: unknown[];
  configRows: { ns: ConfigNamespace; value: unknown }[];
  master: unknown | null;
}

/** Pure transform: read an export dir, produce the migrated payload + report. No
 *  DB I/O (the writer is separate so tests + dry-run stay side-effect free). */
export function buildMigration(exportDir: string): MigrationResult {
  const q: Quarantined[] = [];
  const report: Report = {
    resume: { migrated: false, problems: [] },
    jobs: {
      total: 0,
      overlaysKept: 0,
      overlaysDropped: 0,
      parsedNulled: 0,
      scoreBreakdownNulled: 0,
      auditNulled: 0,
    },
    answers: { total: 0, kept: 0 },
    config: { namespaces: [] },
    quarantine: q,
  };

  // step 1: résumé
  const oldResume = readJson<unknown>(exportDir, 'resume_version.json');
  const migratedResume = migrateResume(oldResume, q);
  report.resume.migrated = migratedResume !== null;
  if (migratedResume === null)
    report.resume.problems = q
      .filter((x) => x.kind === 'resume')
      .flatMap((x) => x.problems);

  // step 2: master.json (file-based; NOT seeded to DB — just validated/reshaped)
  let master: unknown | null = null;
  const oldMaster = readJson<unknown>(exportDir, 'master.json');
  if (oldMaster != null) {
    try {
      master = migrateMasterV1ToV2(oldMaster);
    } catch (err) {
      q.push({
        kind: 'master',
        problems: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  // steps 3+4: jobs
  const jobs = readJson<V1Job[]>(exportDir, 'jobs.json') ?? [];
  report.jobs.total = jobs.length;
  const migratedJobs = jobs.map((j) =>
    migrateJob(j, migratedResume, q, report.jobs)
  );

  // answers (KEEP as-is; validate shape, quarantine non-conformers)
  const rawAnswers = readJson<unknown[]>(exportDir, 'answers.json') ?? [];
  report.answers.total = rawAnswers.length;
  const answers = rawAnswers.filter((a) => {
    const p = Answer.safeParse(a);
    if (p.success) return true;
    q.push({ kind: 'answer', problems: problemsOf(p.error.issues) });
    return false;
  });
  report.answers.kept = answers.length;

  // step 5: config seeding
  const discovery = readJson<DiscoveryExport>(exportDir, 'discovery.json');
  const env = readJson<EnvExport>(exportDir, 'env.json');
  const configRows = buildConfig(discovery, env, q);
  report.config.namespaces = configRows.map((c) => c.ns);

  // validate the migrated master against MasterBank one more time for the report
  if (master != null) MasterBank.parse(master);

  return { report, migratedResume, migratedJobs, answers, configRows, master };
}

/** Write the migrated payload to DATABASE_URL (only when --apply). Imports pg
 *  lazily so a dry-run never needs a DB driver/connection. Assumes the v2 schema
 *  (incl. 005_config) already exists — the integrator boots the v2 API first,
 *  which applies migrations at startup, then runs this one-shot at cutover. */
async function applyMigration(result: MigrationResult): Promise<void> {
  if (!process.env.DATABASE_URL)
    throw new Error('--apply requires DATABASE_URL (the target v2 DB)');
  const pg = (await import('pg')).default;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (result.migratedResume != null) {
      await pool.query(
        "INSERT INTO resume_versions (data, note) VALUES ($1, 'migration v1→v2')",
        [JSON.stringify(result.migratedResume)]
      );
    }
    for (const j of result.migratedJobs) {
      await pool.query(
        `UPDATE jobs SET overlay=$2, parsed=$3, score_breakdown=$4, audit=$5, updated_at=now() WHERE id=$1`,
        [
          j.id,
          j.overlay != null ? JSON.stringify(j.overlay) : null,
          j.parsed != null ? JSON.stringify(j.parsed) : null,
          j.score_breakdown != null ? JSON.stringify(j.score_breakdown) : null,
          j.audit != null ? JSON.stringify(j.audit) : null,
        ]
      );
    }
    for (const a of result.answers) {
      const ans = a as { key: string; question: string; answer: string };
      await pool.query(
        `INSERT INTO answers (key, question, answer) VALUES ($1,$2,$3)
         ON CONFLICT (key) DO NOTHING`,
        [ans.key, ans.question, ans.answer]
      );
    }
    for (const c of result.configRows) {
      await pool.query(
        `INSERT INTO config (ns, value) VALUES ($1,$2)
         ON CONFLICT (ns) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
        [c.ns, JSON.stringify(c.value)]
      );
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.exportDir) {
    // eslint-disable-next-line no-console
    console.error(
      'usage: migrate-v1-to-v2 --export <dir> [--dry-run] [--apply] [--out <file>]'
    );
    process.exit(2);
  }
  const result = buildMigration(args.exportDir);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result.report, null, 2));

  if (args.out) {
    writeFileSync(
      args.out,
      JSON.stringify(
        {
          resume_version: result.migratedResume,
          jobs: result.migratedJobs,
          answers: result.answers,
          config: result.configRows,
          master: result.master,
        },
        null,
        2
      ) + '\n'
    );
    // eslint-disable-next-line no-console
    console.log(`wrote migrated payload → ${args.out}`);
  }

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log('\n[dry-run] no DB writes. Pass --apply to write to DATABASE_URL.');
    return;
  }
  await applyMigration(result);
  // eslint-disable-next-line no-console
  console.log('[apply] migration written to DATABASE_URL.');
}

// Run as CLI only (importable for tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
