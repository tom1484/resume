import React, { useEffect, useState } from 'react';
import { approve, getJob, label, listJobs, reject } from './api.js';

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
  return m ? <Detail id={decodeURIComponent(m[1])} /> : <Inbox />;
}

function Inbox() {
  const [status, setStatus] = useState('in_review');
  const [jobs, setJobs] = useState(null);
  useEffect(() => { setJobs(null); listJobs(status).then(setJobs).catch(() => setJobs([])); }, [status]);
  const tabs = ['in_review', 'approved', 'scored', 'rejected'];
  return (
    <div className="inbox">
      <h1>Job Review</h1>
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
        <section className="pane">
          <h3>Tailored résumé {patches.length > 0 && <span className="muted">({patches.length} edits)</span>}</h3>
          <iframe className="resume" title="tailored resume" src={`/site/?application=${encodeURIComponent(id)}`} />
        </section>

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

const Shell = ({ children }) => <div className="detail">{children}</div>;
