# CLAUDE.md

Personal resume site (React + Vite + Tailwind) being extended into a
self-hosted job application pipeline. Plan of record: `PROPOSALS.md`.
**Current phase: 0 — planning done, Phase 1 (workspace restructure +
overlay schema) not started.** Update this line as phases complete.

## Data invariants

- `src/data/resume.json` is canonical and is NEVER mutated by tooling or
  pipeline code. All tailoring goes through overlays: profile selection
  (same shape as `meta.x-profiles`) + RFC-6902 JSON Patches.
- The adapter (`src/data/adapter.js`) must emit exactly the known
  view-model keys — components spread items onto DOM elements.
  `src/data/adapter.test.js` enforces this; don't add keys casually.
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
pnpm validate   # Ajv: JSON Resume schema + extension schema
pnpm test       # vitest (adapter contract tests)
pnpm build      # validate + production build into build/
pnpm pdf        # per-profile PDFs into out/
node scripts/capture.mjs <build-dir> <out-prefix> [query]  # render capture
```
