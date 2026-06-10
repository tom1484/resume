// §5 Pipeline LLM schemas + score_breakdown.
//
// Jd/Fit/Tailor/Verdict shapes plus a typed score_breakdown (a real Zod schema,
// persisted as jsonb).
import { z } from 'zod';
import { SECTION_KEYS } from './sections.js';

export const JdSchema = z.object({
  hardSkills: z.array(z.string()),
  softSkills: z.array(z.string()),
  mustHaves: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  responsibilities: z.array(z.string()),
  seniority: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'unspecified']),
  citizenshipOrClearanceRequired: z.boolean(),
  sponsorshipAvailable: z.enum(['yes', 'no', 'unstated']),
  internshipTerm: z.string().nullable(),
  minEducation: z.string().nullable(),
});
export type JdSchema = z.infer<typeof JdSchema>;

export const FitSchema = z.object({
  fit: z.number().min(0).max(1),
  rationale: z.string(),
  redFlags: z.array(z.string()),
});
export type FitSchema = z.infer<typeof FitSchema>;

export const TailorSchema = z.object({
  // sections enum from §1
  profile: z.object({
    name: z.string(),
    sections: z.array(z.enum(SECTION_KEYS as unknown as [string, ...string[]])),
    filters: z
      .record(
        z.string(),
        z.object({
          tagsAnyOf: z.array(z.string()).nullable(),
          titleIn: z.array(z.string()).nullable(),
          limit: z.number().int().min(0).nullable(),
        })
      )
      .nullable(),
  }),
  patches: z.array(
    z.object({
      // replace-only (§4 LlmPatch)
      op: z.literal('replace'),
      path: z.string(),
      value: z.string(),
      groundedIn: z.array(z.string()).min(1),
    })
  ),
  coverLetter: z.string(),
});
export type TailorSchema = z.infer<typeof TailorSchema>;

export const VerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      patchIndex: z.number().int(),
      supported: z.boolean(),
      reason: z.string(),
    })
  ),
});
export type VerdictSchema = z.infer<typeof VerdictSchema>;

// §5.3 score_breakdown — real Zod schema, persisted as jsonb. Records WHICH
// constraint/preference moved the score. Score formula: score = w.keyword·keyword
// + w.llmFit·llmFit + w.structural·structural, 4-dp.
export const ScoreBreakdown = z
  .object({
    keyword: z.number(), // keywordScore.value (0.5 floor — §11)
    missingTerms: z.array(z.string()), // top 12
    llmFit: z.number(), // FitSchema.fit
    rationale: z.string(),
    redFlags: z.array(z.string()),
    structural: z.number(), // post-constraint structural value
    // explicit attribution of what moved the score
    constraintsFired: z.array(
      z.object({
        id: z.string(),
        effect: z.enum(['hard', 'penalty']),
        amount: z.number().optional(), // for penalties
      })
    ),
    preferencesApplied: z.array(
      z.object({ id: z.string(), priority: z.number().int() })
    ),
    weights: z.object({
      keyword: z.number(),
      llmFit: z.number(),
      structural: z.number(),
    }),
  })
  .strict();
export type ScoreBreakdown = z.infer<typeof ScoreBreakdown>;
