// Renders the built app to one PDF per profile defined in
// resume.json meta["x-profiles"], using the ?profile=<id> URL parameter.
// Usage: pnpm pdf  (expects a root-base `pnpm build` first; writes out/*.pdf)
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveStatic } from './lib/server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

const resume = JSON.parse(readFileSync(join(root, 'src/data/resume.json'), 'utf8'));
const profileIds = Object.keys(resume.meta['x-profiles']);

const { port, close } = await serveStatic(buildDir);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });

for (const id of profileIds) {
  await page.goto(`http://localhost:${port}/?profile=${id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const path = join(outDir, `resume-${id}.pdf`);
  await page.pdf({
    path,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  console.log(`✓ ${path}`);
}

await browser.close();
close();
