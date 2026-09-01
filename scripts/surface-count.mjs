/* surface-count.mjs — THE ONE COUNTING RULE.
   The door's surface number, the smoke's assertion, and the registry's own
   cross-check all walk THE SAME list from THE SAME walker. Before this module
   there were three counters: the atlas printed a stored counts block (94),
   the smoke counted the tree (85), the deck listed its own array (84) — and
   the front door told a stranger a false number in Latvian. The rule now
   lives here and is DERIVED FROM THE TREE every time; it cannot drift.

   EXCLUDED, and why:
     surfaces/fleet/                     preserved founder art
     surfaces/fleet-hosted/gallery|lab   generated copies of that same art. Seven
                                         differ from the original only by the src
                                         that drops the CDN. intake-tracker and
                                         bnr-dashboard ALSO carry behaviour fixes,
                                         because functional change to fleet content
                                         lands in the DERIVATIVE and never in the
                                         archive — that is what fleet-hosted/ is
                                         for. They stay uncounted because they are
                                         still his pages, generated from his art;
                                         fixing a bug in a copy does not transfer
                                         authorship of the surface.
   COUNTED: surfaces/fleet-hosted/index.html — that page is our own work.
   Change this rule DELIBERATELY: the hub footer, the review deck, and
   estate-check's tree cross-check all depend on it — they are ONE check
   reported three times, not three agreeing checks. */
import { readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd().replace(/(scripts|e2e)$/, '');
const NOT_OURS = (dir, name) =>
  name === 'fleet' ||
  (dir.endsWith('fleet-hosted') && (name === 'gallery' || name === 'lab'));

export function listSurfacesOnDisk(dir = join(ROOT, 'surfaces'), base = '') {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && NOT_OURS(dir, e.name)) continue;
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(listSurfacesOnDisk(join(dir, e.name), rel));
    else if (extname(e.name) === '.html') out.push(rel);
  }
  return out;
}

export function countSurfacesOnDisk() {
  return listSurfacesOnDisk().length;
}

/* The registry's counts block, recomputed from the registry's own rows.
   CENSUS LAW: a surface with counted:false is listed but not counted (the
   founder-art fleet copies; the rule mirrors NOT_OURS above — and the
   tree cross-check in estate-check proves the mirror holds). */
export function recomputeCounts(reg) {
  const byFam = {}; reg.families.forEach(f => byFam[f] = 0);
  for (const s of reg.surfaces) if (s.counted !== false) byFam[s.family]++;
  const byOrg = {};
  for (const s of reg.surfaces) if (s.counted !== false) byOrg[s.org] = (byOrg[s.org] || 0) + 1;
  return {
    surfaces: reg.surfaces.filter(s => s.counted !== false).length,
    listed: reg.surfaces.length,
    families: reg.families.length,
    domains: reg.domains.length,
    domainsLive: reg.domains.filter(d => d.state === 'LIVE').length,
    domainsPending: reg.domains.filter(d => d.state === 'DNS-PENDING').length,
    domainsSeatOpen: reg.domains.filter(d => d.state === 'SEAT-OPEN').length,
    byFamily: byFam,
    byState: { LIVE: reg.surfaces.filter(s => s.state === 'LIVE').length },
    byOrg: byOrg,
  };
}
