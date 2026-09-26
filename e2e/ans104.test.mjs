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

test('a signed item parses, verifies and carries the same id in arbundles', async () => {
  const { DataItem } = req('@dha-team/arbundles');
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
