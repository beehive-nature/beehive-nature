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
    ok('an only-me file says so: its one slot opened with your own key', /unsigned, an only-me file: its one key slot opens with your own key/.test(opened.stat), opened.stat.slice(0, 160));
    // sealed in Node by a stranger, to this soul as a READER, unsigned: never called only-me
    const toMe = await NODE_BPQ.seal(new TextEncoder().encode('for a reader'), { self: stranger, to: [EXPECT.kem.publicKey], meta: { name: 'shared.txt', type: 'text/plain' } });
    await page.setInputFiles('#pq-open-file', { name: 'shared.txt.bpq', mimeType: 'application/octet-stream', buffer: Buffer.from(toMe) });
    await page.evaluate(() => { document.getElementById('pq-open-stat').textContent = ''; document.getElementById('pq-open').click(); });
    await page.waitForSelector('#pq-open-stat a', { state: 'attached', timeout: 20000 });
    const readerStat = await page.evaluate(() => document.getElementById('pq-open-stat').textContent);
    ok('a file opened through a reader slot says nothing proves who sealed it, never only-me',
      /unsigned: nothing proves who sealed it \(opened through a reader slot\)/.test(readerStat) && !/only-me/.test(readerStat), readerStat.slice(0, 160));
    await page.setInputFiles('#pq-sign-file', { name: 'ruling.md', mimeType: 'text/markdown', buffer: Buffer.from('# a ruling\n') });
    await page.evaluate(() => document.getElementById('pq-sign').click());
    await page.waitForSelector('#pq-sign-stat a', { state: 'attached', timeout: 20000 });
    const sigJson = await page.evaluate(async () => (await (await fetch(document.querySelector('#pq-sign-stat a').href)).text()));
    ok('page-made detached signature verifies in Node for that file only', NODE_BPQ.verifyFile(JSON.parse(sigJson), new TextEncoder().encode('# a ruling\n')).id === EXPECT.id && !NODE_BPQ.verifyFile(JSON.parse(sigJson), new TextEncoder().encode('# a ruling!\n')).ok);
    await page.setInputFiles('#pq-ver-target', { name: 'ruling.md', mimeType: 'text/markdown', buffer: Buffer.from('# a ruling\n') });
    await page.setInputFiles('#pq-ver-sig', { name: 'ruling.md.bpqsig.json', mimeType: 'application/json', buffer: Buffer.from(sigJson) });
    await page.evaluate(() => document.getElementById('pq-verify').click());
    await page.waitForFunction(() => /✓|✗/.test(document.getElementById('pq-verify-stat').textContent), null, { timeout: 10000 });
    const verStat = await page.evaluate(() => document.getElementById('pq-verify-stat').textContent);
    ok('the page checks its own signature and calls its time a claim', /^✓ ruling\.md is signed by bzpq1\S+ \(ML-DSA-65\); it says it was signed at \d{4}-/.test(verStat), verStat);
    await page.evaluate(() => document.getElementById('pq-bind').click());
    await page.waitForSelector('#pq-bind-stat a', { state: 'attached', timeout: 20000 });
    const binding = await page.evaluate(async () => JSON.parse(await (await fetch(document.querySelector('#pq-bind-stat a').href)).text()));
    ok('binding verifies in Node under the bzpq1 id', NODE_BPQ.verifyBind(binding) && binding.id === EXPECT.id, JSON.stringify(Object.keys(binding.claims || {})));
    // OpenTimestamps against mocked calendars: no network in CI, same bytes as a real reply's shape
    // the real wire shape of a calendar reply: ops (append 16 bytes, sha256), then
    // 0x00 + PENDING tag + varbytes(payload), the payload being varbytes(uri)
    const pending = Buffer.concat([Buffer.from([0xf0, 0x10]), Buffer.alloc(16, 7), Buffer.from([0x08, 0x00, 0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e, 0x0f, 0x0e]), Buffer.from('https://mock/x')]);
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
    const otsWords = await page.evaluate(() => document.getElementById('pq-bind-stat').textContent);
    ok('the stamp is called pending, needs ots upgrade, and the page says it does not check it',
      /3 calendars hold a pending stamp/.test(otsWords) && /ots upgrade/.test(otsWords) && /nothing on this page checks it/.test(otsWords) && !/it completes once/.test(otsWords), otsWords.slice(-400));
    // one calendar answers 200 with an HTML page: it is refused, not counted, not spliced
    await page.unroute(/\/digest$/);
    const html = Buffer.from('<!doctype html><html><body>calendar maintenance</body></html>');
    await page.route(/\/digest$/, route => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': /a\.pool\.opentimestamps/.test(route.request().url()) ? 'text/html' : 'application/vnd.opentimestamps.v1' }, body: /a\.pool\.opentimestamps/.test(route.request().url()) ? html : pending }));
    await page.evaluate(() => document.getElementById('pq-bind').click());
    await page.waitForSelector('#pq-ots', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => document.getElementById('pq-ots').click());
    await page.waitForFunction(() => [...document.querySelectorAll('#pq-bind-stat a')].some(x => /\.ots$/.test(x.download)), null, { timeout: 20000 });
    const ots2 = Buffer.from(await page.evaluate(async () => { const x = [...document.querySelectorAll('#pq-bind-stat a')].find(y => /\.ots$/.test(y.download)); return Array.from(new Uint8Array(await (await fetch(x.href)).arrayBuffer())); }));
    const words2 = await page.evaluate(() => document.getElementById('pq-bind-stat').textContent);
    ok('an HTML calendar reply is not counted and not spliced into the .ots',
      /2 calendars hold a pending stamp/.test(words2) && ots2.length === magic.length + 34 + 1 + pending.length * 2 && ots2.indexOf('<!doctype') < 0 && ots2.indexOf('maintenance') < 0,
      'len ' + ots2.length + ' · ' + words2.slice(-300, -200));
    // a reply that forks at its top level, and one with a zero-length append: both refused, as the ots client would
    const forked = Buffer.concat([Buffer.from([0xff]), pending, pending]);
    const emptyArg = Buffer.concat([Buffer.from([0xf0, 0x00]), pending.subarray(18)]);
    await page.unroute(/\/digest$/);
    await page.route(/\/digest$/, route => { const u = route.request().url(); route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: /a\.pool\.opentimestamps/.test(u) ? forked : /b\.pool\.opentimestamps/.test(u) ? emptyArg : pending }); });
    await page.evaluate(() => document.getElementById('pq-bind').click());
    await page.waitForSelector('#pq-ots', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => document.getElementById('pq-ots').click());
    await page.waitForFunction(() => [...document.querySelectorAll('#pq-bind-stat a')].some(x => /\.ots$/.test(x.download)), null, { timeout: 20000 });
    const ots3 = Buffer.from(await page.evaluate(async () => { const x = [...document.querySelectorAll('#pq-bind-stat a')].find(y => /\.ots$/.test(y.download)); return Array.from(new Uint8Array(await (await fetch(x.href)).arrayBuffer())); }));
    const words3 = await page.evaluate(() => document.getElementById('pq-bind-stat').textContent);
    ok('a top-level fork and a zero-length append are refused; only the clean reply is kept',
      /1 calendar holds a pending stamp/.test(words3) && ots3.length === magic.length + 34 + pending.length && ots3.subarray(magic.length + 34).equals(pending),
      'len ' + ots3.length);
    // every calendar answers junk: no stamp is made
    await page.unroute(/\/digest$/);
    await page.route(/\/digest$/, route => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: html }));
    await page.evaluate(() => document.getElementById('pq-bind').click());
    await page.waitForSelector('#pq-ots', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => document.getElementById('pq-ots').click());
    await page.waitForFunction(() => /no stamp was made/.test(document.getElementById('pq-bind-stat').textContent), null, { timeout: 20000 });
    ok('when no calendar gives a pending stamp, the page says no stamp was made and offers no .ots',
      await page.evaluate(() => ![...document.querySelectorAll('#pq-bind-stat a')].some(x => /\.ots$/.test(x.download))));
    await page.unroute(/\/digest$/);
    // a successor id with a broken bech32m checksum is refused before anything is signed
    const badSucc = NODE_BPQ.keys(new Uint8Array(32).fill(0x2c), 'pq:next').id.replace(/.$/, c => (c === 'q' ? 'p' : 'q'));
    await page.evaluate(s => { document.getElementById('pq-succ').value = s; document.getElementById('pq-bind').click(); }, badSucc);
    const succStat = await page.evaluate(() => ({ t: document.getElementById('pq-bind-stat').textContent, links: document.querySelectorAll('#pq-bind-stat a').length }));
    ok('a bzpq1 successor with a bad checksum is refused and nothing is signed', /fails its checksum/.test(succStat.t) && succStat.links === 0, JSON.stringify(succStat));
    await page.evaluate(() => { document.getElementById('pq-succ').value = ''; });
    // Only me → My Data: the sealed bytes, and nothing else, land on My Data's shelf on this device
    await page.evaluate(() => document.getElementById('pq-to-mydata').click());
    await page.waitForSelector('#pq-mydata-link', { state: 'attached', timeout: 10000 });
    const shelved = await page.evaluate(() => new Promise((resolve, reject) => {
      const rq = indexedDB.open('bdata-local-shelf', 1);
      rq.onerror = () => reject(rq.error);
      rq.onsuccess = () => { const all = rq.result.transaction('artifacts', 'readonly').objectStore('artifacts').getAll(); all.onsuccess = async () => { const r = all.result; rq.result.close(); resolve(await Promise.all(r.map(async x => ({ sha256: x.sha256, name: x.name, keys: Object.keys(x).sort().join(','), bytes: Array.from(new Uint8Array(await x.blob.arrayBuffer())) })))); }; };
    }));
    const shelfSha = (await import('node:crypto')).createHash('sha256').update(sealed).digest('hex');
    ok('My Data shelf holds exactly the sealed bytes under their sha256, no key and no plaintext',
      shelved.length === 1 && shelved[0].sha256 === shelfSha && Buffer.from(shelved[0].bytes).equals(sealed) && shelved[0].name === 'note.txt.bpq' && shelved[0].keys === 'at,blob,bytes,name,sha256,shelf',
      JSON.stringify(shelved.map(x => [x.name, x.keys, x.bytes.length])));
    await page.route('http://127.0.0.1:8807/**', route => route.abort());
    await page.goto(`${BASE}/surfaces/bdata.html`, { waitUntil: 'load' });
    await page.waitForSelector('[data-bdata-sealed]', { state: 'attached', timeout: 15000 });
    const md = await page.evaluate(() => ({ shelf: document.querySelector('[data-bdata-intake-ok]')?.getAttribute('data-bdata-intake-shelf'), sha: document.querySelector('[data-bdata-intake-ok]')?.textContent, honest: !!document.querySelector('[data-bdata-intake-honest]'), link: document.querySelector('[data-bdata-seal-link]')?.getAttribute('href') }));
    ok('My Data shows the kept file as sealed, still on this device, and links back to the seal panel',
      md.shelf === 'browser' && md.honest && (md.sha || '').includes(shelfSha.slice(0, 16)) && md.link === 'wallet.html#pq-file', JSON.stringify(md));
    await page.close();
  }

  /* E · device registry against MOCKED relays (a fake WebSocket; no live relay
     is ever opened): newest by the signed time wins over first-to-answer, a
     rollback below this browser's high-water mark is refused, a classical list
     after a PQ one is refused, "nothing here" needs relays that answered in
     full, a flooding relay is cut off, a fast clock cannot raise the mark, and
     nothing is built on a list that is not PQ-verified until the human chooses
     this device's own view. */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.addInitScript(() => {
      try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {}
      window.__dmRelays = {}; window.__dmDelay = {}; window.__dmFail = {}; window.__dmFlood = {};
      window.__wsOpened = []; window.__wsSent = []; window.__wsDelivered = {};
      class FakeWS {
        constructor(url) {
          this.url = url; this.readyState = 0; window.__wsOpened.push(url);
          if (window.__dmFail[url]) { setTimeout(() => { this.readyState = 3; this.onerror && this.onerror({}); this.onclose && this.onclose({}); }, 2); return; }
          setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 2);
        }
        deliver(msg) { if (this.readyState !== 1) return; window.__wsDelivered[this.url] = (window.__wsDelivered[this.url] || 0) + 1; this.onmessage && this.onmessage({ data: JSON.stringify(msg) }); }
        send(s) {
          const m = JSON.parse(s); window.__wsSent.push([this.url, m]);
          if (m[0] !== 'REQ') return;
          const evs = window.__dmRelays[this.url] || [], flood = window.__dmFlood[this.url];
          setTimeout(() => {
            if (flood) { for (let i = 0; i < flood.n; i++) this.deliver(['EVENT', m[1], flood.ev]); }
            evs.forEach(e => this.deliver(['EVENT', m[1], e]));
            if (this.readyState === 1) this.onmessage && this.onmessage({ data: JSON.stringify(['EOSE', m[1]]) });
          }, window.__dmDelay[this.url] || 2);
        }
        close() { if (this.readyState === 3) return; this.readyState = 3; setTimeout(() => this.onclose && this.onclose({}), 0); }
      }
      window.WebSocket = FakeWS;
    });
    await page.goto(`${BASE}/surfaces/wallet.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BnrSign && window.BPQ, null, { timeout: 20000 });
    await page.evaluate(() => {
      const mprk = new Uint8Array(32).fill(0x2a);
      const code = window.BZDIDKEY.encodeRecoveryCode(mprk);
      const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = code;
      document.getElementById('kc-recgo').click();
      // test-side event maker: the soul's registry nostr key and PQ key, from the same TEST root
      const BN = window.BnrSign, hex = u => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
      const sk = window.BZDIDKEY.deriveK1Key(mprk, 'nostr:bnr-devices').seed.slice();
      window.__mkEv = (body, created) => {
        const ev = { pubkey: hex(BN.schnorr.getPublicKey(sk)), created_at: created, kind: 30078, tags: [['d', 'bnr-devices-v1']], content: JSON.stringify(body) };
        const ser = '[0,"' + ev.pubkey + '",' + ev.created_at + ',' + ev.kind + ',' + JSON.stringify(ev.tags) + ',' + JSON.stringify(ev.content) + ']';
        ev.id = hex(BN.sha256(new TextEncoder().encode(ser)));
        ev.sig = hex(BN.schnorr.sign(Uint8Array.from(ev.id.match(/../g).map(h => parseInt(h, 16))), sk));
        return ev;
      };
      const BPQ = window.BPQ;
      window.__v2 = (at, devices, root) => {
        const k = BPQ.keys(new Uint8Array(32).fill(root || 0x2a), 'pq:bnr-devices');
        return { v: 2, at, devices, pqsig: BPQ.signFile(k, new TextEncoder().encode(JSON.stringify({ at, devices })), at) };
      };
      window.__hwmKey = () => Object.keys(JSON.parse(localStorage.getItem('bnr_dm_hwm') || '{}'))[0];
      window.__lastEvent = () => { const x = window.__wsSent.filter(y => y[1][0] === 'EVENT').pop(); return x ? JSON.parse(x[1][1].content) : null; };
    });
    await page.waitForFunction(() => /keychain live/.test(document.getElementById('kc-stat').textContent), null, { timeout: 15000 });
    const R = await page.evaluate(() => { const m = document.documentElement.innerHTML.match(/QR_RELAYS=\[([^\]]+)\]/); return m[1].split(',').map(s => s.replace(/'/g, '').trim()); });
    const openDm = async () => {
      await page.evaluate(() => { document.getElementById('dm-stat').textContent = ''; document.getElementById('dm-open').click(); });
      await page.waitForFunction(() => { const t = document.getElementById('dm-stat').textContent; return t && !/^loading/.test(t); }, null, { timeout: 10000 });
      return page.evaluate(() => ({
        stat: document.getElementById('dm-stat').textContent,
        head: document.querySelector('[data-dm-reg]')?.textContent || '',
        trust: document.querySelector('[data-dm-trust]')?.getAttribute('data-dm-trust') || null,
        rows: [...document.querySelectorAll('.dm-rv')].map(b => b.getAttribute('data-c')),
        own: !!document.getElementById('dm-own'),
        hwm: localStorage.getItem('bnr_dm_hwm'),
      }));
    };
    const setRelays = (all, extra = {}) => page.evaluate(({ R, all, extra }) => {
      window.__wsDelivered = {}; window.__dmFail = extra.fail || {}; window.__dmFlood = extra.flood || {}; window.__dmDelay = extra.delay || {};
      R.forEach((u, i) => { window.__dmRelays[u] = all[i] || []; });
    }, { R, all, extra });
    const T1 = '2026-10-01T00:00:00.000Z', T2 = '2026-10-02T00:00:00.000Z', T3 = '2026-10-03T00:00:00.000Z';
    const A = { credId: 'devA', name: 'A', fp: 'fa', at: T1 }, B = { credId: 'devB', name: 'B', fp: 'fb', at: T1 };
    const mk = (body, created) => page.evaluate(({ body, created }) => window.__mkEv(body, created), { body, created });
    const v2 = (at, devs, root) => page.evaluate(({ at, devs, root }) => window.__v2(at, devs, root), { at, devs, root });
    // 0 · nothing anywhere, every relay said so: a new soul may start here
    await setRelays([[], [], []]);
    const s0 = await openDm();
    ok('registry: every relay answered in full with nothing, so a new list may start (no dash in the words)', !s0.own && /^no registry on the relays yet, so this soul's device list starts here$/.test(s0.stat), JSON.stringify(s0));
    // 0b · only one relay answered in full, two failed: never "nothing here"
    await setRelays([[], [], []], { fail: { [R[1]]: 1, [R[2]]: 1 } });
    const s0b = await openDm();
    ok('registry: with only 1 of 3 relays answering, an empty result is not a fresh start', s0b.own && /only 1 of 3 relays answered in full/.test(s0b.stat) && /only 1 of 3 relays answered in full/.test(s0b.head), JSON.stringify(s0b));
    await page.evaluate(() => document.querySelector('#dm-add').click());
    ok('registry: add after a partial answer is refused before any passkey prompt', /Nothing was changed/.test(await page.evaluate(() => document.getElementById('dm-stat').textContent)));
    // 1 · relay 0 is slow and has the newest list (B revoked); relay 1 answers first with the older list
    await setRelays([[await mk(await v2(T2, [A]), 1000)], [await mk(await v2(T1, [A, B]), 2000)], []], { delay: { [R[0]]: 200 } });
    const s1 = await openDm();
    ok('registry: the newest SIGNED list wins, not the first relay to answer', s1.trust === 'pq' && s1.rows.join() === 'devA' && !s1.own, JSON.stringify(s1));
    ok('registry: the high-water mark is a timestamp only, kept under a public-key prefix', (() => { try { const h = JSON.parse(s1.hwm); const ks = Object.keys(h); return ks.length === 1 && /^[0-9a-f]{16}$/.test(ks[0]) && JSON.stringify(h[ks[0]]) === JSON.stringify({ at: T2 }); } catch (e) { return false; } })(), s1.hwm);
    // 2 · every relay now serves only the older (validly signed) list: refused
    const old = await mk(await v2(T1, [A, B]), 3000);
    await setRelays([[old], [old], [old]]);
    const s2 = await openDm();
    ok('registry: an older list than this browser saw is refused (no revoked device comes back)', /not used/.test(s2.stat) && /older list/.test(s2.stat) && s2.rows.length === 0 && s2.trust === null && s2.own, JSON.stringify(s2));
    // 3 · a classical v1 list after a PQ one: refused
    const v1 = await mk({ v: 1, devices: [A, B] }, 4000);
    await setRelays([[v1], [v1], [v1]]);
    const s3 = await openDm();
    ok('registry: a classical list after a post-quantum one is refused', /not used/.test(s3.stat) && /not signed post-quantum/.test(s3.stat) && s3.rows.length === 0, JSON.stringify(s3));
    // 3b · nothing comes back, but this browser saw a list: the header and the status agree
    await setRelays([[], [], []]);
    const s3b = await openDm();
    ok('registry: an empty answer after a seen list says so in the header and the status alike',
      s3b.own && new RegExp('though this browser saw one signed at ' + T2.replace(/\./g, '\\.')).test(s3b.head) && new RegExp('though this browser saw one signed at ' + T2.replace(/\./g, '\\.')).test(s3b.stat) && !/new soul, or never published/.test(s3b.head), JSON.stringify(s3b));
    // 3c · a relay floods 3000 copies of a valid list: cut off after 10, one check, no stall
    const fresh = await mk(await v2(T3, [A]), 5000);
    await setRelays([[], [], []], { flood: { [R[0]]: { n: 3000, ev: fresh } } });
    const t0 = Date.now();
    const s3c = await openDm();
    const flooded = await page.evaluate(u => window.__wsDelivered[u], R[0]);
    ok('registry: a flooding relay is cut off after 10 events and the list still loads quickly', s3c.trust === 'pq' && s3c.rows.join() === 'devA' && flooded <= 11 && Date.now() - t0 < 4000, 'delivered ' + flooded + ' in ' + (Date.now() - t0) + ' ms');
    // 3d · a list signed with a clock a day fast: shown and usable, but the mark is not raised to it
    const future = new Date(Date.now() + 864e5).toISOString();
    const fast = await mk(await v2(future, [A]), 6000);
    await setRelays([[fast], [fast], [fast]]);
    const s3d = await openDm();
    ok('registry: a list dated beyond this clock is shown but never raises the mark',
      s3d.trust === 'pq' && /more than 10 minutes ahead of this device's clock/.test(s3d.stat) && JSON.parse(s3d.hwm)[await page.evaluate(() => window.__hwmKey())].at === T3, JSON.stringify(s3d));
    // 3e · a mark slightly ahead (within the allowance): a publish signs past it, never at or below it
    const near = Date.now() + 5 * 60 * 1000, nearIso = new Date(near).toISOString();
    const nearEv = await mk(await v2(nearIso, [A]), 7000);
    await setRelays([[nearEv], [nearEv], [nearEv]]);
    await page.evaluate(T2 => localStorage.setItem('bnr_seal', JSON.stringify({ credId: 'devA', name: 'A', fp: 'fa', at: T2 })), T2);
    const s3e = await openDm();
    await page.evaluate(() => { window.__wsSent.length = 0; document.querySelector('.dm-rv[data-c="devA"]').click(); });
    await page.waitForFunction(() => window.__wsSent.some(x => x[1][0] === 'EVENT'), null, { timeout: 5000 });
    const pubNear = await page.evaluate(() => window.__lastEvent());
    ok('registry: a publish signs a time after the mark even when this clock is behind it',
      s3e.trust === 'pq' && pubNear.v === 2 && Date.parse(pubNear.at) === near + 1, JSON.stringify({ s: s3e.stat, at: pubNear.at, near: nearIso }));
    // 4 · fresh browser (no mark) and a list whose PQ signature is another key's: shown as bad, never built on
    const badEv = await mk(await v2(T2, [A, B], 0x2b), 8000);
    await page.evaluate(T2 => {
      localStorage.removeItem('bnr_dm_hwm');
      localStorage.setItem('bnr_seal', JSON.stringify({ credId: 'devA', name: 'A', fp: 'fa', at: T2 }));
      window.__wsSent.length = 0;
    }, T2);
    await setRelays([[badEv], [badEv], [badEv]]);
    const s4 = await openDm();
    ok('registry: a list with a foreign PQ signature is shown as bad and offers this device\'s own view', s4.trust === 'bad' && s4.own && s4.rows.join() === 'devA,devB', JSON.stringify(s4));
    await page.evaluate(() => document.querySelector('.dm-rv[data-c="devB"]').click());
    const s4b = await page.evaluate(() => ({ stat: document.getElementById('dm-stat').textContent, events: window.__wsSent.filter(x => x[1][0] === 'EVENT').length }));
    ok('registry: revoke on an unverified list is refused and nothing is published', /Nothing was changed/.test(s4b.stat) && s4b.events === 0, JSON.stringify(s4b));
    await page.evaluate(() => document.getElementById('dm-own').click());
    const s4c = await page.evaluate(() => ({ stat: document.getElementById('dm-stat').textContent, rows: [...document.querySelectorAll('.dm-rv')].map(b => b.getAttribute('data-c')), own: !!document.getElementById('dm-own') }));
    ok('registry: this device\'s own view holds only this browser\'s seal', s4c.rows.join() === 'devA' && !s4c.own && /only what this browser knows/.test(s4c.stat), JSON.stringify(s4c));
    await page.evaluate(() => document.querySelector('.dm-rv[data-c="devA"]').click());
    await page.waitForFunction(() => window.__wsSent.some(x => x[1][0] === 'EVENT'), null, { timeout: 5000 });
    const pub = await page.evaluate(() => {
      const o = window.__lastEvent();
      const r = window.BPQ.verifyFile(o.pqsig, new TextEncoder().encode(JSON.stringify({ at: o.at, devices: o.devices })));
      return { v: o.v, n: o.devices.length, ok: r.ok, id: r.id, want: window.BPQ.keys(new Uint8Array(32).fill(0x2a), 'pq:bnr-devices').id, at: o.at, hwm: JSON.parse(localStorage.getItem('bnr_dm_hwm') || '{}'), trust: document.querySelector('[data-dm-trust]')?.getAttribute('data-dm-trust') };
    });
    ok('registry: a revoke from the own view publishes a v2 list this soul signed post-quantum and raises the mark',
      pub.v === 2 && pub.n === 0 && pub.ok && pub.id === pub.want && Object.values(pub.hwm)[0]?.at === pub.at && pub.trust === 'pq', JSON.stringify(pub));
    // 5 · post-quantum bundle missing, no mark, relays serve a v2 list: no classical list may replace it
    const v2Ev = await mk(await v2(T2, [A, B]), 9000);
    await page.evaluate(T2 => {
      localStorage.removeItem('bnr_dm_hwm');
      localStorage.setItem('bnr_seal', JSON.stringify({ credId: 'devA', name: 'A', fp: 'fa', at: T2 }));
      window.__savedBPQ = window.BPQ; window.BPQ = undefined;
      window.__wsSent.length = 0;
    }, T2);
    await setRelays([[v2Ev], [v2Ev], [v2Ev]]);
    const s5 = await openDm();
    await page.evaluate(() => document.querySelector('.dm-rv[data-c="devB"]').click());
    const s5b = await page.evaluate(() => ({ stat: document.getElementById('dm-stat').textContent, events: window.__wsSent.filter(x => x[1][0] === 'EVENT').length }));
    await page.evaluate(() => { window.BPQ = window.__savedBPQ; });
    ok('registry: without the PQ bundle, a classical list never replaces a post-quantum one',
      s5.trust === 'unchecked' && /cannot sign post-quantum right now/.test(s5b.stat) && /Nothing was changed/.test(s5b.stat) && s5b.events === 0, JSON.stringify({ s5, s5b }));
    ok('registry: only the mocked relay URLs were ever opened', (await page.evaluate(() => window.__wsOpened)).every(u => R.includes(u)));
    await page.close();
  }

  /* F · leaving the page wipes the keys (pagehide, not only beforeunload), and a
     page restored from the back/forward cache reloads instead of showing a live
     keychain with nothing behind it */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'gatesoul'); } catch (e) {} });
    await page.goto(`${BASE}/surfaces/wallet.html#pq-sec`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BZDIDKEY && window.BPQ, null, { timeout: 20000 });
    await page.evaluate(() => {
      const code = window.BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(0x2a));
      const sc = document.getElementById('kc-rec-scaffold'); if (sc) sc.open = true;
      document.getElementById('kc-rec').value = code;
      document.getElementById('kc-recgo').click();
    });
    await page.waitForFunction(() => !document.getElementById('pq-tools').hidden, null, { timeout: 15000 });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await page.waitForFunction(() => document.getElementById('pq-tools').hidden, null, { timeout: 5000 });
    ok('pagehide wipes the keys: the seal tools close and the gate asks to connect', await page.evaluate(() => !document.getElementById('pq-gate').hidden && /connect your keychain/.test(document.getElementById('pq-gate').textContent)));
    const reload = page.waitForEvent('load', { timeout: 15000 });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await reload;
    await page.waitForFunction(() => window.BZDIDKEY && document.getElementById('kc-stat'), null, { timeout: 20000 });
    ok('a page restored from the back/forward cache reloads and starts disconnected', await page.evaluate(() => !/keychain live/.test(document.getElementById('kc-stat').textContent) && document.getElementById('pq-tools').hidden));
    const src = await readFile(join(SURF, 'wallet.html'), 'utf8');
    ok('the QR bridge promises only what holds: wiped when this page closes', /tab memory only, wiped when this page closes'/.test(src) && !/scrubbed on close like every lane here|close or leave this page/.test(src));
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
