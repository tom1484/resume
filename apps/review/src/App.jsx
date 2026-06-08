import React, { useEffect, useState } from 'react';
import { approve, getAnswers, getJob, label, listJobs, reject, saveAnswer, updateOverlay } from './api.js';

// Hash routing: #/ (inbox) | #/app/<id> (detail). No router dep.
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

const go = (h) => { window.location.hash = h; };

export function App() {
  const hash = useHashRoute();
  const m = hash.match(/^#\/app\/(.+)$/);
  if (m) return <Detail id={decodeURIComponent(m[1])} />;
  if (hash === '#/answers') return <Answers />;
  return <Inbox />;
}

function Answers() {
  const [rows, setRows] = useState(null);
  const [saved, setSaved] = useState(null);
  useEffect(() => { getAnswers().then(setRows).catch(() => setRows([])); }, []);
  const save = async (r) => { await saveAnswer(r.key, r.question, r.answer); setSaved(r.key); setTimeout(() => setSaved(null), 1500); };
  if (!rows) return <Shell><p className="muted">Loading…</p></Shell>;
  return (
    <div className="inbox">
      <div className="detailhead"><a href="#/" className="back">← inbox</a><h2>Answers bank</h2></div>
      <p className="muted">Templated answers the apply agent uses for application questions. The pipeline lightly tailors these per job; edits here are the source of truth.</p>
      {rows.map((r, i) => (
        <div key={r.key} className="answer">
          <label>{r.question} <span className="muted">({r.key})</span></label>
          <textarea value={r.answer} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
          <button onClick={() => save(r)}>{saved === r.key ? 'saved ✓' : 'save'}</button>
        </div>
      ))}
    </div>
  );
}

function Inbox() {
  const [status, setStatus] = useState('in_review');
  const [jobs, setJobs] = useState(null);
  useEffect(() => { setJobs(null); listJobs(status).then(setJobs).catch(() => setJobs([])); }, [status]);
  const tabs = ['in_review', 'approved', 'scored', 'rejected'];
  return (
    <div className="inbox">
      <h1>Job Review <a className="answerslink" href="#/answers">answers bank →</a></h1>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={t === status ? 'tab active' : 'tab'} onClick={() => setStatus(t)}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>
      {jobs === null ? <p className="muted">Loading…</p> : jobs.length === 0 ? (
        <p className="muted">No jobs in “{status.replace('_', ' ')}”.</p>
      ) : (
        <ul className="joblist">
          {jobs.map((j) => (
            <li key={j.id} onClick={() => go(`#/app/${encodeURIComponent(j.id)}`)}>
              <span className="score">{j.score?.toFixed(2) ?? '—'}</span>
              <span className="jobmeta">
                <strong>{j.company}</strong>
                {(j.company_flags ?? []).map((f) => <span key={f} className="flag">{f}</span>)}
                <br />{j.title}
              </span>
              {j.label && <span className={`label ${j.label}`}>{j.label}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Detail({ id }) {
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const reload = () => getJob(id).then(setJob).catch(() => setJob(false));
  useEffect(() => { reload(); }, [id]);

  if (job === false) return <Shell><p className="muted">Not found. <a href="#/">Back</a></p></Shell>;
  if (!job) return <Shell><p className="muted">Loading…</p></Shell>;

  const act = (fn) => async () => { setBusy(true); try { await fn(); await reload(); } finally { setBusy(false); } };
  const bd = job.score_breakdown ?? {};
  const patches = job.overlay?.patches ?? [];

  return (
    <Shell>
      <div className="detailhead">
        <a href="#/" className="back">← inbox</a>
        <h2>{job.company} — {job.title}</h2>
        <span className={`status ${job.status}`}>{job.status}</span>
      </div>

      <div className="actions">
        <button className="approve" disabled={busy || job.status !== 'in_review'} onClick={act(() => approve(id))}>Approve</button>
        <button className="reject" disabled={busy} onClick={act(() => reject(id, prompt('Reject reason?') ?? ''))}>Reject</button>
        <span className="sep" />
        <span className="muted">label:</span>
        {['good', 'bad'].map((v) => (
          <button key={v} className={job.label === v ? `lab ${v} on` : `lab ${v}`} disabled={busy}
            onClick={act(() => label(id, job.label === v ? null : v))}>{v}</button>
        ))}
        {job.url && <a className="ext" href={job.url} target="_blank" rel="noreferrer">open posting ↗</a>}
      </div>

      <Editor id={id} job={job} onSaved={reload} />
      <Info job={job} />
    </Shell>
  );
}

// Side-by-side preview (left) | JSON overlay editor (right). The divider
// adjusts WIDTH only; both panes share one fixed height so the preview is
// always as tall as the editor. On mobile they stack and the preview is a
// full viewport-height block.
function Editor({ id, job, onSaved }) {
  const [ratio, setRatio] = useState(() => Number(localStorage.getItem('editorRatio')) || 0.5);
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('resumeZoom')) || 1);
  const [version, setVersion] = useState(0); // cache-bust the iframe after a save
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const rowRef = React.useRef(null);

  useEffect(() => { localStorage.setItem('resumeZoom', String(zoom)); }, [zoom]);
  const loadDraft = () => setDraft(JSON.stringify(job.overlay ?? { jobId: id, profile: { sections: [] } }, null, 2));
  useEffect(loadDraft, [job.overlay, id]);

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true); // disable iframe pointer events so it can't swallow the drag
    const move = (ev) => {
      const r = rowRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      setRatio(Math.min(0.8, Math.max(0.2, x / r.width)));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      setRatio((cur) => { localStorage.setItem('editorRatio', String(cur)); return cur; });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const overlay = JSON.parse(draft);
      await updateOverlay(id, overlay);
      setVersion((v) => v + 1);
      await onSaved();
    } catch (e) {
      setError(e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : e.message);
    } finally {
      setSaving(false);
    }
  };

  const z = Math.round(zoom * 100);
  return (
    <div className={dragging ? 'editor dragging' : 'editor'} ref={rowRef}>
      <div className="epane preview" style={{ flexBasis: `${ratio * 100}%` }}>
        <div className="zoom">
          <button onClick={() => setZoom((x) => Math.max(0.4, +(x - 0.1).toFixed(2)))}>−</button>
          <span>{z}%</span>
          <button onClick={() => setZoom((x) => Math.min(2, +(x + 0.1).toFixed(2)))}>＋</button>
          <button onClick={() => setZoom(1)}>reset</button>
        </div>
        <div className="resumebox">
          <iframe
            key={version}
            className="resume"
            title="tailored resume"
            src={`/site/?application=${encodeURIComponent(id)}&v=${version}`}
            style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
          />
        </div>
      </div>

      <div className="splitter" onMouseDown={startDrag} onTouchStart={startDrag} title="drag to resize" />

      <div className="epane json" style={{ flexBasis: `${(1 - ratio) * 100}%` }}>
        <p className="muted edithint">Reorder <code>profile.sections</code>; per section set
          <code>filters.&lt;section&gt;.order</code> / <code>.exclude</code> (item titles) to
          reorder/drop items; add <code>replace</code> patches to rephrase bullets. Saved edits are
          yours and skip the AI fabrication check.</p>
        <textarea className="json" value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
        {error && <pre className="jsonerror">{error}</pre>}
        <div className="jsonactions">
          <button className="approve" disabled={saving} onClick={save}>{saving ? 'saving…' : 'Save & preview'}</button>
          <button disabled={saving} onClick={loadDraft}>Revert</button>
        </div>
      </div>
    </div>
  );
}

function Info({ job }) {
  const bd = job.score_breakdown ?? {};
  const patches = job.overlay?.patches ?? [];
  return (
    <section className="info">
      <h3>Score {job.score?.toFixed(2)}</h3>
      <ul className="breakdown">
        <li>keyword <b>{bd.keyword?.toFixed(2)}</b></li>
        <li>fit <b>{bd.llmFit?.toFixed(2)}</b></li>
        <li>structural <b>{bd.structural?.toFixed(2)}</b></li>
      </ul>
      {bd.rationale && <p className="rationale">{bd.rationale}</p>}
      {(bd.redFlags ?? []).length > 0 && <p className="flags">⚠ {bd.redFlags.join('; ')}</p>}
      {(bd.missingTerms ?? []).length > 0 && <p className="muted">missing: {bd.missingTerms.join(', ')}</p>}

      <h3>Edits vs. base résumé</h3>
      {patches.length === 0 ? <p className="muted">Section selection only — no bullet rewrites.</p> : (
        <ul className="diff">
          {patches.map((p, i) => <li key={i}><code>{p.path}</code><div className="newval">{p.value}</div></li>)}
        </ul>
      )}

      <h3>Cover letter</h3>
      <pre className="cover">{job.cover_letter || '—'}</pre>

      <details><summary>Job description</summary><pre className="jd">{job.jd_text}</pre></details>
    </section>
  );
}

const Shell = ({ children }) => <div className="detail">{children}</div>;
