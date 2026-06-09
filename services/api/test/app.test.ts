// Route-level tests for the v2 API using a mocked pg pool (no live Postgres).
// Exercises projections, validation paths (ResumeDoc / overlayProblems /
// parseConfig), config CRUD, dashboard, events, ops-flag gating, and the SPA
// fallback exemptions.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/app.js';
import { MockPool, type QueryCall } from './mockPool.js';

// A minimal valid v2 ResumeDoc (the patch target + PUT /api/resume body).
const RESUME = {
  basics: { name: 'A', email: 'a@b.co', profiles: [], qrcodes: [] },
  education: [],
  work: [{ name: 'Lab', time: '2025', highlights: ['did x'] }],
  projects: [],
  publications: [],
  volunteer: [],
  skills: [],
  meta: { sectionOrder: ['personalInfo', 'working'] },
};

function appWith(pool: MockPool): FastifyInstance {
  // resumeSeed supplied explicitly so no /seed file read is needed.
  return createApp({ pool, resumeSeed: RESUME, logger: false });
}

// currentResume() reads resume_versions; seed RESUME as the latest row.
function seedResumeRow(pool: MockPool): void {
  pool.on('FROM resume_versions ORDER BY id DESC', [{ id: 1, data: RESUME }]);
}

describe('jobs routes', () => {
  let pool: MockPool;
  beforeEach(() => {
    pool = new MockPool();
  });

  it('GET /api/jobs uses the list projection + status default', async () => {
    pool.on('FROM jobs WHERE status', (params) => {
      expect(params[0]).toBe('in_review'); // default status
      return {
        rows: [
          {
            id: 'j1',
            company: 'Figure',
            title: 'Intern',
            location: 'SF',
            score: 0.9,
            status: 'in_review',
            company_flags: ['dream'],
            label: null,
          },
        ],
        rowCount: 1,
      };
    });
    const app = appWith(pool);
    const res = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // list projection: no source/remote/posted_at columns selected
    const sql = pool.find('FROM jobs WHERE status')!.sql;
    expect(sql).not.toMatch(/source|remote|posted_at|reviewed_at/);
    expect(body[0].company).toBe('Figure');
  });

  it('GET /api/jobs/:id detail omits PII columns and 404s when absent', async () => {
    pool.on('FROM jobs WHERE id', []);
    const app = appWith(pool);
    const res = await app.inject({ method: 'GET', url: '/api/jobs/nope' });
    expect(res.statusCode).toBe(404);
    const sql = pool.find('FROM jobs WHERE id')!.sql;
    expect(sql).not.toMatch(/source|remote|posted_at|reviewed_at/);
    expect(sql).toMatch(/reject_reason/); // kept
  });

  it('POST approve 409s unless in_review', async () => {
    pool.on("status='approved'", () => ({ rows: [], rowCount: 0 }));
    const app = appWith(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/j1/approve',
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST approve ok when row updated', async () => {
    pool.on("status='approved'", () => ({ rows: [], rowCount: 1 }));
    const app = appWith(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/j1/approve',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('POST label rejects invalid label', async () => {
    const app = appWith(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/j1/label',
      payload: { label: 'maybe' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /applications/:id/overlay.json 404s when no overlay', async () => {
    pool.on('SELECT overlay FROM jobs', [{ overlay: null }]);
    const app = appWith(pool);
    const res = await app.inject({
      method: 'GET',
      url: '/applications/j1/overlay.json',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('overlay validation (single overlayProblems)', () => {
  let pool: MockPool;
  beforeEach(() => {
    pool = new MockPool();
    seedResumeRow(pool);
  });

  const goodOverlay = {
    jobId: 'j1',
    profile: { sections: ['personalInfo', 'working'] },
    patches: [],
  };

  it('PUT overlay rejects missing personalInfo (the ONE rule)', async () => {
    const app = appWith(pool);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/jobs/j1/overlay',
      payload: { ...goodOverlay, profile: { sections: ['working'] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().problems).toContain(
      'profile.sections must include personalInfo'
    );
  });

  it('PUT overlay rejects jobId mismatch', async () => {
    const app = appWith(pool);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/jobs/other/overlay',
      payload: goodOverlay,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/mismatch/);
  });

  it('PUT overlay persists a valid overlay', async () => {
    let updated: QueryCall | undefined;
    pool.on('UPDATE jobs SET overlay', (_p, call) => {
      updated = call;
      return { rows: [], rowCount: 1 };
    });
    const app = appWith(pool);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/jobs/j1/overlay',
      payload: goodOverlay,
    });
    expect(res.statusCode).toBe(200);
    expect(updated).toBeDefined();
  });
});

describe('resume routes', () => {
  let pool: MockPool;
  beforeEach(() => {
    pool = new MockPool();
  });

  it('GET /api/resume seeds when empty then returns data', async () => {
    pool.on('FROM resume_versions ORDER BY id DESC', []); // empty → seed
    pool.on('INSERT INTO resume_versions', [{ id: 1, data: RESUME }]);
    const app = appWith(pool);
    const res = await app.inject({ method: 'GET', url: '/api/resume' });
    expect(res.statusCode).toBe(200);
    expect(res.json().basics.name).toBe('A');
  });

  it('PUT /api/resume validates against ResumeDoc (Zod), not 2-field check', async () => {
    const app = appWith(pool);
    // v1 two-field check would PASS this (has basics + work[]) but Zod rejects:
    // basics.email missing, work[].time missing.
    const res = await app.inject({
      method: 'PUT',
      url: '/api/resume',
      payload: { basics: { name: 'x' }, work: [{ name: 'y' }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/résumé document/);
  });

  it('PUT /api/resume accepts a valid doc and inserts a version', async () => {
    pool.on('INSERT INTO resume_versions', [
      { id: 7, created_at: '2026-06-09' },
    ]);
    const app = appWith(pool);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/resume',
      payload: RESUME,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(7);
  });

  it('history/restore are off by default (ops flag)', async () => {
    const app = appWith(pool);
    const res = await app.inject({ method: 'GET', url: '/api/resume/history' });
    expect(res.statusCode).toBe(404); // route not registered → api 404
  });

  it('history/restore register when enableResumeOps', async () => {
    pool.on('SELECT id, note, created_at FROM resume_versions', []);
    const app = createApp({
      pool,
      resumeSeed: RESUME,
      enableResumeOps: true,
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/api/resume/history' });
    expect(res.statusCode).toBe(200);
  });
});

describe('answers routes', () => {
  it('POST /api/answers requires a question', async () => {
    const pool = new MockPool();
    const app = appWith(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/api/answers',
      payload: { answer: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/answers slugs a unique key', async () => {
    const pool = new MockPool();
    pool.on('SELECT key FROM answers', [{ key: 'why_company' }]);
    pool.on('INSERT INTO answers', []);
    const app = appWith(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/api/answers',
      payload: { question: 'Why company?', answer: 'because' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().key).toBe('why_company_2'); // base taken → suffixed
  });
});

describe('config CRUD (§6/§8) — never secrets', () => {
  let pool: MockPool;
  beforeEach(() => {
    pool = new MockPool();
  });

  it('GET unknown namespace 404s with the namespace list', async () => {
    const app = appWith(pool);
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/ANTHROPIC_API_KEY',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().namespaces).toContain('llm');
  });

  it('GET known namespace falls back to schema default when no row', async () => {
    pool.on('SELECT value FROM config', []); // no row
    const app = appWith(pool);
    const res = await app.inject({ method: 'GET', url: '/api/config/llm' });
    expect(res.statusCode).toBe(200);
    expect(res.json().scoreThreshold).toBe(0.65); // default
    expect(res.json().models.parse).toBe('claude-haiku-4-5');
  });

  it('PUT validates the body against the namespace Zod', async () => {
    const app = appWith(pool);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/llm',
      payload: { scoreThreshold: 5 }, // > 1 → invalid
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/invalid config/);
  });

  it('PUT persists a valid config (upsert by ns)', async () => {
    let upsert: QueryCall | undefined;
    pool.on('INSERT INTO config', (_p, call) => {
      upsert = call;
      return { rows: [], rowCount: 1 };
    });
    const app = appWith(pool);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/preferences',
      payload: [{ id: 'p1', text: 'robotics', priority: 8 }],
    });
    expect(res.statusCode).toBe(200);
    expect(upsert?.params[0]).toBe('preferences');
  });
});

describe('dashboard + events (§9)', () => {
  it('GET /api/dashboard/summary rolls up events + funnel', async () => {
    const pool = new MockPool();
    pool.on('GROUP BY stage', (_p, call) =>
      call.sql.includes('ok = false')
        ? { rows: [{ stage: 'verify_claims', count: '1' }], rowCount: 1 }
        : {
            rows: [{ stage: 'parse_jd', cost: '0.5', calls: '3' }],
            rowCount: 1,
          }
    );
    pool.on('WHERE model IS NOT NULL GROUP BY model', [
      { model: 'claude-haiku-4-5', cost: '0.4' },
    ]);
    pool.on('GROUP BY day', [{ day: '2026-06-09', cost: '0.5' }]);
    pool.on('FROM jobs GROUP BY status', [{ status: 'in_review', count: '4' }]);
    const app = appWith(pool);
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/summary',
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.costByStage[0]).toEqual({
      stage: 'parse_jd',
      costUsd: 0.5,
      calls: 3,
    });
    expect(b.funnel[0]).toEqual({ status: 'in_review', count: 4 });
    expect(b.failures[0]).toEqual({ stage: 'verify_claims', count: 1 });
  });

  it('GET /api/events builds a filtered, paginated query', async () => {
    const pool = new MockPool();
    pool.on('FROM events', (_p, call) => {
      expect(call.sql).toMatch(/stage = \$1/);
      expect(call.sql).toMatch(/ok = \$2/);
      return {
        rows: [
          {
            id: 5,
            job_id: null,
            stage: 'score',
            model: null,
            input_tokens: null,
            output_tokens: null,
            cost_usd: null,
            duration_ms: null,
            ok: true,
            detail: null,
            created_at: '2026-06-09T10:00:00+00',
          },
        ],
        rowCount: 1,
      };
    });
    const app = appWith(pool);
    const res = await app.inject({
      method: 'GET',
      url: '/api/events?stage=score&ok=true&limit=10',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0].id).toBe(5);
  });

  // Regression: pg returns numeric(cost_usd) and bigint(id) as JS STRINGS.
  // Before the fix the route returned them verbatim, so the client did
  // `cost_usd.toFixed(...)` → "e.toFixed is not a function" white-screen.
  // The route must coerce to numbers AND satisfy the EventRow z.number()
  // contract (it validates on the way out).
  it('GET /api/events coerces pg numeric/bigint STRINGS to numbers', async () => {
    const pool = new MockPool();
    pool.on('FROM events', [
      {
        id: '119', // bigint → string from pg
        job_id: null,
        stage: 'tailor',
        model: 'claude-sonnet-4-6',
        input_tokens: 4591,
        output_tokens: 486,
        cost_usd: '0.007021', // numeric(10,6) → string from pg
        duration_ms: 7832,
        ok: true,
        detail: null,
        created_at: '2026-06-09T12:00:00+00',
      },
    ]);
    const app = appWith(pool);
    const res = await app.inject({ method: 'GET', url: '/api/events?limit=50' });
    expect(res.statusCode).toBe(200);
    const row = res.json()[0];
    // The bug was these arriving as strings; assert they are now numbers.
    expect(row.id).toBe(119);
    expect(typeof row.id).toBe('number');
    expect(row.cost_usd).toBe(0.007021);
    expect(typeof row.cost_usd).toBe('number');
    expect(typeof row.input_tokens).toBe('number');
  });
});

describe('healthz + SPA fallback exemptions', () => {
  it('GET /healthz', async () => {
    const app = appWith(new MockPool());
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('ok');
  });

  it('unknown /api/* path is a JSON 404, never SPA fallback', async () => {
    const app = appWith(new MockPool());
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not found');
  });
});

// Regression: the /resume (no slash) vs /resume/ (slash) routing seam.
// The dashboard SPA (react-router) owns `/resume` as a CLIENT route; the bare
// résumé host (apps/site) is static-served at `/resume/` (trailing slash) by the
// API. The danger is a hard nav / refresh / deep-link to `/resume` (no slash)
// being shadowed by the bare host. Fixed in 40c5c4d by (a) removing the old
// `GET /resume` redirect and (b) tightening the setNotFoundHandler exemption to
// `/resume/` (trailing slash) so the bare slash path falls through to the SPA.
// These assertions LOCK that: `/resume` → dashboard index.html, `/resume/` →
// bare host. Uses distinguishable temp static dirs so the assertion is on which
// build serves, not just status codes.
describe('static routing: /resume (SPA route) vs /resume/ (bare host)', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'api-static-'));
  const dashboardDir = join(tmpRoot, 'dashboard');
  const resumeRenderDir = join(tmpRoot, 'site');
  mkdirSync(dashboardDir, { recursive: true });
  mkdirSync(resumeRenderDir, { recursive: true });
  // Sentinel markers mirror the real <title>s so a regression points at the
  // wrong build the way the live curl check does.
  writeFileSync(
    join(dashboardDir, 'index.html'),
    '<!doctype html><title>Job Pipeline · Dashboard</title>'
  );
  writeFileSync(
    join(resumeRenderDir, 'index.html'),
    "<!doctype html><title>Chu-Rong Chen's Resume</title>"
  );

  afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

  function staticApp(): FastifyInstance {
    return createApp({
      pool: new MockPool(),
      resumeSeed: RESUME,
      dashboardDir,
      resumeRenderDir,
      logger: false,
    });
  }

  it('GET /resume (no slash) falls through to the dashboard SPA index.html', async () => {
    const app = staticApp();
    const res = await app.inject({ method: 'GET', url: '/resume' });
    expect(res.statusCode).toBe(200);
    // The dashboard build, NOT the bare host — this is the seam being locked.
    expect(res.body).toContain('Job Pipeline · Dashboard');
    expect(res.body).not.toContain("Chu-Rong Chen's Resume");
  });

  it('GET /resume/ (trailing slash) serves the bare résumé host', async () => {
    const app = staticApp();
    const res = await app.inject({ method: 'GET', url: '/resume/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Chu-Rong Chen's Resume");
    expect(res.body).not.toContain('Job Pipeline · Dashboard');
  });

  it('GET /resume/index.html (the iframe/PDF target) serves the bare host', async () => {
    const app = staticApp();
    const res = await app.inject({ method: 'GET', url: '/resume/index.html' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Chu-Rong Chen's Resume");
  });

  it('setNotFoundHandler exempts /resume/ (slash) but NOT /resume', async () => {
    // A bare-host asset miss must 404 (exempt), never fall back to the SPA…
    const app = staticApp();
    const miss = await app.inject({
      method: 'GET',
      url: '/resume/does-not-exist.js',
    });
    expect(miss.statusCode).toBe(404);
    expect(miss.json().error).toBe('not found');
    // …while an unknown dashboard client route DOES fall back to the SPA.
    const spa = await app.inject({ method: 'GET', url: '/resume-not-a-route' });
    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain('Job Pipeline · Dashboard');
  });
});
