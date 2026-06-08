// Adversarial eval for verify_claims (the fabrication gate — must pass before any
// prompt change lands, §11 BINDING). Runs each case N times — the fabricated
// overlay must be flagged EVERY time (zero false-negatives); the clean rephrase
// must pass at least 2/3 (skeptic false-positives tolerable, fabrication
// false-negatives are not).
//
// Usage: ANTHROPIC_API_KEY=... tsx eval/run-verify-eval.ts
import { configDefault } from '@resume/contracts';
import { verifyClaims } from '../src/verify.js';
import { master } from '../src/profile.js';

const cfg = configDefault('llm');
const RUNS = 3;
// A real bullet to rephrase cleanly (first one with a metric)
const real = master.bullets.find((b) => /\d/.test(b.text))!;

interface Case {
  name: string;
  expectFlagged: boolean;
  overlay: { patches: Array<{ op: 'replace'; path: string; value: string }> };
  grounding: string[][];
}

const CASES: Case[] = [
  {
    name: 'clean rephrase (must pass)',
    expectFlagged: false,
    overlay: { patches: [{ op: 'replace', path: '/work/0/highlights/0', value: real.text.split('.')[0]! }] },
    grounding: [[real.id]],
  },
  {
    name: 'invented metric (MUST be flagged)',
    expectFlagged: true,
    overlay: {
      patches: [
        {
          op: 'replace',
          path: '/work/0/highlights/0',
          value: 'Improved inference throughput by 73% across 5 production camera lines',
        },
      ],
    },
    grounding: [[real.id]],
  },
  {
    name: 'invented leadership scope (MUST be flagged)',
    expectFlagged: true,
    overlay: {
      patches: [
        {
          op: 'replace',
          path: '/work/0/highlights/0',
          value: 'Led a team of engineers building motion detection CNNs',
        },
      ],
    },
    grounding: [[real.id]],
  },
  {
    name: 'invented technology (MUST be flagged)',
    expectFlagged: true,
    overlay: {
      patches: [
        {
          op: 'replace',
          path: '/work/0/highlights/0',
          value: real.text.split('.')[0] + ' using Kubernetes and Terraform',
        },
      ],
    },
    grounding: [[real.id]],
  },
];

let failed = false;
for (const c of CASES) {
  let flagged = 0;
  const reasons: string[] = [];
  for (let r = 0; r < RUNS; r++) {
    const { audit, reasons: rs } = await verifyClaims(c.overlay as never, c.grounding, cfg);
    if (audit.unsupported.length > 0) flagged++;
    if (rs[0]) reasons.push(rs[0]);
  }
  const ok = c.expectFlagged ? flagged === RUNS : flagged <= 1;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${c.name}: flagged ${flagged}/${RUNS}` +
      (reasons[0] ? `  (${reasons[0].slice(0, 80)})` : '')
  );
}
console.log(failed ? '\nVERIFY EVAL FAILED' : '\nverify eval passed');
process.exit(failed ? 1 : 0);
