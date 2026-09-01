#!/usr/bin/env node
/* estate-check.mjs — the registry is the single source; this proves it.
   Validates estate.json: schema, uniqueness, enum states, family membership,
   every LIVE path exists on disk, the org axis (founder-ruled map), and the
   counts block == recomputed counts. Exit 0 = the registry is honest. */
import { readFileSync, existsSync } from 'node:fs';

const reg = JSON.parse(readFileSync('estate.json', 'utf8'));
const fail = (m) => { console.error('FAIL estate-check: ' + m); process.exit(1); };

if (reg.v !== 1) fail('payload must carry v:1 (payloads-carry-v law)');
const STATES = new Set(['LIVE', 'DNS-PENDING', 'BUILT-UNHOSTED', 'SEAT-OPEN']);
const DSTATES = new Set(['LIVE', 'DNS-PENDING', 'SEAT-OPEN']);
/* the founder-ruled org axis — a row outside it is a typo or a new org
   nobody ruled in; both stop here */
const ORGS = new Set(['skaists', 'beehive-nature', 'beehive-biomass']);
const fams = new Set(reg.families);
if (fams.size !== reg.families.length) fail('duplicate family name');

const ids = new Set(), paths = new Set();
for (const s of reg.surfaces) {
  if (!s.id || ids.has(s.id)) fail('duplicate or missing surface id: ' + s.id); ids.add(s.id);
  if (paths.has(s.path)) fail('duplicate surface path: ' + s.path); paths.add(s.path);
  if (!fams.has(s.family)) fail('surface ' + s.id + ' in unknown family ' + s.family);
  if (!STATES.has(s.state)) fail('surface ' + s.id + ' bad state ' + s.state);
  if (!ORGS.has(s.org)) fail('surface ' + s.id + ' missing or invalid org: ' + JSON.stringify(s.org));
  if (s.state === 'LIVE' && !existsSync(s.path)) fail('LIVE surface file missing: ' + s.path);
}
for (const d of reg.domains) {
  if (!fams.has(d.fam)) fail('domain ' + d.d + ' in unknown family ' + d.fam);
  if (!DSTATES.has(d.state)) fail('domain ' + d.d + ' bad state ' + d.state);
  if (!ORGS.has(d.org)) fail('domain ' + d.d + ' missing or invalid org: ' + JSON.stringify(d.org));
}
const domSet = new Set(reg.domains.map(d => d.d));
if (domSet.size !== reg.domains.length) fail('duplicate domain entry');
for (const s of reg.surfaces) if (!domSet.has(s.home)) fail('surface ' + s.id + ' home not a known domain: ' + s.home);

/* the counts block must equal what the registry itself computes — no hand numbers survive.
   THE COUNT IS THE TREE'S: the counted-row set must mirror the disk file-for-file
   (scripts/surface-count.mjs is the one walker; build-atlas enforces the same
   equality at build). A row without a file, or a file without a row, stops here —
   the 94-on-the-door bug (rows grew, stored block didn't) cannot recur. */
import { countSurfacesOnDisk, recomputeCounts } from './surface-count.mjs';
const recomputed = recomputeCounts(reg);
const treeN = countSurfacesOnDisk();
if (recomputed.surfaces !== treeN) fail('counted rows say ' + recomputed.surfaces + ' but the tree holds ' + treeN + ' — run scripts/build-atlas.mjs');
/* the org axis sums to the whole — a bucket typo leaks rows and stops here */
const orgSum = Object.values(recomputed.byOrg).reduce((a, b) => a + b, 0);
if (orgSum !== recomputed.surfaces) fail('per-org counts sum to ' + orgSum + ' but counted surfaces are ' + recomputed.surfaces);
const a = JSON.stringify(recomputed), b = JSON.stringify(reg.counts);
if (a !== b) { console.error('counts block drifted from the registry itself:\n  recomputed: ' + a + '\n  declared : ' + b); process.exit(1); }

/* the hub embeds the registry between markers — the embedded copy must equal
   the file, or the page renders stale numbers CI can't see */
const page = readFileSync('surfaces/index.html', 'utf8');
const m = page.match(/<!--ESTATE-JSON-START-->([\s\S]*?)<!--ESTATE-JSON-END-->/);
if (!m) fail('surfaces/index.html lost its ESTATE-JSON markers');
const embedded = JSON.parse(m[1]);
if (JSON.stringify(embedded) !== JSON.stringify(reg)) fail('the hub\u2019s embedded registry drifted from estate.json — run scripts/build-atlas.mjs');

/* the STATIC atlas must carry an href for every registry surface — a page
   rendered from a stale generator fails here, before CI's crawl does */
const stat = page.match(/<!--ATLAS-STATIC-START-->([\s\S]*?)<!--ATLAS-STATIC-END-->/);
if (!stat) fail('surfaces/index.html lost its ATLAS-STATIC markers — run scripts/build-atlas.mjs');
const hrefs = new Set([...stat[1].matchAll(/href="([^"]+)"/g)].map(x => x[1]));
for (const s of reg.surfaces) {
  if (s.presented === false) continue;   // counted by the tree, deliberately not presented (orbit-v2 law)
  const rel = s.path.replace(/^surfaces\//, '');
  if (!hrefs.has(rel)) fail('surface missing from the static atlas: ' + rel + ' — run scripts/build-atlas.mjs');
}

console.log('PASS estate-check — ' + reg.counts.surfaces + ' counted · ' + reg.counts.listed + ' listed · ' + reg.domains.length + ' domains · orgs ' + Object.entries(reg.counts.byOrg).map(([k, v]) => k + ':' + v).join(' · ') + ' (sum ' + orgSum + ') · counts computed, not written · hub static + embed in sync');
