# Resume

A data-driven resume site built with React + Vite + Tailwind. All content lives
in a single [JSON Resume](https://jsonresume.org/) document and renders as a
print-ready page, with multiple profile variants exported as PDFs.

## Quick start

```sh
pnpm install
pnpm dev        # dev server
pnpm build      # validate data + production build into build/
pnpm preview    # serve the production build
```

## Editing content

Everything is in **`src/data/resume.json`** — a standard
[JSON Resume v1.0.0](https://jsonresume.org/schema) document, so it works with
the wider ecosystem (themes, the [registry](https://registry.jsonresume.org/),
`resumed render`, ATS importers).

Academic features the standard lacks are layered on as `x-` extension fields
(validated by `src/data/extensions.schema.json`):

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
| `x-profiles` | meta | profile definitions (see below) |

Content conventions: `<br>` inside a highlight string creates a sub-bullet;
`!` before an author name highlights it.

Validate after editing:

```sh
pnpm validate   # Ajv: official JSON Resume schema + extension schema
pnpm test       # adapter contract tests
```

## Profiles

`meta.x-profiles` in `resume.json` defines resume variants (`full`,
`academic`, `industry`, `minimal`) as section selections plus declarative
filters (`tagsAnyOf`, `titleIn`, `limit`). Open a variant with
`?profile=<id>`, e.g. `http://localhost:5173/?profile=academic`.

## PDF export

```sh
pnpm build
pnpm pdf        # writes out/resume-<profile>.pdf for every profile
```

Or print any page from the browser — the layout is print-aware
(`print-no-break-*` utilities keep items intact across pages).

## In-browser config panel

Press **Cmd/Ctrl + D** to toggle a panel for hiding/reordering sections and
items, adjusting the layout, and exporting/importing that configuration as
JSON. The panel never appears in print output.

## Architecture

```
src/data/resume.json    canonical data (JSON Resume + x- extensions)
src/data/adapter.js     maps resume.json -> component view models
src/data/profiles.js    builds profile variants from meta.x-profiles
src/components/         renderers (experiences, publications, education, ...)
src/config/             section list, component registry, Tailwind theme
scripts/validate.mjs    Ajv schema validation (pnpm validate)
scripts/print-pdf.mjs   per-profile PDF rendering (pnpm pdf)
scripts/capture.mjs     DOM/PDF/PNG capture for render-regression checks
```

One sharp edge: components spread view-model items onto DOM elements, so the
adapter must emit exactly the known keys — `src/data/adapter.test.js` enforces
this.

## CI

`.github/workflows/ci.yml` validates the data, runs tests, builds, uploads
per-profile PDFs as artifacts, and deploys to GitHub Pages (requires Pages
source set to "GitHub Actions" in the repo settings).
