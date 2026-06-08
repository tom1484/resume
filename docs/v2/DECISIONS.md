# v2 Rebuild — Decisions & Requirements (integrator brief)

**Date:** 2026-06-08 · **Branch/worktree:** `v2` (`/Users/tomchen/Git/resume-v2`)
**Source of truth for the audit:** the four interface audits run 2026-06-08
(frontend / pipeline / api / cross-cutting-contracts) + `docs/agents/*.md`
(treat docs/agents as a possibly-stale map of **v1**; verify against code).

This is the brief the contracts/design agent builds `docs/v2/CONTRACTS.md` from.

## Strategy
- **Clean reimplementation** that reuses v1 contracts **only after** a
  per-contract keep/drop/redesign decision (already audited).
- **Single source of truth** via a shared **`@contracts` package**, **Zod-first**:
  define each shape once in Zod, emit JSON Schema where Ajv/runtime validation is
  needed. Renderer, API, and pipeline all import from it — never restate a shape.
- **Renderer:** internals may change freely (kill the mutable `activeData`/
  `activeDoc` singleton → props/context; rename fields feeding the adapter), BUT
  the **rendered résumé DOM must stay byte-identical** — enforced by the
  `render-check` skill (empty DOM diff for the port). The adapter's *output*
  view-models are the frozen surface; its *input* shape changes.
- **Drop JSON Resume conformance.** The `x-*` fields were only added to match
  JSON Resume; we own the whole pipeline now, so redesign the résumé schema from
  scratch with the names we want, keeping only fields a real consumer uses. One
  Zod-derived schema replaces the dual upstream-JSON-Resume + extension schema;
  `pnpm validate` no longer checks the upstream schema.
- **Phase-4** (local apply agent) contracts are **designed now, implemented later.**
- **Sequencing:** the `@contracts` package is deliverable #0 (this doc →
  CONTRACTS.md), owned by the integrator. Construction agents start only after
  contracts are frozen. Build in the worktree; **stop (not remove)** the old
  deployed stack at construction start.

## New product requirements (v2)
1. **All non-secret config is DB-backed and UI-editable.** Secrets
   (`ANTHROPIC_API_KEY`, Telegram token, Postgres creds, NPM auth) stay in
   env/`.env`, never UI-editable. Everything else — models per stage, scoring
   weights/threshold, batch/poll, schedule, searches, companies, constraints,
   preferences, answers — becomes DB config + CRUD API + UI tab. Services read
   config at runtime (extend the v1 `refreshResume()` pattern to all config).
   (Fixes the v1 finding that `MODEL_*` aren't even passed through compose and a
   model change needs a code change + image rebuild.)
2. **Unified routed dashboard SPA.** Merge `apps/site` + `apps/review` into one
   app with real routing + sidebar/topbar tabs:
   `/dashboard /review /resume /scrawling /llm /preferences /constraints /answers`.
   `/dashboard` surfaces the `events`/cost ledger (unconsumed in v1).
3. **Print isolation:** a **bare résumé render path** (no app chrome) for browser
   print + the Playwright PDF job; it also serves as the review preview, letting
   us **drop the v1 iframe** (`/resume/?application=<id>`).
4. **UI framework: shadcn/ui (Radix + Tailwind)** for admin chrome — shares the
   Tailwind substrate, no global CSS reset to perturb the pixel-stable renderer.
   Résumé canvas stays bespoke Tailwind. (Ant Design rejected: global reset +
   design tokens fight Tailwind and risk the renderer layout.)
5. **Scoring model = two lists:**
   - **Constraints** (hard, deterministic): enforced against parsed-JD structured
     fields (citizenship/clearance, sponsorship, seniority). UI tab. e.g.
     "must accept F-1" → hard 0 when `citizenshipOrClearanceRequired`. Carries the
     v1 deterministic semantics (citizenship → hard 0; complementary penalties).
   - **Preferences** (soft, priority 1–10): fed to the LLM scorer as weighted
     considerations. UI tab. Retires the hard-coded F-1/CPT/"Summer 2027" string.
   - Define the **priority→influence semantics** explicitly.
   - `score_breakdown` records which constraints/preferences moved the score.
6. **Scheduling:** an **in-process DB-driven scheduler** (live; edit in UI →
   effect next tick, no restart). Discovery is invoked by it, replacing the
   baked-in supercronic cron.

## Must-preserve invariants (lift verbatim; binding)
- **Anti-fabrication 3-layer chain:** generation constraint (master-bank-only,
  replace-only patches, required `groundedIn`) → numeric tripwire (+ unknown-id /
  empty-grounding auto-fail; **2019–2030 year exclusion**) → drop-policy
  (`audit.unsupported===[]` by construction at `in_review`; `patchIndex`
  renumbered after drop). Reviewer edits bypass (trusted).
