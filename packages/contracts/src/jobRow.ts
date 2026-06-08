// §10 Discovery → jobs-row write contract.
//
// Verdict: REDESIGN (typed/shared) — v1's write is an untyped Python dict sliced
// to 13 columns (store.py:39); any normalizer key not in COLUMNS is silently
// dropped. v2 defines the row shape once here (mirrored as a Python TypedDict/
// pydantic model kept in lockstep) and validates each record before insert.
// This is exactly the 13 store.COLUMNS (store.py:8-22), now typed. Insert stays
// ON CONFLICT DO NOTHING (store.py:27).
import { z } from 'zod';
import { CompanyFlag } from './db.js';

export const DiscoveredJob = z
  .object({
    id: z.string(), // gh-<co>-<id> | lever-… | ashby-… | jobspy-<site>-<id>
    source: z.string(), // greenhouse|lever|ashby|jobspy:<site>|manual
    company: z.string(),
    title: z.string(),
    location: z.string().nullable(),
    remote: z.boolean().nullable(),
    url: z.string().nullable(),
    posted_at: z.string().nullable(), // ISO date
    jd_text: z.string().nullable(),
    status: z.enum(['new', 'skipped']), // discovery only ever writes these
    skip_reason: z.string().nullable(), // 'title:<term>' | 'jd:<term>' | null
    company_flags: z.array(CompanyFlag),
    dedupe_key: z.string(), // norm(company)|norm(title)|norm(location)
  })
  .strict();
export type DiscoveredJob = z.infer<typeof DiscoveredJob>;
