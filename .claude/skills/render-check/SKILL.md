---
name: render-check
description: Render-regression check for the resume renderer. Use BEFORE any refactor touching src/components, src/data/adapter.js, src/config, or the build setup (capture a baseline), and AFTER the change (diff against baseline — must be empty for pure refactors). Also use to verify intentional render changes.
---

# render-check

Golden-reference render-regression loop built on `scripts/capture.mjs`.
Each capture writes `<prefix>.dom.html`, `<prefix>.pdf`, `<prefix>.png`.

**Authoritative signal: the DOM diff.** Captures are deterministic for the
same build (verified). PDF bytes ALWAYS differ between runs (embedded
timestamps) — never byte-compare PDFs. PNGs are for human eyeballing only.

## 1. Capture baseline (before the change)

```sh
pnpm build   # output: apps/site/build
mkdir -p .render-baseline
node scripts/capture.mjs apps/site/build .render-baseline/resume
```

There is a single canonical résumé. The static
build renders it from the bundled seed when no API is reachable. To check
a tailored render, also capture an `application=<id>` fixture the same way.

## 2. Make the change, then capture current

Same into `.render-current/resume`.

## 3. Diff

```sh
diff -q .render-baseline/resume.dom.html .render-current/resume.dom.html \
  && echo "clean" || echo "DRIFT"
```

- **Pure refactor (restructure, dedupe, dependency bump):** the résumé
  must be `clean`. Any drift = the refactor changed behavior — stop and
  investigate before proceeding.
- **Intentional render change:** inspect the drift with
  `diff .render-baseline/resume.dom.html .render-current/resume.dom.html`
  and the PNGs side by side; confirm the change matches intent. Then
  re-baseline (step 1) so the next check starts clean.

## Notes

- `.render-baseline/` and `.render-current/` are gitignored artifacts.
- Vite hashes asset filenames (`/assets/index-<hash>.js`); these appear in
  the DOM only via script/link tags outside `#root`, so they don't pollute
  the diff. If a hashed path ever shows up inside `#root`, normalize it
  before diffing rather than accepting the drift.
- Run `pnpm validate && pnpm test` alongside this check — render-check
  covers pixels/DOM, not data contracts.
