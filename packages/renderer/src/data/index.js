// Data layer for the renderer. The active résumé view models come from one
// of: the canonical résumé (registerResume, /resume route), an application
// overlay (registerApplication, ?application=<id>), or — as a fallback for
// standalone/PDF/CI builds with no API — the bundled resume.json seed.
import bundledResume from '../../../../data/resume.json';
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
let activeDoc = bundledResume; // the résumé document behind activeData (for the editor)

// Render the canonical résumé (optionally an edited document)
export const registerResume = (doc) => {
  activeDoc = doc;
  activeData = buildViewModels(doc);
  return activeData;
};

// The résumé document currently rendered (used by the /resume editor)
export const getResumeDoc = () => activeDoc;

// Render an application overlay against a base résumé document. activeDoc is
// the base résumé so meta (print config, etc.) is inherited by the render.
export const registerApplication = (overlay, baseDoc = bundledResume) => {
  activeDoc = baseDoc;
  activeData = applyOverlay(overlay, baseDoc).data;
  return activeData;
};

// Items for one section key
export const getData = (dataKey) => {
  const data = activeData[dataKey];
  if (data === undefined) {
    console.warn(`Data key "${dataKey}" not found in resume data`);
    return null;
  }
  return data;
};
