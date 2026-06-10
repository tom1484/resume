# Architecture & data flow

## Scope
System map for the whole repo: the **contracts package** (the SSoT spine), the
**dashboard SPA** + the **bare résumé host**, the three backend services
(discovery / pipeline / api), the Postgres DB, the **config layer** — plus the two
end-to-end flows (scheduled discover→score→tailor→verify→review, and human
review/config/résumé-edit through the API). This is the "map"; field-level shapes
live in [./data-contracts.md](./data-contracts.md) → `docs/CONTRACTS.md`,
per-stage internals in [./pipeline.md](./pipeline.md), UI/renderer in
[./frontend.md](./frontend.md).

## Read this when
- You need to know which package/service owns a step before editing it.
- Tracing a job from a board posting to the Telegram review link.
- Tracing how a reviewer's approve/edit/overlay-save / config-edit / résumé-edit
  reaches the DB.
- Figuring out which container talks to which, over which network.
- Adding a pipeline stage, route, config namespace, or frontend tab.

## Components

| Component | Path | Runtime | Container | Role |
|---|---|---|---|---|
| **contracts** | `packages/contracts/src` | TS lib (`@resume/contracts`) | — | the Zod **single source of truth**; emits `dist/schemas/*.json` for Ajv consumers. Imported by renderer, dashboard, api, pipeline |
| renderer pkg | `packages/renderer/src` | TSX source pkg (`@resume/renderer`) | — | résumé components + `data/` layer (adapter/overlay/editorModel/print) + `editor/ResumeTree`; consumed by `apps/site` (Vite aliases) and `apps/dashboard` (deep subpaths) |
| dashboard SPA | `apps/dashboard` | Vite SPA (shadcn/ui + react-router) | (in `jobs-api`) | the ONE admin UI at `/`: review inbox/detail, résumé editor, config tabs, dashboard/ledger |
| bare site host | `apps/site` | Vite SPA (chrome-less) | (in `jobs-api`) | renders the canonical résumé / an overlay at `/resume/`; print/PDF target + the dashboard's review preview (iframed) |
| discovery | `services/discovery` | Python (uv) | `jobs-discovery` | in-process DB-driven scheduler → boards + JobSpy fetch → normalize → typed-validate → upsert |
| pipeline | `services/pipeline` | Node TS | `jobs-pipeline` | poller: parse→score(two lists)→gate→tailor→verify→in_review→notify |
| api | `services/api` | Fastify 5 (port 8080) | `jobs-api` | review/config/dashboard REST API + serves both SPAs + **applies DB migrations at startup** |
| db | image `pgvector/pgvector:pg17` | Postgres+pgvector | `jobs-db` | single source of truth (`jobs, events, answers, resume_versions, config`) |

The `jobs-api` container co-locates BOTH built SPAs: `services/api/Dockerfile`
builds `site` (with `VITE_BASE=/resume/`) and `dashboard`, copies them to
`/app/site` and `/app/dashboard`; `app.ts` serves them via `@fastify/static`.

## Entry points

| Process | Entry | Notes |
|---|---|---|
| API server (long-running) | `services/api/src/server.ts` → `runMigrations(pool)` then `createApp({pool}).listen(:8080)` | container CMD `node dist/src/server.js` |
| migrations runner | `services/api/migrations/run.ts` `runMigrations()` | applies `migrations/*.sql` in filename order once each, tracked in `schema_migrations`; run at API startup |
| pipeline poller (long-running) | `services/pipeline/src/poller.ts` → `cycle()` forever, sleeping `LlmConfig.pollIntervalMs` | container CMD `node dist/src/poller.js`; **does NOT migrate** (API owns it) |
| one cycle (manual) | `services/pipeline/src/run-once.ts` | one `cycle()` + exit |
| tailor one job (manual) | `services/pipeline/src/tailor-one.ts [jobId]` | `tailorJob()` on a job or the top `scored` |
| discovery scheduler (long-running) | `services/discovery/src/discovery/scheduler.py` `loop()` | container CMD `python -m discovery.scheduler`; per-minute tick, DB-driven |
| discovery (one-shot) | `python -m discovery.main --boards/--jobspy/--all/--dry-run` | the scheduler calls `main.run(mode, conn=…)` in-process |
| bare résumé render boot | `apps/site/src/index.tsx` → `buildPayload()` → `<App payload>` | branches on `?application` param |
| dashboard SPA boot | `apps/dashboard/src/main.tsx` → `RouterProvider` (`router.tsx`) | client-side routes under `Shell` |

