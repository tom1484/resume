// Public barrel of @resume/renderer. Apps currently consume this package
// through Vite aliases (@components, @config, @contexts, @hooks, @data,
// @utils) pointing into src/ — see apps/site/vite.config.mjs. This barrel
// exists for consumers that prefer package-path imports.
export { getComponent } from './config/componentRegistry';
export { ConfigProvider, useConfig } from './contexts/configContext';
export { ThemeProvider, useTheme } from './contexts/themeContext';
