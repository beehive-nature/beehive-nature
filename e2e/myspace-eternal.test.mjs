// myspace-eternal.test.mjs — MY SPACE as three products in one surface (founder blueprint 2026-09-26,
// docs/design/eternal). Proves at 390 px: exactly one front per register, each in its own dress and
// structure; all three carry the SAME facts, read from window.__myspace (the purposes the attached
// rails answer, each rail's declared terms, the device index); and no gesture stores anything on its
// own — choosing presses the page's own #mode-* button, and "add a file" opens the page's own picker,
// whose real write then shows up in all three fronts. Run: node --test e2e/myspace-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8955, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg, ctx) {
  ctx = ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/myspace.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.purposes.some(x => x.offered), null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { ctx, p, errs, outside };
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));

test('one front per register, each in its own dress and structure', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: !!fr.querySelector('.et-b-rows [role="radio"]'), graphic: !!fr.querySelector('svg .orbit'), table: !!fr.querySelector('table.et-c-tab') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.graphic, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three: offered purposes, the rail each resolves to, its declared terms', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    facts[reg] = await p.evaluate(() => {
      const M = window.__myspace, D = window.__eternal.data;
      return {
        truth: M.purposes().map(id => [id, M.railFor(id), JSON.stringify(M.terms(M.railFor(id)))]),
        model: D.purposes.filter(x => x.offered).map(x => [x.id, x.rail, JSON.stringify(x.terms)]),
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row')].map(r => [r.dataset.etPurpose, r.textContent]),
        rings: [...document.querySelectorAll('#etOrbits .orbit')].map(g => [g.dataset.etPurpose, g.getAttribute('aria-label')]),
        table: [...document.querySelectorAll('#etPurposes tr.pick')].map(r => [r.dataset.etPurpose, r.children[1].textContent, r.children[2].textContent]),
        pressed: document.querySelector('#modes .mode[aria-pressed="true"]').dataset.purpose, pick: D.pick,
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.model, a.truth, 'the data layer is __myspace'); assert.ok(a.truth.length >= 2);
  for (const reg of ['raver', 'cypherpunk']) assert.deepEqual(facts[reg].model, a.model, reg + ' same model');
  for (const reg of ['bee', 'raver', 'cypherpunk']) assert.equal(facts[reg].pick, facts[reg].pressed, reg + ' shows the purpose the page has selected');
  const ids = a.model.map(m => m[0]);
  assert.deepEqual(a.bee.map(r => r[0]), ids); assert.deepEqual(facts.raver.rings.map(r => r[0]), ids); assert.deepEqual(facts.cypherpunk.table.map(r => r[0]), ids);
  const say = { bee: { 'this-device': 'only this phone opens it', 'link-holders': 'anyone with the link opens it', everyone: 'anyone can read it' }, raver: { 'this-device': 'this phone only', 'link-holders': 'the link opens it', everyone: 'anyone reads it' } };
  a.model.forEach(([id, rail, tj], i) => {
    const t = JSON.parse(tj);
    assert.ok(a.bee[i][1].includes(say.bee[t.readers]), id + ' bee readers');
    assert.ok(facts.raver.rings[i][1].includes(say.raver[t.readers]), id + ' raver readers');
    assert.equal(facts.cypherpunk.table[i][1], rail, id + ' cypher rail');
    assert.ok(facts.cypherpunk.table[i][2].includes('readers ' + t.readers) && facts.cypherpunk.table[i][2].includes('payer ' + t.payer), id + ' cypher terms');
    if (!t.deletable) { assert.match(a.bee[i][1], /nobody can delete it/); assert.match(facts.raver.rings[i][1], /no delete/); assert.match(facts.cypherpunk.table[i][2], /deletable no/); }
  });
});

