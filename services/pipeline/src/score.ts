// Stage: score — w.keyword·keyword + w.llmFit·llmFit + w.structural·structural
// (PLAN.md Phase 2: embeddings deferred; the bullet bank fits whole in a prompt).
//
// Details:
//   - weights come from LlmConfig (§6).
//   - structural fit is evaluateConstraints (§5.2): DB-backed Constraints
//     evaluated deterministically against the parsed JD — a fired `hard` ⇒ 0;
//     `penalty` subtracts and clamps at >=0.
//   - llmFit injects the DB-backed Preferences block into its system prompt.
import {
  FitSchema,
  KEYWORD_SCORE_FLOOR,
  type JdSchema,
  type Constraint,
  type Preference,
  type LlmConfig,
} from '@resume/contracts';
import { structuredCall } from './llm.js';
import { profileText } from './profile.js';
import type { Job } from './types.js';

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Levenshtein distance with early exit beyond `max`.
export function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      rowMin = Math.min(rowMin, curr[j]!);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length]!;
}

// ATS-style fuzzy term match: exact word/phrase containment, or a length-scaled
// Levenshtein distance ("PyTorch"/"Pytorch", "ROS2"/"ROS 2" — but NOT
// "AWS"/"CSS": short terms get no fuzz budget).
export function termMatches(jdTerm: string, candidate: string): boolean {
  const t = norm(jdTerm);
  const c = norm(candidate);
  if (!t || !c) return false;
  if (t === c || t.includes(c) || c.includes(t)) return true;
  const a = t.replace(/ /g, '');
  const b = c.replace(/ /g, '');
  const fuzz =
    Math.min(a.length, b.length) >= 8 ? 2 : Math.min(a.length, b.length) >= 5 ? 1 : 0;
  return fuzz > 0 && levenshtein(a, b, fuzz) <= fuzz;
}

type KeywordParsed = Pick<JdSchema, 'mustHaves' | 'hardSkills' | 'niceToHaves'>;

// Weighted keyword coverage: must-haves count 3x nice-to-haves (report §4).
export function keywordScore(
  parsed: KeywordParsed,
  candidateTermList: string[]
): { value: number; missing: string[] } {
  const buckets = [
    { terms: [...new Set([...parsed.mustHaves, ...parsed.hardSkills])], weight: 3 },
    { terms: parsed.niceToHaves, weight: 1 },
  ];
  let total = 0;
  let matched = 0;
  const missing: string[] = [];
  for (const { terms, weight } of buckets) {
    for (const term of terms) {
      total += weight;
      if (candidateTermList.some((c) => termMatches(term, c))) matched += weight;
      else missing.push(term);
    }
  }
  // KEYWORD_SCORE_FLOOR (0.5) when the JD gave us nothing to match on (§11).
  if (total === 0) return { value: KEYWORD_SCORE_FLOOR, missing };
  return { value: matched / total, missing };
}

// --- §5.2 Constraints (hard, deterministic) ---

export interface ConstraintFired {
  id: string;
  effect: 'hard' | 'penalty';
  amount?: number;
}

export interface StructuralResult {
  value: number;
  constraintsFired: ConstraintFired[];
}

// Read the parsed-JD field a constraint tests and stringify it for the typed
// predicate (booleans → 'true'/'false'; null → '' so notIn/equals behave).
function fieldValue(parsed: JdSchema, field: Constraint['field']): string {
  const v = parsed[field];
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function constraintFires(parsed: JdSchema, c: Constraint): boolean {
  const raw = parsed[c.field];
  switch (c.test.kind) {
    case 'isTrue':
      return raw === true;
    case 'equals':
      return fieldValue(parsed, c.field) === c.test.value;
    case 'notIn':
      return !c.test.values.includes(fieldValue(parsed, c.field));
  }
}

// Deterministic structural fit from the Constraints list: start at 1; any fired
// `hard` short-circuits to 0; `penalty` constraints subtract their amount;
// clamp at >=0. Disabled constraints skipped.
export function evaluateConstraints(
  parsed: JdSchema,
  constraints: Constraint[]
): StructuralResult {
  const fired: ConstraintFired[] = [];
  let value = 1;
  let hard = false;
  for (const c of constraints) {
    if (c.enabled === false) continue;
    if (!constraintFires(parsed, c)) continue;
    if (c.effect.kind === 'hard') {
      hard = true;
      fired.push({ id: c.id, effect: 'hard' });
    } else {
      value -= c.effect.amount;
      fired.push({ id: c.id, effect: 'penalty', amount: c.effect.amount });
    }
  }
  if (hard) return { value: 0, constraintsFired: fired };
  return { value: Math.max(0, value), constraintsFired: fired };
}

const FIT_INSTRUCTIONS = `

You judge how well THIS candidate fits a job. Consider depth of overlap between
the candidate's accomplishment bank and the job's actual responsibilities (not
just keyword presence), level match for an internship, and growth fit.
Return fit in [0,1]: 0.9+ exceptional alignment, 0.7 strong, 0.5 plausible,
0.3 weak, <0.2 wrong field. List concrete redFlags (missing must-haves,
domain mismatch, location/term conflicts, violated decisive preferences).`;

export async function llmFit(
  job: Job,
  parsed: JdSchema,
  cfg: LlmConfig,
  preferences: Preference[] = []
) {
  // Built per call from the current résumé + preferences (identical within a
  // batch → cached). Preferences are injected via profileText (§5.2).
  return structuredCall({
    model: cfg.models.fit,
    system: `${profileText(preferences)}${FIT_INSTRUCTIONS}`,
    user: `Job: ${job.title} @ ${job.company} (${job.location ?? 'unknown'})
Parsed requirements: ${JSON.stringify(parsed)}
JD excerpt:
${(job.jd_text ?? '').slice(0, cfg.jdTruncation.fit)}`,
    schema: FitSchema,
    maxTokens: 1024,
    cache: true, // stable system prompt (profile) — cache across jobs in a batch
  });
}

export function combine(
  keyword: number,
  fit: number,
  structural: number,
  weights: LlmConfig['weights']
): number {
  return +(
    weights.keyword * keyword +
    weights.llmFit * fit +
    weights.structural * structural
  ).toFixed(4);
}
