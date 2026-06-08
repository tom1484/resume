// Export the live (DB) canonical résumé to the committed seed file
// data/resume.json, so the bundled fallback / CI PDF / offline render stay
// representative of what you've edited in the web editor.
//
// Usage: pnpm export-seed            (uses deploy/.env: REVIEW_BASE_URL, REVIEW_BASIC_AUTH)
// Then:  pnpm validate && git diff data/resume.json   (review) → commit.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// minimal .env reader (KEY=VALUE lines)
function loadEnv(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = { ...loadEnv(join(root, 'deploy/.env')), ...process.env };
const base = env.REVIEW_BASE_URL || 'https://jobs.churong.cc';
const auth = env.REVIEW_BASIC_AUTH; // user:pass for the NPM access list

const headers = {};
if (auth) headers.Authorization = `Basic ${Buffer.from(auth).toString('base64')}`;

const url = `${base}/api/resume`;
const resp = await fetch(url, { headers });
if (!resp.ok) {
  console.error(`GET ${url} → HTTP ${resp.status}. Check REVIEW_BASE_URL / REVIEW_BASIC_AUTH in deploy/.env.`);
  process.exit(1);
}
const resume = await resp.json();
if (!resume?.basics || !Array.isArray(resume?.work)) {
  console.error('response does not look like a résumé (missing basics/work) — aborting');
  process.exit(1);
}

const out = join(root, 'data/resume.json');
writeFileSync(out, JSON.stringify(resume, null, 2) + '\n');
console.log(`wrote ${out} from ${url}`);
console.log('next: pnpm validate && git diff data/resume.json   → commit if it looks right');
