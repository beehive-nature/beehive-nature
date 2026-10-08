// wb001.test.mjs — bTunGsTeN Workbench 001: the intent-binding invariant,
// attacked. No valid signature may authorize any intent other than the
// exact intent that was committed to (SPEC-BTUNGSTEN-1 §workbench).
//
// What runs here is all local: node:crypto Ed25519 keys made in-process,
// no network, no fixtures from outside this tree. The counts the suite
// prints are the CI receipt (the ratchet reads CI's own lines).
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  canonical, decode, keypair, sign, verify, verifyEnvelope,
  naiveConcat, MAGIC, VERSION, Refusal,
} from './wb001-intent.mjs';

const b32 = (seed) => {
  const b = Buffer.alloc(32);
  b.writeBigUInt64BE(0n, 0);
  b.write(seed.slice(0, 24), 0, 'utf8');
  return b;
};

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

test('canonical form is deterministic and round-trips through the strict decoder', () => {
  const x = base();
  const a = canonical(x), a2 = canonical(x);
  assert.ok(a.equals(a2), 'same intent, two calls, different bytes');
  const back = decode(a);
  const a3 = canonical(back);
  assert.ok(a.equals(a3), 'decode(canonical(x)) did not re-canonicalize to the same bytes');
  assert.equal(back.domain, x.domain);
  assert.equal(back.amount, x.amount);
  assert.equal(back.epoch, x.epoch);
  assert.ok(back.nonce.equals(x.nonce) && back.payload.equals(x.payload));
});

test('typed refusals: the encoder and decoder fail closed, each with its name', () => {
  refused(() => canonical({ ...base(), amount: 1 }), 'bt-wb01:type');                    // u64 not BigInt
  refused(() => canonical({ ...base(), domain: '' }), 'bt-wb01:bounds');                 // empty text field
  refused(() => canonical({ ...base(), nonce: Buffer.alloc(31) }), 'bt-wb01:type');      // 31-byte nonce
  refused(() => canonical({ ...base(), extra: 1 }), 'bt-wb01:unknown-field');            // field outside the canon
  refused(() => canonical({ ...base(), payer: undefined }), 'bt-wb01:type');             // missing value path
  const good = canonical(base());
  refused(() => decode(Buffer.alloc(4)), 'bt-wb01:short');
  refused(() => decode(Buffer.concat([Buffer.from('bT-WB00'), good.subarray(7)])), 'bt-wb01:magic');
  refused(() => decode(Buffer.concat([good.subarray(0, 7), Buffer.from([0x02]), good.subarray(8)])), 'bt-wb01:version');
  refused(() => decode(good.subarray(0, good.length - 1)), 'bt-wb01:short');             // truncated last value
  refused(() => decode(Buffer.concat([good, Buffer.from([0x00])])), 'bt-wb01:trailing'); // one byte of drift
  const noPayload = decode(good); delete noPayload.payload;
  refused(() => canonical(noPayload), 'bt-wb01:missing-field');
});

