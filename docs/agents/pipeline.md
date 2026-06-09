# Discovery & tailoring pipeline (v2)

## Scope
The two job-processing services: `services/discovery` (Python/uv — DB-driven
scheduler + boards/JobSpy ingestion) and `services/pipeline` (Node TS — poll loop:
parse → score(two lists) → gate → tailor → verify → in_review + Telegram). Covers
each stage's module, model, input→output, the **config-driven knobs**, the
**two-list scoring**, the **anti-fabrication chain** (load-bearing), the events
ledger, and the `eval/*` harnesses. Shapes: [./data-contracts.md](./data-contracts.md)
→ `docs/v2/CONTRACTS.md`. Deploy/env: [./operations.md](./operations.md).

## Read this when
- Changing how jobs are discovered, normalized, deduped, or excluded.
- Touching the score formula, the gate threshold, Constraints, or Preferences.
- Editing any LLM prompt (parse / fit / tailor / verify) — **must re-run the
  matching `eval/*` harness before landing** (CLAUDE.md, binding).
- Changing the drop-unsupported-patches policy or the numeric tripwire.
- Changing the scheduler, or a config knob (models/threshold/weights/truncation).
- Adding a pipeline stage or a new `events` ledger entry.

## Config-driven, not env-driven (v2)
Everything v1 read from env (`MODEL_*`, `SCORE_THRESHOLD`, `BATCH_SIZE`,
`POLL_INTERVAL_MS`, weights, JD truncation, the schedule, searches/companies) now
comes from the **DB `config` table**, read at runtime via best-effort
`getConfig(ns)` with schema-default fallback. Only secrets stay in env
(`ANTHROPIC_API_KEY`, `TELEGRAM_*`, `DATABASE_URL`). A UI edit takes effect next
cycle/tick, no restart.

- Pipeline (TS): `services/pipeline/src/config.ts` `getConfig<NS>(ns)` reads
  `config` (last-good cache + `configDefault` fallback). `cycle()` reads
  `getConfig('llm')` once per cycle + `getConfig('constraints')`/`'preferences'`
  per job; `poller.ts` re-reads `pollIntervalMs` each loop.
- Discovery (Python): `services/discovery/src/discovery/config.py` `get_config(conn,
  ns)` — a hand-kept **mirror** of the Zod defaults (`DISCOVERY_DEFAULT`/
  `SCHEDULE_DEFAULT` MUST track `packages/contracts/src/config.ts`), deep-merging the
  DB row over the default.

## Entry points
| File | Role |
|---|---|
| `services/discovery/src/discovery/scheduler.py` | `loop()` — per-minute tick; re-reads `ScheduleConfig`; fires `main.run(mode, conn)` when the cron matches. Container CMD. Replaces supercronic. |
| `services/discovery/src/discovery/main.py` | `run(mode, conn, dry_run)` + CLI (`--boards/--jobspy/--all/--dry-run`). The scheduler calls `run()` in-process; the CLI is for manual one-shots. |
| `services/discovery/src/discovery/cron.py` | `CronExpr` — minimal 5-field cron matcher (`* a-b a,b */n`; dom AND dow; documented limitation vs full Vixie). |
| `services/pipeline/src/poller.ts` | Long-running worker: `cycle()` forever, sleeping `LlmConfig.pollIntervalMs`. **No migration** (API owns it). |
| `services/pipeline/src/cycle.ts` | `cycle()` = read config → refresh résumé → claim batch → `processJob` each → gate → `tailorJob` each → Telegram. |
| `services/pipeline/src/run-once.ts` | Manual one-shot: one `cycle()`, exit. |
| `services/pipeline/src/tailor-one.ts` | Manual: `tailor-one.ts [jobId]` — tailor+verify one job (or top `scored`). |

Status lifecycle (jobs.status, text not enum): `new → parsing → scored →
in_review → approved → applying → applied → responded | rejected | skipped |
error`. Discovery writes `new` (or `skipped` + `skip_reason`). Phase 4 owns
`approved→applied`.

