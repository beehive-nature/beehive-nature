/* mission-core.js — THE MISSION ENGINE shared by the LOVErnment mission
   surfaces (missions.html · mission-room.html · receipts.html).
     One engine, three stations. Every operation is a supervised autonomous
   mission: the human approves the envelope (mission, ceiling, permissions);
   agents work inside it; every meaningful action leaves a machine-readable
   receipt; an evaluator releases milestones, pauses, or escalates.
     FIRST RAIL (this file): off-chain proposals + hash-chained receipts with
   testnet accounting, kept in the browser (localStorage) over a deterministic
   seed. The Buzz relay wire (NIP-29 community rooms carrying the same
   envelopes) and the ERC20i treasury rail are later, separate lanes — nothing
   here claims them. Every figure is a fixture, not a measurement.
     Node-requireable on purpose: scripts/build-missions-seed.mjs requires
   this same file so the seed's budget math and chain recipe can never drift
   from what the browser verifies. */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var CURRENCY_NOTE = 'testnet accounting · USD-denominated fixtures — no token moves on these surfaces; the ERC20i treasury is a later rail';

  /* mission lifecycle. Human levers (stop / change order / pause) are legal
     from almost anywhere; the map below is the autonomous path only. */
  var STATES = ['draft', 'budgeted', 'review', 'approved', 'funded', 'active',
    'paused', 'escalated', 'stopped', 'complete'];
  var ALLOWED = {
    draft: ['budgeted'],
    budgeted: ['review', 'draft'],
    review: ['approved', 'draft'],
    approved: ['funded'],
    funded: ['active'],
    active: ['paused', 'escalated', 'complete', 'stopped'],
    paused: ['active', 'escalated', 'stopped'],
    escalated: ['active', 'paused', 'stopped'],
    complete: [],
    stopped: []
  };

  var ESCALATION_REASONS = ['spending_above_ceiling', 'production_changes',
    'legal_or_rights_claims', 'irreversible_transactions'];

  /* Fixture rates for the POC calculator (USD-denominated testnet
     accounting). One schedule per rostered model, per million tokens. When
     the DAO reviewer wires real invoices these become per-mission quotes. */
  var RATES = {
    tokens_per_million: {
      astra: { in: 0.60, out: 2.40, reason: 3.60 },
      glm: { in: 0.15, out: 0.60, reason: 1.20 },
      grok: { in: 0.30, out: 1.20, reason: 1.80 },
      fable: { in: 0.20, out: 0.80, reason: 1.20 }
    },
    compute_hour: 0.12,
    storage_gb: 0.08,
    bandwidth_gb: 0.01,
    human_hour: 0 /* founder attention is tracked in hours, never invoiced */
  };

  /* ── SHA-256, dependency-free ───────────────────────────────────────────
     Runs anywhere the surfaces run, including file:// where SubtleCrypto is
     unavailable. The seed's hashes come from node:crypto — same function,
     one recipe. */
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  function sha256hex(str) {
    var msg = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) msg.push(c);
      else if (c < 0x800) msg.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0xd800 || c >= 0xe000) msg.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else {
        i++;
        var cp = 0x10000 + ((c & 0x3ff) << 10) + (str.charCodeAt(i) & 0x3ff);
        msg.push(0xf0 | cp >> 18, 0x80 | cp >> 12 & 63, 0x80 | cp >> 6 & 63, 0x80 | cp & 63);
      }
    }
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    msg.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255,
      lo >>> 24 & 255, lo >>> 16 & 255, lo >>> 8 & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < msg.length; off += 64) {
      for (var t = 0; t < 16; t++) w[t] = (msg[off + 4 * t] << 24) | (msg[off + 4 * t + 1] << 16) | (msg[off + 4 * t + 2] << 8) | msg[off + 4 * t + 3];
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = rotr(w[t2 - 15], 7) ^ rotr(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = rotr(w[t2 - 2], 17) ^ rotr(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K256[j] + w[j]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2n = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2n) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = '';
    for (var n = 0; n < 8; n++) out += ('00000000' + (H[n] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* ── the receipt chain ──────────────────────────────────────────────────
     Fixed field order is the recipe: hash = sha256(prev + '|' + canonical).
     The seed generator (node:crypto) and every browser verify the same way. */
  var CHAIN_FIELDS = ['seq', 'ts', 'mission', 'kind', 'actor', 'summary', 'cost_usd', 'artifacts', 'note'];

  function canonicalReceipt(r) {
    var o = {};
    CHAIN_FIELDS.forEach(function (f) { o[f] = r[f]; });
    return JSON.stringify(o);
  }
  function receiptHash(r, prev) { return sha256hex(prev + '|' + canonicalReceipt(r)); }
  function verifyChain(receipts) {
    var prev = '';
    for (var i = 0; i < receipts.length; i++) {
      var r = receipts[i];
      if (typeof r.seq !== 'number' || r.seq !== i + 1) return { ok: false, broken_at: r.seq || i + 1, count: receipts.length, head: prev };
      var h = receiptHash(r, prev);
      if (h !== r.hash) return { ok: false, broken_at: r.seq, count: receipts.length, head: prev };
      prev = h;
    }
    return { ok: receipts.length > 0, broken_at: 0, count: receipts.length, head: prev };
  }
  function appendReceipt(ledger, rec) {
    var head = ledger.receipts.length ? ledger.receipts[ledger.receipts.length - 1].hash : '';
    rec.seq = ledger.receipts.length + 1;
    rec.hash = receiptHash(rec, head);
    ledger.receipts.push(rec);
    return rec;
  }

  /* ── the budget and tithe calculator ─────────────────────────────────────
     api_estimate.by_model counts tokens in MILLIONS (fixture worksheets);
     the founder-visible aggregates render as raw token counts. */
  function round2(x) { return Math.round(x * 100) / 100; }

  function budget(resources) {
    var r = resources || {};
    var api = r.api_estimate || {};
    var byModel = api.by_model || {};
    var perModel = {}, apiTotal = 0, inTok = 0, outTok = 0, reasonTok = 0;
    Object.keys(byModel).forEach(function (m) {
      var t = byModel[m] || {};
      var rate = RATES.tokens_per_million[m] || { in: 0, out: 0, reason: 0 };
      var cost = (t.in || 0) * rate.in + (t.out || 0) * rate.out + (t.reason || 0) * rate.reason;
      perModel[m] = round2(cost);
      apiTotal += cost;
      inTok += t.in || 0; outTok += t.out || 0; reasonTok += t.reason || 0;
    });
    var c = r.compute || {};
    var computeCost = (c.runtime_hours || 0) * RATES.compute_hour
      + (c.storage_gb || 0) * RATES.storage_gb
      + (c.bandwidth_gb || 0) * RATES.bandwidth_gb;
    var ext = 0;
    (r.external_services || []).forEach(function (s) { ext += s.cost_usd || 0; });
    var operating = apiTotal + computeCost + ext;
    var contingency = operating * ((r.contingency_percent == null ? 10 : r.contingency_percent) / 100);
    var tithe = (operating + contingency) * ((r.tithe_percent == null ? 10 : r.tithe_percent) / 100);
    return {
      api_by_model: perModel,
      api_total: round2(apiTotal),
      tokens: { input_m: round2(inTok), output_m: round2(outTok), reasoning_m: round2(reasonTok) },
      compute: round2(computeCost),
      external: round2(ext),
      operating_cost_estimate: round2(operating),
      contingency_reserve: round2(contingency),
      bnr_tithe: round2(tithe),
      requested_total: round2(operating + contingency + tithe),
      human_review_hours: r.human_review_hours || 0,
      currency: CURRENCY_NOTE
    };
  }

  /* ── spend + the milestone evaluator ────────────────────────────────────
     The evaluator is a pure function of the ledger: continue / pause /
     escalate, and whether the next milestone may be released inside the
     approved ceiling. Guards: spend + next release must fit the ceiling;
     any unresolved escalation freezes releases. */
  function spendFor(receipts, missionId) {
    var total = 0;
    receipts.forEach(function (r) { if (r.mission === missionId) total += r.cost_usd || 0; });
    return round2(total);
  }
  function nextMilestone(mission) {
    var pend = (mission.milestones || []).filter(function (m) { return m.state === 'pending'; });
    return pend.length ? pend[0] : null;
  }
  function evaluate(mission, receipts) {
    var spend = spendFor(receipts, mission.mission.id);
    var ceiling = mission.controls && mission.controls.spending_ceiling || 0;
    var util = ceiling > 0 ? spend / ceiling : 0;
    var next = nextMilestone(mission);
    var escalated = receipts.some(function (r) {
      return r.mission === mission.mission.id && r.kind === 'evaluator.escalate';
    });
    var resolved = receipts.some(function (r) {
      return r.mission === mission.mission.id && r.kind === 'control.resume';
    });
    var openEscalation = escalated && !resolved;
    var reasons = [];
    if (ceiling > 0 && spend > ceiling) reasons.push('spending_above_ceiling');
    if (openEscalation) reasons.push.apply(reasons, mission.controls && mission.controls.human_escalation_required_for ? ['production_changes'] : ['unresolved_escalation']);
    if (mission.state === 'paused' || mission.state === 'stopped') reasons.push('mission_' + mission.state);
    var canRelease = !!(mission.controls && mission.controls.milestone_release)
      && (mission.state === 'funded' || mission.state === 'active')
      && ceiling > 0 && next && reasons.length === 0
      && round2(spend + next.release_usd) <= ceiling;
    var verdict;
    if (mission.state === 'stopped' || mission.state === 'complete') verdict = mission.state;
    else if (reasons.length) verdict = openEscalation ? 'escalate' : 'pause';
    else if (mission.state === 'review' || mission.state === 'draft' || mission.state === 'budgeted') verdict = 'await_human';
    else verdict = 'continue';
    return {
      spend: spend, ceiling: ceiling, utilization: util,
      next: next, reasons: reasons,
      open_escalation: openEscalation,
      can_release_next: canRelease,
      verdict: verdict
    };
  }

  /* ── reputation (from final reports; fixtures until real reports exist) ── */
  function reputation(fr) {
    if (!fr) return null;
    var proj = fr.projected && fr.projected.requested_total || 0;
    var act = fr.actual && fr.actual.total_spend || 0;
    var accuracy = proj > 0 ? Math.max(0, 1 - Math.abs(act - proj) / proj) : 0;
    return {
      delivery: fr.milestones_delivered / Math.max(1, fr.milestones_planned),
      cost_accuracy: accuracy,
      truthful_reporting: fr.unverified_claims === 0 ? 1 : Math.max(0, 1 - fr.unverified_claims / 5)
    };
  }

  /* ── storage adapter — local-first over the deterministic seed ──────────
     The ledger lives in localStorage once touched; export/reset are
     first-class. The Buzz relay wire replaces this adapter later without
     touching the surfaces (ONE adapter seam, midivault law). */
  var LS_KEY = 'bnr.missions.ledger.v1';

  function seedLedger() {
    if (!global.BNR_MISSION_SEED) throw new Error('mission-seed.js missing — run scripts/build-missions-seed.mjs');
    return JSON.parse(JSON.stringify(global.BNR_MISSION_SEED));
  }
  function loadLedger() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* file:// or storage denied — seed it is */ }
    return seedLedger();
  }
  function saveLedger(ledger) {
    try { global.localStorage && global.localStorage.setItem(LS_KEY, JSON.stringify(ledger)); }
    catch (e) { /* keep working in-memory even when persistence is denied */ }
  }
  function resetLedger() {
    try { global.localStorage && global.localStorage.removeItem(LS_KEY); } catch (e) {}
  }
  function isLocal(ledger) {
    try { return !!(global.localStorage && global.localStorage.getItem(LS_KEY)); } catch (e) { return false; }
  }

  /* ── human levers + treasury — every action appends a chained receipt ─── */
  function findMission(ledger, id) {
    for (var i = 0; i < ledger.missions.length; i++) if (ledger.missions[i].mission.id === id) return ledger.missions[i];
    return null;
  }
  function nowIso() { return new Date().toISOString().replace(/\.\d+Z$/, 'Z'); }

  /* action: approve_ceiling | stop | change_order | resume | release_next */
  function applyControl(ledger, id, action, payload) {
    var m = findMission(ledger, id);
    if (!m) return { error: 'no such mission' };
    var ev = evaluate(m, ledger.receipts);
    var rec;
    if (action === 'approve_ceiling') {
      if (!payload || !payload.ceiling || payload.ceiling <= 0) return { error: 'ceiling must be a positive number' };
      m.controls.spending_ceiling = payload.ceiling;
      m.state = 'approved';
      rec = { ts: nowIso(), mission: id, kind: 'ceiling.approve', actor: 'founder · LOViS', summary: 'spending ceiling approved at $' + payload.ceiling.toFixed(2) + ' — the autonomous envelope is set', cost_usd: 0, artifacts: [], note: payload.note || '' };
    } else if (action === 'stop') {
      m.state = 'stopped';
      rec = { ts: nowIso(), mission: id, kind: 'control.stop', actor: 'founder · LOViS', summary: 'human stop — all autonomous work halts; no further milestone releases', cost_usd: 0, artifacts: [], note: payload && payload.note || '' };
    } else if (action === 'change_order') {
      if (!(payload && payload.note)) return { error: 'a change order carries its note' };
      m.mission.objective += ' · CHANGE: ' + payload.note;
      rec = { ts: nowIso(), mission: id, kind: 'control.change', actor: 'founder · LOViS', summary: 'change order — objective amended by the attending human: ' + payload.note, cost_usd: 0, artifacts: [], note: payload.note };
    } else if (action === 'resume') {
      if (!ev.open_escalation) return { error: 'nothing to resume' };
      rec = { ts: nowIso(), mission: id, kind: 'control.resume', actor: 'founder · LOViS', summary: 'escalation resolved by the attending human — the room resumes inside the approved envelope', cost_usd: 0, artifacts: [], note: payload && payload.note || '' };
      m.state = 'active';
    } else if (action === 'release_next') {
      if (!ev.can_release_next) return { error: 'evaluator refuses: ' + (ev.reasons.join(', ') || 'no pending milestone') };
      var n = ev.next;
      n.state = 'released';
      rec = { ts: nowIso(), mission: id, kind: 'treasury.release', actor: 'milestone evaluator', summary: 'milestone ' + n.id + ' released — $' + n.release_usd.toFixed(2) + ' against the approved ceiling', cost_usd: n.release_usd, artifacts: [], note: 'spend $' + ev.spend.toFixed(2) + ' of $' + ev.ceiling.toFixed(2) + ' before release' };
      var anyPend = nextMilestone(m);
      if (!anyPend && m.state !== 'complete') m.state = 'complete';
    } else return { error: 'unknown action' };
    appendReceipt(ledger, rec);
    saveLedger(ledger);
    return { receipt: rec, mission: m };
  }

  /* ── the proposal YAML — the founder's shape, serialized ──────────────── */
  function proposalYAML(m) {
    var r = m.resources, f = m.finance, c = m.controls, t = m.team;
    var L = [];
    L.push('mission:');
    L.push('  id: ' + m.mission.id);
    L.push('  title: "' + m.mission.title + '"');
    L.push('  objective: "' + m.mission.objective + '"');
    L.push('team:');
    L.push('  lead: ' + t.lead);
    L.push('  agents:');
    t.agents.forEach(function (a) {
      L.push('    - model: ' + a.model);
      L.push('      role: ' + a.role);
    });
    L.push('  human_attending: ' + t.human_attending);
    L.push('resources:');
    L.push('  api_estimate:');
    L.push('    input_tokens: ' + Math.round(f._worksheet.tokens.input_m * 1e6));
    L.push('    output_tokens: ' + Math.round(f._worksheet.tokens.output_m * 1e6));
    L.push('    reasoning_tokens: ' + Math.round(f._worksheet.tokens.reasoning_m * 1e6));
    L.push('  compute:');
    L.push('    runtime_hours: ' + r.compute.runtime_hours);
    L.push('    storage_gb: ' + r.compute.storage_gb);
    L.push('    bandwidth_gb: ' + r.compute.bandwidth_gb);
    L.push('  external_services: ' + (r.external_services.length ? '' : '[]'));
    r.external_services.forEach(function (s) {
      L.push('    - name: ' + s.name);
      L.push('      cost_usd: ' + s.cost_usd);
    });
    L.push('  human_review_hours: ' + r.human_review_hours);
    L.push('  contingency_percent: ' + r.contingency_percent);
    L.push('  tithe_percent: ' + r.tithe_percent);
    L.push('finance:');
    L.push('  operating_cost_estimate: ' + f.operating_cost_estimate);
    L.push('  contingency_reserve: ' + f.contingency_reserve);
    L.push('  bnr_tithe: ' + f.bnr_tithe);
    L.push('  requested_total: ' + f.requested_total);
    L.push('  currency: "' + f.currency + '"');
    L.push('controls:');
    L.push('  spending_ceiling: ' + c.spending_ceiling);
    L.push('  milestone_release: ' + c.milestone_release);
    L.push('  production_access: ' + c.production_access);
    L.push('  secrets_access: ' + c.secrets_access);
    L.push('  human_escalation_required_for:');
    c.human_escalation_required_for.forEach(function (x) { L.push('    - ' + x); });
    return L.join('\n');
  }

  /* ── small shared helpers ──────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  function T(key, fallback) {
    return (global.BNRLanguage && typeof global.BNRLanguage.text === 'function')
      ? global.BNRLanguage.text(key, fallback) : fallback;
  }
  function fmtUSD(x) { return '$' + (Math.round(x * 100) / 100).toFixed(2); }
  function fmtTs(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
    return m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + 'Z' : String(iso || '');
  }

  global.BNRMissions = {
    SCHEMA_VERSION: SCHEMA_VERSION, CURRENCY_NOTE: CURRENCY_NOTE,
    STATES: STATES, ALLOWED: ALLOWED, ESCALATION_REASONS: ESCALATION_REASONS, RATES: RATES,
    sha256hex: sha256hex, canonicalReceipt: canonicalReceipt, receiptHash: receiptHash,
    verifyChain: verifyChain, appendReceipt: appendReceipt,
    budget: budget, evaluate: evaluate, reputation: reputation, spendFor: spendFor, nextMilestone: nextMilestone,
    loadLedger: loadLedger, saveLedger: saveLedger, resetLedger: resetLedger, seedLedger: seedLedger, isLocal: isLocal,
    applyControl: applyControl, findMission: findMission, proposalYAML: proposalYAML,
    esc: esc, T: T, fmtUSD: fmtUSD, fmtTs: fmtTs, LS_KEY: LS_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
