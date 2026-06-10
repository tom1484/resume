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
import PreviewRoot from './PreviewRoot';

// Routes (single canonical résumé — no profiles):
//   ?application=<id> → fetch overlay + base résumé, render the TAILORED résumé
//                       read-only (the dashboard review preview / bare print path).
//   otherwise         → fetch the canonical résumé from /api/resume and render
//                       it. Falls back to the bundled seed when no API is
//                       reachable (standalone build, PDF, CI).
//
// ?preview=<1|paper> layers a LIVE preview on top of any of the above: the host
// becomes an iframe child that swaps its render on postMessage from the
// dashboard (see PreviewRoot). With no `preview` param the render is the exact
// static <App payload/> tree as before (byte-identical invariant).
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const preview = new URLSearchParams(window.location.search).get('preview');

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function buildPayload(): Promise<RenderPayload> {
  const params = new URLSearchParams(window.location.search);
  const applicationId = params.get('application');

  if (applicationId) {
    // base résumé the overlay applies onto (current canonical); fall back to seed
    let base: ResumeDoc = bundledSeed;
    try {
      base = (await fetchJson('/api/resume')) as ResumeDoc;
    } catch {
      /* keep bundled seed */
    }
    try {
      const overlay = (await fetchJson(
        `/applications/${encodeURIComponent(applicationId)}/overlay.json`
      )) as Overlay;
      if (!overlay?.jobId || !overlay?.profile) {
        throw new Error(`overlay ${applicationId} is malformed`);
      }
      return applicationPayload(overlay, base);
    } catch (err) {
      // Preview-before-first-save: when previewing, a missing/malformed overlay
      // is expected — render the base résumé and let the dashboard post the live
      // overlay. Outside preview, keep the strict (throwing) behavior.
      if (!preview) throw err;
      return resumePayload(base);
    }
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
        <PreviewRoot initial={payload} preview={preview} />
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
