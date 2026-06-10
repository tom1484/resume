// §2 Résumé document schema.
//
// Keep only fields a live consumer reads. `pnpm validate` validates against this
// single Zod-derived schema. Consumers: the adapter (view-models), profile
// (candidateTerms/profileText), the editor model (SECTIONS source/titleKey),
// tailor patchableMap (highlight paths), and print (meta.print).
import { z } from 'zod';
import { SECTION_KEYS } from './sections.js';
import { PrintConfig } from './print.js';

const Tuple2 = z.tuple([z.string(), z.string()]);
const Link = z.object({
  text: z.string().min(1),
  url: z.string().regex(/^https?:\/\/.+/),
});
const time = z.string().min(4); // display range, e.g. "Jun 2025 - Aug 2025"

export const Basics = z
  .object({
    name: z.string().min(1),
    headline: z.string().optional(), // scoring-only, not rendered
    email: z.string(),
    phone: z.string().optional(),
    location: z
      .object({
        city: z.string().optional(),
        region: z.string().optional(),
        countryCode: z.string().optional(),
      })
      .optional(),
    profiles: z
      .array(
        z.object({
          network: z.string(),
          username: z.string().optional(),
          url: z.string(),
        })
      )
      .default([]),
    qrcodes: z
      .array(z.object({ label: z.string(), src: z.string() }))
      .default([]), // read by the adapter
  })
  .strict();
export type Basics = z.infer<typeof Basics>;

export const Education = z
  .object({
    institution: z.string().min(1),
    area: z.string().optional(), // scoring-only (profile fit text)
    studyType: z.string().optional(), // scoring-only
    time,
    info: z.array(Tuple2), // content rows (required)
    courses: z.array(Tuple2).optional(), // graded rows (optional)
  })
  .strict();
export type Education = z.infer<typeof Education>;

export const Work = z
  .object({
    name: z.string().min(1),
    position: z.string().optional(),
    location: z.string().optional(),
    time,
    track: z.enum(['academic', 'industry']).optional(), // §1 split; absent ⇒ industry/working
    footnote: z.string().optional(),
    links: z.array(Link).optional(),
    tags: z.array(z.string()).optional(),
    highlights: z.array(z.string()).default([]),
  })
  .strict();
export type Work = z.infer<typeof Work>;

export const Project = z
  .object({
    name: z.string().min(1),
    roles: z.array(z.string()).optional(),
    time,
    kind: z.enum(['competition', 'project']).optional(), // §1 split; absent ⇒ project
    location: z.string().optional(),
    badge: z.string().optional(), // e.g. "Patent"
    links: z.array(Link).optional(),
    tags: z.array(z.string()).optional(),
    highlights: z.array(z.string()).default([]),
  })
  .strict();
export type Project = z.infer<typeof Project>;

export const Volunteer = z
  .object({
    organization: z.string().min(1),
    position: z.string().optional(),
    time,
    location: z.string().optional(),
    highlights: z.array(z.string()).default([]),
  })
  .strict();
export type Volunteer = z.infer<typeof Volunteer>;

export const Publication = z
  .object({
    name: z.string().min(1),
    authors: z.array(z.string().min(1)).min(1), // leading '!' marks the owner — preserved verbatim
    venue: z
      .object({
        type: z.enum(['conference', 'journal']),
        name: z.string().min(1),
      })
      .strict(),
    status: z.string().optional(),
    links: z.array(Link).optional(), // FIX: now emitted by the adapter (§3)
  })
  .strict();
export type Publication = z.infer<typeof Publication>;

export const SkillGroup = z
  .object({ name: z.string(), keywords: z.array(z.string()) })
  .strict();
export type SkillGroup = z.infer<typeof SkillGroup>;

export const ResumeMeta = z
  .object({
    version: z.string().optional(),
    sectionOrder: z.array(
      z.enum(SECTION_KEYS as unknown as [string, ...string[]])
    ), // validated against §1
    print: PrintConfig.optional(),
  })
  .strict();
export type ResumeMeta = z.infer<typeof ResumeMeta>;

export const ResumeDoc = z
  .object({
    basics: Basics,
    education: z.array(Education).default([]),
    work: z.array(Work).default([]),
    projects: z.array(Project).default([]),
    publications: z.array(Publication).default([]),
    volunteer: z.array(Volunteer).default([]),
    skills: z.array(SkillGroup).default([]),
    meta: ResumeMeta,
  })
  .strict();
export type ResumeDoc = z.infer<typeof ResumeDoc>;
