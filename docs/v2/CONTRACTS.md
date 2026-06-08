# v2 Contracts Specification — `@contracts` package (deliverable #0)

**Date:** 2026-06-08 · **Worktree:** `/Users/tomchen/Git/resume-v2` ·
**Status:** authoritative; the construction team imports from this. Derived from
`docs/v2/DECISIONS.md` (binding brief) + the four 2026-06-08 interface audits,
verified against v1 code on disk. Where v1 code and `docs/agents/*.md` disagree,
this doc follows the **code**, and every shape claim cites a v1 `file:line` or is
marked **[v2 redesign]**.

## How to read this

- **Zod-first single source of truth.** Every shape below is a Zod schema in the
  `@contracts` package. JSON Schema (for Ajv/runtime validation: overlays edited
  in the API, master bank, résumé) is *emitted from Zod* via `zod-to-json-schema`
  at build — never hand-written. The renderer, API, pipeline, and (later) the
  apply agent all import the Zod, never restate a shape.
- Verdicts: **KEEP** (port verbatim), **REDESIGN** (same role, new shape),
  **DROP** (remove; verified unused).
- "Producers/consumers" name v2 subsystems: `discovery`, `pipeline` (parse/score/
  tailor/verify/scheduler), `api`, `renderer` (résumé canvas + bare print path),
  `dashboard` (the merged routed SPA), `apply` (Phase-4, designed-not-built).

### `@contracts` package layout (proposed)

```
packages/contracts/src/
  sections.ts        §1  section-key registry (THE one list)
  resume.ts          §2  résumé document schema (+ meta.sectionOrder/print)
  viewModel.ts       §3  view-model contract + all-section guard
  overlay.ts         §4  overlay (op restriction, filter split, audit)
  master.ts          (master bank schema; §11 grounding)
  pipeline.ts        §5  Jd / Fit / Tailor / Verdict + scoreBreakdown
  scoring.ts         §5  Constraint / Preference two-list + influence semantics
  config.ts          §6  llmConfig / scheduleConfig / discoveryConfig / ...
  db.ts              §7  row projections + status enum
  api.ts             §8  request/response DTOs; overlayProblems (THE one impl)
  events.ts          §9  events ledger row + dashboard read DTOs
  jobRow.ts          §10 discovery → jobs write contract
  antifab.ts         §11 anti-fabrication invariants (constants + guards)
  index.ts           barrel
```

---

## 1. Section-key registry — THE one list

