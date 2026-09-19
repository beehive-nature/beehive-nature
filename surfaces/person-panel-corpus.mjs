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
                                      computed SEPARATELY so both can coexist)
   archive.genContext(id, rootId)   → frozen {rel:'self'|'above'|'below'|'off', depth}
   archive.coupleOf(aId, bId)       → true when the corpus couples map joins them
   archive.frontierTotal()          → number of unpublished parent refs (counts only)

   ARCHIVE 1.1 SEAM — THE QUARANTINE LAW
   ─────────────────
   relationship() below is the TEMPORARY pre-Archive-1.1 implementation:
   parent-edge BFS (cycle-safe, shortest way around the corpus's cyclic
   components) plus spouse hops for affinity. When Archive 1.1's corrected
   relationshipPath lands, THIS ONE FUNCTION is replaced; the panel and the
   tests consume only the Relationship shape and never re-derive paths. The
   temporary selected→root direction handling lives here and nowhere else.

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

function birthYear (lifespan) {
  const m = String(lifespan || '').match(/^(\d{3,4})/);
  return m ? parseInt(m[1], 10) : null;
}

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

export function buildArchive ({ corpus, overlay, packs }) {
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

  /* persons that sit inside a cycle of the parent graph (the medieval web
   * loops; e.g. Emma de Bois-l'Evêque's record appears as an ancestor of her
   * own son's record). Membership = strongly connected components of size > 1
   * (or a self parent-edge) — iterative Tarjan, no recursion (chains run 60+). */
  const inCycle = new Set();
  {
    const nodes = Object.keys(persons);
    const index = new Map(), low = new Map(), onstk = new Set(), stk = [];
    let counter = 0;
    for (const root of nodes) {
      if (index.has(root)) continue;
      const work = [[root, 0]];
      while (work.length) {
        const f = work[work.length - 1];
        const v = f[0];
        if (f[1] === 0) { index.set(v, counter); low.set(v, counter); counter++; stk.push(v); onstk.add(v); }
        const es = (edges[v] || []).filter(x => persons[x]);
        let advanced = false;
        while (f[1] < es.length) {
          const w = es[f[1]++];
          if (!index.has(w)) { work.push([w, 0]); advanced = true; break; }
          else if (onstk.has(w)) { low.set(v, Math.min(low.get(v), index.get(w))); }
        }
        if (advanced) continue;
        if (low.get(v) === index.get(v)) {
          const comp = [];
          for (;;) {
            const w = stk.pop(); onstk.delete(w); comp.push(w);
            if (w === v) break;
          }
          if (comp.length > 1) for (const w of comp) inCycle.add(w);
        }
        work.pop();
        if (work.length) {
          const parentFrame = work[work.length - 1];
          low.set(parentFrame[0], Math.min(low.get(parentFrame[0]), low.get(v)));
        }
      }
    }
    /* self parent-edge = a cycle of one */
    for (const c of Object.keys(edges)) for (const p of edges[c]) if (p === c) inCycle.add(c);
  }

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

  /* reconstruct from → … → to as up-hops (to must be an ancestor of from in m) */
  function chainUpReal (m, from, to) {
    /* walk prev links from `to` back to `from`, emitting hops child→parent */
    const seq = [];
    let cur = to;
    while (cur !== from) {
      const rec = m.get(cur);
      if (!rec || rec.prev == null) return null; /* not connected — never invent */
      seq.push(cur);
      cur = rec.prev;
    }
    seq.reverse(); /* nearest-to-root … person-end */
    const hops = [];
    let child = from;
    for (const node of seq) {
      hops.push({ to: node, dir: 'up', label: upLabel(persons[node] && persons[node].gender), evidence: edgeEvidence(child, node) });
      child = node;
    }
    return hops;
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

  /* ── relationship(a, b) — TEMPORARY PRE-ARCHIVE-1.1 IMPLEMENTATION ──────
   * parent-edge BFS + spouse hops; cycle-safe (visited sets); the shortest
   * way around cyclic components. Replaced whole by Archive 1.1's corrected
   * relationshipPath — the panel never re-derives any of this. */
  function relationship (aId, bId) {
    if (!persons[aId] || !persons[bId]) {
      return deepFreeze({ a: aId, b: bId, kind: 'none', blood: null, affinity: null, cyclic: false, note: 'unknown person' });
    }
    if (aId === bId) {
      return deepFreeze({ a: aId, b: bId, kind: 'self', blood: null, affinity: null, cyclic: false, note: null });
    }

    const upB = upMap(bId); /* ancestors of b (b = the standing root) */
    const upA = upMap(aId);

    let blood = null;
    let cyclic = false;

    if (upB.has(aId)) {
      /* a is an ancestor of b — the line itself is the relationship; the
       * common ancestor is the ancestor ENDPOINT, stated as an endpoint */
      const hops = chainUpReal(upB, bId, aId) || [];
      cyclic = hops.some(h => inCycle.has(h.to));
      blood = { mode: 'ancestor-of-root', commonAncestor: aId, commonAncestorIsEndpoint: true, hopsFromRoot: hops, hopsFromPerson: [] };
    } else if (upA.has(bId)) {
      /* b is an ancestor of a — hops run root → down → person; each down-hop
       * is labeled by the CHILD's gender (son/daughter/child). The prev chain
       * points childward, so walk it from the ancestor b DOWN to person a. */
      const seq = [];
      let cur = bId;
      while (cur !== aId) {
        const rec = upA.get(cur);
        if (!rec || rec.prev == null) break; /* not connected — never invent */
        seq.push(cur);
        cur = rec.prev;
      }
      seq.push(aId); /* [b, …, a] in root→person order */
      const dhops = [];
      for (let i = 0; i + 1 < seq.length; i++) {
        dhops.push({
          to: seq[i + 1], dir: 'down',
          label: downLabel(persons[seq[i + 1]] && persons[seq[i + 1]].gender),
          evidence: edgeEvidence(seq[i + 1], seq[i])
        });
      }
      cyclic = dhops.some(h => inCycle.has(h.to));
      blood = { mode: 'descendant-of-root', commonAncestor: bId, commonAncestorIsEndpoint: true, hopsFromRoot: dhops, hopsFromPerson: [] };
    } else {
      /* shared ancestor: meet at the minimal-total-depth common node */
      let meet = null, best = Infinity;
      const byDepth = [...upA.entries()].sort((x, y) => x[1].depth - y[1].depth);
      for (const [id, rec] of byDepth) {
        if (!upB.has(id)) continue;
        const tot = rec.depth + upB.get(id).depth;
        if (tot < best) { best = tot; meet = id; }
      }
      if (meet) {
        const hopsR = chainUpReal(upB, bId, meet) || [];
        const hopsP = chainUpReal(upA, aId, meet) || [];
        cyclic = hopsR.some(h => inCycle.has(h.to)) || hopsP.some(h => inCycle.has(h.to));
        blood = { mode: 'cousin-line', commonAncestor: meet, commonAncestorIsEndpoint: false, hopsFromRoot: hopsR, hopsFromPerson: hopsP };
      }
    }

    /* affinity — marriage, never blood. Direct spouse first; when no blood
     * exists, one spouse hop onto the line makes an affinity-only path.
     * When blood ALSO exists for a direct-spouse pair (married cousins) both
     * are carried — kind 'blood-and-affinity'. */
    let affinity = null;
    if ((spousesOf[aId] || []).indexOf(bId) >= 0) {
      affinity = { hopsFromRoot: [{ to: aId, dir: 'spouse', label: 'spouse ⚭', evidence: 'corpus couples map — affinity, never blood' }] };
    } else if (!blood) {
      const seen = new Set([bId]);
      const q = [{ id: bId, hops: [] }];
      let found = null;
      while (q.length && !found) {
        const f = q.shift();
        if (f.hops.length > 30 || seen.size > 40000) break;
        for (const p of (edges[f.id] || [])) {
          if (!persons[p] || seen.has(p)) continue;
          seen.add(p);
          const hops = f.hops.concat([{ to: p, dir: 'up', label: upLabel(persons[p] && persons[p].gender), evidence: edgeEvidence(f.id, p) }]);
          if (p === aId) { found = hops; break; }
          q.push({ id: p, hops });
        }
        if (found) break;
        for (const s of (spousesOf[f.id] || [])) {
          if (!persons[s] || seen.has(s)) continue;
          seen.add(s);
          const hops = f.hops.concat([{ to: s, dir: 'spouse', label: 'spouse ⚭', evidence: 'corpus couples map — affinity, never blood' }]);
          if (s === aId) { found = hops; break; }
          q.push({ id: s, hops });
        }
      }
      if (found) affinity = { hopsFromRoot: found };
    }

    let kind, note = null;
    if (blood && affinity) kind = 'blood-and-affinity';
    else if (blood) kind = blood.mode === 'cousin-line' ? 'shared' : 'direct';
    else if (affinity) kind = 'affinity';
    else {
      kind = 'none';
      note = 'no shared line within the published archive — a different branch, or the connection rides beyond the published frontier (coverage of the walk, not a finding about anyone)';
    }

    return deepFreeze({ a: aId, b: bId, kind, blood, affinity, cyclic, note });
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
    /* deepest published line from the corpus root (the archive's own anchor) */
    const anchor = corpus.root || rootId || allIds[0];
    const up = upMap(anchor);
    let deepId = null, deepD = -1;
    for (const [id, rec] of up) { if (rec.depth > deepD) { deepD = rec.depth; deepId = id; } }
    /* pedigree collapse from the same anchor */
    const ped = pedigreeOccurrences(anchor, 12);
    const repeaters = Object.keys(ped.occurrences)
      .filter(id => ped.occurrences[id] > 1)
      .sort((a, b) => (ped.occurrences[b] - ped.occurrences[a]) || ((birthYear(persons[a].lifespan) || 9999) - (birthYear(persons[b].lifespan) || 9999)) || (a < b ? -1 : 1));
    const cc = cousinCouples();
    const cycleMembers = [...inCycle].sort();
    const ambiguous = [...nameBuckets.entries()].filter(e => e[1].length > 1);
    const topName = ambiguous.slice().sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))[0] || null;
    let terminus = null;
    for (let i = spineArr.length - 1; i >= 0; i--) { if (spineArr[i].f) { terminus = spineArr[i].f; break; } }
    const stop = rootId ? entranceStop(rootId) : null;
    discMemo = deepFreeze({
      rootId: rootId || null,
      personsCount: allIds.length,
      spine: { gens: spineArr.length, terminus: terminus },
      deepest: { id: deepId, depth: deepD, from: anchor },
      collapse: { gens: ped.gens, repeaters: repeaters.length, top: repeaters[0] ? { id: repeaters[0], n: ped.occurrences[repeaters[0]] } : null },
      cousins: { count: cc.count, bound: cc.bound, exemplar: cc.exemplar },
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
    relationship, /* TEMPORARY pre-Archive-1.1 — see the seam note above */
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
export async function fetchArchive (base) {
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
  return { archive: buildArchive({ corpus, overlay, packs }), corpus, overlay, packs };
}
