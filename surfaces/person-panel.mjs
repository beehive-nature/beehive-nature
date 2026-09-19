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

export const PP_VERSION = 'person-panel/1';

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
   * AND for arbitrary pairs opened from a parent/spouse row */
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
      }
    }
    if (rel.affinity) {
      h += '<div class="pp-chain pp-affinity">' + chainHtml(rel.affinity.hopsFromRoot, rel.b) + '</div>' +
        '<div class="pp-ca-line">' + esc(T('pp.rel.affinity', 'affinity — marriage; never described as blood')) + '</div>';
    }
    if (rel.kind === 'blood-and-affinity') {
      h += '<div class="pp-coexist">' + esc(T('pp.rel.coexist', 'blood AND affinity coexist for this pair — married cousins; both are true and separately labeled')) + '</div>';
    }
    if (rel.cyclic) {
      h += '<div class="pp-cyclic">↻ ' + esc(T('pp.rel.cyclic', 'the shortest recorded line passes through a cyclic record (the medieval web loops) — the archive shows the shortest honest way, never an invented cleaner one')) + '</div>';
    }
    if (rel.kind === 'none') {
      h += '<div class="pp-none">' + esc(rel.note || T('pp.rel.none', 'no shared line within the published archive')) + '</div>';
    }
    return h;
  }

  /* a chain of labeled, clickable hops starting at startId */
  function chainHtml (hops, startId) {
    const start = archive.getPerson(startId);
    let h = '<span class="pp-hopnode" data-ppgo="' + esc(startId) + '" role="button" tabindex="0">' + esc(start ? (start.living ? start.name : shortName(startId)) : startId) + '</span>';
    for (const hop of hops) {
      const p = archive.getPerson(hop.to);
      h += ' <span class="pp-hop" title="' + esc(hop.evidence) + '">' + hopArrow(hop) + esc(hop.label) + '</span> ';
      h += '<span class="pp-hopnode" data-ppgo="' + esc(hop.to) + '" role="button" tabindex="0">' +
        esc(p ? (p.living ? p.name : shortName(hop.to)) : hop.to) + '</span>';
    }
    return h;
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
      viewEl.innerHTML = '<div class="pp-none">' + esc(T('pp.search.nullview', '“{q}” matches no one in the published archive — the walk has a frontier.').replace('{q}', view.query)) + '</div>';
    } else {
      viewEl.innerHTML = '<div class="pp-empty">' + esc(T('pp.empty', 'search a name — or walk from the standing root — to read a person. Blood and marriage are labeled separately; same-name people are never silently chosen.')) + '</div>';
    }
  }

  function onHostClick (e) {
    const t = e.target.closest('[data-ppgo],[data-pprel],[data-pproot],[data-pparchive],.pp-back');
    if (!t) return;
    if (t === backBtn || t.classList.contains('pp-back')) { back(); return; }
    if (t.hasAttribute('data-ppgo')) { choosePerson(t.getAttribute('data-ppgo')); return; }
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
