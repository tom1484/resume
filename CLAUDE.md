# CLAUDE.md

Personal resume site (React + Vite + Tailwind) being extended into a
self-hosted job application pipeline. Plan of record: `PROPOSALS.md`.
**Current phase: 3 functionally done (tailor → verify → in_review →
review app + answers bank, all live on the internal net) — only P3.7
remains: Tom enables the NPM access list so the review UI can go public
(steps in PREPARE.md). Phase 4 (local apply agent) is next.**
Update this line as phases complete.

Services: `services/discovery` (Python), `services/pipeline` (Node ESM:
parse/score/tailor/verify/poller), `services/api` (Fastify review API +
SPA host, container `review-api`). Frontends: `apps/site` (renderer),
`apps/review` (review SPA). Migrations in `services/pipeline/migrations`.
Anti-fabrication is load-bearing: verify.js numeric tripwire + skeptic,
drop-unsupported-patches policy in tailorJob.js — never weaken without
re-running `eval/run-verify-eval.js`.

LLM stages run on Haiku (`claude-haiku-4-5`) per the approved cost plan;
golden-set eval: `services/pipeline/eval/run-parse-eval.js` (live API,
~2¢ — run before landing any prompt change). SCORE_THRESHOLD calibration
pending Tom's labels in `out/calibration.csv`.

## Layout

pnpm workspace: `apps/site` (Vite app: bootstrap, css, public assets),
`packages/renderer` (components, config, contexts, hooks, data — consumed
via Vite aliases `@components/@config/@contexts/@hooks/@data/@utils`),
`services/*` (pipeline services, added per phase), `scripts/` (root tooling),
`deploy/` (compose + secrets). Build output: `apps/site/build`.

## Data invariants

- `packages/renderer/src/data/resume.json` is canonical and is NEVER
  mutated by tooling or pipeline code. All tailoring goes through overlays:
  profile selection (same shape as `meta.x-profiles`) + RFC-6902 JSON
  Patches.
- The adapter (`packages/renderer/src/data/adapter.js`) must emit exactly
  the known view-model keys — components spread items onto DOM elements.
  `adapter.test.js` enforces this; don't add keys casually.
- Every JSON artifact (resume, overlays, job records, master bank) must
  pass Ajv validation (`pnpm validate`) before commit.

## Verification rules (binding)

- Code and its test land in the same change — never "tests later."
- After editing `resume.json` or any schema: `pnpm validate && pnpm test`.
- Before any renderer or structure refactor: capture a render baseline and
  show an empty DOM diff after — use the `render-check` skill.
  (PDF bytes always differ due to embedded timestamps; DOM diff is the
  authoritative signal.)
- Any change to an LLM pipeline prompt/skill requires the golden-set eval
  to pass, including the fabrication-injection test (zero unsupported
  claims). No exceptions.

## Safety constraints (override convenience, always)

- Never run logged-in job-platform automation from the server. The apply
  agent runs on Tom's local machine only.
- Submission is always human-confirmed. ≤50 applications/day, jittered
  pacing. 2FA/CAPTCHA always pauses for a human.
- Application data is PII: stays on Tom's server, review UI stays behind
  nginx proxy manager auth, no third-party vector DBs.

## Deployment

- Docker compose on Tom's server. Web-facing services join nginx proxy
  manager's external docker network; **no exposed ports**. `review` is the
  only web-facing service.

## Commands

```sh
pnpm validate   # Ajv: JSON Resume schema + extension schema (+ overlays)
pnpm test       # vitest across workspace packages
pnpm build      # validate + production build into apps/site/build/
pnpm pdf        # per-profile PDFs into out/
node scripts/capture.mjs <build-dir> <out-prefix> [query]  # render capture
```
