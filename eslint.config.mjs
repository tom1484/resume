import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

export default [
  // Never lint build output, deps, or data/coverage artifacts.
  {
    ignores: [
      '**/build/**',
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      '.render-baseline/**',
      '.render-current/**',
      'services/discovery/**', // Python service (ruff lints it)
    ],
  },

  js.configs.recommended,

  // Browser code: the résumé renderer + the two Vite apps.
  {
    files: ['packages/renderer/**/*.{js,jsx}', 'apps/**/*.{js,jsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off', // new JSX transform
      'react/prop-types': 'off', // not using prop-types
    },
  },

  // Node code: services (except discovery), build/tool configs, root scripts.
  {
    files: ['services/**/*.js', '**/*.config.{js,cjs,mjs}', '*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Scripts use Node (fs) AND run browser callbacks via Playwright page.evaluate.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Tests run under vitest.
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Allow intentionally-unused args/vars prefixed with _, and the common
  // "destructure to omit from ...props" pattern.
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
];
