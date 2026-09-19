// ?? blood-nav.mjs ? the GUX-01 zGeneUI navigation layer for the blood comb.
//   Slice 1: interaction correctness. Load order law: blood.html's classic
//   script boots the corpus and exposes globalThis.BloodComb; this module
//   (deferred, type=module) wires navigation on top and never renders data.
//
//   What this module owns (and unit-tests in tools/genealogy/bloodnav.test.mjs):
//     - selection as STATE (S.sel), preserved across view switches and re-roots
//     - drag / pinch never selects a person (movement threshold + click suppression)
//     - keyboard navigation: arrows walk relationships, R re-roots (a separate
//       action, never the same gesture as selection), O opens the archive,
//       / focuses search, Home resets, Escape collapses the mobile drawer
//     - URL context: #p=<id>&v=<view>&r=<root>&s=<scale>&x=<tx>&y=<ty> ?
//       back/forward restore the whole exploration context; plain legacy
//       #p=<id> links keep their exact old meaning
//     - one-shot sessionStorage context so returning from a person archive
//       page lands the visitor where they were (view + root + selection + zoom)
//     - semantic zoom LOD: far = structure only, mid = near people, near = reading
//     - search-result focus: center the viewport on the selected person when
//       they are in the current view; when they are not, say so honestly and
//       offer re-root / archive instead of pretending the branch is empty
//
//   Pure helpers are exported for Node tests; everything touching the DOM
//   lives behind wire() and browser guards. No corpus writes, no fetches.

/* ---------- pure helpers (Node-testable) ---------- */

// encode a navigation context into a hash string; fields may be missing.
export function encodeCtx(ctx) {
  ctx = ctx || {};
  var parts = [];
  if (ctx.p) parts.push('p=' + ctx.p);
  if (ctx.v) parts.push('v=' + ctx.v);
  if (ctx.r) parts.push('r=' + ctx.r);
  if (typeof ctx.s === 'number' && isFinite(ctx.s)) parts.push('s=' + ctx.s.toFixed(2));
  if (typeof ctx.x === 'number' && isFinite(ctx.x)) parts.push('x=' + Math.round(ctx.x));
  if (typeof ctx.y === 'number' && isFinite(ctx.y)) parts.push('y=' + Math.round(ctx.y));
  return parts.length ? '#' + parts.join('&') : '';
}

// decode a hash into a context object. Tolerant: junk is ignored, not thrown.
// Legacy forms preserved: '#p=<id>' (person deep link), '#myth' (doorway).
// GUX-01 beat 2b: the ONE view vocabulary is the engine's (pedigree|fractal|tree);
// legacy short forms (ped|fan) normalize into it on decode.
export function decodeHash(hash) {
  var out = { p: null, v: null, r: null, s: null, x: null, y: null, myth: false };
  var h = String(hash || '');
  if (!h) return out;
  if (/myth/.test(h)) out.myth = true;
  var m = h.match(/p=([A-Za-z0-9_-]+)/);
  if (m) out.p = m[1];
  m = h.match(/v=(pedigree|fractal|tree|ped|fan)/);
  if (m) out.v = mapView(m[1]);
  m = h.match(/r=([A-Za-z0-9_-]+)/);
  if (m) out.r = m[1];
  m = h.match(/s=([0-9.]+)/);
  if (m) { var s = parseFloat(m[1]); if (s >= 0.3 && s <= 4) out.s = s; }
  m = h.match(/x=(-?[0-9.]+)/); if (m) out.x = parseFloat(m[1]);
  m = h.match(/y=(-?[0-9.]+)/); if (m) out.y = parseFloat(m[1]);
  return out;
}

// the ONE view vocabulary mapper: legacy incumbent short names and the engine's
// full names converge; anything else is null (never a guess).
export function mapView(v) {
  if (v === 'ped' || v === 'pedigree') return 'pedigree';
  if (v === 'fan' || v === 'fractal') return 'fractal';
  if (v === 'tree') return 'tree';
  return null;
}

