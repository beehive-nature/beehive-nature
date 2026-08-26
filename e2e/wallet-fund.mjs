// wallet-fund.mjs — the FUND panel behavioral gate (Meld hosted checkout launcher).
// Catches what the structural gates cannot: launch-control state, constructed
// widget URL (host per environment + locked params carrying actual values),
// address handling, and the no-JS render. Self-contained like estate-review:
// serves the repo root so /surfaces/... paths resolve exactly as on Pages.
// Run:  cd e2e && node wallet-fund.mjs     (exit 0 = green)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const URL_ = '/surfaces/wallet.html';
const PLACEHOLDER = 'PLACEHOLDER-PUBLIC-CHECKOUT-KEY-0000000000';
const ADDR = '0x742c8f2e0ce07Dd3f7E78A31E5A97D45c50fF2c8'; // Meld's own doc example
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8891, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};
// inject the key (and optionally production env) by rewriting the served HTML —
// the file on disk stays UNSET, exactly as committed
const armedContext = async (browser, { env } = {}) => {
  const ctx = await browser.newContext();
  await ctx.route('**' + URL_, async route => {
    const r = await route.fetch();
    let body = (await r.text()).replace(
      'data-meld-public-key=""', `data-meld-public-key="${PLACEHOLDER}"`);
    if (env) body = body.replace('data-meld-env="sandbox"', `data-meld-env="${env}"`);
    await route.fulfill({ response: r, body });
  });
  return ctx;
};
const goHref = page => page.locator('#fund-go').getAttribute('href');
/* mock EVERY endpoint the panel may randomly pick — as ONE RegExp. (A glob
   like '**host*' silently fails on root URLs: single '*' does not match '/',
   so 'https://host/' leaked to the LIVE network and made tests flaky/hollow.)
   Host set mirrors wallet.html's BASE_RPC_HOSTS. */
const BASE_HOST_RE = /^https:\/\/(mainnet\.base\.org|base\.publicnode\.com|1rpc\.io|base\.drpc\.org)(\/|$)/;
const mockBaseRpc = (ctx, result32, tally) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
  ctx.route(BASE_HOST_RE, async route => {
    const host = new URL(route.request().url()).host;
    // a JSON POST from an http test origin triggers a CORS preflight — the
    // mock must answer it like the real endpoints do (they all send ACAO *)
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    if (tally) tally[host] = (tally[host] || 0) + 1;
    await route.fulfill({ contentType: 'application/json', headers: cors,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: result32 }) });
  });
};
// the page resolves names with the vendored keccak, which loads AFTER the
// panel script — wait for it explicitly or name-flow tests race the bundle
const waitBnrSign = page => page.waitForFunction(
  () => !!(window.BnrSign && window.BnrSign.keccak_256), null, { timeout: 8000 });
