# PLAN.md — Job Pipeline Progress Tracker

Plan of record: [PROPOSALS.md](PROPOSALS.md) · Setup checklist:
[PREPARE.md](PREPARE.md)

**Rule:** statuses here are updated in the same commit as the work they
describe. A task is checked only when its verification column passed.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done (verified)

## Phase overview

| Phase | Scope (details in PROPOSALS.md §8) | Status |
|---|---|---|
| 1 | Workspace split, overlay contract, master bank draft, compose skeleton | done |
| 2 | Discovery (JobSpy + boards) + scoring + calibration | done (threshold calibration pending labels) |
| 3 | Tailoring + verify + review app + notifier | **in progress** |
| 4 | Apply agent (local machine, HITL) | pending |
| 5 | Hardening: eval harness in CI, stats, cost guardrails | pending |

## Phase 1 tasks

Checkpoint: a hand-written overlay renders as a tailored resume at
`https://jobs.churong.cc/?application=test`.

| # | Task | Verification | Status |
|---|---|---|---|
| T0 | PLAN.md tracker | committed | [x] |
| T1 | Render baseline (pre-split) | all profiles captured to `.render-baseline/` | [x] |
| T2 | Workspace split: `apps/site` + `packages/renderer`, root scripts delegate | `pnpm validate/test/build/pdf` green from root; **DOM diff vs baseline empty** for every profile (PNG pixel-identical too) | [x] |
| T3 | `overlay.schema.json` + validate.mjs covers `applications/*/overlay.json` incl. patch dry-run | valid/invalid fixtures behave as expected in vitest; `pnpm validate` green | [x] |
| T4 | Overlay engine (`applyOverlay`), `buildProfileFrom` refactor, async bootstrap `?application=<id>`, visible error on failure, `test` fixture | identity property test; capture `application=test` shows patched content + excluded sections absent; plain profiles still match baseline; missing overlay → error box, zero resume content | [x] |
| T5 | `master.json` bullet bank: schema + initial draft (stable ids) | `pnpm validate` green; id-uniqueness + source-pointer-resolution + highlight-coverage tests | [x] |
| T6 | CI workflow: no YAML changes needed (workflow only calls root pnpm scripts; script paths updated in T2) | push → CI green (GitHub API check) | [x] |
| T7 | `deploy/docker-compose.yml`: `db` (pgvector) + `review` (nginx static stub) on `nginx` network; deploy | compose healthy; `http://review:8080` + overlay JSON served from inside `nginx` network; **checkpoint verified: `https://jobs.churong.cc/?application=test` renders patched highlight, filtered sections** | [x] |
| T8 | Close out: PLAN/CLAUDE/PREPARE/memory updated | final push, CI green | [x] |

Post-checkpoint (Tom): request Let's Encrypt cert + enable NPM access list
(PREPARE.md item 3).

## Phase 2 tasks

Checkpoint: discovery runs nightly, new jobs land scored in Postgres, and a
Telegram summary arrives with the top matches.

Design note (deviation from PROPOSALS §5): pgvector bullet retrieval is
**deferred** — the master bank (~40 bullets) fits whole in any prompt, so
RAG retrieval adds latency without value at this scale, and embeddings
would require a second LLM vendor (Anthropic has no embeddings API).
Scoring = 0.5·keyword (code, fuzzy) + 0.3·LLM fit (Haiku) + 0.2·structural.
Revisit when the bank grows ~10×.

| # | Task | Verification | Status |
|---|---|---|---|
| P2.1 | DB migrations (`jobs`, `events`) + runner in pipeline service | migrations apply idempotently against the live db container | [x] |
| P2.2 | Discovery service (Python/uv): Greenhouse/Lever/Ashby board fetchers, normalize → dedupe → upsert; config from PREPARE.md drafts (slugs live-verified, 10 boards) | live smoke: 8 real internships inserted; rerun 0 dupes; 10 pytest cases incl. the Internal≠Intern and year≠EAR word-boundary regressions | [x] |
| P2.3 | JobSpy searches (from searches.yml), conservative throttling, exclude-keyword skip marking | live smoke with one query; excluded titles marked `skipped` with reason | [x] |
| P2.4 | Pipeline service (Node ESM): `parse-jd` (Haiku structured) + scoring + poller + events logging | 16 unit tests (incl. AWS≠CSS fuzzy regression); 30 real JDs parsed+scored live at ~1.1¢/job | [x] |
| P2.5 | Telegram batch summary | delivered live (events: notify ok) + format unit tests | [x] |
| P2.6 | Compose: discovery (supercronic nightly, `init: true` — PID-1 fatal fixed) + pipeline poller; review healthcheck fixed (busybox wget → 127.0.0.1) | end-to-end live: discovery --all → 23 inserted → poller drained queue → 30 scored → Telegram | [x] |
| P2.7 | Golden JD evals (6 frozen real JDs, live recall assertion — gates prompt changes per CLAUDE.md) + calibration CSV exported & sent to Tom | parse eval 6/6 recall=1.0; threshold recommender unit-tested; **SCORE_THRESHOLD update pending Tom's labels (not blocking)** | [x] |
| P2.8 | CI: discovery job (uv + ruff + pytest); pipeline tests already in root vitest | CI green | [x] |

## Phase 3 tasks

Checkpoint: approve a tailored application entirely from a phone —
tailored resume + diff + cover letter reviewed at jobs.churong.cc,
approve flips status, artifacts (PDF) ready for the apply agent.

| # | Task | Verification | Status |
|---|---|---|---|
| P3.1 | Tailor stage: overlay generation (Sonnet default, Opus for `dream` flag), grounded on master bank with per-patch `groundedIn` citations | 3 real jobs tailored live (2-4¢/job): overlays mechanically valid, patches cite bullets; Wayve over-reach correctly blocked by verify | [x] |
| P3.2 | Verify-claims: deterministic numeric tripwire + Haiku skeptic; `audit.unsupported` must be `[]` | **adversarial eval 4/4 (3 runs each)**: invented metric (tripwire), leadership, technology all flagged 3/3; clean rephrase 0/3 | [x] |
| P3.3 | Per-application artifacts: overlay served from DB, PDF rendered via existing print pipeline | PDF text-extract contains patched content (ATS re-parse check) | [ ] |
| P3.4 | Review API + review UI (`apps/review` importing @resume/renderer): /inbox, /app/:id (JD ⇄ tailored resume ⇄ diff ⇄ cover letter), approve/edit/reject. **Also: a good/bad label control per job → drives threshold calibration (Tom labels here, not via CSV)** | Playwright E2E through jobs.churong.cc; approve flips DB status; labels persist | [ ] |
| P3.5 | Pipeline wiring: scored ≥ gate → tailor → verify → in_review → Telegram with review link | live: a real job flows scored → in_review with notification | [ ] |
| P3.6 | Answers bank: table + seed (F-1/CPT etc.) + editing in review UI | seed visible/editable; agent API returns answers | [ ] |
| P3.7 | Deploy + checkpoint + **NPM access list enabled (Tom)** | phone approval demo; UI behind auth | [ ] |
