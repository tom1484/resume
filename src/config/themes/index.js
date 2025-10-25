// Theme selector and exporter
import { vibrantTheme } from './vibrant';
import { normalTheme } from './normal';

export const THEME_MODES = {
  VIBRANT: 'vibrant',
  NORMAL: 'normal'
};

export function getTheme(mode) {
  switch (mode) {
    case THEME_MODES.NORMAL:
      return normalTheme;
    case THEME_MODES.VIBRANT:
    default:
      return vibrantTheme;
  }
}

// Re-export themes for direct access if needed
export { vibrantTheme, normalTheme };

// Export legacy theme for backward compatibility
export { vibrantTheme as theme };
