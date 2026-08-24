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
const assertUrl = (href, host, asset) => {
  const u = new URL(href);
  ok(`  host ${host}`, u.origin === `https://${host}`, u.origin);
  ok(`  publicKey present`, u.searchParams.get('publicKey') === PLACEHOLDER);
  ok(`  transactionType=BUY`, u.searchParams.get('transactionType') === 'BUY');
  ok(`  theme=darkMode`, u.searchParams.get('theme') === 'darkMode');
  ok(`  destinationCurrencyCodeLocked=${asset}`, u.searchParams.get('destinationCurrencyCodeLocked') === asset);
  ok(`  no "=true" param anywhere`, ![...u.searchParams.keys()].some(k => /^(true|1)$/.test(u.searchParams.get(k))));
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
    await page.fill('#fund-addr', '0x123'); // invalid — must be omitted, never silently wrong
    u = assertUrl(await goHref(page), 'sb.meldcrypto.com', 'USDC_ETHEREUM');
    ok('invalid address left out of URL', !u.searchParams.has('walletAddressLocked'));
    ok('invalid address gets a visible note', (await page.locator('#fund-stat').innerText()).includes('0x/EVM address'));
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
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
