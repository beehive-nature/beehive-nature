// Discriminating experiment: does Jungle4's deployed eosio.msig exec re-check
// stored approvals? Fresh proposal, NEVER approved, cleanly-executable inner
// action (transfer to the faucet — self-transfers are refused by this chain's
// eosio.token). If exec succeeds without any approval, the deployed contract
// does not gate execution on the approval set the way c526479a does.
import { packTransaction, transactionId, signatureDigest, taposFromHeadBlockId,
  packProposeData, packExecData, packCancelData, packTransferData, sha256 } from './codec.mjs';
import { loadAccountKeys } from './keys.mjs';
import { Rpc, ENDPOINTS, JUNGLE4_CHAIN_ID } from './rpc.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PERSIST = join(HERE, 'probe-exec-auth-state.json');
const st = existsSync(PERSIST) ? JSON.parse(readFileSync(PERSIST, 'utf8')) : {};

const rpc = new Rpc(ENDPOINTS.primary);
const keys = loadAccountKeys();
const ACCOUNT = 'bzcodejungle';
const DELEGATED = 'wbfoursignr';

async function tapos(expSec = 3600) {
  const info = await rpc.get_info();
  if (info.body.chain_id !== JUNGLE4_CHAIN_ID) throw new Error('chain id');
  const headTime = Math.floor(Date.parse(info.body.head_block_time + 'Z') / 1000);
  const t = taposFromHeadBlockId(info.body.head_block_id);
  return { t, expiration: headTime + expSec };
}

async function push(action, signer) {
  const { t, expiration } = await tapos();
  const packed = packTransaction({ expiration, refBlockNum: t.refBlockNum, refBlockPrefix: t.refBlockPrefix, delaySec: 0, actions: [action] });
  const txid = transactionId(packed);
  const sig = signDigestSafe(signer, signatureDigest(JUNGLE4_CHAIN_ID, packed));
  const res = await rpc.push_transaction([sig], packed.toString('hex'));
  return { res, txid };
}

const { signDigest } = await import('./keys.mjs');
function signDigestSafe(k, d) { return signDigest(k.secret, d); }

const name = st.proposal || (st.proposal = 'wb4auth' + 'abcdefghjklmnpqrstuvwxyz'[Math.floor(Math.random() * 24)] + 'abcdefghjklmnpqrstuvwxyz'[Math.floor(Math.random() * 24)]);
writeFileSync(PERSIST, JSON.stringify(st));

// 1. propose with inner transfer to junglefaucet, requested wbfoursignr, NEVER approve
{
  const { t, expiration } = await tapos();
  const inner = packTransaction({
    expiration, refBlockNum: t.refBlockNum, refBlockPrefix: t.refBlockPrefix, delaySec: 0,
    actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packTransferData(ACCOUNT, 'junglefaucet', '0.0001 EOS', 'wb004 exec-auth probe ' + name) }],
  });
  const propose = await push({ account: 'eosio.msig', name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packProposeData(ACCOUNT, name, [{ actor: ACCOUNT, permission: DELEGATED }], inner) }, keys.active);
  console.log('propose:', propose.res.ok ? 'ACCEPTED ' + propose.txid : 'REFUSED ' + Rpc.refusedBecause(propose.res));
  if (!propose.res.ok) process.exit(1);
}

// 2. confirm NO approvals provided (retry — reads can lag the pushing node)
let row = null;
for (let i = 0; i < 12 && !row; i++) {
  const r = await rpc.get_table_rows({ json: true, code: 'eosio.msig', scope: ACCOUNT, table: 'approvals2', limit: 10 });
  row = r.body.rows.find((x) => x.proposal_name === name);
  if (!row) await new Promise((res) => setTimeout(res, 600));
}
console.log('approvals2:', JSON.stringify({ requested: row ? row.requested_approvals.length : 'missing', provided: row ? row.provided_approvals.length : 'missing' }));
if (!row || row.provided_approvals.length !== 0) { console.log('UNEXPECTED approvals2 state'); process.exit(1); }

// 3. exec WITHOUT approval — the discriminator
{
  const e = await push({ account: 'eosio.msig', name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) }, keys.active);
  if (e.res.ok) {
    console.log('*** EXEC SUCCEEDED WITH ZERO APPROVALS — deployed contract does NOT gate exec on stored approvals (divergence from c526479a). txid ' + e.txid);
    process.exit(0);
  }
  const msg = Rpc.refusedBecause(e.res);
  console.log('exec refused (as the reference would):', msg.slice(0, 160));
}
