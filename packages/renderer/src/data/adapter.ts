// Adapter: maps the canonical résumé document (ResumeDoc, §2) to the
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

// Conditionally include a key only when the value is present.
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
    ...opt('highlight', project.badge), // projects only (work has no badge)
    ...opt('role', work.position ?? project.roles?.[0]),
    time: entry.time,
    ...opt('location', work.location ?? project.location),
    ...opt('footnote', work.footnote),
    ...opt('link', entry.links), // → VM `link`
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
    time: e.time,
    title: e.institution,
    content: e.info,
    ...opt('selectedCourses', e.courses),
  }));

  const work = resume.work.map((w) =>
    toExperience(w, { tags: w.tags })
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
    time: v.time,
    ...opt('location', v.location),
    content: v.highlights,
  }));

  const publications = resume.publications.map((p) => {
    const venue = p.venue;
    return {
      title: p.name,
      authors: p.authors, // '!' marker preserved
      publication: {
        ...(venue.type === 'conference' ? { conference: venue.name } : {}),
        ...(venue.type === 'journal' ? { journal: venue.name } : {}),
        ...opt('status', p.status),
      },
      // §2/§3: emit `link` from publications[].links. DOM-safe — the seed has no
      // publication links, so the render is unchanged.
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
