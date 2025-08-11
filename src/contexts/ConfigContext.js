import React, { createContext, useContext, useState } from 'react';
import { sectionsConfig } from '../config/sections';

const ConfigContext = createContext();

export function ConfigProvider({ children }) {
  // Initialize section visibility from config
  const [sectionVisibility, setSectionVisibility] = useState(() => {
    const initial = {};
    sectionsConfig.forEach(section => {
      initial[section.id] = section.enabled;
    });
    return initial;
  });

  // Column ratio state (percentage for left column)
  const [leftColumnRatio, setLeftColumnRatio] = useState(22);

  const toggleSection = (sectionId) => {
    setSectionVisibility(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const updateLeftColumnRatio = (ratio) => {
    const numRatio = Math.max(10, Math.min(50, Number(ratio))); // Clamp between 10-50%
    setLeftColumnRatio(numRatio);
  };

  const getVisibleSections = () => {
    return sectionsConfig.filter(section => sectionVisibility[section.id]);
  };

  const value = {
    sectionVisibility,
    setSectionVisibility,
    toggleSection,
    leftColumnRatio,
    setLeftColumnRatio,
    updateLeftColumnRatio,
    getVisibleSections,
    allSections: sectionsConfig
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}