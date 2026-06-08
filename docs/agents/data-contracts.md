# Data contracts: schemas, DB, API

## Scope
The canonical shapes of every JSON artifact and DB row in the pipeline: the
résumé doc (JSON Resume v1.0.0 + `x-*`), the application overlay, the master
bullet bank, the Postgres tables, the review-API routes, and the adapter
view-model key contract. Every field below is verified against on-disk files.

## Read this when
- Adding/renaming an `x-*` field, a résumé section, or a skill group.
- Building/validating an overlay (section selection, filters, RFC-6902 patches).
- Adding a master bullet, or wiring the verify pass's `audit.claims[].groundedIn`.
- Writing a DB query or migration; reasoning about the `jobs.status` lifecycle.
- Adding/changing an API route, or debugging a 400/404/409 from the review API.
- Touching `adapter.js` — extra keys leak into the DOM (see Adapter contract).

## Entry points
| Concern | File | Symbol |
|---|---|---|
| Résumé → view models | `packages/renderer/src/data/adapter.js` | `buildViewModels(resume)`, `toExperience` |
| View-model key guard | `packages/renderer/src/data/adapter.test.js` | `EXPERIENCE_KEYS` set |
| Overlay → renderable profile | `packages/renderer/src/data/overlay.js` | `applyOverlay`, `buildProfileFrom`, `applyFilter` |
| Overlay validation (API) | `services/api/src/server.js:28` | `overlayProblems(overlay, resumeDoc)` |
| Canonical résumé read/seed | `services/api/src/server.js:109` | `currentResume()` |
| Schemas (Ajv) | `packages/renderer/src/data/*.schema.json` | extensions / overlay / master |
| DB schema | `services/pipeline/migrations/001–004` | applied by `services/pipeline/src/migrate.js` |

## Where to change X
| Task | File(s) |
|---|---|
| Add an `x-*` field | `extensions.schema.json` + `adapter.js` (map it) + `adapter.test.js` (`EXPERIENCE_KEYS` if it surfaces) |
| Add/rename a résumé section view-model key | `adapter.js` (`buildViewModels` return) + `overlay.schema.json` (`profile.sections` enum) + `data/resume.json` (`meta.sectionOrder`) |
| Add an overlay filter operator | `overlay.schema.json` (`profile.filters.*`) + `overlay.js` (`applyFilter`) |
| Add a job column | new migration in `services/pipeline/migrations/` + `JOB_FIELDS` (`server.js:41`) if it should reach the SPA |
| Add an API route | `services/api/src/server.js` (mind the `setNotFoundHandler` prefixes) |
| Add a master bullet | `packages/renderer/src/data/master.json` (must pass `master.schema.json`) |

Sibling docs: see `../../CLAUDE.md` (invariants), `../../ARCHITECTURE.md`.

---

## (a) Résumé document — JSON Resume v1.0.0 + `x-*` extensions

Lives at repo-root `data/resume.json` (seed + git-export target + bundled
fallback). Validated by the upstream JSON Resume v1.0.0 schema **and**
`packages/renderer/src/data/extensions.schema.json` (`pnpm validate`). The live
canonical copy is DB-backed (`resume_versions`, see §d); `data/resume.json` is
NOT the live source.

Standard JSON Resume sections present: `basics`, `education[]`, `work[]`,
`publications[]`, `projects[]`, `volunteer[]`, `skills[]`, `meta`.

