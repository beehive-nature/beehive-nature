// estate-review.mjs — the full-hub crawl: every surface, zero-error load, broken-link
// sweep, tour.js presence, internal anchor check. Committed and re-runnable by any
// stranger; feeds the Claude Design estate order.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    if (rel.endsWith('/')) rel += 'index.html';
    /* /surfaces/ alias: tour.js/lang.js inject absolute '/surfaces/…' asset URLs (the
       path both real deployments use — Pages under /beehive-nature/, local servers
       rooted at repo root). Serving the tree at root alone made those 404 on every
       page — a harness artifact, not a site bug. Stripped here so the crawl matches
       production instead of punishing it. */
    const orig = rel;
    rel = rel.replace(/^surfaces\//, '');
    const p = join(SURF, rel);
    /* Repo-root fallback: on Pages the site root IS the repo root, so surfaces
       may import assets that live beside surfaces/, not inside it —
       forge/room.html's '../../forge/visual/shared.js' resolves to
       /forge/visual/shared.js and is 200 on production. Serving only surfaces/
       made that a 404 here and failed the crawl intermittently (the dynamic
       import raced the 150ms settle window) — a harness artifact, same class
       as the /surfaces/ alias above. */
    let body;
    try { body = await readFile((extname(p) ? p : join(p, 'index.html'))); }
    catch { const q = join(ROOT, orig); body = await readFile((extname(q) ? q : join(q, 'index.html'))); }
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); } };

const browser = await chromium.launch();
// Viewport pinned, not defaulted: the tbar height bound below is anchored to 1280px.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
const netNotes = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') {
  const t = m.text();
  /* External-network console errors (CORS posture / ERR_FAILED from this localhost
     origin) are noted, not failed: several live surfaces read public endpoints whose
     CORS answer differs by origin, and the pages render declared failure by design
     ("a gap is data"). Local 404s and every JS exception still fail the crawl. */
  if (/blocked by CORS policy|net::ERR_/.test(t)) netNotes.push(t.split('\n')[0]);
  else errs.push('console: ' + t);
} });

// 1 · hub loads; collect every local href it offers
await page.goto(`${BASE}/index.html`);
await page.waitForTimeout(300);
ok('hub loads clean', errs.length === 0, errs.join(' | '));
// The hub is a DIRECTORY of a.t tiles (formerly card anchors). Every tile is crawled.
const hubLinks = await page.$$eval('a.t', as => as.map(a => a.getAttribute('href')).filter(h => h && !/^https?:/.test(h) && !h.startsWith('#')));
// Local doors only: ↗ property tiles (cross-org Pages sites) live on their
// own origins and are not surfaces of THIS tree, so they never enter the
// roster or footer arithmetic. hubLinks already filters to local hrefs.
const cards = hubLinks.length;
console.log(`hub: ${cards} cards, ${hubLinks.length} local hrefs`);

