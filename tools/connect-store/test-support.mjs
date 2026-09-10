import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import WebSocket from 'ws';
import { Channel, signed, hash, now } from './core.mjs';
import { DirectoryStore } from './adapters.mjs';

export async function fixture() {
  const owner = generateSecretKey(), writer = generateSecretKey();
  const alice = generateSecretKey(), bob = generateSecretKey(), outsider = generateSecretKey();
  const root = await mkdtemp(path.join(os.tmpdir(), 'bnr-connect-store-'));
  const channel = `canary-${randomUUID()}`;
  const policy = signed(owner, 30078, [['d', 'bnr-channel-policy-v1']], JSON.stringify({
    version: 1, channel, origin: 'https://isolated-channel.invalid',
    members: [getPublicKey(alice), getPublicKey(bob)], writer: getPublicKey(writer), expires_at: now() + 3600,
  }));
  const config = { policy, owner: getPublicKey(owner), policyId: policy.id, key: randomBytes(32),
    writer, store: new DirectoryStore(root) };
  return { owner, writer, alice, bob, outsider, config, root, channel,
    create: overrides => new Channel({ ...config, ...overrides }),
    message(key, content = 'isolated test message', tags = [], time = now()) {
      return signed(key, 9, [['h', channel], ...tags], content, time);
    },
    async close() {
      const resolved = path.resolve(root);
      if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('bnr-connect-store-')) throw new Error('unsafe-test-cleanup');
      await rm(resolved, { recursive: true, force: true });
    },
  };
}
export function authorization(key, method, url, bytes = Buffer.alloc(0)) {
  const event = signed(key, 27235, [['u', url], ['method', method], ['payload', hash(bytes)], ['nonce', randomUUID()]], '');
  return `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
}
export async function request(gateway, key, origin, route, value, method = 'POST', header) {
  const bytes = value === undefined ? Buffer.alloc(0) : Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  return fetch(gateway.url + route, { method, headers: { authorization: header ?? authorization(key, method, origin + route, bytes),
    'content-type': 'application/json' }, body: method === 'GET' ? undefined : bytes, signal: AbortSignal.timeout(5000) });
}
export async function socket(gateway) {
  const ws = new WebSocket(gateway.wsUrl);
  const queue = []; const pending = [];
  ws.on('message', raw => {
    const value = JSON.parse(raw);
    const index = pending.findIndex(p => p.predicate(value));
    if (index >= 0) { const [p] = pending.splice(index, 1); clearTimeout(p.timer); p.resolve(value); }
    else queue.push(value);
  });
  ws.on('error', () => {});
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return { ws, send: value => ws.send(JSON.stringify(value)),
    next(predicate = () => true) {
      const index = queue.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const p = { predicate, resolve, timer: null };
        p.timer = setTimeout(() => { pending.splice(pending.indexOf(p), 1); reject(new Error('socket-test-timeout')); }, 3000);
        pending.push(p);
      });
    },
    async authenticate(key, origin) {
      const challenge = await this.next(v => v[0] === 'AUTH');
      const event = signed(key, 22242, [['relay', origin.replace(/^https:/, 'wss:')], ['challenge', challenge[1]]], '');
      this.send(['AUTH', event]);
      return this.next(v => v[0] === 'OK' || v[0] === 'NOTICE');
    },
    async close() { if (ws.readyState === 3) return; const closed = new Promise(resolve => ws.once('close', resolve)); ws.terminate(); await closed; },
  };
}
