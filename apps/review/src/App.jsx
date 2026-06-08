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

      <div className="panes">
        <ResumePane id={id} job={job} onSaved={reload} />

        <section className="pane">
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
      </div>
    </Shell>
  );
}

// Résumé pane: Preview (resizable + zoomable iframe) | JSON (overlay editor).
function ResumePane({ id, job, onSaved }) {
  const [tab, setTab] = useState('preview');
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('resumeZoom')) || 1);
  const [version, setVersion] = useState(0); // cache-bust the iframe after a save
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const boxRef = React.useRef(null);

  useEffect(() => { localStorage.setItem('resumeZoom', String(zoom)); }, [zoom]);
  // load the current overlay into the editor when switching to JSON
  useEffect(() => {
    if (tab === 'json') setDraft(JSON.stringify(job.overlay ?? { jobId: id, profile: { sections: [] } }, null, 2));
  }, [tab, job.overlay, id]);
  // Box size lives entirely in the DOM (CSS `resize: both`) + localStorage —
  // NOT React state — so re-renders (zoom, save) never reset the user's drag.
  // Restore the saved size and persist future drags whenever the box mounts.
  useEffect(() => {
    if (tab !== 'preview') return undefined;
    const el = boxRef.current;
    if (!el) return undefined;
    const saved = JSON.parse(localStorage.getItem('resumeBox') || 'null');
    if (saved?.w) el.style.width = saved.w;
    if (saved?.h) el.style.height = saved.h;
    const ro = new ResizeObserver(() => {
      if (el.style.width || el.style.height) {
        localStorage.setItem('resumeBox', JSON.stringify({ w: el.style.width, h: el.style.height }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const overlay = JSON.parse(draft);
      await updateOverlay(id, overlay);
      setVersion((v) => v + 1);   // re-render iframe
      await onSaved();            // refresh job (diff, cover letter)
      setTab('preview');
    } catch (e) {
      setError(e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : e.message);
    } finally {
      setSaving(false);
    }
  };

  const z = Math.round(zoom * 100);
  return (
    <section className="pane">
      <div className="panehead">
        <div className="tabs">
          <button className={tab === 'preview' ? 'tab active' : 'tab'} onClick={() => setTab('preview')}>Preview</button>
          <button className={tab === 'json' ? 'tab active' : 'tab'} onClick={() => setTab('json')}>JSON</button>
        </div>
        {tab === 'preview' && (
          <div className="zoom">
            <button onClick={() => setZoom((x) => Math.max(0.4, +(x - 0.1).toFixed(2)))}>−</button>
            <span>{z}%</span>
            <button onClick={() => setZoom((x) => Math.min(2, +(x + 0.1).toFixed(2)))}>＋</button>
            <button onClick={() => setZoom(1)}>reset</button>
          </div>
        )}
      </div>

      {tab === 'preview' ? (
        <div className="resumebox" ref={boxRef}>
          <iframe
            key={version}
            className="resume"
            title="tailored resume"
            src={`/site/?application=${encodeURIComponent(id)}&v=${version}`}
            style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
          />
        </div>
      ) : (
        <div className="jsoneditor">
          <p className="muted">Edit the overlay: reorder <code>profile.sections</code>; per section,
            <code>filters.&lt;section&gt;.order</code> (titles) reorders/selects items,
            <code>filters.&lt;section&gt;.exclude</code> (titles) drops specific items (e.g. remove
            one project); <code>replace</code> patches rephrase bullets. Saved edits are yours
            (human-authored) and skip the AI fabrication check.</p>
          <textarea className="json" value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
          {error && <pre className="jsonerror">{error}</pre>}
          <div className="jsonactions">
            <button className="approve" disabled={saving} onClick={save}>{saving ? 'saving…' : 'Save & preview'}</button>
            <button disabled={saving} onClick={() => setTab('preview')}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

const Shell = ({ children }) => <div className="detail">{children}</div>;
