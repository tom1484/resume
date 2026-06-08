# Operations: deploy, env, commands

## Scope
How to run, operate, and deploy the stack: root `pnpm` commands, per-service manual
runs, Docker Compose topology, env vars, mounts, DB migrations, discovery cron, and
the nginx-proxy-manager exposure at `jobs.churong.cc`. Source of truth for "how do I
run X" and "what env var controls Y".

## Read this when
- Deploying or redeploying the stack (`docker compose build/up`).
- Adding/changing an env var, secret, or volume mount.
- Adding a DB migration, or debugging migration ordering.
- Editing or triggering the discovery cron (nightly job fetch).
- Running an eval, a one-off pipeline cycle, a manual tailor, or `export-seed`.
- Debugging the public exposure (NPM access list, Cloudflare SSL, healthcheck).

## Entry points
| Concern | File / command | Notes |
|---|---|---|
| Compose topology | `deploy/docker-compose.yml` | project `job-pipeline`; run from `deploy/` |
| Secrets / interpolation | `deploy/.env` (gitignored) | see env table below |
| Root scripts | `package.json:5-15` | `validate/test/build/pdf/lint/export-seed` |
| Pipeline long-running entry | `services/pipeline/src/poller.js` | container CMD; migrate → `cycle()` forever |
| Pipeline migrations runner | `services/pipeline/src/migrate.js:10` | `migrate()`; auto-run at poller start |
| Discovery entry | `services/discovery/src/discovery/main.py:76` | `--boards/--jobspy/--all/--dry-run` |
| Discovery cron | `services/discovery/crontab` | supercronic; nightly 09:00 Asia/Taipei |
| API + static host | `services/api/src/server.js:202` | Fastify `0.0.0.0:8080`, container `jobs-api` |
| Seed export | `scripts/export-seed.mjs` | `pnpm export-seed`; pulls live DB → `data/resume.json` |

## Docker Compose services
Defined in `deploy/docker-compose.yml`. Project name `job-pipeline`. Run all commands
from the `deploy/` directory so `.env` is picked up.

| Service | container | image / build | networks | restart | role |
|---|---|---|---|---|---|
| `db` | `jobs-db` | `pgvector/pgvector:pg17` | `internal` | unless-stopped | Postgres + pgvector; volume `dbdata:/var/lib/postgresql/data`; healthcheck `pg_isready` |
| `discovery` | `jobs-discovery` | build `../services/discovery` | `internal` | unless-stopped | supercronic cron; `init: true` |
| `pipeline` | `jobs-pipeline` | build `../services/pipeline` | `internal` | unless-stopped | poller; CMD `node src/poller.js` |
| `api` | `jobs-api` | build context `..`, `services/api/Dockerfile` | `internal`, `nginx` | unless-stopped | review API + static SPA + résumé renderer; port 8080 |

