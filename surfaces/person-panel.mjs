/* person-panel.mjs — the GUX-01 person/relationship panel (zGenePerson seat,
   2026-09-18). An ISOLATED component the blood.html owner (zGeneUI) mounts;
   it never edits blood.html, the corpus, the model, or profile pages.

   ── THE INTEGRATION CONTRACT (exact) ───────────────────────────────────────
   MOUNT
     import { mountPersonPanel } from './person-panel.mjs';
     const panel = mountPersonPanel(hostEl, archive, {
       root: 'p72d226cedf',          // standing root (relationship reference)
       onreroot(id){...},            // optional — host re-roots its own view
       onnavigate(state){...},       // optional — host mirrors state to its URL
                                      //   state = {view, id, a, b, query, root}
       openPersonPage(id){...},      // optional — host links to its person page;
                                      //   default opens the staged person page
       langText(key, fb){...},       // optional i18n hook (English fallbacks
                                      //   inline; corpus keys ×29 follow-lane)
       scrollContainer: el|null      // optional; default restores window scroll
     });

   ARCHIVE (supplied by the host; surfaces/person-panel-corpus.mjs is the
   reference implementation against the public corpus — any Archive 1.1
   implementation with the same shape is a drop-in replacement):
     getPerson(id) → PersonView|null          frozen
     resolve(q) → {status:'hit'|'ambiguous'|'null', ...}   never a silent pick
     search(q, cap) → [{person, exact}]       frozen
     relationship(a,b) → Relationship         frozen — THE ARCHIVE 1.1 SEAM:
       the temporary selected→root workaround lives ONLY in the adapter's
       relationship(); this panel never re-derives paths, so replacing that
       one function replaces the whole policy.
     genContext(id, rootId) → {rel, depth}
     coupleOf(a,b) → boolean
     frontierTotal() → number

   CONTROLLER
     panel.openPerson(id) / panel.openRelationship(aId,bId)
     panel.search(text)            // programmatic (the input does the same)
     panel.resolveAndOpen(text)    // the lawful resolve: hit→open,
                                   // ambiguous→ambiguity view, null→honest empty
     panel.setRoot(id)             // updates the standing root + re-renders
     panel.back() · panel.state() · panel.destroy()

   KEYBOARD: '/' focus search · Esc back · ↑↓ walk results · Enter chooses the
   highlighted candidate (NEVER pre-highlighted while exact-name duplicates
   are on screen — no silent choice) · R re-root · O person archive.

   LAWS ENCODED (tested in tools/genealogy/personpanel.test.mjs):
     - ambiguity is shown, never silently resolved
     - blood vs affinity labeled separately; both may coexist (married cousins)
     - relationship paths show endpoints and the common ancestor honestly
     - records / tradition / testimony / meaning render as SEPARATELY
       attributed layers — attribution distinguishes, never ranks
     - era ≠ support everywhere; citations connect claims to evidence and
       support is assessed per claim — a citation count is never a
       confidence verdict
     - no mutation of archive-returned objects (all views are derived strings)
     - no living/private leakage in labels, URLs, logs, exports, search: the
       panel renders only what the (public, pseudonymized) archive returns;
       it adds no names, ids, or URLs of its own; it logs nothing
*/

export const PP_VERSION = 'person-panel/1.3';

/* v1.1 — curiosity-first (founder guidance 2026-09-18: "the graph is not the
 * product; the graph is the instrument for discovering people"):
 *   + archive.discoveries(rootId)  OPTIONAL — computed hooks for the opening
 *     strip (counts, deepest line, pedigree collapse, cousin marriages,
 *     cyclic records, the frontier, shared names). Every value is derived
 *     from the archive at run time; the panel renders nothing it was not
 *     given, and degrades to the plain search prompt when absent.
 *   + archive.pedigreeOccurrences(rootId, gens) OPTIONAL — ahnentafel-slot
 *     occupancy; occurrences > 1 = pedigree collapse (one person, several
 *     positions — never two people).
 *   + archive.spineIndex(id) / archive.nameShares(name) OPTIONAL.
 *   + panel.home() — return to the discovery strip.
 * v1.3 — discoveries are CONTEXTUAL to the standing root (re-rooting teaches
 *   itself); the epistemic descent is VISIBLE (tier-classed hops + the tier
 *   sequence a line walks + the tier composition of everything from the
 *   root); FORMAL kinship naming is computed (depth 5 up = 3rd-great-
 *   grandfather — never hand-written); and the DESCENDANT-SIDE FRONTIER is a
 *   first-class state: family sections state the walk's coverage law, and a
 *   person's KNOWN broader family (wives/children totals beyond the walk)
 *   renders ONLY from attributed archive data (buildArchive's optional
 *   `broader` input — testimony/cited-biography numbers the archive owner
 *   stages; the panel never invents them), with the sideways fan locked,
 *   not hidden.

/* ── pure helpers (the laws that read) ───────────────────────────────────── */

