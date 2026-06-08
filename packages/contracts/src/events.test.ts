import { describe, it, expect } from 'vitest';
import { costUsd, logEventRow } from './events.js';

describe('costUsd (§9) — matches v1 llm.js', () => {
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
