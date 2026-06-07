// Adapter: maps the canonical JSON Resume document (resume.json, v1.0.0 +
// x- extensions) to the view-model shapes the components consume.
//
// IMPORTANT: components spread items onto DOM elements ({...item} -> {...props}),
// so every item must contain EXACTLY the known view-model keys — optional keys
// are omitted (not set to undefined) when absent from resume.json.

// Conditionally include a key only when the value is present
const opt = (key, value) => (value !== undefined ? { [key]: value } : {});

// work[] / projects[] entry -> experience view model
// { title, role?, time, location?, footnote?, highlight?, link?, content, tags? }
function toExperience(entry, { org, tags }) {
  return {
    title: entry[org],
    ...opt('highlight', entry['x-highlight']),
    ...opt('role', entry.position ?? entry.roles?.[0]),
    time: entry['x-time'],
    ...opt('location', entry.location ?? entry['x-location']),
    ...opt('footnote', entry['x-footnote']),
    ...opt('link', entry['x-links']),
    content: entry.highlights,
    ...opt('tags', entry[tags]),
  };
}

export function buildViewModels(resume) {
  const basics = resume.basics;

  const personalInfo = {
    name: basics.name,
    info: [
      ['Email', basics.email],
      ['Phone', basics.phone],
    ],
    link: basics.profiles.map((p) => [p.network, p.url]),
    qrcodes: (basics['x-qrcodes'] ?? []).map((q) => [q.label, q.src]),
  };

  const education = resume.education.map((e) => ({
    time: e['x-time'],
    title: e.institution,
    content: e['x-info'],
    ...opt('selectedCourses', e['x-courses']),
  }));

  const work = resume.work.map((w) => toExperience(w, { org: 'name', tags: 'x-tags' }));
  const working = work.filter((_, i) => resume.work[i]['x-section'] !== 'academic');
  const academics = work.filter((_, i) => resume.work[i]['x-section'] === 'academic');

  const allProjects = resume.projects.map((p) => toExperience(p, { org: 'name', tags: 'keywords' }));
  const projects = allProjects.filter((_, i) => resume.projects[i]['x-type'] !== 'competition');
  const competitions = allProjects.filter((_, i) => resume.projects[i]['x-type'] === 'competition');

  const extracurriculars = resume.volunteer.map((v) => ({
    title: v.organization,
    ...opt('role', v.position),
    time: v['x-time'],
    ...opt('location', v['x-location']),
    content: v.highlights,
  }));

  const publications = resume.publications.map((p) => {
    const venue = p['x-venue'] ?? {};
    return {
      title: p.name,
      authors: p['x-authors'],
      publication: {
        ...(venue.type === 'conference' ? { conference: venue.name } : {}),
        ...(venue.type === 'journal' ? { journal: venue.name } : {}),
        ...opt('status', p['x-status']),
      },
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
