// Stage: score — 0.5·keyword + 0.3·llmFit + 0.2·structural (PLAN.md Phase 2
// design note: embeddings deferred; the bullet bank fits whole in a prompt).
import { z } from 'zod';
import { structuredCall } from './llm.js';
import { profileText } from './profile.js';

export const WEIGHTS = { keyword: 0.5, llmFit: 0.3, structural: 0.2 };

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Levenshtein distance with early exit beyond `max`
export function levenshtein(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

// ATS-style fuzzy term match: exact word/phrase containment, or a
// length-scaled Levenshtein distance ("PyTorch"/"Pytorch", "ROS2"/"ROS 2" —
// but NOT "AWS"/"CSS": short terms get no fuzz budget).
export function termMatches(jdTerm, candidate) {
  const t = norm(jdTerm);
  const c = norm(candidate);
  if (!t || !c) return false;
  if (t === c || t.includes(c) || c.includes(t)) return true;
  const a = t.replace(/ /g, '');
  const b = c.replace(/ /g, '');
  const fuzz = Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 5 ? 1 : 0;
  return fuzz > 0 && levenshtein(a, b, fuzz) <= fuzz;
}

// Weighted keyword coverage: must-haves count 3x nice-to-haves (report §4).
export function keywordScore(parsed, candidateTermList) {
  const buckets = [
    { terms: [...new Set([...parsed.mustHaves, ...parsed.hardSkills])], weight: 3 },
    { terms: parsed.niceToHaves, weight: 1 },
  ];
  let total = 0;
  let matched = 0;
  const missing = [];
  for (const { terms, weight } of buckets) {
    for (const term of terms) {
      total += weight;
      if (candidateTermList.some((c) => termMatches(term, c))) matched += weight;
      else missing.push(term);
    }
  }
  if (total === 0) return { value: 0.5, missing }; // JD gave us nothing to match on
  return { value: matched / total, missing };
}

// Deterministic structural fit: internship-shaped, F-1 compatible.
export function structuralScore(parsed) {
  const reasons = [];
  let value = 1;
  if (parsed.citizenshipOrClearanceRequired) {
    return { value: 0, reasons: ['citizenship/clearance required'] };
  }
  if (!['intern', 'entry', 'unspecified'].includes(parsed.seniority)) {
    value -= 0.6;
    reasons.push(`seniority: ${parsed.seniority}`);
  }
  if (parsed.sponsorshipAvailable === 'no') {
    value -= 0.4;
    reasons.push('sponsorship explicitly unavailable');
  }
  return { value: Math.max(0, value), reasons };
}

const FitSchema = z.object({
  fit: z.number().min(0).max(1),
  rationale: z.string(),
  redFlags: z.array(z.string()),
});

const FIT_INSTRUCTIONS = `

You judge how well THIS candidate fits a job. Consider depth of overlap between
the candidate's accomplishment bank and the job's actual responsibilities (not
just keyword presence), level match for an internship, and growth fit.
Return fit in [0,1]: 0.9+ exceptional alignment, 0.7 strong, 0.5 plausible,
0.3 weak, <0.2 wrong field. List concrete redFlags (missing must-haves,
domain mismatch, location/term conflicts).`;

export async function llmFit(job, parsed) {
  // built per call from the current résumé (identical within a batch → cached)
  return structuredCall({
    system: `${profileText()}${FIT_INSTRUCTIONS}`,
    user: `Job: ${job.title} @ ${job.company} (${job.location ?? 'unknown'})
Parsed requirements: ${JSON.stringify(parsed)}
JD excerpt:
${(job.jd_text ?? '').slice(0, 6000)}`,
    schema: FitSchema,
    maxTokens: 1024,
    cache: true, // stable system prompt (profile) — cache across jobs in a batch
  });
}

export function combine(keyword, fit, structural) {
  return +(WEIGHTS.keyword * keyword + WEIGHTS.llmFit * fit + WEIGHTS.structural * structural).toFixed(4);
}
