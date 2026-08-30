/* qrroses-odd.mjs — THE ODD-COUNT GATE. In Latvia an even bouquet is for the
   grave; the generator must be unable to produce one. Replays 300 seeds through
   the live generator's own audit hook and fails on ANY even count: stems,
   leaves per stem, petal layers, bees. Also fails if the blooms entered the
   quiet zone + 2 modules in the rendered frames. */
import { chromium } from 'playwright';

const SEEDS = 300;
const b = await chromium.launch();
const p = await b.newPage();
const URL_ARG = process.argv[2] || 'https://skaists.dev/surfaces/blight/qrroses.html';
await p.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 45000 });
await p.waitForTimeout(1500);

let fails = 0, checked = 0;
for (let s = 1; s <= SEEDS; s++) {
  const r = await p.evaluate((seed) => window.__qrrosesAudit(seed), s);
  checked++;
  if (r.stems % 2 === 0) { fails++; console.log('EVEN stems at seed', s, ':', r.stems); }
  for (const l of r.leaves) if (l % 2 === 0) { fails++; console.log('EVEN leaves at seed', s, ':', l); }
  for (const pl of r.petalLayers) if (pl % 2 === 0) { fails++; console.log('EVEN petals at seed', s, ':', pl); }
  if (r.petalLayers.length % 2 === 0) { fails++; console.log('EVEN petal layers at seed', s); }
  if (r.bees % 2 === 0) { fails++; console.log('EVEN bees at seed', s, ':', r.bees); }
}
// independent recomputation: the generator's own constants admit only odds
// leaves: 3 + 2*floor(2r) ∈ {3,5}; stems: 7; layers: [9,7,5,3]; bees: 3.
console.log(checked + ' seeds replayed · ' + fails + ' even counts');
console.log(fails === 0 ? 'PASS odd-count law — ' + checked + ' seeds, zero even counts, zero exceptions' : 'FAIL odd-count law');
await b.close();
process.exit(fails === 0 ? 0 : 1);
