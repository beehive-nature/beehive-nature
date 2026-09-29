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
import { generateKeyPairSync, createPrivateKey, sign as cryptoSign } from 'node:crypto';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const req = createRequire(ROOT + '/contracts/vending/tool/package.json');
const { memberSigner } = req('./ar-upload.cjs');
const hexCodec = { encode: (b) => Buffer.from(b).toString('hex'), decode: (s) => Buffer.from(s, 'hex') };
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
const signWith = (seed, msg) => cryptoSign(null, msg, createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: 'der', type: 'pkcs8' }));
class LikeArbundles { constructor(k) { const b = hexCodec.decode(k); this.key = b.subarray(0, 32); this.publicKey = b.subarray(32, 64); } sign(m) { return signWith(this.key, m); } }
class Reversed { constructor(k) { const b = hexCodec.decode(k); this.key = b.subarray(32, 64); this.publicKey = b.subarray(0, 32); } sign(m) { return signWith(this.key, m); } }
/* owner right, but a stranger's key signs: only the probe-signature guard catches this */
class WrongSigner extends LikeArbundles { sign(m) { return signWith(Buffer.alloc(32, 9), m); } }
const fresh = () => { const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { seed: Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url'), pub: Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url') }; };

test('the owner is the member public key, derived from the private key, never the seed', async () => {
  const { seed, pub } = fresh();
  const { signer, pubRaw, ready } = memberSigner(seed, { SolanaSigner: LikeArbundles, bs58: hexCodec });
  await ready;
  assert.ok(pubRaw.equals(pub), 'the public key is derived from the seed, not the seed re-wrapped');
  assert.ok(Buffer.from(signer.publicKey).equals(pub)); assert.ok(!Buffer.from(signer.publicKey).equals(seed));
  assert.ok(Buffer.from(signer.key).equals(seed), 'the seed is the signing half');
});

test('a signer whose owner would be the seed is refused before any upload', () => {
  const { seed } = fresh();
  assert.throws(() => memberSigner(seed, { SolanaSigner: Reversed, bs58: hexCodec }), /refusing before any upload/);
  assert.throws(() => memberSigner(Buffer.alloc(31), { SolanaSigner: LikeArbundles, bs58: hexCodec }), /32 bytes/);
});

test('a signer that publishes the right owner but signs with another key is refused before any upload', async () => {
  const { seed } = fresh();
  await assert.rejects(memberSigner(seed, { SolanaSigner: WrongSigner, bs58: hexCodec }).ready, /does not sign with the member key/);
});

test('the script no longer wraps the seed as a public key, and requires no upload library to load', () => {
  const src = readFileSync(ROOT + '/contracts/vending/tool/ar-upload.cjs', 'utf8');
  assert.doesNotMatch(src, /302a300506032b6570032100", "hex"\), seed\]/, 'no SPKI public-key wrapper around the seed');
  assert.match(src, /Buffer\.concat\(\[seed, pubRaw\]\)/);
  assert.match(src, /if \(require\.main === module\)/, 'the upload only runs as a script');
  assert.ok(src.indexOf('await ready;') > 0 && src.indexOf('await ready;') < src.indexOf('TurboFactory.authenticated'), 'the signing check completes before the upload door is touched');
});

let arbundles = null, bs58 = null; try { arbundles = req('@dha-team/arbundles'); bs58 = req('bs58'); } catch {}
test('the real arbundles SolanaSigner agrees with the stand-in, and the item verifies', { skip: arbundles ? false : 'the reference library is not installed here (npm install --prefix contracts/vending/tool --no-save @dha-team/arbundles bs58)' }, async () => {
  const { seed, pub } = fresh();
  const { signer, ready } = memberSigner(seed);
  await ready;
  assert.ok(Buffer.from(signer.publicKey).equals(pub));
  const item = arbundles.createData('probe', signer, { tags: [{ name: 'App-Name', value: 'skaists-vending' }] }); await item.sign(signer);
  assert.ok(Buffer.from(item.rawOwner).equals(pub)); assert.ok(!Buffer.from(item.rawOwner).equals(seed));
  assert.equal(await arbundles.DataItem.verify(item.getRaw()), true);
  const B = bs58.default || bs58;
  const wrong = new arbundles.SolanaSigner(B.encode(Buffer.concat([pub, seed])));
  assert.ok(Buffer.from(wrong.publicKey).equals(seed), 'the reversed order really does put the seed in the owner field');
});

/* the audit tool behind the dispatch's "no seed on Arweave" line (contracts/vending/tool/arweave-owner-audit.mjs, verifyEd25519Item) */
const AUD = await import('../contracts/vending/tool/arweave-owner-audit.mjs');
test('the audit\'s verifier accepts a correctly signed item and rejects one whose owner is the seed', () => {
  const { seed, pub } = fresh();
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: 'der', type: 'pkcs8' });
  const tags = [{ name: 'App-Name', value: 'skaists-vending' }, { name: 'Member-Key', value: pub.toString('hex') }];
  const data = new TextEncoder().encode('{"record":"probe"}');
  const msg = AUD.deepHash([new TextEncoder().encode('dataitem'), new TextEncoder().encode('1'), new TextEncoder().encode('2'), pub, new Uint8Array(0), new Uint8Array(0), AUD.serializeTags(tags), data]);
  const signature = cryptoSign(null, msg, priv);
  assert.equal(AUD.verifyEd25519Item({ owner: pub, signature, tags, data }), true);
  assert.equal(AUD.verifyEd25519Item({ owner: seed, signature, tags, data }), false, 'a seed in the owner field cannot verify the item\'s signature');
  assert.equal(AUD.verifyEd25519Item({ owner: new Uint8Array(512), signature, tags, data }), null, 'not ed25519: not judged');
});
test('the audit\'s verifier agrees with arbundles on an item arbundles signed', { skip: arbundles ? false : 'the reference library is not installed here (npm install --prefix contracts/vending/tool --no-save @dha-team/arbundles bs58)' }, async () => {
  const { seed, pub } = fresh();
  const { signer, ready } = memberSigner(seed); await ready;
  const tags = [{ name: 'App-Name', value: 'skaists-vending' }, { name: 'Member-Key', value: pub.toString('hex') }];
  const item = arbundles.createData('{"record":"probe"}', signer, { tags }); await item.sign(signer);
  assert.equal(AUD.verifyEd25519Item({ owner: new Uint8Array(item.rawOwner), signature: new Uint8Array(item.rawSignature), tags, data: new Uint8Array(item.rawData) }), true);
});
