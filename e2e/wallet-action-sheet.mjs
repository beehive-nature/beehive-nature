// wallet-action-sheet.mjs — one press composes and signs a .b action in our own wallet.
// The name desk composes and hands off; the wallet's #sign-action sheet says in
// words what it signs and as which account, then build → K1 vault → outbox →
// submit → read back. A .b name is a pointer: its owner signs, its account
// receives (king.b → kingbeelovis), and the Vaulta account "king" is a
// stranger's, so nothing is ever signed or received as "king". The one-press
// path runs a real passkey ceremony on a virtual authenticator (PRF).
// Source files are served in-memory at the production origin; every chain read
// is a mock behind one RegExp; nothing reaches a live network. Run: node e2e/wallet-action-sheet.mjs
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://skaists.dev';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const MAIN_CHAIN = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
const RPC_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com)(\/|$)/;
const EVIL = '<img src=x onerror=window.__xss=1>';
const STRANGER_KEY = 'EOS7g7tqRsKpAh2ZDtyqzmjWVkrcdGHGx16D1xeWBZcxQbaqfvBGq'; // PUBLIC-CONSTANT: test fixture public key
const DEV_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // TESTNET-ONLY: eosio's documented dev key, chain-significant nowhere
const DEV_PUB = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'; // PUBLIC-CONSTANT: the dev key's public half
const EOSIO_ABI = { account_name: 'eosio', abi: { version: 'eosio::abi/1.2', actions: [{ name: 'updateauth', type: 'updateauth' }], types: [],
  structs: [
    { name: 'permission_level', fields: [{ name: 'actor', type: 'name' }, { name: 'permission', type: 'name' }] },
    { name: 'key_weight', fields: [{ name: 'key', type: 'public_key' }, { name: 'weight', type: 'uint16' }] },
    { name: 'permission_level_weight', fields: [{ name: 'permission', type: 'permission_level' }, { name: 'weight', type: 'uint16' }] },
    { name: 'wait_weight', fields: [{ name: 'wait_sec', type: 'uint32' }, { name: 'weight', type: 'uint16' }] },
    { name: 'authority', fields: [{ name: 'threshold', type: 'uint32' }, { name: 'keys', type: 'key_weight[]' }, { name: 'accounts', type: 'permission_level_weight[]' }, { name: 'waits', type: 'wait_weight[]' }] },
    { name: 'updateauth', fields: [{ name: 'account', type: 'name' }, { name: 'permission', type: 'name' }, { name: 'parent', type: 'name' }, { name: 'auth', type: 'authority' }] },
    { name: 'newaccount', fields: [{ name: 'creator', type: 'name' }, { name: 'name', type: 'name' }, { name: 'owner', type: 'authority' }, { name: 'active', type: 'authority' }] }] } };
EOSIO_ABI.abi.actions.push({ name: 'newaccount', type: 'newaccount' });
// mainnet's eosio has no transfer action; A is core.vaulta's token (shapes as get_abi core.vaulta returns them)
// eosio.token's transfer, for EOS held on an account (shape as get_abi eosio.token returns it)
const EOSIO_TOKEN_ABI = { account_name: 'eosio.token', abi: { version: 'eosio::abi/1.2', types: [], actions: [{ name: 'transfer', type: 'transfer' }],
  structs: [{ name: 'transfer', fields: [{ name: 'from', type: 'name' }, { name: 'to', type: 'name' }, { name: 'quantity', type: 'asset' }, { name: 'memo', type: 'string' }] }] } };
const CORE_VAULTA_ABI = { account_name: 'core.vaulta', abi: { version: 'eosio::abi/1.2', types: [],
  actions: [{ name: 'transfer', type: 'transfer' }, { name: 'buyrambytes', type: 'buyrambytes' }, { name: 'sellram', type: 'sellram' }],
  structs: [
    { name: 'transfer', fields: [{ name: 'from', type: 'name' }, { name: 'to', type: 'name' }, { name: 'quantity', type: 'asset' }, { name: 'memo', type: 'string' }] },
    { name: 'buyrambytes', fields: [{ name: 'payer', type: 'name' }, { name: 'receiver', type: 'name' }, { name: 'bytes', type: 'uint32' }] },
    { name: 'sellram', fields: [{ name: 'account', type: 'name' }, { name: 'bytes', type: 'int64' }] }] } };
// an Antelope name as its 8 little-endian bytes, to find an action's (account, name) in packed bytes
const nameHex = n => { let v = 0n; for (let i = 0; i <= 12; i++) { const ch = n[i] || '.', c = ch === '.' ? 0 : ch >= 'a' ? ch.charCodeAt(0) - 91 : ch.charCodeAt(0) - 48;
  v |= i < 12 ? BigInt(c & 0x1f) << BigInt(64 - 5 * (i + 1)) : BigInt(c & 0x0f); } return Buffer.from(new BigUint64Array([v]).buffer).toString('hex'); };
const actHex = (acct, act) => nameHex(acct) + nameHex(act);

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`); }
};
const fnv = s => { let h = 0xcbf29ce484222325n; for (const b of Buffer.from(s, 'utf8')) { h ^= BigInt(b); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(); };
const row = (n, owner, account = owner, expires = '2027-08-01T01:37:15') => ({ id: fnv(n), domain_name: n, owner, account, registered: '2026-08-01T01:37:15', expires });
// king.b is the founder's; alicevaulta1.b is a hostile row someone registered over a bare account; gone.b has lapsed
const ROWS = [row('king', 'kingbeelovis'), row('oliver', 'kingbeelovis'), row(EVIL, 'someoneelse1'),
  row('alicevaulta1', 'attacker1111'), row('gonesoul', 'attacker1111', 'attacker1111', '2025-01-01T00:00:00')];
const ABI = { account_name: 'kingbeelovis', abi: { version: 'eosio::abi/1.2',
  actions: [{ name: 'renew', type: 'renew' }, { name: 'registeracc', type: 'registeracc' }],
  structs: [{ name: 'renew', fields: [{ name: 'owner', type: 'name' }, { name: 'domain_name', type: 'string' }, { name: 'days', type: 'uint16' }] },
    { name: 'registeracc', fields: [{ name: 'registrant', type: 'name' }, { name: 'domain_name', type: 'string' }, { name: 'target', type: 'name' }] }],
  types: [] } };

async function context(browser, reg, { soul = 'king', width = 390, realPasskey = false } = {}) {
  const state = { keys: {}, submits: 0, byPacked: new Map(), head: 123456 };
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([r, s, real]) => {
    try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('bregister', r); if (s) localStorage.setItem('bnr_soul', s); sessionStorage.setItem('__seeded', '1'); } } catch (e) {}
    window.__cred = 0;
    if (real) return;
    const deny = async () => { window.__cred++; throw new DOMException('NotAllowedError: the test refuses every passkey', 'NotAllowedError'); };
    if (navigator.credentials) { navigator.credentials.get = deny; navigator.credentials.create = deny; }
    if (window.PublicKeyCredential) window.PublicKeyCredential.getClientCapabilities = async () => ({ 'extension:prf': true });
  }, [reg, soul, realPasskey]);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  await ctx.route('**/*', async route => {
    const url = route.request().url(), u = new URL(url);
    if (RPC_RE.test(url)) {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const json = (o, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
      const body = JSON.parse(route.request().postData() || '{}');
      if (u.pathname.endsWith('/get_table_rows')) {
        if (body.code === 'kingbeelovis' && body.table === 'domains' && state.regDown) return json({ error: { what: 'registry down (fixture)' } }, 500);
        if (body.code === 'kingbeelovis' && body.table === 'domains' && state.slowRows) await new Promise(r => setTimeout(r, state.slowRows));
        if (body.code === 'kingbeelovis' && body.table === 'domains') {
          const rows = body.lower_bound ? ROWS.filter(r => r.id === String(body.lower_bound)) : ROWS;
          return json({ rows: rows.slice(0, body.limit || 500), more: false, next_key: '' });
        }
        if (body.table === 'config') return json({ rows: [{ admin: 'kingbeelovis', registration_fee: '0.0000 EOS', registration_days: 365 }], more: false });
        return json(state.ramDown ? { rows: [], more: false } : { rows: [{ base: { balance: '100000000000 RAM' }, quote: { balance: '1000000.0000 A' } }], more: false });
      }
      if (u.pathname.endsWith('/get_account')) {
        (state.reads = state.reads || []).push(body.account_name);
        if (state.slowAcct) await new Promise(r => setTimeout(r, state.slowAcct));
        if (state.acctDown) return route.abort();   // no node answers the account read
        // a name the forge has not made yet does not exist: nodes answer 500 "unknown key"
        if (/^newacctname/.test(body.account_name) && !state.keys[body.account_name]) return json({ code: 500, message: 'Internal Service Error', error: { code: 0, name: 'exception', what: 'unspecified', details: [{ message: 'unknown key (boost::tuples::tuple<bool, eosio::chain::name>): (0 ' + body.account_name + ')' }] } }, 500);
        const a = body.account_name, keys = (state.keys[a] || [STRANGER_KEY]).map(key => ({ key, weight: 1 }));
        return json({ account_name: a, core_liquid_balance: (state.eos && state.eos[a]) || '0.0000 EOS', ram_quota: 8192, ram_usage: 3000, cpu_limit: { used: 0, available: 1000, max: 1000 }, net_limit: { used: 0, available: 1000, max: 1000 },
          permissions: [{ perm_name: 'active', parent: 'owner', required_auth: { threshold: 1, keys, accounts: [], waits: [] } }] });
      }
      if (u.pathname.endsWith('/get_currency_balance') && state.aDown) return json({ error: { what: 'down (fixture)' } }, 500);
      if (u.pathname.endsWith('/get_currency_balance')) return json(body.code === 'core.vaulta' && body.symbol === 'A' ? ['5.0000 A'] : []);
      if (u.pathname.endsWith('/get_abi') && state.abiDelay && body.account_name === 'core.vaulta') await new Promise(r => setTimeout(r, state.abiDelay));
      if (u.pathname.endsWith('/get_abi')) return json(body.account_name === 'eosio' ? EOSIO_ABI : body.account_name === 'core.vaulta' ? CORE_VAULTA_ABI : body.account_name === 'eosio.token' ? EOSIO_TOKEN_ABI : ABI);
      if (u.pathname.endsWith('/get_info')) return json({ chain_id: MAIN_CHAIN, head_block_num: state.head });
      if (u.pathname.endsWith('/get_block')) {
        const num = body.block_num_or_id;
        if (num === 123453) return json({ ref_block_prefix: 987654321, timestamp: '2026-10-05T00:00:00.000' });
        return json({ id: 'MOCKBLOCK' + num, block_num: num, ref_block_prefix: 987654321, timestamp: '2026-10-05T00:00:00.000', transactions: [...state.byPacked.values()].map(id => ({ id, status: 'executed' })) });
      }
      if (u.pathname.endsWith('/send_transaction')) {
        if (!body.packed_trx || !body.signatures || !body.signatures.length) return json({ error: { details: [{ message: 'malformed' }] } }, 400);
        (state.posts = state.posts || []).push(body.packed_trx);
        if (state.slowSend) await new Promise(r => setTimeout(r, state.slowSend));
        if (state.refuse) { state.refused = (state.refused || 0) + 1; return json({ code: 500, message: 'Internal Service Error', error: { code: 3090003, name: state.refuseName || 'unsatisfied_authorization', what: 'Provided keys, permissions, and delays do not satisfy declared authorizations', details: [{ message: state.refuse }] } }, 500); }   // the chain evaluated it and said no
        if (state.abortN > 0) { state.abortN--; return route.abort(); }   // the answer is lost on the way back
        if (state.dupOnce) { state.dupOnce = false; return json({ code: 409, error: { name: 'tx_duplicate', what: 'Duplicate transaction', details: [{ message: 'duplicate transaction ' + body.packed_trx.slice(0, 16) }] } }, 409); }
        state.submits++; state.packed = body.packed_trx;
        if (state.onSend) state.onSend(body);
        if (state.beforeAck) await state.beforeAck();   // what happens in the page between the send and its answer
        let id = state.byPacked.get(body.packed_trx);
        if (!id) { id = 'MOCKTXID' + body.packed_trx.slice(0, 16); state.byPacked.set(body.packed_trx, id); state.head = 123499; }
        return json({ transaction_id: id, processed: state.noHint ? { status: 'executed' } : { block_num: 123460, status: 'executed' } });
      }
      return json({});
    }
    if (/\/voucher\/v1\/voucher\//.test(url) && state.voucher) {   // the estate's voucher oracle, mocked per test
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const v = state.voucher(url);
      return v === 'abort' ? route.abort() : route.fulfill({ status: v.status || 200, headers: cors, contentType: 'application/json', body: JSON.stringify(v.body) });
    }
    if (u.origin !== ORIGIN) return route.abort();
    const path = resolve(ROOT, '.' + decodeURIComponent(u.pathname));
    if (!path.startsWith(ROOT + sep)) return route.abort();
    try { return route.fulfill({ body: await readFile(path), contentType: MIME[extname(path)] || 'application/octet-stream' }); }
    catch { return route.fulfill({ status: 404, body: 'not found' }); }
  });
  return { ctx, state };
}
const RENEW = { owner: 'kingbeelovis', domain_name: 'king', days: 365 };
const sheetUrl = (data, intent) => `${ORIGIN}/surfaces/wallet.html?compose=${encodeURIComponent('kingbeelovis:renew')}&args=${encodeURIComponent(JSON.stringify(data))}${intent ? '&intent=' + intent : ''}#sign-action`;
const intentFor = (page, id, data) => page.evaluate(([i, d]) => localStorage.setItem('bnr_sign_intent', JSON.stringify({ id: i, contract: 'kingbeelovis', action: 'renew', data: d, at: Date.now() })), [id, data]);
const sheet = page => page.evaluate(() => {
  const d = document.getElementById('act-sheet'); if (!d) return null;
  return { h: document.getElementById('act-h').textContent, say: document.getElementById('act-say').textContent, stat: document.getElementById('act-stat').textContent,
    state: document.getElementById('act-stat').getAttribute('data-state'), buttons: [...d.querySelectorAll('button')].filter(b => b.offsetParent !== null).length, goHidden: document.getElementById('act-go').hidden,
    text: d.innerText, wide: d.scrollWidth > innerWidth + 1, cred: window.__cred, url: location.href };
});
const settled = page => page.waitForFunction(() => { const e = document.getElementById('act-stat'); return e && /^(done|fail|wait)$/.test(e.getAttribute('data-state') || ''); }, null, { timeout: 40000 });
const recoveryConnect = async page => {
  await page.evaluate(() => {
    const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
    document.getElementById('kc-rec').value = window.BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(0x2a));
    document.getElementById('kc-recgo').click();
  });
  await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
};
const k1Of = (page, ctxName) => page.evaluate(c => {
  const B = window.BnrSign, seed = window.BZDIDKEY.deriveK1Key(new Uint8Array(32).fill(0x2a), c).seed;
  const p = new Uint8Array(33); p[0] = 0x80; p.set(seed, 1); const chk = B.sha256(B.sha256(p)).slice(0, 4);
  return B.PrivateKey.fromString(B.Numeric.binaryToBase58(new Uint8Array([...p, ...chk]))).getPublicKey().toLegacyString();
}, ctxName);

