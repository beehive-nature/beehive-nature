// Scoped local host for a prepared working edition (skaists.preservation-local/1).
// SERVES FROM A VERIFIED IMMUTABLE SNAPSHOT, never from the package paths:
// at startup every declared file is checked (regular file, no symlinks), then
// streamed once — hashed while copied — into a private mode-0700 snapshot
// directory under the OS temp dir. Requests are answered only from that
// snapshot, so a file changed, replaced, symlinked or deleted in the package
// after startup cannot alter or crash what is served. Per-request filesystem
// errors are contained (500, host stays up). Loopback only; no listing; no
// writes anywhere outside the snapshot; snapshot removed on server close.
//
//   node tools/genealogy/serve-local.mjs <package-dir> [port]   # default 8790
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import {
  openSync, closeSync, readSync, writeSync, fstatSync, readFileSync,
  existsSync, mkdirSync, rmSync, lstatSync, mkdtempSync,
} from 'node:fs';
import { join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { posixNormalize } from './serve-local-util.mjs';

const DEFAULT_PORT = 8790;
const READ_CHUNK = 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
};

// Open a declared package member: it must exist as a REGULAR FILE (not a
// symlink — O_NOFOLLOW where the platform has it, plus an lstat identity
// check), and the opened descriptor must still describe that same regular
// file when it reaches us.
function openRegular(path) {
  const st = lstatSync(path);
  if (!st.isFile()) throw new Error('declared package member is not a regular file: ' + path);
  const fd = openSync(path, 'r'); // O_RDONLY
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== st.dev || opened.ino !== st.ino)
      throw new Error('declared package member changed shape while opening: ' + path);
    return { fd, size: opened.size };
  } catch (e) { closeSync(fd); throw e; }
}

export function verifyPackage(root, { snapshotRoot } = {}) {
  const manifestPath = join(root, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error('no package manifest.json at ' + root);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest?.schema !== 'skaists.preservation-local/1')
    throw new Error('refusing to serve ' + (manifest?.schema || 'an unlabelled directory') + ': this host serves local working editions only');
  const files = manifest.files;
  if (!files || typeof files !== 'object') throw new Error('package manifest has no files map');
  const declaredTotal = Object.values(files).reduce((a, m) => a + m.bytes, 0);
  if (manifest.totalBytes !== declaredTotal) throw new Error('manifest totalBytes disagrees with its declared files');
  const hashOf = (v) => createHash('sha256').update(Buffer.from(JSON.stringify(v))).digest('hex');
  if (manifest.manifestSha256 !== hashOf(files)) throw new Error('manifestSha256 disagrees with its files map');

  const snap = mkdtempSync(join(snapshotRoot || tmpdir(), 'skaists-edition-'));
  try { mkdirSync(snap, { recursive: true }); } catch { /* mkdtemp created it */ }
  // a private snapshot directory only this process writes
  const served = new Map();
  try {
    for (const [rel, meta] of Object.entries(files)) {
      if (typeof rel !== 'string' || rel.includes('..') || rel.startsWith('/') || rel.startsWith('\\') || posixNormalize(rel) !== rel)
        throw new Error('unsafe declared path: ' + rel);
      const { fd, size } = openRegular(join(root, rel));
      const snapPath = join(snap, rel.replace(/[\\/]/g, '\u2044')); // one flat, opaque name per member
      let snapFd = -1;
      try {
        if (size !== meta.bytes) throw new Error('declared size disagrees for ' + rel);
        snapFd = openSync(snapPath, 'wx'); // create, refuse existing
        const hash = createHash('sha256');
        const buf = Buffer.alloc(Math.min(READ_CHUNK, size));
        let at = 0;
        while (at < size) {
          const n = readSync(fd, buf, 0, Math.min(buf.length, size - at), at);
          if (n <= 0) throw new Error('short read for ' + rel);
          hash.update(buf.subarray(0, n));
          writeSync(snapFd, buf.subarray(0, n));
          at += n;
        }
        const digest = hash.digest('hex');
        if (digest !== meta.sha256) throw new Error('declared digest disagrees for ' + rel);
        closeSync(snapFd); snapFd = -1;
        served.set(rel, { snapPath, bytes: size, sha256: digest, mediaType: MIME[extname(rel).toLowerCase()] || 'application/octet-stream' });
      } catch (e) {
        if (snapFd >= 0) { try { closeSync(snapFd); } catch {} }
        throw e;
      } finally { closeSync(fd); }
    }
  } catch (e) {
    rmSync(snap, { recursive: true, force: true });
    throw e;
  }
  return { manifest, served, snapshotDir: snap, files: served.size, totalBytes: declaredTotal };
}

export function createLocalEditionHost({ root, verify = verifyPackage, host = '127.0.0.1' } = {}) {
  if (typeof root !== 'string' || !root) throw new Error('a package directory is required');
  const { manifest, served, snapshotDir, files, totalBytes } = verify(root);
  let closed = false;
  const server = createServer((req, res) => {
    const refuse = (status, why) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(why); };
    const hostHeader = String(req.headers.host || '');
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(hostHeader)) return refuse(403, 'this host serves the loopback desktop only');
    const url = (req.url || '/').split('?')[0].split('#')[0];
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ service: 'skaists-local-edition', schema: manifest.schema, files, totalBytes }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return refuse(405, 'GET and HEAD only');
    let rel;
    try { rel = decodeURIComponent(url === '/' ? 'surfaces/blood.html' : url.replace(/^\/+/, '')); }
    catch { return refuse(404, 'not a declared package file'); }
    if (rel.includes('..') || posixNormalize(rel) !== rel || rel.startsWith(sep)) return refuse(404, 'not a declared package file');
    const entry = served.get(rel);
    if (!entry) return refuse(404, 'not a declared package file');
    res.writeHead(200, { 'Content-Type': entry.mediaType, 'Content-Length': String(entry.bytes), 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    // every byte served comes from the verified immutable snapshot; a
    // contained read error answers 500 and never kills the host
    let fd = -1;
    try {
      fd = openSync(entry.snapPath, 'r');
      const st = fstatSync(fd);
      if (st.size !== entry.bytes) throw new Error('snapshot member changed size');
      const buf = Buffer.alloc(Math.min(READ_CHUNK, entry.bytes));
      let at = 0;
      const pump = () => {
        let want = Math.min(buf.length, entry.bytes - at);
        if (want <= 0) { closeSync(fd); return res.end(); }
        const n = readSync(fd, buf, 0, want, at);
        if (n <= 0) throw new Error('short snapshot read');
        at += n;
        res.write(buf.subarray(0, n), pump);
      };
      pump();
    } catch (e) {
      if (fd >= 0) { try { closeSync(fd); } catch {} }
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.destroy();
    }
  });
  server.on('close', () => {
    if (closed) return;
    closed = true;
    rmSync(snapshotDir, { recursive: true, force: true });
  });
  return Object.assign(server, { package: { schema: manifest.schema, files, totalBytes, manifestSha256: manifest.manifestSha256 }, snapshotDir });
}

if (process.argv[1] && process.argv[1].endsWith('serve-local.mjs') && process.argv[2]) {
  const [root, portArg] = [process.argv[2], process.argv[3]];
  const port = Number(portArg || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.error('port must be 1024-65535'); process.exit(1); }
  const server = createLocalEditionHost({ root });
  server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ status: 'serving', url: 'http://127.0.0.1:' + port + '/', ...server.package }));
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('exit', () => { try { rmSync(server.snapshotDir, { recursive: true, force: true }); } catch {} });
}
