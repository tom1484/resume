// Guards the adapter's view-model contract. Components spread items onto
// DOM elements, so any extra key would leak into the DOM as an attribute —
// the allowed-key assertions below are load-bearing, not style.
import { describe, expect, it } from 'vitest';
import resume from '../../../../data/resume.json';
import { buildViewModels } from './adapter';
import { buildProfileFrom } from './overlay';

const vm = buildViewModels(resume);

const EXPERIENCE_KEYS = new Set([
  'title', 'role', 'time', 'location', 'footnote', 'highlight', 'link', 'content', 'tags',
]);

describe('adapter view models', () => {
  it('splits work into working and academics by x-section', () => {
    const academicCount = resume.work.filter((w) => w['x-section'] === 'academic').length;
    expect(vm.academics).toHaveLength(academicCount);
    expect(vm.working).toHaveLength(resume.work.length - academicCount);
  });

  it('splits projects into projects and competitions by x-type', () => {
    const competitionCount = resume.projects.filter((p) => p['x-type'] === 'competition').length;
    expect(vm.competitions).toHaveLength(competitionCount);
    expect(vm.projects).toHaveLength(resume.projects.length - competitionCount);
  });

  it('emits only known experience keys (extra keys would leak into the DOM)', () => {
    for (const section of [vm.working, vm.academics, vm.projects, vm.competitions, vm.extracurriculars]) {
      for (const item of section) {
        for (const key of Object.keys(item)) {
          expect(EXPERIENCE_KEYS).toContain(key);
        }
      }
    }
  });

  it('omits optional keys rather than setting them to undefined', () => {
    for (const item of [...vm.working, ...vm.projects]) {
      for (const value of Object.values(item)) {
        expect(value).not.toBeUndefined();
      }
    }
  });

  it('every experience item has title, time, and content', () => {
    for (const section of [vm.working, vm.academics, vm.projects, vm.competitions, vm.extracurriculars]) {
      for (const item of section) {
        expect(item.title).toBeTruthy();
        expect(item.time).toBeTruthy();
        expect(Array.isArray(item.content)).toBe(true);
      }
    }
  });

  it('preserves publication author highlight markers and venue', () => {
    for (const pub of vm.publications) {
      expect(pub.authors.length).toBeGreaterThan(0);
      expect(pub.publication.conference || pub.publication.journal).toBeTruthy();
    }
    expect(vm.publications[0].authors).toContain('!Chu-Rong Chen');
  });

  it('flattens skills with category preserved in group order', () => {
    expect(vm.skills[0]).toEqual({
      title: resume.skills[0].keywords[0],
      category: resume.skills[0].name,
    });
    const total = resume.skills.reduce((n, g) => n + g.keywords.length, 0);
    expect(vm.skills).toHaveLength(total);
  });

  it('surfaces basics.name in personalInfo', () => {
    expect(vm.personalInfo.name).toBe(resume.basics.name);
  });
});

describe('buildProfileFrom', () => {
  it('assembles selected sections unfiltered', () => {
    const p = buildProfileFrom(vm, 'x', { sections: ['projects', 'skills'] });
    expect(p.data.projects).toHaveLength(vm.projects.length);
    expect(p.data.skills).toHaveLength(vm.skills.length);
    expect(Object.keys(p.data)).toEqual(['projects', 'skills']);
  });

  it('applies a limit filter', () => {
    const p = buildProfileFrom(vm, 'x', { sections: ['projects'], filters: { projects: { limit: 3 } } });
    expect(p.data.projects).toHaveLength(3);
  });
});
