// tour-bar-clearance.test.mjs — the fixed tour bar never covers a page's own
// bottom action row (bee-laborer slice, 2026-09-20; measured on the live
// MY SPACE page at 390x844: the strip sat on the lowest 18px of each 52px
// sheet button, the toggle on 121px² more — taps landed only because the
// centre stayed clear). Two mechanisms live in tour.js, both proven here:
//   1. MODAL RETREAT — while an aria-modal dialog (or <dialog> via showModal)
//      is rendered, #tbar and #tbarMore retreat (visibility:hidden, layout
//      kept) and return when it closes. Proven by HIT-TESTING every corner of
//      every sheet button, not by rectangles: a hidden bar keeps its box.
//   2. PUBLISHED HEIGHT — --tbar-h on <html> equals the measured strip height
//      on fixed-bar pages and is 0px on inline-host pages, so a non-modal
//      sticky row can anchor with bottom:var(--tbar-h,0).
// Run: node --test e2e/tour-bar-clearance.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const PORT = 8863;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : rel.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    s.writeHead(200, { 'content-type': ct }); s.end(body);
  } catch { s.writeHead(404); s.end(); }
});
let b = null;
before(async () => { await new Promise(r => srv.listen(PORT, '127.0.0.1', r)); b = await chromium.launch(); });
after(async () => { if (b) await b.close(); srv.close(); });

async function at(page, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w <= 520, hasTouch: w <= 520 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/surfaces/${page}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200); /* riders mount into the bar; fitPad re-measures at 500/1500ms */
  return { ctx, p, errs };
}

/* every corner (inset 3px) and the centre of each visible sheet button must
   hit-test to the button itself — the bar, its toggle, or anything else
   landing there is a covered tap */
async function tapPoints(p) {
  return p.evaluate(() => {
    const out = [];
    for (const btn of document.querySelectorAll('.sheet .actions button')) {
      const r = btn.getBoundingClientRect(); if (!r.width || !r.height) continue;
      /* a column down the centre every 4px (the bar covered the LOWEST 18px) and a row
         across the middle every 8px, inset past the pill radius — never the corners */
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, pts = [];
      for (let y = r.top + 2; y <= r.bottom - 2; y += 4) pts.push([cx, y]);
      for (let x = r.left + Math.min(10, r.width / 4); x <= r.right - 10; x += 8) pts.push([x, cy]);
      for (const [x, y] of pts) {
        const hit = document.elementFromPoint(x, y);
        out.push({ id: btn.id, x: Math.round(x), y: Math.round(y), ok: hit === btn || (hit && btn.contains(hit)), hit: hit ? (hit.id || hit.tagName) + (hit.closest('#tbar,#tbarMore') ? ' [TOUR BAR]' : '') : 'nothing' });
      }
    }
    return out;
  });
}
const barState = p => p.evaluate(() => {
  const bar = document.getElementById('tbar'), tg = document.getElementById('tbarMore');
  const r = bar.getBoundingClientRect();
  return { vis: getComputedStyle(bar).visibility, tgVis: getComputedStyle(tg).visibility, ariaHidden: bar.getAttribute('aria-hidden'), top: Math.round(r.top), h: Math.round(r.height), vh: innerHeight, varH: getComputedStyle(document.documentElement).getPropertyValue('--tbar-h').trim(), bodyPad: getComputedStyle(document.body).paddingBottom };
});

/* two rows, not one (bee-laborer 2026-09-20 20:18Z): the founder's frame was a
   1920x1080 desktop, where the strip's own horizontal scrollbar adds ~15px and
   the cut is WORSE than the phone's. The claim is the same on both: the page's
   own bottom action row is fully visible and tappable while the dialog is open. */
