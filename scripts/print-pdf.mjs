// Renders the built résumé site to a single out/resume.pdf.
// The page renders the canonical résumé (the static build falls back to the
// bundled resume.json seed when no API is reachable, as in CI).
// Usage: pnpm pdf  (expects a root-base `pnpm build` first)
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveStatic } from './lib/server.mjs';
import { getPrint, pdfOptions } from '../packages/renderer/src/data/print.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'apps/site/build');
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

const resume = JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8'));
const print = getPrint(resume);

const { port, close } = await serveStatic(buildDir);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const path = join(outDir, 'resume.pdf');
await page.pdf({ path, ...pdfOptions(print) });
console.log(`✓ ${path} (${print.paperSize}, scale ${print.scale})`);

await browser.close();
close();
