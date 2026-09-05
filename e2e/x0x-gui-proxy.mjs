// ONE-CHAR-FIX GUI receipt harness (lane x0x, 2026-09-05).
// The v0.41.2 embedded GUI ships a parse error (x0x-gui.html: `};` where `});`
// ends the peer-lifecycle addEventListener callback) that kills the whole script
// in every browser — GUI renders shell only. This proxy serves the daemon's own
// /gui HTML with EXACTLY that one character fixed (asserted: exactly 1 match),
// and reverse-proxies REST/SSE/WebSocket to the daemon untouched. Session-token
// auth path is entirely the daemon's. usage: node e2e/x0x-gui-proxy.mjs [port]
import http from 'node:http';
import { request as upstreamReq } from 'node:http';

const PORT = Number(process.argv[2] || 12799);
const TARGET = { host: '127.0.0.1', port: 12700 };
// the shipped defect: the peer-lifecycle addEventListener callback ends `};`
// instead of `});` — anchored by the onerror line that follows it (unique site)
const BROKEN = /removeChild\(out\.lastChild\);(\r?\n\s*)};(\r?\n\s*peerEventsSse\.onerror)/;
let patchedServed = false;

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/gui')) {
    const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const html = await fetchRaw('/gui' + q, req.headers);
    const hits = html.match(new RegExp(BROKEN.source, 'g')) || [];
    if (hits.length !== 1) { res.writeHead(500); res.end(`gui patch pattern found ${hits.length}x (need exactly 1) — upstream changed`); return; }
    const fixed = html.replace(BROKEN, 'removeChild(out.lastChild);$1});$2');
    patchedServed = true;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-x0x-gui': 'one-char-fix' });
    res.end(fixed);
    console.log(`[proxy] served PATCHED /gui (${fixed.length}B)`);
    return;
  }
  const up = upstreamReq({ ...TARGET, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:12700' } }, (ur) => {
    res.writeHead(ur.statusCode, ur.headers);
    ur.pipe(res);
  });
  up.on('error', () => { res.writeHead(502); res.end('upstream error'); });
  req.pipe(up);
});

server.on('upgrade', (req, socket, head) => {
  const up = upstreamReq({ ...TARGET, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:12700' } });
  up.on('upgrade', (ur, usock, uhead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n` + Object.entries(ur.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (uhead?.length) socket.write(uhead);
    usock.pipe(socket); socket.pipe(usock);
    usock.on('error', () => socket.destroy()); socket.on('error', () => usock.destroy());
  });
  up.on('error', () => socket.destroy());
  if (head?.length) up.write(head);
  up.end();
});

function fetchRaw(path, headers) {
  return new Promise((resolve, reject) => {
    const up = upstreamReq({ ...TARGET, path, method: 'GET', headers: { ...headers, host: '127.0.0.1:12700' } }, (ur) => {
      const chunks = []; ur.on('data', (c) => chunks.push(c)); ur.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    up.on('error', reject); up.end();
  });
}

server.listen(PORT, '127.0.0.1', () => console.log(`[proxy] one-char-fix GUI on http://127.0.0.1:${PORT} (daemon ${TARGET.host}:${TARGET.port})`));
