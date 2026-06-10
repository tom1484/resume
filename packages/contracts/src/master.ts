// §11 Master bank schema (grounding corpus).
//
// No `metrics` field — the numeric tripwire re-extracts numbers from `text`.
// Stays file-based (grounding corpus), not DB-backed; editing the résumé via the
// web does NOT change the bank.
// Master bank `id` is IMMUTABLE once referenced — renaming orphans groundedIn
// refs silently. groundedIn refs are bare `<id>`.
import { z } from 'zod';

export const MasterBullet = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), // kebab, IMMUTABLE once referenced
    text: z.string().min(1),
    source: z
      .string()
      .regex(/^(\/|$)/)
      .optional(), // JSON-Pointer into the résumé
    context: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // metrics: DROPPED — tripwire re-extracts from `text`
  })
  .strict();
export type MasterBullet = z.infer<typeof MasterBullet>;

export const MasterBank = z
  .object({
    updatedAt: z.string().optional(),
    bullets: z.array(MasterBullet).min(1),
  })
  .strict();
export type MasterBank = z.infer<typeof MasterBank>;
