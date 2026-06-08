# Job Pipeline — Architecture Plan (Proposal B: Self-Hosted Service)

A self-hosted, end-to-end job application pipeline built around this resume
repo: automated job discovery → LLM resume tailoring → human review on a
private web UI → human-in-the-loop submission. Designed for volume (the
current market demands hundreds of quality applications), deployed as a
single docker compose stack on the existing server behind nginx proxy
manager.

Implementation is Claude Code-driven throughout: Claude Code builds the
system, and the Claude Agent SDK (with skills versioned in-repo) *is* the
LLM runtime for parsing, scoring, tailoring, and verification.

---

## 1. Principles

1. **`resume.json` stays canonical.** The existing JSON Resume v1.0.0
   document with `x-` extensions remains the single source of truth. The
   pipeline never mutates it.
2. **Tailoring output is an overlay, never a rewrite.** Per-job output is a
   structured diff: a generated profile definition (item selection/ordering,
   same shape as `meta.x-profiles`) plus RFC-6902 JSON Patch operations
   against `resume.json` for description tweaks. Structured diffs make the
   anti-fabrication audit mechanical and the review UX a readable diff.
3. **RAG-grounded, verify-passed tailoring.** The LLM may only rephrase,
   reorder, or quantify content present in the master bullet bank. A second
   verification pass diffs every claim against the master; zero invented
   facts is the bar.
4. **The server never touches LinkedIn with credentials.** Discovery,
   tailoring, and review run on the server. The apply agent runs on a local
   machine in a real Chrome profile, pauses before every submit.
   (Cloud-IP logins are the #1 account-ban cause; LinkedIn automation is
   ToS-fragile regardless — prefer Greenhouse/Lever/company portals.)
5. **No exposed ports.** All web-facing services join the external nginx
   proxy manager docker network and are reverse-proxied by NPM with access
   control. Internal services (Postgres, workers) stay on a private compose
   network only.

---

## 2. System overview

