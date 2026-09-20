// GUX-01 ATLAS — the reusable visual/navigation engine for the documented
// family corpus (skaists.lineage/2 + skaists.lineage-overlay/1).
//
// ─── INTEGRATION API (for zGeneUI) ─────────────────────────────────────────
// This module is a page asset (same class as tour.js / lang.js / blood-nav.mjs):
// it is NOT a counted surface. blood.html integrates by:
//   1. <link rel="stylesheet" href="atlas.css">            (one line)
//   2. import { createAtlas, GHOST_TITLE } from "./atlas.mjs";
//   3. const atlas = await createAtlas({
//        mount:   document.getElementById("world"),        // any element
//        corpus:  mergedCorpusObject,                      // OR corpusUrl (fetched same-origin)
//        overlay: overlayObject,                           // OR overlayUrl; merged by ingest()
//        initial: { root, selection, view, transform },  // optional; defaults corpus.root / "pedigree";
//        //                                            transform, when PRESENT, is the AUTHORITATIVE
//        //                                            boot camera: the first paint renders through it
//        //                                            and never reframes it away (deep link / session
//        //                                            return). Omit it for auto-framing boot.
//        bounds:  { ancDepth, descDepth, descNodeCap, sibCap, spouseCap },
//        onContext(ctx, reason) { /* sync #p=&v=&r=&s= hash here */ },
//      });
//   4. atlas.select(iid)          — selection only, NEVER moves the root
//      atlas.reroot(iid)          — explicit re-root, pushes history
//      atlas.setView("pedigree"|"fractal"|"tree") — pushes history, keeps root+selection
//      atlas.back() / atlas.home() — restore prior exploration context
//      atlas.home() returns EXACTLY to the boot framing: the first paint's
//      camera (an explicit initial.transform when provided, else the first
//      reframe) — the mount reports it once via core.adoptBootTransform(),
//      so home() never restores a computed-but-never-displayed transform.
//      Restored contexts (back/home/restoreContext) keep their own camera:
//      only FRESH navigations (reroot/setView/repaint) reframe.
//      atlas.zoomBy(f) / atlas.resetView() — camera affordances; resetView
//      returns the camera to the SAME boot framing home() uses (the two
//      camera-return affordances can never disagree).
//      atlas.getContext()         — frozen {root, selection, view, transform}
//      atlas.search(q, cap) / atlas.ghostCount(iid) / atlas.person(iid)
//      atlas.destroy()            — removes listeners, clears the mount
//   Events reach the integrator ONLY through onContext(ctx, reason) with
//   reason ∈ select|reroot|view|back|home|restore; pan/zoom mutates transform
//   silently (read it from getContext when needed). Ghost cells dispatch a
//   "atlas-ghost" CustomEvent on the mount (detail.child = the child iid).
//
// LAWS this engine keeps (GUX-01 order, verbatim intent):
//   people not placeholders · semantic zoom (LOD by scale) · one canonical
//   identity across repeated pedigree positions · selection ≠ re-root ·
//   bounded rendering · cycles terminate visibly · ghost frontier = coverage
//   unknown, never "no ancestors" · affinity (spouse) visually distinct from
//   blood · no confidence score invented from evidence class or citation
//   count · archive-return values (corpus/overlay objects) immutable.
//
// Pure core (ingest/build*/lodFor/search/createCore) runs headless in node;
// the DOM layer (createAtlas) is browser-only and adds pan/zoom + LOD +
// keyboard + click/dblclick (drag never selects — 5px threshold).

export const ATLAS_VERSION = "gux01/1";
export const GHOST_TITLE = "ancestry continues beyond the published archive";
const EMPTY_TITLE = GHOST_TITLE + " — parents not published for this person";
export const DEFAULT_BOUNDS = Object.freeze({
  ancDepth: 7,      // generations of ancestors (incumbent ring count)
  descDepth: 3,     // generations of descendants in the tree view
  descNodeCap: 150, // hard ceiling on descendant rows — never paint the corpus
  sibCap: 24,
  spouseCap: 6,
});
const VIEWS = new Set(["pedigree", "fractal", "tree"]);
const LOD_FAR = 0.55, LOD_NEAR = 1.15;

// ─── ingest: corpus + overlay → frozen read model ──────────────────────────
// Mirrors blood.html's load order: corpus first, overlay persons/edges merged
// in (overlay edges replace per-key, as the incumbent does). The engine never
// writes corpus/overlay objects; everything it exposes is derived + frozen.
export function ingest(corpus, overlay, opts) {
  const persons = Object.assign({}, corpus.persons || {});
  const edges = Object.assign({}, corpus.edges || {});
  if (overlay && overlay.persons) Object.assign(persons, overlay.persons);
  if (overlay && overlay.edges) {
    // overlay edge targets arrive as provider ids — resolve through the
    // corpus's own refsIndex so walked parents stay walked (never ghosts)
    const ridx = corpus.refsIndex || {};
    for (const k of Object.keys(overlay.edges)) {
      edges[k] = overlay.edges[k].map((p) => (persons[p] ? p : (ridx[p] || p)));
    }
  }

  // children: derived, insertion order deterministic
  const children = {};
  for (const child of Object.keys(edges)) {
    for (const parent of edges[child]) {
      if (persons[parent]) (children[parent] = children[parent] || []).push(child);
    }
  }
  // spouses: couples map (object keyed "p1|p2" in the corpus; array tolerated)
  const spouses = {};
  let coupleCount = 0;
  const coupleList = corpus.couples && !Array.isArray(corpus.couples)
    ? Object.values(corpus.couples)
    : (corpus.couples || []);
  for (const c of coupleList) {
    coupleCount++;
    (spouses[c.p1] = spouses[c.p1] || []).push(c.p2);
    (spouses[c.p2] = spouses[c.p2] || []).push(c.p1);
  }
  // ghost frontier: parent refs with no published person — counted per person,
  // never surfaced as raw provider strings (the provider-string adapter law)
  const ghostCounts = {};
  let ghostTotal = 0;
  for (const child of Object.keys(edges)) {
    if (!persons[child]) continue;
    let n = 0;
    for (const parent of edges[child]) if (!persons[parent]) n++;
    if (n) { ghostCounts[child] = n; ghostTotal += n; }
  }
  const spineIds = new Set();
  for (const r of corpus.spine || []) if (r.f) spineIds.add(r.f);

  // disputed-edge seam (incumbent semantics; default = everything visible)
  const relEvidence = (opts && opts.relEvidence) || (overlay && overlay.relationshipEvidence) || null;
  const reconChoices = (opts && opts.recon && opts.recon.current && opts.recon.current.choices) || null;
  function edgeVisible(child, parent) {
    if (!relEvidence) return true;
    const ev = relEvidence[child + "|" + parent];
    if (!ev) return true;
    const ch = reconChoices && reconChoices[child + "|" + parent];
    if (!ch) return true;
    if (/sven/.test(ch) && String(parent).startsWith("ovl-")) return false;
    return true;
  }

  const model = {
    root: corpus.root || null,
    persons: Object.freeze(persons),
    stats: (corpus.meta && corpus.meta.stats) || {},
    packs: Object.freeze(Object.assign({}, ((corpus.meta || {}).packs) || {})),
    spineLength: (corpus.spine || []).length,
    ghostTotal,
    coupleCount,
    person(iid) { return persons[iid] || null; },
    parentOf(child) { return (edges[child] || []).filter((p) => persons[p] && edgeVisible(child, p)); },
    rawParentRefs(child) { return edges[child] || []; },
    childrenOf(parent) { return (children[parent] || []).slice(); },
    spousesOf(iid) { return (spouses[iid] || []).slice().filter((p) => persons[p]); },
    ghostCount(iid) { return ghostCounts[iid] || 0; },
    isSpine(iid) { return spineIds.has(iid); },
  };
  return Object.freeze(model);
}

