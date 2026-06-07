// Candidate profile loaded from the canonical data (mounted read-only at
// DATA_DIR). Produces: term set for keyword matching + a stable profile text
// for the LLM fit call (stable => prompt-cacheable).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = process.env.DATA_DIR ?? new URL('../../../packages/renderer/src/data', import.meta.url).pathname;

export const resume = JSON.parse(readFileSync(join(dataDir, 'resume.json'), 'utf8'));
export const master = JSON.parse(readFileSync(join(dataDir, 'master.json'), 'utf8'));

// All skill/tag terms the candidate can legitimately claim
export function candidateTerms() {
  const terms = new Set();
  for (const group of resume.skills) for (const kw of group.keywords) terms.add(kw);
  for (const p of resume.projects) for (const kw of p.keywords ?? []) terms.add(kw);
  for (const w of resume.work) for (const t of w['x-tags'] ?? []) terms.add(t);
  for (const b of master.bullets) for (const t of b.tags ?? []) terms.add(t);
  return [...terms];
}

// Stable long-form profile text for fit judgment (system prompt, cached).
export function profileText() {
  const basics = resume.basics;
  const edu = resume.education
    .map((e) => `- ${e.studyType ?? ''} ${e.area ?? ''}, ${e.institution} (${e['x-time'] ?? ''})`)
    .join('\n');
  const bullets = master.bullets.map((b) => `- [${b.id}] (${b.context}) ${b.text}`).join('\n');
  return `CANDIDATE PROFILE
${basics.name} — ${basics.label}
Work authorization: F-1 visa; Summer 2027 internships via CPT; requires sponsorship for full-time.
Education:
${edu}
Skills: ${candidateTerms().join(', ')}

FULL ACCOMPLISHMENT BANK (every claim the candidate can make):
${bullets}`;
}
