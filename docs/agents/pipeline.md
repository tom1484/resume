# Discovery & tailoring pipeline

## Scope
The two job-processing services: `services/discovery` (Python/uv — nightly job
ingestion) and `services/pipeline` (Node ESM — poll loop: parse → score → gate →
tailor → verify → in_review + Telegram). Covers each stage's module, model,
input→output, the anti-fabrication mechanism, the events/cost ledger, and the
`eval/*` harnesses. DB schema and API routes: see [data-contracts.md](./data-contracts.md).

## Read this when
- Changing how jobs are discovered, normalized, deduped, or excluded.
- Touching the score formula, the SCORE_THRESHOLD gate, or F-1 structural rules.
- Editing any LLM prompt (parse / fit / tailor / verify) — **must re-run the
  matching `eval/*` harness before landing** (CLAUDE.md, binding).
- Changing the drop-unsupported-patches policy or numeric tripwire.
- Adding a pipeline stage or a new `events` ledger entry.
- Swapping a model or wiring a new `MODEL_*` env override.

## Entry points
| File | Role |
|---|---|
| `services/discovery/src/discovery/main.py` | Discovery CLI (`--boards` / `--jobspy` / `--all` / `--dry-run`). Cron runs `--all`. |
| `services/discovery/crontab` | `0 9 * * *` (Asia/Taipei) → `uv run --no-sync python -m discovery.main --all`. supercronic execs directly (no shell). |
| `services/pipeline/src/poller.js` | Long-running worker (container CMD): `migrate()` then `cycle()` forever, sleeping `POLL_MS`. |
| `services/pipeline/src/cycle.js` | `cycle()` = refresh résumé → claim batch → `processJob` each → gate → `tailorJob` each → Telegram. |
| `services/pipeline/src/run-once.js` | Manual one-shot: migrate, one `cycle()`, exit. |
| `services/pipeline/src/tailor-one.js` | Manual: `node src/tailor-one.js [jobId]` — tailor+verify one job (or top `scored`). |
| `services/pipeline/src/migrate.js` | Applies `migrations/*.sql` in filename order once each; tracked in `schema_migrations`. Runs at startup. |

Status lifecycle (jobs.status, text not enum):
`new → parsing → scored → in_review → approved → applying → applied →
responded | rejected | skipped | error`. Discovery writes `new` (or `skipped`
with a `skip_reason` for excluded rows). Phase 4 (apply agent) owns
`approved→applied`.

---

## Stage 0 — Discovery (Python, no LLM)

Two ingestion paths, both ending in `normalize.finalize()` → `store.upsert()`.

