#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   build-surfaces.mjs — THE ONE BUILDER.

   surfaces/index.html (the hub) and surfaces/doors/*.html (the six front
   doors) are GENERATED from surfaces/estate.json. Nothing here is
   hand-edited; an edit to a name, a hint, a caveat or a whole new surface
   happens once, in the registry, and both the hub and the door it belongs to
   change together. e2e/estate-source.mjs rebuilds into a temp dir and fails
   if the committed HTML has drifted, so skipping this file cannot survive a
   gate.

   WHY THIS SHAPE (founder, 2026-08-26: "the best structural design to
   accommodate our languages stack and updates/editing forward"):

   · ONE SOURCE. The hub and the doors were two hand-kept lists that had
     already disagreed once — the hub said five domains after bnature.bio
     made six. Two lists of the same truth always drift; one cannot.
   · TRANSLATABLE BY CONSTRUCTION. Every generated string carries a
     data-i18n key, so surfaces/lang.js swaps it like any other estate
     string, and a missing translation falls back to English visibly and is
     counted — the corpus law, untouched. Keys are MECHANICAL, never
     invented: a surface is s.<path with / and . as ->, a domain field is
     d.<id>.<field>. That means the 26-language corpus can be extended by a
     script rather than by someone naming 200 keys by hand.
   · EDITING FORWARD. Adding a surface is one object in estate.json. It
     appears on the hub, behind its door, in the right domain, with its
     honesty state, in one run.

   Usage:  node tools/build-surfaces.mjs
           node tools/build-surfaces.mjs --out <dir>    (used by the gate)
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const argOut = process.argv.indexOf('--out');
const OUT = argOut > 0 ? resolve(process.argv[argOut + 1]) : SURF;

const E = JSON.parse(readFileSync(join(SURF, 'estate.json'), 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rank = { working: 0, partly: 1, roadmap: 2 };

/* the surface count is MEASURED off the tree, never typed — a literal went
   stale the hour the six doors landed, and university-smoke checks it. */
function countTree(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const notOurs = e.name === 'fleet' ||
      (dir.replace(/\\/g, '/').endsWith('fleet-hosted') && (e.name === 'gallery' || e.name === 'lab'));
    if (e.isDirectory()) { if (!notOurs) n += countTree(join(dir, e.name)); }
    else if (e.name.endsWith('.html')) n++;
  }
  return n;
}
const TREE = countTree(SURF);

const HEXPAL = ['#D655BB', '#86CC72', '#45C2DC', '#9C6FD6', '#E8B54B', '#6FA9E0', '#B79FE0'];

/* ── THE COMB WALL ─────────────────────────────────────────────────────────
   A LAYER IS A COURSE, not a plane. Courses stack downward at 0.75 of a hex
   height and alternate a half-tile offset — the real hexagonal tessellation,
   so the rows interlock. Each course drifts on its own clock and direction;
   deeper courses sit dimmer. The mask never moves (animating the clipper is
   what sheared the right edge), and every row is generated wide enough to
   overhang any viewport plus a full tile of travel. */
const HEXW = 46, HEXH = 53, GAP = 6;
const PITCH = Math.round(HEXH * 0.75);          /* vertical course spacing */
function hexBand(courses) {
  const n = Math.max(1, Math.min(3, courses | 0));
  const step = HEXW + GAP;
  const across = Math.ceil(2400 / step) + 2;
  let out = '';
  for (let c = 0; c < n; c++) {
    let cells = '';
    for (let i = 0; i < across; i++) {
      cells += '<i style="background:' + HEXPAL[(i + c * 3) % HEXPAL.length]
        + ';animation-duration:' + (2.4 + ((i + c) % 5) * 0.45).toFixed(1)
        + 's;animation-delay:' + (((i + c * 2) % 7) * 0.19).toFixed(2) + 's"></i>';
    }
    /* alternate courses shift half a tile — the interlock */
    const shift = (c % 2 ? step / 2 : 0) - 80;
    out += '<div class="band" style="top:' + (c * PITCH - 14) + 'px'
      + ';left:' + shift + 'px'
      + ';opacity:' + (1 - c * 0.16).toFixed(2)
      + ';animation-duration:' + (15 + c * 6) + 's'
      + ';animation-name:' + (c % 2 ? 'hexdriftb' : 'hexdrift')
      + ';--step:' + step + 'px">' + cells + '</div>';
  }
  return out;
}
function bandHeight(courses) {
  const n = Math.max(1, Math.min(3, courses | 0));
  return (n - 1) * PITCH + HEXH + 16;
}