test('choosing presses the page\'s own purpose; the one action opens the page\'s own picker and the real write reaches every front', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const { p, errs, outside } = await open('bee', ctx);
  await p.click('.et-b-row[data-et-purpose="share"]');
  assert.equal(await p.getAttribute('#mode-share', 'aria-pressed'), 'true', 'the page\'s own button is pressed');
  await p.click('.et-b-row[data-et-purpose="keep"]');
  assert.equal(await p.getAttribute('#mode-keep', 'aria-pressed'), 'true');
  assert.equal(await p.evaluate(() => window.__eternal.data.count), 0);
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('#etBeeAdd')]);
  await chooser.setFiles({ name: 'a-note.txt', mimeType: 'text/plain', buffer: Buffer.from('kept on this phone') });
  await p.waitForFunction(() => window.__eternal.data.count === 1, null, { timeout: 10000 });
  assert.match(await p.textContent('#etBeeFiles'), /1 file on this phone/);
  const rows = await p.evaluate(() => window.__myspace.rows().then(r => r.map(x => [x.name, x.purpose])));
  assert.deepEqual(rows, [['a-note.txt', 'keep']], 'the page wrote it, with the chosen purpose');
  assert.deepEqual(outside, [], 'a keep-here file sends nothing anywhere');
  // the same row, read by the other two fronts
  for (const reg of ['raver', 'cypherpunk']) {
    await p.evaluate(r => { localStorage.setItem('bregister', r); }, reg);
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready && window.__eternal.data.count === 1, null, { timeout: 15000 });
    if (reg === 'raver') assert.equal(await p.locator('#etOrbits circle.file').count(), 1, 'the file glows on its orbit');
    else assert.match(await p.textContent('#etReceipt'), /rows\s*1 · a-note\.txt 18 B keep/);
  }
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tapping an orbit chooses; the heart opens the picker. cypherpunk: a row chooses; attach opens the picker', async () => {
  let { ctx, p, errs } = await open('raver');
  await p.click('#etOrbits .orbit[data-et-purpose="now"] .hit', { position: { x: 5, y: 60 }, force: true }).catch(() => p.evaluate(() => document.querySelector('#etOrbits .orbit[data-et-purpose="now"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))));
  await p.waitForFunction(() => window.__eternal.data.pick === 'now');
  assert.equal(await p.getAttribute('#mode-now', 'aria-pressed'), 'true');
  assert.match(await p.textContent('#etRaverCard'), /just now · temp/);
  const [c1] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }), p.evaluate(() => document.querySelector('#etOrbits .heart').dispatchEvent(new MouseEvent('click', { bubbles: true })))]);
  assert.ok(c1, 'the heart opens the page picker');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
  ({ ctx, p, errs } = await open('cypherpunk'));
  const d = await p.evaluate(() => ({ steps: document.querySelectorAll('#etPipe li').length, receipt: document.querySelectorAll('#etReceipt tr').length, key: document.getElementById('etCyKey').textContent, real: window.__myspace.devicePubkey() }));
  assert.equal(d.steps, 6); assert.equal(d.receipt, 6); assert.equal(d.key, d.real, 'the path names the real device key');
  await p.click('#etPurposes tr.pick[data-et-purpose="share"]');
  assert.equal(await p.getAttribute('#mode-share', 'aria-pressed'), 'true');
  await p.waitForFunction(() => window.__eternal.data.pick === 'share');
  assert.match(await p.textContent('#etPipe li.now b'), /purpose · share/);
  assert.match(await p.textContent('#etPipe'), /sign · schnorr/);
  const [c2] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }), p.click('#etCyAdd')]);
  assert.ok(c2);
  const fork = await p.$eval('.et-c a[href*="github.com"]', a => [a.target, a.rel]);
  assert.deepEqual(fork, ['_blank', 'noopener noreferrer']);
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('the laws hold on the front: no dash for a value, no forced capitals, 44 px actions', async () => {
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    const bad = await p.evaluate(() => {
      const fr = [...document.querySelectorAll('#eternal>div')].find(e => getComputedStyle(e).display !== 'none'), out = [];
      for (const el of fr.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        if (cs.textTransform !== 'none') out.push('caps ' + el.className);
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
        if (/^[—–-]$/.test(own) || /NaN|undefined|null/.test(own)) out.push('bad value ' + el.className + ' ' + own);
        const r = el.getBoundingClientRect();
        if (/^(BUTTON|A)$/.test(el.tagName) && r.height && (r.height < 44 || r.width < 44)) out.push('small ' + el.tagName + ' ' + el.textContent.trim().slice(0, 20));
      }
      return out;
    });
    assert.deepEqual(bad, [], reg);
    await ctx.close();
  }
});
