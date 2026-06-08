# Frontends & the editor model

## Scope
Two Vite SPAs plus the shared `@resume/renderer` source package. `apps/site`
renders the résumé (read-only `/resume` view, tailored `?application=<id>`
view, and the canonical-résumé editor). `apps/review` is the job-review board
(inbox/detail/answers) with an overlay editor. Both reuse one structured
editor (`editor/ResumeTree.jsx`) and one bridge (`data/editorModel.js`).

## Read this when
- Adding/changing a résumé section, item field, or how it renders.
- Touching the render path (`adapter.js` view-model keys, components, sections).
- Editing the structured editor (drag/reorder/delete/exclude/hide/rephrase).
- Changing what the résumé editor saves (`PUT /api/resume`) or the overlay
  editor saves (`PUT /api/jobs/:id/overlay`).
- Changing print/PDF config (paper size, margins, scale).
- Adding/changing a review-board route, API client call, or answers UI.
- Debugging Vite aliases or the `@resume/renderer/src/*` deep-import rule.

## Serve paths (production)
Served by `services/api` (`services/api/src/server.js`, container `jobs-api`),
same-origin. See ./architecture.md (static routing) and ./operations.md.
| URL prefix | Serves | server.js |
|---|---|---|
| `/` | review SPA build (`apps/review/build`) | server.js:189 |
| `/resume` → `301 /resume/` | redirect | server.js:187 |
| `/resume/` | résumé renderer build (`apps/site/build`) | server.js:188 |
| SPA fallback | review `index.html` (NOT for `/api/`, `/applications/`, `/resume`) | server.js:194-199 |

Site build base path is `VITE_BASE=/resume/` (apps/site/vite.config.mjs:11).

## Entry points
| File | Role |
|---|---|
| `apps/site/src/index.jsx` | Bootstrap. Reads `?application`, fetches data, calls `registerResume`/`registerApplication`, renders `<App editable={!applicationId}/>`. |
| `apps/site/src/App.jsx` | `App`→`AppContent`→`ResumeView`. Render path + `usePageStyle` (@page) + Edit toggle. |
| `apps/site/src/ResumeEditor.jsx` | Canonical-résumé editor (Structured/JSON/Print tabs, Export/Import). |
| `apps/review/src/main.jsx` | Bootstrap `<App/>`. |
| `apps/review/src/App.jsx` | Hash router + `Inbox`/`Detail`/`Answers`. |
| `apps/review/src/Editor.jsx` | `EditorModal` overlay editor (modal over Detail). |
| `apps/review/src/api.js` | API client functions. |
| `packages/renderer/src/data/index.js` | `@data` API (register/get). |
| `packages/renderer/src/data/editorModel.js` | Tree bridge (both editors). |
| `packages/renderer/src/editor/ResumeTree.jsx` | Shared dnd-kit editor tree. |

## apps/site routes (index.jsx)
Single canonical résumé; **no profiles** (`?profile`/`meta.x-profiles` removed).
- `?application=<id>` → `fetchJson('/applications/<id>/overlay.json')`, then
  `fetchJson('/api/resume')` as base (falls back to bundled seed on failure),
  then `registerApplication(overlay, base)`. Rendered read-only (`editable=false`).
  Used inside the review Detail iframe.
- otherwise (`/resume`) → `registerResume(await fetchJson('/api/resume'))`;
  on fetch failure `registerResume` already defaults to the bundled seed
  (standalone build / PDF / CI). Rendered editable.
- Bootstrap failure renders a red error box (index.jsx:48-56).

## apps/review hash routes (App.jsx)
No router dep — `useHashRoute` listens to `hashchange` (App.jsx:6-14).
| Hash | Component |
|---|---|
| `#/` (default) | `Inbox` — tabs: `in_review`/`approved`/`scored`/`rejected`; clicking a job → `#/app/<id>` |
| `#/app/<id>` | `Detail` — actions (approve/reject/label/edit overlay), tailored-résumé iframe, score breakdown, patch diff, cover letter, JD |
| `#/answers` | `Answers` — CRUD over the answers bank |

