// Stage: tailor — generate a per-job overlay (PROPOSALS §3.3): profile
// selection + RFC-6902 patches against resume.json + cover letter.
// Output is ALWAYS a structured diff over canonical data — never a rewrite.
// Anti-fabrication: the model may only rephrase/reorder/quantify content
// present in the master bank; verify.js audits every patch afterwards.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import Ajv from 'ajv';
import jsonpatch from 'fast-json-patch';
import { structuredCall } from './llm.js';
import { master, getResume } from './profile.js';

const dataDir = process.env.DATA_DIR ?? new URL('../../../packages/renderer/src/data', import.meta.url).pathname;
const overlaySchema = JSON.parse(readFileSync(`${dataDir}/overlay.schema.json`, 'utf8'));
const validateOverlay = new Ajv({ allErrors: true }).compile(overlaySchema);

export const TAILOR_MODEL = process.env.MODEL_TAILOR ?? 'claude-sonnet-4-6';
export const TAILOR_MODEL_DREAM = process.env.MODEL_TAILOR_DREAM ?? 'claude-opus-4-8';

const SECTIONS = ['personalInfo', 'education', 'academics', 'working', 'publications', 'competitions', 'projects', 'extracurriculars', 'skills'];

const TailorSchema = z.object({
  profile: z.object({
    name: z.string(),
    sections: z.array(z.enum(SECTIONS)),
    filters: z.nullable(
      z.record(
        z.string(),
        z.object({
          tagsAnyOf: z.nullable(z.array(z.string())),
          titleIn: z.nullable(z.array(z.string())),
          limit: z.nullable(z.number().int().min(0)),
        })
      )
    ),
  }),
  patches: z.array(
    z.object({
      op: z.enum(['replace']),
      path: z.string(),
      value: z.string(),
      groundedIn: z.array(z.string()).min(1),
    })
  ),
  coverLetter: z.string(),
});

// Patchable surface: every highlight with its JSON Pointer + current text,
// so the model targets real paths (and we can verify them mechanically).
function patchableMap(resume) {
  const lines = [];
  const walk = (base, arr, nameKey) =>
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

// Built per call from the CURRENT résumé (so it matches what the renderer
// applies and what overlayProblems validates against).
function buildSystem() {
  const resume = getResume();
  const availableTags = [...new Set(resume.projects.flatMap((p) => p.keywords ?? []))];
  return `You tailor a resume to a specific job by producing a structured overlay.
You may ONLY rephrase, reorder, or quantify accomplishments that are explicitly
present in the MASTER BANK below. You may NOT invent metrics, technologies,
dates, titles, or responsibilities. If the job requires a skill the candidate
does not have, omit it — never claim it. Mirror the job description's exact
phrasing for skills the candidate genuinely has (ATS keyword match).

Rules:
- profile.sections: pick and ORDER sections for this job (always start with
  personalInfo; education second for internships).
- profile.filters: optionally filter "projects" by tagsAnyOf (available tags:
  ${availableTags.join(', ')}) and/or limit.
- patches: replace ops ONLY on the highlight paths listed in PATCHABLE
  HIGHLIGHTS. Each patch must cite groundedIn: the master bullet id(s)
  (e.g. "ambarella-inc-2") that contain every fact in the new text. Patch at
  most 4 highlights — only where rephrasing meaningfully improves the match.
- Keep each patched highlight a single concise resume bullet (<= 200 chars
  preferred), strongest claim first, JD-aligned wording.
- coverLetter: 3 short paragraphs — (1) specific role+company hook,
  (2) 2-3 accomplishments from the master bank matched to the JD,
  (3) brief close. No invented facts. Mention F-1/CPT only if the JD asks
  about authorization.

MASTER BANK (the complete set of claims you may use):
${master.bullets.map((b) => `[${b.id}] (${b.context}) ${b.text}`).join('\n')}

PATCHABLE HIGHLIGHTS (path | entry | current text):
${patchableMap(resume)}`;
}

export async function tailor(job) {
  const model = job.company_flags?.includes('dream') ? TAILOR_MODEL_DREAM : TAILOR_MODEL;
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
${(job.jd_text ?? '').slice(0, 16000)}`,
    schema: TailorSchema,
    maxTokens: 4096,
    cache: true, // SYSTEM (bank + patchable map) is stable across jobs
  });

  const overlay = toOverlay(job, result.output);
  const errors = overlayProblems(overlay);
  if (errors.length > 0) {
    throw new Error(`tailor produced invalid overlay: ${errors.join('; ')}`);
  }
  return { ...result, overlay, grounding: result.output.patches.map((p) => p.groundedIn) };
}

// Convert model output -> overlay.schema.json shape (strip groundedIn into
// audit claims; verify.js sets verdicts).
export function toOverlay(job, out) {
  const filters = {};
  for (const [section, f] of Object.entries(out.profile.filters ?? {})) {
    const clean = {};
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
      claims: out.patches.map((p, i) => ({ patchIndex: i, groundedIn: p.groundedIn, verdict: 'unsupported' })),
      unsupported: out.patches.map((_, i) => i), // verify.js clears these
    },
  };
}

export function overlayProblems(overlay) {
  const problems = [];
  if (!validateOverlay(overlay)) {
    problems.push(...validateOverlay.errors.map((e) => `${e.instancePath} ${e.message}`));
  }
  const patchError = jsonpatch.validate(overlay.patches ?? [], getResume());
  if (patchError) {
    problems.push(`patch #${patchError.index} ${patchError.name} at ${patchError.operation?.path}`);
  }
  if (!overlay.profile.sections.includes('personalInfo')) {
    problems.push('profile must include personalInfo');
  }
  return problems;
}
