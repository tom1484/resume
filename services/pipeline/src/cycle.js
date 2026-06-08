// One pipeline cycle: claim status='new' jobs (SKIP LOCKED — safe with
// multiple workers), run parse_jd -> score per job, log an event per stage,
// send one Telegram summary per non-empty cycle.
import { query } from './db.js';
import { costUsd } from './llm.js';
import { parseJd } from './parseJd.js';
import { candidateTerms, refreshResume } from './profile.js';
import { keywordScore, llmFit, structuralScore, combine } from './score.js';
import { batchSummary, sendTelegram } from './notify.js';
import { tailorJob } from './tailorJob.js';

export const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
export const BATCH = Number(process.env.BATCH_SIZE ?? 10);
export const THRESHOLD = Number(process.env.SCORE_THRESHOLD ?? 0.65);

async function logEvent(jobId, stage, { ok, model, usage, durationMs, detail }) {
  await query(
    `INSERT INTO events (job_id, stage, model, input_tokens, output_tokens, cost_usd, duration_ms, ok, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      jobId, stage, model ?? null,
      usage?.input_tokens ?? null, usage?.output_tokens ?? null,
      model && usage ? costUsd(model, usage) : null,
      durationMs ?? null, ok, detail ? JSON.stringify(detail) : null,
    ]
  );
}

export async function processJob(job) {
  // parse_jd
  const parsed = await parseJd(job);
  await logEvent(job.id, 'parse_jd', { ok: true, ...parsed });

  // structural + keyword are code; llmFit is one Haiku call.
  // candidateTerms() reflects the current résumé (refreshed at cycle start).
  const structural = structuralScore(parsed.output);
  const keyword = keywordScore(parsed.output, candidateTerms());
  const fit = await llmFit(job, parsed.output);
  await logEvent(job.id, 'score', {
    ok: true, model: fit.model, usage: fit.usage, durationMs: fit.durationMs,
    detail: { keyword: keyword.value, llmFit: fit.output.fit, structural: structural.value },
  });

  const score = combine(keyword.value, fit.output.fit, structural.value);
  const breakdown = {
    keyword: keyword.value,
    missingTerms: keyword.missing.slice(0, 12),
    llmFit: fit.output.fit,
    rationale: fit.output.rationale,
    redFlags: fit.output.redFlags,
    structural: structural.value,
    structuralReasons: structural.reasons,
    weights: { keyword: 0.5, llmFit: 0.3, structural: 0.2 },
  };
  await query(
    `UPDATE jobs SET parsed = $2, score = $3, score_breakdown = $4, status = 'scored', updated_at = now() WHERE id = $1`,
    [job.id, JSON.stringify(parsed.output), score, JSON.stringify(breakdown)]
  );
  return { ...job, parsed: parsed.output, score };
}

async function claimBatch() {
  const { rows } = await query(
    `UPDATE jobs SET status = 'parsing', updated_at = now()
     WHERE id IN (SELECT id FROM jobs WHERE status = 'new' ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING *`,
    [BATCH]
  );
  return rows;
}

export async function cycle() {
  await refreshResume(); // pick up any web edits to the canonical résumé
  const jobs = await claimBatch();
  if (jobs.length === 0) return;
  console.log(`processing ${jobs.length} job(s)`);
  const scored = [];
  for (const job of jobs) {
    try {
      scored.push(await processJob(job));
    } catch (err) {
      console.error(`job ${job.id} failed:`, err.message);
      await logEvent(job.id, 'parse_jd', { ok: false, detail: { error: err.message } });
      await query(`UPDATE jobs SET status = 'error', updated_at = now() WHERE id = $1`, [job.id]);
    }
  }
  // Gate: jobs at/above threshold get auto-tailored -> verified -> in_review.
  const top = scored.filter((j) => j.score >= THRESHOLD).sort((a, b) => b.score - a.score);
  const tailored = [];
  for (const job of top) {
    try {
      const result = await tailorJob(job);
      tailored.push({ ...job, dropped: result.dropped, patches: result.overlay.patches.length });
    } catch (err) {
      console.error(`tailor ${job.id} failed:`, err.message);
      await logEvent(job.id, 'tailor', { ok: false, detail: { error: err.message } });
      // leave as 'scored' so a later cycle / manual run can retry
    }
  }

  if (scored.length > 0) {
    try {
      await sendTelegram(
        batchSummary({ scored: scored.length, threshold: THRESHOLD, tailored, reviewBase: REVIEW_BASE })
      );
      await logEvent(null, 'notify', {
        ok: true, detail: { scored: scored.length, above: top.length, tailored: tailored.length },
      });
    } catch (err) {
      console.error('notify failed:', err.message);
      await logEvent(null, 'notify', { ok: false, detail: { error: err.message } });
    }
  }
}

const REVIEW_BASE = process.env.REVIEW_BASE_URL ?? 'https://jobs.churong.cc';
