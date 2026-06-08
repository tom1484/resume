import { describe, it, expect } from 'vitest';
import { ViewModels } from './viewModel.js';

// A minimal but valid view-model object exercising ALL 9 sections — this is the
// v1 DOM-leak gap being closed: the no-extra-keys / no-undefined guard now covers
// non-experience sections (personalInfo/education/publications/skills) too.
function validViewModels() {
  return {
    personalInfo: {
      name: 'Tom',
      info: [['email', 'tom@example.com']] as [string, string][],
      link: [['GitHub', 'https://github.com/x']] as [string, string][],
      qrcodes: [] as [string, string][],
    },
    education: [
      {
        time: '2021 - 2025',
        title: 'University',
        content: [['BSc', 'CS']] as [string, string][],
      },
    ],
    academics: [{ title: 'Lab', time: '2024', content: ['did research'] }],
    working: [{ title: 'Acme', time: '2023', content: ['shipped'] }],
    publications: [
      {
        title: 'A Paper',
        authors: ['!Tom', 'Coauthor'],
        publication: { conference: 'NeurIPS' },
      },
    ],
    competitions: [{ title: 'Hackathon', time: '2022', content: ['won'] }],
    projects: [{ title: 'Side', time: '2021', content: ['built'] }],
    extracurriculars: [{ title: 'Club', time: '2020', content: ['led'] }],
    skills: [{ title: 'Languages', category: 'TypeScript, Python' }],
  };
}

describe('ViewModels guard (§3) — all 9 sections', () => {
  it('parses a valid all-section view-model object', () => {
    expect(() => ViewModels.parse(validViewModels())).not.toThrow();
  });

  // .strict() catches extra keys on EVERY section, including non-experience ones.
  const extraKeyCases: Array<[string, (vm: ReturnType<typeof validViewModels>) => void]> = [
    ['education', (vm) => ((vm.education[0] as Record<string, unknown>).bogus = 'x')],
    ['publications', (vm) => ((vm.publications[0] as Record<string, unknown>).bogus = 'x')],
    ['personalInfo', (vm) => ((vm.personalInfo as Record<string, unknown>).bogus = 'x')],
    ['skills', (vm) => ((vm.skills[0] as Record<string, unknown>).bogus = 'x')],
    ['working', (vm) => ((vm.working[0] as Record<string, unknown>).bogus = 'x')],
  ];
  for (const [section, mutate] of extraKeyCases) {
    it(`rejects an extra key on ${section}`, () => {
      const vm = validViewModels();
      mutate(vm);
      expect(() => ViewModels.parse(vm)).toThrow();
    });
  }

  it('rejects an undefined value on education (DOM-leak)', () => {
    const vm = validViewModels();
    (vm.education[0] as Record<string, unknown>).selectedCourses = undefined;
    expect(() => ViewModels.parse(vm)).toThrow();
  });

  it('rejects an undefined value on publications (DOM-leak)', () => {
    const vm = validViewModels();
    (vm.publications[0] as Record<string, unknown>).link = undefined;
    expect(() => ViewModels.parse(vm)).toThrow();
  });

  it('rejects an undefined value on an experience section', () => {
    const vm = validViewModels();
    (vm.working[0] as Record<string, unknown>).role = undefined;
    expect(() => ViewModels.parse(vm)).toThrow();
  });
});
