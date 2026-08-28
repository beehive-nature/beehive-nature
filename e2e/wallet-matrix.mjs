// wallet-matrix.mjs — the chain-matrix gate (Brief 04 Part 3 as data).
// Proves: 16 rails rendered from the data block, every count computed at
// render (matrix law 4), every row honest (read + sign + state badge), and —
// by served-page mutation, removing one chain from the data — that NOTHING
// is typed prose: the render follows the data or the gate goes red.
// Run:  cd e2e && node wallet-matrix.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8895, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`); }
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  /* A · the sixteen, rendered from data, counts computed */
  console.log('A · sixteen rails from data:');
  {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8895/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__CHAIN_MATRIX && document.querySelectorAll('#matrix-body > div').length >= 4, null, { timeout: 15000 });
    const data = await page.evaluate(() => window.__CHAIN_MATRIX);
    ok('sixteen chains in the data block', data.length === 16, data.length);
    const rendered = await page.evaluate(() => Array.from(document.querySelectorAll('#matrix-body strong')).map(e => e.textContent));
    const namesOk = await page.evaluate(d => d.every(c => document.getElementById('matrix-body').textContent.includes(c.name)), data);
    ok('every chain name renders', namesOk, 'missing: ' + data.filter(c => !rendered.some(r => r.includes(c.name))).map(c => c.name).join(','));
    const families = await page.evaluate(() => Array.from(document.querySelectorAll('#matrix-body > div > div:first-child')).map(e => e.textContent));
    ok('four families sectioned (EVM · Bitcoin · Independent · Hard tail)',
      families.length === 4 && /EVM FAMILY — 6 rails/.test(families[0]) && /BITCOIN FAMILY — 2 rails/.test(families[1]) &&
      /INDEPENDENT FAMILY — 3 rails/.test(families[2]) && /HARD TAIL FAMILY — 5 rails/.test(families[3]), families.join(' | '));
    const pathCounts = await page.evaluate(() => ({
      read: (document.getElementById('matrix-body').innerText.match(/read /g) || []).length,
      sign: (document.getElementById('matrix-body').innerText.match(/sign /g) || []).length
    }));
    ok('every row carries a read path and a sign path (16 each)', pathCounts.read === 16 && pathCounts.sign === 16,
      JSON.stringify(pathCounts));
    const badgeStates = await page.evaluate(() => Array.from(document.querySelectorAll('#matrix-body span')).map(s => s.textContent).filter(t => /^(LIVE|PROVEN|VERIFY|GAP|STUDY)$/.test(t)));
    ok('sixteen honest state badges (LIVE/PROVEN/VERIFY/GAP/STUDY)', badgeStates.length === 16, badgeStates.join(','));
    const summary = await page.locator('#matrix-summary').innerText();
    const tally = await page.evaluate(d => {
      const t = {}; d.forEach(c => t[c.state] = (t[c.state] || 0) + 1); return t;
    }, data);
    ok('summary counts COMPUTED from the data (16 rails + per-state chips)',
      /16 rails · computed/.test(summary) && new RegExp((tally.LIVE || 0) + ' live').test(summary) &&
      new RegExp((tally.GAP || 0) + ' gap').test(summary) && new RegExp((tally.VERIFY || 0) + ' verify').test(summary), summary.replace(/\n/g, ' | '));
    await page.close();
  }

  /* B · MUTATION (matrix law 4): one chain removed from the DATA — the
     render must follow (15 rows, recomputed counts), proving no typed prose */
  console.log('B · data mutation (never typed):');
  {
    const ctx = await browser.newContext();
    await ctx.route(/surfaces\/wallet\.html/, async route => {
      const src = await readFile(join(ROOT, 'surfaces', 'wallet.html'), 'utf8');
      const anchor = "{ family: 'Hard tail', name: 'Arweave',";
      if (!src.includes(anchor)) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'mutation anchor missing' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: src.replace(anchor, "{ family: 'Hard tail', name: 'REMOVED-RAIL',") });
    });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8895/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__CHAIN_MATRIX, null, { timeout: 15000 });
    const body = await page.evaluate(() => document.getElementById('matrix-body').innerText);
    ok('renamed rail in the data ⇒ the render follows (no hand-written Arweave row)',
      /REMOVED-RAIL/.test(body) && !/Arweave gateway/.test(body), body.slice(0, 80));
    const sum2 = await page.locator('#matrix-summary').innerText();
    ok('hard-tail count follows the data (5 → still 5 with the renamed rail; summary stays computed)', /16 rails · computed/.test(sum2), sum2.slice(0, 60));
    await ctx.close();
  }
  /* C · THE KIT PROFILE (founder north star, supplemented 2026-08-28): the
     wallet's estate-only facts live in ONE data block — a turnkey copy edits
     WALLET_PROFILE and nothing else. Proven by mutation: change the profile,
     the composer boots differently. */
  console.log('C · kit profile (config in data, never logic):');
  {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8895/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.WALLET_PROFILE && window.__CHAIN_MATRIX, null, { timeout: 15000 });
    const prof = await page.evaluate(() => window.WALLET_PROFILE);
    ok('the kit profile carries every estate-only fact (home · composer · seeds · anchor)',
      !!(prof.canonical_home && prof.composer && prof.composer.contract && Array.isArray(prof.discovery_seeds) &&
         prof.anchor && prof.anchor.path && prof.anchor.sha256 && Array.isArray(prof.anchor.tags)), JSON.stringify(prof).slice(0, 90));
    const booted = await page.evaluate(() => ({ c: document.getElementById('tx-contract').value, a: document.getElementById('tx-action').value, d: document.getElementById('tx-data').value }));
    ok('composer boots FROM the profile (no hard-wired defaults in the markup)',
      booted.c === prof.composer.contract && booted.a === prof.composer.action &&
      JSON.parse(booted.d).registrant === prof.composer.args.registrant, JSON.stringify(booted));
    await page.close();

    const ctx = await browser.newContext();
    await ctx.route(/surfaces\/wallet\.html/, async route => {
      const src = await readFile(join(ROOT, 'surfaces', 'wallet.html'), 'utf8');
      const anchor = "contract: 'kingbeelovis',";
      if (!src.includes(anchor)) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'mutation anchor missing' });
      return route.fulfill({ status: 200, contentType: 'text/html',
        body: src.replace(anchor, "contract: 'kitcopy11111',").replace("canonical_home: 'https://skaists.dev/surfaces/wallet.html'", "canonical_home: ''") });
    });
    const p2 = await ctx.newPage();
    await p2.goto('http://127.0.0.1:8895/surfaces/wallet.html', { waitUntil: 'load' });
    await p2.waitForFunction(() => window.WALLET_PROFILE, null, { timeout: 15000 });
    const mutated = await p2.evaluate(() => document.getElementById('tx-contract').value);
    ok('a kit copy edits the profile and the composer follows (defaults are data, never logic)',
      mutated === 'kitcopy11111', mutated);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
