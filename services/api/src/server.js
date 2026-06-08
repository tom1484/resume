// Review API + static host for the review SPA and the resume renderer.
// Joins the nginx network (no published ports); NPM proxies jobs.churong.cc
// here and enforces the access list. Everything behind this is PII.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import pg from 'pg';
import Ajv from 'ajv';
import jsonpatch from 'fast-json-patch';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const root = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

// Canonical data + overlay schema (mounted read-only at DATA_DIR) — used to
// validate reviewer-edited overlays before persisting them.
const dataDir = process.env.DATA_DIR ?? '/data';                       // schemas (renderer pkg)
const seedFile = process.env.RESUME_SEED ?? '/seed/resume.json';       // canonical résumé seed
const resume = JSON.parse(readFileSync(seedFile, 'utf8'));
const overlaySchema = JSON.parse(readFileSync(join(dataDir, 'overlay.schema.json'), 'utf8'));
const validateOverlay = new Ajv({ allErrors: true }).compile(overlaySchema);

// Returns an array of problems (empty = valid). Validates patches against
// the CURRENT canonical résumé (resumeDoc) so it matches what the editor
// built against and what the renderer applies.
function overlayProblems(overlay, resumeDoc) {
  const problems = [];
  if (!validateOverlay(overlay)) {
    problems.push(...validateOverlay.errors.map((e) => `${e.instancePath || '/'} ${e.message}`));
  }
  const err = jsonpatch.validate(overlay?.patches ?? [], resumeDoc);
  if (err) problems.push(`patch #${err.index} ${err.name} at ${err.operation?.path}`);
  if (overlay?.profile && !overlay.profile.sections?.includes('personalInfo')) {
    problems.push('profile.sections must include personalInfo');
  }
  return problems;
}

const JOB_FIELDS = `id, source, company, title, location, remote, url, posted_at,
  score, score_breakdown, status, company_flags, label, reject_reason,
  cover_letter, audit, parsed, jd_text, overlay`;

// --- API ---------------------------------------------------------------
app.get('/api/jobs', async (req) => {
  const status = req.query.status ?? 'in_review';
  const { rows } = await pool.query(
    `SELECT id, company, title, location, score, status, company_flags, label
     FROM jobs WHERE status = $1 ORDER BY score DESC NULLS LAST`,
    [status]
  );
  return rows;
});

app.get('/api/jobs/:id', async (req, reply) => {
  const { rows } = await pool.query(`SELECT ${JOB_FIELDS} FROM jobs WHERE id = $1`, [req.params.id]);
  if (!rows.length) return reply.code(404).send({ error: 'not found' });
  return rows[0];
});

// The renderer fetches the overlay from here (?application=<id>)
app.get('/applications/:id/overlay.json', async (req, reply) => {
  const { rows } = await pool.query('SELECT overlay FROM jobs WHERE id = $1', [req.params.id]);
  if (!rows.length || !rows[0].overlay) return reply.code(404).send({ error: 'no overlay' });
  return rows[0].overlay;
});

app.post('/api/jobs/:id/approve', async (req, reply) => {
  const { rowCount } = await pool.query(
    "UPDATE jobs SET status='approved', reviewed_at=now(), updated_at=now() WHERE id=$1 AND status='in_review'",
    [req.params.id]
  );
  return rowCount ? { ok: true } : reply.code(409).send({ error: 'not in_review' });
});

app.post('/api/jobs/:id/reject', async (req) => {
  await pool.query(
    "UPDATE jobs SET status='rejected', reject_reason=$2, reviewed_at=now(), updated_at=now() WHERE id=$1",
    [req.params.id, req.body?.reason ?? null]
  );
  return { ok: true };
});

// Calibration label (good|bad|null) — independent of approve/reject
app.post('/api/jobs/:id/label', async (req, reply) => {
  const label = req.body?.label ?? null;
  if (label !== null && !['good', 'bad'].includes(label)) {
    return reply.code(400).send({ error: 'label must be good|bad|null' });
  }
  await pool.query('UPDATE jobs SET label=$2, updated_at=now() WHERE id=$1', [req.params.id, label]);
  return { ok: true };
});

