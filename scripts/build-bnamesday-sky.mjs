#!/usr/bin/env node
/* build-bnamesday-sky.mjs — the planets, from the theory itself.
   VSOP87D (Bretagnon & Francou 1988, IMCCE; CDS catalogue VI/81): heliocentric L, B, R on the
   ecliptic and equinox OF DATE — exactly the frame a tropical wheel is read in, so no precession
   step can go wrong. The full theory is ~4 MB; a birth chart needs a few arc-seconds, not a
   spacecraft. This script keeps the terms that matter for 1800–2100 and then MEASURES what it threw
   away against the full series, writing the measured worst case into the payload. No hand number.

   usage: node scripts/build-bnamesday-sky.mjs <dir holding VSOP87D.mer … VSOP87D.nep> <retrieved YYYY-MM-DD> */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const [, , dir, retrieved] = process.argv;
const fail = (m) => { console.error('FAIL build-bnamesday-sky: ' + m); process.exit(1); };
if (!dir || !/^\d{4}-\d\d-\d\d$/.test(retrieved || '')) fail('usage: <dir> <retrieved YYYY-MM-DD>');

const BODIES = [['mercury', 'mer'], ['venus', 'ven'], ['earth', 'ear'], ['mars', 'mar'], ['jupiter', 'jup'], ['saturn', 'sat'], ['uranus', 'ura'], ['neptune', 'nep']];
const VAR = { 1: 'L', 2: 'B', 3: 'R' };
/* |T| ≤ 0.3 millennia covers 1700–2300; a term's reach is A·0.3^power */
const REACH = 0.3, KEEP = { L: 1.5e-7, B: 1.5e-6, R: 1.5e-6 };

function parse(text) {
  const out = { L: [], B: [], R: [] }; let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.includes('VSOP87 VERSION')) {
      const v = +line.match(/VARIABLE\s+(\d)/)[1], p = +line.match(/\*T\*\*(\d)/)[1];
      cur = out[VAR[v]][p] = [];
      continue;
    }
    const f = line.trim().split(/\s+/), n = f.length;
    const A = +f[n - 3], B = +f[n - 2], C = +f[n - 1];
    if (!isFinite(A + B + C)) fail('unreadable term: ' + line.slice(0, 50));
    cur.push([A, B, C]);
  }
  return out;
}
const evalSeries = (s, t) => { let sum = 0, tp = 1; for (const terms of s) { let x = 0; if (terms) for (const [A, B, C] of terms) x += A * Math.cos(B + C * t); sum += x * tp; tp *= t; } return sum; };

const bodies = {}, files = {}, worst = {};
let kept = 0, total = 0;
for (const [name, ext] of BODIES) {
  const buf = readFileSync(join(dir, 'VSOP87D.' + ext));
  files[name + '_sha256_PUBLIC-CONSTANT'] = createHash('sha256').update(buf).digest('hex');
  const full = parse(buf.toString('latin1')), cut = { L: [], B: [], R: [] };
  for (const v of ['L', 'B', 'R']) full[v].forEach((terms, p) => {
    total += terms.length;
    cut[v][p] = terms.filter(([A]) => A * Math.pow(REACH, p) >= KEEP[v]).map(([A, B, C]) => [+A.toFixed(11), +B.toFixed(8), +C.toFixed(6)]);
    kept += cut[v][p].length;
  });
  /* the receipt: worst heliocentric difference, full vs kept, every 97 days across 1750–2150 */
  let w = { L: 0, B: 0, R: 0 };
  for (let d = -91310; d <= 54790; d += 97) { const t = d / 365250; for (const v of ['L', 'B', 'R']) w[v] = Math.max(w[v], Math.abs(evalSeries(full[v], t) - evalSeries(cut[v], t))); }
  worst[name] = { L_arcsec: +(w.L * 206264.806).toFixed(3), B_arcsec: +(w.B * 206264.806).toFixed(3), R_au: +w.R.toExponential(2) };
  if (worst[name].L_arcsec > 1.5) fail(name + ' loses ' + worst[name].L_arcsec + '″ in L — tighten KEEP');
  bodies[name] = cut;
}

const out = { v: 1, _meta: {
  what: 'Truncated VSOP87D: heliocentric L (rad), B (rad), R (au) of eight planets, ecliptic and equinox of date. series[variable][power] = [[A, B, C], …]; value = Σ_p t^p · Σ A·cos(B + C·t), t = Julian millennia (TT) from J2000.0.',
  theory: 'P. Bretagnon & G. Francou, “Planetary theories in rectangular and spherical variables. VSOP87 solutions”, Astron. Astrophys. 202, 309 (1988)',
  source: 'https://cdsarc.cds.unistra.fr/ftp/VI/81/ (CDS catalogue VI/81; mirror of IMCCE)', retrieved,
  source_files: files, kept_terms: kept, of_terms: total, keep_threshold: KEEP, reach_millennia: REACH,
  measured_truncation_heliocentric: worst,
  note: 'The Moon, the lunar node and Pluto are not in VSOP87; bnamesday-sky.js carries them and says where each comes from.',
  built_by: 'scripts/build-bnamesday-sky.mjs' }, bodies: '@@B@@' };
const body = Object.keys(bodies).map((k) => ' ' + JSON.stringify(k) + ':' + JSON.stringify(bodies[k])).join(',\n');
const json = JSON.stringify(out, null, 1).replace('"@@B@@"', '{\n' + body + '\n }') + '\n';
JSON.parse(json);
writeFileSync('surfaces/bnamesday-sky.json', json);
console.log('ok surfaces/bnamesday-sky.json ' + Buffer.byteLength(json) + ' bytes · kept ' + kept + ' of ' + total + ' terms');
console.log(JSON.stringify(worst));
