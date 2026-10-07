// wb001-intent.mjs — bTunGsTeN Workbench 001: the canonical BNR intent
// envelope and the binding verifier it is attacked through.
//
// THE INVARIANT (SPEC-BTUNGSTEN-1 §workbench): no valid signature may
// authorize any intent other than the exact intent that was committed to.
// One bit of drift in destination, capability, amount, domain, nonce,
// epoch, expiry, payer, action or payload must break verification.
//
// Canonical form (the formal twin lives in wb001-cryptol/Intent.cry):
//   envelope := magic "bT-WB01" (7 ASCII bytes) || version 0x01 || tlv*
//   tlv      := tag (1 byte) || length (4 bytes, big-endian u32) || value
//   tags appear exactly once each, in strictly ascending order, and
//   nothing follows the last tlv. u64 fields are exactly 8 big-endian
//   bytes; bytes32 fields exactly 32; text fields are UTF-8 within their
//   bounds. Anything else is refused — the verifier fails closed.
//
// The signature is Ed25519 over the full envelope bytes (node:crypto).
// Domain separation is carried INSIDE the signed bytes (the domain field
// plus the magic), never by context, so a signature never travels between
// protocols silently.
//
// naiveConcat() at the bottom is the SABOTAGE encoder — the classic
// length-free concatenation whose {ab,c}/{a,bc} ambiguity is exactly the
// class the framing exists to kill. It exists only so the battery can
// convict it (the teeth row); nothing may ever import it for real work.

import { generateKeyPairSync, sign as edSign, verify as edVerify } from 'node:crypto';

export const MAGIC = Buffer.from('bT-WB01', 'ascii'); // 7 bytes, domain-separating envelope magic
export const VERSION = 0x01;

export const U64_MAX = (1n << 64n) - 1n;

export class Refusal extends Error {
  constructor(code, message) { super(message); this.refusal = code; }
}

// The one legal field order. `kind' fixes the value encoding; bounds are
// in bytes of encoded value.
export const FIELDS = [
  { tag: 0x01, name: 'domain', kind: 'utf8', min: 1, max: 64 },
  { tag: 0x02, name: 'nonce', kind: 'bytes32' },
  { tag: 0x03, name: 'epoch', kind: 'u64' },
  { tag: 0x04, name: 'action', kind: 'bytes32' },
  { tag: 0x05, name: 'destination', kind: 'utf8', min: 1, max: 128 },
  { tag: 0x06, name: 'capability', kind: 'utf8', min: 1, max: 64 },
  { tag: 0x07, name: 'amount', kind: 'u64' },
  { tag: 0x08, name: 'expiry', kind: 'u64' },
  { tag: 0x09, name: 'payer', kind: 'utf8', min: 1, max: 128 },
  { tag: 0x0a, name: 'payload', kind: 'raw', min: 0, max: 4096 },
];
export const FIELD_NAMES = FIELDS.map((f) => f.name);

function encodedValue(field, value) {
  if (field.kind === 'u64') {
    if (typeof value !== 'bigint') throw new Refusal('bt-wb01:type', `${field.name}: u64 fields are BigInt, got ${typeof value}`);
    if (value < 0n || value > U64_MAX) throw new Refusal('bt-wb01:bounds', `${field.name}: outside u64`);
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(value);
    return b;
  }
  if (field.kind === 'bytes32') {
    if (!Buffer.isBuffer(value) || value.length !== 32) throw new Refusal('bt-wb01:type', `${field.name}: exactly 32 bytes`);
    return value;
  }
  if (field.kind === 'utf8') {
    if (typeof value !== 'string') throw new Refusal('bt-wb01:type', `${field.name}: text field, got ${typeof value}`);
    const b = Buffer.from(value, 'utf8');
    if (b.length < field.min || b.length > field.max) throw new Refusal('bt-wb01:bounds', `${field.name}: ${b.length} bytes, bounds ${field.min}..${field.max}`);
    return b;
  }
  // raw
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) throw new Refusal('bt-wb01:type', `${field.name}: byte field`);
  const b = Buffer.from(value);
  if (b.length < field.min || b.length > field.max) throw new Refusal('bt-wb01:bounds', `${field.name}: ${b.length} bytes, bounds ${field.min}..${field.max}`);
  return b;
}