- `keywordScore` **0.5 floor** on empty-JD term sets.
- **`treeToResume` slot-preservation** (no-op save reproduces source arrays
  positionally → existing overlay patch paths stay valid).
- **master-bank `id` immutability** (renaming orphans `groundedIn` refs silently).
- **Eval harnesses** (parse / verify / tailor) are the merge gate for any
  prompt-touching change; verify-eval fabrication false-negatives never tolerated.

## Drop / fix list (verify truly unused by tracing consumers; or simply don't redefine)
- résumé fields with no live consumer: `work.x-highlight` (0 instances),
  `projects.x-tags` (adapter uses stdlib `keywords`), `volunteer.x-links`,
  `volunteer.x-tags`, `publications.x-tags`. **Fix** `publications.x-links`
  (schema + component render it, adapter never emits → emit it in v2).
- `master.json` `metrics` field (never read; tripwire re-extracts from `text`).
- discovery dead config: `searches.yml` `defaults.sites`, `searches[].keywords`,
  `locations` (env wins / location hard-coded "United States"). Replace with the
  DB-backed searches/companies config contract.
- API: `GET /api/resume/history` + `POST /api/resume/restore/:id` (no frontend
  consumer in v1 — keep as protected ops tooling or drop). `JOB_FIELDS`
  over-fetch (`source/remote/posted_at/reject_reason/reviewed_at` unrendered) →
  PII-minimized projections.
- `experienceConfigs`/`publicationsConfig` empty-object config system → keep only
  `projects.showTags` as a real renderer prop.
- **live bugs to fix:** `education.jsx` → `theme.components.education.tableCell`
  (undefined className); `image.jsx` → `theme.components.skills.icon` (missing).

## Single-source-of-truth targets (the `@contracts` package)
- **Section keys:** one registry → derives the overlay enum, editor sections,
  `sectionsConfig`, the TailorSchema enum, and `sectionOrder` validation (v1 had
  these in 6 places).
- **`overlayProblems`:** one shared impl (kill the diverged `server.js` vs
  `tailor.js` copies; both must read the same current-résumé source).
- **`personalInfo`-required rule:** one place.
- **View-model key guard:** extend the no-extra-keys / no-`undefined` guard to
  **all** sections (v1 only guarded experience sections) — DOM-leak protection.
- Give **`score_breakdown`** and **`company_flags`** real Zod schemas.
- Encode the **overlay op restriction** (replace-only for LLM-authored patches)
  and the **reviewer-vs-LLM filter split** (`exclude`/`order` are reviewer-only)
  in the types, not just prose.

## Coupled reshape + migration
- The résumé field reshape ripples into: the **adapter**, `master.json`
  **`source` JSON-Pointers**, the **overlay patch-path format**, and
  **`editorModel`** path logic — redesign as one unit.
- **One-time data migration:** export old `resume_versions` + `master.json` +
  `jobs`/overlays from the live DB → transform to new shapes → seed the new DB.
  An explicit deliverable.

## CONTRACTS.md — required structure
1. Section-key registry (the one list).
2. Résumé document (new schema; pruned/renamed fields; `publications` links fixed;
   `meta.sectionOrder` + `meta.print` validated).
3. View-model contract (all-section guard, no-undefined rule).
4. Overlay (op restriction + reviewer/LLM filter split explicit; audit shape).
5. Pipeline LLM schemas (Jd/Fit/Tailor/Verdict) + the **two-list scoring contract**
   + `score_breakdown` schema.
6. Config/settings layer (LLM, schedule, discovery searches/companies, constraints,
   preferences, answers): DB tables + Zod + CRUD API + UI-tab mapping. Secrets
   boundary stated.
7. DB schema (PII-minimized projections; status lifecycle incl. Phase-4
   placeholders `applying/applied/responded`).
8. API surface (consumer-verified; dead routes dropped or marked ops-only; single
   `overlayProblems`).
9. `events`/cost ledger contract (+ dashboard read API).
10. Discovery → jobs-row write contract (typed/shared; kills silent dict-slice drops).
11. Anti-fabrication invariants (verbatim, binding).
12. Data-migration plan (old shapes → new).

For each contract: the **verdict** (KEEP / DROP / REDESIGN) with a one-line
reason, the **Zod definition** (or a precise sketch), producers/consumers, and any
**must-preserve invariant**. Where v1 had drift vs docs/agents, prefer the code.