const assertUrl = (href, host, asset) => {
  const u = new URL(href);
  ok(`  host ${host}`, u.origin === `https://${host}`, u.origin);
  ok(`  publicKey present`, u.searchParams.get('publicKey') === PLACEHOLDER);
  ok(`  transactionType=BUY`, u.searchParams.get('transactionType') === 'BUY');
  ok(`  theme=darkMode`, u.searchParams.get('theme') === 'darkMode');
  ok(`  destinationCurrencyCodeLocked=${asset}`, u.searchParams.get('destinationCurrencyCodeLocked') === asset);
  ok(`  no "=true" param anywhere`, ![...u.searchParams.keys()].some(k => /^(true|1)$/.test(u.searchParams.get(k))));
  // Finding B — quote routing: NO provider pinning, ever. The exact param key
  // set is asserted, so any future serviceProviders/paymentMethodType/provider
  // param fails here loudly (the widget must route its own quotes).
  const keys = new Set(u.searchParams.keys());
  const allowed = new Set(['publicKey', 'transactionType', 'theme', 'destinationCurrencyCodeLocked']);
  if (keys.has('walletAddressLocked')) allowed.add('walletAddressLocked');
  ok('  no provider pinning (exact param key set)', keys.size === allowed.size &&
    [...keys].every(k => allowed.has(k)), [...keys].join(','));
  return u;
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  /* ── A · key UNSET (file as committed) ─────────────────────────────── */
  console.log('A · key unset (as committed):');
  {
    const consoleLines = [];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('console', m => consoleLines.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.message}`));
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const go = page.locator('#fund-go');
    ok('launch disabled', (await go.getAttribute('aria-disabled')) === 'true');
    ok('launch href=#', (await go.getAttribute('href')) === '#');
    const banner = await page.locator('#fund-stat').innerText();
    ok('unconfigured banner visible', banner.includes('funding not configured'));
    ok('banner names environment (SANDBOX default)', banner.includes('sandbox'));
    ok('panel body revealed', !(await page.locator('#fund-js').evaluate(el => el.hidden)));
    ok('asset options USDC_BASE + USDC_ETHEREUM',
      JSON.stringify(await page.locator('#fund-asset option').evaluateAll(os => os.map(o => o.value))) ===
      '["USDC_BASE","USDC_ETHEREUM"]');
    // the launch law: ALWAYS a top-level new tab, never an iframe — the widget
    // hands off to a third-party hosted checkout on ANOTHER origin (sandbox:
    // global-stg.transak.com); cross-origin handoff inside a top-level tab is
    // plain navigation, inside our iframe it would break. Lock it in.
    ok('launch opens a new tab (target=_blank)', (await go.getAttribute('target')) === '_blank');
    const rel = (await go.getAttribute('rel')) || '';
    ok('launch carries rel=noopener noreferrer', rel.includes('noopener') && rel.includes('noreferrer'));
    ok('panel embeds no iframe', (await page.locator('#fund-sec iframe').count()) === 0);
    const errs = consoleLines.filter(l => l.startsWith('[console.error]') || l.startsWith('[pageerror]'));
    ok('console free of errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* ── B · sandbox key armed (default env) ───────────────────────────── */
  console.log('B · placeholder key, default env (sandbox):');
  {
    const ctx = await armedContext(browser);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    ok('launch enabled', (await page.locator('#fund-go').getAttribute('aria-disabled')) === 'false');
    let u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_BASE');
    ok('no walletAddressLocked when empty', !u.searchParams.has('walletAddressLocked'));
    await page.selectOption('#fund-asset', 'USDC_ETHEREUM');
    assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_ETHEREUM');
    await page.fill('#fund-addr', ADDR);
    u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_ETHEREUM');
    ok('walletAddressLocked carries the address', u.searchParams.get('walletAddressLocked') === ADDR);
    await page.fill('#fund-addr', '0x123'); // garbage — must be omitted, never silently wrong
    u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_ETHEREUM');
    ok('invalid address left out of URL', !u.searchParams.has('walletAddressLocked'));
    ok('invalid address gets a visible note', (await page.locator('#fund-stat').innerText()).includes('does not read as an address'));
    await ctx.close();
  }

  /* ── E · name-form (.eth) input: resolve-then-confirm, honest failure ── */
  console.log('E · Basename input (Base RPC mocked, deterministic):');
  const MOCK = '1111111111111111111111111111111111111111'; // arbitrary mock hex — resolution is mocked, the value means nothing (the old mock was the lost bloverai wallet's hex, 2026-08-26 audit)
  {
    const tally = {};
    const ctx = await armedContext(browser);
    mockBaseRpc(ctx, '0x' + '0'.repeat(24) + MOCK, tally);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await waitBnrSign(page);
    await page.fill('#fund-addr', 'example.base.eth');
    await page.waitForTimeout(250);
    ok('name never called invalid', !(await page.locator('#fund-stat').innerText()).includes('does not read'));
    ok('no RPC read until the user asks (read fires on user action only)', Object.keys(tally).length === 0, JSON.stringify(tally));
    let u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_BASE');
    ok('unresolved name kept out of URL', !u.searchParams.has('walletAddressLocked'));
    await page.locator('#fund-go').click(); // first tap = resolve + show, never launch
    await page.waitForFunction(() => document.getElementById('fund-stat').textContent.includes('0x1111'), null, { timeout: 5000 });
    ok('resolved hex SHOWN to the user before launch',
      (await page.locator('#fund-stat').innerText()).includes('0x' + MOCK));
    u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_BASE');
    ok('URL locks the resolved hex (not the name)', u.searchParams.get('walletAddressLocked') === '0x' + MOCK);
    await page.fill('#fund-addr', 'x');        // any edit…
    await page.fill('#fund-addr', 'example.base.eth'); // …then back to the SAME name:
    // if the reset (resolved=null on input) were broken, re-typing the same
    // name would silently RE-ARM the stale lock — this asserts the specific
    // outcome (no lock until a fresh resolve), not mere absence after drift.
    u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_BASE');
    ok('editing the field resets the resolved lock (same name re-typed, lock absent until re-resolve)',
      !u.searchParams.has('walletAddressLocked'));
    const btnText = await page.locator('#fund-go').innerText();
    ok('button label restored after edit (no stale "resolved" state)',
      !btnText.includes('resolved') && btnText.includes('buy USDC'));
    await ctx.close();
  }
  console.log('E2 · unresolvable name (honest failure, no blame):');
  {
    const ctx = await armedContext(browser);
    mockBaseRpc(ctx, '0x' + '00'.repeat(32)); // zero = no record
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await waitBnrSign(page);
    await page.fill('#fund-addr', 'not-a-base-name.eth');
    await page.locator('#fund-go').click();
    await page.waitForFunction(() => document.getElementById('fund-stat').textContent.includes('could not be resolved'), null, { timeout: 5000 });
    const msg = await page.locator('#fund-stat').innerText();
    ok('failure says the NAME could not be resolved (not "invalid")',
      msg.includes('could not be resolved') && !msg.includes('does not read'));
    ok('failure points to the raw-address fallback', msg.includes('receive'));
    const u = new URL(await goHref(page));
    ok('nothing launched on failure', !u.searchParams.has('walletAddressLocked'));
    await ctx.close();
  }
  console.log('E3 · RPC rotation (privacy ruling — no privileged endpoint):');
  {
    const tally = {};
    const ctx = await armedContext(browser);
    mockBaseRpc(ctx, '0x' + '0'.repeat(24) + MOCK, tally);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await waitBnrSign(page);
    for (let k = 0; k < 10; k++) {
      await page.fill('#fund-addr', 'rot' + k + '.eth');
      await page.locator('#fund-go').click();
      await page.waitForFunction(
        () => document.getElementById('fund-stat').textContent.includes('resolved on Base'),
        null, { timeout: 5000 });
    }
    const hosts = Object.keys(tally);
    const total = hosts.reduce((s, h) => s + tally[h], 0);
    ok('ten lookups, one request each (no retry storms)', total === 10, JSON.stringify(tally));
    // a fixed primary = every hit on one host = FAIL. (P[uniform-4, 10 draws, all
    // one host] ≈ 4·(1/4)^10 ≈ 0.0004% — if this ever flakes, re-run once.)
    ok('first choice is RANDOM — more than one endpoint used across 10 lookups',
      hosts.length >= 2, JSON.stringify(tally));
    await ctx.close();
  }

  /* ── C · production = explicit opt-in in markup only ───────────────── */
  console.log('C · placeholder key, explicit production opt-in:');
  {
    const ctx = await armedContext(browser, { env: 'production' });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    assertUrl(await goHref(page), 'meldcrypto.com', 'USDC_BASE');
    await ctx.close();
  }

  /* ── D · JS disabled: page renders, funding says it needs JS ───────── */
  console.log('D · JavaScript disabled:');
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    ok('page renders (title)', (await page.title()).includes('BNR wallet'));
    ok('noscript funding note visible', await page.locator('.fund-nojs').isVisible());
    ok('panel body hidden', await page.locator('#fund-js').isHidden());
    await ctx.close();
  }
  /* ── F · design acceptance (mobile viewport first, per standing order) ── */
  console.log('F · design acceptance (390px phone):');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const heroSize = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('v-bal')).fontSize));
    const capSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#ch-vaulta .cn')).fontSize));
    const capTransform = await page.evaluate(() => getComputedStyle(document.querySelector('#ch-vaulta .cn')).textTransform);
    ok('hero number ≥ 32px ON A PHONE', heroSize >= 32, heroSize + 'px');
    ok('hero caption ≤ 11px uppercase', capSize <= 11 && capTransform === 'uppercase', capSize + 'px ' + capTransform);
    const grad = await page.evaluate(() => {
      const el = document.querySelector('h1 .h1-arg');
      const cs = getComputedStyle(el);
      return { clip: cs.webkitBackgroundClip || cs.backgroundClip,
               fill: cs.webkitTextFillColor, img: cs.backgroundImage };
    });
    ok('headline gradient-CLIPPED (argument, not colour)', grad.clip === 'text' &&
      (grad.fill === 'rgba(0, 0, 0, 0)' || grad.fill === 'transparent') &&
      /linear-gradient/.test(grad.img), JSON.stringify(grad).slice(0, 90));
    ok('headline stops use the page tokens (gold→leaf→cyan)',
      /255, 215, 0/.test(grad.img) && /125, 223, 143/.test(grad.img) &&
      /0, 229, 255/.test(grad.img), grad.img.slice(0, 80));
    // the fold, on a phone: hero balance + ring ABOVE connect (form-kill law)
    const fold = await page.evaluate(() => {
      const top = el => Math.round(el.getBoundingClientRect().top + window.scrollY);
      const bal = document.getElementById('chains').closest('section');
      const kc = document.getElementById('kc-sec');
      const connect = document.getElementById('wq').closest('section');
      return { bal: top(bal), kc: top(kc), connect: top(connect), fold: window.innerHeight,
               heroInFold: bal.getBoundingClientRect().top + bal.getBoundingClientRect().height * 0.5 <= window.innerHeight };
    });
    ok('fold order: BALANCES before CONNECT on a phone', fold.bal < fold.connect, JSON.stringify(fold));
    ok('fold order: the ring before CONNECT on a phone', fold.kc < fold.connect, JSON.stringify(fold));
    ok('hero balance VISIBLE IN THE FOLD (not below the crease)', fold.heroInFold);
    // desktop order must be untouched
    const desk = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const dpage = await desk.newPage();
    await dpage.goto('http://127.0.0.1:8891' + URL_, { waitUntil: 'domcontentloaded' });
    await dpage.waitForTimeout(400);
    const dOrder = await dpage.evaluate(() => {
      const top = el => Math.round(el.getBoundingClientRect().top + window.scrollY);
      return { bal: top(document.getElementById('chains').closest('section')),
               connect: top(document.getElementById('wq').closest('section')) };
    });
    ok('desktop order unchanged (CONNECT stays above BALANCES)', dOrder.connect < dOrder.bal, JSON.stringify(dOrder));
    await desk.close();
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
