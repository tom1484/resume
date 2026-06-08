# Resume

A data-driven résumé built with React + Vite + Tailwind, and the base of a
self-hosted job-application pipeline. The résumé content is a single
[JSON Resume v1.0.0](https://jsonresume.org/schema) document (plus `x-`
extensions); it renders as a print-ready page and is edited through a web
editor backed by a versioned database.

This repo is a **pnpm workspace**:

```
apps/site/            the résumé renderer + /resume editor (Vite)
apps/review/          the job-review SPA (Vite)
packages/renderer/    @resume/renderer — résumé data, components, editor, overlay
services/             discovery (Python) · pipeline (Node) · api (Fastify)
scripts/              validate · print-pdf · capture
deploy/               docker compose + nginx conf
```

For the pipeline's design see [ARCHITECTURE.md](ARCHITECTURE.md); the plan is
[PROPOSALS.md](PROPOSALS.md), progress is [PLAN.md](PLAN.md), and operator
setup is [PREPARE.md](PREPARE.md). The rest of this file is the résumé site.

## Quick start

```sh
pnpm install
pnpm dev        # résumé site dev server (apps/site)
pnpm build      # validate data + production build into apps/site/build/
pnpm preview    # serve the production build
pnpm test       # vitest across the workspace
pnpm validate   # Ajv: JSON Resume schema + extensions + overlays + master bank
pnpm pdf        # render the résumé to out/resume.pdf
```

## Editing the résumé

Two ways:

1. **The web editor** (deployed): open `/resume`, click **✎ Edit**. A
   structured editor (drag-reorder sections/items/bullets, rephrase, delete)
   with a **JSON** tab and a **Print** tab. **Export/Import** download/load the
   résumé as JSON (a DB-independent backup). Saving writes a new version — the
   canonical résumé is **DB-backed** (`resume_versions`, full history; restore
   any version). `data/resume.json` (repo root) is the **seed +
   git-export target + offline fallback**, not the live source.
   `pnpm export-seed` pulls the live résumé from the API and rewrites it.

2. **Edit the seed file** `data/resume.json` directly (e.g. via git), then
   `pnpm validate && pnpm test`. Use this to sync the committed seed with
   edits you exported from the web editor (or just run `pnpm export-seed`).

### `x-` extensions

Academic features the JSON Resume standard lacks are layered on as `x-` fields
(validated by `packages/renderer/src/data/extensions.schema.json`):

| Extension | Where | Purpose |
|---|---|---|
| `x-authors` | publications | author list; prefix a name with `!` to highlight it |
| `x-venue`, `x-status` | publications | conference/journal + "Under Review" etc. |
| `x-section: "academic"` | work | splits research roles into the Academic Experience section |
| `x-type: "competition"` | projects | splits contest entries into the Competitions section |
| `x-footnote` | work | supervisor line shown instead of location |
| `x-highlight` | projects | award badge ("Patent", "World Champion") |
| `x-links` | anywhere | multiple labeled links per entry |
| `x-time` | anywhere | display time string ("Sep 2021 - Present") |
| `x-tags` | work/volunteer | tag row (`keywords` is used where it's standard) |
| `x-info`, `x-courses` | education | key/value rows and courses with grades |
| `x-qrcodes` | basics | QR images in the header |
| `meta.sectionOrder` | meta | section display order (set by the editor) |
| `meta.print` | meta | print config — paper size, margins (mm), scale |

Conventions: `<br>` inside a highlight creates a sub-bullet; `!` before an
author name highlights it.

## Print / PDF

Print settings live in `meta.print` (Print tab in the editor): paper size
(A4/Letter/Legal/A3/A5), margins, and scale. Defaults are A4 / no margins /
scale 1.

- **Browser:** print or "Save as PDF" from `/resume` — an `@page` rule applies
  the configured size + margins.
- **`pnpm pdf`:** renders `out/resume.pdf` from the bundled seed using the
  print config (Playwright). Layout is print-aware (`print-no-break-*`
  utilities keep items intact across pages).

## Routes

- `/resume` — the canonical résumé (renders + editor).
- `/resume/?application=<id>` — a tailored résumé for a job (read-only;
  fetches the overlay from the API). Used by the review app.

There are **no profile variants** — a single canonical résumé. Per-job section
selection/tailoring lives in application *overlays* (see ARCHITECTURE.md).

## How the renderer works

```
data/resume.json          canonical content (JSON Resume + x-)  ← seed (repo root)
packages/renderer/src/
  data/master.json        bullet bank (RAG grounding) + *.schema.json
  data/adapter.js         resume.json → component view models (key contract)
  data/profiles.js        buildProfileFrom: assemble selected sections (used by overlay)
  data/overlay.js         applyOverlay: patch a CLONE, rebuild, never mutate the canonical
  data/editorModel.js     résumé/overlay ⇄ editor tree (treeToResume / editorTreeToOverlay)
  data/print.js           meta.print → @page CSS + Playwright pdf options
  editor/ResumeTree.jsx   shared dnd-kit structured editor (résumé + overlay modes)
  components/             renderers (experiences, publications, education, …)
  config/                 section list, component registry, Tailwind theme
```

One sharp edge: components spread view-model items onto DOM elements, so the
adapter must emit exactly the known keys — `adapter.test.js` enforces this.

## CI

`.github/workflows/ci.yml` validates the data, runs tests, builds, and uploads
`out/resume.pdf` as an artifact; a separate job lints + tests the Python
discovery service.