// derive the engine's createAtlas initial context from a decoded hash.
// The URL-derived state is the HISTORY BASE (advisor law): a deep link with
// only #p=<person> boots selection=person on the DEFAULT root; a full hash
// (#p=&v=&r=&s=&x=&y=) boots root+selection+view+camera exactly as written.
export function initialFromCtx(ctx, defaultRoot) {
  ctx = ctx || {};
  var t = {
    k: (typeof ctx.s === 'number' && isFinite(ctx.s)) ? ctx.s : 1,
    x: (typeof ctx.x === 'number' && isFinite(ctx.x)) ? ctx.x : 0,
    y: (typeof ctx.y === 'number' && isFinite(ctx.y)) ? ctx.y : 0
  };
  return {
    root: ctx.r || defaultRoot || null,
    selection: ctx.p || null,
    view: mapView(ctx.v) || 'pedigree',
    transform: t
  };
}

// hash sync for the mounted engine: blood-nav owns the ONE grammar; the
// surface calls this from the engine's onContext. replaceState only — the
// URL is derived state, never a second history stack.
export function syncHash(ctx, winRef) {
  var w = winRef || (typeof window !== 'undefined' ? window : null);
  var h = encodeCtx(ctx ? {
    p: ctx.selection || null,
    v: mapView(ctx.view) || null,
    r: ctx.root || null,
    s: ctx.transform && typeof ctx.transform.k === 'number' ? ctx.transform.k : null,
    x: ctx.transform && typeof ctx.transform.x === 'number' ? Math.round(ctx.transform.x) : null,
    y: ctx.transform && typeof ctx.transform.y === 'number' ? Math.round(ctx.transform.y) : null
  } : null);
  if (w && w.history && w.history.replaceState) {
    try { w.history.replaceState(null, '', h || w.location.pathname + w.location.search); } catch (e) { /* hashless environments */ }
  }
  return h;
}

// the one-shot return-from-archive session key (shared with the mounted panel's
// openPersonPage so both doorways return to the SAME context grammar).
export var RETURN_KEY = 'blood.ctx';

// semantic zoom: which reading level does this scale show?
export function lodFor(scale) {
  var s = Number(scale) || 1;
  if (s < 0.55) return 'far';
  if (s < 1.15) return 'mid';
  return 'near';
}

// did pointer movement turn this gesture into a pan (so the click that
// follows must NOT select a person)? Threshold in CSS pixels.
export function shouldSuppressClick(dx, dy, threshold) {
  var t = typeof threshold === 'number' ? threshold : 5;
  return Math.hypot(dx || 0, dy || 0) >= t;
}

// siblings via shared parents, deduplicated, self removed, order stable.
export function siblingsOf(id, edges, childrenMap) {
  var seen = {}; var out = [];
  ((edges && edges[id]) || []).forEach(function (parent) {
    ((childrenMap && childrenMap[parent]) || []).forEach(function (c) {
      if (c === id || seen[c]) return;
      seen[c] = 1; out.push(c);
    });
  });
  return out;
}

// the full sibling ring INCLUDING the person ? stepping left/right needs the
// current position, which a self-excluded list can never provide.
export function siblingRing(id, edges, childrenMap) {
  var ring = [id]; var seen = {}; seen[id] = 1;
  ((edges && edges[id]) || []).forEach(function (parent) {
    ((childrenMap && childrenMap[parent]) || []).forEach(function (c) {
      if (seen[c]) return;
      seen[c] = 1; ring.push(c);
    });
  });
  return ring;
}

// one keyboard step along a relationship. dir: 'up' first parent,
// 'down' first child, 'left'/'right' sibling cycle (wraps). null when the
// relationship does not exist ? a no-op, never a guess.
export function stepSelection(dir, cur, edges, childrenMap) {
  if (!cur) return null;
  if (dir === 'up') {
    var ps = (edges && edges[cur]) || [];
    return ps.length ? ps[0] : null;
  }
  if (dir === 'down') {
    var ch = (childrenMap && childrenMap[cur]) || [];
    return ch.length ? ch[0] : null;
  }
  if (dir === 'left' || dir === 'right') {
    var ring = siblingRing(cur, edges, childrenMap);
    if (ring.length < 2) return null;
    var i = ring.indexOf(cur);
    if (i < 0) return null;
    var d = dir === 'right' ? 1 : -1;
    return ring[(i + d + ring.length) % ring.length];
  }
  return null;
}

