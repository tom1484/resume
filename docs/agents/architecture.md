# Architecture & data flow

## Scope
System map for the whole repo: the renderer package, the two Vite frontends, the
three backend services (discovery / pipeline / api), and the Postgres DB — plus
the two end-to-end flows (nightly discover→score→tailor→verify→review, and human
review/approve + résumé-edit). This is the "map"; schema field-level detail lives
in [./data-contracts.md](./data-contracts.md), per-stage internals in
[./pipeline.md](./pipeline.md).

## Read this when
- You need to know which service/module owns a step before editing it.
- Tracing a job from a board posting to the Telegram review link.
- Tracing how a reviewer's approve/edit/overlay-save reaches the DB.
- Figuring out which container talks to which, and over which network.
- Adding a new pipeline stage, route, or frontend, and need the insertion point.

## Components

| Component | Path | Runtime | Container | Role |
|---|---|---|---|---|
| renderer pkg | `packages/renderer/src` | JS lib (Vite aliases) | — | résumé components + `@data` layer (adapter/overlay/editorModel/print); consumed by both frontends |
| site (résumé) | `apps/site` | Vite SPA | (in `jobs-api`) | renders canonical résumé at `/resume/`; renders tailored overlay via `?application=<id>`; canonical résumé editor |
| review SPA | `apps/review` | Vite SPA | (in `jobs-api`) | reviewer inbox/detail/answers at `/` (hash routes) |
| discovery | `services/discovery` | Python (uv) | `jobs-discovery` | nightly fetch+normalize+upsert of postings |
| pipeline | `services/pipeline` | Node ESM | `jobs-pipeline` | poller: parse→score→tailor→verify→notify |
| api | `services/api` | Fastify (port 8080) | `jobs-api` | review REST API + static host for both built frontends |
| db | (image `pgvector/pgvector:pg17`) | Postgres+pgvector | `jobs-db` | single source of truth (`jobs`, `events`, `answers`, `resume_versions`) |

The renderer package is NOT published via a barrel — frontends import deep
subpaths and Vite aliases `@css/@components/@config/@contexts/@data` (site
only; the review app uses no aliases — see [./frontend.md](./frontend.md)).
The `jobs-api` container co-locates BOTH
built SPAs: `services/api/Dockerfile` builds `site` (with `VITE_BASE=/resume/`)
and `review`, copies them to `/app/site` and `/app/review`, and `server.js`
serves them via `@fastify/static`.

## Entry points

| Process | Entry | Notes |
|---|---|---|
| pipeline poller (long-running) | `services/pipeline/src/poller.js` → `migrate()` then `cycle()` loop every `POLL_MS` | container CMD |
| one cycle (manual) | `services/pipeline/src/run-once.js` | migrate + one `cycle()` + exit |
| tailor one job (manual) | `services/pipeline/src/tailor-one.js [jobId]` | migrate + `tailorJob()` on a job or the top `scored` |
| discovery (nightly) | `python -m discovery.main --all` (`services/discovery/src/discovery/main.py`) | supercronic `crontab`: `0 9 * * *` Asia/Taipei |
| API server | `services/api/src/server.js` → `app.listen(:8080)` | Fastify |
| résumé renderer boot | `apps/site/src/index.jsx` → `bootstrap()` | branches on `?application` param |
| review SPA boot | `apps/review/src/main.jsx` → `App` (`apps/review/src/App.jsx`) | hash routes `#/`, `#/app/:id`, `#/answers` |
| migrations | `services/pipeline/src/migrate.js` → `migrate()` | applies `migrations/*.sql` in name order, tracked in `schema_migrations` |

## Flow 1 — nightly discovery → review (autonomous)

Each hop names the exact module/function. Stage internals → [./pipeline.md](./pipeline.md).

1. **Discover** (`jobs-discovery`, Python). `main.main()` loads
   `config/searches.yml`+`companies.yml`, then:
   - `run_boards()` → `boards.FETCHERS[provider]` (greenhouse/lever/ashby HTTP) →
     `normalize.PROVIDER_NORMALIZERS[provider]` → `is_internship()` filter →
     `normalize.finalize()` (attaches `company_flags`, `dedupe_key`, and a skip
     `status`/`skip_reason` via title/JD exclusion rules).
   - `run_jobspy()` → `jobspy_search.run_searches()` (Indeed by default; one
     country-wide call per term, jittered).
   - `store.upsert()` INSERTs into `jobs` with `ON CONFLICT DO NOTHING`
     (`dedupe_key` unique) → rows land at `status='new'`. `store.log_event()`
     writes a `discover` row to `events`.
