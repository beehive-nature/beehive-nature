// orb-seat.test.mjs — the mobile seat proof (founder order 2026-09-13)
// The orb must still OPEN from every seat, cover nothing on mobile, and keep
// the desktop float untouched. Run: node --test e2e/orb-seat.test.mjs
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

test('mobile: the orb rides the fixed tour bar and the ANT card is visible', async () => {
  const { ctx, p, errs } = await at('wallet.html', 390, 844);
  const orb = p.locator('#adOrb');
  assert.equal(await orb.evaluate(n => n.parentElement.id), 'tbar', 'orb seated in the tour bar');
  assert.equal(await orb.evaluate(n => getComputedStyle(n).position), 'static', 'not floating');
  // new bee opens on its home list (the three grammars, 2026-09-26): the ANT
  // card lives in "see what i have", one row away, which is the reader's path
  await p.locator('#wl-bee [data-wl-go="have"]').click();
  await p.waitForTimeout(400);
  await p.waitForSelector('#ch-autonomi', { timeout: 15000 }); /* the chain matrix renders from adapter reads */
  const ant = p.locator('#ch-autonomi');
  const antVisible = await ant.evaluate(n => {
    const r = n.getBoundingClientRect();
    const orbR = document.getElementById('adOrb').getBoundingClientRect();
    const overlap = Math.max(0, Math.min(r.right, orbR.right) - Math.max(r.left, orbR.left)) * Math.max(0, Math.min(r.bottom, orbR.bottom) - Math.max(r.top, orbR.top));
    return r.width > 0 && r.height > 0 && overlap / (r.width * r.height) < 0.05;
  });
  assert.ok(antVisible, 'the 🐜 Autonomi ANT card is on screen and not covered');
  await orb.click();
  await p.waitForTimeout(400);
  assert.ok(await p.locator('#adWin').evaluate(n => n.classList.contains('on')), 'dock window opens from the bar seat');
  await p.locator('#adClose').click();
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('mobile: the orb rides the register chrome on inline-host pages (hub)', async () => {
  const { ctx, p, errs } = await at('index.html', 390, 844);
  const orb = p.locator('#adOrb');
  assert.ok(await orb.evaluate(n => n.parentElement.tagName === 'SUMMARY' || n.parentElement.id === 'bregbar' || n.parentElement.hasAttribute('data-register-host')), 'seated in visible in-flow chrome (summary/register row)');
  assert.match(await orb.evaluate(n => getComputedStyle(n).position), /static|relative/, 'not floating over content');
  await orb.scrollIntoViewIfNeeded();
  await orb.click();
  await p.waitForTimeout(400);
  assert.ok(await p.locator('#adWin').evaluate(n => n.classList.contains('on')), 'dock window opens from the summary seat');
  await p.locator('#adClose').click();
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

test('rotate: seat follows the media query both ways', async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8857/surfaces/wallet.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  assert.equal(await p.locator('#adOrb').evaluate(n => n.parentElement.id), 'tbar');
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.waitForTimeout(1500);
  const r = await p.locator('#adOrb').evaluate(n => ({ parent: n.parentElement.tagName, pos: getComputedStyle(n).position }));
  assert.equal(r.pos, 'fixed', 'rotate to desktop restores the float');
  assert.equal(r.parent, 'BODY');
  await ctx.close();
});