const BASE_TOKENS = `
  --void:#06110C; --panel:#0A1310; --tile:#0C1412; --inset:#08120E; --lift:#111C17;
  --ink:#E9F2EC; --dim:#8FA79A; --dimmer:#648176; --line:#1E2B26; --hot:#2F4A3C;
  --magenta:#D655BB; --green:#86CC72; --cyan:#45C2DC; --lilac:#B79FE0;
  --blue:#6FA9E0; --gold:#E8B54B; --ember:#FF7A6B;
  --sem-value:var(--magenta); --sem-solution:var(--green); --sem-system:var(--cyan);
  --sem-science:var(--lilac); --sem-harm:var(--ember);
  --mono:ui-monospace,"Cascadia Mono","SF Mono",Menlo,Consolas,monospace;`;

const COMMON = `
/* SEMANTIC COLOUR — the meanings were picked FIRST and a hue fitted to each;
   every domain wears the meaning it embodies, and --sem-harm is declared for
   the estate palette and deliberately unused here: nothing on this page is a
   harm. DEPTH LADDER: --void ground · --panel slab · --tile door · --inset well. */
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--void);color:var(--ink);font:14px/1.7 var(--mono);
  min-height:100vh;padding-bottom:96px;-webkit-text-size-adjust:100%;position:relative}
a{text-decoration:none}
#veil{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:.55;mix-blend-mode:multiply;
  background:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,.22) 3px,rgba(0,0,0,0) 4px)}
header{position:relative;overflow:hidden;border-bottom:1px solid var(--line);padding-bottom:34px}
/* the mask NEVER moves — animating it sheared the right edge (2026-08-26).
   Its height comes from the number of courses, set per page below. */
#bandwrap{position:absolute;top:0;left:0;right:0;overflow:hidden;height:var(--bandh,78px)}
#bandwrap .band{position:absolute;display:flex;gap:6px;
  animation-timing-function:linear;animation-iteration-count:infinite;will-change:transform}
#bandwrap .band i{flex:none;display:block;width:46px;height:53px;
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);
  animation:hexpulse 3s ease-in-out infinite}
@keyframes hexpulse{0%{opacity:.10;transform:scale(.86)}50%{opacity:.95;transform:scale(1)}100%{opacity:.10;transform:scale(.86)}}
@keyframes hexdrift{0%{transform:translateX(0)}100%{transform:translateX(calc(var(--step) * -1))}}
@keyframes hexdriftb{0%{transform:translateX(calc(var(--step) * -1))}100%{transform:translateX(0)}}
.eyebrow{position:relative;padding-top:calc(var(--bandh,78px) + 16px);font-size:10px;letter-spacing:.34em;color:var(--dimmer);text-transform:uppercase}
.shead{display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding-bottom:11px;border-bottom:1px solid var(--line)}
.shead .dot{width:10px;height:10px;flex:none;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.shead h2{font-size:19px;font-weight:800;letter-spacing:-.01em}
.shead em{font-style:normal;font-size:9.5px;letter-spacing:.18em;color:var(--dimmer);text-transform:uppercase}
.shead .n{margin-left:auto;font-size:9.5px;letter-spacing:.14em;color:var(--dimmer);text-transform:uppercase}
.intro{color:var(--dim);font-size:11.5px;line-height:1.8;margin:14px 0 16px;max-width:104ch}
section{margin-top:38px;scroll-margin-top:18px;background:var(--panel);border:1px solid var(--line);padding:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:14px}
a.t{display:block;background:var(--tile);border:1px solid var(--line);border-left:3px solid var(--line);
  padding:20px;color:var(--ink);transition:transform .16s,border-color .16s,background .16s}
a.t:hover,a.t:focus-visible{transform:translateY(-2px);background:var(--lift);outline:none}
a.t i{font-style:normal;font-size:16px;line-height:1;display:block}
a.t b{display:block;font-size:13.5px;font-weight:700;margin-top:9px;letter-spacing:-.01em}
a.t s{display:block;text-decoration:none;font-size:11px;color:var(--dim);margin-top:5px;line-height:1.6}
a.t u{display:block;text-decoration:none;font-size:9.5px;color:var(--gold);margin-top:6px;line-height:1.5}
a.t.p{border-left-color:var(--gold)}
a.t.x b::after{content:" \\2197";font-weight:400;opacity:.55}
footer{max-width:1280px;margin:52px auto 0;padding:22px 22px 0;border-top:1px solid var(--line);
  color:var(--dimmer);font-size:10px;letter-spacing:.1em;line-height:2.2;text-transform:uppercase}
footer a{color:var(--dim);display:inline-flex;align-items:center;min-height:32px;padding:0 5px}
footer a:hover{color:var(--gold)}
@media (prefers-reduced-motion:reduce){
  #bandwrap .band,#bandwrap .band i{animation:none}#bandwrap .band i{opacity:.55}
  a.t{transition:none}a.t:hover{transform:none}}`;

