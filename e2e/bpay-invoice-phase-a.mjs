// bPay Phase A gate — the real, machine-bound invoice renders in the wallet
// surface, understandaby, with NOTHING spendable on it.
//
// Serves surfaces/ from this worktree, opens wallet.html in chromium (390px),
// and proves the bPay invoice panel:
//   1. exists and loaded the same-origin invoice artifact (bpay-invoice.json);
//   2. shows the Bux video identity — filename, exact bytes, sha256;
//   3. derives+shows the ANT storage obligation from the CARRIED quote set
//      (recomputed in this test from the artifact — never trusted from the page);
//   4. shows native gas SEPARATELY (own element, ETH unit — never collapsed);
//   5. shows quote freshness (obtained timestamp) and the commitment digest;
//   6. renders the waiting state honestly (AWAITING-AUTHORIZATION shape);
//   7. carries NO authorization route — page HTML must NOT contain
//      "Review & Pay" / review-pay / bpay-invoice-review-pay (recon1-oracle
//      A9c law: the tripwire owns that string until Phase C's re-ruling);
//   8. no page errors, no bPay-panel console errors.
//
//   node e2e/bpay-invoice-phase-a.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const SURFACES = join(here, '..', 'surfaces');
const INVOICE_PATH = join(SURFACES, 'bpay-invoice.json');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

// the artifact the page must have rendered (read by the TEST, then cross-checked)
let invoice = null;
try { invoice = JSON.parse(await readFile(INVOICE_PATH, 'utf8')); } catch { /* RED phase: absent */ }

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const path = url === '/' ? '/wallet.html' : url;
  try {
    const body = await readFile(join(SURFACES, path.replaceAll('/', '\\').replace(/^\\/, '')));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
const bpayConsole = [];
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && /bpay|invoice/i.test(m.text())) bpayConsole.push(m.text()); });

await page.goto(origin + '/wallet.html', { waitUntil: 'load' });
// the panel loads its artifact async; give it a beat, then read the DOM
await page.waitForTimeout(1200);

const panel = await page.$('#bpay-sec');
check('panel exists (#bpay-sec)', !!panel);
const html = panel ? await panel.innerText() : '';
const fullHtml = await page.content();

if (invoice) {
  // identity — from the artifact, byte-exact expectations
  check('filename shown', invoice.domain?.artifact?.name ? html.includes(invoice.domain.artifact.name) : false, invoice.domain?.artifact?.name || 'artifact.name missing');
  const bytesShown = (await page.$$eval('#bpay-sec [data-bpay-bytes]', els => els.map(e => e.dataset.bpayBytes).join(','))) || '';
  check('exact bytes shown (machine-exact)', bytesShown === String(invoice.domain.artifact.bytes), `shown=${bytesShown} artifact=${invoice.domain.artifact.bytes}`);
  check('sha256 shown (first 16 hex)', invoice.domain.artifact.sha256 ? html.includes(invoice.domain.artifact.sha256.slice(0, 16)) : false);

  // owed ANT — RECOMPUTED from the carried quote set (INV-1.1: derived, never asserted)
  const ant = (invoice.lines || []).find(l => l.asset === 'ANT');
  const recomputed = ant ? ant.quotes.reduce((s, q) => s + BigInt(q.amount_atto), 0n).toString() : null;
  check('invoice carries ANT line with quotes', !!ant && ant.quotes.length > 0, ant ? `${ant.quotes.length} quotes` : 'no ANT line');
  check('page owed equals recomputed quote sum', recomputed !== null && ant.amountAtto === recomputed, `artifact ${ant?.amountAtto} vs recomputed ${recomputed}`);
  const antShown = (await page.$$eval('#bpay-sec [data-bpay-owed-atto]', els => els.map(e => e.dataset.bpayOwedAtto).join(','))) || '';
  check('owed rendered from the same sum', antShown === recomputed, `shown=${antShown}`);

  // gas — SEPARATE element, ETH unit, never inside the ANT figure
  const gasEl = await page.$('#bpay-sec [data-bpay-gas-wei]');
  const gasText = gasEl ? await gasEl.innerText() : '';
  check('native gas shown separately (ETH unit)', !!gasEl && /ETH/i.test(gasText), gasText.slice(0, 60));

  // freshness + commitment
  check('quote timestamp shown', !!invoice.domain?.quote?.obtained_at && html.includes(invoice.domain.quote.obtained_at.slice(0, 10)), invoice.domain?.quote?.obtained_at || 'obtained_at missing');
  check('commitment digest shown', !!invoice.commitment?.digest && html.includes(invoice.commitment.digest.replace('sha256:', '').slice(0, 16)));

  // waiting state, honestly
  const stateText = (await page.$('#bpay-sec [data-bpay-state]')) ? await page.$eval('#bpay-sec [data-bpay-state]', e => e.innerText) : '';
  check('waiting state rendered', /await/i.test(stateText), stateText.slice(0, 60));

  // founder corrections 2026-09-17 — Phase E: obligations ≠ confirmations
  const tux = invoice.domain?.trezor_ux || {};
  check('artifact claims NO confirmation count (obligations only)', tux.expected_confirmations == null && tux.quote_obligations === (invoice.lines.find(l=>l.asset==='ANT')?.quotes?.length ?? -1), `quote_obligations=${tux.quote_obligations} expected_confirmations=${tux.expected_confirmations}`);
  check('page claims no numeric confirmation count', !/\d+\s+confirmation/i.test(fullHtml));

  // founder corrections 2026-09-17 — Phase B: audience axis, one policy object, unavailable modes VISIBLY unavailable
  const aud = invoice.domain?.policy?.audience || {};
  check('artifact carries the audience axis (one policy object)', aud.selected === 'public' && Array.isArray(aud.available) && Array.isArray(aud.unavailable) && !!invoice.domain?.policy?.inspection?.advanced, `selected=${aud.selected} available=${(aud.available||[]).join(',')} unavailable=${(aud.unavailable||[]).map(u=>u.id).join(',')}`);
  const unavailRendered = (await page.$$eval('#bpay-sec [data-bpay-unavailable]', els => els.map(e => e.dataset.bpayUnavailable))) || [];
  check('unavailable audience modes rendered visibly (never promised)', (aud.unavailable || []).every(u => unavailRendered.includes(u.id)), `rendered=${unavailRendered.join(',')}`);
} else {
  check('invoice artifact exists (surfaces/bpay-invoice.json)', false, 'absent — run scripts/bpay-mvp/invoice-from-quote.mjs');
}

// A9c law — no authorization route anywhere on the page until Phase C's re-ruling
check('no authorization route strings (A9c law)', !/Review & Pay|review-pay|bpay-invoice-review-pay/i.test(fullHtml));

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | ').slice(0, 160));
check('no bPay console errors', bpayConsole.length === 0, bpayConsole.slice(0, 2).join(' | ').slice(0, 160));

await page.screenshot({ path: join(here, 'shots-bpay-phase-a', 'wallet-bpay-390.png'), fullPage: false });
await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(failed.length
  ? `\nbPay PHASE-A GATE: ${failed.length} FAILED of ${results.length}`
  : `\nbPay PHASE-A GATE: GREEN — ${results.length}/${results.length} (real invoice rendered; nothing spendable; A9c held)`);
process.exit(failed.length ? 1 : 0);
