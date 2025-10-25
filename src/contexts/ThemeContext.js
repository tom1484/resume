import React, { createContext, useContext, useState, useCallback } from 'react';
import { getTheme, THEME_MODES } from '../config/themes';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(THEME_MODES.VIBRANT);
  const theme = getTheme(themeMode);

  const setThemeMode = useCallback((mode) => {
    if (Object.values(THEME_MODES).includes(mode)) {
      setThemeModeState(mode);
      // Optional: persist to localStorage
      localStorage.setItem('resumeThemeMode', mode);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = themeMode === THEME_MODES.VIBRANT 
      ? THEME_MODES.NORMAL 
      : THEME_MODES.VIBRANT;
    setThemeMode(newMode);
  }, [themeMode, setThemeMode]);

  // Initialize from localStorage on mount
  React.useEffect(() => {
    const savedMode = localStorage.getItem('resumeThemeMode');
    if (savedMode && Object.values(THEME_MODES).includes(savedMode)) {
      setThemeModeState(savedMode);
    }
  }, []);

  const value = {
    themeMode,
    setThemeMode,
    toggleTheme,
    theme,
    isVibrant: themeMode === THEME_MODES.VIBRANT,
    isNormal: themeMode === THEME_MODES.NORMAL,
    THEME_MODES
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
