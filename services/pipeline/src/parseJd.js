// Stage: parse_jd — structured extraction of JD requirements (PROPOSALS §5).
import { z } from 'zod';
import { structuredCall } from './llm.js';

export const JdSchema = z.object({
  hardSkills: z.array(z.string()),
  softSkills: z.array(z.string()),
  mustHaves: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  responsibilities: z.array(z.string()),
  seniority: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'unspecified']),
  citizenshipOrClearanceRequired: z.boolean(),
  sponsorshipAvailable: z.enum(['yes', 'no', 'unstated']),
  internshipTerm: z.nullable(z.string()),
  minEducation: z.nullable(z.string()),
});

const SYSTEM = `You extract structured requirements from job descriptions for a candidate-side
matching pipeline. Be literal: only extract what the text states. mustHaves are
requirements the JD marks as required/minimum; niceToHaves are preferred/bonus.
hardSkills are concrete technologies/tools/languages using the JD's exact phrasing
(e.g. "ROS 2" not "robot middleware"). citizenshipOrClearanceRequired is true only
for explicit US-citizenship / clearance / ITAR-authorization requirements.
internshipTerm is the stated term (e.g. "Summer 2027") or null.`;

export async function parseJd(job) {
  const jd = (job.jd_text ?? '').slice(0, 24000);
  return structuredCall({
    system: SYSTEM,
    user: `Job title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location ?? 'unknown'}\n\n${jd}`,
    schema: JdSchema,
    maxTokens: 2048,
  });
}
