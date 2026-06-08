import defaultTheme from '@config/themes/default';

export type Theme = typeof defaultTheme;

export function getTheme(): Theme {
  return defaultTheme;
}