`Detail` iframe src: `/resume/?application=<id>&rev=<n>`; `rev` is bumped on
overlay save (`onSaved`, App.jsx:117) to cache-bust the iframe.

## @data API (packages/renderer/src/data/index.js)
Module-level singleton `activeData` (view models) + `activeDoc` (the document
behind them). Default = `buildViewModels(bundledResume)` where `bundledResume`
is repo-root `data/resume.json` (the **seed/fallback**, NOT the live source).
| Export | Effect |
|---|---|
| `registerResume(doc)` | set `activeDoc=doc`; `activeData=buildViewModels(doc)` |
| `registerApplication(overlay, baseDoc=bundled)` | `activeDoc=baseDoc`; `activeData=applyOverlay(overlay, baseDoc).data` (meta/print inherited from base) |
| `getResumeDoc()` | current `activeDoc` (used by editor + `usePageStyle` + `orderedSections`) |
| `getData(dataKey)` | items for one section key; `console.warn`+`null` if missing |
| `experienceConfigs`, `publicationsConfig` | per-section presentation flags consumed by `config/sections.js` (e.g. `projects.showTags:false`) |

## Render path (App.jsx → registry → component → adapter)
1. `ResumeView` calls `orderedSections(getResumeDoc())`: sorts `sectionsConfig`
   (config/sections.js) by `doc.meta.sectionOrder` (unknown keys → rank 99).
2. For each section: `getComponent(section.component)` from
   `config/componentRegistry.js` (`PersonalInfo`/`Education`/`Experiences`/
   `Publications`/`Skills`), `getData(section.dataKey)`. Empty/`null` data →
   section skipped; non-null renders `<Title>` (if `section.title`) + component.
3. Components (e.g. `components/experiences.jsx:130-136`) **spread each view-model
   item onto props** (`{...item}`). The adapter therefore must emit exactly the
   known keys — see ./data-contracts.md.

### adapter.js (buildViewModels) — KEY CONTRACT
Maps the JSON-Resume doc + `x-` extensions → view models. Optional keys are
**omitted** (via `opt()`), never set to `undefined`. Output keys (the section
data keys): `personalInfo, education, academics, working, publications,
competitions, projects, extracurriculars, skills`. `work[]` splits into
`working`/`academics` by `x-section==='academic'`; `projects[]` splits into
`projects`/`competitions` by `x-type==='competition'`. Enforced by
`packages/renderer/src/data/adapter.test.js` — do NOT add keys casually.

### overlay.js (applyOverlay)
`applyOverlay(overlay, resumeDoc)` validates RFC-6902 patches against the doc
(`jsonpatch.validate`; throws citing `patchError.index/name/operation.path` on failure),
applies them to a **deep clone** (never mutates), rebuilds view models, checks
each `profile.sections` key exists, then `buildProfileFrom`. `applyFilter`
supports `tagsAnyOf`, `titleIn`, `exclude`, `order`, `limit` — items keyed by
`title`. Profile *variants* are gone; this only serves per-job overlays.

## The editor bridge (editorModel.js) — ONE tree, TWO modes
Tree shape: `{ sections: [ { key, label, list, editable, enabled,
items: [ { id, title, enabled, source, index, path, bullets:[{id,text,hidden?}] } ] } ] }`.
`SECTIONS` (editorModel.js:15-25) defines source array + `titleKey` + `pick`
per section (e.g. `working` = `work` where `x-section!=='academic'`). `id`s are
stable per session (dnd-kit keys). `editable` sections expose bullets
(`highlights`); non-editable sections (Header, Education, Publications, Skills)
have no bullets.

| Function | Direction | Used by |
|---|---|---|
| `buildEditorModel(overlay={}, doc, sectionOrderKeys=null)` | doc(+overlay) → tree | both editors |
| `treeToResume(tree, baseDoc)` | tree → new résumé doc | résumé editor |
| `editorTreeToOverlay(tree, jobId, coverLetter, doc)` | tree → overlay | overlay editor |

