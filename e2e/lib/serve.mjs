// serve.mjs — one localhost static server for the e2e instruments that drive a surface.
//
// Serves a tree over plain http on 127.0.0.1 at a free port, "/" → index.html, with the
// MIME types the surfaces need. Used by myspace-stranger.mjs; the older harnesses carry
// their own copies and can move here when their owners choose.
//
//   const { base, close } = await serveTree(ROOT);   // base = 'http://127.0.0.1:NNNNN'
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm',
};

export async function serveTree(root) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const body = await readFile(join(root, p));
      res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  const base = await new Promise(r => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`)));
  return { base, close: () => new Promise(r => server.close(() => r())) };
}
