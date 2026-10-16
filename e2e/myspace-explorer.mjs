// myspace-explorer.mjs — MY SPACE as an explorer: how fast the list becomes useful, whether a
// stale answer can ever paint, and whether a preview stays inside its boundary.
//
// The ideas are taken as pattern from the Strata file manager (lgse/strata v1.0.0, MIT): bounded
// batches, stale work made harmless, a listing that is not permission, previews that fail closed.
// The kernel is crates/bnr-explorer, run in the page as surfaces/bnr-explorer.wasm inside
// surfaces/bnr-explorer-worker.js. This drives the REAL page in Chromium.
//
//   1  the list does not wait for the slowest rail, and "asking" is never said as "not answering"
//   2  a slow, older read of the index never paints over a newer one
//   3  previews: text, a real PNG, a broken PNG, a decompression bomb, an SVG with a script
//   4  identity: bytes that are not the ones recorded are refused, by the page and by the module
//   5  a listing is not permission: a row that changed or went is refused at the tap, unread
//   6  isolation unavailable means preview unavailable, and the file is never read
//   7  a rail that hangs mid-read cannot hold the page or paint over the look that replaced it
//   8  a share that fails after hand-off never says "nothing left this phone"
//   9  the worker that reads bytes has no network or storage of its own
//   M  measure: first row, all rows, longest My Space frame; cold, warm, one slow rail
//
// Speed is reported, and gated only where the old shape is the regression: no frame with My
// Space work in it may hold the page for more than FREEZE_BUDGET_MS at 20,000 rows (it held it
// 4.5 to 5.3 s before the list was sliced, five cold runs, 2026-10-15).
//
// Run: node e2e/myspace-explorer.mjs            (gate + measure)
//      node e2e/myspace-explorer.mjs --measure  (measure only)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { serveTree, offBox } from './lib/serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// EXPLORER_ROOT serves another tree's surfaces/ (e.g. `git archive <sha> surfaces`) so the same
// meter can read the page as it was before; only --measure makes sense against it
const SERVE = process.env.EXPLORER_ROOT || ROOT;
const MEASURE_ONLY = process.argv.includes('--measure');
const ONLY_PRIVACY = process.argv.includes('--only-privacy');   // section 10 alone (also how it is run red against an older tree)
const SIZES = (process.env.EXPLORER_SIZES || '200,2000,20000').split(',').map(Number);
const RUNS = Number(process.env.EXPLORER_RUNS || 5);
const SLOW_MS = 3000;
const FREEZE_BUDGET_MS = 2500;

const { base: BASE, close } = await serveTree(SERVE);
const PAGE = `${BASE}/surfaces/myspace.html`;
const browser = await chromium.launch();
const sha = b => createHash('sha256').update(b).digest('hex');
// the mocked hive answers every CORS preflight, so a test about a GET or a PUT is about that request
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Expose-Headers': '*' };
const preflight = r => r.request().method() === 'OPTIONS' ? (r.fulfill({ status: 204, headers: CORS }), true) : false;

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

/* ---------- fixtures, built here, no binary files in the tree ---------- */
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (const b of buf) { c = (crc ^ b) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, idat) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = idat || deflateSync(Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 4, 0x7f)]))));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', raw), chunk('IEND', Buffer.alloc(0))]);
}
const PNG_OK = png(2, 2);
const PNG_BAD_CRC = (() => { const b = Buffer.from(PNG_OK); b[29] ^= 1; return b; })();
const PNG_BOMB = png(20000, 20000, deflateSync(Buffer.alloc(16)));
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"><script>window.__pwned=1</script></svg>');
const TEXT = 'a look before saving\nsecond line\n';

/* ---------- the page ---------- */
async function context(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const outside = [];
  await ctx.route('**/*', async r => {
    const u = r.request().url();
    if (opts.route) { const done = await opts.route(r, u); if (done) return; }
    if (offBox(u, BASE)) { outside.push(u); return r.abort('blockedbyclient'); }
    if (opts.slowBlossom && u.includes('myspace-adapter-blossom.js')) await new Promise(f => setTimeout(f, opts.slowBlossom));
    return r.continue();
  });
  if (opts.init) await ctx.addInitScript(opts.init);
  return { ctx, outside };
}

async function seedRows(ctx, rows) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/surfaces/manifest.webmanifest`); // same origin, no page script
  await p.evaluate(async rows => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('myspace', 2);
      r.onupgradeneeded = () => { const d = r.result; for (const s of ['files', 'keys', 'blobs']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, s === 'files' ? { keyPath: 'id' } : undefined); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); for (const row of rows) t.objectStore('files').put(row); t.oncomplete = res; t.onerror = () => rej(t.error); });
    db.close();
  }, rows);
  await p.close();
}

async function open(ctx) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(PAGE, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__myspace && window.__myspace.purposes().length >= 2 &&
    ['temp', 'local', 'blossom', 'ant'].every(s => window.__myspace.phase(s) !== 'asking'), null, { timeout: 20000 });
  return { p, errs };
}

async function add(p, purpose, name, mimeType, buffer) {
  await p.click(`#mode-${purpose}`);
  const seq0 = Number(await p.evaluate(() => document.body.getAttribute('data-busy-seq')));
  await p.setInputFiles('#picker', { name, mimeType, buffer });
  await p.waitForFunction(s => Number(document.body.getAttribute('data-busy-seq')) > s && document.body.getAttribute('data-busy') === '0', seq0, { timeout: 15000 });
  const rows = await p.evaluate(() => window.__myspace.rows());
  return rows.find(r => r.name === name);
}