### Board APIs — `boards.py` + `main.py:run_boards`
Public, auth-free board APIs (one fetcher each in `boards.FETCHERS`):
| Provider | URL | Normalizer |
|---|---|---|
| greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | `normalize.from_greenhouse` |
| lever | `api.lever.co/v0/postings/{slug}?mode=json` | `normalize.from_lever` |
| ashby | `api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | `normalize.from_ashby` |

Companies + slugs in `config/companies.yml` (`board: {provider, slug}`, `flags`).
`boards.probe_slug` returns posting count if a slug resolves (used to verify slugs
offline). `boards.strip_html` collapses HTML JD → plaintext. `run_boards` filters
each board's full posting list to internship-shaped titles via
`is_internship(title, companies_cfg.title_include)` before normalizing; `time.sleep(1)`
between companies.

### JobSpy — `jobspy_search.py` + `main.py:run_jobspy`
For companies without a public board (Boston Dynamics, NVIDIA, Ambarella, etc.).
Conservative by design (home-IP ban is the #1 risk):
- **Indeed only** by default. LinkedIn is opt-in via `JOBSPY_SITES=indeed,linkedin`
  (`jobspy_search._sites()`). Note: `searches.yml` `defaults.sites` lists
  `[indeed, linkedin]` but the runtime site list comes **only** from the env var.
- One country-wide call per search **term** (4 terms in `searches.yml.searches`),
  not per-location fan-out. `location="United States"` hard-coded.
- `scrape_jobs(...)` args from `searches.yml.defaults`: `results_wanted` (25),
  `hours_old` (72), `job_type` ("internship"), `country_indeed` ("USA"),
  `description_format="markdown"`. One failed search is caught and skipped.
- Jittered `time.sleep(random.uniform(3,10))` between terms.
- In-batch cross-search dedupe by `dedupe_key` before append.
- `_clean()` maps pandas NaN floats → `None`. `INCLUDE_TERMS = [intern,
  internship, co-op, coop]`; rows failing `is_internship` are dropped.
- JobSpy results whose `norm(company)` matches a `companies.yml` entry inherit
  that company's `flags` (`main.run_jobspy` builds `_flags_by_company`).

### Normalization, dedupe, exclusion — `normalize.py`
- `norm(s)` = lowercase, non-alphanumerics→space, trim. Used everywhere for matching.
- `dedupe_key(company,title,location)` = `norm(company)|norm(title)|norm(location)`;
  stored on the row and enforced by unique index `jobs_dedupe_key`.
- `is_internship(title, include_terms)` — **whole-word** regex (`\bintern\b`):
  "intern" must NOT match "internal"/"international".
- Exclusion rules (`searches.yml.exclude`), applied in `finalize()`:
  - `title_skip_reason` — token match against `exclude.title`
    (`senior, staff, principal, manager, director, phd`). Sets `skip_reason="title:<term>"`.
  - `jd_skip_reason` — **whole-word** regex against `exclude.jd`
    (`US citizenship, US citizen, security clearance, ITAR, EAR99, export control,
    unpaid`). "EAR" must not match "year"/"wear". Sets `skip_reason="jd:<term>"`.
  - Any reason → `status="skipped"` (still upserted, with reason), else `status="new"`.
  These encode the F-1 visa constraint: citizenship/clearance/ITAR roles are unusable.

### Persist — `store.py`
`upsert()` inserts the 13 `COLUMNS` (id..dedupe_key) with `ON CONFLICT DO NOTHING`
(dedupe-key or id collision → silently skipped; returns inserted count).
`log_event(conn, "discover", ...)` writes one ledger row per run (no model/cost).
`main.py` prints `found / inserted / skipped_by_rules`; `--dry-run` skips all DB writes.

---

## Stage 1 — parse_jd (`parseJd.js`, Haiku)
**Model:** `PARSE_MODEL` = `MODEL_PARSE ?? claude-haiku-4-5` (in `llm.js`).
**In:** job row (uses `job.title/company/location/jd_text`, JD truncated to 24000 chars).
**Out:** `JdSchema` (Zod) — `hardSkills, softSkills, mustHaves, niceToHaves,
responsibilities, seniority(intern|entry|mid|senior|lead|unspecified),
citizenshipOrClearanceRequired(bool), sponsorshipAvailable(yes|no|unstated),
internshipTerm, minEducation`. Persisted to `jobs.parsed`.
Prompt is literal-extraction only ("only extract what the text states";
`citizenshipOrClearanceRequired` true only for explicit US-citizen/clearance/ITAR).

## Stage 2 — score (`score.js` + `cycle.js:processJob`)
**Formula** (`combine`, 4-dp rounded): `score = 0.5·keyword + 0.3·llmFit + 0.2·structural`
(`WEIGHTS = {keyword:.5, llmFit:.3, structural:.2}`).

| Component | How | LLM? |
|---|---|---|
| `keywordScore(parsed, candidateTerms())` | Weighted coverage: must-haves (`mustHaves ∪ hardSkills`) weight 3, nice-to-haves weight 1; `value = matchedWeight / totalWeight`. Empty JD terms → 0.5. Returns `{value, missing}` (missing surfaced to tailor as gaps). | no |
| `structuralScore(parsed)` | F-1/internship deterministic gate (below). | no |
| `llmFit(job, parsed)` | One structured call → `FitSchema{fit[0..1], rationale, redFlags[]}`. | **yes (Haiku)** |

**`termMatches(jdTerm, candidate)` (ATS fuzzy match):** `norm` both → true if exact /
substring containment, else length-scaled Levenshtein: fuzz budget 2 if min length ≥8,
1 if ≥5, else **0** (short acronyms like AWS/CSS get no fuzz). `levenshtein(a,b,max=2)`
has early-exit beyond `max`.

**`structuralScore` (F-1 structural rules)** — starts at 1:
- `citizenshipOrClearanceRequired` → **hard 0** (`reasons:['citizenship/clearance required']`).
- `seniority` not in `[intern, entry, unspecified]` → −0.6.
- `sponsorshipAvailable === 'no'` → −0.4.
- Clamped to `≥0`. Returns `{value, reasons}`.

**`llmFit`** model: Haiku (via `structuredCall` default). System prompt =
`profileText()` (candidate profile + full master bank, see `profile.js`) +
`FIT_INSTRUCTIONS`; `cache:true` so the stable profile prompt caches across the
batch. JD truncated to 6000 chars. Calibration anchors: 0.9+ exceptional, 0.7
strong, 0.5 plausible, 0.3 weak, <0.2 wrong field.

`processJob` persists `parsed`, `score`, and `score_breakdown` (= keyword,
`missingTerms` (top 12), llmFit, rationale, redFlags, structural,
structuralReasons, weights), sets `status='scored'`. Logs `parse_jd` and `score`
events.

## Gate — SCORE_THRESHOLD (`cycle.js`)
`THRESHOLD = SCORE_THRESHOLD ?? 0.65`. After scoring the batch,
`top = scored.filter(j => j.score >= THRESHOLD).sort(desc)`. Only `top` jobs are
auto-tailored. Sub-threshold jobs stay `scored` (visible in review, not tailored).
Threshold is **calibration-pending** Tom's labels in `out/calibration.csv` (see
`recommend-threshold.js` below).

## Stage 3 — tailor (`tailor.js`, Sonnet / Opus for dream)
**Model:** `tailor()` picks `TAILOR_MODEL_DREAM` (`MODEL_TAILOR_DREAM ??
claude-opus-4-8`) when `job.company_flags` includes `dream`, else `TAILOR_MODEL`
(`MODEL_TAILOR ?? claude-sonnet-4-6`).
**In:** scored job (title, company, parsed, `score_breakdown.missingTerms`,
JD≤16000 chars). **Out:** `TailorSchema` → `toOverlay()` → an overlay
(`overlay.schema.json` shape; see [data-contracts.md](./data-contracts.md)):
- `profile.{name, sections(ordered subset of 9 SECTIONS), filters?}` — section
  selection + per-section `tagsAnyOf/titleIn/limit`. Output is **always a
  structured diff over the canonical résumé, never a rewrite.**
- `patches[]` — **`replace`-only** ops on highlight JSON Pointers, each with
  `groundedIn: [bulletId,...]` (≥1). Prompt caps at **≤4 patches**.
- `coverLetter` — 3 short paragraphs, no invented facts.

**Anti-fabrication at generation time (prompt-level):** `buildSystem()` injects the
full **MASTER BANK** (`master.bullets`, the only claims allowed) and a **PATCHABLE
HIGHLIGHTS** map (`patchableMap` — `path | entry | current text` for every
highlight in work/projects/volunteer). The model may "ONLY rephrase, reorder, or
quantify" bank content; may NOT invent metrics/tech/dates/titles. Built per-call
from `getResume()` (current DB résumé) so paths match what the renderer applies;
`cache:true` (bank+map stable across batch).

`toOverlay` strips `groundedIn` out of patches into `audit.claims[]` (initial
`verdict:'unsupported'`, `audit.unsupported = all patch indices` — verify.js
clears these). `overlayProblems()` validates the overlay: Ajv against
`overlay.schema.json`, `jsonpatch.validate` patches apply cleanly against the
current résumé, and `personalInfo` must be selected — `tailor()` throws if any fail.

## Stage 4 — verify_claims (`verify.js`, Haiku skeptic + deterministic tripwire)
**Model:** `VERIFY_MODEL = MODEL_VERIFY ?? claude-haiku-4-5`.
**In:** `(overlay, grounding)` where `grounding[i] = patch i's groundedIn ids`.
**Out:** `{audit:{claims[], unsupported[]}, reasons, usage, model}`.

