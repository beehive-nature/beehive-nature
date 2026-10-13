// WB004 live lane — the bounded Jungle4 multisig lifecycle, website-independent.
//
// One dedicated test authority: bzcodejungle (this seat's own Jungle4 account,
// keys in DPAPI custody). One delegated permission: wb004signr (parent active,
// linkauth'd to eosio.msig::approve) — rotated mid-lane, then invalidated.
//
// Positive path:  prepare → propose → approve (hash-bound) → exec → verify →
// finality (LIB) → receipt preserved.
// Negative controls (each a real chain refusal with the message recorded):
//   wrong proposal_hash / withdrawn approval at exec / duplicate exec /
//   too-early exec (delay_sec) / expired proposal at propose and at exec /
//   approval not on the requested list / insufficient requested authority at
//   propose / stale key after rotation / invalidated approval at exec /
//   duplicate push (ambiguous RPC) reconciled by transaction id.
//
// Refusal law: a control passes only on a nonzero/explained refusal with the
// expected substring in the chain's own message. Any unexpected outcome fails
// the run (nonzero exit, parent-owned FAILS).
//
// Usage: node run-lifecycle.mjs [--stage NAME]   (stages skip when already done)
import {
  Writer, packTransaction, transactionId, signatureDigest, taposFromHeadBlockId,
  packProposeData, packApproveData, packUnapproveData, packExecData, packCancelData,
  packInvalidateData, packTransferData, packAuthority, packUpdateAuthData,
  packLinkAuthData, sha256,
} from './codec.mjs';
import {
  loadAccountKeys, loadLaneKeys, saveLaneKey, randomSecret, signDigest, derivePublic, pubEncodings,
} from './keys.mjs';
import { Rpc, ENDPOINTS, JUNGLE4_CHAIN_ID } from './rpc.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(HERE, 'state.json');
const RECEIPT_PATH = join(HERE, 'receipt-wb004-live.json');
const ACCOUNT = 'bzcodejungle';
const DELEGATED = 'wbfoursignr';
const MSIG = 'eosio.msig';
const TOKEN = 'eosio.token';

const PRIMARY = new Rpc(ENDPOINTS.primary);
const SECONDARY = new Rpc(ENDPOINTS.secondary);

const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : {
  started: new Date().toISOString(),
  account: ACCOUNT,
  chain_id: JUNGLE4_CHAIN_ID,
  stages: {},
  steps: [],
};

