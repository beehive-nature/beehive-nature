/* tree-of-life.mjs — austras koks, the Tree of Life navigator (2026-09-22).
   One public corpus (skaists.lineage/2, privatized, with `lines`), several
   family lines, three readings. It renders only what the corpus holds: it
   never names a living person, never invents a claim, never re-derives who
   is living — privatize() and validate({public:true}) already did that.

   ── CONTRACT ─────────────────────────────────────────────────────────────
     import { mountTreeOfLife } from './tree-of-life.mjs';
     const tree = mountTreeOfLife(hostEl, corpus, {
       openPerson(id){...},   // the existing person explanation (person panel)
       closePerson(){...},    // optional: the state holds no open person
       words: {...},          // optional: this surface's tongue (see WORDS)
       depth: n,              // optional: fixed generations above the focus;
                              //   default picks from the host's width
       history: true,         // default: navigation lives in location.hash, so
                              //   browser Back restores the exact prior tree
     });
     tree.go({ l, f, p }) · tree.state() · tree.destroy()

   STATE (all of it, in the hash): #l=<line key>&f=<focus id>&p=<person id>
     l — which family line; f — the person the view climbs from (default: the
     line's own start); p — the person whose card is open. The register is a
     preference, read from <html data-reg>, and changes reading, never state.

   THE THREE READINGS take the SAME view (same people, same links, same
   counts) and differ only in layout and dress:
     bee        — the fir: the line's start is the trunk, branches widen upward
     raver      — the branch spun into a mandala, the start at the heart
     cypherpunk — levels, straight chords, ids and evidence standing
   No words live inside the art: the svg carries branches only; every name
   is an html control laid over it, so it is tappable and translatable.

   Pure helpers are exported for Node tests (tools/genealogy/treeoflife-nav.test.mjs). */

export const TOL_VERSION = 'tree-of-life/1';
export const DEPTH = 4; // generations shown above the focus

export const WORDS = {
  lines: 'family lines',
  'line.founder': 'founder line',
  'line.spouse': 'spouse line {n}',
  heldMany: '{n} living generations held. living people stay out. always.',
  heldOne: '1 living generation held. living people stay out. always.',
  heldNone: 'no living generation stands between this line and its first ancestors.',
  emerges: 'this line comes into the open at {names}.',
  living: 'living · held',
  follow: 'follow this branch',
  story: 'open the full story',
  whole: 'the whole line',
  focusOn: 'climbing from {name}',
  focusHeld: 'climbing from a held living generation',
  limb: 'follow the branch toward {name}',
  more: '{n} more above',
  datesUnknown: 'dates not known yet',
  claimsHead: 'language and culture, as the sources say',
  claimsNone: 'no language or culture is sourced for this person yet.',
  'kind.language': 'spoke',
  'kind.people': 'people',
  'kind.polity': 'lived under',
  'kind.religion': 'faith',
  'kind.region': 'region',
  'kind.house': 'house',
  'kind.title': 'title',
  span: '{from} to {to}',
  spanFrom: 'from {from}',
  spanTo: 'until {to}',
  spanNone: 'when is not known yet',
  source: 'source: {s}',
  bc: '{n} BC',
  gen: 'generation {n}',
  support: 'standing: {s}',
  close: 'close',
  noLine: 'this family line is not in the archive.',
};

/* ── pure helpers ─────────────────────────────────────────────────────── */

export function fill(s, slots) {
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (slots && slots[k] !== undefined ? slots[k] : m));
}

