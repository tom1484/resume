// Single typed logEvent — folds the v1 duplicated copies (cycle.js:16 +
// tailorJob.js:14) into one. Uses the @resume/contracts logEventRow builder for
// the row shape (cost computed only when model+usage present, llm.js:19) and
// does the actual INSERT here.
import { logEventRow, type LogEventInput } from '@resume/contracts';
import { query } from './db.js';

export async function logEvent(
  jobId: string | null,
  stage: LogEventInput['stage'],
  fields: Omit<LogEventInput, 'jobId' | 'stage'>
): Promise<void> {
  const row = logEventRow({ jobId, stage, ...fields });
  await query(
    `INSERT INTO events (job_id, stage, model, input_tokens, output_tokens, cost_usd, duration_ms, ok, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      row.job_id,
      row.stage,
      row.model,
      row.input_tokens,
      row.output_tokens,
      row.cost_usd,
      row.duration_ms,
      row.ok,
      row.detail != null ? JSON.stringify(row.detail) : null,
    ]
  );
}
