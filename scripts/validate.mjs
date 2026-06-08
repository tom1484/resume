// Validates the canonical resume data and all application overlays:
//   1. resume.json against the official JSON Resume v1.0.0 schema
//      (@jsonresume/schema), with x-* extension keys stripped first,
//   2. resume.json against the local extension schema
//      (extensions.schema.json) covering the x-* fields,
//   3. every apps/site/public/applications/*/overlay.json against
//      overlay.schema.json, AND a dry-run of its RFC-6902 patches
//      against resume.json (a patch that doesn't apply cleanly fails).
// Usage: pnpm validate
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import jsonpatch from 'fast-json-patch';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = join(root, 'packages/renderer/src/data');  // schemas + master bank
const resume = JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8'));  // canonical résumé seed
const extensionsSchema = JSON.parse(
  readFileSync(join(dataDir, 'extensions.schema.json'), 'utf8')
);
const officialSchema = require('@jsonresume/schema/schema.json');

// Deep-copy with all x-* keys (and $schema) removed, for official validation
function stripExtensions(value) {
  if (Array.isArray(value)) return value.map(stripExtensions);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('x-') && key !== '$schema')
        .map(([key, v]) => [key, stripExtensions(v)])
    );
  }
  return value;
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let failed = false;

function check(label, schema, data) {
  const validate = ajv.compile(schema);
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

check('JSON Resume v1.0.0 (official schema, x-* stripped)', officialSchema, stripExtensions(resume));
check('x- extensions (extensions.schema.json)', extensionsSchema, resume);

// Master bullet bank: schema + id uniqueness
const masterSchema = JSON.parse(readFileSync(join(dataDir, 'master.schema.json'), 'utf8'));
const master = JSON.parse(readFileSync(join(dataDir, 'master.json'), 'utf8'));
check('master.json (master.schema.json)', masterSchema, master);
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
const overlaySchema = JSON.parse(readFileSync(join(dataDir, 'overlay.schema.json'), 'utf8'));
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
  check(`overlay ${id} (overlay.schema.json)`, overlaySchema, overlay);

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
