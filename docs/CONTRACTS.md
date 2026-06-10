# Contracts Specification — `@resume/contracts` package

**Status:** authoritative; every subsystem imports from this. Where the code and
`docs/agents/*.md` disagree, this doc follows the **code**.

## How to read this

- **Zod-first single source of truth.** Every shape below is a Zod schema in the
  `@contracts` package. JSON Schema (for Ajv/runtime validation: overlays edited
  in the API, master bank, résumé) is *emitted from Zod* via Zod-4 native
  `z.toJSONSchema()` at build — never hand-written. The renderer, API, pipeline,
  and the apply agent all import the Zod, never restate a shape.
- "Producers/consumers" name subsystems: `discovery`, `pipeline` (parse/score/
  tailor/verify/scheduler), `api`, `renderer` (résumé canvas + bare print path),
  `dashboard` (the merged routed SPA), `apply` (the local apply agent).

### `@contracts` package layout

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

One registry is the source for: the overlay `sections` enum, the
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

> **Note — the split discriminator.** The work/project split lives in the `track`
> and `kind` fields (§2). The `pick` predicates above are the *single* place the
> split lives — adapter, editor model, and tailor's `patchableMap` all consume
> `SECTION_REGISTRY`, so the split rule can never diverge across files.

**Producers:** none (static). **Consumers:** §2 résumé (`sectionOrder` validation),
§3 view-model guard, §4 overlay sections enum, §5 `TailorSchema`, renderer
`sectionsConfig`/`componentRegistry`, dashboard editor tree.

**Invariant:** the **nine keys and their order semantics are the
frozen renderer surface** — adding/removing a key is a renderer-DOM change gated
by the `render-check` skill (empty DOM diff).

---

## 2. Résumé document

The résumé schema is a single Zod schema with un-prefixed fields; `pnpm validate`
validates against it.

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
  headline: z.string().optional(),            // scoring-only, not rendered
  email: z.string(),
  phone: z.string().optional(),
  location: z.object({ city: z.string().optional(), region: z.string().optional(), countryCode: z.string().optional() }).optional(),
  profiles: z.array(z.object({ network: z.string(), username: z.string().optional(), url: z.string() })).default([]),
  qrcodes: z.array(z.object({ label: z.string(), src: z.string() })).default([]),
}).strict();

