#!/usr/bin/env node
// wb002-wasm-equiv.mjs — bTunGsTeN Workbench 002, the WASM-vs-model
// equivalence beat (founder order 2026-10-07: after the model-hardening
// repairs, "proceed with WASM-versus-model comparison"; the comparison
// target is the HARDENED model, specimen profile — the wasm IS the
// specimen).
//
// WHAT RUNS: the VENDORED 2021 wasm + abi (wb002-specimen/simpleassets-
// e6a042f/build/SimpleAssets/, byte-identical to upstream e6a042f — the
// PROVENANCE pins hold), deployed VERBATIM (never rebuilt) onto a fresh
// local dev chain under Antelope Spring — the current Vaulta-era client.
// Each corpus step executes on BOTH the chain (cleos) and the model
// (wb002-simpleassets.mjs, profile 'specimen'), and is compared on:
//   1. the ACCEPT/REFUSE class of the action;
//   2. the FULL post-state projection (every contract table) after
//      EVERY step;
//   3. for refused steps: that the chain's whole state is UNCHANGED
//      across the refusal (the R-1 rollback class, on the real stack).
//
// NAMED RECONCILIATIONS (projections and shims, stated up front):
//   - volatile block-time fields are dropped: offers/offersf/delegates
//     `cdate`;
//   - `offerfs.id` is excluded from projection and reconciled: upstream
//     allocates offer ids from the same counter as deferred-event ids
//     (sendEvent, SA.cpp:1187), which the model intentionally does not
//     port (EXCLUDED SURFACE); after an offerf the harness renames the
//     model's offer key to the chain's so claim rows address one offer;
//   - asset ids (lnftid) and FT ids MATCH naturally: both sides start
//     from the same genesis counters and only create* consumes them.
//
// RESULT CLASS (the result-class law): an EXECUTED CORPUS comparison —
// sampled evidence, not a proof; no EQUIVALENCE-proof claim is made.
// NOT claimed: testnet/mainnet behavior, behavior outside this corpus,
// Spring-version generality.
//
// Runs on Linux (including WSL) against Spring cleos/nodeos. HTTP and
// P2P ports are configurable; each run has a fresh state/wallet directory.
// Cleanup only signals child processes owned by this invocation.

import { createServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Chain, Refusal, canon, sha } from './wb002-simpleassets.mjs';

const HTTP_PORT = Number(process.env.WB002_HTTP_PORT || 8889);
const P2P_PORT = Number(process.env.WB002_P2P_PORT || 9877);
for (const port of [HTTP_PORT, P2P_PORT]) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid WB002 port');
}
const HTTP = `http://127.0.0.1:${HTTP_PORT}`;
const RUN = mkdtempSync('/tmp/wb002-');
const WALLET = `unix://${RUN}/wallet/keosd.sock`; // Spring keosd serves the wallet API on its socket
const SPECIMEN = new URL('./wb002-specimen/simpleassets-e6a042f/', import.meta.url).pathname;
const DEV_KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // PUBLIC-CONSTANT: the universal eosio/Antelope dev-chain genesis key (every tutorial ships it; it unlocks only throwaway local chains)
const DEV_PUB = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';
const ACTORS = ['authorgov', 'authorx', 'alice', 'bob', 'carol', 'dave', 'ed', 'mallory', 'simpleasset1'];
const CONTRACT = 'simpleasset1';

