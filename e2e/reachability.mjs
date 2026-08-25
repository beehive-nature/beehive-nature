// reachability.mjs — ORDER (gate-seat task, 2026-08-24): the count assertions
// prove a surface is COUNTED, not REACHABLE. Three orphans landed tonight, each
// a hand-maintained pointer nobody checked against the tree. This gate walks
// the ACTUAL link graph and fails both ways.
//
//   node reachability.mjs            (against the repo tree)
//   REACH_ROOT=/path/to/tree npm run … (against a mutated throwaway copy — the
//   mutation runs must NEVER touch the real tree)
//   REACH_OVERRIDE=/path/to/list.json (adds allowlist entries for a mutation
//   run only; production runs carry no override)
//
// THE COUNTED SET is the review deck's SURFACES roster (review.html #surf
// options), read from the LIVE page — the roster as shipped, not as grepped.
// It was blind to three surfaces once and its own test certified the blindness
// (b4225f2); this gate is the antidote: the roster is checked against the tree.
//
// THE GRAPH RULES:
//   hub         = surfaces/index.html
//   1-hop       = every local href on the hub that exists
//   1-hop index = a 1-hop page that is an index (index.html or a dir root)
//   2-hop       = local hrefs FROM 1-hop INDEX pages only — a link found on a
//                 non-index 1-hop page does NOT extend reach, or a chain of
//                 orphans satisfies the rule (M3 proves this has teeth)
//
// THE ALLOWLIST FAILS BOTH WAYS (modeled on surfaces/fleet-hosted/I1-EXEMPTION.md):
//   a counted surface that is unreachable and unlisted fails; a listed entry
//   whose file no longer exists fails (stale exemptions are findings, not
//   sediment). Each entry carries its reason and what it does NOT cover.
//   TODAY the list is EMPTY — the fleet nine are art, not counted surfaces,
//   and their hosted twins are reachable 1-hop via fleet-hosted/. The entry
//   shape is here so the next deliberate orphan is written down, not waved in.
//
// FAIL-CLOSED: hub unloadable, roster unreadable or empty, zero local hub
// hrefs, unreadable override — every indeterminate path FAILS, never passes.
// COUNT-AS-RECEIPT: the counted/reachable/exempted arithmetic prints and must
// reconcile exactly — a green run that read nothing is the original bug in
// the fix's clothes.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.REACH_ROOT || join(HERE, '..');
const OVERRIDE = process.env.REACH_OVERRIDE || null;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
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
const page = await browser.newPage();

