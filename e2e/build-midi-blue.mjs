/* build-midi-blue.mjs — merge the current estate bMiDi surface into midi.blue:
   base = beehive-nature/surfaces/blight/midi.html (verified 32/32);
   transplants from the old midi.blue page = blue palette, the creator
   disclosure, and the three live market lines (closet, pool-as-holder,
   TWAP oracle). removals = tour bar rider, relative fleetnav. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const estate = readFileSync('surfaces/blight/midi.html', 'utf8');
const old = readFileSync('C:/Users/travi/midi-blue-old-index.html', 'utf8');

/* 1. the blue palette — midi.blue keeps its own chrome identity */
const BLUE_ROOT = `:root{
  --you:#8F7BFF; --b-value:#B9A7FF; --biomass:#6F61D8; --ai:#9CB8FF;
  --info:#7A8CFF; --guard:#C3B8FF; --sovereign:#483D8B;
  --sem-harm:var(--guard); --sem-solution:var(--biomass); --sem-value:var(--b-value);
  --sem-system:var(--info); --sem-science:var(--ai);
  --bg:#0B0D33; --bg-card:#131646; --bg-well:#0E113C;
  --ink:#E6E8FF; --ink-mut:#9FA3DB; --ink-dim:#6D71B8; --line:#2A2E63;
  --radius:12px;
}`;
const rootRe = /:root\{[\s\S]*?\n\}/;
if (!rootRe.test(estate)) throw new Error('estate :root not found');
let out = estate.replace(rootRe, BLUE_ROOT);

/* 2. title */
out = out.replace('<title>bMiDi — the score the contract already wrote</title>',
                  '<title>midi.blue — the score the contract already wrote</title>');

/* 3. the disclosure + the three live lines, right under the h1 */
const DISCLOSURE = `
<section class="panel" style="border-left:4px solid var(--you)">
<p class="law" style="margin:0"><b>disclosure, before anything else.</b> this site is not the creator's.
the midi.blue domain had lapsed; it was registered openly and this page was built on it — a renderer
for the music the MiDi inscription contracts already hold. the estate behind this renderer holds
MiDi&nbsp;(B). if the creator wants their door back, it is theirs — say the word and the domain
transfers. every read on this page is the chain, keyless, in the open.</p></section>
<section class="panel">
  <p class="law" id="closet-line" style="margin:0">reading the one-way address…</p>
  <p class="law" id="market-line" style="margin:6px 0 0">reading the pool…</p>
  <p class="law" id="price-line" style="margin:6px 0 0">reading the oracle…</p>
</section>`;
const H1END = '</h1>\n<p class="law">bMiDi does not compose.';
if (!out.includes(H1END)) throw new Error('h1 anchor not found');
out = out.replace(H1END, '</h1>\n' + DISCLOSURE + '\n<p class="law">bMiDi does not compose.');

/* 4. the three market JS blocks, transplanted verbatim from the old page */
const m1 = old.indexOf('/* the closet: the one-way address');
const m2 = old.indexOf('</script>', m1);
if (m1 < 0 || m2 < 0) throw new Error('market blocks not found in old page');
const marketJs = old.slice(m1, m2).trimEnd();
const INIT_ANCHOR = 'readPitch();\n</script>';
if (!out.includes(INIT_ANCHOR)) throw new Error('init anchor not found');
out = out.replace(INIT_ANCHOR, "readPitch();\n/* ── the three live market lines, carried over from midi.blue's own page ── */\n" + marketJs + '\n</script>');

/* 5. fleetnav → absolute estate links */
const NAV_OLD = `$('fleetnav').innerHTML=(window.FLEET_NAV||[
 '<a href="./index.html">◈ fLeeT</a>','<a href="./museum.html">◈ museum</a>','<a href="./compare.html">◈ catalog</a>',
 '<a href="./gallery.html">◈ gallery</a>','<a href="./inscription-explorer.html">◈ explorer</a>','<a href="./bnri-gallery.html">◈ bNRi</a>']).join(' · ');`;
const NAV_NEW = `$('fleetnav').innerHTML=(window.FLEET_NAV||[
 '<a href="https://skaists.dev/surfaces/blight/midi.html">◈ the estate surface — bMiDi at skaists.dev</a>',
 '<a href="https://skaists.dev/surfaces/blight/museum.html">◈ museum</a>',
 '<a href="https://skaists.dev/surfaces/blight/inscription-explorer.html">◈ explorer</a>']).join(' · ');`;
if (!out.includes(NAV_OLD)) throw new Error('fleetnav block not found');
out = out.replace(NAV_OLD, NAV_NEW);

/* 6. no tour bar on the collection's own door */
out = out.replace('<script src="../tour.js?v=31"></script>\n', '');

/* 7. provenance: name the door */
out = out.replace('<p class="foot"><b>provenance.</b> one self-contained file',
  '<p class="foot"><b>provenance.</b> midi.blue — the collection&rsquo;s own door, restored. one self-contained file');

mkdirSync('C:/Users/travi/midi-blue-new', { recursive: true });
writeFileSync('C:/Users/travi/midi-blue-new/index.html', out);
console.log('written:', out.length, 'chars — palette/disclosure/market/nav/tour edits applied');
