import { describe, it, expect } from 'vitest';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { toJsonSchema } from './schemas.js';

// The emitted ResumeDoc JSON Schema must compile under Ajv and validate a small
// known-good résumé; reject one missing `basics`.
function knownGoodResume() {
  return {
    basics: { name: 'Tom', email: 'tom@example.com' },
    education: [
      { institution: 'Uni', time: '2021 - 2025', info: [['BSc', 'CS']] },
    ],
    work: [{ name: 'Acme', time: '2023', highlights: ['shipped'] }],
    meta: { sectionOrder: ['personalInfo', 'education', 'working'] },
  };
}

describe('emitted JSON Schemas (§ schema emission)', () => {
  it('ResumeDoc schema compiles under Ajv and validates a known-good résumé', () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = toJsonSchema('resume');
    const validate = ajv.compile(schema as object);

    expect(validate(knownGoodResume())).toBe(true);
  });

  it('rejects a résumé missing basics', () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(toJsonSchema('resume') as object);

    const bad = knownGoodResume() as Record<string, unknown>;
    delete bad.basics;
    expect(validate(bad)).toBe(false);
  });

  it('emits Overlay and MasterBank schemas that compile', () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    expect(() => ajv.compile(toJsonSchema('overlay') as object)).not.toThrow();
    expect(() => ajv.compile(toJsonSchema('master') as object)).not.toThrow();
  });
});
