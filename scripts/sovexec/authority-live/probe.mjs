// SOVEXEC-002 — antelope-authority against a live Antelope node (Jungle4).
//
// Builds the permission graphs the conformance corpus uses as CUSTOM
// PERMISSIONS of one disposable test account (bzcodejungle), then asks the
// chain its verdict for every case through /v1/chain/get_required_keys
// (read-only: candidate PUBLIC keys in, the required subset or a refusal
// out) and, for the minimum-permission rows that get_required_keys does not
// gate, through a handful of real pushes of a 0.0001 EOS donation to
// junglefaucet. Everything the chain answered is written to the receipt;
// crates/antelope-authority/tests/live_agreement.rs replays the receipt
// through the model and must agree row by row.
//
// Laws honored: keys from DPAPI custody through the WB004 kit (plaintext never
// printed, never on disk); one push per step, NEVER a re-signed replacement on
// an unresolved outcome (the 2026-10-13 WB004 correction); every acceptance
// is confirmed by a chain read or recorded as unresolved; no production
// authority touched; the account's links are left exactly as found (none).
//
// Usage: node probe.mjs            (resumable: state.json records progress)
//        node probe.mjs --cases    (skip setup; re-ask the chain only)
import {
  Writer, packTransaction, transactionId, signatureDigest, taposFromHeadBlockId,
  packTransferData, packUpdateAuthData, packLinkAuthData, encodeName,
} from '../../btungsten/wb004-live/codec.mjs';
import {
  loadAccountKeys, loadLaneKeys, saveLaneKey, randomSecret, signDigest, derivePublic, pubEncodings,
} from '../../btungsten/wb004-live/keys.mjs';
import { Rpc, ENDPOINTS, JUNGLE4_CHAIN_ID } from '../../btungsten/wb004-live/rpc.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(HERE, 'state.json');
const RECEIPT_DIR = join(HERE, '..', '..', '..', 'docs', 'receipts', 'sovexec-002');
const RECEIPT_PATH = join(RECEIPT_DIR, 'receipt-authority-live.json');
const A = 'bzcodejungle';
const FAUCET = 'junglefaucet';
const TOKEN = 'eosio.token';
const CASES_ONLY = process.argv.includes('--cases');

const rpc = new Rpc(ENDPOINTS.primary);
const rpc2 = new Rpc(ENDPOINTS.secondary);
// Both JSON files are written as ONE line carrying the marker key: the
// pre-commit hex law wants PUBLIC-CONSTANT on the same line as any long hex
// (transaction and block ids of a public testnet), and the estate's receipt
// JSON files satisfy it exactly this way (docs/receipts/*.json). Read them
// with jq.
export const MARKER = 'PUBLIC-CONSTANT: on-chain transaction ids, block ids and public keys of the Jungle4 testnet; no key material';
const oneLine = (obj) => JSON.stringify({ marker: MARKER, ...obj }) + '\n';
const st = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : { perms: {}, pushes: {}, started: new Date().toISOString() };
const save = () => writeFileSync(STATE_PATH, oneLine(st));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (why) => { log('STOP:', why); save(); process.exit(1); };

// ---- keys ------------------------------------------------------------------
// account keys (active, owner) from DPAPI; lane keys for the custom
// permissions, generated once and kept in the same custody file under the
// AL_* generations; only public encodings ever leave this process
const acct = loadAccountKeys();
let lane = loadLaneKeys();
for (const gen of ['AL_C', 'AL_D', 'AL_G', 'AL_W']) {
  if (!lane[gen]) {
    if (CASES_ONLY) die('lane key ' + gen + ' missing; run setup first');
    saveLaneKey(gen, randomSecret());
    lane = loadLaneKeys();
    log('lane key', gen, 'created');
  }
}
const K = {
  a: acct.active, c: lane.AL_C, d: lane.AL_D, g: lane.AL_G, w: lane.AL_W,
};
const pub34 = (k) => '00' + Buffer.from(derivePublic(k.secret)).toString('hex');
const legacy = (k) => pubEncodings(Buffer.from(derivePublic(k.secret))).legacy;