// canonical(intent) -> envelope bytes. Deterministic; throws typed
// Refusals on every violation. There is exactly one canonical form per
// intent: that is the property the whole workbench stands on.
export function canonical(intent) {
  if (intent === null || typeof intent !== 'object') throw new Refusal('bt-wb01:type', 'intent: object');
  const out = [MAGIC, Buffer.from([VERSION])];
  for (const field of FIELDS) {
    if (!(field.name in intent)) throw new Refusal('bt-wb01:missing-field', `${field.name} absent`);
    const v = encodedValue(field, intent[field.name]);
    const tlv = Buffer.alloc(5);
    tlv[0] = field.tag;
    tlv.writeUInt32BE(v.length, 1);
    out.push(tlv, v);
  }
  for (const k of Object.keys(intent)) {
    if (!FIELD_NAMES.includes(k)) throw new Refusal('bt-wb01:unknown-field', `${k} is not a canonical field`);
  }
  return Buffer.concat(out);
}

// decode(envelope) -> intent, strict: magic, version, ascending tags,
// exact bounds, exact consumption. Any drift refuses with a typed code.
export function decode(env) {
  if (!Buffer.isBuffer(env)) throw new Refusal('bt-wb01:type', 'envelope: bytes');
  if (env.length < MAGIC.length + 1) throw new Refusal('bt-wb01:short', 'not even a header');
  if (!env.subarray(0, MAGIC.length).equals(MAGIC)) throw new Refusal('bt-wb01:magic', 'wrong magic');
  if (env[MAGIC.length] !== VERSION) throw new Refusal('bt-wb01:version', `version ${env[MAGIC.length]}`);
  let at = MAGIC.length + 1;
  const intent = {};
  for (const field of FIELDS) {
    if (at + 5 > env.length) throw new Refusal('bt-wb01:short', `${field.name}: no room for its tlv header`);
    if (env[at] !== field.tag) throw new Refusal('bt-wb01:tag-order', `offset ${at}: tag 0x${env[at].toString(16)}, expected 0x${field.tag.toString(16)} (${field.name})`);
    const len = env.readUInt32BE(at + 1);
    const max = field.kind === 'u64' ? 8 : field.kind === 'bytes32' ? 32 : field.max;
    const min = field.kind === 'u64' || field.kind === 'bytes32' ? (field.kind === 'u64' ? 8 : 32) : field.min;
    if (len < min || len > max) throw new Refusal('bt-wb01:length', `${field.name}: length ${len}, bounds ${min}..${max}`);
    if (at + 5 + len > env.length) throw new Refusal('bt-wb01:short', `${field.name}: value runs past the end`);
    const v = env.subarray(at + 5, at + 5 + len);
    if (field.kind === 'u64') intent[field.name] = v.readBigUInt64BE(0);
    else if (field.kind === 'bytes32') intent[field.name] = Buffer.from(v);
    else if (field.kind === 'utf8') intent[field.name] = v.toString('utf8');
    else intent[field.name] = Buffer.from(v);
    at += 5 + len;
  }
  if (at !== env.length) throw new Refusal('bt-wb01:trailing', `${env.length - at} trailing bytes after the last tlv`);
  return intent;
}

export function keypair() { return generateKeyPairSync('ed25519'); }

export function sign(priv, intent) { return edSign(null, canonical(intent), priv); }

// The binding verifier: structural truth AND cryptographic truth, both.
// verifyEnvelope refuses (returns false — never throws past this seam) on
// any malformed envelope; a receipt over anything but the exact canonical
// bytes of the exact intent does not exist.
export function verifyEnvelope(pub, env, sig) {
  try { decode(env); } catch { return false; }
  return edVerify(null, env, pub, sig);
}

export function verify(pub, intent, sig) {
  try { return verifyEnvelope(pub, canonical(intent), sig); } catch { return false; }
}

// SABOTAGE ENCODER — battery teeth only, never import for real work.
// Concatenates the encoded values with no tags and no lengths, which is
// the historic ambiguity bug: different intents, same bytes, one
// authorization crossing between them.
export function naiveConcat(intent) {
  return Buffer.concat(FIELDS.map((f) => encodedValue(f, intent[f.name])));
}
