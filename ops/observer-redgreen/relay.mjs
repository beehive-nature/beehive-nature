// Minimal dummy buzz relay for the observer RED/GREEN harness.
// One TCP port serving both:
//   - HTTP: POST /query (NIP-98 unverified) answering channel discovery
//     (kind 39002 member + kind 39000 metadata), POST /count, GET /info (404 -> fail-open).
//   - WebSocket (hand-rolled RFC6455): AUTH challenge on open, OK-ack for AUTH
//     responses, REQ -> EOSE (+ one synthetic mention push on the harness's own
//     sub id), EVENT -> tally + OK.
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 19848);
const AGENT_PUBKEY = process.env.AGENT_PUBKEY || '';
const OUT = process.env.OUT || 'relay-out.json';
const CHANNEL = '11111111-2222-3333-4444-555555555555';

const tally = { reqs: [], events: [], http: [], ok_sent: 0, connections: 0 };
let pushedMention = false;

const ev = (kind, tags, content = '') => ({
  id: crypto.randomBytes(32).toString('hex'), pubkey: crypto.randomBytes(32).toString('hex'),
  created_at: Math.floor(Date.now() / 1000), kind, tags, content, sig: '00'.repeat(64),
});

function acceptKey(k) {
  return crypto.createHash('sha1').update(k + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

const server = net.createServer(sock => {
  sock.on('error', () => {});
  sock.once('data', buf => {
    const head = buf.toString('latin1');
    if (/upgrade:\s*websocket/i.test(head)) {
      const m = /sec-websocket-key: ([^\r\n]+)/i.exec(head);
      if (!m) { sock.destroy(); return; }
      const rest = head.includes('\r\n\r\n') ? buf.subarray(head.indexOf('\r\n\r\n') + 4) : Buffer.alloc(0);
      sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acceptKey(m[1].trim()) + '\r\n\r\n');
      handleWs(sock, rest);
    } else {
      handleHttp(sock, buf);
    }
  });
});

function httpResp(sock, code, body, ctype = 'application/json') {
  const b = Buffer.from(body);
  sock.write(`HTTP/1.1 ${code} OK\r\nContent-Type: ${ctype}\r\nContent-Length: ${b.length}\r\nConnection: close\r\n\r\n`);
  sock.write(b);
  setTimeout(() => { try { sock.destroy(); } catch {} }, 50);
}

function handleHttp(sock, initial) {
  let buf = Buffer.from(initial);
  const onData = d => {
    buf = Buffer.concat([buf, d]);
    const head = buf.toString('latin1');
    const cl = /content-length:\s*(\d+)/i.exec(head);
    const bodyStart = head.indexOf('\r\n\r\n') + 4;
    if (!cl || bodyStart + Number(cl[1]) > buf.length) return; // wait for full body
    sock.removeListener('data', onData);
    const body = buf.subarray(bodyStart, bodyStart + Number(cl[1])).toString('utf8');
    const path = (/^(\w+)\s+(\S+)/.exec(head) || [])[2] || '';
    tally.http.push({ path, bodyBytes: body.length });
    let filters = [];
    try { filters = JSON.parse(body); } catch {}
    const kinds = new Set(filters.flatMap(f => f.kinds || []));
    if (path === '/query') {
      if (kinds.has(39002)) return httpResp(sock, 200, JSON.stringify([ev(39002, [['p', AGENT_PUBKEY], ['d', CHANNEL]])]));
      if (kinds.has(39000)) return httpResp(sock, 200, JSON.stringify([ev(39000, [['d', CHANNEL], ['name', 'red-room'], ['description', 'harness room']])]));
      return httpResp(sock, 200, '[]');
    }
    if (path === '/count') return httpResp(sock, 200, '{"count":0}');
    if (path === '/events' || path === '/event') return httpResp(sock, 200, '{"ok":true}');
    return httpResp(sock, 404, '{"error":"not found"}', 'application/json');
  };
  sock.on('data', onData);
  onData(buf); // the whole request may already be in the first chunk
}

function handleWs(sock, initial) {
  let buf = Buffer.from(initial || Buffer.alloc(0));
  let acc = null;

  sock.on('data', d => { buf = Buffer.concat([buf, d]); let f; while ((f = parseFrame())) handleFrame(f); });
  sock.on('close', () => {});

  // NIP-42: the harness expects an AUTH challenge from the relay on connect
  sendText(JSON.stringify(['AUTH', 'dummy-challenge-' + crypto.randomBytes(16).toString('hex')]));

  function parseFrame() {
    if (buf.length < 2) return null;
    const fin = !!(buf[0] & 0x80), op = buf[0] & 0x0f, masked = !!(buf[1] & 0x80);
    let len = buf[1] & 0x7f, off = 2;
    if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    let mask = null;
    if (masked) { if (buf.length < off + 4) return null; mask = buf.subarray(off, off + 4); off += 4; }
    if (buf.length < off + len) return null;
    let payload = buf.subarray(off, off + len);
    if (mask) { const out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3]; payload = out; }
    buf = buf.subarray(off + len);
    return { fin, op, payload };
  }

  function sendText(str) {
    const p = Buffer.from(str);
    let hdr;
    if (p.length < 126) hdr = Buffer.from([0x81, p.length]);
    else if (p.length < 65536) { hdr = Buffer.alloc(4); hdr[0] = 0x81; hdr[1] = 126; hdr.writeUInt16BE(p.length, 2); }
    else { hdr = Buffer.alloc(10); hdr[0] = 0x81; hdr[1] = 127; hdr.writeBigUInt64BE(BigInt(p.length), 2); }
    sock.write(Buffer.concat([hdr, p]));
  }
  const sendMsg = arr => sendText(JSON.stringify(arr));

  function pushMention(text) {
    const e = ev(9, [['p', AGENT_PUBKEY], ['h', CHANNEL]], text);
    sendMsg(['EVENT', 'sub-trigger', e]);
  }

  function handleFrame({ fin, op, payload }) {
    if (op === 8) { try { sock.end(); } catch {} return; }
    if (op === 9) { const hdr = Buffer.from([0x8A, payload.length]); sock.write(Buffer.concat([hdr, payload])); return; }
    if (op === 1 || op === 0 || op === 2) {
      if (op !== 0) acc = { op, chunks: [payload] };
      else if (acc) acc.chunks.push(payload);
      if (acc && fin) {
        const full = Buffer.concat(acc.chunks); const wasText = acc.op === 1; acc = null;
        if (wasText) { try { handleJson(JSON.parse(full.toString('utf8'))); } catch {} }
      }
    }
  }

  function handleJson(m) {
    if (!Array.isArray(m)) return;
    const [type, a, b] = m;
    if (type === 'REQ') {
      tally.reqs.push({ sub: a, filters: (m.slice(2) || []).map(f => ({ kinds: f.kinds })) });
      const hasChat = (m.slice(2) || []).some(f => (f.kinds || []).includes(9));
      if (!pushedMention && hasChat && AGENT_PUBKEY) { pushedMention = true; pushMention('RED-TEST trigger mention — please respond'); }
      sendMsg(['EOSE', a]);
    } else if (type === 'EVENT') {
      const e = b ?? a;
      tally.events.push({
        kind: e?.kind, id: String(e?.id || '').slice(0, 8), pk: String(e?.pubkey || '').slice(0, 8),
        contentLen: e?.content?.length ?? 0, wireBytes: JSON.stringify(e).length,
        tagKinds: (e?.tags || []).map(t => t[0]), ts: new Date().toISOString(),
      });
      tally.ok_sent++;
      sendMsg(['OK', e?.id, true, '']);
    } else if (type === 'AUTH') {
      if (a && typeof a === 'object' && a.id) sendMsg(['OK', a.id, true, '']);
    } else if (type === 'CLOSE') { /* ignore */ }
  }
}

function dump() { try { fs.writeFileSync(OUT, JSON.stringify(tally, null, 1)); } catch {} }
setInterval(dump, 2000).unref();
process.on('SIGTERM', () => { dump(); process.exit(0); });
process.on('SIGINT', () => { dump(); process.exit(0); });
server.listen(PORT, '127.0.0.1', () => console.log('dummy-relay listening on', PORT));