for (const [W, H, label] of [[390, 844, 'phone 390x844'], [1920, 1080, 'desktop 1920x1080']]) test(`MY SPACE @${label}: both sheets open by the real gesture — every button point is tappable, the bar retreats and returns`, async () => {
  const { ctx, p, errs } = await at('myspace.html', W, H);
  const rest = await barState(p);
  assert.equal(rest.vis, 'visible', 'bar is on screen at rest');
  assert.ok(rest.top + rest.h >= rest.vh - 1 && rest.h >= 30, `bar is a bottom strip (top ${rest.top}, h ${rest.h}, vh ${rest.vh})`);
  /* the real gesture: attach one private file, then open each sheet from the row */
  await p.setInputFiles('#picker', { name: 'letter.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from the clearance gate') });
  await p.waitForFunction(() => document.body.getAttribute('data-state') === 'file', null, { timeout: 15000 });
  for (const [btnClass, kind, keepId] of [['.danger', 'delete', 'delKeep'], ['.ghost', 'flip', 'flipKeep']]) {
    const rowBtn = p.locator(`#list button${btnClass}`).first();
    await rowBtn.scrollIntoViewIfNeeded();
    await rowBtn.click();
    await p.waitForFunction(k => document.body.getAttribute('data-state') === k, kind, { timeout: 5000 });
    await p.waitForTimeout(150); /* the retreat is one animation frame behind the attribute */
    const open = await barState(p);
    assert.equal(open.vis, 'hidden', `${kind}: bar retreats while the sheet is up`);
    assert.equal(open.tgVis, 'hidden', `${kind}: toggle retreats with it`);
    assert.equal(open.ariaHidden, 'true', `${kind}: retreated bar is hidden from the accessibility tree`);
    assert.equal(open.bodyPad, rest.bodyPad, `${kind}: nothing reflows — body padding unchanged`);
    const pts = await tapPoints(p);
    assert.ok(pts.length >= 40, `${kind}: two buttons scanned (got ${pts.length} points)`);
    const inView = await p.evaluate(() => [...document.querySelectorAll('.sheet .actions button')].filter(x => x.getBoundingClientRect().height).every(x => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
    assert.ok(inView, `${kind}: every sheet button lies fully inside the ${W}x${H} viewport`);
    const covered = pts.filter(x => !x.ok);
    assert.equal(covered.length, 0, `${kind}: covered tap points — ` + covered.map(x => `${x.id}@${x.x},${x.y}→${x.hit}`).join(' | '));
    await p.locator('#' + keepId).click(); /* close by the sheet's own button */
    await p.waitForFunction(() => document.body.getAttribute('data-state') === 'file', null, { timeout: 5000 });
    await p.waitForTimeout(150);
    const back = await barState(p);
    assert.equal(back.vis, 'visible', `${kind}: bar returns when the sheet closes`);
    assert.equal(back.ariaHidden, null, `${kind}: aria-hidden cleared on return`);
    const barHit = await p.evaluate(() => { const r = document.getElementById('tbar').getBoundingClientRect(); const e = document.elementFromPoint(20, r.top + r.height / 2); return !!(e && e.closest('#tbar')); });
    assert.ok(barHit, `${kind}: the returned bar is tappable again`);
  }
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('the bar publishes its height: --tbar-h == measured strip on a fixed-bar page, 0px on the inline-host hub', async () => {
  const fixed = await at('myspace.html', 390, 844);
  const s = await barState(fixed.p);
  assert.equal(s.varH, s.h + 'px', `--tbar-h (${s.varH}) equals the measured bar height (${s.h}px)`);
  assert.ok(parseFloat(s.bodyPad) >= s.h, `body padding (${s.bodyPad}) clears the bar (${s.h}px)`);
  assert.equal(fixed.errs.length, 0, fixed.errs.join(' | '));
  await fixed.ctx.close();
  const wide = await at('myspace.html', 1280, 800);
  const w = await barState(wide.p);
  assert.equal(w.varH, w.h + 'px', `desktop: --tbar-h (${w.varH}) tracks the bar (${w.h}px)`);
  assert.equal(w.vis, 'visible', 'desktop: no dialog open, bar visible');
  await wide.ctx.close();
  const hub = await at('index.html', 390, 844);
  const h = await hub.p.evaluate(() => ({ varH: getComputedStyle(document.documentElement).getPropertyValue('--tbar-h').trim(), inline: !!document.querySelector('[data-tour-host] #tbar') }));
  assert.ok(h.inline, 'hub hosts the bar in-flow');
  assert.equal(h.varH, '0px', 'in-flow bar publishes 0px — it takes no fixed room');
  assert.equal(hub.errs.length, 0, hub.errs.join(' | '));
  await hub.ctx.close();
});

test('a native <dialog>.showModal() retreats the bar too, and close() restores it', async () => {
  const { ctx, p, errs } = await at('myspace.html', 390, 844);
  await p.evaluate(() => { const d = document.createElement('dialog'); d.id = 'gateDlg'; d.innerHTML = '<button id="gateOk" type="button">ok</button>'; document.body.appendChild(d); d.showModal(); });
  await p.waitForTimeout(150);
  assert.equal((await barState(p)).vis, 'hidden', 'showModal → bar retreats');
  await p.evaluate(() => document.getElementById('gateDlg').close());
  await p.waitForTimeout(150);
  assert.equal((await barState(p)).vis, 'visible', 'close → bar returns');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});
