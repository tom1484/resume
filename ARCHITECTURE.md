# Architecture

> **Superseded by the agent docs.** This file used to hold a hand-drawn v1 system
> overview; v2's architecture is documented exhaustively (and accurately, with
> `file:line` citations) in **[`docs/agents/`](docs/agents/README.md)**.

A self-hosted job-application pipeline built on a data-driven résumé, with a single
**Zod contracts package** (`@resume/contracts`) as the source of truth. Jobs are
discovered on a schedule, scored, tailored by an LLM into a reviewable diff, checked
for fabrication, and surfaced in a private dashboard SPA for human approval. A local
apply agent (Phase 4, not yet built) will submit approved applications.

Start here:

- **System map / data flows / container topology** →
  [`docs/agents/architecture.md`](docs/agents/architecture.md)
- **Start-here model + doc map + task router** →
  [`docs/agents/README.md`](docs/agents/README.md)
- **Always-on invariants** → [`CLAUDE.md`](CLAUDE.md)
- **Authoritative contract spec** → [`docs/v2/CONTRACTS.md`](docs/v2/CONTRACTS.md)
- **Rebuild decisions/record** → [`docs/v2/DECISIONS.md`](docs/v2/DECISIONS.md)

Plan of record: [`PROPOSALS.md`](PROPOSALS.md); progress: [`PLAN.md`](PLAN.md);
operator setup: [`PREPARE.md`](PREPARE.md).
