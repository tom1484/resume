import React, { useState } from 'react';
import { getComponent } from '@config/componentRegistry';
import { sectionsConfig } from '@config/sections';
import { getData, getResumeDoc, registerResume } from '@data';
import { ThemeProvider, useTheme } from '@contexts/themeContext';
import Title from '@components/title';
import ErrorBoundary from '@components/common/errorBoundary';
import { ResumeEditor } from './ResumeEditor';

// Sections honor an optional meta.sectionOrder (set by the editor); unknown
// keys fall to the end in their declared order.
function orderedSections(doc) {
  const order = doc?.meta?.sectionOrder ?? [];
  const rank = (dataKey) => {
    const i = order.indexOf(dataKey);
    return i === -1 ? 99 : i;
  };
  return sectionsConfig.slice().sort((a, b) => rank(a.dataKey) - rank(b.dataKey));
}

function ResumeView() {
  const { theme } = useTheme();
  const renderSection = (section) => {
    const Component = getComponent(section.component);
    if (!Component) return null;
    const data = getData(section.dataKey);
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    return (
      <React.Fragment key={section.id}>
        {section.title && <Title title={section.title} />}
        <Component data={data} {...section.props} />
      </React.Fragment>
    );
  };
  return (
    <div className={theme.components.container.main}>
      <div className={`${theme.layout.containerWidth} ${theme.layout.margins.top}`}></div>
      {orderedSections(getResumeDoc()).map(renderSection)}
      <div className={`${theme.layout.containerWidth} ${theme.layout.margins.bottom}`}></div>
    </div>
  );
}

function AppContent({ editable }) {
  const [editing, setEditing] = useState(false);
  const [rev, setRev] = useState(0); // bump to force a fresh render after save

  const onSaved = async () => {
    try {
      const r = await fetch('/api/resume');
      if (r.ok) registerResume(await r.json());
    } catch { /* keep current */ }
    setEditing(false);
    setRev((n) => n + 1);
  };

  if (editing) return <ResumeEditor doc={getResumeDoc()} onSaved={onSaved} onClose={() => setEditing(false)} />;

  return (
    <>
      {editable && (
        <button className="print:hidden" onClick={() => setEditing(true)}
          style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000, border: '1px solid #d0d3d9', background: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
          ✎ Edit
        </button>
      )}
      <ResumeView key={rev} />
    </>
  );
}

function App({ editable = false }) {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent editable={editable} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
