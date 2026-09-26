// orb-seat.test.mjs — the orb's place on every screen (founder order 2026-09-13, ruling 2026-09-26)
// The orb must OPEN from wherever it sits, never sit on the bar or over the ANT card on mobile,
// move where the reader puts it and stay there, and keep the desktop float untouched. Run: node --test e2e/orb-seat.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    if (!s.headersSent) s.writeHead(200, { 'content-type': ct });
    s.end(body);
  } catch { if (!s.headersSent) s.writeHead(404); s.end(); }
});
let b = null;
before(async () => { await new Promise(r => srv.listen(8857, '127.0.0.1', r)); b = await chromium.launch(); });
after(async () => { if (b) await b.close(); srv.close(); });

async function at(page, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w <= 520 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8857/surfaces/' + page, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  return { ctx, p, errs };
}

/* RULING 2026-09-26 (founder: "THE AI GLOB ... I LIKE BETTER ... SHOULD BE MOVEABLE?"): on a phone the
   orb floats again, above the bar, and the reader can move it — drag, or arrow keys — and it stays
   where they put it (localStorage bnr.orb). What the 2026-09-13 seat order protected still holds and
   is proven here: it opens from wherever it sits, it never sits on the bar, the ANT card is not
   covered, and the desktop float is untouched. */
const rectOf = (p, sel) => p.locator(sel).evaluate(n => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, pos: getComputedStyle(n).position }; });
const onScreen = (r, W, H) => r.w > 0 && r.l >= 0 && r.t >= 0 && r.r <= W && r.b <= H;

test('mobile: the orb floats above the bar, on screen, and the ANT card is not covered', async () => {
  const { ctx, p, errs } = await at('wallet.html', 390, 844);
  const orb = await rectOf(p, '#adOrb'), bar = await rectOf(p, '#tbar');
  assert.equal(orb.pos, 'fixed', 'the orb floats');
  assert.ok(onScreen(orb, 390, 844), 'fully on screen ' + JSON.stringify(orb));
  assert.ok(orb.b <= bar.t + 1, `never on the bar (orb bottom ${orb.b}, bar top ${bar.t})`);
  await p.waitForSelector('#ch-autonomi', { timeout: 15000 }); /* the chain matrix renders from adapter reads */
  await p.locator('#ch-autonomi').evaluate(n => n.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  const covered = await p.locator('#ch-autonomi').evaluate(n => {
    const r = n.getBoundingClientRect(), o = document.getElementById('adOrb').getBoundingClientRect();
    const ov = Math.max(0, Math.min(r.right, o.right) - Math.max(r.left, o.left)) * Math.max(0, Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top));
    return ov / (r.width * r.height);
  });
  assert.ok(covered < 0.05, 'the 🐜 Autonomi ANT card is not covered (' + covered.toFixed(3) + ')');
  await p.locator('#adOrb').click();
  await p.waitForTimeout(400);
  assert.ok(await p.locator('#adWin').evaluate(n => n.classList.contains('on')), 'dock window opens from the float');
  await p.locator('#adClose').click();
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('mobile: on inline-host pages (hub) the orb floats on screen and opens', async () => {
  const { ctx, p, errs } = await at('index.html', 390, 844);
  const orb = await rectOf(p, '#adOrb');
  assert.equal(orb.pos, 'fixed');
  assert.ok(onScreen(orb, 390, 844), 'fully on screen ' + JSON.stringify(orb));
  await p.locator('#adOrb').click();
  await p.waitForTimeout(400);
  assert.ok(await p.locator('#adWin').evaluate(n => n.classList.contains('on')), 'dock window opens on the hub');
  await p.locator('#adClose').click();
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('mobile: the reader moves the orb (drag and keys), a drag never opens it, and the spot is kept', async () => {
  const { ctx, p, errs } = await at('wallet.html', 390, 844);
  const a = await rectOf(p, '#adOrb');
  assert.ok(a.l > 195, 'a phone starts on the right (thumb side)');
  const cx = a.l + a.w / 2, cy = a.t + a.h / 2;
  await p.mouse.move(cx, cy); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(cx - 25 * i, cy - 20 * i);
  await p.mouse.up();
  await p.waitForTimeout(500);
  assert.ok(!(await p.locator('#adWin').evaluate(n => n.classList.contains('on'))), 'a drag is not a tap');
  const b1 = await rectOf(p, '#adOrb');
  assert.ok(b1.l < 195, 'dropped on the left half, it settles left ' + JSON.stringify(b1));
  assert.ok(b1.b < a.b - 100, 'and higher up');
  assert.ok(onScreen(b1, 390, 844));
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('bnr.orb') || 'null'));
  assert.equal(kept && kept.side, 'left', 'the spot is kept');
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200);
  const b2 = await rectOf(p, '#adOrb');
  assert.ok(Math.abs(b2.l - b1.l) < 2 && Math.abs(b2.b - b1.b) < 4, 'same spot after reload');
  await p.locator('#adOrb').focus();
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  assert.ok((await rectOf(p, '#adOrb')).l > 195, 'arrow key moves it back to the right');
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(400);
  const b3 = await rectOf(p, '#adOrb');
  assert.ok(b3.b > b2.b, 'arrow down lowers it');
  assert.ok(b3.b <= (await rectOf(p, '#tbar')).t + 1, 'never below the bar top');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('desktop: the classic bottom-left float is untouched', async () => {
  const { ctx, p, errs } = await at('wallet.html', 1280, 800);
  const r = await p.locator('#adOrb').evaluate(n => {
    const b = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), pos: cs.position };
  });
  assert.equal(r.pos, 'fixed');
  assert.equal(r.x, 16, 'left edge unchanged');
  assert.ok(r.y > 600, 'bottom area unchanged');
  await p.locator('#adOrb').click();
  await p.waitForTimeout(400);
  assert.ok(await p.locator('#adWin').evaluate(n => n.classList.contains('on')), 'dock opens on desktop');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('rotate: the float follows the media query both ways (phone right, desktop left)', async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8857/surfaces/wallet.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  const ph = await rectOf(p, '#adOrb');
  assert.equal(ph.pos, 'fixed'); assert.ok(ph.l > 195, 'phone: right');
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.waitForTimeout(1500);
  const r = await p.locator('#adOrb').evaluate(n => ({ parent: n.parentElement.tagName, pos: getComputedStyle(n).position, x: Math.round(n.getBoundingClientRect().x) }));
  assert.equal(r.pos, 'fixed', 'rotate to desktop keeps the float');
  assert.equal(r.parent, 'BODY');
  assert.equal(r.x, 16, 'desktop: the classic left edge');
  await ctx.close();
});