## Flow 1 — scheduled discovery → review (autonomous)

Each hop names the exact module/function. Stage internals → [./pipeline.md](./pipeline.md).

1. **Schedule** (`jobs-discovery`, Python). `scheduler.loop()` ticks every 60s
   (`scheduler.py:27`). Each tick it re-reads `ScheduleConfig` via
   `config.get_config(conn, 'schedule')` (best-effort, schema-default fallback);
   when `discovery.enabled` and the `cron` (5-field, `cron.py`) matches the current
   minute in `tz`, it calls `main.run(mode, conn=conn)` in-process. **A UI schedule
   edit takes effect next tick, no restart.**
2. **Discover** (`main.run`). Reads `DiscoveryConfig` via `get_config('discovery')`,
   then:
   - `run_boards()` → `boards.FETCHERS[provider]` (greenhouse/lever/ashby HTTP) →
     `normalize.PROVIDER_NORMALIZERS[provider]` → `is_internship()` filter →
     `normalize.finalize()` (attaches `company_flags`, `dedupe_key`, and a skip
     `status`/`skip_reason` via title/JD exclusion rules). `time.sleep(1)` between
     companies.
   - `run_jobspy()` → `jobspy_search.run_searches(cfg, flags_by_company)` (Indeed
     by default; one country-wide call per enabled search term, jittered 3–10s).
   - `store.upsert()` **validates each record against the `DiscoveredJob` contract**
     (`jobrow.validate_record`, pydantic `extra='forbid'`) BEFORE the SQL — a
     non-conforming record is logged + skipped, never silently dict-sliced. INSERT
     is `ON CONFLICT DO NOTHING` (`dedupe_key` unique) → rows land at `status='new'`.
     `store.log_event(conn, 'discover', …)` writes a run-level `events` row.
3. **Claim** (`jobs-pipeline`). `cycle()` (`cycle.ts`) reads `getConfig('llm')`
   (models/threshold/weights/batch/truncation), calls `profile.refreshResume()`
   (pulls the latest `resume_versions` row), then `claimBatch(cfg.batchSize)` flips
   up to `batchSize` `new` rows to `status='parsing'` with `FOR UPDATE SKIP LOCKED`
   (multi-worker-safe).
4. **Parse** — `processJob()` → `parseJd(job, cfg)` (Haiku, model from
   `cfg.models.parse`, `JdSchema`). Logs `parse_jd` event.
5. **Score (two lists)** — in `processJob()`, reading `getConfig('constraints')` +
   `getConfig('preferences')`:
   - `evaluateConstraints(parsed, constraints)` (deterministic; hard ⇒ 0, penalties
     subtract),
   - `keywordScore(parsed, candidateTerms())` (ATS fuzzy match; 0.5 floor on empty),
   - `llmFit(job, parsed, cfg, preferences)` (one call, model `cfg.models.fit`;
     `profileText(preferences)` injects the priority-labeled preference block).
   - `combine(...)` = `w.keyword·keyword + w.llmFit·llmFit + w.structural·structural`
     (4-dp, weights from `cfg.weights`). Writes `parsed`, `score`, and a
     **`ScoreBreakdown.parse`-validated** `score_breakdown` (records
     `constraintsFired` + `preferencesApplied`); `status='scored'`. Logs `score`.
6. **Gate + tailor** — back in `cycle()`: `scored.filter(j => j.score >=
   cfg.scoreThreshold)` go to `tailorJob(job, cfg)`:
   - `tailor()` (model `cfg.models.tailor`, or `tailorDream` when `company_flags`
     includes `dream`) emits a `TailorSchema` → `toOverlay()` = section selection +
     LLM filters + RFC-6902 `replace` patches on highlight paths + cover letter,
     each patch citing `groundedIn` master-bank bullet ids. Validated by the one
     `overlayProblems()`. Logs `tailor`.
   - `verifyClaims(overlay, grounding, cfg)` (numeric tripwire + unknown-id/empty
     auto-fail + Haiku skeptic) marks each patch supported/unsupported. Logs
     `verify_claims`.
   - **Drop policy** (`tailorJob.ts`): removes unsupported patches, rebuilds `audit`
     so `unsupported === []` and renumbers `patchIndex`, re-validates kept patches
     with `jsonpatch.validate`, then UPDATE sets `overlay`, `cover_letter`, `audit`,
     `status='in_review'`.