const ID = /^[A-Za-z0-9_-]+$/;
export function encodeState(st) {
  const parts = [];
  for (const k of ['l', 'f', 'p']) if (st && st[k] && ID.test(st[k])) parts.push(k + '=' + st[k]);
  return parts.length ? '#' + parts.join('&') : '';
}
export function decodeState(hash) {
  const out = { l: null, f: null, p: null };
  for (const part of String(hash || '').replace(/^#/, '').split('&')) {
    const [k, v] = part.split('=');
    if ((k === 'l' || k === 'f' || k === 'p') && v && ID.test(v)) out[k] = v;
  }
  return out;
}

export function lineName(key, words = WORDS) {
  if (key === 'founder') return words['line.founder'];
  const m = /^spouse-(\d+)$/.exec(key || '');
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return m ? fill(words['line.spouse'], { n: ROMAN[m[1] - 1] || m[1] }) : String(key);
}

export function yearText(y, words = WORDS) {
  return y < 0 ? fill(words.bc, { n: -y }) : String(y);
}

// only claims that carry a source are ever shown (public validation already
// refuses the rest; this is the renderer declining to be the weak link)
export function claimLines(person, words = WORDS) {
  const claims = (person && Array.isArray(person.cultureClaims) ? person.cultureClaims : [])
    .filter((c) => c && typeof c.source === 'string' && c.source.trim() && c.value);
  return claims.map((c) => {
    const f = Number.isInteger(c.from) ? yearText(c.from, words) : null;
    const t = Number.isInteger(c.to) ? yearText(c.to, words) : null;
    const when = f && t ? fill(words.span, { from: f, to: t }) : f ? fill(words.spanFrom, { from: f }) : t ? fill(words.spanTo, { to: t }) : words.spanNone;
    return { kind: words['kind.' + c.kind] || c.kind, value: c.value, when, source: fill(words.source, { s: c.source }), note: c.note || null };
  });
}

// The view: focus at generation 0, its ancestors up to `depth`, each placed
// in an ahnentafel slot so every reading draws the same shape. A person met
// twice (pedigree collapse) keeps their first slot; the second meeting is a
// link to the first, never a duplicate person.
export function lineView(corpus, lineKey, focusId, depth = DEPTH) {
  const line = (corpus.lines || []).find((l) => l.key === lineKey) || null;
  if (!line) return null;
  const P = corpus.persons || {}, E = corpus.edges || {};
  const focus = focusId && P[focusId] ? focusId : line.root;
  const nodes = [], links = [], at = new Map();
  let frontier = P[focus] ? [{ id: focus, slot: 0 }] : [];
  for (let gen = 0; frontier.length && gen <= depth; gen++) {
    const next = [];
    for (const { id, slot } of frontier) {
      if (at.has(id)) continue;
      const p = P[id];
      const parents = (E[id] || []).filter((x) => P[x]);
      const node = { id, gen, pos: (slot + 0.5) / 2 ** gen, living: !!p.living,
        name: p.living ? null : p.name, lifespan: p.living ? null : (p.lifespan || null),
        support: p.living ? null : (p.evidence && p.evidence.support) || null,
        claims: p.living ? 0 : claimLines(p).length, above: 0 };
      nodes.push(node);
      at.set(id, node);
      if (gen === depth) { node.above = parents.length; continue; }
      parents.forEach((pid, i) => {
        links.push({ child: id, parent: pid });
        next.push({ id: pid, slot: slot * 2 + (parents.length === 1 ? 0.5 : i) });
      });
    }
    frontier = next;
  }
  const shown = new Set(nodes.map((n) => n.id));
  return {
    line, focus, nodes,
    links: links.filter((k) => shown.has(k.parent)),
    held: nodes.filter((n) => n.living).length,
  };
}

// How many generations fit: the widest row of a depth-d view holds 2^d
// names, each needing ~85px. Width decides; the reading never does, so all
// three readings always show the same people.
export function pickDepth(px) {
  if (!(px > 0)) return 3;
  return Math.min(4, Math.max(2, Math.floor(Math.log2(px / 85))));
}

// Layout in a 0..100 box; the three readings share the view, not a picture.
// Every node gets a width w (%) so no name can overflow its slot.
export function layout(view, reg, px = 600) {
  const depth = Math.max(1, ...view.nodes.map((n) => n.gen));
  const rowMax = Math.max(1, ...[...countRows(view.nodes).values()]);
  const pos = {};
  if (reg === 'raver') {
    // the heart is compact; ring 1 sits just clear of it, the last ring at 38
    for (const n of view.nodes)
      pos[n.id] = { a: -Math.PI / 2 + (n.pos - 0.5) * Math.PI * 1.7,
        r: n.gen === 0 ? 0 : 20 + ((n.gen - 1) / Math.max(1, depth - 1)) * 18, w: n.gen === 0 ? 16 : 22 };
    spaceRings(view.nodes, pos, 22);
    unclash(view.nodes, pos, (60 / px) * 100);
  } else {
    const w = Math.min(reg === 'cypherpunk' ? 24 : 26, 96 / rowMax - 1.5);
    for (const n of view.nodes) {
      const spread = reg === 'cypherpunk' ? 1 : 0.6 + 0.4 * (n.gen / depth); // the fir widens upward
      pos[n.id] = { x: 50 + (n.pos - 0.5) * 92 * spread, y: 88 - (n.gen / depth) * 72, w };
    }
    spaceOut(view.nodes, pos, w);
  }
  const paths = view.links.map(({ child, parent }) => {
    const a = pos[child], b = pos[parent];
    let d;
    if (reg === 'cypherpunk') d = `M${a.x},${a.y} L${b.x},${b.y}`;
    else if (reg === 'raver') d = `M${a.x},${a.y} Q${(a.x + b.x) / 2 + (b.y - a.y) * 0.25},${(a.y + b.y) / 2 - (b.x - a.x) * 0.25} ${b.x},${b.y}`;
    else d = `M${a.x},${a.y} C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2 + 4} ${b.x},${b.y}`;
    return { child, parent, d };
  });
  return { pos, paths };
}

function countRows(nodes) {
  const c = new Map();
  for (const n of nodes) c.set(n.gen, (c.get(n.gen) || 0) + 1);
  return c;
}
function byGen(nodes) {
  const rows = new Map();
  for (const n of nodes) (rows.get(n.gen) || rows.set(n.gen, []).get(n.gen)).push(n.id);
  return rows;
}

// A generation's names must not sit on each other. Keep slot order, push
// neighbours at least one node width apart, re-centre the row on where it
// wanted to be, and keep every whole node inside the box.
function spaceOut(nodes, pos, w) {
  const gap = w + 1.5, lo = w / 2 + 1, hi = 100 - w / 2 - 1;
  for (const ids of byGen(nodes).values()) {
    ids.sort((a, b) => pos[a].x - pos[b].x);
    const want = ids.reduce((s, id) => s + pos[id].x, 0) / ids.length;
    const xs = ids.map((id) => pos[id].x);
    for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + gap);
    const shift = want - xs.reduce((s, x) => s + x, 0) / xs.length;
    const d = Math.min(Math.max(shift, lo - Math.min(...xs)), hi - Math.max(...xs));
    ids.forEach((id, i) => { pos[id].x = xs[i] + d; });
  }
}

