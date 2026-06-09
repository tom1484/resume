import React from 'react';
import ReactDOM from 'react-dom/client';
import '@css/index.css';
import {
  applicationPayload,
  resumePayload,
  bundledSeed,
  type RenderPayload,
} from '@data';
import type { Overlay, ResumeDoc } from '@resume/contracts';
import App from './App';

// Routes (single canonical résumé — no profiles):
//   ?application=<id> → fetch overlay + base résumé, render the TAILORED résumé
//                       read-only (the dashboard review preview / bare print path
//                       — replaces the v1 iframe).
//   otherwise         → fetch the canonical résumé from /api/resume and render
//                       it. Falls back to the bundled seed when no API is
//                       reachable (standalone build, PDF, CI).
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function buildPayload(): Promise<RenderPayload> {
  const params = new URLSearchParams(window.location.search);
  const applicationId = params.get('application');

  if (applicationId) {
    const overlay = (await fetchJson(
      `/applications/${encodeURIComponent(applicationId)}/overlay.json`
    )) as Overlay;
    if (!overlay?.jobId || !overlay?.profile) {
      throw new Error(`overlay ${applicationId} is malformed`);
    }
    // base résumé the overlay applies onto (current canonical); fall back to seed
    let base: ResumeDoc = bundledSeed;
    try {
      base = (await fetchJson('/api/resume')) as ResumeDoc;
    } catch {
      /* keep bundled seed */
    }
    return applicationPayload(overlay, base);
  }

  // canonical résumé from the API; bundled seed if unavailable
  try {
    return resumePayload((await fetchJson('/api/resume')) as ResumeDoc);
  } catch {
    return resumePayload(bundledSeed);
  }
}

buildPayload()
  .then((payload) => {
    root.render(
      <React.StrictMode>
        <App payload={payload} />
      </React.StrictMode>
    );
  })
  .catch((err) => {
     
    console.error(err);
    root.render(
      <div className="m-8 rounded border-2 border-red-600 bg-red-50 p-6 font-sans text-red-800">
        <h1 className="mb-2 text-xl font-bold">Résumé failed to load</h1>
        <p className="font-mono text-sm">{String(err?.message ?? err)}</p>
      </div>
    );
  });