### `x-*` extension fields (from `extensions.schema.json`)
| Section | Field | Type | Required | Notes |
|---|---|---|---|---|
| `basics` | `x-qrcodes[]` | `{label, src}[]` | no | `src` is an asset path (e.g. `links.svg`); `additionalProperties:false` |
| `education[]` | `x-time` | string ≥4 chars | **yes** | Display date range (e.g. `"Sep 2021 - Jan 2026"`) |
| `education[]` | `x-info` | tupleList `[k,v][]` | **yes** | 2-string tuples rendered as labeled rows |
| `education[]` | `x-courses` | tupleList `[k,v][]` | no | `[course, grade]` tuples |
| `work[]` | `x-time` | string ≥4 | **yes** | |
| `work[]` | `x-section` | `enum["academic"]` | no | Splits `work[]` into `working` vs `academics` view models |
| `work[]` | `x-footnote` | string | no | e.g. supervisor name |
| `work[]` | `x-highlight` | string | no | Badge text (e.g. "Patent") |
| `work[]` | `x-links` | labeledLinks `{text,url}[]` | no | `url` must match `^https?://.+` |
| `work[]` | `x-tags` | string[] | no | Drives overlay `tagsAnyOf` filter |
| `projects[]` | `x-time` | string ≥4 | **yes** | |
| `projects[]` | `x-type` | `enum["competition"]` | no | Splits `projects` vs `competitions` view models |
| `projects[]` | `x-location` | string | no | |
| `projects[]` | `x-highlight` | string | no | Badge (e.g. "World Champion") |
| `projects[]` | `x-links` | labeledLinks | no | |
| `projects[]` | `x-tags` | string[] | no | NOTE: projects use stdlib `keywords` for tags in the adapter, not `x-tags` (see §f) |
| `volunteer[]` | `x-time` | string ≥4 | **yes** | |
| `volunteer[]` | `x-location` | string | no | |
| `volunteer[]` | `x-links` | labeledLinks | no | |
| `volunteer[]` | `x-tags` | string[] | no | |
| `publications[]` | `x-authors` | string[] (≥1) | **yes** | A leading `!` on a name marks the résumé owner (e.g. `"!Chu-Rong Chen"`) — preserved verbatim into the view model |
| `publications[]` | `x-venue` | `{type: enum["conference","journal"], name}` | **yes** | `additionalProperties:false` |
| `publications[]` | `x-status` | string | no | |
| `publications[]` | `x-links` | labeledLinks | no | |
| `publications[]` | `x-tags` | string[] | no | |
| `meta` | (open object) | object | no | Schema does not constrain `meta` keys |

`definitions`: `labeledLinks` = `{text(≥1), url(^https?://.+)}[]`,
`additionalProperties:false`; `stringList` = string[] (each ≥1);
`tupleList` = exactly-2-element string arrays; `timeString` = string ≥4.

### `meta` keys actually used (from `data/resume.json`)
- `meta.version` — e.g. `"v1.0.0"`.
- `meta.sectionOrder` — array of view-model keys giving render order:
  `personalInfo, education, academics, working, publications, competitions,
  projects, extracurriculars, skills`.
- `meta.print` — `{ scale, margins:{top,left,right,bottom}, paperSize }`;
  consumed by `print.js` (`getPrint`/`pageCss`/`pdfOptions`). NOT in the
  extension schema (`meta` is unconstrained).

No `meta.x-profiles` and no `?profile` — profiles were removed. Per-job section
selection lives only in the overlay.

---

## (b) Application overlay (`overlay.schema.json`)

A reviewable per-job diff. Never replaces the résumé; describes section
selection + filters + RFC-6902 patches against the **current** canonical
résumé. `additionalProperties:false` at the top level.

| Field | Type | Required | Notes |
|---|---|---|---|
| `jobId` | string ≥1 | **yes** | Must equal the route `:id` on `PUT /api/jobs/:id/overlay` (`server.js:99`) |
| `profile` | object | **yes** | `additionalProperties:false` |
| `profile.name` | string | no | |
| `profile.description` | string | no | |
| `profile.sections` | enum[] (≥1) | **yes** | Subset/ordering of view-model keys: `personalInfo, education, academics, working, publications, competitions, projects, extracurriculars, skills`. `overlayProblems` additionally requires `personalInfo` to be present (`server.js:35`) |
| `profile.filters` | `{ [sectionKey]: Filter }` | no | Filter object `additionalProperties:false` |
| `patches` | RFC-6902 op[] | no | See below |
| `coverLetter` | string | no | Persisted to `jobs.cover_letter` |
| `audit` | object | no | Verify-pass output; `additionalProperties:false` |

