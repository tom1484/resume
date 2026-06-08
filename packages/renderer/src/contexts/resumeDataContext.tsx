// Résumé data context — the v2 replacement for the mutable `activeData`/
// `activeDoc` module singleton (v1 data/index.js:22-23). The render host builds
// a RenderPayload ({ doc, data }) once and provides it here; components read it
// via `useSection(key)` (one section's items, mirroring v1 `getData`) and
// `useResumeDoc()` (the doc behind the render, for print config / section order).
import React, { createContext, useContext } from 'react';
import type { RenderPayload } from '../data/index.js';

const ResumeDataContext = createContext<RenderPayload | null>(null);

export function ResumeDataProvider({
  payload,
  children,
}: {
  payload: RenderPayload;
  children: React.ReactNode;
}) {
  return (
    <ResumeDataContext.Provider value={payload}>
      {children}
    </ResumeDataContext.Provider>
  );
}

function useResumeData(): RenderPayload {
  const ctx = useContext(ResumeDataContext);
  if (!ctx) {
    throw new Error('useResumeData must be used within a ResumeDataProvider');
  }
  return ctx;
}

/** The résumé document currently rendered (print config, meta.sectionOrder). */
export function useResumeDoc() {
  return useResumeData().doc;
}

/** Items for one section key (null + warn when absent — mirrors v1 getData). */
export function useSection(dataKey: string): unknown {
  const { data } = useResumeData();
  const section = (data as Record<string, unknown>)[dataKey];
  if (section === undefined) {
    // eslint-disable-next-line no-console
    console.warn(`Data key "${dataKey}" not found in resume data`);
    return null;
  }
  return section;
}