function head(title, css, themeExtra) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
    + '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n'
    + '<meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">\n'
    + '<meta name="color-scheme" content="dark">\n'
    + '<title>' + esc(title) + '</title>\n'
    + '<meta name="theme-color" content="#06110C">\n'
    + (themeExtra || '')
    + '<style>' + css + '</style>\n</head>\n<body>\n'
    + '<div id="veil" aria-hidden="true"></div>\n';
}

/* ── a door tile ─────────────────────────────────────────────────────────── */
/* A VERB TILE CARRIES A DIFFERENT ENGLISH STRING than the hub tile for the same
   surface, so it carries a different key (.verblabel, not .name). Sharing one
   key made a single corpus entry hold two Englishes, and a translated reader
   got whichever one the corpus happened to store, in the wrong place. */
function tile(s, opts) {
  const ext = /^https?:/.test(s.file);
  const href = (opts.prefix || '') + s.file;
  const cav = s.state === 'partly' ? (s.caveat || 'real, with a named limit') : null;
  const verb = opts.verbs && s.verb;
  return '    <a class="t' + (cav ? ' p' : '') + (ext ? ' x' : '') + (verb ? ' big' : '') + '"'
    + ' href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '')
    + ' data-dom="' + s.domain + '"'
    + ' data-q="' + esc((s.name + ' ' + (s.caveat || '') + ' ' + s.domain).toLowerCase()) + '">'
    + (opts.icon ? '<i>' + opts.icon + '</i>' : '')
        + '<b data-i18n="' + s.i18n + (verb ? '.verblabel' : '.name') + '">' + esc(verb ? s.verb.label + ' →' : s.name) + '</b>'
    + (verb ? '<s class="do" data-i18n="' + s.i18n + '.verb">' + esc(s.verb.sub) + '</s>' : '')
    + '<s>' + esc(s.file) + '</s>'
    + (cav ? '<u data-i18n="' + s.i18n + '.caveat">⚠ ' + esc(cav) + '</u>' : '')
    + '</a>\n';
}

