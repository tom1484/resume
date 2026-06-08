// §9 events / cost ledger + dashboard read API.
//
// Verdict: KEEP table; ADD read API + dashboard surface (unconsumed in v1).
// Pricing + costUsd port VERBATIM from v1 llm.js:12-28. The logEvent helper was
// duplicated in cycle.js:16 and tailorJob.js:14 (and Python store.log_event) —
// v2 folds the Node copies into one @contracts-typed logEvent ROW BUILDER (the
// shape, not the DB call).
import { z } from 'zod';

export const EventStage = z.enum([
  'discover',
  'parse_jd',
  'score',
  'tailor',
  'verify_claims',
  'notify',
]);
export type EventStage = z.infer<typeof EventStage>;

export const EventRow = z
  .object({
    // 001_init.sql:31-45 (KEEP shape)
    id: z.number(),
    job_id: z.string().nullable(),
    stage: EventStage,
    model: z.string().nullable(),
    input_tokens: z.number().nullable(),
    output_tokens: z.number().nullable(),
    cost_usd: z.number().nullable(),
    duration_ms: z.number().nullable(),
    ok: z.boolean(),
    detail: z.unknown().nullable(),
    created_at: z.string(),
  })
  .strict();
export type EventRow = z.infer<typeof EventRow>;

// Dashboard read DTO (GET /api/dashboard/summary)
export const DashboardSummary = z
  .object({
    costByStage: z.array(
      z.object({
        stage: EventStage,
        costUsd: z.number(),
        calls: z.number(),
      })
    ),
    costByModel: z.array(
      z.object({ model: z.string(), costUsd: z.number() })
    ),
    totalsByDay: z.array(z.object({ day: z.string(), costUsd: z.number() })),
    funnel: z.array(z.object({ status: z.string(), count: z.number() })), // jobs per status
    failures: z.array(z.object({ stage: EventStage, count: z.number() })), // ok=false rollup
  })
  .strict();
export type DashboardSummary = z.infer<typeof DashboardSummary>;

// --- Pricing + costUsd (KEEP verbatim, llm.js:12-28) ---
// $/MTok; cache read = 0.1x base input, cache write (5m) = 1.25x base input.
export const PRICES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-4-8': { in: 5, out: 25 },
};

/** Token usage as returned by the Anthropic SDK (the fields costUsd reads). */
export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/**
 * Dollar cost of one LLM call. Returns null when the model is unknown or usage
 * is absent (llm.js:19: cost only computed when model+usage present).
 */
export function costUsd(
  model: string,
  usage: Usage | null | undefined
): number | null {
  const p = PRICES[model];
  if (!p || !usage) return null;
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return (
    (inTok * p.in +
      outTok * p.out +
      cacheRead * p.in * 0.1 +
      cacheWrite * p.in * 1.25) /
    1e6
  );
}

// --- logEvent row builder (the shape, not the DB call) ---
// The persisted events-table row, minus the DB-assigned id/created_at. Maps the
// v1 INSERT column list (cycle.js:16-26): job_id, stage, model, input_tokens,
// output_tokens, cost_usd, duration_ms, ok, detail.
export interface LogEventInput {
  jobId: string | null;
  stage: EventStage;
  ok: boolean;
  model?: string | null;
  usage?: Usage | null;
  durationMs?: number | null;
  detail?: unknown;
}

export interface EventInsertRow {
  job_id: string | null;
  stage: EventStage;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  ok: boolean;
  detail: unknown | null;
}

/**
 * Build the events-table insert row from a stage result. Cost is computed only
 * when both model and usage are present (llm.js:19). The actual INSERT is the
 * API/pipeline agent's job — this is the single typed row shape.
 */
export function logEventRow(input: LogEventInput): EventInsertRow {
  const { jobId, stage, ok, model, usage, durationMs, detail } = input;
  return {
    job_id: jobId ?? null,
    stage,
    model: model ?? null,
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    cost_usd: model && usage ? costUsd(model, usage) : null,
    duration_ms: durationMs ?? null,
    ok,
    detail: detail ?? null,
  };
}
