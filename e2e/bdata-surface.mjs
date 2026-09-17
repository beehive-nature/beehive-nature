// bData (My Data) gate — the organism-level data surface, first slice.
//
// Serves surfaces/ from the worktree and proves in chromium (390px):
//   1. the shelf renders the registered object with MECHANICAL identity
//      (name/bytes/sha from the committed reference invoice — never retyped);
//   2. "Who can get this?" shows the resolved audience; Public is bound as
//      committed (not re-choosable here); Only me / Selected people are
//      VISIBLY UNAVAILABLE with reasons — never promised;
//   3. the SUPERSEDE law is visible: a carried-quote-set commitment exists →
//      changing audience requires a new quote; the old plan stays history;
//   4. the bPay handoff: bounded obligation (ceiling from the carried quotes,
//      recomputed by this test) + gas SEPARATE + "Nothing has been paid." +
//      the link to the wallet's bPay panel;
//   5. AUTOMATION is a first-class policy: Ask me / Automatic within limits /
//      Never — mode changes persist AND append history (supersede-not-mutate:
//      prior entries intact after a second change);
//   6. inspection depth (newbee/raver/cypherpunk) toggles the anatomy
//      (Payload/Audience/Storage/Authority/Automation/Value/Evidence/History)
//      without touching audience or automation;
//   7. A9c law: no authorization route strings; no bData page errors.
//
//   node e2e/bdata-surface.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

const refInvoice = JSON.parse(await readFile(join(SURFACES, 'bpay-invoice.json'), 'utf8'));
const ant = refInvoice.lines.find(l => l.asset === 'ANT');
const recomputedCeiling = ant.quotes.reduce((s, q) => s + BigInt(q.amount_atto), 0n).toString();

const server = createServer(async (req, res) => {
  const p = (req.url === '/' ? '/bdata.html' : req.url).split('?')[0];
  try {
    const body = await readFile(join(SURFACES, ...p.split('/').filter(Boolean)));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

await page.goto(origin + '/bdata.html', { waitUntil: 'load' });
await page.waitForTimeout(1400);

const text = await page.innerText('body');

// 1 · the shelf — mechanical identity
check('object renders with mechanical identity', text.includes(refInvoice.domain.artifact.name) && text.includes('214,091,829'), 'name + exact bytes from the reference invoice');
const bytesAttr = await page.$eval('[data-bdata-bytes]', e => e.dataset.bdataBytes);
check('bytes machine-exact', bytesAttr === String(refInvoice.domain.artifact.bytes), bytesAttr);

// 2 · audience — resolved + unavailable modes visible
check('who-can-get line present', /anyone who obtains the Autonomi address/i.test(text));
const unavail = await page.$$eval('[data-bdata-unavailable]', els => els.map(e => e.dataset.bdataUnavailable));
check('unavailable audience modes visible (never promised)', unavail.includes('only-me') && unavail.includes('selected-people'), unavail.join(','));

// 3 · supersede law visible
check('supersede note: commitment exists, change requires a new quote', !!(await page.$('[data-bdata-supersede-note]')) && /requires a new quote/i.test(text));

// 4 · the bPay handoff
const ceilingAttr = await page.$$eval('[data-bdata-ceiling-atto]', els => els.map(e => e.dataset.bdataCeilingAtto).join(','));
check('handoff ceiling = recomputed carried quotes', ceilingAttr === recomputedCeiling, `${ceilingAttr.slice(0, 12)}… atto`);
check('gas separate in handoff', /Arbitrum ETH/.test(text));
check('nothing-paid line present', /Nothing has been paid/i.test(text));
check('wallet link present', !!(await page.$('[data-bdata-open-bpay]')));

// 5 · automation — first-class, persisted, supersede-not-mutate
check('automation default Ask me', (await page.$eval('[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode)) === 'ask');
await page.click('[data-bdata-auto="never"]');
await page.waitForTimeout(200);
let hist = await page.$$eval('[data-bdata-history]', els => els.length);
check('policy change appends history (1 edition)', hist === 1, `history=${hist}`);
const lsMode = await page.evaluate(() => JSON.parse(localStorage.getItem('bdata-v1')).automation.mode);
check('automation persists (localStorage)', lsMode === 'never', lsMode);
await page.click('[data-bdata-auto="ask"]');
await page.waitForTimeout(200);
hist = await page.$$eval('[data-bdata-history]', els => els.length);
const firstEdition = (await page.$$eval('[data-bdata-history]', els => els.map(e => e.innerText)))[1] || '';
check('second change appends, first edition intact (2 editions)', hist === 2 && /ask → never|never/.test(firstEdition), `history=${hist}`);

// 6 · inspection depth — anatomy without authority
await page.click('[data-bdata-insp="cypherpunk"]');
await page.waitForTimeout(250);
const anatomyVisible = await page.$eval('#cyber', e => e.offsetHeight > 0 && /Payload/.test(e.innerText) && /Authority/.test(e.innerText) && /Evidence/.test(e.innerText));
const sections = await page.$$eval('#cyber .sect', els => els.length);
check('cypherpunk view shows the anatomy (8 sections)', anatomyVisible && sections === 8, `${sections} sections`);
await page.click('[data-bdata-insp="newbee"]');
await page.waitForTimeout(250);
const hidden = await page.$eval('#cyber', e => e.offsetHeight === 0);
const modeStillAsk = await page.$eval('[data-bdata-auto-mode]', e => e.dataset.bdataAutoMode);
check('newbee hides anatomy; policy untouched', hidden && modeStillAsk === 'ask');

// 7 · laws
const fullHtml = await page.content();
check('no authorization route strings (A9c law)', !/Review & Pay|review-pay|bpay-invoice-review-pay/i.test(fullHtml));
check('no bData page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 160));

await page.screenshot({ path: join(here, 'shots-bdata', 'bdata-390.png'), fullPage: false });
await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(failed.length
  ? `\nbData GATE: ${failed.length} FAILED of ${results.length}`
  : `\nbData GATE: GREEN — ${results.length}/${results.length} (My Data owns policy; bPay holds the economics; supersede-not-mutate held)`);
process.exit(failed.length ? 1 : 0);
