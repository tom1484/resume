// The `jobs` row as the pipeline reads/writes it (a superset of the API's
// PII-minimized projections — the worker sees the raw row). Kept local because
// the pipeline operates on the full row, not the API DTOs.
import type { JdSchema, ScoreBreakdown, CompanyFlag } from '@resume/contracts';

export interface Job {
  id: string;
  source?: string;
  company: string;
  title: string;
  location: string | null;
  url?: string | null;
  jd_text: string | null;
  parsed?: JdSchema | null;
  score?: number | null;
  score_breakdown?: ScoreBreakdown | null;
  status?: string;
  company_flags: CompanyFlag[];
  // populated by processJob for the tailor stage:
}

/** A scored job carrying its parsed JD + score (cycle hands these to tailor). */
export interface ScoredJob extends Job {
  parsed: JdSchema;
  score: number;
}