- `buildEditorModel`: reflects `overlay.profile.sections` (→ `enabled`),
  `filters` (`exclude`→item `enabled`, `order`→item sort), and applies
  `overlay.patches` to a clone so bullet text shows tailored content. Section
  display order = `sectionOrderKeys ?? profile.sections ?? SECTION_KEYS`.
- `treeToResume`: writes reorder/delete/bullet-edits **into the source arrays**;
  saves order to `doc.meta.sectionOrder`. Rebuilds each source array slot-by-slot
  per section queue so a **no-op save reproduces the array exactly** and existing
  overlays' positional patches stay valid (editorModel.js:121-137).
- `editorTreeToOverlay`: enabled sections → `profile.sections`; disabled items →
  `filters[key].exclude`; item order → `filters[key].order`; bullet changes
  (vs `doc[source][index].highlights`) → `{op:'replace', path:'/<source>/<i>/highlights', value:[...]}`
  patches. Sets `audit:{claims:[],unsupported:[]}` (reviewer edits are trusted;
  they bypass the fabrication verify — see ./pipeline.md).

### ResumeTree.jsx (shared dnd-kit editor)
Controlled: `<ResumeTree tree onChange mode />`. `mode='resume'` shows trash
(delete) on items+bullets, no toggles. `mode='overlay'` shows include/exclude
checkboxes on sections+items and a per-bullet "show in this application" hide
checkbox, no delete. Three-level vertical drag-reorder (Pointer/Touch/Keyboard
sensors). Pure: never calls the API.

## ResumeEditor.jsx (canonical résumé)
Tabs: **Structured** (`ResumeTree mode='resume'`), **JSON** (raw doc textarea),
**Print** (paper/margins/scale form). `edited = treeToResume(tree, baseDoc)`
with `meta.print` merged in. Save → `PUT /api/resume` with `currentDoc()`
(JSON tab parses textarea; else `edited`); server snapshots a new
`resume_versions` row. `onSaved` (App.jsx:64) re-fetches `/api/resume`,
re-`registerResume`, bumps `rev`. **Export** downloads current doc as
`resume-<date>.json` (not persisted until Save). **Import** loads a JSON file
(requires `basics` + `work[]`), rebuilds tree+print — review, then Save.

## Editor.jsx (overlay, review)
`EditorModal` over Detail. On open, fetches `/api/resume` as `base`, builds
`buildEditorModel(job.overlay ?? {}, base)` so paths/base-text match what the
server validates. `overlay = editorTreeToOverlay(tree, job.id, coverLetter,
base)`. Save → `saveOverlay(job.id, overlay)` (JSON tab parses textarea). Has a
cover-letter textarea. `onSaved` reloads job + bumps iframe `rev`.

## print.js (meta.print → @page + PDF)
`PRINT_DEFAULTS`: A4, margins 0mm, scale 1. `PAPER_SIZES`:
`A4,Letter,Legal,A3,A5`. `getPrint(doc)` reads `doc.meta.print` (clamps/defaults).
Two consumers: `pageCss(print)` → `@page { size; margin }` injected into `<head>`
by `usePageStyle` (App.jsx:14-23, browser print / Save-as-PDF; re-applied on `rev`);
`pdfOptions(print)` → Playwright `page.pdf()` opts (format/margin/scale/
printBackground) used by `scripts/print-pdf.mjs`. Applications inherit print
config because overlays apply onto the base résumé.

## api.js (review client)
Same-origin `fetch`; `json()` throws `body.problems.join('; ')` or `body.error`.
`listJobs(status)`, `getJob(id)`, `approve(id)`, `reject(id,reason)`,
`label(id,value)`, `saveOverlay(id,overlay)` (PUT), `getAnswers()`,
`saveAnswer(key,question,answer)` (PUT), `addAnswer(question,answer)` (POST),
`deleteAnswer(key)` (DELETE). Routes documented in ./architecture.md.

