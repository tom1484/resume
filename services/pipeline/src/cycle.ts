// One pipeline cycle: read config (best-effort, §6), claim status='new' jobs
// (SKIP LOCKED — safe with multiple workers), run parse_jd -> score per job, log
// an event per stage, gate at the configured threshold -> tailor -> verify ->
// in_review, send one Telegram summary per non-empty cycle.
//
// v2: all tuning (models, threshold, weights, batch, poll, truncation) comes from
// LlmConfig; scoring uses the two-list Constraints/Preferences from config.
import { ScoreBreakdown, type LlmConfig } from '@resume/contracts';
import { query } from './db.js';
import { getConfig } from './config.js';
import { logEvent } from './events.js';
import { parseJd } from './parseJd.js';
import { candidateTerms, refreshResume } from './profile.js';
import {
  keywordScore,
  llmFit,
  evaluateConstraints,
  combine,
} from './score.js';
import { batchSummary, sendTelegram, type TailoredSummaryItem } from './notify.js';
import { tailorJob } from './tailorJob.js';
import type { Job, ScoredJob } from './types.js';

const REVIEW_BASE = process.env.REVIEW_BASE_URL ?? 'https://jobs.churong.cc';

export async function processJob(job: Job, cfg: LlmConfig): Promise<ScoredJob> {
  // config read once per cycle (passed in); constraints/preferences too.
  const [constraints, preferences] = await Promise.all([
    getConfig('constraints'),
    getConfig('preferences'),
  ]);

  // parse_jd
  const parsed = await parseJd(job, cfg);
  await logEvent(job.id, 'parse_jd', {
    ok: true,
    model: parsed.model,
    usage: parsed.usage,
    durationMs: parsed.durationMs,
  });

  // structural (constraints, deterministic) + keyword are code; llmFit is one
  // LLM call. candidateTerms() reflects the current résumé (refreshed at start).
  const structural = evaluateConstraints(parsed.output, constraints);
  const keyword = keywordScore(parsed.output, candidateTerms());
  const fit = await llmFit(job, parsed.output, cfg, preferences);
  await logEvent(job.id, 'score', {
    ok: true,
    model: fit.model,
    usage: fit.usage,
    durationMs: fit.durationMs,
    detail: {
      keyword: keyword.value,
      llmFit: fit.output.fit,
      structural: structural.value,
    },
  });

  const score = combine(
    keyword.value,
    fit.output.fit,
    structural.value,
    cfg.weights
  );
  const breakdown: ScoreBreakdown = {
    keyword: keyword.value,
    missingTerms: keyword.missing.slice(0, 12),
    llmFit: fit.output.fit,
    rationale: fit.output.rationale,
    redFlags: fit.output.redFlags,
    structural: structural.value,
    // §5.3: explicit attribution of what moved the score.
    constraintsFired: structural.constraintsFired,
    preferencesApplied: preferences
      .filter((p) => p.enabled !== false)
      .map((p) => ({ id: p.id, priority: p.priority })),
    weights: cfg.weights,
  };
  // Validate the breakdown against the contract before persisting.
  ScoreBreakdown.parse(breakdown);

  await query(
    `UPDATE jobs SET parsed = $2, score = $3, score_breakdown = $4, status = 'scored', updated_at = now() WHERE id = $1`,
    [
      job.id,
      JSON.stringify(parsed.output),
      score,
      JSON.stringify(breakdown),
    ]
  );
  return { ...job, parsed: parsed.output, score, score_breakdown: breakdown };
}

async function claimBatch(batch: number): Promise<Job[]> {
  const { rows } = await query(
    `UPDATE jobs SET status = 'parsing', updated_at = now()
     WHERE id IN (SELECT id FROM jobs WHERE status = 'new' ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING *`,
    [batch]
  );
  return rows as Job[];
}

export async function cycle(): Promise<void> {
  const cfg = await getConfig('llm'); // models, threshold, weights, batch, truncation
  await refreshResume(); // pick up any web edits to the canonical résumé
  const jobs = await claimBatch(cfg.batchSize);
  if (jobs.length === 0) return;
  console.log(`processing ${jobs.length} job(s)`);
  const scored: ScoredJob[] = [];
  for (const job of jobs) {
    try {
      scored.push(await processJob(job, cfg));
    } catch (err) {
      console.error(`job ${job.id} failed:`, (err as Error).message);
      await logEvent(job.id, 'parse_jd', {
        ok: false,
        detail: { error: (err as Error).message },
      });
      await query(
        `UPDATE jobs SET status = 'error', updated_at = now() WHERE id = $1`,
        [job.id]
      );
    }
  }
  // Gate: jobs at/above threshold get auto-tailored -> verified -> in_review.
  const top = scored
    .filter((j) => j.score >= cfg.scoreThreshold)
    .sort((a, b) => b.score - a.score);
  const tailored: TailoredSummaryItem[] = [];
  for (const job of top) {
    try {
      const result = await tailorJob(job, cfg);
      tailored.push({
        id: job.id,
        score: job.score,
        company: job.company,
        title: job.title,
        company_flags: job.company_flags,
        patches: result.overlay.patches.length,
      });
    } catch (err) {
      console.error(`tailor ${job.id} failed:`, (err as Error).message);
      await logEvent(job.id, 'tailor', {
        ok: false,
        detail: { error: (err as Error).message },
      });
      // leave as 'scored' so a later cycle / manual run can retry
    }
  }

  if (scored.length > 0) {
    try {
      await sendTelegram(
        batchSummary({
          scored: scored.length,
          threshold: cfg.scoreThreshold,
          tailored,
          reviewBase: REVIEW_BASE,
        })
      );
      await logEvent(null, 'notify', {
        ok: true,
        detail: {
          scored: scored.length,
          above: top.length,
          tailored: tailored.length,
        },
      });
    } catch (err) {
      console.error('notify failed:', (err as Error).message);
      await logEvent(null, 'notify', {
        ok: false,
        detail: { error: (err as Error).message },
      });
    }
  }
}
