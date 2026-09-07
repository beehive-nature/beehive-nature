#!/usr/bin/env node
/* build-atlas.mjs — the hub renders FROM the registry, statically.
   THE MASTER DESIGN PASS (2026-08-28, wiring lane): three org houses over the
   eight families, every count computed from estate.json's org axis at BUILD —
   zero runtime fetch (the design's preview fetch is preview-only and does not
   ship). The hex-band masthead is lifted BYTE-TRUE from surfaces/doors/index.html
   at build (read, never retyped — preservation law: diff, don't trust). The
   in-page JS adds search and reading preferences. Run after editing estate.json:
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

/* The registry owns membership, counts, descriptions and explicit limits.
   The language corpus supplies existing human-readable renderings. */
const corpus = JSON.parse(readFileSync('surfaces/lang-corpus.json', 'utf8')).strings;
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const text = (key, fallback) => `<span data-i18n="${esc(key)}">${esc(corpus[key]?.en || fallback)}</span>`;
const ORGS = [
  {id:'skaists', mark:'sk', label:'skaists'},
  {id:'beehive-nature', mark:'bn', label:'beehive-nature'},
  {id:'beehive-biomass', mark:'bm', label:'beehive-biomass'}
];
const familyOrg = family => E.domains.find(d => d.fam === family)?.org || E.surfaces.find(s => s.family === family)?.org;
const label = s => s.label || s.id.replace(/-/g, ' ');
const description = s => s.descriptionKey && corpus[s.descriptionKey]
  ? text(s.descriptionKey, s.gloss) : esc(s.gloss);
const limit = s => s.limitKey && corpus[s.limitKey]
  ? text(s.limitKey, s.limit) : esc(s.limit || '');
const surface = s => `<article class="srf" data-family="${esc(s.family)}" data-org="${esc(s.org)}" data-t="${esc([s.id,label(s),s.gloss,s.home,s.family,s.org,s.limit].join(' '))}"><a class="surface-link" href="${esc(s.path.replace(/^surfaces\//,''))}">
  <div class="row-title"><span class="nm">${esc(label(s))}</span><span class="row-arrow" aria-hidden="true">↗</span></div>
  <div class="gl">${description(s)}${s.path === 'surfaces/fleet-hosted/index.html' ? `<p>The hosted copies preserve the founder's art, with ${fleetN} of them carrying behaviour fixes compared with the originals beyond the vendor line.</p>` : ''}</div>
  ${s.limit ? `<div class="surface-limit"><span aria-hidden="true">△</span> ${limit(s)}</div>` : ''}
  <div class="row-meta"><span>${esc(s.family)}</span><span class="page-state">${s.state === 'LIVE' ? text('atlas.published','Published page') : esc(s.state)}</span>${s.warn && !s.limit ? `<span class="surface-limit">${text('atlas.limit','Named limit')}</span>` : ''}</div>
