// Candidate profile. The canonical résumé is DB-backed (resume_versions); the
// bundled/mounted file is the seed + fallback. refreshResume() pulls the current
// version so tailoring/scoring reflect web edits without a redeploy. The bullet
// bank (master.json) stays file-based (the grounding corpus, §11).
//
// Reads the résumé shape (work.tags / projects.tags, headline). profileText takes
// an optional preference block to inject; eligibility anchors live in the
// DB-backed Preferences list (§5.2), not hard-coded here.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResumeDoc, MasterBank, Preference } from '@resume/contracts';
import { query } from './db.js';

// Resolve the repo root by walking up from this module until we find the seed +
// master bank. This is robust whether running from src/ (vitest/tsx) or the
// compiled dist/src/ (the extra dist/ level shifted the old relative paths).
function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'data', 'resume.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume the conventional layout from src/ (3 levels up).
  return fileURLToPath(new URL('../../../', import.meta.url));
}

const repoRoot = findRepoRoot();
const dataDir =
  process.env.DATA_DIR ?? join(repoRoot, 'packages', 'renderer', 'src', 'data');
const seedFile = process.env.RESUME_SEED ?? join(repoRoot, 'data', 'resume.json');

const seedResume = JSON.parse(readFileSync(seedFile, 'utf8')) as ResumeDoc;
export const master = JSON.parse(
  readFileSync(join(dataDir, 'master.json'), 'utf8')
) as MasterBank;

let _resume: ResumeDoc = seedResume;
export const getResume = (): ResumeDoc => _resume;

// Pull the current canonical résumé from the DB (latest version). On any failure
// (no DB, empty table) keep whatever we have — the seed by default.
export async function refreshResume(): Promise<void> {
  try {
    const { rows } = await query(
      'SELECT data FROM resume_versions ORDER BY id DESC LIMIT 1'
    );
    if (rows.length) _resume = rows[0].data as ResumeDoc;
  } catch {
    /* keep current */
  }
}

// All skill/tag terms the candidate can legitimately claim.
export function candidateTerms(): string[] {
  const resume = getResume();
  const terms = new Set<string>();
  for (const group of resume.skills) for (const kw of group.keywords) terms.add(kw);
  for (const p of resume.projects) for (const t of p.tags ?? []) terms.add(t);
  for (const w of resume.work) for (const t of w.tags ?? []) terms.add(t);
  for (const b of master.bullets) for (const t of b.tags ?? []) terms.add(t);
  return [...terms];
}

// §5.2 preference→influence: render enabled preferences (sorted by priority desc)
// as priority-labeled lines for the llmFit system prompt. The fixed label map
// makes the scorer's weighting predictable.
//   9–10 [decisive] | 6–8 [important] | 3–5 [moderate] | 1–2 [mild]
export function preferenceLabel(priority: number): string {
  if (priority >= 9) return 'decisive';
  if (priority >= 6) return 'important';
  if (priority >= 3) return 'moderate';
  return 'mild';
}

export function preferenceBlock(preferences: Preference[]): string {
  const active = preferences
    .filter((p) => p.enabled !== false)
    .slice()
    .sort((a, b) => b.priority - a.priority);
  if (active.length === 0) return '';
  const lines = active.map((p) => `- [${preferenceLabel(p.priority)}] ${p.text}`);
  return `\nCANDIDATE PREFERENCES (weight by priority label — [decisive] strongly,
[important] noticeably, [moderate] slightly, [mild] tie-breaker only). A
preference is NOT a hard requirement; a strong mismatch on a [decisive]
preference should pull fit toward <=0.3, an [important] one noticeably lower
(~-0.2), a [moderate] one slightly (~-0.1):
${lines.join('\n')}`;
}

// Stable long-form profile text for fit judgment (built per call from the
// current résumé; identical within a batch → still prompt-cacheable). The
// optional preference block is appended (§5.2).
export function profileText(preferences: Preference[] = []): string {
  const resume = getResume();
  const basics = resume.basics;
  const edu = resume.education
    .map((e) => `- ${e.studyType ?? ''} ${e.area ?? ''}, ${e.institution} (${e.time ?? ''})`)
    .join('\n');
  const bullets = master.bullets
    .map((b) => `- [${b.id}] (${b.context ?? ''}) ${b.text}`)
    .join('\n');
  return `CANDIDATE PROFILE
${basics.name}${basics.headline ? ` — ${basics.headline}` : ''}
Education:
${edu}
Skills: ${candidateTerms().join(', ')}
${preferenceBlock(preferences)}
FULL ACCOMPLISHMENT BANK (every claim the candidate can make):
${bullets}`;
}