// the staged person archive page for an internal id (same-origin: stays in
// this tab, per the estate's external-navigation law).
export function archiveUrl(id) {
  return '../assets/profile-archive/lineage/persons/' + encodeURIComponent(id) + '.html';
}

/* ---------- the safe-direction relationship adapter (founder order f6320450) ---------- */

// Minimum-hop upward chain [from, ..., to] through PARENT edges only, or
// null when `to` is not reachable upward from `from`. Every hop is a
// child->parent step, so co-parenthood and collateral confusion are
// impossible by construction. THE ONLY relationship traversal zGeneUI ships
// until Archive Slice 1.1's corrected relationshipPath lands — when it does,
// this adapter is replaced in one place, never sprinkled around the surface.
// (archive objects are consumed read-only: presentation derives state, it
// never modifies archive truth.)
export function upPath(from, to, edges) {
  if (!from || !to || !edges) return null;
  if (from === to) return [from];
  var prev = {}; prev[from] = null;
  var queue = [from];
  while (queue.length) {
    var id = queue.shift();
    var ps = edges[id] || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p in prev) continue;
      prev[p] = id;
      if (p === to) {
        var chain = [to], cur = to;
        while (prev[cur] !== null) { cur = prev[cur]; chain.push(cur); }
        return chain.reverse();
      }
      queue.push(p);
    }
  }
  return null;
}

// the step label for one child->parent hop, from the parent's recorded gender
export function hopLabel(parentId, persons) {
  var g = persons && persons[parentId] && persons[parentId].gender;
  if (g === 'F' || g === 'FEMALE') return 'mother';
  if (g === 'M' || g === 'MALE') return 'father';
  return 'parent';
}

// the relationship-to-current-root read model for the detail panel. Both
// directions are PARENT-STEP ONLY (safe by construction, founder order
// f6320450): 'below' = the current root is an ancestor of the selection
// (chain sel -> ... -> root); 'above' = the selection is an ancestor of the
// current root (chain root -> ... -> sel); hops are labeled mother/father/
// parent. 'none' renders as an honest boundary — never an empty family,
// never a guessed sideways/downward claim (those wait for Archive 1.1).
export function relToRoot(selId, ctx) {
  ctx = ctx || {};
  if (!selId || selId === ctx.curRoot) return { kind: 'none', self: true };
  var below = upPath(selId, ctx.curRoot, ctx.edges);
  var above = below ? null : upPath(ctx.curRoot, selId, ctx.edges);
  var chain = below || above;
  if (!chain) return { kind: 'none' };
  var steps = [];
  for (var i = 0; i < chain.length; i++) {
    var p = ctx.persons && ctx.persons[chain[i]];
    steps.push({
      id: chain[i],
      name: p && (p.name || chain[i]) || chain[i],
      hop: i === 0 ? null : hopLabel(chain[i], ctx.persons),
    });
  }
  return { kind: below ? 'below' : 'above', steps: steps, generations: chain.length - 1 };
}

// generation context for ambiguous-name disambiguation in search: where a
// candidate sits relative to the current focus, or null when off the line.
export function generationContext(selId, ctx) {
  ctx = ctx || {};
  if (selId === ctx.curRoot) return 'the current root';
  var down = upPath(selId, ctx.curRoot, ctx.edges); // sel is below root
  if (down) return (down.length - 1) + ' generations below the current root';
  var up = upPath(ctx.curRoot, selId, ctx.edges);   // sel is above root
  if (up) return (up.length - 1) + ' generations above the current root';
  return null;
}

