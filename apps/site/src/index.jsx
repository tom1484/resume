import React from 'react';
import ReactDOM from 'react-dom/client';
import '@css/index.css';
import { registerApplication, registerResume } from '@data';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Routes (single canonical résumé — no profiles):
//   ?application=<id>  → fetch overlay + base résumé, render the TAILORED
//                        résumé read-only (used by the review app iframe)
//   otherwise (/resume) → fetch the canonical résumé from /api/resume and
//                        render it. Falls back to the bundled seed when no
//                        API is reachable (standalone build, PDF, CI).
async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const applicationId = params.get('application');

  if (applicationId) {
    const overlay = await fetchJson(`/applications/${encodeURIComponent(applicationId)}/overlay.json`);
    if (!overlay?.jobId || !overlay?.profile) throw new Error(`overlay ${applicationId} is malformed`);
    // base résumé the overlay applies onto (current canonical); fall back to bundled
    let base;
    try { base = await fetchJson('/api/resume'); } catch { base = undefined; }
    registerApplication(overlay, base);
  } else {
    // canonical résumé from the API; bundled seed if unavailable
    try {
      registerResume(await fetchJson('/api/resume'));
    } catch {
      /* registerResume already defaults to the bundled seed */
    }
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error(err);
  root.render(
    <div className="m-8 rounded border-2 border-red-600 bg-red-50 p-6 font-sans text-red-800">
      <h1 className="mb-2 text-xl font-bold">Résumé failed to load</h1>
      <p className="font-mono text-sm">{String(err.message ?? err)}</p>
    </div>
  );
});
