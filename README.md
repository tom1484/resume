# Resume — self-hosted job-application pipeline

A data-driven résumé renderer extended into a **self-hosted job-application
pipeline**: it discovers internship postings, scores them against your profile,
LLM-tailors your résumé per job (with strict anti-fabrication), and serves a
review/config dashboard. Live behind nginx-proxy-manager auth at
`jobs.churong.cc`.

A TypeScript **pnpm monorepo** with a Zod single-source-of-truth contracts
package.

```
packages/contracts/   @resume/contracts — Zod schemas = the single source of truth
                      (résumé, overlay, view-models, pipeline I/O, config, DB DTOs);
                      JSON Schema is emitted from Zod
packages/renderer/    @resume/renderer — TS résumé renderer (components, adapter,
                      overlay, editor data layer + the dnd-kit ResumeTree)
apps/dashboard/       the admin SPA (React + react-router + shadcn/ui):
                      /dashboard /review /resume /scrawling /llm /preferences
                      /constraints /answers
apps/site/            chrome-less bare résumé render host (print/PDF + the
                      dashboard's review preview)
services/discovery/   Python — board + JobSpy ingestion, in-process DB scheduler
services/pipeline/    TS — poller: parse → score → tailor → verify → review
services/api/         Fastify — review/config/dashboard API, serves both SPAs,
                      applies DB migrations at startup (migrations live here)
scripts/ · deploy/    tooling · docker-compose stack + secrets (.env, gitignored)
```

**Docs for contributors / agents:** start at
[`docs/agents/README.md`](docs/agents/README.md) (the deep per-subsystem
reference). The authoritative contract spec is
[`docs/CONTRACTS.md`](docs/CONTRACTS.md). Always-on rules: `CLAUDE.md`.

## Quick start

```sh
pnpm install
pnpm contracts:build   # build @resume/contracts + emit JSON Schemas (deps of the rest)
pnpm dev               # résumé renderer dev server (apps/site)
pnpm test              # vitest across the workspace (node + jsdom dashboard projects)
pnpm validate          # Ajv-check résumé / master bank / overlays against the emitted schemas
pnpm lint              # eslint (Python lints via ruff)
pnpm build             # validate + build apps/site and apps/dashboard
pnpm pdf               # render the résumé to out/resume.pdf (Playwright)
```

Python service (from `services/discovery/`): `uv run pytest`.

## The résumé

The canonical résumé is **DB-backed** (`resume_versions`; the latest row is
current, full history is kept). You edit it in the dashboard's **`/resume`** tab
(Structured / JSON / Print tabs) — every save writes a new version.
`data/resume.json` (repo root) is the **seed + offline fallback + `pnpm
export-seed` target**, *not* the live source; `pnpm export-seed` pulls the live
résumé into it.

The résumé shape is the **`ResumeDoc` Zod contract** in `@resume/contracts`
(plain, un-prefixed field names — `time`, `info`, `tags`, `links`, `venue`,
`authors`, …; no JSON-Resume `x-` prefixes). Per-job tailoring never mutates the
résumé — it's an **overlay** (section selection + filters + RFC-6902 patches),
verified against the master bullet bank so the LLM can't fabricate. See
[`docs/CONTRACTS.md`](docs/CONTRACTS.md) for every field.

## Print / PDF

Print config lives in `meta.print` (the Print tab): paper size
(A4/Letter/Legal/A3/A5), margins (mm), scale.

- **Browser:** print / "Save as PDF" from the résumé view — an `@page` rule
  applies the size + margins, and only the résumé prints (the dashboard chrome
  is hidden in print).
- **`pnpm pdf`:** renders `out/resume.pdf` via Playwright using the print config.

## Serving

`services/api` (container `jobs-api`, port 8080) serves everything on one origin:
the dashboard SPA at `/`, the bare résumé host at `/resume/`, and `/api/*` +
`/applications/*` as JSON. It's the only web-facing service (behind the NPM
access list — everything is PII). Deploy + the deploy/rollback runbook:
[`docs/agents/operations.md`](docs/agents/operations.md).

## CI

`.github/workflows/ci.yml` validates the data, runs the test suite, and builds;
a separate job lints + tests the Python discovery service.