### Filter object (per section)
| Key | Type | Semantics (from `overlay.js` `applyFilter`) |
|---|---|---|
| `tagsAnyOf` | string[] | Keep items whose `tags` include any of these |
| `titleIn` | string[] | Keep only items with these `title`s |
| `exclude` | string[] | Drop these titles (reviewer "hide item") |
| `order` | string[] | Reorder by this title list; unlisted items keep relative order, after listed ones |
| `limit` | integer ≥0 | Cap count, applied last |
Filters key items by their `title` (the adapter's org/project/institution name).
Order of application: `tagsAnyOf` → `titleIn` → `exclude` → `order` → `limit`.

### `patches[]` (RFC-6902)
Each: `{op, path, from?, value?}`, `additionalProperties:false`.
`op ∈ {add, remove, replace, move, copy, test}`; `path`/`from` match
`^(/|$)`. Applied to a **deep clone** of the résumé doc; view models are then
rebuilt from the patched doc (`overlay.js:60` `applyOverlay`). Must apply
cleanly — `jsonpatch.validate` is run both client-side and in
`overlayProblems`.

### `audit` (fabrication trace)
- `audit.claims[]`: `{patchIndex(int≥0), groundedIn?: string[], verdict: enum["supported","unsupported"]}`.
  `groundedIn` entries are master-bank refs (`master:<id>`).
- `audit.unsupported`: `integer[]` (patch indices). **Must be empty to enter
  review** — `tailorJob.js` DROPS unsupported patches before persisting.
- `additionalProperties:false` on `audit` and on each claim.

---

## (c) Master bullet bank (`master.schema.json` / `master.json`)

The full long-form accomplishment history grounding LLM tailoring. Richer than
any rendered résumé. Lives at `packages/renderer/src/data/master.json`.

Top level `{ updatedAt?: ISO-date, bullets: Bullet[] (≥1) }`,
`additionalProperties:false`.

| Bullet field | Type | Required | Notes |
|---|---|---|---|
| `id` | string `^[a-z0-9]+(-[a-z0-9]+)*$` | **yes** | Stable kebab-case; NEVER renamed once referenced by an `audit`. Convention: `<context-slug>-<n>` (e.g. `ambarella-inc-1`) |
| `text` | string ≥1 | **yes** | The accomplishment, long-form |
| `source` | string `^(/|$)` | no | JSON Pointer into `resume.json` (e.g. `/work/0/highlights/1`) when the bullet mirrors rendered content; omitted for bank-only bullets |
| `context` | string | no | Org / project / role label |
| `tags` | string[] | no | |
| `metrics` | string[] | no | Quantified claims extracted verbatim (e.g. `"20%"`, `"5×"`) — feeds the verify numeric tripwire |

The verify pass traces every overlay patch to bullets here:
`audit.claims[].groundedIn = ["master:<id>"]`.

---

## (d) Database (Postgres + pgvector)

Migrations `001`–`004` in `services/pipeline/migrations/`, applied in filename
order by `services/pipeline/src/migrate.js` (readdir), tracked in
`schema_migrations`. Compose service `jobs-db` (`pgvector/pgvector:pg17`).

### `jobs` (PK `id text`)
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | text PK | | e.g. `gh-figure-12345`, `lever-zoox-abc`, `jobspy-<hash>` |
| `source` | text NOT NULL | | `greenhouse \| lever \| ashby \| jobspy:<site> \| manual` |
| `company` | text NOT NULL | | |
| `title` | text NOT NULL | | |
| `location` | text | | |
| `remote` | boolean | | |
| `url` | text | | |
| `posted_at` | date | | |
| `jd_text` | text | | Raw job description |
| `parsed` | jsonb | | LLM-extracted requirements (`parseJd` output) |
| `score` | real | | |
| `score_breakdown` | jsonb | | written by `cycle.js`: `{keyword, missingTerms, llmFit, rationale, redFlags, structural, structuralReasons, weights}` (the `001` header comment lists only the core four) |
| `status` | text NOT NULL | `'new'` | Lifecycle below |
| `skip_reason` | text | | |
| `company_flags` | text[] NOT NULL | `'{}'` | values: `dream \| startup \| return-path` |
| `dedupe_key` | text NOT NULL | | `norm(company)\|norm(title)\|norm(location)`; UNIQUE index |
| `overlay` | jsonb | | Generated overlay (overlay.schema.json) — added in 002 |
| `cover_letter` | text | | added in 002 |
| `audit` | jsonb | | verifyClaims output — added in 002 |
| `label` | text | | calibration: `good \| bad \| null` — added in 002 |
| `reject_reason` | text | | added in 002 |
| `reviewed_at` | timestamptz | | added in 002 |
| `created_at` | timestamptz NOT NULL | `now()` | |
| `updated_at` | timestamptz NOT NULL | `now()` | |

Indexes: `jobs_dedupe_key` (UNIQUE on `dedupe_key`), `jobs_status` (on `status`).

**`status` lifecycle** (text, grows with phases; per `001_init.sql` header +
`server.js` transitions):
`new → parsing → scored → in_review → approved → applying → applied →
responded | rejected | skipped | error`.
(The migration header lists `parsed`/`tailored` as intermediate; current code
uses `in_review` as the review-entry state.) Reviewer transitions:
`approve` requires current `in_review` → `approved` (else 409); `reject` → `rejected` from any state.

### `events` (PK `id bigserial`)
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `job_id` | text FK → `jobs(id)` ON DELETE SET NULL | |
| `stage` | text NOT NULL | `discover \| parse_jd \| score \| notify \| ...` |
| `model` | text | |
| `input_tokens` | integer | |
| `output_tokens` | integer | |
| `cost_usd` | numeric(10,6) | |
| `duration_ms` | integer | |
| `ok` | boolean NOT NULL | |
| `detail` | jsonb | |
| `created_at` | timestamptz NOT NULL `now()` | |
Index: `events_stage_created` on `(stage, created_at)`.

### `answers` (PK `id bigserial`)
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `key` | text UNIQUE NOT NULL | seeded: `work_authorization, citizenship, salary, notice_availability, relocation, why_company`; custom keys are slugged from the question (`server.js:165`) |
| `question` | text NOT NULL | canonical phrasing |
| `answer` | text NOT NULL | |
| `updated_at` | timestamptz NOT NULL `now()` | |
Seeded by `003_seed_answers.sql` with `ON CONFLICT (key) DO NOTHING` (re-runs
never clobber reviewer edits).

### `resume_versions` (PK `id bigserial`)
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `data` | jsonb NOT NULL | full résumé document |
| `note` | text | `'seed' \| 'edit' \| 'restore of #N'` |
| `created_at` | timestamptz NOT NULL `now()` | |
**Latest row by `id` = current canonical résumé.** Every save = a new row
(history, nothing lost). Seeded on first read from `RESUME_SEED`
(`server.js:109` `currentResume`).

---

## (e) API routes (`services/api/src/server.js`, Fastify, port 8080, container `jobs-api`)

All `/api`, `/applications`, `/resume*` paths are exempt from the SPA fallback
(`setNotFoundHandler`, `server.js:194`). PII — sits behind nginx proxy manager
auth.

| Method | Path | Purpose | Request body | Response / codes |
|---|---|---|---|---|
| GET | `/api/jobs?status=` | List jobs by status (default `in_review`), ordered by `score DESC NULLS LAST` | — | `[{id,company,title,location,score,status,company_flags,label}]` |
| GET | `/api/jobs/:id` | Full job row | — | row with `JOB_FIELDS` (incl. `parsed,jd_text,overlay,score_breakdown,audit,cover_letter`); `404` if absent |
| GET | `/applications/:id/overlay.json` | Overlay for the renderer (`?application=<id>`) | — | overlay JSON; `404` if no overlay |
| POST | `/api/jobs/:id/approve` | `in_review → approved` | — | `{ok:true}`; `409` if not `in_review` |
| POST | `/api/jobs/:id/reject` | → `rejected` | `{reason?}` | `{ok:true}` (sets `reject_reason`) |
| POST | `/api/jobs/:id/label` | Calibration label | `{label}` (`good\|bad\|null`) | `{ok:true}`; `400` if invalid label |
| PUT | `/api/jobs/:id/overlay` | Persist reviewer-edited overlay | overlay JSON | `{ok:true}`; `400` if `overlayProblems` non-empty or `jobId` ≠ `:id`. Writes `overlay`, `cover_letter`, `audit` |
| GET | `/api/resume` | Current canonical résumé | — | résumé `data` (seeds if empty) |
| PUT | `/api/resume` | Save new résumé version | résumé doc | `{ok,version,created_at}`; `400` unless body has `basics` + `Array work[]`. Inserts row note `'edit'` |
| GET | `/api/resume/history` | Last 100 versions | — | `[{id,note,created_at}]` desc |
| POST | `/api/resume/restore/:id` | Re-insert a past version as newest | — | `{ok,version}`; `404` if no such version. Note `'restore of #N'` |
| GET | `/api/answers` | All Q&A | — | `[{key,question,answer}]` by key |
| PUT | `/api/answers/:key` | Upsert a Q&A | `{question?,answer?}` | `{ok:true}` (ON CONFLICT updates) |
| POST | `/api/answers` | Add custom Q&A (auto-slug key) | `{question,answer?}` | `{ok,key}`; `400` if no question |
| DELETE | `/api/answers/:key` | Delete a Q&A | — | `{ok:true}` |
| GET | `/healthz` | Liveness | — | `'ok'` |
| GET | `/resume` | Redirect | — | `302 → /resume/` (Fastify `reply.redirect` default) |

Static hosts: `/resume/` → built renderer (`../site`); `/` → built review SPA
(`../review`). 404s outside the API prefixes fall back to the review
`index.html` (hash routes `#/`, `#/app/:id`, `#/answers`).

`overlayProblems(overlay, resumeDoc)` (`server.js:28`) runs Ajv against
`overlay.schema.json`, validates `patches` against the **current** résumé via
`jsonpatch.validate`, and requires `profile.sections` to include
`personalInfo`. Returns a list of strings (empty = valid).

---

## (f) Adapter view-model KEY CONTRACT (`adapter.js` + `adapter.test.js`)

**Load-bearing:** components spread items onto DOM elements
(`{...item} → {...props}`), so any extra key leaks into the DOM as an
attribute. `buildViewModels(resume)` must emit EXACTLY the known keys; optional
keys are **omitted** (via `opt(key,value)` — never set to `undefined`).
`adapter.test.js` enforces both the allowed-key set and the no-`undefined`
rule.

### View models returned by `buildViewModels`
| View model | Source | Keys emitted |
|---|---|---|
| `personalInfo` | `basics` | `{name, info:[label,value][], link:[network,url][], qrcodes:[label,src][]}` |
| `education` | `education[]` | `{time(x-time), title(institution), content(x-info), selectedCourses?(x-courses)}` |
| `working` | `work[]` where `x-section ≠ academic` | experience keys (below) |
| `academics` | `work[]` where `x-section = academic` | experience keys |
| `projects` | `projects[]` where `x-type ≠ competition` | experience keys |
| `competitions` | `projects[]` where `x-type = competition` | experience keys |
| `extracurriculars` | `volunteer[]` | `{title(organization), role?(position), time(x-time), location?(x-location), content(highlights)}` |
| `publications` | `publications[]` | `{title(name), authors(x-authors), publication:{conference?\|journal?, status?}}` |
| `skills` | `skills[]` flattened | `{title(keyword), category(group name)}`, in group order |

### Experience keys (the enforced set — `EXPERIENCE_KEYS` in `adapter.test.js`)
`title, role, time, location, footnote, highlight, link, content, tags`
— and nothing else. Produced by `toExperience(entry,{org,tags})`:
- `title` ← `entry[org]` (`name`)
- `role?` ← `entry.position ?? entry.roles?.[0]`
- `time` ← `entry['x-time']`
- `location?` ← `entry.location ?? entry['x-location']`
- `footnote?` ← `entry['x-footnote']`
- `highlight?` ← `entry['x-highlight']`
- `link?` ← `entry['x-links']`
- `content` ← `entry.highlights`
- `tags?` ← `entry[tags]` — **`work` uses `x-tags`; `projects` uses
  stdlib `keywords`** (the `tags` arg differs per call: `adapter.js:50,54`).

Test invariants (`adapter.test.js`): every experience item has truthy
`title`/`time` and array `content`; no value is `undefined`; publication
authors non-empty with `!`-marker preserved and a `conference|journal` venue;
skills flattened to `count = Σ group.keywords.length`. Section counts: split by
`x-section` (work) and `x-type` (projects). `buildProfileFrom` assembles only
the requested `sections` (object key order = section order) and applies
`filters`.