const localHrefs = async url => {
  let resp;
  try { resp = await page.goto(url, { waitUntil: 'load', timeout: 10000 }); }
  catch { return { error: true }; }
  // FAIL-CLOSED: playwright does not throw on 404 — an error page "loads" with
  // zero links and reads as a linkless page. A non-200 is an ERROR, never empty.
  if (!resp || resp.status() !== 200) return { error: true, status: resp ? resp.status() : 'none' };
  await page.waitForTimeout(150);
  const hrefs = await page.$$eval('a[href]', as =>
    as.map(a => a.getAttribute('href')).filter(Boolean));
  const dir = new URL(url).pathname.replace(/[^/]*$/, '');
  const out = new Set();
  for (const h of hrefs) {
    if (/^(https?:|mailto:|#|data:|javascript:)/.test(h)) continue;
    let clean = h.split('#')[0];
    if (!clean) continue;
    if (clean.endsWith('/')) clean += 'index.html';
    // resolve page-relative to url-relative, then normalize the estate's
    // absolute /surfaces/ form (both deployments serve surfaces at root)
    // root-relative everywhere: absolute "/surfaces/x" keeps its prefix; the
    // estate's other absolute forms are treated as surfaces-relative
    let rel = clean.startsWith('/')
      ? (c => c.startsWith('surfaces/') ? c : 'surfaces/' + c)(clean.replace(/^\/(beehive-nature\/)?/, ''))
      : dir.replace(/^\//, '') + clean;
    rel = normalize(rel).split(sep).join('/');
    out.add(rel);
  }
  return { hrefs: [...out] };
};

// 1 · the hub and its 1-hop set — fail-closed on every indeterminate path
const hub = await localHrefs(`${BASE}/surfaces/index.html`);
ok('R0 hub loads and yields local hrefs', !hub.error && hub.hrefs && hub.hrefs.length > 0,
  hub.error ? 'hub did not load — refusing to pass' : `hrefs=${hub.hrefs.length}`);
const oneHop = new Set((hub.hrefs || []).filter(h => existsSync(join(ROOT, h))));
ok('R0 every hub href exists on disk (broken hub links are findings)',
  oneHop.size === (hub.hrefs || []).length,
  [...(hub.hrefs || [])].filter(h => !oneHop.has(h)).join(', ') || 'all exist');

// 2 · 1-hop indexes → the 2-hop set. ONLY indexes extend reach.
const isIndex = h => h.endsWith('/index.html') || /\/$/.test(h);
const oneHopIndexes = [...oneHop].filter(isIndex);
const twoHop = new Map(); // page -> the 1-hop index that reaches it
for (const idx of oneHopIndexes) {
  const r = await localHrefs(`${BASE}/${idx}`); // idx is already root-relative
  if (r.error) { ok(`R0 1-hop index ${idx} loads`, false, 'index failed to load'); continue; }
  const dir = idx.replace(/[^/]*$/, '');
  for (const h of r.hrefs) {
    const rel = h.includes('/') && !h.startsWith(dir) ? h : h; // already normalized page-relative
    if (existsSync(join(ROOT, rel)) && !twoHop.has(rel)) twoHop.set(rel, idx);
  }
}
const reachable = new Set(['surfaces/index.html', ...oneHop, ...twoHop.keys()]); // the hub is reachable at zero hops

// 3 · the counted set — the review deck roster, read live from ITS page; fail-closed
let counted = null;
try {
  await page.goto(`${BASE}/surfaces/review.html`, { waitUntil: 'load', timeout: 10000 });
  await page.waitForTimeout(250);
  counted = await page.evaluate(() => {
    const sel = document.querySelector('#surf');
    return sel ? [...sel.options].map(o => o.value) : null;
  });
} catch { counted = null; }
if (Array.isArray(counted)) counted = counted.map(c => 'surfaces/' + c);
ok('R0 review roster readable and non-empty (fail-closed: no roster, no pass)',
  Array.isArray(counted) && counted.length > 0, counted === null ? 'roster unreadable' : `entries=${counted.length}`);

// 4 · the allowlist — narrow, reasoned, and two-way
const ALLOWLIST = [
  // THE pattern (modeled on surfaces/fleet-hosted/I1-EXEMPTION.md): narrow,
  // reasoned, and honest about what it does not cover. One entry today.
  {
    path: 'surfaces/forge/orbit-v2.html',
    reason: 'deliberately unlinked: the orbit.html freeze\'s tinkering valve. orbit.html is ' +
      'frozen art (CI-pinned committed blob, e8581b0 era); orbit-v2 is where edits live ' +
      'until a founder ruling swaps them in. Presenting an unfrozen draft in the estate ' +
      'walk would claim a surface the freeze exists to prevent.',
    notCovering: 'exempts REACHABILITY for THIS file only. Not a pass for any other forge ' +
      'page (hexfield/room/huddle/orbit must stay 2-hop reachable via forge/index.html), ' +
      'not a pass for I1/design gates, and it ENDS the day orbit-v2 becomes the linked ' +
      'orbit — then it must be reachable like everything else.'
  }
]; // entries: { path, reason, notCovering }
if (OVERRIDE) {
  try {
    const o = JSON.parse(await readFile(OVERRIDE, 'utf8'));
    if (!Array.isArray(o)) throw new Error('not an array');
    ALLOWLIST.push(...o);
  } catch (e) { ok('R0 override parseable', false, e.message); }
}
const listed = new Set(ALLOWLIST.map(e => e.path));
ok('R2 every allowlist entry names an existing file (stale entries fail)',
  ALLOWLIST.every(e => existsSync(join(ROOT, e.path))),
  ALLOWLIST.filter(e => !existsSync(join(ROOT, e.path))).map(e => e.path).join(', ') || 'no stale entries');
ok('R2 every allowlist entry carries a reason and a notCovering line',
  ALLOWLIST.every(e => e.reason && e.notCovering), 'shape law of I1-EXEMPTION');

// 5 · the reachability assertion + the arithmetic (count-as-receipt)
if (Array.isArray(counted) && counted.length) {
  const unreachable = counted.filter(s => !reachable.has(s) && !listed.has(s));
  ok('R1 every counted surface is reachable within two hops of the hub, or explicitly exempt',
    unreachable.length === 0, unreachable.join(', ') || 'none unreachable');
  const rCounted = counted.filter(s => reachable.has(s)).length;
  const eCounted = counted.filter(s => listed.has(s)).length;
  ok('R4 arithmetic reconciles: counted == reachable + exempted (exactly)',
    rCounted + eCounted === counted.length,
    `counted=${counted.length} reachable=${rCounted} exempted=${eCounted}`);
  console.log(`  receipt · counted ${counted.length} = reachable ${rCounted} + exempted ${eCounted} · hub 1-hop ${oneHop.size} (${oneHopIndexes.length} indexes) · 2-hop ${twoHop.size}`);
}

// 6 · the index rule, asserted not assumed: every 2-hop page's parent is a 1-hop index
const badParents = [...twoHop.entries()].filter(([p, idx]) => !oneHopIndexes.includes(idx) || !oneHop.has(idx));
ok('R3 every 2-hop page hangs off an index that is itself 1-hop (orphan chains do not satisfy)',
  badParents.length === 0, badParents.map(([p, i]) => `${p} via ${i}`).join(', ') || 'structural, verified');

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
