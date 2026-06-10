// §3 View-model contract — the frozen renderer surface.
//
// The no-extra-keys / no-`undefined` guard covers ALL sections. Components spread
// {...item} onto DOM elements, so any stray key leaks into the DOM as an
// attribute.
import { z } from 'zod';

const Tuple2 = z.tuple([z.string(), z.string()]);

// The §3 guard has TWO halves: no-extra-keys (handled by `.strict()`) and
// no-`undefined`-value. NOTE (spec correction): the spec claims `.optional()` +
// omission alone catches an explicit `undefined`, but in Zod v4 an optional key
// set to `undefined` PASSES `.strict()` (it is treated as absent). Since the
// renderer spreads `{...item}` onto DOM nodes, a literal `undefined`-valued key
// is exactly the DOM leak we guard against. So we add an explicit check that
// rejects any own key whose value is literally `undefined`, and wrap every
// section VM with it — this realizes the binding no-`undefined` invariant.
function rejectUndefinedValues(
  obj: Record<string, unknown>,
  ctx: z.core.$RefinementCtx<Record<string, unknown>>
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `view-model key "${key}" must be omitted, not set to undefined (DOM-leak guard)`,
        path: [key],
      });
    }
  }
}

/** Apply the no-`undefined`-value guard on top of a `.strict()` object schema. */
const guarded = <T extends z.ZodObject>(schema: T) =>
  schema.superRefine((obj, ctx) =>
    rejectUndefinedValues(obj as Record<string, unknown>, ctx)
  );

// EXACT keys the experience components spread (the components destructure
// title/role/time/location/footnote/highlight/link/content/tags). Optional keys
// are OMITTED, never undefined.
export const ExperienceVM = guarded(
  z
    .object({
      title: z.string().min(1),
      time: z.string().min(1),
      content: z.array(z.string()),
      role: z.string().optional(),
      location: z.string().optional(),
      footnote: z.string().optional(),
      highlight: z.string().optional(), // projects badge only
      link: z
        .array(z.object({ text: z.string(), url: z.string() }))
        .optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict()
);
export type ExperienceVM = z.infer<typeof ExperienceVM>;

export const PersonalInfoVM = guarded(
  z
    .object({
      name: z.string(),
      info: z.array(Tuple2),
      link: z.array(Tuple2), // [network, url][]
      qrcodes: z.array(Tuple2), // [label, src][]
    })
    .strict()
);
export type PersonalInfoVM = z.infer<typeof PersonalInfoVM>;

export const EducationVM = guarded(
  z
    .object({
      time: z.string(),
      title: z.string(),
      content: z.array(Tuple2),
      selectedCourses: z.array(Tuple2).optional(),
    })
    .strict()
);
export type EducationVM = z.infer<typeof EducationVM>;

export const PublicationVM = guarded(
  z
    .object({
      title: z.string(),
      authors: z.array(z.string()).min(1),
      publication: z
        .object({
          conference: z.string().optional(),
          journal: z.string().optional(),
          status: z.string().optional(),
        })
        .strict(),
      link: z
        .array(z.object({ text: z.string(), url: z.string() }))
        .optional(), // §2: emitted by the adapter
    })
    .strict()
);
export type PublicationVM = z.infer<typeof PublicationVM>;

export const SkillVM = guarded(
  z.object({ title: z.string(), category: z.string() }).strict()
);
export type SkillVM = z.infer<typeof SkillVM>;

// The adapter test becomes: ViewModels.parse(buildViewModels(resume)) must not
// throw, iterated over EVERY section. .strict() catches extra keys; .optional()
// + omission catches `undefined`.
export const ViewModels = z
  .object({
    personalInfo: PersonalInfoVM,
    education: z.array(EducationVM),
    academics: z.array(ExperienceVM),
    working: z.array(ExperienceVM),
    publications: z.array(PublicationVM),
    competitions: z.array(ExperienceVM),
    projects: z.array(ExperienceVM),
    extracurriculars: z.array(ExperienceVM),
    skills: z.array(SkillVM),
  })
  .strict();
export type ViewModels = z.infer<typeof ViewModels>;