Two layers — an overlay may only enter review with `audit.unsupported === []`:

1. **Numeric tripwire (deterministic, no LLM)** — `numericTripwire(patchValue,
   groundedIn)`: `extractNumbers` pulls bare numerics (`90%→90`, `3.2x→3.2`,
   `.0` stripped). Any number in the patch value **not present** in the cited
   bullets' text is a fabrication. Years 2019–2030 are treated as dates and
   ignored. Also auto-fail (no LLM): grounding cites an **unknown bullet id**, or
   cites **no** bullet.
2. **LLM skeptic (Haiku)** — for patches surviving layer 1, the `SYSTEM` prompt
   judges whether **every** factual claim (tech, metrics, scope, outcome, role) is
   contained in / entailed by the cited bullets. Generalizing is fine
   ("CNN models" ⊇ "motion detection CNNs"); specializing/strengthening is not
   ("led the team" vs "worked on the team"; "75%" vs "significant").
   **If uncertain → supported=false** (bias toward flagging).

`claims[].verdict` = `supported|unsupported`; `unsupported` = indices flagged by
either layer. `reasons` carries human-readable causes (kept out of the
schema-clean audit). `verify.test.js` covers `extractNumbers`/`numericTripwire`
deterministically.

## Stage 5 — tailorJob (`tailorJob.js`) — DROP-unsupported-patches policy
Orchestrates tailor → verify → **drop** → persist. The load-bearing safety rule:
```
drop = Set(verify.audit.unsupported)
keptPatches = overlay.patches.filter((_, i) => !drop.has(i))   // unsupported patches REMOVED
audit.unsupported := []                                        // rebuilt empty by construction
```
A reviewer therefore **never sees a fabricated bullet**. If every patch is
dropped, the overlay still stands as a pure section-selection tailoring (no
rewrites). Kept patches are re-validated with `jsonpatch.validate` (throws if they
no longer apply). Persists `overlay, cover_letter, audit`, sets
`status='in_review'`. Logs `tailor` + `verify_claims` events.
**Never weaken this policy without re-running `eval/run-verify-eval.js`** (CLAUDE.md).

