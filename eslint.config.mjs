import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
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

  // TS parser + recommended rules — SCOPED to ts/tsx so .js/.mjs keep espree +
  // the base rules (avoids TS rules firing on plain-JS scripts/tests/configs).
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['**/*.{ts,tsx}'] })),

  // Browser code: the résumé renderer + the Vite apps (JS/JSX and TS/TSX) + hooks.
  {
    files: ['packages/renderer/**/*.{js,jsx,ts,tsx}', 'apps/**/*.{js,jsx,ts,tsx}'],
    ...react.configs.flat.recommended,
    plugins: { ...react.configs.flat.recommended.plugins, 'react-hooks': reactHooks },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off', // new JSX transform
      'react/prop-types': 'off', // not using prop-types (TS types instead)
      'react/no-unescaped-entities': 'off', // noisy; not a correctness rule
    },
  },

  // Node code: services (except discovery), build/tool configs, root scripts.
  {
    files: ['services/**/*.{js,ts}', '**/*.config.{js,cjs,mjs,ts}', '*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Scripts use Node (fs) AND run browser callbacks via Playwright page.evaluate.
  {
    files: ['scripts/**/*.{mjs,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Tests run under vitest.
  {
    files: ['**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Unused-vars (JS): allow _-prefixed args/vars and the destructure-to-omit pattern.
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },

  // TS/TSX: TS-aware unused-vars; keep lint green by warning (not erroring) on
  // stylistic TS noise on the freshly-ported v2 codebase.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'warn',
    },
  },
);