test('injectivity over the adversarial corpus: distinct intents never share canonical bytes', () => {
  const nested = canonical(base()); // a full valid envelope riding INSIDE payload
  const corpus = [
    base(),
    { ...base(), payload: Buffer.alloc(0) },
    { ...base(), payload: Buffer.from([0]) },
    { ...base(), payload: nested },
    { ...base(), payload: Buffer.concat([nested, nested]) },
    { ...base(), destination: Buffer.from('vault:0xBEEF', 'utf8').toString() + ' ' },
    { ...base(), domain: 'skaists.bpay/1 ', destination: 'vault:0xBEE' },  // shifted-boundary twin
    { ...base(), domain: 'skaists.bpay/1', destination: 'vault:0xBEEF', capability: 'pa' },
    { ...base(), amount: 0n },
    { ...base(), amount: 4294967295n },           // u32 boundary
    { ...base(), amount: 4294967296n },           // one past it
    { ...base(), amount: 18446744073709551615n }, // u64 ceiling
    { ...base(), epoch: 0n },
    { ...base(), expiry: 1790000001n },
    { ...base(), nonce: b32('nonce-wb002') },
    { ...base(), action: b32('action-hash-02') },
    { ...base(), payer: 'seat:bFUzZ2' },
    { ...base(), domain: 'skaists.bpay/2' },
    { ...base(), payload: Buffer.from('{"upload_id":"up-1"} {"upload_id":"up-1"}', 'utf8') },
    { ...base(), payload: Buffer.from('{"upload_id":"up-1', 'utf8') },
    { ...base(), destination: 'a', capability: 'b', payer: 'c' },
    { ...base(), destination: 'ab', capability: 'b', payer: 'c' },
    { ...base(), destination: 'a', capability: 'a', payer: 'c' },
    { ...base(), payload: Buffer.from('\u0100\u0101', 'utf8') },  // multibyte UTF-8
    { ...base(), payload: Buffer.from('\ufffd', 'utf8') },
  ];
  const seen = new Map();
  for (const x of corpus) {
    const hex = canonical(x).toString('hex');
    assert.ok(!seen.has(hex), `two intents collided: ${seen.get(hex)} and a corpus member share canonical bytes`);
    seen.set(hex, seen.size);
  }
  assert.ok(seen.size === corpus.length, `corpus ${corpus.length} produced ${seen.size} forms`);
});

test('the ten fields all bind: a signature over intent A never verifies for intent A-with-one-field-moved', () => {
  const { publicKey, privateKey } = keypair();
  const a = base();
  const sig = sign(privateKey, a);
  assert.ok(verify(publicKey, a, sig), 'control: the honest verify must pass');
  const moves = {
    domain: ['skaists.bpay/2', 'x'],
    nonce: [b32('nonce-wb002'), Buffer.alloc(32)],
    epoch: [2n, 0n],
    action: [b32('action-hash-02'), Buffer.alloc(32)],
    destination: ['vault:0xBEE2', 'vault:0xBEEF/x'],
    capability: ['refund', 'pay-all'],
    amount: [1000001n, 999999n, 0n],
    expiry: [1790000001n, 0n],
    payer: ['seat:bFUzZ2', 'seat:other'],
    payload: [Buffer.from('{"upload_id":"up-2"}', 'utf8'), Buffer.alloc(0)],
  };
  let mutants = 0;
  for (const [field, values] of Object.entries(moves)) {
    for (const v of values) {
      const forged = { ...a, [field]: v };
      assert.equal(verify(publicKey, forged, sig), false, `field ${field}: moved value still verified`);
      assert.ok(verify(publicKey, a, sig), 'control drifted mid-matrix');
      mutants++;
    }
  }
  assert.equal(mutants, 21);
  console.log(`bT-WB001: field-move mutants rejected 0 -> ${mutants}`);
});

test('the one-bit matrix over the envelope: every flipped bit of the committed form fails', () => {
  const { publicKey, privateKey } = keypair();
  const env = canonical(base());
  const sig = sign(privateKey, { ...base() });
  assert.ok(verifyEnvelope(publicKey, env, sig), 'control');
  let mutants = 0;
  for (let i = 0; i < env.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const m = Buffer.from(env);
      m[i] ^= 1 << bit;
      assert.equal(verifyEnvelope(publicKey, m, sig), false, `envelope byte ${i} bit ${bit} flipped and still verified`);
      mutants++;
    }
  }
  assert.equal(mutants, env.length * 8);
  console.log(`bT-WB001: envelope one-bit mutants rejected 0 -> ${mutants} (${env.length} bytes)`);
});

test('the one-bit matrix over the signature: every flipped bit of the witness fails', () => {
  const { publicKey, privateKey } = keypair();
  const env = canonical(base());
  const sig = sign(privateKey, base());
  let mutants = 0;
  for (let i = 0; i < sig.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const s = Buffer.from(sig);
      s[i] ^= 1 << bit;
      assert.equal(verifyEnvelope(publicKey, env, s), false, `signature byte ${i} bit ${bit} flipped and still verified`);
      mutants++;
    }
  }
  assert.equal(mutants, sig.length * 8);
  console.log(`bT-WB001: signature one-bit mutants rejected 0 -> ${mutants} (${sig.length} bytes)`);
});

