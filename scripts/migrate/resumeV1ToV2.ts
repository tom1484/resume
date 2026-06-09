// One-time résumé reshape (CONTRACTS.md §12.2 step 1): the old JSON-Resume +
// `x-` shape → the v2 `ResumeDoc` shape (§2 old→new field map). Pure, typed and
// dependency-light by design: Agent C imports this verbatim for the DB
// migration (latest `resume_versions.data` → new shape), so it depends only on
// the frozen `@resume/contracts` Zod (`ResumeDoc`) and nothing else.
//
// Field map (§2): strip `x-` prefixes; rename split discriminators
// (`x-section`→`track`, `x-type`→`kind`), `basics.label`→`headline`,
// `projects.x-highlight`→`badge`, `projects.keywords`→`tags`; DROP dead stdlib
// (`startDate/endDate/url/score`, education stdlib `courses[]`, `publisher`) and
// dead `x-*` (`work.x-highlight`, `volunteer.x-links/x-tags`, `publications.x-tags`).
// Array order/length is preserved per source (no row drops) so master-bank
// `source` pointers and overlay patch paths stay valid (the slot-preservation
// invariant, §2/§12.2 steps 2–3).
import { ResumeDoc } from '@resume/contracts';
import type {
  ResumeDoc as ResumeDocT,
  Work,
  Project,
  Education,
  Volunteer,
  Publication,
} from '@resume/contracts';

/** Minimal structural view of the v1 (JSON-Resume + `x-`) résumé we read from. */
interface V1Link {
  text: string;
  url: string;
}
interface V1Resume {
  basics?: Record<string, unknown> & {
    name?: string;
    label?: string;
    email?: string;
    phone?: string;
    location?: unknown;
    profiles?: unknown[];
    'x-qrcodes'?: { label: string; src: string }[];
  };
  education?: Record<string, unknown>[];
  work?: Record<string, unknown>[];
  projects?: Record<string, unknown>[];
  publications?: Record<string, unknown>[];
  volunteer?: Record<string, unknown>[];
  skills?: { name?: string; keywords?: string[] }[];
  meta?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Include `key:value` only when `value` is neither undefined nor null. */
const opt = <V>(key: string, value: V): Record<string, V> =>
  value !== undefined && value !== null ? { [key]: value } : {};

const links = (raw: unknown): { links: V1Link[] } | Record<string, never> =>
  Array.isArray(raw) && raw.length ? { links: raw as V1Link[] } : {};

const tags = (raw: unknown): { tags: string[] } | Record<string, never> =>
  Array.isArray(raw) && raw.length ? { tags: raw as string[] } : {};

/**
 * Migrate a v1 résumé document to the v2 `ResumeDoc` shape and validate it.
 * Throws (via `ResumeDoc.parse`) if the result does not conform — a migration
 * that silently produces an invalid doc is never acceptable (§12.3).
 */
export function migrateResumeV1ToV2(oldDoc: unknown): ResumeDocT {
  // Pass-through if the input already conforms to v2 ResumeDoc. The repo SEED
  // (data/resume.json) is `x-`-prefixed and needs the map below, but the LIVE
  // DB résumé (resume_versions) is already un-prefixed / v2-shaped — reshaping
  // it would read absent `x-` fields and produce `undefined`. Validate-first
  // handles both shapes safely.
  const asIs = ResumeDoc.safeParse(oldDoc);
  if (asIs.success) return asIs.data;

  const d = (oldDoc ?? {}) as V1Resume;
  const b = d.basics ?? {};

  const basics = {
    name: b.name as string,
    ...opt('headline', b.label), // basics.label → headline (scoring-only)
    email: b.email as string,
    ...opt('phone', b.phone),
    ...opt('location', b.location),
    profiles: (b.profiles ?? []) as { network: string; username?: string; url: string }[],
    // x-qrcodes → qrcodes
    qrcodes: (b['x-qrcodes'] ?? []).map((q) => ({ label: q.label, src: q.src })),
  };

  const education: Education[] = (d.education ?? []).map((e) => ({
    institution: e.institution as string,
    ...opt('area', e.area), // scoring-only (kept, not rendered)
    ...opt('studyType', e.studyType), // scoring-only
    time: e['x-time'] as string, // x-time → time
    info: (e['x-info'] ?? []) as [string, string][], // x-info → info
    ...opt('courses', e['x-courses']), // x-courses (graded) → courses; stdlib courses[] DROPPED
  }));

  const work: Work[] = (d.work ?? []).map((w) => ({
    name: w.name as string,
    ...opt('position', w.position),
    ...opt('location', w.location),
    time: w['x-time'] as string,
    ...opt('track', w['x-section']), // x-section:'academic' → track:'academic'
    ...opt('footnote', w['x-footnote']),
    ...links(w['x-links']),
    ...tags(w['x-tags']),
    highlights: (w.highlights ?? []) as string[],
    // DROP: stdlib startDate/endDate/url, work.x-highlight (0 instances)
  }));

  const projects: Project[] = (d.projects ?? []).map((p) => ({
    name: p.name as string,
    ...opt('roles', p.roles),
    time: p['x-time'] as string,
    ...opt('kind', p['x-type']), // x-type:'competition' → kind:'competition'
    ...opt('location', p['x-location']),
    ...opt('badge', p['x-highlight']), // x-highlight → badge ("Patent"/"World Champion")
    ...links(p['x-links']),
    ...tags(p.keywords), // stdlib keywords → tags (adapter read keywords)
    highlights: (p.highlights ?? []) as string[],
    // DROP: stdlib startDate/endDate/url, projects.x-tags (adapter used keywords)
  }));

  const volunteer: Volunteer[] = (d.volunteer ?? []).map((v) => ({
    organization: v.organization as string,
    ...opt('position', v.position),
    time: v['x-time'] as string,
    ...opt('location', v['x-location']),
    highlights: (v.highlights ?? []) as string[],
    // DROP: stdlib startDate/endDate, volunteer.x-links / x-tags (0 instances)
  }));

  const publications: Publication[] = (d.publications ?? []).map((p) => {
    const venue = (p['x-venue'] ?? {}) as { type: 'conference' | 'journal'; name: string };
    return {
      name: p.name as string,
      authors: (p['x-authors'] ?? []) as string[], // x-authors → authors ('!' preserved verbatim)
      venue: { type: venue.type, name: venue.name }, // x-venue → venue
      ...opt('status', p['x-status']), // x-status → status
      ...links(p['x-links']), // x-links → links (FIX: emitted by the adapter in v2)
      // DROP: publications.x-tags, stdlib publisher (venue.name is used)
    };
  });

  const skills = (d.skills ?? []).map((g) => ({
    name: g.name as string,
    keywords: (g.keywords ?? []) as string[],
  }));

  const oldMeta = (d.meta ?? {}) as {
    version?: string;
    sectionOrder?: string[];
    print?: unknown;
  };
  const meta = {
    ...opt('version', oldMeta.version),
    sectionOrder: (oldMeta.sectionOrder ?? []) as string[],
    ...opt('print', oldMeta.print),
  };

  const migrated = {
    basics,
    education,
    work,
    projects,
    publications,
    volunteer,
    skills,
    meta,
  };

  // Validate against the frozen §2 schema; parse fills defaults (e.g. print
  // margins) and rejects any field the map missed.
  return ResumeDoc.parse(migrated);
}
