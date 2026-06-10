// Stage: tailor — generate a per-job overlay (PROPOSALS §3.3): profile selection
// + RFC-6902 patches against the canonical résumé + cover letter. Output is
// ALWAYS a structured diff over canonical data — never a rewrite.
//
// Anti-fabrication layer 1 (generation constraint, §11 BINDING): the model may
// ONLY rephrase/reorder/quantify content present in the master bank; replace-only
// patches; required groundedIn (bare <id>); <= MAX_TAILOR_PATCHES patches.
// verify.ts audits every patch afterwards.
import {
  TailorSchema,
  SECTION_KEYS,
  MAX_TAILOR_PATCHES,
  overlayProblems,
  type Overlay,
  type LlmConfig,
} from '@resume/contracts';
import { structuredCall } from './llm.js';
import { master, getResume } from './profile.js';
import type { Job, ScoredJob } from './types.js';
import type { ResumeDoc } from '@resume/contracts';

// Patchable surface: every highlight with its JSON Pointer + current text, so the
// model targets real paths (and we can verify them mechanically). Reads the
// résumé shape (work/projects/volunteer highlights).
function patchableMap(resume: ResumeDoc): string {
  const lines: string[] = [];
  const walk = (
    base: string,
    arr: Array<{ highlights?: string[]; [k: string]: unknown }>,
    nameKey: string
  ) =>
    arr.forEach((entry, i) =>
      (entry.highlights ?? []).forEach((text, j) =>
        lines.push(`/${base}/${i}/highlights/${j} | ${entry[nameKey]} | ${text}`)
      )
    );
  walk('work', resume.work, 'name');
  walk('projects', resume.projects, 'name');
  walk('volunteer', resume.volunteer, 'organization');
  return lines.join('\n');
}

// Built per call from the CURRENT résumé (so it matches what the renderer applies
// and what overlayProblems validates against).
function buildSystem(): string {
  const resume = getResume();
  const availableTags = [...new Set(resume.projects.flatMap((p) => p.tags ?? []))];
  return `You tailor a resume to a specific job by producing a structured overlay.
You may ONLY rephrase, reorder, or quantify accomplishments that are explicitly
present in the MASTER BANK below. You may NOT invent metrics, technologies,
dates, titles, or responsibilities. If the job requires a skill the candidate
does not have, omit it — never claim it. Mirror the job description's exact
phrasing for skills the candidate genuinely has (ATS keyword match).

Rules:
- profile.sections: pick and ORDER sections for this job (always start with
  personalInfo; education second for internships). Valid section keys:
  ${SECTION_KEYS.join(', ')}.
- profile.filters: optionally filter "projects" by tagsAnyOf (available tags:
  ${availableTags.join(', ')}) and/or limit.
- patches: replace ops ONLY on the highlight paths listed in PATCHABLE
  HIGHLIGHTS. Each patch must cite groundedIn: the master bullet id(s)
  (e.g. "ambarella-inc-2") that contain every fact in the new text. Patch at
  most ${MAX_TAILOR_PATCHES} highlights — only where rephrasing meaningfully
  improves the match.
- Keep each patched highlight a single concise resume bullet (<= 200 chars
  preferred), strongest claim first, JD-aligned wording.
- coverLetter: 3 short paragraphs — (1) specific role+company hook,
  (2) 2-3 accomplishments from the master bank matched to the JD,
  (3) brief close. No invented facts. Mention work authorization only if the
  JD asks about it.

MASTER BANK (the complete set of claims you may use):
${master.bullets.map((b) => `[${b.id}] (${b.context ?? ''}) ${b.text}`).join('\n')}

PATCHABLE HIGHLIGHTS (path | entry | current text):
${patchableMap(resume)}`;
}

export async function tailor(job: ScoredJob | Job, cfg: LlmConfig) {
  const model = job.company_flags?.includes('dream')
    ? cfg.models.tailorDream
    : cfg.models.tailor;
  const result = await structuredCall({
    model,
    system: buildSystem(),
    user: `Tailor for this job:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'unknown'}
Parsed requirements: ${JSON.stringify(job.parsed)}
Score gaps (missing terms): ${JSON.stringify(job.score_breakdown?.missingTerms ?? [])}

JD:
${(job.jd_text ?? '').slice(0, cfg.jdTruncation.tailor)}`,
    schema: TailorSchema,
    maxTokens: 4096,
    cache: true, // SYSTEM (bank + patchable map) is stable across jobs
  });

  const overlay = toOverlay(job, result.output);
  // The ONE overlayProblems (§8): validates against the current résumé doc.
  const errors = overlayProblems(overlay, getResume());
  if (errors.length > 0) {
    throw new Error(`tailor produced invalid overlay: ${errors.join('; ')}`);
  }
  return {
    ...result,
    overlay,
    grounding: result.output.patches.map((p) => p.groundedIn),
  };
}

type TailorOutput = TailorSchema;

// Convert model output -> Overlay shape (strip groundedIn into audit claims;
// verify.ts sets verdicts). groundedIn refs are bare <id> (§11).
export function toOverlay(job: Pick<Job, 'id'>, out: TailorOutput): Overlay {
  const filters: Record<string, { tagsAnyOf?: string[]; titleIn?: string[]; limit?: number }> = {};
  for (const [section, f] of Object.entries(out.profile.filters ?? {})) {
    const clean: { tagsAnyOf?: string[]; titleIn?: string[]; limit?: number } = {};
    if (f?.tagsAnyOf?.length) clean.tagsAnyOf = f.tagsAnyOf;
    if (f?.titleIn?.length) clean.titleIn = f.titleIn;
    if (f?.limit != null) clean.limit = f.limit;
    if (Object.keys(clean).length) filters[section] = clean;
  }
  return {
    jobId: job.id,
    profile: {
      name: out.profile.name,
      sections: out.profile.sections,
      ...(Object.keys(filters).length ? { filters } : {}),
    },
    patches: out.patches.map(({ op, path, value }) => ({ op, path, value })),
    coverLetter: out.coverLetter,
    audit: {
      claims: out.patches.map((p, i) => ({
        patchIndex: i,
        groundedIn: p.groundedIn,
        verdict: 'unsupported' as const,
      })),
      unsupported: out.patches.map((_, i) => i), // verify.ts clears these
    },
  } as Overlay;
}
