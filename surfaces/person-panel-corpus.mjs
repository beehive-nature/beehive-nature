/* person-panel-corpus.mjs — the corpus→archive ADAPTER for the GUX-01
   person panel (zGenePerson seat, 2026-09-18).
   Base pin: lane/zcode-lineage-import @ 97f18945 (same as zGeneAtlas/zGeneUI).

   WHAT THIS FILE IS
   ─────────────────
   The person panel (surfaces/person-panel.mjs) consumes an `archive` object
   through a small read-only interface. This adapter builds that archive from
   the committed PUBLIC lineage corpus (assets/profile-archive/lineage/) plus
   the attested overlays and evidence packs — the same truth surfaces/blood.html
   loads, consumed read-only.

   THE ARCHIVE INTERFACE (the zGeneUI mount contract, mirrored in the panel)
   ─────────────────
   archive.getPerson(id)            → frozen PersonView | null
   archive.resolve(query)           → {status:'hit', person}
                                     | {status:'ambiguous', query, exact:boolean, candidates:[PersonView]}
                                     | {status:'null', query}
                                      (never a silent choice among same-name people)
   archive.search(query, cap)       → frozen [{person, exact:boolean}] (cap default 12)
   archive.relationship(aId, bId)   → frozen Relationship (endpoints + common
                                      ancestor + labeled hops; blood and affinity
                                      carried SEPARATELY so both can coexist)
   archive.genContext(id, rootId)   → frozen {rel:'self'|'above'|'below'|'off', depth}
   archive.coupleOf(aId, bId)       → true when the corpus couples map joins them
   archive.frontierTotal()          → number of unpublished parent refs (counts only)

   ARCHIVE 1.1 RESOLVER LAW (Rule A, founder ruling 2026-09-19)
   ................................................................
   relationship() below DELEGATES to the composed archive core
   (surfaces/archive-core.mjs - one resolver, two environments). The
   pre-1.1 parent-edge BFS it carried is REPLACED WHOLE: no path, kind,
   apex, cycle, or spouse facet is derived here. The adapter maps the
   canonical shape onto the panel's frozen Relationship vocabulary
   (kinds, blood.mode, hop labels/evidence) and renders; married cousins
   classify blood-and-affinity because the core's spouse facet says so -
   never a second composition. Cycles come from the core's
   cyclicAncestryOf (the adapter's own Tarjan is dead). The selected
   root direction handling lives here and nowhere else.

   LAWS ENCODED HERE
   ─────────────────
   - no mutation of archive-returned objects: every PersonView and
     Relationship is deep-frozen; the input corpus JSON is never written to
     (views are fresh projections, not the corpus rows).
   - no living/private leakage: living persons carry refs:[], no record URL,
     and keep their pseudonymized ids; ghost-frontier parent refs surface as
     COUNTS ONLY, never as raw provider strings.
   - era ≠ support: the evidence era label and the per-claim support verdict
     are carried as separate fields and never derived from each other.
   - citations connect claims to evidence; support is assessed per claim:
     a source on a tradition claim is rendered as the connection it is — a
     citation count is never a confidence verdict.
 */

/* Archive 1.1 (Rule A, founder ruling 2026-09-19): the ONE resolver is
   composed verbatim from the organ tip (bFUzZ, bfuzz/gux01-archive-graph)
   and mounted inside buildArchive on this adapter's own merged tables. */
import { createArchiveCore } from './archive-core.mjs';
import { birthYear } from '../tools/genealogy/lifespan.mjs';

/* ── tiny utils ─────────────────────────────────────────────────────────── */

function deepFreeze (v) {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) deepFreeze(v[k]);
    Object.freeze(v);
  }
  return v;
}