/* ── THE SIX DOORS ───────────────────────────────────────────────────────── */
const doorCss = accent => ':root{' + BASE_TOKENS + '\n  --accent:' + accent + '; --max:1080px;\n}\n' + COMMON + `
a{color:var(--accent)}
::selection{background:var(--accent);color:var(--void)}
.wrap{max-width:var(--max);margin:0 auto;padding:0 22px}
h1{position:relative;font-size:clamp(30px,6.4vw,64px);font-weight:800;letter-spacing:-.02em;
  line-height:.96;margin-top:14px;color:var(--accent)}
.what{position:relative;color:var(--dim);font-size:13.5px;margin-top:18px;max-width:62ch;line-height:1.8}
.act{position:relative;display:block;background:var(--tile);border:1px solid var(--line);
  border-left:3px solid var(--accent);padding:20px;margin-top:26px;max-width:62ch;
  transition:transform .16s,background .16s,border-color .16s}
.act:hover,.act:focus-visible{transform:translateY(-2px);background:var(--lift);border-color:var(--accent);outline:none}
.act b{display:block;font-size:17px;font-weight:800;color:var(--accent);letter-spacing:-.01em}
.act s{display:block;text-decoration:none;font-size:12px;color:var(--dim);margin-top:8px;line-height:1.75}
.act em{display:block;font-style:normal;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dimmer);margin-bottom:9px}
.shead .dot,section.d .dot{background:var(--accent)}
.shead h2{color:var(--accent);font-size:14px}
a.t{border-left-color:var(--accent)}
a.t b{color:var(--accent)}
a.t:hover{border-color:var(--accent)}
a.t.big{padding:19px}
a.t.big b{font-size:15px}
a.t.big s.do{font-size:11.5px;color:var(--dim);margin-top:8px;line-height:1.75}
a.t.big s:not(.do){font-size:9.5px;color:var(--dimmer);margin-top:8px}
@media (min-width:900px){.grid.verbs{grid-template-columns:repeat(2,1fr)}}
.notyet{margin-top:34px;background:var(--inset);border:1px dashed var(--hot);padding:20px}
.notyet h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.notyet p{font-size:11.5px;color:var(--dim);margin-top:10px;line-height:1.75;max-width:74ch}
.notyet li{list-style:none;font-size:12px;color:var(--dim);margin-top:11px;padding-left:16px;position:relative;line-height:1.7}
.notyet li::before{content:"\\2014";position:absolute;left:0;color:var(--dimmer)}
.notyet li b{color:var(--ink);font-weight:700}
.notyet a{display:inline-flex;align-items:center;min-height:32px;padding:0 5px}
@media (max-width:600px){
  .wrap{padding:0 14px}
  .eyebrow{padding-top:calc(var(--bandh,78px) + 4px);letter-spacing:.2em}
  .grid,.grid.verbs{grid-template-columns:1fr;gap:9px}
  section{padding:14px}.act{padding:16px}
  a.t:hover,.act:hover{transform:none}}`;

mkdirSync(join(OUT, 'doors'), { recursive: true });
const built = [];

