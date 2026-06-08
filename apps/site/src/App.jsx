import React from 'react';
import { getComponent } from '@config/componentRegistry';
import { sectionsConfig } from '@config/sections';
import { getData } from '@data';
import { ThemeProvider, useTheme } from '@contexts/themeContext';
import Title from '@components/title';
import ErrorBoundary from '@components/common/errorBoundary';

// Single canonical résumé: render every section in order. Section/item
// selection for a specific job is handled upstream (application overlay),
// not here.
function AppContent() {
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
      {sectionsConfig.map(renderSection)}
      <div className={`${theme.layout.containerWidth} ${theme.layout.margins.bottom}`}></div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
