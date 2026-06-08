// Deterministic tailor plumbing: model output -> overlay conversion and the
// mechanical validity gate (the ONE overlayProblems from @resume/contracts:
// Zod + patch dry-run + personalInfo rule). No LLM, no DB (uses the file seed).
import { describe, expect, it } from 'vitest';
import { overlayProblems, type TailorSchema } from '@resume/contracts';
import { toOverlay } from './tailor.js';
import { getResume } from './profile.js';

const resume = getResume();
const job = { id: 'gh-acme-1' };

const modelOut: TailorSchema = {
  profile: {
    name: 'Acme Robotics SWE Intern',
    sections: ['personalInfo', 'education', 'working', 'projects', 'skills'],
    filters: { projects: { tagsAnyOf: ['Embedded Systems'], titleIn: null, limit: 3 } },
  },
  patches: [
    {
      op: 'replace',
      path: '/work/0/highlights/0',
      value: 'rephrased claim',
      groundedIn: ['some-bullet-0'],
    },
  ],
  coverLetter: 'Dear team...',
};

describe('toOverlay', () => {
  it('produces a schema-shaped overlay with pending audit', () => {
    const overlay = toOverlay(job, modelOut);
    expect(overlay.jobId).toBe('gh-acme-1');
    expect(overlay.patches).toEqual([
      { op: 'replace', path: '/work/0/highlights/0', value: 'rephrased claim' },
    ]);
    expect(overlay.audit!.unsupported).toEqual([0]); // verify must clear it
    expect(overlay.profile.filters!.projects).toEqual({
      tagsAnyOf: ['Embedded Systems'],
      limit: 3,
    });
  });
  it('drops empty filters entirely', () => {
    const out: TailorSchema = {
      ...modelOut,
      profile: {
        ...modelOut.profile,
        filters: { projects: { tagsAnyOf: null, titleIn: null, limit: null } },
      },
    };
    expect(toOverlay(job, out).profile.filters).toBeUndefined();
  });
});

describe('overlayProblems (the one shared impl)', () => {
  it('accepts a valid overlay', () => {
    expect(overlayProblems(toOverlay(job, modelOut), resume)).toEqual([]);
  });
  it('rejects a patch to a nonexistent path', () => {
    const bad = toOverlay(job, {
      ...modelOut,
      patches: [
        {
          op: 'replace',
          path: `/work/${resume.work.length + 5}/highlights/0`,
          value: 'x',
          groundedIn: ['b'],
        },
      ],
    });
    expect(overlayProblems(bad, resume).join(' ')).toMatch(/patch #0/);
  });
  it('rejects a profile without personalInfo', () => {
    const bad = toOverlay(job, {
      ...modelOut,
      profile: { ...modelOut.profile, sections: ['working'] },
    });
    expect(overlayProblems(bad, resume).join(' ')).toMatch(/personalInfo/);
  });
});
