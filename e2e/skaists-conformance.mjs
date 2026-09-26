// skaists-conformance.mjs — a real standards meter: does a surface speak the estate's design system
// (docs/design/skaists/tokens.json) or hand-picked values? Per surface x register at 390x844, over
// every visible element inside a scope (default: the three-UI front, #eternal):
//   COLOUR   every painted colour (text, background, border) is a skaists token of THAT register
//            (a token at reduced alpha counts: washes and glows are tokens with opacity)
//   TYPE     every text run's size is on that register's type scale (+ the house hand)
//   RADIUS   every rounded corner is a radius token (or a circle: 50%/999px)
//   TARGET   every press target is >= control-min (44 px) both ways
//   CONTRAST text on its ground >= 4.5:1 (WCAG 2.2 AA; 3:1 for >= 24 px / >= 18.66 px bold)
//   CASE     no text-transform (casing is payload)
// The shared chrome (the bar, the register switch, the orb) is measured once, not per page: it is
// excluded from every scope. --scope body scores a whole page.
// Score = conforming checks / all checks, per kind. Exit 1 below --min (default 100).
// Run: node e2e/skaists-conformance.mjs --only blood.html [--scope "#eternal"] [--min 100] [--json out]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PAGES = arg('only', 'blood.html').split(',');
const SCOPE = arg('scope', '#eternal');
const MIN = +arg('min', '100');
const PORT = +arg('port', '8871'), ORIGIN = `http://127.0.0.1:${PORT}`;
const T = JSON.parse(await readFile(join(ROOT, 'docs/design/skaists/tokens.json'), 'utf8'));
const REGS = ['bee', 'raver', 'cypherpunk'];

