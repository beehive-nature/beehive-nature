// footer-audit.mjs — the bottom half of every surface, measured in every register, at 390 px.
// Founder, same day: "its not just the bar… EVERYTHING BOTTOM HALF OF EVERY SURFACE NEEDS TO BE CHECKED".
//
// Founder, 2026-09-26: "there is bugs all over the place in the bottom/footer in probably 50+
// surfaces… every tiny mistake or something out of place will quickly become very obvious to users."
// The bottom edge is shared chrome (tour.js's #tbar + ☰, register.js's dress, lang.js and
// rails-badge.js riders) laid over ~120 hand-built pages, so its bugs are the product of both. This
// walks every counted surface (scripts/surface-count.mjs) × new bee / raver / cypherpunk, scrolls to
// the end like a reader does, and records what a reader would see:
//   CLIP     a bar item cut by the ☰ toggle or the screen edge (a sliver, half a word)
//   UNDER    page content that ends underneath the bar (the last line unreadable)
//   COLLIDE  another fixed/sticky bottom element overlapping the bar or the toggle
//   SEAT     the toggle not sitting inside the bar it belongs to
//   TAP      a bar link under 44 px tall (touch law)
//   WIDE     the page scrolls sideways at 390 px
//   TALL     the resting bar taller than 64 px (it eats the page)
// and, over everything in the lower half of the page (from mid-page to the end):
//   CUT      text cut by its own box (overflow hidden/ellipsis on real words)
//   OVERLAP  two pieces of text drawn over each other
//   OFFSIDE  an element sticking out past the 390 px screen
//   SMALL    reading text under 12 px
//   FAINT    text contrast under 4.5:1 against what is behind it
//   BROKEN   an image that did not load
//   JUNK     undefined / NaN / null / [object …] / a lone dash shown as a value
//   CAPS     forced capitals (text-transform), against the casing law
//   TINY     a link or button under 32 px tall (touch); links inside running prose are exempt (WCAG 2.5.8)
// External requests are refused (nothing leaves the box). Screens of the bottom 220 px go to
// --shots <dir> for the contact sheet. Exit 1 on any finding unless --report.
// CI runs it as a ratchet: --baseline e2e/footer-audit.baseline.json fails when any page × register
// gains findings of a kind; --write-baseline records a run as the new floor.
// Run:  node e2e/footer-audit.mjs [--only a.html,b.html] [--regs bee,raver] [--shots dir] [--report] [--json out.json]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSurfacesOnDisk } from '../scripts/surface-count.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ONLY = arg('only', ''), REGS = arg('regs', 'bee,raver,cypherpunk').split(','), SHOTS = arg('shots', ''), JSON_OUT = arg('json', '');
const REPORT = process.argv.includes('--report');
const PORT = +arg('port', '8877'), ORIGIN = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };

