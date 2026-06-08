// Candidate profile. The canonical résumé is DB-backed (resume_versions);
// the bundled/mounted file is the seed + fallback. refreshResume() pulls the
// current version so tailoring/scoring reflect web edits without a redeploy.
// The bullet bank (master.json) stays file-based (grounding corpus).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from './db.js';

const dataDir = process.env.DATA_DIR ?? new URL('../../../packages/renderer/src/data', import.meta.url).pathname;
const seedFile = process.env.RESUME_SEED ?? new URL('../../../data/resume.json', import.meta.url).pathname;

const seedResume = JSON.parse(readFileSync(seedFile, 'utf8'));
export const master = JSON.parse(readFileSync(join(dataDir, 'master.json'), 'utf8'));

let _resume = seedResume;
export const getResume = () => _resume;

// Pull the current canonical résumé from the DB (latest version). On any
// failure (no DB, empty table) keep whatever we have — the seed by default.
export async function refreshResume() {
  try {
    const { rows } = await query('SELECT data FROM resume_versions ORDER BY id DESC LIMIT 1');
    if (rows.length) _resume = rows[0].data;
  } catch {
    /* keep current */
  }
}

// All skill/tag terms the candidate can legitimately claim
export function candidateTerms() {
  const resume = getResume();
  const terms = new Set();
  for (const group of resume.skills) for (const kw of group.keywords) terms.add(kw);
  for (const p of resume.projects) for (const kw of p.keywords ?? []) terms.add(kw);
  for (const w of resume.work) for (const t of w['x-tags'] ?? []) terms.add(t);
  for (const b of master.bullets) for (const t of b.tags ?? []) terms.add(t);
  return [...terms];
}

// Stable long-form profile text for fit judgment (built per call from the
// current résumé; identical within a batch → still prompt-cacheable).
export function profileText() {
  const resume = getResume();
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
