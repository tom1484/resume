// Renders the built résumé site to a single out/resume.pdf.
// The page renders the canonical résumé (the static build falls back to the
// bundled resume.json seed when no API is reachable, as in CI).
// Usage: pnpm pdf  (expects a root-base `pnpm build` first)
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveStatic } from './lib/server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'apps/site/build');
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

const { port, close } = await serveStatic(buildDir);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const path = join(outDir, 'resume.pdf');
await page.pdf({
  path,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});
console.log(`✓ ${path}`);

await browser.close();
close();
