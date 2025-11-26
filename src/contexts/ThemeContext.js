import React, { createContext, useContext } from 'react';
import { getTheme } from '@config/themes';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const theme = getTheme();

  const value = {
    theme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
