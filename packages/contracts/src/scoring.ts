// §5.2 Two-list scoring — Constraints (hard) + Preferences (soft).
//
// Two DB-backed, UI-editable lists. Hard constraints are deterministic
// (citizenship → hard 0; complementary −0.6 seniority / −0.4 sponsorship
// penalties).
import { z } from 'zod';

// The parsed-JD fields a constraint may test (drawn from JdSchema, §5.1).
export const ConstraintField = z.enum([
  'citizenshipOrClearanceRequired', // boolean
  'sponsorshipAvailable', // 'yes'|'no'|'unstated'
  'seniority', // enum
  'minEducation', // string|null
  'internshipTerm', // string|null
]);
export type ConstraintField = z.infer<typeof ConstraintField>;

export const Constraint = z
  .object({
    id: z.string(), // stable key
    label: z.string(), // UI: "must accept F-1 (no citizenship/clearance)"
    field: ConstraintField,
    // deterministic predicate over the field value, expressed as a typed test:
    test: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('isTrue') }), // boolean field is true
      z.object({ kind: z.literal('equals'), value: z.string() }), // enum/string equality
      z.object({ kind: z.literal('notIn'), values: z.array(z.string()) }), // e.g. seniority NOT in [intern,entry,unspecified]
    ]),
    effect: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('hard') }), // fire ⇒ score 0
      z.object({
        kind: z.literal('penalty'),
        amount: z.number().min(0).max(1),
      }), // subtract from structural
    ]),
    enabled: z.boolean().default(true),
  })
  .strict();
export type Constraint = z.infer<typeof Constraint>;

// Preferences (soft, priority 1–10). Free-text considerations fed to the LLM
// scorer as weighted text. They do NOT alter the deterministic structural score;
// they are injected into the llmFit system prompt as a ranked, labeled block and
// the prompt weights them by priority:
//   9–10 [decisive] | 6–8 [important] | 3–5 [moderate] | 1–2 [mild].
// Sorted descending by priority, rendered as `- [decisive] <text>` lines.
export const Preference = z
  .object({
    id: z.string(),
    text: z.string().min(1), // "Prefers robotics/embedded autonomy roles"
    priority: z.number().int().min(1).max(10), // 1 = mild, 10 = decisive
    enabled: z.boolean().default(true),
  })
  .strict();
export type Preference = z.infer<typeof Preference>;
