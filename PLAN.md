# PLAN.md — Job Pipeline Progress Tracker

Plan of record: [PROPOSALS.md](PROPOSALS.md) · Setup checklist:
[PREPARE.md](PREPARE.md)

**Rule:** statuses here are updated in the same commit as the work they
describe. A task is checked only when its verification column passed.

Legend: `[ ]` pending · `[~]` in progress · `[x]` done (verified)

## Phase overview

| Phase | Scope (details in PROPOSALS.md §8) | Status |
|---|---|---|
| 1 | Workspace split, overlay contract, master bank draft, compose skeleton | **in progress** |
| 2 | Discovery (JobSpy + boards) + scoring + calibration | pending |
| 3 | Tailoring + verify + review app + notifier | pending |
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
| T8 | Close out: PLAN/CLAUDE/PREPARE/memory updated | final push, CI green | [~] |

Post-checkpoint (Tom): request Let's Encrypt cert + enable NPM access list
(PREPARE.md item 3).

## Phase 2+ (not yet planned in detail)

Planned per PROPOSALS.md §8; task breakdown will be added here when each
phase starts.
