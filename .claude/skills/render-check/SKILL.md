---
name: render-check
description: Render-regression check for the resume renderer. Use BEFORE any refactor touching src/components, src/data/adapter.js, src/config, or the build setup (capture a baseline), and AFTER the change (diff against baseline — must be empty for pure refactors). Also use to verify intentional render changes profile-by-profile.
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
for p in $(node -e "console.log(Object.keys(require('./packages/renderer/src/data/resume.json').meta['x-profiles']).join(' '))"); do
  node scripts/capture.mjs apps/site/build .render-baseline/$p profile=$p
done
```

Profiles are read from `meta.x-profiles` in `resume.json` — never hardcode
the list. (Once overlay support exists, also capture representative
`application=<id>` fixtures the same way.)

## 2. Make the change, then capture current

Same loop into `.render-current/`.

## 3. Diff

```sh
for p in $(node -e "console.log(Object.keys(require('./packages/renderer/src/data/resume.json').meta['x-profiles']).join(' '))"); do
  diff -q .render-baseline/$p.dom.html .render-current/$p.dom.html \
    && echo "$p: clean" || echo "$p: DRIFT"
done
```

- **Pure refactor (restructure, dedupe, dependency bump):** every profile
  must be `clean`. Any drift = the refactor changed behavior — stop and
  investigate before proceeding.
- **Intentional render change:** inspect each drift with
  `diff .render-baseline/$p.dom.html .render-current/$p.dom.html` and the
  PNGs side by side; confirm only the intended profiles changed, and the
  change matches intent. Then re-baseline (step 1) so the next check starts
  clean.

## Notes

- `.render-baseline/` and `.render-current/` are gitignored artifacts.
- Vite hashes asset filenames (`/assets/index-<hash>.js`); these appear in
  the DOM only via script/link tags outside `#root`, so they don't pollute
  the diff. If a hashed path ever shows up inside `#root`, normalize it
  before diffing rather than accepting the drift.
- Run `pnpm validate && pnpm test` alongside this check — render-check
  covers pixels/DOM, not data contracts.