export function esc (v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* distinguishing-context line for a candidate — the anti-silent-choice text */
export function genContextText (ctx, rootName) {
  if (!ctx) return 'not on the current line';
  if (ctx.rel === 'self') return 'the current root' + (rootName ? ' — ' + rootName : '');
  if (ctx.rel === 'above') return ctx.depth + (ctx.depth === 1 ? ' generation' : ' generations') + ' above the current root';
  if (ctx.rel === 'below') return ctx.depth + (ctx.depth === 1 ? ' generation' : ' generations') + ' below the current root';
  return 'not on the current line';
}

export function ambiguityHeadline (r) {
  if (!r || r.status !== 'ambiguous') return '';
  if (r.exact) {
    return r.candidates.length + ' people share the exact name “' + r.query + '” in the published archive — the archive never picks for you:';
  }
  return 'no exact match for “' + r.query + '” — close names in the archive (choose deliberately):';
}

/* one-line summary of a Relationship — the honest sentence under the header */
export function relationshipSummary (rel, nameOf) {
  if (!rel) return '';
  const A = nameOf(rel.a), B = nameOf(rel.b);
  if (rel.kind === 'self') return A + ' is the person you are standing on.';
  if (rel.kind === 'affinity') return A + ' is joined to ' + B + ' by marriage — affinity, never blood.';
  if (rel.kind === 'blood-and-affinity') return A + ' and ' + B + ' are married AND share blood — affinity and blood both hold, each labeled.';
  if (rel.kind === 'direct') {
    const up = rel.blood && rel.blood.mode === 'ancestor-of-root';
    return A + ' is ' + (up ? 'an ancestor of ' : 'a descendant of ') + B + ' — the line itself is the relationship; the common ancestor is its endpoint.';
  }
  if (rel.kind === 'shared') {
    return A + ' and ' + B + ' share a common ancestor within the published archive — both lines and the common ancestor are shown.';
  }
  return 'no shared line between ' + A + ' and ' + B + ' within the published archive.';
}

export function hopArrow (hop) {
  if (hop.dir === 'up') return '↑';
  if (hop.dir === 'down') return '↓';
  return '⚭';
}

/* ── formal kinship naming (the founder's genealogical correction, made
   structural): depth 5 up = "3rd-great-grandfather" — computed, never
   hand-written. depth 1..2 plain, 3 = great-, n>=4 = (n-2)th-great-. */
/* proper ordinal: the 11/12/13 exception plus mod-10 suffixing — this
 * archive reaches 141st-great- territory, 21th- never ships */
const ORD = n => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export function kinshipTerm (depth, dir, gender) {
  const g = gender === 'F' || gender === 'FEMALE' ? 'F' : (gender === 'M' || gender === 'MALE' ? 'M' : null);
  if (depth < 1) return null;
  if (dir === 'up') {
    const base = g === 'F' ? 'grandmother' : (g === 'M' ? 'grandfather' : 'grandparent');
    const parent = g === 'F' ? 'mother' : (g === 'M' ? 'father' : 'parent');
    if (depth === 1) return parent;
    if (depth === 2) return base;
    if (depth === 3) return 'great-' + base;
    return ORD(depth - 2) + '-great-' + base;
  }
  if (dir === 'down') {
    const base = g === 'F' ? 'granddaughter' : (g === 'M' ? 'grandson' : 'grandchild');
    const child = g === 'F' ? 'daughter' : (g === 'M' ? 'son' : 'child');
    if (depth === 1) return child;
    if (depth === 2) return base;
    if (depth === 3) return 'great-' + base;
    return ORD(depth - 2) + '-great-' + base;
  }
  return null;
}

/* ── the epistemic descent: the tier transitions a line actually walks —
   CONSECUTIVE deduplication, not global: a route that re-enters colonial
   ground after medieval keeps that second colonial, because that return
   is part of the texture. Nulls skipped; runs collapse; nothing invented. */
export function descentTiers (tiers) {
  const out = [];
  for (const t of tiers) {
    if (t == null || t === '') continue;
    if (out.length && out[out.length - 1] === t) continue;
    out.push(t);
  }
  return out;
}

/* long chains compress honestly: head + ellipsis + tail; the elided count
   is stated, the full length is never hidden */
export function hopWindow (hops, head, tail) {
  const H = head == null ? 10 : head;
  const T = tail == null ? 3 : tail;
  if (hops.length <= H + T + 1) return { render: hops, elided: 0, total: hops.length };
  return { render: hops.slice(0, H).concat([null]).concat(hops.slice(hops.length - T)), elided: hops.length - H - T, total: hops.length };
}

/* "one more ancestor" teasers — PURE, derived ONLY from archive-supplied
 * facts (never invented): a cousin marriage, a pedigree-collapse repeat,
 * shared namesakes, a spine position. The panel renders whatever the
 * archive proves; absence of a fact = absence of a teaser. */
export function buildTeasers (view, ctx) {
  const out = [];
  if (!view || !ctx) return out;
  if (ctx.cousinSpouses && ctx.cousinSpouses.length) {
    const sp = ctx.cousinSpouses[0];
    out.push({ kind: 'cousins', a: view.id, b: sp.id, text: '⚭ ' + sp.name + ' — married cousins; blood and affinity both hold. Open both lines.' });
    if (ctx.cousinSpouses.length > 1) {
      out.push({ kind: 'cousins-more', a: view.id, b: ctx.cousinSpouses[1].id, text: '… and ' + (ctx.cousinSpouses.length - 1) + ' more cousin marriage(s) on this person' });
    }
  }
  if (ctx.pedigreeN && ctx.pedigreeN > 1) {
    out.push({ kind: 'collapse', id: view.id, text: 'appears ' + ctx.pedigreeN + '× in the ' + ctx.pedigreeGens + '-generation pedigree from ' + ctx.rootShort + ' — pedigree collapse: one person, several positions.' });
  }
  if (ctx.nameShareCount && ctx.nameShareCount > 1) {
    out.push({ kind: 'namesakes', query: view.name, text: ctx.nameShareCount + ' people in the archive share this exact name — see them all; the archive never picks for you.' });
  }
  if (ctx.spineIdx != null) {
    out.push({ kind: 'spine', id: view.id, text: 'generation ' + ctx.spineIdx + ' on the spine — one of the named waypoints the published line runs through.' });
  }
  /* the medieval experience — deeper ground speaks its own texture */
  if (view.inCycle) {
    out.push({ kind: 'cyclic', id: view.id, text: 'this record participates in a loop — the medieval web repeats people as their own ancestors; the shortest honest line is what renders.' });
  }
  if ((view.parents || []).some(x => /disputed/.test(x.evidence || ''))) {
    out.push({ kind: 'disputed', id: view.id, text: 'a parent-link here is disputed — competing reconstructions exist; open the parent row to inspect the evidence.' });
  }
  if (view.tier === 'saga' || view.tier === 'medieval') {
    out.push({ kind: 'legendary', id: view.id, text: 'this person rides traditional genealogy (' + view.tier + ' tier) — it does not upgrade to documented; the chips carry the distinction.' });
  }
  return out;
}

/* attribution line per layer — attribution distinguishes, never ranks */
export function layerAttributionLines (view) {
  const out = [];
  const L = view.layers || {};
  if (L.records) out.push({ kind: 'records', label: '① documentary record — provider: ' + L.records.provider + (L.records.retrieved ? ' · retrieved ' + L.records.retrieved.slice(0, 10) : '') });
  if (L.correction) out.push({ kind: 'correction', label: '② founder correction — ' + L.correction.attested });
  if (view.overlay) out.push({ kind: 'overlay', label: '② attested overlay — enters the record outside the provider walk, by evidence pack' });
  if (L.tradition) out.push({ kind: 'tradition', label: '③ tradition — ' + (L.tradition.attribution || 'evidence pack') });
  if (L.testimony && L.testimony.length) out.push({ kind: 'testimony', label: '⚑ family testimony — ' + L.testimony[0].author });
  if (L.spiritual && L.spiritual.length) out.push({ kind: 'spiritual', label: '✵ spiritual reflections — attributed, never verification' });
  if (L.meaning && L.meaning.length) out.push({ kind: 'meaning', label: '✦ meaning — founder-authored symbolism; never a parent-child claim' });
  return out;
}

/* ── the component ───────────────────────────────────────────────────────── */

export function mountPersonPanel (host, archive, opts) {
  if (typeof document === 'undefined') throw new Error('person-panel: DOM required');
  if (!host || !archive) throw new Error('person-panel: host and archive required');

  const o = Object.assign({
    root: null,
    onreroot: null,
    onnavigate: null,
    openPersonPage: null,
    langText: null,
    scrollContainer: null,
    searchPlaceholder: 'search the archive — a name (the panel will not pick for you)'
  }, opts || {});

  const T = (key, fb) => (o.langText ? o.langText(key, fb) : fb);
  const nameOf = id => { const p = archive.getPerson(id); return p ? p.name : id; };
  const shortName = id => { const p = archive.getPerson(id); return p ? (p.living ? p.name : String(p.name).split(/\s+/).slice(0, 2).join(' ')) : id; };

  let curRoot = (o.root && archive.getPerson(o.root)) ? o.root : null;
  let view = { type: 'empty' };
  const stack = []; /* prior contexts — back returns to them */
  let searchHi = -1;
  let searchRows = [];
  let searchDup = false;

  host.classList.add('pp');
  host.setAttribute('data-pp', PP_VERSION);
  host.innerHTML =
    '<div class="pp-search">' +
    '  <input class="pp-q" type="text" spellcheck="false" autocomplete="off" role="combobox" aria-expanded="false" ' +
    '         aria-label="' + esc(T('pp.search.label', 'search people')) + '" placeholder="' + esc(T('pp.search.ph', o.searchPlaceholder)) + '">' +
    '  <div class="pp-results" role="listbox" aria-label="' + esc(T('pp.search.results', 'search results')) + '" hidden></div>' +
    '</div>' +
    '<div class="pp-view" tabindex="-1" aria-live="polite"></div>' +
    '<div class="pp-backbar" hidden><button type="button" class="pp-back">← ' + esc(T('pp.back', 'back to where I was')) + '</button></div>';

  const qEl = host.querySelector('.pp-q');
  const resultsEl = host.querySelector('.pp-results');
  const viewEl = host.querySelector('.pp-view');
  const backbar = host.querySelector('.pp-backbar');
  const backBtn = host.querySelector('.pp-back');

  /* ── context capture/restore — back returns to the PRIOR context ──────── */
  function captureScroll () {
    return o.scrollContainer ? o.scrollContainer.scrollTop : (window.scrollY || 0);
  }
  function restoreScroll (y) {
    if (o.scrollContainer) o.scrollContainer.scrollTop = y;
    else window.scrollTo(0, y);
  }
  function pushContext () {
    stack.push({ view, scroll: captureScroll() });
    if (stack.length > 60) stack.shift();
  }
  function publicState () {
    return {
      view: view.type,
      id: view.type === 'person' ? view.id : null,
      a: view.type === 'relationship' ? view.a : null,
      b: view.type === 'relationship' ? view.b : null,
      query: (view.type === 'ambiguity' || view.type === 'empty-search') ? view.query : null,
      root: curRoot
    };
  }
  function notify () {
    if (o.onnavigate) { try { o.onnavigate(publicState()); } catch (e) { /* host hook errors never break the panel */ } }
  }
  function setView (nv) {
    view = nv;
    render();
    viewEl.focus({ preventScroll: true });
    notify();
  }

  /* ── search ────────────────────────────────────────────────────────────── */
  function onQInput () {
    const q = qEl.value.trim();
    if (!q) { resultsEl.hidden = true; resultsEl.innerHTML = ''; searchRows = []; return; }
    searchRows = archive.search(q, 12);
    /* the no-silent-choice law: while exact-name duplicates are on screen the
     * keyboard highlight stays OFF — a choice must be a deliberate act */
    const seenNames = {};
    searchDup = false;
    for (const r of searchRows) if (r.exact) { const k = r.person.name.toLowerCase(); if (seenNames[k]) searchDup = true; seenNames[k] = 1; }
    searchHi = (searchDup || !searchRows.length) ? -1 : 0;
    renderResults();
  }

  function onQKeydown (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!searchRows.length) return;
      e.preventDefault();
      searchHi = e.key === 'ArrowDown'
        ? (searchHi + 1) % searchRows.length
        : (searchHi <= 0 ? searchRows.length - 1 : searchHi - 1);
      renderResults();
      const hl = resultsEl.querySelector('[data-hi="' + searchHi + '"]');
      if (hl) hl.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchHi >= 0 && searchRows[searchHi]) { choosePerson(searchRows[searchHi].person.id, qEl.value.trim()); return; }
      const q = qEl.value.trim();
      if (q) resolveAndOpen(q);
    } else if (e.key === 'Escape') {
      resultsEl.hidden = true;
      qEl.blur();
    }
  }

  function renderResults () {
    const rows = searchRows;
    if (!rows.length) {
      resultsEl.hidden = false;
      resultsEl.innerHTML = '<div class="pp-nores">' + esc(T('pp.search.none', 'no person by that name in the published archive — the walk has a frontier; try a surname, or open someone nearby.')) + '</div>';
      qEl.setAttribute('aria-expanded', 'false');
      return;
    }
    let html = '';
    if (searchDup) {
      html += '<div class="pp-dupwarn">' + esc(T('pp.search.dupwarn', 'more than one person carries this exact name — the archive never picks for you; choose deliberately (↑↓ + Enter, or click)')) + '</div>';
    }
    rows.forEach((r, i) => {
      const p = r.person;
      const ctx = archive.genContext(p.id, curRoot);
      const ref = (p.refs && p.refs[0]) ? ' · FS ' + p.refs[0].id : '';
      html += '<button type="button" class="pp-res' + (i === searchHi ? ' hi' : '') + '" role="option" ' +
        'aria-selected="' + (i === searchHi) + '" data-ppgo="' + esc(p.id) + '" data-hi="' + i + '">' +
        '<span class="pp-res-name">' + (r.exact ? '<b>' : '') + esc(p.name) + (r.exact ? '</b>' : '') + '</span>' +
        '<span class="pp-res-sub">' + esc(p.lifespan || (p.living ? 'living — redacted stub' : 'lifespan unknown')) + ' · ' + esc(p.era || p.tier) + ref + '</span>' +
        '<span class="pp-res-ctx">' + esc(genContextText(ctx, curRoot ? shortName(curRoot) : '')) + '</span>' +
        '</button>';
    });
    html += '<div class="pp-more">' + esc(T('pp.search.more', 'results capped — keep typing to narrow')) + '</div>';
    resultsEl.innerHTML = html;
    resultsEl.hidden = false;
    qEl.setAttribute('aria-expanded', 'true');
  }

  /* ── the lawful resolve: hit / ambiguous / null, all three visible ─────── */
  function resolveAndOpen (query) {
    const r = archive.resolve(query);
    resultsEl.hidden = true;
    if (r.status === 'hit') { choosePerson(r.person.id, query); return; }
    pushContext();
    if (r.status === 'ambiguous') {
      setView({ type: 'ambiguity', query: r.query, exact: r.exact, candidates: r.candidates.map(c => c.id) });
    } else {
      setView({ type: 'empty-search', query: r.query });
    }
  }

  function choosePerson (id, fromQuery) {
    resultsEl.hidden = true;
    if (view.type === 'person' && view.id === id) return;
    pushContext();
    setView({ type: 'person', id, fromQuery: fromQuery || null });
  }

  /* ── person view ───────────────────────────────────────────────────────── */
  function chipsHtml (p) {
    let h = '<span class="pp-chip pp-era">' + esc(p.era || p.tier) + '</span>' +
      '<span class="pp-chip" title="' + esc(p.supportBasis || '') + '">support: ' + esc(p.support) + '</span>';
    if (p.living) h += '<span class="pp-chip">' + esc(T('pp.chip.living', 'living — redacted stub')) + '</span>';
    if (p.isCorpusRoot) h += '<span class="pp-chip pp-root">' + esc(T('pp.chip.root', 'the founder — living, redacted')) + '</span>';
    if (p.id === curRoot) h += '<span class="pp-chip pp-standing">' + esc(T('pp.chip.standing', 'standing root')) + '</span>';
    if (p.overlay) h += '<span class="pp-chip pp-ovl">' + esc(T('pp.chip.ovl', 'attested overlay — evidence pack')) + '</span>';
    if (p.onSpine) h += '<span class="pp-chip pp-spine">' + esc(T('pp.chip.spine', 'on the spine')) + '</span>';
    if (p.impossibleChronology) h += '<span class="pp-chip pp-warn">⚠ ' + esc(T('pp.chip.chrono', 'impossible chronology — a recorded parent is not older')) + '</span>';
    return h;
  }

  /* chains render from an explicit start id — works for the standing root
   * AND for arbitrary pairs opened from a parent/spouse row. Long chains
   * compress honestly (head + stated ellipsis + tail); hop nodes carry their
   * evidence-tier class so the epistemic descent is VISIBLE. */
  function relChainsHtml (rel) {
    if (!rel || rel.kind === 'self') return '';
    let h = '';
    if (rel.blood) {
      const B = rel.blood;
      if (B.mode === 'cousin-line') {
        const ca = archive.getPerson(B.commonAncestor);
        h += '<div class="pp-lab">' + esc(T('pp.rel.line1', 'from the standing end:')) + '</div>';
        h += '<div class="pp-chain">' + chainHtml(B.hopsFromRoot, rel.b) + '</div>';
        h += '<div class="pp-lab">' + esc(T('pp.rel.line2', 'from the person:')) + '</div>';
        h += '<div class="pp-chain">' + chainHtml(B.hopsFromPerson, rel.a) + '</div>';
        h += '<div class="pp-ca-line">' + esc(T('pp.rel.ca', 'common ancestor:')) + ' <button type="button" class="pp-link" data-ppgo="' + esc(B.commonAncestor) + '">' +
          esc(ca ? ca.name : B.commonAncestor) + (ca && ca.lifespan ? ' · ' + esc(ca.lifespan) : '') + '</button> — ' +
          (B.hopsFromRoot.length + B.hopsFromPerson.length) + ' ' + esc(T('pp.rel.hops', 'hops in total, the shortest way the archive records')) + '</div>';
      } else {
        h += '<div class="pp-chain">' + chainHtml(B.hopsFromRoot, rel.b) + '</div>';
        h += '<div class="pp-ca-line">' + esc(T('pp.rel.endpoint', 'the common ancestor is the line’s upper endpoint — no intermediate meeting point is claimed')) + '</div>';
        /* formal kinship — computed from depth + recorded gender, never prose */
        const personP = archive.getPerson(rel.a);
        const rootP = archive.getPerson(rel.b);
        if (personP && rootP) {
          const term = rel.blood.mode === 'ancestor-of-root'
            ? kinshipTerm(B.hopsFromRoot.length, 'up', personP.gender)
            : kinshipTerm(B.hopsFromRoot.length, 'down', personP.gender);
          if (term) {
            h += '<div class="pp-kinship">' + esc(T('pp.rel.kinship', 'formally: {a} is {b}’s {t} — {n} generations').replace('{a}', esc(personP.name)).replace('{b}', esc(rootP.name)).replace('{t}', esc(term)).replace('{n}', String(B.hopsFromRoot.length))) + '</div>';
          }
        }
      }
    }
    if (rel.affinity) {
      h += '<div class="pp-chain pp-affinity">' + chainHtml(rel.affinity.hopsFromRoot, rel.b) + '</div>' +
        '<div class="pp-ca-line">' + esc(T('pp.rel.affinity', 'affinity — marriage; never described as blood')) + '</div>';
    }
    if (rel.kind === 'blood-and-affinity') {
      h += '<div class="pp-coexist">' + esc(T('pp.rel.coexist', 'blood AND affinity coexist for this pair — married cousins; both are true and separately labeled')) + '</div>';
    }
    /* the epistemic descent: when the blood line's evidence texture changes,
     * the change itself is shown — era labels date the evidence; support is
     * assessed per person; the panel renders no verdict of its own */
    if (rel.blood) {
      const tiers = [tierOf(rel.b)].concat(rel.blood.hopsFromRoot.map(x => tierOf(x.to)));
      const seq = descentTiers(tiers);
      if (seq.length >= 2) {
        h += '<div class="pp-descent">◇ ' + esc(T('pp.rel.descent', 'the evidence texture changes as the line climbs: {s} — era labels date the evidence; support is assessed per person').replace('{s}', esc(seq.join(' → ')))) + '</div>';
      }
    }
    if (rel.cyclic) {
      h += '<div class="pp-cyclic">↻ ' + esc(T('pp.rel.cyclic', 'the shortest recorded line passes through a cyclic record (the medieval web loops) — the archive shows the shortest honest way, never an invented cleaner one')) + '</div>';
    }
    if (rel.kind === 'none') {
      h += '<div class="pp-none">' + esc(rel.note || T('pp.rel.none', 'no shared line within the published archive')) + '</div>';
    }
    return h;
  }

  function tierOf (id) {
    const p = archive.getPerson(id);
    return p ? p.tier : null;
  }

  /* a chain of labeled, clickable hops starting at startId; null hop = the
   * honest ellipsis for a compressed middle */
  function chainHtml (hopsRaw, startId) {
    const w = hopWindow(hopsRaw, 10, 3);
    const start = archive.getPerson(startId);
    let h = nodeHtml(startId, start);
    for (const hop of w.render) {
      if (hop == null) {
        h += ' <span class="pp-hop-ellipsis">… ' + w.elided + ' ' + esc(T('pp.rel.morehops', 'more hops — ' + w.total + ' in total, every one carried in the archive')) + ' …</span> ';
        continue;
      }
      const p = archive.getPerson(hop.to);
      h += ' <span class="pp-hop" title="' + esc(hop.evidence) + '">' + hopArrow(hop) + esc(hop.label) + '</span> ';
      h += nodeHtml(hop.to, p);
    }
    return h;
  }

  function nodeHtml (id, p) {
    const tier = p ? p.tier : null;
    return '<span class="pp-hopnode' + (tier ? ' pp-t-' + esc(tier) : '') + '" data-ppgo="' + esc(id) + '" role="button" tabindex="0" title="' +
      esc(T('pp.node.tier', 'era tier: {t}').replace('{t}', tier || '—')) + '">' +
      esc(p ? (p.living ? p.name : shortName(id)) : id) + '</span>';
  }

  function relToRootHtml (p) {
    if (!curRoot) return '';
    const rel = archive.relationship(p.id, curRoot);
    const rootP = archive.getPerson(curRoot);
    let h = '<section class="pp-sec pp-rel"><h3 class="pp-h">' + esc(T('pp.rel.title', 'relationship to where you are standing')) + '</h3>';
    h += '<div class="pp-rel-line">' + esc(relationshipSummary(rel, nameOf)) + '</div>';
    h += endpointsHtml(p, rootP);
    h += relChainsHtml(rel);
    h += '<div class="pp-sec-note">' + esc(T('pp.rel.era', 'each hop carries its own evidence — era and support are assessed per person and per claim, never upgraded by this line')) + '</div>';
    h += '</section>';
    return h;
  }

  function endpointsHtml (aP, bP) {
    return '<div class="pp-endpoints">' +
      '<span class="pp-end">' + esc(aP ? aP.name : '?') + (aP && aP.lifespan ? ' · ' + esc(aP.lifespan) : '') + '</span>' +
      '<span class="pp-end-sep"> ↔ </span>' +
      '<span class="pp-end">' + esc(bP ? bP.name : '?') + (bP && bP.lifespan ? ' · ' + esc(bP.lifespan) : '') + '</span>' +
      '</div>';
  }

  function familyHtml (p) {
    let h = '<section class="pp-sec"><h3 class="pp-h">' + esc(T('pp.family', 'family in the archive')) + '</h3><div class="pp-fam">';
    if (p.parents.length) {
      h += '<div class="pp-fam-lab">' + esc(T('pp.parents', 'parents')) + '</div>';
      for (const par of p.parents) {
        const pp = archive.getPerson(par.id);
        h += '<button type="button" class="pp-row" data-pprel="' + esc(p.id) + '|' + esc(par.id) + '">' +
          '<span class="pp-row-name">↑ ' + esc(pp ? pp.name : par.id) + (pp && pp.lifespan ? ' · ' + esc(pp.lifespan) : '') + '</span>' +
          '<span class="pp-row-ev">' + esc(par.evidence) + '</span></button>';
      }
    }
    if (p.children.length) {
      h += '<div class="pp-fam-lab">' + esc(T('pp.children', 'children')) + ' (' + p.children.length + ')</div>';
      for (const cid of p.children.slice(0, 10)) {
        const cp = archive.getPerson(cid);
        h += '<button type="button" class="pp-row" data-ppgo="' + esc(cid) + '">' +
          '<span class="pp-row-name">↓ ' + esc(cp ? cp.name : cid) + (cp && cp.lifespan ? ' · ' + esc(cp.lifespan) : '') + '</span></button>';
      }
      if (p.children.length > 10) h += '<div class="pp-more">… ' + (p.children.length - 10) + ' ' + esc(T('pp.more.children', 'more')) + '</div>';
    }
    if (p.spouses.length) {
      h += '<div class="pp-fam-lab">' + esc(T('pp.spouses', 'spouses')) + '</div>';
      for (const sid of p.spouses) {
        const sp = archive.getPerson(sid);
        const pairRel = archive.relationship(p.id, sid);
        const cousins = !!(pairRel && pairRel.blood && pairRel.affinity);
        h += '<button type="button" class="pp-row" data-pprel="' + esc(p.id) + '|' + esc(sid) + '">' +
          '<span class="pp-row-name">⚭ ' + esc(sp ? sp.name : sid) + (sp && sp.lifespan ? ' · ' + esc(sp.lifespan) : '') + '</span>' +
          '<span class="pp-row-ev">' + esc(T('pp.spouse.ev', 'marriage — affinity, never blood')) + (cousins ? ' · ' + esc(T('pp.spouse.cousins', 'married cousins — blood also present')) : '') + '</span></button>';
      }
    }
    if (!p.parents.length && !p.children.length && !p.spouses.length) {
      h += '<div class="pp-none">' + esc(T('pp.family.empty', 'no recorded family links inside the published archive — coverage of the walk, not a finding about anyone')) + '</div>';
    } else {
      /* descendant-side frontier — the generic coverage law: a PARTIAL family
       * must never read as the whole family (the founder's Albert Rockwood
       * finding: “children (1)” ≠ “had one child”) */
      h += '<div class="pp-coverage">' + esc(T('pp.family.coverage', 'this edition follows the founder’s blood line — siblings, other marriages, and descendants of people on the line largely live beyond the published record (coverage, not contradiction)')) + '</div>';
    }
    /* known broader family — attributed numbers carried by the archive
     * (family testimony / cited biography); never invented by the panel */
    if (p.broaderFamily) {
      const bf = p.broaderFamily;
      const spousesHere = p.spouses.length;
      const childrenHere = p.children.length;
      h += '<div class="pp-broader"><div class="pp-broader-lab">' + esc(T('pp.broader.known', 'known broader family')) + '</div>' +
        '<div class="pp-broader-line">' + esc(T('pp.broader.line', '{w} wives · {c} children (known)').replace('{w}', String(bf.spousesTotal)).replace('{c}', String(bf.childrenTotal))) + '</div>' +
        '<div class="pp-broader-line">' + esc(T('pp.broader.coverage', 'archive coverage: this edition follows {x} of {w} wives + {y} of {c} children on the direct line').replace('{x}', String(spousesHere)).replace('{w}', String(bf.spousesTotal)).replace('{y}', String(childrenHere)).replace('{c}', String(bf.childrenTotal))) + '</div>' +
        '<div class="pp-broader-att">' + esc(bf.attribution) + '</div>' +
        '<div class="pp-locked" title="' + esc(T('pp.broader.lockednote', 'future records — locked, not hidden')) + '">🔒 ' +
        esc(T('pp.broader.explore', 'fan sideways into the rest of the family — enters when the attested overlay stages those records (locked, not hidden)')) + '</div></div>';
    }
    h += '</div></section>';
    return h;
  }

  function frontierHtml (p) {
    if (!p.ghostParents) return '';
    return '<section class="pp-sec pp-frontier"><h3 class="pp-h">' + esc(T('pp.frontier', 'the frontier')) + '</h3>' +
      '<div>' + esc(T('pp.frontier.body', 'ancestry continues beyond the published archive — {n} further parent reference(s) on this person are not yet published here. This is coverage of the walk, not an empty family and not a finding about anyone.').replace('{n}', String(p.ghostParents))) + '</div></section>';
  }

  function layersHtml (p) {
    const L = p.layers;
    let h = '<section class="pp-sec"><h3 class="pp-h">' + esc(T('pp.layers', 'evidence layers — separately attributed')) + '</h3>';
    h += '<div class="pp-erasup">' + esc(T('pp.erasup', 'era ≠ support: “' + (p.era || '—') + '” dates the evidence; “' + p.support + '” assesses it — one never derives the other.')) + '</div>';
    let any = false;
    if (L.records) {
      any = true;
      h += '<div class="pp-layer" data-kind="records"><div class="pp-layer-lab">① ' + esc(T('pp.layer.records', 'documentary record')) + '</div>' +
        '<div class="pp-layer-att">' + esc(L.records.provider) + ' · ' + esc(L.records.providerRef) +
        (L.records.retrieved ? ' · ' + esc(T('pp.retrieved', 'retrieved')) + ' ' + esc(L.records.retrieved.slice(0, 10)) : '') + '</div>' +
        '<a class="pp-layer-link" href="' + esc(L.records.recordUrl) + '" target="_blank" rel="noopener">' + esc(T('pp.openrecord', 'open the provider record ↗')) + '</a></div>';
    }
    if (L.correction) {
      any = true;
      h += '<div class="pp-layer" data-kind="correction"><div class="pp-layer-lab">② ' + esc(T('pp.layer.correction', 'founder correction')) + '</div>' +
        '<div class="pp-layer-att">' + esc(L.correction.attested) + '</div>' +
        '<div class="pp-layer-body">' + esc(L.correction.note) + '</div></div>';
    }
    if (p.overlay) {
      any = true;
      h += '<div class="pp-layer" data-kind="overlay"><div class="pp-layer-lab">② ' + esc(T('pp.layer.overlay', 'attested overlay — outside the provider walk')) + '</div>' +
        '<div class="pp-layer-att">' + esc(T('pp.layer.overlay.att', 'enters the record by evidence pack; class never rises above what its sources carry')) + '</div></div>';
    }
    if (L.tradition && L.tradition.claims.length) {
      any = true;
      h += '<div class="pp-layer" data-kind="tradition"><div class="pp-layer-lab">③ ' + esc(T('pp.layer.tradition', 'tradition')) + '</div>' +
        '<div class="pp-layer-att">' + esc(L.tradition.attribution) + '</div>' +
        '<details class="pp-claims"><summary>' + L.tradition.claims.length + ' ' + esc(T('pp.claims', 'cited claims — citations connect the claim to its evidence; support is assessed per claim')) + '</summary>';
      for (const c of L.tradition.claims.slice(0, 8)) {
        h += '<div class="pp-claim"><span class="pp-claim-src">' + esc(c.source) + '</span> — ' + esc(c.claim) +
          (c.url ? ' <a href="' + esc(c.url) + '" target="_blank" rel="noopener">↗</a>' : '') + '</div>';
      }
      h += '</details></div>';
    }
    for (const t of (L.testimony || [])) {
      any = true;
      h += '<div class="pp-layer pp-layer-testimony" data-kind="testimony"><div class="pp-layer-lab">⚑ ' + esc(T('pp.layer.testimony', 'family testimony')) + '</div>' +
        '<div class="pp-layer-att">' + esc(t.author) + (t.status ? ' · ' + esc(t.status) : '') + '</div>' +
        '<div class="pp-layer-body">' + esc(t.text) + '</div>' +
        (t.moneyOverlay ? '<div class="pp-layer-att">' + esc(T('pp.money', 'carried in the money-history overlay — businesses and inheritance form their own layer, never parentage')) + '</div>' : '') + '</div>';
    }
    for (const s of (L.spiritual || [])) {
      any = true;
      h += '<div class="pp-layer pp-layer-spiritual" data-kind="spiritual"><div class="pp-layer-lab">✵ ' + esc(T('pp.layer.spiritual', 'spiritual reflections')) + '</div>' +
        '<div class="pp-layer-att">' + esc(s.author) + (s.status ? ' · ' + esc(s.status) : '') + '</div>' +
        (s.text ? '<div class="pp-layer-body">' + esc(s.text) + '</div>' : '') + '</div>';
    }
    for (const m of (L.meaning || [])) {
      any = true;
      h += '<div class="pp-layer pp-layer-meaning" data-kind="meaning"><div class="pp-layer-lab">✦ ' + esc(T('pp.layer.meaning', 'meaning — founder-authored symbolism')) + '</div>' +
        '<div class="pp-layer-att">' + esc(m.attribution) + '</div>' +
        '<div class="pp-layer-body"><b>' + esc(m.symbol) + '</b> — ' + esc(m.meaning) + '</div></div>';
    }
    if (!any && !p.living) {
      h += '<div class="pp-none">' + esc(T('pp.layers.onlywalk', 'only the walked record carries this person so far — no tradition, testimony, or meaning layers recorded; absence is coverage, not a finding')) + '</div>';
    }
    if (p.living) {
      h += '<div class="pp-none">' + esc(T('pp.layers.living', 'living — redacted stub: no records, layers, or provider references are published for living people')) + '</div>';
    }
    h += '</section>';
    return h;
  }

  /* ── the discovery strip — real people and real discoveries, not controls ─
   * every hook computed by the archive (discoveries()); each opens a person,
   * a pair, or a resolve. Absent methods degrade to the plain prompt. */
  function discoveriesHtml () {
    if (!archive.discoveries) {
      return '<div class="pp-empty">' + esc(T('pp.empty', 'search a name — or walk from the standing root — to read a person. Blood and marriage are labeled separately; same-name people are never silently chosen.')) + '</div>';
    }
    const D = archive.discoveries(curRoot);
    const nm = id => { const p = archive.getPerson(id); return p ? (p.name + (p.lifespan ? ' · ' + p.lifespan : '')) : id; };
    let h = '<div class="pp-strip">';
    h += '<div class="pp-strip-head">' + esc(T('pp.disc.head', 'standing at {r} — discoveries from here (every line opens a real person)').replace('{r}', esc(curRoot ? shortName(curRoot) : 'the archive'))) + '</div>';
    const hooks = [];
    if (D.tiers && D.tiers.total > 1 && D.tiers.order.length) {
      const parts = D.tiers.order.slice(0, 4).map(t => D.tiers.counts[t].toLocaleString() + ' ' + t);
      hooks.push({ kind: 'tiers', label: esc(T('pp.disc.tiers', '{n} ancestors from here — {p}{more}: the deeper ground thins, and the era names say how').replace('{n}', D.tiers.total.toLocaleString()).replace('{p}', parts.join(' · ')).replace('{more}', D.tiers.order.length > 4 ? ' · …' : '')) });
    }
    if (D.spine && D.spine.terminus) {
      hooks.push({ go: D.spine.terminus, label: D.personsCount.toLocaleString() + ' ' + esc(T('pp.disc.people', 'people')) + ' · ' + esc(T('pp.disc.spine', 'the spine runs {g} generations to {t}').replace('{g}', String(D.spine.gens)).replace('{t}', esc(nm(D.spine.terminus)))) });
    }
    if (D.deepest && D.deepest.id) {
      const descentClause = (D.deepest.descent && D.deepest.descent.length >= 2)
        ? ' ' + esc(T('pp.disc.descent', '— the ground changes underfoot: {s}').replace('{s}', esc(D.deepest.descent.join(' → '))))
        : '';
      hooks.push({ go: D.deepest.id, label: esc(T('pp.disc.deep', 'the deepest published line from here runs {d} generations — {n} (published, not verified)').replace('{d}', String(D.deepest.depth)).replace('{n}', esc(nm(D.deepest.id)))) + descentClause });
    }
    if (D.collapse && D.collapse.top) {
      hooks.push({ go: D.collapse.top.id, label: esc(T('pp.disc.collapse', '{r} ancestors repeat in the 12-generation pedigree — pedigree collapse; {n} appears {k}×').replace('{r}', String(D.collapse.repeaters)).replace('{n}', esc(nm(D.collapse.top.id))).replace('{k}', String(D.collapse.top.n))) });
    }
    if (D.cousins && D.cousins.exemplar) {
      hooks.push({ rel: [D.cousins.exemplar.a, D.cousins.exemplar.b], label: esc(T('pp.disc.cousins', '{c} couples were cousins as well as spouses (within {b} generations) — e.g. {a} ⚭ {b2}').replace('{c}', String(D.cousins.count)).replace('{b}', String(D.cousins.bound)).replace('{a}', esc(nm(D.cousins.exemplar.a))).replace('{b2}', esc(nm(D.cousins.exemplar.b)))) });
    }
    if (D.cycles && D.cycles.count && D.cycles.exemplar) {
      hooks.push({ go: D.cycles.exemplar, label: esc(T('pp.disc.cycles', '{c} records loop — the medieval web repeats people as their own ancestors — {n}').replace('{c}', String(D.cycles.count)).replace('{n}', esc(nm(D.cycles.exemplar)))) });
    }
    if (D.frontier && D.frontier.entrance && D.frontier.entrance.stopId) {
      hooks.push({ go: D.frontier.entrance.stopId, label: esc(T('pp.disc.frontier', 'the frontier: {t} parent references continue beyond the published archive — even here: the line from the standing root stops at {n} ({s} generations up)').replace('{t}', D.frontier.total.toLocaleString()).replace('{n}', esc(nm(D.frontier.entrance.stopId))).replace('{s}', String(D.frontier.entrance.steps))) });
    }
    if (D.ambiguousNames && D.ambiguousNames.topName) {
      hooks.push({ q: D.ambiguousNames.topName.name, label: esc(T('pp.disc.names', '{c} names belong to more than one person — {n} belongs to {k}. The archive never picks for you.').replace('{c}', String(D.ambiguousNames.count)).replace('{n}', esc(D.ambiguousNames.topName.name)).replace('{k}', String(D.ambiguousNames.topName.holders))) });
    }
    for (const hk of hooks) {
      if (hk.kind === 'tiers') {
        h += '<div class="pp-hook pp-hook-fact">' + hk.label + '</div>';
      } else if (hk.rel) {
        h += '<button type="button" class="pp-hook" data-pprel="' + esc(hk.rel[0]) + '|' + esc(hk.rel[1]) + '">' + hk.label + ' <span class="pp-hook-open">' + esc(T('pp.disc.open', 'open ↗')) + '</span></button>';
      } else if (hk.q != null) {
        h += '<button type="button" class="pp-hook" data-ppq="' + esc(hk.q) + '">' + hk.label + ' <span class="pp-hook-open">' + esc(T('pp.disc.open', 'open ↗')) + '</span></button>';
      } else if (hk.go) {
        h += '<button type="button" class="pp-hook" data-ppgo="' + esc(hk.go) + '">' + hk.label + ' <span class="pp-hook-open">' + esc(T('pp.disc.open', 'open ↗')) + '</span></button>';
      }
    }
    h += '<div class="pp-strip-note">' + esc(T('pp.disc.note', 'or search a name — blood and marriage are labeled separately; same-name people are never silently chosen')) + '</div>';
    h += '</div>';
    return h;
  }

  /* ── "keep exploring" — the next curious click, derived not invented ───── */
  function teaserContext (p) {
    const ctx = {};
    try {
      if (archive.relationship) {
        ctx.cousinSpouses = p.spouses
          .map(sid => {
            const r = archive.relationship(p.id, sid);
            return (r && r.blood && r.affinity) ? { id: sid, name: (archive.getPerson(sid) || {}).name || sid } : null;
          })
          .filter(Boolean);
      }
      if (archive.pedigreeOccurrences && curRoot) {
        const ped = archive.pedigreeOccurrences(curRoot, 12);
        const n = ped.occurrences[p.id];
        if (n > 1) { ctx.pedigreeN = n; ctx.pedigreeGens = ped.gens; ctx.rootShort = shortName(curRoot); }
      }
      if (archive.nameShares) {
        const c = archive.nameShares(p.name);
        if (c > 1) ctx.nameShareCount = c;
      }
      if (archive.spineIndex && p.onSpine) ctx.spineIdx = archive.spineIndex(p.id);
    } catch (e) { /* optional methods never break the person view */ }
    return ctx;
  }

  function teasersHtml (p) {
    const teasers = buildTeasers(p, teaserContext(p));
    if (!teasers.length) return '';
    let h = '<section class="pp-sec pp-teasers"><h3 class="pp-h">' + esc(T('pp.teasers', 'keep exploring — one more ancestor')) + '</h3>';
    for (const t of teasers) {
      if (t.kind === 'cousins' || t.kind === 'cousins-more') {
        h += '<button type="button" class="pp-teaser" data-pprel="' + esc(t.a) + '|' + esc(t.b) + '">⚭ ' + esc(t.text) + '</button>';
      } else if (t.kind === 'namesakes') {
        h += '<button type="button" class="pp-teaser" data-ppq="' + esc(t.query) + '">⧉ ' + esc(t.text) + '</button>';
      } else {
        h += '<div class="pp-teaser pp-teaser-fact">⊙ ' + esc(t.text) + '</div>';
      }
    }
    h += '</section>';
    return h;
  }

  function personHtml (id) {
    const p = archive.getPerson(id);
    if (!p) return '<div class="pp-none">unknown person</div>';
    let h = '<article class="pp-person" data-ppid="' + esc(id) + '">';
    h += '<h2 class="pp-name" tabindex="-1">' + esc(p.name) + '</h2>';
    if (p.lifespan) h += '<div class="pp-years">' + esc(p.lifespan) + '</div>';
    h += '<div class="pp-chips">' + chipsHtml(p) + '</div>';
    h += relToRootHtml(p);
    h += familyHtml(p);
    h += frontierHtml(p);
    h += layersHtml(p);
    h += teasersHtml(p);
    h += '<section class="pp-sec"><h3 class="pp-h">' + esc(T('pp.bnr', 'blood address')) + '</h3>' +
      '<div class="pp-bnr">' + esc(p.bnr) + '</div></section>';
    h += '<div class="pp-actions">' +
      '<button type="button" class="pp-act" data-pproot="' + esc(id) + '">' + esc(T('pp.reroot', 'stand here (re-root)')) + ' <kbd>R</kbd></button>' +
      '<button type="button" class="pp-act pp-ghost" data-pparchive="' + esc(id) + '">' + esc(T('pp.openarchive', 'open the person archive')) + ' <kbd>O</kbd></button>' +
      '</div></article>';
    return h;
  }

  /* ── ambiguity view ────────────────────────────────────────────────────── */
  function ambiguityHtml (v) {
    let h = '<article class="pp-ambig"><h2 class="pp-name" tabindex="-1">' + esc(T('pp.ambig.title', 'which one?')) + '</h2>' +
      '<div class="pp-ambig-head">' + esc(ambiguityHeadline({ status: 'ambiguous', query: v.query, exact: v.exact, candidates: v.candidates })) + '</div><div class="pp-cands">';
    v.candidates.forEach((cid, i) => {
      const p = archive.getPerson(cid);
      const ctx = archive.genContext(cid, curRoot);
      const ref = (p.refs && p.refs[0]) ? ' · FS ' + p.refs[0].id : '';
      h += '<button type="button" class="pp-res" data-ppgo="' + esc(cid) + '" data-hi="' + i + '">' +
        '<span class="pp-res-name"><b>' + esc(p.name) + '</b></span>' +
        '<span class="pp-res-sub">' + esc(p.lifespan || (p.living ? 'living — redacted stub' : 'lifespan unknown')) + ' · ' + esc(p.era || p.tier) + ref + (p.onSpine ? ' · on the spine' : '') + '</span>' +
        '<span class="pp-res-ctx">' + esc(genContextText(ctx, curRoot ? shortName(curRoot) : '')) + '</span>' +
        '</button>';
    });
    h += '</div><div class="pp-sec-note">' + esc(T('pp.ambig.note', 'same-name people are different people — lifespans, era, provider record, and position relative to where you stand tell them apart')) + '</div></article>';
    return h;
  }

  /* ── relationship view (any pair) ──────────────────────────────────────── */
  function relationshipHtml (aId, bId) {
    const rel = archive.relationship(aId, bId);
    const A = archive.getPerson(aId), B = archive.getPerson(bId);
    let h = '<article class="pp-relview" data-pprelview="' + esc(aId) + '|' + esc(bId) + '">';
    h += '<h2 class="pp-name" tabindex="-1">' + esc(A ? A.name : aId) + ' ↔ ' + esc(B ? B.name : bId) + '</h2>';
    h += '<div class="pp-rel-line">' + esc(relationshipSummary(rel, nameOf)) + '</div>';
    h += '<div class="pp-kindchip kind-' + esc(rel.kind) + '">' + esc(rel.kind) + '</div>';
    h += '<div class="pp-endpoints">';
    h += '<span class="pp-end" data-ppgo="' + esc(aId) + '" role="button" tabindex="0">' + esc(A ? A.name : aId) + (A && A.lifespan ? ' · ' + esc(A.lifespan) : '') + '</span>';
    h += '<span class="pp-end-sep"> ↔ </span>';
    h += '<span class="pp-end" data-ppgo="' + esc(bId) + '" role="button" tabindex="0">' + esc(B ? B.name : bId) + (B && B.lifespan ? ' · ' + esc(B.lifespan) : '') + '</span></div>';
    h += relChainsHtml(rel);
    h += '<div class="pp-sec-note">' + esc(T('pp.rel.evnote', 'hover any hop for its evidence — walked provider links, tradition-carried overlays, and disputed edges are distinct claims')) + '</div>';
    h += '</article>';
    return h;
  }

  /* ── render + events ───────────────────────────────────────────────────── */
  function render () {
    backbar.hidden = stack.length === 0;
    if (view.type === 'person') viewEl.innerHTML = personHtml(view.id);
    else if (view.type === 'relationship') viewEl.innerHTML = relationshipHtml(view.a, view.b);
    else if (view.type === 'ambiguity') viewEl.innerHTML = ambiguityHtml(view);
    else if (view.type === 'empty-search') {
      /* search as discovery, not database: a miss offers the surname's people */
      let rescue = '';
      const last = String(view.query || '').trim().split(/\s+/).pop() || '';
      if (last.length >= 3 && archive.search) {
        const near = archive.search(last, 3).filter(r => r.person.name !== view.query);
        if (near.length) {
          rescue = '<div class="pp-rescue">' + esc(T('pp.search.rescue', 'but {n} people carry the name “{last}”:').replace('{n}', String(archive.search(last, 12).length)).replace('{last}', esc(last))) + '</div><div class="pp-cands">';
          for (const r of near) {
            const ctx = archive.genContext ? archive.genContext(r.person.id, curRoot) : null;
            rescue += '<button type="button" class="pp-res" data-ppgo="' + esc(r.person.id) + '">' +
              '<span class="pp-res-name">' + esc(r.person.name) + '</span>' +
              '<span class="pp-res-sub">' + esc(r.person.lifespan || 'lifespan unknown') + ' · ' + esc(r.person.era || r.person.tier) + '</span>' +
              '<span class="pp-res-ctx">' + esc(genContextText(ctx, curRoot ? shortName(curRoot) : '')) + '</span></button>';
          }
          rescue += '</div>';
        }
      }
      viewEl.innerHTML = '<div class="pp-none">' + esc(T('pp.search.nullview', '“{q}” matches no one in the published archive — the walk has a frontier.').replace('{q}', view.query)) + '</div>' + rescue;
    } else {
      viewEl.innerHTML = discoveriesHtml();
    }
  }

  function onHostClick (e) {
    const t = e.target.closest('[data-ppgo],[data-pprel],[data-pproot],[data-pparchive],[data-ppq],.pp-back');
    if (!t) return;
    if (t === backBtn || t.classList.contains('pp-back')) { back(); return; }
    if (t.hasAttribute('data-ppgo')) { choosePerson(t.getAttribute('data-ppgo')); return; }
    if (t.hasAttribute('data-ppq')) {
      resultsEl.hidden = true;
      pushContext();
      const r = archive.resolve(t.getAttribute('data-ppq'));
      if (r.status === 'hit') setView({ type: 'person', id: r.person.id, fromQuery: r.query });
      else if (r.status === 'ambiguous') setView({ type: 'ambiguity', query: r.query, exact: r.exact, candidates: r.candidates.map(c => c.id) });
      else setView({ type: 'empty-search', query: r.query });
      return;
    }
    if (t.hasAttribute('data-pprel')) {
      const pair = t.getAttribute('data-pprel').split('|');
      pushContext();
      setView({ type: 'relationship', a: pair[0], b: pair[1] });
      return;
    }
    if (t.hasAttribute('data-pproot')) { setRoot(t.getAttribute('data-pproot')); return; }
    if (t.hasAttribute('data-pparchive')) { openArchive(t.getAttribute('data-pparchive')); return; }
  }

  function onHostKeydown (e) {
    const inInput = e.target === qEl;
    if (inInput) return;
    if (e.key === 'Escape') { back(); return; }
    if (e.key === '/') { e.preventDefault(); qEl.focus(); qEl.select(); return; }
    if (e.altKey && e.key === 'ArrowLeft') { back(); return; }
    if ((e.key === 'r' || e.key === 'R') && view.type === 'person') { setRoot(view.id); return; }
    if ((e.key === 'o' || e.key === 'O') && view.type === 'person') { openArchive(view.id); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pp-hopnode')) {
      e.preventDefault();
      const id = e.target.getAttribute('data-ppgo');
      if (id) choosePerson(id);
    }
  }

  function openArchive (id) {
    if (o.openPersonPage) { o.openPersonPage(id); return; }
    /* default: the staged person page, same-origin (external-nav law) */
    window.location.href = '../assets/profile-archive/lineage/persons/' + encodeURIComponent(id) + '.html';
  }

  function setRoot (id) {
    if (!archive.getPerson(id) || id === curRoot) return;
    curRoot = id;
    render();
    if (o.onreroot) { try { o.onreroot(id); } catch (e) {} }
    notify();
  }

  function back () {
    if (!stack.length) return;
    const prev = stack.pop();
    restoreScroll(prev.scroll);
    view = prev.view;
    render();
    notify();
  }

  qEl.addEventListener('input', onQInput);
  qEl.addEventListener('keydown', onQKeydown);
  host.addEventListener('click', onHostClick);
  host.addEventListener('keydown', onHostKeydown);

  render();
  return {
    openPerson (id) { choosePerson(id); },
    openRelationship (a, b) { pushContext(); setView({ type: 'relationship', a, b }); },
    resolveAndOpen (q) { qEl.value = q; resolveAndOpen(q); },
    search (q) { qEl.value = q; onQInput(); },
    setRoot (id) { setRoot(id); },
    back,
    home () { pushContext(); setView({ type: 'empty' }); },
    state: publicState,
    get root () { return curRoot; },
    destroy () {
      qEl.removeEventListener('input', onQInput);
      qEl.removeEventListener('keydown', onQKeydown);
      host.removeEventListener('click', onHostClick);
      host.removeEventListener('keydown', onHostKeydown);
      host.innerHTML = '';
      host.classList.remove('pp');
      host.removeAttribute('data-pp');
    }
  };
}
