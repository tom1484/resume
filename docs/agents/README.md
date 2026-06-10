# Agent docs — start here

Dense reference for an AI agent picking up this repo. Read this file first
(2 min), then jump to the topic doc for your task. For always-on invariants see
the repo-root `CLAUDE.md`. These docs are the **deep, exhaustive** layer.

> Trust the **code on disk** + `docs/CONTRACTS.md` (authoritative Zod spec).
> Every path/route/symbol below is meant to resolve in the code; if one doesn't,
> fix the doc.

## What this is (60-second model)

A data-driven résumé (`packages/renderer`) extended into a **self-hosted job
application pipeline**, with one **Zod contracts package** (`@resume/contracts`)
as the single source of truth that every other subsystem imports. The loop:

```
discovery (scheduled) → jobs table → pipeline (poll): parse_jd → score(two lists)
  → gate → tailor → verify(anti-fabrication) → status=in_review → Telegram
        → you review/edit/approve + tune config + edit the résumé in the
          dashboard SPA at https://jobs.churong.cc
        → [not built yet] local apply agent submits approved apps
```

Key architecture:

- **Contracts SSoT.** `packages/contracts` defines every shape once in Zod;
  JSON Schema (for Ajv) is **emitted** from Zod, not hand-written. One copy of
  the section-key list, one `overlayProblems`, typed `score_breakdown`.
- **One SPA + a bare host.** `apps/dashboard` (shadcn/ui + react-router) is the
  single admin UI at `/` with tabs `/dashboard /review /resume /scrawling /llm
  /preferences /constraints /answers`. `apps/site` is the chrome-less **bare
  résumé render host** at `/resume/` (print/PDF target + the review preview,
  iframed).
- **Un-prefixed résumé fields** (`time, info, tags, links, venue, authors,
  track, kind, badge`).
- **DB-backed config layer.** Every non-secret setting is a `config` table row,
  UI-editable, Zod-validated; services read it at runtime (`getConfig(ns)`).
  Secrets stay in env.
- **Two-list scoring.** Deterministic **Constraints** (vs parsed-JD fields; the
  F-1 rules are seeded config) + **Preferences** (priority 1–10, injected into
  the LLM fit prompt).
- **In-process DB-driven scheduler** in `services/discovery` (`scheduler.py`).
- **Anti-fabrication** — load-bearing and verbatim across generation, verify,
  and drop policy.

## Doc map

| Doc | Read it when |
|---|---|
| [architecture.md](./architecture.md) | You need the system map / how the contracts pkg + SPA + bare host + 3 services + DB connect / the two end-to-end flows / container topology |
| [data-contracts.md](./data-contracts.md) | You touch any shape — short index; points to `docs/CONTRACTS.md` (authoritative) |
| [pipeline.md](./pipeline.md) | You change discovery, the scheduler, scoring (two lists), tailoring, verification, config knobs, or evals |
| [frontend.md](./frontend.md) | You change the dashboard SPA, the renderer, the editor, the bare host, print/PDF, or Vite/build |
| [operations.md](./operations.md) | You deploy, add a DB migration, seed config, touch env/secrets, or read the deploy/rollback runbook + Lessons |

## Task router — "I need to…"

| Task | Go to |
|---|---|
| Add/rename a shape (résumé field, overlay key, config field, DB column) | data-contracts.md → then `packages/contracts/src/*`; **rebuild + gen:schemas + `pnpm validate`** |
| Change what the résumé renders / add a section component | frontend.md → renderer; **then `render-check` skill (empty DOM diff)** |
| Change the tailoring/parse/fit/verify prompt or model | pipeline.md; models come from the `llm` config, NOT env; **then run the matching `eval/*`** (CLAUDE.md gate) |
| Adjust the match score / gate / weights | pipeline.md → score; the `llm` config (`scoreThreshold`, `weights`) — UI-editable |
| Add/edit a hard constraint or soft preference | pipeline.md → two-list scoring; `constraints`/`preferences` config (UI tabs) |
| Add a discovery source / company / search | pipeline.md → discovery; the `discovery` config (UI tab) — NOT the YAMLs |
| Change the schedule | the `schedule` config (UI tab); pipeline.md → scheduler |
| Add/alter a DB column or table | data-contracts.md → DB; add `services/api/migrations/00N_*.sql` (API applies them) |
| Add an API route / dashboard tab / config UI | architecture.md + frontend.md; the route in `services/api/src/app.ts` |
| Deploy / env / runbook | operations.md |
| Refactor the renderer safely | use the `render-check` skill (DOM diff must be empty) |