7. **Notify** — `batchSummary()` builds an HTML summary linking each tailored job
   to `${REVIEW_BASE_URL}/#/app/<id>`; `sendTelegram()` posts it. Logs `notify`. One
   message per non-empty cycle (≥1 job scored).

A failure in a per-job step sets that job to `status='error'` (parse/score) or
leaves it `scored` for retry (tailor) — `cycle()` never aborts the whole batch.

## Flow 2 — human review, config, résumé edit (through the API)

All routes are same-origin to the dashboard SPA (served by `jobs-api`). The DB is
the single source of truth; the bare host reads it via the API.

**Review/approve** (`apps/dashboard/src/routes/ReviewPage.tsx` + `api.ts` →
`services/api/src/app.ts`):
- Inbox `api.jobs(status)` → `GET /api/jobs?status=` → `JobListItem[]`
  (PII-minimized list projection).
- Detail `api.job(id)` → `GET /api/jobs/:id` → `JobDetail` (PII-minimized).
- The tailored résumé preview is an **iframe of the bare host**:
  `ResumeCanvas applicationId={id}` → `<iframe src="/resume/?application=<id>">`.
  The bare host (`apps/site/src/index.tsx`) fetches `GET /applications/:id/
  overlay.json` + `GET /api/resume`, applies the overlay (`applicationPayload`), and
  renders read-only.
- `api.approve(id)` → `POST .../approve` (only flips `in_review`→`approved`; 409
  otherwise). `api.reject(id, reason)`, `api.label(id, good|bad|null)`.
- Overlay edit: `OverlayEditor` (`ResumeTree mode="overlay"`) →
  `editorTreeToOverlay()` → `api.putOverlay(id, overlay)` → `PUT /api/jobs/:id/
  overlay`. The server runs the **one** `overlayProblems(overlay, currentResume)`
  (Zod + `jsonpatch.validate` + the one personalInfo rule) before persisting.
  Reviewer edits are TRUSTED — they bypass the fabrication verify.

**Config** (`apps/dashboard/src/routes/{Llm,Preferences,Constraints,Scrawling}Page`
+ `hooks/useConfig.ts`): `api.config(ns)` → `GET /api/config/:ns` (best-effort DB
read, schema-default fallback); edits are validated client-side with `parseConfig`,
then `api.putConfig(ns, value)` → `PUT /api/config/:ns` re-validates against the
namespace Zod and upserts the `config` row. **Never touches secrets.**

**Canonical résumé edit** (`apps/dashboard/src/routes/ResumePage.tsx`):
`GET /api/resume` (latest `resume_versions`, seeds from `RESUME_SEED` if empty) →
Structured/JSON/Print tabs → `treeToResume()` / Zod-validated JSON → `api.putResume`
→ `PUT /api/resume` (validates against `ResumeDoc`, INSERTs a new `resume_versions`
row note `'edit'`). The preview iframe reflects the last SAVED doc. Refresh the git
seed with `pnpm export-seed`.

**Dashboard/ledger** (`DashboardPage.tsx`): `api.dashboardSummary()` →
`GET /api/dashboard/summary` (cost-by-stage/model, totals-by-day, status funnel,
failures — `DashboardSummary.parse`d at the boundary); `api.events()` →
`GET /api/events` (the `events` ledger, `EventRow[]`).

**Answers bank** (`AnswersPage.tsx`): `GET/PUT/POST/DELETE /api/answers[/:key]` →
`answers` table (templated application-question answers for the future apply agent).

## Container topology & networks

`deploy/docker-compose.yml` (project `job-pipeline`). **No service publishes host
ports.** Two networks: `internal` (private) and `nginx` (external, pre-existing,
shared with nginx proxy manager).

```
                     nginx network                internal network
                  ┌───────────────┐        ┌──────────────────────────────┐
 jobs.churong.cc  │               │        │                              │
 (NPM access list)│  jobs-api ────┼────────┼─► jobs-db (pgvector:pg17)     │
       ──────────►│  :8080        │        │      ▲         ▲       ▲      │
                  │ (dashboard /, │        │      │         │       │      │
                  │  /resume/,    │        │  jobs-pipeline jobs-discovery │
                  │  /api/*,      │        │  (poller)     (scheduler.py)  │
                  │  migrations)  │        │                              │
                  └───────────────┘        └──────────────────────────────┘
```

