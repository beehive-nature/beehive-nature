// kandi-eternal.test.mjs — the kandi bar as three products in one surface (founder blueprint
// 2026-09-26, docs/design/eternal). Proves at 390 px: exactly one front per register, each in its
// own dress and structure; all three carry the SAME facts, read from the bar's own committed arms
// (window.__kandi); a piece strung through the real composer shows up in all three; and no gesture
// writes on its own — "gift it" presses the piece's own gift button, which only prepares the gift
// (the piece stays on the arm until "I handed it over"). Run: node --test e2e/kandi-eternal.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PORT = 8956, ORIGIN = `http://127.0.0.1:${PORT}`;
const srv = createServer(async (q, s) => {
  try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
let browser;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); srv.close(); });

async function open(reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const outside = [];
  await ctx.route('**/*', r => { if (r.request().url().startsWith(ORIGIN)) return r.continue(); outside.push(r.request().url()); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${ORIGIN}/surfaces/kandi.html`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__eternal && window.__eternal.data.ready, null, { timeout: 20000 });
  await p.waitForTimeout(900);
  return { ctx, p, errs, outside };
}
// string a piece through the bar's REAL composer
async function string(p, colours, word, maker, madefor) {
  await p.evaluate(([colours, word, maker, madefor]) => {
    const pal = document.querySelectorAll('#pal button'); colours.forEach(i => pal[i].click());
    if (word) { document.getElementById('word').value = word; document.getElementById('addword').click(); }
    document.getElementById('maker').value = maker; document.getElementById('madefor').value = madefor;
    document.getElementById('stringit').click();
  }, [colours, word, maker, madefor]);
  await p.waitForFunction(n => window.__eternal.data.right.length === n, (await p.evaluate(() => window.__kandi.state().right.length)) + 1, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(200);
}
const shown = p => p.evaluate(() => ['.et-b', '.et-r', '.et-c'].filter(s => getComputedStyle(document.querySelector('#eternal>' + s)).display !== 'none'));
const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(36); };

test('one front per register, each in its own dress and structure', async () => {
  const want = {
    bee: { front: '.et-b', bg: 'rgb(251, 247, 240)', title: /Instrument Serif/, action: 'rgb(168, 35, 140)' },
    raver: { front: '.et-r', bg: 'rgb(6, 17, 12)', title: /Unbounded/, action: 'rgb(214, 85, 187)' },
    cypherpunk: { front: '.et-c', bg: 'rgb(6, 17, 12)', title: /IBM Plex Mono/, action: 'rgb(69, 194, 220)' },
  };
  for (const [reg, w] of Object.entries(want)) {
    const { ctx, p, errs, outside } = await open(reg);
    assert.deepEqual(await shown(p), [w.front], reg + ': exactly its own front');
    const d = await p.evaluate(f => {
      const fr = document.querySelector('#eternal>' + f);
      const title = fr.querySelector('.et-b-h,.et-r-h,.et-c-path'), act = fr.querySelector('.et-b-primary,.et-r-pill,.et-c-primary');
      return { bg: getComputedStyle(document.body).backgroundColor, title: getComputedStyle(title).fontFamily, action: getComputedStyle(act).backgroundColor, wide: document.documentElement.scrollWidth, vw: innerWidth,
        rows: !!fr.querySelector('.et-b-rows .et-b-row[data-arm]'), graphic: !!fr.querySelector('svg .bead'), table: !!fr.querySelector('table.et-c-tab') };
    }, w.front);
    assert.equal(d.bg, w.bg, reg + ' ground'); assert.match(d.title, w.title, reg + ' title face'); assert.equal(d.action, w.action, reg + ' action colour');
    assert.equal(d.rows, reg === 'bee'); assert.equal(d.graphic, reg === 'raver'); assert.equal(d.table, reg === 'cypherpunk');
    assert.ok(d.wide <= 390 && d.vw <= 390, reg + ': no sideways page at 390 px');
    assert.deepEqual(outside, [], 'no request leaves the origin on load');
    assert.equal(errs.length, 0, errs.join(' | '));
    await ctx.close();
  }
});

test('the same facts in all three, and a piece strung in the real composer reaches every front', async () => {
  const facts = {};
  for (const reg of ['bee', 'raver', 'cypherpunk']) {
    const { ctx, p } = await open(reg);
    await string(p, [1, 3, 5], 'PLUR', 'Lu', 'Sam');
    facts[reg] = await p.evaluate(() => {
      const S = window.__kandi.state(), D = window.__eternal.data;
      return {
        truth: [S.right.length, (S.cross || []).length, S.left.length, S.given.length], model: [D.right.length, D.cross.length, D.left.length, D.given.length],
        right0: S.right[0] && [S.right[0].maker, S.right[0].madefor, S.right[0].beads],
        bee: [...document.querySelectorAll('#etBeeRows .et-b-row[data-arm]')].map(r => [r.dataset.arm, parseInt(r.querySelector('small').textContent, 10)]),
        beads: [...document.querySelectorAll('#etBrace .bead')].map(g => g.getAttribute('aria-label')),
        table: [...document.querySelectorAll('#etArms tr.pick')].map(r => [...r.children].map(c => c.textContent)),
        store: document.querySelector('#etReceipt').textContent, raw: localStorage.getItem('bkandi'),
      };
    });
    await ctx.close();
  }
  const a = facts.bee;
  assert.deepEqual(a.truth, [1, 0, 1, 0], 'the welcome keepsake plus the new piece'); assert.deepEqual(a.right0, ['Lu', 'Sam', '135PLUR']);
  for (const reg of ['bee', 'raver', 'cypherpunk']) { assert.deepEqual(facts[reg].model, facts[reg].truth, reg + ' reads the bar'); assert.deepEqual(facts[reg].truth, a.truth); }
  assert.deepEqual(a.bee, [['right', 1], ['cross', 0], ['left', 1], ['given', 0]]);
  assert.equal(facts.raver.beads.length, 2); assert.match(facts.raver.beads[0], /^right arm: by Lu, 7 beads$/); assert.match(facts.raver.beads[1], /^left arm: by the PLUR mUseUm, 8 beads$/);
  assert.deepEqual(facts.cypherpunk.table, [['right', 'Lu → Sam', '7'], ['left · rcv', 'the PLUR mUseUm → you', '8']]);
  assert.match(facts.cypherpunk.store, new RegExp('localStorage bkandi · ' + facts.cypherpunk.raw.length + ' bytes'));
});

test('bee: the one action opens the real composer; the link opens the real receive box', async () => {
  const { ctx, p, errs } = await open('bee');
  await p.click('#etBeeMake'); assert.equal(await p.evaluate(() => document.activeElement.id), 'word');
  await p.click('#etBeeRcv'); assert.equal(await p.evaluate(() => document.activeElement.id), 'rcv');
  await p.click('.et-b-row[data-arm="left"]');
  assert.match(await p.textContent('#etBeeRows'), /by the PLUR mUseUm\s*for you · 8 beads/);
  assert.equal(await p.evaluate(() => window.__kandi.state().right.length), 0, 'no tap wrote anything');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('raver: tap a bead; "gift it" presses the piece\'s own gift button, which only prepares — the piece stays on the arm', async () => {
  const { ctx, p, errs } = await open('raver');
  await string(p, [0, 2], 'HI', 'Lu', '');
  await p.evaluate(() => document.querySelector('#etBrace .bead[data-k="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.match(await p.textContent('#etRaverCard'), /left arm · keepsake/); assert.equal(await p.textContent('#etRaverGo'), 'make one', 'a keepsake is never offered for gifting');
  await p.evaluate(() => document.querySelector('#etBrace .bead[data-k="0"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(await p.textContent('#etRaverGo'), 'gift it');
  await p.click('#etRaverGo'); await p.waitForTimeout(600);
  assert.notEqual(await p.$eval('#ceremony', e => getComputedStyle(e).display), 'none', 'the real handshake opens');
  assert.equal(await p.evaluate(() => window.__kandi.state().right.length), 1, 'the piece is still on the right arm');
  assert.equal(await p.evaluate(() => window.__eternal.data.given.length), 0, 'nothing is claimed handed over');
  assert.equal(errs.length, 0, errs.join(' | ')); await ctx.close();
});

test('cypherpunk: complete at first paint, and every export is a checkable KND1 string', async () => {
  const { ctx, p, errs } = await open('cypherpunk');
  const d = await p.evaluate(() => ({ steps: document.querySelectorAll('#etPipe li').length, receipt: document.querySelectorAll('#etReceipt tr').length, now: (document.querySelector('#etPipe li.now b') || {}).textContent }));
  assert.deepEqual(d, { steps: 6, receipt: 7, now: 'string · right arm' });
  await p.click('#etArms tr.pick[data-k="0"]');
  const knd = (await p.textContent('#etArms tr.names td')).trim();
  const f = knd.split('|'); assert.equal(f.length, 6); assert.equal(f[0], 'KND1');
  assert.equal(fnv(f.slice(0, 5).join('|')), f[5], 'the checksum verifies outside the page');
  await p.click('#etCyGo'); assert.equal(await p.evaluate(() => document.activeElement.id), 'word');
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
