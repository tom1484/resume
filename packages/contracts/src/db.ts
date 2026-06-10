// §7 DB schema — PII-minimized projections + lifecycle.
//
// Core tables: jobs/events/answers/resume_versions/config. Projections are
// PII-minimized — they fetch only the columns the SPA renders.
import { z } from 'zod';
import { ScoreBreakdown } from './pipeline.js';
import { Overlay, Audit } from './overlay.js';

// §7.2 status lifecycle (001_init.sql:2-4; text not enum so it grows):
// new → parsing → scored → in_review → approved → applying → applied →
// responded | rejected | skipped | error.
// applying/applied/responded are Phase-4 placeholders (designed now).
export const JobStatus = z.enum([
  'new',
  'parsing',
  'scored',
  'in_review',
  'approved',
  'applying', // Phase-4 placeholder
  'applied', // Phase-4 placeholder
  'responded', // Phase-4 placeholder
  'rejected',
  'skipped',
  'error',
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const CompanyFlag = z.enum(['dream', 'startup', 'return-path']);
export type CompanyFlag = z.infer<typeof CompanyFlag>;

// Inbox list projection — the ONLY columns /api/jobs (list) returns.
export const JobListItem = z
  .object({
    id: z.string(),
    company: z.string(),
    title: z.string(),
    location: z.string().nullable(),
    score: z.number().nullable(),
    status: JobStatus,
    company_flags: z.array(CompanyFlag),
    label: z.enum(['good', 'bad']).nullable(),
  })
  .strict();
export type JobListItem = z.infer<typeof JobListItem>;

// Detail projection — drops source/remote/posted_at/reviewed_at (unrendered).
// reject_reason kept (reviewer sees why a job was rejected).
export const JobDetail = z
  .object({
    id: z.string(),
    company: z.string(),
    title: z.string(),
    location: z.string().nullable(),
    url: z.string().nullable(),
    status: JobStatus,
    score: z.number().nullable(),
    score_breakdown: ScoreBreakdown.nullable(),
    company_flags: z.array(CompanyFlag),
    label: z.enum(['good', 'bad']).nullable(),
    reject_reason: z.string().nullable(),
    parsed: z.unknown().nullable(), // JdSchema-shaped (§5)
    jd_text: z.string().nullable(),
    overlay: Overlay.nullable(),
    audit: Audit.nullable(),
    cover_letter: z.string().nullable(),
  })
  .strict();
export type JobDetail = z.infer<typeof JobDetail>;

// §7.3 answers (002:10-16; seed 003): {id, key UNIQUE, question, answer,
// updated_at}. The CRUD body shape:
export const Answer = z
  .object({
    key: z.string(),
    question: z.string(),
    answer: z.string(),
  })
  .strict();
export type Answer = z.infer<typeof Answer>;
