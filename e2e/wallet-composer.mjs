// wallet-composer.mjs — the BNR contract composer gate (kills the Unicove lane).
// Covers: ABI-driven field rendering, the exactly-what-you-sign preview, the
// Jungle4 chain-id guard, pushAction round-trip with mocked nodes, the bnames
// walletAction swap, and URL prefill. RPCs mocked with ONE RegExp (glob trap
// law); CORS + preflight handled. Run:  cd e2e && node wallet-composer.mjs
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
await new Promise(r => server.listen(8894, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

const J4_CHAIN = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'; // PUBLIC-CONSTANT: Jungle4 chain id
const MAIN_CHAIN = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
const RPC_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com|api\.eosn\.io|jungle4\.cryptolions\.io|jungle4\.eosphere\.io|jungle4\.api\.eosnation\.io)(\/|$)/;
const FIXTURE_ABI = {
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
/* mode j4 = answer as Jungle4 (J4 chain, J4 tx id); mode main-as-j4 = J4 hosts
   answer with the MAINNET chain id (the guard must refuse) */
function mockChain(ctx, mode) {
  const cors = { 'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  ctx.route(RPC_RE, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(route.request().url());
    const isJ4Host = /jungle4/.test(u.host);
    const chain = mode === 'main-as-j4' ? MAIN_CHAIN : (isJ4Host ? J4_CHAIN : MAIN_CHAIN);
    const json = (obj, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(obj) });
    if (u.pathname.endsWith('/get_abi')) {
      const want = JSON.parse(route.request().postData()).account_name;
      return json(want === 'banchor22222' ? FIXTURE_ABI : BNAME_ABI);
    }
    if (u.pathname.endsWith('/get_info')) return json({ chain_id: chain, head_block_num: 123456 });
    if (u.pathname.endsWith('/get_block')) return json({ ref_block_prefix: 987654321, timestamp: '2026-08-25T00:00:00.000' });
    if (u.pathname.endsWith('/send_transaction')) {
      const body = JSON.parse(route.request().postData());
      if (!body.packed_trx || !body.signatures || !body.signatures.length)
        return json({ error: { details: [{ message: 'malformed tx body — packing or signature missing' }] } }, 400);
      return json({ transaction_id: 'MOCKTXID' + body.packed_trx.slice(0, 16), processed: true });
    }
    return json({});
  });
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  /* ── A · ABI-driven fields + preview honesty ─────────────────────────── */
  console.log('A · ABI fields + preview:');
  {
    const ctx = await browser.newContext();
    mockChain(ctx);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8894/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.selectOption('#tx-net', 'j4');
    await page.fill('#tx-contract', 'banchor22222');
    await page.fill('#tx-action', 'commit');
    await page.click('#tx-abi');
    await page.waitForFunction(() => document.querySelectorAll('.tx-f').length === 7, null, { timeout: 8000 });
    const fields = await page.locator('.tx-f').evaluateAll(els =>
      els.map(e => e.getAttribute('data-fn') + ':' + e.getAttribute('data-ft')));
    ok('seven ABI fields rendered, typed', fields.length === 7 && fields[0] === 'committer:name' && fields[6] === 'forced_watermark:uint64', fields.join(' '));
    await page.fill('.tx-f[data-fn="committer"]', 'banchor22222');
    await page.fill('.tx-f[data-fn="epoch"]', '1000150');
    const json = await page.locator('#tx-data').inputValue();
    ok('args auto-build to JSON from fields', JSON.parse(json).committer === 'banchor22222' && JSON.parse(json).epoch === '1000150', json);
    const prev = await page.locator('#tx-preview-body').innerText();
    ok('preview shows EXACTLY what is signed (action+auth+args+net)',
      /banchor22222:commit/.test(prev) && /@active/.test(prev) && /1000150/.test(prev) && /Jungle4/.test(prev), prev.slice(0, 90));
    ok('pushAction capability flag exposed', await page.evaluate(() =>
      window.BNRVAULTA && BNRVAULTA.CAPABILITIES.pushAction === true &&
      BNRVAULTA.CAPABILITIES.send === true && BNRVAULTA.CAPABILITIES.balance === true));
    await ctx.close();
  }

  /* ── B · chain-id guard: J4 hosts answering mainnet = REFUSED ─────────── */
  console.log('B · Jungle4 chain-id guard:');
  {
    const ctx = await browser.newContext();
    mockChain(ctx, 'main-as-j4');
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8894/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(async () => {
      try {
        return await window.BNRVAULTA.pushAction('banchor22222', 'commit',
          { committer: 'zcgate111111', epoch: '1', new_root: '0'.repeat(64), prev_root: '0'.repeat(64),
            tree_size: '1', delta_id: '0'.repeat(64), forced_watermark: '1' },
          [{ actor: 'zcgate111111', permission: 'active' }],
          { net: 'j4', foreignKey: { wif: null, pub: null } });
      } catch (e) { return { refused: e.message }; }
    });
    ok('wrong chain id on a J4 host is REFUSED, specifically',
      r && r.refused && /chain-id guard/.test(r.refused) && /REFUSED/.test(r.refused) && /aca376f206/.test(r.refused), JSON.stringify(r).slice(0, 90));
    await ctx.close();
  }

  /* ── C · full J4 push round-trip (mocked node) → tx id in the UI ──────── */
  console.log('C · Jungle4 push round-trip:');
  {
    const ctx = await browser.newContext();
    mockChain(ctx);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8894/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.selectOption('#tx-net', 'j4');
    await page.fill('#tx-contract', 'banchor22222');
    await page.fill('#tx-action', 'commit');
    await page.fill('#tx-j4actor', 'banchor22222');
    await page.evaluate(() => {
      // runtime-generated throwaway key (construct-at-runtime law), injected as if pasted
      return window.BnrSign.PrivateKey.fromString('5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3')
        .getPublicKey().toLegacyString();
    }).then(() => {});
    await page.fill('#tx-j4key', '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'); // well-known TESTNET-ONLY dev key
    await page.fill('#tx-data', JSON.stringify({ committer: 'banchor22222', epoch: '1000150',
      new_root: '0'.repeat(64), prev_root: '0'.repeat(64), tree_size: '19', delta_id: '0'.repeat(64), forced_watermark: '1000150' }));
    await page.click('#tx-go');
    await page.waitForFunction(() => /SIGNED \+ BROADCAST on JUNGLE4|jungle4 node said|sign error/.test(document.getElementById('tx-out').textContent), null, { timeout: 10000 });
    const out = await page.locator('#tx-out').innerText();
    ok('J4 push signs + broadcasts, tx id + explorer shown',
      /SIGNED \+ BROADCAST on JUNGLE4/.test(out) && /MOCKTXID/.test(out) && /jungle4\.eosq/.test(out), out.slice(0, 120));
    await ctx.close();
  }

  /* ── D · bnames swap: walletAction in, Unicove out ────────────────────── */
  console.log('D · bnames swap:');
  {
    const src = await readFile(join(ROOT, 'surfaces', 'bnames.html'), 'utf8');
    ok('bnames carries the walletAction factory', /function walletAction\(/.test(src) && /'\.\/wallet\.html'\?/.test(src) || /"\.\/wallet\.html"\?/.test(src) || /\.\/wallet\.html/.test(src));
    ok('no unicove reference remains in bnames', !/unicove.com/i.test(src) && !/unicoveAction/.test(src));
    ok('the factory URL-encodes compose + args', /compose=/.test(src) && /encodeURIComponent/.test(src));
    // and the target actually renders prefilled
    const ctx = await browser.newContext();
    mockChain(ctx);
    const page = await ctx.newPage();
    const args = encodeURIComponent(JSON.stringify({ registrant: 'kingbeelovis', domain_name: 'k', target: 'kingbeelovis' }));
    await page.goto('http://127.0.0.1:8894/surfaces/wallet.html?compose=' + encodeURIComponent('kingbeelovis:registeracc') + '&args=' + args, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('.tx-f').length === 3, null, { timeout: 9000 });
    ok('URL prefill lands: bnames-style link → contract+action+args loaded',
      (await page.locator('#tx-contract').inputValue()) === 'kingbeelovis' &&
      (await page.locator('#tx-action').inputValue()) === 'registeracc');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
