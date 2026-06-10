// §8 API surface — single overlayProblems (THE one impl).
//
// One overlayProblems(overlay, resumeDoc) here, imported by both the API and the
// pipeline; both must read THE SAME current-résumé source. The caller passes the
// current résumé (API: latest resume_versions; pipeline: refreshResume() result —
// the same DB row).
import jsonpatch from 'fast-json-patch';
import { Overlay } from './overlay.js';

/**
 * Returns a list of human-readable problems with an overlay against the current
 * résumé document. Empty array ⇒ valid. Three checks: (1) Zod safeParse of the
 * overlay; (2) fast-json-patch.validate of the patch ops against the résumé;
 * (3) the ONE personalInfo-required rule.
 */
export function overlayProblems(
  overlay: unknown,
  resumeDoc: unknown
): string[] {
  const problems: string[] = [];

  const parsed = Overlay.safeParse(overlay);
  if (!parsed.success) {
    problems.push(
      ...parsed.error.issues.map(
        (i) => `${i.path.join('/')} ${i.message}`
      )
    );
  }

  const ov = overlay as { patches?: unknown[]; profile?: { sections?: string[] } } | null;
  const err = jsonpatch.validate(
    (ov?.patches ?? []) as jsonpatch.Operation[],
    resumeDoc
  );
  if (err) {
    problems.push(
      `patch #${err.index} ${err.name} at ${err.operation?.path}`
    );
  }

  if (ov?.profile && !ov.profile.sections?.includes('personalInfo')) {
    problems.push('profile.sections must include personalInfo'); // the ONE personalInfo rule
  }

  return problems; // [] = valid
}