// ─── role assignment (the incumbent's parentSlots law, mirrored) ───────────
// Gender decides: father slot for male-recorded parents, mother slot for
// female-recorded; unknown-gender and leftover refs fill FREE slots only; the
// same person never occupies both slots; a missing slot stays visibly empty —
// no manufactured second parent, ever.
function parentSlots(model, child) {
  const refs = model.rawParentRefs(child);
  const published = model.parentOf(child);
  let fa = null, mo = null;
  const used = new Set();
  for (const p of published) {
    const g = String((model.person(p) || {}).gender || "");
    if (/^m/i.test(g) && g !== "FEMALE" && !fa) { fa = p; used.add(p); }
    else if (/^f/i.test(g) && !mo) { mo = p; used.add(p); }
  }
  for (const p of published) {
    if (used.has(p)) continue;
    if (!fa) { fa = p; used.add(p); } else if (!mo) { mo = p; used.add(p); }
  }
  const ghosts = refs.length - published.length;
  return { fa, mo, ghosts };
}

function yearOf(lifesan) {
  const m = String(lifesan || "").match(/^(\d{3,4})/);
  return m ? m[1] : "";
}
function cellBase(model, iid, kind, role) {
  const p = model.person(iid) || {};
  return {
    kind, iid, role,
    name: p.name || "",
    year: yearOf(p.lifespan),
    evClass: (p.evidence && p.evidence.class) || "",
    living: !!p.living,
    title: p.name ? p.name + (p.lifespan ? " · " + p.lifespan : "") : "",
  };
}

// ─── the one honest ancestor topology (shared by pedigree + fractal) ───────
// Ahnentafel slots: child slot n → parents 2n (father) / 2n+1 (mother).
// A repeated person renders as a MIRROR of the canonical identity and is
// never recursed under; a referenced-but-unpublished parent renders a GHOST
// slot; an unoccupied slot with no reference stays EMPTY with the honest
// coverage title. Bounded by construction: at most 2^(ancDepth+1)−1 cells.
function slotWalk(model, root, ancDepth) {
  const cells = [Object.assign(cellBase(model, root, "person", "self"), { gen: 0, slot: 0 })];
  const seen = new Set([root]);
  let level = [{ iid: root, slot: 0, kind: "person" }];
  for (let gen = 1; gen <= ancDepth; gen++) {
    const next = [];
    for (const node of level) {
      for (let side = 0; side < 2; side++) {
        const slot = node.slot * 2 + side;
        if (!node || node.kind !== "person") { next.push(null); continue; }
        const ps = parentSlots(model, node.iid);
        const picked = side === 0 ? ps.fa : ps.mo;
        if (picked) {
          if (seen.has(picked)) {
            cells.push(Object.assign(cellBase(model, picked, "mirror", side === 0 ? "father" : "mother"), { gen, slot }));
            next.push({ iid: picked, slot, kind: "mirror" });
          } else {
            seen.add(picked);
            cells.push(Object.assign(cellBase(model, picked, "person", side === 0 ? "father" : "mother"), { gen, slot }));
            next.push({ iid: picked, slot, kind: "person" });
          }
        } else {
          // free slot: a referenced-but-unpublished parent is a ghost; a slot
          // with no reference at all is empty — coverage unknown either way
          const bothFree = ps.fa === null && ps.mo === null;
          const ghostFits = bothFree
            ? ps.ghosts >= side + 1
            : (ps.ghosts > 0 && ((side === 1 && ps.fa) || (side === 0 && ps.mo)));
          if (ghostFits) {
            cells.push({ kind: "ghost", iid: null, role: "parent", gen, slot, title: GHOST_TITLE, ghosts: ps.ghosts });
            next.push(null);
          } else {
            cells.push({ kind: "empty", iid: null, role: side === 0 ? "father" : "mother", gen, slot, title: EMPTY_TITLE });
            next.push(null);
          }
        }
      }
    }
    level = next.filter(Boolean);
    if (!level.length) break;
  }
  return cells;
}

function sceneCounts(cells, extra) {
  let persons = 0, mirrors = 0, ghosts = 0, painted = 0;
  for (const c of cells) {
    if (c.kind === "person") persons++;
    else if (c.kind === "mirror") mirrors++;
    else if (c.kind === "ghost") ghosts++;
    if (c.kind !== "empty") painted++;
  }
  return Object.assign({ persons, mirrors, ghosts, painted, truncated: false }, extra || {});
}

