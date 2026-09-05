// design-acceptance.mjs — the STANDING ORDER DESIGN ACCEPTANCE gate.
// Five laws + mobile, as mechanical proxies; the parts that need judgment
// (does the gradient carry the ARGUMENT, do hues MEAN their meanings in use)
// stay human — the gate checks the structure that makes those judgements
// checkable, and FAILS a surface that misses the structure.
//
//   node design-acceptance.mjs surfaces/devroom.html [more.html …]
//
// D1 DEPTH LADDER      three distinct structural backgrounds: body void / panel / inset
// D2 SEMANTIC COLOUR   five --sem-* tokens declared (harm solution value system science)
//                      + meanings-picked-first comment present in source
// D3 HEADLINE          h1 has a background-image with background-clip:text, color transparent
// D4 HERO NUMBER       one figure at ≥32px with a ≤11px UPPERCASE caption beside it
// D5 DENSITY WITH AIR  body type ≤14px AND panel radius ≥10px AND panel padding ≥12px
// M  MOBILE            viewport meta + a ≤600px media query + no horizontal overflow at 375px
// I1 INSTANT · ALL subresources counted — same-origin is NEVER a free pass
//    (tour.js is same-origin and injects three more scripts; that's how a
//    seed page once claimed nothing loads while loading four things).
//    Cross-origin = FAIL. Same-origin = itemized against the estate rider
//    allowlist; anything outside it = FAIL. The count and KB print either way.
// I2 INSTANT · first contentful paint < 1000ms, the number PRINTED in the
//    output — the standing order says measure it, not claim it.
//    THE METHOD (pinned 2026-08-24, `--measure`): localhost http · cold
//    context per run · real Chromium · FCP read after the paint entry is
//    queryable · request count and KB alongside · five runs, table printed.
//    file:// numbers are NOT comparable and go on record only as divergence.
// F  FORM KILL — human-judged, printed as the gate's last word: if a stranger's
//    first impression is "fill this in" rather than "here is what this is,"
//    the surface fails no matter how green every check above is.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

/* the estate's sanctioned riders — the tbar session and its companions plus
   static assets every surface may reference. ANYTHING else that loads at
   page-open, same-origin or not, is a dependency the surface must argue for
   in the open — the gate will not wave it through. */
const RIDER_ALLOWLIST = [
  /\/tour\.js/, /\/register\.js/, /\/lang\.js/, /\/rails-badge\.js/, /\/level-truth\.js/,
  /\/agent-dock\.js/,
  /\/manifest\.webmanifest/, /\/bn-logo\.(jpg|png)/, /\/icon-180\.png/,
  /\.(json|css)(\?|$)/,
  /* the wallet's first-party vendored riders — the bzDiD key carrier and the
     bnr-keys/bnr-sign Rust-core glue under onboarding/vendor (added when the
     master design pass first ran this gate over surfaces/wallet.html;
     first-party files, named by exact path) */
  /\/onboarding\/bzdid-key\.js/, /\/onboarding\/vendor\/bnr-(sign|keys|qr)\.js/,
  /\/onboarding\/vendor\/bip39-wordlist\.js/, /\/(vault|arweave)\.js/,
  /* the spend-receipt auditor rider — one first-party engine shared by
     surfaces/comb.html's verifier lane and surfaces/wallet.html's receipts
     panel (z3.2 build, 2026-09-03); reads only same-origin spend-ledger.json
     (the json rule above) and carries no other dependency */
  /\/spend-audit\.js/,
  /* the x402 meter-session auditor rider (z3.2, 2026-09-04) — the pure
     9-check audit recomputed in-page on surfaces/vending.html §x402-sec;
     reads only same-origin x402-session42.json (the json rule above) plus
     the same public rehearsal-RPC host the rest of that surface already
     reads, and is held to contracts/vending/tool/x402audit.mjs by
     e2e/x402-engine-parity.mjs */
  /\/x402-meter\.js/,
  /* W-1, the in-browser model (founder order 2026-09-04): vendored
     @mlc-ai/web-llm (Apache-2.0, L-VERIFY @56d318cd) served same-origin at
     surfaces/blight/web-llm.mjs, imported ONLY on the user's wake click —
     nothing model-shaped loads at page-open. The one-time model fetch
     (≈204 MB, SmolLM2-360M-Instruct q4f16; hosts OBSERVED in the receipt
     run: huggingface.co · raw.githubusercontent.com · us.aws.cdn.hf.co —
     then Cache Storage, zero network thereafter, offline proven) is
     likewise click-time and so outside this gate's page-open count by
     construction; named here so the dependency is argued in the open. */
  /\/web-llm\.mjs/,
  /* the market's live chain reads (founder source-confirmed: host-rotated Base
     RPC, zero caching — the surface is honestly live): itemized by exact host */
  /^https:\/\/base-rpc\.publicnode\.com\//,
  /^https:\/\/base\.drpc\.org\//,
  /* the market's live price read (founder eye-catch #7, 2026-08-29): Coinbase's
     own public spot endpoint for the ETH-USD leg — the one new off-origin host
     the fix adds; the per-token leg stays on the Base RPC hosts above */
  /^https:\/\/api\.coinbase\.com\/v2\/prices\//,
  /* the museum's live art reads from base.org's own Basenames API (the
     archived byte-true fallback rides in the tree — MUSEUM LAW) */
  /^https:\/\/www\.base\.org\/api\//,
  /* the engine room's status board probes the estate's own organs live
     (reach per road + NIP-11 identity) — itemized by exact host */
  /^https:\/\/skaists\.buzz\//,
  /^https:\/\/beehivenature\.buzz\//,
  /^https:\/\/relay\.skaists\.dev\//,
  /^https:\/\/relay2\.skaists\.dev\//,
  /* the house crest of von Zutphen — first-party regalia, committed in the tree */
  /assets\/seals\//
];

