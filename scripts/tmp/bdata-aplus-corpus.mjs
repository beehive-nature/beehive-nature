// bdata-aplus-corpus.mjs — the bData A+ rebuild's corpus edition (2026-09-18).
// BIRTHS the new bd.* keys with their real renderings in every docked tongue
// (fleet-drafted + independently verified per batch; all ⚙, unattested), and
// RETIRES five keys the rebuilt page no longer renders — one of which had
// drifted into a lie (bd.preserve.first told 28 tongues to look for a
// "Preserve" button the one-page ruling removed on 2026-09-18).
// The English here is extracted from surfaces/bdata.js + bdata.html and must
// stay byte-identical to what the page renders. Run once from the repo root:
//   node scripts/tmp/bdata-aplus-corpus.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'surfaces/lang-corpus.json';
const c = JSON.parse(readFileSync(f, 'utf8'));
const langs = c._meta.langs;
const { en: EN, tongues: TONGUES } = JSON.parse(readFileSync('scripts/tmp/bdata-aplus-tongues.json', 'utf8'));
const RETIRE = ['bd.preserve.first', 'bd.hist.auto', 'bd.hist.bound', 'bd.hist.fwd', 'bd.view'];

let added = 0, cells = 0, enfilled = [];
for (const [key, en] of Object.entries(EN)) {
  if (c.strings[key]) { console.log('exists, skipped:', key); continue; }
  const row = { en };
  for (const L of langs) {
    const s = TONGUES[L] && TONGUES[L][key];
    if (typeof s === 'string' && s.trim()) { row[L] = s; cells++; }
    else { row[L] = en; enfilled.push(L + ':' + key); } // K3: an honest, visible English fallback — never an empty cell
  }
  c.strings[key] = row; added++;
}
let retired = 0;
for (const key of RETIRE) if (c.strings[key]) { delete c.strings[key]; retired++; }
writeFileSync(f, JSON.stringify(c, null, 1) + '\n');
console.log(`born ${added} keys · ${cells} tongue cells · ${enfilled.length} en-filled${enfilled.length ? ' (' + enfilled.slice(0, 8).join(', ') + '…)' : ''} · retired ${retired}`);