// The mandala's version: each ring keeps its order around the heart and its
// names at least a node width (plus air) apart along the arc, centred on
// where they wanted to sit. The heart is (50, 50).
function spaceRings(nodes, pos, w) {
  for (const ids of byGen(nodes).values()) {
    const r = pos[ids[0]].r;
    if (r > 0 && ids.length > 1) {
      ids.sort((a, b) => pos[a].a - pos[b].a);
      const gap = Math.min((2 * Math.PI) / ids.length, 2 * Math.asin(Math.min(1, (w + 4) / (2 * r))));
      const as = ids.map((id) => pos[id].a);
      for (let i = 1; i < as.length; i++) as[i] = Math.max(as[i], as[i - 1] + gap);
      const shift = (ids.reduce((s, id) => s + pos[id].a, 0) - as.reduce((s, x) => s + x, 0)) / ids.length;
      ids.forEach((id, i) => { pos[id].a = as[i] + shift; });
    }
    for (const id of ids) {
      const { a, r: rr } = pos[id];
      pos[id] = { x: 50 + rr * Math.cos(a), y: 50 + rr * Math.sin(a), w: pos[id].w };
    }
  }
}

// Near the horizontal a parent and its child can sit at almost the same
// angle, and no ring spacing separates two wide names there. Place ring by
// ring: each node keeps its spot if it is clear, else tries the nearest
// angles (and then a little more radius) until it touches nothing already
// placed and stays inside the box. Deterministic; the order is the slot order.
function unclash(nodes, pos, h) {
  const placed = [];
  const clear = (p) => p.x - p.w / 2 >= 1 && p.x + p.w / 2 <= 99 && p.y - h / 2 >= 1 && p.y + h / 2 <= 99 &&
    placed.every((q) => Math.abs(p.x - q.x) >= (p.w + q.w) / 2 + 1 || Math.abs(p.y - q.y) >= h + 1);
  const order = [...nodes].sort((a, b) => a.gen - b.gen || pos[a.id].x - pos[b.id].x);
  for (const n of order) {
    const p = pos[n.id];
    if (n.gen > 0 && !clear(p)) {
      const r0 = Math.hypot(p.x - 50, p.y - 50), a0 = Math.atan2(p.y - 50, p.x - 50);
      search: for (const dr of [0, 3, 6]) for (let k = 1; k <= 40; k++) for (const sgn of [1, -1]) {
        const a = a0 + sgn * k * 0.04, r = r0 + dr;
        const c = { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a), w: p.w };
        if (clear(c)) { p.x = c.x; p.y = c.y; break search; }
      }
    }
    placed.push(p);
  }
}