// ---- chain ------------------------------------------------------------------
async function info() {
  const r = await rpc.get_info();
  if (!r.ok) die('get_info: ' + (r.chainMessage || r.transportError));
  if (r.body.chain_id !== JUNGLE4_CHAIN_ID) die('chain id mismatch');
  return r.body;
}
async function tapos(expSec = 120) {
  const i = await info();
  const headTime = Math.floor(Date.parse(i.head_block_time + 'Z') / 1000);
  return { ...taposFromHeadBlockId(i.head_block_id), expiration: headTime + expSec };
}
async function account(name) {
  const r = await rpc.get_account(name);
  if (!r.ok) die('get_account ' + name + ': ' + (r.chainMessage || r.transportError));
  return r.body;
}
function permOf(acc, name) {
  return acc.permissions.find((p) => p.perm_name === name) || null;
}

// one push, one signature, one verdict; never a replacement
async function push(action, signer) {
  const { refBlockNum, refBlockPrefix, expiration } = await tapos();
  const packed = packTransaction({ expiration, refBlockNum, refBlockPrefix, delaySec: 0, actions: [action] });
  const txid = transactionId(packed);
  const sig = signDigest(signer.secret, signatureDigest(JUNGLE4_CHAIN_ID, packed));
  const res = await rpc.push_transaction([sig], packed.toString('hex'));
  return { res, txid, blockNum: res.ok && res.body.processed ? res.body.processed.block_num : null };
}

// ---- authority packing (full authority: keys, accounts, waits) ---------------
const nameKey = (s) => encodeName(s);
function sortedAuthority(spec) {
  const keys = [...(spec.keys || [])].sort((x, y) => (x.pub34 < y.pub34 ? -1 : x.pub34 > y.pub34 ? 1 : 0));
  const accounts = [...(spec.accounts || [])].sort((x, y) => {
    const ax = nameKey(x.actor), ay = nameKey(y.actor);
    if (ax !== ay) return ax < ay ? -1 : 1;
    const px = nameKey(x.permission), py = nameKey(y.permission);
    return px < py ? -1 : px > py ? 1 : 0;
  });
  const waits = [...(spec.waits || [])].sort((x, y) => x.wait_sec - y.wait_sec);
  return { threshold: spec.threshold, keys, accounts, waits };
}
function packAuthorityFull(spec) {
  const s = sortedAuthority(spec);
  const w = new Writer();
  w.u32le(s.threshold);
  w.varuint32(s.keys.length);
  for (const k of s.keys) { w.bytes(Buffer.from(k.pub34, 'hex')); w.u16le(k.weight); }
  w.varuint32(s.accounts.length);
  for (const a of s.accounts) { w.permissionLevel(a.actor, a.permission); w.u16le(a.weight); }
  w.varuint32(s.waits.length);
  for (const t of s.waits) { w.u32le(t.wait_sec); w.u16le(t.weight); }
  return w.build();
}
// the get_account shape of the same authority, for comparison and the receipt
function authorityJson(spec) {
  const s = sortedAuthority(spec);
  return {
    threshold: s.threshold,
    keys: s.keys.map((k) => ({ key: k.legacy, weight: k.weight })),
    accounts: s.accounts.map((a) => ({ permission: { actor: a.actor, permission: a.permission }, weight: a.weight })),
    waits: s.waits.map((t) => ({ wait_sec: t.wait_sec, weight: t.weight })),
  };
}
function sameAuthority(chainAuth, spec) {
  return JSON.stringify(chainAuth) === JSON.stringify(authorityJson(spec));
}
const key1 = (k) => ({ pub34: pub34(k), legacy: legacy(k), weight: 1 });
const acc1 = (actor, permission) => ({ actor, permission, weight: 1 });

