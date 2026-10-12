// WB004 live lane — pure Antelope wire codec (node:crypto only).
//
// Offline acceptance: selftest.mjs pins the algorithmic invariants (name
// round-shape, varuint vectors, TAPOS split, empty-vector shapes) plus the
// public.json EOS/PUB_K1 encodings as base58 vectors. The live acceptance
// vector is the chain itself: nodeos echoes transaction_id = sha256(packed_trx),
// so any packing slip surfaces as an id mismatch or a rejected push.
import { createHash } from 'node:crypto';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest();
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  if (bytes.length === 0) return '';
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) {
    s = '1' + s;
    i++;
  }
  return s;
}

export function base58Decode(s) {
  if (s === '') return new Uint8Array(0);
  let n = 0n;
  for (const ch of s) {
    const idx = B58.indexOf(ch);
    if (idx < 0) throw new Error('base58 bad char: ' + ch);
    n = n * 58n + BigInt(idx);
  }
  const out = [];
  let lead = 0;
  while (s[lead] === '1') lead++;
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  return new Uint8Array([...new Array(lead).fill(0), ...out]);
}

export function base58CheckEncode(payload, prefix) {
  const h1 = sha256(payload);
  const h2 = sha256(h1);
  return base58Encode(new Uint8Array([...payload, ...h2.subarray(0, 4)]));
}

export function base58CheckDecode(s) {
  const raw = base58Decode(s);
  if (raw.length < 5) throw new Error('base58check too short');
  const payload = raw.subarray(0, raw.length - 4);
  const check = raw.subarray(raw.length - 4);
  const h = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) {
    if (h[i] !== check[i]) throw new Error('base58check mismatch');
  }
  return payload;
}

// ---- names ----

const NAME_CHARS = '.12345abcdefghijklmnopqrstuvwxyz';

export function encodeName(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 13) {
    throw new Error('bad name length: ' + JSON.stringify(s));
  }
  let v = 0n;
  const padded = s.length === 13 ? s : s.padEnd(12, '.');
  for (let i = 0; i < 12; i++) {
    const idx = NAME_CHARS.indexOf(padded[i]);
    if (idx < 0) throw new Error('bad name char in ' + JSON.stringify(s));
    v = (v << 5n) | BigInt(idx);
  }
  if (s.length === 13) {
    const idx = NAME_CHARS.indexOf(s[12]);
    if (idx < 0 || idx > 15) throw new Error('bad 13th name char in ' + JSON.stringify(s));
    v = (v << 4n) | BigInt(idx);
  } else {
    v <<= 4n;
  }
  return v;
}

// ---- binary writer ----

export class Writer {
  constructor() {
    this.parts = [];
    this.length = 0;
  }
  u8(v) {
    if (!Number.isInteger(v) || v < 0 || v > 0xff) throw new Error('u8 out of range');
    this.parts.push(Buffer.from([v]));
    this.length += 1;
    return this;
  }
  u16le(v) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v);
    this.parts.push(b);
    this.length += 2;
    return this;
  }
  u32le(v) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v);
    this.parts.push(b);
    this.length += 4;
    return this;
  }
  u64le(v) {
    if (typeof v !== 'bigint') throw new Error('u64le wants bigint');
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(v);
    this.parts.push(b);
    this.length += 8;
    return this;
  }
  varuint32(v) {
    if (!Number.isInteger(v) || v < 0) throw new Error('varuint32 wants uint');
    let x = v;
    do {
      let byte = x & 0x7f;
      x = Math.floor(x / 128);
      if (x > 0) byte |= 0x80;
      this.parts.push(Buffer.from([byte]));
      this.length += 1;
    } while (x > 0);
    return this;
  }
  bytes(u8) {
    this.parts.push(Buffer.from(u8));
    this.length += u8.length;
    return this;
  }
  name(s) {
    return this.u64le(encodeName(s));
  }
  string(s) {
    const b = Buffer.from(s, 'utf8');
    this.varuint32(b.length);
    return this.bytes(b);
  }
  uint8Array(u8) {
    this.varuint32(u8.length);
    return this.bytes(u8);
  }
  permissionLevel(actor, permission) {
    return this.name(actor).name(permission);
  }
  build() {
    return Buffer.concat(this.parts);
  }
}

// ---- assets ----

export function encodeQuantity(q) {
  // "0.0001 EOS" → { amount u64le, precision u8, symbol_code 7 bytes zero-padded }
  const m = /^(\d+)\.(\d+) ([A-Z]{1,7})$/.exec(q);
  if (!m) throw new Error('bad quantity: ' + q);
  const [, whole, frac, sym] = m;
  const amount = BigInt(whole + frac);
  const precision = frac.length;
  const symBytes = Buffer.alloc(7);
  Buffer.from(sym, 'ascii').copy(symBytes, 0);
  const w = new Writer();
  w.u64le(amount).u8(precision).bytes(symBytes);
  return w.build();
}

