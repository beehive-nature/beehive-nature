// wallet-bridge-acct.mjs — the bridge's one paste and the account forge say what is true.
// The paste lane signs once and never twice: a lost answer is unknown and its one action
// reads the account; a duplicate answer means the bytes went in; a refusal is said in words.
// Both paste fields are empty the moment the button is pressed. The forge's line says the
// price of a new account and what you have, never a figure from another account, and a
// name is read before anything is signed. Source files are served in-memory at the
// production origin; every chain read is a mock behind one RegExp; nothing reaches a live
// network. Run: node e2e/wallet-bridge-acct.mjs
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://skaists.dev';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const MAIN_CHAIN = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
const RPC_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com)(\/|$)/;
const STRANGER_KEY = 'EOS7g7tqRsKpAh2ZDtyqzmjWVkrcdGHGx16D1xeWBZcxQbaqfvBGq'; // PUBLIC-CONSTANT: test fixture public key
const DEV_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // TESTNET-ONLY: eosio's documented dev key, chain-significant nowhere
const DEV_PUB = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'; // PUBLIC-CONSTANT: the dev key's public half
const EOSIO_ABI = { account_name: 'eosio', abi: { version: 'eosio::abi/1.2', actions: [{ name: 'updateauth', type: 'updateauth' }, { name: 'newaccount', type: 'newaccount' }], types: [],
  structs: [
    { name: 'permission_level', fields: [{ name: 'actor', type: 'name' }, { name: 'permission', type: 'name' }] },
    { name: 'key_weight', fields: [{ name: 'key', type: 'public_key' }, { name: 'weight', type: 'uint16' }] },
    { name: 'permission_level_weight', fields: [{ name: 'permission', type: 'permission_level' }, { name: 'weight', type: 'uint16' }] },
    { name: 'wait_weight', fields: [{ name: 'wait_sec', type: 'uint32' }, { name: 'weight', type: 'uint16' }] },
    { name: 'authority', fields: [{ name: 'threshold', type: 'uint32' }, { name: 'keys', type: 'key_weight[]' }, { name: 'accounts', type: 'permission_level_weight[]' }, { name: 'waits', type: 'wait_weight[]' }] },
    { name: 'updateauth', fields: [{ name: 'account', type: 'name' }, { name: 'permission', type: 'name' }, { name: 'parent', type: 'name' }, { name: 'auth', type: 'authority' }] },
    { name: 'newaccount', fields: [{ name: 'creator', type: 'name' }, { name: 'name', type: 'name' }, { name: 'owner', type: 'authority' }, { name: 'active', type: 'authority' }] }] } };
const CORE_VAULTA_ABI = { account_name: 'core.vaulta', abi: { version: 'eosio::abi/1.2', types: [],
  actions: [{ name: 'transfer', type: 'transfer' }, { name: 'buyrambytes', type: 'buyrambytes' }],
  structs: [
    { name: 'transfer', fields: [{ name: 'from', type: 'name' }, { name: 'to', type: 'name' }, { name: 'quantity', type: 'asset' }, { name: 'memo', type: 'string' }] },
    { name: 'buyrambytes', fields: [{ name: 'payer', type: 'name' }, { name: 'receiver', type: 'name' }, { name: 'bytes', type: 'uint32' }] }] } };