const pages = ONLY ? ONLY.split(',') : listSurfacesOnDisk(join(ROOT, 'surfaces'));
const srv = createServer(async (q, s) => {
  let rel = decodeURIComponent(q.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  try { const body = await readFile(join(ROOT, rel)); s.writeHead(200, { 'content-type': TYPES[extname(rel)] || 'application/octet-stream' }); s.end(body); }
  catch { s.writeHead(404); s.end(); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();

// Runs in the page, scrolled to the end, after the riders have mounted.
function measure() {
  const W = innerWidth, H = innerHeight, out = [];
  const bar = document.getElementById('tbar'), tg = document.getElementById('tbarMore');
  if (!bar) return { out, mode: 'none' };
  const inline = !!bar.closest('[data-tour-host]') && getComputedStyle(bar).position !== 'fixed';
  if (inline) return { out, mode: 'inline' };
  const br = bar.getBoundingClientRect(), tgOn = tg && getComputedStyle(tg).display !== 'none' && getComputedStyle(tg).visibility !== 'hidden';
  const tr = tgOn ? tg.getBoundingClientRect() : null;
  const edge = tr ? tr.left : W;
  const label = el => (el.id ? '#' + el.id : '') + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  // CLIP: an item that is partly on screen — straddling the toggle's left edge or the screen edge.
  for (const el of bar.children) {
    if (el.classList.contains('tsep')) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const straddle = (x) => r.left < x - 1 && r.right > x + 1;
    if (straddle(edge) || straddle(W)) out.push(['CLIP', `${label(el)} cut at ${Math.round(r.left)}–${Math.round(r.right)} (visible edge ${Math.round(edge)})`]);
    if (r.height && r.height < 44 && r.right <= edge) out.push(['TAP', `${label(el)} ${Math.round(r.height)} px tall`]);
  }
  if (tr && (tr.top < br.top - 1 || tr.bottom > br.bottom + 1)) out.push(['SEAT', `toggle ${Math.round(tr.top)}–${Math.round(tr.bottom)} outside bar ${Math.round(br.top)}–${Math.round(br.bottom)}`]);
  if (br.height > 64) out.push(['TALL', `bar ${Math.round(br.height)} px`]);
  // UNDER: in-flow content whose last pixels end below the bar's top, with the page scrolled to its end.
  const chrome = '#tbar,#tbarMore,#railsbadge,#blangctl,#bregbar,#adOrb,#adPanel,#adWin';
  let low = null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.closest(chrome)) continue;
    const cs = getComputedStyle(n);
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      const r = n.getBoundingClientRect();
      if (r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0) {
        const hit = (a) => a && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top;
        const full = r.width * r.height > .6 * W * H;
        if (!full && (hit(br) || hit(tr))) out.push(['COLLIDE', `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : ''} (${cs.position}) ${Math.round(r.top)}–${Math.round(r.bottom)} over the bar`]);
      }
      continue;
    }
    if (n.children.length || cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (n.checkVisibility && !n.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true })) continue;
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= H) continue;
    if (!(n.textContent || '').trim() && !/^(IMG|VIDEO|CANVAS|SVG|INPUT|BUTTON|SELECT|TEXTAREA|IFRAME)$/i.test(n.tagName)) continue;
    if (n.closest('[aria-hidden="true"]')) continue;
    if (!low || r.bottom > low.b) low = { b: r.bottom, el: n };
  }
  if (low && low.b > br.top + 1) out.push(['UNDER', `${low.el.tagName.toLowerCase()} "${(low.el.textContent || '').trim().slice(0, 30)}" ends at ${Math.round(low.b)} under the bar top ${Math.round(br.top)}`]);
  if (document.documentElement.scrollWidth > W + 1) out.push(['WIDE', `page ${document.documentElement.scrollWidth} px wide`]);
  // a phone widens its LAYOUT viewport to fit overflowing content even under body{overflow-x:hidden}
  // (the page is then zoomed out and the bar sits partly off-screen): innerWidth itself grows past 390
  else if (innerWidth > 391) out.push(['WIDE', `layout viewport ${innerWidth} px (content overflows 390)`]);
  return { out, mode: 'fixed', bar: Math.round(br.height) };
}
// The lower half: every element whose box lies below the page's middle, measured in document coordinates.
function lowerHalf() {
  const W = innerWidth, out = [], sy = scrollY, docH = document.documentElement.scrollHeight, mid = docH / 2;
  const chrome = '#tbar,#tbarMore,#railsbadge,#blangctl,#bregbar,#adOrb,#adPanel,#adWin';
  const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return { L: .2126 * f(r) + .7152 * f(g) + .0722 * f(b), a }; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = lum(cs.backgroundColor); if (c && c.a > .9) return c.L; } return lum(getComputedStyle(document.body).backgroundColor)?.L ?? 1; };
  const say = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const texts = [];
  const seen = new Set();
  const all = document.body.querySelectorAll('*');
  for (const el of all) {
    if (el.closest(chrome) || el.closest('[aria-hidden="true"]')) continue;
    // what a reader can see: closed <details>, content-visibility, display/visibility/opacity all respected
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true })) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const top = r.top + sy; if (top + r.height < mid) continue;
    if (cs.textTransform === 'uppercase' || cs.textTransform === 'capitalize') { const k = 'CAPS' + cs.textTransform; if (!seen.has(k + el.className)) { seen.add(k + el.className); out.push(['CAPS', say(el) + ' ' + cs.textTransform]); } }
    const hiddenBox = r.width <= 2 || r.height <= 2 || cs.clipPath !== 'none' || cs.clip !== 'auto';
    if (hiddenBox) continue;
    if (r.right > W + 1 && cs.position !== 'fixed') {
      let scroller = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox !== 'visible') { scroller = true; break; } }
      if (!scroller) out.push(['OFFSIDE', say(el) + ` right ${Math.round(r.right)}`]);
    }
    if (el.tagName === 'IMG' && el.complete && !el.naturalWidth) out.push(['BROKEN', 'img ' + (el.getAttribute('src') || '').slice(0, 60)]);
    // WCAG 2.5.8's inline exception: a link inside running prose is sized by the sentence. Prose =
    // the parent still holds 20+ characters once every link in it is taken out (a row of links
    // separated by dots is NOT prose and stays measured).
    const inProse = e => { if (e.tagName !== 'A' || getComputedStyle(e).display !== 'inline') return false; const par = e.parentElement; if (!par) return false; let t = (par.textContent || '').length; for (const x of par.querySelectorAll('a')) t -= (x.textContent || '').length; return t >= 20; };
    if (/^(A|BUTTON|SUMMARY)$/.test(el.tagName) && r.height < 32 && (el.textContent || '').trim() && !inProse(el)) out.push(['TINY', say(el) + ` ${Math.round(r.height)} px`]);
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    if (!own) continue;
    if (/\b(undefined|NaN|null)\b|\[object \w+\]/.test(own) || /^[—–-]$/.test(own)) out.push(['JUNK', say(el)]);
    const fs = parseFloat(cs.fontSize); if (fs < 12 && /[A-Za-z\u00C0-\uFFFF]{3}/.test(own)) out.push(['SMALL', say(el) + ` ${fs}px`]);
    if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2 && own.length > 3) out.push(['CUT', say(el) + ` ${el.scrollWidth}>${el.clientWidth}`]);
    const fg = lum(cs.color), bg = bgOf(el);
    if (fg && bg != null && fg.a > .5) { const [a, b] = [fg.L, bg].sort((x, y) => y - x); const ratio = (a + .05) / (b + .05); if (ratio < 4.5 && fs < 24) out.push(['FAINT', say(el) + ` ${ratio.toFixed(2)}:1`]); }
    // glyph boxes of this element's own text, one per line
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 2 && q.height > 2) texts.push({ el, n, r: q });
    }
  }
  // OVERLAP: glyph boxes of two different text runs drawn over each other (bucketed by row)
  const rows = new Map(), hits = new Set();
  for (const t of texts) { const k0 = Math.floor(t.r.top / 32), k1 = Math.floor(t.r.bottom / 32); for (let k = k0; k <= k1; k++) { if (!rows.has(k)) rows.set(k, []); rows.get(k).push(t); } }
  for (const list of rows.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (a.n === b.n || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ix > 6 && iy > Math.min(a.r.height, b.r.height) * .35) { const key = say(a.el) + ' × ' + say(b.el); if (!hits.has(key)) { hits.add(key); out.push(['OVERLAP', key]); } }
  }
  return out;
}

