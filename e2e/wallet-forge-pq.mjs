/* wallet-forge-pq.mjs — forge pq: public cards (ML-DSA-65 / X-Wing) beside
   classical contexts. Persist names only. With the keychain live, bpq.js
   derives real PQ keys from masterPRK: the cards must equal what Node derives
   from the same root with the same files (two runtimes, one answer), and the
   copied card must verify. Without the keychain: chip says derives when
   keychain connects. Served like soul-chrome; CI: tests.yml node job. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SURF = join(ROOT, 'surfaces');
// the same two files the page loads, evaluated in Node: the expected answer
const require = createRequire(import.meta.url);
require(join(SURF, 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(SURF, 'bpq.js'));
const NODE_BPQ = globalThis.BPQ;
const EXPECT = NODE_BPQ.keys(new Uint8Array(32).fill(0x2a), 'pq:gatesoul');
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

  /* B · soul + keychain live — pq contexts seeded; real PQ keys derived by bpq.js */
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
        dashed: chips.filter(c => c.pq).map(c => c.dashed),
        chipTexts: pqChips.map(c => c.t.replace(/\s+/g, ' ').trim()),
        pqDom: document.querySelectorAll('#forge-chips [data-pq-card]').length,
        failBox: [...document.querySelectorAll('#forge-sec .stat.err, #forge-chips .chip')].some(el => /fail|error|refused/i.test(el.textContent) && /var\(--amber\)/.test(el.getAttribute('style') || '')),
      };
    });
    ok('pq count is 2 after soul seed', live.count === 2, String(live.count) + ' ' + JSON.stringify(live.contexts));
    ok('contexts include pq:ml-dsa-65:gatesoul', live.contexts.includes('pq:ml-dsa-65:gatesoul'), JSON.stringify(live.contexts));
    ok('contexts include pq:ml-kem-768:gatesoul', live.contexts.includes('pq:ml-kem-768:gatesoul'), JSON.stringify(live.contexts));
    ok('PQ armed on the page (bpq.js)', live.armed === true);
    ok('ml-dsa-65 card is the bzpq1 id Node derives from the same root', !!(live.dsa && live.dsa.derived && live.dsa.value === EXPECT.id), JSON.stringify(live.dsa && live.dsa.value) + ' vs ' + EXPECT.id);
    ok('ml-kem-768 card is the X-Wing fingerprint Node derives', !!(live.kem && live.kem.derived && live.kem.value === 'x-wing ' + NODE_BPQ.fingerprint(EXPECT.kem.publicKey)), JSON.stringify(live.kem && live.kem.value));
    const card = live.dsa && live.dsa.copy ? JSON.parse(live.dsa.copy) : null;
    ok('copied public card verifies in Node and names the same id', !!(card && NODE_BPQ.verifyCard(card) && card.id === EXPECT.id));
    ok('copied card carries no secret material', !!(card && Object.keys(card).sort().join(',') === 'bpq,dsa,id,kem,sig,succ'), card ? Object.keys(card).join(',') : 'none');
    ok('DOM paints two data-pq-card chips', live.pqDom === 2, String(live.pqDom));
    ok('armed chips are solid, not stubs', live.dashed.length === 2 && live.dashed.every(d => d === false), JSON.stringify(live.dashed));
    ok('chips name the PQ id and the seal-to-me key', live.chipTexts.some(t => /your PQ id/.test(t)) && live.chipTexts.some(t => /seal-to-me key/.test(t)), JSON.stringify(live.chipTexts));
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

  /* D · only me: seal in the page, open in the page, open the same bytes in Node;
     bind the classical accounts to the PQ id and verify the binding in Node */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
    await page.goto(`${BASE}/surfaces/wallet.html#pq-sec`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BNRWALLET && window.BPQ, null, { timeout: 20000 });
    const gateCold = await page.evaluate(() => ({ gate: !document.getElementById('pq-gate').hidden, tools: document.getElementById('pq-tools').hidden }));
    ok('seal panel waits for the keychain (tools hidden, gate shown)', gateCold.gate && gateCold.tools, JSON.stringify(gateCold));
    await page.evaluate(() => {
      const mprk = new Uint8Array(32).fill(0x2a);
      const code = window.BZDIDKEY.encodeRecoveryCode(mprk);
      const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = code;
      document.getElementById('kc-recgo').click();
    });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
    ok('seal tools appear with the keychain', await page.evaluate(() => !document.getElementById('pq-tools').hidden));
    const secret = 'only me — ' + 'x'.repeat(70000);
    await page.setInputFiles('#pq-file', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from(secret) });
    await page.evaluate(() => document.getElementById('pq-seal').click());
    await page.waitForSelector('#pq-seal-stat a', { state: 'attached', timeout: 20000 });
    const sealed = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('#pq-seal-stat a').href)).arrayBuffer()))));
    ok('sealed file is a bpq1 object that does not contain the plaintext', NODE_BPQ.isSealed(new Uint8Array(sealed)) && sealed.indexOf('only me') < 0, String(sealed.length));
    const inNode = await NODE_BPQ.open(new Uint8Array(sealed), { self: EXPECT });
    ok('Node opens the page-sealed file with keys from the same root', Buffer.from(inNode.bytes).toString() === secret && inNode.meta.name === 'note.txt');
    const stranger = NODE_BPQ.keys(new Uint8Array(32).fill(0x2b), 'pq:gatesoul');
    let strangerOpened = false; try { await NODE_BPQ.open(new Uint8Array(sealed), { self: stranger, kem: stranger }); strangerOpened = true; } catch (e) {}
    ok('a different root cannot open it', !strangerOpened);
    await page.setInputFiles('#pq-open-file', { name: 'note.txt.bpq', mimeType: 'application/octet-stream', buffer: sealed });
    await page.evaluate(() => document.getElementById('pq-open').click());
    await page.waitForSelector('#pq-open-stat a', { state: 'attached', timeout: 20000 });
    const opened = await page.evaluate(async () => ({ text: await (await fetch(document.querySelector('#pq-open-stat a').href)).text(), name: document.querySelector('#pq-open-stat a').download, stat: document.getElementById('pq-open-stat').textContent }));
    ok('the page opens its own sealed file back to the same bytes and name', opened.text === secret && opened.name === 'note.txt', opened.stat.slice(0, 120));
    await page.evaluate(() => document.getElementById('pq-bind').click());
    await page.waitForSelector('#pq-bind-stat a', { state: 'attached', timeout: 20000 });
    const binding = await page.evaluate(async () => JSON.parse(await (await fetch(document.querySelector('#pq-bind-stat a').href)).text()));
    ok('binding verifies in Node under the bzpq1 id', NODE_BPQ.verifyBind(binding) && binding.id === EXPECT.id, JSON.stringify(Object.keys(binding.claims || {})));
    // OpenTimestamps against mocked calendars: no network in CI, same bytes as a real reply's shape
    const pending = Buffer.concat([Buffer.from([0x00, 0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e, 0x0e]), Buffer.from('https://mock/x')]);
    let calendarHits = 0;
    await page.route(/\/digest$/, route => { calendarHits++; route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/vnd.opentimestamps.v1' }, body: pending }); });
    await page.evaluate(() => document.getElementById('pq-ots').click());
    await page.waitForFunction(() => [...document.querySelectorAll('#pq-bind-stat a')].some(x => /\.ots$/.test(x.download)), null, { timeout: 20000 });
    const ots = Buffer.from(await page.evaluate(async () => { const x = [...document.querySelectorAll('#pq-bind-stat a')].find(y => /\.ots$/.test(y.download)); return Array.from(new Uint8Array(await (await fetch(x.href)).arrayBuffer())); }));
    const bindingBytes = Buffer.from(await page.evaluate(async () => { const x = [...document.querySelectorAll('#pq-bind-stat a')].find(y => /\.json$/.test(y.download)); return Array.from(new Uint8Array(await (await fetch(x.href)).arrayBuffer())); }));
    const magic = Buffer.concat([Buffer.from('\0OpenTimestamps\0\0Proof\0'), Buffer.from([0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94])]);
    const digest = (await import('node:crypto')).createHash('sha256').update(bindingBytes).digest();
    ok('the .ots stamps exactly the saved binding (magic, v1, sha256, digest, one branch per calendar)',
      ots.subarray(0, magic.length).equals(magic) && ots[magic.length] === 1 && ots[magic.length + 1] === 0x08 && ots.subarray(magic.length + 2, magic.length + 34).equals(digest) && calendarHits === 3 && ots.length === magic.length + 34 + 2 + pending.length * 3,
      'len ' + ots.length + ' hits ' + calendarHits);
    ok('binding names the derived accounts and carries the bzDiD Ed25519 co-signature', !!(binding.claims && binding.claims.evm && binding.claims['bzdid-ed25519'] && binding.cosign && binding.cosign[0] && binding.cosign[0].alg === 'ed25519'), JSON.stringify(binding.claims));
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