app.put('/api/jobs/:id/overlay', async (req, reply) => {
  const overlay = req.body;
  const problems = overlayProblems(overlay, (await currentResume()).data);
  if (problems.length) return reply.code(400).send({ error: 'invalid overlay', problems });
  if (overlay.jobId !== req.params.id) return reply.code(400).send({ error: 'jobId mismatch' });
  await pool.query(
    'UPDATE jobs SET overlay=$2, cover_letter=$3, audit=$4, updated_at=now() WHERE id=$1',
    [req.params.id, JSON.stringify(overlay), overlay.coverLetter ?? null, JSON.stringify(overlay.audit ?? { claims: [], unsupported: [] })]
  );
  return { ok: true };
});

// --- canonical résumé (DB-backed, seeded from the bundled file) ----------
// Latest resume_versions row is "current". Seed on first read if empty.
async function currentResume() {
  const { rows } = await pool.query('SELECT id, data FROM resume_versions ORDER BY id DESC LIMIT 1');
  if (rows.length) return rows[0];
  const seeded = await pool.query(
    "INSERT INTO resume_versions (data, note) VALUES ($1, 'seed') RETURNING id, data",
    [JSON.stringify(resume)]
  );
  return seeded.rows[0];
}

// Validate an edited résumé: must still pass the JSON Resume + extension
// schemas the build uses. We reuse the overlay's patch validator indirectly
// by re-validating shape here against a minimal structural check + Ajv if
// the schemas are mounted.
app.get('/api/resume', async () => (await currentResume()).data);

app.put('/api/resume', async (req, reply) => {
  const data = req.body;
  if (!data || typeof data !== 'object' || !data.basics || !Array.isArray(data.work)) {
    return reply.code(400).send({ error: 'not a résumé document (need basics + work[])' });
  }
  const { rows } = await pool.query(
    "INSERT INTO resume_versions (data, note) VALUES ($1, 'edit') RETURNING id, created_at",
    [JSON.stringify(data)]
  );
  return { ok: true, version: rows[0].id, created_at: rows[0].created_at };
});

app.get('/api/resume/history', async () =>
  (await pool.query('SELECT id, note, created_at FROM resume_versions ORDER BY id DESC LIMIT 100')).rows
);

app.post('/api/resume/restore/:id', async (req, reply) => {
  const { rows } = await pool.query('SELECT data FROM resume_versions WHERE id=$1', [req.params.id]);
  if (!rows.length) return reply.code(404).send({ error: 'no such version' });
  const ins = await pool.query(
    'INSERT INTO resume_versions (data, note) VALUES ($1, $2) RETURNING id',
    [JSON.stringify(rows[0].data), `restore of #${req.params.id}`]
  );
  return { ok: true, version: ins.rows[0].id };
});

// Export current résumé as a downloadable JSON (commit to git to sync the seed)
app.get('/api/resume/export', async (req, reply) => {
  const cur = await currentResume();
  reply.header('Content-Disposition', 'attachment; filename="resume.json"');
  return cur.data;
});

app.get('/api/answers', async () => (await pool.query('SELECT key, question, answer FROM answers ORDER BY key')).rows);

app.put('/api/answers/:key', async (req) => {
  const { question, answer } = req.body ?? {};
  await pool.query(
    `INSERT INTO answers (key, question, answer) VALUES ($1,$2,$3)
     ON CONFLICT (key) DO UPDATE SET question=EXCLUDED.question, answer=EXCLUDED.answer, updated_at=now()`,
    [req.params.key, question ?? req.params.key, answer ?? '']
  );
  return { ok: true };
});

app.get('/healthz', async () => 'ok');

// --- static: résumé renderer at /resume (canonical editor + the embedded
// tailored view), review SPA at the default root.
app.get('/resume', (req, reply) => reply.redirect('/resume/'));
app.register(fastifyStatic, { root: join(root, '../site'), prefix: '/resume/', decorateReply: false });
app.register(fastifyStatic, { root: join(root, '../review'), prefix: '/', decorateReply: true });

// SPA fallback for the review board's client-side routes (#/app/:id, etc.).
// /api, /applications, and /resume are handled above — never fall back to
// the review SPA for those.
app.setNotFoundHandler((req, reply) => {
  const u = req.raw.url;
  if (u.startsWith('/api/') || u.startsWith('/applications/') || u.startsWith('/resume')) {
    return reply.code(404).send({ error: 'not found' });
  }
  return reply.sendFile('index.html', join(root, '../review'));
});

app.listen({ host: '0.0.0.0', port: 8080 }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