- `jobs-db`: `internal` only; healthcheck `pg_isready`; volume `dbdata`. Every
  other service `depends_on db: service_healthy`.
- `jobs-discovery`: `internal` only; `init: true` (tini owns PID 1 for clean
  signal handling); `TZ=Asia/Taipei`. CMD = the scheduler (long-running).
- `jobs-pipeline`: `internal` only; build context = **repo root** (needs
  `@resume/contracts`); mounts `packages/renderer/src/data:/data:ro` (master bank)
  and `data:/seed:ro` (résumé seed fallback).
- `jobs-api`: the ONLY web-facing service — joins BOTH `internal` and `nginx`;
  build context = **repo root**. NPM proxies `jobs.churong.cc → jobs-api:8080`
  behind an HTTP-basic access list. Everything behind it is PII. Mounts the same
  `/data` and `/seed` (read-only) for résumé/overlay validation. Applies DB
  migrations at startup.

## Static routing inside `jobs-api` (`app.ts`)
- `/api/*`, `/applications/:id/overlay.json`, `/healthz` → JSON handlers.
- `/resume/*` (trailing slash) → built bare host (`apps/site`, `@fastify/static`
  prefix `/resume/`). **No `/resume` (no slash) redirect** — that path belongs to
  the dashboard SPA's own `/resume` route.
- `/` and unmatched → built `dashboard` SPA; `setNotFoundHandler` falls back to the
  dashboard `index.html`, EXCEPT for `/api/`, `/applications/`, and `/resume/`
  prefixes which 404 as JSON. (The exemption is exact — `/resume/` with the trailing
  slash, NOT bare `/resume` — so a *hard* navigation/refresh to the dashboard's own
  `/resume` route falls through to the SPA. Resolved in `40c5c4d`; locked by
  `services/api/test/app.test.ts`. Don't widen the exemption to bare `/resume`.)

## Cross-references
- Contract shapes (résumé/overlay/view-model/pipeline/config/db/events) →
  [./data-contracts.md](./data-contracts.md) → `docs/CONTRACTS.md`
- Per-stage prompts, models, two-list scoring, anti-fabrication, evals →
  [./pipeline.md](./pipeline.md)
- Dashboard tabs, renderer, editor bridge, bare host, print/PDF →
  [./frontend.md](./frontend.md)
- Compose, Dockerfiles, migration, config seeding, env, runbook →
  [./operations.md](./operations.md)

## Invariants & gotchas
- **Contracts are the spine.** Every shape comes from `@resume/contracts`; consumers
  import it, never restate. Changing a shape = edit one Zod, `pnpm contracts:build`,
  re-`gen:schemas`, `pnpm validate`/`test`. Python (`services/discovery`) can't
  import the TS Zod — its `config.py`/`jobrow.py` are **hand-kept mirrors** that
  must track the contracts in lockstep.
- **Validate at the boundary.** The API `.parse()`s its OWN output
  (`DashboardSummary.parse` in `dashboard.ts`, `EventRow.array().parse` in
  `app.ts`); the pipeline `.parse()`s `ScoreBreakdown` before persisting; the
  migration validates each reshaped record. Don't drop these.
- **The API owns migrations.** `server.ts` runs them at
  startup; `poller.ts`/`run-once.ts`/`tailor-one.ts` assume the schema exists.
- **DB is canonical; `data/resume.json` is seed/export/fallback only.** Editing the
  file does NOT change the live résumé — `PUT /api/resume` does. The pipeline reads
  the live résumé via `refreshResume()` at cycle start.
- **Config is live + best-effort.** `getConfig(ns)` (TS `services/*/config.ts`,
  Python `config.py`) reads the `config` table; a DB hiccup / bad write falls back
  to last-good/schema-default and never crashes a cycle/tick. Edits take effect
  next cycle/tick, no restart.
- **Anti-fabrication is load-bearing and one-directional** — guards only LLM-written
  patches (tailor→verify→drop). Reviewer/overlay/résumé edits are trusted. Don't
  weaken `verify.ts` without re-running `eval:verify` (see [./pipeline.md](./pipeline.md)).
- **`events.job_id` is nullable** — `notify` (pipeline) and `discover` (Python) write
  run-level events with no job.
- **Renderer DOM must stay byte-identical** across a refactor — `render-check` skill,
  empty DOM diff (PDF bytes always differ on timestamps).
