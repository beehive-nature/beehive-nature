// serve.mjs — one localhost static server for the e2e instruments that drive a surface.
//
// Serves a tree over plain http on 127.0.0.1 at a free port, streamed (never a whole file in
// memory), with the MIME types the surfaces use. "/dir/" serves dir/index.html; "/dir" without
// the slash is redirected (302, never cached) to "/dir/" so the page's relative links resolve
// where they would on a real host. Nothing outside the tree is served: the resolved and real
// path of every file must stay under the tree's real path, so encoded dots and symlinks that
// leave the tree both get a 404. Every file is opened before it is answered and its size read
// from that open handle, and the body is bounded to that size, so the headers and the body come
// from one snapshot; a failure after the headers destroys the socket (a browser reports a failed
// load, never a good 200). A missing path is 404; any other fault (EACCES, EMFILE, EIO) is 500 and
// written to stderr, so a harness never mistakes a server fault for a missing file. Only GET and
// HEAD are served: anything else is 405 and written to stderr. Used by myspace-stranger.mjs and myspace-seam.mjs. The other harnesses
// under e2e/ that open their own server (184 files on 2026-09-29, `grep -l createServer
// e2e/*.mjs | wc -l`), myspace-eternal.test.mjs (CI-gated) among them, still carry their own
// copies; each can move here when its owner chooses.
//
//   const { base, close } = await serveTree(ROOT);   // base = 'http://127.0.0.1:NNNNN'
import { createServer } from 'node:http';
import { pipeline } from 'node:stream';
import { realpath, open } from 'node:fs/promises';
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

const notFound = res => { if (!res.headersSent) { res.writeHead(404); res.end('nf'); } else res.destroy(); };
const serverError = (res, e) => { process.stderr.write(`serve: ${e?.code || e?.message || e}\n`); if (!res.headersSent) { res.writeHead(500); res.end('err'); } else res.destroy(); };
const missing = e => e?.code === 'ENOENT' || e?.code === 'ENOTDIR' || e instanceof URIError; // a path the tree does not have (or one that does not decode)
// a directory: its index when the slash is there (the caller appended index.html, so reaching here means no index), else a redirect to the slash form
const directory = (res, path, rawPath, query) => { if (path.endsWith('/')) notFound(res); else { res.writeHead(302, { Location: rawPath + '/' + (query ? '?' + query : ''), 'Cache-Control': 'no-store' }); res.end(); } };
// the stream owns the file handle and closes it; a client that goes away mid-body destroys the stream too
const send = (stream, res) => pipeline(stream, res, () => {});

export async function serveTree(root) {
  const top = await realpath(resolve(root));
  const inside = p => p === top || p.startsWith(top + sep);
  const server = createServer(async (req, res) => {
    let fh = null; // the open file handle, closed on every path that does not hand it to a stream
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { process.stderr.write(`serve: ${req.method} ${req.url} refused (405)\n`); res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      const [rawPathIn, query] = req.url.split(/\?(.*)/s);
      const rawPath = rawPathIn.replace(/^\/+/, '/'); // "//dir" would otherwise redirect off the origin (protocol-relative)
      const path = decodeURIComponent(rawPath);
      let file = resolve(join(top, path));
      if (!inside(file)) return notFound(res);
      if (path.endsWith('/')) file = join(file, 'index.html');
      const real = await realpath(file); // a symlink pointing out of the tree is not served either
      if (!inside(real)) return notFound(res);
      try { fh = await open(real, 'r'); } catch (e) { if (e.code === 'EISDIR') return directory(res, path, rawPath, query); throw e; }
      const st = await fh.stat();
      if (st.isDirectory()) { await fh.close(); fh = null; return directory(res, path, rawPath, query); }
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
      if (req.method === 'HEAD') { await fh.close(); fh = null; res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); res.end(); return; } // the headers, no read of the body
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) { // Range honoured so <audio>/<video> can seek
        const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        if (start > end || start >= st.size) { await fh.close(); fh = null; res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
        res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
        const s = fh.createReadStream({ start, end }); fh = null; return send(s, res); // the stream owns the handle from here
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      if (st.size === 0) { await fh.close(); fh = null; res.end(); return; } // an empty file: no stream (a bound of [0, -1] would read one byte if the file grew)
      const s = fh.createReadStream({ start: 0, end: st.size - 1 }); fh = null; send(s, res); // bounded to the size the header promised
    } catch (e) { if (fh) fh.close().catch(() => {}); if (missing(e)) notFound(res); else serverError(res, e); }
  });
  const base = await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`)); });
  return { base, close: () => new Promise(r => server.close(() => r())) };
}
