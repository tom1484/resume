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

// Canonical data for overlay validation (mounted read-only at DATA_DIR).
const dataDir = process.env.DATA_DIR ?? '/data';
const resume = JSON.parse(readFileSync(join(dataDir, 'resume.json'), 'utf8'));
const overlaySchema = JSON.parse(readFileSync(join(dataDir, 'overlay.schema.json'), 'utf8'));
const validateOverlaySchema = new Ajv({ allErrors: true }).compile(overlaySchema);

// Same gate as the tailor stage: schema-valid + patches apply cleanly to
// resume.json + must include personalInfo. Returns a list of problems.
function overlayProblems(overlay) {
  const problems = [];
  if (!validateOverlaySchema(overlay)) {
    problems.push(...validateOverlaySchema.errors.map((e) => `${e.instancePath || '/'} ${e.message}`));
    return problems; // shape is wrong; deeper checks would be noise
  }
  const patchError = jsonpatch.validate(overlay.patches ?? [], resume);
  if (patchError) {
    problems.push(`patch #${patchError.index} ${patchError.name} at ${patchError.operation?.path}`);
  }
  if (!overlay.profile.sections.includes('personalInfo')) {
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
  if (overlay?.jobId !== req.params.id) {
    return reply.code(400).send({ problems: [`jobId must equal "${req.params.id}"`] });
  }
  const problems = overlayProblems(overlay);
  if (problems.length) return reply.code(400).send({ problems });

  // Manual edits are human-authored — flag so they bypass the LLM
  // verify/drop path and never get mistaken for auto-verified output.
  const stored = {
    ...overlay,
    audit: { ...(overlay.audit ?? {}), unsupported: [], humanEdited: true },
  };
  await pool.query(
    'UPDATE jobs SET overlay=$2, cover_letter=$3, audit=$4, updated_at=now() WHERE id=$1',
    [req.params.id, JSON.stringify(stored), stored.coverLetter ?? null, JSON.stringify(stored.audit)]
  );
  return { ok: true };
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

// --- static: resume renderer (for the embedded tailored view) + review SPA
// Renderer build is mounted at /site (it fetches /applications/<id>/overlay.json,
// served above). Review SPA is the default root.
app.register(fastifyStatic, { root: join(root, '../site'), prefix: '/site/', decorateReply: false });
app.register(fastifyStatic, { root: join(root, '../review'), prefix: '/', decorateReply: true });

// SPA fallback for client-side routes (/inbox, /app/:id)
app.setNotFoundHandler((req, reply) => {
  if (req.raw.url.startsWith('/api/') || req.raw.url.startsWith('/applications/')) {
    return reply.code(404).send({ error: 'not found' });
  }
  return reply.sendFile('index.html', join(root, '../review'));
});

app.listen({ host: '0.0.0.0', port: 8080 }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