## Notify (`notify.js`)
`cycle()` sends one Telegram message per non-empty cycle via
`sendTelegram(batchSummary(...))`. Needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
(missing → warn + skip, returns false). `batchSummary` HTML-escapes, links each
tailored job to `${REVIEW_BASE_URL ?? https://jobs.churong.cc}/#/app/<id>`, shows
score + company + flags + patch count. `notify` event logged with
`{scored, above, tailored}`.

---

## Anti-fabrication — the full chain (load-bearing)
Three independent layers; reviewer edits bypass all of them (only LLM-written
patches are verified):
1. **Generation constraint** (`tailor.js` `buildSystem`): model sees only the
   master bank + real highlight paths; replace-only patches; ≤4; `groundedIn` required.
2. **Verification** (`verify.js`): deterministic numeric tripwire + unknown-id /
   no-grounding auto-fail, then Haiku skeptic (uncertain→false).
3. **Drop policy** (`tailorJob.js`): unsupported patches removed before review;
   `audit.unsupported` is always `[]` at `in_review`.
Reviewer edits to résumé/overlay are **trusted** (the verify guard only covers
LLM-authored patches) — see [data-contracts.md](./data-contracts.md).

## Profile / résumé source (`profile.js`)
- Canonical résumé is **DB-backed** (`resume_versions`, latest row). `refreshResume()`
  (called at the top of every `cycle()`) pulls it so scoring/tailoring reflect web
  edits without redeploy; on any DB failure it keeps the current/seed résumé.
- Seed/fallback file: `RESUME_SEED ?? data/resume.json` (repo root).
- `master.json` (the grounding bullet bank) stays **file-based**, loaded from
  `DATA_DIR ?? packages/renderer/src/data`.
- `candidateTerms()` = all skill/project/work-tag/master-bullet-tag terms (drives
  `keywordScore`). `profileText()` = candidate header + F-1 authorization note +
  education + skills + full accomplishment bank (drives `llmFit`).

## Events / cost ledger (`events` table)
Every stage logs one `events` row (`logEvent` duplicated in `cycle.js` and
`tailorJob.js`): `job_id, stage, model, input_tokens, output_tokens, cost_usd,
duration_ms, ok, detail(jsonb)`. Stages seen: `discover` (Python, no model),
`parse_jd, score, tailor, verify_claims, notify`. `cost_usd` computed by
`llm.costUsd(model, usage)` only when model+usage present.
**Prices ($/MTok, `llm.js`):** haiku `{in:1,out:5}`, sonnet `{in:3,out:15}`,
opus `{in:5,out:25}`; cache-read = 0.1× input, cache-write(5m) = 1.25× input
(uses `cache_read_input_tokens` / `cache_creation_input_tokens` from usage).
Failed stages log `ok:false` with `detail.error`; a failed job → `status='error'`,
a failed tailor leaves the job `scored` for a later retry.

## LLM call plumbing (`llm.js`)
`structuredCall({model=PARSE_MODEL, system, user, schema(Zod), maxTokens, cache})`
→ `client.messages.parse({ output_config:{format: zodOutputFormat(schema)} })`.
Returns `{output, usage, model, durationMs}`; throws on unparseable output.
`cache:true` marks the system block `cache_control:{type:'ephemeral'}` (put stable
content first; ~1024-token minimum to actually cache).

