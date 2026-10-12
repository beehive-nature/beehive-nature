// Ground-truth check: recover signers of REAL chain transactions using our
// digest + fc layout, compare with the accounts' on-chain keys. Public data only.
import { Rpc, ENDPOINTS, JUNGLE4_CHAIN_ID } from './rpc.mjs';
import { base58Decode, signatureDigest } from './codec.mjs';
import { recoverFromK1, pubEncodings } from './keys.mjs';

const rpc = new Rpc(ENDPOINTS.primary);
const info = await rpc.get_info();
let checked = 0, matched = 0;
outer:
for (let off = 10; off < 800 && checked < 4; off += 7) {
  const b = await rpc.call('/v1/chain/get_block', { block_num_or_id: info.body.head_block_num - off });
  if (!b.ok) continue;
  for (const t of (b.body.transactions || [])) {
    if (!(t.trx && t.trx.packed_trx && t.trx.signatures && t.trx.transaction)) continue;
    const jsonTx = t.trx.transaction;
    if (!jsonTx.actions) continue;
    const auths = [];
    for (const a of jsonTx.actions) for (const au of (a.authorization || [])) auths.push(au);
    if (!auths.length) continue;
    const sigStr = t.trx.signatures.find((s) => s.startsWith('SIG_K1_'));
    if (!sigStr) continue;
    const dig = signatureDigest(JUNGLE4_CHAIN_ID, Buffer.from(t.trx.packed_trx, 'hex'));
    let pub;
    try { pub = recoverFromK1(sigStr, dig); } catch (e) { console.log('recover threw:', e.message); continue; }
    const enc = pubEncodings(pub);
    const accounts = [...new Set(auths.map((a) => a.actor))];
    for (const actor of accounts) {
      const acct = await rpc.get_account(actor);
      if (!acct.ok) continue;
      const keys = new Set();
      for (const p of acct.body.permissions) for (const k of p.required_auth.keys || []) keys.add(k.key);
      checked++;
      const hit = keys.has(enc.legacy) || keys.has(enc.k1);
      if (hit) matched++;
      console.log('tx signer for', actor + ':', hit ? 'KEY MATCH (' + (keys.has(enc.legacy) ? 'legacy' : 'pub_k1') + ')' : 'no key match');
    }
    if (checked >= 4) break outer;
  }
}
console.log('GROUND TRUTH: ' + matched + '/' + checked + ' recovered signers match on-chain keys');
process.exit(matched === checked && checked > 0 ? 0 : 1);
