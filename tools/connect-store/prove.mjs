import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdir, readdir, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fixture, socket, request } from './test-support.mjs';
import { hash, hex } from './core.mjs';

async function startChild(config, root, pin) {
  const child = fork(new URL('./gateway-child.mjs', import.meta.url), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const exited = new Promise(resolve => child.once('exit', resolve));
  let stderr = false; child.stderr.on('data', () => { stderr = true; });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('canary-start-timeout')); }, 10000);
    child.once('message', message => { clearTimeout(timer); message.ready ? resolve(message) : reject(new Error('canary-start-failed')); });
    child.once('error', () => { clearTimeout(timer); reject(new Error('canary-process-error')); });
  });
  // Runtime-generated test keys only, passed over private parent/child IPC.
  child.send({ config: { policy: config.policy, owner: config.owner, policyId: config.policyId,
    key: [...config.key], writer: pin ? undefined : [...config.writer] }, root, pin });
  const endpoints = await ready;
  return { ...endpoints, async kill() { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exited; },
    async stop() { if (child.connected) child.disconnect(); await exited; assert.equal(stderr, false, 'child emitted an error'); } };
}

const f = await fixture(); let a, b; const clients = [];
try {
  const first = path.join(f.root, 'first-store'), second = path.join(f.root, 'second-store');
  a = await startChild(f.config, first);
  const origin = 'https://isolated-channel.invalid';
  const alice = await socket(a), bob = await socket(a); clients.push(alice, bob);
  assert.equal((await alice.authenticate(f.alice, origin))[2], true);
  assert.equal((await bob.authenticate(f.bob, origin))[2], true);
  bob.send(['REQ', 'room', { '#h': [f.channel] }]); await bob.next(v => v[0] === 'EOSE');
  const root = f.message(f.alice, 'process-loss canary root'); alice.send(['EVENT', root]);
  assert.equal((await alice.next(v => v[0] === 'OK'))[2], true);
  assert.deepEqual((await bob.next(v => v[0] === 'EVENT'))[2], root);
  const reply = f.message(f.bob, 'process-loss canary reply', [['e', root.id, '', 'reply']]);
  bob.send(['EVENT', reply]); assert.equal((await bob.next(v => v[0] === 'OK'))[2], true);
  const bytes = randomBytes(300 * 1024);
  const up = await request(a, f.alice, origin, '/media/upload', bytes, 'PUT'); assert.equal(up.status, 200);
  const uploaded = await up.json();
  const q = await request(a, f.bob, origin, '/query', [{ '#h': [f.channel] }]); assert.equal(q.status, 200);
  const expected = await q.json(), pin = JSON.parse(q.headers.get('x-bnr-checkpoint'));
  // Copy only opaque objects, no running process state, index, or local database.
  await mkdir(second);
  const names = await readdir(first);
  for (const name of names) { assert.ok(hex(name)); await copyFile(path.join(first, name), path.join(second, name)); }
  await a.kill(); a = null;
  await rename(first, path.join(f.root, 'first-store-unavailable'));
  b = await startChild(f.config, second, pin);
  const restored = await request(b, f.bob, origin, '/query', [{ '#h': [f.channel] }]); assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), expected);
  const file = await request(b, f.bob, origin, `/media/${uploaded.sha256}`, undefined, 'GET'); assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  const denied = await request(b, f.outsider, origin, '/query', [{ '#h': [f.channel] }]); assert.equal(denied.status, 403);
  const deniedFile = await request(b, f.outsider, origin, `/media/${uploaded.sha256}`, undefined, 'GET'); assert.equal(deniedFile.status, 403);
  console.log(JSON.stringify({ proof: 'connect-store-isolated-process-loss-v1', passed: true,
    authenticated_clients: 2, preserved_signed_events: expected.length, verified_file_bytes: bytes.length,
    original_gateway_terminated: true, original_store_unavailable: true, recovery_from_object_copy_and_client_pin: true,
    unauthorized_history_status: denied.status, unauthorized_file_status: deniedFile.status,
    public_x0x_transport: false, public_autonomi_retrieval: false, independent_operator: false,
    replacement_writable: false, real_buzz_app_tested: false, synthetic_identities_only: true }, null, 2));
} finally {
  for (const c of clients) await c.close();
  if (a) await a.kill(); if (b) await b.stop(); await f.close();
}
