// Stage: verify_claims — adversarial audit of a tailored overlay.
// Two layers:
//   1. Numeric tripwire (deterministic): any number in a patched value that
//      does not appear in the cited master bullets is an automatic
//      fabrication — no LLM judgment involved.
//   2. LLM skeptic: judges whether every factual claim in the patch is
//      contained in the cited bullets; uncertain => unsupported.
// An overlay enters review ONLY with audit.unsupported === [].
import { z } from 'zod';
import { structuredCall } from './llm.js';
import { master } from './profile.js';

export const VERIFY_MODEL = process.env.MODEL_VERIFY ?? 'claude-haiku-4-5';

const bulletById = new Map(master.bullets.map((b) => [b.id, b]));

// Numbers as claim atoms: "90%", "3.2x", "12", "40%". Normalized to bare
// numeric strings for containment checks.
export function extractNumbers(text) {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(/\.0+$/, ''));
}

export function numericTripwire(patchValue, groundedIn) {
  const allowed = new Set(
    groundedIn.flatMap((id) => extractNumbers(bulletById.get(id)?.text ?? ''))
  );
  // years (2019-2030) are dates, not metrics — don't trip on them
  const suspect = extractNumbers(patchValue).filter(
    (n) => !allowed.has(n) && !(Number(n) >= 2019 && Number(n) <= 2030)
  );
  return suspect;
}

const VerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      patchIndex: z.number().int(),
      supported: z.boolean(),
      reason: z.string(),
    })
  ),
});

const SYSTEM = `You are a skeptical resume fact-checker. For each patch, decide whether EVERY
factual claim in the new text (technologies, metrics, scope, outcomes, role)
is contained in or directly entailed by the cited master bullets. Rephrasing
and reordering are fine; new facts are not. Generalizing a specific fact is
fine ("CNN models" for "motion detection CNNs"); specializing or strengthening
is NOT ("led the team" when the bullet says "worked on the team"; "75%" when
the bullet says "significant"). If uncertain, supported=false.`;

export async function verifyClaims(overlay, grounding) {
  const checks = overlay.patches.map((patch, i) => {
    const cited = (grounding[i] ?? []).filter((id) => bulletById.has(id));
    const unknownIds = (grounding[i] ?? []).filter((id) => !bulletById.has(id));
    return { patch, i, cited, unknownIds, tripped: numericTripwire(patch.value, cited) };
  });

  // Layer 1: deterministic failures need no LLM
  const autoFail = new Map();
  for (const c of checks) {
    if (c.unknownIds.length) autoFail.set(c.i, `cites unknown bullet ids: ${c.unknownIds.join(',')}`);
    else if (c.cited.length === 0) autoFail.set(c.i, 'no grounding cited');
    else if (c.tripped.length) autoFail.set(c.i, `numbers not in cited bullets: ${c.tripped.join(',')}`);
  }

  // Layer 2: LLM skeptic for the rest
  const toJudge = checks.filter((c) => !autoFail.has(c.i));
  let judged = new Map();
  let usage = null;
  let model = null;
  if (toJudge.length > 0) {
    const result = await structuredCall({
      model: VERIFY_MODEL,
      system: SYSTEM,
      user: toJudge
        .map(
          (c) => `PATCH ${c.i}:
New text: ${c.patch.value}
Cited bullets:
${c.cited.map((id) => `[${id}] ${bulletById.get(id).text}`).join('\n')}`
        )
        .join('\n\n'),
      schema: VerdictSchema,
      maxTokens: 1500,
    });
    judged = new Map(result.output.verdicts.map((v) => [v.patchIndex, v]));
    usage = result.usage;
    model = result.model;
  }

  const claims = checks.map((c) => {
    const auto = autoFail.get(c.i);
    const verdict = auto ? false : (judged.get(c.i)?.supported ?? false);
    return {
      patchIndex: c.i,
      groundedIn: c.cited,
      verdict: verdict ? 'supported' : 'unsupported',
      ...(auto ? { reason: auto } : judged.get(c.i)?.reason ? { reason: judged.get(c.i).reason } : {}),
    };
  });
  const unsupported = claims.filter((c) => c.verdict === 'unsupported').map((c) => c.patchIndex);
  return {
    audit: {
      claims: claims.map(({ reason, ...keep }) => keep), // schema-clean
      unsupported,
    },
    reasons: Object.fromEntries(claims.filter((c) => c.reason).map((c) => [c.patchIndex, c.reason])),
    usage,
    model,
  };
}
