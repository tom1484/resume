// Validates src/data/resume.json against:
//   1. the official JSON Resume v1.0.0 schema (@jsonresume/schema),
//      with x-* extension keys stripped first, and
//   2. the local extension schema (src/data/extensions.schema.json)
//      covering the x-* fields.
// Usage: pnpm validate
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = join(root, 'packages/renderer/src/data');
const resume = JSON.parse(readFileSync(join(dataDir, 'resume.json'), 'utf8'));
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

process.exit(failed ? 1 : 0);