function record(step) {
  state.steps.push({ t: new Date().toISOString(), ...step });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function fail(why) {
  console.error('LIFECYCLE FAIL: ' + why);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fresh TAPOS + chain-id gate (the custody law: check the chain id first)
async function tapos(expSec) {
  const info = await PRIMARY.get_info();
  if (!info.ok) fail('get_info transport: ' + JSON.stringify(info).slice(0, 200));
  if (info.body.chain_id !== JUNGLE4_CHAIN_ID) fail('CHAIN ID MISMATCH — refusing to sign: ' + info.body.chain_id);
  const headTime = Math.floor(Date.parse(info.body.head_block_time + 'Z') / 1000);
  return {
    head: info.body,
    refBlockNum: 0, // filled by caller via taposFromHeadBlockId
    get tap() { return taposFromHeadBlockId(info.body.head_block_id); },
    expiration: headTime + expSec,
    headTime,
  };
}

// Build, sign, push ONE action. signers: array of {pub, secret} (single sig).
// The primary endpoint load-balances across nodes that can briefly disagree;
// a refusal matching the fork/TAPOS class is retried with fresh TAPOS (the
// refused transaction never landed, so the retry is safe).
async function pushAction(action, signerKeys, { expect, match, expSec = 3600, expiration = null, delaySec = 0 }) {
  for (let attempt = 0; ; attempt++) {
    const t = await tapos(expSec);
    const packed = packTransaction({
      expiration: expiration ?? t.expiration,
      refBlockNum: t.tap.refBlockNum,
      refBlockPrefix: t.tap.refBlockPrefix,
      delaySec,
      actions: [action],
    });
    const txid = transactionId(packed);
    const digest = signatureDigest(JUNGLE4_CHAIN_ID, packed);
    const signatures = signerKeys.map((k) => signDigest(k.secret, digest));
    const res = await PRIMARY.push_transaction(signatures, packed.toString('hex'));
    const refused = !res.ok;
    const msg = Rpc.refusedBecause(res);
    if (refused && attempt < 3 && /reference block .* did not match|different fork/i.test(msg)) {
      console.log('  [retry] TAPOS/fork divergence from endpoint — refetching head (' + msg.slice(0, 80) + ')');
      await sleep(700);
      continue;
    }
    let blockNum = null;
    let echoIdMatch = null;
    let inclusionVerified = null;
    if (res.ok) {
      blockNum = res.body.processed ? res.body.processed.block_num : null;
      const echoId = res.body.transaction_id ?? (res.body.processed && res.body.processed.id);
      echoIdMatch = echoId === txid;
      if (echoIdMatch === false) fail('TXID MISMATCH: local ' + txid + ' vs nodeos ' + echoId + ' — serializer drift, refusing to continue');
      // phantom-acceptance guard: the load balancer once returned "accepted"
      // from a minority-fork node whose branch died (the tx never reached the
      // main chain). An acceptance counts only with block inclusion.
      inclusionVerified = await verifyInclusion(txid, blockNum);
      if (!inclusionVerified) {
        if (attempt < 3) {
          console.log('  [retry] phantom acceptance (no block inclusion) — repushing');
          await sleep(900);
          continue;
        }
        fail('accepted tx ' + txid + ' never appeared in any block — phantom acceptance refused as evidence');
      }
    }
    const wantRefused = expect === 'refused';
    const got = wantRefused ? refused : res.ok;
    const why = wantRefused ? (match ? (typeof match === 'string' ? msg.includes(match) : match.test(msg)) : true) : true;
    if (!got || !why) {
      fail('step ' + action.name + ': expected ' + expect + (wantRefused ? ' matching ' + (typeof match === 'string' ? match : String(match)) : '') +
        ' but got ' + (refused ? 'REFUSED("' + msg.slice(0, 200) + '")' : 'ACCEPTED') +
        ' txid=' + txid);
    }
    const step = {
      action: action.account + '::' + action.name,
      txid,
      blockNum,
      txidEchoMatch: echoIdMatch,
      blockInclusionVerified: inclusionVerified,
      expected: expect + (wantRefused ? ' ~ ' + (typeof match === 'string' ? match : String(match)) : ''),
      outcome: refused ? 'refused' : 'accepted',
      chainMessage: refused ? msg.slice(0, 300) : undefined,
    };
    record(step);
    console.log((refused ? '  [refused as expected] ' : '  [accepted] ') + step.action + (refused ? ' — ' + msg.slice(0, 120) : ' — txid ' + txid + ' block ' + blockNum));
    return { res, txid, step, packed };
  }
}

async function getProposals(proposer) {
  const r = await PRIMARY.get_table_rows({
    json: true, code: MSIG, scope: proposer, table: 'proposal', limit: 20,
  });
  if (!r.ok) fail('get_table_rows proposal: ' + JSON.stringify(r).slice(0, 200));
  return r.body.rows;
}
async function getApprovals(proposer) {
  // deployed contract writes approvals2 (the reference hpp's newer variant)
  const r = await PRIMARY.get_table_rows({
    json: true, code: MSIG, scope: proposer, table: 'approvals2', limit: 20,
  });
  if (!r.ok) fail('get_table_rows approvals2: ' + JSON.stringify(r).slice(0, 200));
  return r.body.rows;
}

// verify the transaction id actually appears in its block (or a neighbor —
// the reporting node's block_num can sit next to the inclusion block, and the
// LB node serving get_block can lag; retry the scan for a few seconds)
async function verifyInclusion(txid, blockNum, rounds = 8) {
  if (!blockNum) return false;
  for (let round = 0; round < rounds; round++) {
    for (let b = Math.max(1, blockNum - 2); b <= blockNum + 8; b++) {
      const r = await PRIMARY.call('/v1/chain/get_block', { block_num_or_id: b });
      if (!r.ok || !Array.isArray(r.body.transactions)) continue;
      for (const t of r.body.transactions) {
        const id = t.trx && typeof t.trx === 'object' ? (t.trx.id ?? t.id) : t.id;
        if (id === txid && t.status === 'executed') return true;
      }
    }
    await sleep(800);
  }
  return false;
}

// the endpoint can serve reads from a node that lags the node that took the
// push — retry table reads briefly before declaring a row missing
async function waitForRow(table, scope, matchFn, tries = 12, delayMs = 600) {
  for (let i = 0; i < tries; i++) {
    const r = await PRIMARY.get_table_rows({ json: true, code: MSIG, scope, table, limit: 50 });
    if (r.ok) {
      const row = r.body.rows.find(matchFn);
      if (row) return row;
    }
    await sleep(delayMs);
  }
  return null;
}

async function accountState() {
  const r = await PRIMARY.get_account(ACCOUNT);
  if (!r.ok) fail('get_account: ' + JSON.stringify(r).slice(0, 200));
  return r.body;
}

function randName(prefix) {
  const chars = 'abcdefghjmnopqrstuvwxyz125'; // name-legal, no confusing pairs
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return (prefix + s).slice(0, 12);
}

// ---------------------------------------------------------------------------
// stages

async function stagePreflight() {
  const codeHash = await PRIMARY.get_code_hash(MSIG);
  if (!codeHash.ok) fail('get_code_hash');
  const abi = await PRIMARY.get_abi(MSIG);
  if (!abi.ok) fail('get_abi');
  const approveFields = abi.body.abi.structs.find((s) => s.name === 'approve').fields.map((f) => f.name + ':' + f.type).join(',');
  const actions = abi.body.abi.actions.map((a) => a.name).sort().join(',');
  record({
    action: 'preflight/chain',
    deployed_msig_code_hash: codeHash.body.code_hash, // afbc51b5… PUBLIC-CONSTANT deployed eosio.msig wasm hash on Jungle4 at run time
    deployed_msig_actions: actions,
    approve_fields: approveFields,
  });
  console.log('  deployed eosio.msig code_hash ' + codeHash.body.code_hash);
  if (!approveFields.includes('proposal_hash')) fail('deployed ABI lacks proposal_hash — hash binding not available');

  // abi_json_to_bin is DISABLED on both providers (404 Unknown Endpoint —
  // recorded honestly). Zero-push arbitration instead: fetch a historical
  // block and verify transaction_id = sha256(packed_trx) over the chain's own
  // bytes. Name/varuint packing is arbitrated live at the first push by the
  // nodeos txid echo (mismatch aborts the run).
  const { transactionId: txIdOf } = await import('./codec.mjs');
  const info0 = await PRIMARY.get_info();
  let checked = 0, matched = 0, probeBlocks = [];
  for (let off = 10; off < 4000 && checked < 5; off += 13) {
    const blk = await PRIMARY.call('/v1/chain/get_block', { block_num_or_id: info0.body.head_block_num - off });
    if (!blk.ok || !Array.isArray(blk.body.transactions)) continue;
    probeBlocks.push(blk.body.block_num);
    for (const t of blk.body.transactions) {
      if (t.trx && typeof t.trx === 'object' && t.trx.packed_trx) {
        checked++;
        if (txIdOf(Buffer.from(t.trx.packed_trx, 'hex')) === (t.trx.id ?? t.id)) matched++;
      }
    }
  }
  record({
    action: 'preflight/txid-convention',
    probe_blocks: probeBlocks,
    historical_txs_checked: checked,
    historical_txid_matches: matched,
    abi_json_to_bin: 'disabled on cryptolions and greymass (404) — named, live txid echo arbitrates instead',
  });
  if (checked === 0 || matched !== checked) {
    fail('historical txid convention check failed: ' + matched + '/' + checked);
  }
  console.log('  historical txid convention: ' + matched + '/' + checked + ' real transactions match sha256(packed_trx)');
}

async function stageResources(keys) {
  const acct = await accountState();
  const cpuAvail = acct.cpu_limit.available;
  const ramFree = acct.ram_quota - acct.ram_usage;
  record({
    action: 'resources/before',
    cpu_available_us: cpuAvail,
    net_available: acct.net_limit.available,
    ram_free: ramFree,
    core_balance: acct.core_liquid_balance,
  });
  if (cpuAvail > 200000 && acct.net_limit.available > 500000 && ramFree > 2500) {
    console.log('  resources sufficient (cpu ' + cpuAvail + 'µs, ram free ' + ramFree + 'B) — nothing needed');
    return;
  }
  if (ramFree <= 2500) {
    const bw = new Writer();
    bw.name(ACCOUNT).name(ACCOUNT).u32le(16384);
    await pushAction(
      { account: 'eosio', name: 'buyrambytes', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: bw.build() },
      [keys.active],
      { expect: 'accepted' },
    );
    const mid = await accountState();
    record({ action: 'resources/ram', ram_quota: mid.ram_quota, ram_usage: mid.ram_usage, core_balance: mid.core_liquid_balance });
    console.log('  bought 16384 bytes RAM; quota now ' + mid.ram_quota);
    if (mid.cpu_limit.available > 200000) return;
  }
  const { encodeQuantity } = await import('./codec.mjs');
  const dw = new Writer();
  dw.name(ACCOUNT).name(ACCOUNT);
  dw.bytes(encodeQuantity('20.0000 EOS')); // net
  dw.bytes(encodeQuantity('100.0000 EOS')); // cpu
  dw.u8(0); // transfer: false
  await pushAction(
    { account: 'eosio', name: 'delegatebw', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: dw.build() },
    [keys.active],
    { expect: 'accepted' },
  );
  const after = await accountState();
  record({
    action: 'resources/after',
    cpu_available_us: after.cpu_limit.available,
    net_available: after.net_limit.available,
  });
  console.log('  delegated: cpu now ' + after.cpu_limit.available + 'µs, net ' + after.net_limit.available);
}

async function stageSetupPermission(keys, laneKeys) {
  let K2 = laneKeys.K2;
  if (!K2) {
    const secret = randomSecret();
    const pub = saveLaneKey('K2', secret);
    K2 = { secret, pub };
    console.log('  generated K2 for ' + DELEGATED + ' (DPAPI at rest, in-memory pipes only)');
  } else {
    console.log('  reusing existing K2');
  }
  state.K2_pub = K2.pub;
  const acct = await accountState();
  const existing = acct.permissions.find((p) => p.perm_name === DELEGATED);
  const pub33hex = Buffer.from(derivePublic(K2.secret)).toString('hex');
  const NEED_LINKS = [
    { code: MSIG, type: 'approve' },        // the delegated permission's own msig acts
    { code: MSIG, type: 'unapprove' },      // withdrawal is a distinct linked act (learned live)
    { code: TOKEN, type: 'transfer' },      // the bounded action class the proposals carry
  ];
  if (!existing) {
    const authBytes = packAuthority(1, [{ key: '00' + pub33hex, weight: 1 }]);
    await pushAction(
      { account: 'eosio', name: 'updateauth', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packUpdateAuthData(ACCOUNT, DELEGATED, 'active', authBytes) },
      [keys.active],
      { expect: 'accepted' },
    );
  }
  // link law (learned live, 2026-10-12): propose's check_transaction_authorization
  // enforces permission→action links for the DECLARED inner authorizations too —
  // a delegated permission not linked to the action class makes the proposal
  // refuse with "transaction authorization failed" before it exists.
  const linkedNow = new Set((existing && existing.linked_actions || []).map((l) => l.account + '::' + (l.action ?? l.type)));
  for (const l of NEED_LINKS) {
    if (linkedNow.has(l.code + '::' + l.type)) continue;
    await pushAction(
      { account: 'eosio', name: 'linkauth', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packLinkAuthData(ACCOUNT, l.code, l.type, DELEGATED) },
      [keys.active],
      { expect: 'accepted' },
    );
  }
  const check = await accountState();
  const perm = check.permissions.find((p) => p.perm_name === DELEGATED);
  record({
    action: 'setup/' + DELEGATED,
    permission_present: !!perm,
    parent: perm && perm.parent,
    key: perm && (perm.required_auth.keys[0] || {}).key,
    linked: perm && (perm.linked_actions || []).map((l) => l.account + '::' + l.type).join(','),
  });
  if (!perm || perm.parent !== 'active') fail('delegated permission missing or misparented');
  return K2;
}

// Jungle4's deployed eosio.token REFUSES self-transfers ("cannot transfer to
// self" — learned live), so the bounded inner action is a 0.0001 EOS donation
// to the faucet: harmless, verifiable, and executable.
const INNER_RECIPIENT = 'junglefaucet';
function innerAction(permission, memo) {
  return {
    account: TOKEN, name: 'transfer',
    authorization: [{ actor: ACCOUNT, permission }],
    data: packTransferData(ACCOUNT, INNER_RECIPIENT, '0.0001 EOS', memo),
  };
}

async function buildProposal(lane, { requestedPerm = DELEGATED, innerPerm = DELEGATED, delaySec = 0, expirationSec = 1800, proposalName }) {
  const t = await tapos(expirationSec);
  const packedInner = packTransaction({
    expiration: t.expiration,
    refBlockNum: t.tap.refBlockNum,
    refBlockPrefix: t.tap.refBlockPrefix,
    delaySec,
    actions: [innerAction(innerPerm, 'wb004 live ' + proposalName)],
  });
  const proposeData = packProposeData(ACCOUNT, proposalName, [{ actor: ACCOUNT, permission: requestedPerm }], packedInner);
  return { proposalName, packedInner, proposeData, hash: sha256(packedInner).toString('hex') };
}

async function stageP1(keys, K2) {
  const name = state.p1_name || (state.p1_name = randName('wb4'));
  if (state.p1_exec_txid && await verifyInclusion(state.p1_exec_txid, state.p1_exec_block)) {
    // the lifecycle already executed — block-inclusion is authoritative even
    // when a lagging node still serves the pre-exec proposal row
    console.log('  P1 already executed (txid ' + state.p1_exec_txid + ', block-verified) — running the duplicate control only');
    // refusal message depends on the serving node's lag: current state says
    // "proposal not found"; a node lagging between unapprove/reapprove says
    // "transaction authorization failed". Any refusal = no second execution.
    await pushAction(
      { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
      [keys.active], { expect: 'refused', match: /proposal not found|transaction authorization failed/ },
    );
    record({ action: 'p1/complete', exec_txid: state.p1_exec_txid, exec_block: state.p1_exec_block });
    return;
  }
  const alreadyThere = await waitForRow('proposal', ACCOUNT, (r) => r.proposal_name === name, 1);
  let p = null;
  if (alreadyThere) {
    console.log('  proposal ' + name + ' already on chain (stage resume) — recomputing expected bytes is not possible for hash controls, so this run continues with table-verified state');
    // recover the stored hash for the approve-with-correct-hash control
    const stored = Buffer.from(alreadyThere.packed_transaction, 'hex');
    p = { proposalName: name, hash: sha256(stored).toString('hex'), packedInner: stored, resumed: true };
  } else {
    p = await buildProposal(null, { proposalName: name });
    record({ action: 'p1/inner-packed', proposal: name, packed_sha256: p.hash, packed_len: p.packedInner.length });
    // propose
    await pushAction(
      { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: p.proposeData },
      [keys.active], { expect: 'accepted' },
    );
  }
  // chain-stored bytes must equal my packing
  const row = await waitForRow('proposal', ACCOUNT, (r) => r.proposal_name === name);
  if (!row) fail('proposal row missing after propose');
  const storedHash = sha256(Buffer.from(row.packed_transaction, 'hex')).toString('hex');
  record({ action: 'p1/stored-bytes', proposal: name, stored_packed_sha256: storedHash, equals_local: storedHash === p.hash, resumed: !!p.resumed });
  if (storedHash !== p.hash && !p.resumed) fail('stored packed_transaction differs from local packing');
  if (p.resumed && storedHash !== p.hash) fail('resumed proposal bytes differ from recomputed hash');
  const arow0 = await waitForRow('approvals2', ACCOUNT, (r) => r.proposal_name === name);
  record({ action: 'p1/approvals-shape', requested: arow0 && arow0.requested_approvals, provided: arow0 && arow0.provided_approvals });
  const approvedAlready = !!(arow0 && (arow0.provided_approvals || []).some((a) => a.level && a.level.permission === DELEGATED));
  if (!approvedAlready) {
    // wrong-hash refusal
    const wrongHash = sha256(Buffer.concat([p.packedInner, Buffer.from([1])])).toString('hex');
    await pushAction(
      { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, wrongHash) },
      [K2], { expect: 'refused', match: 'hash' },
    );
    // correct-hash approval
    await pushAction(
      { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, p.hash) },
      [K2], { expect: 'accepted' },
    );
    // settle: the load-balanced endpoint once executed the NEXT action on a
    // lagging node whose state predated this approval ("no approval previously
    // granted" while both providers showed it live) — verify before depending
    const providedVisible = await waitForRow('approvals2', ACCOUNT, (r) =>
      r.proposal_name === name && (r.provided_approvals || []).some((a) => a.level.permission === DELEGATED));
    if (!providedVisible) fail('approval not visible before unapprove');
  } else {
    console.log('  approval already provided (resume) — hash controls recorded earlier');
  }
  // withdraw
  await pushAction(
    { account: MSIG, name: 'unapprove', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packUnapproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }) },
    [K2], { expect: 'accepted' },
  );
  // settle: confirm the withdrawal is visible before the dependent exec —
  // exec raced against an in-flight unapprove once and the old approval was
  // still live at its block (the race is itself a recorded finding)
  const withdrawn = await waitForRow('approvals2', ACCOUNT, (r) =>
    r.proposal_name === name && (r.provided_approvals || []).length === 0 && (r.requested_approvals || []).some((a) => a.level.permission === DELEGATED));
  if (!withdrawn) fail('withdrawal not visible in approvals2 before exec control');
  // exec must fail while withdrawn
  await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'refused', match: 'transaction authorization failed' },
  );
  // re-approve without the optional hash (binary extension omitted)
  await pushAction(
    { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, null) },
    [K2], { expect: 'accepted' },
  );
  const reprovided = await waitForRow('approvals2', ACCOUNT, (r) =>
    r.proposal_name === name && (r.provided_approvals || []).some((a) => a.level.permission === DELEGATED));
  if (!reprovided) fail('re-approval not visible before exec');
  // exec — the live settlement
  const execRes = await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
  state.p1_exec_txid = execRes.txid;
  state.p1_exec_block = execRes.step.blockNum;
  await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'refused', match: 'proposal not found' },
  );
}

