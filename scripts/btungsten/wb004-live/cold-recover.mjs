// WB004 live lane — COLD RECOVERY.
//
// A replacement worker (original browser, coordinator, and MSIG.app all
// unavailable) reconstructs and verifies the lifecycle from TWO inputs only:
//   1. the public receipt file (transaction ids, block hints, public keys)
//   2. the Jungle4 chain via public RPC (two independent providers)
// No keys, no DPAPI, no session state, no private memory. Any mismatch exits
// nonzero with the failing assertion.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Rpc, ENDPOINTS, JUNGLE4_CHAIN_ID } from './rpc.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RECEIPT = process.argv[2] || join(HERE, 'receipt-wb004-live.json');

const receipt = JSON.parse(readFileSync(RECEIPT, 'utf8'));
const PRIMARY = new Rpc(ENDPOINTS.primary);
const SECONDARY = new Rpc(ENDPOINTS.secondary);

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name + (detail ? ' — ' + detail : ''));
  else { failures++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

// 1. chain identity on both providers
for (const [tag, rpc] of [['primary', PRIMARY], ['secondary', SECONDARY]]) {
  const info = await rpc.get_info();
  check(tag + ' chain id', info.ok && info.body.chain_id === JUNGLE4_CHAIN_ID, info.ok ? 'head ' + info.body.head_block_num + ' lib ' + info.body.last_irreversible_block_num : 'transport');
}

// 2. locate every accepted txid from the receipt in real blocks (window scan
//    around the recorded block hint; decoded actions come from the chain's own
//    block JSON, not from our packing)
const accepted = receipt.steps.filter((s) => s.outcome === 'accepted' && s.txid);
console.log('locating ' + accepted.length + ' accepted transactions in blocks…');
const located = [];
for (const step of accepted) {
  const hint = step.blockNum || 0;
  let found = null;
  scan: for (let b = Math.max(1, hint - 4); b <= hint + 260; b++) {
    const r = await PRIMARY.call('/v1/chain/get_block', { block_num_or_id: b });
    if (!r.ok || !Array.isArray(r.body.transactions)) continue;
    for (const t of r.body.transactions) {
      const id = t.trx && typeof t.trx === 'object' ? (t.trx.id ?? t.id) : t.id;
      if (id === step.txid) { found = { block: b, status: t.status }; break scan; }
    }
  }
  check('tx ' + step.txid.slice(0, 8) + ' (' + step.action + ') located', !!found && found.status === 'executed', found ? 'block ' + found.block : 'NOT FOUND');
  if (found) located.push({ step, block: found.block });
}

// 3. the exec of P1's first instance must be irreversible and dual-provider
//    agreed (block-id equal + tx present on the secondary too)
const execStep = located.find((l) => l.step.action === 'eosio.msig::exec');
if (execStep) {
  const info = await PRIMARY.get_info();
  check('P1 exec irreversible', info.body.last_irreversible_block_num >= execStep.block, 'lib ' + info.body.last_irreversible_block_num + ' ≥ block ' + execStep.block);
  const [pri, sec] = [await PRIMARY.call('/v1/chain/get_block', { block_num_or_id: execStep.block }),
                      await SECONDARY.call('/v1/chain/get_block', { block_num_or_id: execStep.block })];
  const idsEqual = pri.ok && sec.ok && pri.body.id === sec.body.id;
  let txInSec = false;
  if (sec.ok) for (const t of (sec.body.transactions || [])) {
    const id = t.trx && typeof t.trx === 'object' ? (t.trx.id ?? t.id) : t.id;
    if (id === execStep.step.txid && t.status === 'executed') txInSec = true;
  }
  check('dual-provider block agreement', idsEqual && txInSec, 'block-id ' + (idsEqual ? 'EQUAL' : 'DIFFERS') + ', exec present on secondary: ' + txInSec);
} else {
  check('P1 exec located', false, 'no executed eosio.msig::exec step found');
}

// 4. rebuilt timeline purely from chain blocks (replacement-worker view)
console.log('\nrebuilt lifecycle from chain data:');
for (const l of located) {
  const r = await PRIMARY.call('/v1/chain/get_block', { block_num_or_id: l.block });
  const acts = [];
  for (const t of (r.body.transactions || [])) {
    const id = t.trx && typeof t.trx === 'object' ? (t.trx.id ?? t.id) : t.id;
    if (id !== l.step.txid) continue;
    for (const a of ((t.trx && t.trx.transaction && t.trx.transaction.actions) || [])) {
      const d = a.data || {};
      acts.push(a.account + '::' + a.name + (d.proposal_name ? ' ' + (d.proposer || '') + '/' + d.proposal_name : '') + (a.authorization && a.authorization[0] ? ' as ' + a.authorization[0].actor + '@' + a.authorization[0].permission : ''));
    }
  }
  console.log('  block ' + l.block + ' — ' + acts.join(' | '));
}

// 5. final on-chain state: delegated permission exists with the rotation key,
//    proposal scope swept clean
const acct = await PRIMARY.get_account(receipt.account);
const perm = acct.ok && acct.body.permissions.find((p) => p.perm_name === receipt.delegated_permission);
check('delegated permission present', !!perm && perm.parent === 'active', perm ? 'key ' + ((perm.required_auth.keys[0] || {}).key || '(none)') : 'missing');
if (perm) {
  const chainKey = (perm.required_auth.keys[0] || {}).key || '';
  const want = receipt.K3_pub || {};
  check('rotation key in place', chainKey === want.k1 || chainKey === want.legacy, 'chain ' + chainKey.slice(0, 12) + '… vs K3 ' + ((want.k1 || '').slice(0, 12)) + '… (legacy/PUB_K1 encodings accepted)');
}
const links = new Set((perm && perm.linked_actions || []).map((l) => l.account + '::' + (l.action ?? l.type)));
check('links: approve + unapprove + transfer', links.has('eosio.msig::approve') && links.has('eosio.msig::unapprove') && links.has('eosio.token::transfer'), [...links].join(','));
const rows = await PRIMARY.get_table_rows({ json: true, code: 'eosio.msig', scope: receipt.account, table: 'proposal', limit: 50 });
check('proposal scope swept', rows.ok && rows.body.rows.length === 0, rows.ok ? rows.body.rows.map((r) => r.proposal_name).join(',') || 'clean' : 'read failed');

console.log(failures === 0 ? '\nCOLD RECOVERY GREEN — state fully reconstructed and verified from chain + public receipt' : '\nCOLD RECOVERY RED: ' + failures + ' failure(s)');
process.exit(failures === 0 ? 0 : 1);
