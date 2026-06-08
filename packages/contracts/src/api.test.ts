import { describe, it, expect } from 'vitest';
import { overlayProblems } from './api.js';

// A small known-good résumé doc (the patch-target). Only the arrays the patches
// touch need to be real; overlayProblems validates the overlay, not the résumé.
const resumeDoc = {
  basics: { name: 'Tom', email: 'tom@example.com' },
  work: [{ name: 'Acme', time: '2023', highlights: ['shipped a thing'] }],
  meta: { sectionOrder: ['personalInfo', 'working'] },
};

function validOverlay() {
  return {
    jobId: 'job-1',
    profile: {
      name: 'tailored',
      sections: ['personalInfo', 'working'],
    },
    patches: [
      { op: 'replace', path: '/work/0/highlights/0', value: 'shipped a better thing' },
    ],
  };
}

describe('overlayProblems (§8.1) — the one impl', () => {
  it('returns [] for a valid overlay', () => {
    expect(overlayProblems(validOverlay(), resumeDoc)).toEqual([]);
  });

  it('returns non-empty for a bad patch path', () => {
    const ov = validOverlay();
    ov.patches = [
      { op: 'replace', path: '/work/99/highlights/0', value: 'no such index' },
    ];
    const problems = overlayProblems(ov, resumeDoc);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toMatch(/patch #0/);
  });

  it('returns non-empty for jobId issues', () => {
    const ov = validOverlay();
    (ov as { jobId: string }).jobId = ''; // min(1) violation
    const problems = overlayProblems(ov, resumeDoc);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toMatch(/jobId/);
  });

  it('returns non-empty when profile.sections is missing personalInfo', () => {
    const ov = validOverlay();
    ov.profile.sections = ['working']; // dropped personalInfo
    const problems = overlayProblems(ov, resumeDoc);
    expect(problems).toContain('profile.sections must include personalInfo');
  });
});
