// wallet-matrix.mjs — the chain-matrix gate (Brief 04 Part 3 as data).
// Proves: the original scope and reviewed additions stay visible, counts
// follow the data, every row separates read/sign status, and —
// by served-page mutation, removing one chain from the data — that NOTHING
// is typed prose: the render follows the data or the gate goes red.
// Run:  cd e2e && node wallet-matrix.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { pinRegister, REG } from './wallet-register-pin.mjs';

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
const requiredScope = ['Vaulta','Hive','ETH','Arbitrum','Base','exSAT','stables',
  'BTC','Lightning','Solana','Zano','Bitcoin Cash','Zcash','Monero','Autonomi','Arweave',
  'BitShares','Steem','Golos','Blurt','Peerplays','Cosmos Hub','Osmosis','Celestia','dYdX','Injective'];
let originalCount;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`); }
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
pinRegister(browser);   // WALLET_REG (see wallet-register-pin.mjs)
try {
  /* A · the complete scope, rendered from data, counts computed */
  console.log('A · full wallet scope from data:');
  {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8895/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__CHAIN_MATRIX && document.querySelectorAll('#matrix-body > div').length >= 4, null, { timeout: 15000 });
    const data = await page.evaluate(() => window.__CHAIN_MATRIX);
    originalCount = data.length;
    ok('original rails and reviewed Graphene/Cosmos scope are retained', requiredScope.every(name => data.some(c => c.name === name)), data.map(c => c.name).join(','));
    ok('catalog names are unique', new Set(data.map(c => c.name)).size === data.length);
    const rendered = await page.evaluate(() => Array.from(document.querySelectorAll('#matrix-body strong')).map(e => e.textContent));
    const namesOk = await page.evaluate(d => d.every(c => document.getElementById('matrix-body').textContent.includes(c.name)), data);
    ok('every chain name renders', namesOk, 'missing: ' + data.filter(c => !rendered.some(r => r.includes(c.name))).map(c => c.name).join(','));
    const families = await page.evaluate(() => Array.from(document.querySelectorAll('#matrix-body > div > div:first-child')).map(e => e.textContent));
    const familyNames = [...new Set(data.map(c => c.family))];
    ok('all family counts follow the catalog', families.length === familyNames.length && familyNames.every((f,i) => families[i].includes(f+' family: '+data.filter(c => c.family === f).length)), families.join(' | '));
    ok('native Vaulta and token/storage entries have distinct families', data.find(c => c.name === 'Vaulta').family === 'Antelope' && data.find(c => c.name === 'stables').family === 'Tokens' && data.find(c => c.name === 'Autonomi').family === 'Storage');
    const pathCounts = await page.evaluate(() => ({
      read: Array.from(document.querySelectorAll('#matrix-body b')).filter(e => e.textContent === 'read').length,
      sign: Array.from(document.querySelectorAll('#matrix-body b')).filter(e => e.textContent === 'sign').length
    }));
    ok('every row carries separate read and sign paths', pathCounts.read === data.length && pathCounts.sign === data.length,
      JSON.stringify(pathCounts));
    const badgeStates = await page.evaluate(() => Array.from(document.querySelectorAll('#matrix-body span')).map(s => s.textContent).filter(t => /^(READ|CODE|EVALUATION|GAP|STUDY)$/.test(t)));
    ok('every row has an implementation-status badge', badgeStates.length === data.length, badgeStates.join(','));
    const options = await page.locator('#wa-chain option').evaluateAll(nodes => nodes.map(n => ({value:n.value,disabled:n.disabled,text:n.textContent})));
    const available = data.filter(c => c.watch).map(c => c.watch).concat('bitcoin-account');
    ok('only implemented public readers can be selected', options.filter(o => !o.disabled).length === available.length && options.filter(o => !o.disabled).every(o => available.includes(o.value)));
    ok('every research/gap row is visible and unavailable in the picker', data.filter(c => !c.watch).every(c => options.some(o => o.disabled && o.value === '' && o.text.startsWith(c.name+' · '))));
    ok('Vaulta and Hive remain first-class selectable accounts', ['vaulta','hive'].every(value => options.some(o => o.value === value && !o.disabled)));
    // the count chips are cypherpunk's; every register reads one sentence (textContent carries both)
    const summary = await page.locator('#matrix-summary').textContent();
    const said = await page.locator('#matrix-say').innerText();
    ok('every register reads the coverage as one sentence computed from the data', said === 'this wallet can read ' + data.filter(c => c.state === 'READ').length + ' of these ' + data.length + ' today; the rest cannot be read here yet.', said);
    const tally = await page.evaluate(d => {
      const t = {}; d.forEach(c => t[c.state] = (t[c.state] || 0) + 1); return t;
    }, data);
    ok('summary counts are computed from the data', summary.includes(data.length+' scope entries · computed') && Object.entries(tally).every(([state,count]) => summary.includes(count+' '+state.toLowerCase())), summary.replace(/\n/g, ' | '));
    await page.close();
  }

  /* B · MUTATION (matrix law 4): one chain removed from the DATA — the
     render AND account picker must follow, including recomputed counts. */
  console.log('B · data mutation (never typed):');
  {
    const ctx = await browser.newContext();
    await ctx.route(/surfaces\/wallet\.html/, async route => {
      const src = await readFile(join(ROOT, 'surfaces', 'wallet.html'), 'utf8');
      const anchor = /^    \{ family: 'Storage', name: 'Arweave',.*\r?\n/m;
      if (!anchor.test(src)) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'mutation anchor missing' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: src.replace(anchor, '') });
    });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8895/surfaces/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__CHAIN_MATRIX, null, { timeout: 15000 });
    const body = await page.evaluate(() => document.getElementById('matrix-body').innerText);
    ok('removed rail disappears from the matrix and picker', !/Arweave/.test(body) && await page.locator('#wa-chain option[value="arweave"]').count() === 0);
    const sum2 = await page.locator('#matrix-summary').textContent();
    ok('removal recomputes the summary count', sum2.includes((originalCount-1)+' scope entries · computed'), sum2.slice(0, 60));
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
    if (REG === 'cypherpunk') ok('composer boots FROM the profile (no hard-wired defaults in the markup)',
      booted.c === prof.composer.contract && booted.a === prof.composer.action &&
      JSON.parse(booted.d).registrant === prof.composer.args.registrant, JSON.stringify(booted));
    else ok('bee and raver boot the composer empty: no visitor is shown the estate account as the thing to sign (the profile stays data, cypherpunk boots from it)',
      booted.c === '' && booted.a === '' && booted.d === '' && prof.composer.contract === 'kingbeelovis', JSON.stringify(booted));
    await page.close();

    const ctx = await (browser.newContextOwnRegister || browser.newContext).call(browser);
    await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'cypherpunk'); } catch (e) {} });   // the profile's composer defaults boot in cypherpunk
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