const byName = Object.fromEntries(T.color.tokens.map(t => [t.name, t]));
const res = (n, r) => { const v = byName[n].value[r]; const m = /^\{([\w-]+)\}$/.exec(v); return m ? res(m[1], r) : v.toLowerCase(); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// the one gradient's stops are tokens too (skaists: "the mandala read rim to centre")
const STOPS = T.gradient.tokens.flatMap(t => (t.value.match(/#[0-9a-f]{6}/gi) || []).map(h => h.toLowerCase()));
const PALETTE = Object.fromEntries(REGS.map(r => [r, [...new Set([...T.color.tokens.map(t => res(t.name, r)), ...STOPS])].map(hex)]));
// type scale per register: its own group + the house hand (+ cypherpunk's mono sizes are its group)
const group = n => T.type.groups.find(g => g.name === n);
const sizes = names => [...new Set(names.flatMap(n => group(n).styles.map(s => parseFloat(s.fontSize))))];
const SCALE = { bee: sizes(['new bee', 'the house hand']), raver: sizes(['raver', 'the house hand']), cypherpunk: sizes(['cypherpunk', 'the house hand']) };
const RADII = [...T.radius.tokens.map(t => parseFloat(t.value)), 4, 5]; // the README's cypherpunk pills (5) and tags (4)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = createServer(async (q, s) => { try { const f = join(ROOT, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(f); s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(b); } catch { s.writeHead(404); s.end(); } });
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch();

function measure({ scope, palette, scale, radii }) {
  const rgb = s => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const near = (c, p) => Math.abs(c[0] - p[0]) + Math.abs(c[1] - p[1]) + Math.abs(c[2] - p[2]) <= 3;
  const isToken = c => palette.some(p => near(c, p));
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ground = el => { for (let e = el; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b && b[3] > .5) return b; } return rgb(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; };
  const root = document.querySelector(scope); if (!root) return { missing: true };
  const SHARED = '#tbar,#bregbar,#adOrb,#adWin,#blangctl,#railsbadge,script,style,noscript';
  const vis = [...root.querySelectorAll('*')].filter(e => !e.closest(SHARED) && (e.checkVisibility ? e.checkVisibility() : e.offsetParent !== null));
  const k = { COLOUR: [0, 0], TYPE: [0, 0], RADIUS: [0, 0], TARGET: [0, 0], CONTRAST: [0, 0], CASE: [0, 0] }, bad = [];
  const say = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '') + ' "' + (e.textContent || '').trim().slice(0, 24) + '"');
  const tick = (kind, ok, why) => { k[kind][1]++; if (ok) k[kind][0]++; else bad.push(kind + ' ' + why); };
  for (const e of vis) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const svg = e instanceof SVGElement;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    // COLOUR
    const paints = [];
    if (own) paints.push(['color', cs.color]);
    if (!svg) { paints.push(['background', cs.backgroundColor]); for (const s of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + s + 'Width']) > 0) paints.push(['border' + s, cs['border' + s + 'Color']]); }
    else if (!/^(svg|g)$/i.test(e.tagName)) { if (cs.fill && cs.fill !== 'none') paints.push(['fill', cs.fill]); if (cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) paints.push(['stroke', cs.stroke]); }
    for (const [what, v] of paints) { const c = rgb(v); if (!c || c[3] === 0) continue; tick('COLOUR', isToken(c), say(e) + ' ' + what + ' ' + v); }
    if (own) {
      const fs = parseFloat(cs.fontSize);
      tick('TYPE', scale.some(s => Math.abs(s - fs) < .6), say(e) + ' ' + fs + 'px');
      tick('CASE', cs.textTransform === 'none', say(e) + ' ' + cs.textTransform);
      const fg = rgb(cs.color), bg = ground(e);
      if (fg && fg[3] > .5 && !svg) { const a = L(fg), b = L(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); const big = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700); tick('CONTRAST', ratio >= (big ? 3 : 4.5) - .01, say(e) + ' ' + ratio.toFixed(2) + ':1'); }
    }
    // RADIUS
    if (!svg) { const rad = parseFloat(cs.borderTopLeftRadius); if (rad > 0) tick('RADIUS', radii.some(x => Math.abs(x - rad) < .6) || rad >= Math.min(r.width, r.height) / 2 - 1 || cs.borderTopLeftRadius.includes('%'), say(e) + ' ' + cs.borderTopLeftRadius); }
    // TARGET
    const press = /^(BUTTON|A|SUMMARY|SELECT|INPUT|LABEL)$/.test(e.tagName) || e.getAttribute('role') === 'button' || (e.tabIndex >= 0 && e.tagName !== 'DIV' && !svg) || (svg && e.getAttribute('role') === 'button');
    if (press && e.type !== 'checkbox' && e.type !== 'radio') tick('TARGET', r.height >= 43.5 && r.width >= 43.5, say(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return { k, bad };
}

const rows = []; let fail = false;
for (const page of PAGES) for (const reg of REGS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, reg);
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort('blockedbyclient'));
  const p = await ctx.newPage();
  await p.goto(`${ORIGIN}/surfaces/${page}`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await p.evaluate(() => document.fonts && document.fonts.ready);
  const m = await p.evaluate(measure, { scope: SCOPE, palette: PALETTE[reg], scale: SCALE[reg], radii: RADII });
  await ctx.close();
  if (m.missing) { rows.push({ page, reg, missing: true }); console.log(`MISSING ${page} [${reg}] no ${SCOPE}`); fail = true; continue; }
  const score = Object.fromEntries(Object.entries(m.k).map(([kind, [ok, n]]) => [kind, n ? Math.round(ok / n * 1000) / 10 : 100]));
  const all = Object.values(m.k).reduce((a, [ok, n]) => [a[0] + ok, a[1] + n], [0, 0]);
  const total = all[1] ? Math.round(all[0] / all[1] * 1000) / 10 : 100;
  rows.push({ page, reg, total, score, bad: m.bad });
  console.log(`${String(total).padStart(5)}%  ${page} [${reg}]  ` + Object.entries(score).map(([k, v]) => `${k} ${v}`).join(' · ') + `  (${all[1]} checks)`);
  for (const b of m.bad.slice(0, 12)) console.log('         ' + b);
  if (m.bad.length > 12) console.log(`         … ${m.bad.length - 12} more`);
  if (total < MIN) fail = true;
}
if (arg('json', '')) await writeFile(arg('json'), JSON.stringify(rows, null, 1) + '\n');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
