#!/usr/bin/env node
/* build-atlas.mjs — the hub renders FROM the registry, statically.
   THE MASTER DESIGN PASS (2026-08-28, wiring lane): three org houses over the
   eight families, every count computed from estate.json's org axis at BUILD —
   zero runtime fetch (the design's preview fetch is preview-only and does not
   ship). The hex-band masthead is lifted BYTE-TRUE from surfaces/doors/index.html
   at build (read, never retyped — preservation law: diff, don't trust). The
   in-page JS adds only search. Run after editing estate.json:
     node scripts/build-atlas.mjs
   CI (scripts/estate-check.mjs) fails if the page drifts from the registry. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { countSurfacesOnDisk, listSurfacesOnDisk, recomputeCounts } from './surface-count.mjs';

const E = JSON.parse(readFileSync('estate.json', 'utf8'));

/* ── the count is DERIVED FROM THE TREE, never stored ──────────────────────
   The door's number is the tree's number. The registry's counted rows must
   MIRROR the tree file-for-file (both directions, named on failure), and the
   counts block is then rewritten from the recompute — so a registry edit can
   never leave a stale number on the door again (the 94-on-the-door bug was
   exactly that: rows grew, the stored block didn't). */
const treeFiles = listSurfacesOnDisk().sort();
const regCounted = E.surfaces.filter(s => s.counted !== false).map(s => s.path.replace(/^surfaces\//, '')).sort();
const onlyTree = treeFiles.filter(f => !regCounted.includes(f));
const onlyReg = regCounted.filter(f => !treeFiles.includes(f));
if (onlyTree.length || onlyReg.length) {
  console.error('COUNT DRIFT — the registry\'s counted rows and the tree disagree:');
  if (onlyTree.length) console.error('  on disk, NOT in the registry (add rows or mark counted:false): ' + onlyTree.join(', '));
  if (onlyReg.length) console.error('  in the registry, NOT on disk (register the file or drop the row): ' + onlyReg.join(', '));
  process.exit(1);
}
const recomputed = recomputeCounts(E);
if (recomputed.surfaces !== treeFiles.length) {
  console.error('COUNT DRIFT — counted rows say ' + recomputed.surfaces + ' but the tree holds ' + treeFiles.length);
  process.exit(1);
}
const countsBefore = JSON.stringify(E.counts);
E.counts = recomputed;
if (countsBefore !== JSON.stringify(E.counts)) {
  /* the registry's own format is 1-space indent + trailing newline — kept,
     so the diff is the counts block and nothing else */
  writeFileSync('estate.json', JSON.stringify(E, null, 1) + '\n');
  console.log('counts block re-derived from tree+rows — surfaces: ' + recomputed.surfaces + ' (was ' + JSON.parse(countsBefore).surfaces + ')');
}
const c = E.counts;

/* ── the preservation lift: the doors' hex band, byte-true ─────────────────
   The band markup and its CSS are READ from surfaces/doors/index.html and
   embedded verbatim. If the doors change, the next build carries the change;
   nothing here re-derives the pattern. */
const doorsHtml = readFileSync('surfaces/doors/index.html', 'utf8');
const bandLine = doorsHtml.split('\n').map(l => l.trim()).find(l => l.startsWith('<div id="bandwrap"'));
if (!bandLine) throw new Error('PRESERVATION SOURCE MISSING: the doors hex band was not found in surfaces/doors/index.html');
/* the band CSS is a CONTIGUOUS block from '#bandwrap{' through the hexdriftb
   keyframe — line-picking once orphaned a continuation rule and the unclosed
   brace ate the rest of the sheet. The lift self-checks brace balance. */
const dLines = doorsHtml.split('\n');
const cssStart = dLines.findIndex(l => l.trim().startsWith('#bandwrap{'));
const cssEnd = dLines.findIndex(l => /@keyframes hexdriftb/.test(l));
if (cssStart < 0 || cssEnd < cssStart) throw new Error('PRESERVATION SOURCE MISSING: the doors band CSS block was not found');
const bandCss = dLines.slice(cssStart, cssEnd + 1).map(l => '  ' + l.trim()).join('\n');
const open = (bandCss.match(/\{/g) || []).length, close = (bandCss.match(/\}/g) || []).length;
if (open !== close) throw new Error('BAND LIFT BROKEN: braces unbalanced (' + open + ' vs ' + close + ') — the doors CSS block moved');

/* the fleet sentence is COMPUTED like everything else: hosted copies that
   differ from the founder's originals beyond the CDN vendor line
   (same rule as e2e/university-smoke.mjs — one truth, two checkers) */
const CDN_LINE = /cdn\.jsdelivr\.net\/npm\/chart\.js|\.\.\/vendor\/chart\.js/;
const strip = s => s.split('\n').filter(l => !CDN_LINE.test(l)).join('\n');
let fleetN = 0;
for (const d of ['lab', 'gallery']) {
  for (const f of readdirSync('surfaces/fleet-hosted/' + d).filter(x => x.endsWith('.html'))) {
    if (strip(readFileSync('surfaces/fleet/' + f, 'utf8')) !== strip(readFileSync('surfaces/fleet-hosted/' + d + '/' + f, 'utf8'))) fleetN++;
  }
}

const GLOSS = {
  beehivenature: 'the organism itself — what it is, how it proves it, how to join',
  skaists: 'the makers\u2019 workshop — instruments, art, and labs',
  bnature: 'people and living systems — rooms to talk, honest science',
  beehivebiomass: 'the physical network — machines, farms, bandwidth',
  beehivebuds: 'the buds line — founder-gated, waiting its seat',
  plur: 'the rave heart — sets, festivals, kandi, floor wisdom',
  midi: 'the music universe — one seed, on-chain scores, the vault',
  bnr: 'the kernel\u2019s public face — quests for curious minds'
};
const DOORS = {
  beehivenature: [['doors/beehivenature.html', 'the door →']],
  skaists: [['doors/skaists.html', 'the door →']],
  bnature: [['doors/bnature-social.html', 'social door →'], ['doors/bnature-bio.html', 'bio door →']],
  beehivebiomass: [['doors/beehivebiomass.html', 'the door →']],
  plur: [['doors/plur.html', 'the door →']]
};
const ORGS = [
  { id: 'skaists', label: 'skaists', line: 'the culture face — the makers, the dancefloor, the music universe', gh: 'https://github.com/skaists',
    hex: 'linear-gradient(90deg,#FBFB9F,#86CC72,#45C2DC,#6FA9E0,#9C6FD6)', pill: '#B79FE0', house: 'sk' },
  { id: 'beehive-nature', label: 'beehive-nature', line: 'the organism / protocol face — what it is, how it proves it, how to join', gh: 'https://github.com/beehive-nature',
    hex: 'linear-gradient(92deg,#E9F2EC 55%,#D655BB)', pill: '#D655BB', house: 'bn' },
  { id: 'beehive-biomass', label: 'beehive-biomass', line: 'the machine / supply face — machines, farms, bandwidth', gh: 'https://github.com/beehive-biomass',
    hex: 'linear-gradient(92deg,#E9F2EC 55%,#86CC72)', pill: '#86CC72', house: 'bm' }
];
const nOrgs = ORGS.length;

const dec = t => (t || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/* families grouped by the registry's own org field (the axis is the authority) */
const famOrg = f => (E.domains.find(d => d.fam === f) || {}).org || (E.surfaces.find(s => s.family === f) || {}).org;

const famBlock = (f, house) => {
  const doms = E.domains.filter(d => d.fam === f);
  const all = E.surfaces.filter(s => s.family === f);
  const counted = all.filter(s => s.counted !== false).length;
  const honoured = all.length - counted.length;
  const shown = all.filter(s => s.presented !== false);
  const rows = shown.map(s =>
    `<a class="srf" data-t="${(famOrg(f) + ' ' + f + ' ' + s.id + ' ' + dec(s.gloss)).replace(/"/g, '&quot;')}" href="${s.path.replace(/^surfaces\//, '')}">` +
    `<span class="nm">${s.id.replace(/-/g, ' ')}${s.warn ? '<span class="warn" title="a named limit">⚠</span>' : ''}</span>` +
    `<span class="gl">${s.gloss}</span></a>`).join('\n');
  const domHtml = doms.map(d => {
    const st = d.state === 'LIVE' ? 'live' : d.state === 'DNS-PENDING' ? 'dns' : 'seat';
    return `<span class="dom ${st}" title="front repo: ${d.repo || 'none yet'}">${d.d}<span class="st">${d.state === 'LIVE' ? '<span data-i18n="hub.st.live">LIVE</span>' : d.state === 'DNS-PENDING' ? '<span data-i18n="hub.st.dns">DNS-PENDING</span>' : '<span data-i18n="hub.st.seat">SEAT-OPEN</span>'}</span></span>`;
  }).join('');
  const doorHtml = (DOORS[f] || []).map(d => `<a class="doorlink" href="${d[0]}">${d[1]}</a>`).join(' ');
  const wSurfaces = '<span data-i18n="hub.w.surfaces">surfaces</span>';
  const wDomains = '<span data-i18n="hub.w.domains">domains</span>';
  const countLine = counted === 0 && honoured === 0
    ? '<span data-i18n="hub.openseat">an open seat — the domain waits for its first surface</span> · ' + doms.length + ' ' + wDomains
    : counted + ' ' + wSurfaces + (honoured ? ' · ' + honoured + ' <span data-i18n="hub.honoured">honoured uncounted (the founder’s art)</span>' : '') + ' · ' + doms.length + ' ' + wDomains;
  return `<section class="fam ${house}" id="fam-${f}">
<div class="famhead"><span class="hexdot ${house}"></span><h3>${f}</h3><span class="gloss" data-i18n="hub.gl.${f}">${GLOSS[f] || ''}</span>${doorHtml}</div>
<div class="doms">${domHtml}</div>
<div class="famcount">${countLine}</div>
<div class="rows">${rows || '<span class="gl" style="padding:8px 2px"></span>'}</div>
</section>`;
};

const houses = ORGS.map(o => {
  const fams = E.families.filter(f => famOrg(f) === o.id);
  const counted = (c.byOrg[o.id] || 0);
  const nd = E.domains.filter(d => d.org === o.id).length;
  return `<section class="org" id="org-${o.id}">
<div class="orghead"><span class="orghex" style="background:${o.hex}"></span>
<h2 style="background:${o.hex};-webkit-background-clip:text;background-clip:text;color:transparent">${o.label}</h2>
<span class="orgline" data-i18n="hub.org.${o.id}.line">${o.line}</span>
<a class="gh" href="${o.gh}">${o.gh.replace('https://', '')} →</a></div>
<div class="orgcount">${counted} surfaces · ${nd} domains · ${fams.length}${fams.length === 1 ? ' family' : ' families'} — computed from the registry\u2019s org field</div>
${fams.map(f => famBlock(f, o.house)).join('\n')}
</section>`;
}).join('\n');

const orgPills = ORGS.map(o =>
  `<a href="#org-${o.id}" style="border-color:${o.pill}">${o.label} <span class="n">${c.byOrg[o.id] || 0}</span></a>`).join('\n');
const famPills = E.families.map(f =>
  `<a href="#fam-${f}">${f} <span class="n">${c.byFamily[f] || 0}</span></a>`).join('\n');

const json = JSON.stringify(E);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#06110C">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="bn-logo.jpg">
<title>beehive nature reserve · the atlas — every surface, every org, every domain, live</title>
<meta name="description" content="One estate, three orgs, eight families. Every surface beehive nature reserve has built, grouped by the org that answers for it — computed from the registry, never hand-written.">
<style>
/* THE ATLAS — master design pass 2026-08-28, rendered by scripts/build-atlas.mjs.
   SEMANTIC COLOUR — meanings picked FIRST, hues second:
   harm = guard violet · solution = biomass green (the estate's one accent)
   value = gold (b amounts only — none on this page) · system = info blue
   science = ai cyan (infrastructure state: DNS, warn marks). Org hues are
   IDENTITY (skaists prism · beehive-nature magenta · beehive-biomass green),
   meaning-bearing per the org axis. The hex band is the doors' art, lifted
   byte-true — chrome is calm, the art lives. */
:root{
  --void:#06110C; --panel:#0B1A12; --inset:#0E2418; --line:#1E3A2A; --line2:#1E2B26;
  --ink:#E9F2EC; --dim:#8FA79C; --faint:#648176;
  --biomass:#86CC72; --ai:#45C2DC; --b-value:#E8B54B; --info:#6FA9E0;
  --guard:#B7A8F7; --sovereign:#9C6FD6; --you:#D655BB;
  --sem-harm:var(--guard); --sem-solution:var(--biomass); --sem-value:var(--b-value);
  --sem-system:var(--info); --sem-science:var(--ai);
}
html{background:var(--void);color:var(--ink);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--void);font:14px/1.6 ui-monospace,'Cascadia Mono','SF Mono',Menlo,Consolas,monospace}
a{color:var(--biomass);text-decoration:none}
a:hover{text-decoration:underline}
::selection{background:var(--biomass);color:var(--void)}
.skip{position:absolute;left:-9999px}
.skip:focus{left:8px;top:8px;background:var(--inset);padding:8px 12px;border-radius:8px;z-index:9}
.wrap{max-width:1060px;margin:0 auto;padding:0 clamp(14px,3vw,20px)}
/* the masthead is FULL-BLEED edge-to-edge (founder art ruling 2026-08-28):
   the lifted doors' band bytes are untouched — the presentation wrapper
   anchors bandwrap to the viewport edges, and on ultrawide the COURSES scale
   by stepped CSS zoom (uniform, so there is no seam and no repeat-jolt; the
   drift/pulse transforms run untouched inside the zoom). */
header.mast{position:relative;overflow:hidden;border-bottom:1px solid var(--line);padding-bottom:26px}
#bandwrap{--bandh:149px}
${bandCss}
#bandwrap .band{zoom:1}
@media (min-width:1799px){#bandwrap .band{zoom:1.1}header.mast #bandwrap{--bandh:164px}.crumbs{margin-top:172px}}
@media (min-width:1999px){#bandwrap .band{zoom:1.25}header.mast #bandwrap{--bandh:186px}.crumbs{margin-top:194px}}
@media (min-width:2499px){#bandwrap .band{zoom:1.5}header.mast #bandwrap{--bandh:224px}.crumbs{margin-top:234px}}
@media (min-width:2999px){#bandwrap .band{zoom:1.8}header.mast #bandwrap{--bandh:268px}.crumbs{margin-top:280px}}
@media (min-width:3400px){#bandwrap .band{zoom:2.1}header.mast #bandwrap{--bandh:313px}.crumbs{margin-top:327px}}
@media (min-width:3900px){#bandwrap .band{zoom:2.45}header.mast #bandwrap{--bandh:365px}.crumbs{margin-top:381px}}
@media (min-width:4400px){#bandwrap .band{zoom:2.8}header.mast #bandwrap{--bandh:417px}.crumbs{margin-top:435px}}
@media (min-width:4900px){#bandwrap .band{zoom:3.15}header.mast #bandwrap{--bandh:469px}.crumbs{margin-top:489px}}
@media (prefers-reduced-motion:reduce){#bandwrap *{animation:none !important}}
.crumbs{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:157px;padding:9px 0;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.crumbs .here{color:var(--ink)} .crumbs .sub{color:var(--dim)}
.crumbs .badge{margin-left:auto;display:inline-flex;align-items:center;gap:7px;color:var(--dim);font-size:10px;letter-spacing:.14em}
.crumbs .badge i{width:8px;height:8px;border-radius:50%;background:var(--biomass)}
.kicker{position:relative;margin:22px 0 0;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--faint)}
h1{position:relative;font-size:clamp(32px,6vw,44px);line-height:1.08;margin:10px 0 8px;font-weight:600;
  background:linear-gradient(92deg,#E9F2EC 55%,#86CC72);-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{position:relative;color:var(--dim);max-width:56ch;margin:0 0 14px;font-size:14px;line-height:1.7}
.stat{position:relative;display:flex;flex-direction:column;gap:2px;margin:0 0 6px}
.stat .num{font-size:38px;line-height:1;font-weight:600;font-variant-numeric:tabular-nums}
.stat .cap{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.counts{position:relative;font-size:12.5px;color:var(--dim);margin:0 0 18px}
.counts b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
#q{position:relative;width:100%;box-sizing:border-box;background:var(--inset);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:13px 16px;font:15px/1.4 ui-monospace,Menlo,Consolas,monospace;outline:none;transition:border-color .15s}
#q:focus{border-color:var(--biomass)}
#shown{font-size:11.5px;color:var(--faint);margin:8px 2px 0;min-height:16px}
.orgnav{display:flex;flex-wrap:wrap;gap:8px;padding:16px 0 4px}
.orgnav a{font-size:12px;padding:7px 13px;border:1px solid;border-radius:999px;background:#0A1310;color:var(--ink)}
.orgnav a:hover{text-decoration:none;background:#111C17}
.famjump{display:flex;flex-wrap:wrap;gap:8px;padding:8px 0 22px}
.famjump a{font-size:12px;padding:6px 11px;border:1px solid var(--line2);border-radius:999px;background:#0C1412;color:var(--dim)}
.famjump a:hover{border-color:var(--biomass);text-decoration:none}
.n{color:var(--faint);font-variant-numeric:tabular-nums}
section.org{border:1px solid var(--line2);border-radius:14px;padding:clamp(12px,2.5vw,18px);margin:0 0 22px;scroll-margin-top:18px;background:var(--panel)}
section.org.bn{border-color:var(--line)}
section.org.hidden,section.fam.hidden{display:none}
.orghead{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;margin-bottom:12px;background:var(--inset);border-radius:10px;padding:8px 12px;margin-left:-6px;margin-right:-6px}
.orghex{width:12px;height:13px;flex:none;align-self:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.orghead h2{font-size:20px;font-weight:700;margin:0;letter-spacing:-.01em}
.orgline{color:var(--dim);font-size:12.5px;flex:1 1 240px}
.orghead .gh{font-size:11px;color:var(--dim)}
.orgcount{color:var(--faint);font-size:11.5px;margin:0 2px 12px}
section.fam{border:1px solid;border-radius:12px;padding:clamp(14px,2.5vw,18px) clamp(12px,2.5vw,18px) 10px;margin:0 0 14px;scroll-margin-top:18px}
section.fam.sk{background:#0A1310;border-color:var(--line2)}
section.fam.bn{background:#0B1A12;border-color:var(--line)}
section.fam.bm{background:#0C1412;border-color:var(--line2)}
.famhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;margin-bottom:4px}
.hexdot{width:10px;height:10px;flex:none;align-self:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.hexdot.sk{background:#B79FE0}.hexdot.bn{background:var(--you)}.hexdot.bm{background:var(--biomass)}
.famhead h3{font-size:17px;font-weight:600;margin:0}
.famhead .gloss{color:var(--dim);font-size:12.5px;flex:1 1 240px}
.doorlink{font-size:12px}
.doms{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px}
.dom{white-space:nowrap;font-size:11px;padding:3px 9px;border-radius:6px;border:1px solid var(--line2);color:var(--dim)}
.dom .st{margin-left:6px}
.dom.live{border-color:var(--biomass)}.dom.live .st{color:var(--biomass)}
.dom.dns .st{color:var(--ai)}
.dom.seat .st{color:var(--faint)}
.famcount{color:var(--dim);font-size:11.5px;margin:8px 2px 6px}
.rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0 18px}
.srf{display:block;padding:8px;border-bottom:1px solid var(--line2);border-radius:6px;min-height:44px;box-sizing:border-box}
.srf:hover{background:#111C17;text-decoration:none}
.srf .nm{color:var(--ink);font-size:13.5px}
.srf:hover .nm{color:var(--biomass)}
.srf .gl{color:var(--dim);font-size:11.5px;display:block;margin-top:1px}
.srf .warn{color:var(--ai);font-size:11px;margin-left:5px}
footer{color:var(--dim);font-size:12px;border-top:1px solid var(--line);margin-top:28px;padding:16px 0 84px}
footer .m{margin-top:6px;max-width:72ch;color:var(--faint);line-height:1.8}
footer b{color:var(--ink);font-variant-numeric:tabular-nums}
@media (max-width:600px){
  .crumbs{margin-top:120px}
  #bandwrap{--bandh:112px}
  section.fam{padding:13px 12px 8px}
  section.org{padding:12px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<a class="skip" href="#families">skip to the families</a>
<header class="mast" data-art>
  ${bandLine}
  <div class="wrap">
  <nav class="crumbs" aria-label="you are here">
    <span class="here" data-i18n="hub.name">beehive nature reserve</span><span class="sub">▸</span><span class="sub" data-i18n="hub.crumb.atlas">skaists atlas</span>
    <span class="badge"><i></i><span data-i18n="hub.badge.static">static · search is the only script</span></span>
  </nav>
  <p class="kicker" data-i18n="hub.kicker">zero network · no password · no name</p>
  <h1 data-i18n="hub.name">beehive nature reserve</h1>
  <p class="lede" data-i18n="hub.lede">one estate, three orgs, eight families. every surface the estate has built lives below, grouped by the org that answers for it and the domain it answers to — honest about what is live, what is waiting on dns, and what is still an open seat.</p>
  <div class="stat" aria-live="polite">
    <span class="num" data-hero-number>${c.surfaces}</span>
    <span class="cap" data-hero-caption data-i18n="hub.hero.cap">surfaces · every number computed from the registry</span>
  </div>
  <p class="counts"><b>${c.surfaces}</b> <span data-i18n="hub.w.surfaces">surfaces</span> · <b>${c.domains}</b> <span data-i18n="hub.w.domains">domains</span> · <b>${c.families}</b> <span data-i18n="hub.w.families">families</span> · <b>${nOrgs}</b> <span data-i18n="hub.w.orgs">orgs</span> · <span data-i18n="hub.counts.tail">every number computed from the registry</span></p>
  <input id="q" type="search" placeholder="search the estate — a name, a feeling, a tool" aria-label="search the estate">
  <div id="shown" aria-live="polite"></div>
  </div>
</header>

<div class="wrap">
<!--ATLAS-STATIC-START-->
<nav class="orgnav" aria-label="the three orgs">
${orgPills}
</nav>
<nav class="famjump" id="families" aria-label="the eight families">
${famPills}
</nav>
<main id="list">
${houses}
</main>
<!--ATLAS-STATIC-END-->

<footer>
  <div><a href="../estate.json" data-i18n="hub.foot.registry">the registry</a> · <a href="doors/index.html" data-i18n="hub.foot.doors">the doors</a> · <a href="https://github.com/beehive-nature/beehive-nature" data-i18n="hub.foot.code">the code</a> — <b>${c.surfaces}</b> surfaces · <b>${c.domains}</b> domains · <b>${nOrgs}</b> orgs</div>
  <div class="m">the counts on this page render from the registry and cannot be hand-written —
  CI proves it every push. the fleet's hosted copies stay the founder's art:
  ${fleetN} of them carrying behaviour fixes, kept honest to his originals beyond the vendor line.
  the full manifesto lives behind the <a href="doors/beehivenature.html" data-i18n="hub.foot.door">beehivenature door</a>.</div>
  <div class="m">⬡ the estate's address scheme: <button id="reg" type="button" style="font:inherit;background:var(--inset);color:var(--biomass);border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer">click to register the estate's address scheme (web+bnr)</button> — then follow <a href="web+bnr://skaists.dev">bnr://skaists.dev</a> to the hub itself.</div>
</footer>

<script type="application/json" id="estate">
<!--ESTATE-JSON-START-->
${json}
<!--ESTATE-JSON-END-->
</script>

<script>
/* the atlas is static HTML from the registry; this script adds ONLY search —
   rows hide, empty families hide, empty org houses hide, the count shows. */
(() => {
  const E = JSON.parse(document.getElementById('estate').textContent.replace(/<!--[\\s\\S]*?-->/g, '').trim());
  const q = document.getElementById('q'), shown = document.getElementById('shown');
  const apply = () => {
    const t = q.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.srf').forEach(r => {
      const hit = !t || r.dataset.t.toLowerCase().includes(t);
      r.style.display = hit ? '' : 'none';
      if (hit) visible++;
    });
    document.querySelectorAll('section.fam').forEach(s => {
      const any = [...s.querySelectorAll('.srf')].some(r => r.style.display !== 'none');
      s.classList.toggle('hidden', t && !any);
    });
    document.querySelectorAll('section.org').forEach(s => {
      const any = [...s.querySelectorAll('.srf')].some(r => r.style.display !== 'none');
      s.classList.toggle('hidden', t && !any);
    });
    shown.textContent = t ? visible + (visible === 1 ? ' surface matches' : ' surfaces match') + ' — each hit sits inside its own house; empty houses are hidden' : '';
  };
  q.addEventListener('input', apply);
})();
/* the estate address scheme — tier 1: register web+bnr on this origin.
   the web+ prefix is a browser security rule (mdn: custom schemes must begin
   web+, lowercase ascii; bare bnr:// cannot be registered from a page). */
(() => {
  const rb = document.getElementById('reg');
  if (!rb) return;
  rb.addEventListener('click', () => {
    try {
      navigator.registerProtocolHandler('web+bnr', '/r/?u=%s');
      rb.textContent = 'registered ✓ — now follow an address below';
      rb.disabled = true;
    } catch (e) {
      rb.textContent = 'registration refused: ' + (e.message || e);
    }
  });
})();
</script>
<script src="agent-dock.js?v=5"></script>
<script src="tour.js?v=33"></script>
</body>
</html>
`;

writeFileSync('surfaces/index.html', page);
console.log('atlas built — ' + E.surfaces.length + ' rows listed · ' + c.surfaces + ' counted · ' + nOrgs + ' orgs · band lifted byte-true from doors · ' + page.length + ' bytes');