// 2 · crawl every hub-discovered local page
const TBAR_MAX = 60; // px, collapsed strip at 1280px — see the paint check below
const seen = new Set([...hubLinks, 'index.html']);
const findings = [];
for (const href of seen) {
  const clean = href.replace(/^\.\//, '');
  if (!existsSync(join(SURF, clean))) { findings.push(`MISSING FILE: ${clean}`); continue; }
  errs.length = 0;
  try { await page.goto(`${BASE}/${clean}`, { waitUntil: 'load' }); await page.waitForTimeout(150); }
  catch (e) { findings.push(`LOAD FAIL: ${clean}: ${e.message.split('\n')[0]}`); continue; }
  if (errs.length) findings.push(`ERRORS: ${clean}: ${errs.slice(0, 2).join(' | ')}`);
  // broken local links inside the page (one hop, relative to the page's dir)
  const dir = clean.includes('/') ? clean.slice(0, clean.lastIndexOf('/') + 1) : '';
  const inner = await page.$$eval('a', as => as.map(a => a.getAttribute('href')).filter(Boolean));
  for (const h of inner) {
    if (/^(https?:|mailto:|#|data:)/.test(h)) continue;
    const rootAbs = h.startsWith('/');
    const target = h.split('#')[0].replace(/^\/surfaces\//,'').replace(/^\//,'');
    if (!target) continue;
    const abs = rootAbs ? target : dir + target;
    if (!existsSync(join(SURF, abs))) findings.push(`BROKEN LINK: ${clean} -> ${h}`);
  }
  // tour.js presence AND paint height (the tbar), except pages that opted out
  /* Two founder-reported breaks loaded with zero errors and still shipped an
     unusable bar: page CSS styling bare `nav` restyled the injected strip into
     a viewport-sized sheet, and riders without flex-shrink:0 stretched it to
     126px on blight pages. Both invisible to load/error/presence checks — only
     the RENDERED height tells a healthy bar from a broken one. The collapsed
     strip is ~47px at 1280px (32px links + 14px padding + 1px border); the
     bound leaves slack for fonts/scrollbars without readmitting either bug.
     The riders (register.js / lang.js / rails-badge.js) land async INSIDE the
     bar after the 150ms settle, so poll until the bar is fully dressed (or the
     deadline) before measuring — a bare-bar reading would miss exactly the
     rider bug. On deadline, measure whatever painted rather than skip. */
  const tbarH = await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      if (['tbar', 'bregctl', 'blangctl', 'railsbadge'].every(id => document.getElementById(id))) break;
      await new Promise(r => setTimeout(r, 50));
    }
    const el = document.getElementById('tbar');
    return el ? el.getBoundingClientRect().height : null;
  });
  if (tbarH === null) { if (!clean.startsWith('onboarding')) findings.push(`NO TOURBAR: ${clean}`); }
  else if (tbarH > TBAR_MAX) findings.push(`TBAR HEIGHT: ${clean}: ${Math.round(tbarH)}px > ${TBAR_MAX}px`);
}
ok('every hub-listed surface exists and loads', !findings.some(f => f.startsWith('MISSING') || f.startsWith('LOAD FAIL') || f.startsWith('ERRORS')));
ok('no broken intra-estate links', !findings.some(f => f.startsWith('BROKEN')));
ok(`tour bar rides every surface at strip height (≤${TBAR_MAX}px @1280)`, !findings.some(f => f.startsWith('NO TOURBAR') || f.startsWith('TBAR HEIGHT')));
console.log(findings.length ? 'FINDINGS:\n' + findings.join('\n') : 'FINDINGS: none');
if (netNotes.length) console.log('NET NOTES (external endpoints, not page defects):\n' + [...new Set(netNotes)].join('\n'));

// 3 · counts the whole estate asserts together
const hubTxt = await (await page.goto(`${BASE}/index.html`), page.locator('footer').textContent());
await page.goto(`${BASE}/review.html`); await page.waitForTimeout(200);
const roster = await page.locator('#surf option').count();
{
  // The directory shows MORE doors than the footer counts, on purpose:
  // nine tiles open fleet-hosted/gallery|lab twins of the founder's archive
  // (authorship: NOT OURS — see university-smoke NOT_OURS), the hub itself is
  // not a tile, and forge/orbit-v2.html is a working file deliberately not
  // presented (REACHABILITY_EXEMPT carries the reason). So the invariant is
  // arithmetic, not equality: footerN = ownTiles + hubItself + notPresented.
  const twinTiles = hubLinks.filter(h => /^fleet-hosted\/(gallery|lab)\//.test(h)).length;
  const NOT_PRESENTED = 1; // forge/orbit-v2.html
  const footerN = Number(hubTxt.match(/(\d+)\s+surfaces/)?.[1]);
  const ownTiles = new Set(hubLinks.filter(h => h.endsWith('.html') || h.endsWith('/')).map(h => h.endsWith('/') ? h + 'index.html' : h)).size - twinTiles;
  ok('hub footer count reconciles with the tiles (footer = own tiles + hub itself + not-presented)',
     footerN === ownTiles + 1 + NOT_PRESENTED,
     `footer=${footerN} ownTiles=${ownTiles} twins=${twinTiles} (+1 hub, +${NOT_PRESENTED} orbit-v2)`);
}
ok('review roster is a sane superset of hub cards', roster >= cards - 8, `roster=${roster} cards=${cards}`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