export function heldText(n, words = WORDS) {
  return n === 0 ? words.heldNone : n === 1 ? words.heldOne : fill(words.heldMany, { n });
}

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── the mount (browser only) ─────────────────────────────────────────── */

export function mountTreeOfLife(host, corpus, opts = {}) {
  const words = Object.assign({}, WORDS, opts.words || {});
  const useHistory = opts.history !== false && typeof window !== 'undefined';
  const doc = host.ownerDocument;
  const reg = () => (doc.documentElement.dataset.reg === 'raver' || doc.documentElement.dataset.reg === 'cypherpunk') ? doc.documentElement.dataset.reg : 'bee';
  const lines = corpus.lines || [];
  let st = { l: null, f: null, p: null };

  function normalize(s) {
    const l = lines.some((x) => x.key === s.l) ? s.l : (lines[0] && lines[0].key) || null;
    const P = corpus.persons || {};
    // a living id in the hash opens nothing: stubs have no card
    const f = s.f && P[s.f] ? s.f : null;
    const p = s.p && P[s.p] && !P[s.p].living ? s.p : null;
    return { l, f, p };
  }

  function go(next, { push = true } = {}) {
    st = normalize(Object.assign({}, st, next));
    if (useHistory && push) {
      const h = encodeState(st);
      if (h !== location.hash) history.pushState(null, '', h || location.pathname + location.search);
    }
    render();
    follow();
  }

  // the host's person explanation follows the state both ways, so Back
  // closes a story it opened
  function follow() {
    if (st.p && opts.openPerson) opts.openPerson(st.p);
    else if (!st.p && opts.closePerson) opts.closePerson();
  }

  function render() {
    const r = reg();
    const view = st.l ? lineView(corpus, st.l, st.f, opts.depth || pickDepth(host.clientWidth)) : null;
    if (!view) { host.innerHTML = `<p class="tol-note">${esc(words.noLine)}</p>`; return; }
    const { pos, paths } = layout(view, r, host.clientWidth || 600);
    const P = corpus.persons;
    const entryNames = view.line.entries.map((id) => P[id] && P[id].name).filter(Boolean);
    const focusP = P[view.focus];

    const tabs = lines.map((l) => `<button type="button" class="tol-tab" data-line="${esc(l.key)}" aria-pressed="${l.key === st.l}">${esc(lineName(l.key, words))}</button>`).join('');

    const svg = `<svg class="tol-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${r === 'bee' ? '<path class="tol-root" d="M50,92 q -6,5 -12,6 M50,92 q 6,5 12,6 M50,92 v7" />' : r === 'raver' ? '<circle class="tol-root" cx="50" cy="50" r="44" />' : ''}
      ${paths.map((k) => `<path class="tol-branch${P[k.parent] && P[k.parent].living ? ' is-held' : ''}" d="${k.d}" />`).join('')}
    </svg>
    <svg class="tol-hit" viewBox="0 0 100 100" preserveAspectRatio="none">
      ${paths.filter((k) => P[k.parent]).map((k) => {
        const who = P[k.parent].living ? words.living : P[k.parent].name;
        return `<path class="tol-limb" d="${k.d}" data-focus="${esc(k.parent)}" tabindex="0" role="button" aria-label="${esc(fill(words.limb, { name: who }))}" />`;
      }).join('')}
    </svg>`;

    const nodes = view.nodes.map((n) => {
      const { x, y } = pos[n.id];
      const style = `inset-inline-start:${x}%;top:${y}%;width:${pos[n.id].w}%`;
      if (n.living)
        return `<div class="tol-node is-held" style="${style}"><span class="tol-lock" aria-hidden="true"></span><span class="tol-cap">${esc(words.living)}</span>${n.above ? `<button type="button" class="tol-climb" data-focus="${esc(n.id)}">${esc(fill(words.more, { n: n.above }))}</button>` : ''}</div>`;
      const meta = r === 'cypherpunk'
        ? `<span class="tol-cap tol-mono">${esc(n.id)}</span><span class="tol-cap tol-mono">${esc(n.lifespan || words.datesUnknown)}</span>`
        : `<span class="tol-cap">${esc(n.lifespan || words.datesUnknown)}</span>`;
      const more = n.above ? `<span class="tol-more">${esc(fill(words.more, { n: n.above }))}</span>` : '';
      return `<button type="button" class="tol-node${n.id === st.p ? ' is-open' : ''}${n.claims ? ' has-claims' : ''}" style="${style}" data-person="${esc(n.id)}" aria-pressed="${n.id === st.p}">
        <span class="tol-name">${esc(n.name)}</span>${meta}${more}</button>`;
    }).join('');

    const card = st.p ? personCard(P[st.p], st.p) : '';
    const focusLine = st.f && focusP
      ? `<p class="tol-focus">${esc(focusP.living ? words.focusHeld : fill(words.focusOn, { name: focusP.name }))} <button type="button" class="tol-quiet" data-whole>${esc(words.whole)}</button></p>`
      : '';

    host.innerHTML = `
      <nav class="tol-lines" aria-label="${esc(words.lines)}">${tabs}</nav>
      ${focusLine}
      <div class="tol-stage" data-reading="${r}">${svg}${nodes}</div>
      <div class="tol-guard" role="note"><span class="tol-lock" aria-hidden="true"></span><span>${esc(heldText(view.line.bridge, words))}</span></div>
      ${entryNames.length ? `<p class="tol-note">${esc(fill(words.emerges, { names: entryNames.join(' · ') }))}</p>` : ''}
      ${card}`;
  }

  function personCard(p, id) {
    const cl = claimLines(p, words);
    const claims = cl.length
      ? `<ul class="tol-claims">${cl.map((c) => `<li><span class="tol-kind">${esc(c.kind)}</span> <strong>${esc(c.value)}</strong> <span class="tol-when">${esc(c.when)}</span><span class="tol-src">${esc(c.source)}${c.note ? ' · ' + esc(c.note) : ''}</span></li>`).join('')}</ul>`
      : `<p class="tol-note">${esc(words.claimsNone)}</p>`;
    const canClimb = (corpus.edges[id] || []).some((x) => corpus.persons[x]);
    return `<section class="tol-card" aria-label="${esc(p.name)}">
      <h3 class="tol-card-name">${esc(p.name)}</h3>
      <p class="tol-card-dates">${esc(p.lifespan || words.datesUnknown)}</p>
      <p class="tol-card-support tol-reg-cypherpunk">${esc(fill(words.support, { s: (p.evidence && p.evidence.support) || '' }))} · ${esc(id)}</p>
      <h4 class="tol-card-head">${esc(words.claimsHead)}</h4>
      ${claims}
      <div class="tol-actions">
        ${canClimb ? `<button type="button" class="tol-primary" data-focus="${esc(id)}">${esc(words.follow)}</button>` : ''}
        ${opts.openPerson ? `<button type="button" class="tol-quiet" data-story="${esc(id)}">${esc(words.story)}</button>` : ''}
        <button type="button" class="tol-quiet" data-close>${esc(words.close)}</button>
      </div>
    </section>`;
  }

  function onClick(e) {
    const t = e.target.closest('[data-line],[data-person],[data-focus],[data-story],[data-close],[data-whole]');
    if (!t || !host.contains(t)) return;
    if (t.dataset.line) go({ l: t.dataset.line, f: null, p: null });
    else if (t.dataset.person) go({ p: t.dataset.person });
    else if (t.dataset.focus) go({ f: t.dataset.focus, p: null });
    else if (t.dataset.story && opts.openPerson) opts.openPerson(t.dataset.story);
    else if (t.hasAttribute('data-close')) go({ p: null });
    else if (t.hasAttribute('data-whole')) go({ f: null, p: null });
  }
  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tol-limb')) { e.preventDefault(); onClick(e); }
  }
  function onPop() { st = normalize(decodeState(location.hash)); render(); follow(); }
  const obs = typeof MutationObserver !== 'undefined' ? new MutationObserver(render) : null;

  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  if (useHistory) window.addEventListener('popstate', onPop);
  if (obs) obs.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-reg'] });

  st = normalize(useHistory ? decodeState(location.hash) : {});
  render();
  follow();

  return {
    go: (s) => go(s),
    state: () => Object.assign({}, st),
    destroy() {
      host.removeEventListener('click', onClick);
      host.removeEventListener('keydown', onKey);
      if (useHistory) window.removeEventListener('popstate', onPop);
      if (obs) obs.disconnect();
      host.innerHTML = '';
    },
  };
}