2. **Claim** (`jobs-pipeline`). `cycle()` (`cycle.js`) first calls
   `profile.refreshResume()` (pulls the latest `resume_versions` row so scoring
   reflects web edits), then `claimBatch()` flips up to `BATCH` `new` rows to
   `status='parsing'` using `FOR UPDATE SKIP LOCKED` (multi-worker-safe).
3. **Parse** — `processJob()` → `parseJd.parseJd(job)` (Haiku, `JdSchema`):
   structured JD requirements. Logs `parse_jd` event.
4. **Score** — in `processJob()`:
   `score.structuralScore(parsed)` (deterministic; F-1 / seniority gates),
   `score.keywordScore(parsed, profile.candidateTerms())` (ATS fuzzy match),
   `score.llmFit(job, parsed)` (one Haiku call, `profile.profileText()` system).
   `score.combine()` = 0.5·keyword + 0.3·llmFit + 0.2·structural. UPDATE sets
   `parsed`, `score`, `score_breakdown`, `status='scored'`. Logs `score` event.
5. **Gate + tailor** — back in `cycle()`: jobs with `score >= THRESHOLD`
   (`SCORE_THRESHOLD`, default 0.65) go to `tailorJob.tailorJob(job)`:
   - `tailor.tailor(job)` (Sonnet, or Opus when `company_flags` includes `dream`)
     emits an overlay = section selection + RFC-6902 `replace` patches on
     highlight paths + cover letter, every patch citing `groundedIn` master-bank
     bullet ids. Validated by `tailor.overlayProblems()`. Logs `tailor`.
   - `verify.verifyClaims(overlay, grounding)` (numeric tripwire +
     Haiku skeptic) marks each patch supported/unsupported. Logs `verify_claims`.
   - **Drop policy**: `tailorJob` removes every unsupported patch, rebuilds
     `audit` so `unsupported === []` by construction, re-validates the kept
     patches against the current résumé, then UPDATE sets `overlay`,
     `cover_letter`, `audit`, `status='in_review'`.
6. **Notify** — `notify.batchSummary()` builds an HTML summary linking each
   tailored job to `REVIEW_BASE_URL/#/app/<id>`; `notify.sendTelegram()` posts it.
   Logs `notify`. One message per non-empty cycle.

A failure in any per-job step sets that job to `status='error'` (parse/score) or
leaves it `scored` for retry (tailor) — `cycle()` never aborts the whole batch.

## Flow 2 — human review & résumé edit (through the API)

All routes are same-origin to the review SPA (served by `jobs-api`). The DB is
the single source of truth; the renderer reads it via the API.

**Review/approve** (`apps/review/src/App.jsx` + `api.js` → `services/api/src/server.js`):
- Inbox `listJobs(status)` → `GET /api/jobs?status=` (default `in_review`).
- Detail `getJob(id)` → `GET /api/jobs/:id`. The detail pane embeds the tailored
  résumé in an `<iframe src="/resume/?application=<id>">`. That site instance
  (`apps/site/src/index.jsx`) fetches `GET /applications/:id/overlay.json` for the
  overlay and `GET /api/resume` for the base, then `registerApplication()` applies
  the overlay (`@data/overlay.applyOverlay`, on a clone) and renders read-only.
- `approve(id)` → `POST /api/jobs/:id/approve` (only flips `in_review`→`approved`).
  `reject(id, reason)` → `POST .../reject`. `label(id, good|bad|null)` →
  `POST .../label` (calibration, independent of approve/reject).
- Overlay edit: `Editor.jsx` modal → `saveOverlay(id, overlay)` →
  `PUT /api/jobs/:id/overlay`. Server `overlayProblems()` validates against
  `overlay.schema.json` + the **current** résumé (`fast-json-patch.validate`)
  before persisting. Reviewer edits are TRUSTED — they bypass the fabrication
  verify (which only guards LLM-written patches).

**Canonical résumé edit** (`apps/site/src/ResumeEditor.jsx` at `/resume`):
- `GET /api/resume` returns the latest `resume_versions` row (seeds from
  `RESUME_SEED` file on first read if the table is empty).
