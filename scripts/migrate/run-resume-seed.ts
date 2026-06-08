// Driver (CONTRACTS.md §12.2 step 1, seed half): transform the repo-root
// v1 `data/resume.json` to the v2 shape via the reusable migration and write it
// back. The DB migration (Agent C) imports `migrateResumeV1ToV2` directly; this
// script only handles the file seed + git-export target.
// Usage: node scripts/migrate/run-resume-seed.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateResumeV1ToV2 } from './resumeV1ToV2.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const seedPath = join(root, 'data', 'resume.json');

const old = JSON.parse(readFileSync(seedPath, 'utf8'));
const migrated = migrateResumeV1ToV2(old);
writeFileSync(seedPath, JSON.stringify(migrated, null, 2) + '\n');
// eslint-disable-next-line no-console
console.log(`migrated ${seedPath} → v2 ResumeDoc (validated)`);
