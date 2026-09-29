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
// written to stderr, so a harness never mistakes a server fault for a missing file; a read fault
// after the headers, or a body that comes up short of the promised length (the file shrank under
// the read), destroys the socket and is written to stderr too, a client that went away is not.
// Only GET and HEAD are served: anything else is 405 and written to stderr. offBox(url, base) is
// the one rule for "a request that left this server" (the URL's origin is not the base; an
// unparseable URL counts as left), shared by the gates so they cannot disagree. The harnesses
// under e2e/ that still open their own server (`grep -l createServer e2e/*.mjs`) can move here
// when their owners choose.
//
//   const { base, close } = await serveTree(ROOT);   // base = 'http://127.0.0.1:NNNNN'
import { createServer } from 'node:http';
import { pipeline, Transform } from 'node:stream';
import { realpath, open } from 'node:fs/promises';
import { join, extname, resolve, relative, sep } from 'node:path';

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
export const offBox = (url, base) => { try { return new URL(url).origin !== base; } catch { return true; } };
// a directory: its index when the slash is there (the caller appended index.html, so reaching here means no index), else a redirect to the slash
// form. The Location is built from the resolved path inside the tree, never from the request's own text, so no spelling of the request
// ("//dir", "/\\dir" on Windows) can redirect off the origin
const directory = (res, path, top, file, query) => { if (path.endsWith('/')) notFound(res); else { const loc = '/' + relative(top, file).split(sep).filter(Boolean).map(encodeURIComponent).join('/') + '/'; res.writeHead(302, { Location: loc + (query ? '?' + query : ''), 'Cache-Control': 'no-store' }); res.end(); } };
// the stream owns the file handle and closes it; a client that goes away mid-body destroys the stream too.
// The body is counted against the length the headers promised: a short one (the file shrank between the stat
// and the read) is an error, so the socket is destroyed rather than left open for the client to wait on.
const bounded = n => { let seen = 0; return new Transform({ transform(c, _, cb) { seen += c.length; cb(null, c); }, flush(cb) { cb(seen === n ? null : Object.assign(new Error(`short body: ${seen} of ${n} bytes`), { code: 'ESHORT' })); } }); };
const gone = e => e?.code === 'ERR_STREAM_PREMATURE_CLOSE' || e?.code === 'ECONNRESET' || e?.code === 'EPIPE'; // the client left; not a fault of the server
const send = (stream, res, n) => pipeline(stream, bounded(n), res, e => { if (e && !gone(e)) process.stderr.write(`serve: ${e.code || e.message} after the headers\n`); });

export async function serveTree(root) {
  const top = await realpath(resolve(root));
  const inside = p => p === top || p.startsWith(top + sep);
  const server = createServer(async (req, res) => {
    let fh = null; // the open file handle, closed on every path that does not hand it to a stream
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { process.stderr.write(`serve: ${req.method} ${req.url} refused (405)\n`); res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      const [rawPathIn, query] = req.url.split(/\?(.*)/s);
      const rawPath = rawPathIn.replace(/^[\/\\]+/, '/'); // leading slashes (either kind) collapse to one
      const path = decodeURIComponent(rawPath);
      if (path.includes('\0')) return notFound(res); // no path in the tree has a NUL in it (realpath would throw ERR_INVALID_ARG_VALUE: a fault it is not)
      let file = resolve(join(top, path));
      if (!inside(file)) return notFound(res);
      if (path.endsWith('/')) file = join(file, 'index.html');
      const real = await realpath(file); // a symlink pointing out of the tree is not served either
      if (!inside(real)) return notFound(res);
      try { fh = await open(real, 'r'); } catch (e) { if (e.code === 'EISDIR') return directory(res, path, top, file, query); throw e; }
      const st = await fh.stat();
      if (st.isDirectory()) { await fh.close(); fh = null; return directory(res, path, top, file, query); }
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
      if (req.method === 'HEAD') { await fh.close(); fh = null; res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); res.end(); return; } // the headers, no read of the body
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      // Range honoured so <audio>/<video> can seek: a start past the end is 416; a range whose start is after its end is not
      // a range at all (RFC 9110 §14.2: the field is ignored) and the whole file is answered below
      if (m && (m[1] || m[2])) {
        const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        if (start >= st.size) { await fh.close(); fh = null; res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
        if (start <= end) {
        res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
        const s = fh.createReadStream({ start, end }); fh = null; return send(s, res, end - start + 1); // the stream owns the handle from here
        }
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      if (st.size === 0) { await fh.close(); fh = null; res.end(); return; } // an empty file: no stream (a bound of [0, -1] would read one byte if the file grew)
      const s = fh.createReadStream({ start: 0, end: st.size - 1 }); fh = null; send(s, res, st.size); // bounded to the size the header promised
    } catch (e) { if (fh) fh.close().catch(() => {}); if (missing(e)) notFound(res); else serverError(res, e); }
  });
  const base = await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`)); });
  server.on('error', e => process.stderr.write(`serve: ${e.code || e.message}\n`)); // an accept-time error (EMFILE) is written down, never an uncaught throw that kills the gate
  // close() resolves once the listener is gone: connections still open (a body a client left paused) are cut, so a
  // caller that awaits it never waits on a client
  return { base, close: () => new Promise(r => { server.close(() => r()); server.closeAllConnections(); }) };
}
