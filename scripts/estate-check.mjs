#!/usr/bin/env node
/* estate-check.mjs — the registry is the single source; this proves it.
   Validates estate.json: schema, uniqueness, enum states, family membership,
   every LIVE path exists on disk, and the counts block == recomputed counts.
   Exit 0 = the registry is honest; anything else fails CI. */
import { readFileSync, existsSync } from 'node:fs';

const reg = JSON.parse(readFileSync('estate.json', 'utf8'));
const fail = (m) => { console.error('FAIL estate-check: ' + m); process.exit(1); };

if (reg.v !== 1) fail('payload must carry v:1 (payloads-carry-v law)');
const STATES = new Set(['LIVE', 'DNS-PENDING', 'BUILT-UNHOSTED', 'SEAT-OPEN']);
const DSTATES = new Set(['LIVE', 'DNS-PENDING', 'SEAT-OPEN']);
const fams = new Set(reg.families);
if (fams.size !== reg.families.length) fail('duplicate family name');

const ids = new Set(), paths = new Set();
for (const s of reg.surfaces) {
  if (!s.id || ids.has(s.id)) fail('duplicate or missing surface id: ' + s.id); ids.add(s.id);
  if (paths.has(s.path)) fail('duplicate surface path: ' + s.path); paths.add(s.path);
  if (!fams.has(s.family)) fail('surface ' + s.id + ' in unknown family ' + s.family);
  if (!STATES.has(s.state)) fail('surface ' + s.id + ' bad state ' + s.state);
  if (s.state === 'LIVE' && !existsSync(s.path)) fail('LIVE surface file missing: ' + s.path);
}
for (const d of reg.domains) {
  if (!fams.has(d.fam)) fail('domain ' + d.d + ' in unknown family ' + d.fam);
  if (!DSTATES.has(d.state)) fail('domain ' + d.d + ' bad state ' + d.state);
}
const domSet = new Set(reg.domains.map(d => d.d));
if (domSet.size !== reg.domains.length) fail('duplicate domain entry');
for (const s of reg.surfaces) if (!domSet.has(s.home)) fail('surface ' + s.id + ' home not a known domain: ' + s.home);

/* the counts block must equal what the registry itself computes — no hand numbers survive */
const byFam = {}; reg.families.forEach(f => byFam[f] = 0);
for (const s of reg.surfaces) byFam[s.family]++;
const recomputed = {
  surfaces: reg.surfaces.length,
  families: reg.families.length,
  domains: reg.domains.length,
  domainsLive: reg.domains.filter(d => d.state === 'LIVE').length,
  domainsPending: reg.domains.filter(d => d.state === 'DNS-PENDING').length,
  domainsSeatOpen: reg.domains.filter(d => d.state === 'SEAT-OPEN').length,
  byFamily: byFam,
  byState: { LIVE: reg.surfaces.filter(s => s.state === 'LIVE').length },
};
const a = JSON.stringify(recomputed), b = JSON.stringify(reg.counts);
if (a !== b) { console.error('counts block drifted from the registry itself:\n  recomputed: ' + a + '\n  declared : ' + b); process.exit(1); }

console.log('PASS estate-check — ' + reg.surfaces.length + ' surfaces once each · ' + reg.domains.length + ' domains · counts computed, not written');
