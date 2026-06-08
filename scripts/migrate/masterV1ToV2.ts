// One-time master-bank reshape (CONTRACTS.md §12.2 step 2): drop the `metrics`
// field (never read — the verify tripwire re-extracts numbers from `text`, §11),
// keep `id` (immutable), `text`, `source`, `context`, `tags`. Array order and
// `source` JSON-Pointers are preserved (the résumé migration kept array indices,
// so pointers stay valid). Validated against the frozen `MasterBank` Zod.
// Pure + dependency-light so Agent C can reuse it if needed (master stays
// file-based per §11; the DB does not own it).
import { MasterBank } from '@resume/contracts';
import type { MasterBank as MasterBankT } from '@resume/contracts';

interface V1Bullet {
  id: string;
  text: string;
  source?: string;
  context?: string;
  tags?: string[];
  metrics?: string[]; // DROPPED
  [k: string]: unknown;
}
interface V1Master {
  updatedAt?: string;
  bullets: V1Bullet[];
}

export function migrateMasterV1ToV2(oldBank: unknown): MasterBankT {
  const m = (oldBank ?? {}) as V1Master;
  const bullets = (m.bullets ?? []).map((b) => {
    // Strip `metrics` (and any other stray key) — keep only the known fields.
    const { id, text, source, context, tags } = b;
    return {
      id,
      text,
      ...(source !== undefined ? { source } : {}),
      ...(context !== undefined ? { context } : {}),
      ...(tags !== undefined ? { tags } : {}),
    };
  });
  const next = {
    ...(m.updatedAt !== undefined ? { updatedAt: m.updatedAt } : {}),
    bullets,
  };
  return MasterBank.parse(next);
}