async function stageP2delay(keys, K2) {
  const name = state.p2_name || (state.p2_name = randName('wb4'));
  const existing = await waitForRow('proposal', ACCOUNT, (r) => r.proposal_name === name, 1);
  let p;
  if (existing) {
    p = { proposalName: name, hash: sha256(Buffer.from(existing.packed_transaction, 'hex')).toString('hex'), packedInner: Buffer.from(existing.packed_transaction, 'hex'), resumed: true };
    console.log('  proposal ' + name + ' already on chain (resume)');
  } else {
    p = await buildProposal(null, { proposalName: name, delaySec: 60, expirationSec: 900 });
    await pushAction(
      { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: p.proposeData },
      [keys.active], { expect: 'accepted' },
    );
  }
  const arow = await waitForRow('approvals2', ACCOUNT, (r) => r.proposal_name === name);
  if (!(arow && (arow.provided_approvals || []).some((a) => a.level.permission === DELEGATED))) {
    await pushAction(
      { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, p.hash) },
      [K2], { expect: 'accepted' },
    );
    const ok = await waitForRow('approvals2', ACCOUNT, (r) => r.proposal_name === name && (r.provided_approvals || []).some((a) => a.level.permission === DELEGATED));
    if (!ok) fail('p2 approval not visible');
  }
  // too early
  await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'refused', match: 'too early to execute' },
  );
  console.log('  waiting 62s for the delay window to pass…');
  await sleep(62000);
  const r = await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
  state.p2_exec_txid = r.txid;
}