function cleosRaw(args) {
  return execFileSync('cleos', ['-u', HTTP, '--wallet-url', WALLET, '--no-auto-keosd', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function tryCleos(args) {
  try { return { ok: true, out: cleosRaw(args) }; } catch (e) {
    const err = `${e.stderr || e.stdout || e.message}`.split('\n').map((l) => l.trim()).filter(Boolean).join(' | ').slice(0, 1400);
    return { ok: false, err };
  }
}

let nodeosProc = null;
let keosdProc = null;
const cleanup = () => {
  for (const p of [nodeosProc, keosdProc]) { if (p && p.exitCode === null) { try { p.kill('SIGKILL'); } catch {} } }
};

process.once('SIGTERM', () => { cleanup(); process.exit(143); });
process.once('SIGINT', () => { cleanup(); process.exit(130); });

async function bootChain() {
  // Refuse occupied ports before creating a wallet or touching a chain.
  for (const port of [HTTP_PORT, P2P_PORT]) {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', reject);
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
  }
  for (const d of ['data', 'config', 'wallet']) mkdirSync(`${RUN}/${d}`, { recursive: true });
  keosdProc = spawn('keosd', [
    '--unlock-timeout', '86400',
    `--unix-socket-path=${RUN}/wallet/keosd.sock`, `--wallet-dir=${RUN}/wallet`, `--data-dir=${RUN}/wallet/keosd-data`,
  ], { detached: true, stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (tryCleos(['wallet', 'list']).ok) break;
    if (i === 29) throw new Error('keosd did not come up on its socket');
  }
  const { openSync } = await import('node:fs');
  const logFd = openSync(`${RUN}/nodeos.log`, 'a');
  nodeosProc = spawn('nodeos', [
    '-e', '-p', 'eosio',
    '--plugin', 'eosio::chain_api_plugin',
    '--plugin', 'eosio::producer_plugin',
    '--plugin', 'eosio::producer_api_plugin',
    '--plugin', 'eosio::http_plugin',
    '--access-control-allow-origin=*', '--http-validate-host=false',
    `--http-server-address=127.0.0.1:${HTTP_PORT}`,
    `--p2p-listen-endpoint=127.0.0.1:${P2P_PORT}`,
    // WSL's timer accuracy is poor (nodeos warns); the 499ms subjective
    // deadline kills the 2021 contract's heavier calls nondeterministically
    '--max-transaction-time=10000', '--abi-serializer-max-time-ms=10000',
    `--signature-provider=${DEV_PUB}=KEY:${DEV_KEY}`,
    `--data-dir=${RUN}/data`, `--config-dir=${RUN}/config`,
  ], { detached: true, stdio: ['ignore', 'ignore', logFd] });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (nodeosProc.exitCode !== null || nodeosProc.signalCode !== null) throw new Error(`nodeos exited during startup; see ${RUN}/nodeos.log`);
    const r = tryCleos(['get', 'info']);
    if (r.ok) return JSON.parse(r.out);
  }
  throw new Error(`nodeos did not come up at ${HTTP} (see ${RUN}/nodeos.log)`);
}

async function headTime() {
  const info = JSON.parse(cleosRaw(['get', 'info']));
  return BigInt(Math.floor(new Date(`${info.head_block_time}${info.head_block_time.endsWith('Z') ? '' : 'Z'}`).getTime() / 1000));
}

// quantity string "10000.0000 WOOD" -> raw integer units + symbol
function qty(s) {
  const m = /^(\d+)\.(\d+) ([A-Z]{1,7})$/.exec(s);
  if (!m) throw new Error(`unparsed quantity ${s}`);
  return { amount: BigInt(m[1] + m[2]), sym: m[3] };
}

function getTable(scope, table) {
  const r = tryCleos(['get', 'table', CONTRACT, scope, table, '--limit', '500']);
  if (!r.ok) throw new Error(`getTable ${scope}/${table} FAILED (a failed read must never read as an empty table): ${r.err.slice(0, 160)}`);
  return JSON.parse(r.out).rows;
}

const normChainAsset = (row) => ({
  id: String(row.id), owner: row.owner, author: row.author, category: row.category,
  idata: row.idata, mdata: row.mdata,
  contains: (row.container || []).map(normChainAsset),
  containsF: (row.containerf || []).map((c) => { const q = qty(typeof c.balance === 'string' ? c.balance : c.balance.quantity); return { id: String(c.id), amount: String(q.amount), sym: q.sym }; }),
});
const normModelAsset = (row) => ({
  id: String(row.id), owner: row.owner, author: row.author, category: row.category,
  idata: row.idata, mdata: row.mdata,
  contains: row.container.map(normModelAsset),
  containsF: row.containerf.map((f) => ({ id: String(f.id), amount: String(f.amount), sym: f.sym })),
});
const byId = (arr) => arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

function projectChain() {
  const sassets = []; const sntt = []; const accounts = [];
  for (const actor of ACTORS) {
    for (const row of getTable(actor, "sassets")) sassets.push(normChainAsset(row));
    for (const row of getTable(actor, 'snttassets')) sntt.push({ id: String(row.id), owner: row.owner, author: row.author, category: row.category, idata: row.idata, mdata: row.mdata });
    for (const row of getTable(actor, 'accounts')) { const q = qty(row.balance); accounts.push({ holder: actor, id: String(row.id), balance: String(q.amount), sym: q.sym }); }
  }
  const offers = getTable(CONTRACT, 'offers').map((r) => ({ assetid: String(r.assetid), owner: r.owner, offeredto: r.offeredto }));
  const nttoffers = getTable(CONTRACT, 'nttoffers').map((r) => ({ assetid: String(r.assetid), owner: r.owner, offeredto: r.offeredto }));
  const offerfs = getTable(CONTRACT, 'offerfs').map((r) => { const q = qty(r.quantity); return { author: r.author, owner: r.owner, offeredto: r.offeredto, quantity: String(q.amount), sym: q.sym }; });
  const delegates = getTable(CONTRACT, 'delegates').map((r) => ({ assetid: String(r.assetid), owner: r.owner, delegatedto: r.delegatedto, period: String(r.period), redelegate: !!r.redelegate }));
  const stat = [];
  for (const author of ['authorgov', 'authorx']) {
    for (const row of getTable(author, 'stat')) {
      const s = qty(row.supply); const mx = qty(row.max_supply);
      stat.push({ issuer: row.issuer, id: String(row.id), authorctrl: !!row.authorctrl, supply: String(s.amount), max: String(mx.amount), sym: s.sym });
    }
  }
  return {
    sassets: byId(sassets), snttassets: byId(sntt), accounts: byId(accounts),
    offers: byId(offers), nttoffers: byId(nttoffers), offerfs, delegates: byId(delegates), stat: byId(stat),
  };
}

function projectModel(c) {
  const sassets = []; const sntt = []; const accounts = [];
  for (const [holder, rows] of c.scopes) for (const row of rows.values()) sassets.push(normModelAsset(row));
  for (const rows of c.nttScopes.values()) for (const row of rows.values()) sntt.push({ id: String(row.id), owner: row.owner, author: row.author, category: row.category, idata: row.idata, mdata: row.mdata });
  for (const [holder, m] of c.balances) for (const [ftid, b] of m) accounts.push({ holder, id: String(ftid), balance: String(b.amount), sym: b.sym });
  return {
    sassets: byId(sassets), snttassets: byId(sntt), accounts: byId(accounts),
    offers: byId([...c.offers.entries()].map(([id, o]) => ({ assetid: String(id), owner: o.owner, offeredto: o.offeredto }))),
    nttoffers: byId([...c.nttOffers.entries()].map(([id, o]) => ({ assetid: String(id), owner: o.owner, offeredto: o.offeredto }))),
    offerfs: [...c.ftOffers.values()].map((o) => ({ author: o.author, owner: o.owner, offeredto: o.offeredto, quantity: String(o.amount), sym: o.sym })),
    delegates: byId([...c.delegates.entries()].map(([id, d]) => ({ assetid: String(id), owner: d.owner, delegatedto: d.delegatedto, period: String(d.period), redelegate: !!d.redelegate }))),
    stat: byId([...c.stats.values()].map((st) => ({ issuer: st.issuer, id: String(st.id), authorctrl: st.authorctrl, supply: String(st.supply), max: String(st.max), sym: st.symbol }))),
  };
}

// ---------------------------------------------------------------------------
const MODEL = new Chain({ profile: 'specimen', now: 1_700_000_000n });
const rows = [];
let classMismatches = 0;
let stateMismatches = 0;
let atomicityChecks = 0;
const TABLES = ['sassets', 'snttassets', 'accounts', 'offers', 'nttoffers', 'offerfs', 'delegates', 'stat'];

async function step(name, modelCall, chainAction, chainArgs, signers) {
  MODEL.now = await headTime(); // one clock: the chain's, for both sides
  const before = sha(canon(projectChain()));

  let modelOk = true; let modelErr = null;
  try { modelCall(); } catch (e) { if (e instanceof Refusal) { modelOk = false; modelErr = e.refusal; } else throw e; }

  const perms = signers.map((s) => ['-p', `${s}@active`]).flat();
  const chain = tryCleos(['push', 'action', CONTRACT, chainAction, JSON.stringify(chainArgs), ...perms]);
  const chainOk = chain.ok;

  const base = { name, model: modelOk ? 'accept' : `refuse:${modelErr}`, chain: chainOk ? 'accept' : 'refuse' };
  if (modelOk !== chainOk) {
    classMismatches++;
    rows.push({ ...base, chainMsg: chain.err.slice(0, 400), verdict: 'CLASS-MISMATCH' });
    console.error(`CLASS-MISMATCH  ${name}: model=${base.model} chain=${base.chain} :: ${chain.err}`);
    if (classMismatches === 1) console.error(`FIRST-MISMATCH FULL: ${chain.err}`);
    return;
  }
  if (!chainOk) {
    const atomic = sha(canon(projectChain())) === before;
    if (!atomic) { stateMismatches++; console.error(`ATOMICITY-MISMATCH ${name}: the chain state changed across a REFUSED action`); }
    else atomicityChecks++;
    rows.push({ ...base, chainMsg: chain.err, atomicOnChain: atomic, verdict: 'match' });
    return;
  }
  const chainProj = projectChain();
  const modelProj = projectModel(MODEL);
  if (sha(canon(chainProj)) !== sha(canon(modelProj))) {
    stateMismatches++;
    const k = TABLES.find((t) => canon(chainProj[t]) !== canon(modelProj[t]));
    console.error(`STATE-MISMATCH  ${name}: tables diverged first at '${k}'`);
    console.error(`  chain: ${canon(chainProj[k]).slice(0, 500)}`);
    console.error(`  model: ${canon(modelProj[k]).slice(0, 500)}`);
    rows.push({ ...base, verdict: 'STATE-MISMATCH' });
    return;
  }
  rows.push({ ...base, verdict: 'match' });
}

// rename the model's only open FT offer to the chain's offer id (the
// NAMED RECONCILIATION: deferred-event ids are upstream-internal)
function reconcileFtOfferId() {
  const chainOffers = getTable(CONTRACT, 'offerfs');
  if (chainOffers.length !== 1) throw new Error(`reconcileFtOfferId expects exactly 1 chain offer, saw ${chainOffers.length}`);
  const chainId = BigInt(chainOffers[0].id);
  const modelIds = [...MODEL.ftOffers.keys()];
  if (modelIds.length !== 1) throw new Error(`reconcileFtOfferId expects exactly 1 model offer, saw ${modelIds.length}`);
  if (modelIds[0] !== chainId) {
    MODEL.ftOffers.set(chainId, MODEL.ftOffers.get(modelIds[0]));
    MODEL.ftOffers.delete(modelIds[0]);
  }
  return chainId;
}

async function main() {
  process.on('exit', cleanup);
  const info = await bootChain();
  console.error(`chain up: Spring ${info.server_version_string || info.server_version}, head ${info.head_block_num}`);

  // wallet over the socket: a freshly created keosd wallet is ALREADY
  // unlocked and stays so (unlock-timeout 86400) — no unlock dance
  const wcr = tryCleos(['wallet', 'create', '-n', 'wb002', '--to-console']);
  if (!wcr.ok) throw new Error(`wallet create failed: ${wcr.err}`);
  let r2 = tryCleos(['wallet', 'import', '-n', 'wb002', '--private-key', DEV_KEY]);
  if (!r2.ok) throw new Error(`import dev key: ${r2.err}`);
  const pubs = {};
  for (const a of ACTORS) {
    const k = tryCleos(['create', 'key', '--to-console']);
    if (!k.ok) throw new Error(`create key for ${a}: ${k.err}`);
    pubs[a] = /Public key: (\S+)/.exec(k.out)[1];
    r2 = tryCleos(['wallet', 'import', '-n', 'wb002', '--private-key', /Private key: (\S+)/.exec(k.out)[1]]);
    if (!r2.ok) throw new Error(`import key ${a}: ${r2.err}`);
  }
  console.error('wallet + keys ready');
  for (const a of ACTORS) {
    const r = tryCleos(['create', 'account', 'eosio', a, pubs[a]]);
    if (!r.ok) throw new Error(`create account ${a}: ${r.err}`);
    MODEL.acct(a); // the model learns the world the chain just built
  }

  const wasm = `${SPECIMEN}build/SimpleAssets/SimpleAssets.wasm`;
  const abi = `${SPECIMEN}build/SimpleAssets/SimpleAssets.abi`;
  let r = tryCleos(['set', 'code', CONTRACT, wasm]);
  if (!r.ok) throw new Error(`set code failed (RAM? wasm compat?): ${r.err}`);
  r = tryCleos(['set', 'abi', CONTRACT, abi]);
  if (!r.ok) throw new Error(`set abi failed: ${r.err}`);
  // the documented deployment step for this 2021 contract: its sendEvent
  // deferred transactions act as simpleasset1@active, which every
  // Antelope since eosio.code requires to be linked explicitly
  r = tryCleos(['set', 'account', 'permission', CONTRACT, 'active', '--add-code', '-p', `${CONTRACT}@active`]);
  if (!r.ok) throw new Error(`link eosio.code failed: ${r.err}`);
  console.error(`deployed the VENDORED 2021 wasm+abi verbatim onto Spring + the contract's own documented eosio.code link`);

  const ids = {};
  const N = (k) => Number(ids[k]);

  // ---- THE CORPUS -------------------------------------------------------
  await step('create NFT direct', () => { ids.a = MODEL.create('authorgov', 'cred', 'alice', 'cmt-a', 'md-a', false, ['authorgov']); }, 'create', ['authorgov', 'cred', 'alice', 'cmt-a', 'md-a', 0], ['authorgov']);
  await step('create NFT requireclaim', () => { ids.b = MODEL.create('authorgov', 'cred', 'bob', 'cmt-b', 'md-b', true, ['authorgov']); }, 'create', ['authorgov', 'cred', 'bob', 'cmt-b', 'md-b', 1], ['authorgov']);
  await step('claim own offer (consent)', () => { MODEL.claim('bob', [ids.b], ['bob']); }, 'claim', ['bob', [N('b')]], ['bob']);
  await step('create by a stranger', () => { MODEL.create('authorx', 'cred', 'carol', 'x', '{}', false, ['mallory']); }, 'create', ['authorx', 'cred', 'carol', 'x', '{}', 0], ['mallory']);
  await step('transfer alice->bob', () => { MODEL.transfer('alice', 'bob', [ids.a], 'mv', ['alice']); }, 'transfer', ['alice', 'bob', [N('a')], 'mv'], ['alice']);
  await step('transfer by a stranger', () => { MODEL.transfer('bob', 'carol', [ids.a], 'x', ['mallory']); }, 'transfer', ['bob', 'carol', [N('a')], 'x'], ['mallory']);
  await step('transfer by the receiver only', () => { MODEL.transfer('bob', 'carol', [ids.a], 'x', ['carol']); }, 'transfer', ['bob', 'carol', [N('a')], 'x'], ['carol']);
  await step('partial batch rolls back whole (R-1 on the real stack)', () => { MODEL.transfer('bob', 'carol', [ids.a, 999999999999999n], 'x', ['bob']); }, 'transfer', ['bob', 'carol', [N('a'), 999999999999999], 'x'], ['bob']);
  await step('offer bob->carol', () => { MODEL.offer('bob', 'carol', [ids.a], 'off', ['bob']); }, 'offer', ['bob', 'carol', [N('a')], 'off'], ['bob']);
  await step('claim by the wrong offeree', () => { MODEL.claim('dave', [ids.a], ['dave']); }, 'claim', ['dave', [N('a')]], ['dave']);
  await step('transfer an offered asset', () => { MODEL.transfer('bob', 'dave', [ids.a], 'x', ['bob']); }, 'transfer', ['bob', 'dave', [N('a')], 'x'], ['bob']);
  await step('claim by the offeree (consent)', () => { MODEL.claim('carol', [ids.a], ['carol']); }, 'claim', ['carol', [N('a')]], ['carol']);
  await step('mdata update by the author', () => { MODEL.update('authorgov', 'carol', ids.a, 'md-a2', ['authorgov']); }, 'update', ['authorgov', 'carol', N('a'), 'md-a2'], ['authorgov']);
  await step('mdata update by the owner refuses', () => { MODEL.update('authorgov', 'carol', ids.a, 'nope', ['carol']); }, 'update', ['authorgov', 'carol', N('a'), 'nope'], ['carol']);

  await step('delegate carol->dave (long period)', () => { MODEL.delegate('carol', 'dave', [ids.a], 500000n, false, 'd1', ['carol']); }, 'delegate', ['carol', 'dave', [N('a')], 500000, 0, 'd1'], ['carol']);
  await step('borrower routes a delegated asset onward', () => { MODEL.transfer('dave', 'ed', [ids.a], 'x', ['dave']); }, 'transfer', ['dave', 'ed', [N('a')], 'x'], ['dave']);
  await step('undelegate before expiry refuses', () => { MODEL.undelegate('carol', [ids.a], ['carol']); }, 'undelegate', ['carol', [N('a')]], ['carol']);
  await step('borrower returns early (upstream semantics)', () => { MODEL.transfer('dave', 'carol', [ids.a], 'back', ['dave']); }, 'transfer', ['dave', 'carol', [N('a')], 'back'], ['dave']);
  await step('delegate carol->dave (2s period, redelegate on)', () => { MODEL.delegate('carol', 'dave', [ids.a], 2n, true, 'd2', ['carol']); }, 'delegate', ['carol', 'dave', [N('a')], 2, 1, 'd2'], ['carol']);
  await step('redelegation by the borrower (sovereign never moves)', () => { MODEL.delegate('dave', 'ed', [ids.a], 1n, false, 'r1', ['dave']); }, 'delegate', ['dave', 'ed', [N('a')], 1, 0, 'r1'], ['dave']);
  await sleep(3500); // the 2s period elapses in real chain time; the model clock resyncs per step
  await step('undelegate after expiry', () => { MODEL.undelegate('carol', [ids.a], ['carol']); }, 'undelegate', ['carol', [N('a')]], ['carol']);

  await step('create container', () => { ids.c = MODEL.create('authorgov', 'cred', 'carol', 'cmt-c', 'md-c', false, ['authorgov']); }, 'create', ['authorgov', 'cred', 'carol', 'cmt-c', 'md-c', 0], ['authorgov']);
  await step('create child', () => { ids.d = MODEL.create('authorgov', 'cred', 'carol', 'cmt-d', 'md-d', false, ['authorgov']); }, 'create', ['authorgov', 'cred', 'carol', 'cmt-d', 'md-d', 0], ['authorgov']);
  await step('attach by the AUTHOR (F-3 composition is author-gated upstream)', () => { MODEL.attach('carol', ids.c, [ids.d], ['authorgov']); }, 'attach', ['carol', N('c'), [N('d')]], ['authorgov']);
  await step('attach by the OWNER refuses (the F-3 seam, live)', () => { MODEL.attach('carol', ids.c, [ids.a], ['carol']); }, 'attach', ['carol', N('c'), [N('a')]], ['carol']);
  await step('burn a container with children refuses', () => { MODEL.burn('carol', [ids.c], ['carol']); }, 'burn', ['carol', [N('c')], 'b'], ['carol']);
  await step('detach by the AUTHOR', () => { MODEL.detach('carol', ids.c, [ids.d], ['authorgov']); }, 'detach', ['carol', N('c'), [N('d')]], ['authorgov']);

  await step('createf WOOD authorctrl=true', () => { MODEL.createf('authorgov', 1000000000000n, 'WOOD', true, '{}', ['authorgov']); }, 'createf', ['authorgov', '100000000.0000 WOOD', 1, '{}'], ['authorgov']);
  await step('issuef to bob', () => { MODEL.issuef('bob', 'authorgov', { symbol: 'WOOD', amount: 100000000n }, 'i', ['authorgov']); }, 'issuef', ['bob', 'authorgov', '10000.0000 WOOD', 'i'], ['authorgov']);
  await step('transferf bob->carol', () => { MODEL.transferf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 10000000n }, 't', ['bob']); }, 'transferf', ['bob', 'carol', 'authorgov', '1000.0000 WOOD', 't'], ['bob']);
  await step('F-1 LIVE: the issuer moves a holder balance on the issuer signature ALONE', () => { MODEL.transferf('carol', 'authorgov', 'authorgov', { symbol: 'WOOD', amount: 5000000n }, 'confiscate', ['authorgov']); }, 'transferf', ['carol', 'authorgov', 'authorgov', '500.0000 WOOD', 'confiscate'], ['authorgov']);
  await step('transferf by a stranger refuses', () => { MODEL.transferf('carol', 'ed', 'authorgov', { symbol: 'WOOD', amount: 100000n }, 'x', ['mallory']); }, 'transferf', ['carol', 'ed', 'authorgov', '10.0000 WOOD', 'x'], ['mallory']);
  await step('offerf carol->ed', () => { MODEL.offerf('carol', 'ed', 'authorgov', { symbol: 'WOOD', amount: 1000000n }, 'of', ['carol']); }, 'offerf', ['carol', 'ed', 'authorgov', '100.0000 WOOD', 'of'], ['carol']);
  const ftOfferId = reconcileFtOfferId();
  await step('claimf by the wrong offeree refuses', () => { MODEL.claimf('mallory', [ftOfferId], ['mallory']); }, 'claimf', ['mallory', [Number(ftOfferId)]], ['mallory']);
  await step('claimf by the offeree (consent)', () => { MODEL.claimf('ed', [ftOfferId], ['ed']); }, 'claimf', ['ed', [Number(ftOfferId)]], ['ed']);
  await step('F-1b LIVE: the issuer burns a holder balance alone', () => { MODEL.burnf('ed', 'authorgov', { symbol: 'WOOD', amount: 100000n }, 'cb', ['authorgov']); }, 'burnf', ['ed', 'authorgov', '10.0000 WOOD', 'cb'], ['authorgov']);
  await step('attachf value into the container (author-gated)', () => { MODEL.attachf('carol', 'authorgov', { symbol: 'WOOD', amount: 100000n }, ids.c, ['authorgov']); }, 'attachf', ['carol', 'authorgov', '10.0000 WOOD', N('c')], ['authorgov']);
  await step('detachf value back (author-gated)', () => { MODEL.detachf('carol', 'authorgov', { symbol: 'WOOD', amount: 100000n }, ids.c, ['authorgov']); }, 'detachf', ['carol', 'authorgov', '10.0000 WOOD', N('c')], ['authorgov']);

  await step('createntt for alice (direct)', () => { ids.n1 = MODEL.createntt('authorgov', 'cap', 'alice', 'ntt-cmt', '{}', false, ['authorgov']); }, 'createntt', ['authorgov', 'cap', 'alice', 'ntt-cmt', '{}', 0], ['authorgov']);
  await step('createntt requireclaim for bob', () => { ids.n2 = MODEL.createntt('authorgov', 'cap', 'bob', 'ntt-cmt2', '{}', true, ['authorgov']); }, 'createntt', ['authorgov', 'cap', 'bob', 'ntt-cmt2', '{}', 1], ['authorgov']);
  await step('claimntt by bob (consent)', () => { MODEL.claimntt('bob', [ids.n2], ['bob']); }, 'claimntt', ['bob', [N('n2')]], ['bob']);
  await step('updatentt by the author', () => { MODEL.updatentt('authorgov', 'alice', ids.n1, 'nmd', ['authorgov']); }, 'updatentt', ['authorgov', 'alice', N('n1'), 'nmd'], ['authorgov']);
  await step('burnntt by alice', () => { MODEL.burnntt('alice', [ids.n1], ['alice']); }, 'burnntt', ['alice', [N('n1')], 'b'], ['alice']);

  await step('changeauthor by the author alone (F-8 seam, upstream semantics)', () => { MODEL.changeauthor('authorgov', 'authorx', 'carol', [ids.c], 'ca', ['authorgov']); }, 'changeauthor', ['authorgov', 'authorx', 'carol', [N('c')], 'ca'], ['authorgov']);
  await step('changeauthor by the owner alone refuses', () => { MODEL.changeauthor('authorx', 'authorgov', 'carol', [ids.c], 'ca', ['carol']); }, 'changeauthor', ['authorx', 'authorgov', 'carol', [N('c')], 'ca'], ['carol']);
  await step('burn by the owner (final)', () => { MODEL.burn('carol', [ids.c], ['carol']); }, 'burn', ['carol', [N('c')], 'final'], ['carol']);

  // ---- receipt ----------------------------------------------------------
  const matched = rows.filter((x) => x.verdict === 'match').length;
  const f1 = rows.find((x) => x.name.startsWith('F-1 LIVE'));
  const f3 = rows.find((x) => x.name.startsWith('attach by the OWNER'));
  const receipt = {
    beat: 'wb002-wasm-vs-model',
    stack: { client: `antelope-spring ${info.server_version_string || info.server_version}`, chain: 'local dev chain, single producer', wasm: 'vendored 2021 e6a042f, verbatim, never rebuilt' },
    steps: rows.length, matched, classMismatches, stateMismatches,
    refusedStepsProvenAtomicOnChain: atomicityChecks,
    f1IssuerConfiscationAcceptedOnChain: f1 ? f1.chain === 'accept' : false,
    f3OwnerAttachRefusedOnChain: f3 ? f3.chain === 'refuse' : false,
    rows,
  };
  const finalChainHash = sha(canon(projectChain()));
  const finalModelHash = sha(canon(projectModel(MODEL)));
  console.log(`bT-WB002-WASM: corpus steps 0 -> ${rows.length}, verdicts matched 0 -> ${matched}, class mismatches 0 -> ${classMismatches}, state mismatches 0 -> ${stateMismatches}`);
  console.log(`bT-WB002-WASM: refused steps proven atomic on chain 0 -> ${atomicityChecks}; F-1 issuer confiscation ACCEPTED on chain: ${receipt.f1IssuerConfiscationAcceptedOnChain}; F-3 owner-attach refused on chain: ${receipt.f3OwnerAttachRefusedOnChain}`);
  console.log(`bT-WB002-WASM: final projections agree: ${finalChainHash === finalModelHash}`);
  // the committed receipt scrubs 48+ hex runs (tx ids) — the marker law
  // has no same-line carrier inside JSON; full ids live in the run output
  const scrub = (s) => s.replace(/[0-9a-fA-F]{48,}/g, (m) => `${m.slice(0, 10)}…redacted`);
  writeFileSync(process.env.WB002_RECEIPT || '/tmp/wb002-wasm-receipt.json', JSON.stringify({ ...receipt, hexScrubbed: true, finalChainHash40: finalChainHash.slice(0, 40), rows: receipt.rows.map((r) => ({ ...r, chainMsg: r.chainMsg ? scrub(r.chainMsg) : undefined })) }, null, 2));
  cleanup();
  process.exit(classMismatches + stateMismatches > 0 || finalChainHash !== finalModelHash ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS FAILED:', e.stack || e.message); cleanup(); process.exit(2); });
