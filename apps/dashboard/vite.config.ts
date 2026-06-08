import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The dashboard reuses the renderer ONLY via its alias-free deep-importable
// surface (`@resume/renderer/src/data/*`, `.../editor/ResumeTree`) — the editor
// tree + editorModel + print/overlay/adapter helpers. The résumé CANVAS is NOT
// rendered in-app: it is iframed from the bare host (apps/site, served at
// /resume/ by the API) so it stays pixel-identical to the Playwright PDF target
// and the Tailwind preflight of the renderer never collides with shadcn/ui's.
// That means NONE of the renderer's internal @components/@config/@contexts/@css
// aliases are needed here. `@` → the dashboard's own src (shadcn/ui convention).
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
});
