#!/usr/bin/env node
/* build-atlas.mjs — the hub renders FROM the registry, statically.
   The page's family sections, rows and counts are written as raw HTML so
   crawlers (and the university-smoke reachability walk) see every surface
   without executing a single script; the in-page JS only adds search.
   Run after editing estate.json:  node scripts/build-atlas.mjs
   CI (scripts/estate-check.mjs) fails if the page drifts from the registry. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const E = JSON.parse(readFileSync('estate.json', 'utf8'));

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
  beehivenature: [['doors/beehivenature.html', 'the door']],
  skaists: [['doors/skaists.html', 'the door']],
  bnature: [['doors/bnature-social.html', 'social door'], ['doors/bnature-bio.html', 'bio door']],
  beehivebiomass: [['doors/beehivebiomass.html', 'the door']],
  plur: [['doors/plur.html', 'the door']]
};
const c = E.counts;

const chips = E.families.map(f =>
  `<a href="#fam-${f}">${f} <span class="n">${(c.byFamily[f] || 0)}</span></a>`).join('\n');

const sections = E.families.map(f => {
  const doms = E.domains.filter(d => d.fam === f);
  const srfs = E.surfaces.filter(s => s.family === f);
  const doorHtml = (DOORS[f] || []).map(d => `<a class="doorlink" href="${d[0]}">${d[1]} →</a>`).join(' ');
  const domHtml = doms.map(d =>
    `<span class="dom ${d.state}" title="front repo: ${d.repo || 'none yet'}">${d.d}<span class="st">${d.state}</span></span>`).join('');
  const shown = srfs.filter(s => s.presented !== false);
  const uncounted = srfs.filter(s => s.counted === false).length;
  const shownN = shown.length ? `${shown.length} surface${shown.length === 1 ? '' : 's'}` : 'an open seat — the domain waits for its first surface';
  const rows = shown.map(s =>
    `<a class="srf" data-t="${f} ${s.id} ${s.gloss.replace(/"/g, '&quot;')}" href="${s.path.replace(/^surfaces\//, '')}">` +
    `<span class="nm">${s.id.replace(/-/g, ' ')}${s.warn ? '<span class="warn">⚠</span>' : ''}</span>` +
    `<span class="gl">${s.gloss}</span></a>`).join('\n');
  return `<section class="fam" id="fam-${f}">
<div class="famhead"><h2>${f}</h2><span class="gloss">${GLOSS[f] || ''}</span>${doorHtml}</div>
<div class="doms">${domHtml}</div>
<div class="famcount">${shownN}${uncounted ? ` · ${uncounted} honoured uncounted (the founder's art)` : ''}${doms.length ? ` · ${doms.length} domain${doms.length === 1 ? '' : 's'}` : ''}</div>
<div class="rows">${rows || '<span class="gl" style="padding:8px 2px"></span>'}</div>
</section>`;
}).join('\n');

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
<title>beehive nature · the atlas — every surface, every domain, live</title>
<meta name="description" content="26 domains, one organism. Every surface the estate has built, grouped by family, honest about what is live — computed from the registry, never hand-written.">
<style>
/* THE ATLAS — sprint 2026-08-28 lane A2, rendered by scripts/build-atlas.mjs.
   One ground, one accent, one job per screen. Sections are STATIC HTML from
   estate.json (crawlers see every surface); JS adds only search. Palette law:
   biomass green is the one accent (alive/estate), ai cyan = infrastructure
   state; gold never appears (b amounts only — this page carries none).
   Depth ladder: void ground · panel slab · inset well. */
:root{
  --void:#06110C; --panel:#0B1A12; --inset:#0E2418; --line:#1E3A2A;
  --ink:#E9F2EC; --dim:#8FA89A;
  --biomass:#86CC72; --ai:#45C2DC;
}
html{background:var(--void);color:var(--ink);
  font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}
body{margin:0;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
.wrap{max-width:1060px;margin:0 auto;padding:0 20px}
a{color:var(--biomass);text-decoration:none}
a:hover{text-decoration:underline}
.skip{position:absolute;left:-9999px}
.skip:focus{left:8px;top:8px;background:var(--inset);padding:8px 12px;border-radius:8px;z-index:9}
.hero{padding:44px 0 8px}
.kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
h1{font-size:clamp(32px,6vw,44px);line-height:1.08;margin:10px 0 8px;font-weight:600;
  background:linear-gradient(92deg,var(--ink) 55%,var(--biomass));
  -webkit-background-clip:text;background-clip:text;color:transparent}
.lede{color:var(--dim);max-width:56ch;margin:0 0 14px}
.counts{font-size:12.5px;color:var(--dim);margin-bottom:18px}
.counts b{color:var(--ink);font-weight:600}
#q{width:100%;box-sizing:border-box;background:var(--inset);color:var(--ink);
  border:1px solid var(--line);border-radius:10px;padding:13px 16px;font:inherit;
  outline:none;transition:border-color .15s}
#q:focus{border-color:var(--biomass)}
#shown{font-size:11.5px;color:var(--dim);margin:8px 2px 0;min-height:16px}
.band{display:block;width:100%;height:56px;margin:18px 0 4px;color:var(--line)}
.famjump{display:flex;flex-wrap:wrap;gap:8px;padding:10px 0 22px}
.famjump a{font-size:12px;padding:6px 11px;border:1px solid var(--line);border-radius:999px;
  background:var(--panel);color:var(--ink)}