// ---- the graphs -------------------------------------------------------------
// creation order respects references (updateauth refuses a reference to a
// permission that does not exist yet); the cycle is closed in a second
// updateauth of alcyca
const PLAN = [
  ['alcust', 'active', { threshold: 1, keys: [key1(K.c)] }],
  ['aldeep', 'alcust', { threshold: 1, keys: [key1(K.d)] }],
  ['alxacct', 'active', { threshold: 1, accounts: [acc1(FAUCET, 'active')] }],
  ['alcyca', 'active', { threshold: 1, keys: [key1(K.c)] }], // temporary, closed below
  ['alcycb', 'active', { threshold: 1, accounts: [acc1(A, 'alcyca')] }],
  ['alcyca', 'active', { threshold: 1, accounts: [acc1(A, 'alcycb')] }], // the cycle
  ['allinkg', 'active', { threshold: 1, keys: [key1(K.g)] }],
  ['allinkf', 'active', { threshold: 1, accounts: [acc1(A, 'allinkg')] }],
  ['allinke', 'active', { threshold: 1, accounts: [acc1(A, 'allinkf')] }],
  ['allinkd', 'active', { threshold: 1, accounts: [acc1(A, 'allinke')] }],
  ['allinkc', 'active', { threshold: 1, accounts: [acc1(A, 'allinkd')] }],
  ['allinkb', 'active', { threshold: 1, accounts: [acc1(A, 'allinkc')] }],
  ['allinka', 'active', { threshold: 1, accounts: [acc1(A, 'allinkb')] }],
  ['allinkz', 'active', { threshold: 1, accounts: [acc1(A, 'allinkb')] }],
  ['altop', 'active', { threshold: 1, accounts: [acc1(A, 'allinkb'), acc1(A, 'allinkf')] }],
  ['altopb', 'active', { threshold: 1, accounts: [acc1(A, 'allinkf'), acc1(A, 'allinkz')] }],
  ['alwait', 'active', { threshold: 2, keys: [key1(K.w)], waits: [{ wait_sec: 3600, weight: 1 }] }],
  ['aldedup', 'active', { threshold: 2, accounts: [acc1(A, 'alcust'), acc1(A, 'aldeep')] }],
];

async function setup() {
  log('setup: account', A, 'on', ENDPOINTS.primary);
  for (const [perm, parent, spec] of PLAN) {
    const before = permOf(await account(A), perm);
    if (before && before.parent === parent && sameAuthority(before.required_auth, spec)) {
      log('perm', perm, 'already as planned, skipped');
      st.perms[perm] = { ...(st.perms[perm] || {}), parent, authority: authorityJson(spec), confirmed: true };
      save();
      continue;
    }
    const action = {
      account: 'eosio', name: 'updateauth',
      authorization: [{ actor: A, permission: 'active' }],
      data: packUpdateAuthData(A, perm, parent, packAuthorityFull(spec)),
    };
    const { res, txid, blockNum } = await push(action, K.a);
    if (!res.ok) die('updateauth ' + perm + ' refused: ' + Rpc.refusedBecause(res));
    log('updateauth', perm, 'accepted', txid, 'block', blockNum);
    st.perms[perm] = { parent, authority: authorityJson(spec), txid, blockNum, confirmed: false };
    save();
    // confirm by state read (reads can lag the pushing node); never re-push
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) {
      await sleep(1500);
      const now = permOf(await account(A), perm);
      ok = !!(now && now.parent === parent && sameAuthority(now.required_auth, spec));
    }
    if (!ok) die('updateauth ' + perm + ' accepted (' + txid + ') but the permission did not appear as planned within 30 s: UNRESOLVED, not retried');
    st.perms[perm].confirmed = true;
    save();
  }
  log('setup complete:', Object.keys(st.perms).length, 'permissions confirmed');
}

