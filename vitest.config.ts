import { defineConfig } from 'vitest/config';

// Root vitest with projects (integration config). The dashboard suites need
// jsdom + the `@` alias, so they run under their own config; everything else
// runs in a plain node project. A bare `vitest run` cannot satisfy both.
export default defineConfig({
  test: {
    projects: [
      // jsdom + @vitejs/plugin-react + `@ -> src` alias (its own file)
      'apps/dashboard/vitest.config.ts',
      // packages/**, services/**, tests/**, apps/site/** — node env, no aliases
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.{test,spec}.{js,mjs,ts,jsx,tsx}'],
          exclude: [
            '**/node_modules/**',
            '**/build/**',
            '**/dist/**',
            'apps/dashboard/**',
          ],
        },
      },
    ],
  },
});
