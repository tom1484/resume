# Architecture

A self-hosted job-application pipeline built on a data-driven résumé. Jobs
are discovered nightly, scored, tailored by an LLM into a reviewable diff,
checked for fabrication, and surfaced in a private web UI for human approval.
A local apply agent (Phase 4, not yet built) will submit approved
applications. Plan of record: [PROPOSALS.md](PROPOSALS.md); progress:
[PLAN.md](PLAN.md); operator setup: [PREPARE.md](PREPARE.md).

## End-to-end flow

```
                         ┌──────── server (docker compose, project "job-pipeline") ────────┐
                         │                                                                  │
  job boards ─┐          │  jobs-discovery (Python, supercronic 09:00 Asia/Taipei)          │
  Greenhouse  │ nightly  │    Greenhouse/Lever/Ashby board APIs + JobSpy (Indeed)           │
  Lever       ├─────────▶│    normalize → uniform schema → dedupe → upsert                  │
  Ashby       │          │                         │                                        │
  Indeed      ┘          │                         ▼                                        │
                         │  ┌────────────┐   jobs table (status: new)                        │
                         │  │  jobs-db   │◀────────┐                                         │
                         │  │ Postgres   │         │                                         │
                         │  │ +pgvector  │   jobs-pipeline (Node, poller every 60s)          │
                         │  │            │   new → parse_jd(Haiku) → score → status=scored   │
                         │  │ jobs       │   scored ≥ gate → tailor(Sonnet/Opus)             │
                         │  │ events     │              → verify_claims(Haiku, drop bad)     │
                         │  │ answers    │              → status=in_review                   │
                         │  └────────────┘         │        │                                │
                         │                         │        └─▶ Telegram: "N ready to review"│
                         │                         ▼                                         │
                         │  jobs-api (Fastify) ── serves ──┬─ review SPA  (apps/review) at /  │
                         │   jobs+answers+résumé versions  ├─ résumé renderer at /resume/     │
                         │                                 └─ /applications/:id/overlay.json  │
                         │         ▲                                                          │
                         └─────────┼──────────────────────────────────────────────────────┘
                                   │ nginx network (no published ports)
                          nginx-proxy-manager  ──TLS + Access List──▶  https://jobs.churong.cc
                                   │
                                   ▼
                              you (review / approve / label, from any device)
                                   │ approved
                                   ▼
                   ┌── Phase 4 (NOT BUILT) ── your Mac, real Chrome profile ──┐
                   │  apply agent: pull approved → fill form (answers bank,    │
                   │  upload PDF) → PAUSE for your OK → submit → report status │
                   └──────────────────────────────────────────────────────────┘
```

## Repository layout (pnpm workspace)

```
resume/
├── data/resume.json          JSON Resume SEED (repo root; DB is the live source — see
│                             below). git-export target; `pnpm export-seed` refreshes it.
├── packages/renderer/        @resume/renderer — the résumé as data + components
│   └── src/
│       ├── data/
│       │   ├── extensions.schema.json x-* extension schema (academic fields)
│       │   ├── master.json            bullet bank: every claim, with stable ids (RAG grounding)
│       │   ├── master.schema.json
│       │   ├── overlay.schema.json    the tailoring contract (profile + RFC-6902 patches)
│       │   ├── adapter.js             resume.json → component view models (key contract)
│       │   ├── profiles.js            buildProfileFrom: assemble selected sections (overlay)
│       │   ├── overlay.js             applyOverlay: patch a clone, rebuild, never mutate
│       │   ├── editorModel.js         résumé/overlay ⇄ editor tree (treeToResume / editorTreeToOverlay)
│       │   ├── print.js               meta.print → @page CSS + Playwright pdf options
│       │   └── index.js               data API: registerResume / registerApplication / getResumeDoc
│       ├── editor/ResumeTree.jsx      shared dnd-kit structured editor (résumé + overlay modes)
│       ├── components/  config/  contexts/  hooks/   the renderer
│       └── index.js                   package barrel
│
├── apps/site/                the résumé site (Vite), served at /resume/
│   └── src/{index.jsx (routes: /resume, ?application=), App.jsx, ResumeEditor.jsx}
│
├── apps/review/              the review SPA (Vite) at /. hash routes: #/, #/app/:id, #/answers
│   └── src/{App.jsx, Editor.jsx (overlay editor modal), api.js, style.css}
│
├── services/
│   ├── discovery/            Python/uv — board fetchers + JobSpy, normalize, dedupe, upsert
│   │   ├── src/discovery/{boards,jobspy_search,normalize,store,main}.py
│   │   └── config/{searches.yml, companies.yml}   saved searches + verified board slugs
│   ├── pipeline/             Node ESM — the LLM pipeline + worker
│   │   ├── migrations/       001 jobs+events · 002 overlay/labels/answers · 003 answers seed · 004 resume_versions
│   │   ├── src/
│   │   │   ├── parseJd.js    structured JD extraction (Haiku)
│   │   │   ├── score.js      0.5·keyword(fuzzy) + 0.3·llmFit + 0.2·structural
│   │   │   ├── tailor.js     overlay generation (Sonnet; Opus for dream flag)
│   │   │   ├── verify.js     numeric tripwire + LLM skeptic (anti-fabrication)
│   │   │   ├── tailorJob.js  tailor→verify→persist, drop-unsupported-patches policy
│   │   │   ├── cycle.js      one poll cycle (claim → parse → score → gate → tailor)
│   │   │   ├── poller.js     long-running loop · run-once.js · tailor-one.js (manual)
│   │   │   ├── llm.js  db.js  profile.js  notify.js  migrate.js
│   │   │   └── *.test.js     scoring/verify/tailor/notify unit tests
│   │   └── eval/             golden-jds.json + run-{parse,verify,tailor}-eval.js (live, gate prompt changes)
│   └── api/                  Fastify — review API + static host (jobs-api)
│       └── src/server.js
│
├── scripts/                  validate.mjs (schemas + overlays) · print-pdf.mjs · capture.mjs · export-seed.mjs (DB → data/resume.json)
├── deploy/
│   ├── docker-compose.yml    the 4-service stack (db, discovery, pipeline, api)
│   └── .env                  secrets (gitignored): DB pw, ANTHROPIC_API_KEY, Telegram
├── .github/workflows/ci.yml  validate + lint (eslint) + vitest + build + PDF; discovery (uv/ruff/pytest)
└── CLAUDE.md  PLAN.md  PREPARE.md  PROPOSALS.md
```