test('structural forgeries: splice, reorder, duplicate, unknown tag, truncated — all refuse', () => {
  const { publicKey, privateKey } = keypair();
  const a = base();
  const env = canonical(a);
  const sig = sign(privateKey, a);
  // locate the destination (0x05) and capability (0x06) tlvs
  let at = MAGIC.length + 1, destAt = -1, capAt = -1;
  while (at < env.length) {
    if (env[at] === 0x05) destAt = at;
    if (env[at] === 0x06) capAt = at;
    at += 5 + env.readUInt32BE(at + 1);
  }
  assert.ok(destAt > 0 && capAt > destAt);
  const destTlv = env.subarray(destAt, capAt), capTlv = env.subarray(capAt, capAt + 5 + env.readUInt32BE(capAt + 1));
  const swapped = Buffer.concat([env.subarray(0, destAt), capTlv, destTlv, env.subarray(capAt + capTlv.length)]);
  const unknown = Buffer.concat([env, Buffer.from([0x0b, 0, 0, 0, 1, 0x41])]);
  const duped = Buffer.concat([env.subarray(0, destAt), destTlv, destTlv, env.subarray(destAt + destTlv.length)]);
  // length-extension splice: the destination length swallows its own tag + the capability header
  const splice = Buffer.from(env);
  const destLen = splice.readUInt32BE(destAt + 1);
  splice.writeUInt32BE(destLen + 5 + env.readUInt32BE(capAt + 1) + 5, destAt + 1);
  for (const [name, forged] of [['reordered tlv', swapped], ['unknown trailing tag', unknown], ['duplicated tlv', duped], ['length splice', splice], ['truncated mid-tlv', env.subarray(0, env.length - 3)]]) {
    assert.equal(verifyEnvelope(publicKey, forged, sig), false, `${name} verified`);
    assert.throws(() => decode(forged), Refusal, `${name} did not refuse`);
  }
  assert.ok(verifyEnvelope(publicKey, env, sig), 'control drifted');
  console.log('bT-WB001: structural forgeries rejected 0 -> 5 (reorder, unknown tag, duplicate, splice, truncation)');
});

test('domain, nonce and epoch participate: the same act under a different domain, moment or sequence is not this act', () => {
  const { publicKey, privateKey } = keypair();
  const sig = sign(privateKey, base());
  for (const [field, value] of [['domain', 'other.protocol/9'], ['nonce', b32('nonce-wb003')], ['epoch', 2n], ['expiry', 1790000500n]]) {
    assert.equal(verify(publicKey, { ...base(), [field]: value }, sig), false, `${field} does not participate in binding`);
  }
  assert.ok(verify(publicKey, base(), sig), 'control');
});

test('TEETH: the naive length-free encoder is convicted by this corpus (a green row here would mean the battery lost its teeth)', () => {
  // The classic ambiguity: boundary-shifted twins over ADJACENT
  // variable-length fields that naive concatenation maps to the SAME
  // bytes, so one authorization would cover both intents.
  const pairs = [
    [{ ...base(), destination: 'ab', capability: 'c' }, { ...base(), destination: 'a', capability: 'bc' }],
    [{ ...base(), payer: 'ab', payload: Buffer.from('c') }, { ...base(), payer: 'a', payload: Buffer.from('bc') }],
  ];
  for (const [left, right] of pairs) {
    assert.ok(naiveConcat(left).equals(naiveConcat(right)), 'sabotage control: the naive encoder no longer collides on this pair — the teeth row is stale');
    assert.ok(!canonical(left).equals(canonical(right)), 'the canonical encoder must separate them');
    const { publicKey, privateKey } = keypair();
    const sig = sign(privateKey, left);
    assert.ok(verify(publicKey, left, sig));
    assert.equal(verify(publicKey, right, sig), false, 'a signature over left verified right — THE INVARIANT IS BROKEN');
  }
});

test('cross-key: a different key\'s signature is not this key\'s authorization', () => {
  const other = keypair();
  const sig = sign(other.privateKey, base());
  assert.equal(verify(keypair().publicKey, base(), sig), false);
  assert.ok(verify(other.publicKey, base(), sig), 'control');
});
