/* soul-chrome.mjs — FOUNDER BUG 2026-10-01
   Bottom rails chrome and connect menus must reflect soul truth:
   - no soul  → honest "connect" + "create bzDiD" / "get a bzDiD"
   - live soul (bnr_soul / painted .b) → those CTAs GONE; identity only
   Click-through: with soul live, footer has no connect/create; without, they appear.
   Served from repo root the same way doors.mjs does. CI: tests.yml node job. */
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
  '.json': 'application/json', '.svg': 'image/svg+xml',
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

const browser = await chromium.launch();

async function badgeText(page) {
  // Attached first — on narrow the badge is display:none until the ☰ drawer opens.
  await page.waitForSelector('#railsbadge #rb-txt', { state: 'attached', timeout: 8000 });
  const more = page.locator('#tbarMore');
  if (await more.count()) {
    const expanded = await page.locator('#tbar.t-open').count();
    if (!expanded) {
      await more.evaluate(el => { el.style.display = 'inline-flex'; });
      await more.click({ force: true });
      await page.waitForTimeout(250);
    }
  }
  // Prefer visible text; fall back to textContent if CSS still hides the rider.
  const loc = page.locator('#railsbadge #rb-txt');
  try {
    await loc.waitFor({ state: 'visible', timeout: 2000 });
    return loc.innerText();
  } catch (e) {
    return loc.evaluate(el => el.textContent || '');
  }
}

async function hasConnectCreate(txt) {
  const t = (txt || '').toLowerCase();
  const hasConnect = /\bconnect\b/.test(t);
  const hasCreate = /create bzdid|get a bzdid/.test(t);
  return { hasConnect, hasCreate, both: hasConnect && hasCreate };
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/surfaces/wallet.html`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  let txt = await badgeText(page);
  let cc = await hasConnectCreate(txt);
  ok('wallet cold: rails badge shows connect', cc.hasConnect, txt.slice(0, 120));
  ok('wallet cold: rails badge shows create bzDiD', cc.hasCreate, txt.slice(0, 120));

  // paint a live soul mid-session (same path wallet publishSoul uses)
  await page.evaluate(() => {
    try { localStorage.setItem('bnr_soul', 'kingbeelovis'); } catch (e) {}
    document.body.setAttribute('data-wl-soul', 'true');
    const wq = document.getElementById('wq'); if (wq) wq.value = 'kingbeelovis';
    document.dispatchEvent(new CustomEvent('bnr-soul', { detail: { soul: 'kingbeelovis' } }));
  });
  await page.waitForTimeout(600);
  txt = await badgeText(page);
  cc = await hasConnectCreate(txt);
  ok('wallet live: rails badge shows .b name', /kingbeelovis\.b/i.test(txt), txt.slice(0, 160));
  ok('wallet live: rails badge has NO connect', !cc.hasConnect, txt.slice(0, 160));
  ok('wallet live: rails badge has NO create bzDiD', !cc.hasCreate, txt.slice(0, 160));

  // shell CTAs
  const createVisible = await page.locator('.wl-create-bzdid').isVisible().catch(() => false);
  const connectVisible = await page.locator('.wl-connect-cta').isVisible().catch(() => false);
  ok('wallet live: connect-sec create CTA hidden', !createVisible);
  ok('wallet live: connect-sec connect CTA hidden', !connectVisible);

  // clear soul → CTAs return
  await page.evaluate(() => {
    try { localStorage.removeItem('bnr_soul'); } catch (e) {}
    document.body.removeAttribute('data-wl-soul');
    const wq = document.getElementById('wq'); if (wq) wq.value = '';
    document.dispatchEvent(new CustomEvent('bnr-soul', { detail: { soul: null } }));
  });
  await page.waitForTimeout(600);
  txt = await badgeText(page);
  cc = await hasConnectCreate(txt);
  ok('wallet cleared: connect returns', cc.hasConnect, txt.slice(0, 120));
  ok('wallet cleared: create bzDiD returns', cc.hasCreate, txt.slice(0, 120));
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { try { localStorage.setItem('bnr_soul', 'kingbeelovis'); } catch (e) {} });
  await page.goto(`${BASE}/surfaces/wallet.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const txt = await badgeText(page);
  const cc = await hasConnectCreate(txt);
  ok('wallet boot-with-soul: identity only (no connect)', !cc.hasConnect && /kingbeelovis\.b/i.test(txt), txt.slice(0, 160));
  ok('wallet boot-with-soul: no create bzDiD', !cc.hasCreate, txt.slice(0, 160));
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/surfaces/bnames.html`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  // reveal soul strip if hidden behind eternal front
  await page.evaluate(() => {
    const strip = document.getElementById('soul-strip');
    if (strip) strip.style.display = 'block';
  });
  const createCold = await page.locator('#soul-create').isVisible().catch(() => false);
  const goCold = await page.locator('#soul-go').isVisible().catch(() => false);
  ok('bnames cold: create bzDiD visible', createCold);
  ok('bnames cold: connect visible', goCold);

  await page.fill('#soul-in', 'kingbeelovis');
  await page.click('#soul-go');
  await page.waitForTimeout(400);
  const createLive = await page.locator('#soul-create').isVisible().catch(() => false);
  const goLive = await page.locator('#soul-go').isVisible().catch(() => false);
  const chip = await page.locator('#soul-chip').innerText();
  ok('bnames live: chip says connected', /connected/i.test(chip) && /kingbeelovis/i.test(chip), chip);
  ok('bnames live: create bzDiD removed', !createLive);
  ok('bnames live: connect removed', !goLive);

  const txt = await badgeText(page);
  const cc = await hasConnectCreate(txt);
  ok('bnames live: rails badge no connect/create', !cc.hasConnect && !cc.hasCreate, txt.slice(0, 160));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
