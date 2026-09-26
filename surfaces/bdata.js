// bdata.js — My Data (bData): the organism-level data surface. Owner of
// file/data policy, audience, automation, preservation and history. bPay is
// the economic organ, invoked only when a data operation needs value; its
// evidence returns here. (UX architecture correction, founder 2026-09-17.)
//
// LAWS HELD HERE:
//  - BEFORE commitment: policy is freely editable (audience/automation/bounds).
//  - AFTER commitment: changing a load-bearing policy CREATES A SUCCESSOR
//    plan requirement ("a new quote is required") — history is appended,
//    never mutated. Yesterday's legitimate operations stay legitimate.
//  - Automation is a first-class dimension: Ask me / Automatic within explicit
//    limits / Never — capabilities-bound, economically bounded.
//  - Unsupported private audiences stay VISIBLY UNAVAILABLE with reasons.
//  - Nothing here can spend. Phase C adds ONE founder-reviewed authorization
//    object (an intent to sign, bound to the exact quote + invoice lineage);
//    there is still no pay route and no signing path — those are Phase E's.
//
// THE A+ REBUILD (founder, 2026-09-18: "D+ — buttons don't even work"):
//  - EVERY PRESS ANSWERS. The screen is DERIVED from state (policy key + st +
//    the one in-flight ask), never poked into the DOM — so a re-render, a
//    language switch or another tab can never wipe a wait or re-arm a button.
//  - NO DECOYS. While the network is being asked there is no price button at
//    all: a spinner, the seconds so far, and "Stop waiting". A control exists
//    only while it can act; what cannot act yet is prose with its reason.
//  - ONE ASK AT A TIME. A single in-flight guard covers the gesture, the
//    button, the refresh and the auto-retry — in EVERY open tab (a marker in
//    the store + a liveness ping, so a closed tab's marker cannot strand the
//    page); answers to a withdrawn ask are ignored; a deadline ends a hung one.
//  - THE RIDERS ARE OBEYED. Depth follows the estate's register control
//    (body[data-reg] + <details data-reg-disclose>); strings follow 'blang';
//    both shared keys follow 'storage'. No private view picker.
(function(){
  'use strict';
  var LS = 'bdata-v1', SHARED = 'bpay-policy-v1';
  var DEFAULT_BRIDGE = 'http://127.0.0.1:8807';
  var FRESH_MS = 15 * 60 * 1000;   // past this a cached price is "earlier", never "current"
  var DEADLINE_MS = 150000;        // measured asks: 42-69 s; a hung one ends here
  var RETRY_MS = 3000;
  var MODES = ['ask', 'auto', 'never'];
  var UNAVAIL = [
    { id:'only-me', ico:'🔒', label:['wl.bpay.aud.onlyme','Only me'], why:['bd.aud.onlyme.why','Private storage for your eyes only is not ready.'], tech:['bd.aud.onlyme.tech','private-DataMap custody path not yet qualified'] },
    { id:'selected-people', ico:'🔒', label:['wl.bpay.aud.selected','Selected people'], why:['bd.aud.selected.why','Sharing with people you pick is not ready.'], tech:['bd.aud.selected.tech','recipient capability/key granting not yet qualified'] }
  ];

  /* ---------- words ---------- */
  // resolved at CALL time: lang.js arrives late (tour.js injects it) and the
  // corpus later still — 'blang' then re-renders everything below
  function T(k, f){ var L = window.BNRLanguage; return (L && L.text) ? L.text(k, f) : f; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  // a keyed text node lang.js can also re-swap (data-i18n-en = its English of record)
  function tx(k, en){ return '<span data-i18n="' + k + '" data-i18n-en="' + esc(en) + '">' + esc(T(k, en)) + '</span>'; }
  function fill(s, map){ return String(s).replace(/\{(\w+)\}/g, function(m, k){ return map[k] != null ? map[k] : m; }); }
  function lang(){ return document.documentElement.lang || 'en'; }
  function antStr(atto){ try{ var n=BigInt(atto), w=n/10n**18n, f=(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,''); return f? w+'.'+f : String(w); }catch(e){ return null; } }
  // the FULL figure, always, in every register — the first four decimals lead
  // and the rest follow smaller on the same line (typography, never rounding)
  function antHtml(atto, small){
    var s = antStr(atto); if (s === null) return '<span class="amount' + (small?' small':'') + '">?</span>';
    var i = s.indexOf('.'), lead = (i < 0 || s.length - i - 1 <= 4) ? s : s.slice(0, i + 5), tail = s.slice(lead.length);
    return '<bdi class="amount' + (small?' small':'') + '" aria-label="' + s + ' ANT"><span>' + lead + '</span>' + (tail ? '<span class="tail">' + tail + '</span>' : '') + '<span class="unit">&nbsp;ANT</span></bdi>';
  }
  function utc(iso){ return String(iso).replace('T',' ').replace(/(\.\d+)?Z$/,' UTC'); }
  function when(iso){
    var d = new Date(iso); if (isNaN(d)) return esc(iso);
    var out; try { out = new Intl.DateTimeFormat(lang(), { dateStyle:'medium', timeStyle:'short' }).format(d); } catch(e){ out = d.toLocaleString(); }
    return '<time datetime="' + esc(iso) + '" title="' + esc(utc(iso)) + '"><bdi>' + esc(out) + '</bdi></time>';
  }
  function ago(iso){
    var ms = Date.now() - new Date(iso).getTime(); if (!(ms >= 0)) return '';
    var m = Math.round(ms / 60000), v, u;
    if (m < 1) return '';   // "this minute" says nothing the time beside it does not
    if (m < 60) { v = m; u = 'minute'; } else if (m < 2880) { v = Math.round(m / 60); u = 'hour'; } else { v = Math.round(m / 1440); u = 'day'; }
    try { return new Intl.RelativeTimeFormat(lang(), { numeric:'auto' }).format(-v, u); } catch(e){ return ''; }
  }

  /* ---------- state ---------- */
  function isBound(v){ return typeof v === 'string' && /^\d{1,12}(\.\d{1,18})?$/.test(v); }
  function trimBridge(v){ return String(v || '').trim().replace(/\/+$/, ''); }
  function validBridge(v){ try { var u = new URL(String(v)); return u.protocol === 'http:' || u.protocol === 'https:'; } catch(e){ return false; } }
  function validQuote(q){ return !!(q && typeof q === 'object' && typeof q.obtainedAt === 'string' && typeof q.totalAtto === 'string' && antStr(q.totalAtto) !== null); }
  function rawStore(){ try { var o = JSON.parse(localStorage.getItem(LS) || 'null'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch(e){ return {}; } }
  // a stored shape is validated field by field — a bad one can never strand the page
  function load(){
    var d = { automation:{ mode:'ask', boundAnt:'0.5' }, history:[], bridge:DEFAULT_BRIDGE, freshQuote:null, authorization:null }, sv = rawStore();
    if (sv.automation && typeof sv.automation === 'object') {
      if (MODES.indexOf(sv.automation.mode) >= 0) d.automation.mode = sv.automation.mode;
      if (isBound(String(sv.automation.boundAnt))) d.automation.boundAnt = String(sv.automation.boundAnt);
    }
    if (Array.isArray(sv.history)) d.history = sv.history.filter(function(e){ return e && typeof e === 'object' && typeof e.at === 'string'; });
    if (validBridge(sv.bridge)) d.bridge = trimBridge(sv.bridge);
    if (validQuote(sv.freshQuote)) d.freshQuote = sv.freshQuote;
    var au = sv.authorization;
    if (au && typeof au === 'object' && typeof au.id === 'string' && typeof au.state === 'string') d.authorization = { id: au.id, state: au.state, quoteAt: String(au.quoteAt || '') };
    return d;
  }
  var st = load();
  // MERGE-ON-WRITE (the field-ownership law, as bpay-invoice.js): a write carries
  // only its own fields and merges with the LATEST stored object
  function save(fields){ try { localStorage.setItem(LS, JSON.stringify(Object.assign(rawStore(), fields))); return true; } catch(e){ return false; } }
  // append-only, against the LATEST stored history; editions are structured
  // and worded at display time, so the record is language-neutral. Never truncated.
  function note(entry){
    var latest = load().history;
    entry.at = new Date().toISOString();
    latest.unshift(entry);
    st.history = latest;
    save({ history: latest });
  }

  function readShared(){ try { var o = JSON.parse(localStorage.getItem(SHARED) || 'null'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch(e){ return {}; } }
  // PERSIST FIRST, READ BACK: no network ask may follow a gesture that did not record
  function writeShared(fields){
    localStorage.setItem(SHARED, JSON.stringify(Object.assign(readShared(), fields)));
    var back = readShared();
    Object.keys(fields).forEach(function(k){ if (back[k] !== fields[k]) throw new Error('policy write did not land'); });
  }
  function chosen(){ var s = readShared(); return (s.audience === 'public' && typeof s.selectedAt === 'string' && s.selectedAt) ? s : null; }
  // "originated in My Data" is a provenance CLAIM — made only on evidence: this
  // surface's own origin stamp for this exact selection, or (selections made
  // before the stamp existed) this surface's own history edition of that moment
  function originHere(sel){
    if (sel.origin === 'bdata' && sel.originAt === sel.selectedAt) return true;
    if (sel.origin) return false;
    var t = new Date(sel.selectedAt).getTime();
    return st.history.some(function(e){ return typeof e.what === 'string' && e.what.indexOf('🌐') >= 0 && Math.abs(new Date(e.at).getTime() - t) < 2000; });
  }

  var INV = null, invState = 'loading';   // loading | ready | empty | failed
  var FINV = null;     // the CURRENT founder invoice — the authorization binds THIS lineage
  var review = false;  // the review is open (a reader's tap; closes when the price it was for is gone)
  var authBusy = false, authErr = null;
  var ask = null;      // THE one in-flight ask: { id, startedAt, attempt, phase:'asking'|'retrying', ... }
  var fail = null;     // the last ask's failure: { cls, detail, secs }
  var notice = null;   // 'nostore' | null
  var fieldErr = {};   // a REJECTED field keeps the reader's own text: { bound:'1e-7', bridge:'ftp://x' }
  var seq = 0, ticker = null, freshTimer = null, paintTimer = null;
  var TAB = Math.random().toString(36).slice(2);   // this page load, for the cross-tab ask marker
  var peers = {};      // foreign ask markers: id → 'alive' | 'orphan' | 'asked'
  var chan = null; try { chan = new BroadcastChannel('bdata-ask'); } catch(e){}

  function pin(){ return (INV && INV.domain && INV.domain.artifact) ? INV.domain.artifact.sha256 : null; }
  function refLine(){ return INV ? (INV.lines || []).filter(function(l){ return l && l.asset === 'ANT'; })[0] : null; }
  // a cached price stands only for THIS artifact, THIS selection, THIS quote service
  function usableQuote(sel){
    var q = st.freshQuote; if (!q || !sel) return null;
    if (q.artifact && q.artifact !== pin()) return null;
    if (q.selectedAt ? q.selectedAt !== sel.selectedAt : !(new Date(q.obtainedAt).getTime() > new Date(sel.selectedAt).getTime())) return null;
    if (q.bridge && q.bridge !== trimBridge(st.bridge)) return null;
    return q;
  }
  // ANOTHER tab's in-flight ask: its marker in the store, believed only while
  // that tab answers a ping (a reloaded or closed tab's marker is an orphan)
  function foreignAsk(){
    var m = rawStore().asking;
    if (!m || typeof m !== 'object' || m.tab === TAB || typeof m.id !== 'string' || typeof m.at !== 'number') return null;
    if (Date.now() - m.at > DEADLINE_MS * 2 + RETRY_MS || peers[m.id] === 'orphan') return null;
    if (chan && !peers[m.id]) {
      peers[m.id] = 'asked';
      try { chan.postMessage({ t:'who', id: m.id }); } catch(e){}
      setTimeout(function(){ if (peers[m.id] === 'alive') return; peers[m.id] = 'orphan'; var cur = rawStore().asking; if (cur && cur.id === m.id) save({ asking: null }); render(); }, 500);
    }
    return m;
  }
  function founderLine(){ return FINV ? (FINV.lines || []).filter(function(l){ return l && l.asset === 'ANT'; })[0] : null; }
  // an authorization stands only for the EXACT quote it was pressed for — a
  // re-quote voids it at the bridge (the digest wall), so the page stops showing it
  function authFor(q){ var a = st.authorization; return (a && q && a.quoteAt === q.obtainedAt) ? a : null; }
  function mark(on){ var cur = rawStore().asking; if (on) save({ asking: on }); else if (cur && cur.tab === TAB) save({ asking: null }); }
  function priceState(sel){
    if (!sel) return 'waiting';
    if (ask) return ask.phase;
    if (foreignAsk()) return 'elsewhere';
    if (fail) return 'failed';
    return usableQuote(sel) ? 'priced' : 'idle';
  }

  /* ---------- the ask ---------- */
  function say(text){ var live = document.getElementById('bdata-live'); if (live) live.textContent = text; }
  function problem(cls, detail, retryable){ var e = new Error(detail || cls); e.cls = cls; e.retryable = !!retryable; return e; }

  function startAsk(){
    if (ask || foreignAsk()) { render(); return; }   // the single guard: gesture, button, refresh, retry — and every other tab
    var sel = chosen(), artifact = pin();
    if (!sel || !artifact) { render(); return; }
    // an automated browser cannot be the founder's hand: it may never reach the
    // live quote service by omission (a test must seed its own mock)
    if (navigator.webdriver && trimBridge(st.bridge) === DEFAULT_BRIDGE) { fail = { cls:'automation', detail:'' }; render(); return; }
    fail = null;
    ask = { id: TAB + ':' + (++seq), startedAt: Date.now(), attempt: 1, phase: 'asking', sel: sel, artifact: artifact, bridge: trimBridge(st.bridge) };
    mark({ id: ask.id, tab: TAB, at: ask.startedAt });
    render();
    say(T('bd.price.asking', 'asking Autonomi — up to a minute'));
    send(ask);
  }

  function send(my){
    var ctl = new AbortController();
    my.controller = ctl;
    my.deadline = setTimeout(function(){ my.timedOut = true; ctl.abort(); }, DEADLINE_MS);
    fetch(my.bridge + '/v1/upload/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // the RESOLVED policy that was recorded — never a button label
      body: JSON.stringify({ artifact_sha256: my.artifact, audience: my.sel.audience, force_fresh: true }),
      signal: ctl.signal
    }).then(function(r){
      if (!r.ok) return r.text().then(function(t){ throw problem(r.status >= 500 ? 'network' : 'refused', 'HTTP ' + r.status + (t ? ' — ' + t.slice(0, 160) : ''), r.status >= 500); });
      return r.json().catch(function(){ throw problem('refused', 'the answer was not JSON'); });
    }).then(function(prepare){
      if (!prepare || typeof prepare !== 'object') throw problem('refused', 'empty answer');
      if (!prepare.policy || typeof prepare.policy.binding !== 'string' || prepare.policy.binding.indexOf('founder-selected') !== 0)
        throw problem('refused', T('bd.price.nobind', 'the quote service did not bind your selected policy — refused'));
      if (prepare.artifact_sha256 !== my.artifact) throw problem('refused', 'artifact mismatch');
      var payments = Array.isArray(prepare.payments) ? prepare.payments : [], sum;
      try { sum = payments.reduce(function(s, p){ return s + BigInt(p.amount_atto); }, 0n).toString(); } catch(e){ throw problem('refused', 'unreadable amounts'); }
      if (prepare.total_amount_atto && String(prepare.total_amount_atto) !== sum) throw problem('refused', 'quote sum mismatch');
      // no quotes at all is a price only when every chunk is already stored
      if (!payments.length && !(Number(prepare.total_chunks) > 0 && Number(prepare.already_stored) === Number(prepare.total_chunks))) throw problem('refused', 'the answer carried no quotes');
      return { obtainedAt: new Date().toISOString(), totalAtto: sum, count: payments.length, shape: String(prepare.payment_type || ''), uploadId: String(prepare.upload_id || ''),
               artifact: my.artifact, audience: my.sel.audience, selectedAt: my.sel.selectedAt, bridge: my.bridge };
    }).then(function(q){
      clearTimeout(my.deadline);
      if (ask !== my) return;   // withdrawn or superseded: this answer is nobody's
      ask = null; mark(null);
      var now = chosen();
      if (!now || now.selectedAt !== my.sel.selectedAt) { render(); return; }   // the selection it was for no longer stands
      st.freshQuote = q;
      if (!save({ freshQuote: q })) notice = 'nostore';
      note({ kind:'quote', totalAtto: q.totalAtto, count: q.count, uploadId: q.uploadId });
      render({ focus: 'price' });
      say(antStr(q.totalAtto) + ' ANT. ' + T('bd.paid.scope', 'Nothing has been paid from this page.'));
    }).catch(function(e){
      clearTimeout(my.deadline);
      if (ask !== my) return;
      var f = (e && e.cls) ? e : (my.timedOut ? problem('timeout', '') : problem('unreachable', String((e && e.message) || e)));
      // ONE honest auto-retry, only for the flake class the founder hit live
      // (the network answered 5xx); decided on the error's TYPE, never its words
      if (f.retryable && my.attempt === 1) {
        my.attempt = 2; my.phase = 'retrying';
        render();
        say(T('bd.price.retry', 'the network flaked — retrying once…'));
        my.retryTimer = setTimeout(function(){ if (ask !== my) return; my.phase = 'asking'; render(); send(my); }, RETRY_MS);
        return;
      }
      ask = null; mark(null);
      fail = { cls: f.cls, detail: String(f.message || ''), secs: Math.round((Date.now() - my.startedAt) / 1000) };
      render({ focus: 'price' });
      say(failHead(fail));
    });
  }

  // withdrawal is a first-class state: the page stops waiting (the quote
  // service may still finish its own job — nothing is paid either way)
  function stopAsk(){
    var my = ask; if (!my) return;
    ask = null; mark(null);
    clearTimeout(my.deadline); clearTimeout(my.retryTimer);
    try { my.controller.abort(); } catch(e){}
  }

  function failHead(f){
    if (f.cls === 'network') return T('bd.price.fail', 'Autonomi did not answer');
    if (f.cls === 'unreachable') return T('bd.price.unreachable', 'The quote service on this device did not answer.');
    if (f.cls === 'timeout') return fill(T('bd.price.timeout', 'No answer after {s} seconds.'), { s: f.secs });
    if (f.cls === 'automation') return T('bd.price.automation', 'An automated browser may not ask the live quote service — that press belongs to a person.');
    return T('bd.price.refused', 'The quote service answered wrongly — refused.');
  }

  /* ---------- gestures ---------- */
  function choosePublic(){
    if (chosen()) { render(); return; }   // chosen elsewhere meanwhile: show it — a press never returns silently
    var at = new Date().toISOString();
    try { writeShared({ audience:'public', selectedAt: at, origin:'bdata', originAt: at }); }
    catch(e){ notice = 'nostore'; render(); say(T('bd.aud.nostore', 'This browser would not save your choice, so nothing was asked.')); return; }
    notice = null;
    note({ kind:'audience.chosen' });
    // LATENCY LAW (founder, 2026-09-19): the gesture IS the trigger — the ask
    // starts now, hiding the network's 40-60 s behind the decision
    startAsk();
    if (!ask) render();
  }
  function undoChoice(){
    var sel = chosen(); if (!sel) { render(); return; }
    var q = usableQuote(sel);
    try { writeShared({ audience:null, selectedAt:null, origin:null, originAt:null }); }
    catch(e){ notice = 'nostore'; render(); say(T('bd.aud.nostore', 'This browser would not save your choice, so nothing was asked.')); return; }
    stopAsk();
    // supersede, never rewrite: the withdrawn plan and its price stay as history
    note({ kind:'audience.undone', was: sel.selectedAt, quote: q ? { totalAtto: q.totalAtto, count: q.count, uploadId: q.uploadId } : null });
    st.freshQuote = null; save({ freshQuote: null });
    fail = null; notice = null;
    render({ focus: 'public' });
  }
  function setMode(to){
    var from = st.automation.mode;
    if (MODES.indexOf(to) < 0 || from === to) { render(); return; }
    st.automation = { mode: to, boundAnt: st.automation.boundAnt };
    notice = save({ automation: st.automation }) ? null : 'nostore';
    note({ kind:'auto.mode', from: from, to: to, bound: to === 'auto' ? st.automation.boundAnt : null });
    render();
  }
  // COMMIT NOW, PAINT LATER: 'change' fires on the mousedown of the reader's NEXT
  // press — a repaint there would destroy that button before its click lands
  function repaint(){ clearTimeout(paintTimer); paintTimer = setTimeout(render, 0); }
  function setBound(raw){
    var v = String(raw).trim().replace(',', '.');
    if (!isBound(v)) { fieldErr.bound = String(raw); say(T('bd.auto.boundbad', 'Enter a plain number, 0 or more (up to 18 decimals).')); repaint(); return; }
    fieldErr.bound = null;
    var from = st.automation.boundAnt;
    if (from === v) { repaint(); return; }
    st.automation = { mode: st.automation.mode, boundAnt: v };
    notice = save({ automation: st.automation }) ? null : 'nostore';
    note({ kind:'auto.bound', from: from, to: v });
    repaint();
  }
  function setBridge(raw){
    if (ask) { repaint(); return; }
    var v = trimBridge(raw) || DEFAULT_BRIDGE;
    if (!validBridge(v)) { fieldErr.bridge = String(raw); say(T('bd.bridge.bad', 'Enter an http(s) address.')); repaint(); return; }
    fieldErr.bridge = null;
    st.bridge = v; notice = save({ bridge: v }) ? null : 'nostore';
    fail = null;
    repaint();
  }

  /* ---------- drawing ---------- */
  function shelf(){
    if (invState === 'loading') return '<div class="card" aria-busy="true"><div class="skel"></div><p class="sub note">' + tx('bd.inv.loading', 'Loading your data…') + '</p></div>';
    if (invState === 'empty') return '<div class="card law" data-bdata-shelf="empty">' + tx('bd.shelf.empty', 'no data objects registered on this device yet — intake adds them; the Bux community video is the first registered object and loads from the estate reference') + '</div>';
    if (invState === 'failed') return '<div class="card" data-bdata-shelf="failed"><div class="alert"><b>' + tx('bd.inv.fail', 'Your data list did not load.') + '</b></div><div class="actions"><button type="button" class="btn primary" data-act="reload-inv" data-fk="reload-inv">' + tx('bd.price.again', 'Try again') + '</button></div></div>';

    var d = INV.domain, a = d.artifact, pol = d.policy || {}, aud = pol.audience || {};
    var committed = !!(INV.commitment && INV.commitment.digest);
    var sel = chosen();
    var h = '<section class="card" data-bdata-object="bux-try-autonomi" aria-labelledby="obj-h">';
    h += '<div class="head"><div><h2 id="obj-h">' + esc((d.media && d.media.title) || a.name) + '</h2><div class="sub">' + esc((d.media && d.media.creator) || '') + '</div></div><span class="tag">' + tx('bd.registered', 'registered intake') + '</span></div>';
    h += '<div class="meta sub"><span><bdi>' + esc(a.name) + '</bdi> · <bdi data-bdata-bytes="' + esc(a.bytes) + '">' + Number(a.bytes).toLocaleString('en-US') + '</bdi> ' + tx('bd.bytes', 'bytes') + '</span><span class="mono">sha256 ' + esc(String(a.sha256).slice(0, 16)) + '…</span></div>';

    /* THE STORE RECEIPT — one unmarked block, so EVERY register shows it:
       ✓ Stored on Autonomi, the whole address, and a Watch link (bee-address
       law: the address whole, never an ellipsis). Unreadable receipt = a
       named failure with a real Try again; a mismatch renders exactly as
       before — the page never shows STORED on evidence it cannot check. */
    var sv = storedVerdict();
    if (sv.state === 'stored') {
      var bare = bareHex(sv.receipt.data_map_address);
      h += '<div class="stored" data-bdata-stored="1">';
      h += '<div><span class="badge">✓ ' + tx('bd.stored.on', 'Stored on Autonomi') + '</span></div>';
      h += '<div class="meta sub"><span class="mono" data-bdata-stored-address="' + esc(bare) + '"><bdi>' + esc(bare) + '</bdi></span></div>';
      h += '<div class="actions"><a class="btn" data-bdata-watch="1" href="bview.html#' + esc(bare) + '">▶ ' + tx('bd.stored.watch', 'Watch') + '</a></div>';
      h += '</div>';
    } else if (sv.state === 'unreadable') {
      h += '<div class="alert note" data-bdata-stored-err="1"><b>' + tx('bd.stored.err', 'the store receipt could not be read') + '</b><bdi class="mono">' + esc(sv.why) + '</bdi></div>';
      h += '<div class="actions"><button type="button" class="btn" data-act="reload-stored" data-fk="reload-stored">' + tx('bd.price.again', 'Try again') + '</button></div>';
    }

    /* 1 · WHO — THE ORIGIN (advisor law, 2026-09-17): the desire to make
       something public belongs HERE; bPay receives the already-resolved
       operation. One live choice is a button; what cannot be chosen yet is
       prose with its reason in plain sight (dead affordances are banned). */
    h += '<div class="step"><h3 class="step-h" id="aud-h"><span class="num" aria-hidden="true">1</span>' + tx('wl.bpay.who', 'Who can get this?') + '</h3>';
    h += '<div class="opts" role="radiogroup" aria-labelledby="aud-h">';
    h += '<button type="button" class="opt" data-bdata-aud="public" data-act="public" data-fk="public" role="radio" aria-checked="' + (sel ? 'true' : 'false') + '"><span class="ico" aria-hidden="true">🌐</span><span class="name">' + tx('wl.bpay.aud.public', 'Public') + '</span><span class="mark" aria-hidden="true">' + (sel ? '✓' : '') + '</span><span class="desc">' + tx('wl.bpay.aud.public.desc', 'anyone with the address can retrieve it') + '</span></button>';
    UNAVAIL.forEach(function(u){
      h += '<div class="opt na" role="radio" aria-checked="false" aria-disabled="true" data-bdata-aud="' + u.id + '" data-bdata-unavailable="' + u.id + '"><span class="ico" aria-hidden="true">' + u.ico + '</span><span class="name">' + tx(u.label[0], u.label[1]) + '</span><span class="soon">' + tx('bd.aud.notyet', 'Not available yet') + '</span><span class="desc">' + tx(u.why[0], u.why[1]) + '<span data-reg="cypherpunk"> · ' + tx(u.tech[0], u.tech[1]) + '</span></span></div>';
    });
    h += '</div>';
    if (notice === 'nostore') h += '<div class="alert note"><b>' + tx('bd.aud.nostore', 'This browser would not save your choice, so nothing was asked.') + '</b></div>';
    if (sel) h += '<div class="chose"><span>' + tx('wl.bpay.youchose', 'You chose') + ' <b>🌐 ' + tx('wl.bpay.aud.public', 'Public') + '</b> <span class="sub">· ' + when(sel.selectedAt) + '</span></span><button type="button" class="btn quiet" data-bdata-undo="1" data-act="undo" data-fk="undo">' + tx('bd.aud.undo', 'Undo this choice') + '</button></div>';
    h += '<details class="more" data-reg-disclose data-dk="aud-rules"><summary>' + tx('bd.rules.sum', 'The rules behind this') + '</summary>';
    h += '<div class="law"><bdi>' + esc(aud.access || pol.access || '') + '</bdi></div>';
    if (sel && originHere(sel)) h += '<div class="law" data-bdata-origin="bdata">' + tx('bd.origin.note', 'this choice originated in My Data; bPay receives the resolved plan and asks only about its economics') + '</div>';
    else if (!sel) h += '<div class="law">' + tx('bd.origin.choose', 'the current binding is the machine reference; choosing Public yourself makes the policy YOURS — the selection is yours to make, here') + '</div>';
    if (committed) h += '<div class="law" data-bdata-supersede-note="1">' + tx('bd.supersede', 'a carried-quote-set commitment exists — changing the audience changes the preservation plan and requires a new quote; the old plan remains as history') + '</div>';
    else h += '<div class="law">' + tx('bd.freely', 'no commitment yet — audience is freely adjustable') + '</div>';
    h += '</details></div>';

    /* 2 · THE PRICE, IN PLACE (founder ruling 2026-09-18: one page, one
       concept, one click at a time — the ceremony never leaves My Data). */
    h += priceStep(sel, refLine());

    /* 3 · AUTHORIZE (Phase C) — locked prose until a price stands; then one
       founder-reviewed intent to sign. Never a pay route, never a signing path. */
    h += authStep(sel);
    h += '</section>';
    return h;
  }

  function priceStep(sel, ref){
    var state = priceState(sel), q = sel ? usableQuote(sel) : null;
    var h = '<div class="step" data-bdata-price-state="' + state + '"' + (ask || state === 'elsewhere' ? ' aria-busy="true"' : '') + '><h3 class="step-h" id="price-h" tabindex="-1" data-fk="price"><span class="num" aria-hidden="true">2</span>' + tx('bd.price.h', 'What does it cost now?') + '</h3>';
    var refHtml = ref ? '<div class="sub while">' + tx('bd.price.reference', 'reference (machine, not chosen by you)') + ': <bdi>' + esc(antStr(ref.amountAtto)) + ' ANT</bdi></div>' : '';
    var nothing = '<div><span class="badge" data-bdata-nothing-paid="1">' + tx('bd.paid.scope', 'Nothing has been paid from this page.') + '</span></div>';
    function earlier(){ return '<div class="while"><div class="sub">' + tx('bd.price.earlier', 'earlier price — caused by your choice') + ' · ' + when(q.obtainedAt) + '</div>' + antHtml(q.totalAtto, true) + '</div>'; }

    if (state === 'waiting') {
      h += '<p class="dim" data-bdata-preserve-waiting="1">' + tx('bd.price.first', 'First choose who can get this — the price check then starts on its own.') + '</p>';
      h += refHtml;
    } else if (state === 'asking' || state === 'retrying') {
      // no price button exists while the network is being asked — nothing to press twice
      h += '<div class="busy"><span class="spin" aria-hidden="true"></span><div><b>' + (state === 'retrying' ? tx('bd.price.retry', 'the network flaked — retrying once…') : tx('bd.price.asking', 'asking Autonomi — up to a minute')) + '</b><div class="sub" data-bdata-elapsed="1">' + elapsedText() + '</div></div></div>';
      h += '<div class="bar" aria-hidden="true"><i></i></div>';
      h += '<div class="actions"><button type="button" class="btn" data-bdata-stop="1" data-act="stop" data-fk="stop">' + tx('bd.price.stop', 'Stop waiting') + '</button></div>';
      h += q ? earlier() : refHtml;
      h += nothing;
    } else if (state === 'elsewhere') {
      // another tab of this page is asking: no button here either — its answer lands in both
      h += '<div class="busy"><span class="spin" aria-hidden="true"></span><div><b>' + tx('bd.price.asking', 'asking Autonomi — up to a minute') + '</b><div class="sub" data-bdata-elapsed="1">' + elapsedText() + '</div></div></div>';
      h += '<div class="bar" aria-hidden="true"><i></i></div>';
      h += '<p class="sub note">' + tx('bd.price.elsewhere', 'Another tab is already asking — the price will appear here too.') + '</p>';
      h += q ? earlier() : refHtml;
      h += nothing;
    } else if (state === 'failed') {
      h += '<div class="alert" data-bdata-fail="' + esc(fail.cls) + '"><b>' + esc(failHead(fail)) + '</b>';
      if (fail.cls === 'unreachable') h += '<div class="sub">' + tx('bd.price.unreachable.hint', 'It runs on the owner’s own machine — start it there, then try again.') + ' ' + tx('bd.price.unreachable.allow', 'If this browser asked whether the page may reach it, allow that.') + '</div>';
      if (fail.detail) h += '<bdi class="mono">' + esc(fail.detail.slice(0, 200)) + '</bdi>';
      h += '</div>';
      if (fail.cls !== 'automation') h += '<div class="actions"><button type="button" class="btn primary" data-bdata-quote-go="1" data-act="ask" data-fk="ask">' + tx('bd.price.again', 'Try again') + '</button></div>';
      if (q) h += earlier();
      h += nothing;
    } else if (state === 'idle') {
      h += '<button type="button" class="btn primary" data-bdata-quote-go="1" data-act="ask" data-fk="ask">➜ ' + tx('bd.price.go', 'Get the storage price') + '</button>';
      h += '<p class="sub note" data-bdata-price-hint="1">' + tx('bd.price.askingnote', 'one press asks the live network; it can take up to a minute') + '</p>';
      h += refHtml;
    } else {
      // priced: "current" is a claim about NOW — an older figure says so, and
      // asking again becomes the primary press
      var fresh = (Date.now() - new Date(q.obtainedAt).getTime()) < FRESH_MS;
      h += '<div data-bdata-fresh-atto="' + esc(q.totalAtto) + '">' + antHtml(q.totalAtto) + '</div>';
      h += '<div class="sub" data-bdata-price-age="' + (fresh ? 'current' : 'earlier') + '">' + (fresh ? tx('bd.price.caused', 'current price — caused by your choice') : tx('bd.price.earlier', 'earlier price — caused by your choice')) + ' · ' + tx('wl.bpay.fresh', 'quote obtained') + ' ' + when(q.obtainedAt) + (ago(q.obtainedAt) ? ' (' + esc(ago(q.obtainedAt)) + ')' : '') + '</div>';
      h += '<div class="facts sub"><span data-bdata-quote-obligations="' + esc(q.count) + '"><bdi>' + esc(q.count) + '</bdi> × ' + tx('wl.bpay.quotes', 'chunk quotes') + (q.shape ? ' · <bdi>' + esc(q.shape) + '</bdi>' : '') + '</span><span data-bdata-gas-separate="1">⛽ ' + tx('wl.bpay.gasside', 'separate') + ' · <bdi>Arbitrum ETH</bdi></span>' + (q.uploadId ? '<span class="mono" data-reg="cypherpunk">' + esc(q.uploadId) + '</span>' : '') + '</div>';
      h += nothing;
      h += '<div class="actions"><button type="button" class="btn' + (fresh ? '' : ' primary') + '" data-bdata-price-refresh="1" data-act="ask" data-fk="ask">↻ ' + tx('bd.price.refresh', 'refresh the price') + '</button>' + (fresh ? '<span class="sub">' + tx('bd.price.cached', 'cached — shown instantly; a refresh asks the network again') + '</span>' : '') + '</div>';
      h += refHtml;
    }
    h += '</div>';
    return h;
  }
  /* ── THE AUTHORIZATION STEP (Phase C) ──────────────────────────────────────
     One founder-reviewed authorization object, bound to the exact open job and
     invoice lineage, BEFORE any signing path exists. The press creates intent
     only: nothing is signed, nothing is paid, nothing is uploaded. The bridge
     enforces every binding at creation (digest wall = no silent requote; the
     ceiling is exact; the audience must be the founder-selected one). */
  function authStep(sel){
    var q = (sel && priceState(sel) === 'priced') ? usableQuote(sel) : null;
    var num = '<span class="num" aria-hidden="true">3</span>';
    if (!q) return '<div class="step"><p class="locked" data-bdata-authorize-next="1">' + num + '<span><span aria-hidden="true">🔒 </span>' + tx('bd.price.next', 'Authorize — the payment step is not built yet; nothing can be paid from this page') + '</span></p></div>';
    var fl = founderLine();
    if (!fl || fl.amountAtto !== q.totalAtto) return '<div class="step"><p class="locked" data-bdata-review-stale="1">' + num + '<span><span aria-hidden="true">⚠ </span>' + tx('bd.auth.warncache', 'your cached price does not match the current invoice — refresh the price first; the authorization binds the live quote, never a stale one') + '</span></p></div>';
    var auth = authFor(q);
    var h = '<div class="step" data-bdata-review="1"' + (authBusy ? ' aria-busy="true"' : '') + '><h3 class="step-h" id="auth-h" tabindex="-1" data-fk="auth">' + num + tx('bd.auth.h', 'What you are authorizing') + '</h3>';
    if (auth && auth.state === 'authorized-for-signing') {
      h += '<p data-bdata-auth-state="authorized"><b><span aria-hidden="true">🔑 </span>' + tx('bd.auth.done', 'Authorized for signing — nothing signed, nothing paid; signing arrives with Phase E') + '</b></p>';
      h += '<p class="sub note"><bdi class="mono">' + esc(auth.id) + '</bdi> · ' + tx('bd.auth.cancelnote', 'cancellation is always lawful before a signature exists') + '</p>';
      if (authErr) h += '<div class="alert note"><bdi class="mono">' + esc(authErr) + '</bdi></div>';
      h += authBusy ? '<div class="busy note"><span class="spin" aria-hidden="true"></span><div class="sub">' + tx('bd.auth.cancel', 'Cancel authorization') + '…</div></div>'
                    : '<div class="actions"><button type="button" class="btn" data-bdata-auth-cancel="1" data-act="auth-cancel" data-fk="auth-cancel">✕ ' + tx('bd.auth.cancel', 'Cancel authorization') + '</button></div>';
      return h + '</div>';
    }
    if (auth && auth.state === 'cancelled') h += '<p class="dim" data-bdata-auth-state="cancelled">✕ ' + tx('bd.auth.cancelled', 'Cancelled — no paid or uploaded state exists') + '</p>';
    if (!review) return h + '<div class="actions"><button type="button" class="btn primary" data-bdata-review-open="1" data-act="review" data-fk="review">➜ ' + tx('bd.auth.review', 'Review what you are authorizing') + '</button></div></div>';

    var d = FINV.domain || {}, a = d.artifact || {}, id = FINV.identity || {};
    function row(k, v){ return '<div class="rv"><span class="sub">' + k + '</span><span>' + v + '</span></div>'; }
    h += '<div class="review" data-bdata-review-panel="1">';
    h += row(tx('bd.auth.invoice', 'invoice'), '<bdi class="mono">' + esc(id.contentDigest || '') + '</bdi> <span class="sub">(' + tx('bd.auth.lineage', 'lineage') + ': <bdi class="mono">' + esc(String(id.priorDigest || '').slice(0, 23)) + '…</bdi>)</span>');
    h += row(tx('bd.cyber.s.payload', 'Payload'), '<bdi>' + esc(a.name) + '</bdi> · <bdi>' + Number(a.bytes).toLocaleString('en-US') + '</bdi> ' + tx('bd.bytes', 'bytes') + ' · <bdi class="mono">sha256 ' + esc(String(a.sha256).slice(0, 12)) + '…</bdi>');
    h += row(tx('wl.bpay.audience', 'audience'), '🌐 ' + tx('wl.bpay.aud.public', 'Public') + ' — <b>' + tx('bd.auth.binding', 'founder-selected, origin My Data') + '</b>');
    h += row(tx('bd.auth.ceiling', 'ANT ceiling'), antHtml(fl.amountAtto, true) + ' <span class="sub">' + tx('bd.auth.exact', 'exact, never above') + '</span>');
    h += row(tx('bd.auth.gas', 'gas'), '⛽ ' + tx('bd.auth.gasnote', 'separate — Arbitrum ETH, wallet-side at signing; never folded into storage'));
    h += row(tx('bd.auth.fresh', 'freshness'), tx('wl.bpay.fresh', 'quote obtained') + ' ' + when(q.obtainedAt) + ' · ' + tx('bd.auth.singleuse', 'single-use — a re-quote voids this authorization automatically (the digest wall)'));
    var stops = (FINV.authorization && Array.isArray(FINV.authorization.stopConditions) && FINV.authorization.stopConditions.length) ? FINV.authorization.stopConditions.map(function(x){ return '<bdi>' + esc(x) + '</bdi>'; }) : [tx('bd.auth.stopquote', 'quote set superseded or consumed'), tx('bd.auth.stopartifact', 'artifact identity mismatch')];
    h += row(tx('bd.auth.stops', 'stop conditions'), stops.join(' · '));
    h += '</div>';
    h += '<p class="sub note"><b>' + tx('bd.paid.scope', 'Nothing has been paid from this page.') + '</b> ' + tx('bd.auth.noroute', 'This press creates a bounded intent to sign — it cannot move value; signing is Phase E and starts only from this authorization.') + '</p>';
    if (authErr) h += '<div class="alert note" data-bdata-auth-err="1"><bdi class="mono">' + esc(authErr) + '</bdi></div>';
    // while the quote service is being asked there is no authorize button at all
    h += authBusy ? '<div class="busy note"><span class="spin" aria-hidden="true"></span><div class="sub">' + tx('bd.auth.go', 'I authorize this') + '…</div></div>'
                  : '<div class="actions"><button type="button" class="btn primary" data-bdata-auth-go="1" data-act="auth-go" data-fk="auth-go">🔑 ' + tx('bd.auth.go', 'I authorize this') + '</button></div>';
    return h + '</div>';
  }

  function authCall(path, body, done){
    // the same wall as the price ask: an automated browser never reaches the live quote service
    if (navigator.webdriver && trimBridge(st.bridge) === DEFAULT_BRIDGE) { authErr = failHead({ cls:'automation' }); render(); return; }
    authBusy = true; authErr = null; render();
    fetch(trimBridge(st.bridge) + path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) })
      .then(function(r){
        if (!r.ok) return r.text().then(function(t){ throw new Error('HTTP ' + r.status + (t ? ' — ' + t.slice(0, 180) : '')); });
        return r.json();
      }).then(function(rec){
        if (!rec || typeof rec.authorization_id !== 'string' || typeof rec.state !== 'string') throw new Error('the answer was not an authorization record');
        authBusy = false; done(rec);
      }).catch(function(e){
        authBusy = false; authErr = String((e && e.message) || e).slice(0, 200);
        render({ focus: 'auth' }); say(authErr);
      });
  }
  function authorizePress(){
    var sel = chosen(), q = sel ? usableQuote(sel) : null, fl = founderLine(), has = authFor(q);
    if (authBusy || !q || !fl || fl.amountAtto !== q.totalAtto || (has && has.state === 'authorized-for-signing')) { render(); return; }
    authCall('/v1/authorization', {
      upload_id: q.uploadId,
      invoice_digest: FINV.identity.contentDigest,
      commitment_digest: FINV.commitment.digest,
      artifact_sha256: FINV.domain.artifact.sha256,
      artifact_bytes: FINV.domain.artifact.bytes,
      audience: 'public',
      ant_ceiling_atto: fl.amountAtto,
      gas_ceiling: 'separate — wallet-side at signing',
      stop_conditions: (FINV.authorization && FINV.authorization.stopConditions) || [],
      gesture: 'founder press in My Data @ ' + new Date().toISOString()
    }, function(rec){
      st.authorization = { id: rec.authorization_id, state: rec.state, quoteAt: q.obtainedAt };
      if (!save({ authorization: st.authorization })) notice = 'nostore';
      note({ kind:'auth', id: rec.authorization_id });
      review = false;
      render({ focus: 'auth-cancel' });
      say(T('bd.auth.done', 'Authorized for signing — nothing signed, nothing paid; signing arrives with Phase E'));
    });
  }
  function cancelPress(){
    var a = st.authorization;
    if (authBusy || !a || a.state !== 'authorized-for-signing') { render(); return; }
    authCall('/v1/authorization/cancel', { authorization_id: a.id }, function(rec){
      st.authorization = { id: rec.authorization_id, state: rec.state, quoteAt: a.quoteAt };
      save({ authorization: st.authorization });
      note({ kind:'auth.cancelled', id: rec.authorization_id });
      render({ focus: 'review' });
      say(T('bd.auth.cancelled', 'Cancelled — no paid or uploaded state exists'));
    });
  }

  function since(){ if (ask) return ask.startedAt; var m = foreignAsk(); return m ? m.at : null; }
  function elapsedText(){ var t = since(); return t ? fill(T('bd.price.elapsed', '{s} s so far — usually under a minute'), { s: Math.max(0, Math.round((Date.now() - t) / 1000)) }) : ''; }

  function modeLabel(m){ return m === 'ask' ? T('bd.auto.ask', 'Ask me') : m === 'auto' ? T('bd.auto.auto', 'Automatic within limits') : m === 'never' ? T('bd.auto.never', 'Never') : String(m); }
  function autoCard(){
    var m = st.automation.mode;
    var h = '<div class="seg" role="radiogroup" aria-labelledby="auto-h">';
    [['ask', 'bd.auto.ask', 'Ask me'], ['auto', 'bd.auto.auto', 'Automatic within limits'], ['never', 'bd.auto.never', 'Never']].forEach(function(p){
      h += '<button type="button" class="btn" data-bdata-auto="' + p[0] + '" data-act="mode" data-fk="mode-' + p[0] + '" role="radio" aria-checked="' + (m === p[0] ? 'true' : 'false') + '">' + tx(p[1], p[2]) + '</button>';
    });
    h += '</div>';
    if (m === 'auto') {
      h += '<div class="field"><label for="bdata-bound">' + tx('bd.auto.bound', 'each operation at most') + '</label><input id="bdata-bound" data-fk="bound" inputmode="decimal" autocomplete="off" size="10" value="' + esc(fieldErr.bound || st.automation.boundAnt) + '" aria-describedby="bdata-bound-note' + (fieldErr.bound ? ' bdata-bound-err' : '') + '"' + (fieldErr.bound ? ' aria-invalid="true"' : '') + '><span>ANT</span>' + (fieldErr.bound ? '<span class="err" id="bdata-bound-err">' + tx('bd.auto.boundbad', 'Enter a plain number, 0 or more (up to 18 decimals).') + '</span>' : '') + '</div>';
      h += '<p class="sub note" id="bdata-bound-note">' + tx('bd.auto.boundnote', 'an autonomous preserve above the bound is refused — it must ask') + '</p>';
    }
    if (notice === 'nostore') h += '<div class="alert note"><b>' + tx('bd.aud.nostore', 'This browser would not save your choice, so nothing was asked.') + '</b></div>';
    h += '<p class="dim note" data-bdata-auto-mode="' + m + '">' + (m === 'ask' ? tx('bd.auto.asknote', 'every economic gesture asks you first — through the surface, never chat') : m === 'auto' ? tx('bd.auto.autonote', 'your bees may preserve within the bound you set; capabilities they lack stay unavailable') : tx('bd.auto.nevernote', 'nothing spends unless you press it yourself')) + '</p>';
    return h;
  }

  // an edition is worded when SHOWN (whole sentences, the reader's tongue);
  // editions written before this build carry their own words and are shown as written
  function histText(e){
    if (typeof e.what === 'string') return e.what;
    if (e.kind === 'audience.chosen') return T('bd.hist.audience', 'audience policy: chosen 🌐 Public by the founder — originated in My Data; supersedes the machine reference binding (new quote required); the reference plan remains as history');
    if (e.kind === 'audience.undone') return T('bd.hist.undo', 'audience policy: the 🌐 Public choice was withdrawn in My Data — the earlier plan remains as history') + (e.quote ? ' · ' + fill(T('bd.hist.quote', 'storage price obtained: {ant} ANT · {count} chunk quotes — nothing has been paid from this page'), { ant: antStr(e.quote.totalAtto), count: e.quote.count }) : '');
    if (e.kind === 'auto.mode') return fill(T('bd.hist.mode', 'automation policy: {from} → {to} — governs future decisions; prior operations unchanged'), { from: modeLabel(e.from), to: modeLabel(e.to) + (e.bound ? ' (' + e.bound + ' ANT)' : '') });
    if (e.kind === 'auto.bound') return fill(T('bd.hist.bound2', 'automation bound: {from} → {to} ANT — governs future decisions; prior operations unchanged'), { from: e.from, to: e.to });
    if (e.kind === 'auth') return T('bd.hist.auth', 'authorization ') + e.id + ' — ' + T('bd.hist.authnote', 'founder press in My Data; authorized-for-signing; nothing signed/paid/uploaded');
    if (e.kind === 'auth.cancelled') return T('bd.hist.authcancel', 'authorization ') + e.id + ' — ' + T('bd.hist.authcancelnote', 'cancelled by the founder before any signature existed; no paid or uploaded state exists');
    if (e.kind === 'quote') return fill(T('bd.hist.quote', 'storage price obtained: {ant} ANT · {count} chunk quotes — nothing has been paid from this page'), { ant: antStr(e.totalAtto), count: e.count }) + (e.uploadId ? ' · ' + e.uploadId : '');
    return String(e.kind || '');
  }

  function cyber(){
    if (invState !== 'ready') return '<div class="sect law">' + tx('wl.bpay.loadfail', 'no invoice loaded') + '</div>';
    var d = INV.domain, a = d.artifact, pol = d.policy || {}, aud = pol.audience || {}, line = refLine() || {}, sel = chosen(), q = sel ? usableQuote(sel) : null;
    var h = '';
    function S(k, en, body){ return '<div class="sect"><b>' + tx(k, en) + '</b> — ' + body + '</div>'; }
    h += S('bd.cyber.s.payload', 'Payload', '<bdi>' + esc(a.name) + '</bdi> · <bdi>' + Number(a.bytes).toLocaleString('en-US') + '</bdi> ' + tx('bd.bytes', 'bytes') + ' · <span class="mono">sha256 ' + esc(a.sha256) + '</span> (' + tx('bd.cyber.orig', 'the original, never re-encoded') + ')');
    h += S('bd.cyber.s.audience', 'Audience', tx('bd.cyber.resolved', 'resolved') + ': <b>' + esc((sel && sel.audience) || aud.selected || 'public') + '</b> — <bdi>' + esc(aud.access || pol.access || '') + '</bdi>' + (sel ? ' · ' + (originHere(sel) ? tx('bd.cyber.origin.here', 'origin: My Data (this surface)') : tx('bd.cyber.origin.else', 'origin: not recorded on this surface')) + ' · <span class="mono">' + esc(utc(sel.selectedAt)) + '</span>' : '') + ' · ' + UNAVAIL.map(function(u){ return '🔒 ' + tx(u.label[0], u.label[1]) + ': ' + tx(u.tech[0], u.tech[1]); }).join(' · ') + ' · ' + tx('bd.cyber.audnote', 'adjustable before commitment; after commitment a change supersedes (new quote), never mutates'));
    var svC = storedVerdict();
    var storedBare = svC.state === 'stored' ? bareHex(svC.receipt.data_map_address) : null;
    var stateHtml = storedBare
      ? '<b data-bdata-stored="1">✓ ' + tx('bd.stored.on', 'Stored on Autonomi') + '</b> · <a class="btn" data-bdata-watch="1" href="bview.html#' + esc(storedBare) + '">' + tx('bd.stored.watch', 'Watch') + '</a>'
      : '<b>' + tx('bd.cyber.state', 'NOT STORED — nothing has been paid from this page') + '</b>';
    h += S('bd.cyber.s.storage', 'Storage', tx('bd.cyber.adapter', 'adapter: Autonomi (production network, keyless prepare proven) · deterministic address once stored') + ': <span class="mono">' + esc(storedBare || d.data_map_address || '—') + '</span> · ' + tx('bd.cyber.statelbl', 'state') + ': ' + stateHtml);
    h += S('bd.cyber.s.authority', 'Authority', tx('bd.cyber.auth', 'the founder gesture alone changes policy or spends; agents prepare and verify; chat text is never canonical'));
    h += S('bd.cyber.s.automation', 'Automation', '<b>' + esc(modeLabel(st.automation.mode)) + '</b>' + (st.automation.mode === 'auto' ? ' (' + esc(fill(T('bd.cyber.bound', 'bound {ant} ANT per operation'), { ant: st.automation.boundAnt })) + ')' : '') + ' — ' + tx('bd.cyber.future', 'governs future decisions only'));
    h += S('bd.cyber.s.value', 'Value', (line.amountAtto ? tx('bd.cyber.refcommit', 'reference commitment') + ' <span class="mono">' + esc((INV.commitment && INV.commitment.digest) || '') + '</span> · ' + tx('bd.ceiling', 'ceiling') + ' <bdi>' + esc(antStr(line.amountAtto)) + ' ANT</bdi>' : tx('bd.cyber.nopriced', 'no priced obligation yet')) + (q ? ' · ' + tx('wl.bpay.fresh', 'quote obtained') + ' <span class="mono">' + esc(utc(q.obtainedAt)) + '</span> <bdi>' + esc(antStr(q.totalAtto)) + ' ANT</bdi>' + (q.uploadId ? ' <span class="mono">' + esc(q.uploadId) + '</span>' : '') : '') + ' · ' + tx('bd.cyber.value', 'bPay (wallet) holds the obligation when economics are required'));
    h += S('bd.cyber.s.evidence', 'Evidence', storedBare
      ? tx('bd.stored.evidence', 'stored: receipt bdata-stored-bux-try-autonomi.json — purchased · uploaded · retrieved, each citing its source; identity pin: invoice bpay-invoice.json')
      : tx('bd.cyber.evidence', 'live quote receipt banked in-tree (docs/receipts/); no payment evidence yet — quote ≠ purchased ≠ uploaded ≠ retrieved'));
    h += '<div class="sect"><b>' + tx('bd.cyber.s.history', 'History') + '</b> — ' + tx('bd.cyber.hist', 'append-only policy editions; supersede, never rewrite');
    if (!st.history.length) h += '<div class="hist">' + tx('flow.st.notyet', 'not yet') + '</div>';
    st.history.forEach(function(e){ h += '<div class="hist" data-bdata-history="' + esc(e.kind || 'legacy') + '"><span class="mono">' + esc(utc(e.at)) + '</span> · ' + esc(histText(e)) + '</div>'; });
    h += '</div>';
    // the quote-service address: reachable BEFORE any gesture and in EVERY register —
    // one tap away for New bee, open for cypherpunk (technical is a depth, never a tier)
    h += '<div class="field" data-bdata-bridge-row="1"><label class="sub" for="bdata-bridge">' + tx('wl.bpay.bridge', 'quote service') + '</label><input id="bdata-bridge" class="mono" data-fk="bridge" inputmode="url" autocomplete="off" spellcheck="false" value="' + esc(fieldErr.bridge || st.bridge) + '"' + (ask ? ' disabled' : '') + (fieldErr.bridge ? ' aria-invalid="true" aria-describedby="bdata-bridge-err"' : '') + '>' + (fieldErr.bridge ? '<span class="err" id="bdata-bridge-err">' + tx('bd.bridge.bad', 'Enter an http(s) address.') + '</span>' : '') + '</div>';
    return h;
  }

  // one region failing to draw never strands the others (or the listeners below)
  function paint(id, fn){
    var el = document.getElementById(id); if (!el) return;
    try { el.innerHTML = fn(); }
    catch(e){ el.innerHTML = '<div class="card"><div class="alert"><b>' + tx('bd.err.draw', 'This part of the page could not be drawn.') + '</b><bdi class="mono">' + esc(String((e && e.message) || e).slice(0, 160)) + '</bdi></div></div>'; }
  }
  function render(opts){
    var active = document.activeElement, had = (active && active.getAttribute && active.getAttribute('data-fk')) || null;
    // a requested focus move happens only when the reader is nowhere or already in this ceremony —
    // an answer landing a minute later never pulls them out of a field, a disclosure or the top bar
    var free = !active || active === document.body || /^(ask|stop|price|public|undo|reload-inv|review|auth|auth-go|auth-cancel)$/.test(had || '');
    var fk = (opts && opts.focus && free) ? opts.focus : had;
    // a press that replaces its own button hands focus to what took its place
    var NEXT = { ask:['ask','stop','price'], stop:['stop','ask','price'], undo:['undo','public'], price:['price'], 'reload-inv':['reload-inv','public'], 'reload-stored':['reload-stored','public'], review:['auth-go','review','auth'], 'auth-go':['auth-cancel','auth-go','auth'], 'auth-cancel':['review','auth-cancel','auth'] };
    // text being typed right now survives the redraw, caret and all
    var typing = (active && (active.id === 'bdata-bound' || active.id === 'bdata-bridge')) ? { id: active.id, v: active.value, s: active.selectionStart, e: active.selectionEnd } : null;
    // a reader's own disclosure taps survive every redraw
    var open = {};
    document.querySelectorAll('details[data-dk]').forEach(function(d){ open[d.getAttribute('data-dk')] = { open: d.open, touched: d.dataset.userTouched }; });
    if (review && !(chosen() && usableQuote(chosen()))) review = false;   // the price it was for is gone
    paint('shelf', shelf);
    paint('auto-card', autoCard);
    paint('cyber', cyber);
    var sh = document.getElementById('shelf'); if (sh) sh.setAttribute('aria-busy', String(invState === 'loading'));
    var reg = document.body.getAttribute('data-reg') || 'bee';
    document.querySelectorAll('details[data-dk]').forEach(function(d){
      var was = open[d.getAttribute('data-dk')];
      if (was) { d.open = was.open; if (was.touched) d.dataset.userTouched = was.touched; }
      else d.open = (reg === 'cypherpunk');
    });
    if (fk) { var target = null; (NEXT[fk] || [fk]).some(function(k){ target = document.querySelector('[data-fk="' + k + '"]:not([disabled])'); return !!target; }); if (target && target !== document.activeElement) { try { target.focus({ preventScroll: true }); } catch(e){} } }
    if (typing) { var field = document.getElementById(typing.id); if (field && !field.disabled) { field.value = typing.v; try { field.setSelectionRange(typing.s, typing.e); } catch(e){} } }
    var waitingOn = since();
    if (waitingOn && !ticker) ticker = setInterval(function(){ if (!since()) { clearInterval(ticker); ticker = null; render(); return; } var el = document.querySelector('[data-bdata-elapsed]'); if (el) el.textContent = elapsedText(); }, 1000);
    if (!waitingOn && ticker) { clearInterval(ticker); ticker = null; }
    // "current" expires by itself, even on a page nobody touches
    clearTimeout(freshTimer); freshTimer = null;
    var sel = chosen(), q = sel && !ask ? usableQuote(sel) : null, left = q ? FRESH_MS - (Date.now() - new Date(q.obtainedAt).getTime()) : 0;
    if (left > 0) freshTimer = setTimeout(render, left + 250);
  }

  /* ---------- listeners: delegated ONCE on the stable page, so no redraw can lose them ---------- */
  var root = document.getElementById('bdata') || document.body;
  root.addEventListener('click', function(ev){
    var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!b || b.disabled) return;
    var act = b.getAttribute('data-act');
    if (act === 'public') choosePublic();
    else if (act === 'undo') undoChoice();
    else if (act === 'ask') startAsk();
    else if (act === 'stop') { stopAsk(); render({ focus: 'ask' }); say(''); }
    else if (act === 'mode') setMode(b.getAttribute('data-bdata-auto'));
    else if (act === 'reload-inv') loadInvoice();
    else if (act === 'reload-stored') loadStored();
    else if (act === 'review') { review = true; authErr = null; render(); }
    else if (act === 'auth-go') authorizePress();
    else if (act === 'auth-cancel') cancelPress();
  });
  root.addEventListener('change', function(ev){
    var t = ev.target; if (!t) return;
    if (t.id === 'bdata-bound') setBound(t.value);
    else if (t.id === 'bdata-bridge') setBridge(t.value);
  });
  // the riders: language re-words everything; the register only changes what
  // CSS and the disclosures show, but a redraw keeps new nodes in step
  document.addEventListener('blang', function(){ render(); });
  document.addEventListener('bregister', function(){ render(); });
  // another tab (My Data or the wallet) changed policy or state: follow it
  window.addEventListener('storage', function(e){
    if (e.key !== null && e.key !== SHARED && e.key !== LS) return;
    st = load();
    var now = chosen();
    if (ask && (!now || now.selectedAt !== ask.sel.selectedAt)) stopAsk();   // the selection it was for no longer stands
    render();
  });
  if (chan) chan.onmessage = function(ev){
    var m = ev.data || {};
    if (m.t === 'who' && ask && ask.id === m.id) { try { chan.postMessage({ t:'alive', id: m.id }); } catch(e){} }
    else if (m.t === 'alive') peers[m.id] = 'alive';
  };
  window.addEventListener('pagehide', function(){ if (ask) mark(null); });

  /* ---------- the store receipt (founder order 2026-09-25) ----------
     The Bux video IS on Autonomi mainnet — the founder paid and uploaded by
     his own hand (RECEIPT-ANT-VIDEO-UPLOAD-2026-09-21). This page may say
     STORED only when the receipt on file verifies against the invoice line
     by line: name, sha256, bytes, data-map address, network, audience and
     all three evidence rows (purchased / uploaded / retrieved), each citing
     its source. Anything less renders exactly as before — the page claims
     only what its own evidence shows (measured-states economics law). */
  var STO = null, stoState = 'loading', stoErr = '';   // loading | ready | absent | unreadable
  function bareHex(v){ return String(v || '').replace(/^0x/i, '').toLowerCase(); }
  function storeVerify(r){
    if (!INV || !INV.domain || !INV.domain.artifact) return 'no-invoice';
    var a = INV.domain.artifact, d = INV.domain, aud = (d.policy && d.policy.audience) || {};
    if (!r || typeof r !== 'object' || Array.isArray(r) || r.schema !== 'bdata.store-receipt/1') return 'shape';
    if (!r.artifact || typeof r.artifact !== 'object' || r.artifact.name !== a.name || r.artifact.sha256 !== a.sha256 || Number(r.artifact.bytes) !== Number(a.bytes)) return 'artifact';
    if (!/^[0-9a-f]{64}$/.test(bareHex(r.data_map_address)) || bareHex(r.data_map_address) !== bareHex(d.data_map_address)) return 'address';
    if (r.network !== d.network) return 'network';
    if (r.audience !== aud.selected) return 'audience';
    if (!Array.isArray(r.evidence)) return 'evidence';
    var need = ['purchased', 'uploaded', 'retrieved'];
    for (var i = 0; i < need.length; i++) {
      var row = r.evidence.filter(function(e){ return e && e.state === need[i]; })[0];
      if (!row || typeof row.source !== 'string' || !row.source.trim()) return 'evidence';
    }
    return 'stored';
  }
  // the verdict for THIS render: the receipt only speaks when the invoice it
  // must match is on the page; a mismatch renders exactly as before
  function storedVerdict(){
    if (invState === 'loading' || stoState === 'loading') return { state: 'loading' };
    if (stoState === 'unreadable') return { state: 'unreadable', why: stoErr };
    if (stoState !== 'ready' || invState !== 'ready') return { state: 'absent' };
    var v = storeVerify(STO);
    return v === 'stored' ? { state: 'stored', receipt: STO } : { state: 'mismatch', why: v };
  }
  function loadStored(){
    stoState = 'loading'; stoErr = ''; render();
    fetch('bdata-stored-bux-try-autonomi.json').then(function(r){
      if (r.status === 404) { STO = null; stoState = 'absent'; return null; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().catch(function(){ throw new Error('the answer was not JSON'); });
    }).then(function(rec){
      if (stoState === 'absent') return;
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new Error('empty answer');
      STO = rec; stoState = 'ready';
    }).catch(function(e){
      STO = null; stoState = 'unreadable';
      stoErr = String((e && e.message) || e).slice(0, 160);
    }).then(function(){ render(); });
  }

  function loadInvoice(){
    invState = 'loading'; render();
    fetch('bpay-invoice.json').then(function(r){
      if (r.status === 404) { INV = null; invState = 'empty'; return null; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(inv){
      if (invState === 'empty') return;
      var a = inv && inv.domain && inv.domain.artifact;
      if (!a || typeof a.name !== 'string' || typeof a.sha256 !== 'string' || !(Number(a.bytes) >= 0)) throw new Error('invoice shape');
      INV = inv; invState = 'ready';
    }).catch(function(){ INV = null; invState = 'failed'; say(T('bd.inv.fail', 'Your data list did not load.')); }).then(function(){ render(); });
  }
  loadInvoice();
  loadStored();
  // without the current founder invoice the authorization step stays locked, in words
  fetch('bpay-invoice-founder.json').then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(finv){ if (finv && finv.identity && finv.commitment && finv.domain && finv.domain.artifact) { FINV = finv; render(); } })
    .catch(function(){});
})();
