// Review/config/dashboard API (Fastify 5). All validation routes through
// @resume/contracts Zod and the single imported overlayProblems. Built as a
// factory so unit tests inject a
// mocked pg pool (no live Postgres needed; DB integration is the integrator's
// job at merge).
//
// Joins the nginx network (no published ports); NPM proxies jobs.churong.cc here
// and enforces the access list. Everything behind this is PII (§8 invariant).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { ResumeDoc, overlayProblems, parseConfig, EventRow } from '@resume/contracts';
import type { Queryable } from './pool.js';
import { getConfig, isConfigNs, CONFIG_NS } from './config.js';
import { dashboardSummary } from './dashboard.js';

export interface AppDeps {
  /** pg pool (or a mock with the same .query surface) — REQUIRED. */
  pool: Queryable;
  /** Bundled résumé fallback used to seed resume_versions on first read.
   *  Defaults to reading RESUME_SEED (the § data-invariant seed file). */
  resumeSeed?: unknown;
  /** Static roots. Defaults derive from APP_STATIC_ROOT (the image lays the
   *  built SPAs next to dist/). */
  dashboardDir?: string;
  resumeRenderDir?: string;
  /** Expose the ops-only résumé history/restore routes (default off, §8). */
  enableResumeOps?: boolean;
  /** Fastify logger toggle (off in tests). */
  logger?: boolean;
}

// --- column projections (§7) -------------------------------------------------
// List: the ONLY columns /api/jobs returns (JobListItem).
const JOB_LIST_FIELDS = `id, company, title, location, score, status, company_flags, label`;
// Detail: JobDetail — PII-minimized. Omits source/remote/posted_at/reviewed_at;
// keeps reject_reason.
const JOB_DETAIL_FIELDS = `id, company, title, location, url, status, score,
  score_breakdown, company_flags, label, reject_reason, parsed, jd_text,
  overlay, audit, cover_letter`;

function loadResumeSeed(explicit: unknown): unknown {
  if (explicit !== undefined) return explicit;
  const seedFile = process.env.RESUME_SEED ?? '/seed/resume.json';
  try {
    return JSON.parse(readFileSync(seedFile, 'utf8'));
  } catch {
    // No seed available (e.g. tests with an explicit pool that never seeds).
    return null;
  }
}

