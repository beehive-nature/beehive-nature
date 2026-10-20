import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createObservationRequest} from './observation-request.mjs';

// Independent reference encoder retained from the pre-optimization wire layout.
// Compare every byte, not just an accepted verdict: the binding must be identical.
const enc = new TextEncoder();
const uint = (n, bytes, little = false) => {
  const b = Buffer.alloc(bytes);
  if (bytes === 8) little ? b.writeBigUInt64LE(BigInt(n)) : b.writeBigUInt64BE(BigInt(n));
  if (bytes === 4) little ? b.writeUInt32LE(n) : b.writeUInt32BE(n);
  if (bytes === 2) little ? b.writeUInt16LE(n) : b.writeUInt16BE(n);
  return b;
};
const block = (tag, bytes) => Buffer.concat([Buffer.from([tag]), uint(bytes.length, 4), bytes]);
const reference = (address, authority, action, clock, sequence, hash) => {
  const domain = enc.encode('ant/verified-read/v1'), cap = enc.encode('diagnostic/observe');
  const policy = Buffer.alloc(540);
  policy[0] = domain.length; policy.set(domain, 1);
  policy[260] = cap.length; policy.set(cap, 261); policy.set(uint(32, 4, true), 536);
  const nonce = authority.slice(); nonce.set(uint(sequence, 8), 24);
  const envelope = Buffer.concat([enc.encode('bT-WB01'), Buffer.from([1]),
    block(1, domain), block(2, nonce), block(3, uint(clock, 8)),
    block(4, action), block(5, enc.encode(address)), block(6, cap),
    block(7, uint(0, 8)), block(8, uint(clock + 60, 8)),
    block(9, enc.encode('local-observer')), block(10, hash)]);
  return Buffer.concat([Buffer.from([1, 1]), uint(clock, 8, true),
    authority, policy, uint(envelope.length, 2, true), envelope]);
};
test('reused template preserves every policy and binding byte across sequence carries and time/hash changes', () => {
  const authority = Uint8Array.from({length:32}, (_, i) => i);
  const action = Uint8Array.from({length:32}, (_, i) => 255 - i);
  for (const address of ['a'.repeat(64), '0123456789abcdef'.repeat(4)]) {
    const encode = createObservationRequest(address, authority, action);
    for (const sequence of [1, 255, 256, 65536, 2 ** 32, Number.MAX_SAFE_INTEGER]) {
      const clock = 1792512000 + sequence % 1000;
      const hash = new Uint8Array(32).fill(sequence % 251);
      assert.deepEqual(Buffer.from(encode(clock, sequence, hash)),
        reference(address, authority, action, clock, sequence, hash));
    }
  }
});
