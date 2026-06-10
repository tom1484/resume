# STATE

Pointer doc for the next agent. Deep reference: `docs/agents/` (start at README);
contract spec: `docs/CONTRACTS.md` (§13 = the latest UI additions).

## Done & verified (2026-06-10)
Dashboard UX layer shipped on top of the live stack — **deployed to `jobs-api` and
verified live** (jobs.churong.cc, behind NPM auth):
- **Config validation / constrained inputs** — LLM model dropdowns (`KNOWN_MODELS` +
  custom-entry), searchable timezone combobox, live cron validation, `JobType` +
  jobType/country dropdowns, context-sensitive Constraints `equals`, weights-sum warning.
- **Toggleable preview modal rendering UNSAVED edits** — full-width editors +
  `PreviewModal`; a typed `PreviewMessage` postMessage bridge pushes the in-memory
  doc/overlay into the bare host (no auto-save). Works pre-save on the review page.
- **Paper-accurate preview** — `PaperFrame` renders configured size/margins/scale;
  true multi-page (pagedjs, lazy) + a Continuous switch; single scroll region; clean
  print (no trailing blanks).

Gates (all green): `pnpm test` **190/190**, `pnpm lint` 0 errors, dashboard+site
typecheck clean, **render-check DOM byte-identical**, `pnpm pdf` OK, discovery
`pytest` **34/34**. Live Playwright E2E: modal renders 4 A4 pages.

Committed on branch **`feat/dashboard-preview-and-validation`** (`7b457cc` code +
this docs/handoff commit). **About to fast-forward `main` and push to `origin`.**

## In progress
Nothing half-built. (pagedjs multi-page is verified working; if it ever fails it
degrades to the dependency-free continuous engine.)

## Next
1. **Local apply agent** (still the next major piece of work; runs on Tom's machine
   only, never the server). Status placeholders `applying/applied/responded` exist.
2. Optional polish: true multi-page page-break guides; broaden field validation if more
   free-text config fields appear.

## Known traps
- **Byte-identical DOM invariant** (render-check, binding): the preview/paper-frame is
  ADDITIVE and OFF by default — only `?preview=…` mounts `PreviewRoot`'s listener /
  `PaperFrame`. A bare `/resume/` and `pnpm pdf` must stay unchanged. Don't widen this.
- **`pagedjs` is dynamically imported** (preview-only) — never import it eagerly or it
  bloats the default bundle / PDF path.
- **`LlmConfig.models.*` is intentionally `z.string()`, NOT a Zod enum** — the dropdown
  is sourced from `KNOWN_MODELS` with a `__custom__` escape hatch. Don't "tighten" it.
- **`JobType` enum ↔ Python mirror**: `services/discovery/.../config.py` default must
  stay in the enum (`'internship'`); it passes the value through, no enforcement.
- **Print-from-modal** depends on the `@media print` rules in `PaperFrame` (hide
  `.pagedjs_pages`, reveal `.paper-frame__source`). Removing them brings back trailing
  blank pages.
- **Deploy = build from the working tree.** The live `jobs-api` image was built from the
  tree (Dockerfile context = repo root). Only `jobs-api` was rebuilt; pipeline/discovery
  /db untouched (UI changes live entirely in that image). Redeploy: from `deploy/`,
  `docker compose build api && docker compose up -d api` (API runs migrations at start).

## Map (what this work touched)
- Contracts (SSoT, all additive): `packages/contracts/src/preview.ts` (PreviewMessage),
  `print.ts` (PAPER_DIMENSIONS), `events.ts` (KNOWN_MODELS), `config.ts` (JobType).
- Renderer: `packages/renderer/src/data/print.ts` (`mmToPx`, `MM_TO_PX`).
- Bare host: `apps/site/src/{index.tsx, PreviewRoot.tsx, PaperFrame.tsx, preview.ts}`.
- Dashboard: `components/{PreviewModal,ResumeCanvas}.tsx`, `components/ui/{select,
  popover,command,combobox,dialog,field-error}.tsx`, `lib/{validators,lists}.ts`,
  routes `{Llm,Scrawling,Constraints,Resume,Review}Page.tsx`, `resumeEditor.ts`.
- Deploy: `deploy/docker-compose.yml`, `services/api/Dockerfile` (builds both SPAs).