// turn a decoded context into an application plan against state S:
// what to set first, what to skip when unknown. Zoom only applies to the
// fractal view (pedigree/tree are not zoomable worlds).
export function applyPlan(ctx, persons, fallbackRoot) {
  var plan = { root: null, view: null, sel: null, zoom: null };
  if (!ctx || !persons) return plan;
  var root = (ctx.r && persons[ctx.r]) ? ctx.r : (ctx.p && persons[ctx.p] ? ctx.p : null);
  if (root && root !== fallbackRoot) plan.root = root;
  if (ctx.v === 'ped' || ctx.v === 'fan' || ctx.v === 'tree') plan.view = ctx.v;
  if (ctx.p && persons[ctx.p]) plan.sel = ctx.p;
  if (plan.view === 'fan' && typeof ctx.s === 'number' && isFinite(ctx.s)) {
    plan.zoom = { s: ctx.s, x: ctx.x, y: ctx.y };
  }
  return plan;
}

/* ---------- browser wiring (guarded; inert under Node) ---------- */

var SESSION_KEY = RETURN_KEY;
var nav = {
  api: null,
  lod: null,
  suppress: false,
  origin: null,       // pointerdown anchor while a gesture is live
  zoomTimer: 0,
  wired: false,
};

function api() { return nav.api; }

function markSelected() {
  var a = api(); if (!a) return;
  var doc = a.doc || document;
  var sel = a.S.sel; if (!sel) return;
  doc.querySelectorAll('[data-pid="' + sel + '"]').forEach(function (el) { el.classList.add('sel'); });
}

function persistCtx(push) {
  var a = api(); if (!a || !a.S.booted) return;
  var ctx = { p: a.S.sel || null, v: a.S.viewMode || null, r: a.S.curRoot || null };
  if (a.S.viewMode === 'fan' && a.view) {
    ctx.s = a.view.s; ctx.x = a.view.tx; ctx.y = a.view.ty;
  }
  var h = encodeCtx(ctx);
  try {
    if (push) history.pushState(null, '', h || location.pathname);
    else if (h) history.replaceState(null, '', h);
  } catch (e) { /* file:// and sandboxed iframes: context still lives in-session */ }
}

function applyCtx(ctx) {
  var a = api(); if (!a || !a.S.booted) return;
  var plan = applyPlan(ctx, a.S.persons, a.S.curRoot);
  if (plan.root) a.setRoot(plan.root, true);
  if (plan.view && plan.view !== a.S.viewMode) a.setView(plan.view);
  if (plan.zoom && a.view) {
    a.view.s = plan.zoom.s;
    if (typeof plan.zoom.x === 'number' && isFinite(plan.zoom.x)) a.view.tx = plan.zoom.x;
    if (typeof plan.zoom.y === 'number' && isFinite(plan.zoom.y)) a.view.ty = plan.zoom.y;
    if (a.S.viewMode === 'fan') a.applyViewInstant();
  }
  if (plan.sel && plan.sel !== a.S.sel) a.showDetail(plan.sel);
  markSelected();
}

// center the fractal on the selected person's cell when the cell is in the
// current view; in tree view scroll to their row. When they are not drawn at
// all, inject an honest hint instead of an empty branch.
function focusInView(id) {
  var a = api(); if (!a) return;
  var doc = a.doc || document;
  var hintId = 'nav-hint';
  var old = doc.getElementById(hintId); if (old) old.remove();
  var el = doc.querySelector('[data-pid="' + id + '"]');
  var detailActions = doc.querySelector('#dbody .dactions') || doc.getElementById('dbody');
  if (!el) {
    if (detailActions && a.S.persons[id]) {
      var hint = doc.createElement('div');
      hint.id = hintId; hint.className = 'navhint';
      hint.textContent = 'not drawn in this view ? press R to walk from here, O for their archive';
      detailActions.appendChild(hint);
    }
    return;
  }
  if (a.S.viewMode === 'fan') {
    var pts = (el.getAttribute('points') || '').split(/\s+/).slice(0, 3).map(function (p) {
      var xy = p.split(','); return { x: parseFloat(xy[0]), y: parseFloat(xy[1]) };
    });
    if (pts.length === 3 && isFinite(pts[0].x)) {
      var cx = (pts[0].x + pts[1].x + pts[2].x) / 3, cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
      a.centerOn(cx, cy, false);
    }
  } else if (a.S.viewMode === 'tree') {
    el.scrollIntoView && el.scrollIntoView({ block: 'center' });
  }
}