## Repo coordinates

- **Workspace** (pnpm; `pnpm-workspace.yaml` globs `apps/* packages/* services/*`):
  `packages/contracts` (`@resume/contracts`, TS, the SSoT, emits
  `dist/schemas/*.json`), `packages/renderer` (`@resume/renderer`, TSX source
  package — Vite aliases `@components/@config/@contexts/@data` for `apps/site`,
  deep subpath imports for the dashboard, no barrel), `apps/dashboard` (`dashboard`,
  Vite SPA), `apps/site` (`site`, Vite bare host), `services/{discovery,pipeline,
  api}`, `scripts/`, `deploy/`.
- **Commands** (root): `pnpm validate / test / lint / build`,
  `pnpm contracts:build` (tsc + gen:schemas), `pnpm pdf`, `pnpm export-seed`.
  Python: `cd services/discovery && uv run pytest`.
- **Live**: `https://jobs.churong.cc` behind nginx-proxy-manager access list →
  `jobs-api:8080`. Containers: `jobs-db / jobs-discovery / jobs-pipeline /
  jobs-api` (compose project `job-pipeline`). No host ports; web only via NPM.
- **Plans/state**: `docs/CONTRACTS.md` (authoritative Zod contract spec);
  per-session decisions/handoff in the repo-root `DECISIONS.md`. The local apply
  agent is not built yet.

## Glossary

- **contracts (`@resume/contracts`)** — the Zod single source of truth. One file
  per concern in `packages/contracts/src/` (`sections, resume, viewModel, overlay,
  master, pipeline, scoring, config, db, api, events, jobRow, antifab, print,
  schemas`); barrel `index.ts`. Emits Ajv JSON Schemas via `schemas.ts`.
- **section registry** — `sections.ts` `SECTION_REGISTRY`: THE one list of the 9
  section keys (+ `source/list/editable/titleKey/pick`). Derives the overlay enum,
  the TailorSchema enum, the editor tree, `sectionsConfig`, and `sectionOrder`
  validation. The work/projects split lives only in its `pick` predicates.
- **overlay** — per-job tailoring artifact: `{ profile{sections,filters}, patches
  (RFC-6902 replace-only for LLM), coverLetter, audit }`. Applied to a clone of the
  résumé. `overlayProblems(overlay, resumeDoc)` (`api.ts`) is the ONE validator.
- **master bank** — `packages/renderer/src/data/master.json`: every accomplishment
  as a stable-id bullet; the grounding corpus for tailoring/verification.
  File-based (not DB); ids immutable once referenced; `groundedIn` refs are bare
  `<id>`.
- **two-list scoring** — Constraints (hard, deterministic, `evaluateConstraints`)
  + Preferences (soft, priority 1–10, `preferenceBlock` into the fit prompt).
- **company_flags** — `dream` (→ Opus tailoring), `startup`, `return-path`.
- **bare host** — `apps/site`: chrome-less résumé render at `/resume/`; the
  print/PDF target and the dashboard's review preview (iframed by `ResumeCanvas`).
- **getConfig(ns)** — best-effort DB config read with schema-default fallback
  (the resilient `refreshResume` pattern, generalized). TS: `services/*/config.ts`;
  Python: `services/discovery/src/discovery/config.py` (kept in lockstep).