// ─── pedigree view: rectangular ahnentafel rows, connector geometry ─────────
export function buildPedigree(model, opts) {
  const ancDepth = (opts && opts.ancDepth) || DEFAULT_BOUNDS.ancDepth;
  const root = (opts && opts.root) || model.root;
  const cells = slotWalk(model, root, ancDepth);
  for (const c of cells) {
    const rowLen = Math.pow(2, c.gen);
    c.x = c.slot - (rowLen - 1) / 2;   // centered grid; the DOM scales it
    c.y = c.gen;
    c.size = 1;
  }
  return { view: "pedigree", root, cells: Object.freeze(cells), counts: sceneCounts(cells), bounds: { ancDepth } };
}

// ─── fractal view: the same topology on polar honeycomb rings ───────────────
// Root at the world origin; ring g holds the generation's slots by binary
// angle (neighbors stay adjacent); cells shrink outward so structure reads
// far away and people read close up — the semantic-zoom world. Root spouses
// sit BESIDE the root as affinity cells, never in blood slots.
export function buildFractal(model, opts) {
  const ancDepth = (opts && opts.ancDepth) || DEFAULT_BOUNDS.ancDepth;
  const spouseCap = (opts && opts.spouseCap) || DEFAULT_BOUNDS.spouseCap;
  const root = (opts && opts.root) || model.root;
  const cells = slotWalk(model, root, ancDepth);
  for (const c of cells) {
    if (c.gen === 0) { c.x = 0; c.y = 0; c.size = 1; c.angle = 0; continue; }
    const rowLen = Math.pow(2, c.gen);
    c.angle = ((c.slot + 0.5) / rowLen) * Math.PI * 2;
    const r = c.gen; // ring index; the DOM scales radius + cell size
    c.x = Math.cos(c.angle) * r;
    c.y = Math.sin(c.angle) * r;
    c.size = 1 / c.gen; // outer rings draw smaller — structure when zoomed out
  }
  const spouses = model.spousesOf(root).slice(0, spouseCap);
  spouses.forEach((iid, i) => {
    cells.push(Object.assign(cellBase(model, iid, "spouse", "spouse"), {
      gen: 0, slot: -1 - i, x: -1.35 - i * 0.05, y: 0.72 + i * 0.06, size: 0.62,
      angle: Math.PI, title: (model.person(iid).name || "") + " — affinity (spouse), never a blood slot",
    }));
  });
  return { view: "fractal", root, cells: Object.freeze(cells), counts: sceneCounts(cells), bounds: { ancDepth, spouseCap } };
}

// ─── tree view: bounded local topology as readable rows ────────────────────
// ancestors (indented, mirrors as link rows, one ghost affordance row per
// ghosted person) · self · spouses (affinity) · siblings · descendants
// (BFS, node-capped, cycles close as mirror rows). Truncation is STATED.
export function buildTree(model, opts) {
  const o = Object.assign({}, DEFAULT_BOUNDS, opts || {});
  const root = o.root || model.root;
  const rows = [];
  const push = (r) => { rows.push(r); };
  // ancestors: preorder DFS, father first
  const seenAnc = new Set([root]);
  (function anc(iid, depth) {
    if (depth > o.ancDepth) return;
    const ps = parentSlots(model, iid);
    for (const p of [ps.fa, ps.mo]) {
      if (!p) continue;
      const mirror = seenAnc.has(p);
      if (!mirror) seenAnc.add(p);
      push(Object.assign(cellBase(model, p, mirror ? "mirror" : "person", p === ps.fa ? "father" : "mother"), {
        depth, section: "ancestors",
        title: mirror ? cellBase(model, p, "person", "parent").title + " — reached again; shown once above" : cellBase(model, p, "person", "parent").title,
      }));
      if (!mirror) anc(p, depth + 1);
    }
    if (model.ghostCount(iid) > 0) {
      push({ kind: "ghost", iid: null, role: "parent", depth, section: "ancestors", name: "", year: "", evClass: "", living: false,
        title: GHOST_TITLE, ghosts: model.ghostCount(iid) });
    }
  })(root, 1);
  push(Object.assign(cellBase(model, root, "person", "self"), { depth: 0, section: "self" }));
  for (const sp of model.spousesOf(root).slice(0, o.spouseCap)) {
    push(Object.assign(cellBase(model, sp, "spouse", "spouse"), {
      depth: 1, section: "spouse",
      title: (model.person(sp).name || "") + " — affinity (spouse), never blood",
    }));
  }
  // siblings: share ≥1 parent, excluding self, capped
  const parentSet = new Set(model.parentOf(root));
  if (parentSet.size) {
    const sibs = new Map();
    for (const p of parentSet) for (const c of model.childrenOf(p)) if (c !== root && !sibs.has(c)) sibs.set(c, p);
    let n = 0;
    for (const c of sibs.keys()) {
      if (n >= o.sibCap) break;
      push(Object.assign(cellBase(model, c, "person", "sibling"), { depth: 1, section: "siblings" }));
      n++;
    }
  }
  // descendants: BFS, level- and node-capped; revisits close as mirrors
  let truncated = false;
  const visited = new Set([root]);
  let frontier = model.childrenOf(root);
  let painted = 0;
  for (let level = 1; level <= o.descDepth && frontier.length; level++) {
    const next = [];
    for (const c of frontier) {
      if (painted >= o.descNodeCap) { truncated = true; break; }
      const mirror = visited.has(c);
      push(Object.assign(cellBase(model, c, mirror ? "mirror" : "person", "child"), {
        depth: level, section: "descendants",
        title: mirror ? cellBase(model, c, "person", "child").title + " — reached again; shown once above" : cellBase(model, c, "person", "child").title,
      }));
      painted++;
      if (!mirror) { visited.add(c); next.push(c); }
    }
    if (painted >= o.descNodeCap && frontier.length) truncated = true;
    frontier = [];
    for (const parent of next) frontier.push(...model.childrenOf(parent));
  }
  for (let i = 0; i < rows.length; i++) rows[i].y = i;
  const counts = { painted: rows.length, persons: rows.filter((r) => r.kind === "person").length,
    mirrors: rows.filter((r) => r.kind === "mirror").length,
    ghosts: rows.filter((r) => r.kind === "ghost").length,
    descendants: painted, truncated };
  return { view: "tree", root, rows: Object.freeze(rows), counts, bounds: Object.freeze({ ...o }) };
}

