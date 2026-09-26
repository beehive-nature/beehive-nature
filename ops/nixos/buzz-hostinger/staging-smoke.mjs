// Only run against the isolated restore through a loopback SSH tunnel.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const base = new URL(process.env.BUZZ_STAGING_URL ?? 'http://127.0.0.1:33400');
assert.equal(base.hostname, '127.0.0.1', 'Only an explicit loopback staging tunnel is allowed');
assert.equal(base.port, '33400', 'Use the dedicated staging tunnel port');
assert.ok(process.env.BUZZ_DESKTOP_PACKAGE, 'Point BUZZ_DESKTOP_PACKAGE at the built desktop package.json');
const require = createRequire(process.env.BUZZ_DESKTOP_PACKAGE);
const { generateSecretKey, finalizeEvent } = require('nostr-tools/pure');
const sk = generateSecretKey();
const infoResponse = await fetch(new URL('/info', base));
assert.equal(infoResponse.status, 200);
const info = await infoResponse.json();
assert.equal(info.push.origin, 'wss://skaists.buzz');
console.log('PASS canonical relay identity');
const joinResponse = await fetch(new URL('/join.json', base));
assert.equal(joinResponse.status, 200);
const join = await joinResponse.json();
const channel = join.default_channel.id;
const code = new URL(join.invite_url, 'https://skaists.buzz').pathname.split('/').at(-1);
assert.ok(code && channel);
const body = JSON.stringify({ code });
const auth = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), content: '', tags: [
  ['u', 'https://skaists.buzz/api/invites/claim'], ['method', 'POST'],
  ['payload', createHash('sha256').update(body).digest('hex')], ['nonce', randomUUID()],
] }, sk);
const claim = await fetch(new URL('/api/invites/claim', base), { method: 'POST', body,
  headers: { 'Content-Type': 'application/json', Authorization: `Nostr ${Buffer.from(JSON.stringify(auth)).toString('base64')}` },
});
assert.equal(claim.status, 200, `Clone invite claim failed (${claim.status})`);
console.log('PASS invite claim in private clone');
// Optional isolated desktop canary identity. Caller supplies a restricted local
// directory; never print the secret or overwrite an existing identity file.
if (process.env.BUZZ_CANARY_KEY_FILE) {
  await writeFile(process.env.BUZZ_CANARY_KEY_FILE, Buffer.from(sk).toString('hex'), { flag: 'wx', mode: 0o600 });
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const pngHash = createHash('sha256').update(png).digest('hex');
const uploadAuth = finalizeEvent({ kind: 24242, created_at: Math.floor(Date.now() / 1000),
  content: 'Upload a tiny private migration test image', tags: [
    ['t', 'upload'], ['x', pngHash], ['server', 'skaists.buzz'],
    ['expiration', String(Math.floor(Date.now() / 1000) + 120)],
  ] }, sk);
const upload = await fetch(new URL('/upload', base), { method: 'PUT', body: png, headers: {
  'Content-Type': 'image/png', 'X-SHA-256': pngHash,
  Authorization: `Nostr ${Buffer.from(JSON.stringify(uploadAuth)).toString('base64')}`,
} });
assert.ok(upload.ok, `Private clone upload failed (${upload.status}): ${(await upload.clone().text()).slice(0, 180)}`);
const blob = await upload.json();
const blobUrl = new URL(blob.url);
const anonymousRead = await fetch(new URL(blobUrl.pathname, base));
assert.equal(anonymousRead.status, 401, 'Private media must reject anonymous reads');
const readAuth = finalizeEvent({ kind: 24242, created_at: Math.floor(Date.now() / 1000),
  content: 'Read the private migration test image', tags: [
    ['t', 'get'], ['x', blob.sha256], ['server', 'skaists.buzz'],
    ['expiration', String(Math.floor(Date.now() / 1000) + 120)],
  ] }, sk);
const downloaded = await fetch(new URL(blobUrl.pathname, base), { headers: {
  Authorization: `Nostr ${Buffer.from(JSON.stringify(readAuth)).toString('base64')}`,
} });
assert.equal(downloaded.status, 200);
assert.equal(createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex'), blob.sha256);
console.log('PASS authenticated image upload and hash-verified retrieval');

await new Promise((resolve, reject) => {
  const ws = new WebSocket(base.toString().replace(/^http/, 'ws'));
  const timeout = setTimeout(() => finish(new Error('WebSocket flow timed out')), 20000);
  let authId, messageId, acknowledged = false, echoed = false, completed = false;
  function finish(error) {
    if (completed) return;
    completed = true;
    clearTimeout(timeout);
    ws.close();
    error ? reject(error) : resolve();
  }
  ws.addEventListener('error', () => finish(new Error('WebSocket transport failed')));
  ws.addEventListener('message', ({ data }) => {
    try {
      const m = JSON.parse(String(data));
      if (m[0] === 'AUTH') {
        const event = finalizeEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000),
          content: '', tags: [['relay', 'wss://skaists.buzz'], ['challenge', m[1]]] }, sk);
        authId = event.id;
        ws.send(JSON.stringify(['AUTH', event]));
      } else if (m[0] === 'OK' && m[1] === authId) {
        assert.equal(m[2], true, 'NIP-42 authentication refused');
        console.log('PASS NIP-42 authentication');
        ws.send(JSON.stringify(['REQ', 'migration-probe', { kinds: [9], '#h': [channel], limit: 3 }]));
      } else if (m[0] === 'EOSE' && m[1] === 'migration-probe') {
        console.log('PASS room history read');
        const event = finalizeEvent({ kind: 9, created_at: Math.floor(Date.now() / 1000),
          content: `Private migration staging probe ${randomUUID()}`, tags: [['h', channel]] }, sk);
        messageId = event.id;
        ws.send(JSON.stringify(['EVENT', event]));
      } else if (m[0] === 'OK' && m[1] === messageId) {
        assert.equal(m[2], true, 'Staging message refused');
        acknowledged = true;
      } else if (m[0] === 'EVENT' && m[1] === 'migration-probe' && m[2]?.id === messageId) {
        echoed = true;
      } else if (m[0] === 'CLOSED' && m[1] === 'migration-probe') {
        throw new Error('Authenticated room subscription closed');
      }
      if (acknowledged && echoed) {
        console.log('PASS message persistence acknowledgment and live echo');
        finish();
      }
    } catch (error) { finish(error); }
  });
});
