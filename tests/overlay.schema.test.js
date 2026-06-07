// Overlay schema contract: the valid fixture (and the committed test
// overlay) must pass; each invalid fixture must fail for its specific
// reason. Runs at the repo root so Ajv resolves from root devDependencies.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(
  readFileSync(join(root, 'packages/renderer/src/data/overlay.schema.json'), 'utf8')
);
const validate = new Ajv({ allErrors: true }).compile(schema);

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
