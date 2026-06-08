// Stage: parse_jd — structured extraction of JD requirements (PROPOSALS §5).
// Model + JD-truncation come from LlmConfig (§6), not env.
import { JdSchema, type LlmConfig } from '@resume/contracts';
import { structuredCall } from './llm.js';
import type { Job } from './types.js';

const SYSTEM = `You extract structured requirements from job descriptions for a candidate-side
matching pipeline. Be literal: only extract what the text states. mustHaves are
requirements the JD marks as required/minimum; niceToHaves are preferred/bonus.
hardSkills are concrete technologies/tools/languages using the JD's exact phrasing
(e.g. "ROS 2" not "robot middleware"). citizenshipOrClearanceRequired is true only
for explicit US-citizenship / clearance / ITAR-authorization requirements.
internshipTerm is the stated term (e.g. "Summer 2027") or null.`;

export async function parseJd(job: Job, cfg: LlmConfig) {
  const jd = (job.jd_text ?? '').slice(0, cfg.jdTruncation.parse);
  return structuredCall({
    model: cfg.models.parse,
    system: SYSTEM,
    user: `Job title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location ?? 'unknown'}\n\n${jd}`,
    schema: JdSchema,
    maxTokens: 2048,
  });
}