// ---- get_required_keys cases ------------------------------------------------
function grkTrx(declared, delaySec, i) {
  const headTime = Math.floor(Date.parse(i.head_block_time + 'Z') / 1000);
  return {
    expiration: new Date((headTime + 600) * 1000).toISOString().slice(0, 19),
    ref_block_num: i.head_block_num & 0xffff, ref_block_prefix: 0,
    max_net_usage_words: 0, max_cpu_usage_ms: 0, delay_sec: delaySec, context_free_actions: [],
    actions: [{ account: TOKEN, name: 'transfer', authorization: [{ actor: A, permission: declared }], data: '' }],
    transaction_extensions: [],
  };
}
async function grk(client, declared, candidates, delaySec) {
  const i = await info();
  const r = await client.call('/v1/chain/get_required_keys', { transaction: grkTrx(declared, delaySec, i), available_keys: candidates });
  if (r.ok) return { ok: true, required_keys: r.body.required_keys };
  return { ok: false, httpStatus: r.httpStatus, message: (r.chainMessage || r.transportError || '').slice(0, 200) };
}

async function runCases(faucetKey) {
  const C = { a: legacy(K.a), c: legacy(K.c), d: legacy(K.d), g: legacy(K.g), w: legacy(K.w), f: faucetKey };
  const rows = [
    ['r01', 'active', ['a'], 0, 'the active key satisfies active'],
    ['r02', 'active', [], 0, 'no keys: unsatisfied'],
    ['r03', 'alcust', ['c'], 0, 'a custom permission satisfied by its own key'],
    ['r04', 'alcust', ['a'], 0, 'the active key does not satisfy a child permission'],
    ['r05', 'alxacct', ['f'], 0, 'cross-account delegation: the faucet active key satisfies alxacct (class 1 would look for junglefaucet@alxacct)'],
    ['r06', 'alxacct', ['c'], 0, 'cross-account delegation: an unrelated key does not'],
    ['r07', 'alcyca', [], 0, 'a two-node cycle terminates unsatisfied'],
    ['r08', 'alcyca', ['c', 'd', 'g', 'w'], 0, 'a cycle with no keys stays unsatisfied whatever is offered'],
    ['r09', 'allinkb', ['g'], 0, 'five delegation edges: the key at authority depth 6 counts'],
    ['r10', 'allinka', ['g'], 0, 'six delegation edges: the sixth edge is not followed (class 3 would approve)'],
    ['r11', 'alwait', ['w'], 3600, 'a wait counts under a sufficient delay'],
    ['r12', 'alwait', ['w'], 0, 'a wait does not count under zero delay'],
    ['r13', 'alwait', ['w'], 3599, 'a wait does not count one second short'],
    ['r14', 'aldedup', ['c'], 0, 'two permissions of one actor: one key is not both (class 2 would count it twice)'],
    ['r15', 'aldedup', ['c', 'd'], 0, 'two permissions of one actor: both keys satisfy'],
    ['r16', 'altop', ['g'], 0, 'the depth artifact: allinkf reached first at depth 5 is cached UNSATISFIED and the direct edge reads the cache'],
    ['r17', 'altopb', ['g'], 0, 'the same structure with the direct edge sorted first is satisfied'],
    ['r18', 'alcycb', ['c'], 0, 'the other node of the cycle, unsatisfied'],
    ['r19', 'aldeep', ['d'], 0, 'a grandchild permission satisfied by its own key'],
    ['r20', 'active', ['a', 'c'], 0, 'an irrelevant candidate is not among the required keys'],
    ['r21', 'nosuchperm', ['a'], 0, 'an unknown permission is unsatisfied, not an error of another kind'],
    ['r22', 'aldedup', ['a'], 0, 'the parent key satisfies neither child by itself'],
  ];
  const out = [];
  for (const [id, declared, cands, delay, claim] of rows) {
    const candidates = cands.map((n) => C[n]);
    const primary = await grk(rpc, declared, candidates, delay);
    const secondary = await grk(rpc2, declared, candidates, delay);
    const agree = primary.ok === secondary.ok && JSON.stringify([...(primary.required_keys || [])].sort()) === JSON.stringify([...(secondary.required_keys || [])].sort());
    log(id, declared, 'cands', cands.join(','), 'delay', delay, '->', primary.ok ? 'SAT ' + primary.required_keys.length + ' keys' : 'UNSAT', agree ? '(both nodes agree)' : '(NODES DISAGREE)');
    out.push({ id, claim, declared: { actor: A, permission: declared }, candidates, delay_sec: delay, chain: primary, secondary, nodes_agree: agree });
  }
  return out;
}

