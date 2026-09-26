// standards-audit.mjs — PUBLISHED-STANDARD UX metrics over every top-level
// surface. Not the estate's own design laws (design-acceptance.mjs holds
// those); this instrument measures against standards written by other
// people, so the numbers are comparable to anything else on the web:
//
//   A11Y  axe-core (Deque) run with the WCAG 2.0/2.1/2.2 A + AA rule tags —
//         violations by impact (critical/serious/moderate/minor), rule ids.
//   TGT   WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA): interactive targets
//         whose rendered box is under 24×24 CSS px, counted at 375px wide.
//         Also the 44×44 figure (WCAG 2.5.5 AAA / Apple HIG / Material)
//         because that is the number product teams actually ship to.
//   DOC   lang attribute, <title>, viewport meta, exactly one h1, a <main>
//         landmark — the five document-level checks every audit tool starts
//         with (WCAG 3.1.1, 2.4.2, 1.3.1).
//   MOB   horizontal overflow at 375px (WCAG 1.4.10 Reflow at 320 CSS px
//         is the AA bar; 375 is the iPhone width the estate tests at).
//   PERF  requests, transferred KB, first-contentful-paint ms — measured
//         over localhost http in a cold context, so they are floors, not
//         field numbers. Core Web Vitals "good" FCP is < 1800 ms lab.
//   ERR   console errors + failed same-origin requests at load.
//   EXT   cross-origin requests the page ATTEMPTED (all are aborted before
//         leaving the box; the count is what the page would have leaked).
//
//   node standards-audit.mjs                 # all surfaces/*.html
//   node standards-audit.mjs wallet.html …   # a subset
//   node standards-audit.mjs --json out.json # also write the full record
//
// Locally without a playwright-managed browser: PW_CHROMIUM_PATH=/path/to/chrome
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const AXE_SRC = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const AXE_VERSION = require('axe-core/package.json').version;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURFACES = join(ROOT, 'surfaces');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.md': 'text/markdown' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
const base = await new Promise(r => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`)));

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const wanted = args.filter((a, i) => a !== '--json' && args[i - 1] !== '--json');
const pages = wanted.length ? wanted.map(w => w.replace(/^surfaces\//, ''))
  : (await readdir(SURFACES)).filter(f => f.endsWith('.html')).sort();

const launchOpts = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOpts);

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function measure(file, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const rec = { requests: 0, bytes: 0, external: new Set(), failed: [], consoleErrors: [], pageErrors: [] };
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== base) { rec.external.add(u.host); return route.abort(); }
    route.continue();
  });
  page.on('response', async r => {
    if (!r.url().startsWith(base)) return;
    rec.requests++;
    if (r.status() >= 400) rec.failed.push(`${r.status()} ${r.url().slice(base.length)}`);
    try { rec.bytes += (await r.body()).length; } catch {}
  });
  page.on('console', m => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => rec.pageErrors.push(String(e.message || e).slice(0, 160)));

  const url = `${base}/surfaces/${file}`;
  let loadError = null;
  try { await page.goto(url, { waitUntil: 'load', timeout: 30000 }); }
  catch (e) { loadError = String(e.message).split('\n')[0]; }
  await page.waitForTimeout(600);

  const doc = await page.evaluate(() => {
    const fcp = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint');
    const nav = performance.getEntriesByType('navigation')[0];
    const vp = document.querySelector('meta[name=viewport]');
    return {
      lang: document.documentElement.getAttribute('lang') || '',
      title: (document.title || '').trim(),
      viewport: vp ? vp.getAttribute('content') : null,
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main,[role=main]').length,
      skipLink: !!document.querySelector('a[href^="#"].skip, a[href^="#"][class*=skip], a[href="#main"], a[href="#content"]'),
      fcp: fcp ? Math.round(fcp.startTime) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      textChars: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length,
    };
  });

  // WCAG 2.2 SC 2.5.8 — every interactive element's rendered box, at this
  // viewport. Elements that are hidden or zero-sized are not targets.
  const targets = await page.evaluate(() => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=switch], [tabindex]:not([tabindex="-1"])';
    const out = { total: 0, under24: 0, under44: 0, samplesUnder24: [] };
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      // inline text links inside a sentence are exempt from 2.5.8; approximate: <a> whose parent is a text block and the link is inline.
      if (el.tagName === 'A' && cs.display === 'inline' && (el.parentElement?.textContent || '').trim().length > el.textContent.trim().length + 20) continue;
      out.total++;
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w < 24 || h < 24) { out.under24++; if (out.samplesUnder24.length < 5) out.samplesUnder24.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} ${w}×${h}`); }
      if (w < 44 || h < 44) out.under44++;
    }
    return out;
  });

  let axe = { error: null, violations: [], incomplete: 0, passes: 0 };
  try {
    await page.addScriptTag({ content: AXE_SRC });
    const res = await page.evaluate(async tags => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete', 'passes'] });
      // color-contrast receipts: which ink-on-ground pairs fail, and by how
      // much — the fix is a token change, so the pair is the actionable unit.
      const pairs = {};
      for (const v of r.violations) if (v.id === 'color-contrast') for (const n of v.nodes) {
        const d = (n.any[0] || {}).data || {};
        if (!d.fgColor) continue;
        const k = `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (needs ${d.expectedContrastRatio})`;
        pairs[k] = (pairs[k] || 0) + 1;
      }
      return { violations: r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, tags: v.tags.filter(t => /^wcag\d/.test(t)) })), incomplete: r.incomplete.length, passes: r.passes.length,
        contrastPairs: Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ×${n}`) };
    }, AXE_TAGS);
    axe = { error: null, ...res };
  } catch (e) { axe.error = String(e.message).split('\n')[0]; }

  await ctx.close();
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of axe.violations) byImpact[v.impact] = (byImpact[v.impact] || 0) + v.nodes;
  return {
    file, viewport: `${viewport.width}x${viewport.height}`, loadError,
    doc, targets, axe: { ...axe, byImpact, ruleCount: axe.violations.length },
    perf: { requests: rec.requests, kb: Math.round(rec.bytes / 1024), fcp: doc.fcp },
    errors: { console: rec.consoleErrors, page: rec.pageErrors, failed: rec.failed },
    external: [...rec.external].sort(),
    overflow: doc.scrollWidth > doc.innerWidth + 1 ? doc.scrollWidth - doc.innerWidth : 0,
  };
}

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };
const results = [];
const t0 = Date.now();
for (const file of pages) {
  const m = await measure(file, MOBILE);
  const d = await measure(file, DESKTOP);
  results.push({ file, mobile: m, desktop: d });
  const a = m.axe.byImpact;
  process.stderr.write(`${file.padEnd(24)} axe c${a.critical} s${a.serious} m${a.moderate} n${a.minor} | tgt<24 ${m.targets.under24}/${m.targets.total} | ovf ${m.overflow} | fcp ${m.perf.fcp} | req ${m.perf.requests} ${m.perf.kb}KB | err ${m.errors.console.length + m.errors.page.length} | ext ${m.external.length}${m.loadError ? ' | LOAD: ' + m.loadError : ''}\n`);
}
await browser.close();
server.close();

// ---- report ---------------------------------------------------------------
const tot = (k) => results.reduce((s, r) => s + k(r), 0);
const summary = {
  axeVersion: AXE_VERSION, tags: AXE_TAGS, playwright: require('playwright/package.json').version,
  chromium: browser.version(), surfaces: results.length, seconds: Math.round((Date.now() - t0) / 1000),
  mobile: {
    critical: tot(r => r.mobile.axe.byImpact.critical), serious: tot(r => r.mobile.axe.byImpact.serious),
    moderate: tot(r => r.mobile.axe.byImpact.moderate), minor: tot(r => r.mobile.axe.byImpact.minor),
    zeroViolationSurfaces: results.filter(r => r.mobile.axe.ruleCount === 0 && !r.mobile.axe.error).length,
    targetsUnder24: tot(r => r.mobile.targets.under24), targetsTotal: tot(r => r.mobile.targets.total),
    targetsUnder44: tot(r => r.mobile.targets.under44),
    overflowSurfaces: results.filter(r => r.mobile.overflow > 0).length,
    noLang: results.filter(r => !r.mobile.doc.lang).length, noTitle: results.filter(r => !r.mobile.doc.title).length,
    noViewport: results.filter(r => !r.mobile.doc.viewport).length, h1NotOne: results.filter(r => r.mobile.doc.h1 !== 1).length,
    noMain: results.filter(r => r.mobile.doc.main === 0).length,
    consoleErrorSurfaces: results.filter(r => r.mobile.errors.console.length + r.mobile.errors.page.length > 0).length,
    externalSurfaces: results.filter(r => r.mobile.external.length > 0).length,
    fcpOver1800: results.filter(r => r.mobile.perf.fcp == null || r.mobile.perf.fcp > 1800).length,
    medianFcp: median(results.map(r => r.mobile.perf.fcp).filter(x => x != null)),
    medianKb: median(results.map(r => r.mobile.perf.kb)),
  },
  desktop: {
    critical: tot(r => r.desktop.axe.byImpact.critical), serious: tot(r => r.desktop.axe.byImpact.serious),
    moderate: tot(r => r.desktop.axe.byImpact.moderate), minor: tot(r => r.desktop.axe.byImpact.minor),
    zeroViolationSurfaces: results.filter(r => r.desktop.axe.ruleCount === 0 && !r.desktop.axe.error).length,
  },
};
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

// rule frequency across surfaces (mobile)
const ruleFreq = {};
for (const r of results) for (const v of r.mobile.axe.violations) { ruleFreq[v.id] ??= { surfaces: 0, nodes: 0, impact: v.impact, help: v.help, wcag: v.tags.join(' ') }; ruleFreq[v.id].surfaces++; ruleFreq[v.id].nodes += v.nodes; }
const ruleTable = Object.entries(ruleFreq).sort((a, b) => b[1].nodes - a[1].nodes);

const lines = [];
lines.push(`# Standards audit — ${results.length} surfaces, axe-core ${AXE_VERSION} (${AXE_TAGS.join(', ')}), Chromium ${summary.chromium}, ${summary.seconds}s`);
lines.push('');
lines.push('## Totals (375×812, mobile)');
lines.push('');
lines.push('| metric | value | standard |');
lines.push('|---|---|---|');
const M = summary.mobile;
lines.push(`| axe violations — critical / serious / moderate / minor (nodes) | ${M.critical} / ${M.serious} / ${M.moderate} / ${M.minor} | WCAG 2.x A+AA via axe-core |`);
lines.push(`| surfaces with zero axe violations | ${M.zeroViolationSurfaces} / ${results.length} | |`);
lines.push(`| interactive targets under 24×24 px | ${M.targetsUnder24} / ${M.targetsTotal} | WCAG 2.2 SC 2.5.8 (AA) |`);
lines.push(`| interactive targets under 44×44 px | ${M.targetsUnder44} / ${M.targetsTotal} | WCAG 2.5.5 (AAA), Apple HIG, Material |`);
lines.push(`| surfaces with horizontal overflow at 375 px | ${M.overflowSurfaces} | WCAG 1.4.10 Reflow |`);
lines.push(`| missing html lang / title / viewport meta | ${M.noLang} / ${M.noTitle} / ${M.noViewport} | WCAG 3.1.1, 2.4.2; MDN |`);
lines.push(`| h1 count ≠ 1 / no main landmark | ${M.h1NotOne} / ${M.noMain} | WCAG 1.3.1, 2.4.1 |`);
lines.push(`| surfaces with console or page errors at load | ${M.consoleErrorSurfaces} | |`);
lines.push(`| surfaces attempting cross-origin requests at load | ${M.externalSurfaces} | (all aborted by the harness) |`);
lines.push(`| median FCP ms / surfaces over 1800 ms | ${M.medianFcp} / ${M.fcpOver1800} | Core Web Vitals lab FCP "good" < 1800 ms |`);
lines.push(`| median transferred KB (same-origin) | ${M.medianKb} | |`);
lines.push('');
lines.push(`Desktop (1280×800) axe nodes: critical ${summary.desktop.critical}, serious ${summary.desktop.serious}, moderate ${summary.desktop.moderate}, minor ${summary.desktop.minor}; zero-violation surfaces ${summary.desktop.zeroViolationSurfaces}/${results.length}.`);
lines.push('');
lines.push('## axe rules by weight (mobile, nodes across all surfaces)');
lines.push('');
lines.push('| rule | impact | WCAG | surfaces | nodes | what |');
lines.push('|---|---|---|---|---|---|');
for (const [id, v] of ruleTable) lines.push(`| ${id} | ${v.impact} | ${v.wcag} | ${v.surfaces} | ${v.nodes} | ${v.help} |`);
lines.push('');
lines.push('## Per surface (mobile 375×812)');
lines.push('');
lines.push('| surface | crit | ser | mod | min | tgt<24 / total | tgt<44 | ovf px | lang | title | vp | h1 | main | FCP ms | req | KB | errs | ext hosts | load |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const m = r.mobile, a = m.axe.byImpact, d = m.doc;
  lines.push(`| ${r.file} | ${a.critical} | ${a.serious} | ${a.moderate} | ${a.minor} | ${m.targets.under24} / ${m.targets.total} | ${m.targets.under44} | ${m.overflow} | ${d.lang || '—'} | ${d.title ? 'y' : '—'} | ${d.viewport ? 'y' : '—'} | ${d.h1} | ${d.main} | ${m.perf.fcp ?? '—'} | ${m.perf.requests} | ${m.perf.kb} | ${m.errors.console.length + m.errors.page.length} | ${m.external.length} | ${m.loadError ? 'FAIL' : 'ok'} |`);
}
lines.push('');
lines.push('## Receipts — per-surface detail (mobile)');
lines.push('');
for (const r of results) {
  const m = r.mobile;
  const bits = [];
  if (m.loadError) bits.push(`load error: ${m.loadError}`);
  if (m.axe.error) bits.push(`axe error: ${m.axe.error}`);
  if (m.axe.violations.length) bits.push('axe: ' + m.axe.violations.map(v => `${v.id}(${v.impact}×${v.nodes})`).join(', '));
  if (m.axe.contrastPairs?.length) bits.push('contrast pairs: ' + m.axe.contrastPairs.join('; '));
  if (m.targets.samplesUnder24.length) bits.push('small targets e.g. ' + m.targets.samplesUnder24.join('; '));
  if (m.errors.page.length) bits.push('page errors: ' + m.errors.page.slice(0, 3).join(' | '));
  if (m.errors.console.length) bits.push('console: ' + m.errors.console.slice(0, 3).join(' | '));
  if (m.errors.failed.length) bits.push('failed requests: ' + m.errors.failed.slice(0, 5).join(', '));
  if (m.external.length) bits.push('cross-origin attempted: ' + m.external.join(', '));
  if (bits.length) { lines.push(`- **${r.file}** — ${bits.join('. ')}`); }
}
const md = lines.join('\n') + '\n';
process.stdout.write(md);
if (jsonOut) await writeFile(jsonOut, JSON.stringify({ summary, ruleTable, results }, null, 2));
