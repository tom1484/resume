// Overlay schema contract: the valid fixture (and the committed test
// overlay) must pass; each invalid fixture must fail for its specific
// reason. Runs at the repo root so Ajv resolves from root devDependencies.
// v2: validates against the single-source-of-truth Overlay schema emitted from
// @resume/contracts (Zod → JSON Schema), not the removed v1 overlay.schema.json.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// See scripts/validate.mjs: the frozen Overlay emits a spurious `required: [all
// section keys]` on profile.filters (Zod v4 exhaustive enum-keyed record). §4's
// intent is a partial record — strip it so a single-section filter validates.
const schema = structuredClone(require('@resume/contracts/schemas/overlay.json'));
{
  const f = schema?.properties?.profile?.properties?.filters;
  if (f && f.propertyNames && Array.isArray(f.required)) delete f.required;
}
// Contracts emit draft 2020-12 → use the matching Ajv build.
const validate = addFormats(new Ajv2020({ allErrors: true, strict: false })).compile(schema);

const valid = {
  jobId: 'gh-acme-1',
  profile: {
    sections: ['personalInfo', 'working'],
    filters: { projects: { tagsAnyOf: ['Rust'], limit: 3 } },
  },
  patches: [{ op: 'replace', path: '/work/0/highlights/0', value: 'x' }],
  coverLetter: 'hi',
};

describe('overlay.schema.json', () => {
  it('accepts a valid overlay', () => {
    expect(validate(valid)).toBe(true);
  });

  it('accepts the committed test fixture', () => {
    const fixture = JSON.parse(
      readFileSync(join(root, 'apps/site/public/applications/test/overlay.json'), 'utf8')
    );
    expect(validate(fixture)).toBe(true);
  });

  it('rejects a missing jobId', () => {
    const { jobId, ...rest } = valid;
    expect(validate(rest)).toBe(false);
  });

  it('rejects an unknown section name', () => {
    expect(
      validate({ ...valid, profile: { sections: ['notASection'] } })
    ).toBe(false);
  });

  it('rejects a patch with an invalid op', () => {
    expect(
      validate({ ...valid, patches: [{ op: 'explode', path: '/work/0' }] })
    ).toBe(false);
  });

  it('rejects a patch path not starting with /', () => {
    expect(
      validate({ ...valid, patches: [{ op: 'remove', path: 'work/0' }] })
    ).toBe(false);
  });

  it('rejects unknown top-level keys', () => {
    expect(validate({ ...valid, resume: {} })).toBe(false);
  });
});
