// Tailor + verify one scored job, persist the reviewable overlay.
//
// Anti-fabrication layer 3 (drop policy, §11 BINDING): patches the verify stage
// marks unsupported are DROPPED (the safe patches survive). The overlay reaching
// review therefore ALWAYS has audit.unsupported === [] by construction, with
// patchIndex renumbered after the drop — a reviewer never sees a fabricated
// bullet. If every patch is dropped, the overlay still stands as a pure
// section-selection tailoring (no rewrites).
import jsonpatch from 'fast-json-patch';
import type { LlmConfig, Overlay } from '@resume/contracts';
import { query } from './db.js';
import { logEvent } from './events.js';
import { getResume } from './profile.js';
import { tailor } from './tailor.js';
import { verifyClaims } from './verify.js';
import type { Job, ScoredJob } from './types.js';

export async function tailorJob(job: ScoredJob | Job, cfg: LlmConfig) {
  const t = await tailor(job, cfg);
  await logEvent(job.id, 'tailor', {
    ok: true,
    model: t.model,
    usage: t.usage,
    durationMs: t.durationMs,
    detail: {
      patches: t.overlay.patches.length,
      sections: t.overlay.profile.sections,
    },
  });

  const v = await verifyClaims(t.overlay, t.grounding, cfg);
  await logEvent(job.id, 'verify_claims', {
    ok: true,
    model: v.model,
    usage: v.usage,
    detail: { unsupported: v.audit.unsupported, reasons: v.reasons },
  });

  // Drop unsupported patches; rebuild audit so unsupported === [] and renumber
  // the surviving claims' patchIndex to match the kept patch positions.
  const drop = new Set(v.audit.unsupported);
  const keptPatches = t.overlay.patches.filter((_, i) => !drop.has(i));
  const overlay: Overlay = {
    ...t.overlay,
    patches: keptPatches,
    audit: {
      claims: v.audit.claims
        .filter((c) => c.verdict === 'supported')
        .map((c, i) => ({ ...c, patchIndex: i })),
      unsupported: [],
    },
  };

  // Sanity: kept patches must still apply cleanly against the current résumé.
  const patchErr = jsonpatch.validate(
    overlay.patches as jsonpatch.Operation[],
    getResume()
  );
  if (patchErr)
    throw new Error(
      `kept patches invalid: ${patchErr.name} at ${patchErr.operation?.path}`
    );

  await query(
    `UPDATE jobs SET overlay=$2, cover_letter=$3, audit=$4, status='in_review', updated_at=now() WHERE id=$1`,
    [
      job.id,
      JSON.stringify(overlay),
      overlay.coverLetter,
      JSON.stringify(overlay.audit),
    ]
  );
  return { overlay, dropped: drop.size, model: t.model };
}