// ─── semantic zoom (L2): scale decides what the eye is owed ────────────────
export function lodFor(k) {
  if (k < LOD_FAR) return "far";     // structure only — cells, markers, ghosts
  if (k < LOD_NEAR) return "mid";    // people appear: near rings readable
  return "near";                     // reading: names + years everywhere
}

// ─── search: substring over the one address space, capped, never first-pick ─
export function search(model, q, cap = 12) {
  const needle = String(q || "").toLowerCase().trim();
  if (!needle) return [];
  const hits = [];
  for (const iid of Object.keys(model.persons)) {
    const p = model.persons[iid];
    if (String(p.name || "").toLowerCase().includes(needle)) {
      hits.push({ iid, name: p.name, lifespan: p.lifespan || null, evClass: (p.evidence && p.evidence.class) || "" });
      if (hits.length >= cap) break;
    }
  }
  return hits;
}

// ─── core state machine: selection ≠ re-root; history = exploration context ─
// ─── discovery layer (founder order 2026-09-18): derived first-load cards ──
// The surface must answer on first load — who is this, how am I related, why
// is it interesting, why believe it, what happens if I keep exploring — from
// hooks the CORPUS declares (packs, spine, corrections, frontier, bounded
// counts), never from hardcoded celebrity tiles.
// UI LAW, enforced structurally: whenever a count depends on traversal depth,
// the depth rides beside the count (depthNote); a corpus-wide count states
// corpusWide instead. The builder refuses a depthless count.

// shortest blood route over parent edges: `to` must be an ancestor of `from`
export function bloodRoute(model, from, to) {
  if (!model.person(from) || !model.person(to)) return null;
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const p of model.parentOf(cur)) if (!prev.has(p)) { prev.set(p, cur); q.push(p); }
  }
  if (!prev.has(to)) return null;
  const route = [];
  for (let n = to; n; n = prev.get(n)) route.push(n);
  return route.reverse();
}

// ─── route-alternates law (founder order 2026-09-18) ───────────────────────
// Alternate-route claims are COMPUTED, never universal boilerplate. This
// counts, over the published parent-edge graph: the shortest length, how many
// DISTINCT shortest routes exist, and how many routes exactly one hop longer
// exist (a two-pass layered DP over the ancestor DAG — same-level reads only
// after the level's shortest counts are complete). ~12 ms at depth 143.
export function routeAlternates(model, from, to) {
  if (!model.person(from) || !model.person(to)) return null;
  const dist = { [from]: 0 };
  const kids = new Map();
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const p of model.parentOf(cur)) {
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p).push(cur);
      if (dist[p] === undefined) { dist[p] = dist[cur] + 1; q.push(p); }
    }
  }
  if (dist[to] === undefined) return null;
  const L = dist[to];
  const byLevel = new Map();
  for (const v in dist) {
    const l = dist[v];
    if (l > L + 1) continue;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l).push(v);
  }
  const sc = {}, po = {};
  sc[from] = 1; po[from] = 0;
  for (let l = 1; l <= L + 1; l++) {
    const lvl = byLevel.get(l) || [];
    for (const v of lvl) sc[v] = 0;
    for (const v of lvl) for (const ch of kids.get(v) || []) if (dist[ch] === l - 1) sc[v] += sc[ch] || 0;
    for (const v of lvl) po[v] = 0;
    for (const v of lvl) for (const ch of kids.get(v) || []) {
      if (dist[ch] === l - 1) po[v] += po[ch] || 0;
      else if (dist[ch] === l) po[v] += sc[ch] || 0;
    }
  }
  return { shortestLen: L, shortestCount: sc[to] || 0, plusOneCount: po[to] || 0 };
}

// The phrase builder REFUSES uncomputed claims: it accepts only the derived
// object and emits one of the three qualified states — proven alternates
// (equal-length), proven alternates (one hop longer), or an honest
// not-assessed statement. "Alternates exist because collapse exists somewhere"
// is unconstructible.
export function routeAlternatesPhrase(a) {
  if (!a || typeof a.shortestLen !== "number" || typeof a.shortestCount !== "number" || typeof a.plusOneCount !== "number") {
    throw new Error("atlas routeAlternatesPhrase: alternates claims require the computed routeAlternates object — never universal boilerplate (the route-meta law)");
  }
  const parts = [];
  if (a.shortestCount > 1) parts.push((a.shortestCount - 1) + " more equal-length route" + (a.shortestCount - 1 === 1 ? "" : "s") + " at " + a.shortestLen + " hops computed");
  if (a.plusOneCount > 0) parts.push(a.plusOneCount + " route" + (a.plusOneCount === 1 ? "" : "s") + " one hop longer (" + (a.shortestLen + 1) + ") also computed");
  if (!parts.length) parts.push("alternate routes not assessed beyond one hop longer; other routes may exist — this view has not exhaustively enumerated them");
  return parts.join(" · ");
}

function card(fields) {
  if (fields.count != null && !fields.depthNote && fields.corpusWide !== true) {
    throw new Error("atlas discoveries: a count without its depth is refused — attach depthNote or corpusWide (the UI law)");
  }
  return Object.freeze(fields);
}

const NON_FAMILY = new Set(["Sr", "Jr", "I", "II", "III", "IV", "V", "?", "De", "Van"]);
function familyNameClusters(model, iid, withinGen, top = 4) {
  const counts = {};
  const seen = new Set([iid]);
  (function walk(cur, depth) {
    if (depth > withinGen) return;
    for (const p of model.parentOf(cur)) {
      if (seen.has(p)) continue;
      seen.add(p);
      const parts = String(model.person(p).name || "").trim().split(/\s+/);
      const last = parts[parts.length - 1];
      if (last && last.length > 2 && !NON_FAMILY.has(last)) counts[last] = (counts[last] || 0) + 1;
      walk(p, depth + 1);
    }
  })(iid, 0);
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top).map(([n]) => n);
}
function countWithin(model, iid, withinGen) {
  const seen = new Set([iid]);
  (function walk(cur, depth) {
    if (depth > withinGen) return;
    for (const p of model.parentOf(cur)) { if (!seen.has(p)) { seen.add(p); walk(p, depth + 1); } }
  })(iid, 0);
  return seen.size - 1;
}

