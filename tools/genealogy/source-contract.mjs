/* source-contract.mjs — AN INDEPENDENT READING OF THE PUBLISHED ARCHIVE.
 *
 * Founder order 2026-09-23 (SKAISTS CORE SPRINT 001): build an independent
 * reader from the SOURCE CONTRACT — no model.mjs, no pipeline.mjs, no #222
 * changes — and check source / claim / linking semantics offline.
 *
 * WHY A SECOND READER AT ALL. Every existing genealogy instrument is a
 * descendant of the thing it judges: model.mjs and pipeline.mjs WRITE the
 * corpus, and person-panel-corpus.mjs / archive-core.mjs are two readers the
 * agreement battery already plays against each other. Two implementations
 * agreeing is a real fact and it is not this fact. This module implements the
 * CONTRACT — the sentences the artifacts and the dispatches declare about
 * themselves — and reads the published bytes with its own code. It imports
 * nothing from the genealogy implementation; source-contract.test.mjs locks
 * that mechanically, because an import would quietly turn this file into a
 * third copy of the same reading.
 *
 * WHAT IT IS NOT. The producer writes both the artifacts and the `meta` block
 * that declares them, so a producer that is consistently wrong in both places
 * is invisible here. This module catches a declaration that disagrees with the
 * bytes, and a byte that disagrees with a law stated somewhere else. It does
 * not certify the walk.
 *
 * THE CONTRACT, quoted at its source (every clause below cites one of these):
 *
 *  [OVL] assets/profile-archive/lineage/attested-overlays.json — `purpose`:
 *      "Every overlay person MUST reference an evidence pack
 *       (assets/profile-archive/lineage/evidence/); overlay persons never
 *       inherit a better evidence class than 'saga' or 'medieval' unless their
 *       pack cites contemporary records."
 *    …and `law`:
 *      "Overlay ids use the ovl- prefix so they can never collide with provider
 *       ids. CORRECTIONS patch walked persons by provider id — a correction is a
 *       founder attestation layered OVER the provider record, never a silent
 *       edit."
 *    …and `moneyHistory.law`:
 *      "Businesses, investments, inheritance, and patronage form a SEPARATE
 *       overlay connected to people — never confused with parentage, never
 *       rendered as blood."
 *    …and `edgeNotes`: every overlay edge is annotated "parents per tradition".
 *
 *  [META] assets/profile-archive/lineage/remington-bloodline.json — `meta`:
 *      privacy · confidenceTiers · claimPolicy · packs · reconciliation ·
 *      stagedPersons. The corpus's own declaration of what it published.
 *
 *  [PACK] evidence/*.json — each pack's own `law`, e.g.
 *      "This pack ATTRIBUTES the provider record (id, retrieval date, link). It
 *       does not assert independent verification."
 *
 *  [GUX] docs/dispatches/2026-09-18-gux01-zgeneperson-person-panel.md:59 —
 *      the hop evidence vocabulary:
 *        'walked provider link' | 'disputed — inspect' | 'overlay — tradition-carried'
 *    …and its stated laws: "era ≠ support" and "citations CONNECT claims to
 *      evidence; support is assessed per claim".
 *
 *  [RM] tools/genealogy/README.md — "Provenance: `source` + `sourceId` ride
 *      every person" · "public artifacts drop the living entirely except an
 *      anonymous 'Living' root stub".
 *
 * A finding is {code, where, detail}. BASELINE COMPARISON IS ON code+where
 * ONLY: a class under repair must not turn its gate red every time the
 * population moves. `detail` carries the magnitude for the reader.
 */

/* ---- the walked-provenance tag, quoted from [GUX] and from the staged bytes.
 * The staged corpus writes the longer form; both are the same claim. */
const WALKED_TAGS = new Set(['walked provider link', 'walked provider link (fs-adapter)']);
const DISPUTED_PREFIX = 'disputed';
/* [OVL] purpose — the ceiling an overlay person may not exceed. */
const OVERLAY_CLASS_CEILING = new Set(['saga', 'medieval']);
/* [GUX] "era ≠ support": an era LABEL may never be written into the support
 * field. The era vocabulary is read from [META] confidenceTiers at run time;
 * this is the fixed part the corpus itself uses. */
