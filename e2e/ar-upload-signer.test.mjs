/* ar-upload-signer.test.mjs — the ed25519 upload door puts the member's PUBLIC key in the
   item's owner field, never the seed. Offline and key-free: every key is a throwaway made
   here, and nothing is printed.
   1. a stand-in built exactly like arbundles' SolanaSigner constructor (the first 32 bytes
      sign, the last 32 are the owner) gets owner == public key from memberSigner();
   2. a stand-in with the order reversed is REFUSED before any upload (the guard works
      whatever a future library version does);
   3. where the reference library is installed (a --no-save dev install; CI does not), the
      real SolanaSigner agrees, and the signed item verifies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const req = createRequire(ROOT + '/contracts/vending/tool/package.json');
const { memberSigner } = req('./ar-upload.cjs');
const hexCodec = { encode: (b) => Buffer.from(b).toString('hex'), decode: (s) => Buffer.from(s, 'hex') };
class LikeArbundles { constructor(k) { const b = hexCodec.decode(k); this.key = b.subarray(0, 32); this.publicKey = b.subarray(32, 64); } }
class Reversed { constructor(k) { const b = hexCodec.decode(k); this.key = b.subarray(32, 64); this.publicKey = b.subarray(0, 32); } }
const fresh = () => { const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { seed: Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url'), pub: Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url') }; };

test('the owner is the member public key, derived from the private key, never the seed', () => {
  const { seed, pub } = fresh();
  const { signer, pubRaw } = memberSigner(seed, { SolanaSigner: LikeArbundles, bs58: hexCodec });
  assert.ok(pubRaw.equals(pub), 'the public key is derived from the seed, not the seed re-wrapped');
  assert.ok(Buffer.from(signer.publicKey).equals(pub)); assert.ok(!Buffer.from(signer.publicKey).equals(seed));
  assert.ok(Buffer.from(signer.key).equals(seed), 'the seed is the signing half');
});

test('a signer whose owner would be the seed is refused before any upload', () => {
  const { seed } = fresh();
  assert.throws(() => memberSigner(seed, { SolanaSigner: Reversed, bs58: hexCodec }), /refusing before any upload/);
  assert.throws(() => memberSigner(Buffer.alloc(31), { SolanaSigner: LikeArbundles, bs58: hexCodec }), /32 bytes/);
});

test('the script no longer wraps the seed as a public key, and requires no upload library to load', () => {
  const src = readFileSync(ROOT + '/contracts/vending/tool/ar-upload.cjs', 'utf8');
  assert.doesNotMatch(src, /302a300506032b6570032100/, 'no SPKI public-key wrapper around the seed');
  assert.match(src, /Buffer\.concat\(\[seed, pubRaw\]\)/);
  assert.match(src, /if \(require\.main === module\)/, 'the upload only runs as a script');
});

let arbundles = null, bs58 = null; try { arbundles = req('@dha-team/arbundles'); bs58 = req('bs58'); } catch {}
test('the real arbundles SolanaSigner agrees with the stand-in, and the item verifies', { skip: arbundles ? false : 'the reference library is not installed here (npm install --prefix contracts/vending/tool --no-save @dha-team/arbundles bs58)' }, async () => {
  const { seed, pub } = fresh();
  const { signer } = memberSigner(seed);
  assert.ok(Buffer.from(signer.publicKey).equals(pub));
  const item = arbundles.createData('probe', signer, { tags: [{ name: 'App-Name', value: 'skaists-vending' }] }); await item.sign(signer);
  assert.ok(Buffer.from(item.rawOwner).equals(pub)); assert.ok(!Buffer.from(item.rawOwner).equals(seed));
  assert.equal(await arbundles.DataItem.verify(item.getRaw()), true);
  const B = bs58.default || bs58;
  const wrong = new arbundles.SolanaSigner(B.encode(Buffer.concat([pub, seed])));
  assert.ok(Buffer.from(wrong.publicKey).equals(seed), 'the reversed order really does put the seed in the owner field');
});