export function discoveries(model, opts) {
  const o = Object.assign({ branchDepth: 10, collapseDepth: 7, maxCards: 24 }, opts || {});
  if (o._testBadCard) return [card({ kind: "test", title: "bad", count: 123 })]; // refused — proof of the law
  const root = model.root;
  // generations above the root (upward BFS over published parent edges)
  const gen = { [root]: 0 };
  const q = [root];
  while (q.length) {
    const cur = q.shift();
    for (const p of model.parentOf(cur)) if (gen[p] === undefined) { gen[p] = gen[cur] + 1; q.push(p); }
  }
  const cards = [];
  // ROUTE cards — from pack registration (the estate's cited souls) + the
  // deepest published line (pure derivation); every count carries its depth.
  // TWO-LAYER GRAMMAR: title+hook speak human; disclosure carries the
  // engineering facts (graph, status, retrieval) — never mixed.
  const packTargets = Object.keys(model.packs)
    .filter((iid) => model.person(iid) && gen[iid] !== undefined)
    .sort((a, b) => gen[b] - gen[a]);
  for (const iid of packTargets.slice(0, 4)) {
    const p = model.person(iid);
    cards.push(card({
      id: "route-" + iid, kind: "route", iid,
      title: gen[iid] + " generations to " + p.name,
      hook: "follow every ancestor between you.",
      count: gen[iid], depthNote: "within " + gen[iid] + " generations (shortest parent path)",
      action: { type: "show-route", from: root, to: iid },
      disclosure: "shortest published parent-edge route · " + gen[iid] + " hops · " + routeAlternatesPhrase(routeAlternates(model, root, iid)) + " · evidence pack " + model.packs[iid] + " · records retrieved " + (model.stats && model.stats.retrieved ? model.stats.retrieved : "with the corpus"),
    }));
  }
  let deepest = null;
  for (const iid in gen) if (gen[iid] > (deepest ? gen[deepest] : -1)) deepest = iid;
  if (deepest) {
    cards.push(card({
      id: "route-deepest", kind: "route", iid: deepest,
      title: "the deepest published line runs " + gen[deepest] + " generations",
      hook: "travel it and watch the evidence change character.",
      count: gen[deepest], depthNote: "within " + gen[deepest] + " generations (shortest parent path)",
      action: { type: "show-route", from: root, to: deepest },
      disclosure: "shortest published parent-edge route · " + gen[deepest] + " hops · " + routeAlternatesPhrase(routeAlternates(model, root, deepest)) + " · pure corpus derivation (upward BFS) · published, not verified — era≠support chips carry the honesty along the way",
    }));
  }
  // BRANCH cards — the named grandparents, bounded counts + family names
  for (const parent of model.parentOf(root)) {
    for (const gp of model.parentOf(parent)) {
      const p = model.person(gp);
      if (!p || p.living || p.name === "Living") continue;
      const n = countWithin(model, gp, o.branchDepth);
      const names = familyNameClusters(model, gp, o.branchDepth);
      cards.push(card({
        id: "branch-" + gp, kind: "branch", iid: gp,
        title: "the " + (String(p.name || "").split(" ").slice(-1)[0] || p.name) + " branch — " + p.name,
        hook: "a whole mapped branch of the family: " + names.slice(0, 3).join(" · ") + ".",
        count: n, depthNote: "within " + o.branchDepth + " generations",
        familyNames: Object.freeze(names),
        action: { type: "enter-branch", iid: gp },
        disclosure: "bounded ancestor closure · " + n + " ancestors within " + o.branchDepth + " generations · totals beyond this depth are depth-dependent by construction (the collapsed-web law) · derived from the corpus",
      }));
    }
  }
  // COLLAPSE card — the corpus's own pedigree collapse at the default depth
  const mirrors = buildPedigree(model, { root, ancDepth: o.collapseDepth }).cells.filter((c) => c.kind === "mirror");
  if (mirrors.length) {
    const m = mirrors[0];
    cards.push(card({
      id: "collapse-" + m.iid, kind: "collapse", iid: m.iid,
      title: m.name + " reaches you more than one way",
      hook: "one person, more than one path — meet them once.",
      count: mirrors.length, depthNote: "within " + o.collapseDepth + " generations",
      action: { type: "select", iid: m.iid },
      disclosure: "pedigree collapse · " + mirrors.length + " repeated positions within " + o.collapseDepth + " generations · one canonical person id (" + m.iid + ") · ahnentafel walk over the corpus",
    }));
  }
  // CORRECTION cards — records carrying the founder attestation
  for (const iid of Object.keys(model.persons)) {
    const p = model.person(iid);
    if (!p.corrected || gen[iid] === undefined || gen[iid] > 4) continue;
    cards.push(card({
      id: "corrected-" + iid, kind: "correction", iid,
      title: p.name,
      hook: "the record said one thing — your family said another. See what changed.",
      action: { type: "select", iid },
      disclosure: "founder attestation on the walked record · " + p.corrected.attested + " · " + p.corrected.note,
    }));
  }
  // FRONTIER card — corpus-wide ghost refs + the nearest edge
  let nearest = null;
  for (const iid in gen) if (model.ghostCount(iid) > 0 && (!nearest || gen[iid] < gen[nearest])) nearest = iid;
  if (nearest) {
    cards.push(card({
      id: "frontier", kind: "frontier", iid: nearest,
      title: "ancestry continues beyond the published archive",
      hook: "walk to the edge — generation " + gen[nearest] + ", where the references keep going.",
      count: model.ghostTotal, corpusWide: true,
      action: { type: "reroot", iid: nearest },
      disclosure: model.ghostTotal + " frontier references counted across the whole published corpus (not depth-bounded) · nearest edge: " + model.person(nearest).name + ", generation " + gen[nearest] + " · coverage of the walk, never an empty family",
    }));
  }
  return Object.freeze(cards.slice(0, o.maxCards));
}