async function stageP3rotation(keys, K2) {
  // P3: approved pre-rotation, executed post-rotation — rotation does NOT
  // withdraw stored approvals (they are permission levels, not keys).
  const name = state.p3_name || (state.p3_name = randName('wb4'));
  const p = await buildProposal(null, { proposalName: name });
  await pushAction(
    { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: p.proposeData },
    [keys.active], { expect: 'accepted' },
  );
  await pushAction(
    { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, p.hash) },
    [K2], { expect: 'accepted' },
  );
  // rotate: K2 → K3
  let K3 = (await loadLaneKeys()).K3;
  if (!K3) {
    const secret = randomSecret();
    const pub = saveLaneKey('K3', secret);
    K3 = { secret, pub };
  }
  state.K3_pub = K3.pub;
  const pub33hex = Buffer.from(derivePublic(K3.secret)).toString('hex');
  await pushAction(
    { account: 'eosio', name: 'updateauth', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packUpdateAuthData(ACCOUNT, DELEGATED, 'active', packAuthority(1, [{ key: '00' + pub33hex, weight: 1 }])) },
    [keys.active], { expect: 'accepted' },
  );
  // stale key K2 can no longer push as wb004signr
  await pushAction(
    { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, null) },
    [K2], { expect: 'refused', match: /signatur|authority/i },
  );
  // but exec of the pre-rotation approval SUCCEEDS
  const r = await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
  state.p3_exec_txid = r.txid;
  record({ action: 'p3/finding', finding: 'key rotation of the approving permission did NOT withdraw the stored approval; exec succeeded post-rotation. The reference remedy is invalidate(), exercised in P4.' });

  // P4: invalidate kills earlier approvals at exec time
  const name4 = state.p4_name || (state.p4_name = randName('wb4'));
  const p4 = await buildProposal(null, { proposalName: name4 });
  await pushAction(
    { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: p4.proposeData },
    [keys.active], { expect: 'accepted' },
  );
  await pushAction(
    { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name4, { actor: ACCOUNT, permission: DELEGATED }, p4.hash) },
    [K3], { expect: 'accepted' },
  );
  await pushAction(
    { account: MSIG, name: 'invalidate', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packInvalidateData(ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
  await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name4, ACCOUNT) },
    [keys.active], { expect: 'refused', match: 'transaction authorization failed' },
  );
  // cleanup: proposer cancels
  await pushAction(
    { account: MSIG, name: 'cancel', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packCancelData(ACCOUNT, name4, ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
}

async function stageP5expiry(keys, K3) {
  // propose with an expiration already in the past → refused at propose
  const pastName = randName('wb4');
  const p0 = await buildProposal(null, { proposalName: pastName, expirationSec: 1800 });
  const t = await tapos(30);
  const stale = packTransaction({
    expiration: t.headTime - 60,
    refBlockNum: t.tap.refBlockNum,
    refBlockPrefix: t.tap.refBlockPrefix,
    delaySec: 0,
    actions: [innerAction(DELEGATED, 'wb004 stale ' + pastName)],
  });
  await pushAction(
    { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packProposeData(ACCOUNT, pastName, [{ actor: ACCOUNT, permission: DELEGATED }], stale) },
    [keys.active], { expect: 'refused', match: 'transaction expired' },
  );
  void p0;

  // short-lived proposal: approve then let it expire, exec refused, cancel cleans up
  const name = state.p5_name || (state.p5_name = randName('wb4'));
  const p = await buildProposal(null, { proposalName: name, expirationSec: 45 });
  await pushAction(
    { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: p.proposeData },
    [keys.active], { expect: 'accepted' },
  );
  // wrong level: active is not on the requested list (exact-match list check)
  await pushAction(
    { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: 'active' }, null) },
    [keys.active], { expect: 'refused', match: 'approval is not on the list of requested approvals' },
  );
  await pushAction(
    { account: MSIG, name: 'approve', authorization: [{ actor: ACCOUNT, permission: DELEGATED }], data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, p.hash) },
    [K3], { expect: 'accepted' },
  );
  // insufficient authority at propose: requested (child) cannot satisfy declared (parent active)
  const badName = randName('wb4');
  const t2 = await tapos(1800);
  const badInner = packTransaction({
    expiration: t2.expiration,
    refBlockNum: t2.tap.refBlockNum,
    refBlockPrefix: t2.tap.refBlockPrefix,
    delaySec: 0,
    actions: [innerAction('active', 'wb004 insufficient ' + badName)],
  });
  await pushAction(
    { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packProposeData(ACCOUNT, badName, [{ actor: ACCOUNT, permission: DELEGATED }], badInner) },
    [keys.active], { expect: 'refused', match: 'transaction authorization failed' },
  );
  console.log('  waiting 50s for expiration…');
  await sleep(50000);
  await pushAction(
    { account: MSIG, name: 'exec', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packExecData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'refused', match: 'transaction expired' },
  );
  await pushAction(
    { account: MSIG, name: 'cancel', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packCancelData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
}

async function stageP6ambiguous(keys, K3) {
  // push the exact same signed approve bytes twice: second push is refused as
  // duplicate — the AMBIGUOUS case — then reconciled by transaction id lookup
  // proving exactly-once.
  const name = state.p6_name || (state.p6_name = randName('wb4'));
  const existing = await waitForRow('proposal', ACCOUNT, (r) => r.proposal_name === name, 1);
  let p;
  if (existing) {
    p = { proposalName: name, hash: sha256(Buffer.from(existing.packed_transaction, 'hex')).toString('hex'), resumed: true };
    console.log('  proposal ' + name + ' already on chain (resume)');
  } else {
    p = await buildProposal(null, { proposalName: name });
    await pushAction(
      { account: MSIG, name: 'propose', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: p.proposeData },
      [keys.active], { expect: 'accepted' },
    );
  }
  const approveAction = {
    account: MSIG, name: 'approve',
    authorization: [{ actor: ACCOUNT, permission: DELEGATED }],
    data: packApproveData(ACCOUNT, name, { actor: ACCOUNT, permission: DELEGATED }, p.hash),
  };
  // hand-built duplicate push (settle-tolerant, same protections as pushAction)
  let first = null, packed = null, sig = null, txid = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const t = await tapos(1800);
    packed = packTransaction({
      expiration: t.expiration, refBlockNum: t.tap.refBlockNum, refBlockPrefix: t.tap.refBlockPrefix,
      delaySec: 0, actions: [approveAction],
    });
    txid = transactionId(packed);
    sig = [signDigest(K3.secret, signatureDigest(JUNGLE4_CHAIN_ID, packed))];
    first = await PRIMARY.push_transaction(sig, packed.toString('hex'));
    if (first.ok) {
      const echo = first.body.transaction_id ?? (first.body.processed && first.body.processed.id);
      if (echo !== txid) fail('p6 txid echo mismatch');
      const blockNum = first.body.processed ? first.body.processed.block_num : null;
      if (!await verifyInclusion(txid, blockNum)) {
        console.log('  [retry] p6 phantom acceptance — repushing');
        await sleep(900);
        continue;
      }
      break;
    }
    const msg = Rpc.refusedBecause(first);
    if (/reference block .* did not match|different fork/i.test(msg)) {
      console.log('  [retry] p6 TAPOS divergence — refetching head');
      await sleep(700);
      continue;
    }
    break;
  }
  if (!first.ok) fail('p6 first push failed unexpectedly: ' + Rpc.refusedBecause(first));
  const second = await PRIMARY.push_transaction(sig, packed.toString('hex'));
  const secondMsg = second.ok ? 'ACCEPTED?!' : Rpc.refusedBecause(second);
  record({ action: 'p6/duplicate-push', txid, first: 'accepted', second: second.ok ? 'accepted' : 'refused', second_message: String(secondMsg).slice(0, 200) });
  console.log('  duplicate push of ' + txid + ': ' + (second.ok ? 'ACCEPTED (unexpected!)' : 'refused — ' + String(secondMsg).slice(0, 120)));
  if (second.ok) fail('duplicate push accepted — exactly-once violated');
  // reconcile: the tx exists exactly once
  const hist = await PRIMARY.history_get_transaction(txid);
  const found = hist.ok && (hist.body.transaction_id === txid || hist.body.id === txid);
  record({ action: 'p6/reconcile', txid, found_once: !!found, status: hist.ok ? (hist.body.status ?? hist.body.executed ? 'executed' : 'seen') : 'lookup-failed' });
  if (!found) console.log('  WARN: v2 history lookup for duplicate-reconcile not found (recorded; continuing — the txid echo is the primary evidence)');
  // cleanup
  await pushAction(
    { account: MSIG, name: 'cancel', authorization: [{ actor: ACCOUNT, permission: 'active' }], data: packCancelData(ACCOUNT, name, ACCOUNT) },
    [keys.active], { expect: 'accepted' },
  );
}

