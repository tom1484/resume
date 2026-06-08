// Guards the adapter's view-model contract. Components spread items onto DOM
// elements, so any extra key would leak into the DOM as an attribute — the
// allowed-key assertions below are load-bearing, not style. v2 (§3): the
// no-extra-keys / no-undefined guard is extended to ALL sections via
// ViewModels.parse (the strict() + no-undefined Zod), not just experience ones.
import { describe, expect, it } from 'vitest';
import { ViewModels, sectionMeta } from '@resume/contracts';
import type { ResumeDoc, Work, Project } from '@resume/contracts';
import resumeSeed from '../../../../data/resume.json' with { type: 'json' };
import { buildViewModels } from './adapter.js';
import { buildProfileFrom } from './overlay.js';

const resume = resumeSeed as unknown as ResumeDoc;
const vm = buildViewModels(resume);

const pickFor = (key: string): ((e: Work | Project) => boolean) =>
  (sectionMeta(key)?.pick as ((e: Work | Project) => boolean) | undefined) ??
  (() => true);

describe('adapter view models', () => {
  // THE all-section guard (deliverable #4): the migrated seed's view models must
  // pass ViewModels.parse — strict() catches extra keys, the no-undefined guard
  // catches undefined-valued keys, across EVERY section (v1 only guarded
  // experience sections).
  it('ViewModels.parse(buildViewModels(seed)) does not throw (all sections)', () => {
    expect(() => ViewModels.parse(vm)).not.toThrow();
  });

  it('splits work into working and academics by track', () => {
    const academicCount = resume.work.filter((w) =>
      pickFor('academics')(w)
    ).length;
    expect(vm.academics).toHaveLength(academicCount);
    expect(vm.working).toHaveLength(resume.work.length - academicCount);
  });

  it('splits projects into projects and competitions by kind', () => {
    const competitionCount = resume.projects.filter((p) =>
      pickFor('competitions')(p)
    ).length;
    expect(vm.competitions).toHaveLength(competitionCount);
    expect(vm.projects).toHaveLength(resume.projects.length - competitionCount);
  });

  it('every experience item has title, time, and content', () => {
    for (const section of [
      vm.working,
      vm.academics,
      vm.projects,
      vm.competitions,
      vm.extracurriculars,
    ]) {
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
      expect(
        pub.publication.conference || pub.publication.journal
      ).toBeTruthy();
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
    const p = buildProfileFrom(vm, 'x', {
      sections: ['projects'],
      filters: { projects: { limit: 3 } },
    });
    expect(p.data.projects).toHaveLength(3);
  });
});
