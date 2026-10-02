/* wallet-forge-pq.mjs — Gold move: forge pq: public cards (ML-DSA-65 / ML-KEM-768)
   Beside classical contexts. Persist names only. Never fake PQ from nothing.
   When keychain live + no bsigner WASM: honest "core derives when WASM armed".
   When no keychain: chip says derives when keychain connects.
   Served like soul-chrome; CI: tests.yml node job. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const orig = rel;
    rel = rel.replace(/^surfaces\//, '');
    const p = join(SURF, rel);
    let body;
    try { body = await readFile(extname(p) ? p : join(p, 'index.html')); }
    catch { const q = join(ROOT, orig); body = await readFile(extname(q) ? q : join(q, 'index.html')); }
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); }
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });

try {
  /* A · cold forge — no soul: pq buttons present, no fake cards forced */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.goto(`${BASE}/surfaces/wallet.html#forge-sec`, { waitUntil: 'load' });
    await page.waitForSelector('#forge-sec', { timeout: 15000 });
    const ui = await page.evaluate(() => ({
      dsa: !!document.getElementById('forge-pq-dsa'),
      kem: !!document.getElementById('forge-pq-kem'),
      law: (document.querySelector('#forge-sec .law') || {}).textContent || '',
      api: !!(window.BNRWALLET && window.BNRWALLET.forgePq),
      count: window.BNRWALLET && window.BNRWALLET.forgePq ? window.BNRWALLET.forgePq.count() : -1,
      registry: window.BNRWALLET && window.BNRWALLET.forgePq ? window.BNRWALLET.forgePq.registry.slice() : [],
    }));
    ok('forge has + pq:ml-dsa-65 button', ui.dsa);
    ok('forge has + pq:ml-kem-768 button', ui.kem);
    ok('forge law names pq:ml-dsa-65 and pq:ml-kem-768', /pq:ml-dsa-65/.test(ui.law) && /pq:ml-kem-768/.test(ui.law), ui.law.slice(0, 120));
    ok('BNRWALLET.forgePq surface exists', ui.api);
    ok('registry lists ml-dsa-65 and ml-kem-768', ui.registry.join(',') === 'ml-dsa-65,ml-kem-768', JSON.stringify(ui.registry));
    ok('cold pq count is 0 (no soul seeded yet)', ui.count === 0, String(ui.count));
    await page.close();
  }

  /* B · soul + keychain live — pq contexts seeded; honest WASM stub (no fake pubkey) */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
    await page.goto(`${BASE}/surfaces/wallet.html#forge-sec`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRWALLET && window.BNRWALLET.forgePq, null, { timeout: 20000 });
    // connect via recovery (same TEST-ONLY path as wallet-signer)
    await page.evaluate(() => {
      const mprk = new Uint8Array(32).fill(0x2a);
      const code = window.BZDIDKEY.encodeRecoveryCode(mprk);
      const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = code;
      document.getElementById('kc-recgo').click();
    });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
    const live = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('#forge-chips .chip')].map(el => ({
        t: el.textContent, pq: el.getAttribute('data-pq-card'), dashed: getComputedStyle(el).borderStyle === 'dashed'
      }));
      const pqChips = chips.filter(c => /pq:ml-dsa-65:|pq:ml-kem-768:/.test(c.t) || c.pq);
      return {
        count: window.BNRWALLET.forgePq.count(),
        contexts: window.BNRWALLET.forgePq.contexts(),
        armed: window.BNRWALLET.forgePq.armed(),
        dsa: window.BNRWALLET.forgePq.derive('pq:ml-dsa-65:gatesoul'),
        kem: window.BNRWALLET.forgePq.derive('pq:ml-kem-768:gatesoul'),
        chipTexts: pqChips.map(c => c.t.replace(/\s+/g, ' ').trim()),
        pqDom: document.querySelectorAll('#forge-chips [data-pq-card]').length,
        failBox: [...document.querySelectorAll('#forge-sec .stat.err, #forge-chips .chip')].some(el => /fail|error|refused/i.test(el.textContent) && /var\(--amber\)/.test(el.getAttribute('style') || '')),
      };
    });
    ok('pq count is 2 after soul seed', live.count === 2, String(live.count) + ' ' + JSON.stringify(live.contexts));
    ok('contexts include pq:ml-dsa-65:gatesoul', live.contexts.includes('pq:ml-dsa-65:gatesoul'), JSON.stringify(live.contexts));
    ok('contexts include pq:ml-kem-768:gatesoul', live.contexts.includes('pq:ml-kem-768:gatesoul'), JSON.stringify(live.contexts));
    ok('bsigner WASM not armed on main (honest residual)', live.armed === false);
    ok('ml-dsa-65 derive is needsWasm stub (no fake value)', !!(live.dsa && live.dsa.needsWasm && !live.dsa.value), JSON.stringify(live.dsa));
    ok('ml-kem-768 derive is needsWasm stub (no fake value)', !!(live.kem && live.kem.needsWasm && !live.kem.value), JSON.stringify(live.kem));
    ok('DOM paints two data-pq-card chips', live.pqDom === 2, String(live.pqDom));
    ok('chips say core derives when WASM armed', live.chipTexts.every(t => /core derives when WASM armed/i.test(t)), JSON.stringify(live.chipTexts));
    ok('no New-bee fail box on forge pq cards', !live.failBox);
    // quick-add buttons still work if contexts cleared
    await page.evaluate(() => {
      try { localStorage.setItem('bnr_contexts', '[]'); } catch (e) {}
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRWALLET, null, { timeout: 20000 });
    await page.evaluate(() => {
      const mprk = new Uint8Array(32).fill(0x2a);
      const code = window.BZDIDKEY.encodeRecoveryCode(mprk);
      const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = code;
      document.getElementById('kc-recgo').click();
    });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
    await page.click('#forge-pq-dsa');
    await page.click('#forge-pq-kem');
    const afterBtn = await page.evaluate(() => ({
      count: window.BNRWALLET.forgePq.count(),
      contexts: window.BNRWALLET.forgePq.contexts(),
      persisted: JSON.parse(localStorage.getItem('bnr_contexts') || '[]').filter(c => /^pq:/.test(c)),
    }));
    ok('quick-add buttons restore pq count to 2', afterBtn.count === 2, JSON.stringify(afterBtn));
    ok('persisted contexts are names only (pq:*)', afterBtn.persisted.length === 2 && afterBtn.persisted.every(c => /^pq:(ml-dsa-65|ml-kem-768):/.test(c)), JSON.stringify(afterBtn.persisted));
    await page.close();
  }

  /* C · no keychain: pq contexts may seed with soul, chips wait honestly */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
    await page.goto(`${BASE}/surfaces/wallet.html#forge-sec`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BNRWALLET && window.BNRWALLET.forgePq, null, { timeout: 20000 });
    const cold = await page.evaluate(() => {
      const dsa = window.BNRWALLET.forgePq.derive('pq:ml-dsa-65:gatesoul');
      const chips = [...document.querySelectorAll('#forge-chips .chip')].filter(el => /pq:ml-dsa-65:/.test(el.textContent));
      return {
        count: window.BNRWALLET.forgePq.count(),
        dsaNull: dsa === null,
        waitText: chips.map(c => c.textContent.replace(/\s+/g, ' ')).join(' | '),
      };
    });
    ok('soul alone seeds pq contexts (names)', cold.count === 2, String(cold.count));
    ok('without MPRK derive returns null (honest connect path)', cold.dsaNull);
    ok('chip says derives when keychain connects', /derives when keychain connects/i.test(cold.waitText), cold.waitText);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass}/${pass + fail} pass`);
if (fail) process.exit(1);
