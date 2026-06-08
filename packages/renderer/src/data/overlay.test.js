// Overlay engine contract:
//  - identity: a patch-free overlay selecting the full profile's sections
//    must deep-equal the built-in full profile (the overlay path adds
//    nothing on its own)
//  - patches apply to a CLONE (canonical resume must never mutate)
//  - filters behave like profile filters
//  - dirty patches and unknown sections throw (no silent fallback)
import { describe, expect, it } from 'vitest';
import resume from './resume.json';
import { applyOverlay } from './overlay';
import { profiles } from './profiles';

const fullDef = resume.meta['x-profiles'].full;

describe('applyOverlay', () => {
  it('identity: empty patches + full sections === built-in full profile data', () => {
    const profile = applyOverlay({
      jobId: 'identity',
      profile: { sections: fullDef.sections },
      patches: [],
    });
    expect(profile.data).toEqual(profiles.full.data);
  });

  it('applies a replace patch without mutating the canonical resume', () => {
    const original = resume.work[0].highlights[2];
    const profile = applyOverlay({
      jobId: 't',
      profile: { sections: ['working'] },
      patches: [{ op: 'replace', path: '/work/0/highlights/2', value: 'PATCHED' }],
    });
    const ambarella = profile.data.working.find((w) => w.title === 'Ambarella Inc.');
    expect(ambarella.content).toContain('PATCHED');
    expect(resume.work[0].highlights[2]).toBe(original); // no mutation
  });

  it('applies section filters (tagsAnyOf + limit)', () => {
    const profile = applyOverlay({
      jobId: 't',
      profile: {
        sections: ['projects'],
        filters: { projects: { tagsAnyOf: ['Embedded Systems'], limit: 1 } },
      },
    });
    expect(profile.data.projects).toHaveLength(1);
    expect(profile.data.projects[0].tags).toContain('Embedded Systems');
  });

  it('respects section selection and order', () => {
    const profile = applyOverlay({
      jobId: 't',
      profile: { sections: ['skills', 'education'] },
    });
    expect(Object.keys(profile.data)).toEqual(['skills', 'education']);
  });

  it('order selects and reorders items by title, overriding other filters', () => {
    const full = applyOverlay({ jobId: 'f', profile: { sections: ['projects'] } });
    const titles = full.data.projects.map((p) => p.title);
    expect(titles.length).toBeGreaterThanOrEqual(2);
    const reversed = [titles[1], titles[0]]; // pick 2, swap order
    const profile = applyOverlay({
      jobId: 't',
      profile: { sections: ['projects'], filters: { projects: { order: reversed } } },
    });
    expect(profile.data.projects.map((p) => p.title)).toEqual(reversed);
  });

  it('order ignores unknown titles and wins over tagsAnyOf/limit', () => {
    const full = applyOverlay({ jobId: 'f', profile: { sections: ['projects'] } });
    const known = full.data.projects[0].title;
    const profile = applyOverlay({
      jobId: 't',
      profile: {
        sections: ['projects'],
        filters: { projects: { order: [known, 'NO SUCH PROJECT'], tagsAnyOf: ['nope'], limit: 0 } },
      },
    });
    expect(profile.data.projects.map((p) => p.title)).toEqual([known]);
  });

  it('throws on a patch that does not apply cleanly', () => {
    expect(() =>
      applyOverlay({
        jobId: 't',
        profile: { sections: ['working'] },
        patches: [{ op: 'replace', path: '/work/99/highlights/0', value: 'x' }],
      })
    ).toThrow(/does not apply/);
  });

  it('throws on an unknown section key', () => {
    expect(() =>
      applyOverlay({ jobId: 't', profile: { sections: ['nonsense'] } })
    ).toThrow(/unknown section/);
  });
});