const fnv = s => { let h = 0xcbf29ce484222325n; for (const b of Buffer.from(s, 'utf8')) { h ^= BigInt(b); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(); };
const row = (n, owner) => ({ id: fnv(n), domain_name: n, owner, account: owner, registered: '2026-08-01T01:37:15', expires: '2027-08-01T01:37:15' });
const ROWS = [row('king', 'kingbeelovis')];

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 240) : ''}`); }
};

async function context(browser, reg, { soul = 'king', width = 390 } = {}) {
  const state = { keys: {}, posts: [], head: 123456 };
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([r, s]) => {
    try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('bregister', r); if (s) localStorage.setItem('bnr_soul', s); sessionStorage.setItem('__seeded', '1'); } } catch (e) {}
    const deny = async () => { throw new DOMException('NotAllowedError: the test refuses every passkey', 'NotAllowedError'); };
    if (navigator.credentials) { navigator.credentials.get = deny; navigator.credentials.create = deny; }
  }, [reg, soul]);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  await ctx.route('**/*', async route => {
    const url = route.request().url(), u = new URL(url);
    if (RPC_RE.test(url)) {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const json = (o, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
      const body = JSON.parse(route.request().postData() || '{}');
      if (u.pathname.endsWith('/get_table_rows')) {
        if (state.rowsDelay && body.table === 'domains') await new Promise(r => setTimeout(r, state.rowsDelay));
        if (body.code === 'kingbeelovis' && body.table === 'domains') {
          const rows = body.lower_bound ? ROWS.filter(r => r.id === String(body.lower_bound)) : ROWS;
          return json({ rows: rows.slice(0, body.limit || 500), more: false, next_key: '' });
        }
        return json({ rows: [{ base: { balance: '100000000000 RAM' }, quote: { balance: '1000000.0000 A' } }], more: false });
      }
      if (u.pathname.endsWith('/get_account')) {
        const a = body.account_name;
        if (state.acctDelay && state.acctDelay[a]) await new Promise(r => setTimeout(r, state.acctDelay[a]));
        // an account that does not exist: nodes answer 500 "unknown key"
        if (/^(newacct|freename)/.test(a) && !state.keys[a]) return json({ code: 500, message: 'Internal Service Error', error: { code: 0, name: 'exception', what: 'unspecified', details: [{ message: 'unknown key (boost::tuples::tuple<bool, eosio::chain::name>): (0 ' + a + ')' }] } }, 500);
        const keys = (state.keys[a] || [STRANGER_KEY]).map(key => ({ key, weight: 1 }));
        return json({ account_name: a, core_liquid_balance: '0.0000 EOS', ram_quota: 8192, ram_usage: 3000, cpu_limit: { used: 0, available: 1000, max: 1000 }, net_limit: { used: 0, available: 1000, max: 1000 },
          permissions: [{ perm_name: 'active', parent: 'owner', required_auth: { threshold: (state.threshold && state.threshold[a]) || 1, keys, accounts: [], waits: [] } }] });
      }
      if (u.pathname.endsWith('/get_currency_balance')) {
        if (state.aDown) return json({ code: 500, error: { what: 'the test drops this read' } }, 500);
        return json(body.code === 'core.vaulta' && body.symbol === 'A' ? [state.aBal || '5.0000 A'] : []);
      }
      if (u.pathname.endsWith('/get_abi')) return json(body.account_name === 'eosio' ? EOSIO_ABI : CORE_VAULTA_ABI);
      if (u.pathname.endsWith('/get_info')) return json({ chain_id: MAIN_CHAIN, head_block_num: state.head });
      if (u.pathname.endsWith('/get_block')) return json({ id: 'MOCKBLOCK' + body.block_num_or_id, block_num: body.block_num_or_id, ref_block_prefix: 987654321, timestamp: '2026-10-05T00:00:00.000', transactions: [] });
      if (u.pathname.endsWith('/send_transaction')) {
        state.posts.push(body.packed_trx);
        if (state.abortN > 0) { state.abortN--; if (state.applyLost && state.onSend) state.onSend(body); return route.abort(); }   // the node took it; the answer is lost
        if (state.dupOnce) { state.dupOnce = false; return json({ code: 409, error: { name: 'tx_duplicate', what: 'Duplicate transaction', details: [{ message: 'duplicate transaction ' + body.packed_trx.slice(0, 16) }] } }, 409); }
        if (state.refuseWith) return json({ code: 500, error: { name: 'unsatisfied_authorization', what: 'Transaction declares authority', details: [{ message: state.refuseWith }] } }, 500);
        if (state.onSend) state.onSend(body);
        return json({ transaction_id: 'MOCKTXID' + body.packed_trx.slice(0, 16), processed: { block_num: 123460, status: 'executed' } });
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
const open = async (browser, reg, opts) => {
  const { ctx, state } = await context(browser, reg, opts);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BZDIDKEY && /kingbeelovis/.test(document.getElementById('sum-soul').textContent), null, { timeout: 20000 });
  return { ctx, state, page, errors };
};
const toKey = page => page.evaluate(() => { const b = document.querySelector('[data-wl-go="key"]'); if (b) b.click(); });
const waitIn = (page, id, re, timeout = 40000) => page.waitForFunction(([i, r]) => { const e = document.getElementById(i); return !!e && new RegExp(r).test(e.textContent); }, [id, re.source], { timeout })
  .catch(async () => console.log('  (waited for ' + re + ' in #' + id + ', it reads: ' + JSON.stringify(await page.evaluate(i => { const e = document.getElementById(i); return e && e.textContent; }, id)) + ')'));
const stat = page => page.evaluate(() => { const e = document.getElementById('br-paste-stat'); return e ? { text: e.innerText, all: e.textContent, btn: (e.querySelector('button.wl-act') || {}).textContent || null } : null; });

const browser = await chromium.launch();
try {
  /* P · one paste: a lost answer is unknown, check again reads and never signs */
  {
    console.log('P · one paste, a lost answer (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [DEV_PUB];
    await recoveryConnect(page);
    await page.waitForFunction(() => /let this wallet sign for it/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await toKey(page);
    await page.waitForFunction(() => !!document.getElementById('br-paste') && document.getElementById('bridge-sec').style.display === 'block', null, { timeout: 15000 });
    const k1 = (await page.textContent('#kc-k1-pub')).trim();
    const head = await page.evaluate(() => ({ h: document.querySelector('#bridge-sec h2').innerText.trim(), say: document.querySelector('#br-calm > div').innerText.trim(), go: document.getElementById('br-paste-go').textContent }));
    ok('the bridge is named by what it does, in one lower case sentence and its one button', head.h === '🌉 let this wallet sign for your account' && /^this wallet does not sign for kingbeelovis yet, so paste its active key once and every sign after is one press\./.test(head.say) && head.go === 'add this wallet', JSON.stringify(head));
    await waitIn(page, 'ac-stat', /let it sign/, 15000);
    const unb = await page.evaluate(() => ({ t: document.getElementById('ac-stat').innerText.trim(), a: !!document.querySelector('#ac-stat a[href="#bridge-sec"]') }));
    ok('the forge says its price and the one step before it can make anything: let it sign', /^a new account costs about 0\.0823 A of your 5\.0000 A\. this wallet does not sign for kingbeelovis yet, so let it sign first\.$/.test(unb.t) && unb.a, JSON.stringify(unb));
    const hidden = await page.evaluate(() => ({ stat: document.getElementById('br-stat').getClientRects().length, out: document.getElementById('br-out').getClientRects().length, btn: document.getElementById('br-go').getClientRects().length }));
    ok('bee never sees the scaffold lane: no step line, no receipt, no shouting button', hidden.stat === 0 && hidden.out === 0 && hidden.btn === 0, JSON.stringify(hidden));
    const law = await page.evaluate(() => [...document.querySelectorAll('#bridge-sec [data-wl-tech]')].map(e => e.textContent).join(' '));
    ok('the bridge\'s details promise only what this lane does', /wiped from the page right after/.test(law) && !/never pastes|New-bee|threshold 1|scrubbed the moment|[—–]/.test(law), law);
    ok('the bridge sentence promises the key is wiped, not "never kept"', /wiped from the page right after/.test(await page.textContent('#br-calm')) && !/never kept/.test(await page.textContent('#br-calm')), await page.textContent('#br-calm'));
    await page.evaluate(() => document.getElementById('br-paste-go').click());
    await waitIn(page, 'br-paste-stat', /active key here first/, 10000);
    ok('an empty press asks for the one paste, calmly, and sends nothing', /^paste kingbeelovis’s active key here first\.$/.test((await stat(page)).text.trim()) && state.posts.length === 0, JSON.stringify(await stat(page)));
    await page.fill('#br-paste', 'not-a-key!');
    await page.evaluate(() => document.getElementById('br-paste-go').click());
    await waitIn(page, 'br-paste-stat', /not a whole private key/, 10000);
    const bad = await stat(page);
    ok('a broken paste is one calm sentence; the parser\'s reason is kept for cypherpunk', /^that is not a whole private key, so nothing was sent\. copy kingbeelovis’s active key again and paste it here\.$/.test(bad.text.trim()) && !/WIF|eosjs|[—–]/.test(bad.text) && /characters a private key never has/.test(bad.all) && state.posts.length === 0, JSON.stringify(bad));
    ok('and the broken paste is gone from the field', await page.inputValue('#br-paste') === '');
    // the vault's handoff fills both fields; both hosts lose the answer; the account has not changed
    state.abortN = 2;
    await page.evaluate(w => { document.getElementById('br-paste').value = w; document.getElementById('br-wif').value = w; }, DEV_WIF);
    await page.evaluate(() => document.getElementById('br-paste-go').click());
    await waitIn(page, 'br-paste-stat', /adding this wallet to kingbeelovis/, 10000);
    const flight = await page.evaluate(() => ({ paste: document.getElementById('br-paste').value, wif: document.getElementById('br-wif').value, off: document.getElementById('br-paste').disabled && document.getElementById('br-paste-go').disabled }));
    ok('pressed: both paste fields are already empty, and the field and button stay off while it runs', flight.paste === '' && flight.wif === '' && flight.off, JSON.stringify(flight));
    await waitIn(page, 'br-paste-stat', /cannot tell yet/);
    const lost = await stat(page);
    ok('a lost answer is said as unknown, never as "the chain said no"', /^the network did not answer, so this wallet cannot tell yet whether kingbeelovis changed\. check it before you paste again\./.test(lost.text.trim()) && !/said no|nothing changed/.test(lost.text), JSON.stringify(lost));
    ok('its one action reads the account; the paste field waits', lost.btn === 'check again' && await page.evaluate(() => document.getElementById('br-paste').disabled && document.getElementById('br-paste-go').disabled), JSON.stringify(lost));
    ok('one signature: the same bytes went to each host, nothing was signed twice', state.posts.length === 2 && state.posts[0] === state.posts[1], String(state.posts.length));
    ok('the bridge stays on screen with its words', await page.evaluate(() => document.getElementById('bridge-sec').style.display === 'block'));
    await page.evaluate(() => document.querySelector('#br-paste-stat button.wl-act').click());
    await waitIn(page, 'br-paste-stat', /may still go in/);
    const still = await stat(page);
    ok('check again reads and never signs: inside its window it may still go in', /^kingbeelovis does not show this wallet yet, and the last paste may still go in\./.test(still.text.trim()) && still.btn === 'check again' && state.posts.length === 2, JSON.stringify(still));
    state.keys.kingbeelovis = [DEV_PUB, k1];   // the chain applied it after all
    await page.evaluate(() => document.querySelector('#br-paste-stat button.wl-act').click());
    await waitIn(page, 'br-calm', /^done\./);
    const done = await page.evaluate(() => ({ t: document.getElementById('br-calm').innerText.trim(), link: !!document.querySelector('#br-calm a[href="#bal-sec"]'), shown: document.getElementById('bridge-sec').style.display }));
    ok('once the account carries the key it is done, said where the reader pressed, with its one link', /^done\. this wallet now signs for kingbeelovis with one press\. see what you have$/.test(done.t) && done.link && done.shown === 'block' && state.posts.length === 2, JSON.stringify(done));
    ok('at a glance agrees', (await page.textContent('#sum-bridge')).trim() === 'kingbeelovis · ready to sign ✓', await page.textContent('#sum-bridge'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* P2 · a duplicate after a lost answer means the bytes went in */
  {
    console.log('P2 · one paste, a duplicate answer on failover (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [DEV_PUB];
    await recoveryConnect(page);
    await page.waitForFunction(() => /let this wallet sign for it/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    const k1 = (await page.textContent('#kc-k1-pub')).trim();
    await toKey(page);
    await page.waitForFunction(() => !!document.getElementById('br-paste'), null, { timeout: 15000 });
    state.onSend = () => { state.keys.kingbeelovis = [DEV_PUB, k1]; };
    state.abortN = 1; state.applyLost = true; state.dupOnce = true;
    await page.fill('#br-paste', DEV_WIF);
    await page.evaluate(() => document.getElementById('br-paste-go').click());
    await waitIn(page, 'br-calm', /^done\./);
    const t = (await page.innerText('#br-calm')).trim();
    ok('a duplicate answer after a lost one is read as in: done, never "the chain said no"', /^done\. this wallet now signs for kingbeelovis with one press\./.test(t) && !/said no/.test(t), t);
    ok('and nothing was signed twice: the same bytes, one per host', state.posts.length === 2 && state.posts[0] === state.posts[1], String(state.posts.length));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* P3 · a refusal is said in words, and the field comes back */
  {
    console.log('P3 · one paste, refused (raver):');
    const { ctx, state, page, errors } = await open(browser, 'raver');
    state.keys.kingbeelovis = [DEV_PUB];
    await recoveryConnect(page);
    await page.waitForFunction(() => /let this wallet sign for it/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.waitForFunction(() => !!document.getElementById('br-paste'), null, { timeout: 15000 });
    ok('raver never sees the scaffold lane\'s lines', await page.evaluate(() => document.getElementById('br-stat').getClientRects().length === 0 && document.getElementById('br-out').getClientRects().length === 0));
    state.refuseWith = 'missing authority of kingbeelovis';
    await page.evaluate(w => { document.getElementById('br-paste').value = w; document.getElementById('br-paste-go').click(); }, DEV_WIF);
    await waitIn(page, 'br-paste-stat', /did not accept/);
    const r = await page.evaluate(() => { const e = document.getElementById('br-paste-stat'); const c = e.cloneNode(true); c.querySelectorAll('.wl-cyd').forEach(x => x.remove()); return { t: c.textContent.trim(), all: e.textContent, off: document.getElementById('br-paste').disabled }; });
    ok('a refusal names the pasted key, says nothing changed, and keeps the raw answer for cypherpunk', r.t === 'kingbeelovis did not accept that key, so nothing changed.' && /missing authority/.test(r.all) && !r.off && state.posts.length === 1, JSON.stringify(r));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q · the forge: the price in the line, a name read before anything is signed */
  {
    console.log('Q · the account forge (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await toKey(page);
    await waitIn(page, 'ac-stat', /costs about/, 20000);
    const line = (await page.innerText('#ac-stat')).trim();
    ok('the forge says the price of a new account and what you have, in the line bee reads', /^a new account costs about 0\.0823 A of your 5\.0000 A\. type its name and press make this account\.$/.test(line), line);
    const forge = await page.evaluate(() => ({ go: document.getElementById('ac-go').textContent, ram: document.getElementById('ac-ram').getClientRects().length, out: document.getElementById('ac-out').closest('[data-reg]') && document.getElementById('ac-out').closest('[data-reg]').getAttribute('data-reg'), ph: document.getElementById('ac-name').placeholder, h: document.querySelector('#acct-sec h2').innerText.replace(/\s+/g, ' ').trim(), sum: document.querySelector('#acct-sec summary').textContent }));
    ok('the forge speaks bee: its button, name hint, heading and note carry no shouting, no dash, no jargon', forge.go === '🏭 make this account' && forge.ram === 0 && forge.out === 'cypherpunk' && !/[—–]/.test(forge.ph) && forge.h === '🏭 make a new Vaulta account' && /^how a new account is made: your keychain signs it/.test(forge.sum), JSON.stringify(forge));
    await page.evaluate(() => { document.getElementById('ac-name').value = 'someoneelse1'; document.getElementById('ac-go').click(); });
    await waitIn(page, 'ac-stat', /taken/, 20000);
    ok('a name someone else holds is read first and said as taken; nothing is signed', /^that name is taken, so nothing was signed\. type another name\.$/.test((await page.innerText('#ac-stat')).trim()) && state.posts.length === 0, await page.innerText('#ac-stat'));
    state.keys.mineacct1234 = [await k1Of(page, 'vaulta:mineacct1234/active')];   // a forge whose answer was lost, landed after all
    await page.evaluate(() => { document.getElementById('ac-name').value = 'mineacct1234'; document.getElementById('ac-go').click(); });
    await waitIn(page, 'ac-stat', /already yours/, 20000);
    const mine = await page.evaluate(() => ({ t: document.getElementById('ac-stat').innerText.trim(), b: (document.querySelector('#ac-stat button.wl-act') || {}).textContent }));
    ok('an account this keychain already made is said as yours, never made twice', /^mineacct1234 is already yours, so nothing was signed\./.test(mine.t) && mine.b === 'switch the wallet to mineacct1234' && state.posts.length === 0, JSON.stringify(mine));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q2 · a read that fails is said, with try again; a new account never shows the old figure */
  {
    console.log('Q2 · the forge when reads fail (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.aDown = true;
    await page.evaluate(() => { document.getElementById('wq').value = 'king'; document.getElementById('wgo').click(); });
    await toKey(page);
    await waitIn(page, 'ac-stat', /could not read the A on kingbeelovis/, 20000);
    const f = await page.evaluate(() => ({ t: document.getElementById('ac-stat').innerText.trim(), b: (document.querySelector('#ac-stat button.wl-act') || {}).textContent }));
    ok('a failed read says so in the forge\'s line, with try again', /^could not read the A on kingbeelovis just now, so the cost of a new account is not known yet\./.test(f.t) && f.b === 'try again', JSON.stringify(f));
    state.aDown = false;
    await page.evaluate(() => document.querySelector('#ac-stat button.wl-act').click());
    await waitIn(page, 'ac-stat', /costs about/, 20000);
    ok('try again reads it, and the line then says the price', /^a new account costs about 0\.0823 A of your 5\.0000 A\./.test((await page.innerText('#ac-stat')).trim()), await page.innerText('#ac-stat'));
    state.aDown = true;
    await page.evaluate(() => { document.getElementById('wq').value = 'someoneelse1'; document.getElementById('wgo').click(); });
    await waitIn(page, 'ac-stat', /could not read the A on someoneelse1/, 20000);
    const sw = (await page.innerText('#ac-stat')).trim();
    ok('another account whose read fails never shows the figure from the one before', /^could not read the A on someoneelse1 just now/.test(sw) && !/5\.0000/.test(sw), sw);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q3 · the forge checks what you have before it signs */
  {
    console.log('Q3 · the forge with too little A (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    state.aBal = '0.0100 A';
    await page.evaluate(() => document.getElementById('wgo').click());   // the account is read again: it holds less now
    await toKey(page);
    await waitIn(page, 'ac-stat', /needs about/, 20000);
    const low = await page.evaluate(() => ({ t: document.getElementById('ac-stat').innerText.trim(), a: !!document.querySelector('#ac-stat a[href="#pay-sec"]') }));
    ok('too little A is said with its price, and its one link gets A', /^a new account needs about 0\.0823 A for its room on the chain, and you have 0\.0100 A\. get A$/.test(low.t) && low.a, JSON.stringify(low));
    await page.evaluate(() => { document.getElementById('ac-name').value = 'newacctnamea'; document.getElementById('ac-go').click(); });
    await waitIn(page, 'ac-stat', /so nothing was signed/, 20000);
    ok('the press is refused before signing, never by the chain', /^a new account needs about 0\.0823 A for its room on the chain, and you have 0\.0100 A, so nothing was signed\./.test((await page.innerText('#ac-stat')).trim()) && state.posts.length === 0, await page.innerText('#ac-stat'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q4 · a press made while the account is checked goes on only for the name it was made for */
  {
    console.log('Q4 · a press, then another name, while the account is checked (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await toKey(page);
    await waitIn(page, 'ac-stat', /needs about/, 20000);
    state.acctDelay = { kingbeelovis: 4000 };
    await page.evaluate(() => {
      window.__acSaid = []; const st = document.getElementById('ac-stat');
      new MutationObserver(() => window.__acSaid.push(st.innerText.trim())).observe(st, { childList: true, subtree: true, characterData: true });
      document.getElementById('wgo').click();   // the name is read again: the account check is slow this time
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { document.getElementById('ac-name').value = 'newacctnamec'; document.getElementById('ac-go').click(); });
    await page.waitForFunction(() => window.__acSaid.some(s => /^checking kingbeelovis, one moment\./.test(s)), null, { timeout: 5000 }).catch(() => {});
    const waited = await page.evaluate(() => window.__acSaid.some(s => /^checking kingbeelovis, one moment\./.test(s)));
    await page.evaluate(() => { document.getElementById('wq').value = 'bobaccount11'; document.getElementById('wgo').click(); });   // another name, before the check answers
    await page.waitForFunction(() => window.__acSaid.some(s => /^you connected another name while this was being checked, so nothing was signed\./.test(s)), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const said = await page.evaluate(() => window.__acSaid);
    ok('the press waits for the check it needs, and says so', waited, JSON.stringify(said.slice(0, 4)));
    ok('once the name changed, the waiting press signs nothing and says why', said.some(s => /^you connected another name while this was being checked, so nothing was signed\. press it now$/.test(s)) && state.posts.length === 0, JSON.stringify(said.slice(-4)) + ' · posts ' + state.posts.length);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q5 · a press whose typing changed while it waited signs nothing: what is signed is what was pressed */
  {
    console.log('Q5 · a press, then the name typed again, while the account is checked (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await toKey(page);
    state.acctDelay = { kingbeelovis: 4000 };
    await page.evaluate(() => {
      window.__acSaid = []; const st = document.getElementById('ac-stat');
      new MutationObserver(() => window.__acSaid.push(st.innerText.trim())).observe(st, { childList: true, subtree: true, characterData: true });
      document.getElementById('wgo').click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { document.getElementById('ac-name').value = 'newacctnamed'; document.getElementById('ac-go').click(); });
    await page.waitForFunction(() => window.__acSaid.some(s => /^checking kingbeelovis, one moment\./.test(s)), null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => { document.getElementById('ac-name').value = 'newacctnamee'; });   // typed again, never pressed
    await page.waitForFunction(() => window.__acSaid.some(s => /^you changed it while this was being checked, so nothing was signed\./.test(s)), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const said = await page.evaluate(() => window.__acSaid);
    ok('a name typed again while the press waited is never signed: it is said, with the one press that would sign it', said.some(s => /^you changed it while this was being checked, so nothing was signed\. press it now$/.test(s)) && state.posts.length === 0, JSON.stringify(said.slice(-3)) + ' · posts ' + state.posts.length);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q6 · a RAM swap pressed while the account is checked, then flipped to sell, signs nothing */
  {
    console.log('Q6 · a swap, then its direction flipped, while the account is checked (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-sw').click(); document.getElementById('sw-amt').value = '4096'; });
    state.acctDelay = { kingbeelovis: 4000 };
    await page.evaluate(() => {
      window.__swSaid = []; const st = document.getElementById('sw-stat');
      new MutationObserver(() => window.__swSaid.push(st.innerText.trim())).observe(st, { childList: true, subtree: true, characterData: true });
      document.getElementById('wgo').click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('sw-go').click());
    await page.waitForFunction(() => window.__swSaid.some(s => /^checking kingbeelovis, one moment\./.test(s)), null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.getElementById('sw-dir').click());   // flipped to sell while the press waits
    await page.waitForFunction(() => window.__swSaid.some(s => /^you changed it while this was being checked, so nothing was signed\./.test(s)), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const said = await page.evaluate(() => window.__swSaid);
    ok('a swap flipped to sell while the press waited signs nothing, and says why', said.some(s => /^you changed it while this was being checked, so nothing was signed\. press it now$/.test(s)) && state.posts.length === 0, JSON.stringify(said.slice(-3)) + ' · posts ' + state.posts.length);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q7 · a press made while the name's pointer is still being read waits for it, then goes on */
  {
    console.log('Q7 · a press while the pointer is read (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    await toKey(page);
    state.aBal = '0.0100 A';
    state.rowsDelay = 3000;
    await page.evaluate(() => {
      try { localStorage.removeItem('bnr_vacct'); } catch (e) {}
      window.__acSaid = []; const st = document.getElementById('ac-stat');
      new MutationObserver(() => window.__acSaid.push(st.innerText.trim())).observe(st, { childList: true, subtree: true, characterData: true });
      document.getElementById('wgo').click();   // the pointer is read again, slowly
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { document.getElementById('ac-name').value = 'newacctnamef'; document.getElementById('ac-go').click(); });
    await page.waitForFunction(() => window.__acSaid.some(s => /so nothing was signed/.test(s)), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    const said = await page.evaluate(() => window.__acSaid);
    ok('while the pointer is read the press says so, never "could not read"', said.some(s => /^reading which account king\.b points at, one moment\./.test(s)) && !said.some(s => /could not read which account/.test(s)), JSON.stringify(said.slice(0, 5)));
    ok('and once it answers the press goes on to its own verdict, signing nothing it should not', said.some(s => /^a new account needs about [0-9.]+ A for its room on the chain, and you have 0\.0100 A, so nothing was signed\./.test(s)) && state.posts.length === 0, JSON.stringify(said.slice(-3)) + ' · posts ' + state.posts.length);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* Q8 · "check again" on an account that does not exist only reads: once it signs, the reader presses */
  {
    console.log('Q8 · check again on a missing account (bee):');
    const { ctx, state } = await context(browser, 'bee', { soul: 'newacctnameg' });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${ORIGIN}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY, null, { timeout: 20000 });
    await recoveryConnect(page);
    await page.waitForFunction(() => /is not a Vaulta account yet/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { document.querySelector('[data-wl-go="move"]').click(); document.getElementById('pay-tx').click(); document.getElementById('tx-tab-v').click();
      document.getElementById('sv-to').value = 'someoneelse1'; document.getElementById('sv-amt').value = '0.1'; document.getElementById('sv-go').click(); });
    await page.waitForFunction(() => /is not a Vaulta account yet, so nothing was signed/.test(document.getElementById('sv-stat').innerText), null, { timeout: 15000 }).catch(() => {});
    state.keys.newacctnameg = [await k1Of(page, 'vaulta:newacctnameg')];   // the account exists now, and carries this wallet's key
    await page.evaluate(() => { const b = [...document.querySelectorAll('#sv-stat button.wl-act')].find(x => x.textContent === 'check again'); if (b) b.click(); });
    await page.waitForFunction(() => /is ready to sign now/.test(document.getElementById('sv-stat').innerText), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const line = (await page.innerText('#sv-stat')).trim();
    ok('check again only reads: once the account signs, the line says so and waits for the reader\'s own press', line === 'newacctnameg is ready to sign now. press it now' && state.posts.length === 0, line + ' · posts ' + state.posts.length);
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* R · an account that needs two keys to sign is said, never "ready", never half-joined */
  {
    console.log('R · a multisig account (bee):');
    const { ctx, state, page, errors } = await open(browser, 'bee');
    state.threshold = { kingbeelovis: 2 };
    state.keys.kingbeelovis = [DEV_PUB];
    await recoveryConnect(page);
    await page.waitForFunction(() => /more than one key/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 }).catch(() => {});
    const sum = await page.evaluate(() => ({ t: document.getElementById('sum-bridge').textContent.trim(), a: !!document.querySelector('#sum-bridge a[href="#bridge-sec"]') }));
    ok('at a glance says it needs more than one key, with its one link, never ready', sum.t === 'kingbeelovis needs more than one key to sign, so this wallet cannot sign for it alone. see what to do' && sum.a, JSON.stringify(sum));
    await toKey(page);
    const br = await page.evaluate(() => ({ t: document.getElementById('br-calm').innerText.trim(), field: !!document.getElementById('br-paste') }));
    ok('the bridge says why this wallet cannot sign alone and offers no paste', /^kingbeelovis needs more than one key to sign, so this wallet cannot sign for it alone\. choose the account$/.test(br.t) && !br.field && state.posts.length === 0, JSON.stringify(br));
    // the key on the account at weight 1 under threshold 2 still is not "ready"
    state.keys.kingbeelovis = [DEV_PUB, (await page.textContent('#kc-k1-pub')).trim()];
    await page.evaluate(() => { document.getElementById('wgo').click(); });
    await page.waitForTimeout(1500);
    ok('a key that cannot meet the threshold by itself is never read as ready', !/ready to sign/.test(await page.textContent('#sum-bridge')), await page.textContent('#sum-bridge'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  /* S · cypherpunk keeps the RAM field, and a byte count the chain cannot use is said before signing */
  {
    console.log('S · the forge RAM field (cypherpunk):');
    const { ctx, state, page, errors } = await open(browser, 'cypherpunk');
    state.keys.kingbeelovis = [await k1Of(page, 'vaulta:kingbeelovis')];
    await recoveryConnect(page);
    await page.waitForFunction(() => /ready to sign/.test(document.getElementById('sum-bridge').textContent), null, { timeout: 20000 });
    ok('cypherpunk sees the RAM field and its live price', await page.evaluate(() => document.getElementById('ac-ram').getClientRects().length > 0 && document.getElementById('ac-cost').getClientRects().length > 0));
    await page.evaluate(() => { document.getElementById('ac-ram').value = '0'; document.getElementById('ac-name').value = 'newacctnameb'; document.getElementById('ac-go').click(); });
    await waitIn(page, 'ac-stat', /3072/, 15000);
    ok('a byte count below the floor is said and nothing is signed, never quietly swapped for 8192', /^the new account needs at least 3072 bytes of room, so type a whole number from 3072 up\.$/.test((await page.textContent('#ac-stat')).trim()) && state.posts.length === 0, await page.textContent('#ac-stat'));
    ok('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\nwallet bridge and account forge: ${pass} pass, ${fail} fail`);
if (fail) process.exit(1);