## Running services (docker compose, all `restart: unless-stopped`)

| Container | Role | Network | Exposed? |
|---|---|---|---|
| `jobs-db` | Postgres 17 + pgvector | internal | no |
| `jobs-discovery` | nightly cron discovery (supercronic, `init: true`) | internal | no |
| `jobs-pipeline` | poller: parse → score → tailor → verify | internal | no |
| `jobs-api` | review API + SPA + résumé renderer | internal + nginx | via NPM (auth) |

Web exposure is exclusively through nginx-proxy-manager on the external
`nginx` network; **no service publishes host ports**. `jobs.churong.cc` →
`jobs-api:8080`, behind a TLS cert + HTTP-basic Access List. Postgres,
discovery, and the pipeline are unreachable from outside the host.

## Data model (Postgres)

- **jobs** — one row per discovered posting. Uniform schema + `parsed`
  (LLM-extracted requirements), `score` + `score_breakdown`, `overlay`
  (tailoring) + `cover_letter` + `audit`, `company_flags` (dream/startup/
  return-path), `label` (good/bad, calibration), `status`, `dedupe_key`.
- **events** — one row per pipeline stage per job: stage, model, tokens,
  `cost_usd`, duration, ok, detail. The cost/observability ledger.
- **answers** — application answers (work auth, salary, …): a seeded set
  plus custom Q&A added/edited/deleted in the review UI (`/answers`), read
  by the future apply agent.
- **resume_versions** — the canonical résumé, one row per save (latest =
  current; full history). Seeded from `resume.json` on first read.

Status lifecycle: `new → parsing → scored → in_review → approved →
applying → applied → responded | rejected | skipped | error`.

## Key design decisions

- **The canonical résumé is DB-backed and editable.** `resume_versions`
  (latest row = current); `data/resume.json` (repo root) is the seed +
  git-export target + bundled fallback (CI/PDF); `pnpm export-seed` refreshes
  it from the live DB. The `/resume` route renders it and offers a
  structured editor (drag reorder, rephrase, delete) + JSON + Print tabs +
  Export/Import, saving new versions via `PUT /api/resume` (full history). No
  profiles — a single résumé; per-job section selection lives only in the
  overlay. The pipeline reads the current résumé from the DB each cycle
  (`refreshResume`), so web edits flow into tailoring without a redeploy.
- **Print config (`meta.print`)** — paper size, margins, scale; global on the
  résumé, inherited by applications. Drives an `@page` rule (browser print)
  and Playwright `page.pdf` (PDF pipeline).
- **Tailoring is a structured overlay** — section selection + RFC-6902
  patches — applied to a clone at render time. Every change is a reviewable
  diff; the review app edits it in a modal (shared dnd-kit editor). Reviewer
  edits are trusted; only LLM-written patches go through the fabrication
  verify.
- **Anti-fabrication is load-bearing.** `verify.js` runs a deterministic
  numeric tripwire (any number in a patch absent from its cited master
  bullets = automatic reject) plus an LLM skeptic. `tailorJob.js` then
  *drops* any unsupported patch, so an overlay reaching review always has
  `audit.unsupported == []` — you never see an invented bullet. Guarded by
  `eval/run-verify-eval.js` (4/4 adversarial cases); do not weaken without
  re-running it.
- **Model tiering** (cost plan): Haiku for bulk parse/score/verify,
  Sonnet for tailoring, Opus for `dream`-flagged companies.
- **Embeddings/pgvector deferred.** The ~40-bullet master bank fits whole in
  a prompt; retrieval adds latency without value at this scale. The column
  exists for when the bank grows ~10×.
- **The server never logs into job platforms.** Discovery uses public board
  APIs + JobSpy (Indeed). All credentialed actions are Phase 4, local-only.

## CI

`.github/workflows/ci.yml`: validate (schemas + overlays) → vitest (renderer
+ pipeline) → build → `out/resume.pdf`; separate job runs discovery's
uv/ruff/pytest. Live LLM evals are NOT in CI (they cost API spend) — run
them manually before changing a prompt.