```
┌─ server: docker compose ───────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────┐   ┌──────────────────────────────────────────────┐  │
│  │ Postgres       │   │ discovery worker (Python)                    │  │
│  │ + pgvector     │◄──┤ JobSpy (LinkedIn/Indeed/Glassdoor/Google)    │  │
│  │                │   │ + Greenhouse/Lever public board APIs         │  │
│  │ jobs           │   │ cron-in-container, dedupe, normalize         │  │
│  │ applications   │   └──────────────────────────────────────────────┘  │
│  │ answers_bank   │                                                     │
│  │ events         │   ┌──────────────────────────────────────────────┐  │
│  │ bullet_vecs    │◄──┤ pipeline worker (TS, Claude Agent SDK)       │  │
│  └──────┬─────────┘   │ parse_jd → retrieve → score → gate           │  │
│         │             │ → tailor overlay → verify claims             │  │
│         │             │ → render PDF/DOCX → notify                   │  │
│         │             └──────────────────────────────────────────────┘  │
│         │                                                               │
│  ┌──────▼─────────────────────────────┐   ┌───────────────────────┐    │
│  │ review app (API + web UI)          │   │ notifier              │    │
│  │ reuses this repo's renderer        │   │ Telegram bot / email  │    │
│  │ /inbox /app/<id> approve|edit|skip │   └───────────────────────┘    │
│  └──────┬─────────────────────────────┘                                │
│         │ joins npm network (no exposed ports)                         │
└─────────┼───────────────────────────────────────────────────────────────┘
          │ https://jobs.<domain> via nginx proxy manager
          ▼
   you review on any device
          │ approve
          ▼
┌─ local machine ─────────────────────────────────────────────────────────┐
│  apply agent (browser-use, real Chrome profile)                         │
│  pull approved queue via API → fill forms (answers bank, file upload)   │
│  → screenshot → WAIT FOR HUMAN OK → submit → report status back         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data model

### 3.1 Master profile

| Artifact | Role |
|---|---|
| `src/data/resume.json` | Canonical curated resume (unchanged role) |
| `src/data/master.json` (new) | Bullet bank: full long-form history — every project, metric, tech stack, including content too verbose for any rendered variant. Grounding corpus for RAG and the verification pass. |

Each bullet in `master.json` gets a stable id; embeddings are computed per
bullet and stored in `bullet_vecs` (refreshed when the file changes,
detected by content hash).

### 3.2 Job record (uniform schema)

```jsonc
{
  "id": "gh-acme-12345",
  "source": "greenhouse",          // jobspy:linkedin | jobspy:indeed | greenhouse | lever | manual
  "company": "Acme",
  "title": "Robotics Software Engineer",
  "location": "Remote (US)",
  "remote": true,
  "url": "https://...",
  "postedAt": "2026-06-05",
  "jdText": "...",
  "parsed": {                       // LLM-extracted, structured
    "hardSkills": [], "softSkills": [],
    "mustHaves": [], "niceToHaves": [],
    "responsibilities": [], "seniority": "mid"
  },
  "score": 0.78,                    // 0.5*keyword + 0.3*semantic + 0.2*structural
  "status": "in_review"             // new → parsed → scored → tailored → in_review
                                    // → approved → applying → applied → responded | rejected | skipped
}
```

Dedupe key: normalized `(company, title, location)` + URL canonicalization.

### 3.3 Application overlay (the tailoring contract)

```jsonc
// applications/<job-id>/overlay.json
{
  "jobId": "gh-acme-12345",
  "profile": {                      // same shape as meta.x-profiles entries
    "sections": ["experiences", "projects", "skills", "education"],
    "filters": { "projects": { "tagsAnyOf": ["robotics", "control"] , "limit": 3 } }
  },
  "patches": [                      // RFC-6902 against resume.json — reviewable diff
    { "op": "replace", "path": "/work/0/highlights/1", "value": "..." }
  ],
  "coverLetter": "...",
  "audit": {                        // verification pass output
    "claims": [ { "patchIndex": 0, "groundedIn": ["master:bullet-42"], "verdict": "supported" } ],
    "unsupported": []               // must be empty to enter review
  }
}
```

Rendered artifacts per application: `resume.pdf` (existing
`scripts/print-pdf.mjs` logic, extracted into a shared lib), `resume.docx`
(docxtpl, single-column ATS-clean template — ATS parse DOCX best).

### 3.4 Answers bank

Templated responses to recurring custom questions ("salary expectations",
"work authorization", "why this company"), stored in Postgres, lightly
tailored per job by the pipeline, editable in the review UI. The apply agent
never free-generates an answer it hasn't shown you.

---

## 4. Services (docker compose)

| Service | Stack | Networks | Notes |
|---|---|---|---|
| `db` | postgres:17 + pgvector | `internal` | Volume-backed; pgcrypto for PII at rest; HNSW index on bullet vectors |
| `discovery` | Python (JobSpy, httpx) | `internal` | Cron-in-container (e.g. supercronic). JobSpy via tls-client; 3–10 s jittered delays; optional proxy rotation. Greenhouse/Lever board APIs polled directly (no protection, JSON-LD/REST) |
| `pipeline` | TypeScript, Claude Agent SDK | `internal` | Queue consumer over the `jobs` table (`SELECT ... FOR UPDATE SKIP LOCKED` — no separate broker needed). Skills from `.claude/skills/` |
| `renderer` | Node + Playwright (this repo) | `internal` | Renders overlay → PDF via the existing print pipeline; DOCX via a small Python sidecar or docx lib |
| `review` | API (Fastify/FastAPI) + web UI | `internal`, `npm` | The only web-facing service. UI reuses this repo's components: `?application=<id>` renders the tailored resume |
| `notifier` | tiny worker | `internal` | Telegram bot: "7 new matches ≥ 70% — review at https://jobs.…" |

```yaml
# compose sketch — networking pattern
networks:
  internal: {}
  npm:
    external: true            # nginx proxy manager's network

services:
  db:
    image: pgvector/pgvector:pg17
    networks: [internal]
    volumes: [dbdata:/var/lib/postgresql/data]

  review:
    build: ./services/review
    networks: [internal, npm]   # NPM proxies to http://review:8080 — no ports exposed
    environment:
      - DATABASE_URL=postgres://...@db/jobs

  # discovery / pipeline / renderer / notifier: internal only