</a><details class="row-trace"><summary>${text('atlas.source','Source & limits')}</summary><dl><dt>id</dt><dd>${esc(s.id)}</dd><dt>path</dt><dd><a href="https://github.com/beehive-nature/beehive-nature/blob/main/${esc(s.path)}" target="_blank" rel="noopener">${esc(s.path)} ↗</a></dd><dt>org</dt><dd>${esc(s.org)}</dd><dt>home</dt><dd>${esc(s.home)}</dd><dt>page</dt><dd>${esc(s.state)}</dd><dt>limit</dt><dd>${s.limit ? limit(s) : text('atlas.unspecified','Not specified in this registry row')}</dd></dl></details></article>`;
const families = family => {
  const rows = E.surfaces.filter(s => s.family === family && s.presented !== false);
  const domains = E.domains.filter(d => d.fam === family);
  const count = E.surfaces.filter(s => s.family === family && s.counted !== false).length;
  return `<section class="fam" id="fam-${family}" data-family="${family}">
    <div class="famhead"><div><h3>${esc(family)}</h3><p>${text('hub.gl.'+family,'')}</p></div><span class="family-count">${count}</span></div>
    <div class="rows">${rows.length ? rows.map(surface).join('\n') : `<p class="open-seat">${text('hub.openseat','')}</p>`}</div>
    <details class="domain-details"><summary>${text('atlas.domains','Domains & ownership')} <span>${domains.length}</span></summary><div class="doms">${domains.map(d => `<div class="dom"><span>${esc(d.d)}</span><span class="st ${d.state === 'LIVE' ? 'live' : 'pending'}">${text(d.state === 'LIVE' ? 'hub.st.live' : d.state === 'DNS-PENDING' ? 'hub.st.dns' : 'hub.st.seat',d.state)}</span></div>`).join('')}</div></details>
  </section>`;
};
const houses = ORGS.map(o => `<section class="org ${o.mark}" id="org-${o.id}" data-org="${o.id}">
  <div class="orghead"><span class="org-mark" aria-hidden="true">${o.mark}</span><div><h2>${o.label}</h2><p>${text('hub.org.'+o.id+'.line','')}</p></div><a class="org-source" href="https://github.com/${o.id}" target="_blank" rel="noopener">GitHub ↗</a></div>
  ${E.families.filter(f => familyOrg(f) === o.id).map(families).join('\n')}