for (const d of E.domains) {
  const mine = E.surfaces.filter(s => s.domain === d.id)
    .sort((a, b) => rank[a.state] - rank[b.state] || a.file.localeCompare(b.file));
  const live = mine.filter(s => s.state !== 'roadmap');
  const dead = mine.filter(s => s.state === 'roadmap');
  const unsorted = mine.filter(s => s.unsorted);
  const verbs = live.some(s => s.verb);

  let tiles = '';
  for (const s of live) tiles += tile(s, { prefix: '../', verbs: true });

  const ruled = d.notYet.map(([t, why]) => '    <li><b>' + esc(t) + '</b> — ' + esc(why) + '</li>').join('\n');
  const pages = dead.map(s => '    <li><b>' + esc(s.name) + '</b> — ' + esc(s.caveat || 'not built')
    + ' <a href="../' + s.file + '" style="color:var(--dimmer)">(read the plan)</a></li>').join('\n');
  const notyet = (ruled || pages)
    ? '  <div class="notyet">\n    <h2>Not built yet — named, so this door does not promise it</h2>\n'
      + '    <p>' + esc(E._meta.binding_rule.replace(/state:"roadmap".*$/, '').trim())
      + ' Everything above is a page you can open right now. Everything below is not, and says so.</p>\n'
      + '    <ul>\n' + [ruled, pages].filter(Boolean).join('\n') + '\n    </ul>\n  </div>\n'
    : '';
  const unsortedNote = unsorted.length
    ? '  <div class="notyet" style="border-style:solid;border-color:var(--line)">\n'
      + '    <h2 style="color:var(--dimmer)">Landed here because it fits no other door</h2>\n'
      + '    <p>' + unsorted.length + ' surface' + (unsorted.length > 1 ? 's' : '') + ' fit no door cleanly, so '
      + (unsorted.length > 1 ? 'they fall' : 'it falls') + ' here and '
      + (unsorted.length > 1 ? 'are' : 'is') + ' named rather than forced somewhere tidier: '
      + unsorted.map(s => '<a href="../' + s.file + '">' + esc(s.file) + '</a>').join(' · ') + '.</p>\n  </div>\n'
    : '';

  const html = head(d.host + ' — ' + d.who.replace(/^for /, ''), doorCss(d.accent))
    + '<header style="--bandh:' + bandHeight(d.layers || 1) + 'px">\n  <div id="bandwrap" aria-hidden="true">' + hexBand(d.layers || 1) + '</div>\n'
    + '  <div class="wrap">\n'
    + '    <p class="eyebrow" data-i18n="d.' + d.id + '.who">' + esc(d.who) + '</p>\n'
    + '    <h1>' + esc(d.host) + '</h1>\n'
    + '    <p class="what" data-i18n="d.' + d.id + '.what">' + esc(d.what) + '</p>\n'
    + '    <a class="act" href="../' + d.act.href + '"><em>one thing to do</em>'
    + '<b data-i18n="d.' + d.id + '.act">' + esc(d.act.label) + ' →</b>'
    + '<s data-i18n="d.' + d.id + '.actsub">' + esc(d.act.sub) + '</s></a>\n'
    + '  </div>\n</header>\n\n<div class="wrap">\n  <section class="d">\n'
    + '    <div class="shead"><span class="dot"></span><h2>Everything behind this door</h2>'
    + '<em>open now · ⚠ marks a named limit</em><span class="n">' + live.length + '</span></div>\n'
    + '    <div class="grid' + (verbs ? ' verbs' : '') + '">\n' + tiles + '    </div>\n  </section>\n\n'
    + notyet + unsortedNote + '</div>\n\n'
    + '<footer>\n  <div>' + esc(d.host) + ' · one of six doors · paths for now, no DNS · '
    + 'a door may not claim what the estate does not do</div>\n'
    + '  <div><a href="./">all six doors</a> · <a href="../">the hub</a> · '
    + '<a href="https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/estate.json" rel="noopener">the registry</a></div>\n'
    + '</footer>\n\n<script src="../tour.js?v=23"></' + 'script>\n</body>\n</html>\n';

  writeFileSync(join(OUT, 'doors', (d.slug||d.id) + '.html'), html);
  built.push({ id: d.id, host: d.host, live: live.length, notYet: dead.length + d.notYet.length });
}

/* the index of doors */
{
  let g = '';
  for (const d of E.domains) {
    const b = built.find(x => x.id === d.id);
    g += '      <a class="t" href="' + (d.slug||d.id) + '.html" style="border-left-color:' + d.accent + '">'
      + '<b style="color:' + d.accent + '">' + esc(d.host) + '</b>'
      + '<s data-i18n="d.' + d.id + '.who">' + esc(d.who) + '</s>'
      + '<s>' + b.live + ' open now</s></a>\n';
  }
  const html = head('the six doors — beehive nature', doorCss('#D655BB'))
    + '<header style="--bandh:' + bandHeight(3) + 'px">\n  <div id="bandwrap" aria-hidden="true">' + hexBand(3) + '</div>\n'
    + '  <div class="wrap">\n    <p class="eyebrow">six doors, six different strangers</p>\n'
    + '    <h1 style="color:var(--ink)">the six doors</h1>\n'
    + '    <p class="what">Six front doors, one organism. Each one answers a different person’s first '
    + 'question and gives them one thing to do. Paths for now — no DNS, nothing at the registrar.</p>\n'
    + '  </div>\n</header>\n\n<div class="wrap">\n  <section class="d">\n'
    + '    <div class="shead"><span class="dot"></span><h2>Pick the one that sounds like you</h2>'
    + '<span class="n">' + E.domains.length + '</span></div>\n'
    + '    <div class="grid">\n' + g + '    </div>\n  </section>\n</div>\n\n'
    + '<footer>\n  <div>six doors · paths for now, no DNS · a door may not claim what the estate does not do</div>\n'
    + '  <div><a href="../">the hub</a> · '
    + '<a href="https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/estate.json" rel="noopener">the registry</a></div>\n'
    + '</footer>\n<script src="../tour.js?v=23"></' + 'script>\n</body>\n</html>\n';
  writeFileSync(join(OUT, 'doors', 'index.html'), html);
}

