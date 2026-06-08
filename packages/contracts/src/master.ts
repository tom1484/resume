// §11 Master bank schema (grounding corpus).
//
// Verdict: KEEP, DROP `metrics` (brief): never read — the tripwire re-extracts
// numbers from `text` (verify.js:24), not from `metrics`. Stays file-based
// (grounding corpus, profile.js:13), not DB-backed; editing the résumé via the
// web does NOT change the bank.
// Master bank `id` is IMMUTABLE once referenced — renaming orphans groundedIn
// refs silently (DECISIONS must-preserve). groundedIn refs are bare `<id>`
// (matches the working code, tailor.js:84/verify.js:54-56; the `master:` prefix
// in master.schema.json:4 / overlay.schema.json:92 is doc-only drift — §11 flag).
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
