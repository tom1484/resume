# Agent docs — start here

Dense reference for an AI agent picking up this repo. Read this file first
(2 min), then jump to the topic doc for your task. For always-on invariants
see the repo-root `CLAUDE.md`; for the human-oriented overview see
`ARCHITECTURE.md`. These docs are the **deep, exhaustive** layer.

> Accuracy rule: this repo has changed a lot over time. Trust the **code on
> disk**, not stale memory. Every path/route/symbol below is meant to be
> real — if one doesn't resolve, fix the doc.

## What this is (60-second model)

A data-driven résumé (`packages/renderer`) extended into a **self-hosted job
application pipeline**. The loop:

```
discovery (nightly) → jobs table → pipeline (poll): parse_jd → score → gate
  → tailor → verify(anti-fabrication) → status=in_review → Telegram
        → you review/edit/approve at https://jobs.churong.cc (review SPA)
        → [Phase 4, not built] local apply agent submits approved apps
```

- **Canonical résumé is DB-backed** (`resume_versions` table; latest row =
  current). `data/resume.json` (repo root) is the seed + export target +
  offline fallback — **not** the live source.
- **No profiles.** One résumé; per-job customization is an **overlay**
  (section selection + filters + RFC-6902 patches), never a mutation of the
  base. Tailoring and the review editor both produce overlays.
- **Anti-fabrication is load-bearing**: `verify.js` (numeric tripwire +
  Haiku skeptic) + drop-unsupported-patches in `tailorJob.js`. Reviewer
  edits are trusted; only LLM-written patches are verified.

## Doc map

| Doc | Read it when |
|---|---|
| [architecture.md](./architecture.md) | You need the system map / how components connect / the end-to-end flows |
| [data-contracts.md](./data-contracts.md) | You touch résumé JSON, the overlay shape, DB tables, or API routes |
| [pipeline.md](./pipeline.md) | You change discovery, scoring, tailoring, verification, or evals |
| [frontend.md](./frontend.md) | You change the renderer, either app, the editor, or PDF/print |
| [operations.md](./operations.md) | You deploy, add env/secrets, run commands, or debug the stack |

## Task router — "I need to…"

| Task | Go to |
|---|---|
| Change what the résumé renders / add a section component | frontend.md → render path; data-contracts.md → adapter key contract |
| Change the tailoring prompt / model | pipeline.md → tailor; **then run `eval/run-parse-eval.js` + `run-verify-eval.js`** (CLAUDE.md gate) |
| Adjust the match score / gate | pipeline.md → score; env `SCORE_THRESHOLD` |
| Add a discovery source / company / search | pipeline.md → discovery; `services/discovery/config/*.yml` |
| Add/alter a DB column or table | data-contracts.md → DB; add a `services/pipeline/migrations/00N_*.sql` |
| Add an API route or review-UI feature | data-contracts.md → API; frontend.md → apps/review |
| Deploy / redeploy / read logs / env | operations.md |
| Refactor the renderer safely | use the `render-check` skill (DOM-diff must be empty) |

## Repo coordinates

- **Workspace** (pnpm): `apps/site` (renderer, served `/resume/`), `apps/review`
  (review SPA, served `/`), `packages/renderer` (`@resume/renderer`: components +
  config + contexts + data layer; consumed via Vite aliases `@components/@config/
  @contexts/@data` and deep subpath imports — no package barrel),
  `services/{discovery,pipeline,api}`, `scripts/`, `deploy/`.
- **Commands** (root): `pnpm validate` (Ajv: résumé + extensions + overlays +
  master), `pnpm test` (vitest, all packages), `pnpm lint` (eslint flat config),
  `pnpm build` (validate + site build → `apps/site/build`), `pnpm pdf`,
  `pnpm export-seed` (DB → `data/resume.json`). Python: `cd services/discovery &&
  uv run pytest`.
- **Live**: `https://jobs.churong.cc` behind nginx-proxy-manager access list →
  `jobs-api:8080`. Containers: `jobs-db / jobs-discovery / jobs-pipeline /
  jobs-api` (compose project `job-pipeline`). No host ports; web only via NPM.
- **Plans/state**: `PROPOSALS.md` (plan of record), `PLAN.md` (per-task progress),
  `PREPARE.md` (operator setup + owed items). Phases 1–3 + review-editor done;
  Phase 4 (local apply agent) not built.

## Glossary

- **overlay** — per-job tailoring artifact: `{ profile{sections,filters}, patches
  (RFC-6902), coverLetter, audit }`. Applied to a clone of the résumé at render
  time (`overlay.js#applyOverlay`). Schema: `overlay.schema.json`.
- **master bank** — `packages/renderer/src/data/master.json`: every accomplishment
  as a stable-id bullet; the grounding corpus for tailoring/verification.
- **company_flags** — `dream` (high-effort tier → Opus tailoring), `startup`,
  `return-path`. On the `jobs` row.
- **tailor / verify** — `tailor.js` generates the overlay (Sonnet, Opus for
  `dream`); `verify.js` audits each patch (numeric tripwire + skeptic);
  `tailorJob.js` drops unsupported patches so review only sees grounded edits.
- **adapter key contract** — `adapter.js#buildViewModels` must emit exactly the
  known view-model keys (components spread them onto DOM); `adapter.test.js`
  enforces it.
- **editor model** — `editorModel.js` bridges résumé/overlay ⇄ a section/item/
  bullet tree for the dnd-kit editor (`editor/ResumeTree.jsx`).
