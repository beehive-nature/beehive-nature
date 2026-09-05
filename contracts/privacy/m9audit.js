// m9audit.js — the stranger's audit of the two-tier anchoring (M9).
// Recomputes the checkpoint chain from the chain's OWN tables (nullifiers
// sorted by seq — each row carries its fee legs since M9) and checks every
// anchor row commits the recomputed CHAIN HEAD at its seq. No history
// plugin, no receipts list — the anchor binds (seq, head) only.
//   node m9audit.js   (reads m9-ckpt.json, m9-anchors.json, m9-nulls.json
//                      as dumped by m9run.sh; NODE_PATH=<node_modules dir>)
// DISPLAY LAW (measured live, M9): the table hex for the nullifier and the
// head is ALREADY the byte form that flows through the fold — use it raw,
// genesis = 32 zero bytes. (The M6 T-compensation applies on the
// extract()-of-memcpy'd-storage path inside the contract, not here.)
const fs = require('fs');
const { keccak256 } = require('js-sha3');

const be32word = v => {                  // u64 -> 32-byte BE word (low 8 bytes, zero-filled)
  const w = Buffer.alloc(32);
  let x = BigInt(v);
  for (let i = 0; i < 8; i++) { w[31 - i] = Number(x & 0xffn); x >>= 8n; }
  return w.toString('hex');
};

const ckpt = JSON.parse(fs.readFileSync('m9-ckpt.json', 'utf8')).rows[0];
const anchors = JSON.parse(fs.readFileSync('m9-anchors.json', 'utf8')).rows;
const nulls = JSON.parse(fs.readFileSync('m9-nulls.json', 'utf8')).rows;
nulls.sort((a, b) => Number(a.seq) - Number(b.seq));

// recompute: link_i = keccak(seq ‖ nullifier ‖ fee ‖ feeAsset);
//            head_i = keccak(head_{i-1} ‖ link_i);  head_0 = 32 zero bytes
let head = Buffer.alloc(32).toString('hex');
const heads = { 0: head };
for (const r of nulls) {
  const link = keccak256(
    Buffer.from(be32word(r.seq) + r.n + be32word(r.fee) + be32word(r.fee_asset), 'hex'));
  head = keccak256(Buffer.from(head + link, 'hex'));
  heads[Number(r.seq)] = head;
}

let fails = 0;
for (const a of anchors) {
  const ok = heads[Number(a.seq)] === a.head;
  if (!ok) fails++;
  console.log(`  anchor ${a.id}: commits seq ${a.seq} — recomputed head ${ok ? 'MATCHES' : 'MISMATCH'}`);
}
const ckOk = heads[Number(ckpt.seq)] === ckpt.head;
if (!ckOk) fails++;
console.log(`  checkpoint singleton: seq ${ckpt.seq} — recomputed head ${ckOk ? 'MATCHES' : 'MISMATCH'}`);
console.log(`  nullifiers folded: ${nulls.length} (seq ${nulls[0].seq}..${nulls[nulls.length - 1].seq})`);
console.log(fails === 0 ? 'AUDIT PASS — every anchor commits the recomputed chain head' : `AUDIT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