async function look(p, id) {
  await p.click(`#look-${id}`);
  await p.waitForFunction(() => {
    const v = document.getElementById('look-view');
    return document.body.dataset.state === 'look' && v.dataset.kind && v.dataset.kind !== 'reading';
  }, null, { timeout: 15000 });
  if (await p.evaluate(() => document.getElementById('look-view').dataset.kind === 'image')) {
    await p.waitForFunction(() => { const i = document.querySelector('#look-view img'); return !i || i.complete; }, null, { timeout: 5000 }).catch(() => {});
  }
  return p.evaluate(() => {
    const v = document.getElementById('look-view'), img = v.querySelector('img'), pre = v.querySelector('pre');
    return { kind: v.dataset.kind, reason: v.dataset.reason || null, body: document.getElementById('look-body').textContent,
      title: document.getElementById('look-title').textContent, pre: pre ? pre.textContent : null,
      img: img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 5) } : null };
  });
}

async function closeLook(p) {
  await p.click('#lookClose');
  await p.waitForFunction(() => document.body.dataset.state !== 'look', null, { timeout: 5000 });
}

const sent = (p, scheme) => p.evaluate(s => window.__myspace.adapter(s).telemetry.sent, scheme);

async function gate() {
  // ── 1 · the list does not wait for the slowest rail ────────────────────────
  console.log('\n1 · first useful rows: each row says its own rail\'s state; one slow rail holds nothing');
  {
    const { ctx } = await context({
      slowBlossom: SLOW_MS,
      init: () => {
        window.__snaps = [];
        const take = () => {
          const rows = [...document.querySelectorAll('#list article.file')].map(a => [a.querySelector('.name').textContent, a.querySelector('.why').textContent]);
          const k = JSON.stringify(rows);
          if (!window.__snaps.length || window.__snaps[window.__snaps.length - 1].k !== k) window.__snaps.push({ t: performance.now(), rows, k });
        };
        new MutationObserver(take).observe(document, { childList: true, subtree: true, characterData: true });
      }
    });
    const A = 'a'.repeat(64);
    await seedRows(ctx, [
      { id: 'k1', name: 'kept.txt', size: 5, purpose: 'keep', ts: 3, addr: { scheme: 'local', address: A } },
      { id: 't1', name: 'visit-only.txt', size: 5, purpose: 'now', ts: 2, addr: { scheme: 'temp', address: A } },
      { id: 'g1', name: 'nowhere.txt', size: 5, purpose: 'keep', ts: 1, addr: { scheme: 'gone-rail', address: A } }
    ]);
    const p = await ctx.newPage();
    await p.goto(PAGE, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__myspace && window.__myspace.phase('blossom') !== 'asking', null, { timeout: 20000 });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ snaps: window.__snaps, blossomAt: performance.now() }));
    const truth = 'Only this phone opens it.';
    const firstTrue = r.snaps.find(s => s.rows.some(([n, w]) => n === 'kept.txt' && w.startsWith(truth)));
    const lies = r.snaps.filter(s => s.rows.some(([n, w]) => n !== 'nowhere.txt' && /not answering/.test(w)));
    const control = r.snaps.some(s => s.rows.some(([n, w]) => n === 'nowhere.txt' && /not answering/.test(w)));
    const lastVisit = [...r.snaps].reverse().find(s => s.rows.some(([n]) => n === 'visit-only.txt'));
    ok('the kept file shows its own rail\'s true words long before the slow rail answers',
      !!firstTrue && firstTrue.t < SLOW_MS - 1000, firstTrue ? Math.round(firstTrue.t) + ' ms' : 'never');
    ok('no row on a rail that was only starting ever said "not answering"', lies.length === 0, JSON.stringify(lies[0] && lies[0].rows));
    ok('CONTROL — a row on a rail this page does not have does say it, so the scan can see the sentence', control);
    ok('the this-visit-only file was swept by its own rail\'s answer, before the slow rail answered',
      !!lastVisit && lastVisit.t < SLOW_MS - 1000, lastVisit ? Math.round(lastVisit.t) + ' ms' : 'never seen');
    ok('PRECONDITION — the slow rail really was slow: it answered after the hold', r.blossomAt >= SLOW_MS, Math.round(r.blossomAt) + ' ms');
    await ctx.close();
  }

  // ── 2 · a slow older read never paints over a newer one ────────────────────
  console.log('\n2 · stale work is harmless: an older read of the index that answers late is dropped');
  {
    const { ctx } = await context({
      init: () => {
        const desc = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
        const orig = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (stores, mode) {
          const t = orig.apply(this, arguments);
          if (window.__holdRead && mode !== 'readwrite') {
            const ms = window.__holdRead; window.__holdRead = 0;
            Object.defineProperty(t, 'oncomplete', { configurable: true, get() { return null; },
              set(fn) { desc.set.call(t, ev => setTimeout(() => { window.__heldFiredAt = performance.now(); fn.call(t, ev); }, ms)); } });
          }
          return t;
        };
      }
    });
    const A = 'a'.repeat(64);
    await seedRows(ctx, ['one', 'two', 'three'].map((n, i) => ({ id: 's' + i, name: n + '.txt', size: 3, purpose: 'keep', ts: 10 - i, addr: { scheme: 'local', address: A } })));
    const { p, errs } = await open(ctx);
    await p.evaluate(() => window.__myspace.render());
    const r = await p.evaluate(async () => {
      const list = document.getElementById('list');
      const seen = [];
      new MutationObserver(() => seen.push({ t: performance.now(), names: [...list.querySelectorAll('.name')].map(n => n.textContent) })).observe(list, { childList: true, subtree: true });
      window.__holdRead = 900;
      window.__myspace.render();                                   // the slow, older read: three rows
      await new Promise(r => setTimeout(r, 50));
      const db = await new Promise(res => { const q = indexedDB.open('myspace', 2); q.onsuccess = () => res(q.result); });
      await new Promise(res => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete('s1'); t.oncomplete = res; });
      db.close();
      await window.__myspace.render();                             // the newer read: two rows
      const newerAt = performance.now();
      await new Promise(r => setTimeout(r, 1400));
      return { seen, newerAt, heldAt: window.__heldFiredAt || 0, final: [...list.querySelectorAll('.name')].map(n => n.textContent) };
    });
    const late = r.seen.filter(s => s.t > r.newerAt && s.names.includes('two.txt'));
    ok('PRECONDITION — the older read really answered after the newer list was drawn', r.heldAt > r.newerAt, `held ${Math.round(r.heldAt)} vs newer ${Math.round(r.newerAt)}`);
    ok('the deleted row never came back after the newer list was drawn', late.length === 0, JSON.stringify(late[0]));
    ok('the list is the index as it is now', JSON.stringify(r.final) === JSON.stringify(['one.txt', 'three.txt']), JSON.stringify(r.final));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── 3 · previews, and 9 · the worker's own reach ───────────────────────────
  console.log('\n3 · previews come from the module, bounded, checked, and drawn only when sound');
  const { ctx: c3, outside: out3 } = await context();
  const { p: p3, errs: errs3 } = await open(c3);
  const files = {};
  files.text = await add(p3, 'keep', 'note.txt', 'text/plain', Buffer.from(TEXT));
  files.png = await add(p3, 'keep', 'dot.png', 'image/png', PNG_OK);
  files.bad = await add(p3, 'keep', 'broken.png', 'image/png', PNG_BAD_CRC);
  files.bomb = await add(p3, 'keep', 'bomb.png', 'image/png', PNG_BOMB);
  files.svg = await add(p3, 'keep', 'trap.svg', 'image/svg+xml', SVG);
  files.named = await add(p3, 'keep', 'not-a-picture.png', 'image/png', Buffer.from(TEXT));
  ok('PRECONDITION — six files kept, each with the digest of what was added', Object.values(files).every(f => f && /^[0-9a-f]{64}$/.test(f.sha256)) &&
    files.png.sha256 === sha(PNG_OK), JSON.stringify(Object.values(files).map(f => f && f.name)));
  ok('the index recorded what was added, not what the rail holds', files.text.sha256 === sha(Buffer.from(TEXT)) && files.text.addr.address !== files.text.sha256);

  let t0 = Date.now();
  let v = await look(p3, files.text.id);
  const coldLook = Date.now() - t0;
  ok('text: shown as text, exactly, and checked against what was added',
    v.kind === 'text' && v.pre === TEXT && /^Checked/.test(v.body), JSON.stringify(v));
  await closeLook(p3);
  t0 = Date.now();
  await look(p3, files.text.id);
  const warmLook = Date.now() - t0;
  await closeLook(p3);
  console.log(`  first verified preview, tap to checked text on screen: ${coldLook} ms with the worker cold (module fetched, pinned, compiled), ${warmLook} ms warm`);
  v = await look(p3, files.png.id);
  ok('a real PNG: drawn from the checked bytes, at its own size', v.kind === 'image' && v.img && v.img.w === 2 && v.img.h === 2 && v.img.src === 'blob:' && /PNG · 2 × 2/.test(v.body), JSON.stringify(v));
  await closeLook(p3);
  v = await look(p3, files.bad.id);
  ok('a PNG with one wrong checksum byte: not drawn, and said why', v.kind === 'none' && v.reason === '4' && !v.img && /broken/.test(v.body), JSON.stringify(v));
  await closeLook(p3);
  v = await look(p3, files.bomb.id);
  ok('a 20000 × 20000 header over 16 bytes of data: refused from the header, never decoded', v.kind === 'none' && v.reason === '5' && !v.img && /50 million/.test(v.body), JSON.stringify(v));
  await closeLook(p3);
  v = await look(p3, files.svg.id);
  const pwned = await p3.evaluate(() => window.__pwned);
  ok('an SVG with a script is text to read, never an image to run', v.kind === 'text' && /^<svg/.test(v.pre) && !v.img && pwned === undefined, JSON.stringify({ v, pwned }));
  await closeLook(p3);
  v = await look(p3, files.named.id);
  ok('the content decides, not the name: a ".png" that is text is shown as text', v.kind === 'text' && v.pre === TEXT, JSON.stringify(v));

  console.log('\n9 · the worker that reads the bytes has no network or storage of its own');
  const w = p3.workers().find(x => x.url().endsWith('/bnr-explorer-worker.js'));
  const reach = w ? await w.evaluate(() => [typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof indexedDB, typeof importScripts, typeof caches]) : null;
  ok('fetch, XMLHttpRequest, WebSocket, indexedDB, importScripts and caches are all gone inside it',
    !!reach && reach.every(x => x === 'undefined'), JSON.stringify(reach));
  const lk = await p3.evaluate(() => window.__myspace.look());
  ok('the look state is published for the gates (worker up while a look is open, memory in pages)', lk.worker === true && lk.pages > 0, JSON.stringify(lk));
  await closeLook(p3);
  ok('six private looks sent nothing anywhere', out3.length === 0, out3.join(' | '));
  ok('no page errors across the looks', errs3.length === 0, errs3.join(' | '));

  // ── 4 · identity ──────────────────────────────────────────────────────────
  console.log('\n4 · bytes that are not the ones recorded are refused — by the page, and by the module itself');
  const other = sha(Buffer.from('something else entirely'));
  await p3.evaluate(async ([id, digest]) => {
    const db = await new Promise(res => { const q = indexedDB.open('myspace', 2); q.onsuccess = () => res(q.result); });
    const row = await new Promise(res => { const q = db.transaction('files').objectStore('files').get(id); q.onsuccess = () => res(q.result); });
    row.sha256 = digest;
    await new Promise(res => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(row); t.oncomplete = res; });
    db.close();
    await window.__myspace.render();
  }, [files.text.id, other]);
  v = await look(p3, files.text.id);
  ok('a row whose recorded digest is not its bytes: nothing shown, said why', v.kind === 'none' && v.reason === '2' && !v.pre && /not the ones you added/.test(v.body), JSON.stringify(v));
  await closeLook(p3);
  let downloaded = false;
  p3.once('download', () => { downloaded = true; });
  await p3.click(`#open-${files.text.id}`);
  await p3.waitForFunction(() => /not the ones you added/.test(document.getElementById('status').textContent), null, { timeout: 10000 }).catch(() => {});
  await p3.waitForTimeout(500);
  ok('Open refuses the same bytes and hands nothing to the device', !downloaded && /not the ones you added/.test(await p3.textContent('#status')), await p3.textContent('#status'));

  const shell = await readFile(join(ROOT, 'surfaces/myspace.js'), 'utf8');
  const PIN = /PREVIEW_SHA256 = '([0-9a-f]{64})'/.exec(shell)[1];
  const wasm = await readFile(join(ROOT, 'surfaces/bnr-explorer.wasm'));
  ok('the page pins the module that is committed', PIN === sha(wasm), `${PIN} vs ${sha(wasm)}`);
  const direct = await p3.evaluate(async ([PIN, okDigest, wrongDigest]) => {
    const w = new Worker('bnr-explorer-worker.js');
    const next = () => new Promise(r => { w.onmessage = e => r(e.data); });
    w.postMessage({ op: 'init', url: 'bnr-explorer.wasm', pin: PIN });
    const ready = await next();
    const enc = new TextEncoder().encode('plain words');
    w.postMessage({ op: 'preview', id: 1, digest: okDigest, bytes: enc });
    const good = await next();
    w.postMessage({ op: 'preview', id: 2, digest: wrongDigest, bytes: enc });
    const bad = await next();
    const huge = new Uint8Array(32 * 1024 * 1024 + 1);
    w.postMessage({ op: 'preview', id: 3, digest: wrongDigest, bytes: huge });
    const big = await next();
    w.terminate();
    return { ready, good: [...good.bytes.slice(0, 6)], bad: [...bad.bytes], big: { refused: big.refused, bytes: big.bytes } };
  }, [PIN, sha(Buffer.from('plain words')), other]);
  ok('the module, driven directly: the right digest gives a text verdict', direct.ready.op === 'ready' && direct.ready.sha === PIN && direct.good.join() === [0x42, 0x58, 0x50, 0x56, 1, 1].join(), JSON.stringify(direct.ready));
  ok('the module, driven directly: a wrong digest is refused before parsing (reason 2)', direct.bad.join() === [0x42, 0x58, 0x50, 0x56, 1, 3, 2, 0].join(), JSON.stringify(direct.bad));
  ok('the module, driven directly: one byte over 32 MB is refused before it is even copied in (the allocator\'s cap is the budget\'s)', direct.big.refused === 'alloc' && direct.big.bytes === null, JSON.stringify(direct.big));

  // ── 5 · a listing is not permission ───────────────────────────────────────
  console.log('\n5 · the row on screen is a claim about the past: changed or gone is refused at the tap, unread');
  const before5 = await sent(p3, 'local');
  await p3.evaluate(async id => {
    const db = await new Promise(res => { const q = indexedDB.open('myspace', 2); q.onsuccess = () => res(q.result); });
    const row = await new Promise(res => { const q = db.transaction('files').objectStore('files').get(id); q.onsuccess = () => res(q.result); });
    row.addr = { scheme: 'local', address: 'f'.repeat(64) };            // another tab moved it
    await new Promise(res => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(row); t.oncomplete = res; });
    db.close();
  }, files.png.id);
  await p3.click(`#look-${files.png.id}`);
  await p3.waitForFunction(() => /changed since this list was drawn/.test(document.getElementById('status').textContent), null, { timeout: 5000 }).catch(() => {});
  const st5 = await p3.evaluate(() => ({ status: document.getElementById('status').textContent, state: document.body.dataset.state }));
  ok('a row moved elsewhere since it was drawn: refused by name, no sheet opened', /changed since this list was drawn/.test(st5.status) && st5.state !== 'look', JSON.stringify(st5));
  ok('and its rail was never asked for the bytes', (await sent(p3, 'local')) === before5, `${before5} -> ${await sent(p3, 'local')}`);
  await p3.evaluate(async id => {
    const db = await new Promise(res => { const q = indexedDB.open('myspace', 2); q.onsuccess = () => res(q.result); });
    await new Promise(res => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete(id); t.oncomplete = res; });
    db.close();
  }, files.bad.id);
  await p3.click(`#look-${files.bad.id}`);
  await p3.waitForFunction(() => /no longer in your list/.test(document.getElementById('status').textContent), null, { timeout: 5000 }).catch(() => {});
  ok('a row deleted elsewhere: "no longer in your list", and the list is redrawn without it',
    /no longer in your list/.test(await p3.textContent('#status')) && !(await p3.$(`#look-${files.bad.id}`)), await p3.textContent('#status'));
  await c3.close();

  // ── 6 · isolation unavailable ─────────────────────────────────────────────
  console.log('\n6 · no isolation, no preview — and the file is never read');
  const cases6 = [
    { why: 'fetch', words: /did not arrive/, opts: { route: (r, u) => u.includes('bnr-explorer.wasm') ? (r.fulfill({ status: 404, body: '' }), true) : false } },
    { why: 'pin', words: /not the one this page was built with/, opts: { route: async (r, u) => { if (!u.includes('bnr-explorer.wasm')) return false; const resp = await r.fetch(); const b = Buffer.concat([await resp.body(), Buffer.from([0])]); await r.fulfill({ status: 200, contentType: 'application/wasm', body: b }); return true; } } },
    { why: 'wasm', words: /does not run WebAssembly/, opts: { init: () => { delete window.WebAssembly; } } }
  ];
  for (const c of cases6) {
    const { ctx } = await context(c.opts);
    const { p, errs } = await open(ctx);
    const f = await add(p, 'keep', 'private.txt', 'text/plain', Buffer.from(TEXT));
    const s0 = await sent(p, 'local');
    const r6 = await look(p, f.id);
    ok(`${c.why}: previews off, said in words`, r6.kind === 'off' && r6.reason === c.why && c.words.test(r6.body) && /Nothing was read/.test(r6.body), JSON.stringify(r6));
    ok(`${c.why}: the file's bytes were never read`, (await sent(p, 'local')) === s0, `${s0} -> ${await sent(p, 'local')}`);
    ok(`${c.why}: no page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  {
    // a module that asks for one import, given its own pin: the worker refuses it anyway
    const evil = Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 4, 1, 0x60, 0, 0, 2, 9, 1, 3, 0x65, 0x6e, 0x76, 1, 0x66, 0, 0]);
    const { ctx } = await context({ route: (r, u) => u.includes('evil.wasm') ? (r.fulfill({ status: 200, contentType: 'application/wasm', body: evil }), true) : false });
    const { p } = await open(ctx);
    const said = await p.evaluate(async pin => {
      const w = new Worker('bnr-explorer-worker.js');
      const got = new Promise(r => { w.onmessage = e => r(e.data); });
      w.postMessage({ op: 'init', url: 'evil.wasm', pin });
      const m = await got; w.terminate(); return m;
    }, sha(evil));
    ok('a module with an import is refused even when its own digest is the pin', said.op === 'off' && said.why === 'imports', JSON.stringify(said));
    await ctx.close();
  }

  // ── 7 · a rail that hangs mid-read ────────────────────────────────────────
  console.log('\n7 · cancellation under peer failure: a hung read neither holds the page nor paints later');
  {
    let release = null;
    const SLOW = Buffer.from('this came back far too late\n');
    const { ctx } = await context({
      route: (r, u) => {
        if (!/^https:\/\/skaists\.buzz\/media\//.test(u)) return false;
        if (preflight(r)) return true;
        release = () => r.fulfill({ status: 200, contentType: 'image/png', body: SLOW, headers: CORS });
        return true;
      }
    });
    const A = 'b'.repeat(64);
    await seedRows(ctx, [{ id: 'slow1', name: 'from-the-hive.txt', size: SLOW.length, purpose: 'share', ts: 1, addr: { scheme: 'blossom', address: A }, sha256: sha(SLOW) }]);
    const { p, errs } = await open(ctx);
    await p.waitForFunction(() => window.__myspace.phase('blossom') === 'up', null, { timeout: 20000 });
    const near = await add(p, 'keep', 'right-here.txt', 'text/plain', Buffer.from(TEXT));
    await p.click('#look-slow1');
    await p.waitForFunction(() => document.getElementById('look-view').dataset.kind === 'reading', null, { timeout: 5000 });
    for (let i = 0; i < 50 && !release; i++) await p.waitForTimeout(100);
    ok('PRECONDITION — the hive read is in flight and hung', !!release);
    const t0 = Date.now();
    await closeLook(p);
    const v7 = await look(p, near.id);
    const took = Date.now() - t0;
    ok('leaving the hung look and opening another answers at once', v7.kind === 'text' && v7.pre === TEXT && took < 3000, took + ' ms');
    release();
    await p.waitForTimeout(1200);
    const after = await p.evaluate(() => ({ title: document.getElementById('look-title').textContent, pre: (document.querySelector('#look-view pre') || {}).textContent, kind: document.getElementById('look-view').dataset.kind }));
    ok('the hung read, answered late, painted nothing over the look that replaced it',
      after.title === 'right-here.txt' && after.pre === TEXT && after.kind === 'text', JSON.stringify(after));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── 8 · a share that fails after hand-off ─────────────────────────────────
  console.log('\n8 · a share that fails after the bytes were handed over never says "nothing left this phone"');
  for (const c of [
    { what: 'the network dropped mid-upload', fulfil: r => r.abort('failed'), words: /possibly shared/ },
    { what: 'the hive answered no', fulfil: r => r.fulfill({ status: 401, body: 'no', headers: CORS }), words: /reached the rail and the rail refused/ }
  ]) {
    const { ctx } = await context({ route: (r, u) => /^https:\/\/skaists\.buzz\/upload/.test(u) ? (preflight(r) || (c.fulfil(r), true)) : false });
    const { p, errs } = await open(ctx);
    await p.waitForFunction(() => window.__myspace.purposes().includes('share'), null, { timeout: 20000 });
    await add(p, 'share', 'meant-to-share.txt', 'text/plain', Buffer.from(TEXT));
    const said = await p.textContent('#status');
    ok(`${c.what}: says what may have happened`, c.words.test(said) && !/Nothing left this phone/.test(said), said);
    const rows = await p.evaluate(() => window.__myspace.rows());
    ok(`${c.what}: the file is kept here, sealed, as before`, rows.length === 1 && rows[0].purpose === 'keep', JSON.stringify(rows.map(r => r.purpose)));
    ok(`${c.what}: no page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

/* ---------- 10 · EXPLORER-PRIVACY-001: what a preview leaves behind ----------
   Verified here: memory ISOLATION, i.e. what this module's linear memory and this
   page's live objects still hold. Not verified, and not claimable from a browser:
   physical RAM erasure, swap, or what the JavaScript engine's collector does with
   memory it has already released. */
const CANARY = 'CANARY-7f3e19d2-a look that must not linger-';

function count(hay, needle) {
  let n = 0;
  for (let i = hay.indexOf(needle[0]); i !== -1 && i <= hay.length - needle.length; i = hay.indexOf(needle[0], i + 1)) {
    let j = 1; while (j < needle.length && hay[i + j] === needle[j]) j++;
    if (j === needle.length) n++;
  }
  return n;
}

// one preview through the module's own ABI in Node, then a scan of its whole memory
async function residue(bytes, text) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const X = instance.exports;
  const body = Buffer.from(text);
  const len = 42 + body.length;
  const req = X.bx_alloc(len);
  const mem = () => new Uint8Array(X.memory.buffer);
  mem().set(Buffer.concat([Buffer.from('BXPQ\x01\x01', 'latin1'), Buffer.from(sha(body), 'hex'), Buffer.from(Uint32Array.of(body.length).buffer)]), req);
  mem().set(body, req + 42);
  const needle = Buffer.from(CANARY);
  const before = count(mem(), needle);
  const n = X.bx_preview(req, len, X.bx_verdict_arena(), X.bx_verdict_cap());
  const verdict = mem().slice(X.bx_verdict_arena(), X.bx_verdict_arena() + n);
  if (typeof X.bx_wipe === 'function') X.bx_wipe();
  X.bx_free(req, len);
  return { before, after: count(mem(), needle), kind: verdict[5], wipe: typeof X.bx_wipe === 'function' };
}

// The module this lane replaces, kept as a committed fixture (not a git-history read, so the
// red control cannot fail for an infrastructure reason). Its digest is checked before use:
// a wrong fixture is a fixture failure, named as such.
const OLD_MODULE = '7739e3990ddc999ce15c6accf89e6b9073a4919854ae6413fd2db1cfeccf079f'; // PUBLIC-CONSTANT sha256 of the pre-privacy module (9d8ba900c)
async function oldModule() {
  const b = await readFile(join(ROOT, 'e2e/fixtures/bnr-explorer-7739e399.wasm'));
  if (sha(b) !== OLD_MODULE) throw new Error('fixture e2e/fixtures/bnr-explorer-7739e399.wasm is not the pinned pre-privacy module');
  return b;
}

async function privacy() {
  console.log('\n10 · EXPLORER-PRIVACY-001 — what a preview leaves behind');
  const text = (CANARY + '\n').repeat(4096);  // ~190 KB: the excerpt (64 KB) and the full request both carry it

  // 10a residue in the module's memory, with the red control: the module this lane replaces
  const now = await residue(await readFile(join(SERVE, 'surfaces/bnr-explorer.wasm')), text);
  ok('10a CONTROL — the scanner sees the canary while the request is still in memory', now.before > 1000, JSON.stringify(now));
  ok('10a after a text preview the canary is nowhere in the module\'s memory (request, excerpt and verdict arena zeroed)',
    now.kind === 1 && now.after === 0, JSON.stringify(now));
  let old = null;
  try { old = await residue(await oldModule(), text); } catch (e) { old = null; }
  ok('10a RED CONTROL — the module before this lane (pinned fixture of 9d8ba900c) still holds the canary after free, so the check can fail',
    !!old && old.after > 0, JSON.stringify(old));

  // 10e RED CONTROL and the cost of zeroing, in Node against the module itself
  {
    const bytes = await readFile(join(SERVE, 'surfaces/bnr-explorer.wasm'));
    const { instance: { exports: L } } = await WebAssembly.instantiate(bytes, {});
    const start = L.memory.buffer.byteLength;
    for (let i = 0; i < 20; i++) L.bx_alloc(8 << 20);                   // cleanup deliberately disabled: never freed
    const grew = L.memory.buffer.byteLength - start;
    ok('10e RED CONTROL — allocations never freed DO grow the memory the ceiling watches, so the ceiling can fail', grew >= 20 * (8 << 20), `${grew >> 20} MiB grew`);
    const timeIt = async b => {
      const { instance: { exports: X } } = await WebAssembly.instantiate(b, {});
      const body = Buffer.alloc(32 << 20, 0x61), len = 42 + body.length, d = Buffer.from(sha(body), 'hex');
      const ms = [];
      for (let k = 0; k < 4; k++) {
        const req = X.bx_alloc(len), m = new Uint8Array(X.memory.buffer);
        m.set(Buffer.concat([Buffer.from('BXPQ\x01\x01', 'latin1'), d, Buffer.from(Uint32Array.of(body.length).buffer)]), req); m.set(body, req + 42);
        const t0 = performance.now();
        X.bx_preview(req, len, X.bx_verdict_arena(), X.bx_verdict_cap()); if (X.bx_wipe) X.bx_wipe(); X.bx_free(req, len);
        ms.push(performance.now() - t0);
      }
      return Math.round(ms.slice(1).sort((a, b) => a - b)[1]);
    };
    const tNew = await timeIt(bytes);
    let tOld = null; try { tOld = await timeIt(await oldModule()); } catch (e) { tOld = null; }
    console.log(`  cost of zeroing, one 32 MiB preview (hash + parse + wipe + free), median of 3 in Node: ${tNew} ms now, ${tOld} ms before`);
  }

  // 10b-e in the page
  const { ctx } = await context({
    init: () => {
      window.__urls = { made: new Set(), revoked: new Set() };
      const mk = URL.createObjectURL.bind(URL), rv = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = o => { const u = mk(o); window.__urls.made.add(u); return u; };
      URL.revokeObjectURL = u => { window.__urls.revoked.add(u); return rv(u); };
    }
  });
  const { p, errs } = await open(ctx);
  const workerUp = () => p.workers().some(x => x.url().endsWith('/bnr-explorer-worker.js'));
  const leftover = () => p.evaluate(() => [...window.__urls.made].filter(u => !window.__urls.revoked.has(u)).length);

  const t = await add(p, 'now', 'canary-visit.txt', 'text/plain', Buffer.from(text));
  const v1 = await look(p, t.id);
  ok('10b PRECONDITION — the look is open and a worker holds it', v1.kind === 'text' && workerUp(), JSON.stringify({ kind: v1.kind, worker: workerUp() }));
  await closeLook(p);
  await p.waitForTimeout(300);
  ok('10b closing a text look ends its worker', !workerUp() && (await p.evaluate(() => window.__myspace.look().worker)) === false);
  ok('10b and the page holds no copy: the view is empty', await p.evaluate(() => document.getElementById('look-view').childElementCount === 0));
  const rows = await p.evaluate(() => window.__myspace.rows().then(r => r.map(x => x.name)));
  ok('10c the this-visit file itself is untouched by closing the look (it goes with the visit, not the preview)', rows.includes('canary-visit.txt'), JSON.stringify(rows));

  const img = await add(p, 'keep', 'canary.png', 'image/png', PNG_OK);
  const made0 = await p.evaluate(() => window.__urls.made.size);
  await p.click(`#look-${img.id}`);
  await p.waitForFunction(m => window.__urls.made.size > m, made0, { timeout: 10000 }).catch(() => {});
  await p.click('#lookClose');                              // during decode, or just after
  await p.waitForTimeout(1200);
  const late = await p.evaluate(() => ({ state: document.body.dataset.state, imgs: document.querySelectorAll('#look-view img').length }));
  ok('10d an image look closed mid-decode: every preview URL revoked, nothing repainted', (await leftover()) === 0 && late.imgs === 0 && late.state !== 'look', JSON.stringify(late));
  const leak = await p.evaluate(() => URL.createObjectURL(new Blob(['never revoked'])));   // cleanup deliberately skipped
  ok('10d RED CONTROL — an object URL left unrevoked IS counted, so the cleanup check can fail', (await leftover()) === 1);
  await p.evaluate(u => URL.revokeObjectURL(u), leak);

  // 10e memory ceiling: the worker driven directly, 100 x 8 MiB then 10 x 32 MiB
  const pin = /PREVIEW_SHA256 = '([0-9a-f]{64})'/.exec(await readFile(join(SERVE, 'surfaces/myspace.js'), 'utf8'))[1];
  const mem = await p.evaluate(async pin => {
    const w = new Worker('bnr-explorer-worker.js');
    const next = () => new Promise(r => { w.onmessage = e => r(e.data); });
    w.postMessage({ op: 'init', url: 'bnr-explorer.wasm?v=' + pin.slice(0, 12), pin });
    const ready = await next();
    const pages = [];
    const run = async (size, times) => {
      const b = new Uint8Array(size); for (let i = 0; i < size; i += 4096) b[i] = (i >> 12) & 255;
      const d = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
      for (let i = 0; i < times; i++) { w.postMessage({ op: 'preview', id: i, digest: d, bytes: b }); const v = await next(); pages.push(v.pages); if (v.refused) return v.refused; }
      return null;
    };
    const r8 = await run(8 << 20, 100);
    const r32 = await run(32 << 20, 10);
    w.terminate();
    return { ready: ready.op, r8, r32, pages, heap: performance.memory ? performance.memory.usedJSHeapSize : null };
  }, pin);
  const p8 = mem.pages.slice(0, 100), p32 = mem.pages.slice(100);
  const MiB = x => Math.round(x * 64 / 1024);
  console.log(`  memory: 8 MiB x100 -> pages ${Math.min(...p8)}..${Math.max(...p8)} (${MiB(Math.max(...p8))} MiB); 32 MiB x10 -> pages ${Math.min(...p32)}..${Math.max(...p32)} (${MiB(Math.max(...p32))} MiB); page heap ${mem.heap ? Math.round(mem.heap / 1048576) + ' MiB' : 'n/a'}`);
  ok('10e 110 large previews all answered', mem.ready === 'ready' && !mem.r8 && !mem.r32 && mem.pages.length === 110, JSON.stringify({ r8: mem.r8, r32: mem.r32, n: mem.pages.length }));
  ok('10e repeated 8 MiB previews do not grow memory (run 100 = run 2)', p8[99] === p8[1], `${p8[1]} -> ${p8[99]}`);
  ok('10e repeated 32 MiB previews do not grow memory and stay under 1,200 pages (75 MiB)', p32[9] === p32[1] && Math.max(...p32) <= 1200, `${p32[1]} -> ${p32[9]}, max ${Math.max(...p32)}`);

  ok('10 no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ---------- M · measure ---------- */
// installed before any page script: when the first and the N-th row arrive, and the longest
// animation frame in which myspace.js ran (long-animation-frame attributes script time by file,
// so the estate's own lang.js frame is not charged to the list)
function clockScript(n) {
  return `(() => {
    const W = window.__explorerClock = { first: null, all: null, trueAt: null, longest: 0, ours: 0, n: ${n} };
    const placeholder = /not answering|Still asking|Checking where|describe\\(\\) pending/;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) {
      W.longest = Math.max(W.longest, e.duration);
      if (e.scripts.some(s => /myspace\\.js/.test(s.sourceURL || ''))) W.ours = Math.max(W.ours, e.duration);
    } }).observe({ type: 'long-animation-frame', buffered: true }); } catch (e) {}
    const look = () => {
      const k = document.querySelectorAll('#list article.file').length;
      if (k > 0 && W.first == null) W.first = performance.now();
      if (k >= W.n && W.all == null) W.all = performance.now();
      if (k > 0 && W.trueAt == null) { const w = document.querySelector('#list article.file .why'); if (w && w.textContent && !placeholder.test(w.textContent)) W.trueAt = performance.now(); }
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
  })();`;
}

async function seedMany(ctx, n) {
  const t0 = Date.now();
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: 'seed' + String(i).padStart(6, '0'), name: 'file-' + i + '.txt', size: 100 + i, type: 'text/plain',
    purpose: 'keep', ts: t0 - i * 1000, addr: { scheme: 'local', address: 'a'.repeat(64) }, keyref: 'device:aes-gcm:v1' });
  await seedRows(ctx, rows);
}

async function onePage(ctx, n, warm) {
  const p = await ctx.newPage();
  await p.addInitScript(clockScript(n));
  if (warm) { await p.goto(PAGE); await p.waitForFunction(() => window.__explorerClock.all != null, null, { timeout: 120000 }); }
  await (warm ? p.reload() : p.goto(PAGE));
  await p.waitForFunction(() => window.__explorerClock.all != null, null, { timeout: 120000 });
  // a row's true words can trail the rows themselves (the old page waited for every rail)
  await p.waitForFunction(() => window.__explorerClock.trueAt != null, null, { timeout: 15000 }).catch(() => {});
  /* READ THE BUFFERED FRAMES, DO NOT WAIT FOR THE OBSERVER. A frame that held the page
     for seconds is delivered to an observer as a task queued after it, which can land
     after this read; the first table this meter printed missed the old page's 4.5 s
     frame exactly that way. takeRecords() on a fresh buffered observer is synchronous. */
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 100)))));
  const c = await p.evaluate(() => {
    const W = window.__explorerClock;
    const take = type => { try { const o = new PerformanceObserver(() => {}); o.observe({ type, buffered: true }); const r = o.takeRecords(); o.disconnect(); return r; } catch (e) { return []; } };
    for (const e of take('longtask')) W.longest = Math.max(W.longest, e.duration);
    for (const e of take('long-animation-frame')) {
      W.longest = Math.max(W.longest, e.duration);
      if (e.scripts.some(s => /myspace\.js/.test(s.sourceURL || ''))) W.ours = Math.max(W.ours, e.duration);
    }
    return W;
  });
  await p.close();
  return c;
}

