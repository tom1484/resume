// Validates the canonical résumé seed, the master bullet bank, and all
// application overlays against the v2 single-source-of-truth JSON Schemas
// emitted from `@resume/contracts` (Zod → JSON Schema, §0). This replaces v1's
// dual upstream-JSON-Resume + extension-schema validation: v2 owns one schema.
//   1. data/resume.json against the `resume` schema (ResumeDoc),
//   2. master.json against the `master` schema (MasterBank) + id uniqueness,
//   3. every apps/site/public/applications/*/overlay.json against the `overlay`
//      schema (Overlay), AND a dry-run of its RFC-6902 patches against the
//      résumé (a patch that doesn't apply cleanly fails).
// Usage: pnpm validate
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import jsonpatch from 'fast-json-patch';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'packages/renderer/src/data'); // master bank lives here

// Contract schemas (emitted by `pnpm --filter @resume/contracts gen:schemas`).
const schema = (name) => require(`@resume/contracts/schemas/${name}.json`);
const resumeSchema = schema('resume');
const masterSchema = schema('master');

// profile.filters is a PARTIAL record over section keys (contracts uses
// z.partialRecord, so the emitted schema carries no spurious `required`).
const overlaySchema = schema('overlay');

const resume = JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8'));

// Contracts emit draft 2020-12 → use the matching Ajv build.
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

let failed = false;

function check(label, schemaObj, data) {
  const validate = ajv.compile(schemaObj);
  if (validate(data)) {
    console.log(`✓ ${label}`);
  } else {
    failed = true;
    console.error(`✗ ${label}`);
    for (const err of validate.errors) {
      console.error(`    ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

check('resume.json (@resume/contracts ResumeDoc)', resumeSchema, resume);

// Master bullet bank: schema + id uniqueness
const master = JSON.parse(readFileSync(join(dataDir, 'master.json'), 'utf8'));
check('master.json (@resume/contracts MasterBank)', masterSchema, master);
{
  const ids = master.bullets.map((b) => b.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    failed = true;
    console.error(`✗ master.json: duplicate bullet ids: ${[...new Set(dupes)].join(', ')}`);
  } else {
    console.log('✓ master.json (bullet ids unique)');
  }
}

// Application overlays: schema + patch dry-run against resume.json
const applicationsDir = join(root, 'apps/site/public/applications');
const overlayIds = existsSync(applicationsDir)
  ? readdirSync(applicationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

for (const id of overlayIds) {
  const overlayPath = join(applicationsDir, id, 'overlay.json');
  if (!existsSync(overlayPath)) {
    failed = true;
    console.error(`✗ overlay ${id}: missing overlay.json`);
    continue;
  }
  const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
  check(`overlay ${id} (@resume/contracts Overlay)`, overlaySchema, overlay);

  const patchError = jsonpatch.validate(overlay.patches ?? [], resume);
  if (patchError) {
    failed = true;
    console.error(`✗ overlay ${id}: patches do not apply cleanly`);
    console.error(`    op #${patchError.index}: ${patchError.name} at ${patchError.operation?.path}`);
  } else {
    console.log(`✓ overlay ${id} (patches apply cleanly to resume.json)`);
  }
}

process.exit(failed ? 1 : 0);
