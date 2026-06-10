# Frontends, renderer & the editor model

## Scope
The **one dashboard SPA** (`apps/dashboard` — shadcn/ui + react-router admin UI),
the **bare résumé render host** (`apps/site` — chrome-less, the print/PDF target +
review preview), and the shared `@resume/renderer` source package (components +
`data/` layer + the `editor/ResumeTree`). The layout is ONE SPA at `/` + a bare
host at `/resume/` that the SPA iframes for previews.

## Read this when
- Adding/changing a résumé section, item field, or how it renders.
- Touching the render path (`adapter.ts` view-model keys, components).
- Editing the structured editor (drag/reorder/delete/exclude/hide/rephrase).
- Changing what the résumé editor saves (`PUT /api/resume`) or the overlay editor
  saves (`PUT /api/jobs/:id/overlay`).
- Changing print/PDF config (paper size, margins, scale) or print isolation.
- Adding/changing a dashboard route, tab, config UI, or the API client.
- Debugging Vite aliases / the renderer deep-import rule / the bare-host iframe.

## Serve paths (production)
Served by `services/api` (`app.ts`, container `jobs-api`), same-origin. See
[./architecture.md](./architecture.md) (static routing) + [./operations.md](./operations.md).
| URL prefix | Serves | Where |
|---|---|---|
| `/` and unmatched | dashboard SPA build (`apps/dashboard/build` → `/app/dashboard`) | `app.ts` `@fastify/static` prefix `/` + `setNotFoundHandler` fallback to `index.html` |
| `/resume/` (trailing slash) | bare host build (`apps/site/build` → `/app/site`) | `app.ts` `@fastify/static` prefix `/resume/` (`VITE_BASE=/resume/`) |
| `/api/*`, `/applications/*`, `/resume/` | exempt from SPA fallback (404 JSON) | `setNotFoundHandler` |