// ---- the push rows (minimum permission through real transactions) -----------
const linkData = (code, type, requirement) => packLinkAuthData(A, code, type, requirement);
const unlinkData = (code, type) => new Writer().name(A).name(code).name(type).build();
const transfer = (declared, memo) => ({
  account: TOKEN, name: 'transfer',
  authorization: [{ actor: A, permission: declared }],
  data: packTransferData(A, FAUCET, '0.0001 EOS', memo),
});

async function confirmIncluded(txid) {
  // Hyperion history on the primary; an absent row after the window is
  // UNRESOLVED (recorded as such, never re-pushed)
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const r = await rpc.history_get_transaction(txid);
    if (r.ok && r.body && (r.body.executed || r.body.trx_id === txid || r.body.actions)) {
      const b = r.body.actions && r.body.actions[0] ? r.body.actions[0].block_num : (r.body.block_num || null);
      return { included: true, block_num: b };
    }
  }
  return { included: false };
}

async function pushRow(id, claim, action, signer, expect, linksAtTime) {
  if (st.pushes[id] && st.pushes[id].done) {
    log(id, 'already done, skipped');
    return st.pushes[id];
  }
  const { res, txid, blockNum } = await push(action, signer);
  const row = {
    id, claim, expect, links_at_time: linksAtTime,
    declared: action.authorization[0], signer: legacy(signer),
    action: { account: action.account, name: action.name },
    chain: res.ok
      ? { accepted: true, txid, block_num_at_push: blockNum }
      : { accepted: false, message: (res.chainMessage || res.transportError || '').slice(0, 240) },
  };
  if (res.ok) {
    const inc = await confirmIncluded(txid);
    row.chain.included = inc.included;
    row.chain.block_num = inc.block_num || null;
    if (!inc.included) row.chain.note = 'accepted by the pushing node; inclusion not confirmed through history within 30 s; UNRESOLVED, not re-pushed';
  }
  const matches = expect === 'accepted' ? res.ok : (!res.ok && /irrelevant/i.test(row.chain.message));
  row.matches_expectation = matches;
  log(id, res.ok ? 'ACCEPTED ' + txid : 'REFUSED ' + (res.chainMessage || '').slice(0, 90), matches ? '(as expected)' : '(UNEXPECTED)');
  if (!matches) die(id + ' did not match the expectation; the receipt records the actual answer');
  if (!res.ok || row.chain.included) row.done = true;
  st.pushes[id] = row;
  save();
  return row;
}

