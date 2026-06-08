// Overlay engine contract (§4):
//  - identity: a patch-free overlay selecting the full sections must deep-equal
//    the built-in full view models (the overlay path adds nothing on its own)
//  - patches apply to a CLONE (canonical résumé must never mutate)
//  - filters behave like profile filters
//  - dirty patches and unknown sections throw (no silent fallback)
import { describe, expect, it } from 'vitest';
import type { Overlay, ResumeDoc } from '@resume/contracts';
import resumeSeed from '../../../../data/resume.json' with { type: 'json' };
import { applyOverlay } from './overlay.js';
import { buildViewModels } from './adapter.js';

const resume = resumeSeed as unknown as ResumeDoc;

const ALL_SECTIONS = [
  'personalInfo',
  'education',
  'academics',
  'working',
  'publications',
  'competitions',
  'projects',
  'extracurriculars',
  'skills',
];

// Helper: build an overlay loosely (tests pass partial shapes intentionally).
const ov = (o: object): Overlay => o as Overlay;

describe('applyOverlay', () => {
  it('identity: empty patches + all sections === unfiltered view models', () => {
    const profile = applyOverlay(
      ov({ jobId: 'identity', profile: { sections: ALL_SECTIONS }, patches: [] })
    );
    const vm = buildViewModels(resume) as Record<string, unknown>;
    for (const key of ALL_SECTIONS)
      expect(profile.data[key as keyof typeof profile.data]).toEqual(vm[key]);
  });

  it('applies a replace patch without mutating the canonical résumé', () => {
    const original = resume.work[0].highlights[2];
    const profile = applyOverlay(
      ov({
        jobId: 't',
        profile: { sections: ['working'] },
        patches: [
          { op: 'replace', path: '/work/0/highlights/2', value: 'PATCHED' },
        ],
      })
    );
    const ambarella = (profile.data.working as Array<{ title: string; content: string[] }>).find(
      (w) => w.title === 'Ambarella Inc.'
    )!;
    expect(ambarella.content).toContain('PATCHED');
    expect(resume.work[0].highlights[2]).toBe(original); // no mutation
  });

  it('applies section filters (tagsAnyOf + limit)', () => {
    const profile = applyOverlay(
      ov({
        jobId: 't',
        profile: {
          sections: ['projects'],
          filters: { projects: { tagsAnyOf: ['Embedded Systems'], limit: 1 } },
        },
      })
    );
    const projects = profile.data.projects as Array<{ tags?: string[] }>;
    expect(projects).toHaveLength(1);
    expect(projects[0].tags).toContain('Embedded Systems');
  });

  it('respects section selection and order', () => {
    const profile = applyOverlay(
      ov({ jobId: 't', profile: { sections: ['skills', 'education'] } })
    );
    expect(Object.keys(profile.data)).toEqual(['skills', 'education']);
  });

  it('excludes items by title', () => {
    const all = applyOverlay(ov({ jobId: 't', profile: { sections: ['working'] } }));
    const allWorking = all.data.working as Array<{ title: string }>;
    const drop = allWorking[0].title;
    const filtered = applyOverlay(
      ov({
        jobId: 't',
        profile: { sections: ['working'], filters: { working: { exclude: [drop] } } },
      })
    );
    const filteredWorking = filtered.data.working as Array<{ title: string }>;
    expect(filteredWorking.map((w) => w.title)).not.toContain(drop);
    expect(filteredWorking).toHaveLength(allWorking.length - 1);
  });

  it('reorders items by the order list, unlisted kept after', () => {
    const all = applyOverlay(ov({ jobId: 't', profile: { sections: ['projects'] } }));
    const titles = (all.data.projects as Array<{ title: string }>).map((p) => p.title);
    const last = titles[titles.length - 1];
    const reordered = applyOverlay(
      ov({
        jobId: 't',
        profile: { sections: ['projects'], filters: { projects: { order: [last] } } },
      })
    );
    const reorderedProjects = reordered.data.projects as Array<{ title: string }>;
    expect(reorderedProjects[0].title).toBe(last); // moved to front
    expect(reorderedProjects).toHaveLength(titles.length); // none dropped
  });

  it('throws on a patch that does not apply cleanly', () => {
    expect(() =>
      applyOverlay(
        ov({
          jobId: 't',
          profile: { sections: ['working'] },
          patches: [{ op: 'replace', path: '/work/99/highlights/0', value: 'x' }],
        })
      )
    ).toThrow(/does not apply/);
  });

  it('throws on an unknown section key', () => {
    expect(() =>
      applyOverlay(ov({ jobId: 't', profile: { sections: ['nonsense'] } }))
    ).toThrow(/unknown section/);
  });
});
