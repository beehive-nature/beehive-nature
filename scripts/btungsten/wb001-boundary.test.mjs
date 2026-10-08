// wb001-boundary.test.mjs — the accepted-input boundary of Workbench 001,
// repaired 2026-10-07 after the founder review of the genesis (PR #349).
//
// THE FINDING (reproduced on this module, node 24.18.0, before repair):
// unpaired UTF-16 surrogates are DISTINCT JavaScript strings that
// Buffer.from(value, 'utf8') silently maps to the same replacement bytes
// (efbfbd) — so canonical('\uD800') == canonical('\uD801') ==
// canonical('\uFFFD') and one signature verified all three, in EVERY text
// field. Not an Ed25519 forgery: the cryptography signs exactly what it
// receives; the encoder had already lost the distinction. The twin gap
// sat in the decoder: v.toString('utf8') replaces invalid UTF-8 instead
// of refusing it, so a raw 0xff byte inside a text field was accepted
// lossily, and verifyEnvelope accepted a signature made over exactly
// those malformed bytes.
//
// THE REPAIR LAW (founder ruling 2026-10-07): reject ill-formed strings
// at encode (bt-wb01:utf16), reject malformed UTF-8 at decode
// (bt-wb01:utf8); PRESERVE valid international text, supplementary
// characters and a legitimate U+FFFD. No ASCII-only retreat.
//
// These rows ran RED against the genesis module first — the verbatim
// receipt is in docs/dispatches/2026-10-07-btungsten-wb001-boundary-repair.md
// — and the valid-Unicode controls were green before and after.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sign as edSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  canonical, decode, keypair, sign, verify, verifyEnvelope,
  MAGIC, VERSION, Refusal,
} from './wb001-intent.mjs';

const b32 = (seed) => { const b = Buffer.alloc(32); b.write(seed.slice(0, 24), 0, 'utf8'); return b; };
const base = () => ({
  domain: 'skaists.bpay/1',
  nonce: b32('nonce-wb001'),
  epoch: 1n,
  action: b32('action-hash-01'),
  destination: 'vault:0xBEEF',
  capability: 'pay',
  amount: 1000000n,
  expiry: 1790000000n,
  payer: 'seat:bFUzZ',
  payload: Buffer.from('{"upload_id":"up-1"}', 'utf8'),
});
const refused = (fn, code) => {
  try { fn(); } catch (e) { assert.ok(e instanceof Refusal, `not a Refusal: ${e}`); assert.equal(e.refusal, code, e.message); return; }
  assert.fail(`expected a ${code} refusal`);
};

// Craft an envelope whose FIRST tlv (domain) carries exactly `bytes`,
// everything else from a valid base envelope.
const withDomainBytes = (bytes) => {
  const rest = canonical(base()).subarray(8 + 5 + Buffer.byteLength('skaists.bpay/1'));
  const head = Buffer.alloc(5); head[0] = 0x01; head.writeUInt32BE(bytes.length, 1);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), head, bytes, rest]);
};

const LONE_SURROGATES = ['\uD800', '\uDBFF', '\uDC00', '\uDFFF', 'x\uD800', '\uD800x', '\uD800A', '\uDC00\uD800'];
const VALID_INTERNATIONAL = [
  ['supplementary pair (astral)', '\uD83D\uDC31'],           // 🐱
  ['mathematical astral', '\uD835\uDD4F'],                   // 𝕏
  ['latin extended', 'b\u0101bis'],
  ['combining mark', 'e\u0301'],
  ['legitimate replacement char', '\uFFFD'],
  ['cjk', '\u652f\u4ed8'],                                    // 支付
  ['rtl', '\u0645\u0646\u062d\u0649'],
  ['mixed astral + bmp', 'a\uD83D\uDE00\u0101'],
];

test('RED->GREEN: unpaired surrogates are refused at encode, in every text field', () => {
  let n = 0;
  for (const field of ['domain', 'destination', 'capability', 'payer']) {
    for (const s of LONE_SURROGATES) {
      refused(() => canonical({ ...base(), [field]: s }), 'bt-wb01:utf16');
      n++;
    }
  }
  assert.equal(n, 32);
  console.log(`bT-WB001-boundary: lone-surrogate encodes refused 0 -> ${n} (4 fields x 8 forms)`);
});

test('RED->GREEN: the collision class is gone — one authorization can never cover the twin strings', () => {
  const { publicKey, privateKey } = keypair();
  const honest = base();
  const sig = sign(privateKey, honest);
  assert.ok(verify(publicKey, honest, sig), 'control: the honest pair');
  for (const field of ['domain', 'destination', 'capability', 'payer']) {
    // Pre-repair, signing the '\uD800' intent produced bytes that ALSO
    // verified for '\uD801' and '\uFFFD' — three distinct strings, one
    // signature. Post-repair the signing itself refuses: no accepted
    // intent can share these bytes at all.
    refused(() => sign(privateKey, { ...honest, [field]: '\uD800' }), 'bt-wb01:utf16');
    refused(() => sign(privateKey, { ...honest, [field]: '\uD801' }), 'bt-wb01:utf16');
    // the legitimate U+FFFD intent stays signable and its signature
    // covers ONLY itself
    const ffd = { ...honest, [field]: '\uFFFD' };
    assert.ok(!canonical(honest).equals(canonical(ffd)), `${field}: honest and U+FFFD intents must be distinct bytes`);
    const ffsig = sign(privateKey, ffd);
    assert.ok(verify(publicKey, ffd, ffsig), `${field}: the U+FFFD control must still work`);
    assert.equal(verify(publicKey, honest, ffsig), false, `${field}: forward crossing to the honest intent`);
    assert.equal(verify(publicKey, honest, sig), true, 'mid-matrix control');
    assert.equal(verify(publicKey, { ...honest, [field]: '\uD800' }, sig), false, `${field}: twin under the honest signature`);
    assert.equal(verify(publicKey, { ...honest, [field]: '\uFFFD' }, sig), false, `${field}: U+FFFD under the honest signature`);
  }
  console.log('bT-WB001-boundary: surrogate-class authorization crossings rejected 0 -> 24 (4 fields x 6 rows)');
});