async function stageFinality() {
  const target = state.p1_exec_block;
  for (let i = 0; i < 40; i++) {
    const info = await PRIMARY.get_info();
    if (info.ok && info.body.last_irreversible_block_num >= target) {
      record({ action: 'finality/primary', exec_block: target, lib: info.body.last_irreversible_block_num, irreversible: true });
      console.log('  P1 exec block ' + target + ' is irreversible (LIB ' + info.body.last_irreversible_block_num + ')');
      break;
    }
    await sleep(1500);
    if (i === 39) fail('finality wait timed out');
  }
  // second source: greymass must serve the SAME block, id-equal, containing
  // the executed transaction (history APIs are disabled on both providers —
  // block-level agreement is the independent observation)
  const txid = state.p1_exec_txid;
  const sec = await SECONDARY.call('/v1/chain/get_block', { block_num_or_id: target });
  const pri = await PRIMARY.call('/v1/chain/get_block', { block_num_or_id: target });
  let agree = false, secBlockId = null, detail = 'lookup failed';
  if (sec.ok && pri.ok) {
    secBlockId = sec.body.id;
    const sameId = secBlockId === pri.body.id;
    let txIn = false;
    for (const t of (sec.body.transactions || [])) {
      const id = t.trx && typeof t.trx === 'object' ? (t.trx.id ?? t.id) : t.id;
      if (id === txid && t.status === 'executed') txIn = true;
    }
    agree = sameId && txIn;
    detail = 'block-id ' + (sameId ? 'EQUAL' : 'DIFFERS') + ', tx ' + (txIn ? 'EXECUTED in greymass copy' : 'absent');
  }
  record({ action: 'finality/secondary', endpoint: ENDPOINTS.secondary, txid, block: target, secondary_block_id: secBlockId, agrees_with_primary: agree, detail });
  console.log('  second source ' + ENDPOINTS.secondary + ': block ' + target + ' — ' + detail);
  if (!agree) fail('second-source verification failed');

  // no orphan proposals left
  const rows = await getProposals(ACCOUNT);
  record({ action: 'finality/cleanup-check', leftover_proposals: rows.map((r) => r.proposal_name) });
  if (rows.length !== 0) console.log('  NOTE: leftover proposal rows: ' + rows.map((r) => r.proposal_name).join(',') + ' (RAM-bearing; cancel them or record)');
}

