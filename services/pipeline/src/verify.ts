// Stage: verify_claims — adversarial audit of a tailored overlay (§11, BINDING).
// Anti-fabrication layer 2. Two sub-layers:
//   1. Numeric tripwire (deterministic): any number in a patched value that does
//      not appear in the cited master bullets is an automatic fabrication — no
//      LLM judgment. YEARS 2019–2030 are excluded (dates, not metrics). Unknown
//      bullet ids / empty grounding also auto-fail. All three live in the
//      @resume/contracts antifab module (extractTripwireNumbers /
//      isStructurallyGrounded) — the ONE source of truth, never weakened here.
//   2. LLM skeptic: judges whether every factual claim is contained in the cited
//      bullets; uncertain => unsupported.
// An overlay enters review ONLY with audit.unsupported === [] (the drop policy,
// applied in tailorJob.ts).
import {
  VerdictSchema,
  extractTripwireNumbers,
  isStructurallyGrounded,
  type LlmConfig,
} from '@resume/contracts';
import { structuredCall } from './llm.js';
import { master } from './profile.js';
import type { Overlay } from '@resume/contracts';

const bulletById = new Map(master.bullets.map((b) => [b.id, b]));
const knownIds = new Set(master.bullets.map((b) => b.id));

/**
 * Numeric tripwire. Numbers in `patchValue` not present in
 * any cited bullet's text are suspect; years 2019–2030 never trip (handled by
 * extractTripwireNumbers). Returns the list of suspect numbers (empty = clean).
 */
export function numericTripwire(patchValue: string, groundedIn: string[]): number[] {
  const allowed = new Set<number>(
    groundedIn.flatMap((id) => extractTripwireNumbers(bulletById.get(id)?.text ?? ''))
  );
  return extractTripwireNumbers(patchValue).filter((n) => !allowed.has(n));
}

const SYSTEM = `You are a skeptical resume fact-checker. For each patch, decide whether EVERY
factual claim in the new text (technologies, metrics, scope, outcomes, role)
is contained in or directly entailed by the cited master bullets. Rephrasing
and reordering are fine; new facts are not. Generalizing a specific fact is
fine ("CNN models" for "motion detection CNNs"); specializing or strengthening
is NOT ("led the team" when the bullet says "worked on the team"; "75%" when
the bullet says "significant"). If uncertain, supported=false.`;

export async function verifyClaims(
  overlay: Pick<Overlay, 'patches'>,
  grounding: string[][],
  cfg: LlmConfig
) {
  const checks = overlay.patches.map((patch, i) => {
    const cited = (grounding[i] ?? []).filter((id) => knownIds.has(id));
    const unknownIds = (grounding[i] ?? []).filter((id) => !knownIds.has(id));
    return {
      patch,
      i,
      cited,
      unknownIds,
      tripped: numericTripwire(patch.value as string, cited),
    };
  });

  // Layer 1: deterministic auto-fails need no LLM. isStructurallyGrounded covers
  // unknown-id / empty-grounding; the tripwire covers metrics.
  const autoFail = new Map<number, string>();
  for (const c of checks) {
    if (c.unknownIds.length)
      autoFail.set(c.i, `cites unknown bullet ids: ${c.unknownIds.join(',')}`);
    else if (!isStructurallyGrounded(c.cited, knownIds))
      autoFail.set(c.i, 'no grounding cited');
    else if (c.tripped.length)
      autoFail.set(c.i, `numbers not in cited bullets: ${c.tripped.join(',')}`);
  }

  // Layer 2: LLM skeptic for the rest.
  const toJudge = checks.filter((c) => !autoFail.has(c.i));
  let judged = new Map<number, { supported: boolean; reason: string }>();
  let usage = null;
  let model: string | null = null;
  if (toJudge.length > 0) {
    const result = await structuredCall({
      model: cfg.models.verify,
      system: SYSTEM,
      user: toJudge
        .map(
          (c) => `PATCH ${c.i}:
New text: ${c.patch.value}
Cited bullets:
${c.cited.map((id) => `[${id}] ${bulletById.get(id)!.text}`).join('\n')}`
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
    const reason = auto ?? judged.get(c.i)?.reason;
    return {
      patchIndex: c.i,
      groundedIn: c.cited,
      verdict: (verdict ? 'supported' : 'unsupported') as 'supported' | 'unsupported',
      ...(reason ? { reason } : {}),
    };
  });
  const unsupported = claims
    .filter((c) => c.verdict === 'unsupported')
    .map((c) => c.patchIndex);
  return {
    audit: {
      // schema-clean: strip the freetext `reason` (kept separately for logging)
      claims: claims.map(({ reason: _reason, ...keep }) => keep),
      unsupported,
    },
    reasons: Object.fromEntries(
      claims.filter((c) => c.reason).map((c) => [c.patchIndex, c.reason!])
    ),
    usage,
    model,
  };
}