test('valid international text survives byte-exactly through encode and strict decode', () => {
  for (const [name, s] of VALID_INTERNATIONAL) {
    const x = { ...base(), destination: s };
    const env = canonical(x);
    const back = decode(env);
    assert.equal(back.destination, s, `${name}: decode returned a different string`);
    assert.ok(env.includes(Buffer.from(s, 'utf8')), `${name}: exact UTF-8 bytes not carried`);
  }
  console.log(`bT-WB001-boundary: valid-unicode controls round-trip 0 -> ${VALID_INTERNATIONAL.length}`);
});

test('RED->GREEN: strict decode refuses malformed UTF-8 by name, accepts the valid 4-byte and U+FFFD controls', () => {
  const cases = [
    ['raw 0xff', Buffer.from([0xff])],
    ['lone continuation 0x80', Buffer.from([0x80])],
    ['overlong 0xc0 0x80', Buffer.from([0xc0, 0x80])],
    ['overlong 0xe0 0x9f 0xbf', Buffer.from([0xe0, 0x9f, 0xbf])],
    ['encoded surrogate 0xed 0xa0 0x80 (CESU-8)', Buffer.from([0xed, 0xa0, 0x80])],
    ['beyond U+10FFFF 0xf4 0x90 0x80 0x80', Buffer.from([0xf4, 0x90, 0x80, 0x80])],
    ['overlong 4-byte 0xf0 0x8f 0xbf 0xbf', Buffer.from([0xf0, 0x8f, 0xbf, 0xbf])],
    ['truncated 0xc2', Buffer.from([0xc2])],
    ['truncated 3-byte 0xe2 0x82', Buffer.from([0xe2, 0x82])],
  ];
  for (const [name, bytes] of cases) {
    refused(() => decode(withDomainBytes(bytes)), 'bt-wb01:utf8');
    assert.ok(name.length > 0);
  }
  // controls: the astral bee (4-byte) and the legitimate replacement char decode
  assert.equal(decode(withDomainBytes(Buffer.from([0xf0, 0x9f, 0x90, 0x9d]))).domain, '\uD83D\uDC1D'); // 🐝
  assert.equal(decode(withDomainBytes(Buffer.from([0xef, 0xbf, 0xbd]))).domain, '\uFFFD');
  console.log(`bT-WB001-boundary: malformed-utf8 decodes refused 0 -> ${cases.length} (valid 4-byte + U+FFFD controls pass)`);
});

test('RED->GREEN: verifyEnvelope refuses malformed-wire envelopes even when the signature was made over exactly those bytes', () => {
  const { publicKey, privateKey } = keypair();
  const malformed = withDomainBytes(Buffer.from([0xff]));
  const sig = edSign(null, malformed, privateKey); // signature over the malformed bytes themselves
  assert.equal(verifyEnvelope(publicKey, malformed, sig), false, 'a signature over malformed wire was accepted');
  // control: the same key honestly signs a valid intent and verifies
  const honest = base();
  assert.ok(verify(publicKey, honest, sign(privateKey, honest)), 'control');
});

test('the pinned shared vectors: byte-for-byte, refusals by code (the bridge every twin must reproduce)', () => {
  const v = JSON.parse(readFileSync(new URL('./wb001-vectors.json', import.meta.url), 'utf8'));
  assert.equal(v.format, 'bt-wb01/1');
  const intentOf = (row) => ({
    domain: row.domain, nonce: Buffer.from(row.nonce, 'hex'), epoch: BigInt(row.epoch),
    action: Buffer.from(row.action, 'hex'), destination: row.destination, capability: row.capability,
    amount: BigInt(row.amount), expiry: BigInt(row.expiry), payer: row.payer, payload: Buffer.from(row.payload, 'hex'),
  });
  for (const p of v.positives) {
    const env = canonical(intentOf(p));
    assert.equal(env.toString('hex'), p.envelope, `${p.name}: envelope bytes drifted from the pinned vector`);
    assert.equal(env.length, p.length, `${p.name}: length drifted`);
    assert.ok(env.equals(canonical(decode(env))), `${p.name}: round-trip through strict decode`);
  }
  for (const r of v.refusals) {
    if (r.intent) refused(() => canonical(intentOf(r.intent)), r.code);
    else refused(() => decode(Buffer.from(r.envelope, 'hex')), r.code);
  }
  console.log(`bT-WB001-boundary: shared vectors held 0 -> ${v.positives.length} positives byte-for-byte, ${v.refusals.length} refusals by code`);
});
