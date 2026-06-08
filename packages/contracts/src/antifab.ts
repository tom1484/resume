// §11 Anti-fabrication invariants (verbatim, binding).
//
// Load-bearing; never weaken without re-running eval/run-verify-eval.js.
//
// Anti-fabrication 3-layer chain (DECISIONS must-preserve):
//   1. generation constraint  — master-bank-only, replace-only patches, required
//      groundedIn (tailor.js:66-97; ≤4 patches).
//   2. numeric tripwire       — extract numbers from a patch value; any number
//      not present in the cited master-bank source text auto-fails; YEARS
//      2019–2030 are EXCLUDED from the tripwire (verify.js:19-32, the :29 skip);
//      unknown-id / empty-grounding also auto-fail (verify.js:61-65).
//   3. drop policy            — audit.unsupported === [] BY CONSTRUCTION at
//      in_review; patchIndex renumbered after drop (tailorJob.js:36-48).
// Reviewer edits BYPASS the chain (trusted; editorModel.js:94 writes
// audit:{claims:[],unsupported:[]}).

/** Max LLM-authored patches per tailoring pass (tailor.js generation constraint). */
export const MAX_TAILOR_PATCHES = 4;

/**
 * Years excluded from the numeric tripwire (verify.js:29). A bare 4-digit year
 * in this inclusive range is NOT treated as a fabricated metric.
 */
export const TRIPWIRE_YEAR_MIN = 2019;
export const TRIPWIRE_YEAR_MAX = 2030;

/** True if `n` is a 4-digit year inside the tripwire exclusion window. */
export function isExcludedYear(n: number): boolean {
  return (
    Number.isInteger(n) && n >= TRIPWIRE_YEAR_MIN && n <= TRIPWIRE_YEAR_MAX
  );
}

/**
 * Extract candidate numeric tokens from text for the tripwire, dropping years in
 * the 2019–2030 exclusion window (verify.js:24-30). Matches integers, decimals,
 * and percentages; the trailing `%`/`x`/commas are stripped before parsing.
 */
export function extractTripwireNumbers(text: string): number[] {
  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const out: number[] = [];
  for (const raw of matches) {
    const n = Number(raw.replace(/,/g, ''));
    if (Number.isNaN(n)) continue;
    if (isExcludedYear(n)) continue;
    out.push(n);
  }
  return out;
}

/**
 * Layer-2 deterministic pre-check for a single LLM patch BEFORE the LLM skeptic
 * runs: a patch whose groundedIn is empty, or references an unknown master-bank
 * id, auto-fails as unsupported (verify.js:61-65). Returns true when the patch
 * is structurally grounded (every ref resolves to a known id and at least one
 * ref is present); false ⇒ auto-fail unsupported.
 *
 * `knownIds` is the set of master-bank bullet ids (bare `<id>`, §11 ref format).
 * The numeric-tripwire comparison against the cited source text and the LLM
 * skeptic (uncertain → false, verify.js:44-50) are the verify-stage agent's job.
 */
export function isStructurallyGrounded(
  groundedIn: readonly string[] | undefined | null,
  knownIds: ReadonlySet<string>
): boolean {
  if (!groundedIn || groundedIn.length === 0) return false;
  return groundedIn.every((id) => knownIds.has(id));
}

/** keywordScore floor on empty-JD term sets (score.js:58, DECISIONS). */
export const KEYWORD_SCORE_FLOOR = 0.5;
