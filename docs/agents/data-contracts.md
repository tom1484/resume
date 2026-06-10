# Data contracts — index

## Scope
There is ONE authoritative shape spec: **`docs/CONTRACTS.md`**. It is the §1–§12
Zod reference, kept accurate against the code. This file is a **short index** — what
lives where, plus the binding invariants — so you know what to open. **Do not
restate shapes here; read `docs/CONTRACTS.md` and the code.**

## Read this when
You touch any shape: a résumé field, the overlay, a view-model key, a pipeline LLM
schema, the two-list scoring types, a config namespace, a DB column/projection, the
events ledger, or the discovery→jobs write contract.

## The one rule for changing a shape
Edit the Zod in `packages/contracts/src/<file>.ts` (ONE place) → `pnpm
contracts:build` (tsc + `gen:schemas` re-emits `dist/schemas/*.json`) → `pnpm
validate` + `pnpm test`. Consumers import from `@resume/contracts`; never restate a
shape, never hand-write a JSON Schema. If the shape is read by the Python discovery
service, also update its hand-kept mirror (`config.py` / `jobrow.py`) in lockstep.

## Where each contract lives (`packages/contracts/src/`)

| File | CONTRACTS.md § | Exports (the shapes) |
|---|---|---|
| `sections.ts` | §1 | `SECTION_REGISTRY` (THE 9-key list), `SECTION_KEYS`, `SectionKey` (the one enum), `EDITABLE_SECTION_KEYS`, `sectionMeta` |
| `resume.ts` | §2 | `ResumeDoc` (+ `Basics/Education/Work/Project/Volunteer/Publication/SkillGroup/ResumeMeta`) — **un-prefixed fields** |
| `print.ts` | §2.3 | `PrintConfig`, `PAPER_SIZES`, `PAPER_DIMENSIONS` (mm per size — drives the on-screen paper-accurate preview) |
| `preview.ts` | §8a | `PreviewMessage` (dashboard↔bare-host postMessage union), `PREVIEW_MESSAGE_SOURCE`, `PreviewLayout` |
| `viewModel.ts` | §3 | `ViewModels` + per-section VMs; the no-extra-keys / no-`undefined` guard (`guarded`) over ALL sections |
| `overlay.ts` | §4 | `Overlay`, `OverlayFilter` (`ReviewerFilter`∪`LlmFilter`), `LlmPatch`, `Patch`, `Audit`, `AuditClaim` |
| `master.ts` | §11 | `MasterBank`, `MasterBullet` (id immutable; `metrics` dropped) |
| `pipeline.ts` | §5.1/5.3 | `JdSchema`, `FitSchema`, `TailorSchema`, `VerdictSchema`, `ScoreBreakdown` |
| `scoring.ts` | §5.2 | `Constraint` (+`ConstraintField`), `Preference` — the two-list types |
| `config.ts` | §6 | `LlmConfig`, `ScheduleConfig`, `DiscoveryConfig` (+`DiscoverySearch`/`DiscoveryCompany`), `ConstraintsConfig`, `PreferencesConfig`, `JobType` (enum; `jobspyDefaults.jobType`); `CONFIG_NAMESPACES`, `parseConfig`, `configDefault` |
| `db.ts` | §7 | `JobStatus`, `CompanyFlag`, `JobListItem`, `JobDetail`, `Answer` (PII-minimized projections) |
| `api.ts` | §8 | the ONE `overlayProblems(overlay, resumeDoc)` |
| `events.ts` | §9 | `EventStage`, `EventRow`, `DashboardSummary`, `PRICES`, `KNOWN_MODELS` (= `PRICES` keys; the model-dropdown SSoT), `costUsd`, `logEventRow` |
| `jobRow.ts` | §10 | `DiscoveredJob` (discovery→jobs write contract) |
| `antifab.ts` | §11 | `MAX_TAILOR_PATCHES`, `extractTripwireNumbers`, `isStructurallyGrounded`, `KEYWORD_SCORE_FLOOR`, `isExcludedYear` |
| `schemas.ts` | §0 | `JSON_SCHEMA_TARGETS` (resume/overlay/master), `toJsonSchema`, `allJsonSchemas` — Zod-4 native `z.toJSONSchema({io:'input'})` |
| `index.ts` | — | barrel re-export of all of the above |