/* ── THE HUB ─────────────────────────────────────────────────────────────── */
const hubCss = ':root{' + BASE_TOKENS + '\n  --max:1280px;\n}\n' + COMMON + `
a{color:var(--ink)}
::selection{background:var(--magenta);color:var(--void)}
.wrap{max-width:var(--max);margin:0 auto;padding:0 22px}
.mark{position:relative;font-size:34px;line-height:1;margin-top:22px}
h1{position:relative;font-family:var(--mono);font-size:clamp(34px,7.4vw,86px);font-weight:800;
  letter-spacing:-.02em;line-height:.92;text-transform:lowercase;margin-top:6px;
  background:linear-gradient(96deg,var(--green) 2%,var(--cyan) 26%,var(--lilac) 52%,var(--magenta) 76%,var(--gold) 98%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
h1+.lede{position:relative;color:var(--dim);font-size:13px;margin-top:18px;max-width:64ch;line-height:1.75}
.pstrip{position:relative;display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.pstat{background:var(--inset);border:1px solid var(--line);padding:11px 18px 10px;min-width:104px}
.pstat b{display:block;font-size:32px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.pstat small{display:block;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--dimmer);margin-top:8px}
.pstat .c1{color:var(--green)}.pstat .c2{color:var(--magenta)}.pstat .c3{color:var(--lilac)}.pstat .c4{color:var(--cyan)}
#manifest{background:var(--panel);border:1px solid var(--line);margin-top:30px;padding:22px;
  display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px}
#manifest h3{font-size:9.5px;letter-spacing:.2em;color:var(--gold);font-weight:700;text-transform:uppercase}
#manifest p{font-size:11.5px;line-height:1.75;color:var(--dim);margin-top:9px}
#find{margin-top:38px}
#dsearch{width:100%;background:var(--inset);border:1px solid var(--line);color:var(--ink);
  font:12.5px var(--mono);padding:15px 17px;min-height:48px}
#dsearch:focus{outline:none;border-color:var(--hot)}
#dsearch::placeholder{color:var(--dimmer)}
#chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
#chips button{background:var(--inset);border:1px solid var(--line);color:var(--dim);cursor:pointer;
  font:9.5px var(--mono);letter-spacing:.16em;text-transform:uppercase;padding:9px 13px;min-height:34px}
#chips button:hover{color:var(--ink);border-color:var(--hot)}
#chips button[aria-pressed="true"]{background:var(--ink);color:var(--void);border-color:var(--ink);font-weight:700}
#tally{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dimmer);margin-top:12px}
section[hidden],a.t[hidden]{display:none}
@media (max-width:600px){
  .wrap{padding:0 14px}
  .eyebrow{padding-top:calc(var(--bandh,78px) + 6px);letter-spacing:.22em}
  section{padding:14px;margin-top:26px}
  .grid{grid-template-columns:1fr;gap:9px}
  a.t{padding:15px}
  .pstat{flex:1 1 40%;min-width:0;padding:10px 12px}
  a.t:hover{transform:none}}`;

let acc = '', body = '';

/* the six doors, first row */
body += '<section id="doors" class="doorrow">\n'
  + '  <div class="shead"><span class="dot" style="background:var(--ink)"></span>'
  + '<h2 style="color:var(--ink)">⌂ THE SIX DOORS</h2>'
  + '<em>six front doors, six different strangers</em><span class="n">'
  + E.domains.length + ' doors</span></div>\n'
  + '  <p class="intro">Each door answers one person’s first question and gives them one thing to do. '
  + 'A door lists only what you can open now; anything not built is named under it rather than promised. '
  + 'Paths for now — no DNS yet.</p>\n  <div class="grid">\n';
for (const d of E.domains) {
  body += '    <a class="t" href="doors/' + (d.slug||d.id) + '.html" data-dom="doors"'
    + ' data-q="' + esc((d.host + ' ' + d.who).toLowerCase()) + '"'
    + ' style="border-left-color:' + d.accent + '">'
    + '<b style="color:' + d.accent + '">' + esc(d.host) + '</b>'
    + '<s data-i18n="d.' + d.id + '.who">' + esc(d.who) + '</s></a>\n';
}
body += '    <a class="t" href="doors/index.html" data-dom="doors" data-q="all six doors"'
  + ' style="border-left-color:var(--ink)"><b>all six on one page</b>'
  + '<s>pick the one that sounds like you</s></a>\n  </div>\n</section>\n\n';

