// WB004 live lane — offline selftest (no network, node:crypto only where possible).
//
// What this pins offline:
//   - LEB128 varuint32 public vectors
//   - name encoder structural invariants (bit-shape, char legality, 13th-char cap)
//   - TAPOS derivation shape
//   - base58check round-trips and the REAL pinned vectors from
//     public.json (the account's own EOS / PUB_K1 encodings of the same two
//     pubkeys — external constants recorded at account creation)
// What is NOT claimed offline: full transaction packing — that is arbitrated
// live by abi_json_to_bin byte-equality plus the chain echoing
// transaction_id = sha256(packed_trx) on every accepted push (see the run
// receipt).
import {
  Writer, encodeName, base58Encode, base58Decode, base58CheckEncode, base58CheckDecode,
  encodeQuantity, taposFromHeadBlockId, packTransaction, transactionId,
} from './codec.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

// varuint32 public vectors (LEB128)
{
  const w = new Writer();
  for (const v of [0, 1, 127, 128, 300, 16383, 16384, 65535, 0xfffffff]) w.varuint32(v);
  const b = w.build();
  const expect = [
    0x00, 0x01, 0x7f, 0x80, 0x01, 0xac, 0x02, 0xff, 0x7f, 0x80, 0x80, 0x01,
    0xff, 0xff, 0x03, 0xff, 0xff, 0xff, 0x7f,
  ];
  check('varuint32 LEB128 vectors', Buffer.compare(b, Buffer.from(expect)) === 0, [...b].map(x => x.toString(16)).join(' '));
}

// name encoder structural invariants
{
  check('name: all-dots is zero', encodeName('.') === 0n);
  check('name: 13th char cap refuses z', (() => { try { encodeName('zzzzzzzzzzzzz'); return false; } catch { return true; } })());
  check('name: 13th char a-p accepted', encodeName('zzzzzzzzzzzza') !== undefined);
  check('name: >13 refused', (() => { try { encodeName('aaaaaaaaaaaaaa'); return false; } catch { return true; } })());
  check('name: dot-in-middle ok (eosio.token)', encodeName('eosio.token') > 0n);
  // bit-shape: a 12-char name of all-z fills exactly the top 60 bits (low 4 zero)
  const z = encodeName('zzzzzzzzzzzz');
  check('name: 12 z fills 60 bits', (z & 0xfn) === 0n && (z >> 4n) === (1n << 60n) - 1n);
  // monotonic padding law: 'a' == 'a.' == 'a..' (trailing dots are zero-fill)
  check('name: trailing dots are padding', encodeName('a') === encodeName('a.') && encodeName('a') === encodeName('a..'));
}

// base58 + base58check round trips
{
  for (const len of [0, 1, 7, 32, 33]) {
    const b = new Uint8Array(len).map((_, i) => (i * 37 + 11) & 0xff);
    check('base58 roundtrip len=' + len, Buffer.compare(base58Decode(base58Encode(b)), Buffer.from(b)) === 0);
  }
  const payload = Buffer.from('wb004 selftest payload', 'utf8');
  const enc = base58CheckEncode(payload);
  check('base58check roundtrip', Buffer.compare(base58CheckDecode(enc), payload) === 0);
  check('base58 known vector: 0x00 -> "1"', base58Encode(new Uint8Array([0])) === '1');
  check('base58 known vector: 0x02 -> "3" (digit charset is value-offset)', base58Encode(new Uint8Array([2])) === '3');
  check('base58 known vector: 00 01 -> "12"', base58Encode(new Uint8Array([0, 1])) === '12');
}

// REAL pinned vectors: the account's own public key encodings (public.json)
{
  const pub = JSON.parse(readFileSync(join(process.env.LOCALAPPDATA, 'BeehiveNature', 'jungle4', 'bzcodejungle', 'public.json'), 'utf8'));
  let anchored = 0;
  for (const perm of ['active', 'owner']) {
    const legacy = pub[perm].legacy;
    const k1 = pub[perm].pub_k1;
    // both must decode to the same 33-byte point; legacy = 'EOS' + b58(pub + rmd160(pub)[:4])
    const legacyBytes = base58Decode(legacy.slice(3));
    const k1Bytes = base58Decode(k1.slice(7));
    const ptLegacy = legacyBytes.subarray(0, 33);
    const ptK1 = k1Bytes.subarray(0, 33);
    check('public.json ' + perm + ': legacy/PUB_K1 same point', Buffer.compare(ptLegacy, ptK1) === 0);
    if (Buffer.compare(ptLegacy, ptK1) === 0) anchored++;
  }
  check('public.json anchors present', anchored === 2);
}

// quantity
{
  const q = encodeQuantity('0.0001 EOS');
  check('quantity 0.0001 EOS is 16 bytes', q.length === 16);
  const view = new DataView(q.buffer, q.byteOffset, q.byteLength);
  check('quantity amount=1', view.getBigUint64(0, true) === 1n);
  check('quantity precision=4 sym=EOS', q[8] === 4 && String.fromCharCode(q[9], q[10], q[11]) === 'EOS' && q[12] === 0 && q[15] === 0);
}

// TAPOS
{
  // fabricated head id: blocknum 0x01166BE2 in first 4 bytes, distinct bytes at 8..11
  const id = Buffer.alloc(32);
  id.writeUInt32BE(291729890, 0);
  Buffer.from([0xde, 0xad, 0xbe, 0xef]).copy(id, 8);
  const t = taposFromHeadBlockId(id.toString('hex'));
  check('tapos: ref_block_num = num & 0xffff', t.refBlockNum === (291729890 & 0xffff));
  check('tapos: ref_block_prefix = LE u32 at 8', t.refBlockPrefix === 0xefbeadde);
}

// transaction shape
{
  const packed = packTransaction({
    expiration: 1760000000,
    refBlockNum: 0x1234,
    refBlockPrefix: 0xdeadbeef,
    delaySec: 0,
    actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'a', permission: 'active' }], data: new Uint8Array([1, 2, 3]) }],
  });
  check('packed transaction deterministic', transactionId(packed) === transactionId(packTransaction({
    expiration: 1760000000,
    refBlockNum: 0x1234,
    refBlockPrefix: 0xdeadbeef,
    delaySec: 0,
    actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'a', permission: 'active' }], data: new Uint8Array([1, 2, 3]) }],
  })));
  check('tx id is 64 hex', /^[0-9a-f]{64}$/.test(transactionId(packed)));
  // header shape: 4+2+4+1+1+1 = 13 bytes before vectors; vector counts 1 varuint each
  check('header prefix shape', packed[0] === 0x00 && packed.length > 13);
}

console.log(failures === 0 ? 'SELFTEST GREEN' : 'SELFTEST RED: ' + failures + ' failure(s)');
process.exit(failures === 0 ? 0 : 1);