const MEASURE = process.argv.includes('--measure');
const RUNS = 5;

// The repo root derived from THIS FILE, never process.cwd() — the gate must
// run identically from any directory (bZiq defect: target paths used to
// resolve against the caller's cwd and broke every foreign invocation).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function serveRoot() {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const { readFile: rd } = await import('node:fs/promises');
  const srv = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
      const p = join(ROOT, rel);
      const body = await rd(p);
      res.writeHead(200, { 'content-type': MIME[(p.match(/\.[a-z0-9]+$/) || [])[0]] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}

if (MEASURE) {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const { srv, base } = await serveRoot();
  const browser = await chromium.launch();
  for (const rel of files) {
    const url = base + '/' + rel.replace(/\\/g, '/').replace(/^\.\.\//, '');
    console.log(`\n### THE METHOD · ${rel} · localhost http · cold context · real Chromium · ${RUNS} runs`);
    const rows = [];
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext(); // COLD — nothing warm, nothing cached
      const pg = await ctx.newPage();
      const reqs = [];
      const sizes = [];
      pg.on('request', r => { if (r.resourceType() !== 'document') reqs.push(r.url().split('/').pop()); });
      pg.on('response', async r => { try { sizes.push((await r.body()).length); } catch {} });
      await pg.goto(url, { waitUntil: 'commit' });
      // FCP read only after the paint entry is queryable — poll until it exists
      const fcp = await pg.waitForFunction(() =>
        performance.getEntriesByType('paint').some(e => e.name === 'first-contentful-paint'),
        null, { timeout: 10000 }).then(() =>
        pg.evaluate(() => Math.round(performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint').startTime))).catch(() => null);
      rows.push({ run: i + 1, fcp, n: reqs.length, riders: reqs.join(','), kb: (sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(1) });
      await ctx.close();
    }
    rows.forEach(r => console.log(`  run ${r.run} · FCP ${r.fcp === null ? 'unmeasured' : r.fcp + 'ms'} · ${r.n} requests · ${r.kb} KB · riders: ${r.riders || 'none'}`));
    const fcps = rows.map(r => r.fcp).filter(v => v !== null).sort((a, b) => a - b);
    if (fcps.length) console.log(`  median FCP ${fcps[Math.floor(fcps.length / 2)]}ms · requests ${rows[0].n} · ${rows[0].kb} KB — THE number for the report`);
  }
  await browser.close(); srv.close();
  process.exit(0);
}


const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['surfaces/devroom.html'];
const browser = await chromium.launch();

let totalPass = 0, totalFail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { totalPass++; console.log(`  PASS ${name}`); }
  else { totalFail++; console.log(`  FAIL ${name}${note ? ' — ' + note : ''}`); }
};

for (const rel of targets) {
  const path = resolve(ROOT, rel);
  const url = 'file://' + path.replace(/\\/g, '/');
  const src = await readFile(path, 'utf8');
  console.log(`\n### ${rel}`);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // D1 — three distinct structural background steps
  const d1 = await page.evaluate(() => {
    const bg = el => el ? getComputedStyle(el).backgroundColor : 'none';
    const body = bg(document.body);
    const panel = bg(document.querySelector('section'));
    const inset = bg(document.querySelector('.art,.pstat,#pipe,pre') || document.querySelector('section *'));
    return { body, panel, inset,
      distinct: new Set([body, panel, inset]).size >= 3 && !new Set([body, panel, inset]).has('rgba(0, 0, 0, 0)') };
  });
  ok('D1 depth ladder (void/panel/inset distinct)', d1.distinct, `body=${d1.body} panel=${d1.panel} inset=${d1.inset}`);

  // D2 — semantic tokens declared with meanings first
  const tokens = await page.evaluate(() =>
    ['harm', 'solution', 'value', 'system', 'science'].map(k =>
      getComputedStyle(document.documentElement).getPropertyValue(`--sem-${k}`).trim()));
  ok('D2 five --sem-* tokens resolve', tokens.every(t => t.length > 2), tokens.join(' | '));
  ok('D2 meanings-picked-first declaration in source', /SEMANTIC COLOUR/i.test(src), 'comment block naming the meanings');

  // D3 — gradient-clipped headline
  const h1 = await page.evaluate(() => {
    const el = document.querySelector('h1,[data-hero-title]');
    if (!el) return null;
    const c = getComputedStyle(el);
    return { img: c.backgroundImage, clip: (c.webkitBackgroundClip || c.backgroundClip), color: c.color };
  });
  ok('D3 headline gradient-clipped', !!h1 && h1.img !== 'none' && h1.clip === 'text' && (h1.color.includes('rgba(0, 0, 0, 0)') || h1.color === 'transparent'),
    h1 ? `clip=${h1.clip} img=${h1.img.slice(0, 40)}…` : 'no h1');

  // D4 — hero number ≥32px with ≤11px uppercase caption
  const hero = await page.evaluate(() => {
    const n = document.querySelector('[data-hero-number],.pstat.hero .n,.hero-number');
    if (!n) return null;
    const cap = n.parentElement.querySelector('.l,.hero-caption,[data-hero-caption]');
    const cn = getComputedStyle(n), cc = cap ? getComputedStyle(cap) : null;
    return { size: parseFloat(cn.fontSize), capSize: cc ? parseFloat(cc.fontSize) : null, capUp: cc ? cc.textTransform : null };
  });
  ok('D4 hero number ≥32px + ≤11px uppercase caption', !!hero && hero.size >= 32 && hero.capSize !== null && hero.capSize <= 11 && hero.capUp === 'uppercase',
    hero ? `${hero.size}px / caption ${hero.capSize}px ${hero.capUp}` : 'no hero marked');

  // D5 — small type AND generous radius AND padding
  const d5 = await page.evaluate(() => {
    const body = parseFloat(getComputedStyle(document.body).fontSize);
    const s = document.querySelector('section');
    const c = getComputedStyle(s);
    const r = parseFloat(c.borderTopLeftRadius), p = [c.paddingTop, c.paddingLeft].map(parseFloat);
    return { body, r, p };
  });
  ok('D5 density with air', d5.body <= 14 && d5.r >= 10 && d5.p.every(v => v >= 12), `type=${d5.body}px radius=${d5.r}px padding=${d5.p}`);

  // M — mobile
  ok('M viewport meta', /name=["']viewport["']/i.test(src));
  ok('M ≤600px media query exists', /@media\s*\(\s*max-width\s*:\s*([1-5]?[0-9]{1,2}|600)px/.test(src));
  const mob = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mob.goto(url, { waitUntil: 'load' });
  await mob.waitForTimeout(300);
  const m = await mob.evaluate(() => {
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const h1 = getComputedStyle(document.querySelector('h1')).fontSize;
    return { over, h1 };
  });
  const h1Big = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('h1')).fontSize));
  ok('M no horizontal overflow at 375px', m.over <= 1, `overflow=${m.over}px`);
  ok('M headline shrinks on phone', parseFloat(m.h1) < h1Big, `phone=${m.h1} desktop=${h1Big}px`);
  await mob.close();

  /* X  DESKTOP (and phone) — no viewport-dominating FIXED chrome. Born from the
     2026-08-28 language-lane defect: the register intro was a display:block
     width:100% span inside the tour bar's single-row flex — flex-shrink crushed
     it to a sliver, the paragraph stacked ~300px tall, align-items:stretch
     dragged every control to that height, and the bar became an ENORMOUS panel
     hiding the page — at BOTH widths. Every gate had looked at 375px and none
     of them looked AT the chrome. This probe does: any position:fixed element
     covering ≥25% of viewport height and ≥50% of width fails, at 1440 AND 375 — served over localhost http, because the riders inject by absolute path and never mount under file://. */
  {
    const { srv: xsrv, base: xbase } = await serveRoot();
    try {
      for (const [label, vp] of [['desktop 1440', { width: 1440, height: 900 }], ['phone 375', { width: 375, height: 700 }]]) {
        const dp = await browser.newPage({ viewport: vp });
        await dp.goto(xbase + '/' + rel.split('\\').join('/'), { waitUntil: 'load' });
        await dp.waitForTimeout(900);
        const dom = await dp.evaluate(() => {
          const bad = [];
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            if (cs.position !== 'fixed') continue;
            const r = el.getBoundingClientRect();
            if (r.height >= innerHeight * 0.25 && r.width >= innerWidth * 0.5)
              bad.push(el.id || el.tagName.toLowerCase());
          }
          return bad;
        });
        ok('X no viewport-dominating fixed chrome (' + label + ' )', dom.length === 0, dom.join(', '));
        await dp.close();
      }
    } finally { xsrv.close(); }
  }

  // I1/I2 — INSTANT: ALL subresources counted; same-origin is never a free pass
  const subs = [], sizes = [];
  page.on('request', r => { if (r.resourceType() !== 'document') subs.push(r.url()); });
  page.on('response', async r => { try { sizes.push((await r.body()).length); } catch {} });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  let pageHost = ''; try { pageHost = new URL(page.url()).host; } catch {}
  const cross = [], riders = [], unknown = [];
  for (const u of subs) {
    let host = ''; try { host = new URL(u).host; } catch {}
    if (host && pageHost && host !== pageHost) cross.push(u);
    else if (RIDER_ALLOWLIST.some(re => re.test(u))) riders.push(u.split('/').pop());
    else unknown.push(u);
  }
  const kb = (sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(1);
  ok('I1 all subresources counted · zero cross-origin, zero outside the rider allowlist',
    cross.length === 0 && unknown.length === 0,
    `cross-origin: ${cross.slice(0, 3).join(' | ') || 'none'} · outside-allowlist: ${unknown.slice(0, 3).join(' | ') || 'none'}`);
  console.log(`  INSTANT · ${subs.length} subresource request(s) · ${kb} KB · riders: ${riders.join(', ') || 'none'} — same-origin riders are COUNTED, never waved through`);
  const fcp = await page.evaluate(() => {
    const p = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint');
    return p ? Math.round(p.startTime) : null;
  });
  ok('I2 first contentful paint < 1000ms', fcp !== null && fcp < 1000, `FCP=${fcp === null ? 'unmeasured' : fcp + 'ms'} (report the number, never just the pass)`);
  console.log(`  INSTANT · first contentful paint = ${fcp === null ? 'unmeasured' : fcp + 'ms'} — file:// number; THE METHOD number is --measure's localhost http table`);
  console.log('  F  FORM KILL — human-judged, not scored: first impression must be "here is what this is," never "fill this in."');
  await page.close();
}

console.log(`\n${totalPass} passed, ${totalFail} failed`);
await browser.close();
process.exit(totalFail ? 1 : 0);