/* one section per domain */
let total = 0;
for (const d of E.domains) {
  const mine = E.surfaces.filter(s => s.domain === d.id)
    .sort((a, b) => rank[a.state] - rank[b.state] || a.file.localeCompare(b.file));
  total += mine.length;
  acc += 'section.' + d.id + ' .dot{background:' + d.accent + '}\n'
    + 'section.' + d.id + ' .shead h2{color:' + d.accent + '}\n'
    + 'section.' + d.id + ' a.t{border-left-color:' + d.accent + '}\n'
    + 'section.' + d.id + ' a.t b{color:' + d.accent + '}\n'
    + 'section.' + d.id + ' a.t:hover{border-color:' + d.accent + '}\n';
  body += '<section class="' + d.id + '" id="' + d.id + '">\n'
    + '  <div class="shead"><span class="dot"></span><h2>' + esc(d.host) + '</h2>'
    + '<em>' + esc(d.label) + '</em><span class="n">' + mine.length + ' doors</span></div>\n'
    + '  <p class="intro" data-i18n="d.' + d.id + '.intro">' + esc(d.intro) + '</p>\n'
    + '  <div class="grid">\n';
  for (const s of mine) body += tile(s, { prefix: '' });
  body += '  </div>\n</section>\n';
}

const manifest = [
  ['01 · WHAT IT IS', 'One organism across six domains — identity, the floor, community, the social layer, health, and the machines that carry it. Not a company. A hive.'],
  ['02 · HOW IT PROVES', 'Every claim carries a receipt or is marked UNVERIFIED and stops there.'],
  ['03 · WHAT IT COSTS', 'Nothing. No login, no key custody, no telemetry. Your keys, your resources, no one in between.'],
  ['04 · WHO IT’S FOR', 'Built for the poor starving artist. “10Ve the first ingredient.”'],
].map(([h, p], i) => '    <div><h3>' + esc(h) + '</h3><p data-i18n="m.' + (i + 1) + '">' + esc(p) + '</p></div>').join('\n');