const results = [];
async function run(page, reg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', route => route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort('blockedbyclient'));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  let rec = { page, reg, findings: [] };
  try {
    await p.goto(`${ORIGIN}/surfaces/${page}`, { waitUntil: 'load', timeout: 20000 });
    await p.waitForTimeout(1700);   // tour.js re-fits at 500 and 1500 ms, after the riders mount
    // instant, whatever the page's scroll-behavior: a smooth scroll is still moving when we measure
    await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await p.waitForTimeout(350);
    const m = await p.evaluate(measure);
    // lower half: walk it from the middle down, so everything is laid out, then measure it all at once
    const low = await p.evaluate(lowerHalf);
    rec = { ...rec, mode: m.mode, bar: m.bar, findings: m.out.concat(low) };
    if (SHOTS) { const H = await p.evaluate(() => document.documentElement.scrollHeight); const mid = Math.floor(H / 2); await p.screenshot({ path: join(SHOTS, `${page.replace(/\//g, '__')}--${reg}--half.png`), fullPage: true, clip: { x: 0, y: mid, width: 390, height: Math.min(H - mid, 2600) } }); }
    if (SHOTS) await p.screenshot({ path: join(SHOTS, `${page.replace(/\//g, '__')}--${reg}.png`), clip: { x: 0, y: 844 - 220, width: 390, height: 220 } });
  } catch (e) { rec.findings.push(['LOAD', String(e).split('\n')[0].slice(0, 140)]); }
  await ctx.close();
  results.push(rec);
}
const jobs = []; for (const pg of pages) for (const r of REGS) jobs.push([pg, r]);
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (next < jobs.length) { const [pg, r] = jobs[next++]; await run(pg, r); } }));
await browser.close(); srv.close();