const ERA_WORDS = new Set(['recorded', 'colonial', 'medieval', 'saga', 'unrecorded', 'living']);
/* [PACK] law — support words a pack claim may not assert of itself. Scoped to
 * claims[].claim only: `summary` and `law` legitimately use these words in the
 * NEGATIVE ("never presented as verification") and a scan over them would
 * report the disclaimer as the defect. */
const VERIFICATION_ASSERTION = /\b(independently\s+verified|verified|proven|proves|authenticated|certified)\b/i;
/* support values that claim a harvest happened. */
const SOURCED_SUPPORT = new Set(['sourced', 'verified', 'documented', 'record-backed']);

const CLAUSES = [
  ['SRC-PACK-UNDECLARED', '[OVL] every overlay person MUST reference an evidence pack'],
  ['SRC-PACK-MISSING', '[OVL] the referenced pack must exist'],
  ['SRC-OVERLAY-CLASS', "[OVL] an overlay person never exceeds 'saga' or 'medieval'"],
  ['SRC-PACK-NO-LAW', '[PACK] a pack states its own attribution law'],
  ['SRC-PACK-CLAIM-UNSOURCED', '[GUX] a citation CONNECTS a claim to evidence'],
  ['SRC-PACK-FSID-UNRESOLVED', '[PACK] a pack names a person the corpus published'],
  ['SRC-META-PACK-UNKNOWN', '[META] meta.packs names published persons and existing files'],
  ['SRC-NO-PROVENANCE', '[RM] source + sourceId ride every published person'],
  ['SRC-STUB-CARRIES-REFS', "[RM] the living survive only as an anonymous stub"],
  ['SRC-EDGE-OVERSTATED', '[OVL] edgeNotes — an overlay edge is carried by tradition, not walked'],
  ['CLM-VERIFICATION-LANGUAGE', '[PACK] a pack does not assert independent verification'],
  ['CLM-TIER-UNDECLARED', '[META] confidenceTiers names the classes the corpus uses'],
  ['CLM-ERA-AS-SUPPORT', '[GUX] era ≠ support'],
  ['CLM-SUPPORT-OVERSTATED', '[META] claimPolicy — support stays unsourced until harvested'],
  ['CLM-SYMBOL-UNATTRIBUTED', '[OVL] symbolism is identified as symbolism'],
  ['CLM-SYMBOL-DANGLING', '[OVL] a symbolic link connects to a person'],
  ['CLM-SYMBOL-AS-EDGE', '[OVL] symbolism is never rendered as a parent-child claim'],
  ['CLM-MONEY-AS-BLOOD', '[OVL] money history is never confused with parentage'],
  ['CLM-TESTIMONY-UNATTRIBUTED', '[OVL] testimony carries its author and its status'],
  ['CLM-DISPUTE-THIN', '[OVL] a disputed claim carries its hypotheses, contradictions and sources'],
  ['CLM-DISPUTE-UNDISCLOSED', '[GUX] a disputed hop says so where it is read'],
  ['LNK-OVERLAY-PREFIX', '[OVL] overlay ids use the ovl- prefix so they can never collide'],
  ['LNK-OVERLAY-EDGE-UNRESOLVED', '[OVL] an overlay edge endpoint resolves to a real person'],
  ['LNK-CORRECTION-UNRESOLVED', '[OVL] a correction patches a walked person by provider id'],
  ['LNK-CORRECTION-NOT-APPLIED', '[OVL] a correction is never a silent edit'],
  ['LNK-SELF-PARENT', '[META] an edge is a relation between two persons'],
  ['LNK-EDGE-ORPHAN', '[META] an edge child is a published person'],
  ['LNK-COUPLE-BROKEN', '[META] a couple names two published persons'],
  ['LNK-COUPLE-AND-EDGE', '[GUX] ⚭ hop = marriage, never blood — so a pair holding BOTH relations must render both'],
  ['LNK-RECIPROCITY', '[META] a staged parent row and its child row are the same edge'],
  ['LNK-STAGED-CORPUS-DIVERGE', '[META] stagedPersons.store holds what the corpus published'],
  ['LNK-FRONTIER-UNDISCLOSED', '[META] reconciliation accounts for what the corpus did not publish'],
  ['META-COUNT-DIVERGE', '[META] the corpus counts what it published'],
];

export const CONTRACT = CLAUSES.map(([code, sentence]) => ({ code, sentence }));
export const CLAUSE_CODES = CLAUSES.map(([code]) => code);

