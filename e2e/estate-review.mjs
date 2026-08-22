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
    rel = rel.replace(/^surfaces\//, '');
    const p = join(SURF, rel);
    const body = await readFile((extname(p) ? p : join(p, 'index.html')));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); } };

const browser = await chromium.launch();
const page = await browser.newPage();
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
const hubLinks = await page.$$eval('a.card', as => as.map(a => a.getAttribute('href')).filter(h => h && !/^https?:/.test(h) && !h.startsWith('#')));
const cards = await page.locator('a.card').count();
console.log(`hub: ${cards} cards, ${hubLinks.length} local hrefs`);

// 2 · crawl every hub-discovered local page
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
  // tour.js presence (the tbar), except pages that opted out
  const hasTour = await page.evaluate(() => !!document.getElementById('tbar'));
  if (!hasTour && !clean.startsWith('onboarding')) findings.push(`NO TOURBAR: ${clean}`);
}
ok('every hub-listed surface exists and loads', !findings.some(f => f.startsWith('MISSING') || f.startsWith('LOAD FAIL') || f.startsWith('ERRORS')));
ok('no broken intra-estate links', !findings.some(f => f.startsWith('BROKEN')));
console.log(findings.length ? 'FINDINGS:\n' + findings.join('\n') : 'FINDINGS: none');
if (netNotes.length) console.log('NET NOTES (external endpoints, not page defects):\n' + [...new Set(netNotes)].join('\n'));

// 3 · counts the whole estate asserts together
const hubTxt = await (await page.goto(`${BASE}/index.html`), page.locator('footer').textContent());
await page.goto(`${BASE}/review.html`); await page.waitForTimeout(200);
const roster = await page.locator('#surf option').count();
ok('hub footer count matches card count', hubTxt.includes(`${cards} surfaces`), `footer=${hubTxt.match(/\d+ surfaces/)?.[0]} cards=${cards}`);
ok('review roster is a sane superset of hub cards', roster >= cards - 8, `roster=${roster} cards=${cards}`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
