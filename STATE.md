# STATE

Pointer doc for the next agent. Deep reference: `docs/agents/` (start at README);
contract spec: `docs/CONTRACTS.md` (§13 = the latest UI additions).

## Done & verified (2026-06-10b) — preview scale/print fix + modal topbar
Branch **`fix/preview-scale-print-and-modal-topbar`** (off current `main` =
`6f2794e`), NOT yet built/deployed — the served `/resume/` iframe still runs the
OLD `PaperFrame` until `jobs-api` is rebuilt (see Next).
- **Preview scale now scales CONTENT, not page size.** Scale was a `transform` on
  the whole pagedjs page stack (just shrank the paper). Now scale is `zoom` on the
  content: multipage wraps the pagedjs SOURCE in `{width: contentBox/scale, zoom:
  scale}` so pagedjs repaginates scaled, full-width content into fixed @page sheets;
  continuous switched transform→zoom. Verified live (real renderer + chromium):
  4 pages → 2 at scale 0.6, page box stays A4 794×1123.
- **Print from modal now honors margins + scale.** pagedjs injects its own
  `@page { margin: 0 }` reset AFTER App's `usePageStyle` (equal specificity → later
  wins → margins dropped). `useFrameStyle` now injects a print-only
  `@page { size !important; margin !important }` that out-ranks it; `zoom` (unlike
  transform) reflows + survives into print, so scale applies too.
- **Preview modal topbar** (dashboard): `space-y-0` kills the phantom switch
  top-margin (inherited `space-y-1.5`); `h-12` aligns the row with the close button;
  `gap-0` on DialogContent removes the inherited `gap-4` (the extra 32px topbar gap).

Gates: `pnpm test` **186/186**, `pnpm lint` 0, site typecheck clean, `pnpm pdf` OK
(authoritative path = default render + `pdfOptions`, untouched). pagedjs stays a
dynamic-only chunk.

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

Gates (green when shipped): `pnpm test` **186/186** (was 190 before `78d8442`
dropped the dead v1→v2 migration + its tests), `pnpm lint` 0 errors, dashboard+site
typecheck clean, **render-check DOM byte-identical**, `pnpm pdf` OK, discovery
`pytest` **34/34**. Live: deployed to `jobs-api`, modal renders 4 A4 pages.

## In progress
**`fix/preview-scale-print-and-modal-topbar` is committed but NOT deployed.** The
preview iframe (`/resume/`) is served by `jobs-api` from a STATIC build of
`apps/site` baked into the image — source edits don't show until rebuild. Until
then the live preview shows the OLD (page-size) scale + broken print.

## Next
1. **Merge + deploy `fix/preview-scale-print-and-modal-topbar`.** Fast-forward to
   `main`, push, then from `deploy/`: `docker compose build api && docker compose
   up -d api` (rebuilds both SPAs). Then eyeball live: scale repaginates at fixed
   A4; modal Print dialog shows configured margins + scaled content.
2. **Local apply agent** (the next major piece; runs on Tom's machine only, never
   the server). Status placeholders `applying/applied/responded` exist.
3. Optional polish: true multi-page page-break guides; broaden field validation if more
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
- **Scale = `zoom`, never `transform`** in `PaperFrame`. zoom reflows (so pagedjs
  repaginates + it survives into print); transform only visually shrinks the stack
  (scales page size, not content). Multipage zooms the SOURCE wrapper (`width:
  contentBox/scale; zoom: scale`) so pagedjs paginates scaled, full-width content.
- **pagedjs injects `@page { margin: 0 }` into `<head>` after `usePageStyle`** —
  for native (modal) print to keep margins, `useFrameStyle` re-asserts `@page {
  margin … !important }` (!important out-ranks pagedjs's later non-important rule).
  Don't drop the `!important`.
- **Browser print scale has no CSS `@page` knob** — only `zoom` on content can scale
  a Ctrl+P / modal-print output. Playwright `pnpm pdf` is separate (uses
  `pdfOptions.scale` on the default render, no PaperFrame) and stays authoritative.
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