export const Education = z.object({
  institution: z.string().min(1),
  area: z.string().optional(),                // scoring-only (fit text)
  studyType: z.string().optional(),           // scoring-only
  time,
  info: z.array(Tuple2),                       // required
  courses: z.array(Tuple2).optional(),         // graded rows
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
  badge: z.string().optional(),                // e.g. "Patent"
  links: z.array(Link).optional(),
  tags: z.array(z.string()).optional(),
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
  links: z.array(Link).optional(),             // emitted by the adapter (§3)
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

### 2.3 `meta.print` (validated)

`meta.print` is validated via Zod.

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
`getPrint`/`pageCss`/`pdfOptions` consumers: renderer `usePageStyle` (@page) + the
bare print path + the Playwright PDF job.

**Producers:** `api` (`PUT /api/resume`), dashboard résumé editor, `pnpm
export-seed`. **Consumers:** `renderer` (adapter input + print), `pipeline`
(scoring/tailoring source).

**Invariants:**
- **Renderer DOM byte-identical:** the adapter's *output* view-models are the
  frozen surface. This schema must produce an **empty `render-check` DOM diff**.
- **`treeToResume` slot-preservation:** a no-op save reproduces source arrays
  positionally → existing overlay patch paths stay valid.
- **`!`-author marker preserved verbatim** into the view model.

---

## 3. View-model contract — the frozen renderer surface

The emitted keys are the byte-identical DOM surface; the no-extra-keys /
no-`undefined` guard covers **all** sections. A stray key on any section would
leak into the DOM (components spread `{...item}`).

```ts
// viewModel.ts
import { z } from 'zod';

const Tuple2 = z.tuple([z.string(), z.string()]);

// EXACT keys the experience components spread (the components destructure
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
  link: z.array(z.object({ text: z.string(), url: z.string() })).optional(),   // emitted (§2)
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

> **`PublicationVM.link`:** the renderer already renders it (`link = []`
> default), so emitting it from real data is additive — and since today's
> `resume.json` has **no** publication links, the produced DOM for the current
> seed is **unchanged** (the render-check stays empty). New publication links
> will render going forward.

**Producers:** `renderer` `buildViewModels(resume)`. **Consumers:** renderer
components (spread onto DOM), `buildProfileFrom`, dashboard editor tree.

**Invariant:** the no-extra-keys / no-`undefined` guard covers **all** sections
— DOM-leak protection. Components spread items onto DOM elements, so any extra
key leaks into the DOM as an attribute.

---

## 4. Application overlay

The overlay encodes the op-restriction and the reviewer-vs-LLM filter split *in
the types*, and validates `profile.filters` keys against §1. The shape is
`{jobId, profile{name?,description?,sections[], filters?}, patches[],
coverLetter?, audit?}`. Two type-level rules are encoded: (a) **LLM-authored**
patches are `replace`-only (the `TailorSchema` enforces `z.enum(['replace'])`);
(b) `filters` mixes LLM filters (`tagsAnyOf/titleIn/limit`) with reviewer filters
(`exclude/order`) — only the reviewer (editor) may emit `exclude`/`order`, and
only the LLM emits `tagsAnyOf`/`titleIn`/`limit`. Both are encoded.

```ts
// overlay.ts
import { z } from 'zod';
import { SectionKey } from './sections';

// JSON-Pointer subset used by patches/from (pattern ^(/|$))
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
// order tagsAnyOf→titleIn→exclude→order→limit). The split is
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
// whole-array highlight patches.
export const Patch = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),  // schema breadth
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

**Filter application order:** `tagsAnyOf → titleIn →
exclude → order → limit`; items keyed by `title`.

**Producers:** `pipeline` tailor (`toOverlay`, LLM filters + replace patches),
dashboard overlay editor (`editorTreeToOverlay`, reviewer filters + replace
patches). **Consumers:** `renderer` `applyOverlay` (bare print path), `api` (`PUT
/api/jobs/:id/overlay` validation), dashboard `buildEditorModel`.

**Invariants:**
- **Op restriction in the type:** LLM patches are `replace`-only.
- **Reviewer/LLM filter split in the type:** `exclude`/`order` reviewer-only,
  `tagsAnyOf`/`titleIn`/`limit` LLM-only.
- **`audit.unsupported === []` at `in_review`** by construction (§11).
- **`personalInfo` must be in `profile.sections`** (one rule, §8).
- Overlay applies to a **deep clone**; never mutates the résumé.

---

## 5. Pipeline LLM schemas + two-list scoring + `score_breakdown`

### 5.1 Jd / Fit / Tailor / Verdict

```ts
// pipeline.ts
import { z } from 'zod';
import { SECTION_KEYS } from './sections';

export const JdSchema = z.object({
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

export const FitSchema = z.object({
  fit: z.number().min(0).max(1),
  rationale: z.string(),
  redFlags: z.array(z.string()),
});

export const TailorSchema = z.object({                       // sections enum from §1
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

export const VerdictSchema = z.object({
  verdicts: z.array(z.object({
    patchIndex: z.number().int(),
    supported: z.boolean(),
    reason: z.string(),
  })),
});
```

JD-truncation defaults live in `LlmConfig.jdTruncation` (§6): parse 24000, fit
6000, tailor 16000.

### 5.2 Two-list scoring — Constraints (hard) + Preferences (soft)

Two DB-backed, UI-editable lists drive scoring, with deterministic semantics for
hard constraints.

**Constraints (hard, deterministic).** Evaluated in code against `JdSchema`
structured fields — never sent to an LLM. Each constraint is a typed rule over a
parsed field; a `hard` constraint that fires forces `score = 0` (e.g. citizenship
→ hard 0). `penalty` constraints subtract from the structural component (e.g. a
complementary −0.6 seniority / −0.4 sponsorship).

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

The three seed F-1 Constraints:

| Rule | Constraint |
|---|---|
| `citizenshipOrClearanceRequired` → hard 0 | `field:'citizenshipOrClearanceRequired', test:{isTrue}, effect:{hard}` |
| seniority ∉ [intern,entry,unspecified] → −0.6 | `field:'seniority', test:{notIn:['intern','entry','unspecified']}, effect:{penalty:0.6}` |
| `sponsorshipAvailable==='no'` → −0.4 | `field:'sponsorshipAvailable', test:{equals:'no'}, effect:{penalty:0.4}` |

**Deterministic semantics:** `structuralScore` starts at 1, any fired `hard`
short-circuits to 0, penalties subtract and clamp at ≥0.

**Preferences (soft, priority 1–10).** Free-text considerations fed to the LLM
scorer as weighted text.

```ts
export const Preference = z.object({
  id: z.string(),
  text: z.string().min(1),           // "Prefers robotics/embedded autonomy roles"
  priority: z.number().int().min(1).max(10),   // 1 = mild, 10 = decisive
  enabled: z.boolean().default(true),
}).strict();
```

**priority→influence semantics (explicit).** Preferences do not alter the
deterministic structural score; they are injected into the `llmFit` system prompt
as a ranked, labeled block, and the prompt instructs the model to weight them by
priority. The mapping is fixed so the scorer behaves predictably:

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

`score_breakdown` is a typed Zod schema that records **which constraint/preference
moved the score**.

```ts
export const ScoreBreakdown = z.object({
  keyword: z.number(),                         // keywordScore.value (0.5 floor — §11)
  missingTerms: z.array(z.string()),           // top 12
  llmFit: z.number(),                          // FitSchema.fit
  rationale: z.string(),
  redFlags: z.array(z.string()),
  structural: z.number(),                      // post-constraint structural value
  // explicit attribution of what moved the score
  constraintsFired: z.array(z.object({
    id: z.string(),
    effect: z.enum(['hard', 'penalty']),
    amount: z.number().optional(),             // for penalties
  })),
  preferencesApplied: z.array(z.object({ id: z.string(), priority: z.number().int() })),
  weights: z.object({ keyword: z.number(), llmFit: z.number(), structural: z.number() }),
}).strict();
```

Score formula (weights configurable via §6):
`score = w.keyword·keyword + w.llmFit·llmFit + w.structural·structural`, 4-dp.

**Producers:** `pipeline` (`processJob` writes `parsed`, `score`, `score_breakdown`;
`tailorJob` writes overlay/audit). **Consumers:** `api` (`GET /api/jobs/:id`),
dashboard `/review` detail (renders breakdown), §9 dashboard.

**Invariants:**
- **`keywordScore` 0.5 floor on empty-JD term sets.**
- **Anti-fabrication chain at tailor/verify** — see §11.
- **Numeric tripwire ignores years 2019–2030.**

---

## 6. Config / settings layer — DB-backed, Zod-validated, CRUD'd, UI-mapped

Every non-secret config is a DB row, Zod-validated, exposed via CRUD, mapped to a
dashboard tab. Services read it at runtime via a best-effort pull. Only
`ANTHROPIC_API_KEY` (and the other secrets, §6.1) stay in compose/env.

### 6.1 Secrets boundary (stated, binding)

**Secrets stay in env/`.env`, never DB, never UI-editable:** `ANTHROPIC_API_KEY`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `POSTGRES_*`/`DATABASE_URL`, NPM access
list (`REVIEW_BASIC_AUTH`). Everything else moves to DB config. The config CRUD
API never reads or writes secrets; the dashboard has no field for them.

### 6.2 Storage shape

A single `config` table, one row per namespace, `value jsonb` validated by the
matching Zod schema on write (§7). A `getConfig(ns)` helper (best-effort, falls
back to schema defaults on DB failure) is read at the top of each pipeline cycle /
scheduler tick / API request.

```ts
// config.ts
import { z } from 'zod';
import { Constraint, Preference } from './scoring';

// --- LLM (per-stage model + tuning) ---
export const LlmConfig = z.object({
  models: z.object({
    parse:       z.string().default('claude-haiku-4-5'),
    fit:         z.string().default('claude-haiku-4-5'),
    tailor:      z.string().default('claude-sonnet-4-6'),
    tailorDream: z.string().default('claude-opus-4-8'),
    verify:      z.string().default('claude-haiku-4-5'),
  }).default({}),
  scoreThreshold: z.number().min(0).max(1).default(0.65),
  weights: z.object({ keyword: z.number(), llmFit: z.number(), structural: z.number() })
            .default({ keyword: 0.5, llmFit: 0.3, structural: 0.2 }),
  batchSize: z.number().int().min(1).default(10),
  pollIntervalMs: z.number().int().min(1000).default(60000),
  jdTruncation: z.object({ parse: z.number().default(24000), fit: z.number().default(6000), tailor: z.number().default(16000) }).default({}),
}).strict();

// --- Scheduler (in-process, DB-driven) ---
export const ScheduleConfig = z.object({
  discovery: z.object({
    enabled: z.boolean().default(true),
    // cron expression evaluated in `tz`; the in-process scheduler reads this each
    // tick so a UI edit takes effect next tick with NO restart.
    cron: z.string().default('0 9 * * *'),
    tz: z.string().default('Asia/Taipei'),
    mode: z.enum(['boards', 'jobspy', 'all']).default('all'),
  }).default({}),
  // poll loop cadence already in LlmConfig.pollIntervalMs; scheduler also owns it.
}).strict();

// --- Discovery searches + companies ---
export const DiscoverySearch = z.object({
  name: z.string(),
  term: z.string(),
  enabled: z.boolean().default(true),
  // JobSpy site list comes from `sites` (DiscoveryConfig).
}).strict();

export const DiscoveryCompany = z.object({
  name: z.string(),
  flags: z.array(z.enum(['dream', 'startup', 'return-path'])).default([]),
  board: z.object({ provider: z.enum(['greenhouse', 'lever', 'ashby']), slug: z.string() }).nullable(),
  enabled: z.boolean().default(true),
}).strict();

export const DiscoveryConfig = z.object({
  sites: z.array(z.enum(['indeed', 'linkedin'])).default(['indeed']),
  jobspyDefaults: z.object({
    resultsWanted: z.number().int().default(25), hoursOld: z.number().int().default(72),
    jobType: z.string().default('internship'), country: z.string().default('USA'),
    location: z.string().default('United States'),
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

| Config namespace | Zod | UI tab | Read by |
|---|---|---|---|
| `llm` | `LlmConfig` | `/llm` | pipeline (every cycle: models, threshold, weights, batch, poll, truncation) |
| `schedule` | `ScheduleConfig` | `/scrawling` | in-process scheduler (every tick) |
| `discovery` | `DiscoveryConfig` | `/scrawling` | discovery service (each run) |
| `constraints` | `ConstraintsConfig` | `/constraints` | pipeline `structuralScore` (each job) |
| `preferences` | `PreferencesConfig` | `/preferences` | pipeline `llmFit` prompt builder (each job) |
| `answers` (table, §7) | `Answer` | `/answers` | reviewer / apply agent |

**Producers:** dashboard config tabs via §8 CRUD. **Consumers:** every service,
read at runtime via best-effort `getConfig(ns)` with schema-default fallback.

**Invariant:** **scheduler edits take effect next tick, no restart**; config reads
are **best-effort** (DB hiccup → last-good/defaults, never crash).

---

## 7. DB schema — PII-minimized projections + lifecycle

The `jobs`/`events`/`answers`/`resume_versions` core tables plus a `config` table;
PII-minimized read projections.

### 7.1 `jobs` (PII-minimized read projections)

Columns come from `migrations/001_init.sql` and `002_overlay_and_labels.sql`. The
read **projection** layer defines two typed projections in `db.ts` that omit
`source, remote, posted_at, reviewed_at` (the SPA never renders them):

```ts
// db.ts
import { z } from 'zod';
import { ScoreBreakdown } from './pipeline';
import { Overlay, Audit } from './overlay';

export const JobStatus = z.enum([
  'new', 'parsing', 'scored', 'in_review', 'approved',
  'applying', 'applied', 'responded',          // written by the apply agent
  'rejected', 'skipped', 'error',
]);
export const CompanyFlag = z.enum(['dream', 'startup', 'return-path']);

// Inbox list projection — the ONLY columns /api/jobs (list) returns
export const JobListItem = z.object({
  id: z.string(), company: z.string(), title: z.string(),
  location: z.string().nullable(), score: z.number().nullable(),
  status: JobStatus, company_flags: z.array(CompanyFlag), label: z.enum(['good', 'bad']).nullable(),
}).strict();

// Detail projection — returns these columns; reject_reason kept (reviewer sees
// why a job was rejected).
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

`status` is text (not an enum) so it grows: `new → parsing → scored → in_review →
approved → applying → applied → responded | rejected | skipped | error`.
`applying/applied/responded` are written by the apply agent. Reviewer
transitions: `approve` requires `in_review`→`approved` else 409;
`reject`→`rejected` from any state.

### 7.3 `events`, `answers`, `resume_versions`, `config`

- `events` (`001_init.sql`) — §9.
- `answers` (`002`; seed `003`): `{id, key UNIQUE, question, answer,
  updated_at}`. `Answer = z.object({ key, question, answer }).strict()`.
- `resume_versions` (`004`): latest row = canonical; every save = new row.
- **`config` (migration `005`):** `{ ns text PRIMARY KEY, value jsonb NOT
  NULL, updated_at timestamptz }`. One row per §6 namespace, jsonb validated by
  the matching Zod on write.

**Producers:** `discovery` (jobs insert, §10), `pipeline` (jobs update + events),
`api` (jobs/answers/resume/config writes). **Consumers:** `api` projections,
dashboard, `pipeline`/scheduler config reads.

**Invariants:** `jobs_dedupe_key` UNIQUE index (`001`); `resume_versions`
latest-row-is-current + nothing-lost (`004`); answers seed `ON CONFLICT DO
NOTHING` (never clobber reviewer edits, `003`).

---

## 8. API surface — consumer-verified, single `overlayProblems`, config CRUD

### 8.1 The one `overlayProblems`

There is one `overlayProblems(overlay, resumeDoc)` in `@contracts/api.ts`,
imported by both the API and the pipeline; the caller passes the current résumé
(API: latest `resume_versions`; pipeline: the refreshed-résumé result — the same
DB row). Both read **the same current-résumé source**.

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

### 8.2 Route table

| Method · Path | Notes |
|---|---|
| `GET /api/jobs?status=` | returns `JobListItem[]` (§7) ordered `score DESC NULLS LAST` |
| `GET /api/jobs/:id` | returns `JobDetail` (§7, PII-minimized) |
| `GET /applications/:id/overlay.json` | data source for the **bare print path** |
| `POST /api/jobs/:id/approve` | 409 unless `in_review` |
| `POST /api/jobs/:id/reject` | sets `reject_reason` |
| `POST /api/jobs/:id/label` | `good\|bad\|null`; 400 otherwise |
| `PUT /api/jobs/:id/overlay` | validates via the **one** `overlayProblems`; 400 on problems or `jobId≠:id` |
| `GET /api/resume` | latest `resume_versions` (seeds if empty) |
| `PUT /api/resume` | validate against §2 `ResumeDoc` |
| `GET /api/resume/history` | ops-only |
| `POST /api/resume/restore/:id` | ops-only |
| `GET/PUT/POST/DELETE /api/answers[...]` | answers bank CRUD |
| `GET /healthz` | liveness |
| `GET /api/config/:ns`, `PUT /api/config/:ns` | §6 config CRUD; validates body against the `:ns` Zod; never touches secrets |
| `GET /api/events?…`, `GET /api/dashboard/summary` | §9 ledger read |

**Static hosting:** one unified dashboard SPA at `/` with client-side routes
(`/dashboard /review /resume /scrawling /llm /preferences /constraints /answers`),
plus a **bare résumé render path** (no chrome) for print/PDF/preview. `/api/*` +
the print path are exempt from SPA fallback.

**Producers/consumers:** `api` serves; dashboard + `renderer` (print path) +
`pipeline` (overlayProblems) consume.

**Invariants:** PII stays behind the NPM access list (no host ports);
`personalInfo`-required is the one rule (§8.1); approve gated on `in_review`.

---

## 9. `events` / cost ledger + dashboard read API

The `events` table is written by every stage and read back by
`/api/dashboard/summary` + `/api/events`, surfaced on `/dashboard`.

```ts
// events.ts
import { z } from 'zod';
export const EventStage = z.enum(['discover', 'parse_jd', 'score', 'tailor', 'verify_claims', 'notify']);
export const EventRow = z.object({                 // 001_init.sql
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

**Pricing:** haiku `{in:1,out:5}`, sonnet `{in:3,out:15}`, opus `{in:5,out:25}`
$/MTok; cache-read 0.1× input, cache-write(5m) 1.25× input. `costUsd(model,
usage)` computes per-call cost. Every stage logs one `events` row via a single
`@contracts`-typed `logEvent` (the Python side has `store.log_event`).

**Producers:** every pipeline stage + discovery. **Consumers:** `/dashboard`.
**Invariant:** `cost_usd` only computed when model+usage present; failed stages
log `ok:false` with `detail.error`.

---

## 10. Discovery → jobs-row write contract

The row shape is defined once (Zod in `@contracts/jobRow.ts`, mirrored as a Python
`TypedDict`/pydantic model generated from it or hand-kept in lockstep) and each
record is validated before insert.

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

This is exactly the 13 `store.COLUMNS`, typed. Insert stays `ON CONFLICT DO
NOTHING`. The normalizers (`from_greenhouse/lever/ashby`, `_row_to_record`) and
`finalize` (which attaches `company_flags`, `dedupe_key`, `status`, `skip_reason`)
must produce exactly `DiscoveredJob`; validation runs in `upsert` before the SQL.

**Producers:** `discovery` (boards + jobspy). **Consumers:** `jobs` table; then
`pipeline`.

**Invariants:** dedupe via `dedupe_key` UNIQUE; `is_internship` whole-word match
("intern" ∉ "internal"); JD/title exclude whole-word ("EAR" ∉ "year");
citizenship/clearance/ITAR JD matches → `status='skipped'` with reason (the F-1
ingestion gate). **Never run logged-in platform automation from the server**
(JobSpy is public/unauthenticated; jittered pacing intentional).

---

## 11. Anti-fabrication invariants (binding)

Load-bearing; never weaken without re-running `eval:verify`.

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

Code anchors: generation constraint in `tailor.ts` (master bank + patchable map,
replace-only, ≤4 patches, `groundedIn` required); numeric tripwire in `verify.ts`
(years 2019–2030 ignored); unknown-id / no-grounding auto-fail in `verify.ts`; LLM
skeptic uncertain→false in `verify.ts`; drop policy in `tailorJob.ts`
(`unsupported` rebuilt empty, `patchIndex` renumbered); reviewer-edit bypass
(`audit:{claims:[],unsupported:[]}` — trusted).

**Master bank schema:** `{updatedAt?, bullets[]{id (kebab, immutable), text,
source? (JSON-Pointer), context?, tags[]?}}`. There is no `metrics` field — the
tripwire re-extracts numbers from `text`, not from `metrics`. The bank stays
**file-based** (grounding corpus), not DB-backed; editing the résumé via the web
does NOT change the bank.

```ts
// master.ts
import { z } from 'zod';
export const MasterBullet = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),   // IMMUTABLE once referenced
  text: z.string().min(1),
  source: z.string().regex(/^(\/|$)/).optional(),
  context: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // no metrics field — tripwire re-extracts from `text`
}).strict();
export const MasterBank = z.object({ updatedAt: z.string().optional(), bullets: z.array(MasterBullet).min(1) }).strict();
```

> **groundedIn ref format.** `groundedIn` refs are bare `<id>`: tailor's
> `groundedIn` is the raw bullet id (e.g. `"ambarella-inc-2"`), and verify looks
> up `bulletById.get(id)` with no prefix strip. Encoded in §4 `LlmPatch.
> groundedIn` / `AuditClaim.groundedIn`.

---

## 13. UI: preview protocol + validated inputs

Full-width editors + a toggleable paper-accurate preview modal that renders
UNSAVED edits, and constrained/validated config inputs. **All additive — no
existing shape changed.** Frontend wiring: `docs/agents/frontend.md`.

### 13.1 Preview postMessage protocol (`preview.ts`)
Typed channel between the dashboard (parent) and the bare-host iframe (child) that
renders the editor's current, possibly UNSAVED, doc/overlay (no auto-save). Both ends
enforce same-origin + the `source` tag. It carries `ResumeDoc`/`Overlay`, so it lives in
contracts (never restated).
```ts
export const PREVIEW_MESSAGE_SOURCE = 'resume-preview' as const;
export type PreviewLayout = 'multipage' | 'continuous';
export type PreviewMessage =
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'ready' }                      // child→parent
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'resume'; doc: ResumeDoc }     // parent→child
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'overlay'; overlay: Overlay }  // parent→child
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'mode'; layout: PreviewLayout };
```
Producers/consumers: `PreviewModal` posts `resume`/`overlay`/`mode`; the bare host
(`PreviewRoot` + the pure, node-tested `reduceMessage`) posts `ready` and applies via
`resumePayload`/`applicationPayload`. OFF by default — only active under `?preview=…`
(byte-identical default render preserved; render-check-gated).

### 13.2 `PAPER_DIMENSIONS` (`print.ts`) + `mmToPx` (`renderer/data/print.ts`)
Physical mm per `PAPER_SIZES` key — A4 210×297, Letter 215.9×279.4, Legal 215.9×355.6,
A3 297×420, A5 148×210 (portrait); `mmToPx(mm) = mm * 96 / 25.4`. Drive the on-screen
paper-accurate preview (`PaperFrame`); the real PDF still derives its dimensions from the
size NAME via the `@page` rule / Playwright `format`, so this is preview-only.

### 13.3 `KNOWN_MODELS` (`events.ts`) + `JobType` (`config.ts`)
`KNOWN_MODELS = Object.keys(PRICES)` — the selectable-model SSoT for the LlmPage model
dropdowns. **Deliberately NOT a Zod enum:** `LlmConfig.models.*` stays `z.string()` with
a `__custom__` UI escape hatch, so a brand-new model ID is selectable before a contracts
rebuild. `JobType = z.enum(['fulltime','parttime','internship','contract'])` tightens
`DiscoveryConfig.jobspyDefaults.jobType` so the UI offers a dropdown and a bad value is
rejected at the write boundary; the Python discovery mirror passes the value straight
through and the default (`'internship'`) is unchanged — no Python change.

---

## Appendix — contents

| § | Contract |
|---|---|
| 1 | Section-key registry |
| 2 | Résumé document |
| 3 | View-model contract |
| 4 | Overlay |
| 5 | Pipeline LLM + two-list scoring + `score_breakdown` |
| 6 | Config/settings layer |
| 7 | DB schema |
| 8 | API surface |
| 9 | events / cost ledger |
| 10 | Discovery → jobs write |
| 11 | Anti-fabrication |
| 13 | UI: preview protocol + validated inputs |
