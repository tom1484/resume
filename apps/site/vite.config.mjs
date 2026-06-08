import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const renderer = path.resolve(__dirname, '../../packages/renderer/src');

export default defineConfig({
  // Set VITE_BASE=/<subpath>/ when deploying under a subpath
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@css': path.resolve(__dirname, 'src/css'),
      '@components': path.join(renderer, 'components'),
      '@config': path.join(renderer, 'config'),
      '@contexts': path.join(renderer, 'contexts'),
      '@data': path.join(renderer, 'data'),
    },
  },
  build: {
    outDir: 'build',
  },
});
