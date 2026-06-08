// getConfig (§6 TODO) best-effort behavior: a valid row parses; a DB error or a
// malformed/invalid row falls back to schema defaults / last-good — NEVER throws.
// The pool is mocked so this needs no live Postgres.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configDefault } from '@resume/contracts';

const queryMock = vi.fn();
vi.mock('./db.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: {},
}));

let getConfig: typeof import('./config.js').getConfig;
let _resetConfigCache: typeof import('./config.js')._resetConfigCache;

beforeEach(async () => {
  vi.resetModules();
  queryMock.mockReset();
  const mod = await import('./config.js');
  getConfig = mod.getConfig;
  _resetConfigCache = mod._resetConfigCache;
  _resetConfigCache();
});

afterEach(() => vi.clearAllMocks());

describe('getConfig', () => {
  it('returns schema defaults when the table is empty', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const llm = await getConfig('llm');
    expect(llm).toEqual(configDefault('llm'));
    expect(llm.scoreThreshold).toBe(0.65);
    expect(llm.models.parse).toBe('claude-haiku-4-5');
  });

  it('returns schema defaults when the DB read throws (no DB)', async () => {
    queryMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await getConfig('discovery')).toEqual(configDefault('discovery'));
  });

  it('parses and returns a valid stored row', async () => {
    queryMock.mockResolvedValue({
      rows: [{ value: { scoreThreshold: 0.8, batchSize: 25 } }],
    });
    const llm = await getConfig('llm');
    expect(llm.scoreThreshold).toBe(0.8);
    expect(llm.batchSize).toBe(25);
    expect(llm.models.tailor).toBe('claude-sonnet-4-6'); // defaulted
  });

  it('falls back (not crash) on an invalid stored row', async () => {
    queryMock.mockResolvedValue({ rows: [{ value: { scoreThreshold: 5 } }] }); // >1 invalid
    const llm = await getConfig('llm');
    expect(llm).toEqual(configDefault('llm'));
  });

  it('returns last-good after a transient failure', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ value: { scoreThreshold: 0.42 } }] });
    expect((await getConfig('llm')).scoreThreshold).toBe(0.42);
    queryMock.mockRejectedValueOnce(new Error('blip'));
    expect((await getConfig('llm')).scoreThreshold).toBe(0.42); // last-good, not default
  });

  it('list namespaces default to []', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    expect(await getConfig('constraints')).toEqual([]);
    expect(await getConfig('preferences')).toEqual([]);
  });
});