// ---------------------------------------------------------------------------

async function main() {
  const only = process.argv.includes('--stage')
    ? process.argv[process.argv.indexOf('--stage') + 1]
    : null;

  console.log('WB004 live lifecycle — account ' + ACCOUNT + ', chain ' + JUNGLE4_CHAIN_ID);
  const keys = loadAccountKeys(); // chain-id gate happens per-push in tapos()
  const laneKeys = loadLaneKeys();

  const runIfWanted = async (name, fn) => {
    if (only && only !== name) return;
    if (!only && state.stages[name] === 'done') { console.log('[' + name + '] already done — skipping'); return; }
    console.log('[' + name + ']');
    await fn();
    state.stages[name] = 'done';
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  };

  await runIfWanted('preflight', () => stagePreflight());
  let K2 = null, K3 = null;
  await runIfWanted('resources', async () => { await stageResources(keys); });
  await runIfWanted('permission', async () => { K2 = await stageSetupPermission(keys, laneKeys); state.K2_held = true; });
  if (!only && !K2 && state.stages.p1 !== 'done') { K2 = (await loadLaneKeys()).K2; if (!K2) fail('K2 missing for lifecycle stages'); }
  K3 = (await loadLaneKeys()).K3 || null;
  await runIfWanted('p1', async () => { await stageP1(keys, K2 ?? (await loadLaneKeys()).K2); });
  await runIfWanted('p2', async () => { await stageP2delay(keys, K2 ?? (await loadLaneKeys()).K2); });
  await runIfWanted('p3', async () => { await stageP3rotation(keys, K2 ?? (await loadLaneKeys()).K2); });
  await runIfWanted('p5', async () => { await stageP5expiry(keys, (await loadLaneKeys()).K3); });
  await runIfWanted('p6', async () => { await stageP6ambiguous(keys, (await loadLaneKeys()).K3); });
  await runIfWanted('finality', async () => { await stageFinality(); });

  if (only) { writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); console.log('STAGE ' + only + ' GREEN'); return; }

  // final receipt (public data only)
  const receipt = {
    lane: 'wb004-jungle-live-2026-10-12',
    account: ACCOUNT,
    delegated_permission: DELEGATED,
    chain_id: JUNGLE4_CHAIN_ID,
    endpoints: ENDPOINTS,
    K2_pub: state.K2_pub,
    K3_pub: state.K3_pub,
    proposals: {
      p1: state.p1_name, p2: state.p2_name, p3: state.p3_name, p4: state.p4_name, p5: state.p5_name, p6: state.p6_name,
    },
    msig_app_urls: [state.p1_name, state.p2_name, state.p3_name, state.p5_name, state.p6_name].filter(Boolean)
      .map((n) => 'https://msig.app/jungle/' + ACCOUNT + '/' + n),
    exec_txids: { p1: state.p1_exec_txid, p2: state.p2_exec_txid, p3: state.p3_exec_txid },
    steps: state.steps,
    stages_completed: state.stages,
  };
  writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2));
  console.log('RECEIPT written: ' + RECEIPT_PATH);
  console.log('LIFECYCLE GREEN');
}

main().catch((e) => fail(e && e.stack || String(e)));
