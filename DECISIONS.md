# DECISIONS

Dated decision log (newest first). This is the per-session handoff log
`/orient` reads.

## 2026-06-10b — Preview/print scale fix + modal topbar alignment

- **Scale must scale CONTENT inside a fixed page, not the page itself.** The
  shipped impl used `transform: scale()` on the whole pagedjs page stack — which
  only visually shrank the paper (page count never changed; print ignored it).
  Switched to CSS `zoom` everywhere: zoom reflows, so (a) pagedjs repaginates the
  scaled content into fixed @page sheets — verified 4→2 pages at scale 0.6 with the
  page box staying A4 794×1123 — and (b) zoom survives into print (transform got
  reverted in @media print). Rejected `transform` (no reflow) and per-page font
  scaling (fragile across pagedjs fragments).
- **Multipage zooms the pagedjs SOURCE, not the rendered pages.** Wrap the source
  in `{width: contentBox/scale, zoom: scale}` so the content is pre-scaled to full
  page width before pagedjs reads `innerHTML` and paginates. Verified with a real
  pagedjs@0.4.3 + chromium harness that the zoom wrapper survives fragmentation AND
  the content fills the page width (paragraph right edge == content-box edge).
- **Print margins: re-assert `@page` with `!important` to beat pagedjs.** pagedjs
  injects `@page { size: letter; margin: 0 }` into `<head>` when it paginates —
  AFTER App's `usePageStyle` @page (equal specificity → source order → pagedjs
  wins → margins lost). `useFrameStyle` now appends a print-only `@page { size
  !important; margin !important }`; !important out-ranks pagedjs's non-important
  reset regardless of order (spec-guaranteed). Verified: our rule present + the
  later pagedjs @page rules are non-important; PDF MediaBox = A4.
- **Kept the Playwright PDF path authoritative + untouched.** `pnpm pdf` renders
  the DEFAULT bare host (no `?preview`, no PaperFrame, no pagedjs) and feeds
  `pdfOptions({format, margin, scale})` to `page.pdf()`. All preview/modal-print
  changes are confined to `PaperFrame` (preview-only), so the byte-identical-DOM
  invariant and the canonical PDF output are unaffected.
- **Modal topbar: fixed via tailwind-merge gaps, not new markup.** shadcn
  `DialogHeader` carries `space-y-1.5` and `DialogContent` carries `gap-4`; neither
  is overridden when the modal flips grid→flex / p-6→p-0, so they leaked as a
  phantom switch top-margin and a 32px topbar gap. Added `space-y-0` + `h-12` (row
  centerline matches the auto-injected close button at 24px) and `gap-0`. CSS-only,
  scoped to PreviewModal — shared `dialog.tsx` left alone so other dialogs are safe.

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
