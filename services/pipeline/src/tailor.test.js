// Deterministic tailor plumbing: model output -> overlay conversion and
// the mechanical validity gate (schema + patch dry-run + section rules).
import { describe, expect, it } from 'vitest';
import { overlayProblems, toOverlay } from './tailor.js';
import { getResume } from './profile.js';

const resume = getResume();

const job = { id: 'gh-acme-1', company_flags: [] };
const modelOut = {
  profile: {
    name: 'Acme Robotics SWE Intern',
    sections: ['personalInfo', 'education', 'working', 'projects', 'skills'],
    filters: { projects: { tagsAnyOf: ['Embedded Systems'], titleIn: null, limit: 3 } },
  },
  patches: [
    { op: 'replace', path: '/work/0/highlights/0', value: 'rephrased claim', groundedIn: ['some-bullet-0'] },
  ],
  coverLetter: 'Dear team...',
};

describe('toOverlay', () => {
  it('produces a schema-shaped overlay with pending audit', () => {
    const overlay = toOverlay(job, modelOut);
    expect(overlay.jobId).toBe('gh-acme-1');
    expect(overlay.patches).toEqual([{ op: 'replace', path: '/work/0/highlights/0', value: 'rephrased claim' }]);
    expect(overlay.audit.unsupported).toEqual([0]); // verify must clear it
    expect(overlay.profile.filters.projects).toEqual({ tagsAnyOf: ['Embedded Systems'], limit: 3 });
  });
  it('drops empty filters entirely', () => {
    const out = { ...modelOut, profile: { ...modelOut.profile, filters: { projects: { tagsAnyOf: null, titleIn: null, limit: null } } } };
    expect(toOverlay(job, out).profile.filters).toBeUndefined();
  });
});

describe('overlayProblems', () => {
  it('accepts a valid overlay', () => {
    expect(overlayProblems(toOverlay(job, modelOut))).toEqual([]);
  });
  it('rejects a patch to a nonexistent path', () => {
    const bad = toOverlay(job, {
      ...modelOut,
      patches: [{ op: 'replace', path: `/work/${resume.work.length + 5}/highlights/0`, value: 'x', groundedIn: ['b'] }],
    });
    expect(overlayProblems(bad).join(' ')).toMatch(/patch #0/);
  });
  it('rejects a profile without personalInfo', () => {
    const bad = toOverlay(job, { ...modelOut, profile: { ...modelOut.profile, sections: ['working'] } });
    expect(overlayProblems(bad).join(' ')).toMatch(/personalInfo/);
  });
});
