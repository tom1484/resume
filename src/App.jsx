import React from 'react';
import Title from './components/title';
import DataValidationDemo from './components/DataValidationDemo';
import { getComponent } from './config/componentRegistry';
import { getData } from './data';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// TODO:
//   Certifications (TOEFL, GRE, etc.)

function AppContent() {
  const { getVisibleSections, getVisibleItems } = useConfig();
  const { theme } = useTheme();
  
  const renderSection = (section) => {
    const Component = getComponent(section.component);
    if (!Component) return null;

    const data = getVisibleItems(section.id);
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
      {/* Data Management Demo Panel (includes theme switcher) */}
      <DataValidationDemo />

      {/* Top margin */}
      <div className={`${theme.layout.containerWidth} ${theme.layout.margins.top}`}></div>

      {/* Dynamic sections rendering */}
      {getVisibleSections().map(renderSection)}

      {/* Bottom margin */}
      <div className={`${theme.layout.containerWidth} ${theme.layout.margins.bottom}`}></div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </ThemeProvider>
  );
}

export default App;