JSON Schemas are emitted to `packages/contracts/dist/schemas/{resume,overlay,
master}.json` by `gen:schemas` (`src/scripts/gen-schemas.ts`), consumed by
`scripts/validate.mjs` (`pnpm validate`) via `@resume/contracts/schemas/<name>.json`.

## Key invariants (binding — full detail in `docs/CONTRACTS.md`)

- **One section registry** (§1): `SECTION_REGISTRY` derives the overlay enum, the
  `TailorSchema` sections enum, the editor tree, the renderer `sectionsConfig`, and
  `sectionOrder` validation. The work/projects split (`track`/`kind`) lives ONLY in
  its `pick` predicates — never restated in adapter/editor/tailor. The 9 keys are
  the frozen renderer surface (adding/removing one is a `render-check`-gated DOM
  change).
- **Un-prefixed résumé fields** (§2): `time, info, courses, footnote, links,
  tags, track, kind, badge, location, authors, venue, status, qrcodes, headline` —
  NO `x-`. `ResumeDoc` is the single Zod-derived schema `pnpm validate` checks.
  Publications `links` are emitted by the adapter.
- **View-model guard over ALL sections** (§3): `ViewModels` is `.strict()` (no extra
  keys) + a custom `rejectUndefinedValues` refinement (no literal `undefined`
  values) — because components spread `{...item}` onto DOM nodes. `adapter.test.ts`
  asserts `ViewModels.parse(buildViewModels(seed))` doesn't throw.
- **One `overlayProblems`** (§8, `api.ts`): Zod `safeParse` + `fast-json-patch`
  validate against the SAME current-résumé source + the ONE personalInfo-required
  rule. Imported by both the API (`PUT /api/jobs/:id/overlay`) and the pipeline
  (`tailor.ts`).
- **Overlay encodes the op restriction + filter split in the types** (§4):
  `LlmPatch` is `replace`-only; reviewer filters (`exclude`/`order`) vs LLM filters
  (`tagsAnyOf`/`titleIn`/`limit`) are split at the producer boundary. `groundedIn`
  refs are bare `<id>`. Overlay applies to a deep clone — never mutates the résumé.
- **Validate at the boundary** (§7/§9): the API `.parse()`s its own output
  (`DashboardSummary.parse`, `EventRow.array().parse` — the latter also coerces pg's
  numeric/bigint→string columns to real numbers so the `z.number()` contract holds);
  the pipeline `.parse()`s `ScoreBreakdown`; the migration validates each record.
- **DB tables** (§7, migrations `001`–`005` in `services/api/migrations/`): `jobs`
  (PK `id`, `jobs_dedupe_key` UNIQUE), `events` (cost ledger, `job_id` nullable),
  `answers` (`key` UNIQUE, seeded `ON CONFLICT DO NOTHING`), `resume_versions`
  (latest row = current, every save a new row), **`config`** (`ns text PK, value
  jsonb` — §6, migration `005`).
- **Status lifecycle** (§7.2, text not enum so it grows): `new → parsing → scored →
  in_review → approved → applying → applied → responded | rejected | skipped |
  error`. `applying/applied/responded` are Phase-4 placeholders (designed now,
  written by the apply agent later). Reviewer transitions: `approve` requires
  `in_review` (else 409); `reject` from any state.
- **Anti-fabrication** (§11) and **two-list scoring** (§5.2) — see
  [./pipeline.md](./pipeline.md).

Sibling docs: `../../CLAUDE.md` (always-on invariants), `./architecture.md`,
`./pipeline.md`, `./frontend.md`, `./operations.md`. Authoritative spec:
`../CONTRACTS.md`.
