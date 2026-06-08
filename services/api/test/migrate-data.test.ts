// Data-migration (buildMigration) test: pure transform over a synthetic v1
// export — résumé reshape, per-job re-validation, quarantine (never drop),
// config seeding (F-1 constraints + lifted preference, dead keys dropped).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildMigration } from '../scripts/migrate-v1-to-v2.ts';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'v1export-'));
  writeFileSync(
    join(dir, 'resume_version.json'),
    JSON.stringify({
      basics: {
        name: 'T',
        label: 'Robotics Intern',
        email: 't@e.co',
        profiles: [],
        'x-qrcodes': [],
      },
      education: [
        {
          institution: 'GT',
          'x-time': '2024',
          'x-info': [['GPA', '4.0']],
          courses: ['dead'],
        },
      ],
      work: [
        {
          name: 'Lab',
          'x-time': '2025',
          'x-section': 'academic',
          'x-tags': ['ros'],
          highlights: ['x'],
        },
      ],
      projects: [
        {
          name: 'Bot',
          'x-time': '2025',
          'x-type': 'competition',
          'x-highlight': 'World Champion',
          keywords: ['c++'],
          highlights: ['won'],
        },
      ],
      publications: [
        {
          name: 'P',
          'x-authors': ['!T', 'Co'],
          'x-venue': { type: 'conference', name: 'ICRA' },
        },
      ],
      volunteer: [],
      skills: [],
      meta: { sectionOrder: ['personalInfo'] },
    })
  );
  writeFileSync(
    join(dir, 'jobs.json'),
    JSON.stringify([
      {
        id: 'ok-1',
        overlay: {
          jobId: 'ok-1',
          profile: { sections: ['personalInfo', 'working'] },
          patches: [],
        },
        parsed: {
          hardSkills: [],
          softSkills: [],
          mustHaves: [],
          niceToHaves: [],
          responsibilities: [],
          seniority: 'intern',
          citizenshipOrClearanceRequired: false,
          sponsorshipAvailable: 'unstated',
          internshipTerm: null,
          minEducation: null,
        },
        audit: { claims: [], unsupported: [] },
      },
      {
        id: 'bad-2',
        overlay: { jobId: 'bad-2', profile: { sections: ['working'] }, patches: [] },
        parsed: { wrong: true },
      },
    ])
  );
  writeFileSync(
    join(dir, 'answers.json'),
    JSON.stringify([{ key: 'salary', question: 'q', answer: 'a' }])
  );
  writeFileSync(
    join(dir, 'discovery.json'),
    JSON.stringify({
      searches: [{ name: 's', term: 't', keywords: ['DEAD'] }],
      companies: [
        {
          name: 'Figure',
          flags: ['dream'],
          board: { provider: 'greenhouse', slug: 'figureai' },
        },
      ],
    })
  );
  writeFileSync(
    join(dir, 'env.json'),
    JSON.stringify({ cron: '0 9 * * *', tz: 'Asia/Taipei', mode: 'all' })
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('buildMigration', () => {
  it('reshapes the résumé (x- stripped, discriminators renamed, ! preserved)', () => {
    const r = buildMigration(dir);
    expect(r.report.resume.migrated).toBe(true);
    const doc = r.migratedResume as Record<string, any>;
    expect(doc.basics.headline).toBe('Robotics Intern');
    expect(doc.work[0].track).toBe('academic');
    expect(doc.work[0].tags).toEqual(['ros']);
    expect(doc.projects[0].kind).toBe('competition');
    expect(doc.projects[0].badge).toBe('World Champion');
    expect(doc.projects[0].tags).toEqual(['c++']);
    expect(doc.publications[0].authors).toEqual(['!T', 'Co']); // ! preserved
    // dead stdlib education.courses string array dropped; only x-info kept
    expect(doc.education[0].courses).toBeUndefined();
  });

  it('keeps the valid job, quarantines the bad one (never drops)', () => {
    const r = buildMigration(dir);
    expect(r.report.jobs.total).toBe(2);
    expect(r.report.jobs.overlaysKept).toBe(1);
    expect(r.report.jobs.overlaysDropped).toBe(1);
    expect(r.report.jobs.parsedNulled).toBe(1);
    // both jobs survive as rows (the bad one nulled, not removed)
    expect(r.migratedJobs.map((j) => j.id)).toEqual(['ok-1', 'bad-2']);
    const badOverlay = r.report.quarantine.find(
      (q) => q.kind === 'job.overlay' && q.id === 'bad-2'
    );
    expect(badOverlay?.problems).toContain(
      'profile.sections must include personalInfo'
    );
  });

  it('seeds all 5 config namespaces with F-1 constraints + lifted preference', () => {
    const r = buildMigration(dir);
    expect(r.report.config.namespaces.sort()).toEqual([
      'constraints',
      'discovery',
      'llm',
      'preferences',
      'schedule',
    ]);
    const c = r.configRows.find((x) => x.ns === 'constraints')!
      .value as any[];
    expect(c.map((x) => x.id)).toEqual([
      'f1-no-citizenship',
      'f1-seniority',
      'f1-sponsorship',
    ]);
    expect(c[0].effect.kind).toBe('hard');
    const p = r.configRows.find((x) => x.ns === 'preferences')!.value as any[];
    expect(p[0].text).toMatch(/Summer 2027/);
    // dead search keys (keywords) dropped
    const d = r.configRows.find((x) => x.ns === 'discovery')!.value as any;
    expect(d.searches[0]).not.toHaveProperty('keywords');
  });

  it('keeps valid answers', () => {
    const r = buildMigration(dir);
    expect(r.report.answers.kept).toBe(1);
  });
});