const hub = head('beehive nature · the surfaces — six domains, one organism', hubCss + acc,
  '<link rel="manifest" href="manifest.webmanifest">\n'
  + '<meta name="apple-mobile-web-app-capable" content="yes">\n'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
  + '<link rel="apple-touch-icon" href="bn-logo.jpg">\n')
  + '<header style="--bandh:' + bandHeight(3) + 'px">\n  <div id="bandwrap" aria-hidden="true">' + hexBand(3) + '</div>\n'
  + '  <div class="wrap">\n'
  + '    <p class="eyebrow">zero network · no password · no name</p>\n'
  + '    <div class="mark">🐝</div>\n'
  + '    <h1>beehive nature</h1>\n'
  + '    <p class="lede" data-i18n="hub.lede">Six domains, one organism. Every door opens something real; '
  + 'nothing asks for a password or your name.</p>\n'
  + '    <!-- COUNTED, never typed: the surface number is walked off the tree at build\n'
  + '         time the same way e2e/university-smoke.mjs counts it, so it cannot drift.\n'
  + '         6 domains and 3 orgs are the founder\'s owned properties and GitHub\n'
  + '         organisations; 11 chains is the live chainkeys row count on kingbeelovis. -->\n'
  + '    <div class="pstrip hero">\n'
  + '      <div class="pstat"><b data-hero-number class="c1">' + TREE + '</b><small data-hero-caption>surfaces</small></div>\n'
  + '      <div class="pstat"><b data-hero-number class="c2">' + E.domains.length + '</b><small data-hero-caption>domains</small></div>\n'
  + '      <div class="pstat"><b data-hero-number class="c3">3</b><small data-hero-caption>orgs</small></div>\n'
  + '      <div class="pstat"><b data-hero-number class="c4">11</b><small data-hero-caption>chains</small></div>\n'
  + '    </div>\n'
  + '    <div id="manifest">\n' + manifest + '\n    </div>\n'
  + '  </div>\n</header>\n\n<div class="wrap">\n'
  + '<div id="find">\n'
  + '  <div class="shead"><span class="dot" style="background:var(--ink)"></span>'
  + '<h2 style="font-size:15px">⬡ ALL SURFACES</h2><em>search, or filter by domain</em></div>\n'
  + '  <label for="dsearch" style="position:absolute;left:-9999px">search the doors</label>\n'
  + '  <input id="dsearch" type="search" autocomplete="off" placeholder="search ' + total + ' doors — name, tagline, domain…">\n'
  + '  <div id="chips">\n    <button type="button" data-f="all" aria-pressed="true">all domains</button>\n'
  + E.domains.map(d => '    <button type="button" data-f="' + d.id + '" aria-pressed="false">' + esc(d.host.split('.')[0]) + '</button>\n').join('')
  + '  </div>\n  <p id="tally">' + total + ' doors across ' + E.domains.length + ' domains</p>\n</div>\n\n'
  + body
  + '</div>\n\n'
  + '<footer>\n  <div>' + TREE + ' surfaces · six domains · three orgs · one organism · '
  + 'built for the poor starving artist · “10Ve the first ingredient”</div>\n'
  + '  <div><a href="doors/">the six doors</a> · '
  + '<a href="https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/estate.json">the registry</a> · '
  + '<a href="https://github.com/beehive-nature/beehive-nature/blob/main/docs/architecture/HOMEOSTASIS-v1.md">HOMEOSTASIS v1</a></div>\n</footer>\n\n'
  + '<script>\n(function(){\n'
  + '  /* search + domain filter. Everything is already in the DOM — this only\n'
  + '     hides; no fetch, no index, no network. */\n'
  + '  var q=document.getElementById("dsearch"), chips=document.getElementById("chips"),\n'
  + '      tally=document.getElementById("tally"),\n'
  + '      tiles=[].slice.call(document.querySelectorAll("a.t[data-dom]")),\n'
  + '      secs=[].slice.call(document.querySelectorAll("section[id]")), f="all";\n'
  + '  var TOTAL=' + total + ', NDOM=' + E.domains.length + ';\n'
  + '  function run(){\n'
  + '    var s=(q.value||"").trim().toLowerCase(), shown=0;\n'
  + '    tiles.forEach(function(t){\n'
  + '      var d=t.getAttribute("data-dom");\n'
  + '      var okF=(f==="all")||d===f||d==="doors";\n'
  + '      var okQ=!s||t.getAttribute("data-q").indexOf(s)>=0;\n'
  + '      var on=okF&&okQ; t.hidden=!on;\n'
  + '      if(on&&d!=="doors") shown++;\n'
  + '    });\n'
  + '    secs.forEach(function(sec){ sec.hidden = sec.querySelectorAll("a.t:not([hidden])").length===0; });\n'
  + '    tally.textContent=(s||f!=="all") ? shown+" of "+TOTAL+" doors shown"\n'
  + '      : TOTAL+" doors across "+NDOM+" domains";\n'
  + '  }\n'
  + '  q.addEventListener("input",run);\n'
  + '  chips.addEventListener("click",function(e){\n'
  + '    var b=e.target.closest("button[data-f]"); if(!b) return;\n'
  + '    f=b.getAttribute("data-f");\n'
  + '    [].forEach.call(chips.querySelectorAll("button"),function(x){\n'
  + '      x.setAttribute("aria-pressed", x===b?"true":"false"); });\n'
  + '    run();\n'
  + '  });\n'
  + '})();\n</' + 'script>\n'
  + '<script src="agent-dock.js?v=5"></' + 'script>\n'
  + '<script src="tour.js?v=23"></' + 'script>\n</body>\n</html>\n';

writeFileSync(join(OUT, 'index.html'), hub);

console.log('built from surfaces/estate.json → ' + OUT);
console.log('  hub      : ' + E.domains.length + ' domains, ' + total + ' tiles, tree count ' + TREE);
built.forEach(b => console.log('  ' + b.host.padEnd(20) + 'open:' + String(b.live).padStart(2) + '  not-yet:' + b.notYet));
