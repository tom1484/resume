// Live tailor+verify eval on real scored jobs (jsonl exported from the DB).
// Asserts per job: overlay mechanically valid, every patch verified
// (audit.unsupported === []), cover letter non-trivial.
// Usage: node eval/run-tailor-eval.js /tmp/tailor-jobs.jsonl
// Cost: ~2-5¢ per job (Sonnet tailor + Haiku verify).
import { readFileSync } from 'node:fs';
import { tailor } from '../src/tailor.js';
import { verifyClaims } from '../src/verify.js';
import { costUsd } from '../src/llm.js';

const file = process.argv[2];
const jobs = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

let failed = false;
for (const job of jobs) {
  try {
    const t = await tailor(job);
    const v = await verifyClaims(t.overlay, t.grounding);
    const cost = (costUsd(t.model, t.usage) ?? 0) + (v.model ? costUsd(v.model, v.usage) ?? 0 : 0);
    const ok = v.audit.unsupported.length === 0 && t.overlay.coverLetter.length > 200;
    if (!ok) failed = true;
    console.log(`${ok ? '✓' : '✗'} ${job.company} — ${job.title.slice(0, 45)}`);
    console.log(`   sections: ${t.overlay.profile.sections.join(',')}`);
    console.log(`   patches: ${t.overlay.patches.length}, unsupported: [${v.audit.unsupported}], cost: $${cost.toFixed(3)}`);
    for (const p of t.overlay.patches) {
      console.log(`   ${p.path}: ${p.value.slice(0, 90)}`);
    }
    if (v.audit.unsupported.length) console.log(`   reasons: ${JSON.stringify(v.reasons)}`);
  } catch (err) {
    failed = true;
    console.log(`✗ ${job.company} — ${job.title.slice(0, 45)}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
