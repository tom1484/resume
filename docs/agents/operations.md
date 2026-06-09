# Operations: deploy, env, migration, runbook (v2)

## Scope
How to run, operate, and deploy the v2 stack: root `pnpm` commands, the three
Dockerfiles (build-from-repo-root), Docker Compose topology, the env/secrets
boundary, DB migrations (**API-owned**), the **config seeding** layer, the
in-process **scheduler**, the NPM exposure, the **v1→v2 cutover/rollback runbook**,
and the **Lessons** that bit us in the real cutover. Source of truth for "how do I
run X" and "what controls Y".

## Read this when
- Deploying or redeploying the stack (`docker compose build/up`).
- Adding/changing an env var, secret, or volume mount.
- Adding a DB migration, or running the one-time v1→v2 data migration.
- Seeding or editing config (it's DB-backed + UI-editable now, not env/YAML).
- Editing the discovery schedule (in-process scheduler, not cron).
- Running an eval, a one-off pipeline cycle, a manual tailor, or `export-seed`.
- Debugging the public exposure (NPM access list, Cloudflare SSL, healthcheck).

## Entry points
| Concern | File / command | Notes |
|---|---|---|
| Compose topology | `deploy/docker-compose.yml` | project `job-pipeline`; run from `deploy/` |
| Secrets / interpolation | `deploy/.env` (gitignored, `.gitignore:31`) | see env table |
| Root scripts | root `package.json` | `validate/test/lint/build/pdf/export-seed/contracts:build` |
| API entry (long-running) | `services/api/src/server.ts` | `runMigrations(pool)` then `createApp().listen(:8080)`; container CMD |
| DB migrations runner | `services/api/migrations/run.ts` `runMigrations()` | applied at API startup; idempotent |
| Pipeline poller | `services/pipeline/src/poller.ts` | container CMD; `cycle()` forever; **no migration** |
| Discovery scheduler | `services/discovery/src/discovery/scheduler.py` | container CMD; per-minute DB-driven tick |
| v1→v2 data migration | `services/api/scripts/migrate-v1-to-v2.ts` | one-time, against an EXPORT; `--dry-run` default |
| Résumé seed reshape | `scripts/migrate/run-resume-seed.ts` | reshape repo-root `data/resume.json` to v2 (file only) |
| Seed export | `scripts/export-seed.mjs` | `pnpm export-seed`; live DB → `data/resume.json` |

## Docker Compose services
`deploy/docker-compose.yml`, project `job-pipeline`. Run from `deploy/` so `.env` is
picked up.

| Service | container | image / build | networks | role |
|---|---|---|---|---|
| `db` | `jobs-db` | `pgvector/pgvector:pg17` | `internal` | Postgres + pgvector; volume `dbdata`; healthcheck `pg_isready` |
| `discovery` | `jobs-discovery` | build `../services/discovery` | `internal` | **in-process DB-driven scheduler** (`scheduler.py`); `init: true` |
| `pipeline` | `jobs-pipeline` | build context **`..` (repo root)**, `services/pipeline/Dockerfile` | `internal` | poller; CMD `node dist/src/poller.js` |
| `api` | `jobs-api` | build context **`..` (repo root)**, `services/api/Dockerfile` | `internal`, `nginx` | review/config/dashboard API + both SPAs + migrations; port 8080 |

- Networks: `internal` (default bridge) + `nginx` (declared `external: true` — must
  pre-exist; it is nginx-proxy-manager's docker network). **NO service publishes
  host ports.** Only `jobs-api` joins `nginx`, so it is the only web-facing service.
- `depends_on: db (condition: service_healthy)` on discovery/pipeline/api.
- `pipeline` + `api` build from the **repo root** (they need the `@resume/contracts`
  workspace package); `discovery` builds from its own dir (Python, no contracts at
  build — it mirrors them in `config.py`/`jobrow.py`).

## The three Dockerfiles
- **`services/api/Dockerfile`** (context = repo root). Stage 1 (node:22-alpine):
  `pnpm install` the workspace, build `@resume/contracts` FIRST (every package
  imports its `dist/`), then `@resume/api`, then `VITE_BASE=/resume/ pnpm --filter
  site build && pnpm --filter dashboard build`. Stage 2 (runtime): installs the
  API's runtime deps **by name** (`fastify @fastify/static pg zod fast-json-patch`)
  — see Lesson 3 — then copies the contracts `dist/` + `package.json` into
  `node_modules/@resume/contracts`, the API `dist/`, the `.sql` files next to
  `dist/migrations/` (tsc doesn't compile them), and the two SPA builds to
  `/app/site` + `/app/dashboard`. `APP_STATIC_ROOT=/app`; CMD `node dist/src/server.js`.
- **`services/pipeline/Dockerfile`** (context = repo root). Build stage installs +
  builds `@resume/contracts` then `@resume/pipeline`; runtime copies `/repo` and
  CMD `node dist/src/poller.js`. **No migrations** (API owns them).
- **`services/discovery/Dockerfile`** (context = its own dir). `uv:python3.12` slim;
  `uv sync --frozen`; CMD `["uv","run","--no-sync","python","-m","discovery.scheduler"]`
  (the long-running scheduler — supercronic is gone). `tzdata` is a dep so the
  scheduler tz resolves in the slim image.

## Public exposure (jobs.churong.cc)
- Path: Cloudflare → nginx-proxy-manager (NPM) → `jobs-api:8080` over the `nginx`
  docker network. No exposed host ports anywhere.
- NPM enforces an **access list** (HTTP basic auth) in front of everything — the API
  serves PII (applications, résumé, answers, config). Never expose without it.
- The API serves on one origin (`app.ts`): `/` → dashboard SPA (fallback to
  `index.html`), `/resume/` → bare résumé host, `/api/*` + `/applications/*` → JSON.
  `GET /healthz` → `'ok'` (liveness).

## Env / secrets boundary (binding)
**Secrets live in `deploy/.env` (gitignored) and ONLY in env — never DB, never
UI-editable.** Everything else that was env/YAML in v1 is now a DB `config` row
(below). The config CRUD API never reads/writes secrets; the dashboard has no field
for them.

| Var | Where | Secret? | Notes |
|---|---|---|---|
| `POSTGRES_USER/PASSWORD/DB` | db; compose composes `DATABASE_URL` | **yes** | |
| `DATABASE_URL` | api/pipeline/discovery | derived | `postgres://$USER:$PASS@db:5432/$DB` (compose) |
| `ANTHROPIC_API_KEY` | pipeline (LLM) | **yes** | only the pipeline calls the LLM |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | pipeline `notify.ts` | **yes** | missing → notify skipped |
| `REVIEW_BASIC_AUTH` | `export-seed.mjs` (`user:pass`) | **yes** | the NPM access-list creds |
| `REVIEW_BASE_URL` | pipeline notify links; `export-seed` | no | `https://jobs.churong.cc` (compose) |
| `DATA_DIR` | pipeline + api | no | `/data` (mount: renderer `src/data`, ro) — master bank + schemas |
| `RESUME_SEED` | pipeline + api | no | `/seed/resume.json` (mount: repo `data`, ro) — fallback only |
| `APP_STATIC_ROOT` | api | no | `/app` (image lays SPAs at `/app/{site,dashboard}`) |
| `MIGRATIONS_DIR` | api migrations runner | no | optional override; default = next to `dist/migrations` |
| `ENABLE_RESUME_OPS` | api | no | `=1` exposes the ops-only `/api/resume/history` + `/restore/:id` (default off) |
| `TZ` | discovery container | no | `Asia/Taipei`; the *scheduler's* tz is the `schedule` config |

Everything formerly env/YAML — **models per stage, scoreThreshold, weights, batch,
poll, JD truncation, the cron/tz/mode, JobSpy sites/defaults, searches, companies,
exclude lists, constraints, preferences** — is now in the `config` table (§ below),
edited in the dashboard. (This fixes the v1 finding that `MODEL_*` weren't even
passed through compose and a model change needed a code change + image rebuild.)

## Mounts: DATA_DIR and RESUME_SEED
Both `pipeline` and `api` mount two read-only volumes:
- `../packages/renderer/src/data:/data:ro` → `DATA_DIR=/data`: the master bank
  (`master.json`) for the pipeline; emitted JSON Schemas / overlay validation source.
- `../data:/seed:ro` → `RESUME_SEED=/seed/resume.json`: the canonical résumé **seed +
  fallback** (NOT the live source — DB `resume_versions` is canonical). The API seeds
  `resume_versions` from it on first read when empty; the pipeline keeps it as the
  `refreshResume()` fallback.

## Migrations (API-owned)
- Location: `services/api/migrations/*.sql`. Files: `001_init.sql` (jobs+events),
  `002_overlay_and_labels.sql` (overlay/cover_letter/audit/label/reject_reason/
  reviewed_at on jobs + answers table), `003_seed_answers.sql` (`ON CONFLICT DO
  NOTHING`), `004_resume_versions.sql`, **`005_config.sql`** (`config(ns text PK,
  value jsonb NOT NULL, updated_at)`).
- Runner: `services/api/migrations/run.ts` `runMigrations(pool)` — `CREATE TABLE IF
  NOT EXISTS schema_migrations`, read dir, filter `.sql`, **sort by filename**, apply
  each unseen one in its own transaction, record the name. Idempotent.
- **Ownership move (v2):** the API applies migrations at startup (`server.ts`); the
  pipeline no longer does. So a normal `docker compose up -d api` applies pending
  migrations. Manual: `node services/api/dist/migrations/run.js` (or
  `pnpm --filter @resume/api migrate`) with `DATABASE_URL` set. The image copies the
  `.sql` files next to `dist/migrations/` (tsc doesn't compile them); the runner
  resolves the dir relative to itself or via `MIGRATIONS_DIR`.
- Adding one: create the next-numbered `NNN_name.sql` in `services/api/migrations/`.
  Filename ordering is load-bearing — zero-pad, never renumber an applied file.

## Config layer (seeding + runtime)
- The `config` table has one row per namespace (`llm / schedule / discovery /
  constraints / preferences`); `value jsonb` is validated by the matching
  `@resume/contracts` Zod on write (`PUT /api/config/:ns` → `parseConfig`).
- **Seeding:** the v1→v2 migration (`migrate-v1-to-v2.ts`, below) seeds every
  namespace — `discovery` from the YAMLs (dropping dead `keywords`/`locations`/
  `defaults.sites`), `llm`/`schedule` from compose/.env non-secrets, `constraints`
  with the three F-1 rules, `preferences` with the lifted Summer-2027 anchor. If you
  skip the migration (fresh DB), `getConfig(ns)` returns `configDefault(ns)` (schema
  defaults) until you PUT real values from the UI.
- **Runtime reads** are best-effort (`services/pipeline/src/config.ts`,
  `services/api/src/config.ts`, `services/discovery/src/discovery/config.py`): DB row
  → Zod parse → on any failure last-good/schema-default; **never crash**. Edits take
  effect next cycle/tick, no restart. Python defaults MUST track `contracts/config.ts`.

## The scheduler (replaces supercronic)
`services/discovery/src/discovery/scheduler.py` `loop()` is the discovery container's
CMD — a long-running process that ticks every 60s. Each tick it re-reads
`ScheduleConfig` (`config.get_config(conn, 'schedule')`) and, if `discovery.enabled`
and the 5-field `cron` (parsed by `cron.py`, evaluated in `tz`) matches the current
minute, calls `main.run(mode, conn=conn)` in-process. A `minute_key` dedupe prevents
double-fires; a bad cron/tz or a failed run is logged and the loop continues. **A UI
schedule edit takes effect next tick, no restart.** `init: true` on the service
(tini owns PID 1 for clean signals). Manual one-shot:
`docker compose run --rm discovery uv run --no-sync python -m discovery.main --boards`
(`--jobspy`, `--all`, `--dry-run`).

## Root commands (from repo root)
| Command | Effect |
|---|---|
| `pnpm contracts:build` | `tsc` the contracts pkg, then `gen:schemas` → `dist/schemas/{resume,overlay,master}.json` |
| `pnpm validate` | `contracts:build` then `node scripts/validate.mjs`: Ajv-checks `data/resume.json` (ResumeDoc), `master.json` (MasterBank + id uniqueness), every `apps/site/public/applications/*/overlay.json` (Overlay + patch dry-run) against the **emitted** schemas |
| `pnpm test` | `contracts:build` then `vitest run` — two projects: `node` (packages/services/site/tests) + jsdom `apps/dashboard` (its own `vitest.config.ts`) |
| `pnpm lint` | `eslint .` (flat config; TS rules scoped to ts/tsx; discovery ignored — ruff lints it) |
| `pnpm build` | `pnpm validate` then build `site` (`VITE_BASE=/resume/`) + `dashboard` |
| `pnpm pdf` | `scripts/print-pdf.mjs` → `out/resume.pdf` (Playwright, uses `getPrint`/`pdfOptions`) |
| `pnpm export-seed` | `scripts/export-seed.mjs`: GET live `/api/resume` (via `REVIEW_BASE_URL`+`REVIEW_BASIC_AUTH` from `deploy/.env`) → write `data/resume.json`. Then `pnpm validate && git diff data/resume.json` → commit |

Python (discovery): `cd services/discovery && uv run pytest` (tests:
`test_normalize/test_config/test_cron/test_scheduler/test_jobrow`).

## Per-service manual runs
Pipeline (from `services/pipeline/`, with `DATABASE_URL`/`ANTHROPIC_API_KEY`):
`node dist/src/run-once.js` (one cycle), `node dist/src/tailor-one.js [jobId]`
(tailor+verify one job / top scored), `node dist/src/poller.js` (the loop). Evals via
`pnpm --filter @resume/pipeline eval:parse|eval:verify|eval:tailor` (tsx, live API —
see [./pipeline.md](./pipeline.md); run before landing any prompt change).

## v1 → v2 cutover runbook
The brief's sequencing: build v2 in the worktree; **stop (not remove)** the old v1
stack at construction start; migrate data once at cutover.

1. **Stop v1** (don't remove): `docker compose stop` in the old stack. Keep its DB
   volume intact (rollback depends on it).
2. **Export the live v1 data** into an export dir the migration reads (it never
   touches a live DB itself). Assemble: `resume_version.json` (latest
   `resume_versions.data`), `jobs.json` (rows incl. overlay/parsed/score_breakdown/
   audit), `answers.json`, `master.json`, `discovery.json` (the two YAMLs converted
   to JSON), `env.json` (compose/.env non-secrets: models/threshold/batch/poll/cron/
   tz/mode/sites).
3. **Bring up the v2 DB + API** (`docker compose up -d db api`) — the API applies
   migrations `001`–`005` at startup, creating the v2 schema incl. `config`.
4. **Reshape the file seed:** `node scripts/migrate/run-resume-seed.ts` (repo-root
   `data/resume.json` → v2 `ResumeDoc`, validated), then `pnpm validate` + a
   `render-check` empty-DOM-diff against the v1 baseline (the byte-identical-DOM
   invariant).
5. **Dry-run the data migration against the EXACT export you'll apply:**
   `node services/api/dist/scripts/migrate-v1-to-v2.js --export <dir>` (default
   `--dry-run`, writes nothing). It reshapes the résumé, re-validates each overlay
   (`Overlay` + `overlayProblems`; non-conformers nulled + logged for re-tailor),
   re-validates `parsed`/`score_breakdown`/`audit` per job, KEEPs all job rows + ids
   + dedupe keys, validates answers, and builds the five config rows (F-1 constraints
   + the seed preference). Review the printed report's `quarantine` list — nothing is
   silently dropped. Optionally `--out <file>` to inspect the payload.
6. **Apply:** re-run with `--apply` (requires `DATABASE_URL` = the v2 DB). It inserts
   the migrated résumé (note `'migration v1→v2'`), updates the migrated jobs, upserts
   answers (`ON CONFLICT DO NOTHING`) and the config rows.
7. **Bring up the rest:** `docker compose up -d pipeline discovery`. Verify the
   dashboard at jobs.churong.cc (behind the NPM access list): review inbox, config
   tabs (they should show the seeded values), `/dashboard` ledger.
8. **Point NPM** at the new `jobs-api` if the container/network identity changed.

**Rollback:** the migration is one-way against the v2 DB only; the v1 DB volume is
untouched. To roll back: `docker compose stop` v2, restart the v1 stack against its
preserved volume, repoint NPM. (Note: the `migrate-v1-to-v2.ts` reshaper passes
already-v2-shaped input through, so re-running it is safe; but prefer a clean v2 DB.)

## Known gotchas (with fixes)
- **External `nginx` network missing** → `up` fails with "network nginx not found".
  Create it (nginx-proxy-manager owns it) before deploying.
- **No host ports.** Never add a `ports:` mapping; exposure is exclusively via NPM on
  the `nginx` network. A port bypasses the access list and leaks PII.
- **Cloudflare Flexible SSL + NPM ForceSSL → redirect loop.** Set the Cloudflare SSL
  mode to **Full** for the `jobs.churong.cc` host.
- **`/resume` (no slash) vs `/resume/` (slash) — RESOLVED (`40c5c4d`).** The bare host
  owns ONLY `/resume/` (trailing slash); the SPA-fallback exemption and the (removed)
  `GET /resume` redirect were tightened so a hard nav/refresh to the dashboard's own
  `/resume` route falls through to the SPA. Keep the `setNotFoundHandler` exemption
  exact (`/resume/`, not bare `/resume`) — widening it re-shadows the SPA route.
  Locked by `services/api/test/app.test.ts`.
- **The pipeline does NOT migrate** — if you bring up `pipeline` before `api` on a
  fresh DB, it has no schema. Always bring up `api` (which migrates) first/together.

## Lessons (these bit us in the real cutover — binding)
1. **Validate at the boundary.** A contract that isn't enforced on API *output* (or
   on a migration *write*) lets bad data through. Two real failures: pg returns
   `numeric`/`bigint` columns as JS **strings** (the events `id`/`cost_usd`), so a
   client `.toFixed()` crashed — `GET /api/events` now coerces them to numbers and
   `EventRow.array().parse()`s on the way out; and the résumé migration went
   "false-green" because the write wasn't re-validated. **Keep the `.parse()` on
   every API response (`DashboardSummary.parse`, `EventRow.array().parse`), on the
   pipeline's `ScoreBreakdown`, and on every migration record.**
2. **Dry-run against the exact data you apply, atomically.** A migration dry-run
   passed against an earlier export while the live row changed underneath. Export
   once, dry-run that export, and `--apply` *that same* export — don't re-export
   between dry-run and apply. Quarantine + log non-conformers (never silently drop).
3. **Docker image dep gotcha.** A `workspace:*` dep + `npm install … || true`
   silently omits runtime deps (the v1-image bug: `pg`/`fastify` missing at runtime,
   masked by `|| true`). **Install runtime deps by NAME in the runtime stage**
   (`services/api/Dockerfile` does: `fastify @fastify/static pg zod fast-json-patch`),
   then copy the workspace `@resume/contracts` `dist/` in as a real dir afterwards so
   its own deps (zod/fast-json-patch) resolve from the named install.

## Sibling docs
- System map + flows + topology: `./architecture.md`
- Pipeline internals (discovery/scheduler/scoring/tailor/verify/evals): `./pipeline.md`
- Dashboard / renderer / editor / print: `./frontend.md`
- Contract shapes: `./data-contracts.md` → `../v2/CONTRACTS.md`
