// Data layer for the renderer. The active résumé view models come from one
// of: the canonical résumé (registerResume, /resume route), an application
// overlay (registerApplication, ?application=<id>), or — as a fallback for
// standalone/PDF/CI builds with no API — the bundled resume.json seed.
import bundledResume from './resume.json';
import { buildViewModels } from './adapter';
import { applyOverlay } from './overlay';

// Per-section presentation configs (consumed by config/sections.js)
export const experienceConfigs = {
  academics: {},
  working: {},
  competitions: {},
  projects: {
    showTags: false,
  },
  extracurriculars: {},
};

export const publicationsConfig = {};

let activeData = buildViewModels(bundledResume);

// Render the canonical résumé (optionally an edited document)
export const registerResume = (doc) => {
  activeData = buildViewModels(doc);
  return activeData;
};

// Render an application overlay against a base résumé document
export const registerApplication = (overlay, baseDoc = bundledResume) => {
  activeData = applyOverlay(overlay, baseDoc).data;
  return activeData;
};

// Current view models (object: section key -> items)
export const getResumeData = () => activeData;

// Items for one section key
export const getData = (dataKey) => {
  const data = activeData[dataKey];
  if (data === undefined) {
    console.warn(`Data key "${dataKey}" not found in resume data`);
    return null;
  }
  return data;
};