async function runPushes() {
  const rows = [];
  rows.push(await pushRow('p01', 'without a link, a grandchild permission is irrelevant for eosio.token::transfer (minimum is active)', transfer('aldeep', 'sovexec-002 p01'), K.d, 'refused', []));
  rows.push(await pushRow('p02', 'linkauth eosio.token::transfer -> alcust', { account: 'eosio', name: 'linkauth', authorization: [{ actor: A, permission: 'active' }], data: linkData(TOKEN, 'transfer', 'alcust') }, K.a, 'accepted', []));
  const L1 = [{ code: TOKEN, type: 'transfer', requirement: 'alcust' }];
  rows.push(await pushRow('p03', 'with the link, alcust satisfies the minimum', transfer('alcust', 'sovexec-002 p03'), K.c, 'accepted', L1));
  rows.push(await pushRow('p04', 'with the link, the grandchild below alcust is still irrelevant', transfer('aldeep', 'sovexec-002 p04'), K.d, 'refused', L1));
  rows.push(await pushRow('p05', 'with the link, the ancestor active still satisfies the minimum', transfer('active', 'sovexec-002 p05'), K.a, 'accepted', L1));
  rows.push(await pushRow('p06', 'linkauth eosio.token::transfer -> eosio.any (replaces the alcust link)', { account: 'eosio', name: 'linkauth', authorization: [{ actor: A, permission: 'active' }], data: linkData(TOKEN, 'transfer', 'eosio.any') }, K.a, 'accepted', L1));
  const L2 = [{ code: TOKEN, type: 'transfer', requirement: 'eosio.any' }];
  rows.push(await pushRow('p07', 'under eosio.any there is no minimum: the grandchild is accepted', transfer('aldeep', 'sovexec-002 p07'), K.d, 'accepted', L2));
  rows.push(await pushRow('p08', 'unlinkauth eosio.token::transfer (the account returns to no links)', { account: 'eosio', name: 'unlinkauth', authorization: [{ actor: A, permission: 'active' }], data: unlinkData(TOKEN, 'transfer') }, K.a, 'accepted', L2));
  rows.push(await pushRow('p09', 'after the unlink, alcust is irrelevant again', transfer('alcust', 'sovexec-002 p09'), K.c, 'refused', []));
  return rows;
}

// ---- main -------------------------------------------------------------------
const i0 = await info();
const i2 = await rpc2.get_info();
log('chain', i0.chain_id, 'primary', i0.server_version_string, 'head', i0.head_block_num, '| secondary', i2.ok ? i2.body.server_version_string : 'unreachable');
if (!CASES_ONLY) await setup();
const accA = await account(A);
const accF = await account(FAUCET);
const faucetKey = permOf(accF, 'active').required_auth.keys[0].key;
const cases = await runCases(faucetKey);
const pushes = CASES_ONLY ? Object.values(st.pushes) : await runPushes();
const i1 = await info();
mkdirSync(RECEIPT_DIR, { recursive: true });
const receipt = {
  lane: 'sovexec-002-authority-live',
  at: new Date().toISOString(),
  chain: {
    chain_id: i0.chain_id,
    primary: { url: ENDPOINTS.primary, server_version_string: i0.server_version_string, head_block_num_start: i0.head_block_num, head_block_num_end: i1.head_block_num },
    secondary: { url: ENDPOINTS.secondary, server_version_string: i2.ok ? i2.body.server_version_string : null },
  },
  account: A,
  faucet: FAUCET,
  keys: { active: legacy(K.a), AL_C: legacy(K.c), AL_D: legacy(K.d), AL_G: legacy(K.g), AL_W: legacy(K.w), faucet_active: faucetKey },
  accounts: {
    [A]: accA.permissions.map((p) => ({ perm_name: p.perm_name, parent: p.parent, required_auth: p.required_auth })),
    [FAUCET]: accF.permissions.map((p) => ({ perm_name: p.perm_name, parent: p.parent, required_auth: p.required_auth })),
  },
  setup: st.perms,
  cases,
  pushes,
  links_final: [],
  notes: [
    'get_required_keys applies authority satisfaction only (authorization_manager::get_required_keys), not the minimum-permission gate; the push rows cover that gate',
    'candidate keys are public keys; the chain answers with the subset it used (checker.used_keys) or refuses',
    'the custom permissions are left on the account so anyone can re-ask the chain the same questions; the links are removed (links_final)',
  ],
};
writeFileSync(RECEIPT_PATH, oneLine(receipt));
log('receipt written', RECEIPT_PATH, 'cases', cases.length, 'pushes', pushes.length);
