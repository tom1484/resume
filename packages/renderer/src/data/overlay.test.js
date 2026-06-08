// Overlay engine contract:
//  - identity: a patch-free overlay selecting the full profile's sections
//    must deep-equal the built-in full profile (the overlay path adds
//    nothing on its own)
//  - patches apply to a CLONE (canonical resume must never mutate)
//  - filters behave like profile filters
//  - dirty patches and unknown sections throw (no silent fallback)
import { describe, expect, it } from 'vitest';
import resume from '../../../../data/resume.json';
import { applyOverlay } from './overlay';
import { buildViewModels } from './adapter';

const ALL_SECTIONS = ['personalInfo', 'education', 'academics', 'working', 'publications', 'competitions', 'projects', 'extracurriculars', 'skills'];

describe('applyOverlay', () => {
  it('identity: empty patches + all sections === unfiltered view models', () => {
    const profile = applyOverlay({
      jobId: 'identity',
      profile: { sections: ALL_SECTIONS },
      patches: [],
    });
    const vm = buildViewModels(resume);
    for (const key of ALL_SECTIONS) expect(profile.data[key]).toEqual(vm[key]);
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

  it('excludes items by title', () => {
    const all = applyOverlay({ jobId: 't', profile: { sections: ['working'] } });
    const drop = all.data.working[0].title;
    const filtered = applyOverlay({
      jobId: 't',
      profile: { sections: ['working'], filters: { working: { exclude: [drop] } } },
    });
    expect(filtered.data.working.map((w) => w.title)).not.toContain(drop);
    expect(filtered.data.working).toHaveLength(all.data.working.length - 1);
  });

  it('reorders items by the order list, unlisted kept after', () => {
    const all = applyOverlay({ jobId: 't', profile: { sections: ['projects'] } });
    const titles = all.data.projects.map((p) => p.title);
    const last = titles[titles.length - 1];
    const reordered = applyOverlay({
      jobId: 't',
      profile: { sections: ['projects'], filters: { projects: { order: [last] } } },
    });
    expect(reordered.data.projects[0].title).toBe(last); // moved to front
    expect(reordered.data.projects).toHaveLength(all.data.projects.length); // none dropped
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