</section>`).join('\n');
const starters = [
  {id:'blight-gallery',number:'01',mark:'art',action:'Explore art',help:'Look around the gallery.'},
  {id:'blight-studio-music',number:'02',mark:'music',action:'Make music',help:'Create a piece of your own.'},
  {id:'buzz-directory',number:'03',mark:'people',action:'Meet the hive',help:'Find a community to visit.'}
].map(item => {
  const s = E.surfaces.find(s => s.id === item.id && s.presented !== false);
  if (!s) throw new Error('Start destination missing from registry: '+item.id);
  const picture = item.mark === 'art'
    ? '<img src="atlas-art/fungi.svg" width="80" height="80" alt="">'
    : item.mark === 'music'
      ? '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M17 34v12m9-24v36m9-43v50m10-40v30m9-24v18m9-14v10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="m40 12 15 9v18l-15 9-15-9V21Zm-15 27 15 9v18l-15 9-15-9V48Zm30 0 15 9v18l-15 9-15-9V48Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  return `<a class="start-link ${item.mark}" href="${esc(s.path.replace(/^surfaces\//,''))}"><span class="start-picture" aria-hidden="true">${picture}</span><div><strong>${text('atlas.'+item.mark+'Action',item.action)}</strong><span class="start-help">${text('atlas.'+item.mark+'Help',item.help)}</span><span class="start-technical" data-reg="cypherpunk">${description(s)}</span></div><span class="start-arrow" aria-hidden="true">→</span></a>`;
}).join('\n');
const side = ORGS.map(o => `<div class="side-house ${o.mark}"><a class="side-org" href="#org-${o.id}"><span>${o.label}</span><b>${c.byOrg[o.id] || 0}</b></a>${E.families.filter(f => familyOrg(f) === o.id).map(f => `<a class="side-family" href="#fam-${f}" data-family-link="${f}">${esc(f)}<span>${c.byFamily[f] || 0}</span></a>`).join('')}</div>`).join('\n');
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f6f7f2">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="bn-logo.jpg">
<link rel="stylesheet" href="atlas.css?v=1">
<title>skaists · beehive nature reserve</title>
<meta name="description" content="Explore the beehive nature reserve: on-chain art, music, people, science and open tools. Find a place to begin, then browse the whole estate.">
<style>
/* Founder-preserved artwork, lifted verbatim from the doors. SEMANTIC COLOUR:
   biomass green = living systems; guard violet = limits; information blue =
   system evidence; honey is reserved for b value, not navigation. */
${bandCss}
</style>
</head>
<body data-reg="bee">
<a class="skip" href="#explore">${text('atlas.browse','Explore the estate')}</a>
<div class="mode-bar"><div class="wrap mode-inner"><a class="mode-home" href="index.html" aria-label="skaists home">⬡ <span>skaists</span></a><div data-register-host aria-describedby="view-explainer"></div><a class="mode-proof" href="#explore">${text('atlas.everything','Explore everything')} ↓</a></div><p class="sr-only" id="view-explainer">${text('atlas.view','Choose how this page speaks to you')}. ${text('atlas.canonical','Same facts. Three ways to read them.')}</p></div>
<header class="mast" data-art>
  ${bandLine}
  <div class="wrap mast-content">
    <nav class="mast-nav" aria-label="Primary"><a class="wordmark" href="index.html">skaists<span>.dev</span></a><span data-language-host></span></nav>
    <div class="welcome">
      <div class="welcome-copy"><p class="eyebrow">${text('m.4','')}</p><h1><span data-reg="bee">${text('atlas.heading','A place for your creativity.')}</span><span data-reg="raver">${text('hub.name','')}</span><span data-reg="cypherpunk">${text('hub.name','')}</span></h1><p class="intro" data-reg="bee">${text('atlas.intro','Art, science and tools made in the open — with people to meet.')}</p><p class="intro" data-reg="raver">${text('atlas.raver','Carry a garden. Make a sound. Find your people.')}</p><p class="intro" data-reg="cypherpunk">${text('atlas.cypher','Inspect the implementation, provenance and limits of each surface.')}</p><p class="begin-note" data-reg="bee">${text('atlas.progressive','Choose a place to begin. The rest is here when you want it.')}</p></div>
      <div class="start"><p class="eyebrow">${text('atlas.start','Start here')}</p>${starters}</div>
    </div>
    <div class="art-stage" data-reg="raver"><a class="art-piece fungi" href="blight/gallery.html"><img src="atlas-art/fungi.svg" width="240" height="240" alt="FUNGi on-chain mushroom artwork"><span><b>FUNGi</b><span>ERC20i</span></span></a><a class="art-piece froggi" href="blight/gallery.html"><img src="atlas-art/froggi.svg" width="240" height="240" alt="FROGGi on-chain frog artwork"><span><b>FROGGi</b><span>ERC20i</span></span></a><a class="art-piece pepi" href="blight/gallery.html"><img src="atlas-art/pepi.svg" width="240" height="240" alt="PEPi on-chain pixel artwork"><span><b>PEPi</b><span>ERC20i</span></span></a><p class="art-caption">${text('atlas.art','On-chain artwork snapshots. Open the gallery to explore.')} <a href="atlas-art/provenance.json">${text('h.016','SOURCES')} ↗</a></p></div>
    <details class="architecture"><summary>${text('atlas.source','Source & limits')}</summary><div class="counts"><span><b data-hero-number>${c.surfaces}</b> ${text('hub.w.surfaces','surfaces')}</span><span><b>${c.families}</b> ${text('hub.w.families','families')}</span><span><b>${ORGS.length}</b> ${text('hub.w.orgs','orgs')}</span></div><div class="architecture-grid"><div><span>registry</span><a href="../estate.json">estate.json · v${E.v}</a></div><div><span>render</span><a href="https://github.com/beehive-nature/beehive-nature/blob/main/scripts/build-atlas.mjs" target="_blank" rel="noopener">build-atlas.mjs ↗</a></div><div><span>kernel</span><a href="dock.html">BNRoSe · ${text('s.dock.name','')}</a></div><div><span>continuity</span><a href="../docs/dispatches/2026-09-06-astra-kernel-continuity.md">${text('atlas.proof','Read the evidence')} ↗</a></div></div></details>
  </div>
</header>
<main class="wrap" id="explore">
<details class="collection" id="collection"><summary><span>${text('atlas.everything','Explore everything')}</span><span class="collection-chevron" aria-hidden="true">⌄</span></summary>
<div class="atlas">
  <aside class="sidebar"><div class="side-inner"><p class="eyebrow">${text('hub.crumb.atlas','')}</p><nav aria-label="Organisations and families">${side}</nav><div class="side-proof"><span aria-hidden="true">↳</span><a href="dock.html">${text('s.dock.name','')}</a><a href="../estate.json">${text('hub.foot.registry','')} ↗</a></div></div></aside>
  <div class="catalogue">
    <div class="catalogue-heading"><h2>${text('atlas.browse','Explore the estate')}</h2><a href="doors/index.html">${text('hub.foot.doors','')} ↗</a></div>
    <form class="search-form" role="search" onsubmit="return false">
      <label for="q">${text('atlas.simpleSearch','Search for something')}</label>
      <div class="search-controls"><div class="search-field"><span aria-hidden="true">⌕</span><input id="q" name="q" type="search" autocomplete="off" spellcheck="false" aria-describedby="shown"><kbd aria-hidden="true">/</kbd></div><label class="sr-only" for="family-filter">${text('hub.w.families','families')}</label><select id="family-filter" name="family"><option value="" data-i18n="atlas.topics">${esc(corpus['atlas.topics']?.en || 'All topics')}</option>${E.families.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></div>
      <div class="search-meta"><output id="shown" aria-live="polite">${text('atlas.results','Results')}: <bdi id="result-count">${E.surfaces.filter(s => s.presented !== false).length}</bdi></output><button type="reset" id="clear" hidden>${text('atlas.clear','Clear filters')}</button></div>
    </form>
    <p class="state-note">${text('atlas.state','Published describes the page; each tool discloses its own readiness.')}</p>
    <noscript><p class="state-note">${text('atlas.nojs','Every destination is available below. Enable JavaScript to switch views and filter the estate.')}</p></noscript>
    <div id="empty" class="empty" hidden><span aria-hidden="true">⌕</span><p>${text('atlas.empty','No matching surfaces. Try another word or clear the filters.')}</p></div>
    <!--ATLAS-STATIC-START-->
    <div id="list">${houses}</div>
    <!--ATLAS-STATIC-END-->
  </div>
</div>
</details>
</main>
<footer class="wrap footer"><div><a class="wordmark" href="index.html">skaists<span>.dev</span></a><p>${text('hub.name','')}</p></div><div class="footer-links"><a href="onboarding/index.html">${text('reg.bee','')}</a><a href="doors/index.html">${text('hub.foot.doors','')}</a><a href="../estate.json">${text('hub.foot.registry','')}</a><a href="https://github.com/beehive-nature/beehive-nature" target="_blank" rel="noopener">${text('hub.foot.code','')} ↗</a></div><p class="footer-count"><b>${c.surfaces}</b> ${text('hub.w.surfaces','surfaces')} · <b>${c.domains}</b> ${text('hub.w.domains','domains')} · ${text('hub.counts.tail','')}</p><details class="address"><summary>web+bnr</summary><button id="reg" type="button">Register web+bnr addresses</button><a href="web+bnr://skaists.dev">bnr://skaists.dev</a><p id="protocol-status" role="status"></p></details></footer>
<div class="wrap estate-navigation"><details><summary>${text('atlas.browse','Explore the estate')}</summary><div data-tour-host></div></details></div>
<script type="application/json" id="estate">
<!--ESTATE-JSON-START-->
${JSON.stringify(E)}
<!--ESTATE-JSON-END-->
</script>
<script src="atlas-search.js?v=1" defer></script>
<script src="atlas.js?v=3" defer></script>
<script src="agent-dock.js?v=7"></script>
<script src="tour.js?v=36"></script>
</body>
</html>
`;
// Whitespace-only template slots should not become dirty generated lines.
writeFileSync('surfaces/index.html', page.replace(/^ +$/gm, ''));
console.log('atlas built — '+E.surfaces.length+' listed · '+c.surfaces+' counted · preserved doors artwork · '+page.length+' bytes');
