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
        if (body.code === 'kingbeelovis' && body.table === 'domains') {
          const rows = body.lower_bound ? ROWS.filter(r => r.id === String(body.lower_bound)) : ROWS;
          return json({ rows: rows.slice(0, body.limit || 500), more: false, next_key: '' });
        }
        if (body.table === 'config') return json({ rows: [{ admin: 'kingbeelovis', registration_fee: '0.0000 EOS', registration_days: 365 }], more: false });
        return json({ rows: [{ base: { balance: '100000000000 RAM' }, quote: { balance: '1000000.0000 A' } }], more: false });
      }
      if (u.pathname.endsWith('/get_account')) {
        const a = body.account_name, keys = (state.keys[a] || [STRANGER_KEY]).map(key => ({ key, weight: 1 }));
        return json({ account_name: a, core_liquid_balance: '5.0000 A', ram_quota: 8192, ram_usage: 3000, cpu_limit: { used: 0, available: 1000, max: 1000 }, net_limit: { used: 0, available: 1000, max: 1000 },
          permissions: [{ perm_name: 'active', parent: 'owner', required_auth: { threshold: 1, keys, accounts: [], waits: [] } }] });
      }
      if (u.pathname.endsWith('/get_abi')) return json(ABI);
      if (u.pathname.endsWith('/get_info')) return json({ chain_id: MAIN_CHAIN, head_block_num: state.head });
      if (u.pathname.endsWith('/get_block')) {
        const num = body.block_num_or_id;
        if (num === 123453) return json({ ref_block_prefix: 987654321, timestamp: '2026-10-05T00:00:00.000' });
        return json({ id: 'MOCKBLOCK' + num, block_num: num, transactions: [...state.byPacked.values()].map(id => ({ id, status: 'executed' })) });
      }
      if (u.pathname.endsWith('/send_transaction')) {
        if (!body.packed_trx || !body.signatures || !body.signatures.length) return json({ error: { details: [{ message: 'malformed' }] } }, 400);
        state.submits++;
        let id = state.byPacked.get(body.packed_trx);
        if (!id) { id = 'MOCKTXID' + body.packed_trx.slice(0, 16); state.byPacked.set(body.packed_trx, id); state.head = 123499; }
        return json({ transaction_id: id, processed: { block_num: 123460, status: 'executed' } });
      }
      return json({});
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
    state: document.getElementById('act-stat').getAttribute('data-state'), buttons: d.querySelectorAll('button').length, goHidden: document.getElementById('act-go').hidden,
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
    ok('a link with no live intent shows the words and waits: no passkey, no send', s && s.h === 'Renew king.b' && s.say === 'Renew king.b for 365 days. Signed as kingbeelovis.' && s.cred === 0 && state.submits === 0 && s.buttons === 1, JSON.stringify(s));
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
    ok('signing as the stranger "king" is refused before any passkey prompt', s.stat === 'This is for king, and your wallet signs for kingbeelovis. Nothing was signed.' && s.cred === 0 && state.submits === 0, JSON.stringify(s));
    ok('no page errors in the wallet', errors.length === 0, errors.join(' | '));
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
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    ok('a bare account that carries this wallet\'s key stays itself, whatever a row says', (await page.textContent('#sum-bridge')).trim() === 'alicevaulta1 · ready to sign ✓', await page.textContent('#sum-bridge'));
    const rx = await page.evaluate(() => window.BNRPAY.railAddresses(null, 'alicevaulta1')[0]);
    ok('and it receives at itself, never at the hostile row\'s account', rx.v === 'alicevaulta1' && !/attacker/.test(JSON.stringify(rx)), JSON.stringify(rx));
    ok('the proof is kept, so the row cannot redirect it on the next visit', await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_vacct')).proven === true));
    await page.evaluate(() => { localStorage.setItem('bnr_soul', 'gonesoul'); localStorage.removeItem('bnr_vacct'); });
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRPAY && /gonesoul/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
    ok('a lapsed row is not followed', await page.evaluate(() => JSON.parse(localStorage.getItem('bnr_vacct') || '{}').state) === 'self' && !/attacker/.test(await page.textContent('#sum-soul')), await page.textContent('#sum-soul'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\nwallet action sheet: ${pass} pass, ${fail} fail`);
if (fail) process.exit(1);
