#!/usr/bin/env node
/* vending-deck-local.mjs — run the value deck beside your own x0x daemon.

   WHY: the x0x daemon answers only pages served from a literal loopback
   origin (saorsa-labs/x0x src/server/auth.rs is_allowed_loopback_origin_str)
   and every route wants a bearer token. A page on skaists.dev can never ask
   it; a page served from http://127.0.0.1 can. This serves surfaces/ on
   loopback, zero dependencies, and — only when you name the daemon's
   durable token file — mints a ten-minute session token for the page at
   GET /x0x/session, so the page holds a short token in memory and never the
   durable one. Nothing is written anywhere; nothing is logged but the URL.

   One line:
     node scripts/vending-deck-local.mjs
   Flags:
     --port 8842                 loopback port to serve on
     --door http://127.0.0.1:12700   the daemon's api_address (ops/x0x/x0xd-laptop.toml)
     --token-file <path>         the daemon's data_dir/api-token; without it, paste a session token in the page
   Refuses loudly, never half-runs: a bad flag, a missing surfaces/, or a
   token file that cannot be read stops before the server starts. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

/* the checkout root is the server root, so the page sits at /surfaces/… exactly as
   it does on skaists.dev — the riders (tour.js, lang.js) resolve /surfaces/ by law */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; if (v === undefined || v.startsWith('--')) fail(name + ' needs a value'); return v; };
function fail(why) { process.stderr.write('vending-deck-local: ' + why + '\n'); process.exit(2); }
for (const a of args) if (a.startsWith('--') && !['--port', '--door', '--token-file'].includes(a)) fail('unknown flag ' + a);

const PORT = Number(flag('--port', '8842'));
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) fail('--port must be an integer between 1024 and 65535');
const DOOR = flag('--door', 'http://127.0.0.1:12700').replace(/\/+$/, '');
if (!/^http:\/\/(127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/.test(DOOR)) fail('--door must be a literal loopback address, e.g. http://127.0.0.1:12700');
const TOKEN_FILE = flag('--token-file', null);

try { if (!(await stat(join(ROOT, 'surfaces', 'vending-deck.html'))).isFile()) throw 0; } catch { fail('surfaces/vending-deck.html not found beside this script'); }
if (TOKEN_FILE) { try { const t = (await readFile(TOKEN_FILE, 'utf8')).trim(); if (!t) throw 0; } catch { fail('cannot read a token from ' + TOKEN_FILE); } }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };

/* mint a session from the durable token: the durable token is read at request time and never kept */
async function session(res) {
  if (!TOKEN_FILE) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"no token file named; paste a session token in the page"}'); }
  try {
    const durable = (await readFile(TOKEN_FILE, 'utf8')).trim();
    const r = await fetch(DOOR + '/auth/session', { method: 'POST', headers: { authorization: 'Bearer ' + durable }, signal: AbortSignal.timeout(8000) });
    const body = await r.text();
    res.writeHead(r.ok ? 200 : 502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(r.ok ? body : JSON.stringify({ error: 'the daemon refused to mint a session (' + r.status + ')' }));
  } catch (e) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'the daemon at ' + DOOR + ' is not answering' })); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (url.pathname.endsWith('/x0x/session')) return session(res);
  let p = decodeURIComponent(url.pathname);
  if (p === '/') { res.writeHead(302, { location: '/surfaces/vending-deck.html' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT) || /[\\/]\.git([\\/]|$)/.test(file)) { res.writeHead(403); return res.end(); }
  try {
    const s = await stat(file); if (!s.isFile()) throw 0;
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not here'); }
});
server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write('the value deck: http://127.0.0.1:' + PORT + '/surfaces/vending-deck.html\n');
  process.stdout.write('x0x door: ' + DOOR + (TOKEN_FILE ? ' · session minted from the named token file, never printed' : ' · no token file named; paste a session token in the page') + '\n');
});
