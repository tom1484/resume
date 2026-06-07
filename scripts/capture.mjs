// Golden-reference capture for render-regression checks.
// Usage: node scripts/capture.mjs <build-dir> <out-prefix> [query]
// Serves <build-dir> statically, renders in headless Chromium, and writes:
//   <out-prefix>.dom.html  — #root outerHTML (fast diff)
//   <out-prefix>.pdf       — print-to-PDF, A4, no margins/header/footer
//   <out-prefix>.png       — full-page screenshot
// [query] is an optional URL query string, e.g. "profile=academic".
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serveStatic } from './lib/server.mjs';

const [buildDir, outPrefix, query] = process.argv.slice(2);
if (!buildDir || !outPrefix) {
  console.error('usage: node scripts/capture.mjs <build-dir> <out-prefix> [query]');
  process.exit(1);
}

const { port, close } = await serveStatic(buildDir);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
await page.goto(`http://localhost:${port}/${query ? `?${query}` : ''}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const dom = await page.evaluate(() => document.getElementById('root').outerHTML);
writeFileSync(`${outPrefix}.dom.html`, dom);

await page.pdf({
  path: `${outPrefix}.pdf`,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});

await page.screenshot({ path: `${outPrefix}.png`, fullPage: true });

await browser.close();
close();
console.log(`captured: ${outPrefix}.{dom.html,pdf,png}`);