.famjump a:hover{border-color:var(--biomass);text-decoration:none}
.famjump .n{color:var(--dim)}
section.fam{background:var(--panel);border:1px solid var(--line);border-radius:12px;
  padding:18px 18px 10px;margin:0 0 18px}
section.fam.hidden{display:none}
.famhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;margin-bottom:4px}
.famhead h2{font-size:18px;font-weight:600;margin:0}
.famhead .gloss{color:var(--dim);font-size:12.5px;flex:1 1 260px}
.doorlink{font-size:12px}
.doms{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px}
.dom{font-size:11px;padding:3px 9px;border-radius:6px;border:1px solid var(--line);color:var(--dim)}
.dom .st{margin-left:6px}
.dom.LIVE{border-color:var(--biomass)}.dom.LIVE .st{color:var(--biomass)}
.dom.DNS-PENDING .st{color:var(--ai)}
.dom.SEAT-OPEN .st{color:var(--dim)}
.rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:0 18px}
.srf{display:block;padding:7px 8px;border-bottom:1px solid var(--line);border-radius:6px}
.srf:hover{background:var(--inset);text-decoration:none}
.srf .nm{color:var(--ink);font-size:13.5px}
.srf:hover .nm{color:var(--biomass)}
.srf .gl{color:var(--dim);font-size:11.5px;display:block;margin-top:1px}
.srf .warn{color:var(--ai);font-size:11px;margin-left:5px}
.famcount{color:var(--dim);font-size:11.5px;margin:8px 2px 6px}
footer{color:var(--dim);font-size:12px;border-top:1px solid var(--line);
  margin-top:28px;padding:16px 0 84px}
footer .m{margin-top:6px;max-width:72ch}
@media (max-width:640px){
  .hero{padding-top:30px}
  section.fam{padding:14px 12px 8px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<a class="skip" href="#families">skip to the families</a>
<div class="wrap">

<header class="hero">
  <div class="kicker">zero network · no password · no name</div>
  <h1>beehive nature</h1>
  <p class="lede">one organism, eight families. every surface the estate has built lives
  below, grouped by the domain it answers to — honest about what is live,
  what is waiting on dns, and what is still an open seat.</p>
  <div class="counts" id="counts"><b>${c.surfaces}</b> surfaces · <b>${c.domains}</b> domains · <b>${c.families}</b> families · every number computed from the registry</div>
  <input id="q" type="search" placeholder="search the estate — a name, a feeling, a tool" aria-label="search the estate">
  <div id="shown" aria-live="polite"></div>
</header>

<svg class="band" viewBox="0 0 1060 56" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><polygon id="hx" points="14,0 42,0 56,28 42,56 14,56 0,28"/></defs>
  <g fill="none" stroke="currentColor" stroke-width="1">
    <use href="#hx" x="0"/><use href="#hx" x="58"/><use href="#hx" x="116"/><use href="#hx" x="174"/>
    <use href="#hx" x="232"/><use href="#hx" x="290"/><use href="#hx" x="348"/><use href="#hx" x="406"/>
    <use href="#hx" x="464"/><use href="#hx" x="522"/><use href="#hx" x="580"/><use href="#hx" x="638"/>
    <use href="#hx" x="696"/><use href="#hx" x="754"/><use href="#hx" x="812"/><use href="#hx" x="870"/>
    <use href="#hx" x="928"/><use href="#hx" x="986"/>
  </g>
  <use href="#hx" x="232" fill="#86CC72" opacity=".18"/>
  <use href="#hx" x="522" fill="#86CC72" opacity=".10"/>
  <use href="#hx" x="812" fill="#45C2DC" opacity=".10"/>
</svg>

<!--ATLAS-STATIC-START-->
<nav class="famjump" id="families" aria-label="the eight families">
${chips}
</nav>
<main id="list">
${sections}
</main>
<!--ATLAS-STATIC-END-->

<footer>
  <div id="foot"><a href="../estate.json">the registry</a> · <a href="doors/index.html">the doors</a> · <a href="https://github.com/beehive-nature/beehive-nature">the code</a> — ${c.surfaces} surfaces · ${c.domains} domains</div>
  <div class="m">the counts on this page render from the registry and cannot be hand-written —
  CI proves it every push. the fleet's hosted copies stay the founder's art:
  ${fleetN} of them carrying behaviour fixes, kept honest to his originals beyond the vendor line.
  the full manifesto lives behind the <a href="doors/beehivenature.html">beehivenature door</a>.</div>
</footer>

<script type="application/json" id="estate">
<!--ESTATE-JSON-START-->
${json}
<!--ESTATE-JSON-END-->
</script>

<script>
/* the atlas is static HTML from the registry; this script adds ONLY search. */
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
    shown.textContent = t ? visible + ' of ' + E.counts.surfaces + ' counted surfaces shown' : '';
  };
  q.addEventListener('input', apply);
})();
</script>
<script src="agent-dock.js?v=5"></script>
<script src="tour.js?v=32"></script>
</body>
</html>
`;

writeFileSync('surfaces/index.html', page);
console.log('atlas built — ' + E.surfaces.length + ' rows listed · ' + c.surfaces + ' counted · ' + page.length + ' bytes');
