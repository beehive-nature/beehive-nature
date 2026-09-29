// serve.mjs — one localhost static server for the e2e instruments that drive a surface.
//
// Serves a tree over plain http on 127.0.0.1 at a free port, streamed (never a whole file in
// memory), with the MIME types the surfaces use. "/dir/" serves dir/index.html; "/dir" without
// the slash is redirected (302, never cached) to "/dir/" so the page's relative links resolve
// where they would on a real host. Nothing outside the tree is served: the resolved and real
// path of every file must stay under the tree's real path, so encoded dots and symlinks that
// leave the tree both get a 404. Used by myspace-stranger.mjs and myspace-seam.mjs. The other
// harnesses under e2e/ that open their own server (184 files on 2026-09-29,
// `grep -l createServer e2e/*.mjs | wc -l`), myspace-eternal.test.mjs (CI-gated) among them,
// still carry their own copies; each can move here when its owner chooses.
//
//   const { base, close } = await serveTree(ROOT);   // base = 'http://127.0.0.1:NNNNN'
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.zip': 'application/zip',
};

export async function serveTree(root) {
  const top = await realpath(resolve(root));
  const inside = p => p === top || p.startsWith(top + sep);
  const server = createServer(async (req, res) => {
    try {
      const [rawPathIn, query] = req.url.split(/\?(.*)/s);
      const rawPath = rawPathIn.replace(/^\/+/, '/'); // "//dir" would otherwise redirect off the origin (protocol-relative)
      const path = decodeURIComponent(rawPath);
      let file = resolve(join(top, path));
      if (!inside(file)) { res.writeHead(404); res.end('nf'); return; }
      if (path.endsWith('/')) file = join(file, 'index.html');
      const real = await realpath(file); // a symlink pointing out of the tree is not served either
      if (!inside(real)) { res.writeHead(404); res.end('nf'); return; }
      const st = await stat(real);
      if (st.isDirectory()) { if (path.endsWith('/')) { res.writeHead(404); res.end('nf'); } else { res.writeHead(302, { Location: rawPath + '/' + (query ? '?' + query : '') }); res.end(); } return; }
      // streamed, with Range honoured so <audio>/<video> can seek
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
        res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
        createReadStream(real, { start, end }).pipe(res); return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      createReadStream(real).pipe(res);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  const base = await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`)); });
  return { base, close: () => new Promise(r => server.close(() => r())) };
}
