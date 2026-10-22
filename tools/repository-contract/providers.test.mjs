// Built native providers, public disposable keys and loopback fixtures only.
// Missing binaries fail, never skip; no external storage/chain acceptance claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { nativeReader, verifyOwner } from './providers.mjs';
import { fixture, keys, envelope } from './fixtures.mjs';
import { bytesDigest } from './contract.mjs';
import { repositoryPrivacy } from './privacy.mjs';
const B = globalThis.BPQ;
const binary = key => { assert.ok(process.env[key], `${key} must name the real built binary`); return resolve(process.env[key]); };

test('native atmirror Arweave reader returns exact bytes, bounds oversized reads and rejects redirects', async t => {
  const bin = binary('REPOSITORY_RAIL_BIN'), plain = Buffer.from('native atmirror readback'), good = 'a'.repeat(43), large = 'b'.repeat(43);
  const server = createServer((req, res) => {
    if (req.url.includes(good)) res.end(plain);
    else if (req.url.includes(large)) res.end(Buffer.alloc(1024));
    else { res.writeHead(302, { location: '/'+good }); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
  const rail = nativeReader({ binary: bin, scheme: 'ar', endpoint: `http://127.0.0.1:${server.address().port}` });
  assert.deepEqual(await rail.get(good, plain.length), plain);
  await assert.rejects(() => rail.get(large, 10)); await assert.rejects(() => rail.get('c'.repeat(43), 100));
  await assert.rejects(() => rail.get('../unsafe', 100), e => e.code === 'LOCATION');
  assert.throws(() => nativeReader({ binary: bin, scheme: 'ar', endpoint: 'https://example.com/path' }));
  assert.equal('put' in rail, false, 'the read adapter has no default payer or write verb');
});

// Small TEST-ONLY DAG-CBOR writer. Production parsing/rotation verification is
// exclusively crates/bzdid; these fixture bytes exercise that independent code.
function cbor(v) {
  const head = (major, n) => {
    if (n < 24) return Buffer.from([(major << 5) | n]);
    const size = n <= 255 ? 1 : n <= 65535 ? 2 : 4, b = Buffer.alloc(1 + size); b[0] = (major << 5) | (size === 1 ? 24 : size === 2 ? 25 : 26); b.writeUIntBE(n, 1, size); return b;
  };
  if (typeof v === 'number') return head(0, v);
  if (typeof v === 'string') { const b = Buffer.from(v); return Buffer.concat([head(3, b.length), b]); }
  if (v instanceof Uint8Array) return Buffer.concat([head(2, v.length), v]);
  if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(cbor)]);
  const entries = Object.entries(v).sort(([a], [b]) => a.length - b.length || Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}
function base32(bytes) {
  let out = '', acc = 0, bits = 0; const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; out += alphabet[(acc >>> bits) & 31]; } }
  if (bits) out += alphabet[(acc << (5 - bits)) & 31]; return out;
}
test('native bzDiD resolves current PQ owner, rotation, exact head pin and policy authorization', async t => {
  const bin = binary('REPOSITORY_OWNER_BIN'), dir = mkdtempSync(join(tmpdir(), 'repository-owner-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const card = n => ({ alg: 'ml-dsa-65', key: Buffer.from(keys[n].public_key, 'base64url') });
  const op = { type: 'b:genesis', rotationKeys: [card(0)], signingKey: card(0), services: [], alsoKnownAs: [], validUntil: 2_000_000_000 };
  const bytes = cbor(op), genesis = join(dir, 'genesis.cbor'); writeFileSync(genesis, bytes);
  const f = fixture(), did = 'did:b:' + base32(createHash('sha256').update(bytes).digest());
  const args = { binary: bin, did, genesis, head: bytesDigest(bytes), sequence: 0, clock: 1_900_000_000, policy: f.policy };
  assert.equal((await verifyOwner(args)).key_id, keys[0].id);
  await assert.rejects(() => verifyOwner({ ...args, head: bytesDigest(Buffer.from('different head')) }));
  await assert.rejects(() => verifyOwner({ ...args, clock: op.validUntil }));
  await assert.rejects(() => verifyOwner({ ...args, sequence: 1 }));
  const other = structuredClone(f.policy); other.update_keys = [keys[2].id]; await assert.rejects(() => verifyOwner({ ...args, policy: other }), e => e.code === 'IDENTITY_POLICY');
  const body = { type: 'b:rotate', seq: 1, prev: Buffer.from(args.head.slice(7), 'hex'), at: args.clock, signedBy: 0,
    rotationKeys: [card(0)], signingKey: card(1), services: [], alsoKnownAs: [], validUntil: op.validUntil };
  const signature = envelope(Buffer.concat([Buffer.from('did:b:rotate/v1\0'), cbor(body)]), 0).signature.b64u;
  const rotation = cbor({ ...body, sig: Buffer.from(signature, 'base64url') }), path = join(dir, 'rotation.cbor'); writeFileSync(path, rotation);
  const rotated = structuredClone(f.policy); rotated.update_keys = [keys[1].id];
  assert.equal((await verifyOwner({ ...args, rotations: [path], sequence: 1, head: bytesDigest(rotation), policy: rotated })).key_id, keys[1].id);
  await assert.rejects(() => verifyOwner({ ...args, rotations: [path] }), /pinned head/);
});

test('Rust bSigner opens the existing BPQ X-Wing repository ciphertext independently', async t => {
  const bin = binary('REPOSITORY_BSIGNER_BIN'), dir = mkdtempSync(join(tmpdir(), 'repository-bpq-native-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const vector = JSON.parse(readFileSync(new URL('../../surfaces/bpq-vectors.json', import.meta.url))).keys[0];
  const master = new Uint8Array(createHash('sha256').update(vector.rootFrom).digest()); // TEST-ONLY published vector
  const reader = B.keys(master, vector.context); t.after(() => reader.wipe());
  const privacy = repositoryPrivacy({ recipients: [B.card(reader)], credentials: { kem: reader.kem } });
  const plain = Buffer.from('repository native confidential readback'), sealed = await privacy.seal(plain);
  const input = join(dir, 'cipher.bpq'), out = join(dir, 'padded.bin'); writeFileSync(input, sealed);
  const r = spawnSync(bin, ['bpq-open', '--object', input, '--rec-env', 'REPOSITORY_PUBLIC_TEST_RECOVERY', '--context', vector.context, '--out', out],
    { encoding: 'utf8', windowsHide: true, env: { ...process.env, REPOSITORY_PUBLIC_TEST_RECOVERY: vector.recoveryCode } });
  assert.equal(r.status, 0, r.stderr); const result = JSON.parse(r.stdout); assert.equal(result.opened_with, 'x-wing');
  const padded = readFileSync(out), prefix = Buffer.from('bnr.repo.private/1\0'); assert.equal(padded.length, 4096);
  const length = Number(padded.readBigUInt64BE(prefix.length)); assert.deepEqual(padded.subarray(prefix.length + 8, prefix.length + 8 + length), plain);
});
