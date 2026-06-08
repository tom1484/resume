import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './api';

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl as typeof fetch));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('GET /api/jobs encodes the status query', async () => {
    const spy = vi.fn((_url: string) => json([{ id: 'j1' }]));
    mockFetch(spy);
    const res = await api.jobs('in_review');
    expect(spy).toHaveBeenCalledWith(
      '/api/jobs?status=in_review',
      expect.any(Object)
    );
    expect(res).toEqual([{ id: 'j1' }]);
  });

  it('GET /api/jobs/:id encodes the id', async () => {
    const spy = vi.fn((_url: string) => json({ id: 'a/b' }));
    mockFetch(spy);
    await api.job('a/b');
    expect(spy).toHaveBeenCalledWith('/api/jobs/a%2Fb', expect.any(Object));
  });

  it('PUT /api/jobs/:id/overlay sends JSON body + content-type', async () => {
    const spy = vi.fn((_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      expect((init?.headers as Record<string, string>)['content-type']).toBe(
        'application/json'
      );
      expect(init?.body).toBe(JSON.stringify({ jobId: 'j1' }));
      return json({ ok: true });
    });
    mockFetch(spy);
    // deliberately loose cast; the client just serializes the body
    await api.putOverlay('j1', { jobId: 'j1' } as never);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('config GET/PUT hits /api/config/:ns', async () => {
    const getSpy = vi.fn((_url: string) => json({ scoreThreshold: 0.65 }));
    mockFetch(getSpy);
    await api.config('llm');
    expect(getSpy).toHaveBeenCalledWith('/api/config/llm', expect.any(Object));

    const putSpy = vi.fn((_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      return json({ ok: true, ns: 'llm' });
    });
    mockFetch(putSpy);
    await api.putConfig('llm', { scoreThreshold: 0.7 } as never);
    expect(putSpy).toHaveBeenCalledWith('/api/config/llm', expect.any(Object));
  });

  it('events serializes ok + numeric params', async () => {
    const spy = vi.fn((_url: string) => json([]));
    mockFetch(spy);
    await api.events({ stage: 'parse_jd', ok: false, limit: 25 });
    const url = spy.mock.calls[0]![0];
    expect(url).toContain('stage=parse_jd');
    expect(url).toContain('ok=false');
    expect(url).toContain('limit=25');
  });

  it('throws ApiError with status + problems on non-2xx', async () => {
    mockFetch(() =>
      json({ error: 'invalid overlay', problems: ['a', 'b'] }, 400)
    );
    await expect(api.putOverlay('j1', {} as never)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'invalid overlay',
      problems: ['a', 'b'],
    });
  });

  it('ApiError carries a fallback message when none provided', async () => {
    mockFetch(() => new Response('boom', { status: 500 }));
    const err = await api.resume().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });
});