```

NPM config: new proxy host `jobs.<domain>` → `review:8080`, with access
list or forward-auth (the data is PII — resume, application history). The
apply agent on the local machine reaches the API through the same NPM
hostname with a bearer token.

Secrets (`ANTHROPIC_API_KEY`, DB password, Telegram token, API bearer
token) via `.env` / compose secrets, never in images.

---

## 5. Pipeline (per job)

```
new job ──► 1 parse_jd        Haiku, structured output → parsed{}        (~0.1–0.5¢)
        ──► 2 retrieve        pgvector top-K bullets vs JD embedding
        ──► 3 score           0.5*keyword(Levenshtein ≤2, JD's exact phrasing)
                              + 0.3*semantic cosine + 0.2*structural
                              must-haves weighted 3× nice-to-haves
        ──► 4 gate            score < threshold (start 0.65) → status: skipped
        ──► 5 tailor          Sonnet/Opus, RAG-grounded, temp 0.2–0.4
                              → overlay.json (profile + patches + cover letter)
        ──► 6 verify          second LLM pass: diff every patch against
                              master.json; any unsupported claim → reject & retry,
                              twice failed → flag for manual tailoring
        ──► 7 render          PDF + DOCX
        ──► 8 notify          status: in_review, Telegram link
```

Every stage writes an `events` row (timing, model, cost, result) —
observability and the evaluation data come for free.

**Claude Code integration.** Stages 1, 5, 6 are skills in `.claude/skills/`
(`parse-jd`, `tailor-overlay`, `verify-claims`) executed via the Agent SDK
with enforced output schemas. The same skills run interactively in Claude
Code for debugging: `claude "/tailor-overlay gh-acme-12345"` reproduces a
production run against the live DB. Prompts are code-reviewed and versioned
with the repo.

Anti-hallucination system prompt (fixed): *"You may ONLY rephrase, reorder,
or quantify accomplishments explicitly present in the master profile. Never
invent metrics, technologies, dates, or titles. If the JD requires a skill
the candidate lacks, omit it."*

---

## 6. Review app

Routes:

- **`/inbox`** — scored queue, sorted by match; filters by source/score/status;
  batch-skip.
- **`/app/<id>`** — three panes: JD (must-haves highlighted) ⇄ rendered
  tailored resume (this repo's components, overlay applied) ⇄ patch diff
  vs `resume.json` with grounding refs from the audit. Cover letter below.
  Actions: **Approve** · **Edit overlay** (JSON editor with live re-render,
  like the existing Cmd/Ctrl+D config panel) · **Reject + reason** (reasons
  feed prompt iteration).
- **`/stats`** — funnel: applications by week, response rate by source /
  score band / resume variant. Decision thresholds from the report encoded
  as visible alerts: *< 5% response after 100 tailored apps → fix the master
  resume, not the tailoring.*

The renderer components, theme system, and print CSS come from this repo —
extract `src/components`, `src/data/adapter.js`, and the profile logic into
a shared workspace package so the resume site and the review app consume the
same code.

---

## 7. Apply agent (local machine only)

- **Substrate:** browser-use running in the real local Chrome profile
  (fallback: Claude Code driving Playwright MCP interactively for new/odd
  portals).
- **Loop:** poll `GET /api/queue/approved` → download PDF/DOCX → navigate →
  fill (answers bank for custom questions; `upload_file` for documents) →
  **screenshot + pause for explicit human OK → submit** → `POST` status +
  confirmation screenshot.
- **Portal order:** Greenhouse/Lever first (simple, stable forms) → company
  Workday tenants (multi-step but rarely fingerprinted) → LinkedIn Easy
  Apply last, if at all.
- **Throttles (hard rules):** ≤ 50/day total, jittered 3–10 s pacing, spread
  across the day, never overnight batches. **If LinkedIn flags the account
  once: all LinkedIn automation stops for 30 days** (manual or
  autofill-only).
- 2FA/CAPTCHA: always pause for human input — never auto-solve.

---

## 8. Build phases

**Phase 1 — Foundation (≈ week 1)**
- Repo restructure: pnpm workspace (`apps/site` = current resume app,
  `packages/renderer` = shared components/adapter/profiles, `services/*`).
- `master.json` bullet bank + schema; overlay schema
  (`overlay.schema.json`) + Ajv validation alongside the existing setup.
- Apply-an-overlay support in the renderer + `?application=<id>` route.
- Compose stack skeleton: `db` + `review` (stub) joined to the NPM network;
  proxy host + auth configured.
- ✅ *Checkpoint: a hand-written overlay renders as a tailored resume at
  `https://jobs.<domain>/app/test`.*

**Phase 2 — Discovery + scoring (≈ week 2)**
- Discovery worker: JobSpy queries (3–5 saved searches) + Greenhouse/Lever
  boards of target companies; dedupe; `jobs` table.
- Embedding refresh job; `parse-jd` skill; scoring; calibrate the threshold
  on 20–50 hand-labeled good/bad matches.
- ✅ *Checkpoint: inbox fills nightly with scored jobs.*

**Phase 3 — Tailoring + review (≈ weeks 3–4)**
- `tailor-overlay` + `verify-claims` skills via Agent SDK; renderer service
  (PDF + DOCX); notifier.
- Review app fully functional: inbox, three-pane review, overlay editor,
  approve/reject.
- ✅ *Checkpoint: approve a tailored application entirely from a phone.*

**Phase 4 — Submission (≈ week 5)**
- Apply agent on the local machine; answers bank; status reporting.
- First ~20 applications driven semi-interactively (Claude Code + Playwright
  MCP) to learn portal quirks; then promote stable portals to browser-use.
- ✅ *Checkpoint: approved → applied with one human confirmation per submit.*

**Phase 5 — Hardening (ongoing)**
- `/stats` funnel; per-stage cost tracking from `events`.
- Evaluation harness on every prompt change: before/after match score,
  embedding-similarity delta (target +0.05–0.15), truthfulness diff
  (zero unsupported claims).
- Cost guardrail: if tailoring spend > $50/mo, demote long-tail tailoring to
  Haiku; reserve Sonnet/Opus for the top ~20% of matches.

---

## 9. Cost & risk summary

| Item | Estimate / stance |
|---|---|
| LLM cost | ≈ $20–40/mo at ~1000 jobs scanned, ~100 tailored (Haiku bulk, Sonnet/Opus top matches) |
| Proxies | $0 to start; add rotation only if JobSpy gets rate-limited |
| Server | Existing box; stack is ~6 light containers + Postgres |
| LinkedIn ToS | Logged-in automation violates the User Agreement; mitigated (local profile, throttles, human submit) but never zero — prefer Greenhouse/Lever/company portals |
| PII | All data on own server; pgcrypto at rest; review UI behind NPM auth; Anthropic API retains prompts per its policy — no third-party vector DB |
| Fabrication | Structurally prevented: overlay-only output + grounded verify pass + human review of every diff |

---

## 10. Setup checklist (owner: Tom)

### Required before Phase 1

| # | Item | How to obtain | Used by |
|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` | console.anthropic.com → create a dedicated workspace (e.g. `job-pipeline`) → API key. Set a monthly spend limit (~$50). Note: the Claude Code subscription does **not** cover Agent SDK calls from the server — this key is billed usage. | pipeline worker, apply agent |
| 2 | Server deploy path | Decide: (a) SSH host alias so Claude Code can run `docker compose` remotely, or (b) git-pull + manual `compose up` by you. Confirm docker engine + compose v2 versions. | deployment |
| 3 | NPM network name | `docker network ls` on the server — the external network nginx proxy manager sits on (often `npm_default`). | compose file |
| 4 | Subdomain + proxy host | Pick the hostname (e.g. `jobs.<domain>`), add DNS record → server. In NPM UI: proxy host → `review:8080`, Let's Encrypt SSL, **access list enabled** (PII behind auth). | review app |
| 5 | Telegram bot | @BotFather → `/newbot` → `TELEGRAM_BOT_TOKEN`. Then message the bot once; chat id read from `getUpdates` (scripted during setup). | notifier |

### Required for Phase 2

| # | Item | Notes |
|---|---|---|
| 6 | Search definitions | 3–5 saved searches: titles, locations, remote preference, seniority, exclude-keywords. |
| 7 | Target company list | 10–30 companies whose Greenhouse/Lever boards to poll (slugs discoverable during setup). |
| 8 | Proxies (optional) | Defer until JobSpy gets rate-limited. |

### Content (Phases 1–3)

| # | Item | Notes |
|---|---|---|
| 9 | Master bullet bank | Drafted from `resume.json` + git history; gaps filled in an interview-style session (full project list, metrics, tech stacks). |
| 10 | Answers bank seed | Work authorization / visa status per target region, salary range, notice period, relocation stance, why-company template, links. |

### Phase 4 (local machine)

| # | Item | Notes |
|---|---|---|
| 11 | Chrome profile | Dedicated local Chrome profile, logged into job-site accounts. |
| 12 | Local agent env | Python + browser-use; `ANTHROPIC_API_KEY`; API bearer token (generated, in server `.env` and local config); reachability of `jobs.<domain>`. |

Generated automatically (no action): Postgres password, API bearer token —
created at setup, stored in server-side `.env` / compose secrets.

---

## 11. Verification strategy

Layered; every task is "done" only when its layer-relevant checks pass.

| Layer | What | Tooling |
|---|---|---|
| L0 static | All JSON artifacts (job records, overlays, master bank) Ajv-validated against schemas; lint | extends existing `scripts/validate.mjs` pattern |
| L1 unit | Overlay application, scoring math, dedupe, patch dry-runs | vitest (existing) |
| L2 LLM evals | Golden sets + thresholds for every skill; re-run on any prompt change | eval harness, results in `events` |
| L3 integration | Compose stack healthchecks + smoke scripts per service | docker compose, healthcheck + `smoke.sh` |
| L4 E2E | Browser flows through the real NPM hostname | Playwright (already a dep) |
| L5 human checkpoint | The ✅ demo at each phase end | Tom |

**Per-phase loops:**

- **Phase 1 (restructure must be invisible):** capture render baseline
  (existing `scripts/capture.mjs`) for all profiles *before* the workspace
  split; after, DOM/pixel-diff must be empty. Existing
  validate/test/build/pdf all green. Overlay schema: valid+invalid fixtures.
  Identity property: empty overlay renders byte-identical to its profile.
  E2E: `?application=test` shows patched text; curl via NPM → 401 unauthed,
  200 authed.
- **Phase 2 (discovery/scoring):** live smoke against 2–3 Greenhouse/Lever
  boards (assert inserts, schema-valid); recorded fixtures for CI (no
  scraping in CI); dedupe = run twice, zero dupes. `parse-jd`: ~10 real JDs
  with hand-checked expected must-haves (recall asserted). Scoring:
  calibrate on 20–50 labeled pairs; assert ranking quality before fixing
  the gate threshold. Embedding round-trip: a bullet's own text retrieves
  itself top-1.
- **Phase 3 (tailoring/review):** the critical adversarial test — inject a
  fixture overlay containing a fabricated claim → `verify-claims` MUST flag
  it (and a clean overlay must pass). Tailor eval per golden JD: overlay
  validates, patches apply cleanly, `audit.unsupported == []`, match-score
  delta > 0, embedding-similarity delta in +0.05–0.15. ATS re-parse test:
  render PDF/DOCX → extract text (`pdftotext`/docx read-back) → assert
  name/email/patched bullets present (simulates dumb ATS parsing). Review
  E2E: approve flips DB status; edit re-renders; reject records reason.
  Telegram: automated 200-assert + one human "received" confirmation.
- **Phase 4 (apply agent):** local fixture replicas of Greenhouse/Lever
  forms for automated runs; **dry-run mode** (fill + screenshot, never
  submit) reviewed by Tom; first real submission supervised live. Rate
  limiter unit-tested (≤50/day, jitter). Status POST asserted in DB.
- **Phase 5:** eval harness wired into CI — prompt/skill changes blocked
  unless golden-set thresholds and zero-fabrication audit pass.

**Needs human verification (cannot be automated):** Telegram delivery
(once), NPM/DNS configuration (verified by external curl after Tom sets
it), the first real application per portal.

---

## Appendix: alternatives considered

- **A — Repo-native (git as DB, PRs as review):** minimal infra, great audit
  trail; rejected as primary because git-as-DB and PR review don't scale to
  high application volume, and funnel metrics are essential in this market.
- **C — Agent-native (Claude Code orchestrates everything):** least code,
  fastest to evolve; rejected as primary due to unattended-robustness and
  per-run cost concerns. Retained where it shines: skills as the prompt
  layer, and interactive Claude Code + Playwright MCP as the on-ramp for
  new application portals.
