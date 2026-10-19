// Consumer of the frozen bheart.signature/1 envelope. No new signer contract.
// Uses the estate's existing vendored noble ML-DSA-65 implementation; the
// native test crosses this verifier with crates/bsigner's RustCrypto organ.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
require('../../surfaces/onboarding/vendor/bpq-lib.js');
const { ml_dsa65 } = globalThis.BPQ_LIB;
const sha3 = bytes => createHash('sha3-256').update(bytes).digest('base64url');
function decode(text, size) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('base64url');
  const bytes = Buffer.from(text, 'base64url');
  if (bytes.length !== size || bytes.toString('base64url') !== text) throw new Error('base64url size');
  return bytes;
}
export function verifyEnvelope(key, bytes, envelope) {
  try {
    if (key?.alg !== 'ml-dsa-65') return false;
    const publicKey = decode(key.public_key, 1952);
    const keyId = `bheart-${sha3(Buffer.concat([Buffer.from(key.alg), publicKey])).slice(0, 16)}`;
    if (key.id !== keyId || envelope?.key_id !== keyId || envelope.type !== 'bheart.signature/1' || envelope.alg !== key.alg || envelope.signature?.alg !== key.alg) return false;
    if (envelope.content?.bytes !== bytes.length || envelope.content?.digest?.bytes !== bytes.length || envelope.content?.digest?.alg !== 'sha3-256' || envelope.content?.digest?.b64u !== sha3(bytes)) return false;
    if (envelope.signature.bytes !== 3309) return false;
    return ml_dsa65.verify(decode(envelope.signature.b64u, 3309), bytes, publicKey);
  } catch { return false; }
}
