import { describe, it, expect } from 'vitest';
import { costUsd, logEventRow, DashboardSummary, EventRow, KNOWN_MODELS, PRICES } from './events.js';

describe('KNOWN_MODELS (§9) — the selectable-model SSoT', () => {
  it('equals the PRICES key set (never drifts)', () => {
    expect([...KNOWN_MODELS]).toEqual(Object.keys(PRICES));
  });
  it('includes the dream-tier Opus model', () => {
    expect(KNOWN_MODELS).toContain('claude-opus-4-8');
  });
});

describe('costUsd (§9)', () => {
  it('computes haiku cost for a sample usage', () => {
    // haiku {in:1, out:5} $/MTok; cache-read 0.1×in, cache-write 1.25×in.
    // (1000*1 + 500*5 + 2000*1*0.1 + 800*1*1.25) / 1e6
    const usage = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 2000,
      cache_creation_input_tokens: 800,
    };
    const expected = (1000 * 1 + 500 * 5 + 2000 * 0.1 + 800 * 1.25) / 1e6;
    expect(costUsd('claude-haiku-4-5', usage)).toBeCloseTo(expected, 12);
  });

  it('computes sonnet/opus base rates', () => {
    expect(costUsd('claude-sonnet-4-6', { input_tokens: 1_000_000 })).toBeCloseTo(3, 9);
    expect(costUsd('claude-opus-4-8', { output_tokens: 1_000_000 })).toBeCloseTo(25, 9);
  });

  it('returns null for unknown model or missing usage', () => {
    expect(costUsd('gpt-4', { input_tokens: 100 })).toBeNull();
    expect(costUsd('claude-haiku-4-5', null)).toBeNull();
  });
});

describe('logEventRow (§9) — typed row builder', () => {
  it('builds an events insert row with computed cost', () => {
    const row = logEventRow({
      jobId: 'job-1',
      stage: 'score',
      ok: true,
      model: 'claude-haiku-4-5',
      usage: { input_tokens: 1000, output_tokens: 500 },
      durationMs: 1234,
      detail: { llmFit: 0.8 },
    });
    expect(row).toMatchObject({
      job_id: 'job-1',
      stage: 'score',
      model: 'claude-haiku-4-5',
      input_tokens: 1000,
      output_tokens: 500,
      duration_ms: 1234,
      ok: true,
    });
    expect(row.cost_usd).toBeCloseTo((1000 * 1 + 500 * 5) / 1e6, 12);
  });

  it('nulls cost/tokens when model+usage absent', () => {
    const row = logEventRow({ jobId: null, stage: 'discover', ok: false, detail: { error: 'boom' } });
    expect(row.cost_usd).toBeNull();
    expect(row.input_tokens).toBeNull();
    expect(row.job_id).toBeNull();
    expect(row.ok).toBe(false);
  });
});

// The contracts already declared these as z.number(), but the API wasn't
// enforcing them on its OWN output — pg returns numeric/bigint as strings, so
// strings flowed to the client and `.toFixed()` crashed the dashboard. These
// tests pin the contract as the boundary guard: the string-shaped objects pg
// produces MUST be rejected, and the API must coerce before returning.
describe('numeric-as-string boundary (the dashboard .toFixed crash)', () => {
  it('DashboardSummary.parse rejects pg string-shaped numbers', () => {
    const stringShaped = {
      costByStage: [{ stage: 'parse_jd', costUsd: '0.5', calls: '3' }],
      costByModel: [{ model: 'claude-haiku-4-5', costUsd: '0.4' }],
      totalsByDay: [{ day: '2026-06-09', costUsd: '0.5' }],
      funnel: [{ status: 'in_review', count: '4' }],
      failures: [{ stage: 'verify_claims', count: '1' }],
    };
    expect(() => DashboardSummary.parse(stringShaped)).toThrow();

    // ...and accepts the coerced (numeric) shape the API must produce.
    const numeric = {
      costByStage: [{ stage: 'parse_jd' as const, costUsd: 0.5, calls: 3 }],
      costByModel: [{ model: 'claude-haiku-4-5', costUsd: 0.4 }],
      totalsByDay: [{ day: '2026-06-09', costUsd: 0.5 }],
      funnel: [{ status: 'in_review', count: 4 }],
      failures: [{ stage: 'verify_claims' as const, count: 1 }],
    };
    expect(() => DashboardSummary.parse(numeric)).not.toThrow();
  });

  it('EventRow.parse rejects pg string id/cost_usd', () => {
    const base = {
      job_id: null,
      stage: 'tailor' as const,
      model: 'claude-sonnet-4-6',
      input_tokens: 4591,
      output_tokens: 486,
      duration_ms: 7832,
      ok: true,
      detail: null,
      created_at: '2026-06-09T12:00:00+00',
    };
    // id + cost_usd as strings (the exact shape pg hands back) → rejected.
    expect(() =>
      EventRow.parse({ ...base, id: '119', cost_usd: '0.007021' })
    ).toThrow();
    // coerced numbers → accepted.
    expect(() =>
      EventRow.parse({ ...base, id: 119, cost_usd: 0.007021 })
    ).not.toThrow();
  });
});