> `/resume` (no slash) vs `/resume/` (slash): the
> fallback exempts ONLY `/resume/` (trailing slash) and there is no `GET /resume`
> redirect, so a **hard** nav/refresh/deep-link to the dashboard's own `/resume`
> route falls through to the SPA (renders `ResumePage`), while `/resume/` and
> `/resume/?application=<id>` keep serving the bare host. Locked by
> `services/api/test/app.test.ts` ("static routing: /resume (SPA route) vs
> /resume/ (bare host)"). Keep the exemption exact — never widen it to bare
> `/resume`, that re-shadows the SPA route.

---

## apps/dashboard — the unified SPA

Stack: React 18, **react-router v6** (`createBrowserRouter`), **shadcn/ui** (Radix +
Tailwind: `components/ui/*` + `lucide-react` icons), Vite 6. `@` → `src` (the shadcn
convention); the renderer is NOT aliased here (it's deep-imported, see below).

The admin chrome uses shadcn/ui (Radix + Tailwind), chosen over Ant Design because
Ant's global CSS reset and design tokens would fight Tailwind and risk the
pixel-stable renderer.

### Entry + routing
- `src/main.tsx` → `<RouterProvider router={router}>`.
- `src/router.tsx` → `createBrowserRouter` with `Shell` (sidebar/topbar nav) as the
  layout and these child routes (the §2 tab set):

| Route | Component | Role |
|---|---|---|
| `/dashboard` (index → here) | `routes/DashboardPage` | events/cost ledger: cost-by-stage/model, totals-by-day, status funnel, failures, recent events |
| `/review`, `/review/:id` | `routes/ReviewPage` | inbox (status tabs) + detail (approve/reject/label, score breakdown, **full-width** overlay editor, patch diff, cover letter, JD) + a **Preview** button → `PreviewModal` (the tailored overlay, live/unsaved) |
| `/resume` | `routes/ResumePage` | canonical résumé editor (Structured/JSON/Print tabs), **full-width** + a **Preview** button → `PreviewModal` (the live/unsaved doc) |
| `/scrawling` | `routes/ScrawlingPage` | `schedule` + `discovery` config (cron/tz/mode, JobSpy sites/defaults, exclude lists, searches, companies) |
| `/llm` | `routes/LlmPage` | `llm` config (per-stage models, threshold, weights, batch, poll, truncation) |
| `/preferences` | `routes/PreferencesPage` | `preferences` config (soft, priority 1–10) |
| `/constraints` | `routes/ConstraintsPage` | `constraints` config (hard, deterministic) |
| `/answers` | `routes/AnswersPage` | answers-bank CRUD |

`Shell.tsx` is the sidebar (desktop) / topbar (mobile) nav; chrome is marked
`print-hide`.

### Typed API client (`src/api.ts`)
Same-origin `fetch`; every shape comes from `@resume/contracts` (never restated).
`request<T>` throws `ApiError` (carrying the server's `{error, problems}`) on non-2xx.
Methods: `jobs/job/approve/reject/label/putOverlay`, `resume/putResume`,
`answers/putAnswer/addAnswer/deleteAnswer`, `config<NS>/putConfig<NS>` (typed by
`ConfigNamespace`/`ConfigValue<NS>`), `dashboardSummary/events`. `api.test.ts` covers
it.

### Config UIs (client-side Zod validation)
`hooks/useConfig.ts` `useConfig(ns)` loads a namespace via `api.config(ns)`, holds an
editable draft, and **validates with `parseConfig(ns, value)` (the contracts Zod)
BEFORE PUT** (brief requirement) — surfacing `parsed.error.issues` in the `SaveBar`.
`LlmPage`/`PreferencesPage`/`ConstraintsPage`/`ScrawlingPage` are thin forms over it.
The Résumé editor (`ResumePage`) validates with `ResumeDoc.safeParse` before
`putResume`. `LlmPage.test.tsx`/`DashboardPage.test.tsx` cover representative pages
(jsdom; the dashboard runs under its own `vitest.config.ts`).

**Constrained inputs + live (presentational) validation.** Free-text fields with a
finite valid set are dropdowns now, and field-level errors render live (they
*complement* the on-save `parseConfig`+`SaveBar` gate, never replace it). New shadcn
primitives in `components/ui/`: `select`, `popover`, `command`, `combobox` (searchable —
the timezone picker), `dialog` (the preview modal), `field-error` (`FieldError`/
`FieldWarning`). Helpers in `src/lib/`: `validators.ts` (`validateCron` — mirrors the
Python `discovery/cron.py` 5-field grammar; `isValidTimeZone`; `weightsSumWarning`) and
`lists.ts` (`timeZones()` via `Intl.supportedValuesOf`, `JOBSPY_COUNTRIES`). Dropdown
value sources are contract-derived (never hard-coded): models from `KNOWN_MODELS`
(events.ts, = `PRICES` keys) with a `__custom__` escape hatch; `jobType` from `JobType`
(config.ts); the Constraints `equals` value from `JdSchema.shape.<field>.options`
(seniority/sponsorship); paperSize from `PAPER_SIZES`.

### The résumé canvas is an IFRAME of the bare host (`components/ResumeCanvas.tsx`)
The dashboard does NOT render the résumé in-app. `ResumeCanvas` iframes the bare host
(`/resume/` canonical, `/resume/?application=<jobId>` tailored), `rev`-bumped to
cache-bust after a save. Why: the renderer canvas is pixel-stable and is the Playwright
PDF target — iframing the SAME host keeps the preview byte-identical to the PDF and
isolates the renderer's Tailwind preflight from shadcn/ui's. The in-frame "Print
résumé" button drives the iframe's own print context (only the résumé prints).
`index.css` adds a `@media print` `.print-isolating` / `.print-canvas` fallback for
`Cmd+P` on the page. `ResumeCanvas` fills its container (`flex-1`, no fixed height) so
inside the preview modal the **bare host's paper-frame is the single scroll region** —
the button row stays fixed (a hard-coded iframe height previously caused a second
scrollbar).

### The preview is a toggleable modal that renders UNSAVED edits (`components/PreviewModal.tsx`)
ResumePage/ReviewPage editors are **full-width**; the preview is a blocking centered
shadcn `Dialog` opened by a "Preview" button. It renders the editor's **current,
possibly unsaved** doc/overlay — **no auto-save**. Mechanism: a typed **postMessage
bridge** (`PreviewMessage` in `@resume/contracts`, `preview.ts`, same-origin +
`source:'resume-preview'` tag). The bare host posts `{type:'ready'}` on mount; the modal
replies with the in-memory payload — `{type:'resume',doc}` (ResumePage, `doc` from
`treeToResume`) or `{type:'overlay',overlay}` (ReviewPage, `overlay` from
`editorTreeToOverlay`, so the tailored preview works **before the first save**) — plus
`{type:'mode',layout}`; it re-posts (debounced) on edits while open. The bare host
applies it via `resumePayload`/`applicationPayload` (renderer/data) — all view-model
logic stays in the bare host; the dashboard posts raw `doc`/`overlay` only.

### Paper-accurate preview (`apps/site/src/PaperFrame.tsx`)
In the modal the bare host renders inside a **paper frame** sized to the configured
paper (`PAPER_DIMENSIONS` mm → px via `mmToPx`, 96dpi), with margins as padding and the
configured `scale` applied (`transform: scale`, content laid out at `1/scale` of the
content box — matching Playwright `page.pdf({scale})`). Two engines behind the modal's
**Continuous switch**: **multi-page** (default) paginates via `pagedjs` (dynamically
imported, so it never enters the default bundle or the PDF path) into real
`.pagedjs_page` A4 sheets honoring the renderer's `break-inside` rules; **continuous** is
a dependency-free single tall sheet (also the fallback if pagedjs fails). Reads
`getPrint(payload.doc)`, so paper/margins/scale reflect live Print-tab edits. **Print
from the modal** hides the pagedjs page-boxes and reveals the source résumé in normal
flow (`@media print` in `PaperFrame`), so the browser paginates via the `@page` rule —
no trailing blank pages.

---

## apps/site — the bare host

Chrome-less render of the canonical résumé (or an applied overlay). The print/PDF
target and the dashboard's review preview. No editor UI lives here (the editors moved
to the dashboard).

### Entry (`src/index.tsx`) — routes by `?application`, wrapped by `?preview`
- `?application=<id>` → `fetchJson('/applications/<id>/overlay.json')` + `fetchJson(
  '/api/resume')` (base; falls back to `bundledSeed` on failure) → `applicationPayload(
  overlay, base)` → render read-only. (This is what `ResumeCanvas` iframes.)
- otherwise → `resumePayload(await fetchJson('/api/resume'))`; on failure
  `resumePayload(bundledSeed)` (standalone build / PDF / CI).
- Bootstrap failure renders a red error box.
- **`?preview` (live-preview wrapper, OFF by default):** the built payload is handed to
  `<PreviewRoot initial preview>`. `preview=null` → renders **exactly** `<App
  payload={initial}/>` (byte-identical default path — render-check safe). `preview='1'`
  → live fluid render; `preview='paper'` → live render wrapped in `<PaperFrame>`. In
  preview mode `PreviewRoot` posts `{type:'ready'}` to `window.parent` and swaps the
  payload on same-origin `PreviewMessage`s via the pure `reduceMessage` reducer
  (`preview.ts`, node-tested). `buildPayload` is preview-tolerant: a missing overlay
  falls back to the base résumé instead of throwing (so review preview works pre-save).

### Render path (`src/App.tsx`) — data via the provider
The host builds a
`RenderPayload` (`{ doc, data }`) once and passes it to `<App payload>`, which
provides it via `ResumeDataProvider` (`contexts/resumeDataContext.tsx`); components
read it through `useSection(key)` (one section's items) and
`useResumeDoc()` (the doc, for print config + section order).
1. `ResumeView` → `orderedSections(useResumeDoc())`: sorts `sectionsConfig`
   (`config/sections.ts`) by `doc.meta.sectionOrder` (unknown keys → rank 99).
2. Per section: `getComponent(section.component)` (`config/componentRegistry.ts` —
   `PersonalInfo`/`Education`/`Experiences`/`Publications`/`Skills`),
   `useSection(section.dataKey)`. Empty/null data → skipped; else `<Title>` (if
   `section.title`) + `<Component data={data} {...section.props}/>`.
3. Components spread each view-model item onto props (`{...item}`), so the adapter
   must emit exactly the known keys — see the view-model contract below.
4. `usePageStyle(payload.doc)` injects the `@page` rule into `<head>` (browser print
   / Save-as-PDF), kept out of `#root`.

`config/sections.ts` `sectionsConfig` is built from the §1 `SECTION_REGISTRY` (keys +
order are NOT restated) — only the renderer-presentation facts the registry doesn't
carry: the component name, the displayed `<Title>` text (intentionally NOT the
registry `label` — header text is fixed: "Academic Experience"/"Work
Experience"/"Competition Experience"/"Projects"/"Extracurricular"), and the one real
prop (`projects.showTags` via `SECTION_PROPS`).

### adapter.ts (`buildViewModels`) — KEY CONTRACT
Maps `ResumeDoc` (§2) → `ViewModels` (§3). Optional keys are **omitted** (via `opt()`),
never set to `undefined`. Reads the **un-prefixed fields** (`time, info, courses,
tags, links, badge, footnote, location, authors, venue, status, headline`). The
work/projects split is NOT restated here — it consumes the §1 registry `pick`
predicates (`pickFor(key)`). The §2/§3 publications-`link` fix is here (the adapter now
emits `link` from `publications[].links`; the seed has none, so the rendered DOM is
unchanged). Enforced by `ViewModels.parse` (`.strict()` + no-`undefined` guard) over
ALL sections, asserted in `adapter.test.ts`.

### overlay.ts (`applyOverlay`)
`applyOverlay(overlay, resumeDoc)` validates RFC-6902 patches against the doc
(`jsonpatch.validate`; throws on failure), applies them to a **deep clone** (never
mutates), rebuilds view models, checks each `profile.sections` key, then
`buildProfileFrom`. `applyFilter` supports `tagsAnyOf → titleIn → exclude → order →
limit` — items keyed by `title`. `overlay.test.ts` covers it.

---

## The editor bridge (`packages/renderer/src/data/editorModel.ts`) — ONE tree, TWO modes
Tree: `{ sections:[{ key, label, list, editable, enabled, items:[{ id, title,
enabled, source, index, path, bullets:[{id,text,hidden?}] }] }] }`. The section list
+ work/projects split derive from the §1 `SECTION_REGISTRY` (`SECTIONS`) — never
restated. ids are stable per session (dnd-kit keys); editable sections expose bullets
(`highlights`), non-editable (Header/Education/Publications/Skills) don't.

| Function | Direction | Used by |
|---|---|---|
| `buildEditorModel(overlay={}, doc, sectionOrderKeys=null)` | doc(+overlay) → tree | both editors |
| `treeToResume(tree, baseDoc)` | tree → new résumé doc | résumé editor (ResumePage) |
| `editorTreeToOverlay(tree, jobId, coverLetter, doc)` | tree → overlay | overlay editor (ReviewPage) |

- `buildEditorModel`: reflects `overlay.profile.sections` (→ `enabled`), `filters`
  (`exclude`→item `enabled`, `order`→item sort), and applies `overlay.patches` to a
  clone so bullet text shows tailored content. Display order = `sectionOrderKeys ??
  profile.sections ?? SECTION_KEYS`.
- `treeToResume`: writes reorder/delete/bullet-edits into the source arrays; saves
  order to `meta.sectionOrder`. **Slot-preservation invariant (§2):** rebuilds each
  source array slot-by-slot per section queue so a no-op save reproduces the array
  positionally → existing overlays' patch paths stay valid.
- `editorTreeToOverlay`: enabled sections → `profile.sections`; disabled items →
  `filters[key].exclude`; item order → `filters[key].order`; bullet changes (vs
  `doc[source][index].highlights`) → `{op:'replace', path:'/<source>/<i>/highlights',
  value:[...]}` patches. Sets `audit:{claims:[],unsupported:[]}` — **reviewer edits
  are trusted; they bypass the fabrication verify** (see [./pipeline.md](./pipeline.md)).
  `editorModel.test.ts` covers it.

### ResumeTree.tsx (shared dnd-kit editor)
Controlled: `<ResumeTree tree onChange mode />`. `mode='resume'` shows trash on
items+bullets, no toggles. `mode='overlay'` shows include/exclude checkboxes on
sections+items + a per-bullet "show in this application" hide checkbox, no delete.
Three-level vertical drag-reorder. Pure — never calls the API.

## print (`packages/renderer/src/data/print.ts`)
`PRINT_DEFAULTS`: A4, margins 0mm, scale 1. `PAPER_SIZES` comes from the §2.3
`PrintConfig` (contracts). `getPrint(doc)` reads `doc.meta.print` (clamps/defaults).
Two consumers: `pageCss(print)` → `@page { size; margin }` injected by
`usePageStyle` (browser print); `pdfOptions(print)` → Playwright `page.pdf()` opts
used by `scripts/print-pdf.mjs`. Applications inherit print config (overlays apply
onto the base résumé, whose `meta` the payload carries).

## Renderer reuse from the dashboard — the deep-import rule
The dashboard reuses ONLY the renderer's **alias-free** surface via
`apps/dashboard/src/resumeEditor.ts`, which re-exports from package deep subpaths:
`@resume/renderer/src/data/editorModel`, `@resume/renderer/src/editor/ResumeTree`,
`@resume/renderer/src/data/print`. Those modules import only `@resume/contracts` +
`fast-json-patch` + `dnd-kit` + `react` — NO internal `@components/@config/@contexts`
aliases — so they bundle cleanly in the dashboard (which doesn't mirror the renderer's
Vite aliases). The résumé CANVAS, which DOES need those aliases, is iframed from the
bare host instead (`ResumeCanvas`). The renderer package has no `main`/`exports` and
no barrel; `apps/site/vite.config.mjs` aliases `@css/@components/@config/@contexts/
@data` into `packages/renderer/src`.

## Vite / build
- `apps/site/vite.config.mjs`: `base = VITE_BASE ?? '/'` (built with
  `VITE_BASE=/resume/`); aliases as above; outDir `build`.
- `apps/dashboard/vite.config.ts`: `base = '/'`; alias `@` → `src`; outDir `build`.
- Root `pnpm build` = `pnpm validate` then build `site` (with `VITE_BASE=/resume/`) +
  `dashboard`. The API Dockerfile builds both inside the image (no committed build
  output). `pnpm dev`/`start` runs the `site` Vite dev server.

## Invariants & gotchas
- **Render is provider-driven, not singleton-driven** — the host must build the
  `RenderPayload` before `<App payload>`; components read it via the context hooks.
- **adapter must emit EXACTLY the known keys** (spread onto DOM). Adding a key fails
  `ViewModels.parse`/`adapter.test.ts`; optional keys are omitted, never `undefined`.
- **Reviewer edits (résumé or overlay) are trusted**; the fabrication verify only
  guards LLM-written patches.
- **Before any renderer/structure refactor: `render-check` skill** (baseline, then
  empty DOM diff). PDF bytes always differ (timestamps); DOM diff is authoritative.
- **The dashboard validates config/résumé client-side with the same contracts Zod**
  the server enforces — keep them aligned via `@resume/contracts`, never a local copy.
- **The preview is an iframe of the bare host, shown in a modal** — it renders the
  CURRENT, possibly UNSAVED, doc/overlay pushed over the `PreviewMessage` postMessage
  bridge (no auto-save); the `?application`/`rev` fetch path is the first-paint/fallback.
- **Preview/paper-frame is additive + OFF by default** — a bare `/resume/` visit (and
  `pnpm pdf`) renders `<App>` unchanged. Only `?preview=…` mounts `PreviewRoot`'s
  listener / `PaperFrame`. `pagedjs` is dynamically imported (never in the default
  bundle). Keep it this way so the byte-identical-DOM invariant + the PDF hold.
- `data/resume.json` is seed + git-export target + bundled fallback; refresh from the
  live DB with `pnpm export-seed`.

## Where to change X
| Task | File(s) |
|---|---|
| Add/rename a section key | `packages/contracts/src/sections.ts` (`SECTION_REGISTRY`) → flows to adapter/editor/tailor/sectionsConfig; then `config/sections.ts` presentation + `config/componentRegistry.ts`; **`render-check`** |
| Change a view-model item field | `packages/contracts/src/viewModel.ts` + `data/adapter.ts` + the spreading component (`components/*.tsx`) + `adapter.test.ts` |
| New render component | add `components/X.tsx`, register in `config/componentRegistry.ts`, reference in `config/sections.ts` |
| What the résumé editor saves | `apps/dashboard/src/routes/ResumePage.tsx` + `editorModel.treeToResume`; `PUT /api/resume` |
| What the overlay editor saves | `apps/dashboard/src/routes/ReviewPage.tsx` (`OverlayEditor`) + `editorModel.editorTreeToOverlay`; `PUT /api/jobs/:id/overlay` |
| Overlay filter semantics | `data/overlay.ts` `applyFilter` + the `Overlay` Zod (`contracts/overlay.ts`) |
| Print/PDF | `data/print.ts` + `contracts/print.ts`; UI in `ResumePage` Print tab; PDF in `scripts/print-pdf.mjs` |
| A config UI | `apps/dashboard/src/routes/<NS>Page.tsx` + `hooks/useConfig.ts`; shape in `contracts/config.ts` |
| A config field's input/validation (dropdown, combobox, live error) | the `<NS>Page.tsx` field + `components/ui/{select,combobox,field-error}` + `src/lib/{validators,lists}.ts`; value source in `contracts/*` (e.g. `KNOWN_MODELS`, `JobType`, `JdSchema.shape.*.options`) |
| The preview modal / live unsaved preview | `apps/dashboard/src/components/PreviewModal.tsx` (sender + handshake) + `ResumeCanvas.tsx` (live/paper props) + `apps/site/src/{PreviewRoot,preview}.tsx`; protocol `contracts/preview.ts` |
| Paper-accurate preview (size/margins/scale, multipage/continuous) | `apps/site/src/PaperFrame.tsx` + `PAPER_DIMENSIONS`/`mmToPx` (`contracts/print.ts`, `renderer/data/print.ts`) |
| Dashboard routes/tabs | `apps/dashboard/src/router.tsx` + `components/Shell.tsx` |
| API client call | `apps/dashboard/src/api.ts` |
| Bare-host iframe / print isolation / preview modal host | `apps/dashboard/src/components/ResumeCanvas.tsx` + `PreviewModal.tsx` + `src/index.css` |
| Serve paths / SPA fallback | `services/api/src/app.ts` (static + `setNotFoundHandler`) |
| Vite aliases / base path | `apps/site/vite.config.mjs` (`VITE_BASE`) / `apps/dashboard/vite.config.ts` |