- Save → `PUT /api/resume` INSERTs a NEW `resume_versions` row (`note='edit'`) —
  every save is a new history row; nothing is overwritten.
- `GET /api/resume/history`, `POST /api/resume/restore/:id` (re-inserts an old
  version's data as a new row). Refresh the git seed with `pnpm export-seed`.

**Answers bank** (`#/answers`): `GET/PUT/POST/DELETE /api/answers[/:key]` →
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
       ──────────►│  :8080        │        │      ▲         ▲      ▲       │
                  │  (review SPA, │        │      │         │      │       │
                  │   /resume/,   │        │  jobs-pipeline jobs-discovery │
                  │   /api/*)     │        │  (poller)     (supercronic)   │
                  └───────────────┘        └──────────────────────────────┘
```

- `jobs-db`: `internal` only; healthcheck `pg_isready`; volume `dbdata`. Every
  other service `depends_on db: service_healthy`.
- `jobs-discovery`: `internal` only; `init: true` (tini owns PID 1 because
  supercronic's reaper fatals as PID 1). `TZ=Asia/Taipei`.
- `jobs-pipeline`: `internal` only; mounts `packages/renderer/src/data:/data:ro`
  (master bank + schemas) and `data:/seed:ro` (résumé seed fallback).
- `jobs-api`: the ONLY web-facing service — joins BOTH `internal` and `nginx`.
  NPM proxies `jobs.churong.cc → jobs-api:8080` behind an HTTP-basic access list.
  Everything behind it is PII. Mounts the same `/data` and `/seed` (read-only)
  for overlay/résumé validation.

## Static routing inside `jobs-api` (`server.js`)
- `/api/*`, `/applications/:id/overlay.json`, `/healthz` → JSON handlers.
- `/resume` → redirect to `/resume/` (Fastify default 302); `/resume/*` → built `site`.
- `/` and unmatched → built `review` SPA (`setNotFoundHandler` falls back to the
  review `index.html`, EXCEPT for `/api/`, `/applications/`, `/resume` prefixes
  which 404 as JSON).

## Cross-references
- DB tables, JSON Resume/overlay/master schemas, view-model key contract,
  status lifecycle → [./data-contracts.md](./data-contracts.md)
- Per-stage prompts, models, anti-fabrication internals, evals →
  [./pipeline.md](./pipeline.md)
- Renderer components, `@data` API, editor tree bridge, print config →
  [./frontend.md](./frontend.md)

## Invariants & gotchas
- **DB is canonical; `data/resume.json` is seed/export/fallback only.** Pipeline
  reads the live résumé via `profile.refreshResume()` at cycle start; the API
  seeds the table from `RESUME_SEED` only when empty. Editing the file does NOT
  change the live résumé — `PUT /api/resume` (or restore) does.
- **No profiles.** `meta.x-profiles`/`?profile` are gone; per-job selection lives
  only in the application overlay's `profile` field. Section order = `meta.sectionOrder`.
- **Overlays are validated against the CURRENT résumé**, not the seed — both the
  tailor (`tailor.overlayProblems`) and the API (`server.overlayProblems`) call
  `jsonpatch.validate(patches, currentResume)`. A résumé edit can invalidate an
  older overlay's patch paths.
- **Anti-fabrication is load-bearing and one-directional.** It guards only
  LLM-written patches (tailor→verify→drop in `tailorJob.js`). Reviewer edits via
  `PUT /api/jobs/:id/overlay` are trusted. Don't weaken `verify.js` without
  re-running the verify eval (see [./pipeline.md](./pipeline.md)).
- **Models per cost plan:** parse/score/verify on Haiku; tailor on Sonnet
  (`MODEL_TAILOR`), `dream`-flagged companies on Opus (`MODEL_TAILOR_DREAM`).
  `llm.costUsd` prices cache reads at 0.1x and writes at 1.25x.
- **`events.job_id` is nullable** — `notify` (pipeline) and `discover` (Python
  `store.log_event`) write run-level events with no job.
- **The renderer fetches base from `/api/resume` for `?application` too**, so the
  tailored view inherits live `meta` (print config). Falls back to the bundled
  seed when no API is reachable (standalone/PDF/CI).
- **Discovery never runs logged-in automation** and the (future) apply agent runs
  only on Tom's local machine — never from a server container.