## Models per stage + env overrides
| Stage | Default model | Env override |
|---|---|---|
| parse_jd | claude-haiku-4-5 | `MODEL_PARSE` |
| score (llmFit) | claude-haiku-4-5 | `MODEL_PARSE` (shares `structuredCall` default) |
| tailor (normal) | claude-sonnet-4-6 | `MODEL_TAILOR` |
| tailor (dream flag) | claude-opus-4-8 | `MODEL_TAILOR_DREAM` |
| verify_claims | claude-haiku-4-5 | `MODEL_VERIFY` |
Tuning knobs: `SCORE_THRESHOLD` (0.65), `POLL_INTERVAL_MS` (60000), `BATCH_SIZE`
(10), `JOBSPY_SITES` (indeed), `DATABASE_URL`, `ANTHROPIC_API_KEY`, `DATA_DIR`
(/data), `RESUME_SEED` (/seed/resume.json), `REVIEW_BASE_URL`, `CONFIG_DIR`
(discovery), `TELEGRAM_BOT_TOKEN/CHAT_ID`. Secrets in `deploy/.env`.

## eval/* harnesses (what gates prompt changes)
| Harness | Gates | Live API? | Notes |
|---|---|---|---|
| `eval/run-parse-eval.js` | parse_jd prompt | yes (~2¢, 6 Haiku calls) | Re-parses 6 frozen JDs in `golden-jds.json`; asserts recall ≥0.8 of `expectedTerms` in `mustHaves∪hardSkills` (via `termMatches`) **and** `seniority==='intern'`. **NOT in CI.** |
| `eval/run-verify-eval.js` | verify_claims prompt / drop policy | yes | Adversarial: clean rephrase + 3 fabrications (invented metric / leadership scope / technology), N=3 runs each. Fabrication must be flagged **every** run; clean must pass ≥2/3. **Fabrication false-negatives are never tolerated.** |
| `eval/run-tailor-eval.js` | tailor + verify end-to-end | yes (~2–5¢/job) | `node eval/run-tailor-eval.js <jobs.jsonl>`. Per job: overlay valid, `audit.unsupported===[]`, coverLetter >200 chars. |
| `eval/recommend-threshold.js` | SCORE_THRESHOLD calibration | no | Reads `out/calibration.csv` (`label` good/bad); prints precision/recall/F1 per threshold 0.2–0.85 and the max-F1 recommendation. Needs ≥10 labeled rows. `recommend-threshold.test.js` covers it. |

**Binding (CLAUDE.md):** any change to a parse/fit/tailor/verify prompt requires
the matching golden-set eval to pass, including the fabrication-injection test
(zero unsupported claims). Code + its test land in the same change.

## Invariants & gotchas
- **Drop-policy is the safety contract:** never let an unsupported patch reach
  `in_review`. `audit.unsupported` must be `[]` at `in_review` by construction.
- **Numeric tripwire ignores years 2019–2030** — a fabricated date inside that
  range will not trip the deterministic check (skeptic is the backstop).
- **JD truncation differs per stage:** parse 24000, fit 6000, tailor 16000 chars.
  Long JDs lose tail content for scoring/fit.
- **JOBSPY_SITES env wins over `searches.yml.defaults.sites`** — the YAML list is
  not read by `_sites()`. Keep Indeed-only unless deliberately opting into LinkedIn.
- **Never run logged-in platform automation from the server** (CLAUDE.md). JobSpy
  uses public unauthenticated search only; jittered pacing is intentional.
- **`refreshResume()` is best-effort:** a DB hiccup silently falls back to the seed
  résumé — scoring/tailoring may run against stale data without erroring.
- **`master.json` is file-based, not DB-backed:** editing the résumé via the web
  does NOT change the grounding bank. New claims must be added to `master.json`
  (and pass `pnpm validate`) or the model can't ground patches on them.
- **`keywordScore` returns 0.5 (not 0) when the JD yields no terms** — avoids
  unfairly zeroing thin JDs.
- **Tailor patches are `replace`-only on existing highlight paths** — no add/remove;
  the schema (`TailorSchema`) enforces this and `op:'replace'` is the only enum value.
- **One Telegram message per non-empty cycle**; empty cycles are silent.
- **Migrations run in filename order at every container start** (idempotent).
  New schema → add `migrations/00N_*.sql`; don't mutate applied files.