**Verdict: REDESIGN** (one registry replaces v1's 6 duplicated literals).

In v1 the nine section keys are restated independently in: `overlay.schema.json`
sections enum (`overlay.schema.json:25-35`), `tailor.js` `SECTIONS`
(`tailor.js:20`), `editorModel.js` `SECTIONS` (`editorModel.js:15-25`),
`adapter.js` `buildViewModels` return object (`adapter.js:83-93`), `config/
sections.js` `sectionsConfig` (`sections.js:3-93`), and `data/resume.json`
`meta.sectionOrder` (`resume.json:563-573`). They drift independently — this is
the single worst source of v1 coupling-by-copy.

In v2 one registry is the source for: the overlay `sections` enum, the
`TailorSchema` sections enum, the editor section tree, the renderer
`sectionsConfig`, the adapter's emitted keys, and `sectionOrder` validation.

```ts
// sections.ts
import { z } from 'zod';

/** A view-model/section key. `source` is the résumé array it draws from (or
 *  null for synthesized sections); `pick` splits one array into two sections;
 *  `editable` exposes bullets in the editor + is patch-targetable by tailoring;
 *  `titleKey` is the field items are keyed by for overlay exclude/order/filter. */
export const SECTION_REGISTRY = [
  { key: 'personalInfo',     label: 'Header',              source: 'basics',       list: false, editable: false },
  { key: 'education',        label: 'Education',           source: 'education',    list: true,  editable: false, titleKey: 'institution' },
  { key: 'academics',       label: 'Academic Experience', source: 'work',         list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.track === 'academic' },
  { key: 'working',          label: 'Experience',          source: 'work',         list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.track !== 'academic' },
  { key: 'publications',     label: 'Publications',        source: 'publications', list: true,  editable: false, titleKey: 'name' },
  { key: 'competitions',     label: 'Competitions',        source: 'projects',     list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.kind === 'competition' },
  { key: 'projects',         label: 'Projects',            source: 'projects',     list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.kind !== 'competition' },
  { key: 'extracurriculars', label: 'Activities',          source: 'volunteer',    list: true,  editable: true,  titleKey: 'organization' },
  { key: 'skills',           label: 'Skills',              source: 'skills',       list: false, editable: false },
] as const;

export const SECTION_KEYS = SECTION_REGISTRY.map((s) => s.key);          // ['personalInfo', …]
export const SectionKey = z.enum(SECTION_KEYS as [string, ...string[]]);  // the ONE enum

export const EDITABLE_SECTION_KEYS =
  SECTION_REGISTRY.filter((s) => s.editable).map((s) => s.key);          // patch-targetable
export const sectionMeta = (key) => SECTION_REGISTRY.find((s) => s.key === key);
```

> **Note — the split-discriminator rename.** v1 splits with `x-section:'academic'`
> (`adapter.js:51`) and `x-type:'competition'` (`adapter.js:55`). v2 renames these
> to `track` and `kind` (§2). The `pick` predicates above are the *single* place
> the split lives — adapter, editor model, and tailor's `patchableMap` all consume
> `SECTION_REGISTRY`, so the split rule can never diverge across files again.

**Producers:** none (static). **Consumers:** §2 résumé (`sectionOrder` validation),
§3 view-model guard, §4 overlay sections enum, §5 `TailorSchema`, renderer
`sectionsConfig`/`componentRegistry`, dashboard editor tree.

**Must-preserve invariant:** the **nine keys and their order semantics are the
frozen renderer surface** — adding/removing a key is a renderer-DOM change gated
by the `render-check` skill (empty DOM diff).

---

## 2. Résumé document — fresh schema (drop JSON Resume conformance)

**Verdict: REDESIGN** — own the schema; drop `x-` prefixes and the upstream
JSON-Resume schema; keep only fields a live consumer reads; fix `publications`
links. `pnpm validate` validates against this single Zod-derived schema (the
brief: "One Zod-derived schema replaces the dual upstream-JSON-Resume + extension
schema").

### 2.1 Old → new field mapping (drives the §12 migration)

Verified consumers: `adapter.js` (view-models), `profile.js`
(`candidateTerms`/`profileText`), `editorModel.js` (`SECTIONS` source/titleKey),
`tailor.js` `patchableMap` (highlight paths), `print.js` (`meta.print`).

| Section | v1 field (file:line) | v2 field | Verdict | Reason |
|---|---|---|---|---|
| `basics` | `name, email, phone, location{city,region,countryCode}, profiles[]{network,username,url}` (`resume.json:3-24`) | same names | **KEEP** | all read by `adapter.js:30-41` |
| `basics` | `label` (`resume.json:5`) | `headline` | **REDESIGN** | only read by `profile.js:50` (`profileText`); rename for clarity, no `x-`. **NOT rendered** (adapter never emits it) — keep as a non-rendered field feeding scoring |
| `basics` | `x-qrcodes[]{label,src}` (`resume.json:25-30`) | `qrcodes[]{label,src}` | **REDESIGN** | drop `x-`; read by `adapter.js:40` |
| `education[]` | `institution` | `institution` | **KEEP** | `adapter.js:44` (`title`) |
| `education[]` | `x-time` (`resume.json:38`) | `time` | **REDESIGN** | drop `x-`; `adapter.js:43` |
| `education[]` | `x-info` `[k,v][]` (`resume.json:39`) | `info: [string,string][]` | **REDESIGN** | drop `x-`; `adapter.js:46` (`content`) |
| `education[]` | `x-courses` `[k,v][]` (`resume.json:72`) | `courses: [string,string][]?` | **REDESIGN** | drop `x-`; `adapter.js:47` (`selectedCourses`). **Renamed-collides** with old stdlib `courses: string[]` — see note below |
| `education[]` | stdlib `area, studyType, score, startDate, endDate, courses[]` (`resume.json:35-60`) | **DROP** | **DROP** | none read by adapter; `profile.js:45` reads `studyType`/`area` for fit text → fold those two into the new `info` tuples or keep as scoring-only fields (decision: keep `area`,`studyType` as optional non-rendered scoring fields) |
| `work[]` | `name, position, location, highlights[]` | same | **KEEP** | `adapter.js:13-24,50` |
| `work[]` | `x-time` | `time` | **REDESIGN** | drop `x-` |
| `work[]` | `x-section:'academic'` (`resume.json:151`) | `track: 'academic'\|'industry'?` | **REDESIGN** | the §1 split discriminator; renamed off `x-` |
| `work[]` | `x-footnote` (`resume.json:153`) | `footnote?` | **REDESIGN** | drop `x-`; `adapter.js:20` |
| `work[]` | `x-links[]{text,url}` (`resume.json:130`) | `links[]{text,url}?` | **REDESIGN** | drop `x-`; `adapter.js:21` (`link`) |
| `work[]` | `x-tags[]` (`resume.json:113`) | `tags[]?` | **REDESIGN** | drop `x-`; `adapter.js:23` + `candidateTerms` (`profile.js:35`) |
| `work[]` | `x-highlight` | — | **DROP** | **0 instances** in `work[]` (verified: `resume.json` `x-highlight` only at lines 416,474, both in `projects[]`). Keep the field only on projects |
| `work[]` | stdlib `startDate, endDate, url` | **DROP** | **DROP** | not read by adapter (display uses `time`); `url` superseded by `links` |
| `projects[]` | `name, roles[], highlights[], keywords[]` | `name, roles[]?, highlights[], tags[]?` | **REDESIGN** | `keywords` → `tags` (adapter currently reads stdlib `keywords` as tags: `adapter.js:54`). Unifies the work/project tag field name |
| `projects[]` | `x-time` | `time` | **REDESIGN** | drop `x-` |
| `projects[]` | `x-type:'competition'` (`resume.json:443`) | `kind: 'competition'\|'project'?` | **REDESIGN** | §1 split discriminator |
| `projects[]` | `x-location` (`resume.json:256`) | `location?` | **REDESIGN** | drop `x-`; `adapter.js:19` |
| `projects[]` | `x-highlight` (`resume.json:416`) | `badge?` | **REDESIGN** | rename (the "Patent"/"World Champion" badge); `adapter.js:16` (`highlight`) |
| `projects[]` | `x-links[]` | `links[]?` | **REDESIGN** | drop `x-` |
| `projects[]` | `x-tags[]` | — | **DROP** | adapter uses `keywords`→`tags`, never `x-tags` for projects (`adapter.js:54`, doc `data-contracts.md:71`). The unified `tags` field above replaces it |
| `projects[]` | stdlib `startDate,endDate,url` | **DROP** | **DROP** | not read; `url` → `links` |
| `volunteer[]` | `organization, position, highlights[]` | same | **KEEP** | `adapter.js:58-64` |
| `volunteer[]` | `x-time` | `time` | **REDESIGN** | drop `x-` |
| `volunteer[]` | `x-location` | `location?` | **REDESIGN** | drop `x-`; `adapter.js:62` |
| `volunteer[]` | `x-links[]`, `x-tags[]` | — | **DROP** | adapter emits neither for extracurriculars (`adapter.js:58-64`); 0 instances in data |
| `publications[]` | `name` | `name` | **KEEP** | `adapter.js:71` |
| `publications[]` | `x-authors[]` (`!`-marker) (`resume.json:197`) | `authors[]` (`!`-marker preserved) | **REDESIGN** | drop `x-`; `adapter.js:67`. **Invariant: `!` prefix preserved verbatim** |
| `publications[]` | `x-venue{type,name}` (`resume.json:206`) | `venue{type:'conference'\|'journal', name}` | **REDESIGN** | drop `x-`; `adapter.js:72-75` |
| `publications[]` | `x-status` | `status?` | **REDESIGN** | drop `x-`; `adapter.js:75` |
| `publications[]` | `x-links[]` (`resume.json` schema:128; **never in data**) | `links[]?` | **REDESIGN + FIX** | **the publications-links bug:** `publications.jsx:61` renders `link` and the schema defines `x-links`, but `adapter.js:66-77` never emits it. v2: adapter emits `link` from `links` (§3) |
| `publications[]` | `x-tags[]`, stdlib `publisher` | — | **DROP** | adapter emits neither (`adapter.js:66-77`); `publisher` is dead (`venue.name` is used) |
| `skills[]` | `{name, keywords[]}` | `{name, keywords[]}` | **KEEP** | `adapter.js:79-81` |
| `meta` | `version, sectionOrder[], print{}` | same | **KEEP** | §2.3 |

> **`courses` collision:** v1 has *both* stdlib `education[].courses: string[]`
> (unused by adapter) and `x-courses: [k,v][]` (rendered as graded rows). v2 keeps
> only the graded form, named `courses: [string,string][]`. The migration (§12)
> drops the stdlib string array.

### 2.2 Zod — résumé document

```ts
// resume.ts
import { z } from 'zod';
import { SECTION_KEYS } from './sections';
import { PrintConfig } from './print';

const Tuple2 = z.tuple([z.string(), z.string()]);
const Link = z.object({ text: z.string().min(1), url: z.string().regex(/^https?:\/\/.+/) });
const time = z.string().min(4);   // display range, e.g. "Jun 2025 - Aug 2025"

export const Basics = z.object({
  name: z.string().min(1),
  headline: z.string().optional(),            // was basics.label — scoring-only, not rendered
  email: z.string(),
  phone: z.string().optional(),
  location: z.object({ city: z.string().optional(), region: z.string().optional(), countryCode: z.string().optional() }).optional(),
  profiles: z.array(z.object({ network: z.string(), username: z.string().optional(), url: z.string() })).default([]),
  qrcodes: z.array(z.object({ label: z.string(), src: z.string() })).default([]),
}).strict();

export const Education = z.object({
  institution: z.string().min(1),
  area: z.string().optional(),                // scoring-only (profile.js fit text)
  studyType: z.string().optional(),           // scoring-only
  time,
  info: z.array(Tuple2),                       // was x-info (required)
  courses: z.array(Tuple2).optional(),         // was x-courses (graded rows)
}).strict();

export const Work = z.object({
  name: z.string().min(1),
  position: z.string().optional(),
  location: z.string().optional(),
  time,
  track: z.enum(['academic', 'industry']).optional(),  // §1 split; absent ⇒ industry/working
  footnote: z.string().optional(),
  links: z.array(Link).optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string()).default([]),
}).strict();

export const Project = z.object({
  name: z.string().min(1),
  roles: z.array(z.string()).optional(),
  time,
  kind: z.enum(['competition', 'project']).optional(),  // §1 split; absent ⇒ project
  location: z.string().optional(),
  badge: z.string().optional(),                // was x-highlight (e.g. "Patent")
  links: z.array(Link).optional(),
  tags: z.array(z.string()).optional(),        // was stdlib `keywords`
  highlights: z.array(z.string()).default([]),
}).strict();

export const Volunteer = z.object({
  organization: z.string().min(1),
  position: z.string().optional(),
  time,
  location: z.string().optional(),
  highlights: z.array(z.string()).default([]),
}).strict();

export const Publication = z.object({
  name: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),  // leading '!' marks the owner — preserved verbatim
  venue: z.object({ type: z.enum(['conference', 'journal']), name: z.string().min(1) }).strict(),
  status: z.string().optional(),
  links: z.array(Link).optional(),             // FIX: now emitted by the adapter (§3)
}).strict();

export const SkillGroup = z.object({ name: z.string(), keywords: z.array(z.string()) }).strict();

export const ResumeMeta = z.object({
  version: z.string().optional(),
  sectionOrder: z.array(z.enum(SECTION_KEYS as [string, ...string[]])),  // validated against §1
  print: PrintConfig.optional(),
}).strict();

export const ResumeDoc = z.object({
  basics: Basics,
  education: z.array(Education).default([]),
  work: z.array(Work).default([]),
  projects: z.array(Project).default([]),
  publications: z.array(Publication).default([]),
  volunteer: z.array(Volunteer).default([]),
  skills: z.array(SkillGroup).default([]),
  meta: ResumeMeta,
}).strict();
```

### 2.3 `meta.print` (validated — was unconstrained in v1)

In v1 `meta` is an open object (`extensions.schema.json:133`); `print` is only
clamped at read time in `print.js:16-27`. v2 validates it via Zod.

```ts
// print.ts
import { z } from 'zod';
export const PAPER_SIZES = ['A4', 'Letter', 'Legal', 'A3', 'A5'] as const;
export const PrintConfig = z.object({
  paperSize: z.enum(PAPER_SIZES).default('A4'),
  margins: z.object({
    top: z.number().min(0).default(0), right: z.number().min(0).default(0),
    bottom: z.number().min(0).default(0), left: z.number().min(0).default(0),
  }).default({}),
  scale: z.number().positive().default(1),
}).strict();
```
`getPrint`/`pageCss`/`pdfOptions` (`print.js`) port **KEEP** verbatim. Consumers:
renderer `usePageStyle` (@page) + the bare print path (§ DECISIONS req 3) + the
Playwright PDF job.

**Producers:** `api` (`PUT /api/resume`), dashboard résumé editor, `pnpm
export-seed`. **Consumers:** `renderer` (adapter input + print), `pipeline`
(`profile.js` scoring/tailoring source).

**Must-preserve invariants:**
- **Renderer DOM byte-identical:** "The adapter's *output* view-models are the
  frozen surface; its *input* shape changes." Porting this schema must produce an
  **empty `render-check` DOM diff**.
- **`treeToResume` slot-preservation:** "no-op save reproduces source arrays
  positionally → existing overlay patch paths stay valid" (`editorModel.js:121-137`).
- **`!`-author marker preserved verbatim** into the view model.

---

## 3. View-model contract — the frozen renderer surface

**Verdict: KEEP shape, REDESIGN guard** — the emitted keys are unchanged
(byte-identical DOM); the no-extra-keys / no-`undefined` guard is extended from
*experience-only* to **all** sections.

v1's `adapter.test.js` only iterates `working/academics/projects/competitions/
extracurriculars` for the key check (`adapter.test.js:29`) and only `working/
projects` for the no-`undefined` check (`adapter.test.js:39`). `personalInfo`,
`education`, `publications`, `skills` are unguarded — a stray key there leaks into
the DOM (components spread `{...item}`: `experiences.jsx:131`, `publications.jsx:46,90`).

```ts
// viewModel.ts
import { z } from 'zod';

const Tuple2 = z.tuple([z.string(), z.string()]);

// EXACT keys the experience components spread (experiences.jsx destructures
// title/role/time/location/footnote/highlight/link/content/tags). Optional keys
// are OMITTED, never undefined.
export const ExperienceVM = z.object({
  title: z.string().min(1),
  time: z.string().min(1),
  content: z.array(z.string()),
  role: z.string().optional(),
  location: z.string().optional(),
  footnote: z.string().optional(),
  highlight: z.string().optional(),                          // projects badge only
  link: z.array(z.object({ text: z.string(), url: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export const PersonalInfoVM = z.object({
  name: z.string(),
  info: z.array(Tuple2),
  link: z.array(Tuple2),                                     // [network, url][]
  qrcodes: z.array(Tuple2),                                  // [label, src][]
}).strict();

export const EducationVM = z.object({
  time: z.string(), title: z.string(), content: z.array(Tuple2),
  selectedCourses: z.array(Tuple2).optional(),
}).strict();

export const PublicationVM = z.object({
  title: z.string(),
  authors: z.array(z.string()).min(1),
  publication: z.object({
    conference: z.string().optional(), journal: z.string().optional(), status: z.string().optional(),
  }).strict(),
  link: z.array(z.object({ text: z.string(), url: z.string() })).optional(),   // FIX (§2): now emitted
}).strict();

export const SkillVM = z.object({ title: z.string(), category: z.string() }).strict();

export const ViewModels = z.object({
  personalInfo: PersonalInfoVM,
  education: z.array(EducationVM),
  academics: z.array(ExperienceVM),
  working: z.array(ExperienceVM),
  publications: z.array(PublicationVM),
  competitions: z.array(ExperienceVM),
  projects: z.array(ExperienceVM),
  extracurriculars: z.array(ExperienceVM),
  skills: z.array(SkillVM),
}).strict();
```

The adapter test becomes: `ViewModels.parse(buildViewModels(resume))` must not
throw (`.strict()` catches extra keys; `.optional()` + omission catches
`undefined`), iterated over **every** section.

> **The one behavior change in §3:** `PublicationVM.link` is now emitted (v1 bug
> §2). `publications.jsx:61` already renders it (`link = []` default), so emitting
> it from real data is additive — but since today's `resume.json` has **no**
> publication links, the produced DOM for the current seed is **unchanged** (the
> render-check stays empty). New publication links will render going forward.

**Producers:** `renderer` `buildViewModels(resume)`. **Consumers:** renderer
components (spread onto DOM), `overlay.js#buildProfileFrom`, dashboard editor tree.

**Must-preserve invariant (verbatim, brief §SSoT):** "extend the no-extra-keys /
no-`undefined` guard to **all** sections (v1 only guarded experience sections) —
DOM-leak protection." And: components spread items onto DOM elements, so any extra
key leaks into the DOM as an attribute (`adapter.js:1-6`).

---

## 4. Application overlay

**Verdict: KEEP shape, REDESIGN encoding** — port the overlay shape; encode the
op-restriction and the reviewer-vs-LLM filter split *in the types*, and validate
`profile.filters` keys against §1.

v1 overlay (`overlay.schema.json`): `{jobId, profile{name?,description?,sections[],
filters?}, patches[], coverLetter?, audit?}`. Two type-level gaps the brief calls
out: (a) the schema's `patches[].op` allows all six RFC-6902 ops
(`overlay.schema.json:71`) although **LLM-authored** patches are `replace`-only
(`tailor.js:39` `TailorSchema` enforces `z.enum(['replace'])`); (b) `filters`
mixes LLM filters (`tagsAnyOf/titleIn/limit`) with reviewer filters
(`exclude/order`) in one open object — but only the reviewer (editor) may emit
`exclude`/`order` (`editorModel.js:75-80`), and only the LLM emits `tagsAnyOf`/
`titleIn`/`limit` (`tailor.js:26-34`). Encode both.

```ts
// overlay.ts
import { z } from 'zod';
import { SectionKey } from './sections';

// JSON-Pointer subset used by patches/from (v1: pattern ^(/|$))
const Pointer = z.string().regex(/^(\/|$)/);

// Reviewer-only filter ops (editorModel.editorTreeToOverlay) — keyed by item title.
export const ReviewerFilter = z.object({
  exclude: z.array(z.string()).optional(),   // hide these titles
  order: z.array(z.string()).optional(),      // reorder by these titles
}).strict();

// LLM-only filter ops (tailor TailorSchema → toOverlay).
export const LlmFilter = z.object({
  tagsAnyOf: z.array(z.string()).optional(),
  titleIn: z.array(z.string()).optional(),
  limit: z.number().int().min(0).optional(),
}).strict();

// The persisted filter is the union (applyFilter consumes all five keys in the
// order tagsAnyOf→titleIn→exclude→order→limit, overlay.js:18-43). The split is
// enforced at the PRODUCER boundary (tailor emits only LlmFilter keys; the editor
// emits only ReviewerFilter keys) and re-checked by overlayProblems (§8).
export const OverlayFilter = ReviewerFilter.merge(LlmFilter).strict();

// LLM-authored patch: replace-only, value is a string highlight, groundedIn ≥1.
export const LlmPatch = z.object({
  op: z.literal('replace'),
  path: Pointer,
  value: z.string(),
  groundedIn: z.array(z.string()).min(1),     // master-bank ids; stripped into audit by toOverlay
}).strict();

// Persisted patch (after toOverlay strips groundedIn): RFC-6902-shaped but the
// pipeline only ever writes `replace`. Reviewer edits also produce replace-only
// whole-array highlight patches (editorModel.js:86).
export const Patch = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),  // schema breadth (KEEP)
  path: Pointer,
  from: Pointer.optional(),
  value: z.unknown().optional(),
}).strict();

export const AuditClaim = z.object({
  patchIndex: z.number().int().min(0),
  groundedIn: z.array(z.string()).optional(),   // ['master:<id>' | '<id>'] — see §11
  verdict: z.enum(['supported', 'unsupported']),
}).strict();

export const Audit = z.object({
  claims: z.array(AuditClaim).default([]),
  unsupported: z.array(z.number().int()).default([]),   // MUST be [] at in_review (§11)
}).strict();

export const Overlay = z.object({
  jobId: z.string().min(1),
  profile: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    sections: z.array(SectionKey).min(1),               // §1 enum
    filters: z.record(SectionKey, OverlayFilter).optional(),  // keys validated against §1
  }).strict(),
  patches: z.array(Patch).default([]),
  coverLetter: z.string().optional(),
  audit: Audit.optional(),
}).strict();
```

**Filter application order (KEEP, `overlay.js:18-43`):** `tagsAnyOf → titleIn →
exclude → order → limit`; items keyed by `title`.

**Producers:** `pipeline` tailor (`toOverlay`, LLM filters + replace patches),
dashboard overlay editor (`editorTreeToOverlay`, reviewer filters + replace
patches). **Consumers:** `renderer` `applyOverlay` (bare print path), `api` (`PUT
/api/jobs/:id/overlay` validation), dashboard `buildEditorModel`.

**Must-preserve invariants:**
- **Op restriction in the type:** LLM patches are `replace`-only (`tailor.js:39`).
- **Reviewer/LLM filter split in the type:** `exclude`/`order` reviewer-only,
  `tagsAnyOf`/`titleIn`/`limit` LLM-only (brief §SSoT).
- **`audit.unsupported === []` at `in_review`** by construction (§11).
- **`personalInfo` must be in `profile.sections`** (one rule, §8).
- Overlay applies to a **deep clone**; never mutates the résumé (`overlay.js:68`).

---

## 5. Pipeline LLM schemas + two-list scoring + `score_breakdown`

### 5.1 Jd / Fit / Tailor / Verdict

**Verdict: KEEP Jd/Fit/Tailor/Verdict shapes, REDESCRIBE structural inputs.**

```ts
// pipeline.ts
import { z } from 'zod';
import { SECTION_KEYS } from './sections';

export const JdSchema = z.object({                          // parseJd.js:5-16 (KEEP)
  hardSkills: z.array(z.string()),
  softSkills: z.array(z.string()),
  mustHaves: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  responsibilities: z.array(z.string()),
  seniority: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'unspecified']),
  citizenshipOrClearanceRequired: z.boolean(),
  sponsorshipAvailable: z.enum(['yes', 'no', 'unstated']),
  internshipTerm: z.string().nullable(),
  minEducation: z.string().nullable(),
});

export const FitSchema = z.object({                          // score.js:80-84 (KEEP)
  fit: z.number().min(0).max(1),
  rationale: z.string(),
  redFlags: z.array(z.string()),
});

export const TailorSchema = z.object({                       // tailor.js:22-46 (KEEP, sections enum from §1)
  profile: z.object({
    name: z.string(),
    sections: z.array(z.enum(SECTION_KEYS as [string, ...string[]])),
    filters: z.record(z.string(), z.object({
      tagsAnyOf: z.array(z.string()).nullable(),
      titleIn: z.array(z.string()).nullable(),
      limit: z.number().int().min(0).nullable(),
    })).nullable(),
  }),
  patches: z.array(z.object({                                // replace-only (§4 LlmPatch)
    op: z.literal('replace'),
    path: z.string(),
    value: z.string(),
    groundedIn: z.array(z.string()).min(1),
  })),
  coverLetter: z.string(),
});

export const VerdictSchema = z.object({                      // verify.js:34-42 (KEEP)
  verdicts: z.array(z.object({
    patchIndex: z.number().int(),
    supported: z.boolean(),
    reason: z.string(),
  })),
});
```

JD-truncation knobs (KEEP behavior, but see §6 — they could become config):
parse 24000 (`parseJd.js:27`), fit 6000 (`score.js:102`), tailor 16000
(`tailor.js:112`).

### 5.2 Two-list scoring — Constraints (hard) + Preferences (soft)

**Verdict: REDESIGN** — replace v1's hard-coded F-1 `structuralScore`
(`score.js:63-78`) and the F-1/CPT/"Summer 2027" string baked into `profileText`
(`profile.js:51`) with two DB-backed, UI-editable lists. Preserve v1's
deterministic semantics for hard constraints.

**Constraints (hard, deterministic).** Evaluated in code against `JdSchema`
structured fields — never sent to an LLM. Each constraint is a typed rule over a
parsed field; a `hard` constraint that fires forces `score = 0` (mirrors v1
citizenship → hard 0, `score.js:66-68`). `penalty` constraints subtract from the
structural component (mirrors v1's complementary −0.6 seniority / −0.4 sponsorship,
`score.js:69-77`).

```ts
// scoring.ts
import { z } from 'zod';

// The parsed-JD fields a constraint may test (drawn from JdSchema, §5.1).
export const ConstraintField = z.enum([
  'citizenshipOrClearanceRequired',  // boolean
  'sponsorshipAvailable',            // 'yes'|'no'|'unstated'
  'seniority',                       // enum
  'minEducation',                    // string|null
  'internshipTerm',                  // string|null
]);

export const Constraint = z.object({
  id: z.string(),                    // stable key
  label: z.string(),                 // UI: "must accept F-1 (no citizenship/clearance)"
  field: ConstraintField,
  // deterministic predicate over the field value, expressed as a typed test:
  test: z.discriminatedUnion('kind', [
    z.object({ kind: 'isTrue' }),                              // boolean field is true
    z.object({ kind: 'equals', value: z.string() }),          // enum/string equality
    z.object({ kind: 'notIn', values: z.array(z.string()) }), // e.g. seniority NOT in [intern,entry,unspecified]
  ]),
  effect: z.discriminatedUnion('kind', [
    z.object({ kind: 'hard' }),                                // fire ⇒ score 0
    z.object({ kind: 'penalty', amount: z.number().min(0).max(1) }), // subtract from structural
  ]),
  enabled: z.boolean().default(true),
}).strict();
```

The v1 F-1 rules map to three seed Constraints (the §12 migration plants these):

| v1 rule (`score.js`) | v2 Constraint |
|---|---|
| `citizenshipOrClearanceRequired` → hard 0 (`:66`) | `field:'citizenshipOrClearanceRequired', test:{isTrue}, effect:{hard}` |
| seniority ∉ [intern,entry,unspecified] → −0.6 (`:69`) | `field:'seniority', test:{notIn:['intern','entry','unspecified']}, effect:{penalty:0.6}` |
| `sponsorshipAvailable==='no'` → −0.4 (`:73`) | `field:'sponsorshipAvailable', test:{equals:'no'}, effect:{penalty:0.4}` |

**Deterministic semantics preserved (verbatim, brief req 5):** "Preserve v1's
deterministic semantics for hard constraints (citizenship → hard 0; complementary
penalties)." `structuralScore` starts at 1, any fired `hard` short-circuits to 0,
penalties subtract and clamp at ≥0 (`score.js:77`).

**Preferences (soft, priority 1–10).** Free-text considerations fed to the LLM
scorer as weighted text, replacing the hard-coded F-1/CPT/"Summer 2027" anchor in
`profileText` (`profile.js:51`).

```ts
export const Preference = z.object({
  id: z.string(),
  text: z.string().min(1),           // "Prefers robotics/embedded autonomy roles"
  priority: z.number().int().min(1).max(10),   // 1 = mild, 10 = decisive
  enabled: z.boolean().default(true),
}).strict();
```

**priority→influence semantics (explicit, [v2 redesign]).** Preferences do not
alter the deterministic structural score; they are injected into the `llmFit`
system prompt (`score.js:98`) as a ranked, labeled block, and the prompt instructs
the model to weight them by priority. The mapping is fixed so the scorer behaves
predictably:

| priority | label injected | instruction to scorer |
|---|---|---|
| 9–10 | `[decisive]` | A strong mismatch should pull `fit` toward ≤0.3 |
| 6–8 | `[important]` | A mismatch should noticeably lower `fit` (~−0.2) |
| 3–5 | `[moderate]` | A small nudge (~−0.1) |
| 1–2 | `[mild]` | A tie-breaker only |

Preferences are sorted descending by priority and rendered as
`- [decisive] <text>` lines appended to the candidate profile block. The LLM still
returns `FitSchema` unchanged; influence is realized through `fit` and `redFlags`.
The §9 `score_breakdown.preferencesApplied` records which preference texts were in
the prompt (for explainability), and `redFlags` surfaces which the model judged
violated.

### 5.3 `score_breakdown` — real Zod schema

**Verdict: REDESIGN** — v1 writes `score_breakdown` as an untyped jsonb blob
(`cycle.js:45-54`; the `001_init.sql:19` header comment even lists the wrong four
fields). Give it a real schema and have it record **which constraint/preference
moved the score** (brief req 5 + §SSoT).

```ts
export const ScoreBreakdown = z.object({
  keyword: z.number(),                         // keywordScore.value (0.5 floor — §11)
  missingTerms: z.array(z.string()),           // top 12 (cycle.js:47)
  llmFit: z.number(),                          // FitSchema.fit
  rationale: z.string(),
  redFlags: z.array(z.string()),
  structural: z.number(),                      // post-constraint structural value
  // v2: explicit attribution of what moved the score
  constraintsFired: z.array(z.object({
    id: z.string(),
    effect: z.enum(['hard', 'penalty']),
    amount: z.number().optional(),             // for penalties
  })),                                         // replaces v1 freetext `structuralReasons`
  preferencesApplied: z.array(z.object({ id: z.string(), priority: z.number().int() })),
  weights: z.object({ keyword: z.number(), llmFit: z.number(), structural: z.number() }),
}).strict();
```

Score formula KEEP (`score.js:109-110`, weights configurable via §6):
`score = w.keyword·keyword + w.llmFit·llmFit + w.structural·structural`, 4-dp.

**Producers:** `pipeline` (`processJob` writes `parsed`, `score`, `score_breakdown`;
`tailorJob` writes overlay/audit). **Consumers:** `api` (`GET /api/jobs/:id`),
dashboard `/review` detail (renders breakdown), §9 dashboard.

**Must-preserve invariants:**
- **`keywordScore` 0.5 floor on empty-JD term sets** (`score.js:58`, brief).
- **Anti-fabrication chain at tailor/verify** — see §11.
- **Numeric tripwire ignores years 2019–2030** (`verify.js:29`).

---

## 6. Config / settings layer — DB-backed, Zod-validated, CRUD'd, UI-mapped

**Verdict: REDESIGN (new in v2)** — every non-secret config becomes a DB row,
Zod-validated, exposed via CRUD, mapped to a dashboard tab. Services read it at
runtime (extend v1's `refreshResume()` best-effort pull, `profile.js:20`, to all
config). This fixes the v1 finding that `MODEL_*` env vars "aren't even passed
through compose and a model change needs a code change + image rebuild"
(operations.md:90; only `ANTHROPIC_API_KEY` is in compose).

### 6.1 Secrets boundary (stated, binding)

**Secrets stay in env/`.env`, never DB, never UI-editable:** `ANTHROPIC_API_KEY`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `POSTGRES_*`/`DATABASE_URL`, NPM access
list (`REVIEW_BASIC_AUTH`). Everything else moves to DB config. The config CRUD
API never reads or writes secrets; the dashboard has no field for them.

### 6.2 Storage shape

A single `config` table, one row per namespace, `value jsonb` validated by the
matching Zod schema on write (§7). A `getConfig(ns)` helper (best-effort, falls
back to schema defaults on DB failure — the `refreshResume` pattern) is read at
the top of each pipeline cycle / scheduler tick / API request.

```ts
// config.ts
import { z } from 'zod';
import { Constraint, Preference } from './scoring';

// --- LLM (per-stage model + tuning) — replaces MODEL_* / SCORE_THRESHOLD /
//     BATCH_SIZE / POLL_INTERVAL_MS env (operations.md:79-86) ---
export const LlmConfig = z.object({
  models: z.object({
    parse:       z.string().default('claude-haiku-4-5'),
    fit:         z.string().default('claude-haiku-4-5'),
    tailor:      z.string().default('claude-sonnet-4-6'),
    tailorDream: z.string().default('claude-opus-4-8'),
    verify:      z.string().default('claude-haiku-4-5'),
  }).default({}),
  scoreThreshold: z.number().min(0).max(1).default(0.65),   // SCORE_THRESHOLD
  weights: z.object({ keyword: z.number(), llmFit: z.number(), structural: z.number() })
            .default({ keyword: 0.5, llmFit: 0.3, structural: 0.2 }),
  batchSize: z.number().int().min(1).default(10),           // BATCH_SIZE
  pollIntervalMs: z.number().int().min(1000).default(60000),// POLL_INTERVAL_MS
  jdTruncation: z.object({ parse: z.number().default(24000), fit: z.number().default(6000), tailor: z.number().default(16000) }).default({}),
}).strict();

// --- Scheduler (in-process, DB-driven; replaces supercronic crontab) ---
export const ScheduleConfig = z.object({
  discovery: z.object({
    enabled: z.boolean().default(true),
    // cron expression evaluated in `tz`; the in-process scheduler reads this each
    // tick so a UI edit takes effect next tick with NO restart (brief req 6).
    cron: z.string().default('0 9 * * *'),                  // was crontab `0 9 * * *`
    tz: z.string().default('Asia/Taipei'),                   // was TZ
    mode: z.enum(['boards', 'jobspy', 'all']).default('all'),// was crontab `--all`
  }).default({}),
  // poll loop cadence already in LlmConfig.pollIntervalMs; scheduler also owns it.
}).strict();

// --- Discovery searches + companies (replaces searches.yml / companies.yml) ---
export const DiscoverySearch = z.object({
  name: z.string(),
  term: z.string(),
  enabled: z.boolean().default(true),
  // NOTE: v1 `keywords` and `locations` and `defaults.sites` are DROPPED (dead —
  // see §10); JobSpy site list comes from `sites` here (was JOBSPY_SITES env).
}).strict();

export const DiscoveryCompany = z.object({
  name: z.string(),
  flags: z.array(z.enum(['dream', 'startup', 'return-path'])).default([]),
  board: z.object({ provider: z.enum(['greenhouse', 'lever', 'ashby']), slug: z.string() }).nullable(),
  enabled: z.boolean().default(true),
}).strict();

export const DiscoveryConfig = z.object({
  sites: z.array(z.enum(['indeed', 'linkedin'])).default(['indeed']),  // was JOBSPY_SITES (env-only in v1)
  jobspyDefaults: z.object({
    resultsWanted: z.number().int().default(25), hoursOld: z.number().int().default(72),
    jobType: z.string().default('internship'), country: z.string().default('USA'),
    location: z.string().default('United States'),    // was hard-coded (jobspy_search.py:61)
  }).default({}),
  titleInclude: z.array(z.string()).default(['intern', 'internship', 'co-op', 'coop']),
  exclude: z.object({
    title: z.array(z.string()).default(['senior', 'staff', 'principal', 'manager', 'director', 'phd']),
    jd: z.array(z.string()).default(['US citizenship', 'US citizen', 'security clearance', 'ITAR', 'EAR99', 'export control', 'unpaid']),
  }).default({}),
  searches: z.array(DiscoverySearch).default([]),
  companies: z.array(DiscoveryCompany).default([]),
}).strict();

// --- Constraints / Preferences (§5.2) ---
export const ConstraintsConfig = z.array(Constraint).default([]);
export const PreferencesConfig = z.array(Preference).default([]);

// --- Answers config: the answers bank is already a DB table (§7); its CRUD is §8.
```

### 6.3 Namespace → UI-tab mapping

| Config namespace | Zod | UI tab (DECISIONS req 2) | Read by |
|---|---|---|---|
| `llm` | `LlmConfig` | `/llm` | pipeline (every cycle: models, threshold, weights, batch, poll, truncation) |
| `schedule` | `ScheduleConfig` | `/scrawling` | in-process scheduler (every tick) |
| `discovery` | `DiscoveryConfig` | `/scrawling` | discovery service (each run) |
| `constraints` | `ConstraintsConfig` | `/constraints` | pipeline `structuralScore` (each job) |
| `preferences` | `PreferencesConfig` | `/preferences` | pipeline `llmFit` prompt builder (each job) |
| `answers` (table, §7) | `Answer` | `/answers` | reviewer / apply agent |

**Producers:** dashboard config tabs via §8 CRUD. **Consumers:** every service,
read at runtime via best-effort `getConfig(ns)` with schema-default fallback.

**Must-preserve invariant:** **scheduler edits take effect next tick, no restart**
(brief req 6); config reads are **best-effort** (DB hiccup → last-good/defaults,
never crash — the `refreshResume` semantics, `profile.js:24`).

---

## 7. DB schema — PII-minimized projections + lifecycle

**Verdict: KEEP `jobs`/`events`/`answers`/`resume_versions` core; REDESIGN
projections + ADD `config`.**

### 7.1 `jobs` (KEEP columns; PII-minimized read projections)

Columns port verbatim from `001`/`002` (`migrations/001_init.sql:7-26`,
`002_overlay_and_labels.sql:2-7`). The v2 change is at the **projection** layer:
v1's `JOB_FIELDS` (`server.js:41-43`) over-fetches `source, remote, posted_at,
reject_reason, reviewed_at` which the SPA never renders (brief drop/fix list).
v2 defines two typed projections in `db.ts`:

```ts
// db.ts
import { z } from 'zod';
import { ScoreBreakdown } from './pipeline';
import { Overlay, Audit } from './overlay';

export const JobStatus = z.enum([
  'new', 'parsing', 'scored', 'in_review', 'approved',
  'applying', 'applied', 'responded',          // Phase-4 placeholders (designed now)
  'rejected', 'skipped', 'error',
]);
export const CompanyFlag = z.enum(['dream', 'startup', 'return-path']);

// Inbox list projection — the ONLY columns /api/jobs (list) returns (server.js:49)
export const JobListItem = z.object({
  id: z.string(), company: z.string(), title: z.string(),
  location: z.string().nullable(), score: z.number().nullable(),
  status: JobStatus, company_flags: z.array(CompanyFlag), label: z.enum(['good', 'bad']).nullable(),
}).strict();

// Detail projection — drops source/remote/posted_at/reviewed_at (unrendered).
// reject_reason kept (reviewer sees why a job was rejected).
export const JobDetail = z.object({
  id: z.string(), company: z.string(), title: z.string(), location: z.string().nullable(),
  url: z.string().nullable(), status: JobStatus, score: z.number().nullable(),
  score_breakdown: ScoreBreakdown.nullable(), company_flags: z.array(CompanyFlag),
  label: z.enum(['good', 'bad']).nullable(), reject_reason: z.string().nullable(),
  parsed: z.unknown().nullable(),   // JdSchema-shaped (§5)
  jd_text: z.string().nullable(), overlay: Overlay.nullable(), audit: Audit.nullable(),
  cover_letter: z.string().nullable(),
}).strict();
```

### 7.2 status lifecycle

KEEP (`001_init.sql:2-4`, text not enum so it grows): `new → parsing → scored →
in_review → approved → applying → applied → responded | rejected | skipped |
error`. `applying/applied/responded` are **Phase-4 placeholders** (designed now,
written by the apply agent later). Reviewer transitions KEEP: `approve` requires
`in_review`→`approved` else 409 (`server.js:69-74`); `reject`→`rejected` from any
state (`server.js:77-83`).

### 7.3 `events`, `answers`, `resume_versions`, `config`

- `events` (KEEP, `001_init.sql:31-45`) — §9.
- `answers` (KEEP, `002:10-16`; seed `003`): `{id, key UNIQUE, question, answer,
  updated_at}`. `Answer = z.object({ key, question, answer }).strict()`.
- `resume_versions` (KEEP, `004`): latest row = canonical; every save = new row.
- **`config` (ADD, migration `005`):** `{ ns text PRIMARY KEY, value jsonb NOT
  NULL, updated_at timestamptz }`. One row per §6 namespace, jsonb validated by
  the matching Zod on write.

**Producers:** `discovery` (jobs insert, §10), `pipeline` (jobs update + events),
`api` (jobs/answers/resume/config writes). **Consumers:** `api` projections,
dashboard, `pipeline`/scheduler config reads.

**Must-preserve invariants:** `jobs_dedupe_key` UNIQUE index (`001:28`);
`resume_versions` latest-row-is-current + nothing-lost (`004` comment); answers
seed `ON CONFLICT DO NOTHING` (never clobber reviewer edits, `003:23`).

---

## 8. API surface — consumer-verified, single `overlayProblems`, config CRUD

**Verdict: KEEP core routes; DROP/mark dead ones; ADD config CRUD; unify
`overlayProblems`.**

### 8.1 The one `overlayProblems`

**Verdict: REDESIGN** — v1 has **two diverged copies**: `server.js:28-39` (Ajv +
`jsonpatch.validate` against `currentResume().data` + `personalInfo` required) and
`tailor.js:153-166` (Ajv + `jsonpatch.validate` against `getResume()` +
`personalInfo` required). Both must read **the same current-résumé source**. v2:
one `overlayProblems(overlay, resumeDoc)` in `@contracts/api.ts`, imported by both
the API and the pipeline; the caller passes the current résumé (API: latest
`resume_versions`; pipeline: `refreshResume()` result — the same DB row).

```ts
// api.ts
import { Overlay } from './overlay';
import jsonpatch from 'fast-json-patch';
export function overlayProblems(overlay, resumeDoc) {
  const problems = [];
  const parsed = Overlay.safeParse(overlay);
  if (!parsed.success) problems.push(...parsed.error.issues.map((i) => `${i.path.join('/')} ${i.message}`));
  const err = jsonpatch.validate(overlay?.patches ?? [], resumeDoc);
  if (err) problems.push(`patch #${err.index} ${err.name} at ${err.operation?.path}`);
  if (overlay?.profile && !overlay.profile.sections?.includes('personalInfo'))
    problems.push('profile.sections must include personalInfo');   // the ONE personalInfo rule
  return problems;   // [] = valid
}
```

### 8.2 Route table (verdicts)

| Method · Path | Verdict | Notes |
|---|---|---|
| `GET /api/jobs?status=` | KEEP | returns `JobListItem[]` (§7) ordered `score DESC NULLS LAST` |
| `GET /api/jobs/:id` | KEEP | returns `JobDetail` (§7, PII-minimized) — drops `source/remote/posted_at/reviewed_at` from `JOB_FIELDS` |
| `GET /applications/:id/overlay.json` | **REDESIGN** | KEEP as data source for the **bare print path** (replaces the v1 iframe — DECISIONS req 3) |
| `POST /api/jobs/:id/approve` | KEEP | 409 unless `in_review` |
| `POST /api/jobs/:id/reject` | KEEP | sets `reject_reason` |
| `POST /api/jobs/:id/label` | KEEP | `good\|bad\|null`; 400 otherwise |
| `PUT /api/jobs/:id/overlay` | KEEP | validates via the **one** `overlayProblems`; 400 on problems or `jobId≠:id` |
| `GET /api/resume` | KEEP | latest `resume_versions` (seeds if empty) |
| `PUT /api/resume` | REDESIGN | validate against §2 `ResumeDoc` (was a 2-field structural check, `server.js:127`) |
| `GET /api/resume/history` | **DROP→ops-only** | no frontend consumer in v1 (brief). Keep behind an ops flag or drop |
| `POST /api/resume/restore/:id` | **DROP→ops-only** | same — no v1 consumer |
| `GET/PUT/POST/DELETE /api/answers[...]` | KEEP | answers bank CRUD (`server.js:151-181`) |
| `GET /healthz` | KEEP | liveness |
| `GET /api/config/:ns`, `PUT /api/config/:ns` | **ADD** | §6 config CRUD; validates body against the `:ns` Zod; never touches secrets |
| `GET /api/events?…`, `GET /api/dashboard/summary` | **ADD** | §9 ledger read |

**Static hosting (REDESIGN, DECISIONS req 2):** v1 serves two builds (`/resume/`
renderer, `/` review SPA, `server.js:188-189`). v2 serves **one** unified
dashboard SPA at `/` with client-side routes (`/dashboard /review /resume
/scrawling /llm /preferences /constraints /answers`), plus a **bare résumé render
path** (no chrome) for print/PDF/preview. `/api/*` + the print path are exempt
from SPA fallback.

**Producers/consumers:** `api` serves; dashboard + `renderer` (print path) +
`pipeline` (overlayProblems) consume.

**Must-preserve invariants:** PII stays behind the NPM access list (no host ports,
operations.md:205); `personalInfo`-required is the one rule (§8.1); approve gated
on `in_review`.

---

## 9. `events` / cost ledger + dashboard read API

**Verdict: KEEP table; ADD read API + dashboard surface (unconsumed in v1).**

The `events` table exists and is written by every stage but **nothing reads it
back** in v1 (DECISIONS req 2: "`/dashboard` surfaces the `events`/cost ledger
(unconsumed in v1)"). v2 adds the read side.

```ts
// events.ts
import { z } from 'zod';
export const EventStage = z.enum(['discover', 'parse_jd', 'score', 'tailor', 'verify_claims', 'notify']);
export const EventRow = z.object({                 // 001_init.sql:31-45 (KEEP shape)
  id: z.number(), job_id: z.string().nullable(), stage: EventStage,
  model: z.string().nullable(), input_tokens: z.number().nullable(), output_tokens: z.number().nullable(),
  cost_usd: z.number().nullable(), duration_ms: z.number().nullable(), ok: z.boolean(),
  detail: z.unknown().nullable(), created_at: z.string(),
}).strict();

// Dashboard read DTO (GET /api/dashboard/summary)
export const DashboardSummary = z.object({
  costByStage: z.array(z.object({ stage: EventStage, costUsd: z.number(), calls: z.number() })),
  costByModel: z.array(z.object({ model: z.string(), costUsd: z.number() })),
  totalsByDay: z.array(z.object({ day: z.string(), costUsd: z.number() })),
  funnel: z.array(z.object({ status: z.string(), count: z.number() })),  // jobs per status
  failures: z.array(z.object({ stage: EventStage, count: z.number() })), // ok=false rollup
}).strict();
```

**Pricing (KEEP, `llm.js:12-28`):** haiku `{in:1,out:5}`, sonnet `{in:3,out:15}`,
opus `{in:5,out:25}` $/MTok; cache-read 0.1× input, cache-write(5m) 1.25× input.
`costUsd(model, usage)` ports verbatim. The `logEvent` helper is **duplicated** in
`cycle.js:16` and `tailorJob.js:14` (and the Python `store.log_event`) — v2 folds
the Node copies into one `@contracts`-typed `logEvent`.

**Producers:** every pipeline stage + discovery. **Consumers:** `/dashboard`.
**Invariant:** `cost_usd` only computed when model+usage present (`llm.js:19`);
failed stages log `ok:false` with `detail.error`.

---

## 10. Discovery → jobs-row write contract

**Verdict: REDESIGN (typed/shared)** — v1's write is an untyped Python dict sliced
to 13 columns with `row = {c: record.get(c) for c in COLUMNS}` (`store.py:39`);
any normalizer key not in `COLUMNS` is **silently dropped** (brief: "kills silent
dict-slice drops"). v2 defines the row shape once (Zod in `@contracts/jobRow.ts`,
mirrored as a Python `TypedDict`/pydantic model generated from it or hand-kept in
lockstep) and validates each record before insert.

```ts
// jobRow.ts
import { z } from 'zod';
import { CompanyFlag } from './db';
export const DiscoveredJob = z.object({
  id: z.string(),                              // gh-<co>-<id> | lever-… | ashby-… | jobspy-<site>-<id>
  source: z.string(),                          // greenhouse|lever|ashby|jobspy:<site>|manual
  company: z.string(), title: z.string(),
  location: z.string().nullable(),
  remote: z.boolean().nullable(),
  url: z.string().nullable(),
  posted_at: z.string().nullable(),            // ISO date
  jd_text: z.string().nullable(),
  status: z.enum(['new', 'skipped']),          // discovery only ever writes these
  skip_reason: z.string().nullable(),          // 'title:<term>' | 'jd:<term>' | null
  company_flags: z.array(CompanyFlag),
  dedupe_key: z.string(),                       // norm(company)|norm(title)|norm(location)
}).strict();
```

This is exactly the 13 `store.COLUMNS` (`store.py:8-22`), now typed. Insert stays
`ON CONFLICT DO NOTHING` (`store.py:27`). The normalizers (`from_greenhouse/lever/
ashby`, `_row_to_record`) and `finalize` (which attaches `company_flags`,
`dedupe_key`, `status`, `skip_reason` — `normalize.py:102-113`) must produce
exactly `DiscoveredJob`; validation runs in `upsert` before the SQL.

**Dropped discovery config (verified dead, brief):**
- `searches.yml defaults.sites` — JobSpy reads `JOBSPY_SITES` env via `_sites()`
  (`jobspy_search.py:21`), the YAML list is never read. → §6 `DiscoveryConfig.sites`.
- `searches.yml searches[].keywords` — present on every search
  (`searches.yml`), never consumed by `run_searches` (`jobspy_search.py:48-93`). → DROP.
- `searches.yml locations` — listed (7 entries) but `location="United States"` is
  hard-coded (`jobspy_search.py:61`). → DROP (replaced by
  `DiscoveryConfig.jobspyDefaults.location`).

**Producers:** `discovery` (boards + jobspy). **Consumers:** `jobs` table; then
`pipeline`.

**Must-preserve invariants:** dedupe via `dedupe_key` UNIQUE; `is_internship`
whole-word match ("intern" ∉ "internal", `normalize.py:18-21`); JD/title exclude
whole-word ("EAR" ∉ "year", `normalize.py:32-39`); citizenship/clearance/ITAR JD
matches → `status='skipped'` with reason (the F-1 ingestion gate). **Never run
logged-in platform automation from the server** (JobSpy is public/unauthenticated;
jittered pacing intentional, `jobspy_search.py:92`).

---

## 11. Anti-fabrication invariants (verbatim, binding)

**Verdict: KEEP — reproduced verbatim from the brief; load-bearing; never weaken
without re-running `eval/run-verify-eval.js`.**

> **Anti-fabrication 3-layer chain:** generation constraint (master-bank-only,
> replace-only patches, required `groundedIn`) → numeric tripwire (+ unknown-id /
> empty-grounding auto-fail; **2019–2030 year exclusion**) → drop-policy
> (`audit.unsupported===[]` by construction at `in_review`; `patchIndex`
> renumbered after drop). Reviewer edits bypass (trusted).

> `keywordScore` **0.5 floor** on empty-JD term sets.

> **`treeToResume` slot-preservation** (no-op save reproduces source arrays
> positionally → existing overlay patch paths stay valid).

> **master-bank `id` immutability** (renaming orphans `groundedIn` refs silently).

> **Eval harnesses** (parse / verify / tailor) are the merge gate for any
> prompt-touching change; verify-eval fabrication false-negatives never tolerated.

Code anchors (v1, KEEP verbatim): generation constraint `tailor.js:66-97`
(master bank + patchable map, replace-only, ≤4 patches, `groundedIn` required);
numeric tripwire `verify.js:19-32` (years 2019–2030 ignored, `:29`); unknown-id /
no-grounding auto-fail `verify.js:61-65`; LLM skeptic uncertain→false
`verify.js:44-50`; drop policy `tailorJob.js:36-48` (`unsupported` rebuilt empty,
`patchIndex` renumbered `:45`); reviewer-edit bypass
`editorModel.js:94` (`audit:{claims:[],unsupported:[]}` — trusted).

**Master bank schema (KEEP, `master.schema.json`):** `{updatedAt?, bullets[]{id
(kebab, immutable), text, source? (JSON-Pointer), context?, tags[]?, metrics[]?}}`.
**DROP `metrics`** (brief): never read — the tripwire re-extracts numbers from
`text` (`verify.js:24`), not from `metrics`. Stays **file-based** (grounding
corpus, `profile.js:13`), not DB-backed; editing the résumé via the web does NOT
change the bank.

```ts
// master.ts
import { z } from 'zod';
export const MasterBullet = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),   // IMMUTABLE once referenced
  text: z.string().min(1),
  source: z.string().regex(/^(\/|$)/).optional(),
  context: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // metrics: DROPPED — tripwire re-extracts from `text`
}).strict();
export const MasterBank = z.object({ updatedAt: z.string().optional(), bullets: z.array(MasterBullet).min(1) }).strict();
```

> **groundedIn ref format — flagged for the integrator.** The schema/audit prose
> says refs are `master:<id>` (`master.schema.json:4`, `overlay.schema.json:92`
> description, data-contracts.md:139), but the **code uses bare `<id>`**: tailor's
> `groundedIn` is the raw bullet id (`tailor.js:84` example `"ambarella-inc-2"`),
> verify looks up `bulletById.get(id)` with no `master:` strip (`verify.js:54-56`).
> v2 must pick ONE. Recommendation: standardize on **bare `<id>`** (matches the
> working code; the `master:` prefix is doc-only drift). Encode in §4 `LlmPatch.
> groundedIn` / `AuditClaim.groundedIn` accordingly.

---

## 12. Data-migration plan (old shapes → new)

**Verdict: explicit one-time deliverable** (brief §coupled-reshape). Export the
live DB + file `master.json`, transform to the §2/§4/§11 shapes, seed the new DB.

### 12.1 Sources (old)
- `resume_versions` (DB, latest row = canonical) — old JSON-Resume+`x-` shape (§2).
- `jobs` (DB) — incl. `overlay` jsonb (old overlay shape, §4) + `parsed`/`audit`/
  `score_breakdown` (old untyped) per row.
- `answers` (DB) — `{key,question,answer}` (unchanged shape; KEEP as-is).
- `master.json` (file) — old master shape incl. `metrics` (§11).
- `searches.yml` / `companies.yml` (files) — seed §6 `DiscoveryConfig`.
- `deploy/.env` + compose `environment:` — seed §6 `LlmConfig`/`ScheduleConfig`
  defaults (models, threshold, batch, poll, TZ, cron, JOBSPY_SITES); secrets stay
  in env.

### 12.2 Steps

1. **Résumé reshape (the spine, §2 mapping table).** Take the latest
   `resume_versions.data`. Apply the old→new field map: strip `x-` prefixes
   (`x-time`→`time`, `x-info`→`info`, `x-courses`→`courses`, `x-footnote`→
   `footnote`, `x-links`→`links`, `x-tags`/`keywords`→`tags`, `x-location`→
   `location`, `x-authors`→`authors`, `x-venue`→`venue`, `x-status`→`status`,
   `x-qrcodes`→`qrcodes`); rename split discriminators (`x-section`→`track`,
   `x-type`→`kind` with `'competition'`→`kind:'competition'`); rename
   `basics.label`→`headline`, `projects.x-highlight`→`badge`; **drop** dead
   stdlib fields (`startDate/endDate/url/score`, education stdlib `courses[]`,
   `publisher`) and dead `x-*` (`work.x-highlight`, `volunteer.x-links/x-tags`,
   `projects.x-tags`, `publications.x-tags`). Validate with §2 `ResumeDoc`.
   Insert as `resume_versions` row `note:'migration v1→v2'`. **Capture a
   `render-check` baseline from v1 BEFORE, diff AFTER the renderer port — must be
   empty** (the byte-identical-DOM invariant).
2. **`master.json` reshape (§11).** Drop `metrics`; keep `id` (immutable),
   `text`, `source`, `context`, `tags`. Re-point `source` JSON-Pointers if any
   résumé array indices shifted (they don't, if §2 preserves array order/length —
   it does: only field renames, no row drops). Validate with `MasterBank`. Stays
   file-based.
3. **Overlay reshape (§4), per `jobs.overlay`.** Patch `path`s are JSON-Pointers
   into résumé arrays — since §2 preserves array indices (slot-preservation
   invariant), **paths stay valid unchanged**. Re-validate each overlay with the
   new `Overlay` Zod + `overlayProblems` against the migrated résumé. Drop any
   overlay that no longer validates (log it); the job can be re-tailored.
   `groundedIn` refs: normalize to bare `<id>` (§11 flag) if any used `master:`.
4. **`jobs` typed columns.** Re-validate `parsed` against `JdSchema`,
   `score_breakdown` against the new `ScoreBreakdown` (synthesize
   `constraintsFired` from the old freetext `structuralReasons` where possible;
   else leave `[]`), `audit` against `Audit`. Non-conforming → null the column
   and leave status for re-processing. KEEP all `jobs` rows + ids + dedupe keys.
5. **Config seeding (§6).** Create `config` table (`005`). Seed `discovery` from
   the two YAMLs (dropping dead `keywords`/`locations`/`defaults.sites`); seed
   `llm`/`schedule` from compose defaults + `.env` non-secrets; seed
   `constraints` with the three F-1 rules from §5.2's mapping; seed `preferences`
   empty (or one seed: "Summer 2027 robotics/embedded internships, F-1/CPT"
   lifted from `profile.js:51`). `answers` table already DB-backed — KEEP.
6. **Verify.** `pnpm validate` (new Zod-derived JSON Schemas) + `pnpm test`
   (adapter all-section guard §3) + the empty `render-check` DOM diff + a tailor/
   verify eval pass on a sample migrated job.

### 12.3 Ordering & safety
- One-way, run once, against an **export** of the live DB (never in place); the
  old stack is **stopped, not removed** at construction start (DECISIONS §strategy).
- Anything that fails validation is logged and quarantined, never silently
  dropped (the §10 anti-drop principle applies to migration too).

---

## Appendix — verdict roll-up

| § | Contract | Verdict |
|---|---|---|
| 1 | Section-key registry | REDESIGN (one list ← 6 copies) |
| 2 | Résumé document | REDESIGN (drop JSON-Resume + `x-`; fix pub links) |
| 3 | View-model contract | KEEP shape / REDESIGN guard (all sections) |
| 4 | Overlay | KEEP shape / REDESIGN encoding (op + filter split typed) |
| 5 | Pipeline LLM + two-list scoring + `score_breakdown` | KEEP Jd/Fit/Tailor/Verdict; REDESIGN scoring + breakdown |
| 6 | Config/settings layer | REDESIGN (new: DB-backed + Zod + CRUD + tabs) |
| 7 | DB schema | KEEP tables; REDESIGN projections; ADD `config` |
| 8 | API surface | KEEP core; DROP 2 ops-only; ADD config/dashboard; one `overlayProblems` |
| 9 | events / cost ledger | KEEP table; ADD read API |
| 10 | Discovery → jobs write | REDESIGN (typed/shared; kill dict-slice drops) |
| 11 | Anti-fabrication | KEEP (verbatim, binding) |
| 12 | Data migration | new deliverable |
