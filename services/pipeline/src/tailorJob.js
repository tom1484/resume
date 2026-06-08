// Tailor + verify one scored job, persist the reviewable overlay.
// Policy: patches the verify stage marks unsupported are DROPPED (the safe
// patches survive). The overlay that reaches review therefore always has
// audit.unsupported === [] by construction — a reviewer never sees a
// fabricated bullet. If every patch is dropped, the overlay still stands as
// a pure section-selection tailoring (no rewrites).
import jsonpatch from 'fast-json-patch';
import { query } from './db.js';
import { costUsd } from './llm.js';
import { getResume } from './profile.js';
import { tailor } from './tailor.js';
import { verifyClaims } from './verify.js';

async function logEvent(jobId, stage, { ok, model, usage, durationMs, detail }) {
  await query(
    `INSERT INTO events (job_id, stage, model, input_tokens, output_tokens, cost_usd, duration_ms, ok, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [jobId, stage, model ?? null, usage?.input_tokens ?? null, usage?.output_tokens ?? null,
     model && usage ? costUsd(model, usage) : null, durationMs ?? null, ok, detail ? JSON.stringify(detail) : null]
  );
}

export async function tailorJob(job) {
  const t = await tailor(job);
  await logEvent(job.id, 'tailor', {
    ok: true, model: t.model, usage: t.usage, durationMs: t.durationMs,
    detail: { patches: t.overlay.patches.length, sections: t.overlay.profile.sections },
  });

  const v = await verifyClaims(t.overlay, t.grounding);
  await logEvent(job.id, 'verify_claims', {
    ok: true, model: v.model, usage: v.usage,
    detail: { unsupported: v.audit.unsupported, reasons: v.reasons },
  });

  // Drop unsupported patches; rebuild audit so unsupported === []
  const drop = new Set(v.audit.unsupported);
  const keptPatches = t.overlay.patches.filter((_, i) => !drop.has(i));
  const overlay = {
    ...t.overlay,
    patches: keptPatches,
    audit: {
      claims: v.audit.claims
        .filter((c) => c.verdict === 'supported')
        .map((c, i) => ({ ...c, patchIndex: i })),
      unsupported: [],
    },
  };

  // Sanity: kept patches must still apply cleanly
  const patchErr = jsonpatch.validate(overlay.patches, getResume());
  if (patchErr) throw new Error(`kept patches invalid: ${patchErr.name} at ${patchErr.operation?.path}`);

  await query(
    `UPDATE jobs SET overlay=$2, cover_letter=$3, audit=$4, status='in_review', updated_at=now() WHERE id=$1`,
    [job.id, JSON.stringify(overlay), overlay.coverLetter, JSON.stringify(overlay.audit)]
  );
  return { overlay, dropped: drop.size, model: t.model };
}
