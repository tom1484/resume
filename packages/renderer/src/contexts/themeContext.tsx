import React, { createContext, useContext } from 'react';
import { getTheme, type Theme } from '@config/themes';

interface ThemeValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = getTheme();
  const value: ThemeValue = { theme };
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
