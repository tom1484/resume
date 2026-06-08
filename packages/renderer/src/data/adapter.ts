// Adapter: maps the v2 canonical résumé document (ResumeDoc, §2) to the
// view-model shapes the components consume (ViewModels, §3).
//
// IMPORTANT: components spread items onto DOM elements ({...item} -> {...props}),
// so every item must contain EXACTLY the known view-model keys — optional keys
// are omitted (not set to undefined) when absent from the résumé. The §3
// ViewModels Zod (.strict() + no-undefined guard) enforces this; adapter.test
// asserts ViewModels.parse(buildViewModels(seed)) does not throw, all sections.
//
// The work/projects splits are NOT restated here: they come from the §1
// SECTION_REGISTRY `pick` predicates (the single place the split rule lives).
import { sectionMeta } from '@resume/contracts';
import type {
  ResumeDoc,
  Work,
  Project,
  Volunteer,
  ViewModels,
  ExperienceVM,
} from '@resume/contracts';

// Conditionally include a key only when the value is present (mirrors v1 `opt`).
const opt = <V>(key: string, value: V | undefined): Record<string, V> =>
  value !== undefined ? { [key]: value } : {};

// The split predicate for a given section key, drawn from the §1 registry (the
// single place the work/projects split rule lives).
const pickFor = (key: string): ((e: Work | Project) => boolean) =>
  (sectionMeta(key)?.pick as ((e: Work | Project) => boolean) | undefined) ??
  (() => true);

// work[] / projects[] entry -> experience view model
// { title, role?, time, location?, footnote?, highlight?, link?, content, tags? }
function toExperience(
  entry: Work | Project,
  { tags }: { tags?: readonly string[] }
): ExperienceVM {
  const work = entry as Work;
  const project = entry as Project;
  return {
    title: entry.name,
    ...opt('highlight', project.badge), // was x-highlight; projects only (work has no badge)
    ...opt('role', work.position ?? project.roles?.[0]),
    time: entry.time, // was x-time
    ...opt('location', work.location ?? project.location), // was location / x-location
    ...opt('footnote', work.footnote), // was x-footnote
    ...opt('link', entry.links), // was x-links → VM `link`
    content: entry.highlights,
    ...opt('tags', tags as string[] | undefined),
  };
}

export function buildViewModels(resume: ResumeDoc): ViewModels {
  const basics = resume.basics;

  const personalInfo = {
    name: basics.name,
    info: [
      ['Email', basics.email],
      ['Phone', basics.phone],
      ...(basics.location
        ? [
            [
              'Location',
              [basics.location.city, basics.location.region]
                .filter(Boolean)
                .join(', '),
            ],
          ]
        : []),
    ] as [string, string][],
    link: basics.profiles.map((p) => [p.network, p.url]) as [string, string][],
    qrcodes: (basics.qrcodes ?? []).map((q) => [q.label, q.src]) as [
      string,
      string,
    ][],
  };

  const education = resume.education.map((e) => ({
    time: e.time, // was x-time
    title: e.institution,
    content: e.info, // was x-info
    ...opt('selectedCourses', e.courses), // was x-courses
  }));

  const work = resume.work.map((w) =>
    toExperience(w, { tags: w.tags }) // was x-tags
  );
  const working = work.filter((_, i) => pickFor('working')(resume.work[i]));
  const academics = work.filter((_, i) => pickFor('academics')(resume.work[i]));

  const allProjects = resume.projects.map((p) =>
    toExperience(p, { tags: p.tags }) // was stdlib keywords
  );
  const projects = allProjects.filter((_, i) =>
    pickFor('projects')(resume.projects[i])
  );
  const competitions = allProjects.filter((_, i) =>
    pickFor('competitions')(resume.projects[i])
  );

  const extracurriculars = resume.volunteer.map((v: Volunteer) => ({
    title: v.organization,
    ...opt('role', v.position),
    time: v.time, // was x-time
    ...opt('location', v.location), // was x-location
    content: v.highlights,
  }));

  const publications = resume.publications.map((p) => {
    const venue = p.venue; // was x-venue
    return {
      title: p.name,
      authors: p.authors, // was x-authors ('!' marker preserved)
      publication: {
        ...(venue.type === 'conference' ? { conference: venue.name } : {}),
        ...(venue.type === 'journal' ? { journal: venue.name } : {}),
        ...opt('status', p.status), // was x-status
      },
      // §2/§3 FIX: emit `link` from publications[].links (v1 never emitted it).
      // DOM-safe — the seed has no publication links, so the render is unchanged.
      ...opt('link', p.links),
    };
  });

  const skills = resume.skills.flatMap((group) =>
    group.keywords.map((title) => ({ title, category: group.name }))
  );

  return {
    personalInfo,
    education,
    academics,
    working,
    publications,
    competitions,
    projects,
    extracurriculars,
    skills,
  };
}
