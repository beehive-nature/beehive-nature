// A reader owns this template. Only the clock, nonce sequence and verified hash
// change per completion. The caller must consume it synchronously before reuse.
const enc = new TextEncoder();
const DOMAIN = enc.encode('ant/verified-read/v1');
const CAP = enc.encode('diagnostic/observe');

export function createObservationRequest(address, authority, action) {
  const request = new Uint8Array(1024), view = new DataView(request.buffer);
  request.set([1, 1]);
  request.set(authority, 10);
  const policy = 42;
  request[policy] = DOMAIN.length; request.set(DOMAIN, policy + 1);
  request[policy + 260] = CAP.length; request.set(CAP, policy + 261);
  view.setUint32(policy + 536, 32, true);
  const envelope = 584;
  request.set(enc.encode('bT-WB01'), envelope); request[envelope + 7] = 1;
  let cursor = envelope + 8;
  const field = (tag, value) => {
    request[cursor++] = tag;
    view.setUint32(cursor, value.length); cursor += 4;
    const offset = cursor;
    request.set(value, cursor); cursor += value.length;
    return offset;
  };
  field(1, DOMAIN);
  const nonce = field(2, authority);
  const issued = field(3, new Uint8Array(8));
  field(4, action);
  field(5, enc.encode(address));
  field(6, CAP);
  field(7, new Uint8Array(8)); // zero amount; observation grants no spending
  const expiry = field(8, new Uint8Array(8));
  field(9, enc.encode('local-observer'));
  const payload = field(10, new Uint8Array(32));
  view.setUint16(582, cursor - envelope, true);
  const used = request.subarray(0, cursor);
  return (clock, sequence, hash) => {
    view.setBigUint64(2, BigInt(clock), true);
    view.setBigUint64(nonce + 24, BigInt(sequence));
    view.setBigUint64(issued, BigInt(clock));
    view.setBigUint64(expiry, BigInt(clock + 60));
    request.set(hash, payload);
    return used;
  };
}