export function createApp(deps: AppDeps): FastifyInstance {
  const { pool } = deps;
  const resumeSeed = loadResumeSeed(deps.resumeSeed);
  const staticRoot = process.env.APP_STATIC_ROOT ?? '/app';
  const dashboardDir =
    deps.dashboardDir ?? join(staticRoot, 'dashboard');
  const resumeRenderDir = deps.resumeRenderDir ?? join(staticRoot, 'site');
  const enableResumeOps =
    deps.enableResumeOps ?? process.env.ENABLE_RESUME_OPS === '1';

  const app = Fastify({ logger: deps.logger ?? false });

  // --- canonical résumé (DB-backed, seeded from the bundled fallback) --------
  // Latest resume_versions row is "current". Seed on first read if empty.
  async function currentResume(): Promise<{ id: unknown; data: unknown }> {
    const { rows } = await pool.query(
      'SELECT id, data FROM resume_versions ORDER BY id DESC LIMIT 1'
    );
    if (rows.length) return rows[0] as { id: unknown; data: unknown };
    const seeded = await pool.query(
      "INSERT INTO resume_versions (data, note) VALUES ($1, 'seed') RETURNING id, data",
      [JSON.stringify(resumeSeed)]
    );
    return seeded.rows[0] as { id: unknown; data: unknown };
  }

  // ====================== jobs ======================
  app.get('/api/jobs', async (req) => {
    const q = req.query as { status?: string };
    const status = q.status ?? 'in_review';
    const { rows } = await pool.query(
      `SELECT ${JOB_LIST_FIELDS} FROM jobs WHERE status = $1 ORDER BY score DESC NULLS LAST`,
      [status]
    );
    return rows; // JobListItem[]
  });

  app.get('/api/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      `SELECT ${JOB_DETAIL_FIELDS} FROM jobs WHERE id = $1`,
      [id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not found' });
    return rows[0]; // JobDetail
  });

  // Bare print path data source.
  app.get('/applications/:id/overlay.json', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(
      'SELECT overlay FROM jobs WHERE id = $1',
      [id]
    );
    if (!rows.length || !rows[0]?.overlay)
      return reply.code(404).send({ error: 'no overlay' });
    return rows[0].overlay;
  });

  app.post('/api/jobs/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rowCount } = await pool.query(
      "UPDATE jobs SET status='approved', reviewed_at=now(), updated_at=now() WHERE id=$1 AND status='in_review'",
      [id]
    );
    return rowCount
      ? { ok: true }
      : reply.code(409).send({ error: 'not in_review' });
  });

  app.post('/api/jobs/:id/reject', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { reason?: string } | undefined;
    await pool.query(
      "UPDATE jobs SET status='rejected', reject_reason=$2, reviewed_at=now(), updated_at=now() WHERE id=$1",
      [id, body?.reason ?? null]
    );
    return { ok: true };
  });

  // Calibration label (good|bad|null) — independent of approve/reject.
  app.post('/api/jobs/:id/label', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { label?: string | null } | undefined;
    const label = body?.label ?? null;
    if (label !== null && !['good', 'bad'].includes(label)) {
      return reply.code(400).send({ error: 'label must be good|bad|null' });
    }
    await pool.query('UPDATE jobs SET label=$2, updated_at=now() WHERE id=$1', [
      id,
      label,
    ]);
    return { ok: true };
  });

  app.put('/api/jobs/:id/overlay', async (req, reply) => {
    const { id } = req.params as { id: string };
    const overlay = req.body as { jobId?: string; coverLetter?: string; audit?: unknown };
    const resumeDoc = (await currentResume()).data;
    // The ONE overlayProblems (imported, §8.1) — Zod + patch-validate + the one
    // personalInfo rule, against the SAME current-résumé source the editor used.
    const problems = overlayProblems(overlay, resumeDoc);
    if (problems.length)
      return reply.code(400).send({ error: 'invalid overlay', problems });
    if (overlay.jobId !== id)
      return reply.code(400).send({ error: 'jobId mismatch' });
    await pool.query(
      'UPDATE jobs SET overlay=$2, cover_letter=$3, audit=$4, updated_at=now() WHERE id=$1',
      [
        id,
        JSON.stringify(overlay),
        overlay.coverLetter ?? null,
        JSON.stringify(overlay.audit ?? { claims: [], unsupported: [] }),
      ]
    );
    return { ok: true };
  });

  // ====================== résumé ======================
  app.get('/api/resume', async () => (await currentResume()).data);

  app.put('/api/resume', async (req, reply) => {
    // Validate against @resume/contracts ResumeDoc (Zod safeParse).
    const parsed = ResumeDoc.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid résumé document',
        problems: parsed.error.issues.map(
          (i) => `${i.path.join('/')} ${i.message}`
        ),
      });
    }
    const { rows } = await pool.query(
      "INSERT INTO resume_versions (data, note) VALUES ($1, 'edit') RETURNING id, created_at",
      [JSON.stringify(parsed.data)]
    );
    const row = rows[0] as { id: unknown; created_at: unknown };
    return { ok: true, version: row.id, created_at: row.created_at };
  });

  // §8 DROP→ops-only: history + restore behind an env/ops flag (default off).
  if (enableResumeOps) {
    app.get(
      '/api/resume/history',
      async () =>
        (
          await pool.query(
            'SELECT id, note, created_at FROM resume_versions ORDER BY id DESC LIMIT 100'
          )
        ).rows
    );
    app.post('/api/resume/restore/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const { rows } = await pool.query(
        'SELECT data FROM resume_versions WHERE id=$1',
        [id]
      );
      if (!rows.length)
        return reply.code(404).send({ error: 'no such version' });
      const ins = await pool.query(
        'INSERT INTO resume_versions (data, note) VALUES ($1, $2) RETURNING id',
        [JSON.stringify(rows[0]?.data), `restore of #${id}`]
      );
      return { ok: true, version: (ins.rows[0] as { id: unknown }).id };
    });
  }

  // ====================== answers ======================
  app.get(
    '/api/answers',
    async () =>
      (
        await pool.query(
          'SELECT key, question, answer FROM answers ORDER BY key'
        )
      ).rows
  );

  app.put('/api/answers/:key', async (req) => {
    const { key } = req.params as { key: string };
    const body = req.body as { question?: string; answer?: string } | undefined;
    await pool.query(
      `INSERT INTO answers (key, question, answer) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET question=EXCLUDED.question, answer=EXCLUDED.answer, updated_at=now()`,
      [key, body?.question ?? key, body?.answer ?? '']
    );
    return { ok: true };
  });

  // Add a custom Q&A; key auto-derived from the question (slug, made unique).
  app.post('/api/answers', async (req, reply) => {
    const body = req.body as { question?: string; answer?: string } | undefined;
    const question = (body?.question ?? '').trim();
    const answer = (body?.answer ?? '').trim();
    if (!question)
      return reply.code(400).send({ error: 'question is required' });
    const base =
      question
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'custom';
    const { rows } = await pool.query('SELECT key FROM answers');
    const taken = new Set(rows.map((r) => r.key as string));
    let key = base;
    for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
    await pool.query(
      'INSERT INTO answers (key, question, answer) VALUES ($1,$2,$3)',
      [key, question, answer]
    );
    return { ok: true, key };
  });

  app.delete('/api/answers/:key', async (req) => {
    const { key } = req.params as { key: string };
    await pool.query('DELETE FROM answers WHERE key=$1', [key]);
    return { ok: true };
  });

  // ====================== config CRUD (§6/§8) ======================
  // NEVER reads/writes secrets — only the §6.3 namespaces (config table).
  app.get('/api/config/:ns', async (req, reply) => {
    const { ns } = req.params as { ns: string };
    if (!isConfigNs(ns))
      return reply
        .code(404)
        .send({ error: 'unknown config namespace', namespaces: CONFIG_NS });
    return getConfig(pool, ns); // best-effort: DB → Zod → schema default
  });

  app.put('/api/config/:ns', async (req, reply) => {
    const { ns } = req.params as { ns: string };
    if (!isConfigNs(ns))
      return reply
        .code(404)
        .send({ error: 'unknown config namespace', namespaces: CONFIG_NS });
    const parsed = parseConfig(ns, req.body); // validate body against the ns Zod
    if (!parsed.success) {
      return reply.code(400).send({
        error: `invalid config for ${ns}`,
        problems: parsed.error.issues.map(
          (i) => `${i.path.join('/')} ${i.message}`
        ),
      });
    }
    await pool.query(
      `INSERT INTO config (ns, value) VALUES ($1, $2)
       ON CONFLICT (ns) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [ns, JSON.stringify(parsed.data)]
    );
    return { ok: true, ns };
  });

  // ====================== dashboard / events (§9) ======================
  app.get('/api/dashboard/summary', async () => dashboardSummary(pool));

  app.get('/api/events', async (req) => {
    const q = req.query as {
      stage?: string;
      ok?: string;
      job_id?: string;
      limit?: string;
      before?: string; // id-based cursor: return events with id < before
    };
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.stage) {
      params.push(q.stage);
      where.push(`stage = $${params.length}`);
    }
    if (q.ok === 'true' || q.ok === 'false') {
      params.push(q.ok === 'true');
      where.push(`ok = $${params.length}`);
    }
    if (q.job_id) {
      params.push(q.job_id);
      where.push(`job_id = $${params.length}`);
    }
    if (q.before) {
      params.push(Number(q.before));
      where.push(`id < $${params.length}`);
    }
    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500);
    params.push(limit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, job_id, stage, model, input_tokens, output_tokens, cost_usd,
              duration_ms, ok, detail, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS created_at
         FROM events ${whereSql} ORDER BY id DESC LIMIT $${params.length}`,
      params
    );
    // pg returns numeric/bigint columns as JS STRINGS (id is bigserial, cost_usd
    // is numeric(10,6)). Coerce to real numbers so the EventRow z.number()
    // contract holds — and validate on the way out so a string→number regression
    // is caught at the boundary, not in the client's .toFixed().
    const toNum = (v: unknown): number | null => (v == null ? null : Number(v));
    const events = rows.map((r) => ({
      ...r,
      id: Number(r.id),
      input_tokens: toNum(r.input_tokens),
      output_tokens: toNum(r.output_tokens),
      cost_usd: toNum(r.cost_usd),
      duration_ms: toNum(r.duration_ms),
    }));
    return EventRow.array().parse(events); // EventRow[]
  });

  app.get('/healthz', async () => 'ok');

  // ====================== static hosting (§8) ======================
  // ONE unified dashboard SPA at / (apps/dashboard/build — built later by the
  // dashboard agent; just wire the root + SPA fallback). PLUS the bare résumé
  // render path (apps/site/build) at /resume/ for print/PDF/preview.
  // NOTE: no `/resume` (no trailing slash) redirect — that path belongs to the
  // dashboard SPA's own /resume route (it falls through to the SPA below). The
  // bare résumé host owns ONLY `/resume/...` (trailing slash).
  app.register(fastifyStatic, {
    root: resumeRenderDir,
    prefix: '/resume/',
    decorateReply: false,
  });
  app.register(fastifyStatic, {
    root: dashboardDir,
    prefix: '/',
    decorateReply: true,
  });

  // SPA fallback for the dashboard's client-side routes. /api/*, /applications/*,
  // and the bare-host /resume/ path are exempt — never fall back to the SPA.
  // The exemption uses '/resume/' (trailing slash) so a hard nav to the
  // dashboard's own '/resume' route falls through to the SPA.
  app.setNotFoundHandler((req, reply) => {
    const u = req.raw.url ?? '';
    if (
      u.startsWith('/api/') ||
      u.startsWith('/applications/') ||
      u.startsWith('/resume/')
    ) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html', dashboardDir);
  });

  return app;
}