const browser = await chromium.launch();
try {
  /* A · the name desk: the owner fills in; one press hands off */
  for (const reg of ['bee', 'cypherpunk']) {
    console.log(`A · name desk, ${reg}:`);
    const { ctx } = await context(browser, reg);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/bnames.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bnamesDesk && window.__bnamesDesk.live.reach === 'ok', null, { timeout: 20000 });
    ok('the desk keeps where king.b points for the wallet (owner signs, account receives)', await page.evaluate(() => localStorage.getItem('bnr_vacct')) === JSON.stringify({ soul: 'king', acct: 'kingbeelovis', recv: 'kingbeelovis', state: 'name', proven: false }));
    await page.evaluate(() => document.querySelector('#workshop .act[data-action="renew"]').click());
    ok('renew prefills the owner with the account the name points at, never the bare name', await page.inputValue('#cz-owner') === 'kingbeelovis', await page.inputValue('#cz-owner'));
    await page.fill('#cz-domain_name', 'king.b');
    ok('the one button says what it does', /^✍ renew king\.b$/.test((await page.textContent('#cz-compose')).trim()), await page.textContent('#cz-compose'));
    const recipe = await page.evaluate(() => { const e = document.getElementById('cz-out'); return { shown: e.getClientRects().length > 0, t: e.textContent }; });
    if (reg === 'cypherpunk') ok('cypherpunk keeps the recipe for signing by hand, for the real action', recipe.shown && /push action kingbeelovis renew '\{"owner":"kingbeelovis","domain_name":"king","days":"365"\}' -p kingbeelovis@active/.test(recipe.t), recipe.t);
    else ok('new bee shows no paste recipe', !recipe.shown && !/Anchor|cleos/.test(await page.evaluate(() => document.getElementById('composer-zone').innerText)));
    await page.fill('#cz-days', '0'); await page.click('#cz-compose');
    ok('a bad field is said calmly and nothing is handed off', /days: a whole number from 1 to 65535/.test(await page.textContent('#cz-stat')) && /bnames\.html$/.test(page.url()));
    await page.fill('#cz-days', '365');
    await page.fill('#cz-owner', 'someoneelse1'); await page.click('#cz-compose');
    ok('an owner that is not your account is said on the desk, before any wallet or passkey', /king\.b belongs to someoneelse1, and your wallet signs for kingbeelovis\. only that account can do this\./.test(await page.textContent('#cz-stat')) && /bnames\.html$/.test(page.url()), await page.textContent('#cz-stat'));
    await page.fill('#cz-owner', 'kingbeelovis');
    const [req] = await Promise.all([page.waitForRequest(r => /\/surfaces\/wallet\.html\?compose=/.test(r.url()), { timeout: 15000 }), page.click('#cz-compose')]);
    const u = new URL(req.url());
    ok('one press composes the renew action and opens the wallet sheet', u.searchParams.get('compose') === 'kingbeelovis:renew' && u.searchParams.get('args') === JSON.stringify(RENEW) && /^[\w-]{8,}$/.test(u.searchParams.get('intent') || ''), req.url());
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await settled(page);
    const s = await sheet(page);
    ok('the handoff starts by itself: it asks for the passkey once, then waits for the press', s.cred >= 1 && /^Press Sign, then confirm with your passkey\.$/.test(s.stat), JSON.stringify(s));
    ok('the intent is one-time and the address bar no longer carries the action', await page.evaluate(() => localStorage.getItem('bnr_sign_intent')) === null && /\/surfaces\/wallet\.html$/.test(s.url), s.url);
    ok('no page errors on the desk or the sheet', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* B · the desk never turns chain text or typed text into markup; registration stays founder-only */
  {
    console.log('B · escaping and the gate:');
    const { ctx } = await context(browser, 'bee', { soul: null, width: 1280 });
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/surfaces/bnames.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bnamesDesk && window.__bnamesDesk.live.reach === 'ok', null, { timeout: 20000 });
    await page.evaluate(() => { document.querySelectorAll('#const g').forEach(g => g.dispatchEvent(new PointerEvent('pointerenter', { clientX: 10, clientY: 10 }))); });
    await page.evaluate(n => { document.getElementById('q').value = n; document.getElementById('go').click(); }, EVIL);
    await page.waitForTimeout(400);
    ok('a hostile name from the chain or the keyboard stays text', await page.evaluate(() => window.__xss) === undefined && /<img src=x/.test(await page.textContent('#vwrap')), await page.textContent('#vwrap'));
    await page.evaluate(() => document.querySelector('#workshop .act[data-action="registeracc"]').click());
    await page.fill('#cz-registrant', 'someoneelse1'); await page.fill('#cz-domain_name', 'newname'); await page.fill('#cz-target', 'someoneelse1');
    await page.click('#cz-compose');
    ok('registering a new name from the workshop stays founder-only', /founder-only for now/.test(await page.textContent('#cz-stat')) && /bnames\.html$/.test(page.url()), await page.textContent('#cz-stat'));
    await ctx.close();
  }

  /* C · the wallet: words before anything, the account checked before any passkey */
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    console.log(`C · wallet sheet, ${reg}:`);
    const { ctx, state } = await context(browser, reg);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(sheetUrl(RENEW, 'forged-0001'), { waitUntil: 'load' });
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await page.waitForTimeout(600);
    let s = await sheet(page);
    ok('a link with no live intent shows the words and waits: no passkey, no send', s && s.h === 'Renew king.b' && s.say === 'Renew king.b for 365 days. You sign as kingbeelovis.' && s.cred === 0 && state.submits === 0 && s.buttons === 1, JSON.stringify(s));
    ok('the sheet carries no dash and fits a phone', !/[–—]/.test(s.text) && !s.wide, s.text.slice(0, 120));
    await page.evaluate(() => { location.hash = '#sign-action'; });
    await page.waitForTimeout(300);
    ok('a later hash change never opens a second sheet', await page.evaluate(() => document.querySelectorAll('#act-sheet').length) === 1);
    await page.evaluate(() => { document.getElementById('act-sheet').remove(); document.documentElement.style.overflow = ''; });
    await page.waitForFunction(() => /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 15000 });
    ok('at a glance names the soul and the account it points at', (await page.textContent('#sum-soul')).trim() === 'king.b · Vaulta kingbeelovis', await page.textContent('#sum-soul'));
    ok('Vaulta authority before the keychain is one sentence and a link', await page.evaluate(() => { const e = document.getElementById('sum-bridge'); return /^connect your keychain to check kingbeelovis$/.test(e.textContent.trim()) && !!e.querySelector('a[href="#kc-sec"]'); }), await page.textContent('#sum-bridge'));
    const rx0 = await page.evaluate(() => window.BNRPAY.railAddresses(null, 'king')[0]);
    ok('no Vaulta receive address until this wallet signs for the name, and never the stranger "king"', rx0.v === null && /king\.b points at kingbeelovis/.test(rx0.err || ''), JSON.stringify(rx0));
    await recoveryConnect(page);
    await page.waitForFunction(() => /let this wallet sign for it/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 15000 });
    ok('a missing key reads as one sentence with the one next step', await page.evaluate(() => { const e = document.getElementById('sum-bridge'); return e.textContent.trim() === 'kingbeelovis · let this wallet sign for it' && !!e.querySelector('a[href="#bridge-sec"]') && !/needs bridge/.test(document.body.innerText); }), await page.textContent('#sum-bridge'));
    const k1 = (await page.textContent('#kc-k1-pub')).trim(), acctKey = await k1Of(page, 'vaulta:kingbeelovis'), nameKey = await k1Of(page, 'vaulta:king');
    ok('the derived Vaulta key belongs to the owner account (vaulta:kingbeelovis), not the name', k1 === acctKey && acctKey !== nameKey, JSON.stringify({ k1, acctKey, nameKey }));
    // a wrong owner is refused in words, before any passkey, with nothing sent
    await intentFor(page, 'live-0001', { owner: 'king', domain_name: 'king', days: 365 });
    await page.goto(sheetUrl({ owner: 'king', domain_name: 'king', days: 365 }, 'live-0001'), { waitUntil: 'load' });
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await settled(page);
    s = await sheet(page);
    ok('signing as the stranger "king" is refused before any passkey prompt, with its one link and no Sign to press again', s.stat === 'This is for king, and your wallet signs for kingbeelovis. Nothing was signed. use the name that owns king' && s.goHidden && s.cred === 0 && state.submits === 0 && await page.evaluate(() => !!document.querySelector('#act-stat a[href="#connect-sec"]')), JSON.stringify(s));
    ok('no page errors in the wallet', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* C2 · no name connected: the sheet sends the reader to connect it, then comes back by itself and waits for the press */
  {
    console.log('C2 · connect the name, and the sheet comes back:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(sheetUrl(RENEW), { waitUntil: 'load' });
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await page.click('#act-go');
    await settled(page);
    let s = await sheet(page);
    ok('with no name connected, the sheet says so with its one link, before any passkey', s.stat === 'Connect your name first, and this comes back so you can sign it. connect it' && s.cred === 0 && state.submits === 0, JSON.stringify(s));
    await page.click('#act-stat a[href="#connect-sec"]');
    await page.waitForFunction(() => !document.getElementById('act-sheet'), null, { timeout: 5000 });
    await page.fill('#wq', 'king'); await page.click('#wgo');
    await page.waitForSelector('#act-sheet', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    s = await sheet(page);
    ok('once the name is connected the same action comes back in words and waits for the press: no passkey, nothing sent', !!s && s.h === 'Renew king.b' && s.say === 'Renew king.b for 365 days. You sign as kingbeelovis.' && !s.goHidden && s.cred === 0 && state.submits === 0 && !s.stat, JSON.stringify(s));
    ok('a sheet that came back is not pressed for the reader: Sign is not focused', await page.evaluate(() => !!document.getElementById('act-sheet') && (document.activeElement || {}).id !== 'act-go'), await page.evaluate(() => (document.activeElement || {}).id));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* C3 · an action left waiting for a name stays in its page: never on the next load, never over another link */
  {
    console.log('C3 · a waiting action never comes back by itself:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(sheetUrl(RENEW), { waitUntil: 'load' });
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await page.click('#act-go');
    await settled(page);
    ok('no name connected: nothing about the action is written into the tab\'s storage', await page.evaluate(() => sessionStorage.getItem('bnr_act_pending')) === null);
    /* the reader walks away; another page of this site remembers the name */
    await page.evaluate(() => localStorage.setItem('bnr_soul', 'king'));
    await page.goto(ORIGIN + '/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    await page.waitForTimeout(900);
    ok('the next wallet load opens no sheet: the action the reader walked away from is gone', await page.evaluate(() => !document.getElementById('act-sheet')) && state.submits === 0);
    /* a waiting action an older page kept in this tab is dropped on load, never opened */
    await page.evaluate(d => sessionStorage.setItem('bnr_act_pending', JSON.stringify({ contract: 'kingbeelovis', action: 'renew', data: d, at: Date.now() })), RENEW);
    await page.goto(sheetUrl({ owner: 'kingbeelovis', domain_name: 'king', days: 30 }), { waitUntil: 'load' });
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await page.waitForTimeout(900);
    const s = await sheet(page);
    ok('a fresh link opens its own action only, never an older one over it', s && s.say === 'Renew king.b for 30 days. You sign as kingbeelovis.' && await page.evaluate(() => document.querySelectorAll('#act-sheet').length === 1 && sessionStorage.getItem('bnr_act_pending') === null), JSON.stringify(s));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* the reader opens a link with no name, presses connect it, connects the keychain and the name on the
     same page: the action comes back and waits for its press, with this wallet's keychain in tab memory */
  const backAfterConnect = async (page, state, keys) => {
    await page.goto(sheetUrl(RENEW), { waitUntil: 'load' });
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await page.click('#act-go');
    await settled(page);
    await page.click('#act-stat a[href="#connect-sec"]');
    await page.waitForFunction(() => !document.getElementById('act-sheet'), null, { timeout: 5000 });
    state.keys.kingbeelovis = keys || [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.fill('#wq', 'king'); await page.click('#wgo');
    await page.waitForSelector('#act-sheet', { timeout: 20000 });
    await page.waitForTimeout(400);
  };
  const stateAfter = page => page.waitForFunction(() => /^(done|fail|wait)$/.test(document.getElementById('act-stat').getAttribute('data-state') || ''), null, { timeout: 45000 });

  /* C4 · a lost answer on the sheet is said as unknown, never as "did not go out" */
  {
    console.log('C4 · a lost answer on the sheet:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await backAfterConnect(page, state);
    state.abortN = 2;
    await page.click('#act-go');
    await stateAfter(page);
    const s = await sheet(page);
    ok('a lost answer: this wallet cannot tell yet whether it went out, with its one link, and no second Sign',
      /^The network did not answer, so this wallet cannot tell yet whether it went out\./.test(s.stat) && !/did not go out/.test(s.stat) && s.goHidden && await page.evaluate(() => !!document.querySelector('#act-stat a[href="#outbox-sec"]')), JSON.stringify(s));
    await page.click('#act-stat a[href="#outbox-sec"]');
    await page.waitForTimeout(500);
    const row = await page.evaluate(() => ({ view: document.body.getAttribute('data-wl-view'), stat: (document.querySelector('#outbox-list .obx-stat') || {}).innerText, btn: (document.querySelector('#outbox-list .obx-retry') || {}).textContent }));
    ok('its link lands on waiting to be sent, where the row says it may be out and its button says what it does', row.view === 'move' && /^it may already be out\. sending it again is safe\./.test(row.stat || '') && row.btn === 'send it again', JSON.stringify(row));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* C5 · the sheet's links land through the wallet's router: a key refusal reads the account first, so the bridge shows */
  {
    console.log('C5 · a key refusal lands on the bridge:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await backAfterConnect(page, state);
    state.refuse = 'missing authority of kingbeelovis';
    await page.click('#act-go');
    await stateAfter(page);
    const s = await sheet(page);
    ok('the chain refused the key: one sentence and its one link', /^The account did not accept this wallet\u2019s key\. Nothing changed\./.test(s.stat) && await page.evaluate(() => !!document.querySelector('#act-stat a[href="#bridge-sec"]')), JSON.stringify(s));
    state.keys.kingbeelovis = [STRANGER_KEY];   // the account no longer carries this wallet's key
    await page.click('#act-stat a[href="#bridge-sec"]');
    await page.waitForFunction(() => document.getElementById('bridge-sec').style.display === 'block', null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const land = await page.evaluate(() => { const b = document.getElementById('bridge-sec'); return { view: document.body.getAttribute('data-wl-view'), shown: b.style.display !== 'none' && b.getClientRects().length > 0, paste: !!document.getElementById('br-paste'), sheet: !!document.getElementById('act-sheet') }; });
    ok('let this wallet sign for it lands on the bridge, shown, with its paste field (never on a hidden section)', land.view === 'key' && land.shown && land.paste && !land.sheet, JSON.stringify(land));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* C6 · a paste the network lost: check again reads the account, and says when the paste is safe to make again */
  {
    console.log('C6 · a lost paste, read until it is safe to paste again:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await backAfterConnect(page, state, [DEV_PUB]);
    await page.click('#act-go');
    await page.waitForFunction(() => !document.getElementById('act-paste').hidden, null, { timeout: 40000 });
    const k1 = await k1Of(page, 'vaulta:kingbeelovis');
    state.abortN = 2;
    await page.fill('#act-key', DEV_WIF); await page.click('#act-paste-go');
    await stateAfter(page);
    const lockedNow = () => page.evaluate(() => document.getElementById('act-key').disabled && document.getElementById('act-paste-go').disabled);
    let s = await sheet(page);
    ok('a paste the network lost: its one button reads the account, and the paste field waits', /cannot tell yet/.test(s.stat) && await page.textContent('#act-stat button.wl-act') === 'check again' && await lockedNow(), JSON.stringify(s));
    await page.click('#act-stat button.wl-act'); await stateAfter(page);
    s = await sheet(page);
    ok('inside its window: it may still go in, check again, the field still waits', /^kingbeelovis does not show this wallet yet, and the paste may still go in\./.test(s.stat) && await lockedNow(), JSON.stringify(s));
    await page.evaluate(() => { const real = Date.now.bind(Date); Date.now = () => real() + 200000; });   // its window and grace are over
    await page.click('#act-stat button.wl-act'); await stateAfter(page);
    s = await sheet(page);
    ok('once its window is over and the account lacks the key: it did not go in, and the paste can be made again', /^It did not go in, so nothing changed\. Paste kingbeelovis\u2019s active key again to try once more\./.test(s.stat) && await page.evaluate(() => !document.getElementById('act-key').disabled && !document.getElementById('act-paste-go').disabled), JSON.stringify(s));
    state.onSend = () => { state.keys.kingbeelovis = [DEV_PUB, k1]; };
    await page.fill('#act-key', DEV_WIF); await page.click('#act-paste-go');
    await page.waitForFunction(() => /^(done|fail)$/.test(document.getElementById('act-stat').getAttribute('data-state') || ''), null, { timeout: 40000 });
    s = await sheet(page);
    ok('the paste made again lands once: added and renewed', s.state === 'done' && /^Done\. king\.b is renewed for 365 days\./.test(s.stat) && state.submits === 1, JSON.stringify(s) + ' submits ' + state.submits);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* C7 · the account shows this wallet's key from another way: the sheet says only what that proves */
  {
    console.log('C7 · a key that arrived another way proves only the key:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await backAfterConnect(page, state, [DEV_PUB]);
    await page.click('#act-go');
    await page.waitForFunction(() => !document.getElementById('act-paste').hidden, null, { timeout: 40000 });
    const k1 = await k1Of(page, 'vaulta:kingbeelovis');
    state.abortN = 2;
    await page.fill('#act-key', DEV_WIF); await page.click('#act-paste-go');
    await stateAfter(page);
    state.keys.kingbeelovis = [DEV_PUB, k1];   // another tab let this wallet sign, with no action
    await page.click('#act-stat button.wl-act'); await stateAfter(page);
    const s = await sheet(page);
    ok('check again finds the key: it says this wallet signs now and sends the reader to the name desk, never that the renew is done',
      /^This wallet now signs for kingbeelovis, and the name desk shows whether king\.b changed\./.test(s.stat) && !/renewed/.test(s.stat) && await page.evaluate(() => /bnames\.html/.test((document.querySelector('#act-stat a') || {}).href || '')), JSON.stringify(s));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* D · one press, end to end, with a real passkey ceremony */
  {
    console.log('D · one press with a passkey (virtual authenticator, PRF):');
    const { ctx, state } = await context(browser, 'bee', { realPasskey: true });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    let prf = true;
    try { await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true } }); }
    catch (e) { prf = false; }
    if (!prf) console.log('  (this Chromium has no PRF virtual authenticator; the one-press passkey path is not exercised here)');
    else {
      await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
      await page.evaluate(() => document.getElementById('kc-create').click());
      await page.waitForFunction(() => /keychain live|bzDiD born/.test(document.getElementById('kc-stat').textContent), null, { timeout: 30000 });
      state.keys.kingbeelovis = [(await page.textContent('#kc-k1-pub')).trim()];
      await intentFor(page, 'live-0002', RENEW);
      await page.goto(sheetUrl(RENEW, 'live-0002'), { waitUntil: 'load' });
      await page.waitForSelector('#act-sheet', { timeout: 20000 });
      await page.waitForFunction(() => { const e = document.getElementById('act-stat'); return e && /^(done|fail)$/.test(e.getAttribute('data-state') || ''); }, null, { timeout: 60000 });
      const s = await sheet(page);
      ok('one press: passkey, build, sign as kingbeelovis, persist, send, read back, done in words', s.state === 'done' && s.stat === 'Done. king.b is renewed for 365 days. The chain confirmed it.' && s.goHidden && state.submits === 1, JSON.stringify(s) + ' submits ' + state.submits);
      const box = await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]'));
      const e = (Array.isArray(box) ? box : (box.entries || [])).find(x => x && x.phase === 'confirmed');
      ok('the outbox holds the signed bytes as confirmed (persist before submit)', !!e && /kingbeelovis::renew by kingbeelovis@active/.test(e.human_summary || ''), JSON.stringify(e || box).slice(0, 200));
      ok('at a glance now reads ready, and the receive address is the account', (await page.textContent('#sum-bridge')).trim() === 'kingbeelovis · ready to sign ✓' && await page.evaluate(() => window.BNRPAY.railAddresses(null, 'king')[0].v) === 'kingbeelovis', await page.textContent('#sum-bridge'));
    }
    ok('no page errors in the one-press run', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* E · a row someone registered over a bare account never redirects it */
  {
    console.log('E · a hostile row and a lapsed row:');
    const { ctx, state } = await context(browser, 'bee', { soul: 'alicevaulta1' });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY, null, { timeout: 20000 });
    state.keys.alicevaulta1 = [await k1Of(page, 'vaulta:alicevaulta1')];
    // the receive panel open before the keychain: no address, one sentence and the one link
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-rx').click(); });
    const vcard = () => page.evaluate(() => { const c = [...document.getElementById('rx-cards').children].find(x => /Vaulta/.test(x.textContent)); return c ? { t: c.innerText.trim(), addr: (c.querySelector('.rx-addr') || {}).textContent || null, kc: !!c.querySelector('a[href="#kc-sec"]') } : null; });
    let vc = await vcard();
    ok('before the keychain the Vaulta card offers no address, with one sentence and its one link', !!vc && vc.addr === null && /your Vaulta address shows here once your keychain is connected\./.test(vc.t) && vc.kc, JSON.stringify(vc));
    state.slowAcct = 1200;   // the account check is still in flight when the card is first redrawn
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 30000 });
    state.slowAcct = 0;
    await page.waitForFunction(() => { const a = document.querySelector('#rx-cards .rx-addr'); return a && a.textContent === 'alicevaulta1'; }, null, { timeout: 5000 }).catch(() => {});
    vc = await vcard();
    ok('once the check proves the account, the open card shows it without a press', !!vc && vc.addr === 'alicevaulta1', JSON.stringify(vc));
    ok('a bare account that carries this wallet\'s key stays itself, whatever a row says', (await page.textContent('#sum-bridge')).trim() === 'alicevaulta1 · ready to sign ✓', await page.textContent('#sum-bridge'));
    const rx = await page.evaluate(() => window.BNRPAY.railAddresses(null, 'alicevaulta1')[0]);
    ok('and it receives at itself, never at the hostile row\'s account', rx.v === 'alicevaulta1' && !/attacker/.test(JSON.stringify(rx)), JSON.stringify(rx));
    ok('the proof is kept, so the row cannot redirect it on the next visit', await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_vacct')).proven === true));
    await page.evaluate(() => { localStorage.setItem('bnr_soul', 'gonesoul'); localStorage.removeItem('bnr_vacct'); });
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRPAY && /gonesoul/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    ok('a lapsed row is not followed', await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_vacct') || '{}').state) === 'self' && !/attacker/.test(await page.textContent('#sum-soul')), await page.textContent('#sum-soul'));
    const gone = await page.evaluate(() => window.BNRPAY.railAddresses(null, 'gonesoul')[0]);
    ok('a lapsed name offers no Vaulta receive address: the bare name may be a stranger\'s', gone.v === null && gone.why === 'vacct-lapsed', JSON.stringify(gone));
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-rx').click(); });
    const goneCard = await page.innerText('#rx-cards');
    ok('and its card says so in one sentence with its one link, with no address to copy',
      /gonesoul\.b has lapsed, so it points at no account and no Vaulta address is shown\./.test(goneCard) && !(await page.$('#rx-cards .rxc')) && await page.evaluate(() => !!document.querySelector('#rx-cards a[href="#connect-sec"]')), goneCard);
    await page.evaluate(() => { localStorage.setItem('bnr_soul', 'honey-bee7'); localStorage.removeItem('bnr_vacct'); });
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRPAY && /honey-bee7/.test(document.getElementById('sum-soul').textContent) && JSON.parse(localStorage.getItem('bnr_vacct') || '{}').soul === 'honey-bee7', null, { timeout: 20000 });
    const noacct = await page.evaluate(() => window.BNRPAY.railAddresses(null, 'honey-bee7')[0]);
    ok('a name that cannot be a Vaulta account offers no Vaulta receive address', noacct.v === null && noacct.why === 'vacct-noacct', JSON.stringify(noacct));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* F · the account already carries this keychain's key from an earlier name: found, no paste */
  {
    console.log('F · an earlier key on the account is found:');
    const { ctx, state } = await context(browser, 'bee');
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__ctx')) { localStorage.setItem('bnr_contexts', JSON.stringify(['vaulta:oldsoul'])); sessionStorage.setItem('__ctx', '1'); } } catch (e) {} });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    state.keys.kingbeelovis = [DEV_PUB, await k1Of(page, 'vaulta:oldsoul')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    ok('the wallet finds its own earlier key on kingbeelovis and signs with it: no paste, no other wallet', (await page.textContent('#sum-bridge')).trim() === 'kingbeelovis · ready to sign ✓' && (await page.textContent('#kc-k1-pub')).trim() === state.keys.kingbeelovis[1], await page.textContent('#sum-bridge'));
    ok('it keeps only the context name, never a key', await page.evaluate(() => localStorage.getItem('bnr_k1ctx')) === JSON.stringify({ acct: 'kingbeelovis', ctx: 'vaulta:oldsoul' }));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* G · one paste, one press: the account's active key adds this wallet AND renews, in one transaction */
  {
    console.log('G · one paste, one press (virtual authenticator):');
    const { ctx, state } = await context(browser, 'bee', { realPasskey: true });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    let prf = true;
    try { await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true } }); }
    catch (e) { prf = false; }
    if (!prf) console.log('  (this Chromium has no PRF virtual authenticator; the paste path is not exercised here)');
    else {
      state.keys.kingbeelovis = [DEV_PUB];
      await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
      await page.evaluate(() => document.getElementById('kc-create').click());
      await page.waitForFunction(() => /keychain live|bzDiD born/.test(document.getElementById('kc-stat').textContent), null, { timeout: 30000 });
      const k1 = (await page.textContent('#kc-k1-pub')).trim();
      // the bridge page: one sentence, one field, one button; no copy button, no other wallet named
      await page.waitForFunction(() => !!document.getElementById('br-paste'), null, { timeout: 15000 });
      ok('the bridge page is one sentence, one field and one button', await page.evaluate(() => { const c = document.getElementById('br-calm'); return !!c && !document.getElementById('br-copy') && !/Anchor|permissions →|copy/i.test(c.textContent) && /^this wallet does not sign for kingbeelovis yet, so paste its active key once/.test(c.textContent) && document.getElementById('br-paste-go').textContent === 'add this wallet'; }), await page.textContent('#br-calm'));
      state.onSend = () => { state.keys.kingbeelovis = [DEV_PUB, k1]; };   // the chain applies the updateauth the transaction carried
      await intentFor(page, 'live-0004', RENEW);
      await page.goto(sheetUrl(RENEW, 'live-0004'), { waitUntil: 'load' });
      await page.waitForSelector('#act-sheet', { timeout: 20000 });
      await page.waitForFunction(() => !document.getElementById('act-paste').hidden, null, { timeout: 40000 });
      let s = await sheet(page);
      ok('not signing for kingbeelovis yet: the sheet asks for one paste, right there', /Paste kingbeelovis\u2019s active key once/.test(s.stat) && s.goHidden && !/Anchor|bridge/i.test(s.text), JSON.stringify(s));
      await page.fill('#act-key', DEV_WIF);
      await page.click('#act-paste-go');
      await page.waitForFunction(() => /^(done|fail)$/.test(document.getElementById('act-stat').getAttribute('data-state') || ''), null, { timeout: 40000 });
      s = await sheet(page);
      ok('one press: added and renewed', s.state === 'done' && s.stat === 'Done. king.b is renewed for 365 days. This wallet now signs for kingbeelovis with one press.', JSON.stringify(s));
      ok('in ONE transaction carrying two actions (updateauth, then renew)', state.submits === 1 && parseInt(String(state.packed).slice(28, 30), 16) === 2, String(state.packed).slice(0, 40));
      ok('the pasted key is gone from the page', await page.evaluate(() => document.getElementById('act-key').value === '' && !JSON.stringify(localStorage).includes('5KQwrPbw')));
      ok('the wallet now signs for kingbeelovis itself', (await page.textContent('#sum-bridge')).trim() === 'kingbeelovis · ready to sign ✓', await page.textContent('#sum-bridge'));
    }
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* H · the A lanes: send, RAM and a new account move A through core.vaulta, and the owner's daily cap holds on every lane, the composer included */
  {
    console.log('H · the A lanes and the daily cap:');
    const { ctx, state } = await context(browser, 'bee');
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.waitForFunction(() => document.getElementById('v-bal').textContent === '5.0000 A', null, { timeout: 15000 }).catch(() => {});
    ok('the A figure is the core.vaulta balance, never the EOS core balance relabelled', (await page.textContent('#v-bal')) === '5.0000 A', await page.textContent('#v-bal'));
    const sent = []; state.onSend = body => sent.push(body.packed_trx);
    const press = id => page.evaluate(i => document.getElementById(i).click(), id);
    const settle = (id, re) => page.waitForFunction(([i, r]) => new RegExp(r).test(document.getElementById(i).innerText), [id, re.source], { timeout: 20000 })
      .catch(async () => console.log('  (waited for ' + re + ' in #' + id + ', it reads: ' + JSON.stringify(await page.innerText('#' + id)) + ')'));
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-tx').click(); document.getElementById('tx-tab-v').click(); });
    await page.evaluate(() => { document.getElementById('sv-to').value = 'someoneelse1'; document.getElementById('sv-amt').value = '1.5'; });
    await press('sv-go');
    await settle('sv-stat', /^sent 1\.5000 A to someoneelse1\.$/);
    ok('send A is one transfer on core.vaulta, never on eosio', sent.length === 1 && sent[0].includes(actHex('core.vaulta', 'transfer')) && !sent[0].includes(actHex('eosio', 'transfer')) && sent[0].includes('983a0000000000000441000000000000'), String(sent[0]).slice(0, 120));
    await page.evaluate(() => localStorage.setItem('bnr-spend-cap', JSON.stringify({ A: 1 })));
    await page.evaluate(() => { document.getElementById('sv-to').value = 'someoneelse1'; document.getElementById('sv-amt').value = '0.1'; });
    await press('sv-go');
    await settle('sv-stat', /past the daily cap you set/);
    ok('past the daily cap, send A says so in one sentence with its one link, and signs nothing', sent.length === 1 && await page.evaluate(() => !!document.querySelector('#sv-stat a[href="#cap-row"]')), await page.innerText('#sv-stat'));
    await page.evaluate(() => { document.querySelector('[data-wl-go="proof"]').click();
      document.getElementById('tx-contract').value = 'core.vaulta'; document.getElementById('tx-action').value = 'transfer'; document.getElementById('tx-net').value = 'main';
      document.getElementById('tx-data').value = JSON.stringify({ from: 'kingbeelovis', to: 'someoneelse1', quantity: '0.5000 A', memo: '' }); });
    const boxBefore = await page.evaluate(() => (localStorage.getItem('bnr_outbox_v1') || '[]').length);
    await press('tx-go');
    await settle('tx-out', /past the daily cap you set/);
    ok('a composed action that moves A meets the same cap: refused before anything is built or signed', sent.length === 1 && await page.evaluate(() => document.getElementById('tx-out').getAttribute('data-fail')) === 'cap' && await page.evaluate(() => (localStorage.getItem('bnr_outbox_v1') || '[]').length) === boxBefore, await page.innerText('#tx-out'));
    ok('the composer offers no passkey lane it cannot sign with', await page.evaluate(() => !document.getElementById('tx-wa') && !document.getElementById('tx-wa-row')));
    await page.evaluate(() => localStorage.removeItem('bnr-spend-cap'));
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-sw').click(); document.getElementById('sw-amt').value = '4096'; });
    await press('sw-go');
    await settle('sw-stat', /^bought 4,096 bytes of RAM\.$/);
    ok('buying RAM with A goes through core.vaulta buyrambytes', sent.length === 2 && sent[1].includes(actHex('core.vaulta', 'buyrambytes')) && !sent[1].includes(actHex('eosio', 'buyrambytes')), String(sent[1]).slice(0, 120));
    await page.evaluate(() => { document.querySelector('[data-wl-go="key"]').click(); document.getElementById('ac-name').value = 'newacctname1'; document.getElementById('ac-ram').value = '8192'; });
    await press('ac-go');
    await settle('ac-stat', /^newacctname1 is yours now\./);
    ok('a new account is eosio newaccount plus RAM bought in A at core.vaulta, in one transaction', sent.length === 3 && sent[2].includes(actHex('eosio', 'newaccount')) && sent[2].includes(actHex('core.vaulta', 'buyrambytes')), String(sent[2]).slice(0, 120));
    await page.evaluate(() => { localStorage.setItem('bnr-spend-cap', JSON.stringify({ A: 0.0001 })); document.getElementById('ac-name').value = 'newacctname2'; });
    await press('ac-go');
    await settle('ac-stat', /past the daily cap you set/);
    ok('the account forge meets the daily cap too: its RAM is A spent', sent.length === 3, await page.innerText('#ac-stat'));
    state.ramDown = true;
    await page.evaluate(() => { localStorage.setItem('bnr-spend-cap', JSON.stringify({ A: 50 })); document.querySelector('[data-wl-go="proof"]').click();
      document.getElementById('tx-contract').value = 'core.vaulta'; document.getElementById('tx-action').value = 'buyrambytes'; document.getElementById('tx-net').value = 'main';
      document.getElementById('tx-data').value = JSON.stringify({ payer: 'kingbeelovis', receiver: 'kingbeelovis', bytes: 4096 }); document.getElementById('tx-go').click(); });
    await settle('tx-out', /cannot be checked/);
    ok('RAM the page cannot price is said as exactly that, and nothing is signed', sent.length === 3 && await page.evaluate(() => document.getElementById('tx-out').getAttribute('data-fail')) === 'cap-unsized', await page.innerText('#tx-out'));
    state.ramDown = false;
    await page.evaluate(d => { localStorage.setItem('bnr-spend-cap', JSON.stringify({ A: 0.0001 }));
      document.getElementById('tx-contract').value = 'kingbeelovis'; document.getElementById('tx-action').value = 'renew'; document.getElementById('tx-data').value = JSON.stringify(d); document.getElementById('tx-go').click(); }, RENEW);
    await settle('tx-out', /^(done|sent)./);
    ok('a registry action moves no A, so even a tiny cap lets it through', sent.length === 4 && await page.evaluate(() => document.getElementById('tx-out').getAttribute('data-fail') === null), await page.innerText('#tx-out'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* I · a composed action for an account this wallet does not sign for stops at the guard */
  {
    console.log('I · the composer never skips the guard:');
    const { ctx, state } = await context(browser, 'bee');
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await ctx.addInitScript(() => { try { localStorage.setItem('bnr_wa', JSON.stringify({ pub: 'PUB_WA_fixture', canon: 'PUB_WA_fixture', credIdHex: '00' })); } catch (e) {} });
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    await recoveryConnect(page);
    await page.waitForFunction(() => /let this wallet sign for it/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(d => { document.querySelector('[data-wl-go="proof"]').click();
      document.getElementById('tx-contract').value = 'kingbeelovis'; document.getElementById('tx-action').value = 'renew'; document.getElementById('tx-net').value = 'main';
      document.getElementById('tx-data').value = JSON.stringify(d); document.getElementById('tx-go').click(); }, RENEW);
    await page.waitForFunction(() => /does not sign for kingbeelovis yet/.test(document.getElementById('tx-out').innerText), null, { timeout: 15000 });
    ok('even with an account passkey on file, an unbridged account gets the guard\'s one sentence and link, and nothing is sent or kept',
      state.submits === 0 && await page.evaluate(() => !!document.querySelector('#tx-out a[href="#bridge-sec"]') && (localStorage.getItem('bnr_outbox_v1') || '[]') === '[]'), await page.innerText('#tx-out'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* J · an account the forge made is proven by its /active key, even under a hostile row */
  {
    console.log('J · a forged bare account under a hostile row:');
    const { ctx, state } = await context(browser, 'bee', { soul: 'alicevaulta1' });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY, null, { timeout: 20000 });
    state.keys.alicevaulta1 = [await k1Of(page, 'vaulta:alicevaulta1/active')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    ok('the forge\'s /active key proves the bare account is this wallet\'s: it signs as itself', (await page.textContent('#sum-bridge')).trim() === 'alicevaulta1 · ready to sign ✓', await page.textContent('#sum-bridge'));
    ok('it keeps only the context name', await page.evaluate(() => localStorage.getItem('bnr_k1ctx')) === JSON.stringify({ acct: 'alicevaulta1', ctx: 'vaulta:alicevaulta1/active' }));
    ok('and it receives at itself, never at the hostile row\'s account', await page.evaluate(() => window.BNRPAY.railAddresses(null, 'alicevaulta1')[0].v) === 'alicevaulta1');
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* K · the forge's done line carries its one action: switch to the new account, which signs with no paste */
  {
    console.log('K · from the forge to the new account in one press:');
    const { ctx, state } = await context(browser, 'bee');
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => { document.querySelector('[data-wl-go="key"]').click(); document.getElementById('ac-name').value = 'newacctname1'; document.getElementById('ac-go').click(); });
    await page.waitForFunction(() => /^newacctname1 is yours now\./.test(document.getElementById('ac-stat').innerText), null, { timeout: 20000 }).catch(() => {});
    const btn = await page.evaluate(() => { const b = document.querySelector('#ac-stat button.wl-act'); return b ? b.textContent : null; });
    ok('the done line is one sentence and its one button', btn === 'switch the wallet to newacctname1', await page.innerText('#ac-stat'));
    state.keys.newacctname1 = [await k1Of(page, 'vaulta:newacctname1/active')];
    await page.evaluate(() => document.querySelector('#ac-stat button.wl-act').click());
    await page.waitForFunction(() => /^newacctname1 · ready to sign/.test(document.getElementById('sum-bridge').textContent.trim()), null, { timeout: 20000 }).catch(() => {});
    ok('one press later the wallet signs as the new account: no paste, no bridge', (await page.textContent('#sum-bridge')).trim() === 'newacctname1 · ready to sign ✓' && await page.evaluate(() => document.getElementById('bridge-sec').style.display === 'none'), await page.textContent('#sum-bridge'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* L · a lost or duplicate answer never signs a second transaction */
  {
    console.log('L · one signature per send, whatever the network answers:');
    const { ctx, state } = await context(browser, 'bee');
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-tx').click(); document.getElementById('tx-tab-v').click(); });
    const fill = (to, amt, memo) => page.evaluate(([t, a, m]) => { document.getElementById('sv-to').value = t; document.getElementById('sv-amt').value = a; document.getElementById('sv-memo').value = m || ''; }, [to, amt, memo]);
    const svText = () => page.innerText('#sv-stat');
    const ledger = () => page.evaluate(() => JSON.parse(localStorage.getItem('bnr-cap-ledger') || '[]').reduce((t, e) => t + e.a, 0));
    await fill('someoneelse1', '0.12345');
    await page.evaluate(() => document.getElementById('sv-go').click());
    ok('an amount finer than A carries is refused in words, never rounded', /at most 4 digits/.test(await svText()) && !(state.posts || []).length, await svText());
    await fill('someoneelse1', '0.1', '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');   // TESTNET-ONLY: eosio's documented dev key, as a careless memo
    await page.evaluate(() => document.getElementById('sv-go').click());
    ok('a memo that holds a private key is never sent: memos are public', /looks like a private key/.test(await svText()) && !(state.posts || []).length, await svText());
    for (const [what, memo] of [['0x and 64 hex', '0x' + 'ab'.repeat(32)], ['64 hex after a word and a colon', 'key:' + 'cd'.repeat(32)], ['64 hex in quotes', '"' + 'EF'.repeat(32) + '"']]) {
      await fill('someoneelse1', '0.1', memo);
      await page.evaluate(() => document.getElementById('sv-go').click());
      ok('a memo with ' + what + ' (an EVM style key) is never sent', /looks like a private key/.test(await svText()) && !(state.posts || []).length, await svText());
    }
    // a duplicate answer: the bytes went in, nothing new is signed, the cap keeps the count
    state.dupOnce = true;
    await fill('someoneelse1', '0.2');
    await page.evaluate(() => document.getElementById('sv-go').click());
    await page.waitForFunction(() => /already sent once/.test(document.getElementById('sv-stat').innerText), null, { timeout: 20000 }).catch(() => {});
    ok('a duplicate answer reads as already sent, not as refused, and offers no second signature', /already sent once, so nothing new was signed/.test(await svText()) && !/nothing was sent/.test(await svText()) && !(await page.$('#sv-stat button.wl-act')), await svText());
    ok('and the daily count keeps it (no refund for a send that went in)', Math.abs((await ledger()) - 0.2) < 1e-9, String(await ledger()));
    // the same send again while that one may be in: nothing new is signed until the reader chooses
    const p0 = (state.posts || []).length;
    await fill('someoneelse1', '0.2');
    await page.evaluate(() => document.getElementById('sv-go').click());
    await page.waitForFunction(() => /still on its way/.test(document.getElementById('sv-stat').innerText), null, { timeout: 15000 }).catch(() => {});
    ok('the identical send inside its window is held: still on its way, nothing new signed', /still on its way, so nothing new was signed/.test(await svText()) && state.posts.length === p0, await svText());
    await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l.forEach(e => { if (/send 0\.2000 A/.test(e.human_summary)) e.expires_at = new Date(Date.now() - 600000).toISOString(); }); localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); });
    await page.evaluate(() => document.getElementById('sv-go').click());
    await page.waitForFunction(() => /may already be in/.test(document.getElementById('sv-stat').innerText), null, { timeout: 15000 }).catch(() => {});
    ok('past its window it may still be in: the reader is told and chooses, nothing is signed silently', /may already be in, so nothing new was signed/.test(await svText()) && state.posts.length === p0 && (await page.textContent('#sv-stat button.wl-act')) === 'send a new one', await svText());
    await page.evaluate(() => document.querySelector('#sv-stat button.wl-act').click());
    await page.waitForFunction(() => /^sent 0\.2000 A to someoneelse1\.$/.test(document.getElementById('sv-stat').innerText.trim()), null, { timeout: 30000 }).catch(() => {});
    ok('send a new one signs exactly one new transaction', state.posts.length === p0 + 1, String(state.posts.length - p0));
    // a lost answer: kept, and "send it again" resends the identical bytes
    const before = (state.posts || []).length;
    state.abortN = 2;
    await fill('someoneelse1', '0.3');
    await page.evaluate(() => document.getElementById('sv-go').click());
    await page.waitForFunction(() => /cannot tell yet/.test(document.getElementById('sv-stat').innerText), null, { timeout: 30000 }).catch(() => {});
    ok('a lost answer is said as unknown, never as nothing sent', /cannot tell yet whether it went out/.test(await svText()) && !/nothing was sent/.test(await svText()), await svText());
    const lost = state.posts.slice(before);
    await page.evaluate(() => document.querySelector('#sv-stat button.wl-act').click());
    await page.waitForFunction(() => /^sent 0\.3000 A to someoneelse1\.$/.test(document.getElementById('sv-stat').innerText.trim()), null, { timeout: 30000 }).catch(() => {});
    const again = state.posts.slice(before + lost.length);
    ok('send it again resends the identical signed bytes: one transaction, never a second signature', again.length >= 1 && again.every(p => p === lost[0]) && lost.every(p => p === lost[0]), JSON.stringify({ lost: lost.length, again: again.length }));
    ok('and it then lands in words', /^sent 0\.3000 A to someoneelse1\.$/.test((await svText()).trim()), await svText());
    // two quick presses sign once
    const b2 = (state.posts || []).length;
    await fill('someoneelse1', '0.05');
    await page.evaluate(() => { const b = document.getElementById('sv-go'); b.click(); b.click(); });
    await page.waitForFunction(() => /^sent 0\.0500 A/.test(document.getElementById('sv-stat').innerText.trim()), null, { timeout: 30000 }).catch(() => {});
    const posted = state.posts.slice(b2);
    ok('a double press signs and sends one transaction', posted.length === 1, String(posted.length));
    // a send still waiting for its answer, the receive panel open, and the keychain closes: the cards follow at once
    await page.evaluate(() => document.getElementById('pay-rx').click());
    const evmShown = () => page.evaluate(() => /0x[0-9a-fA-F]{40}/.test(document.getElementById('rx-cards').textContent));
    ok('the receive panel shows this soul\'s derived addresses', await evmShown());
    state.slowSend = 4000;
    const b3 = (state.posts || []).length;
    await page.evaluate(() => { document.getElementById('pay-tx').click(); document.getElementById('tx-tab-v').click(); });
    await fill('someoneelse1', '0.06');
    await page.evaluate(() => document.getElementById('sv-go').click());
    for (let i = 0; i < 60 && (state.posts || []).length === b3; i++) await page.waitForTimeout(100);
    await page.evaluate(() => { document.getElementById('pay-rx').click(); document.getElementById('kc-out').click(); });
    await page.waitForTimeout(1200);
    const busy = await page.evaluate(() => document.getElementById('sv-go').disabled);
    ok('while that send is still busy, the open receive panel drops the closed keychain\'s addresses', (state.posts || []).length === b3 + 1 && busy && !(await evmShown()), JSON.stringify({ posted: state.posts.length - b3, busy }));
    state.slowSend = 0;
    await page.waitForFunction(() => /^sent 0\.0600 A/.test(document.getElementById('sv-stat').innerText.trim()), null, { timeout: 30000 }).catch(() => {});
    ok('and the send itself still lands in words', /^sent 0\.0600 A to someoneelse1\./.test((await svText()).trim()), await svText());
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* P · a node took a capped send and this browser could not write that down: every tab, and this one reopened,
     holds the send and its count. A late press is never proof it did not go, gives nothing back, and signs nothing new */
  {
    console.log('P · an ack the outbox could not save holds the cap in every tab:');
    const { ctx, state } = await context(browser, 'bee');
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(ORIGIN + '/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    const toSend = pg => pg.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-tx').click(); document.getElementById('tx-tab-v').click();
      document.getElementById('sv-to').value = 'someoneelse1'; document.getElementById('sv-amt').value = '0.2'; document.getElementById('sv-memo').value = ''; });
    const ledger = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('bnr-cap-ledger') || '[]').reduce((t, e) => t + e.a, 0));
    await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__full && k === 'bnr_outbox_v1') throw new DOMException('the quota is full (fixture)', 'QuotaExceededError'); return set.call(this, k, v); }; });
    state.noHint = true;
    state.beforeAck = () => page.evaluate(() => { window.__full = true; });
    await toSend(page);
    await page.evaluate(() => document.getElementById('sv-go').click());
    await page.waitForFunction(() => /could not save that/.test(document.getElementById('sv-stat').innerText), null, { timeout: 30000 }).catch(() => {});
    state.beforeAck = null;
    await page.evaluate(() => { window.__full = false; });
    const one = state.posts.length;
    ok('the send went out, its outbox write failed, and the daily count holds it', /^it was sent, but this browser could not save that/.test(await page.innerText('#sv-stat')) && Math.abs((await ledger(page)) - 0.2) < 1e-9 &&
      await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bnr_outbox_ack') || '{}')).some(a => a.acked && /^MOCKTXID/.test(a.ref || ''))), await page.innerText('#sv-stat'));
    /* a second wallet tab, which never heard the answer */
    const tab2 = await ctx.newPage(); tab2.on('pageerror', e => errors.push(e.message));
    await tab2.goto(ORIGIN + '/surfaces/wallet.html', { waitUntil: 'load' });
    await tab2.waitForFunction(() => window.BZDIDKEY && document.querySelector('#outbox-list .obx-retry') && window.BNRWALLET && BNRWALLET.adapters.vaulta.attached, null, { timeout: 25000 });
    const row2 = await tab2.evaluate(() => ({ stat: (document.querySelector('#outbox-list .obx-stat') || {}).innerText, btn: (document.querySelector('#outbox-list .obx-retry') || {}).textContent }));
    ok('the other tab reads it as sent, never as signed and not sent yet', /^sent\. the chain has not confirmed it yet\./.test(row2.stat || '') && row2.btn === 'send it again', JSON.stringify(row2));
    /* its window long over, a press there is refused as expired */
    await tab2.evaluate(() => { const l = JSON.parse(localStorage.getItem('bnr_outbox_v1')); l.forEach(e => { if (/send 0\.2000 A to someoneelse1/.test(e.human_summary)) e.expires_at = new Date(Date.now() - 600000).toISOString(); }); localStorage.setItem('bnr_outbox_v1', JSON.stringify(l)); });
    state.refuse = 'expired transaction'; state.refuseName = 'expired_tx_exception';
    await tab2.evaluate(() => document.querySelector('#outbox-list .obx-retry').click());
    await tab2.waitForFunction(() => JSON.parse(localStorage.getItem('bnr_outbox_v1') || '[]').some(e => /send 0\.2000 A/.test(e.human_summary) && e.phase === 'expired'), null, { timeout: 20000 }).catch(() => {});
    state.refuse = null; state.refuseName = null;
    const x = await tab2.evaluate(() => ({ e: JSON.parse(localStorage.getItem('bnr_outbox_v1')).find(e => /send 0\.2000 A/.test(e.human_summary)), said: (document.querySelector('#outbox-list .obx-stat') || {}).innerText || '' }));
    ok('the late press is filed as maybe in, with no "nothing changed", and the cap gives nothing back',
      x.e && x.e.phase === 'expired' && x.e.evidence && x.e.evidence.maybe_in === true && !x.e.evidence.definite && !/nothing changed/.test(x.said) && !(x.e.cap && x.e.cap.refunded) && Math.abs((await ledger(tab2)) - 0.2) < 1e-9, JSON.stringify(x).slice(0, 260));
    /* the same send again from the other tab: held, nothing new is signed */
    await recoveryConnect(tab2);
    await tab2.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await toSend(tab2);
    await tab2.evaluate(() => document.getElementById('sv-go').click());
    await tab2.waitForFunction(() => /nothing new was signed|^sent 0\.2000/.test(document.getElementById('sv-stat').innerText), null, { timeout: 20000 }).catch(() => {});
    ok('the same send pressed again is held as may already be in: nothing new is signed', /may already be in, so nothing new was signed/.test(await tab2.innerText('#sv-stat')) && state.posts.length === one + 1, await tab2.innerText('#sv-stat') + ' · posts ' + (state.posts.length - one));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* N · EOS held on the account turns into A in one press: an eosio.token transfer to core.vaulta, signed once, under the cap */
  {
    console.log('N · EOS held turns into A in one press:');
    const { ctx, state } = await context(browser, 'bee');
    state.eos = { kingbeelovis: '1.2345 EOS' };
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    await page.waitForFunction(() => /also holds 1\.2345 EOS/.test(document.getElementById('v-stat').textContent), null, { timeout: 20000 }).catch(() => {});
    const offer = await page.evaluate(() => ({ t: document.getElementById('v-stat').innerText, btn: (document.querySelector('#v-stat button.wl-act') || {}).textContent }));
    ok('EOS held is said as a fact with its one action, and is not counted as A', /also holds 1\.2345 EOS/.test(offer.t) && offer.btn === 'turn it into A' && /5\.0000 A/.test(await page.textContent('#v-bal')), JSON.stringify(offer));
    await page.evaluate(() => document.querySelector('#v-stat button.wl-act').click());
    await page.waitForFunction(() => /connect your keychain/.test(document.getElementById('v-stat').innerText), null, { timeout: 10000 }).catch(() => {});
    ok('without the keychain nothing is signed and the line names the one step', /connect your keychain/.test(await page.innerText('#v-stat')) && !(state.posts || []).length, await page.innerText('#v-stat'));
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    // the cap is asked first: an owner's EOS cap below the amount refuses before anything is signed
    await page.evaluate(() => localStorage.setItem('bnr-spend-cap', JSON.stringify({ EOS: 1 })));
    await page.evaluate(() => { document.getElementById('wq').value = 'king'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => document.querySelector('#v-stat button.wl-act') && /turn it into A/.test(document.querySelector('#v-stat button.wl-act').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200); await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => document.querySelector('#v-stat button.wl-act').click());
    await page.waitForFunction(() => /past the daily cap/.test(document.getElementById('v-stat').innerText), null, { timeout: 15000 }).catch(() => {});
    ok('an EOS cap below the amount refuses before anything is signed', /past the daily cap/.test(await page.innerText('#v-stat')) && !(state.posts || []).length, await page.innerText('#v-stat'));
    await page.evaluate(() => localStorage.removeItem('bnr-spend-cap'));
    let sent = null; state.onSend = b => { sent = b.packed_trx; state.eos.kingbeelovis = '0.0000 EOS'; };
    // read again so the offer is back, then one press
    await page.evaluate(() => { document.getElementById('wq').value = 'king'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => document.querySelector('#v-stat button.wl-act') && /turn it into A/.test(document.querySelector('#v-stat button.wl-act').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200); await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => document.querySelector('#v-stat button.wl-act').click());
    const landed = await page.waitForFunction(() => /is now A/.test(document.getElementById('v-stat').innerText) && document.getElementById('v-stat').innerText, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => '');
    ok('one press signs one eosio.token transfer of exactly 1.2345 EOS from kingbeelovis to core.vaulta', !!sent && (state.posts || []).length === 1 && sent.includes(actHex('eosio.token', 'transfer')) && sent.includes(nameHex('kingbeelovis') + nameHex('core.vaulta') + '3930000000000000' + '04454f5300000000'), String(sent).slice(0, 120));
    ok('and it lands in words', /your 1\.2345 EOS is now A\./.test(landed), landed);
    // every Arbitrum host is down here: the card says so calmly, with try again, and shows no figure
    await page.waitForFunction(() => /did not load/.test(document.getElementById('a-stat').innerText), null, { timeout: 20000 }).catch(() => {});
    const arb = await page.evaluate(() => ({ t: document.getElementById('a-stat').innerText, btn: (document.querySelector('#a-stat button.wl-act') || {}).textContent, fig: document.getElementById('a-bal').textContent }));
    ok('a failed Arbitrum read is one calm sentence and try again, never a bare "read failed" or a figure', /^your Arbitrum balance did not load just now\./.test(arb.t) && arb.btn === 'try again' && arb.fig === '', JSON.stringify(arb));
    // a new name's total counts only its own accounts (each reads 5.0000 A here): never 10.0000 A
    await page.evaluate(() => { document.getElementById('wq').value = 'bobsoul'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => /bobsoul/.test(document.getElementById('vaulta-breakdown').textContent), null, { timeout: 20000 }).catch(() => {});
    const tot = await page.evaluate(() => ({ bal: document.getElementById('v-bal').textContent, rows: [...document.querySelectorAll('#vaulta-breakdown .va-rollup-row')].map(r => r.textContent) }));
    ok('a new name\'s total counts only its own accounts, never the last name\'s', tot.bal === '5.0000 A' && tot.rows.length === 1 && /bobsoul/.test(tot.rows[0]), JSON.stringify(tot));
    // let the new name's signing check settle first (a disconnect in the middle of it is the bridge lane's own race, not this card's)
    await page.waitForTimeout(400); await page.waitForFunction(() => !/checking/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.getElementById('kc-out').click());
    const out = await page.evaluate(() => ({ a: document.getElementById('a-stat').innerText, ant: document.getElementById('ant-stat').innerText, antBal: document.getElementById('ant-bal').textContent, lit: document.getElementById('ch-arb').classList.contains('connected') || document.getElementById('ch-autonomi').classList.contains('connected') }));
    ok('disconnecting the keychain stops the cards made from it claiming a read', /^connect your keychain to see your Arbitrum balance\.$/.test(out.a) && /^connect your keychain/.test(out.ant) && out.antBal === '' && !out.lit, JSON.stringify(out));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* O · the voucher tops up from this wallet: one sentence names amount, account and memo; yes signs one
     core.vaulta transfer with the memo filled in. A failed second look up never leaves the last key's
     account and memo on screen. The estate's own address and the sample bills are never shown as the reader's. */
  {
    console.log('O · voucher top up, failed look up, the estate address and the sample bills:');
    const { ctx, state } = await context(browser, 'bee');
    const VOUCHER = { balance: '12.5000', topup: { rail_a: { send_to: 'bnrvoucher11', memo: 'gatekey' }, rail_usdc: { send_to: '0x' + '1'.repeat(40), rate_a_per_usdc: '4.2', rate_ref: 'RATE-REF-FIXTURE' } },
      spent_total: '1.0000', deposited_total: '13.5000', tithe_total: '0.1000', receipts: [], source: 'SOURCE-FIXTURE-HOST' };
    state.voucher = () => ({ body: VOUCHER });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    ok('the key field never shows a live meter key as its example', !/bclau|paid-1/.test(await page.getAttribute('#vc-key', 'placeholder')), await page.getAttribute('#vc-key', 'placeholder'));
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-wl-go="add"]').click());
    await page.fill('#vc-key', 'gatekey'); await page.click('#vc-go');
    await page.waitForFunction(() => document.getElementById('vc-panel').style.display === 'block', null, { timeout: 10000 });
    const shown = await page.evaluate(() => ({ copies: [...document.querySelectorAll('.vc-copy')].filter(b => b.getClientRects().length).length, dest: document.getElementById('vc-a-dest').getClientRects().length, top: document.getElementById('vc-top-go').getClientRects().length }));
    ok('bee tops up with one press and sees no copy recipe that sends it elsewhere', shown.copies === 0 && shown.dest === 0 && shown.top === 1, JSON.stringify(shown));
    const topText = () => page.innerText('#vc-top-stat');
    await page.fill('#vc-top-amt', '0.5'); await page.click('#vc-top-go');
    ok('the press asks first, in one sentence naming the amount, the account and the memo, and signs nothing yet',
      /^send 0\.5000 A from kingbeelovis to bnrvoucher11 with the memo gatekey\? it tops up the voucher for gatekey\./.test(await topText()) && !(state.posts || []).length, await topText());
    state.abiDelay = 1500;   // the transfer takes a while to make ready after yes
    await page.click('#vc-top-stat button.wl-act >> text=yes, send it');
    const closed = await page.evaluate(() => ({ t: document.getElementById('vc-top-stat').innerText.trim(), btns: document.querySelectorAll('#vc-top-stat button').length }));
    ok('yes closes the choice at once: one calm sentence, no yes or not now left to press while it is made ready', closed.t === 'getting it ready to sign, one moment.' && closed.btns === 0, JSON.stringify(closed));
    state.abiDelay = 0;
    await page.waitForFunction(() => /^added 0\.5000 A to the voucher for gatekey/.test(document.getElementById('vc-top-stat').innerText.trim()), null, { timeout: 30000 }).catch(() => {});
    const posts = state.posts || [];
    ok('yes signs ONE core.vaulta transfer to the voucher account with the memo filled in', posts.length === 1 && posts[0].includes(actHex('core.vaulta', 'transfer')) && posts[0].includes(nameHex('bnrvoucher11')) && posts[0].includes(Buffer.from('gatekey').toString('hex')), JSON.stringify({ n: posts.length }));
    ok('and it lands in words naming the key it credited, with its one next step', /^added 0\.5000 A to the voucher for gatekey; its balance shows it once the estate counts it\./.test((await topText()).trim()) && (await page.textContent('#vc-top-stat button.wl-act')) === 'read my balance', await topText());
    ok('the top up counts against the daily cap like every send', Math.abs(await page.evaluate(() => JSON.parse(localStorage.getItem('bnr-cap-ledger') || '[]').reduce((t, e) => t + e.a, 0)) - 0.5) < 1e-9);
    // can I afford it asks about the key on screen, never what the field holds now, and answers in words
    let asked = '';
    state.voucher = url => { if (/\/afford/.test(url)) { asked = url; return { body: { ok: true, message: 'ORACLE-AFFORD-FIXTURE' } }; } return { body: VOUCHER }; };
    await page.fill('#vc-key', 'someoneelse'); await page.fill('#vc-afford-amt', '1'); await page.click('#vc-afford-go');
    await page.waitForFunction(() => /^yes/.test(document.getElementById('vc-afford-out').innerText), null, { timeout: 10000 }).catch(() => {});
    ok('can I afford it asks for the key whose balance is on screen and answers in one calm sentence', /\/gatekey\/afford/.test(asked) && /^yes, your voucher covers a job of 1 A\.$/.test((await page.innerText('#vc-afford-out')).trim()), asked + ' · ' + await page.innerText('#vc-afford-out'));
    // a second look up that fails: the last key's account and memo leave the screen
    state.voucher = () => 'abort';
    await page.fill('#vc-key', 'otherkey'); await page.click('#vc-go');
    await page.waitForFunction(() => /could not be read just now/.test(document.getElementById('vc-err').innerText), null, { timeout: 10000 }).catch(() => {});
    const gone = await page.evaluate(() => ({ panel: document.getElementById('vc-panel').style.display, err: document.getElementById('vc-err').innerText, btn: (document.querySelector('#vc-err button.wl-act') || {}).textContent }));
    ok('a failed look up hides the panel (no other key\'s account or memo beside the error) and offers try again', gone.panel === 'none' && /^your balance could not be read just now, so nothing is shown\./.test(gone.err) && gone.btn === 'try again', JSON.stringify(gone));
    await page.evaluate(() => { document.getElementById('vc-top-amt').value = '0.5'; document.getElementById('vc-top-go').click(); });
    ok('and nothing can be topped up for a key that is not on screen', /look up your meter key first/.test(await topText()) && (state.posts || []).length === 1, await topText());
    // an answer missing its top up ways is a failed read, never a half panel
    state.voucher = () => ({ body: { balance: '9.0000' } });
    await page.click('#vc-go');
    await page.waitForFunction(() => /could not be read just now/.test(document.getElementById('vc-err').innerText), null, { timeout: 10000 }).catch(() => {});
    ok('a partial answer shows nothing rather than a mix of two keys', await page.evaluate(() => document.getElementById('vc-panel').style.display) === 'none');
    state.voucher = () => ({ status: 404, body: { message: 'no such meter key' } });
    await page.click('#vc-go');
    await page.waitForFunction(() => /not found/.test(document.getElementById('vc-err').innerText), null, { timeout: 10000 }).catch(() => {});
    ok('an unknown key is said calmly, the oracle\'s own words kept for cypherpunk', /^that meter key was not found; check it and press look up again\./.test(await page.innerText('#vc-err')) && /no such meter key/.test(await page.textContent('#vc-err')), await page.innerText('#vc-err'));
    // the estate's receive address is not the reader's
    const peer = await page.evaluate(() => ({ addr: [...document.querySelectorAll('#peer-sec code')].some(c => c.getClientRects().length && /0x8988/i.test(c.textContent)), copy: document.getElementById('peer-copy').getClientRects().length, what: document.getElementById('peer-what').innerText }));
    ok('bee never sees the estate\'s 0x and copy button as its own; it is told to use receive', !peer.addr && !peer.copy && /not money for you/.test(peer.what), JSON.stringify(peer));
    // the receipts: sample bills said as samples, and a cell opens its own bill
    await page.evaluate(() => document.querySelector('[data-wl-go="proof"]').click());
    await page.waitForFunction(() => window.__spendAuditStats, null, { timeout: 15000 });
    ok('the receipts say they are sample bills, none of them the reader\'s, and where the reader\'s own spending is', /none of them are yours/.test(await page.innerText('#sa-sample')) && (await page.getAttribute('#sa-sample a', 'href')) === '#voucher-sec', await page.innerText('#sa-sample'));
    await page.click('#receiptsBody details[data-reg-disclose] > summary >> nth=0');
    const n = await page.evaluate(() => document.querySelectorAll('#receiptsBody button[data-rc]').length);
    const opened = [];
    for (const j of [0, n - 1]) {
      await page.evaluate(() => document.querySelectorAll('#receiptsBody details[data-ri]').forEach(d => { d.open = false; }));
      await page.click(`#receiptsBody button[data-rc="${j}"]`);
      opened.push(await page.evaluate(() => [...document.querySelectorAll('#receiptsBody details[data-ri]')].filter(d => d.open).map(d => d.getAttribute('data-ri')).join()));
    }
    ok('tapping a receipt cell opens that receipt\'s own proof (first and last)', opened[0] === '0' && opened[1] === String(n - 1), JSON.stringify(opened));
    const words = await page.evaluate(() => ({ text: document.getElementById('receiptsBody').innerText, raw: document.getElementById('receiptsBody').textContent, label: document.querySelector('#receiptsBody button[data-rc]').getAttribute('aria-label') }));
    ok('bee reads each verdict in words; the state names stay in the page for cypherpunk', !/\b(PASSED|PENDING_ANCHOR|FAILED|INCONCLUSIVE)\b/.test(words.text) && /PENDING_ANCHOR/.test(words.raw) && /does not add up/.test(words.text) && !/[A-Z_]{6,}/.test(words.label), words.label);
    ok('the total says which bills it leaves out', /the bills that add up; .* are left out\./.test(words.text));
    await page.fill('#sa-paste', '{"not":"a receipt"}'); await page.click('#sa-paste-go');
    ok('a pasted text that is not a receipt is said calmly, never as a raw error', /^that is not a receipt this page can read; paste the whole receipt and press check it\.$/.test((await page.innerText('#sa-paste-out')).trim()), await page.innerText('#sa-paste-out'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* O2 · the top up signs only what its question named. Connecting another name closes the question; yes
     checks the account, its keychain and its signing again; a top up still on its way when another key is
     looked up keeps its words, named, with the key it credited, never under the other key's balance. */
  {
    console.log('O2 · voucher top up: the question binds the account, the key and the outcome:');
    const { ctx, state } = await context(browser, 'bee');
    const V = (dest, memo) => ({ balance: '12.5000', topup: { rail_a: { send_to: dest, memo }, rail_usdc: { send_to: '0x' + '1'.repeat(40), rate_a_per_usdc: '4.2', rate_ref: 'RATE-REF-FIXTURE' } },
      spent_total: '1.0000', deposited_total: '13.5000', tithe_total: '0.1000', receipts: [], source: 'SOURCE-FIXTURE-HOST' });
    state.voucher = url => ({ body: /\/otherkey\//.test(url) ? V('bnrvoucher22', 'otherkey') : V('bnrvoucher11', 'gatekey') });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    state.keys.bobsoul = [await k1Of(page, 'vaulta:bobsoul')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-wl-go="add"]').click());
    const lookUp = async key => { await page.fill('#vc-key', key); await page.click('#vc-go');
      await page.waitForFunction(k => document.getElementById('vc-panel').style.display === 'block' && document.getElementById('vc-a-memo').textContent === k, key, { timeout: 10000 }); };
    const topText = async () => (await page.innerText('#vc-top-stat')).trim();
    const nPosts = () => (state.posts || []).length;
    const pressYes = () => page.evaluate(() => [...document.querySelectorAll('#vc-top-stat button.wl-act')].find(b => b.textContent === 'yes, send it').click());
    const connectAs = async (name, ready) => { await page.evaluate(n => { document.getElementById('wq').value = n; document.getElementById('wgo').click(); }, name);
      await page.waitForFunction(r => new RegExp(r).test(document.getElementById('sum-bridge').textContent), ready, { timeout: 20000 }).catch(() => {}); };
    await lookUp('gatekey');
    // a top up still on its way when another key is looked up lands in sight, named, never under that key
    await page.fill('#vc-top-amt', '0.5'); await page.click('#vc-top-go');
    await pressYes();
    for (let w = 0; w < 300 && !nPosts(); w++) await page.waitForTimeout(50);
    await lookUp('otherkey');
    await page.fill('#vc-top-amt', '0.7');
    await page.waitForFunction(() => /added 0\.5000 A/.test(document.getElementById('vc-top-away').innerText), null, { timeout: 40000 }).catch(() => {});
    const away = await page.evaluate(() => ({ t: document.getElementById('vc-top-away').innerText.trim(), seen: document.getElementById('vc-top-away').getClientRects().length > 0,
      btn: (document.querySelector('#vc-top-away button.wl-act') || {}).textContent, here: document.getElementById('vc-top-stat').innerText.trim(), amt: document.getElementById('vc-top-amt').value }));
    ok('a top up on its way when another key is looked up lands in sight, naming the key it credited', nPosts() === 1 && away.seen && /^your top up of 0\.5000 A for the voucher gatekey:\s*added 0\.5000 A to the voucher for gatekey;/.test(away.t) && away.btn === 'read its balance', JSON.stringify(away));
    ok('and never under the other key\'s balance, nor wiping the amount typed for it', !/added|gatekey/.test(away.here) && away.amt === '0.7', JSON.stringify(away));
    await page.click('#vc-top-away button.wl-act');
    await page.waitForFunction(() => document.getElementById('vc-panel').style.display === 'block' && document.getElementById('vc-a-memo').textContent === 'gatekey', null, { timeout: 10000 }).catch(() => {});
    ok('its one next step reads the balance of the key it credited', await page.textContent('#vc-a-memo') === 'gatekey' && !(await page.evaluate(() => document.getElementById('vc-top-away').getClientRects().length)), await page.textContent('#vc-a-memo'));
    // the question names the account it sends from; connecting another name closes it and nothing is sent
    await page.fill('#vc-top-amt', '0.25'); await page.click('#vc-top-go');
    ok('the question names the account it sends from', /^send 0\.2500 A from kingbeelovis to bnrvoucher11 with the memo gatekey\?/.test(await topText()), await topText());
    await page.evaluate(() => { window.__yes = [...document.querySelectorAll('#vc-top-stat button.wl-act')].find(b => b.textContent === 'yes, send it'); });
    await page.evaluate(() => { document.getElementById('wq').value = 'bobsoul'; document.getElementById('wgo').click(); });
    const swapped = await page.evaluate(() => ({ t: document.getElementById('vc-top-stat').innerText.trim(), btns: document.querySelectorAll('#vc-top-stat button').length }));
    ok('connecting another name closes the question: nothing is sent, said calmly with what to do', swapped.t === 'you connected another name, so nothing was sent. press top up from my wallet again.' && swapped.btns === 0 && nPosts() === 1, JSON.stringify(swapped));
    await page.evaluate(() => window.__yes.click());
    await page.waitForTimeout(1500);
    ok('a yes left over from the old question signs nothing', nPosts() === 1 && /^you connected another name/.test(await topText()), await topText());
    await page.waitForFunction(() => /bobsoul · ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.click('#vc-top-go');
    ok('asked again, the question names the account now connected', /^send 0\.2500 A from bobsoul to bnrvoucher11 with the memo gatekey\?/.test(await topText()), await topText());
    await pressYes();
    await page.waitForFunction(() => /^added 0\.2500 A to the voucher for gatekey/.test(document.getElementById('vc-top-stat').innerText.trim()), null, { timeout: 30000 }).catch(() => {});
    ok('and yes signs exactly that: one transfer from bobsoul to the voucher account', nPosts() === 2 && state.posts[1].includes(actHex('core.vaulta', 'transfer')) && state.posts[1].includes(nameHex('bobsoul') + nameHex('bnrvoucher11')), await topText());
    // yes runs the signing check again: a key that left the account since the question signs nothing
    await page.fill('#vc-top-amt', '0.25'); await page.click('#vc-top-go');
    state.keys.bobsoul = [STRANGER_KEY];
    await connectAs('bobsoul', 'let this wallet sign for it');
    ok('the question stays open while the same name is read again', /^send 0\.2500 A from bobsoul/.test(await topText()), await topText());
    await pressYes();
    await page.waitForTimeout(300);
    ok('yes checks again that this wallet signs for the account, and signs nothing when it does not', /^this wallet does not sign for bobsoul yet/.test(await topText()) && nPosts() === 2, await topText());
    // another name connected while the transfer is made ready (a slow host) signs nothing
    state.keys.bobsoul = [await k1Of(page, 'vaulta:bobsoul')];
    await connectAs('bobsoul', 'bobsoul · ready to sign');
    await page.click('#vc-top-go');
    state.abiDelay = 1500;
    await pressYes();
    await page.evaluate(() => { document.getElementById('wq').value = 'king'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => /changed since you were asked/.test(document.getElementById('vc-top-stat').innerText), null, { timeout: 10000 }).catch(() => {});
    state.abiDelay = 0;
    ok('another name connected while the transfer is made ready signs nothing, and offers to ask again', /^the account to send from changed since you were asked, so nothing was signed\./.test(await topText()) && (await page.textContent('#vc-top-stat button.wl-act')) === 'ask me again' && nPosts() === 2, await topText());
    // a keychain closed since the question signs nothing
    await page.waitForFunction(() => /kingbeelovis · ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.click('#vc-top-go');
    await page.evaluate(() => document.getElementById('kc-out').click());
    await pressYes();
    ok('a keychain closed since the question signs nothing, and the line names the one step', await topText() === 'connect your keychain to top up from this wallet. nothing was sent.' && nPosts() === 2, await topText());
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* M · a link's arguments land in the composer preview as text: a hostile one never runs */
  for (const reg of ['bee', 'cypherpunk']) {
    console.log(`M · a hostile compose link, ${reg}:`);
    const { ctx } = await context(browser, reg);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const hostile = { owner: EVIL, domain_name: '<svg onload=window.__xss=2>', days: 365 };
    await page.goto(`${ORIGIN}/surfaces/wallet.html?compose=${encodeURIComponent('kingbeelovis:renew')}&args=${encodeURIComponent(JSON.stringify(hostile))}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('tx-preview').style.display === 'block', null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({ xss: window.__xss, shown: document.getElementById('tx-preview').style.display, text: document.getElementById('tx-preview-body').textContent, tags: document.querySelectorAll('#tx-preview-body img, #tx-preview-body svg').length }));
    ok('the link\'s arguments are shown as text and nothing in them runs', r.shown === 'block' && r.xss === undefined && r.tags === 0 && /<img src=x/.test(r.text), JSON.stringify(r).slice(0, 200));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* M · at a glance tells the truth about its reads, and the name can be changed */
  {
    console.log('M · the glance and the name:');
    const { ctx, state } = await context(browser, 'bee');
    state.regDown = true;
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => /could not check which account king\.b points to/.test(document.getElementById('wstat').textContent), null, { timeout: 20000 });
    let g = await page.evaluate(() => ({ wstat: document.getElementById('wstat').innerText, btn: !!document.querySelector('#wstat button.wl-act'), vbal: document.getElementById('v-bal').textContent.trim(),
      bee: document.querySelector('#wl-bee .wlb-fig').textContent.trim(), beeSays: document.querySelector('#wl-bee .wlb-stat').innerText }));
    ok('the registry unread on a first visit: the bare name "king" (a stranger\'s) is never read, and no balance is shown', !(state.reads || []).includes('king') && g.vbal === '' && g.bee === '', JSON.stringify({ reads: state.reads, g }));
    ok('the glance says why in one sentence and offers try again, never "balances live"', g.btn && !/balances live|✓/.test(g.wstat) && /no balance is shown yet/.test(g.wstat) && /could not check/.test(g.beeSays), JSON.stringify(g));
    state.regDown = false;
    await page.click('#wl-bee [data-wl-go="have"]'); await page.waitForTimeout(300);
    await page.click('#wstat button.wl-act');
    await page.waitForFunction(() => /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    await page.waitForFunction(() => /read just now/.test(document.getElementById('wstat').textContent), null, { timeout: 20000 });
    g = await page.evaluate(() => ({ wstat: document.getElementById('wstat').innerText, link: !!document.querySelector('#wstat a[href="#bal-sec"]'), vbal: document.getElementById('v-bal').textContent.trim() }));
    ok('try again reads where king.b points, then its own account, and says the coins were read', g.vbal === '5.0000 A' && g.link && /^king\.b is connected and its coins were read just now\./.test(g.wstat) && !(state.reads || []).includes('king'), JSON.stringify({ g, reads: state.reads }));
    // a read that fails is said as failed, with try again
    state.aDown = true;
    await page.evaluate(() => { document.getElementById('wq').value = ''; });
    await page.click('#wl-rename');
    g = await page.evaluate(() => ({ field: document.querySelector('.wl-connect-cta').getClientRects().length > 0, focus: document.activeElement && document.activeElement.id, val: document.getElementById('wq').value }));
    ok('"not you? change the name" brings the name field back, holding the name, ready to replace', g.field && g.focus === 'wq' && g.val === 'king', JSON.stringify(g));
    await page.fill('#wq', 'oliver'); await page.click('#wgo');
    await page.waitForFunction(() => /oliver\.b is connected, but its Vaulta coins could not be read just now/.test(document.getElementById('wstat').textContent), null, { timeout: 20000 });
    g = await page.evaluate(() => ({ btn: !!document.querySelector('#wstat button.wl-act'), live: /balances live/.test(document.getElementById('wstat').innerText), field: document.querySelector('.wl-connect-cta').getClientRects().length > 0,
      rows: [...document.querySelectorAll('#bal-sec [data-vaulta-rows] .va-rollup-row small')].map(e => e.textContent) }));
    ok('a failed read never says "balances live": it names what was not read and offers try again', g.btn && !g.live, JSON.stringify(g));
    ok('connecting the new name closes the field again', !g.field, JSON.stringify(g));
    ok('the earlier name\'s Vaulta figure leaves with it (the total never sums a name you left)', g.rows.length === 0, JSON.stringify(g.rows));
    // the bee card's stale line carries the read's own try again, and pressing it reads again
    await page.evaluate(() => { const v = document.getElementById('v-bal'); v.textContent = '5.0000 A'; });
    await page.click('#wl-bar [data-wl-go="home"]'); await page.waitForTimeout(300);
    g = await page.evaluate(() => { const b = document.querySelector('#wl-bee .wlb-stale [data-wl-retry]'); return { shown: !!b && b.getClientRects().length > 0, said: document.querySelector('#wl-bee .wlb-stale').innerText }; });
    ok('a figure whose last read failed says so and offers try again right there', g.shown && /out of date/.test(g.said), JSON.stringify(g));
    state.aDown = false;
    const before = (state.reads || []).length;
    await page.click('#wl-bee .wlb-stale [data-wl-retry]');
    await page.waitForFunction(() => /read just now|✓ live/.test(document.getElementById('v-stat').textContent), null, { timeout: 20000 }).catch(() => {});
    ok('try again beside the figure presses the read\'s own try again (one more read, now live)', (state.reads || []).length > before && /live/.test(await page.textContent('#v-stat')), (state.reads || []).length + ' reads, v-stat ' + await page.textContent('#v-stat'));
    // a misspelt name is said calmly and is not kept
    await page.click('#wl-bee [data-wl-go="have"]'); await page.waitForTimeout(300);
    await page.click('#wl-rename');
    await page.fill('#wq', 'hello world'); await page.click('#wgo');
    g = await page.evaluate(() => ({ wstat: document.getElementById('wstat').innerText, soul: localStorage.getItem('bnr_soul'), field: document.querySelector('.wl-connect-cta').getClientRects().length > 0 }));
    ok('text that cannot be a name is refused in one sentence, the field stays, and the name is not kept', /does not look like a name/.test(g.wstat) && g.soul === 'oliver' && g.field, JSON.stringify(g));
    // a plain account (no current row) is said as itself, never with ".b"
    await page.fill('#wq', 'bobaccount11'); await page.click('#wgo');
    await page.waitForFunction(() => /bobaccount11/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    g = await page.evaluate(() => ({ soul: document.getElementById('sum-soul').textContent.trim(), live: document.getElementById('wl-soul-name').textContent, wstat: document.getElementById('wstat').innerText }));
    ok('a plain Vaulta account is named as itself, never as a .b name nobody may own', g.soul === 'bobaccount11' && g.live === 'bobaccount11' && !/bobaccount11\.b/.test(g.wstat), JSON.stringify(g));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* N · keychain first, name second: the Vaulta key is derived and checked */
  {
    console.log('N · keychain before the name:');
    const { ctx, state } = await context(browser, 'bee', { soul: null });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY, null, { timeout: 20000 });
    await recoveryConnect(page);
    await page.click('#wl-bee [data-wl-go="have"]'); await page.waitForTimeout(300);
    await page.fill('#wq', 'bobaccount11'); await page.click('#wgo');
    const signLine = () => page.waitForFunction(() => /let this wallet sign for it/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    await signLine(); await page.waitForTimeout(1500); await signLine();
    const k1 = (await page.textContent('#kc-k1-pub')).trim(), acctKey = await k1Of(page, 'vaulta:bobaccount11');
    ok('a plain account connected after the keychain derives its Vaulta key and checks it (no "connect your keychain")', k1 === acctKey && (await page.textContent('#sum-bridge')).trim() === 'bobaccount11 · let this wallet sign for it', JSON.stringify({ k1, acctKey, bridge: await page.textContent('#sum-bridge') }));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* P · the receive card while the pointer and the account are read: reading is never said as failed, an
     account a node says does not exist is said as that (never a try again that cannot work), and a key placed
     for the bridge never waits in a field nobody can see or press */
  {
    console.log('P · reading, no such account, and the bridge field:');
    const { ctx, state } = await context(browser, 'bee');
    state.slowRows = 2500;   // the first pointer read is still out when the card is drawn
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRPAY, null, { timeout: 20000 });
    const openRx = () => page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-rx').click(); });
    const vcard = () => page.evaluate(() => { const c = [...document.getElementById('rx-cards').children].find(x => /Vaulta/.test(x.textContent)); const say = c && c.querySelector('.rx-say');
      return c ? { t: say ? say.innerText.trim() : '', btn: ((c.querySelector('button.wl-act') || {}).textContent) || null, addr: (c.querySelector('.rx-addr') || {}).textContent || null } : null; });
    await openRx();
    let vc = await vcard();
    ok('while the first pointer read is out, the card says it is reading, never that the read failed', !!vc && vc.t === 'reading your Vaulta account, one moment.' && !vc.btn && vc.addr === null, JSON.stringify(vc));
    state.slowRows = 0;
    await page.waitForFunction(() => /once your keychain is connected/.test(document.getElementById('rx-cards').innerText), null, { timeout: 15000 }).catch(() => {});
    vc = await vcard();
    ok('once it answers, the card follows without a press', !!vc && /^your Vaulta address shows here once your keychain is connected\.( connect your keychain)?$/.test(vc.t), JSON.stringify(vc));
    // a registry that does not answer is said as that, and its try again works
    state.regDown = true;
    await page.evaluate(() => localStorage.removeItem('bnr_vacct'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRPAY, null, { timeout: 20000 });
    await page.waitForFunction(() => /could not check which account king\.b points to/.test(document.getElementById('wstat').textContent), null, { timeout: 20000 }).catch(() => {});
    await openRx();
    vc = await vcard();
    ok('a registry read that failed is said as failed, with try again', !!vc && /^we could not read your Vaulta account just now, so no address is shown\. try again$/.test(vc.t) && vc.btn === 'try again', JSON.stringify(vc));
    state.regDown = false;
    await page.evaluate(() => [...document.getElementById('rx-cards').children].find(x => /Vaulta/.test(x.textContent)).querySelector('button.wl-act').click());
    await page.waitForFunction(() => /once your keychain is connected/.test(document.getElementById('rx-cards').innerText), null, { timeout: 15000 }).catch(() => {});
    vc = await vcard();
    ok('and try again reads it, and the card follows', !!vc && /^your Vaulta address shows here once your keychain is connected/.test(vc.t), JSON.stringify(vc));
    // a name with no row whose account a node says does not exist
    await page.evaluate(() => { localStorage.setItem('bnr_soul', 'newacctnamez'); localStorage.removeItem('bnr_vacct'); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY, null, { timeout: 20000 });
    await recoveryConnect(page);
    await page.waitForFunction(() => /is not a Vaulta account yet/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    const na = await page.evaluate(() => ({ sum: document.getElementById('sum-bridge').textContent.trim(), sumLink: !!document.querySelector('#sum-bridge a[href="#connect-sec"]'),
      verdict: document.getElementById('kc-bridge-verdict').textContent, card: window.BNRPAY.railAddresses(null, 'newacctnamez')[0] }));
    ok('at a glance says the account does not exist, with its one link, never "could not read"', na.sum === 'newacctnamez is not a Vaulta account yet, so this wallet cannot sign for it. choose the account' && na.sumLink, JSON.stringify(na));
    ok('the keychain\'s verdict says the same', /^newacctnamez is not a Vaulta account yet\. choose the account/.test(na.verdict), na.verdict);
    ok('the receive card says no Vaulta account, never a try again that cannot work', na.card.v === null && na.card.why === 'vacct-noacct', JSON.stringify(na.card));
    await openRx();
    vc = await vcard();
    ok('and the open card says it in one sentence with its one link', !!vc && /^newacctnamez is not a Vaulta account yet, so there is no Vaulta address to share\. choose the account$/.test(vc.t) && !vc.btn, JSON.stringify(vc));
    const p0 = (state.posts || []).length;
    await page.evaluate(() => { document.getElementById('pay-tx').click(); document.getElementById('tx-tab-v').click();
      document.getElementById('sv-to').value = 'someoneelse1'; document.getElementById('sv-amt').value = '0.1'; document.getElementById('sv-go').click(); });
    await page.waitForFunction(() => /nothing was signed/.test(document.getElementById('sv-stat').innerText), null, { timeout: 15000 }).catch(() => {});
    ok('a send from it is refused in the same words, and nothing is signed', /^newacctnamez is not a Vaulta account yet, so nothing was signed\./.test((await page.innerText('#sv-stat')).trim()) && (state.posts || []).length === p0, await page.innerText('#sv-stat'));
    // a read that gets no answer at all keeps its try again, and the try again can succeed
    state.acctDown = true;
    await page.evaluate(() => { document.getElementById('wq').value = 'someoneelse1'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => /could not read someoneelse1/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    await openRx();
    vc = await vcard();
    ok('an account read that got no answer says so on the card, with try again', !!vc && /^we could not check someoneelse1 just now, so no Vaulta address is shown\. try again$/.test(vc.t) && vc.btn === 'try again', JSON.stringify(vc));
    state.acctDown = false;
    await page.evaluate(() => [...document.getElementById('rx-cards').children].find(x => /Vaulta/.test(x.textContent)).querySelector('button.wl-act').click());
    await page.waitForFunction(() => /once this wallet can sign for someoneelse1/.test(document.getElementById('rx-cards').innerText), null, { timeout: 15000 }).catch(() => {});
    vc = await vcard();
    ok('and its try again reads the account, and the card follows', !!vc && /^your Vaulta address shows here once this wallet can sign for someoneelse1\./.test(vc.t), JSON.stringify(vc));
    // a key placed in the bridge's field (as the vault places it) goes when the bridge hides
    await page.waitForFunction(() => document.getElementById('bridge-sec').style.display === 'block' && !!document.getElementById('br-paste'), null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(w => { document.getElementById('br-paste').value = w; }, DEV_WIF);
    state.acctDown = true;
    await page.evaluate(() => { document.getElementById('wq').value = 'someoneelse1'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => /could not read someoneelse1/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    let fld = await page.evaluate(() => ({ shown: document.getElementById('bridge-sec').style.display !== 'none', v: (document.getElementById('br-paste') || {}).value || '' }));
    ok('when the bridge hides (its account unread), a key placed in its field goes with it', !fld.shown && fld.v === '', JSON.stringify({ shown: fld.shown, held: fld.v.length }));
    state.acctDown = false;
    await page.evaluate(() => document.querySelector('#sum-bridge button').click());
    await page.waitForFunction(() => document.getElementById('bridge-sec').style.display === 'block' && !!document.getElementById('br-paste'), null, { timeout: 15000 }).catch(() => {});
    fld = await page.evaluate(() => ({ shown: document.getElementById('bridge-sec').style.display !== 'none', v: (document.getElementById('br-paste') || {}).value || '' }));
    ok('and the bridge comes back with an empty field', fld.shown && fld.v === '', JSON.stringify({ shown: fld.shown, held: fld.v.length }));
    // a key placed for one account is never carried to another account's field
    await page.evaluate(w => { document.getElementById('br-paste').value = w; }, DEV_WIF);
    await page.evaluate(() => { document.getElementById('wq').value = 'king'; document.getElementById('wgo').click(); });
    await page.waitForFunction(() => { const f = document.getElementById('br-paste'); return f && /kingbeelovis/.test(f.placeholder); }, null, { timeout: 20000 }).catch(() => {});
    fld = await page.evaluate(() => { const f = document.getElementById('br-paste'); return { ph: f ? f.placeholder : null, v: f ? f.value : '' }; });
    ok('a key placed for someoneelse1 is not carried into kingbeelovis\'s field', /kingbeelovis/.test(fld.ph || '') && fld.v === '', JSON.stringify({ ph: fld.ph, held: fld.v.length }));
    ok('no key is left in this browser\'s storage', await page.evaluate(() => !JSON.stringify(localStorage).includes('5KQwrPbw')));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\nwallet action sheet: ${pass} pass, ${fail} fail`);
if (fail) process.exit(1);
