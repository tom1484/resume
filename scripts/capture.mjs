// Golden-reference capture for the resume app migration.
// Usage: node capture.mjs <build-dir> <out-prefix>
// Serves <build-dir> statically, renders in headless Chromium, and writes:
//   <out-prefix>.dom.html  — #root outerHTML (fast diff)
//   <out-prefix>.pdf       — print-to-PDF, A4, no margins/header/footer
//   <out-prefix>.png       — full-page screenshot
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const [buildDir, outPrefix] = process.argv.slice(2);
if (!buildDir || !outPrefix) {
  console.error('usage: node capture.mjs <build-dir> <out-prefix>');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json', '.txt': 'text/plain',
};

const root = resolve(buildDir);
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    // SPA fallback
    try {
      const data = await readFile(join(root, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
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
server.close();
console.log(`captured: ${outPrefix}.{dom.html,pdf,png}`);
