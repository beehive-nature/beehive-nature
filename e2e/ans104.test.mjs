/* ans104.test.mjs — the page's own ANS-104 signer against the reference library.
   surfaces/ans104.js builds and signs a data item with no dependency; here the
   bytes are handed to @dha-team/arbundles (installed for the vending tool) which
   must parse them, agree on the id, and verify the ed25519 signature. Offline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const req = createRequire(ROOT + '/contracts/vending/tool/package.json');
const src = readFileSync(ROOT + '/surfaces/ans104.js', 'utf8');
const sandbox = { self: undefined, crypto: webcrypto, TextEncoder, btoa, atob, require: createRequire(import.meta.url) };
vm.runInNewContext(src + '\nthis.ANS104 = ANS104;', sandbox);
const A = sandbox.ANS104;

/* the reference library is a dev dependency of the vending tool, installed there
   with npm; CI's static job does not install it, so the parity test SKIPS by name
   rather than pretending. The library-free verification below always runs. */
let arbundles = null; try { arbundles = req('@dha-team/arbundles'); } catch {}

test('the signature verifies under WebCrypto over the same deepHash, and the id is sha256(signature)', async () => {
  const key = await A.generateKey();
  const data = new TextEncoder().encode('{"record":"probe"}');
  const tags = [{ name: 'App-Name', value: 'skaists-vending' }];
  const item = await A.sign(key, data, tags);
  const te = new TextEncoder();
  const msg = await A.deepHash([te.encode('dataitem'), te.encode('1'), te.encode('2'), key.publicRaw, new Uint8Array(0), new Uint8Array(0), A.serializeTags(tags), data]);
  const sig = A.fromB64url(item.signature);
  assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, key.publicKey, sig, msg), true);
  assert.equal(item.id, A.b64url(new Uint8Array(await webcrypto.subtle.digest('SHA-256', sig))));
  /* the binary layout: sigtype 2 LE · 64 B sig · 32 B owner · no target · no anchor · tag counts · tags · data */
  const b = item.bytes;
  assert.deepEqual([...b.slice(0, 2)], [2, 0]); assert.deepEqual([...b.slice(2, 66)], [...sig]); assert.deepEqual([...b.slice(66, 98)], [...key.publicRaw]);
  assert.deepEqual([...b.slice(98, 100)], [0, 0]);
  assert.equal(b.length, 100 + 16 + A.serializeTags(tags).length + data.length);
  assert.deepEqual([...b.slice(b.length - data.length)], [...data]);
});

test('a signed item parses, verifies and carries the same id in arbundles', { skip: arbundles ? false : 'the reference library is not installed here (npm install in contracts/vending/tool)' }, async () => {
  const { DataItem } = arbundles;
  const key = await A.generateKey();
  const data = new TextEncoder().encode(JSON.stringify({ record: 'probe', n: 1 }));
  const tags = [{ name: 'App-Name', value: 'skaists-vending' }, { name: 'Type', value: 'agent-birth-certificate' }, { name: 'Content-Type', value: 'application/json' }, { name: 'Member-Key', value: key.publicHex }];
  const item = await A.sign(key, data, tags);
  const di = new DataItem(Buffer.from(item.bytes));
  assert.equal(di.id, item.id, 'id agrees');
  assert.equal(di.signatureType, 2, 'ed25519 / solana signature type');
  assert.equal(Buffer.from(di.rawOwner).toString('hex'), key.publicHex, 'the owner IS the member key');
  assert.deepEqual(di.tags, tags);
  assert.equal(Buffer.from(di.rawData).toString(), Buffer.from(data).toString());
  assert.equal(await DataItem.verify(Buffer.from(item.bytes)), true, 'the signature verifies in the reference library');
});

test('a seed round-trips to the same public key, and the free limit is enforced', async () => {
  const k = await A.generateKey();
  const k2 = await A.importSeed(k.seed);
  assert.equal(k2.publicHex, k.publicHex);
  const big = new Uint8Array(A.FREE_LIMIT + 1);
  const item = await A.sign(k, big, []);
  await assert.rejects(A.upload(item, async () => { throw new Error('must not be called'); }), /free door takes/);
});

test('upload refuses a door that answers a different id', async () => {
  const k = await A.generateKey();
  const item = await A.sign(k, new Uint8Array([1, 2, 3]), []);
  await assert.rejects(A.upload(item, async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: 'nope' }) })), /returned id nope/);
});
