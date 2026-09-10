import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { checkedEvent, tag, hash, encode, parse, requireThat, now, LIMITS } from './core.mjs';

function failure(err) { return { error: err.status ? err.message : 'internal-error' }; }
function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(encode(value));
}
const SOCKET_OUTPUT_LIMIT = 128 * 1024;
function sendFrame(ws, value) {
  if (ws.readyState !== 1) return false;
  // Buffer payloads make the underlying writable queue count actual UTF-8
  // bytes. Queued strings can be counted in code units instead by the stream.
  const frame = encode(value);
  // Include this frame before enqueueing it, including up to ten bytes of
  // unmasked server framing. The close control frame has a separate fixed cap.
  if (ws.bufferedAmount + frame.length + 10 > SOCKET_OUTPUT_LIMIT) {
    ws.close(1008, 'consumer-lag'); return false;
  }
  ws.send(frame, { binary: false });
  return true;
}
async function body(request, max) {
  requireThat(!request.headers['content-length'] || Number(request.headers['content-length']) <= max, 'body-limit', 413);
  const chunks = []; let total = 0;
  for await (const chunk of request) {
    total += chunk.length; requireThat(total <= max, 'body-limit', 413); chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// A protocol subset for the isolated experiment, bound to loopback only. It does
// not advertise support for the entire Buzz application or unimplemented NIPs.
export async function startGateway(channel) {
  const seen = new Map();
  const sockets = new Set();
  let inFlight = 0;
  const wsOrigin = channel.policy.origin.replace(/^https:/, 'wss:');
  function authenticate(request, route, bytes) {
    const header = request.headers.authorization;
    requireThat(typeof header === 'string' && header.startsWith('Nostr ') && header.length <= 24000, 'authentication-required', 401);
    const event = checkedEvent(parse(Buffer.from(header.slice(6), 'base64'), LIMITS.event));
    const blossomGet = event.kind === 24242 && request.method === 'GET' && route.startsWith('/media/');
    if (blossomGet) {
      // Blossom GET tokens are reusable by design, unlike NIP-98 request events.
      requireThat(tag(event, 't') === 'get' && tag(event, 'server') === new URL(channel.policy.origin).host
        && /^\d+$/.test(tag(event, 'expiration')) && Number(tag(event, 'expiration')) > now()
        && Number(tag(event, 'expiration')) <= now() + 600 && event.created_at <= now() + 60, 'invalid-blossom-auth', 401);
    } else {
      requireThat(event.kind === 27235 && event.content === '' && Math.abs(now() - event.created_at) <= 60
        && tag(event, 'u') === channel.policy.origin + route && tag(event, 'method') === request.method
        && tag(event, 'payload') === hash(bytes), 'invalid-http-auth', 401);
    }
    // Reject nonmembers and expired policy before inspecting or mutating shared
    // replay state: an outsider must not consume a member's admission capacity.
    channel.authorize(event.pubkey);
    if (!blossomGet) {
      for (const [id, expiry] of seen) if (expiry < now()) seen.delete(id);
      requireThat(!seen.has(event.id), 'auth-replay', 401);
      requireThat(seen.size < 1024, 'auth-capacity', 429);
      seen.set(event.id, event.created_at + 61);
    }
    return event.pubkey;
  }
  const server = createServer(async (request, response) => {
    if (inFlight >= 8) return json(response, 429, { error: 'request-capacity' });
    inFlight++;
    try {
      requireThat(request.headers.host === `127.0.0.1:${server.address().port}`, 'unknown-host', 404);
      const route = request.url;
      if (request.method === 'GET' && route === '/info') return json(response, 200,
        { name: 'BNR isolated channel experiment', supported_nips: [], push: { origin: wsOrigin }, experimental: true });
      requireThat((request.method === 'POST' && ['/events', '/query'].includes(route))
        || (request.method === 'PUT' && route === '/media/upload')
        || (request.method === 'GET' && /^\/media\/[a-f0-9]{64}$/.test(route)), 'unsupported-route', 404);
      const bytes = await body(request, route === '/media/upload' ? LIMITS.file : LIMITS.event);
      const pubkey = authenticate(request, route, bytes);
      if (route === '/events') return json(response, 200, await channel.publish(pubkey, parse(bytes, LIMITS.event)));
      if (route === '/query') {
        if (channel.pin) response.setHeader('x-bnr-checkpoint', JSON.stringify(channel.pin));
        return json(response, 200, channel.query(pubkey, parse(bytes, LIMITS.event)));
      }
      if (route === '/media/upload') return json(response, 200, await channel.upload(pubkey, bytes));
      const file = channel.download(pubkey, route.slice('/media/'.length));
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': file.length,
        'cache-control': 'no-store', 'content-disposition': 'attachment' }); response.end(file);
    } catch (err) { if (!response.headersSent) json(response, err.status ?? 500, failure(err)); }
    finally { inFlight--; }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.maxConnections = 16;
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.event, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/' || request.headers.host !== `127.0.0.1:${server.address().port}` || sockets.size >= 8) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    const session = { ws, pubkey: null, subscriptions: new Map(), challenge: randomBytes(24).toString('hex'), pending: false };
    sockets.add(session);
    const deadline = setTimeout(() => ws.close(1008, 'authentication-required'), 10000);
    sendFrame(ws, ['AUTH', session.challenge]);
    ws.on('error', () => {});
    ws.on('close', () => { clearTimeout(deadline); sockets.delete(session); });
    ws.on('message', async raw => {
      let frame; let acquired = false;
      try {
        requireThat(!session.pending, 'operation-in-progress', 409);
        session.pending = true; acquired = true;
        frame = parse(raw, LIMITS.event);
        requireThat(Array.isArray(frame), 'invalid-frame');
        if (frame[0] === 'AUTH') {
          requireThat(!session.pubkey && frame.length === 2, 'invalid-auth', 401);
          const e = checkedEvent(frame[1]);
          requireThat(e.kind === 22242 && e.content === '' && Math.abs(now() - e.created_at) <= 60
            && tag(e, 'relay') === wsOrigin && tag(e, 'challenge') === session.challenge, 'invalid-ws-auth', 401);
          channel.authorize(e.pubkey); session.pubkey = e.pubkey; clearTimeout(deadline);
          sendFrame(ws, ['OK', e.id, true, 'authenticated']); return;
        }
        requireThat(session.pubkey, 'authentication-required', 401);
        channel.authorize(session.pubkey);
        if (frame[0] === 'REQ') {
          requireThat(typeof frame[1] === 'string' && frame[1].length <= 64 && frame.length >= 3
            && (session.subscriptions.has(frame[1]) || session.subscriptions.size < 4), 'subscription-limit');
          const filters = frame.slice(2); const events = channel.query(session.pubkey, filters);
          const sub = { filters, sent: new Set() };
          session.subscriptions.set(frame[1], sub);
          for (const e of events) {
            if (!sendFrame(ws, ['EVENT', frame[1], e])) return;
            sub.sent.add(e.id);
          }
          sendFrame(ws, ['EOSE', frame[1]]); return;
        }
        if (frame[0] === 'CLOSE' && frame.length === 2) { session.subscriptions.delete(frame[1]); return; }
        if (frame[0] === 'EVENT' && frame.length === 2) {
          const result = await channel.publish(session.pubkey, frame[1]);
          sendFrame(ws, ['OK', result.event_id, true, 'stored and read back']); return;
        }
        requireThat(false, 'unsupported-frame');
      } catch (err) {
        sendFrame(ws, ['NOTICE', failure(err).error]);
      } finally { if (acquired) session.pending = false; }
    });
  });
  const notify = () => {
    for (const session of sockets) {
      if (!session.pubkey || session.ws.readyState !== 1) continue;
      try {
        channel.authorize(session.pubkey);
        for (const [id, sub] of session.subscriptions) {
          if (session.ws.readyState !== 1) break;
          for (const event of channel.query(session.pubkey, sub.filters)) {
            if (sub.sent.has(event.id)) continue;
            if (!sendFrame(session.ws, ['EVENT', id, event])) break;
            sub.sent.add(event.id);
          }
        }
      } catch { session.ws.close(1008, 'authorization-ended'); }
    }
  };
  channel.on('committed', notify);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, wsUrl: `ws://127.0.0.1:${server.address().port}`,
    async close() {
      channel.off('committed', notify);
      for (const s of sockets) s.ws.terminate();
      await new Promise(resolve => wss.close(resolve));
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    } };
}