// ---- transactions ----

export function taposFromHeadBlockId(headBlockIdHex) {
  const id = Buffer.from(headBlockIdHex, 'hex');
  if (id.length !== 32) throw new Error('bad head block id');
  const blockNum = id.readUInt32BE(0);
  return { refBlockNum: blockNum & 0xffff, refBlockPrefix: id.readUInt32LE(8) };
}

// actions: [{ account, name, authorization: [{actor, permission}], data: Uint8Array }]
export function packTransaction({ expiration, refBlockNum, refBlockPrefix, delaySec = 0, maxNetUsageWords = 0, maxCpuUsageMs = 0, actions = [] }) {
  const w = new Writer();
  w.u32le(expiration); // epoch seconds
  w.u16le(refBlockNum & 0xffff);
  w.u32le(refBlockPrefix >>> 0);
  w.varuint32(maxNetUsageWords);
  w.u8(maxCpuUsageMs);
  w.varuint32(delaySec);
  w.varuint32(0); // context_free_actions
  w.varuint32(actions.length);
  for (const act of actions) {
    w.name(act.account).name(act.name);
    w.varuint32(act.authorization.length);
    for (const a of act.authorization) w.permissionLevel(a.actor, a.permission);
    w.uint8Array(act.data);
  }
  w.varuint32(0); // transaction_extensions
  return w.build();
}

export function transactionId(packedTrx) {
  return sha256(packedTrx).toString('hex');
}

export function signatureDigest(chainIdHex, packedTrx) {
  const cid = Buffer.from(chainIdHex, 'hex');
  if (cid.length !== 32) throw new Error('bad chain id');
  return sha256(Buffer.concat([cid, packedTrx, Buffer.alloc(32)]));
}

// eosio.msig propose action data: proposer, proposal_name, requested[] — then
// the packed transaction appended RAW (the contract reads it via ignore<> +
// datastream remainder, no length prefix).
export function packProposeData(proposer, proposalName, requested, packedTrx) {
  const w = new Writer();
  w.name(proposer).name(proposalName);
  w.varuint32(requested.length);
  for (const r of requested) w.permissionLevel(r.actor, r.permission);
  w.bytes(packedTrx);
  return w.build();
}

export function packApproveData(proposer, proposalName, level, proposalHashHex) {
  const w = new Writer();
  w.name(proposer).name(proposalName).permissionLevel(level.actor, level.permission);
  if (proposalHashHex !== undefined && proposalHashHex !== null) {
    // binary_extension present: exactly 32 bytes appended
    const h = Buffer.from(proposalHashHex, 'hex');
    if (h.length !== 32) throw new Error('proposal hash must be 32 bytes');
    w.bytes(h);
  }
  return w.build();
}

export function packUnapproveData(proposer, proposalName, level) {
  const w = new Writer();
  w.name(proposer).name(proposalName).permissionLevel(level.actor, level.permission);
  return w.build();
}

export function packExecData(proposer, proposalName, executer) {
  const w = new Writer();
  w.name(proposer).name(proposalName).name(executer);
  return w.build();
}

export function packCancelData(proposer, proposalName, canceler) {
  const w = new Writer();
  w.name(proposer).name(proposalName).name(canceler);
  return w.build();
}

export function packInvalidateData(account) {
  const w = new Writer();
  w.name(account);
  return w.build();
}

// eosio.token transfer action data
export function packTransferData(from, to, quantity, memo) {
  const w = new Writer();
  w.name(from).name(to).bytes(encodeQuantity(quantity)).string(memo);
  return w.build();
}

// eosio updateauth: account, permission, parent, authority{threshold,keys,accounts,waits}
// publicKey wire: 0x00 (K1) + 33-byte compressed point.
export function packAuthority(threshold, pubKeysWithWeights) {
  const w = new Writer();
  w.u32le(threshold);
  w.varuint32(pubKeysWithWeights.length);
  for (const { key, weight } of pubKeysWithWeights) {
    const b = Buffer.from(key, 'hex'); // 34 bytes: 00 + 33, or 66-hex-char string
    w.bytes(b);
    w.u16le(weight);
  }
  w.varuint32(0); // accounts
  w.varuint32(0); // waits
  return w.build();
}

export function packUpdateAuthData(account, permission, parent, authorityBytes) {
  const w = new Writer();
  w.name(account).name(permission).name(parent).bytes(authorityBytes);
  return w.build();
}

export function packLinkAuthData(account, code, type, permission) {
  const w = new Writer();
  w.name(account).name(code).name(type).name(permission);
  return w.build();
}