- Networks: `internal` (default bridge) + `nginx` (declared `external: true` — must
  pre-exist; it is nginx-proxy-manager's docker network). **NO service publishes host
  ports.** Only `jobs-api` joins `nginx`, so it is the only web-facing service.
- `depends_on: db (condition: service_healthy)` on discovery/pipeline/api.
- `db` is reached by the others at host `db:5432` over `internal`.

## Public exposure (jobs.churong.cc)
- Path: Cloudflare → nginx-proxy-manager (NPM) → `jobs-api:8080` over the `nginx`
  docker network. No exposed host ports anywhere.
- NPM proxy host enforces an **access list** (HTTP basic auth) in front of everything,
  because the API serves PII (applications, résumé, answers). Per CLAUDE.md safety
  constraints: never expose this service without the access list.
- The API serves three things on one origin (`services/api/src/server.js:185-200`):
  - `/` → review SPA (`apps/review` build), with SPA fallback to `index.html`.
  - `/resume/` → résumé renderer (`apps/site` build); `/resume` 302-redirects to it
    (`reply.redirect` with no explicit status = 302).
  - `/api/*`, `/applications/*` → JSON API (never falls back to the SPA).
- `GET /healthz` returns `ok` (string), used for liveness checks.

## Env vars
Secrets live in `deploy/.env` (gitignored; also `/deploy/.env` in root `.gitignore:31`).
Non-secret values are hard-coded in compose `environment:` blocks.

| Var | Where used | Default / value | Secret? |
|---|---|---|---|
| `POSTGRES_USER` | db; composes `DATABASE_URL` | — | yes (.env) |
| `POSTGRES_PASSWORD` | db; composes `DATABASE_URL` | — | yes (.env) |
| `POSTGRES_DB` | db; composes `DATABASE_URL` | — | yes (.env) |
| `DATABASE_URL` | pipeline/api/discovery | `postgres://$USER:$PASS@db:5432/$DB` (compose) | derived |
| `ANTHROPIC_API_KEY` | pipeline (LLM stages) | — | yes (.env) |
| `TELEGRAM_BOT_TOKEN` | pipeline `notify.js` | — | yes (.env) |
| `TELEGRAM_CHAT_ID` | pipeline `notify.js` | — | yes (.env) |
| `REVIEW_BASE_URL` | pipeline `cycle.js:116` (review links in notify summary); `export-seed.mjs` | `https://jobs.churong.cc` (compose) | no |
| `REVIEW_BASIC_AUTH` | `export-seed.mjs` only (`user:pass`) | — | yes (.env) |
| `DATA_DIR` | pipeline + api | `/data` (mount: renderer `src/data`, ro) | no |
| `RESUME_SEED` | pipeline + api | `/seed/resume.json` (mount: repo `data`, ro) | no |
| `CONFIG_DIR` | discovery `main.py:22` | `/app/config` (set in Dockerfile) | no |
| `TZ` | discovery | `Asia/Taipei` (compose) | no |
| `MODEL_PARSE` | pipeline `llm.js` | `claude-haiku-4-5` | no |
| `MODEL_VERIFY` | pipeline `verify.js` | `claude-haiku-4-5` | no |
| `MODEL_TAILOR` | pipeline `tailor.js` | `claude-sonnet-4-6` | no |
| `MODEL_TAILOR_DREAM` | pipeline `tailor.js` (dream-tier jobs) | `claude-opus-4-8` | no |
| `SCORE_THRESHOLD` | pipeline `cycle.js:14` | `0.65` | no |
| `POLL_INTERVAL_MS` | pipeline `cycle.js:12` | `60000` | no |
| `BATCH_SIZE` | pipeline `cycle.js:13` | `10` | no |
| `JOBSPY_SITES` | discovery jobspy search | `indeed` (searches.yml uses `[indeed, linkedin]`) | no |
| `VITE_BASE` | api Dockerfile build only | `/resume/` (site build base) | no |

Notes:
- LLM-model vars are read from `process.env` in pipeline modules with the defaults
  above; set them in compose `environment:` (currently only the API key is passed —
  defaults apply otherwise).
- `deploy/.env` keys present today: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`,
  `REVIEW_BASIC_AUTH`.

## Mounts: DATA_DIR and RESUME_SEED
Both pipeline and api containers mount two read-only volumes:
- `../packages/renderer/src/data:/data:ro` → `DATA_DIR=/data`. Provides schemas
  (`overlay.schema.json`, `extensions.schema.json`) and the master bank `master.json`.
- `../data:/seed:ro` → `RESUME_SEED=/seed/resume.json`. The canonical résumé **seed +
  fallback** (NOT the live source — DB `resume_versions` is canonical).

How seed vs DB is used:
- API (`server.js:21,109-116`): loads `resume.json` from `RESUME_SEED` at boot. On
  first `currentResume()` call with an empty `resume_versions` table, it inserts the
  seed as note `'seed'`. Thereafter the latest row is canonical.
- Pipeline (`profile.js:10-20`): `seedResume` from `RESUME_SEED` (fallback default
  `data/resume.json` relative to module); `refreshResume()` pulls the latest DB row at
  each `cycle()` start (`cycle.js:73`) so scoring/tailoring reflect live web edits. On
  DB failure it keeps the seed.

## Migrations
- Location: `services/pipeline/migrations/*.sql`. Current files: `001_init.sql`,
  `002_overlay_and_labels.sql`, `003_seed_answers.sql`, `004_resume_versions.sql`.
- Runner: `services/pipeline/src/migrate.js`. Reads dir, filters `.sql`, **sorts by
  filename**, applies each once inside a transaction, tracks applied names in
  `schema_migrations(name PK, applied_at)`. Idempotent — safe every start.
- Auto-run: `poller.js:7` calls `migrate()` before the first cycle. So a normal
  `docker compose up -d pipeline` applies pending migrations.
- Manual run (against the live DB): from `services/pipeline/`,
  `DATABASE_URL=... node src/migrate.js` (the module self-executes when run directly,
  `migrate.js:37`).
- Adding a migration: create the next-numbered `NNN_name.sql`. Filename ordering is
  load-bearing — zero-pad and never renumber an applied file. SQL runs as one query
  string (multiple statements allowed; whole file is one transaction).

## Discovery cron
- `services/discovery/Dockerfile` installs supercronic v0.2.33 and runs
  `CMD ["supercronic", "/app/crontab"]` (logs to stdout, container-friendly).
- `services/discovery/crontab`: `0 9 * * * uv run --no-sync python -m discovery.main --all`
  — nightly 09:00 server-local (`TZ=Asia/Taipei`). cwd is WORKDIR `/app`; supercronic
  execs directly (no shell) so keep commands shell-free.
- `init: true` on the service (compose `:41`) — supercronic's reaper fatals as PID 1,
  so tini owns PID 1. Do not remove.
- Config: `services/discovery/config/searches.yml` (JobSpy saved searches, locations,
  title/JD exclude rules) + `companies.yml` (target companies, board slugs, flags).
  Baked into the image at build (`CONFIG_DIR=/app/config`); rebuild on config change.

## Root commands (run from repo root)
| Command | Effect |
|---|---|
| `pnpm dev` / `pnpm start` | Vite dev server for `apps/site` |
| `pnpm build` | `node scripts/validate.mjs` then `pnpm --filter site build` → `apps/site/build` |
| `pnpm preview` | Vite preview of the built site |
| `pnpm validate` | Ajv: JSON Resume schema + extension schema (+ overlays) |
| `pnpm lint` | `eslint .` |
| `pnpm test` | `vitest run` across workspace packages |
| `pnpm pdf` | `node scripts/print-pdf.mjs` → single `out/resume.pdf` |
| `pnpm export-seed` | `node scripts/export-seed.mjs`: GET live `/api/resume` → write `data/resume.json` |

`export-seed` reads `REVIEW_BASE_URL` + `REVIEW_BASIC_AUTH` from `deploy/.env`
(`export-seed.mjs:24-29`). After running: `pnpm validate && git diff data/resume.json`,
then commit if correct.

## Per-service manual runs
Pipeline (Node ESM, from `services/pipeline/`, with `DATABASE_URL`/`ANTHROPIC_API_KEY`
in env):
| Command | Effect |
|---|---|
| `node src/run-once.js` | migrate, run one `cycle()`, exit (manual / smoke test) |
| `node src/tailor-one.js [jobId]` | tailor+verify one job (default: top `scored` job) |
| `node src/poller.js` | the long-running loop (same as container) |
| `node src/migrate.js` | apply migrations only |

Evals (live API, NOT in CI — run before landing prompt changes; see CLAUDE.md):
| Command | Cost | Asserts |
|---|---|---|
| `ANTHROPIC_API_KEY=… node eval/run-parse-eval.js` | ~2¢ | parse recall on 6 golden JDs |
| `ANTHROPIC_API_KEY=… node eval/run-verify-eval.js` | live | fabrication flagged every run; clean ≥2/3 |
| `node eval/run-tailor-eval.js <jobs.jsonl>` | ~2-5¢/job | overlay valid, every patch verified, cover letter non-trivial |
| `node eval/recommend-threshold.js out/calibration.csv` | free | precision/recall/F1 vs threshold; max-F1 recommendation |

Discovery (Python/uv, from `services/discovery/` or via compose):
- `docker compose run --rm discovery uv run --no-sync python -m discovery.main --boards`
- `--jobspy` (JobSpy only), `--all` (both, cron default), `--dry-run` (no DB writes).

## Deploy / redeploy
From `deploy/` (so `.env` is loaded):
```sh
docker compose build              # rebuild changed service images
docker compose up -d              # create/recreate + start (applies migrations via poller)
docker compose up -d --build api  # rebuild + redeploy a single service
docker compose logs -f pipeline   # tail logs
docker compose ps                 # status + health
```
- `apps/*/build` and `out/` are gitignored; the API image **builds the SPAs inside the
  Docker build** (`services/api/Dockerfile` stage 1: `VITE_BASE=/resume/ pnpm --filter
  site build && pnpm --filter review build`). No committed build output — a code change
  to `apps/site` or `apps/review` requires `docker compose build api`.
- The `nginx` external network must exist before `up` (created by nginx-proxy-manager).
- Migrations apply automatically when `pipeline` starts; no separate migrate step needed
  for a normal deploy.

## Known gotchas (with fixes)
- **supercronic fatals as PID 1.** Its process reaper assumes it is not PID 1. Fix:
  `init: true` on the discovery service (tini becomes PID 1). Already set; keep it.
- **busybox-wget healthcheck must use `127.0.0.1`, not `localhost`.** Alpine's
  busybox wget can fail name resolution for `localhost` in some setups — use
  `http://127.0.0.1:8080/healthz` in any API healthcheck.
- **Cloudflare Flexible SSL + NPM ForceSSL → redirect loop.** With CF SSL mode
  "Flexible", Cloudflare talks HTTP to the origin while NPM force-redirects to HTTPS,
  looping. Fix: set the Cloudflare SSL mode to **Full** for the `jobs.churong.cc` host.
- **No host ports.** Never add a `ports:` mapping; exposure is exclusively via NPM on
  the `nginx` network. Adding a port bypasses the access list and leaks PII.
- **External `nginx` network missing** → `up` fails with "network nginx not found".
  Create it (nginx-proxy-manager owns it) before deploying.

## Sibling docs
- Data contracts / résumé + overlay model: `./data-contracts.md`
- Pipeline internals (parse/score/tailor/verify): `./pipeline.md`
- Renderer / frontends: `./renderer.md`
(Cross-links are by convention; create siblings as they are written.)
