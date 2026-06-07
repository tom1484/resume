// Minimal static file server for the built app, used by the capture and
// print-pdf scripts.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json', '.txt': 'text/plain',
};

// Serves `buildDir` on an ephemeral port; returns { port, close }.
export async function serveStatic(buildDir) {
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
  return { port: server.address().port, close: () => server.close() };
}
