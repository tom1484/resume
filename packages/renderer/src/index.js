// Public barrel of @resume/renderer. Apps currently consume this package
// through Vite aliases (@components, @config, @contexts, @hooks, @data,
// @utils) pointing into src/ — see apps/site/vite.config.mjs. This barrel
// exists for consumers that prefer package-path imports.
export { getComponent } from './config/componentRegistry';
export { ConfigProvider, useConfig } from './contexts/configContext';
export { ThemeProvider, useTheme } from './contexts/themeContext';
// Data-layer helpers are deep-imported by consumers (e.g. apps/review uses
// @resume/renderer/src/data/editorModel) to avoid pulling component code
// that depends on app-specific Vite aliases. Not re-exported here.