export function createCore(model, opts) {
  const o = opts || {};
  const historyCap = o.historyCap || 100;
  let state = {
    root: (o.initial && o.initial.root) || model.root,
    selection: (o.initial && o.initial.selection) || null,
    view: (o.initial && o.initial.view) || "pedigree",
    transform: Object.assign({ k: 1, x: 0, y: 0 }, (o.initial && o.initial.transform) || {}),
  };
  let initial = Object.assign({}, state);
  let bootAdopted = false;
  const bootTransform = () => Object.assign({}, initial.transform);
  let history = [];
  const emit = (reason) => { if (o.onContext) o.onContext(snapshot(), reason); };
  const snapshot = () => Object.freeze({
    root: state.root, selection: state.selection, view: state.view,
    transform: Object.freeze(Object.assign({}, state.transform)),
  });
  const push = () => {
    history.push(snapshot());
    if (history.length > historyCap) history.shift();
  };
  return {
    getContext: snapshot,
    historyDepth: () => history.length,
    select(iid) {
      if (!model.person(iid)) return false;
      if (iid !== state.selection) state.selection = iid;
      emit("select");
      return true;
    },
    reroot(iid) {
      if (!model.person(iid) || iid === state.root) return false;
      push();
      state.root = iid; // selection survives a re-root by design
      emit("reroot");
      return true;
    },
    setView(v) {
      if (!VIEWS.has(v) || v === state.view) return false;
      push();
      state.view = v;
      emit("view");
      return true;
    },
    setTransform(t) { state.transform = Object.assign({}, state.transform, t); },
    back() {
      const prev = history.pop();
      if (!prev) return null;
      state = { root: prev.root, selection: prev.selection, view: prev.view, transform: Object.assign({}, prev.transform) };
      emit("back");
      return snapshot();
    },
    home() {
      push();
      state = { root: initial.root, selection: initial.selection, view: initial.view, transform: Object.assign({}, initial.transform) };
      emit("home");
      return snapshot();
    },
    // One-shot: the mount reports the transform the FIRST paint actually
    // rendered — the honored explicit boot camera, or the first reframe.
    // home() must return to the framing boot SHOWED, never to a camera that
    // was computed and then discarded, or never displayed at all.
    adoptBootTransform(t) {
      if (bootAdopted) return false;
      if (t && typeof t === "object") initial = Object.assign({}, initial, { transform: Object.assign({ k: 1, x: 0, y: 0 }, t) });
      bootAdopted = true;
      return true;
    },
    // the framing boot showed (post-adoption). resetView() aims here so the
    // two camera-return affordances can never disagree (V1).
    bootTransform() { return bootTransform(); },
    restoreContext(ctx) {
      if (!ctx) return false;
      if (ctx.root != null && !model.person(ctx.root)) return false;
      if (ctx.selection != null && !model.person(ctx.selection)) return false;
      state = {
        root: ctx.root != null ? ctx.root : state.root,
        selection: ctx.selection != null ? ctx.selection : state.selection,
        view: VIEWS.has(ctx.view) ? ctx.view : state.view,
        transform: Object.assign({ k: 1, x: 0, y: 0 }, ctx.transform || {}),
      };
      emit("restore");
      return true;
    },
  };
}

