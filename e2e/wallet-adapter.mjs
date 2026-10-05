// wallet-adapter.mjs — the SPEC-ADAPTER-CONTRACT-1 gate battery (§9 criteria 1–6).
// The contract is real here: two adapters attached (vaulta full, hive read),
// real Web Workers in real Chromium, mocked rails behind one RegExp (glob trap
// law). Mutations are served-file surgery — the page loads a MUTATED copy of
// the worker and the gate asserts the enforcement fires. A gate that has never
// gone red has not been proven: every mutation below is first shown green on
// the unmutated path. Run:  cd e2e && node wallet-adapter.mjs
import {installWalletFixture,WALLET_ORIGIN} from './lib/wallet-source-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pinRegister, REG } from './wallet-register-pin.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`); }
};

const J4_CHAIN = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'; // PUBLIC-CONSTANT: Jungle4 chain id
const MAIN_CHAIN = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
const RPC_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com|api\.eosn\.io|jungle4\.cryptolions\.io|jungle4\.eosphere\.io|jungle4\.api\.eosnation\.io|api\.hive\.blog|arweave\.net|ar-io\.dev|gateway\.ardrive\.io)(\/|$)/;
const J4_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // TESTNET-ONLY: eosio's documented dev key, chain-significant nowhere
const COMMIT_ABI = {
  account_name: 'banchor22222',
  abi: {
    version: 'eosio::abi/1.2',
    actions: [{ name: 'commit', type: 'commit' }],
    structs: [{ name: 'commit', fields: [
      { name: 'committer', type: 'name' }, { name: 'epoch', type: 'uint64' },
      { name: 'new_root', type: 'checksum256' }, { name: 'prev_root', type: 'checksum256' },
      { name: 'tree_size', type: 'uint64' }, { name: 'delta_id', type: 'checksum256' },
      { name: 'forced_watermark', type: 'uint64' } ] }],
    types: []
  }
};
const BNAME_ABI = {
  account_name: 'kingbeelovis',
  abi: { version: 'eosio::abi/1.2',
    actions: [{ name: 'registeracc', type: 'registeracc' }],
    structs: [{ name: 'registeracc', fields: [
      { name: 'registrant', type: 'name' }, { name: 'domain_name', type: 'string' }, { name: 'target', type: 'name' } ] }],
    types: [] }
};

/* the mocked rail estate: one shared state per context — the dedupe map is
   the "exactly one tx id" oracle (same packed bytes ⇒ same id, forever) */
function mockChain(ctx, opts = {}) {
  const state = { head: 123456, byPacked: new Map(), submits: 0, abortsRemaining: 0, blockCarries: true };
  const cors = { 'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  ctx.route(RPC_RE, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(route.request().url());
    const json = (obj, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(obj) });
    if (/arweave|ar-io|ardrive/.test(u.host)) {
      const text = (t, status = 200) => route.fulfill({ status, headers: cors, body: String(t) });
      if (u.pathname.startsWith('/price/')) return text('1000');
      if (u.pathname === '/tx_anchor') return text('MOCKANCHOR' + 'a'.repeat(24));
      if (u.pathname === '/spot_price') return text('20.5');
      if (u.pathname.startsWith('/wallet/') && u.pathname.endsWith('/balance')) return text('0');
      if (u.pathname === '/tx' && route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData());
        if (!body.signature || !body.id || !body.owner) return route.fulfill({ status: 400, headers: cors, body: 'malformed tx' });
        state.arPosts = (state.arPosts || 0) + 1;
        if (state.arAbort > 0) { state.arAbort--; return route.abort('connectionfailed'); }   // the gateway took it, or not: the answer is lost
        state.arAccepted = body.id;                                  // idempotent by id — the rail's own dedupe
        return route.fulfill({ status: 202, headers: cors, body: '' });
      }
      if (/^\/tx\/[^/]+\/status$/.test(u.pathname)) {                           // the confirm rail read
        if (state.arConfirm) return json({ block_height:123499, block_indep_hash:'B'.repeat(64), number_of_confirmations:20 });
        return json('pending',202);
      }
      return text('');
    }
    if (/api\.hive\.blog/.test(u.host)) {
      const accounts = [{ balance: '425.103 HIVE' }];
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: accounts }) });
    }
    const isJ4Host = /jungle4/.test(u.host);
    const chain = opts.mainAsJ4 ? MAIN_CHAIN : (isJ4Host ? J4_CHAIN : MAIN_CHAIN);
    if (u.pathname.endsWith('/get_currency_balance')) {
      const q = JSON.parse(route.request().postData());
      if (q.code !== 'core.vaulta' || q.symbol !== 'A') return json([]);
      return json(q.account === 'emptyacct' ? { unreadable: true } : ['12.3456 A']);
    }
    if (u.pathname.endsWith('/get_account')) {
      return json({ core_liquid_balance: '0.0000 EOS' });
    }
    if (u.pathname.endsWith('/get_abi')) {
      const want = JSON.parse(route.request().postData()).account_name;
      return json(want === 'banchor22222' ? COMMIT_ABI : BNAME_ABI);
    }
    if (u.pathname.endsWith('/get_info')) return json({ chain_id: chain, head_block_num: state.head });
    if (u.pathname.endsWith('/get_block')) {
      const num = JSON.parse(route.request().postData()).block_num_or_id;
      if (num === 123453) return json({ ref_block_prefix: 987654321, timestamp: '2026-08-28T00:00:00.000' });   // the build read
      const txs = [];
      if (state.blockCarries) for (const [packed, txid] of state.byPacked) txs.push({ id: txid, status: 'executed', packed_hint: packed.slice(0, 8) });
      return json({ id: 'MOCKBLOCK' + num, block_num: num, transactions: txs });
    }
    if (u.pathname.endsWith('/send_transaction')) {
      const body = JSON.parse(route.request().postData());
      if (state.refuse) { state.refused = (state.refused || 0) + 1; return json({ code: 500, message: 'Internal Service Error', error: { code: 3050003, details: [{ message: state.refuse }] } }, 500); }   // the chain evaluated it and said no
      if (!body.packed_trx || !body.signatures || !body.signatures.length)
        return json({ error: { details: [{ message: 'malformed tx body — packing or signature missing' }] } }, 400);
      if (state.abortsRemaining > 0) { state.abortsRemaining--; return route.abort('connectionfailed'); }   // the whole rail is cut — rotation cannot walk around it
      state.submits++;
      if (state.slowMs) await new Promise(r => setTimeout(r, state.slowMs));   // an answer that takes its time: a second press lands while it runs
      if (state.beforeAck) await state.beforeAck();                           // what happens in the page between the send and its answer
      let txid = state.byPacked.get(body.packed_trx);
      if (!txid) { txid = 'MOCKTXID' + body.packed_trx.slice(0, 16); state.byPacked.set(body.packed_trx, txid); state.head = 123499; }
      return json({ transaction_id: txid, processed: state.noHint ? { status: 'executed' } : { block_num: 123460, status: 'executed' } });
    }
    return json({});
  });
  return state;
}

/* serve the vaulta worker with surgery — the MUTATION rig (§9's red paths) */
function mutateVaulta(ctx, from, to) {
  ctx.route(/wallet-adapter-vaulta\.js/, async route => {
    const src = await readFile(join(ROOT, 'surfaces', 'wallet-adapter-vaulta.js'), 'utf8');
    if (!src.includes(from)) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'mutation anchor missing: ' + from });
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: src.replace(from, to) });
  });
}

const WALLET = WALLET_ORIGIN+'/surfaces/wallet.html';
const COMMIT_ARGS = { committer: 'banchor22222', epoch: '1000150', new_root: '0'.repeat(64),
  prev_root: '0'.repeat(64), tree_size: '19', delta_id: '0'.repeat(64), forced_watermark: '1000150' };

const browser = await chromium.launch({ args: ['--no-sandbox'] });
await installWalletFixture(browser,ROOT);
// the register this battery reads in: WALLET_REG (see wallet-register-pin.mjs)
pinRegister(browser);
// the Jungle4 rehearsal lane, its test key and the raw JSON are cypherpunk's: a pipeline that
// rehearses on Jungle4 opens its own cypherpunk context in every battery
const cyContext = async () => { const c = await browser.newContextOwnRegister(); await c.addInitScript(() => { try { localStorage.setItem('bregister', 'cypherpunk'); } catch (e) {} }); return c; };
try {
  /* ── 1 · describe + attach: two adapters, contract v1, vendored lane works
         inside the worker (the stack-law proof — present-but-inert is not ok) */
  console.log('1 · describe + attach (§9.1):');
  let page, ctx, rail;
  {
    ctx = await browser.newContext(); rail = mockChain(ctx);
    page = await ctx.newPage();
    await page.goto(WALLET, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached && BNRWALLET.adapters.hive.attached, null, { timeout: 12000 });
    const d = await page.evaluate(() => BNRWALLET.adapters.vaulta.caps);
    ok('vaulta describes: rail, contract v1, networks, replay_safe', d.rail === 'vaulta' && d.contract_version === '1' &&
      JSON.stringify(d.networks) === '["mainnet","jungle4"]' && d.replay_safe === true, JSON.stringify(d));
    ok('vaulta declares exactly the contract capabilities', JSON.stringify(d.capabilities) ===
      '["balance","status","buildSend","buildAction","submit","confirm"]', JSON.stringify(d.capabilities));
    const h = await page.evaluate(() => BNRWALLET.adapters.hive.caps);
    ok('hive describes: read rail, balance only', h.rail === 'hive' && JSON.stringify(h.capabilities) === '["balance"]', JSON.stringify(h));
    ok('adapter states painted in the composer', /vaulta ✓/.test(await page.locator('#adapter-states').innerText()));
    const vis = await page.evaluate(() => ['tx-net', 'tx-data', 'tx-k', 'adapter-states', 'tx-go', 'tx-contract'].map(id => document.getElementById(id).getClientRects().length > 0));
    ok(REG === 'cypherpunk' ? 'cypherpunk keeps the test network, the raw JSON, the presets and the adapter chips' : 'bee and raver show no test network, no raw JSON, no estate presets and no adapter chips: the account, the action and its parts carry it',
      REG === 'cypherpunk' ? vis.every(Boolean) : (vis.slice(0, 4).every(v => !v) && vis[4] && vis[5]), JSON.stringify(vis));
    const balance = await page.evaluate(() => BNRWALLET.callAdapter('vaulta', 'balance', { address: 'banchor22222' }));
    ok('the A balance is read at core.vaulta, never the EOS core balance relabelled',
      balance.unit === 'A' && balance.quantity === '12.3456 A', JSON.stringify(balance));
    const emptyBalance = await page.evaluate(() => BNRWALLET.callAdapter('vaulta', 'balance', { address: 'emptyacct' }).then(()=>null,error=>error.message));
    ok('an unreadable A balance is refused, never fabricated as zero',
      /A balance of emptyacct unreadable/.test(emptyBalance), String(emptyBalance));
  }

  /* ── 2 · the pipeline on the mock: build → sign → OUTBOX PERSISTED →
         submit → confirm reads the block → CONFIRMED with named evidence */
  console.log('2 · full pipeline (green path):');
  {
    /* the Jungle4 rehearsal lane, its test key and the raw JSON are cypherpunk's: in bee and raver
       this pipeline runs on a cypherpunk page of its own */
    let cp = page;
    if (REG !== 'cypherpunk') { const cc = await cyContext(); mockChain(cc); cp = await cc.newPage(); await cp.goto(WALLET, { waitUntil: 'load' });
      await cp.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 }); }
    await cp.selectOption('#tx-net', 'j4');
    await cp.fill('#tx-contract', 'banchor22222');
    await cp.fill('#tx-action', 'commit');
    await cp.click('#tx-abi');
    await cp.waitForFunction(() => document.querySelectorAll('.tx-f').length === 7, null, { timeout: 8000 });
    const fields = await cp.locator('.tx-f').evaluateAll(els =>
      els.map(e => e.getAttribute('data-fn') + ':' + e.getAttribute('data-ft')));
    ok('seven ABI fields rendered, typed (vendored eosjs serializes IN the worker)',
      fields.length === 7 && fields[0] === 'committer:name' && fields[6] === 'forced_watermark:uint64', fields.join(' '));
    await cp.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; }).catch(()=>{});
    await cp.fill('#tx-j4actor', 'banchor22222');
    await cp.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; }).catch(()=>{});
    await cp.fill('#tx-j4key', J4_WIF);
    await cp.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await cp.click('#tx-go');
    await cp.waitForFunction(() => /CONFIRMED|FAILED|EXPIRED|error|refused/i.test(document.getElementById('tx-out').textContent), null, { timeout: 30000 });
    const out = await cp.locator('#tx-out').innerText(), outRaw = await cp.locator('#tx-out').textContent();
    ok('CONFIRMED only from the block read, evidence names what was read (kept for cypherpunk)',
      /done\. the chain confirmed it/.test(out) && /CONFIRMED by a block read: get_block #123460/.test(outRaw) && /MOCKTXID/.test(outRaw), outRaw.slice(0, 160));
    ok('the intent is previewed in words before the go (the words for every register, the raw lines for cypherpunk)',
      /^run commit on banchor22222 with the parts shown, on the Jungle4 test network\. you sign as banchor22222\.$/.test(await cp.locator('#tx-preview-body .tx-words').textContent()) &&
      /in words/.test(await cp.locator('#tx-preview-body').textContent()), await cp.locator('#tx-preview-body').textContent());
    const obx = await cp.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]'));
    ok('outbox holds the entry, phase confirmed, digest + human summary present',
      obx.length === 1 && obx[0].phase === 'confirmed' && /^[0-9a-f]{64}$/.test(obx[0].digest) &&
      /Vaulta action banchor22222::commit/.test(obx[0].human_summary), JSON.stringify(obx[0] && { phase: obx[0].phase }));
    const rowWords = await cp.evaluate(() => { const r = document.querySelector('#outbox-list .obx-row'); const was = document.body.getAttribute('data-reg'); document.body.setAttribute('data-reg', 'bee');
      const t = r ? r.firstElementChild.innerText : ''; document.body.setAttribute('data-reg', was); return t; });
    ok('a Jungle4 row says its test network in words a bee reader sees', /^run commit on banchor22222 with the parts shown, on the Jungle4 test network\./.test(rowWords), rowWords);
    ok('signed bytes persisted BEFORE submit (order provable: signatures present with the packed tx)',
      !!(obx[0] && obx[0].signed_bytes) && JSON.parse(obx[0].signed_bytes).signatures.length === 1 &&
      JSON.parse(obx[0].signed_bytes).packed_hex.length > 100);
  }

  /* ── 3 · §9.2 MUTATION — buildAction removed from describe: the call path
         is GONE (zero dispatch, telemetry-proven), not a worker-side error */
  console.log('3 · capability mutation (§9.2):');
  {
    const c2 = await browser.newContext(); mockChain(c2);
    mutateVaulta(c2, "capabilities: ['balance', 'status', 'buildSend', 'buildAction', 'submit', 'confirm']",
      "capabilities: ['balance', 'status', 'buildSend', 'submit', 'confirm']");
    const p2 = await c2.newPage();
    await p2.goto(WALLET, { waitUntil: 'load' });
    await p2.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    const sentBefore = await p2.evaluate(() => BNRWALLET._telemetry.vaulta.sent);   // describe already counted
    const r = await p2.evaluate(() => window.BNRWALLET.walletAction('banchor22222', 'commit',
      { committer: 'x', epoch: '1' }, [{ actor: 'banchor22222', permission: 'active' }], { network: 'j4', wif: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' })); // TESTNET-ONLY: eosio documented dev key
    const sentAfter = await p2.evaluate(() => BNRWALLET._telemetry.vaulta.sent);
    const out = await p2.locator('#tx-out').innerText(), outRaw = await p2.locator('#tx-out').textContent();
    ok('undeclared capability: the shell refuses at the seam — ZERO messages dispatched',
      r === null && sentAfter === sentBefore && /cannot build actions, so nothing was signed/.test(out) && /not declared/.test(outRaw), `sent ${sentBefore}→${sentAfter} · ${outRaw.slice(0, 120)}`);
    await c2.close();
  }

  /* ── 4 · §9.3 MUTATION — a leaking balance: the redaction wall quarantines */
  console.log('4 · redaction wall mutation (§9.3):');
  {
    const c3 = await browser.newContext(); mockChain(c3);
    mutateVaulta(c3, "return { unit: 'A', quantity: a.length ? displayA(a[0]) : '0.0000 A' };",
      "return { unit: 'A', quantity: a.length ? displayA(a[0]) : '0.0000 A', memo_hint: '" + J4_WIF + "' };");
    const p3 = await c3.newPage();
    await p3.goto(WALLET, { waitUntil: 'load' });
    await p3.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    const r = await p3.evaluate(() => BNRWALLET.callAdapter('vaulta', 'balance', { address: 'banchor22222' }).then(
      () => 'LEAKED THROUGH', e => e.message));
    ok('WIF-shaped material in a response: rejected by the wall, never reaches the caller',
      /REDACTION WALL/.test(String(r)), String(r).slice(0, 100));
    await c3.close();
  }

  /* ── 5 · §9.4 — kill the vaulta worker mid-flight: hive keeps answering */
  console.log('5 · fault containment (§9.4):');
  {
    await page.evaluate(() => BNRWALLET._crash('vaulta', 'gate kill — mid-operation'));
    const hb = await page.evaluate(() => BNRWALLET.callAdapter('hive', 'balance', { address: 'anybody' }));
    ok('vaulta crashed — hive still answers balance (one rail, never the wallet)',
      hb && hb.unit === 'HIVE' && /425\.103/.test(hb.quantity), JSON.stringify(hb));
    const st = await page.locator('#adapter-states').innerText();
    ok('the composer shows vaulta down and hive standing', /vaulta — down/.test(st) && /hive ✓/.test(st), st);
  }

  /* ── 6 · §9.5 — network cut between sign and submit, then retry:
         exactly ONE transaction id reaches the rail, identical stored bytes */
  console.log('6 · cut-then-retry (§9.5):');
  {
    const c6 = await cyContext(); const rail6 = mockChain(c6); rail6.abortsRemaining = 5;
    const p6 = await c6.newPage();
    await p6.goto(WALLET, { waitUntil: 'load' });
    await p6.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await p6.selectOption('#tx-net', 'j4');
    await p6.fill('#tx-contract', 'banchor22222'); await p6.fill('#tx-action', 'commit');
    await p6.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; }).catch(()=>{});
    await p6.fill('#tx-j4actor', 'banchor22222'); await p6.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; }).catch(()=>{});
    await p6.fill('#tx-j4key', J4_WIF);
    await p6.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await p6.click('#tx-go');
    await p6.waitForFunction(() => /submit faulted|resubmit the identical|CONFIRMED|FAILED/i.test(document.getElementById('tx-out').textContent), null, { timeout: 30000 });
    const afterCut = await p6.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('network cut at submit: entry stays phase signed — bytes persisted, nothing lost',
      afterCut && afterCut.phase === 'signed' && afterCut.signed_bytes, JSON.stringify(afterCut && afterCut.phase));
    await p6.click('.obx-retry');
    await p6.waitForFunction(() => ((JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]) || {}).phase !== 'signed', null, { timeout: 30000 });
    const inFlight = await p6.evaluate(() => { const b = document.querySelector('#outbox-list .obx-retry'); return { btn: b ? b.disabled : 'gone', phase: JSON.parse(localStorage.getItem('bnr_outbox_v1'))[0].phase }; });
    ok('while a row is still sending, its repainted button stays pressed: a second press cannot start a second send',
      inFlight.btn === true || (inFlight.btn === 'gone' && inFlight.phase === 'confirmed'), JSON.stringify(inFlight));
    await p6.waitForFunction(() => {
      const e = (JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]) || {};
      return e.phase === 'confirmed' || e.phase === 'failed' || e.phase === 'expired';
    }, null, { timeout: 30000 });
    const afterRetry = await p6.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('retry resubmitted the IDENTICAL stored bytes (same signatures, never re-signed)',
      afterRetry.signed_bytes === afterCut.signed_bytes && afterRetry.digest === afterCut.digest &&
      afterRetry.intent_id === afterCut.intent_id, 'signed bytes ' + (afterRetry.signed_bytes === afterCut.signed_bytes ? 'identical' : 'CHANGED'));
    ok('exactly ONE transaction id reached the rail', rail6.byPacked.size === 1 && rail6.submits >= 1,
      `distinct ids ${rail6.byPacked.size} across ${rail6.submits} accepted submits · abortsLeft=${rail6.abortsRemaining}`);
  }

  /* ── 7 · §9.6 — a lying ack (tx never lands in a block): NO terminal state,
         and the honest terminal is time (expiry), never the ack */
  console.log('7 · lying ack (§9.6):');
  {
    const c7 = await cyContext(); const rail7 = mockChain(c7); rail7.blockCarries = false;
    const p7 = await c7.newPage();
    await p7.goto(WALLET, { waitUntil: 'load' });
    await p7.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await p7.selectOption('#tx-net', 'j4');
    await p7.fill('#tx-contract', 'banchor22222'); await p7.fill('#tx-action', 'commit');
    await p7.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; }).catch(()=>{});
    await p7.fill('#tx-j4actor', 'banchor22222'); await p7.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; }).catch(()=>{});
    await p7.fill('#tx-j4key', J4_WIF);
    await p7.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await p7.click('#tx-go');
    await p7.waitForFunction(() => /not visible yet|reading again/i.test(document.getElementById('tx-out').textContent), null, { timeout: 20000 });
    const midOut = await p7.locator('#tx-out').innerText(), midRaw = await p7.locator('#tx-out').textContent();
    const midBox = await p7.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('ack without a block: UI says sent and waiting, never done; outbox phase submitted',
      /waiting for the chain to confirm it/.test(midOut) && !/confirmed it\./.test(midOut) && !/CONFIRMED/.test(midRaw) && !/✓/.test(midOut) && midBox.phase === 'submitted', midRaw.slice(0, 120));
    // force the clock: the intent's window closes → the HONEST terminal is expired
    await p7.evaluate(() => {
      const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l[l.length - 1].expires_at = new Date(Date.now() - 120000).toISOString();   // past the 30s grace — the honest terminal is due
      localStorage.setItem('bnr_outbox_v1', JSON.stringify(l));
    });
    /* the flow that sent it still holds its row (one send at a time per entry): its button stays pressed, and that flow reads the closed window */
    ok('while the sending flow still reads the chain, the row\'s button stays pressed', await p7.evaluate(() => { const b = document.querySelector('#outbox-list .obx-retry'); return !!b && b.disabled; }));
    await p7.waitForFunction(() => {
      const e = (JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]) || {};
      return e.phase === 'expired' || e.phase === 'confirmed';
    }, null, { timeout: 30000 });
    const endOut = await p7.locator('#tx-out').innerText(), endRaw = await p7.locator('#tx-out').textContent();
    const rowOut = await p7.locator('#outbox-list .obx-row .obx-stat').first().innerText();
    const endBox = await p7.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('terminal came from the rail/time (expired), never from the ack, said in the line that sent it and kept in its row',
      /did not show up on the chain before its time ran out/.test(endOut) && /check your coins/.test(endOut) && /expired|EXPIRED/.test(endRaw) && endBox.phase === 'expired' && !/CONFIRMED/.test(endRaw) && /check your coins/.test(rowOut), endRaw.slice(0, 120) + ' · row: ' + rowOut);
    ok('a send a node took, missing from the one block that was read, is filed as cannot tell (maybe in), never as most likely not gone',
      /so this wallet cannot tell whether it went in\./.test(endOut) && !/most likely did not go through/.test(endOut) && endBox.evidence && endBox.evidence.maybe_in === true && !endBox.evidence.definite, endOut);
  }

  /* ── 8 · the chain-id guard still guards (worker-side now) ─────────────── */
  console.log('8 · chain-id guard:');
  {
    const c8 = await browser.newContext(); mockChain(c8, { mainAsJ4: true });
    const p8 = await c8.newPage();
    await p8.goto(WALLET, { waitUntil: 'load' });
    await p8.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    const r = await p8.evaluate(() => window.BNRWALLET.callAdapter('vaulta', 'buildAction', {
      account: 'banchor22222', action: 'commit',
      data: { committer: 'banchor22222', epoch: '1', new_root: '0'.repeat(64), prev_root: '0'.repeat(64), tree_size: '1', delta_id: '0'.repeat(64), forced_watermark: '1' },
      auth: [{ actor: 'banchor22222', permission: 'active' }], network: 'jungle4' }).then(
      () => 'BUILT (WRONG)', e => e.message));
    ok('a J4 host answering mainnet chain id: build REFUSED before any signing',
      /chain-id guard/.test(String(r)) && /REFUSED/.test(String(r)), String(r).slice(0, 100));
    await c8.close();
  }

  /* ── 9 · the Unicove retirement, pinned ────────────────────────────────── */
  console.log('9 · Unicove retired:');
  {
    const src = await readFile(join(ROOT, 'surfaces', 'bnames.html'), 'utf8');
    ok('bnames carries the walletAction factory into the composer',
      /function walletAction\(/.test(src) && /compose=/.test(src) && /encodeURIComponent/.test(src) && /\.\/wallet\.html/.test(src));
    ok('no unicove wiring remains in bnames (the word may appear in the tombstone copy)',
      !/unicove\.com/i.test(src) && !/unicoveAction/.test(src) && !/OPEN IN UNICOVE/.test(src));
    const wsrc = await readFile(join(ROOT, 'surfaces', 'wallet.html'), 'utf8');
    ok('wallet.html itself names no unicove', !/unicove\.com/i.test(wsrc));
    ok('no ack-as-receipt copy survives in the wallet (the rendered ✓-BROADCAST shape is dead)', !/✓ SIGNED \+ BROADCAST/.test(wsrc));
    // prefill still lands the bnames handoff
    const c9 = await browser.newContext(); mockChain(c9);
    const p9 = await c9.newPage();
    const args = encodeURIComponent(JSON.stringify({ registrant: 'kingbeelovis', domain_name: 'k', target: 'kingbeelovis' }));
    await p9.goto(WALLET + '?compose=' + encodeURIComponent('kingbeelovis:registeracc') + '&args=' + args, { waitUntil: 'load' });
    await p9.waitForFunction(() => document.querySelectorAll('.tx-f').length === 3, null, { timeout: 9000 });
    ok('URL prefill lands: bnames link → contract+action+args loaded',
      (await p9.locator('#tx-contract').inputValue()) === 'kingbeelovis' &&
      (await p9.locator('#tx-action').inputValue()) === 'registeracc');
    /* a link that names the action and carries no parts: the line says what it filled in, never "nothing" */
    await p9.goto(WALLET + '?compose=' + encodeURIComponent('kingbeelovis:registeracc'), { waitUntil: 'load' });
    await p9.waitForFunction(() => /this link/.test(document.getElementById('tx-out').innerText), null, { timeout: 25000 }).catch(() => {});
    const desk9 = { out: await p9.locator('#tx-out').innerText(), contract: await p9.locator('#tx-contract').inputValue(), action: await p9.locator('#tx-action').inputValue() };
    ok('a link with the action and no parts says its parts are empty, never that nothing is filled in',
      desk9.contract === 'kingbeelovis' && desk9.action === 'registeracc' && /^this link named the action but not its parts, so its parts are empty here. fill them in, or go back to the name desk./.test(desk9.out) && !/nothing is filled in/.test(desk9.out), JSON.stringify(desk9));
    await c9.close();
  }

  /* ── 10 · the SECOND WRITE ADAPTER (§9.7 — the contract tested as a
         contract): arweave buildPublish end-to-end + the JWK wall ──────── */
  console.log('10 · arweave adapter (§9.7):');
  {
    const c10 = await browser.newContext(); const rail10 = mockChain(c10); rail10.arConfirm = true;
    const p10 = await c10.newPage();
    await p10.goto(WALLET, { waitUntil: 'load' });
    await p10.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.arweave && BNRWALLET.adapters.arweave.attached &&
      BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    const desc = await p10.evaluate(() => ({ ar: BNRWALLET.adapters.arweave.caps, vt: BNRWALLET.adapters.vaulta.caps }));
    ok('arweave describes with buildPublish — two WRITE adapters now attached (§9.7 closed)',
      desc.ar.rail === 'arweave' && desc.ar.capabilities.includes('buildPublish') && desc.ar.contract_version === '1' &&
      desc.vt.capabilities.includes('buildAction'), JSON.stringify(desc.ar.capabilities));
    const r = await p10.evaluate(async () => {
      const kp = await crypto.subtle.generateKey({ name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
      const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);        // runtime TEST key — vault side, never crosses the seam
      const bytes = new TextEncoder().encode('lane-b B3 anchor proof — the contract path, not a direct publish');
      window.__jwk10 = jwk;
      const entry = await window.BNRWALLET.walletPublish(bytes, [['App-Name', 'bnr-lane-b'], ['Type', 'anchor-proof']], { jwk: jwk });
      return entry && { phase: entry.phase, ref: entry.ref, evidence: entry.evidence, id: entry.intent_id };
    });
    ok('publish end-to-end: build (public JWK only) → vault sign → outbox → submit → CONFIRMED from the gateway read',
      r && r.phase === 'confirmed' && /^arweave:/.test(r.id) && r.ref && r.ref.length === 43 &&
      /GET \/tx\/.*@ https:\/\/(arweave\.net|ar-io\.dev|gateway\.ardrive\.io)/.test(r.evidence.read), JSON.stringify(r && { phase: r.phase, ev: r.evidence }));
    const obx10 = await p10.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]').filter(e => e.rail === 'arweave'));
    ok('the arweave entry lives in the same outbox under the same phases', obx10.length === 1 && obx10[0].phase === 'confirmed' && obx10[0].signed_by === 'arweave-jwk');
    const publishSame = text => p10.evaluate(async t => { const said = [];
      const e = await window.BNRWALLET.walletPublish(new TextEncoder().encode(t), [['App-Name', 'bnr-lane-b'], ['Type', 'anchor-proof']], { jwk: window.__jwk10, say: p => said.push(p.filter(x => typeof x === 'string').join('')) });
      return { phase: e && e.phase, said: said.join(' | ') }; }, text);
    const posts10 = rail10.arPosts;
    const re10 = await publishSame('lane-b B3 anchor proof — the contract path, not a direct publish');
    const obx10b = await p10.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]').filter(e => e.rail === 'arweave'));
    ok('the same file published again after it is done keeps the done receipt, sends nothing new, and says it was already done',
      !re10.phase && obx10b.length === 1 && obx10b[0].phase === 'confirmed' && obx10b[0].ref === obx10[0].ref && obx10b[0].signed_bytes === obx10[0].signed_bytes && rail10.arPosts === posts10 && /already done, so nothing new was published/.test(re10.said), JSON.stringify({ re10, n: obx10b.length, posts: rail10.arPosts - posts10 }));
    rail10.arAbort = 99;   // every gateway loses its answer: the first copy stays kept, maybe out
    const first10 = await publishSame('a second file, its answer lost on the way back');
    const kept10 = await p10.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]').filter(e => e.rail === 'arweave' && e.phase === 'signed'));
    const posts10b = rail10.arPosts;
    const second10 = await publishSame('a second file, its answer lost on the way back');
    const kept10b = await p10.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]').filter(e => e.rail === 'arweave' && e.phase === 'signed'));
    ok('a second copy of a publish still on its way is never written over the first: nothing new is sent, and it says where the first one waits',
      first10.phase === 'signed' && kept10.length === 1 && !second10.phase && kept10b.length === 1 && kept10b[0].signed_bytes === kept10[0].signed_bytes && rail10.arPosts === posts10b && /already waiting to be sent, so nothing new was published/.test(second10.said),
      JSON.stringify({ first10, second10, kept: kept10.length, keptb: kept10b.length, posts: rail10.arPosts - posts10b }));
    rail10.arAbort = 0;
    await c10.close();
  }

  /* ── 11 · §9.3 MUTATION, arweave shape: a leaking JWK private param ───── */
  console.log('11 · JWK wall mutation:');
  {
    const c11 = await browser.newContext(); mockChain(c11);
    await c11.route(/wallet-adapter-arweave\.js/, async route => {
      const src = await readFile(join(ROOT, 'surfaces', 'wallet-adapter-arweave.js'), 'utf8');
      const from = "return { unit: 'AR', quantity: String(winston), winston: String(winston) };";
      if (!src.includes(from)) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'mutation anchor missing' });
      const to = "return { unit: 'AR', quantity: String(winston), winston: String(winston), p: '" + 'A'.repeat(342) + "' };";
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: src.replace(from, to) });
    });
    const p11 = await c11.newPage();
    await p11.goto(WALLET, { waitUntil: 'load' });
    await p11.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.arweave && BNRWALLET.adapters.arweave.attached, null, { timeout: 25000 });
    const r = await p11.evaluate(() => window.BNRWALLET.callAdapter('arweave', 'balance', { address: 'x'.repeat(43) }).then(
      () => 'LEAKED THROUGH', e => e.message));
    ok('JWK private parameter in a response: rejected by the wall, never reaches the caller',
      /REDACTION WALL/.test(String(r)), String(r).slice(0, 90));
    await c11.close();
  }

  // The wire shown for review and the signing bytes must describe one file.
  for(const mutation of ["reward:String(BigInt(built.wire.reward)+1n)","data_root:'A'.repeat(43)","tags:[]"]){
    const changed=await browser.newContext();mockChain(changed);
    await changed.route(/wallet-adapter-arweave\.js/,async route=>{
      const source=await readFile(join(ROOT,'surfaces/wallet-adapter-arweave.js'),'utf8');
      const anchor='wire_json: JSON.stringify(built.wire),';
      if(!source.includes(anchor))throw Error('mutation anchor missing');
      return route.fulfill({contentType:'text/javascript',body:source.replace(anchor,'wire_json: JSON.stringify({...built.wire,'+mutation+'}),')});
    });
    const p=await changed.newPage();await p.goto(WALLET);
    await p.waitForFunction(()=>window.BNRWALLET?.adapters.arweave?.attached);
    const result=await p.evaluate(async()=>{
      const pair=await crypto.subtle.generateKey({name:'RSA-PSS',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign']);
      const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);let signed=0;
      const original=BNRAR.signRaw;BNRAR.signRaw=async(...args)=>{signed++;return original(...args)};
      let error='';try{await BNRWALLET.walletPublish(new TextEncoder().encode('fixture'),[['App-Name','fixture']],{jwk})}catch(e){error=e.message}
      return {error,signed,outbox:localStorage.getItem('bnr_outbox_v1')};
    });
    ok('changed wire refused before signing: '+mutation,/do not match/.test(result.error)&&result.signed===0&&result.outbox===null,JSON.stringify(result));
    await changed.close();
  }

  // ABI metadata is untrusted RPC text, never executable wallet markup.
  {
    const hostile=await browser.newContext();mockChain(hostile);
    const payload='"><img id="rpc-injection" src="missing" onerror="window.rpcInjected=true">';
    await hostile.route(/\/v1\/chain\/get_abi$/,route=>route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({...COMMIT_ABI,abi:{...COMMIT_ABI.abi,structs:[{name:'commit',fields:[{name:payload,type:'string'}]}]}})}));
    const p=await hostile.newPage();await p.goto(WALLET);
    await p.locator('#tx-contract').fill('banchor22222');await p.locator('#tx-action').fill('commit');await p.locator('#tx-abi').click();
    await p.waitForFunction(()=>document.querySelectorAll('.tx-f').length===1);
    ok('hostile ABI names stay attribute text and cannot inject wallet HTML',await p.locator('.tx-f').getAttribute('data-fn')===payload&&await p.locator('#rpc-injection').count()===0&&await p.evaluate(()=>!window.rpcInjected));
    await hostile.close();
  }

  /* ── 12 · a refusal is one calm sentence and its one action; the node's own words are cypherpunk's ── */
  console.log('12 · refusals in words:');
  for (const [refuse, words, act] of [
    ['account banchor22222 has insufficient ram; needs 9000 bytes has 8000 bytes [ram_usage_exceeded]', /^the test account needs more RAM on the Jungle4 test network\. nothing changed\. open the composer$/, null],
    ['transaction net usage is too high: 300 > 200 [tx_net_usage_exceeded]', /^the chain is not letting the account send more right now\. nothing changed\. try again in a while\.$/, null],
    ['assertion failure with message: <img src=x onerror=window.__xss=9> is not yours [eosio_assert_message_exception]', /^the contract refused it\. nothing changed\.\s*$/, null]]) {
    const c12 = await cyContext(); const r12 = mockChain(c12); r12.refuse = refuse;
    const p12 = await c12.newPage();
    await p12.goto(WALLET, { waitUntil: 'load' });
    await p12.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await p12.selectOption('#tx-net', 'j4');
    await p12.fill('#tx-contract', 'banchor22222'); await p12.fill('#tx-action', 'commit');
    await p12.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; });
    await p12.fill('#tx-j4actor', 'banchor22222'); await p12.fill('#tx-j4key', J4_WIF);
    await p12.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await p12.click('#tx-go');
    await p12.waitForFunction(() => ((JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]) || {}).phase === 'failed', null, { timeout: 30000 }).catch(() => {});
    const said = await p12.evaluate(() => { const o = document.getElementById('tx-out').cloneNode(true); o.querySelectorAll('.wl-cyd').forEach(x => x.remove()); const b = o.querySelector('button.wl-act'); if (b) b.remove();
      return { words: o.textContent, btn: b ? b.textContent : null, cy: [...document.querySelectorAll('#tx-out .wl-cyd')].map(x => x.textContent).join(' '), xss: window.__xss }; });
    ok('a refusal (' + refuse.slice(0, 28) + '…) is one calm sentence and its one action; the node\'s words stay in the detail',
      words.test(said.words) && said.btn === act && !/ram_usage|tx_net|assertion|CPU|NET|<img|banchor22222 has/.test(said.words) && said.cy.includes(refuse.slice(0, 30)) && said.xss === undefined, JSON.stringify(said));
    if (/ram_usage/.test(refuse)) ok('a Jungle4 RAM refusal offers no mainnet RAM buy: its one link opens the composer', await p12.evaluate(() => !!document.querySelector('#tx-out a[href="#composer-sec"]') && !/buy RAM/.test(document.getElementById('tx-out').innerText)), await p12.locator('#tx-out').innerText());
    await c12.close();
  }

  /* 12b · a refusal kept in the outbox: a mainnet RAM refusal opens the wallet's own RAM buy, a Jungle4 one never does */
  {
    const c12b = await browser.newContext(); mockChain(c12b);
    const fx = (id, network) => ({ intent_id: id, rail: 'vaulta', network, phase: 'failed', words: 'run commit on banchor22222 with the parts shown.', signed_bytes: '{}',
      evidence: { read: 'send_transaction refusal', detail: 'account banchor22222 has insufficient ram; needs 9000 bytes has 8000 bytes [ram_usage_exceeded]', definite: true }, created_at: new Date().toISOString() });
    await c12b.addInitScript(l => { try { if (!sessionStorage.getItem('__obx')) { localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); sessionStorage.setItem('__obx', '1'); } } catch (e) {} },
      [fx('vaulta:fixture-ram-j4', 'jungle4'), fx('vaulta:fixture-ram-main', 'mainnet')]);
    const pb = await c12b.newPage();
    await pb.goto(WALLET, { waitUntil: 'load' });
    await pb.waitForFunction(() => document.querySelectorAll('#outbox-list .obx-row').length === 2, null, { timeout: 15000 }).catch(() => {});
    const rows = await pb.evaluate(() => [...document.querySelectorAll('#outbox-list .obx-row')].map(r => ({ id: r.getAttribute('data-id'), btn: (r.querySelector('button.wl-act') || {}).textContent || null, text: r.innerText })));
    const j4 = rows.find(r => r.id === 'vaulta:fixture-ram-j4') || {}, main = rows.find(r => r.id === 'vaulta:fixture-ram-main') || {};
    ok('a kept Jungle4 RAM refusal says its test network and offers no mainnet RAM buy', !j4.btn && /Jungle4 test network/.test(j4.text || '') && !/buy RAM/.test(j4.text || ''), JSON.stringify(j4));
    ok('a kept mainnet RAM refusal keeps its one button: buy RAM with A', main.btn === 'buy RAM with A', JSON.stringify(main));
    await pb.evaluate(() => [...document.querySelectorAll('#outbox-list .obx-row')].find(r => r.getAttribute('data-id') === 'vaulta:fixture-ram-main').querySelector('button.wl-act').click());
    await pb.waitForTimeout(500);
    const sw = await pb.evaluate(() => ({ hash: location.hash, panel: document.getElementById('sw-panel').style.display, dir: document.getElementById('sw-dir').textContent }));
    ok('and it opens the wallet\'s own swap at buy RAM with A, signing nothing by itself', sw.hash === '#pay-sec' && sw.panel === 'block' && /buy RAM with A$/.test(sw.dir), JSON.stringify(sw));
    await c12b.close();
  }

  /* 13 · a node took it and this browser could not write that down: this tab keeps the answer */
  console.log('13 · an answer the outbox could not save:');
  const commitOf = epoch => ({ committer: 'banchor22222', epoch: String(epoch), new_root: '0'.repeat(64), prev_root: '0'.repeat(64), tree_size: '19', delta_id: '0'.repeat(64), forced_watermark: String(epoch) });
  const j4Action = (pg, epoch) => pg.evaluate(([w, d]) => window.BNRWALLET.walletAction('banchor22222', 'commit', d, [{ actor: 'banchor22222', permission: 'active' }], { network: 'j4', wif: w }).then(e => e && e.phase), [J4_WIF, commitOf(epoch)]);
  /* a browser out of room for the outbox, switched on by the test */
  const quota = pg => pg.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__full && this === window.localStorage && String(v).length > String(this.getItem(k) || '').length) throw new DOMException('the quota is full (fixture)', 'QuotaExceededError'); return set.call(this, k, v); }; });
  const stored = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]'));
  {
    const c13 = await cyContext(); const r13 = mockChain(c13); r13.blockCarries = false; r13.noHint = true;
    const p13 = await c13.newPage();
    await p13.goto(WALLET, { waitUntil: 'load' });
    await p13.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await quota(p13);
    r13.beforeAck = () => p13.evaluate(() => { window.__full = true; });
    await j4Action(p13, 1001);
    r13.beforeAck = null;
    const s13 = await p13.evaluate(() => ({ out: document.getElementById('tx-out').innerText, btn: (document.querySelector('#tx-out button.wl-act') || {}).textContent,
      known: localStorage.getItem('bnr_outbox_ack'), row: (document.querySelector('#outbox-list .obx-stat') || {}).innerText }));
    const e13 = (await stored(p13))[0] || {};
    ok('a node took it and the outbox could not write that down: said as sent, with free some storage and its one honest button',
      /^it was sent, but this browser could not save that/.test(s13.out) && s13.btn === 'send it again' && e13.phase === 'signed' && !e13.maybe_out, JSON.stringify({ s13, phase: e13.phase }).slice(0, 220));
    ok('the ack is kept under its own small key, so its row reads as sent (never "not sent yet") with its one honest button', /MOCKTXID/.test(s13.known || '') && /^sent. the chain has not confirmed it yet./.test(s13.row || '') && await p13.textContent('#outbox-list .obx-retry') === 'send it again', JSON.stringify({ row: s13.row, known: s13.known }));
    /* another tab, or this one reopened, reads the same ack: the row is never "signed, not sent yet" there */
    await p13.evaluate(() => { window.__full = false; });
    const q13 = await c13.newPage();
    await q13.goto(WALLET, { waitUntil: 'load' });
    await q13.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached && document.querySelector('#outbox-list .obx-retry'), null, { timeout: 25000 });
    const t13 = await q13.evaluate(() => ({ row: (document.querySelector('#outbox-list .obx-stat') || {}).innerText, btn: (document.querySelector('#outbox-list .obx-retry') || {}).textContent }));
    ok('a second tab reads that ack: the row says sent, and its button sends the same copy again', /^sent\. the chain has not confirmed it yet\./.test(t13.row || '') && t13.btn === 'send it again', JSON.stringify(t13));
    /* storage freed, its window long over: in the second tab the node refuses it as expired. A node took it once, so this is never proof it did not go */
    await q13.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l[0].expires_at = new Date(Date.now() - 600000).toISOString(); localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); });
    r13.refuse = 'expired transaction';
    await q13.click('#outbox-list .obx-retry');
    await q13.waitForFunction(() => (JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0] || {}).phase === 'expired', null, { timeout: 15000 }).catch(() => {});
    const x13 = { e: (await stored(q13))[0] || {}, out: await q13.evaluate(() => (document.querySelector('#outbox-list .obx-stat') || {}).innerText || '') };
    ok('a late press in the second tab is filed as maybe in, never as proof it did not go (no "nothing changed")',
      x13.e.phase === 'expired' && x13.e.evidence && x13.e.evidence.maybe_in === true && !x13.e.evidence.definite && !/nothing changed/.test(x13.out), JSON.stringify(x13).slice(0, 240));
    /* an older tab that never saw the ack wrote "proven expired": every read that knows the ack says maybe in */
    await q13.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l[0].evidence = { read: 'send_transaction refusal', detail: 'expired transaction', definite: true, maybe_in: false }; localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); });
    await q13.reload({ waitUntil: 'load' });
    await q13.waitForFunction(() => document.querySelector('#outbox-list .obx-row'), null, { timeout: 15000 }).catch(() => {});
    const y13 = await q13.evaluate(() => (document.querySelector('#outbox-list .obx-stat') || {}).innerText || '');
    ok('a stored "proven expired" verdict for a send a node took reads as cannot tell, never as nothing changed', /^its time ran out before this wallet could tell whether it went in\./.test(y13) && !/nothing changed/.test(y13), y13);
    await c13.close();
  }

  /* 14 · one send at a time per entry, from any button; a write that fails after an answer is never "nothing was sent"; a gone row leaves */
  console.log('14 · one send per entry, honest after a failed write, a gone row:');
  {
    const c14 = await cyContext(); const r14 = mockChain(c14);
    const p14 = await c14.newPage();
    await p14.goto(WALLET, { waitUntil: 'load' });
    await p14.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    r14.abortsRemaining = 3;   // every Jungle4 host loses the answer: kept, maybe out
    await j4Action(p14, 2001);
    r14.slowMs = 1500;
    const before14 = r14.submits;
    await p14.click('#tx-out button.wl-act');   // the status line's own "send it again"
    await p14.waitForTimeout(400);
    const mid14 = await p14.evaluate(() => { const b = document.querySelector('#outbox-list .obx-retry'); const was = b ? b.disabled : 'gone'; if (b) { b.disabled = false; b.click(); } return was; });   // even a forced press of the row's button starts nothing
    await p14.waitForFunction(() => (JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0] || {}).phase === 'confirmed', null, { timeout: 30000 }).catch(() => {});
    ok('a status line\'s send it again holds the row\'s button, and a press there starts no second send', mid14 === true && r14.submits - before14 === 1, JSON.stringify({ mid14, sends: r14.submits - before14 }));
    r14.slowMs = 0; r14.head = 123456;   // the next build reads its reference block where the mock keeps one
    r14.abortsRemaining = 3;
    await j4Action(p14, 2002);
    await quota(p14);
    await p14.evaluate(() => { window.__full = true; });
    r14.refuse = 'duplicate transaction 2002 (fixture)';
    await p14.click('#outbox-list .obx-retry');
    await p14.waitForFunction(() => /already sent once|nothing was sent/.test((document.querySelector('#outbox-list .obx-row .obx-stat') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => {});
    const d14 = await p14.evaluate(() => (document.querySelector('#outbox-list .obx-row .obx-stat') || {}).innerText || '');
    ok('a duplicate answer this browser could not save is said as already sent, never as nothing sent', /already sent once, so nothing new was signed/.test(d14) && !/nothing was sent/.test(d14), d14);
    await p14.evaluate(() => { window.__full = false; localStorage.setItem('bnr_outbox_v1', '[]'); });   // set aside in another tab this one has not heard from
    r14.refuse = null;
    const before14b = r14.submits + (r14.refused || 0);
    await p14.click('#outbox-list .obx-retry');
    await p14.waitForTimeout(300);
    const g14 = await p14.evaluate(() => ({ rows: document.querySelectorAll('#outbox-list .obx-row').length, note: (document.querySelector('#outbox-list .obx-note') || {}).innerText || '', link: !!document.querySelector('#outbox-list .obx-note a[href="#bal-sec"]') }));
    ok('a press on a row whose entry is gone: the row leaves, nothing is sent, and the line says so with its one link',
      g14.rows === 0 && /^that one is no longer in this list, so nothing was sent from here\./.test(g14.note) && g14.link && r14.submits + (r14.refused || 0) === before14b, JSON.stringify(g14));
    await c14.close();
  }

  /* 15 · check again reads the chain for a kept transaction before it sends anything */
  console.log('15 · check again reads before it sends:');
  {
    const c15 = await cyContext(); const r15 = mockChain(c15);
    const p15 = await c15.newPage();
    await p15.goto(WALLET, { waitUntil: 'load' });
    await p15.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await j4Action(p15, 3001);
    /* the reader left before it was read back: the row still says sent, not confirmed */
    await p15.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l[0].phase = 'submitted'; l[0].evidence = null; localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); });
    await p15.reload({ waitUntil: 'load' });
    await p15.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached && document.querySelector('#outbox-list .obx-retry'), null, { timeout: 25000 });
    const label15 = await p15.textContent('#outbox-list .obx-retry');
    const before15 = r15.submits + (r15.refused || 0);
    await p15.click('#outbox-list .obx-retry');
    await p15.waitForFunction(() => (JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0] || {}).phase === 'confirmed', null, { timeout: 20000 }).catch(() => {});
    const e15 = (await stored(p15))[0] || {};
    const said15 = await p15.evaluate(() => (document.querySelector('#outbox-list .obx-row .obx-stat') || {}).innerText || '');
    ok('a sent row\'s check again reads the chain first: a send that landed reaches done, and nothing is sent again',
      label15 === 'check again' && e15.phase === 'confirmed' && r15.submits + (r15.refused || 0) === before15 && /^done\. the chain confirmed it\./.test(said15), JSON.stringify({ label15, phase: e15.phase, sends: r15.submits - before15, said15 }));
    await c15.close();
  }

  /* 16 · a "duplicate" answer this browser could not save is kept: a later check again never files it as not gone */
  console.log('16 · a duplicate answer kept over an equal phase:');
  {
    const c16 = await cyContext(); const r16 = mockChain(c16); r16.blockCarries = false;
    const now = Date.now();
    await c16.addInitScript(e => { try { if (!sessionStorage.getItem('__obx16')) { localStorage.setItem('bnr_outbox_v1', JSON.stringify([e])); localStorage.setItem('bnr_outbox_ack', JSON.stringify({ [e.intent_id]: { reserved: true, at: Date.now(), pad: '0'.repeat(1000) } })); sessionStorage.setItem('__obx16', '1'); }   /* as outboxPut keeps it: with room reserved for an answer */ } catch (x) {} },
      { intent_id: 'vaulta:fixture-dup16', rail: 'vaulta', network: 'jungle4', phase: 'submitted', ref: 'MOCKREFDUP16', block_hint: 123460, maybe_out: true, evidence: null,
        words: 'run commit on banchor22222 with the parts shown, on the Jungle4 test network.', signed_bytes: JSON.stringify({ network: 'jungle4', packed_hex: '00', signatures: ['SIG_K1_fixture'] }),
        expires_at: new Date(now + 600000).toISOString(), created_at: new Date(now).toISOString(), updated_at: new Date(now - 5000).toISOString() });
    const p16 = await c16.newPage();
    await p16.goto(WALLET, { waitUntil: 'load' });
    await p16.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached && document.querySelector('#outbox-list .obx-retry'), null, { timeout: 25000 });
    await quota(p16);
    /* inside its window: the read does not find it, the resend is answered duplicate, and the outbox cannot write that */
    await p16.evaluate(() => { window.__full = false; const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l[0].expires_at = new Date(Date.now() - 25000).toISOString(); localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); window.__full = true; });
    r16.refuse = 'duplicate transaction (fixture)';
    await p16.click('#outbox-list .obx-retry');
    await p16.waitForFunction(() => { const b = document.querySelector('#outbox-list .obx-retry'); return b && !b.disabled; }, null, { timeout: 30000 }).catch(() => {});
    const d16 = await p16.evaluate(() => ({ ack: JSON.parse(localStorage.getItem('bnr_outbox_ack') || '{}')['vaulta:fixture-dup16'] || null, stored: JSON.parse(localStorage.getItem('bnr_outbox_v1'))[0].evidence }));
    ok('the duplicate answer the outbox could not write is kept under the ack key', !!d16.ack && d16.ack.evidence && d16.ack.evidence.duplicate === true && d16.stored === null, JSON.stringify(d16));
    /* its window is over now: check again reads the block, does not find it, and keeps what the node said */
    await p16.click('#outbox-list .obx-retry');
    await p16.waitForFunction(() => { const b = document.querySelector('#outbox-list .obx-retry'); return b && !b.disabled && /a node already held it|did not go through|cannot tell/.test((document.querySelector('#outbox-list .obx-stat') || {}).innerText || ''); }, null, { timeout: 30000 }).catch(() => {});
    const e16 = await p16.evaluate(() => (document.querySelector('#outbox-list .obx-stat') || {}).innerText || '');
    ok('after the window, a send a node answered duplicate for reads as most likely in, never as did not go through', /^a node already held it, so it is most likely in/.test(e16) && !/did not go through/.test(e16), e16);
    await c16.close();
  }

  /* 17 · leaving cypherpunk while a Jungle4 send runs: the preview is drawn for Vaulta once that send ends */
  console.log('17 · the preview follows the network once its send ends:');
  {
    const c17 = await cyContext(); const r17 = mockChain(c17);
    const p17 = await c17.newPage();
    await p17.goto(WALLET, { waitUntil: 'load' });
    await p17.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await p17.selectOption('#tx-net', 'j4');
    await p17.fill('#tx-contract', 'banchor22222'); await p17.fill('#tx-action', 'commit');
    await p17.locator('#tx-j4-scaffold').evaluate(el => { el.open = true; });
    await p17.fill('#tx-j4actor', 'banchor22222'); await p17.fill('#tx-j4key', J4_WIF);
    await p17.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    r17.slowMs = 2500;
    await p17.click('#tx-go');
    await p17.waitForFunction(() => /sending the signed copy/.test(document.getElementById('tx-out').textContent), null, { timeout: 15000 }).catch(() => {});
    await p17.evaluate(() => { document.body.setAttribute('data-reg', 'bee'); document.dispatchEvent(new CustomEvent('bregister', { detail: { reg: 'bee' } })); });
    const mid17 = await p17.evaluate(() => document.querySelector('#tx-preview-body .tx-words').textContent);
    await p17.waitForFunction(() => /confirmed it|did not|cannot tell/.test(document.getElementById('tx-out').textContent), null, { timeout: 30000 }).catch(() => {});
    await p17.waitForTimeout(200);
    const end17 = await p17.evaluate(() => ({ net: document.getElementById('tx-net').value, words: document.querySelector('#tx-preview-body .tx-words').textContent }));
    ok('while the Jungle4 send runs its preview keeps what it signs; once it ends the preview is drawn for Vaulta, where the next Sign goes',
      /on the Jungle4 test network/.test(mid17) && end17.net === 'main' && !/Jungle4/.test(end17.words) && /^run commit on banchor22222 with the parts shown\./.test(end17.words), JSON.stringify({ mid17, end17 }));
    await c17.close();
  }

  await ctx.close();
} finally {
  await browser.close();

}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
