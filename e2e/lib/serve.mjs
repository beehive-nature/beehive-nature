// serve.mjs — one localhost static server for the e2e instruments that drive a surface.
//
// Serves a tree over plain http on 127.0.0.1 at a free port, with the MIME types the surfaces
// need. "/dir/" serves dir/index.html; "/dir" without the slash is redirected to "/dir/" so the
// page's relative links resolve where they would on a real host. Nothing outside the tree is
// served: the resolved and real path of every file must stay under the tree's real path, so
// encoded dots and symlinks that leave the tree both get a 404. Used by myspace-stranger.mjs;
// myspace-eternal.test.mjs, myspace-seam.mjs, fleet-bus.mjs and intake-daybucket.mjs still carry
// their own copies and can move here when their owners choose.
//
//   const { base, close } = await serveTree(ROOT);   // base = 'http://127.0.0.1:NNNNN'
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm',
};

export async function serveTree(root) {
  const top = await realpath(resolve(root));
  const inside = p => p === top || p.startsWith(top + sep);
  const server = createServer(async (req, res) => {
    try {
      const [rawPath, query] = req.url.split(/\?(.*)/s);
      const path = decodeURIComponent(rawPath);
      let file = resolve(join(top, path));
      if (!inside(file)) { res.writeHead(404); res.end('nf'); return; }
      if (path.endsWith('/')) file = join(file, 'index.html');
      else if ((await stat(file).catch(() => null))?.isDirectory()) { res.writeHead(301, { Location: rawPath + '/' + (query ? '?' + query : '') }); res.end(); return; } // the still-encoded path, query kept
      const real = await realpath(file); // a symlink pointing out of the tree is not served either
      if (!inside(real)) { res.writeHead(404); res.end('nf'); return; }
      const body = await readFile(real);
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  const base = await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`)); });
  return { base, close: () => new Promise(r => server.close(() => r())) };
}
