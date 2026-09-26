// register-divergence.mjs — measures the founder's register ruling
// (2026-09-26) as numbers, colour deliberately excluded:
//
//   one set of facts, three MATERIALLY different UX readings.
//   FAIL if: same information hierarchy · same component arrangement ·
//            same density · same interaction grammar · recolor only.
//   PASS only if new bee / raver / cypherpunk are distinguishable in
//   STRUCTURE and BEHAVIOUR before colour is considered.
//
// For every surface that carries data-reg, the page is loaded three times
// (localStorage bregister = bee | raver | cypherpunk, set before any page
// script runs) at 375×812 and a colour-blind fingerprint is taken:
//
//   HIER   heading outline (h1–h4 levels in document order, visible only)
//   ARR    visible-element tag sequence (a structural hash) + visible count
//   DENS   visible text characters per 1000px of scroll height
//   GRAM   interactive-element grammar: counts by kind (link, button, input,
//          select, details, summary), and how many <details> are open
//   VOICE  median rendered font-size, distinct font-families actually painted
//
// Two readings are "the same" on an axis when the metric is identical
// (HIER, ARR, GRAM) or within 10% (DENS). A surface PASSES when every
// pair of registers differs on at least two of the four structural axes.
// "Recolor only" = all four axes identical for a pair.
//
//   node register-divergence.mjs                # every data-reg surface
//   node register-divergence.mjs wallet.html …  # a subset
//   node register-divergence.mjs --json out.json
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURFACES = join(ROOT, 'surfaces');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
const base = await new Promise(r => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`)));

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const wanted = args.filter((a, i) => a !== '--json' && args[i - 1] !== '--json').map(w => w.replace(/^surfaces\//, ''));
let pages = wanted;
if (!pages.length) {
  pages = [];
  for (const f of (await readdir(SURFACES)).filter(f => f.endsWith('.html')).sort()) {
    const src = await readFile(join(SURFACES, f), 'utf8');
    if (/data-reg|data-register-host|register\.js/.test(src)) pages.push(f);
  }
}
const REGS = ['bee', 'raver', 'cypherpunk'];
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

async function fingerprint(file, reg) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  const page = await ctx.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  let loadError = null;
  try { await page.goto(`${base}/surfaces/${file}`, { waitUntil: 'load', timeout: 30000 }); } catch (e) { loadError = String(e.message).split('\n')[0]; }
  await page.waitForTimeout(700);
  const fp = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
    const all = [...document.body.querySelectorAll('*')].filter(el => !['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName) && vis(el));
    const headings = all.filter(el => /^H[1-4]$/.test(el.tagName)).map(el => el.tagName[1]).join('');
    const tags = all.map(el => el.tagName.toLowerCase()).join(',');
    const kinds = { link: 0, button: 0, input: 0, select: 0, details: 0, summary: 0, detailsOpen: 0 };
    for (const el of all) {
      const t = el.tagName;
      if (t === 'A' && el.hasAttribute('href')) kinds.link++;
      else if (t === 'BUTTON' || el.getAttribute('role') === 'button') kinds.button++;
      else if (t === 'INPUT' || t === 'TEXTAREA') kinds.input++;
      else if (t === 'SELECT') kinds.select++;
      else if (t === 'DETAILS') { kinds.details++; if (el.open) kinds.detailsOpen++; }
      else if (t === 'SUMMARY') kinds.summary++;
    }
    const textEls = all.filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1));
    const sizes = textEls.map(el => parseFloat(getComputedStyle(el).fontSize)).sort((a, b) => a - b);
    const fams = {};
    for (const el of textEls) { const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(); fams[f] = (fams[f] || 0) + 1; }
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    const h = document.documentElement.scrollHeight;
    return {
      reg: document.body.getAttribute('data-reg'), dress: document.body.getAttribute('data-reg-dress'),
      headings, visible: all.length, tags, textChars: text.length, scrollHeight: h,
      density: h ? Math.round(text.length / h * 1000) : 0, kinds,
      medianFont: sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0,
      fonts: Object.entries(fams).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${f}(${n})`),
      svgCanvas: all.filter(el => el.tagName === 'svg' || el.tagName === 'CANVAS').length,
      tableRows: all.filter(el => el.tagName === 'TR').length,
    };
  });
  await ctx.close();
  fp.arrHash = createHash('sha1').update(fp.tags).digest('hex').slice(0, 10);
  delete fp.tags;
  fp.loadError = loadError;
  return fp;
}