function openArchive(id) {
  var a = api(); if (!a || !id) return;
  persistCtxNow();
  try { sessionStorage.setItem(SESSION_KEY, currentCtxString()); } catch (e) {}
  var u = archiveUrl(id);
  if (a.doc && a.doc.defaultView) a.doc.defaultView.location.href = u;
}

function currentCtxString() {
  var a = api(); if (!a) return '';
  return encodeCtx({ p: a.S.sel, v: a.S.viewMode, r: a.S.curRoot, s: a.view && a.S.viewMode === 'fan' ? a.view.s : null, x: a.view && a.view.tx, y: a.view && a.view.ty });
}

function persistCtxNow() { persistCtx(false); }

function onZoom(scale) {
  var a = api(); if (!a) return;
  if (a.S.viewMode !== 'fan') return setLod(null);
  setLod(lodFor(scale));
  if (nav.zoomTimer) clearTimeout(nav.zoomTimer);
  nav.zoomTimer = setTimeout(persistCtxNow, 450);
}

function setLod(lod) {
  var a = api(); if (!a) return;
  var doc = a.doc || document;
  var world = doc.getElementById('world'); if (!world) return;
  if (nav.lod === lod) return;
  nav.lod = lod;
  world.classList.remove('lod-far', 'lod-mid', 'lod-near');
  if (lod) world.classList.add('lod-' + lod);
}

function onSelect(id) {
  var a = api(); if (!a) return;
  var doc = a.doc || document;
  markSelected();
  var bar = doc.getElementById('drawer-name');
  if (bar) bar.textContent = (a.S.persons[id] && (a.S.persons[id].name || id)) || id || '';
  var detail = doc.getElementById('detail');
  if (detail && isMobile(doc)) detail.classList.add('open');
  focusInView(id);
  persistCtx(false);
}

function isMobile(doc) {
  var w = (doc && doc.defaultView) || (typeof window !== 'undefined' && window);
  return !!(w && w.matchMedia && w.matchMedia('(max-width:640px)').matches);
}

function onRoot() { persistCtx(false); }
function onView(mode) { setLod(mode === 'fan' ? lodFor(api() && api().view ? api().view.s : 1) : null); markSelected(); persistCtx(false); }

function ensureDrawer() {
  var a = api(); if (!a) return;
  var doc = a.doc || document;
  var detail = doc.getElementById('detail');
  if (!detail || doc.getElementById('drawerbar')) return;
  var bar = doc.createElement('div');
  bar.id = 'drawerbar'; bar.className = 'drawerbar';
  var name = doc.createElement('span'); name.id = 'drawer-name';
  var btn = doc.createElement('button');
  btn.id = 'drawer-toggle'; btn.type = 'button'; btn.setAttribute('aria-label', 'collapse the person drawer');
  btn.textContent = '?';
  btn.addEventListener('click', function () { detail.classList.toggle('open'); });
  bar.appendChild(name); bar.appendChild(btn);
  detail.insertBefore(bar, detail.firstChild);
}

function wirePointerSafety() {
  var a = api(); var doc = a.doc || document;
  var svg = doc.getElementById('comb'); if (!svg) return;
  svg.addEventListener('pointerdown', function (e) {
    nav.origin = { x: e.clientX, y: e.clientY }; nav.suppress = false;
  }, true);
  svg.addEventListener('pointermove', function (e) {
    if (!nav.origin) return;
    if (shouldSuppressClick(e.clientX - nav.origin.x, e.clientY - nav.origin.y)) nav.suppress = true;
  }, true);
  function guard(e) {
    if (!nav.suppress) return;
    e.stopPropagation(); e.preventDefault();
    nav.suppress = false; nav.origin = null;
  }
  svg.addEventListener('click', guard, true);
  svg.addEventListener('dblclick', guard, true);
}