function nonEmpty(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

/* Read the class vocabulary out of [META] confidenceTiers rather than hard-coding
 * it: the contract is the corpus's own sentence, so the checker must parse that
 * sentence. "era heuristic (recorded ≥1850 · colonial 1550–1850 · …)" */
export function declaredTiers(confidenceTiers) {
  if (!nonEmpty(confidenceTiers)) return new Set();
  const out = new Set();
  for (const word of confidenceTiers.match(/[a-z][a-z-]+/g) || []) {
    if (ERA_WORDS.has(word)) out.add(word);
  }
  return out;
}

/**
 * checkSourceContract — pure. Nothing here touches the filesystem or the
 * network, so a caller can plant a defect in a copy and watch one clause move.
 *
 * @param corpus      parsed remington-bloodline.json
 * @param overlay     parsed attested-overlays.json
 * @param packs       { 'evidence/x.json': parsed } — every pack the artifacts name
 * @param staged      { internalId: parsed persons/<id>.json }
 * @param packExists  (path) => boolean — injected so a missing pack is testable
 * @returns {{findings: Array, inspected: Object, byCode: Object}}
 */
export function checkSourceContract({ corpus, overlay, packs = {}, staged = {}, packExists }) {
  const findings = [];
  const inspected = Object.create(null);
  for (const code of CLAUSE_CODES) inspected[code] = 0;

  const exists = typeof packExists === 'function'
    ? packExists
    : (p) => Object.prototype.hasOwnProperty.call(packs, p);

  const add = (code, where, detail) => findings.push({ code, where, detail });
  const saw = (code, n = 1) => { inspected[code] += n; };

  const persons = (corpus && corpus.persons) || {};
  const edges = (corpus && corpus.edges) || {};
  const couples = (corpus && corpus.couples) || {};
  const refsIndex = (corpus && corpus.refsIndex) || {};
  const meta = (corpus && corpus.meta) || {};
  const ovPersons = (overlay && overlay.persons) || {};
  const ovEdges = (overlay && overlay.edges) || {};

  /* resolve any endpoint token — an internal id, an overlay id, or a provider
   * id that must travel through refsIndex to become a person. */
  const resolve = (token) => {
    if (Object.prototype.hasOwnProperty.call(persons, token)) return token;
    if (Object.prototype.hasOwnProperty.call(ovPersons, token)) return token;
    const viaRef = refsIndex[token];
    if (viaRef && Object.prototype.hasOwnProperty.call(persons, viaRef)) return viaRef;
    return null;
  };

  /* ===================== SOURCE ===================== */

  for (const [id, p] of Object.entries(ovPersons)) {
    saw('SRC-PACK-UNDECLARED'); saw('SRC-OVERLAY-CLASS'); saw('LNK-OVERLAY-PREFIX');
    const pack = p && p.evidencePack;
    if (!nonEmpty(pack)) {
      add('SRC-PACK-UNDECLARED', id, 'overlay person references no evidence pack');
    } else {
      saw('SRC-PACK-MISSING');
      if (!exists(pack)) add('SRC-PACK-MISSING', id, `evidencePack ${pack} is not on disk`);
    }
    const cls = p && p.evidence && p.evidence.class;
    if (!OVERLAY_CLASS_CEILING.has(cls)) {
      add('SRC-OVERLAY-CLASS', id, `evidence.class ${JSON.stringify(cls)} exceeds the overlay ceiling`);
    }
    if (!String(id).startsWith('ovl-')) {
      add('LNK-OVERLAY-PREFIX', id, 'overlay id does not carry the ovl- prefix');
    }
  }
  for (const id of Object.keys(persons)) {
    saw('LNK-OVERLAY-PREFIX');
    if (String(id).startsWith('ovl-') && !Object.prototype.hasOwnProperty.call(ovPersons, id)) {
      add('LNK-OVERLAY-PREFIX', id, 'a walked person carries the reserved ovl- prefix');
    }
  }

  for (const [path, pack] of Object.entries(packs)) {
    saw('SRC-PACK-NO-LAW'); saw('SRC-PACK-FSID-UNRESOLVED');
    if (!nonEmpty(pack && pack.law)) add('SRC-PACK-NO-LAW', path, 'pack states no attribution law');
    const fsid = pack && pack.person && pack.person.fsid;
    if (nonEmpty(fsid) && !resolve(fsid)) {
      add('SRC-PACK-FSID-UNRESOLVED', path, `person.fsid ${fsid} resolves to nobody published`);
    }
    for (const [i, c] of ((pack && pack.claims) || []).entries()) {
      saw('SRC-PACK-CLAIM-UNSOURCED'); saw('CLM-VERIFICATION-LANGUAGE');
      if (!nonEmpty(c && c.claim) || !nonEmpty(c && c.source)) {
        add('SRC-PACK-CLAIM-UNSOURCED', `${path}#${i}`, 'a claim carries no text or no source');
      }
      const m = nonEmpty(c && c.claim) && c.claim.match(VERIFICATION_ASSERTION);
      if (m) add('CLM-VERIFICATION-LANGUAGE', `${path}#${i}`, `claim asserts ${JSON.stringify(m[0])}`);
    }
  }

  for (const [id, path] of Object.entries(meta.packs || {})) {
    saw('SRC-META-PACK-UNKNOWN');
    if (!resolve(id)) add('SRC-META-PACK-UNKNOWN', id, 'meta.packs names an unpublished person');
    else if (!exists(path)) add('SRC-META-PACK-UNKNOWN', id, `meta.packs names ${path}, which is not on disk`);
  }

  for (const [id, sp] of Object.entries(staged)) {
    const status = sp && sp.publication && sp.publication.status;
    const refs = (sp && sp.refs) || [];
    const pack = sp && sp.layers && sp.layers.tradition && sp.layers.tradition.pack;
    if (status === 'private-stub') {
      saw('SRC-STUB-CARRIES-REFS');
      if (refs.length) add('SRC-STUB-CARRIES-REFS', id, `a redacted stub carries ${refs.length} provider ref(s)`);
    } else {
      saw('SRC-NO-PROVENANCE');
      const hasRef = refs.some((r) => nonEmpty(r && r.provider) && nonEmpty(r && r.id));
      if (!hasRef && !nonEmpty(pack)) {
        add('SRC-NO-PROVENANCE', id, 'a published person carries neither a provider ref nor an evidence pack');
      }
    }
  }

  /* An overlay edge is declared by the overlay, annotated "parents per
   * tradition" in edgeNotes, and therefore is not a walked provider link no
   * matter what the staged row says. [OVL] edgeNotes + [GUX] hop vocabulary. */
  for (const [child, parentRefs] of Object.entries(ovEdges)) {
    const sp = staged[child];
    for (const ref of parentRefs || []) {
      const resolved = resolve(ref);
      saw('LNK-OVERLAY-EDGE-UNRESOLVED');
      if (!resolved) {
        add('LNK-OVERLAY-EDGE-UNRESOLVED', `${child}->${ref}`, 'overlay parent ref resolves to nobody');
        continue;
      }
      if (!sp) continue;
      const row = ((sp.relationships && sp.relationships.parents) || []).find((r) => r.id === resolved);
      if (!row) continue;
      saw('SRC-EDGE-OVERSTATED');
      if (WALKED_TAGS.has(row.evidence)) {
        add('SRC-EDGE-OVERSTATED', `${child}->${resolved}`,
          `a tradition-carried overlay edge is staged as ${JSON.stringify(row.evidence)}`);
      }
    }
  }

  /* ===================== CLAIM ===================== */

  const tiers = declaredTiers(meta.confidenceTiers);
  const usedTiers = new Set();
  for (const p of Object.values(persons)) {
    const cls = p && p.evidence && p.evidence.class;
    if (nonEmpty(cls)) usedTiers.add(cls);
  }
  for (const cls of usedTiers) {
    saw('CLM-TIER-UNDECLARED');
    /* 'living' is declared by [META] privacy rather than by confidenceTiers. */
    if (cls === 'living') continue;
    if (!tiers.has(cls)) {
      const n = Object.values(persons).filter((p) => p && p.evidence && p.evidence.class === cls).length;
      add('CLM-TIER-UNDECLARED', cls,
        `${n} published person(s) carry evidence.class ${JSON.stringify(cls)}, which meta.confidenceTiers does not name`);
    }
  }

  for (const [id, p] of Object.entries(persons)) {
    const ev = (p && p.evidence) || {};
    saw('CLM-ERA-AS-SUPPORT'); saw('CLM-SUPPORT-OVERSTATED');
    if (nonEmpty(ev.support) && ERA_WORDS.has(ev.support)) {
      add('CLM-ERA-AS-SUPPORT', id, `evidence.support reads ${JSON.stringify(ev.support)} — an era label, not an assessment`);
    }
    /* The harvest status is written in two places and in two wordings —
     * evidence.basis "support unsourced until sources are harvested" and
     * research.basis "per-person source counts not yet harvested". Read BOTH;
     * a pattern anchored on one of the two phrasings would be silent on the
     * other, which is where the defect would actually live. */
    const harvestSentence = `${ev.basis || ''} ${((p && p.research) || {}).basis || ''}`;
    if (SOURCED_SUPPORT.has(ev.support) && /harvested/i.test(harvestSentence)) {
      add('CLM-SUPPORT-OVERSTATED', id, `support ${JSON.stringify(ev.support)} while its own basis says sources are not harvested`);
    }
  }

  const testimonyIds = new Set(((overlay && overlay.testimony) || []).map((t) => t && t.id));
  const edgeEndpoints = new Set();
  for (const [child, parentRefs] of Object.entries(edges)) {
    edgeEndpoints.add(child);
    for (const ref of parentRefs || []) edgeEndpoints.add(ref);
  }
  for (const [child, parentRefs] of Object.entries(ovEdges)) {
    edgeEndpoints.add(child);
    for (const ref of parentRefs || []) edgeEndpoints.add(ref);
  }

  for (const sl of (overlay && overlay.symbolicLinks) || []) {
    saw('CLM-SYMBOL-UNATTRIBUTED'); saw('CLM-SYMBOL-AS-EDGE');
    if (!nonEmpty(sl && sl.attribution) || sl.kind !== 'meaning') {
      add('CLM-SYMBOL-UNATTRIBUTED', (sl && sl.id) || '(anonymous)',
        'a symbolic link is not identified as attributed symbolism');
    }
    if (edgeEndpoints.has(sl && sl.id) || Object.prototype.hasOwnProperty.call(persons, sl && sl.id)) {
      add('CLM-SYMBOL-AS-EDGE', sl.id, 'a symbolic link id stands where a person stands');
    }
    for (const target of (sl && sl.connects) || []) {
      saw('CLM-SYMBOL-DANGLING');
      if (!resolve(target)) add('CLM-SYMBOL-DANGLING', `${sl.id}->${target}`, 'symbolic link connects to nobody');
    }
  }

  for (const entry of ((overlay && overlay.moneyHistory) || {}).entries || []) {
    saw('CLM-MONEY-AS-BLOOD');
    const ref = entry && entry.ref;
    if (!testimonyIds.has(ref) || edgeEndpoints.has(ref) || Object.prototype.hasOwnProperty.call(persons, ref)) {
      add('CLM-MONEY-AS-BLOOD', String(ref),
        'a money-history entry does not resolve to attributed testimony, or stands where a person stands');
    }
  }

  for (const t of (overlay && overlay.testimony) || []) {
    saw('CLM-TESTIMONY-UNATTRIBUTED');
    if (!nonEmpty(t && t.author) || !nonEmpty(t && t.status)) {
      add('CLM-TESTIMONY-UNATTRIBUTED', (t && t.id) || '(anonymous)', 'testimony carries no author or no status');
    }
  }

  for (const [pair, re] of Object.entries((overlay && overlay.relationshipEvidence) || {})) {
    saw('CLM-DISPUTE-THIN');
    if (re && re.status === 'disputed') {
      const thin = [];
      if (((re.hypotheses || []).length) < 2) thin.push('fewer than two hypotheses');
      if (!nonEmpty(re.contradictions)) thin.push('no contradictions stated');
      if (((re.sources || []).length) < 1) thin.push('no sources');
      if (thin.length) add('CLM-DISPUTE-THIN', pair, thin.join('; '));
    }
    const [child, parent] = String(pair).split('|');
    const sp = staged[child];
    if (!sp) continue;
    const resolved = resolve(parent);
    const row = ((sp.relationships && sp.relationships.parents) || []).find((r) => r.id === resolved);
    if (!row) continue;
    saw('CLM-DISPUTE-UNDISCLOSED');
    if (re && re.status === 'disputed' && !String(row.evidence || '').startsWith(DISPUTED_PREFIX)) {
      add('CLM-DISPUTE-UNDISCLOSED', pair,
        `the staged parent row reads ${JSON.stringify(row.evidence)} for a claim the overlay calls disputed`);
    }
  }

  /* ===================== LINKING ===================== */

  for (const [providerId, corr] of Object.entries((overlay && overlay.corrections) || {})) {
    saw('LNK-CORRECTION-UNRESOLVED');
    const internal = refsIndex[providerId];
    if (!internal || !persons[internal]) {
      add('LNK-CORRECTION-UNRESOLVED', providerId, 'a correction patches a person the corpus never published');
      continue;
    }
    saw('LNK-CORRECTION-NOT-APPLIED');
    const target = persons[internal];
    const patch = (corr && corr.patch) || {};
    const problems = [];
    if (!target.corrected) problems.push('the published person carries no `corrected` mark');
    for (const [k, v] of Object.entries(patch)) {
      if (target[k] !== v) problems.push(`${k} reads ${JSON.stringify(target[k])}, the correction says ${JSON.stringify(v)}`);
    }
    if (problems.length) add('LNK-CORRECTION-NOT-APPLIED', `${providerId}->${internal}`, problems.join('; '));
  }

  for (const [child, parentRefs] of Object.entries(edges)) {
    saw('LNK-EDGE-ORPHAN'); saw('LNK-SELF-PARENT');
    if (!persons[child] && !ovPersons[child]) add('LNK-EDGE-ORPHAN', child, 'an edge hangs off a person the corpus did not publish');
    if ((parentRefs || []).includes(child)) add('LNK-SELF-PARENT', child, 'a person is listed as its own parent');
  }

  for (const [key, cp] of Object.entries(couples)) {
    saw('LNK-COUPLE-BROKEN'); saw('LNK-COUPLE-AND-EDGE');
    const parts = String(key).split('|');
    const a = cp && cp.p1;
    const b = cp && cp.p2;
    if (parts.length !== 2 || !parts.includes(a) || !parts.includes(b)) {
      add('LNK-COUPLE-BROKEN', key, 'the couple key does not name its own two members');
    } else if (!resolve(a) || !resolve(b)) {
      add('LNK-COUPLE-BROKEN', key, 'a couple names somebody the corpus did not publish');
    }
    const aParents = edges[a] || [];
    const bParents = edges[b] || [];
    if (aParents.includes(b) || bParents.includes(a)) {
      /* NOT an accusation. The pair may be a consanguineous marriage the
       * provider records faithfully (Ramesses II ⚭ Bintanath), or two records
       * of one person. Either way a reader that renders ONE relation drops the
       * other, and [GUX]'s RELATIONSHIP SHAPE has a slot for both
       * (kind:'blood-and-affinity'). The row enumerates the class; it does not
       * resolve any member of it. */
      add('LNK-COUPLE-AND-EDGE', key, 'the same pair is a marriage AND a parent-child edge — both relations must render');
    }
  }

  const stagedIds = Object.keys(staged);
  if (stagedIds.length) {
    saw('LNK-STAGED-CORPUS-DIVERGE', stagedIds.length);
    const missingFromStore = Object.keys(persons).filter((id) => !staged[id]);
    const extraInStore = stagedIds.filter((id) => !persons[id]);
    if (missingFromStore.length || extraInStore.length) {
      add('LNK-STAGED-CORPUS-DIVERGE', 'persons/',
        `${missingFromStore.length} published person(s) have no staged object; ${extraInStore.length} staged object(s) are not in the corpus`);
    }

    const unresolvedParents = [];
    for (const [id, sp] of Object.entries(staged)) {
      const rel = (sp && sp.relationships) || {};
      for (const par of rel.parents || []) {
        saw('LNK-RECIPROCITY');
        if (!staged[par.id]) { unresolvedParents.push(`${id}->${par.id}`); continue; }
        const back = (staged[par.id].relationships || {}).children || [];
        if (!back.some((c) => c.id === id)) {
          add('LNK-RECIPROCITY', `${id}->${par.id}`, 'a staged parent row has no matching child row');
        }
      }
      for (const ch of rel.children || []) {
        saw('LNK-RECIPROCITY');
        if (!staged[ch.id]) continue;
        const back = (staged[ch.id].relationships || {}).parents || [];
        if (!back.some((p) => p.id === id)) {
          add('LNK-RECIPROCITY', `${id}<-${ch.id}`, 'a staged child row has no matching parent row');
        }
      }
    }

    saw('LNK-FRONTIER-UNDISCLOSED');
    if (unresolvedParents.length) {
      /* [META] reconciliation accounts for the raw walk minus the published
       * corpus. It does not account for parent REFERENCES the published corpus
       * still carries into that excluded population — a reader following one
       * lands nowhere and the corpus never said it would. */
      const declaredAnywhere = JSON.stringify(meta.reconciliation || {}) + String(meta.privacy || '');
      const disclosed = /frontier|unresolved parent|parent reference/i.test(declaredAnywhere);
      if (!disclosed) {
        add('LNK-FRONTIER-UNDISCLOSED', 'meta.reconciliation',
          `${unresolvedParents.length} staged parent reference(s) point outside the published corpus and meta declares no frontier`);
      }
    }
  }

  /* ===== the declaration against the bytes =====
   * The producer writes meta AND the artifacts, so agreement here is not proof
   * the walk was right — it is the cheapest way to catch a producer that
   * changed one and not the other. Each row compares ONE declared number to a
   * number recomputed here. */
  {
    const declared = [
      ['meta.stats.deceasedPublished', (meta.stats || {}).deceasedPublished, Object.keys(persons).length],
      ['meta.overlayPersons', meta.overlayPersons, Object.keys(ovPersons).length],
      ['meta.correctionsApplied', meta.correctionsApplied, Object.keys((overlay && overlay.corrections) || {}).length],
    ];
    /* rows whose declared side is a whole CENSUS OBJECT rather than a number;
     * they cannot go through the numeric comparison below. */
    const censusRows = [];
    if (stagedIds.length) {
      const sp = meta.stagedPersons || {};
      declared.push(['meta.stagedPersons.publicStaged', sp.publicStaged, stagedIds.length]);
      const census = (field) => {
        const out = Object.create(null);
        for (const obj of Object.values(staged)) {
          const v = obj && obj[field] && obj[field].status;
          if (nonEmpty(v)) out[v] = (out[v] || 0) + 1;
        }
        return out;
      };
      for (const [key, field] of [['researchCounts', 'research'], ['publicationCounts', 'publication']]) {
        const want = sp[key];
        const got = census(field);
        /* A MISSING CENSUS IS ITSELF A DIVERGENCE. The three fixed rows above
         * already report an absent declaration (`typeof want !== 'number'`);
         * this one used to `continue` on a falsy `want`, so a producer that
         * stopped declaring a census switched its comparisons off and the
         * clause still read clean. The skip was invisible to the battery too:
         * the inspected count merely fell, and a truthiness test cannot see
         * 9 fall to 6. Reported by bee-laborer attacking #225, 2026-09-23. */
        if (!want || typeof want !== 'object') {
          censusRows.push([`meta.stagedPersons.${key}`, want, got]);
          continue;
        }
        for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) {
          declared.push([`meta.stagedPersons.${key}.${k}`, want[k], got[k] || 0]);
        }
      }
    }
    for (const [where, want, got] of declared) {
      saw('META-COUNT-DIVERGE');
      if (typeof want !== 'number') {
        add('META-COUNT-DIVERGE', where, `the corpus declares no number here; the artifacts hold ${got}`);
      } else if (want !== got) {
        add('META-COUNT-DIVERGE', where, `declared ${want}, artifacts hold ${got}`);
      }
    }
    for (const [where, want, got] of censusRows) {
      saw('META-COUNT-DIVERGE');
      const total = Object.values(got).reduce((n, v) => n + v, 0);
      if (total === 0) continue; /* nothing published under this field; an absent census declares nothing wrong */
      add('META-COUNT-DIVERGE', where,
        `the corpus declares no census here (${want === undefined ? 'absent' : JSON.stringify(want)}); the artifacts hold ${total} staged person(s) across ${JSON.stringify(got)}`);
    }
  }

  const byCode = Object.create(null);
  for (const f of findings) byCode[f.code] = (byCode[f.code] || 0) + 1;
  return { findings, inspected, byCode };
}

/** A stable, order-independent key for baseline comparison. */
export function findingKey(f) {
  return `${f.code} :: ${f.where}`;
}
