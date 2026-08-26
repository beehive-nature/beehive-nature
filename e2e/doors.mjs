/* doors.mjs — THE SIX FRONT DOORS.
   Founder order, 2026-08-26: each door renders at 390px, no link under the 32px
   tap floor, footer clearance passes the 12px real-room check, zero page errors
   — plus the new one: EVERY LINK A DOOR LISTS RESOLVES 200 AND RENDERS BODY
   TEXT. A door pointing at nothing is the claim-vs-code defect in navigation
   form, which is the defect this estate is least willing to ship.

   Served from the repo root so relative rider paths resolve exactly as Pages
   serves them (same shape as estate-review.mjs). */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const DOORS = join(SURF, 'doors');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

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

const TAP_FLOOR = 32;   // px — the estate's design floor, not an invented 40
const CLEAR = 12;       // px the fixed bar must leave under the footer

const browser = await chromium.launch();
const files = (await readdir(DOORS)).filter(f => f.endsWith('.html')).sort();
ok('the six doors exist, plus their index', files.length === 7, files.join(', '));

const allLinks = new Set();

for (const f of files) {
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  await page.goto(`${BASE}/surfaces/doors/${f}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const m = await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      if (['tbar', 'bregctl', 'blangctl', 'railsbadge'].every(id => document.getElementById(id))) break;
      await new Promise(r => setTimeout(r, 50));
    }
    const prevSB = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(r => setTimeout(r, 220));
    document.documentElement.style.scrollBehavior = prevSB;
    const tb = document.getElementById('tbar');
    const foot = document.querySelector('footer');
    const small = [...document.querySelectorAll('a, button')]
      .filter(a => {
        const r = a.getBoundingClientRect();
        return r.height > 0 && r.height < 32 && !a.closest('#tbar, #adOrb, #adPanel');
      })
      .map(a => (a.textContent || '').trim().slice(0, 22) + ' @' + Math.round(a.getBoundingClientRect().height) + 'px');
    return {
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: (document.querySelector('h1') || {}).textContent || null,
      oneThing: !!document.querySelector('.act'),
      clearance: (tb && foot) ? Math.round(tb.getBoundingClientRect().top - foot.getBoundingClientRect().bottom) : null,
      small,
      links: [...document.querySelectorAll('a[href^="../"]')].map(a => a.getAttribute('href')),
    };
  });

  const d = f.replace('.html', '');
  ok(`${d}: renders at 390px with no horizontal overflow`, m.over === 0, `overflow=${m.over}px`);
  ok(`${d}: has a headline and one thing to do`, !!m.h1 && (f === 'index.html' || m.oneThing), `h1=${m.h1}`);
  ok(`${d}: every link clears the ${TAP_FLOOR}px tap floor`, m.small.length === 0, m.small.join(' | '));
  ok(`${d}: the bar leaves the footer ${CLEAR}px of room`, m.clearance === null || m.clearance >= CLEAR, `clearance=${m.clearance}px`);
  ok(`${d}: zero page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
  /* Strip the fragment before resolving. blanguage.html#skaists is a real
     page plus an anchor, and the gate was treating the whole string as a
     filename — a legitimate deep link read as a broken one. */
  m.links.forEach(h => allLinks.add(h.replace(/^\.\.\//, '').split('#')[0]));
  await page.close();
}

/* THE NEW ASSERTION. Not "the file exists" — a file can exist and render
   nothing. Load every listed link and require real body text, so a door can
   never point at a blank. */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const broken = [], blank = [];
  for (const href of [...allLinks].sort()) {
    if (/^https?:/.test(href)) continue;
    const target = href.endsWith('/') ? href + 'index.html' : href;
    if (!existsSync(join(SURF, target))) { broken.push(target); continue; }
    const resp = await page.goto(`${BASE}/surfaces/${target}`, { waitUntil: 'load' }).catch(() => null);
    if (!resp || resp.status() !== 200) { broken.push(`${target} (${resp ? resp.status() : 'load failed'})`); continue; }
    await page.waitForTimeout(120);
    const text = await page.evaluate(() => (document.body.innerText || '').trim().length);
    if (text < 80) blank.push(`${target} (${text} chars)`);
  }
  ok(`every link the doors list resolves 200 (${allLinks.size} links)`, broken.length === 0, broken.join(', '));
  ok('every link the doors list renders body text', blank.length === 0, blank.join(', '));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