---

## Stage 0 — Discovery (Python, no LLM)

Two ingestion paths, both ending in `normalize.finalize()` → `store.upsert()`
(which validates each record against the `DiscoveredJob` contract first).

### Board APIs — `boards.py` + `main.run_boards`
Public, auth-free board APIs (one fetcher each in `boards.FETCHERS`):
| Provider | URL | Normalizer |
|---|---|---|
| greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | `normalize.from_greenhouse` |
| lever | `api.lever.co/v0/postings/{slug}?mode=json` | `normalize.from_lever` |
| ashby | `api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | `normalize.from_ashby` |

Companies + slugs come from `DiscoveryConfig.companies` (the `discovery` config
namespace; `{name, flags, board:{provider,slug}, enabled}`) — **NOT** the YAMLs (the
two `services/discovery/config/*.yml` are migration seed only). `boards.probe_slug`
returns a posting count if a slug resolves. `boards.strip_html` collapses HTML JD →
plaintext. `run_boards` filters each board's postings to internship titles via
`is_internship(title, cfg.titleInclude)`; `time.sleep(1)` between companies.

### JobSpy — `jobspy_search.py` + `main.run_jobspy`
For companies without a public board. Conservative by design (home-IP ban is the #1
risk):
- **Indeed only** by default (`DiscoveryConfig.sites = ['indeed']`); LinkedIn is
  opt-in by adding it to `sites` in the UI.
- One country-wide call per enabled `DiscoveryConfig.searches[]` term, NOT
  per-location fan-out. `location` comes from `jobspyDefaults.location` (was
  hard-coded "United States" in v1).
- `scrape_jobs(...)` args from `jobspyDefaults`: `resultsWanted` (25), `hoursOld`
  (72), `jobType` ("internship"), `country` ("USA"), `description_format=markdown`.
  One failed search is caught + skipped.
- Jittered `time.sleep(random.uniform(3,10))` between terms; in-batch cross-search
  dedupe by `dedupe_key`. `_clean()` maps pandas NaN → None.
- JobSpy results whose `norm(company)` matches a `DiscoveryConfig.companies` entry
  inherit that company's `flags` (`run_jobspy` builds `flags_by_company`).
- **Dropped v1 config** (verified dead, §10): `searches[].keywords`, `locations`,
  `defaults.sites` — `DiscoveryConfig` doesn't carry them; the migration strips them.

### Normalization, dedupe, exclusion — `normalize.py`
- `norm(s)` = lowercase, non-alphanumerics→space, trim. Used everywhere for matching.
- `dedupe_key(company,title,location)` = `norm(company)|norm(title)|norm(location)`;
  stored on the row and enforced by unique index `jobs_dedupe_key`.
- `is_internship(title, include_terms)` — **whole-word** regex (`\bintern\b`):
  "intern" must NOT match "internal"/"international".
- Exclusion in `finalize()` (terms from `DiscoveryConfig.exclude`):
  - `title_skip_reason` — token match against `exclude.title` (default
    `senior, staff, principal, manager, director, phd`). → `skip_reason="title:<term>"`.
  - `jd_skip_reason` — **whole-word** regex against `exclude.jd` (default
    `US citizenship, US citizen, security clearance, ITAR, EAR99, export control,
    unpaid`). "EAR" must not match "year". → `skip_reason="jd:<term>"`.
  - Any reason → `status="skipped"` (still upserted, with reason), else `"new"`.
  These encode the F-1 ingestion gate: citizenship/clearance/ITAR roles are unusable.

### Persist — `store.py` (typed write, §10)
`upsert()` validates each record via `jobrow.validate_record` (pydantic
`DiscoveredJob`, `extra='forbid'`) BEFORE the SQL — a non-conforming record is
**logged + skipped, never silently dict-sliced** (the v1 drop bug). INSERT is `ON
CONFLICT DO NOTHING` (dedupe-key/id collision → skipped; returns inserted count).
`jobrow.COLUMNS` is the single ordering source (= the 13 contract fields).
`log_event(conn, 'discover', …)` writes one run-level `events` row (no model/cost).
`main.run` prints `found/inserted/skipped_by_rules`; `--dry-run` skips DB writes.

---

## Stage 1 — parse_jd (`parseJd.ts`, Haiku)
**Model:** `cfg.models.parse` (default `claude-haiku-4-5`). **In:** job row
(`title/company/location/jd_text`, JD truncated to `cfg.jdTruncation.parse`, default
24000). **Out:** `JdSchema` — `hardSkills, softSkills, mustHaves, niceToHaves,
responsibilities, seniority(intern|entry|mid|senior|lead|unspecified),
citizenshipOrClearanceRequired(bool), sponsorshipAvailable(yes|no|unstated),
internshipTerm, minEducation`. Persisted to `jobs.parsed`. Prompt is
literal-extraction only; `citizenshipOrClearanceRequired` true only for explicit
US-citizen/clearance/ITAR.

## Stage 2 — score, two lists (`score.ts` + `cycle.ts:processJob`)
**Formula** (`combine`, 4-dp): `score = w.keyword·keyword + w.llmFit·llmFit +
w.structural·structural`, weights from `cfg.weights` (default `{keyword:.5,
llmFit:.3, structural:.2}`).

| Component | How | LLM? |
|---|---|---|
| `keywordScore(parsed, candidateTerms())` | Weighted coverage: `mustHaves ∪ hardSkills` weight 3, nice-to-haves weight 1; `value = matched/total`. **Empty terms → 0.5** (`KEYWORD_SCORE_FLOOR`, contracts). Returns `{value, missing}`. | no |
| `evaluateConstraints(parsed, constraints)` | Deterministic two-list "Constraints" (below). | no |
| `llmFit(job, parsed, cfg, preferences)` | One call (`cfg.models.fit`) → `FitSchema{fit[0..1], rationale, redFlags[]}`. System = `profileText(preferences)` + `FIT_INSTRUCTIONS`; `cache:true`. JD≤`cfg.jdTruncation.fit` (6000). | **yes (Haiku)** |

**`termMatches` (ATS fuzzy):** `norm` both → true if exact / substring containment,
else length-scaled Levenshtein: fuzz budget 2 if min length ≥8, 1 if ≥5, else **0**
(short acronyms like AWS get no fuzz). `levenshtein(a,b,max)` early-exits beyond max.

### Two-list scoring (v2 — replaces v1's baked F-1 `structuralScore`)
- **Constraints** (hard, deterministic, DB-backed `constraints` config). Each
  `Constraint` is a typed predicate over a parsed-JD field: `test` ∈
  `{isTrue} | {equals,value} | {notIn,values}`; `effect` ∈ `{hard} | {penalty,
  amount}`. `evaluateConstraints` starts at 1; a fired `hard` short-circuits to 0;
  `penalty` subtracts its amount; clamp ≥0. Disabled constraints skipped. Preserves
  v1 semantics. The three seed F-1 rules (planted by the migration):
  citizenship/clearance → hard 0; seniority ∉ [intern,entry,unspecified] → −0.6;
  sponsorship=='no' → −0.4.
- **Preferences** (soft, priority 1–10, DB-backed `preferences` config). Free-text
  considerations fed to the `llmFit` system prompt by `profile.preferenceBlock`:
  enabled prefs sorted descending, rendered as `- [decisive|important|moderate|mild]
  <text>` lines (label map: 9–10 decisive, 6–8 important, 3–5 moderate, 1–2 mild) with
  an instruction telling the model how hard to weight each tier. They do NOT alter
  the deterministic structural score; influence is realized via `fit`/`redFlags`.

`processJob` writes a **`ScoreBreakdown.parse`-validated** `score_breakdown`:
`{keyword, missingTerms(top12), llmFit, rationale, redFlags, structural,
constraintsFired[], preferencesApplied[], weights}` — `constraintsFired`/
`preferencesApplied` are the explicit attribution of what moved the score (replacing
v1's untyped blob). Sets `status='scored'`. Logs `parse_jd` + `score` events.

## Gate — `scoreThreshold` (`cycle.ts`)
After scoring the batch, `top = scored.filter(j => j.score >= cfg.scoreThreshold)`
(default 0.65) sorted desc. Only `top` jobs are auto-tailored; sub-threshold jobs
stay `scored` (visible in review, not tailored). Calibrate with
`eval/recommend-threshold.ts` on `out/calibration.csv` (the `label good|bad`
column); set the recommended value in the LLM config tab.

## Stage 3 — tailor (`tailor.ts`, Sonnet / Opus for dream)
**Model:** `cfg.models.tailorDream` (default `claude-opus-4-8`) when
`job.company_flags` includes `dream`, else `cfg.models.tailor` (default
`claude-sonnet-4-6`). **In:** scored job (title, company, parsed,
`score_breakdown.missingTerms`, JD≤`cfg.jdTruncation.tailor` = 16000). **Out:**
`TailorSchema` → `toOverlay()` → an `Overlay`:
- `profile.{name, sections(ordered subset of the 9 keys), filters?}` — section
  selection + per-section LLM filters (`tagsAnyOf/titleIn/limit`). Always a
  structured diff over the canonical résumé, never a rewrite.
- `patches[]` — **`replace`-only** ops on highlight JSON Pointers, each with
  `groundedIn:[bulletId,...]` (bare `<id>`, ≥1). Prompt caps at **≤4 patches**
  (`MAX_TAILOR_PATCHES`, contracts).
- `coverLetter` — 3 short paragraphs, no invented facts.

**Anti-fabrication at generation (prompt-level, layer 1):** `buildSystem()` injects
the full **MASTER BANK** (`master.bullets`, the only allowed claims) and a
**PATCHABLE HIGHLIGHTS** map (`patchableMap` — `path | entry | current text` for
every highlight in work/projects/volunteer). The model may "ONLY rephrase, reorder,
or quantify" bank content; may NOT invent metrics/tech/dates/titles. Built per-call
from `getResume()` (current DB résumé) so paths match the renderer; `cache:true`.
`toOverlay` strips `groundedIn` into `audit.claims[]` (initial `verdict:
'unsupported'`, `audit.unsupported = all indices` — verify clears these). `tailor()`
validates with the one `overlayProblems(overlay, getResume())` and throws on
problems.

## Stage 4 — verify_claims (`verify.ts`, Haiku skeptic + deterministic tripwire)
**Model:** `cfg.models.verify` (default `claude-haiku-4-5`). **In:** `(overlay,
grounding, cfg)` where `grounding[i]` = patch i's `groundedIn` ids. **Out:**
`{audit:{claims[], unsupported[]}, reasons, usage, model}`. An overlay may only
enter review with `audit.unsupported === []`.

Two layers (the deterministic parts live in `@resume/contracts/antifab` — the ONE
source, never re-implemented in `verify.ts`):
1. **Deterministic auto-fails (no LLM):** `isStructurallyGrounded(cited, knownIds)`
   fails empty grounding / unknown bullet ids; `numericTripwire` (built on
   `extractTripwireNumbers`) fails any number in the patch value not present in the
   cited bullets' text. **Years 2019–2030 are excluded** (`isExcludedYear`).
2. **LLM skeptic (Haiku):** for patches surviving layer 1, judges whether **every**
   factual claim is contained in / entailed by the cited bullets. Generalizing is
   fine; specializing/strengthening is not. **Uncertain → supported=false.**

`claims[].verdict` = `supported|unsupported`; `unsupported` = indices flagged by
either layer. `reasons` is human-readable (kept out of the schema-clean audit).
`verify.test.ts` covers `numericTripwire`/`extractTripwireNumbers` deterministically.

## Stage 5 — tailorJob (`tailorJob.ts`) — DROP-unsupported-patches policy (layer 3)
Orchestrates tailor → verify → **drop** → persist. The load-bearing safety rule:
```
drop        = new Set(verify.audit.unsupported)
keptPatches = overlay.patches.filter((_, i) => !drop.has(i))   // unsupported REMOVED
audit.claims = supported claims, patchIndex RENUMBERED to kept positions
audit.unsupported = []                                          // empty by construction
```
A reviewer therefore **never sees a fabricated bullet**. If every patch is dropped,
the overlay still stands as a pure section-selection tailoring. Kept patches are
re-validated with `jsonpatch.validate` (throws if they no longer apply). Persists
`overlay, cover_letter, audit`, `status='in_review'`. Logs `tailor` +
`verify_claims`. **Never weaken this without re-running `eval:verify`** (CLAUDE.md).

## Notify (`notify.ts`)
`cycle()` sends one Telegram message per non-empty cycle via
`sendTelegram(batchSummary(...))`. Needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
(env; missing → warn + skip, returns false). `batchSummary` HTML-escapes, links each
tailored job to `${REVIEW_BASE_URL}/#/app/<id>`, shows score + company + flags +
patch count. `notify` event logged with `{scored, above, tailored}`.

---

## Anti-fabrication — the full chain (load-bearing, §11 binding)
Three independent layers; reviewer edits bypass all of them (only LLM-written
patches are verified):
1. **Generation constraint** (`tailor.ts` `buildSystem`): model sees only the master
   bank + real highlight paths; replace-only patches; ≤4; `groundedIn` required.
2. **Verification** (`verify.ts` + `@resume/contracts/antifab`): numeric tripwire
   (years 2019–2030 excluded) + unknown-id/empty-grounding auto-fail, then Haiku
   skeptic (uncertain→false).
3. **Drop policy** (`tailorJob.ts`): unsupported patches removed before review;
   `audit.unsupported` always `[]` at `in_review`; `patchIndex` renumbered.
Reviewer edits to résumé/overlay are **trusted** (the dashboard's
`editorTreeToOverlay` writes `audit:{claims:[],unsupported:[]}`). The deterministic
constants/guards live ONCE in `@resume/contracts/antifab.ts` — never copied.

## Profile / résumé source (`profile.ts`)
- Canonical résumé is **DB-backed** (`resume_versions`, latest row).
  `refreshResume()` (top of every `cycle()`) pulls it so scoring/tailoring reflect
  web edits without redeploy; on any DB failure it keeps the current/seed résumé.
- Seed/fallback file: `RESUME_SEED ?? data/resume.json` (repo root; resolved by
  walking up to find `data/resume.json`).
- `master.json` (the grounding bullet bank) stays **file-based**, loaded from
  `DATA_DIR ?? packages/renderer/src/data`. Reads v2 résumé fields (`work.tags`/
  `projects.tags`, `headline`) — NOT v1 `x-tags`/`keywords`/`basics.label`.
- `candidateTerms()` = all skill/project-tag/work-tag/master-bullet-tag terms
  (drives `keywordScore`). `profileText(preferences)` = candidate header + education
  + skills + the preference block + the full accomplishment bank (drives `llmFit`).
  The v1 hard-coded F-1/CPT/"Summer 2027" anchor is GONE — it lives in the
  `preferences` config now (the migration seeds one).

## Events / cost ledger (`events` table + `events.ts`)
Every stage logs one `events` row via the single `logEvent` (`pipeline/src/events.ts`,
which calls the contracts `logEventRow` builder — the v1 duplicated copies are
folded into one). Columns: `job_id, stage, model, input_tokens, output_tokens,
cost_usd, duration_ms, ok, detail`. Stages: `discover` (Python, no model),
`parse_jd, score, tailor, verify_claims, notify`. `cost_usd` (via contracts
`costUsd(model, usage)`) only when model+usage present. **Prices ($/MTok):** haiku
`{in:1,out:5}`, sonnet `{in:3,out:15}`, opus `{in:5,out:25}`; cache-read 0.1×,
cache-write(5m) 1.25×. Failed stages log `ok:false` with `detail.error`; a failed
job → `status='error'`, a failed tailor leaves the job `scored` for retry. The read
side is the dashboard (`GET /api/dashboard/summary` + `GET /api/events`).

## LLM call plumbing (`llm.ts`)
`structuredCall({model, system, user, schema(Zod), maxTokens, cache})` →
`client.messages.parse({ output_config:{format: zodOutputFormat(schema)} })`. Returns
`{output, usage, model, durationMs}`; throws on unparseable output. `cache:true` marks
the system block `cache_control:{type:'ephemeral'}` (put stable content first; ~1024
tokens to actually cache). `costUsd`/`PRICES` re-exported from `@resume/contracts`.

## eval/* harnesses (what gates prompt changes)
Run with `tsx` (the `pnpm --filter @resume/pipeline eval:*` scripts) — live API, NOT
in CI. They load defaults via `configDefault('llm')`.
| Harness | Gates | Live API? | Asserts |
|---|---|---|---|
| `eval/run-parse-eval.ts` (`eval:parse`) | parse_jd prompt | yes (~2¢, 6 Haiku calls) | Re-parses 6 frozen JDs in `golden-jds.json`; recall ≥0.8 of `expectedTerms` in `mustHaves∪hardSkills` (via `termMatches`) **and** `seniority==='intern'`. |
| `eval/run-verify-eval.ts` (`eval:verify`) | verify_claims / drop policy | yes | Adversarial: clean rephrase + 3 fabrications (metric / leadership scope / technology), N=3 runs each. Fabrication flagged **every** run; clean passes ≥2/3. **Fabrication false-negatives never tolerated.** |
| `eval/run-tailor-eval.ts` (`eval:tailor`) | tailor + verify end-to-end | yes (~2–5¢/job) | `eval/run-tailor-eval.ts <jobs.jsonl>`. Per job: overlay valid, `audit.unsupported===[]`, coverLetter >200 chars. |
| `eval/recommend-threshold.ts` | scoreThreshold calibration | no | Reads `out/calibration.csv`; precision/recall/F1 per threshold 0.2–0.85 + max-F1 recommendation. Needs ≥10 labeled rows. `recommend-threshold.test.ts` covers it. |

**Binding (CLAUDE.md):** any change to a parse/fit/tailor/verify prompt requires the
matching golden-set eval to pass, including the fabrication-injection test (zero
unsupported). Code + its test land in the same change.

## Invariants & gotchas
- **Config-driven, best-effort:** a DB hiccup or a malformed UI write falls back to
  last-good/schema-default and never crashes a cycle/tick. Python defaults
  (`config.py`) MUST track `contracts/config.ts`.
- **Drop-policy is the safety contract:** `audit.unsupported` must be `[]` at
  `in_review` by construction. Never let an unsupported patch reach review.
- **Numeric tripwire ignores years 2019–2030** — a fabricated date in that range
  won't trip the deterministic check (skeptic is the backstop).
- **JD truncation differs per stage** (config `jdTruncation`): parse 24000, fit 6000,
  tailor 16000. Long JDs lose tail content for scoring/fit.
- **Two-list scoring is DB-backed** — edit Constraints/Preferences in the UI, not in
  code. The F-1 rules are seed config, no longer hard-coded.
- **The pipeline does NOT run migrations** (the API does). `db.ts`/`poller.ts` assume
  the schema (incl. `config`) exists.
- **Never run logged-in platform automation from the server** (CLAUDE.md). JobSpy is
  public/unauthenticated; jittered pacing is intentional.
- **`master.json` is file-based, not DB-backed:** editing the résumé via the web does
  NOT change the grounding bank; ids are immutable once referenced (renaming orphans
  `groundedIn` silently). New claims go in `master.json` + pass `pnpm validate`.
- **Tailor patches are `replace`-only** — the `TailorSchema`/`LlmPatch` enforce it.
- **One Telegram message per non-empty cycle**; empty cycles are silent.
