import React from 'react';
import ReactDOM from 'react-dom/client';
import '@css/index.css';
import { registerApplication } from '@data';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Application overlays must be loaded BEFORE the app mounts: the data layer
// is synchronous (view models are resolved at module scope), so the overlay
// is fetched first and registered as the active profile.
//
// On any failure we render a visible error instead of falling back to the
// plain resume — a reviewer must never mistake the default resume for a
// tailored one.
async function bootstrap() {
  const applicationId = new URLSearchParams(window.location.search).get('application');

  if (applicationId) {
    const url = `/applications/${encodeURIComponent(applicationId)}/overlay.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to load overlay ${url}: HTTP ${response.status}`);
    }
    const overlay = await response.json();
    if (!overlay || typeof overlay !== 'object' || !overlay.jobId || !overlay.profile) {
      throw new Error(`overlay ${applicationId} is malformed (missing jobId/profile)`);
    }
    registerApplication(overlay);
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
      <h1 className="mb-2 text-xl font-bold">Application overlay failed to load</h1>
      <p className="font-mono text-sm">{String(err.message ?? err)}</p>
    </div>
  );
});
