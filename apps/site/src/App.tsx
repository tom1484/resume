import React, { useEffect } from 'react';
import { getComponent } from '@config/componentRegistry';
import { sectionsConfig } from '@config/sections';
import { getPrint, pageCss } from '@data';
import { ThemeProvider, useTheme } from '@contexts/themeContext';
import {
  ResumeDataProvider,
  useResumeDoc,
  useSection,
} from '@contexts/resumeDataContext';
import type { RenderPayload } from '@data';
import Title from '@components/title';
import ErrorBoundary from '@components/common/errorBoundary';

// The BARE résumé render host: a chrome-less render of the
// canonical résumé (or an applied overlay) — the print/PDF target and the
// dashboard's review preview. No editor UI lives here; the résumé/overlay
// editors moved to the dashboard agent (which imports editorModel/ResumeTree
// from @resume/renderer). Data flows via ResumeDataProvider (no module
// singleton). Print wiring (usePageStyle / @page) is preserved.

// Inject the résumé's print config as an @page rule in <head> (browser print /
// Save-as-PDF). Kept out of #root so it doesn't affect the render DOM.
function usePageStyle(doc: unknown) {
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'print-cfg';
    el.textContent = pageCss(getPrint(doc));
    document.getElementById('print-cfg')?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [doc]);
}

// Sections honor an optional meta.sectionOrder (set by the editor); unknown keys
// fall to the end in their declared order.
function orderedSections(doc: { meta?: { sectionOrder?: string[] } } | undefined) {
  const order = doc?.meta?.sectionOrder ?? [];
  const rank = (dataKey: string) => {
    const i = order.indexOf(dataKey);
    return i === -1 ? 99 : i;
  };
  return sectionsConfig
    .slice()
    .sort((a, b) => rank(a.dataKey) - rank(b.dataKey));
}

function SectionRender({
  section,
}: {
  section: (typeof sectionsConfig)[number];
}) {
  const Component = getComponent(section.component);
  const data = useSection(section.dataKey);
  if (!Component) return null;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return (
    <>
      {section.title && <Title title={section.title} />}
      <Component data={data} {...section.props} />
    </>
  );
}

function ResumeView() {
  const { theme } = useTheme();
  const doc = useResumeDoc();
  return (
    <div className={theme.components.container.main}>
      <div
        className={`${theme.layout.containerWidth} ${theme.layout.margins.top}`}
      ></div>
      {orderedSections(doc).map((section) => (
        <SectionRender key={section.id} section={section} />
      ))}
      <div
        className={`${theme.layout.containerWidth} ${theme.layout.margins.bottom}`}
      ></div>
    </div>
  );
}

function App({ payload }: { payload: RenderPayload }) {
  usePageStyle(payload.doc);
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <ResumeDataProvider payload={payload}>
          <ResumeView />
        </ResumeDataProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
