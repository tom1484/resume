# DECISIONS

Dated decision log (newest first). The v2 rebuild record lives in
`docs/v2/DECISIONS.md`; this is the per-session handoff log `/orient` reads.

## 2026-06-10 — Dashboard UX: validation + preview modal + paper-accurate render

- **Preview modal renders UNSAVED edits via postMessage; no auto-save.** Investigated
  first: the preview iframe was purely fetch-driven (saved state only). Rather than
  auto-save on preview, added a typed `PreviewMessage` bridge (contracts/`preview.ts`)
  so the dashboard posts the in-memory `doc`/`overlay` into the bare host. Kept the
  renderer iframed (not in-app) because the canvas needs the renderer's Vite aliases +
  Tailwind-preflight isolation and IS the Playwright PDF target. Rejected: rendering
  the canvas in-app (breaks isolation + pixel-stability), base64-in-URL (length/security).
- **Modal is blocking + centered** (user choice). Live-while-typing is therefore moot;
  the modal posts the current snapshot on open. Bug-fixed later: the iframe filled the
  modal (not a fixed height) so there's a single scroll region; the close button gets
  header right-padding (`pr-12`) to clear the Continuous switch.
- **`LlmConfig.models.*` stays `z.string()` (NOT a Zod enum) + dropdown from
  `KNOWN_MODELS` (= `PRICES` keys) with a `__custom__` escape hatch.** Why: model IDs
  change; a hard enum would reject a new/retired model on every config load and force a
  rebuild. Forward-compat beats strictness here.
- **`JobType` IS an enum** (`jobspyDefaults.jobType`), unlike models — the JobSpy set is
  small + stable ({fulltime,parttime,internship,contract}). Verified the Python mirror
  passes it through and default `'internship'` is in the enum → no Python change.
- **Paper preview: true multi-page DEFAULT (pagedjs) + Continuous switch + fallback**
  (user choice). pagedjs is dynamically imported so it never enters the default bundle
  or the PDF path; continuous is the dependency-free guaranteed engine and the
  degrade-to target. Print hides pagedjs page-boxes and reveals the source résumé so the
  browser paginates via `@page` — fixes trailing blank pages.
- **`PAPER_DIMENSIONS` in contracts; `mmToPx` in `renderer/data/print.ts`.** Co-located
  the data fact with `PAPER_SIZES` (so they can't drift) and the pure function beside
  `pageCss`/`pdfOptions` — matching the existing shape-vs-function split.
- **Contracts stayed single-source-of-truth**: the two work tracks touched disjoint
  contract files (events/config vs print/preview), all via the `export *` barrel — no
  divergence (verified before fan-out, per the user's explicit ask).
- **Deploy: rebuilt/redeployed ONLY `jobs-api`.** It's the only image that bundles the
  changed UI (it builds both SPAs + contracts); pipeline/discovery/db were left running
  (the contracts additions don't affect their runtime). Built from the working tree.
- **Implementation orchestrated as foundation (self) → 2 parallel agent waves**
  (disjoint files) → integrated verify, to keep contracts correct and avoid lockfile/
  barrel write-conflicts between concurrent agents.