## Vite aliases & deep-import rule
`apps/site/vite.config.mjs` aliases into `packages/renderer/src`:
`@css`(site src/css), `@components`, `@config`, `@contexts`, `@data`. The
renderer is a **source package, no `main`/`exports` and no barrel** (renderer
package.json). `apps/review` has **no aliases** (vite.config.mjs is minimal);
it imports the renderer by package deep subpaths resolved through the pnpm
workspace symlink: `@resume/renderer/src/editor/ResumeTree` and
`@resume/renderer/src/data/editorModel` (Editor.jsx). (`apps/site`'s
`ResumeEditor.jsx` deep-imports the same two plus `data/print`.) Many renderer
modules internally use `@components/@config/@contexts` aliases — so **review
may only deep-import the alias-free modules** (`editor/ResumeTree`,
`data/editorModel`, `data/print`), NOT component-pulling modules. Importing
`@data` from review would break (it pulls `adapter`/`overlay`, which are
alias-free, but `@data` is resolved only via the `apps/site` alias, not as a
deep subpath — review imports `editorModel` directly instead).

## Invariants & gotchas
- Render is driven by module singletons (`activeData`/`activeDoc`). Components
  call `getData`/`getResumeDoc` at render time — `register*` must run BEFORE
  `root.render` (index.jsx does). `ResumeView key={rev}` forces a fresh tree.
- adapter must emit EXACTLY the known keys (spread onto DOM). Adding a key
  fails `adapter.test.js`. Optional keys are omitted, never `undefined`.
- `overlay.js` and `editorModel.js` `import data/resume.json` (the seed) as the
  default doc — but live editors always pass the fetched `/api/resume` doc.
- `editorModel.SECTIONS` and `config/sections.js`/`componentRegistry` are
  separate maps; both must agree on the section data keys.
- Reviewer edits (résumé or overlay) are trusted; the fabrication verify only
  guards LLM-written patches (./pipeline.md).
- Before any renderer/structure refactor: use the `render-check` skill (capture
  baseline, then empty DOM diff). PDF bytes always differ (timestamps).
- `data/resume.json` is seed + git-export target + bundled fallback; refresh
  from live DB with `pnpm export-seed` (./data-contracts.md).

## Where to change X
| Task | File(s) |
|---|---|
| Add/rename a section data key | `data/adapter.js` + `data/adapter.test.js`, `config/sections.js`, `config/componentRegistry.js`, `data/editorModel.js` (`SECTIONS`) |
| Change a view-model item field | `data/adapter.js` (`toExperience`/`buildViewModels`) + component that spreads it (`components/*.jsx`) + `adapter.test.js` |
| New render component | add `components/X.jsx`, register in `config/componentRegistry.js`, reference in `config/sections.js` |
| Section display order behavior | `App.jsx` `orderedSections` (reads `meta.sectionOrder`); editor writes it via `treeToResume` |
| Structured editor affordances | `editor/ResumeTree.jsx` (mode flags) |
| What résumé editor saves | `ResumeEditor.jsx` + `editorModel.treeToResume`; persisted by `PUT /api/resume` (./architecture.md) |
| What overlay editor saves | `Editor.jsx` + `editorModel.editorTreeToOverlay`; `PUT /api/jobs/:id/overlay` |
| Overlay filter semantics | `data/overlay.js` `applyFilter` + `data/overlay.schema.json` |
| Print/PDF (paper/margins/scale) | `data/print.js`; UI in `ResumeEditor.jsx` Print tab; PDF in `scripts/print-pdf.mjs` |
| Review routes / inbox tabs | `apps/review/src/App.jsx` |
| Review API calls | `apps/review/src/api.js` |
| Answers bank UI | `apps/review/src/App.jsx` `Answers` |
| Vite aliases / base path | `apps/site/vite.config.mjs` (`VITE_BASE`) |
| Serve paths / SPA fallback | `services/api/src/server.js:185-199` |