function wireKeyboard() {
  var a = api(); var doc = a.doc || document;
  doc.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var key = e.key;
    if (key === '/') { var q = doc.getElementById('q'); if (q) { q.focus(); e.preventDefault(); } return; }
    if (key === 'Escape') {
      var detail = doc.getElementById('detail');
      if (detail) { detail.classList.remove('open'); e.preventDefault(); }
      return;
    }
    // GUX-01 beat 2b — engine-mounted mode: the atlas owns arrows/R/Home/B
    // inside its stage; blood-nav keeps only the page-level grammar keys
    // (Esc drawer, / search focus, O archive doorway for the engine's
    // selection). One keyboard law, split by ownership, never duplicated.
    if (globalThis.__guxAtlas) {
      var actx = null;
      try { actx = globalThis.__guxAtlas.getContext(); } catch (err) { actx = null; }
      if ((key === 'o' || key === 'O') && actx && actx.selection) { openArchive(actx.selection); e.preventDefault(); }
      return;
    }
    var S = a.S;
    if (key === 'Home') { var rb = doc.getElementById('resetbtn'); if (rb) { rb.click(); e.preventDefault(); } return; }
    if (!S.sel) return;
    if (key === 'r' || key === 'R') { a.setRoot(S.sel); e.preventDefault(); return; }
    if (key === 'o' || key === 'O') { openArchive(S.sel); e.preventDefault(); return; }
    var dir = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : null;
    if (!dir) return;
    var next = stepSelection(dir, S.sel, S.edges, S.children);
    if (next && S.persons[next]) { a.showDetail(next); e.preventDefault(); }
  });
}

function wireHashAndSession() {
  var a = api(); var doc = a.doc || document;
  var win = doc.defaultView || window;
  // one-shot session restore: returning from a person archive page lands the
  // visitor where they were. Only fires when the arriving hash agrees (or is
  // empty), so a shared deep link still opens clean.
  // GUX-01 beat 2b — when the engine is (or becomes) mounted, the ENGINE boots
  // from this same session-merged hash (blood-nav stays the grammar owner;
  // the incumbent restore below must not fight it), so the saved context is
  // left in place for the mount to consume and no incumbent apply runs.
  try {
    var saved = sessionStorage.getItem(SESSION_KEY);
    var guxPending = !!globalThis.__guxAtlas || !!globalThis.__guxBoot;
    if (saved && !guxPending) {
      sessionStorage.removeItem(SESSION_KEY);
      var sctx = decodeHash(saved);
      var hctx = decodeHash(win.location.hash);
      if (!hctx.p || hctx.p === sctx.p) applyCtx(sctx);
    }
  } catch (e) { /* private mode: the URL hash context still applies */ }
  win.addEventListener('popstate', function () {
    if (globalThis.__guxAtlas) return; // engine mode: the URL is derived state, replaced not pushed
    applyCtx(decodeHash(win.location.hash));
  });
}

function onReady() {
  if (!nav.api || nav.wired) return;
  nav.wired = true;
  nav.api.S.booted = true;
  ensureDrawer();
  wirePointerSafety();
  wireKeyboard();
  wireHashAndSession();
  // respect an incoming context (legacy #p= and the extended form alike) —
  // skipped when the gux mount is pending: the engine will boot from the
  // same hash and session context instead (one truth, one applier).
  if (!globalThis.__guxAtlas && !globalThis.__guxBoot) {
    applyCtx(decodeHash((nav.api.doc && nav.api.doc.defaultView ? nav.api.doc.defaultView.location : window.location).hash));
  }
}

export function wire(apiRef) {
  if (!apiRef || !apiRef.S) return false;
  if (nav.wired) return true;
  nav.api = apiRef;
  apiRef.focusInView = focusInView;
  if (apiRef.S.booted) onReady();
  return true;
}

/* ---------- module side effects: expose for blood.html's classic script ---------- */
var BloodNav = { wire: wire, onReady: onReady, onSelect: onSelect, onRoot: onRoot, onView: onView, onZoom: onZoom, focusInView: focusInView, relToRoot: relToRoot, generationContext: generationContext };
if (typeof globalThis !== 'undefined') {
  globalThis.BloodNav = BloodNav;
  // blood.html's classic script may have finished booting before this
  // deferred module loaded: converge both orders onto wire()+onReady().
  if (globalThis.__bloodReady && globalThis.BloodComb) { wire(globalThis.BloodComb); onReady(); }
}
export default BloodNav;