// ─── DOM layer (browser only): pan/zoom world, LOD, pointer + keyboard ─────
const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k of Object.keys(attrs || {})) if (attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
  return el;
}
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function createAtlas(opts) {
  const o = opts || {};
  if (!o.mount) throw new Error("atlas: mount element required");
  const load = (v, url) => (v ? Promise.resolve(v) : url ? fetch(url).then((r) => r.json()) : null);
  const corpus = await load(o.corpus, o.corpusUrl);
  if (!corpus) throw new Error("atlas: corpus or corpusUrl required");
  const overlay = o.overlayUrl ? await load(null, o.overlayUrl) : (o.overlay || null);
  const model = ingest(corpus, overlay, o);
  const bounds = Object.assign({}, DEFAULT_BOUNDS, o.bounds || {});
  const core = createCore(model, { initial: o.initial, historyCap: o.historyCap, onContext: (ctx, reason) => {
    paint(reason);
    if (o.onContext) o.onContext(core.getContext(), reason); // fresh — restored paints keep their own camera
  } });

  const mount = o.mount;
  mount.classList.add("atlas-root");
  const stage = document.createElement("div");
  stage.className = "atlas-stage";
  stage.innerHTML = '<svg class="atlas-world" role="img" aria-label="family atlas"></svg><ol class="atlas-listview"></ol>';
  mount.appendChild(stage);
  const world = stage.querySelector(".atlas-world");
  const listview = stage.querySelector(".atlas-listview");
  const pan = svgEl("g", { class: "atlas-pan" });
  world.appendChild(pan);

  const CELL = 108;       // pedigree cell pitch, px (world units)
  const RING = 150;       // fractal ring pitch, px
  let transform = { k: 1, x: 0, y: 0 };
  let lastScene = null;
  let lastViewRoot = "";
  let firstPaint = true;
  // An explicitly provided initial.transform is the AUTHORITATIVE boot
  // camera (deep link / session return): the first paint renders through it
  // and never reframes it away. Omit initial.transform for auto-framing.
  // An EMPTY transform object counts as absent (V2): a grammar-side bug
  // passing {} would otherwise silently boot at {1,0,0} with no reframe.
  const hasBootCamera = !!(o.initial && o.initial.transform && Object.keys(o.initial.transform).length > 0);
  // framing: pedigree anchors near the stage top (ancestors flow DOWN into
  // view — at 390px a center anchor pushed generations 2+ under the fold);
  // fractal anchors at the center (rings radiate). Reframe on view/root change.
  function reframe(view) {
    const rect = stage.getBoundingClientRect();
    transform.x = 0;
    transform.y = view === "pedigree" ? 70 - rect.height / 2 : 0;
  }

  function hexPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3; // flat-top hex
      pts.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }
  function cellPos(c) {
    if (lastScene.view === "fractal") {
      if (c.gen === 0) {
        if (c.kind === "spouse") return { x: c.x * RING, y: c.y * RING, r: Math.max(10, c.size * 58) };
        return { x: 0, y: 0, r: 58 };
      }
      const R = RING * c.gen + RING * 0.55;
      const angular = (2 * Math.PI * R) / Math.pow(2, c.gen); // width this slot owns
      const r = Math.max(10, Math.min(angular * 0.36, 64));
      return { x: Math.cos(c.angle) * R, y: Math.sin(c.angle) * R, r };
    }
    return { x: c.x * CELL, y: c.y * CELL * 1.35, r: 46 };
  }

  function paint(reason) {
    const ctx = core.getContext();
    transform = Object.assign({}, ctx.transform); // snapshot is frozen — keep a live copy
    const scene = ctx.view === "tree"
      ? buildTree(model, { root: ctx.root, ...bounds })
      : ctx.view === "fractal"
        ? buildFractal(model, { root: ctx.root, ancDepth: bounds.ancDepth, spouseCap: bounds.spouseCap })
        : buildPedigree(model, { root: ctx.root, ancDepth: bounds.ancDepth });
    lastScene = scene;
    const vr = scene.view + "|" + ctx.root;
    // Reframe only FRESH navigations (reroot/setView/repaint). Restored
    // contexts (back/home/restore) carry their own camera — reframing them
    // would discard the exact context being restored; and an explicit boot
    // camera is honored on the first paint, never reframed away.
    const restored = reason === "back" || reason === "home" || reason === "restore";
    if (vr !== lastViewRoot && !restored && !(firstPaint && hasBootCamera)) reframe(scene.view);
    lastViewRoot = vr;
    // the boot framing is what home() returns to: adopt it exactly once,
    // after the first paint's camera decision (honored or reframed).
    if (firstPaint) { firstPaint = false; core.adoptBootTransform(transform); }
    const isTree = scene.view === "tree";
    world.style.display = isTree ? "none" : "";
    listview.style.display = isTree ? "" : "none";
    pan.innerHTML = "";
    listview.innerHTML = "";
    world.setAttribute("data-painted", String(isTree ? scene.counts.painted : scene.counts.painted));
    world.setAttribute("data-view", scene.view);
    if (isTree) {
      for (const row of scene.rows) {
        const li = document.createElement("li");
        li.className = "atlas-row kind-" + row.kind + " ev-" + (row.evClass || "none")
          + (row.kind === "spouse" ? " atlas-affinity" : "") + (row.kind === "ghost" ? " atlas-ghost" : "")
          + (row.kind === "mirror" ? " atlas-mirror" : "");
        li.style.paddingLeft = 12 + row.depth * 18 + "px";
        li.setAttribute("data-section", row.section);
        if (row.iid) {
          li.setAttribute("data-pid", row.iid);
          li.setAttribute("role", "button");
          li.setAttribute("tabindex", "0");
          if (row.iid === ctx.selection) li.classList.add("atlas-sel");
          if (row.iid === ctx.root) li.classList.add("atlas-root");
        }
        li.title = row.title || "";
        li.innerHTML = row.kind === "ghost"
          ? '<span class="atlas-ghostmark">◌</span> <span class="atlas-label">…' + row.ghosts + ' further parent ' + (row.ghosts === 1 ? "reference" : "references") + " — " + esc(GHOST_TITLE) + "</span>"
          : '<span class="atlas-mark">' + (row.kind === "mirror" ? "⊙" : row.kind === "spouse" ? "⚭" : "·") + '</span> <span class="atlas-label">' + esc(row.name) + '</span> <span class="atlas-year">' + esc(row.year) + "</span>";
        li.addEventListener("click", () => core.select(row.iid));
        listview.appendChild(li);
      }
      return;
    }
    // svg world: pedigree rows or fractal rings. Links live in their OWN
    // layer under the cells — a connector inside the cell's <g> pollutes the
    // group's bbox and bbox-center hit-testing (clicks land off-cell).
    const linksG = svgEl("g", { class: "atlas-links" });
    pan.appendChild(linksG);
    for (const c of scene.cells) {
      if (c.kind === "empty" && scene.view === "fractal") continue; // fractal never paints empty geometry
      const pos = cellPos(c);
      const g = svgEl("g", {
        class: "atlas-cell kind-" + c.kind + " ev-" + (c.evClass || "none")
          + (c.kind === "spouse" ? " atlas-affinity" : "")
          + (c.kind === "ghost" ? " atlas-ghost" : "")
          + (c.kind === "mirror" ? " atlas-mirror" : ""),
        transform: "translate(" + pos.x.toFixed(1) + "," + pos.y.toFixed(1) + ")",
      });
      if (c.iid) {
        g.setAttribute("data-pid", c.iid);
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "-1");
        g.setAttribute("aria-label", c.title);
        if (c.iid === ctx.selection) g.classList.add("atlas-sel");
        if (c.iid === ctx.root) g.classList.add("atlas-root");
      }
      g.setAttribute("data-gen", String(c.gen));
      g.setAttribute("data-ring", String(c.gen));
      const t = svgEl("title", {});
      t.textContent = c.title || "";
      g.appendChild(t);
      const r = Math.max(9, pos.r * (c.kind === "ghost" ? 0.42 : c.kind === "mirror" ? 0.5 : 1));
      if (scene.view === "fractal") {
        g.appendChild(svgEl("polygon", { points: hexPoints(0, 0, r), class: "atlas-hex",
          "pointer-events": c.kind === "ghost" ? "all" : undefined }));
      } else {
        // a ghost's box is unfilled — say pointer-events:all or hit-testing
        // (visiblePainted) would never reach it and clicks would fall through
        g.appendChild(svgEl("rect", { x: -r, y: -r * 0.72, width: r * 2, height: r * 1.44, rx: 10, class: "atlas-box",
          "pointer-events": c.kind === "ghost" ? "all" : undefined }));
        if (c.role && c.role !== "self" && (c.kind === "person" || c.kind === "ghost")) {
          // connector in the links layer, absolute world coords
          // (slot arithmetic keeps the child honest)
          const parentSlot = c.slot % 2 === 0 ? c.slot / 2 : (c.slot - 1) / 2;
          const rowLen = Math.pow(2, c.gen - 1);
          const childX = (parentSlot - (rowLen - 1) / 2) * CELL;
          const childY = (c.gen - 1) * CELL * 1.35;
          linksG.appendChild(svgEl("path", {
            d: "M" + childX.toFixed(0) + "," + (childY + 34).toFixed(0) + " L" + pos.x.toFixed(0) + "," + (pos.y - r * 0.72).toFixed(0),
            class: "atlas-link",
          }));
        }
      }
      if (c.kind !== "ghost" && c.iid) {
        const label = svgEl("text", { class: "atlas-label", y: c.kind === "mirror" ? 4 : -2, "text-anchor": "middle" });
        label.textContent = c.living ? "Living" : shortName(c.name, c.kind === "mirror");
        g.appendChild(label);
        if (c.kind !== "mirror") {
          const yr = svgEl("text", { class: "atlas-year", y: 14, "text-anchor": "middle" });
          yr.textContent = c.year || "";
          g.appendChild(yr);
        }
        if (c.kind === "mirror") {
          const m = svgEl("text", { class: "atlas-mirrormark", y: 16, "text-anchor": "middle" });
          m.textContent = "⊙";
          g.appendChild(m);
        }
      } else if (c.kind === "ghost") {
        const q = svgEl("text", { class: "atlas-ghostmark", y: 4, "text-anchor": "middle" });
        q.textContent = "◌";
        g.appendChild(q);
      }
      g.addEventListener("click", (ev) => {
        if (dragMoved) return;
        ev.stopPropagation();
        if (c.kind === "ghost") {
          // click-through to the child that carries the unpublished reference
          const childSlot = Math.floor(c.slot / 2);
          const childCell = scene.cells.find((s) => s.gen === c.gen - 1 && s.slot === childSlot);
          mount.dispatchEvent(new CustomEvent("atlas-ghost", {
            detail: { child: childCell ? childCell.iid : null, gen: c.gen, slot: c.slot, ghosts: c.ghosts || 1 },
          }));
          return;
        }
        if (c.iid) core.select(c.iid);
      });
      g.addEventListener("dblclick", (ev) => {
        if (dragMoved) return;
        ev.stopPropagation();
        if (c.iid) core.reroot(c.iid);
      });
      pan.appendChild(g);
    }
    applyTransform();
  }
  function shortName(n, tight) {
    const s = String(n || "");
    return tight ? s.split(" ")[0] : s.length > 18 ? s.slice(0, 17) + "…" : s;
  }
  function applyTransform() {
    core.setTransform(transform);
    // center-anchored world: the root (0,0) sits at the STAGE CENTER, pan/zoom
    // offsets from there — without the anchor the pedigree hangs off-canvas
    const rect = stage.getBoundingClientRect();
    pan.setAttribute("transform", "translate(" + (rect.width / 2 + transform.x).toFixed(1) + "," + (rect.height / 2 + transform.y).toFixed(1) + ") scale(" + transform.k + ")");
    const lod = lodFor(transform.k);
    world.classList.remove("lod-far", "lod-mid", "lod-near");
    world.classList.add("lod-" + lod);
    world.setAttribute("data-lod", lod);
  }

  // pointer: pan + pinch + wheel zoom-to-cursor; a drag NEVER selects.
  // No setPointerCapture — capture retargets the click to the stage and the
  // cell handlers would never fire; window-level move/up tracking instead.
  let dragMoved = false;
  const pointers = new Map();
  let pinchDist = 0;
  const onDown = (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = false; };
  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) zoomBy(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDist = d;
      dragMoved = true;
      return;
    }
    if (Math.hypot(dx, dy) > 5) dragMoved = true;
    if (dragMoved) { transform.x += dx; transform.y += dy; applyTransform(); }
  };
  const onUp = (e) => { pointers.delete(e.pointerId); pinchDist = 0; setTimeout(() => { dragMoved = false; }, 0); };
  const onBlur = () => { pointers.clear(); pinchDist = 0; dragMoved = false; };
  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("blur", onBlur);
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  }, { passive: false });
  function zoomBy(f, cx, cy) {
    const rect = stage.getBoundingClientRect();
    const px = cx - rect.left - rect.width / 2, py = cy - rect.top - rect.height / 2;
    const k = Math.min(4, Math.max(0.18, transform.k * f));
    transform.x = px - (px - transform.x) * (k / transform.k);
    transform.y = py - (py - transform.y) * (k / transform.k);
    transform.k = k;
    applyTransform();
  }

  // keyboard: relationship walking; R re-root on selection; B/Backspace back
  function keyNav(e) {
    if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
    const ctx = core.getContext();
    const sel = ctx.selection || ctx.root;
    if (e.key === "ArrowUp") { const p = model.parentOf(sel)[0]; if (p) core.select(p); }
    else if (e.key === "ArrowDown") { const c = model.childrenOf(sel)[0]; if (c) core.select(c); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const ps = model.parentOf(sel);
      if (ps.length) {
        const sibs = [];
        for (const p of ps) for (const c of model.childrenOf(p)) if (!sibs.includes(c)) sibs.push(c);
        const i = sibs.indexOf(sel);
        if (i >= 0) core.select(sibs[(i + (e.key === "ArrowRight" ? 1 : sibs.length - 1)) % sibs.length]);
      }
    }
    else if (e.key === "r" || e.key === "R") { if (ctx.selection) core.reroot(ctx.selection); }
    else if (e.key === "b" || e.key === "B" || (e.altKey && e.key === "ArrowLeft")) core.back();
    else if (e.key === "Home") core.home();
    else return;
    e.preventDefault();
  }
  mount.addEventListener("keydown", keyNav);
  mount.setAttribute("tabindex", "0");

  paint();
  const api = {
    model, core,
    getContext: () => core.getContext(),
    select: (iid) => core.select(iid),
    reroot: (iid) => core.reroot(iid),
    setView: (v) => core.setView(v),
    back: () => core.back(),
    home: () => core.home(),
    zoomBy: (f) => { zoomBy(f, 0, 0); },
    resetView: () => { transform = core.bootTransform(); applyTransform(); },
    search: (q, cap) => search(model, q, cap),
    person: (iid) => model.person(iid),
    ghostCount: (iid) => model.ghostCount(iid),
    repaint: paint,
    destroy() {
      mount.removeEventListener("keydown", keyNav);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
      mount.classList.remove("atlas-root");
      mount.removeAttribute("tabindex");
      stage.remove();
    },
  };
  mount.dispatchEvent(new CustomEvent("atlas-ready", { detail: { version: ATLAS_VERSION } }));
  return api;
}
