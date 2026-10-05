// wallet-compose-xss.mjs: everything a link, the chain or an adapter worker puts on the
// composer, the sign sheet or the adapter chips is text, never markup, in all three registers.
// A compose link (?compose=<contract:action>&args=<json>) runs loadAbiUi by itself after
// 400 ms, so its arguments reach the preview with no press at all. Every chain read is a
// mock behind one RegExp; nothing reaches a live network; nothing is signed.
// Run: node e2e/wallet-compose-xss.mjs
import { installWalletFixture, WALLET_ORIGIN } from './lib/wallet-source-fixture.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WALLET = WALLET_ORIGIN + '/surfaces/wallet.html';
const MAIN_CHAIN = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'; // PUBLIC-CONSTANT: Vaulta mainnet chain id
const RPC_RE = /^https:\/\/(eos\.api\.eosnation\.io|eos\.greymass\.com|api\.eosn\.io)(\/|$)/;
const ABI = { account_name: 'kingbeelovis', abi: { version: 'eosio::abi/1.2', types: [],
  actions: [{ name: 'renew', type: 'renew' }],
  structs: [{ name: 'renew', fields: [{ name: 'owner', type: 'name' }, { name: 'domain_name', type: 'string' }, { name: 'days', type: 'uint16' }] }] } };
// three hostile arguments, each a different way markup could run if it were ever parsed
const HOSTILE = { owner: '<img src=x onerror="window.__xss=1">', domain_name: '"><svg onload="window.__xss=2">', days: '</pre><script>window.__xss=3</script>' };
// a whole renew whose name is hostile: the sheet's words carry it, as text
const HOSTILE_NAME = { owner: 'kingbeelovis', domain_name: '<img src=x onerror="window.__xss=4">', days: 365 };
// a worker that fails describe with markup in its error message
const EVIL_WORKER = `onmessage=function(e){var m=e.data;postMessage({jsonrpc:'2.0',id:m.id,error:{code:-32000,message:'<img src=x onerror="window.__xss=5">'}})}`;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`); }
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
await installWalletFixture(browser, ROOT);
async function open(reg, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch (e) {} }, reg);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  await ctx.route(RPC_RE, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(route.request().url());
    const json = o => route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname.endsWith('/get_abi')) return json(ABI);
    if (u.pathname.endsWith('/get_info')) return json({ chain_id: MAIN_CHAIN, head_block_num: 123456 });
    if (u.pathname.endsWith('/get_table_rows')) return json({ rows: [], more: false });
    if (u.pathname.endsWith('/send_transaction')) { ctx.__sent = (ctx.__sent || 0) + 1; return json({ error: { what: 'the fixture never accepts a send' } }); }
    return json({});
  });
  await ctx.route(/wallet-adapter-hive\.js/, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: EVIL_WORKER }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  return { ctx, page, errors };
}
const markupIn = (page, sel) => page.evaluate(s => document.querySelectorAll(s + ' img, ' + s + ' svg, ' + s + ' script, ' + s + ' iframe').length, sel);

try {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    console.log(`${reg}:`);
    /* 1 · hostile arguments on a compose link: the link fills the composer and draws the preview by itself */
    {
      const { ctx, page, errors } = await open(reg, `${WALLET}?compose=${encodeURIComponent('kingbeelovis:renew')}&args=${encodeURIComponent(JSON.stringify(HOSTILE))}`);
      await page.waitForFunction(() => document.getElementById('tx-preview').style.display === 'block' && document.querySelectorAll('.tx-f').length === 3, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => ({ xss: window.__xss, body: document.getElementById('tx-preview-body').textContent,
        fields: [...document.querySelectorAll('.tx-f')].map(f => f.value) }));
      ok('hostile link arguments land in the preview as text, and nothing in them runs',
        r.xss === undefined && /<img src=x onerror=/.test(r.body) && /<script>window\.__xss=3<\/script>/.test(r.body) && await markupIn(page, '#composer-sec') === 0, JSON.stringify(r).slice(0, 220));
      ok('and in the fields as values', r.fields.includes(HOSTILE.owner) && r.fields.includes(HOSTILE.domain_name), JSON.stringify(r.fields));
      /* typing the same markup into a field redraws the preview, still as text */
      await page.evaluate(v => { const f = document.querySelector('.tx-f[data-fn="domain_name"]'); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); }, '<img src=y onerror="window.__xss=6">');
      await page.waitForTimeout(400);
      ok('a field typed with markup redraws the preview as text', await page.evaluate(() => window.__xss) === undefined && await markupIn(page, '#tx-preview-body') === 0 &&
        /<img src=y/.test(await page.locator('#tx-preview-body').textContent()));
      /* a hostile worker's failure text lands in the adapter chips as text */
      await page.waitForFunction(() => /hive — down/.test(document.getElementById('adapter-states').textContent), null, { timeout: 15000 }).catch(() => {});
      ok('a worker\'s own failure text lands in the adapter chips as text', /<img src=x onerror=/.test(await page.locator('#adapter-states').textContent()) &&
        await markupIn(page, '#adapter-states') === 0 && await page.evaluate(() => window.__xss) === undefined, await page.locator('#adapter-states').textContent());
      ok('nothing was sent and no page errors', !ctx.__sent && errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    /* 2 · a hostile contract name on a compose link */
    {
      const { ctx, page, errors } = await open(reg, `${WALLET}?compose=${encodeURIComponent('<img src=x onerror="window.__xss=7">:renew')}&args=${encodeURIComponent(JSON.stringify({ owner: 'kingbeelovis', domain_name: 'k', days: 1 }))}`);
      await page.waitForTimeout(2000);
      ok('a hostile contract name is text everywhere it lands', await page.evaluate(() => window.__xss) === undefined && await markupIn(page, '#composer-sec') === 0 && errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    /* 3 · the sign sheet: hostile arguments never open it; a hostile name inside a whole action is said as text */
    {
      const one = await open(reg, `${WALLET}?compose=${encodeURIComponent('kingbeelovis:renew')}&args=${encodeURIComponent(JSON.stringify(HOSTILE))}#sign-action`);
      await one.page.waitForTimeout(1500);
      ok('a sign link whose fields are not a whole action opens no sheet', await one.page.evaluate(() => !document.getElementById('act-sheet') && window.__xss === undefined) && one.errors.length === 0, one.errors.join(' | '));
      await one.ctx.close();
      const two = await open(reg, `${WALLET}?compose=${encodeURIComponent('kingbeelovis:renew')}&args=${encodeURIComponent(JSON.stringify(HOSTILE_NAME))}#sign-action`);
      await two.page.waitForSelector('#act-sheet', { timeout: 20000 }).catch(() => {});
      await two.page.waitForTimeout(800);
      const s = await two.page.evaluate(() => ({ xss: window.__xss, h: (document.getElementById('act-h') || {}).textContent, read: (document.querySelector('#act-read pre') || {}).textContent }));
      ok('a hostile name inside a whole action is said as text on the sheet and runs nothing',
        s.xss === undefined && /<img src=x onerror=/.test(s.h || '') && await markupIn(two.page, '#act-sheet') === 0 && two.errors.length === 0, JSON.stringify(s).slice(0, 200) + ' ' + two.errors.join(' | '));
      ok('the sheet waited for its press: nothing was sent', !two.ctx.__sent);
      await two.ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`\nwallet compose xss: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