results.sort((a, b) => (a.page + a.reg).localeCompare(b.page + b.reg));
const bad = results.filter(r => r.findings.length);
const byKind = {};
for (const r of bad) for (const [k] of r.findings) byKind[k] = (byKind[k] || 0) + 1;
for (const r of bad) for (const [k, t] of r.findings) console.log(`${k.padEnd(7)} ${r.page} [${r.reg}] ${t}`);
const pagesBad = new Set(bad.map(r => r.page)).size;
console.log(`\n${results.length} page×register views · ${pages.length} surfaces · ${bad.length} views with findings on ${pagesBad} surfaces · ${Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(' · ') || 'no findings'}`);
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(results, null, 1) + '\n');
/* THE RATCHET (CI): --baseline <file> compares per page × register × kind counts with the
   committed baseline. A count above its baseline (or a kind the baseline never had) fails;
   a count below it is reported so the baseline can be tightened. The estate only gets better.
   --write-baseline rewrites the file from this run (after a fix, commit the smaller numbers). */
const BASE = arg('baseline', '');
if (BASE) {
  const tally = {};
  for (const r of results) { const k = `${r.page} [${r.reg}]`; for (const [kind] of r.findings) { tally[k] ??= {}; tally[k][kind] = (tally[k][kind] || 0) + 1; } }
  if (process.argv.includes('--write-baseline')) {
    const sorted = Object.fromEntries(Object.keys(tally).sort().map(k => [k, Object.fromEntries(Object.keys(tally[k]).sort().map(x => [x, tally[k][x]]))]));
    await writeFile(BASE, JSON.stringify({ _law: 'footer-audit ratchet: counts may only fall. Regenerate with --write-baseline after a fix.', views: sorted }, null, 1) + '\n');
    console.log(`baseline written: ${Object.keys(sorted).length} views with findings`);
    process.exit(0);
  }
  /* layout kinds hang on where a line wraps, which a CI runner's fonts can move by a word;
     they get a slack of 2 per view. Computed-style kinds (SMALL, FAINT, CAPS, JUNK, TAP…) are exact. */
  const LAYOUT = new Set(['OVERLAP', 'OFFSIDE', 'CUT', 'TINY', 'UNDER', 'COLLIDE']);
  const base = JSON.parse(await readFile(BASE, 'utf8')).views;
  const seen = new Set(results.map(r => `${r.page} [${r.reg}]`));
  const worse = [], better = [];
  for (const k of seen) {
    const now = tally[k] || {}, was = base[k] || {};
    for (const kind of new Set([...Object.keys(now), ...Object.keys(was)])) {
      const n = now[kind] || 0, b0 = was[kind] || 0;
      if (n > b0 + (LAYOUT.has(kind) ? 2 : 0)) worse.push(`${k} ${kind} ${b0} → ${n}`); else if (n < b0) better.push(`${k} ${kind} ${b0} → ${n}`);
    }
  }
  for (const w of better) console.log('BETTER  ' + w);
  for (const w of worse) console.log('WORSE   ' + w);
  console.log(`ratchet: ${worse.length} worse · ${better.length} better than ${BASE.split(/[\\/]/).pop()}`);
  process.exit(worse.length ? 1 : 0);
}
process.exit(bad.length && !REPORT ? 1 : 0);