function normName (s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/* the one signed year reader (BC negative, 1-4 digit years): tools/genealogy/lifespan.mjs */

function escapeRe (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* hop label from child → parent by the parent's recorded gender;
 * an uncertain role stays uncertain — never decided by array order.
 * The corpus carries both 'MALE'/'FEMALE' and stray 'M'/'F' forms. */
export function upLabel (parentGender) {
  if (parentGender === 'F' || parentGender === 'FEMALE') return 'mother';
  if (parentGender === 'M' || parentGender === 'MALE') return 'father';
  return 'parent';
}

/* hop label from parent → child by the child's recorded gender */
export function downLabel (childGender) {
  if (childGender === 'F' || childGender === 'FEMALE') return 'daughter';
  if (childGender === 'M' || childGender === 'MALE') return 'son';
  return 'child';
}

/* testimony attaches to a person when the entry's subject line and the
 * person's name share a surname token (the incumbent's Rockwood law,
 * generalized without inventing new attachments) */
function testimonyAttaches (subject, name) {
  const sw = normName(subject).split(' ').filter(w => w.length > 2);
  const nw = normName(name).split(' ');
  return sw.some(w => nw.indexOf(w) >= 0);
}

/* ── the builder: (corpus, overlay, packs) → archive ────────────────────── */
/* corpus  — parsed remington-bloodline.json (skaists.lineage/2)
 * overlay — parsed attested-overlays.json (skaists.lineage-overlay/1), may be null
 * packs   — { 'evidence/ragnar-lodbrok.json': parsedPack, ... } (skaists.evidence/1)
 * All three are consumed READ-ONLY; nothing in them is modified or frozen. */

export function buildArchive ({ corpus, overlay, packs, broader }) {
  if (!corpus || !corpus.persons) throw new Error('buildArchive: corpus.persons missing');

  /* merged copies — the corpus object itself is never touched */
  const persons = Object.assign({}, corpus.persons);
  const edges = Object.assign({}, corpus.edges || {});
  const children = {};
  const addChild = (p, c) => { (children[p] = children[p] || []).push(c); };
  for (const c of Object.keys(edges)) for (const p of edges[c]) addChild(p, c);

  const relEvidence = Object.assign({}, (overlay && overlay.relationshipEvidence) || {});
  const testimony = (overlay && overlay.testimony) || [];
  const symbolicLinks = (overlay && overlay.symbolicLinks) || [];
  const moneyHistory = (overlay && overlay.moneyHistory) || { law: null, entries: [] };
  const packIndex = Object.assign({}, (corpus.meta && corpus.meta.packs) || {});

  if (overlay && overlay.persons) {
    for (const id of Object.keys(overlay.persons)) {
      persons[id] = overlay.persons[id];
      if (overlay.persons[id].evidencePack) packIndex[id] = overlay.persons[id].evidencePack;
    }
  }
  const overlayEdgeChildren = new Set(overlay && overlay.edges ? Object.keys(overlay.edges) : []);
  if (overlay && overlay.edges) {
    /* overlay edges may cite parents by PROVIDER fsid (e.g. Ragnar M8WZ-XZY);
     * resolve through the corpus refsIndex to internal ids so the walked
     * person is the parent — an unresolved ref stays absent (never invented) */
    const refsIndex = corpus.refsIndex || {};
    for (const ce of Object.keys(overlay.edges)) {
      edges[ce] = overlay.edges[ce].map(p => (persons[p] ? p : (refsIndex[p] || p)));
      for (const p of edges[ce]) addChild(p, ce);
    }
  }

  /* couples map → spouse adjacency (affinity — marriage, never blood) */
  const spousesOf = {};
  const couples = corpus.couples || {};
  const coupleKeys = new Set();
  for (const k of Object.keys(couples)) {
    const c = couples[k];
    spousesOf[c.p1] = spousesOf[c.p1] || [];
    spousesOf[c.p1].push(c.p2);
    spousesOf[c.p2] = spousesOf[c.p2] || [];
    spousesOf[c.p2].push(c.p1);
    coupleKeys.add(c.p1 + '|' + c.p2);
    coupleKeys.add(c.p2 + '|' + c.p1);
  }

  /* DESCENDANT-SIDE FRONTIER (contract v1.3, optional input): `broader` maps
   * personId → { spousesTotal, childrenTotal, attribution } — KNOWN family
   * breadth beyond the walked line (family testimony, cited biography…).
   * The adapter only CARRIES these attributed numbers; it never derives or
   * invents them, and the corpus/overlay files themselves are untouched —
   * the canonical home for this data is the zBlood attested-overlays lane;
   * hosts may stage it here until that lane records it. */
  const broaderMap = broader || {};

  const spineIds = new Set();
  for (const r of (corpus.spine || [])) if (r.f) spineIds.add(r.f);
  const retrieved = (corpus.meta && corpus.meta.retrieved) || null;

  /* ghost frontier: parent refs with no published person — COUNTS ONLY
   * (the raw provider strings never enter a view; adapter law) */
  let frontierTotal = 0;
  const ghostCount = {};
  for (const c of Object.keys(edges)) {
    let n = 0;
    for (const p of edges[c]) if (!persons[p]) n++;
    if (n) { ghostCount[c] = n; frontierTotal += n; }
  }

  /* ARCHIVE 1.1 (Rule A): the ONE resolver, mounted once on this
   * adapter's own merged tables - after the overlay merge (the 20d5c74a
   * lesson), same truth blood.html boots. The core derives paths, kinds,
   * apexes, cycle membership, and the married-cousin spouse facet; this
   * adapter renders. G4: cyclicAncestryOf is the only cycle authority -
   * the second Tarjan that lived here is dead. */
  const core = createArchiveCore({ persons, edges, couples, refsIndex: corpus.refsIndex, root: corpus.root });
  const inCyclicAncestry = (id) => core.cyclicAncestryOf(id) != null;
  let _cyclicMembers = null;
  const cyclicMembers = () => (_cyclicMembers ??= Object.keys(persons).filter(inCyclicAncestry).sort());

  /* upward BFS map: id → {depth, prev(childId)} — cycle-safe by visited set */
  const upCache = new Map();
  function upMap (id) {
    if (upCache.has(id)) return upCache.get(id);
    const m = new Map([[id, { depth: 0, prev: null }]]);
    const q = [id];
    while (q.length) {
      const c = q.shift();
      const d = m.get(c).depth;
      for (const p of (edges[c] || [])) {
        if (!persons[p] || m.has(p)) continue;
        m.set(p, { depth: d + 1, prev: c });
        q.push(p);
      }
    }
    if (upCache.size > 48) upCache.clear(); /* bounded; corpus is immutable so any entry stays valid */
    upCache.set(id, m);
    return m;
  }

  function edgeEvidence (child, parent) {
    if (relEvidence[child + '|' + parent]) return 'disputed — inspect';
    if (overlayEdgeChildren.has(child)) return 'overlay — tradition-carried';
    return 'walked provider link';
  }

  /* ── PersonView projection (frozen; never the corpus row) ─────────────── */
  const viewCache = new Map();
  function personView (id) {
    const p = persons[id];
    if (!p) return null;
    if (viewCache.has(id)) return viewCache.get(id);

    const fsRef = (p.refs || []).find(r => r.provider === 'familysearch') || null;
    const living = !!(p.living);

    const pack = packIndex[id] || null;
    const packData = pack ? (packs ? packs[pack] : null) : null;
    const byr = birthYear(p.lifespan);
    let impossibleChronology = false;
    for (const par of (edges[id] || [])) {
      const pb = persons[par] ? birthYear(persons[par].lifespan) : null;
      if (byr != null && pb != null && pb >= byr) impossibleChronology = true;
    }

    const view = {
      id,
      name: p.name || id,
      lifespan: p.lifespan || null,
      gender: p.gender || null,
      living,
      tier: (p.evidence && p.evidence.class) || 'unrecorded',
      era: (p.evidence && p.evidence.era) || null,               /* era ≠ support — */
      support: (p.evidence && p.evidence.support) || 'unsourced-entry', /* — never derived one from the other */
      supportBasis: (p.evidence && p.evidence.basis) || null,
      onSpine: spineIds.has(id),
      isCorpusRoot: id === (corpus.root || null),
      inCycle: inCyclicAncestry(id),
      /* descendant-side frontier — attributed known breadth, carried only */
      broaderFamily: broaderMap[id]
        ? {
            spousesTotal: broaderMap[id].spousesTotal,
            childrenTotal: broaderMap[id].childrenTotal,
            attribution: broaderMap[id].attribution || 'attributed family knowledge — staged via the archive host'
          }
        : null,
      refs: living ? [] : (p.refs || []).slice(),
      corrected: p.corrected ? { attested: p.corrected.attested || '', note: p.corrected.note || '' } : null,
      overlay: /^ovl-/.test(id),
      parents: (edges[id] || []).filter(x => persons[x]).map(x => ({ id: x, evidence: edgeEvidence(id, x) })),
      children: (children[id] || []).filter(x => persons[x]),
      spouses: (spousesOf[id] || []).filter(x => persons[x]),
      ghostParents: ghostCount[id] || 0,
      impossibleChronology,
      bnr: 'bnr://skaists.dev/blood/' + id,
      layers: {
        records: (!living && fsRef)
          ? {
              provider: 'familysearch',
              recordUrl: 'https://www.familysearch.org/tree/person/details/' + fsRef.id,
              providerRef: fsRef.id,
              retrieved
            }
          : null,
        correction: p.corrected ? { attested: p.corrected.attested || '', note: p.corrected.note || '' } : null,
        tradition: (packData && packData.claims)
          ? {
              attribution: packData.person ? ((packData.person.tier || 'evidence pack') + ' — ' + (packData.person.tierBasis || 'tier basis carried from the pack')) : 'evidence pack',
              claims: packData.claims.map(c => ({ claim: c.claim, source: c.source, url: c.url || null }))
            }
          : null,
        testimony: testimony.filter(t => t.lens === 'testimony' && t.text && testimonyAttaches(t.subject, p.name)).map(t => ({
          id: t.id, author: t.author, text: t.text, status: t.status || null,
          moneyOverlay: (moneyHistory.entries || []).some(e => e.ref === t.id)
        })),
        spiritual: testimony.filter(t => t.lens === 'spiritual').map(t => ({
          id: t.id, author: t.author, text: t.text || null, status: t.status || null
        })),
        meaning: symbolicLinks.filter(sl => (sl.connects || []).indexOf(id) >= 0).map(sl => ({
          id: sl.id, symbol: sl.symbol, meaning: sl.meaning, attribution: sl.attribution
        }))
      }
    };
    deepFreeze(view);
    viewCache.set(id, view);
    return view;
  }

  /* ── resolve / search — the three lawful outcomes, no silent choice ───── */
  const allIds = Object.keys(persons);
  function matches (q) {
    const exact = [];
    const partial = [];
    for (const id of allIds) {
      const n = normName(persons[id].name);
      if (!n) continue;
      if (n === q) exact.push(id);
      else if (q && n.indexOf(q) >= 0) partial.push(id);
    }
    return { exact, partial };
  }

  function resolve (query) {
    const q = normName(query);
    if (!q) return deepFreeze({ status: 'null', query: String(query == null ? '' : query) });
    const { exact, partial } = matches(q);
    if (exact.length === 1) return deepFreeze({ status: 'hit', person: personView(exact[0]) });
    if (exact.length > 1) {
      return deepFreeze({ status: 'ambiguous', query: String(query), exact: true, candidates: exact.map(personView) });
    }
    if (partial.length > 0) {
      return deepFreeze({ status: 'ambiguous', query: String(query), exact: false, candidates: partial.map(personView) });
    }
    return deepFreeze({ status: 'null', query: String(query) });
  }

  function search (query, cap) {
    const c = cap == null ? 12 : cap;
    const q = normName(query);
    if (!q) return [];
    const { exact, partial } = matches(q);
    const seen = new Set();
    const out = [];
    for (const id of exact) { if (!seen.has(id) && out.length < c) { seen.add(id); out.push({ person: personView(id), exact: true }); } }
    for (const id of partial) { if (!seen.has(id) && out.length < c) { seen.add(id); out.push({ person: personView(id), exact: false }); } }
    return Object.freeze(out);
  }

  /* generation position relative to a focus person — for distinguishing
   * same-name candidates honestly ("N generations above the current root") */
  function genContext (id, rootId) {
    if (id === rootId) return deepFreeze({ rel: 'self', depth: 0 });
    const upR = upMap(rootId);
    if (upR.has(id)) return deepFreeze({ rel: 'above', depth: upR.get(id).depth });
    const upI = upMap(id);
    if (upI.has(rootId)) return deepFreeze({ rel: 'below', depth: upI.get(rootId).depth });
    return deepFreeze({ rel: 'off', depth: null });
  }

  /* relationship(a, b) - ARCHIVE 1.1: the ONE resolver, rendered only.
   * a = the person, b = the standing root. The core derives; this maps
   * the canonical shape onto the panel's frozen Relationship vocabulary
   * and never re-derives a path, kind, apex, cycle, or spouse facet. */
  function relationship (aId, bId) {
    if (!persons[aId] || !persons[bId]) {
      return deepFreeze({ a: aId, b: bId, kind: 'none', blood: null, affinity: null, cyclic: false, note: 'unknown person' });
    }
    if (aId === bId) {
      return deepFreeze({ a: aId, b: bId, kind: 'self', blood: null, affinity: null, cyclic: false, note: null });
    }

    const c = core.relationshipPath(aId, bId);
    const genderOf = (id) => (persons[id] && persons[id].gender) || null;
    const spouseHop = (to) => ({ to, dir: 'spouse', label: 'spouse ⚭', evidence: 'corpus couples map — affinity, never blood' });
    const cyclicOnPath = (path) => path.some((s) => inCyclicAncestry(s.id));

    if (c.kind === 'blood' || c.kind === 'blood-and-affinity') {
      /* core path: a -> (up-hops) -> apex -> (down-hops) -> b */
      const path = c.path;
      const apex = c.commonAncestor;
      const k = path.findIndex((s) => s.id === apex);
      const mode = apex === aId ? 'ancestor-of-root' : (apex === bId ? 'descendant-of-root' : 'cousin-line');
      let hopsFromRoot = [], hopsFromPerson = [];
      if (mode === 'ancestor-of-root') {
        /* a IS an ancestor of the root: the chain runs root -> a, up-hops */
        for (let i = path.length - 1; i >= 1; i--) {
          hopsFromRoot.push({ to: path[i - 1].id, dir: 'up', label: upLabel(genderOf(path[i - 1].id)), evidence: edgeEvidence(path[i].id, path[i - 1].id) });
        }
      } else if (mode === 'descendant-of-root') {
        /* the root IS an ancestor of a: the chain runs root -> a, down-hops */
        for (let i = k - 1; i >= 0; i--) {
          hopsFromRoot.push({ to: path[i].id, dir: 'down', label: downLabel(genderOf(path[i].id)), evidence: edgeEvidence(path[i].id, path[i + 1].id) });
        }
      } else {
        /* cousin line: both sides climb to the NAMED common ancestor */
        for (let i = 1; i <= k; i++) {
          hopsFromPerson.push({ to: path[i].id, dir: 'up', label: upLabel(genderOf(path[i].id)), evidence: edgeEvidence(path[i - 1].id, path[i].id) });
        }
        for (let i = path.length - 1; i >= k + 1; i--) {
          hopsFromRoot.push({ to: path[i - 1].id, dir: 'up', label: upLabel(genderOf(path[i - 1].id)), evidence: edgeEvidence(path[i].id, path[i - 1].id) });
        }
      }
      const blood = { mode, commonAncestor: apex, commonAncestorIsEndpoint: mode !== 'cousin-line', hopsFromRoot, hopsFromPerson };
      const kind = c.kind === 'blood-and-affinity' ? 'blood-and-affinity' : (mode === 'cousin-line' ? 'shared' : 'direct');
      /* Rule A: the core's spouse facet carries the marriage truth; the
       * panel renders its existing direct-spouse hop - no recomposition */
      const affinity = c.kind === 'blood-and-affinity' ? { hopsFromRoot: [spouseHop(aId)] } : null;
      return deepFreeze({ a: aId, b: bId, kind, blood, affinity, cyclic: cyclicOnPath(path), note: null });
    }

    if (c.kind === 'affinity') {
      /* core path a -> b (parent/child/spouse steps); the panel renders
       * hopsFromRoot starting AT the standing root - walk it reversed */
      const hops = [];
      for (let i = c.path.length - 1; i >= 1; i--) {
        const from = c.path[i - 1].id, to = c.path[i].id, via = c.path[i].via;
        if (via === 'spouse') hops.push(spouseHop(from));
        else if (via === 'parent') hops.push({ to: from, dir: 'down', label: downLabel(genderOf(from)), evidence: edgeEvidence(from, to) });
        else hops.push({ to: from, dir: 'up', label: upLabel(genderOf(from)), evidence: edgeEvidence(to, from) });
      }
      return deepFreeze({ a: aId, b: bId, kind: 'affinity', blood: null, affinity: { hopsFromRoot: hops }, cyclic: cyclicOnPath(c.path), note: null });
    }

    /* none: the honest bounded boundary - the panel's own wording, verbatim */
    return deepFreeze({ a: aId, b: bId, kind: 'none', blood: null, affinity: null, cyclic: false, note: 'no shared line within the published archive — a different branch, or the connection rides beyond the published frontier (coverage of the walk, not a finding about anyone)' });
  }

  function coupleOf (aId, bId) { return coupleKeys.has(aId + '|' + bId); }

  /* ── discovery hooks (OPTIONAL archive methods, contract v1.1) ───────────
   * Curiosity-first law: every hook is COMPUTED from this archive at run
   * time — counts, exemplars, and depths derive from the corpus; nothing is
   * hardcoded, nothing is invented, and each hook opens a real person or a
   * real pair. The panel degrades gracefully when an archive omits them. */

  const spineArr = corpus.spine || [];
  const spinePos = new Map();
  spineArr.forEach((r, i) => { if (r.f) spinePos.set(r.f, r.i != null ? r.i : i); });

  function spineIndex (id) { return spinePos.has(id) ? spinePos.get(id) : null; }

  /* how many published people share this exact (normalized) name */
  const nameBuckets = (() => {
    const m = new Map();
    for (const id of allIds) {
      const n = normName(persons[id].name);
      if (!n) continue;
      if (!m.has(n)) m.set(n, []);
      m.get(n).push(id);
    }
    return m;
  })();
  function nameShares (name) {
    const b = nameBuckets.get(normName(name));
    return b ? b.length : 0;
  }
  function nameHolders (name) {
    const b = nameBuckets.get(normName(name));
    return b ? b.slice() : [];
  }

  /* pedigree occurrence map: who occupies how many of the 2^gens-1 ahnentafel
   * slots of root's pedigree (bounded expansion — missing parents stay
   * empty, never invented). Pedigree collapse = occurrences > 1. */
  const pedCache = new Map();
  function pedigreeOccurrences (rootId, gens) {
    const G = gens == null ? 12 : gens;
    const key = rootId + '|' + G;
    if (pedCache.has(key)) return pedCache.get(key);
    const occ = {};
    let layer = [rootId];
    for (let g = 0; g < G; g++) {
      const next = [];
      for (const id of layer) {
        for (const p of (edges[id] || [])) {
          if (!persons[p]) continue;
          occ[p] = (occ[p] || 0) + 1;
          next.push(p);
        }
      }
      layer = next;
    }
    const out = deepFreeze({ root: rootId, gens: G, occurrences: occ });
    if (pedCache.size > 16) pedCache.clear();
    pedCache.set(key, out);
    return out;
  }

  /* bounded ancestor set for cousin detection (honest about its bound) */
  function ancBounded (id, maxDepth) {
    const m = new Set();
    const q = [[id, 0]];
    while (q.length) {
      const f = q.shift();
      if (f[1] >= maxDepth) continue;
      for (const p of (edges[f[0]] || [])) {
        if (!persons[p] || m.has(p)) continue;
        m.add(p);
        q.push([p, f[1] + 1]);
      }
    }
    return m;
  }

  let cousinMemo = null;
  function cousinCouples () {
    if (cousinMemo) return cousinMemo;
    const bound = 16;
    const hits = [];
    for (const k of Object.keys(couples)) {
      const c = couples[k];
      if (!persons[c.p1] || !persons[c.p2]) continue;
      const A = ancBounded(c.p1, bound);
      const B = ancBounded(c.p2, bound);
      if (A.has(c.p2) || B.has(c.p1)) continue; /* direct-line marriage is a different (and rarer) claim */
      let hit = false;
      for (const x of A) if (B.has(x)) { hit = true; break; }
      if (hit) hits.push({ a: c.p1, b: c.p2 });
    }
    cousinMemo = deepFreeze({ count: hits.length, bound, exemplar: hits[0] || null, pairs: hits });
    return cousinMemo;
  }

  /* climb the standing root's first-parent line to where the published
   * record stops — the frontier told as the entrance's own story */
  function entranceStop (rootId) {
    let cur = rootId, steps = 0;
    while (cur && steps < 64) {
      const ps = (edges[cur] || []).filter(x => persons[x]);
      if (!ps.length) {
        return { stopId: (edges[cur] && edges[cur].length) ? cur : cur, steps, atFrontier: !!(edges[cur] && edges[cur].length) };
      }
      cur = ps[0];
      steps++;
    }
    return null;
  }

  let discMemo = null;
  function discoveries (rootId) {
    if (discMemo && discMemo.rootId === rootId) return discMemo;
    /* v1.2 — discoveries are CONTEXTUAL to wherever the visitor stands:
     * deepest line, collapse, tier composition, and the cousin exemplar are
     * computed FROM the standing root (re-rooting teaches itself); spine,
     * cycles, frontier total, and shared names stay archive-level. */
    const anchor = rootId || corpus.root || allIds[0];
    const up = upMap(anchor);
    let deepId = null, deepD = -1, deepBirth = Infinity;
    for (const [id, rec] of up) {
      const b = birthYear(persons[id].lifespan) || 9999;
      if (rec.depth > deepD || (rec.depth === deepD && b < deepBirth)) { deepD = rec.depth; deepId = id; deepBirth = b; }
    }
    /* the epistemic descent: the tier transitions the deepest line ACTUALLY
     * walks — CONSECUTIVE dedup (a return to earlier ground is itself
     * texture), never global first-appearance, never a verdict */
    const descent = (() => {
      const seq = [];
      let cur = deepId;
      const chain = [];
      while (cur && cur !== anchor) { chain.push(cur); const r = up.get(cur); if (!r || r.prev == null) break; cur = r.prev; }
      chain.reverse();
      const push = (t) => { if (t != null && seq[seq.length - 1] !== t) seq.push(t); };
      push(persons[anchor] && persons[anchor].evidence ? persons[anchor].evidence.class : null);
      for (const id of chain) push(persons[id].evidence ? persons[id].evidence.class : null);
      return seq;
    })();
    /* tier composition of everything reachable from the standing root */
    const tierCounts = {};
    for (const id of up.keys()) {
      const t = persons[id].evidence ? persons[id].evidence.class : 'unrecorded';
      tierCounts[t] = (tierCounts[t] || 0) + 1;
    }
    const tiers = Object.keys(tierCounts).sort((a, b) => tierCounts[b] - tierCounts[a] || (a < b ? -1 : 1));
    /* pedigree collapse from the standing root */
    const ped = pedigreeOccurrences(anchor, 12);
    const repeaters = Object.keys(ped.occurrences)
      .filter(id => ped.occurrences[id] > 1)
      .sort((a, b) => (ped.occurrences[b] - ped.occurrences[a]) || ((birthYear(persons[a].lifespan) || 9999) - (birthYear(persons[b].lifespan) || 9999)) || (a < b ? -1 : 1));
    /* the cousin exemplar must live in THIS root's family (both members
     * ancestors of the standing root) — or the hook honestly hides */
    const cc = cousinCouples();
    let rootExemplar = null;
    for (const pair of cc.pairs) {
      if (up.has(pair.a) && up.has(pair.b)) { rootExemplar = pair; break; }
    }
    const cycleMembers = cyclicMembers();
    const ambiguous = [...nameBuckets.entries()].filter(e => e[1].length > 1);
    const topName = ambiguous.slice().sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))[0] || null;
    let terminus = null;
    for (let i = spineArr.length - 1; i >= 0; i--) { if (spineArr[i].f) { terminus = spineArr[i].f; break; } }
    const stop = rootId ? entranceStop(rootId) : null;
    discMemo = deepFreeze({
      rootId: rootId || null,
      rootIsCorpusRoot: rootId === corpus.root,
      personsCount: allIds.length,
      spine: { gens: spineArr.length, terminus: terminus },
      deepest: { id: deepId, depth: deepD, from: anchor, descent },
      tiers: { total: up.size, counts: tierCounts, order: tiers },
      collapse: { gens: ped.gens, repeaters: repeaters.length, top: repeaters[0] ? { id: repeaters[0], n: ped.occurrences[repeaters[0]] } : null },
      cousins: { count: cc.count, bound: cc.bound, exemplar: rootExemplar },
      cycles: { count: cycleMembers.length, exemplar: cycleMembers[0] || null },
      frontier: { total: frontierTotal, entrance: stop },
      ambiguousNames: { count: ambiguous.length, topName: topName ? { name: topName[0], holders: topName[1].length } : null }
    });
    return discMemo;
  }

  return Object.freeze({
    getPerson: personView,
    resolve,
    search,
    relationship, /* Archive 1.1 delegation to the ONE core - see the resolver-law note above */
    genContext,
    coupleOf,
    frontierTotal: () => frontierTotal,
    /* OPTIONAL v1.1 — curiosity hooks; panel degrades gracefully without them */
    discoveries,
    pedigreeOccurrences,
    spineIndex,
    nameShares,
    nameHolders
  });
}

/* ── browser loader — same truth blood.html loads, same-origin ──────────── */
/* base: path prefix ending in '/' that resolves to assets/profile-archive/lineage/ */
export async function fetchArchive (base, broader) {
  const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  const corpus = await j(base + 'remington-bloodline.json');
  let overlay = null;
  try { overlay = await j(base + 'attested-overlays.json'); } catch (e) { /* optional */ }
  const packs = {};
  const packPaths = new Set(Object.values((corpus.meta && corpus.meta.packs) || {}));
  if (overlay && overlay.persons) {
    for (const id of Object.keys(overlay.persons)) if (overlay.persons[id].evidencePack) packPaths.add(overlay.persons[id].evidencePack);
  }
  await Promise.all([...packPaths].map(p => j(base + p).then(d => { packs[p] = d; }).catch(() => {})));
  return { archive: buildArchive({ corpus, overlay, packs, broader }), corpus, overlay, packs };
}
