# PREPARE.md — What Tom needs to provide

Setup items for the job pipeline (PROPOSALS.md). Secrets live in
`deploy/.env` (gitignored, mode 600) — never in this file.

## Blocking for Phase 1

- [x] **1. Server deploy path** — this machine (the Mac running docker).
      Docker 29.3.1 · Compose v5.1.2 ✓ (verified 2026-06-07)
- [x] **2. NPM docker network name** — `nginx` ✓ (exists; NPM container
      `nginx-proxy-manager` running on it)
- [~] **3. Subdomain** — `jobs.churong.cc` ✓ DNS resolves (Cloudflare-
      proxied; root domain points at this machine via ddns-go).
      ✓ NPM proxy host created (502 is expected until the `review`
      service exists).
      - [ ] Request Let's Encrypt SSL once `review` is up (needs a
        working upstream); if HTTP-01 fails behind Cloudflare proxy, use
        a Cloudflare origin certificate or DNS-01.
      - [ ] Enable **access list** (user/pass) when service goes live — PII
      - [ ] **Fix the "too many redirects" loop** (observed 2026-06-08):
        Cloudflare SSL/TLS mode is **Flexible** (CF→origin over HTTP)
        while NPM has **Force SSL** on → NPM 301s every request back to
        HTTPS forever. Fix: set Cloudflare SSL/TLS → **Full**, OR turn
        off Force SSL in the NPM proxy host.
- [x] **4. Anthropic API key** — in `deploy/.env` ✓ verified against
      `/v1/models`. Reminder: consider a spend limit on the workspace;
      key was pasted in chat — rotate at will, it's one line in `.env`.
- [x] **5. Telegram bot** — @ChurongJobsBot token + chat ID in
      `deploy/.env` ✓ verified end-to-end (test message delivered
      2026-06-07).

## Phase 3 — ACTION NEEDED before the review UI goes live

The review app (`jobs-api:8080`) is built, deployed, and reachable on the
`nginx` network — but it serves **PII** (your full application history,
tailored resumes, answers) and is currently NOT exposed. To turn it on,
in the nginx-proxy-manager UI:

- [ ] **Create an Access List** (Access Lists → Add): a username + password
      (HTTP Basic). Authorization, satisfy "all".
- [ ] **Point a proxy host at the review app**, with that access list:
      - Easiest: edit the existing `jobs.churong.cc` host → Forward
        Hostname/Port → `jobs-api` / `8080`; Details tab → set the Access
        List. (This replaces the public résumé that's there now; the
        résumé renderer still lives at `jobs.churong.cc/site/`.)
      - Or use a separate hostname (e.g. `apply.churong.cc`) if you want to
        keep a public résumé at `jobs.churong.cc`.
- [ ] SSL: same as before (LE; CF origin cert if HTTP-01 fails).
- [ ] Verify: `https://<host>/` prompts for auth → after login, the review
      inbox loads. Then the **phone-approval checkpoint** is doable.

Until this is done, review only over the internal docker network (verified
working). The nightly pipeline keeps populating it regardless.

## Phase 2 (discovery) — DRAFT, Tom to confirm/edit

Target: **Summer 2027 internships** (confirmed; US recruiting opens
~Aug–Sep 2026 — pipeline will be ready ahead of season).

- [x] **6. Saved searches** (confirmed by Tom, edited 2026-06-07):
  1. **Robotics software** — titles: "Robotics Software Engineer Intern",
     "Robotics Intern"; keywords: ROS 2, C++, motion planning, controls
  2. **Embedded / Edge AI** — titles: "Embedded Software Intern",
     "Firmware Engineer Intern"; keywords: C/C++, RTOS, STM32, edge AI
     (matches Ambarella experience)
  3. **Autonomy / controls** — titles: "Autonomy Intern", "Controls
     Intern"
  4. **Systems SWE (wider net)** — title: "Software Engineer Intern";
     keywords: Rust, C++
  - Locations: United States — Atlanta GA, SF Bay Area, Seattle, Boston,
    Pittsburgh, Austin + Remote US
  - **Exclude-keywords (F-1 reality):** "US citizenship", "security
    clearance", "ITAR", "EAR", senior, staff, unpaid
- [ ] **7. Target companies** (draft list for Greenhouse/Lever/board
      polling — ATS per company verified during Phase 2 setup):
      robotics/autonomy: Boston Dynamics, Agility Robotics, Figure, 1X,
      Dexterity, Nuro, Zoox, Aurora, Applied Intuition, Waymo;
      edge/silicon AI: NVIDIA, Qualcomm, Ambarella (return offer path);
      ML platforms: Scale AI, Anthropic, DeepMind.
      Company flags (stored per company in the jobs DB): `dream`
      (high-effort tier — Sonnet/Opus tailoring, extra review),
      `startup` (early-stage — often Lever/Ashby boards, faster
      processes, more openness to F-1/CPT), `return-path` (Ambarella).
      *Tom: add/remove companies; assign flags.*
- [ ] **8. Proxies** — defer; only if JobSpy gets rate-limited.

## Phase 3 content

- [ ] **9. Master bullet bank** — interview session scheduled when Phase 3
      starts (Claude drafts from resume.json + git history first).
- [~] **10. Answers bank seed:**
  - Work authorization: **F-1 visa** → Summer 2027 internships via **CPT**
    (eligible after 2 semesters at GT); "require sponsorship?" → yes
  - Salary range: `____` (ask later)
  - Notice period / availability: `____` (ask later)
  - Relocation stance: `____` (ask later)
  - Why-company template: `____` (drafted with bullet bank)

## Phase 4 (apply agent, local machine)

- [ ] **11. Dedicated Chrome profile** logged into job-site accounts.
- [ ] **12. Local agent env** — Python + browser-use; bearer token
      (generated at setup); reach `jobs.churong.cc`.

## Generated automatically (no action)

Postgres password, API bearer token — created during setup, stored in
`deploy/.env`.
