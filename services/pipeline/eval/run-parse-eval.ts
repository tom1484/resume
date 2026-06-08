// Golden-set eval for the parse_jd stage (required to pass before any prompt
// change lands). Re-parses 6 frozen real JDs live and asserts each expected term
// is recalled in mustHaves ∪ hardSkills.
//
// Usage: ANTHROPIC_API_KEY=... tsx eval/run-parse-eval.ts
// Cost: ~2¢ per run (6 Haiku calls). NOT run in CI (live API).
import { readFileSync } from 'node:fs';
import { configDefault } from '@resume/contracts';
import { parseJd } from '../src/parseJd.js';
import { termMatches } from '../src/score.js';
import type { Job } from '../src/types.js';

const cfg = configDefault('llm');
interface Fixture extends Job {
  expectedTerms: string[];
}
const fixtures = JSON.parse(
  readFileSync(new URL('./golden-jds.json', import.meta.url), 'utf8')
) as Fixture[];
const MIN_RECALL = 0.8;

let failed = false;
for (const fx of fixtures) {
  const { output } = await parseJd(fx, cfg);
  const extracted = [...output.mustHaves, ...output.hardSkills];
  const hits = fx.expectedTerms.filter((t) =>
    extracted.some((e) => termMatches(t, e) || termMatches(e, t))
  );
  const recall = hits.length / fx.expectedTerms.length;
  const missed = fx.expectedTerms.filter((t) => !hits.includes(t));
  const ok = recall >= MIN_RECALL && output.seniority === 'intern';
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${fx.company} — ${fx.title.slice(0, 45)}  recall=${recall.toFixed(2)}` +
      (missed.length ? `  missed: ${missed.join(', ')}` : '') +
      (output.seniority !== 'intern' ? `  seniority=${output.seniority}` : '')
  );
}
process.exit(failed ? 1 : 0);
