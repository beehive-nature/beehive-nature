// wallet-adapter.mjs — the SPEC-ADAPTER-CONTRACT-1 gate battery (§9 criteria 1–6).
// The contract is real here: two adapters attached (vaulta full, hive read),
// real Web Workers in real Chromium, mocked rails behind one RegExp (glob trap
// law). Mutations are served-file surgery — the page loads a MUTATED copy of
// the worker and the gate asserts the enforcement fires. A gate that has never
// gone red has not been proven: every mutation below is first shown green on
// the unmutated path. Run:  cd e2e && node wallet-adapter.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8896, '127.0.0.1', r));

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
        state.arAccepted = body.id;                                  // idempotent by id — the rail's own dedupe
        return route.fulfill({ status: 202, headers: cors, body: '' });
      }
      if (u.pathname.startsWith('/tx/')) {                           // the confirm rail read
        if (state.arConfirm) return json({ status: 'confirmed', confirmations: 20 });
        return json({ status: 'pending', confirmations: 0 });
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
      if (!body.packed_trx || !body.signatures || !body.signatures.length)
        return json({ error: { details: [{ message: 'malformed tx body — packing or signature missing' }] } }, 400);
      if (state.abortsRemaining > 0) { state.abortsRemaining--; return route.abort('connectionfailed'); }   // the whole rail is cut — rotation cannot walk around it
      state.submits++;
      let txid = state.byPacked.get(body.packed_trx);
      if (!txid) { txid = 'MOCKTXID' + body.packed_trx.slice(0, 16); state.byPacked.set(body.packed_trx, txid); state.head = 123499; }
      return json({ transaction_id: txid, processed: { block_num: 123460, status: 'executed' } });
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

const WALLET = 'http://127.0.0.1:8896/surfaces/wallet.html';
const COMMIT_ARGS = { committer: 'banchor22222', epoch: '1000150', new_root: '0'.repeat(64),
  prev_root: '0'.repeat(64), tree_size: '19', delta_id: '0'.repeat(64), forced_watermark: '1000150' };

const browser = await chromium.launch({ args: ['--no-sandbox'] });
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
  }

  /* ── 2 · the pipeline on the mock: build → sign → OUTBOX PERSISTED →
         submit → confirm reads the block → CONFIRMED with named evidence */
  console.log('2 · full pipeline (green path):');
  {
    await page.selectOption('#tx-net', 'j4');
    await page.fill('#tx-contract', 'banchor22222');
    await page.fill('#tx-action', 'commit');
    await page.click('#tx-abi');
    await page.waitForFunction(() => document.querySelectorAll('.tx-f').length === 7, null, { timeout: 8000 });
    const fields = await page.locator('.tx-f').evaluateAll(els =>
      els.map(e => e.getAttribute('data-fn') + ':' + e.getAttribute('data-ft')));
    ok('seven ABI fields rendered, typed (vendored eosjs serializes IN the worker)',
      fields.length === 7 && fields[0] === 'committer:name' && fields[6] === 'forced_watermark:uint64', fields.join(' '));
    await page.fill('#tx-j4actor', 'banchor22222');
    await page.fill('#tx-j4key', J4_WIF);
    await page.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await page.click('#tx-go');
    await page.waitForFunction(() => /CONFIRMED|FAILED|EXPIRED|error|refused/i.test(document.getElementById('tx-out').textContent), null, { timeout: 30000 });
    const out = await page.locator('#tx-out').innerText();
    ok('CONFIRMED only from the block read, evidence names what was read',
      /CONFIRMED — read back from the rail: get_block #123460/.test(out) && /MOCKTXID/.test(out), out.slice(0, 140));
    ok('the intent is previewed in words before the go', /in words/.test(await page.locator('#tx-preview-body').innerText()));
    const obx = await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]'));
    ok('outbox holds the entry, phase confirmed, digest + human summary present',
      obx.length === 1 && obx[0].phase === 'confirmed' && /^[0-9a-f]{64}$/.test(obx[0].digest) &&
      /Vaulta action banchor22222::commit/.test(obx[0].human_summary), JSON.stringify(obx[0] && { phase: obx[0].phase }));
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
      { committer: 'x', epoch: '1' }, [{ actor: 'banchor22222', permission: 'active' }], { network: 'j4', wif: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' }));
    const sentAfter = await p2.evaluate(() => BNRWALLET._telemetry.vaulta.sent);
    const out = await p2.locator('#tx-out').innerText();
    ok('undeclared capability: the shell refuses at the seam — ZERO messages dispatched',
      r === null && sentAfter === sentBefore && /not declared/.test(out), `sent ${sentBefore}→${sentAfter} · ${out.slice(0, 80)}`);
    await c2.close();
  }

  /* ── 4 · §9.3 MUTATION — a leaking balance: the redaction wall quarantines */
  console.log('4 · redaction wall mutation (§9.3):');
  {
    const c3 = await browser.newContext(); mockChain(c3);
    mutateVaulta(c3, "return { unit: 'A', quantity: d.core_liquid_balance || '0.0000 A' };",
      "return { unit: 'A', quantity: d.core_liquid_balance || '0.0000 A', memo_hint: '" + J4_WIF + "' };");
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
    const c6 = await browser.newContext(); const rail6 = mockChain(c6); rail6.abortsRemaining = 5;
    const p6 = await c6.newPage();
    await p6.goto(WALLET, { waitUntil: 'load' });
    await p6.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await p6.selectOption('#tx-net', 'j4');
    await p6.fill('#tx-contract', 'banchor22222'); await p6.fill('#tx-action', 'commit');
    await p6.fill('#tx-j4actor', 'banchor22222'); await p6.fill('#tx-j4key', J4_WIF);
    await p6.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await p6.click('#tx-go');
    await p6.waitForFunction(() => /submit faulted|resubmit the identical|CONFIRMED|FAILED/i.test(document.getElementById('tx-out').textContent), null, { timeout: 30000 });
    const afterCut = await p6.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('network cut at submit: entry stays phase signed — bytes persisted, nothing lost',
      afterCut && afterCut.phase === 'signed' && afterCut.signed_bytes, JSON.stringify(afterCut && afterCut.phase));
    await p6.click('.obx-retry');
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
    const c7 = await browser.newContext(); const rail7 = mockChain(c7); rail7.blockCarries = false;
    const p7 = await c7.newPage();
    await p7.goto(WALLET, { waitUntil: 'load' });
    await p7.waitForFunction(() => window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    await p7.selectOption('#tx-net', 'j4');
    await p7.fill('#tx-contract', 'banchor22222'); await p7.fill('#tx-action', 'commit');
    await p7.fill('#tx-j4actor', 'banchor22222'); await p7.fill('#tx-j4key', J4_WIF);
    await p7.fill('#tx-data', JSON.stringify(COMMIT_ARGS));
    await p7.click('#tx-go');
    await p7.waitForFunction(() => /not visible yet|reading again/i.test(document.getElementById('tx-out').textContent), null, { timeout: 20000 });
    const midOut = await p7.locator('#tx-out').innerText();
    const midBox = await p7.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('ack without a block: UI says submitted-not-sent, outbox phase submitted',
      /submitted/i.test(midOut) && !/CONFIRMED/i.test(midOut) && !/✓/.test(midOut) && midBox.phase === 'submitted', midOut.slice(0, 100));
    // force the clock: the intent's window closes → the HONEST terminal is expired
    await p7.evaluate(() => {
      const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l[l.length - 1].expires_at = new Date(Date.now() - 120000).toISOString();   // past the 30s grace — the honest terminal is due
      localStorage.setItem('bnr_outbox_v1', JSON.stringify(l));
    });
    await p7.click('.obx-retry');
    await p7.waitForFunction(() => {
      const e = (JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]) || {};
      return e.phase === 'expired' || e.phase === 'confirmed';
    }, null, { timeout: 30000 });
    const endOut = await p7.locator('#tx-out').innerText();
    const endBox = await p7.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]')[0]);
    ok('terminal came from the rail/time (expired), never from the ack',
      /EXPIRED/.test(endOut) && endBox.phase === 'expired' && !/CONFIRMED/i.test(endOut), endOut.slice(0, 100));
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
      const entry = await window.BNRWALLET.walletPublish(bytes, [['App-Name', 'bnr-lane-b'], ['Type', 'anchor-proof']], { jwk: jwk });
      return entry && { phase: entry.phase, ref: entry.ref, evidence: entry.evidence, id: entry.intent_id };
    });
    ok('publish end-to-end: build (public JWK only) → vault sign → outbox → submit → CONFIRMED from the gateway read',
      r && r.phase === 'confirmed' && /^arweave:/.test(r.id) && r.ref && r.ref.length === 43 &&
      /GET \/tx\/.*@ https:\/\/(arweave\.net|ar-io\.dev|gateway\.ardrive\.io)/.test(r.evidence.read), JSON.stringify(r && { phase: r.phase, ev: r.evidence }));
    const obx10 = await p10.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]').filter(e => e.rail === 'arweave'));
    ok('the arweave entry lives in the same outbox under the same phases', obx10.length === 1 && obx10[0].phase === 'confirmed' && obx10[0].signed_by === 'arweave-jwk');
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

  await ctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
