# CLAUDE.md

Personal résumé site (React + Tailwind) extended into a self-hosted **job
application pipeline**. **This is v2** — a clean TypeScript/pnpm-monorepo
reimplementation that replaced v1 and is **LIVE** behind NPM auth at
jobs.churong.cc. Rebuild record: `docs/v2/DECISIONS.md`; authoritative
contract spec: `docs/v2/CONTRACTS.md`.
**Deep agent reference: `docs/agents/` (start at `docs/agents/README.md`) —
exhaustive per-subsystem maps; read it before non-trivial changes.**
**Current phase: v2 cutover done (contracts SSoT + unified dashboard SPA +
config layer + two-list scoring). Phase 4 (local apply agent) is next.**
Update this line as phases complete.

> History note: any doc/comment describing `apps/review`, `x-`-prefixed résumé
> fields, env-var model selection (`MODEL_*`), supercronic crontab, or Ajv-as-SSoT
> is **v1 and wrong**. Trust the code on disk + `docs/v2/*`.

Packages (pnpm workspace): `packages/contracts` (`@resume/contracts` — Zod
single source of truth), `packages/renderer` (`@resume/renderer` — TS résumé
renderer + editor data layer), `apps/dashboard` (the one shadcn/ui + react-router
admin SPA), `apps/site` (chrome-less bare résumé render host for print/PDF +
review preview). Services: `services/discovery` (Python — boards + JobSpy +
in-process scheduler), `services/pipeline` (TS — poller: parse→score→tailor→
verify→in_review→Telegram), `services/api` (Fastify, container `jobs-api`, port
8080 — review/config/dashboard API + serves both SPAs + applies DB migrations).
Migrations live in `services/api/migrations`.

## Load-bearing invariants

- **Contracts are the single source of truth** (`packages/contracts/src/*`).
  Every shape (résumé, overlay, view-model, pipeline `Jd/Fit/Tailor/Verdict`,
  `ScoreBreakdown`, config, DB projections, `DashboardSummary`/`EventRow`, the one
  `overlayProblems`, `costUsd`) is a Zod schema defined ONCE. JSON Schema for Ajv
  consumers is **emitted** from Zod via Zod-4 native `z.toJSONSchema()`
  (`pnpm --filter @resume/contracts build && … gen:schemas`). Never restate a
  shape in a consumer; never hand-write a JSON Schema.
- **Anti-fabrication is load-bearing and preserved verbatim.** The 3-layer chain:
  generation constraint (master-bank-only, replace-only patches, required
  `groundedIn`, ≤4 patches — `tailor.ts`) → verify (numeric tripwire ignoring
  years 2019–2030 + unknown-id/empty-grounding auto-fail + Haiku skeptic
  uncertain→false — `verify.ts`) → drop policy (`audit.unsupported === []` by
  construction at `in_review`, `patchIndex` renumbered — `tailorJob.ts`). Reviewer
  edits bypass (trusted). Never weaken without re-running `eval:verify`.
- **The canonical résumé is DB-backed** (`resume_versions`, latest row = current).
  `data/resume.json` (repo root) is the seed + `pnpm export-seed` target + bundled
  offline fallback — NOT the live source. Field names are **un-prefixed v2**
  (`time, info, tags, links, venue, authors, track, kind, badge`) — no `x-`.
- **Config layer:** every non-secret setting is a DB `config` row (namespaces
  `llm / schedule / discovery / constraints / preferences`), UI-editable, validated
  on write by the matching Zod; services read it at runtime via best-effort
  `getConfig(ns)` with schema-default fallback (a UI edit takes effect next
  cycle/tick, no restart). **Secrets stay in env** (`ANTHROPIC_API_KEY`,
  `TELEGRAM_*`, `DATABASE_URL`/`POSTGRES_*`, `REVIEW_BASIC_AUTH`) — never DB, never
  UI.
- **Validate at the boundary.** The API `.parse()`s its OWN output
  (`DashboardSummary.parse`, `EventRow.array().parse`); the pipeline `.parse()`s
  `ScoreBreakdown` before persisting; the migration validates every reshaped
  record. A contract that isn't enforced on output/write lets bad data through.
- **Renderer DOM stays byte-identical.** Internals changed (data flows via an
  immutable `ResumeDataProvider`, not a mutable singleton), but the rendered
  résumé DOM must not change — before/after any renderer touch use the
  `render-check` skill (empty DOM diff; PDF bytes always differ on timestamps).
- The adapter (`packages/renderer/src/data/adapter.ts`) emits exactly the §3
  view-model keys (components spread items onto DOM); `ViewModels` Zod
  (`.strict()` + no-`undefined` guard) + `adapter.test.ts` enforce it for ALL
  sections.
- Code and its test land in the same change. Any change to an LLM prompt
  (parse/fit/tailor/verify) requires the matching `eval/*` harness to pass,
  including the fabrication-injection test (zero unsupported). No exceptions.

## Safety constraints (override convenience, always)

- Never run logged-in job-platform automation from the server. The apply agent
  (Phase 4) runs on Tom's local machine only. JobSpy is public/unauthenticated;
  jittered pacing is intentional.
- Submission is always human-confirmed. ≤50 applications/day, jittered pacing.
  2FA/CAPTCHA always pauses for a human.
- Application data is PII: stays on Tom's server, the dashboard stays behind nginx
  proxy manager auth, no exposed host ports, no third-party vector DBs.

## Commands

```sh
pnpm validate   # contracts:build (Zod→JSON Schema) then Ajv-check resume/master/overlays
pnpm test       # contracts:build then vitest (node project + jsdom dashboard project)
pnpm lint       # eslint flat config (Python lints via ruff)
pnpm build      # validate + build apps/site (VITE_BASE=/resume/) + apps/dashboard
pnpm contracts:build          # tsc the contracts pkg, then gen:schemas (dist/schemas/*.json)
pnpm pdf        # Playwright → out/resume.pdf
pnpm export-seed              # GET live /api/resume → data/resume.json
# deploy (from deploy/): docker compose build && docker compose up -d
# discovery (Python, from services/discovery/): uv run pytest
```

## Deployment

Docker compose on Tom's server (project `job-pipeline`). `jobs-api` is the ONLY
web-facing service — joins NPM's external `nginx` network; **no exposed host
ports**. The `pipeline` + `api` images build from the **repo root** (they need
`@resume/contracts`). The API applies DB migrations at startup. Details + the
cutover/rollback runbook + the v1→v2 migration: `docs/agents/operations.md`.