async function series(n, mode) {
  const out = [];
  for (let i = 0; i < RUNS; i++) {
    const { ctx } = await context({ slowBlossom: mode === 'slow' ? SLOW_MS : 0 });
    await seedMany(ctx, n);
    out.push(await onePage(ctx, n, mode === 'warm'));
    await ctx.close();
  }
  return out;
}

const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const ms = v => (v == null ? '—' : Math.round(v) + ' ms');

async function measure() {
  const rows = [];
  for (const n of SIZES) for (const mode of ['cold', 'warm']) rows.push({ n, mode, runs: await series(n, mode) });
  rows.push({ n: SIZES[0], mode: 'slow', runs: await series(SIZES[0], 'slow') });
  console.log(`\nM · MY SPACE list, ${RUNS} runs per line, median / worst (Chromium ${browser.version()}, this machine)`);
  console.log('rows    mode   first row          first true row       all rows             longest frame (any)   longest frame with My Space work');
  for (const r of rows) {
    const f = r.runs.map(x => x.first), tr = r.runs.map(x => x.trueAt), a = r.runs.map(x => x.all), l = r.runs.map(x => x.longest), o = r.runs.map(x => x.ours);
    const cell = (xs, w) => (ms(q(xs, .5)) + ' / ' + ms(q(xs, 1))).padEnd(w);
    console.log(`${String(r.n).padEnd(7)} ${r.mode.padEnd(6)} ${cell(f, 18)} ${cell(tr, 20)} ${cell(a, 20)} ${cell(l, 21)} ${cell(o, 0)}`);
  }
  return rows;
}

try {
  if (ONLY_PRIVACY) {
    await privacy();
    console.log(`\n${passed} passed, ${failed} failed`);
  } else {
  if (!MEASURE_ONLY) { await gate(); await privacy(); }
  const rows = await measure();
  if (!MEASURE_ONLY) {
    const big = rows.filter(r => r.n === Math.max(...SIZES) && r.mode !== 'slow').flatMap(r => r.runs);
    const worst = Math.max(...big.map(x => x.ours));
    ok(`M · no frame with My Space work held the page over ${FREEZE_BUDGET_MS} ms at ${Math.max(...SIZES)} rows (one 4.5 to 5.3 s task before slicing)`,
      worst <= FREEZE_BUDGET_MS, Math.round(worst) + ' ms');
    ok('M · every run drew every row', rows.every(r => r.runs.every(x => x.all != null)));
    console.log(`\n${passed} passed, ${failed} failed`);
  }
  }
} finally {
  await browser.close();
  await close();
}
process.exit(failed ? 1 : 0);