function compare(a, b) {
  const same = {
    HIER: a.headings === b.headings,
    ARR: a.arrHash === b.arrHash,
    DENS: Math.abs(a.density - b.density) <= 0.10 * Math.max(a.density, b.density, 1),
    GRAM: JSON.stringify(a.kinds) === JSON.stringify(b.kinds),
  };
  const differing = Object.values(same).filter(s => !s).length;
  return { same, differing, recolorOnly: differing === 0 };
}

const results = [];
for (const file of pages) {
  const fps = {};
  for (const r of REGS) fps[r] = await fingerprint(file, r);
  const pairs = { 'bee/raver': compare(fps.bee, fps.raver), 'bee/cypherpunk': compare(fps.bee, fps.cypherpunk), 'raver/cypherpunk': compare(fps.raver, fps.cypherpunk) };
  const applied = REGS.every(r => fps[r].reg === r);
  const minDiff = Math.min(...Object.values(pairs).map(p => p.differing));
  const verdict = !applied ? 'NO-REG' : minDiff >= 2 ? 'PASS' : minDiff === 0 ? 'RECOLOR' : 'WEAK';
  results.push({ file, applied, verdict, minDiff, pairs, fps });
  process.stderr.write(`${file.padEnd(22)} ${verdict.padEnd(8)} minDiff ${minDiff} | dens b/r/c ${fps.bee.density}/${fps.raver.density}/${fps.cypherpunk.density} | vis ${fps.bee.visible}/${fps.raver.visible}/${fps.cypherpunk.visible} | fonts ${fps.bee.fonts[0]} / ${fps.raver.fonts[0]} / ${fps.cypherpunk.fonts[0]}\n`);
}
await browser.close(); server.close();

const counts = {};
for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
const L = [];
L.push(`# Register divergence — ${results.length} data-reg surfaces at 375×812, colour excluded`);
L.push('');
L.push(`Verdicts: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}. PASS = every register pair differs on ≥2 of HIER/ARR/DENS/GRAM. RECOLOR = at least one pair identical on all four. WEAK = a pair differs on one axis only. NO-REG = a register did not apply (body[data-reg] missing).`);
L.push('');
L.push('| surface | verdict | bee/raver same axes | bee/cypher same axes | raver/cypher same axes | density b/r/c (chars per 1000px) | visible els b/r/c | headings b/r/c | interactive (link,btn,input,sel,details open) b/r/c | median font px b/r/c | top font b / r / c | dress |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
const sameStr = p => Object.entries(p.same).filter(([, s]) => s).map(([k]) => k).join(' ') || '—';
const gram = k => `${k.link},${k.button},${k.input},${k.select},${k.details}/${k.detailsOpen}`;
for (const r of results) {
  const f = r.fps;
  L.push(`| ${r.file} | ${r.verdict} | ${sameStr(r.pairs['bee/raver'])} | ${sameStr(r.pairs['bee/cypherpunk'])} | ${sameStr(r.pairs['raver/cypherpunk'])} | ${f.bee.density}/${f.raver.density}/${f.cypherpunk.density} | ${f.bee.visible}/${f.raver.visible}/${f.cypherpunk.visible} | ${f.bee.headings || '∅'}/${f.raver.headings || '∅'}/${f.cypherpunk.headings || '∅'} | ${gram(f.bee.kinds)} · ${gram(f.raver.kinds)} · ${gram(f.cypherpunk.kinds)} | ${f.bee.medianFont}/${f.raver.medianFont}/${f.cypherpunk.medianFont} | ${f.bee.fonts[0] || '—'} / ${f.raver.fonts[0] || '—'} / ${f.cypherpunk.fonts[0] || '—'} | ${f.bee.dress || '—'} |`);
}
process.stdout.write(L.join('\n') + '\n');
if (jsonOut) await writeFile(jsonOut, JSON.stringify({ counts, results }, null, 2));
