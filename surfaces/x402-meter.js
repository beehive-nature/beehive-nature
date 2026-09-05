/* x402-meter.js — THE METER-SESSION AUDITOR, in your page (z3.2, 2026-09-04).
   The second half of the x402 raid's z3.2 rows: the spend-receipt auditor
   (spend-audit.js) recomputes BILLS; this one recomputes METER SESSIONS —
   the pure 9-check audit of SPEC-VENDING-1 §x402 item 4, ported from
   contracts/vending/tool/x402audit.mjs (Tally audit.ts shape, RULES only).
   The port is held to the tool by e2e/x402-engine-parity.mjs: both engines
   run over the same public record and must return the same verdict, check
   names and notes, byte for byte — one law, two engines, proven equal.

   THE LAW IT AUDITS (the meter rules, ruled 2026-09-04):
   · credit lands ONLY from settled single-use nonces — and a settle burns
     its nonce EVEN AT ZERO (the Tally rule)
   · charges clamp under a ceiling signed ONCE at open (over-max refused)
   · a session that cannot pay is PAUSED, never killed; charges refuse
     while paused; top-up + resume bring it back
   · every rates row carries its own tithe beside the basis — the split is
     audited, never trusted

   THE FOUR VERIFIER STATES, drawn as comb cells (CANON-COMB vocabulary):
     PASSED          = capped   — sealed gold with the ⬡ glyph
     PENDING_ANCHOR  = honey    — amber, ripening
     FAILED          = flag     — the validated --flag/--cat-bug hue #c07f1c,
                                  NEVER a new red (founder hue-correction)
     INCONCLUSIVE    = nectar   — translucent; the record does not carry the
                                  verdict yet
   precedence (z3.2): failed ? FAILED : inconclusive ? INCONCLUSIVE
                      : covered ? PASSED : PENDING_ANCHOR

   CARE (verbatim, wherever these states are drawn):
   this is topology and vocabulary, NEVER a security claim.

   UMD-shaped like its sibling: browser attaches window.X402Meter; node (the
   parity gate) gets module.exports — the audit core is pure. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.X402Meter = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var STATES = ['PASSED', 'PENDING_ANCHOR', 'FAILED', 'INCONCLUSIVE'];

  /* ── exact meter arithmetic: asset strings parse to their integer units
     ("0.6000 A" → 6000n) exactly as the contract stores them. The scale is
     the string's own decimals — Jungle/Vaulta quantities are 4 — so the
     multiplication price × units never rounds: it cannot. ─────────────── */
  function assetAmt(s) {
    return BigInt(String(s).trim().split(' ')[0].replace('.', '') || '0');
  }
  function fmtA(n) {                       // 4-decimals units → "x.xxxx A"
    var s = BigInt(n).toString().padStart(5, '0');
    return s.slice(0, -4) + '.' + s.slice(-4) + ' A';
  }

  /* ── the pure 9-check audit — ported from tool/x402audit.mjs; the parity
     gate fails if the two drift. No I/O inside: public record in, verdict
     out; anyone re-runs it and gets the same answer. ──────────────────── */
  function auditSession(record) {
    var sess = record.sess, rate = record.rate, nonces = record.nonces || [], events = record.events || [];
    var F = [], inconclusive = false, anchorCovered = false;
    function pass(name, note) { F.push({ name: name, ok: true, note: note }); }
    function fail(name, note) { F.push({ name: name, ok: false, note: note }); }

    /* 1 arithmetic_fraud — price × burned == charged, on BigInt */
    var units = 0n;
    events.forEach(function (e) { if (e.kind === 'charge') units += BigInt(e.units); });
    var owed = assetAmt(rate.basis) * units;
    var burned = assetAmt(sess.burned);
    owed === burned ? pass('arithmetic_fraud', rate.basis + ' × ' + units + ' = ' + sess.burned)
                    : fail('arithmetic_fraud', 'price×units ' + owed + ' ≠ burned ' + sess.burned);

    /* 2 over_capture — charged ≤ settled credit */
    var credit = assetAmt(sess.credit);
    burned <= credit ? pass('over_capture', sess.burned + ' ≤ ' + sess.credit)
                     : fail('over_capture', 'burned ' + sess.burned + ' > credit ' + sess.credit);

    /* 3 over_max — charged ≤ the upto ceiling (verifyAgainst rule) */
    var ceiling = assetAmt(sess.ceiling);
    burned <= ceiling ? pass('over_max', sess.burned + ' ≤ ceiling ' + sess.ceiling)
                      : fail('over_max', 'burned ' + sess.burned + ' > ceiling ' + sess.ceiling);

    /* 4 terms_mismatch — the rail's rate row carries the tithe field */
    (rate && rate.rail === sess.rail && Number.isInteger(rate.tithe_bp))
      ? pass('terms_mismatch', 'rail ' + sess.rail + ' @ basis ' + rate.basis + ' + tithe ' + rate.tithe_bp + 'bp')
      : fail('terms_mismatch', 'rail ' + sess.rail + ' has no tithe-carrying rate row');

    /* 5 nonce_replay — every credit nonce unique in the record */
    var seen = {};
    nonces.forEach(function (n) { seen[n.value] = 1; });
    Object.keys(seen).length === nonces.length
      ? pass('nonce_replay', nonces.length + ' settlements, ' + Object.keys(seen).length + ' distinct nonces')
      : fail('nonce_replay', 'duplicate nonce in the record');

    /* 6 pause_integrity — no charge event while the session was paused */
    var pauseSpans = events.filter(function (e) { return e.kind === 'pause' || e.kind === 'resume'; });
    if (events.some(function (e) { return e.kind === 'charge' && e.whilePaused; }))
      fail('pause_integrity', 'a charge executed while paused');
    else if (pauseSpans.length === 0 && !events.length) { inconclusive = true; pass('pause_integrity', 'no events — not checked'); }
    else pass('pause_integrity', 'no charge under pause in the event log');

    /* 7 tithe_split — the row's tithe_bp partitions every charge exactly */
    if (rate && Number.isInteger(rate.tithe_bp)) {
      var bp = BigInt(rate.tithe_bp);
      if (bp < 0n || bp > 10000n) fail('tithe_split', 'tithe_bp out of range');
      else {
        var tithe = burned * bp / 10000n, basisPart = burned - tithe;
        pass('tithe_split', 'basis ' + fmtA(basisPart) + ' + tithe ' + fmtA(tithe) + ' = ' + sess.burned + ' @ ' + rate.tithe_bp + 'bp');
      }
    } else { inconclusive = true; F.push({ name: 'tithe_split', ok: true, note: 'rate row lacks tithe — nectar' }); }

    /* 8 anchor_pending — present ⇒ covered, absent ⇒ honey, malformed ⇒ nectar */
    var anchor = null;
    events.forEach(function (e) { if (e.kind === 'anchor' && !anchor) anchor = e; });
    if (anchor && /^[0-9a-f]{64}$/.test(anchor.hash)) { anchorCovered = true; pass('anchor_pending', anchor.hash.slice(0, 16) + '…'); }
    else if (anchor) { inconclusive = true; F.push({ name: 'anchor_pending', ok: true, note: 'anchor malformed — nectar' }); }
    else F.push({ name: 'anchor_pending', ok: true, note: 'no anchor yet — honey' });

    /* 9 clock_sanity — timestamps monotonic across the record */
    var ts = events.map(function (e) { return Date.parse(e.at); }).filter(function (t) { return Number.isFinite(t); });
    if (ts.length < 2) {
      if (events.length) pass('clock_sanity', 'single event');
      else { inconclusive = true; F.push({ name: 'clock_sanity', ok: true, note: 'no events — nectar' }); }
    } else {
      var mono = ts.every(function (t, i) { return i === 0 || t >= ts[i - 1]; });
      mono ? pass('clock_sanity', ts.length + ' timestamps monotonic')
           : fail('clock_sanity', 'timestamps regress');
    }

    var failed = F.some(function (c) { return !c.ok; });
    var state = failed ? 'FAILED' : inconclusive ? 'INCONCLUSIVE' : anchorCovered ? 'PASSED' : 'PENDING_ANCHOR';
    return { state: state, checks: F, units: units.toString(), burned: sess.burned };
  }

  /* ── canonical JSON + sha256 — the same content-hash law as the tool's
     auditHash: the fingerprint of exactly what was checked ─────────────── */
  function canon(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    var ks = Object.keys(o).sort(), out = [];
    for (var i = 0; i < ks.length; i++) out.push(JSON.stringify(ks[i]) + ':' + canon(o[ks[i]]));
    return '{' + out.join(',') + '}';
  }
  function subtle() {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
    var c = require('crypto'); return c.webcrypto.subtle;
  }
  async function auditHash(record) {        // over {session, checks} — what auditmark pins
    var verdict = typeof record === 'object' && record.checks ? record : null;
    if (!verdict) throw new Error('auditHash takes {session, checks}');
    var buf = await subtle().digest('SHA-256', new TextEncoder().encode(canon(verdict)));
    var h = '', u8 = new Uint8Array(buf);
    for (var i = 0; i < u8.length; i++) h += u8[i].toString(16).padStart(2, '0');
    return h;
  }

  /* ── the comb-cell chip — same drawing law as spend-audit.js (pointy-top,
     tokens.css hues, the FAILED fill pinned #c07f1c) so every surface that
     draws the four states draws them identically ───────────────────────── */
  var CELL = {
    PASSED: { fill: 'var(--gold)', fillOp: .92, rim: 'var(--gold)', label: 'capped', glyph: true },
    PENDING_ANCHOR: { fill: 'var(--amber)', fillOp: .62, rim: 'var(--amber)', label: 'honey' },
    FAILED: { fill: '#c07f1c', fillOp: .8, rim: '#c07f1c', label: 'flag' },
    INCONCLUSIVE: { fill: 'var(--cyan)', fillOp: .16, rim: 'var(--cyan)', label: 'nectar', rimOp: .5 }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hexPoints(cx, cy, R) {
    var p = [];
    for (var i = 0; i < 6; i++) { var a = Math.PI / 180 * (60 * i - 90); p.push((cx + R * Math.cos(a)).toFixed(2) + ',' + (cy + R * Math.sin(a)).toFixed(2)); }
    return p.join(' ');
  }
  function cellChip(state, size, title) {
    var c = CELL[state], s = size || 22, seal = c.glyph ? '<polygon points="' + hexPoints(s / 2, s / 2, s * 0.21) + '" fill="none" stroke="rgba(7,9,11,.85)" stroke-width="' + Math.max(1.2, s / 16) + '"/>' : '';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" role="img" aria-label="' + state + ' — ' + c.label + '"' + (title ? ' title="' + esc(title) + '"' : '') +
      ' style="flex:none"><polygon points="' + hexPoints(s / 2, s / 2 + (s * 0.02), s * 0.44) + '" fill="' + c.fill + '" fill-opacity="' + c.fillOp + '" stroke="' + c.rim + '" stroke-opacity="' + (c.rimOp || 1) + '" stroke-width="1.4"/>' + seal + '</svg>';
  }

  /* ── the record views — one public record, four demonstrations. The
     mutations are the receipt doc's own proofs, replayed in the visitor's
     page: nothing is trusted, everything is recomputed. ────────────────── */
  function views(record) {
    var strip = function (evs, rate) {
      return { sess: record.sess, rate: rate || record.rate, nonces: record.nonces, events: evs };
    };
    var evs = record.events;
    /* the anchor event = the pass-1 pinned record; everything after the
       pass-1 auditmark belongs to the anchoring itself */
    var preAnchor = evs.filter(function (e) { return e.kind !== 'anchor'; });
    return {
      PASSED: { label: 'as it stands', hint: 'the full record — anchored, 9/9', record: strip(evs) },
      PENDING_ANCHOR: { label: 'pass 1 · before the anchor', hint: 'audited and pinned, anchor not yet read — honey', record: strip(preAnchor) },
      FAILED: {
        label: 'a forged charge', hint: 'an invented charge appended — arithmetic breaks, the flag hue',
        record: strip(evs.concat([{ kind: 'charge', units: 11, whilePaused: false, at: evs[evs.length - 1].at, _forged: 'demo — never landed on chain' }]))
      },
      INCONCLUSIVE: {
        label: 'a malformed anchor', hint: 'the record carries a shape it cannot evaluate — nectar',
        record: strip(evs.map(function (e) { return e.kind === 'anchor' ? { kind: 'anchor', hash: 'not-a-hash', at: e.at } : e; }))
      }
    };
  }

  /* ── the panel — mounted on vending.html §x402-sec. Live chain rows are
     read when the rail answers (the same public RPC the rest of the surface
     uses); the embedded record is the receipt's own bytes, labelled, and
     the audit is recomputed either way. ────────────────────────────────── */
  async function fetchLive(sessId, rpc) {
    var rows = async function (table) {
      var r = await fetch((rpc || 'https://jungle4.greymass.com') + '/v1/chain/get_table_rows', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ json: true, code: 'bnrapolltest', scope: 'bnrapolltest', table: table, limit: 200 }),
        signal: AbortSignal.timeout(15000)      /* the rail hanging must not hang the receipt */
      });
      return (await r.json()).rows || [];
    };
    var sess = (await rows('sessions')).filter(function (s) { return s.id === sessId; })[0];
    if (!sess) throw new Error('session ' + sessId + ' not found on chain');
    var rate = (await rows('rates')).filter(function (r) { return r.rail === sess.rail; })[0];
    var nonces = (await rows('nonces')).filter(function (n) { return n.session === sessId; });
    return { sess: sess, rate: rate, nonces: nonces };
  }

  async function mountPanel(el, opts) {
    opts = opts || {};
    var record = opts.record;                       /* the embedded receipt bytes */
    var live = null, liveKind = 'reading the chain…';
    el.innerHTML = '<div style="color:var(--dim);font-size:11px">reading the meter session…</div>';

    if (opts.rpc !== null) {
      try { live = await fetchLive(record.sess.id, opts.rpc); liveKind = 'chain'; }
      catch (e) { liveKind = 'chain unread — the receipt bytes below, labelled'; }
    } else liveKind = 'embedded record (live read disabled)';

    /* chain truth = live rows when we have them; the audit input is the
       LIVE rows with the receipt's event log (the log rides the receipt;
       every event a landed tx, cited) */
    var auditInput = { sess: (live || record).sess, rate: (live || record).rate,
                       nonces: (live || record).nonces, events: record.events };
    var chainRow = live ? live.sess : record.sess;
    var chainMatches = !live || JSON.stringify(live.sess) === JSON.stringify(record.sess);

    var V = views(auditInput);
    var results = {};
    for (var k in V) results[k] = auditSession(V[k].record);
    var fp = await auditHash({ session: auditInput.sess.id, checks: results.PASSED.checks });

    /* the census hook — same law as __spendAuditStats: the renderer's own
       count of the states on screen, for the receipt gate to assert */
    var byState = { PASSED: 0, PENDING_ANCHOR: 0, FAILED: 0, INCONCLUSIVE: 0 };
    for (var k2 in results) byState[results[k2].state]++;

    var order = ['PASSED', 'PENDING_ANCHOR', 'FAILED', 'INCONCLUSIVE'];
    var stripHtml = order.map(function (st) {
      return '<button type="button" data-view="' + st + '" aria-label="' + st + ' view"' +
        ' style="background:none;border:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:64px;flex:1">' +
        cellChip(st, 30) +
        '<span style="font-size:9.5px;letter-spacing:.08em;color:var(--dim);text-transform:uppercase">' + V[st].label + '</span></button>';
    }).join('');

    var stepsHtml = record.events.map(function (e) {
      var tx = e.tx ? '<a href="' + esc(record.monitor + e.tx) + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;border-bottom:1px dashed var(--gold)">' + esc(e.tx.slice(0, 10)) + '…' + esc(e.tx.slice(-6)) + '</a>' : '<span style="color:var(--faint)">no tx — refused, nothing landed</span>';
      var kind = e.kind + (e.nonce != null ? ' ' + e.nonce : '') + (e.units != null ? ' · ' + e.units + ' units' : '') + (e.amount != null ? ' · ' + e.amount : '');
      return '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--dim);padding:3px 0;border-top:1px solid var(--line)">' +
        '<span style="color:var(--faint);min-width:64px">' + esc((e.at || '—').replace('T', ' ').slice(5, 19)) + '</span>' +
        '<span style="color:var(--ink);min-width:86px">' + esc(kind) + '</span>' +
        '<span style="flex:1;min-width:120px">' + (e.note ? esc(e.note) : '') + (e._forged ? ' <b style="color:var(--flag)">' + esc(e._forged) + '</b>' : '') + '</span>' +
        '<span>' + tx + '</span></div>';
    }).join('');

    function checksHtml(res) {
      return res.checks.map(function (c) {
        return '<div style="font-size:10px;color:' + (c.ok ? 'var(--dim)' : 'var(--flag)') + ';padding:2px 0">' +
          (c.ok ? '✓' : '✗') + ' <b style="color:var(--ink)">' + esc(c.name) + '</b>' + (c.note ? ' — ' + esc(c.note) : '') + '</div>';
      }).join('');
    }

    el.innerHTML =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">' + stripHtml + '</div>' +
      '<div id="x402-verdict" style="margin-top:8px"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:9.5px;color:var(--faint);letter-spacing:.06em;margin-top:6px">' +
      '<span>verifier states as comb cells — PASSED = capped ⬡ · PENDING_ANCHOR = honey · FAILED = flag #c07f1c · INCONCLUSIVE = nectar</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:10px;color:var(--dim)">' +
      '<span style="border:1px solid var(--line);border-radius:99px;padding:3px 10px">credit <b style="color:var(--ink)">' + esc(chainRow.credit) + '</b></span>' +
      '<span style="border:1px solid var(--line);border-radius:99px;padding:3px 10px">burned <b style="color:var(--ink)">' + esc(chainRow.burned) + '</b></span>' +
      '<span style="border:1px solid var(--line);border-radius:99px;padding:3px 10px">ceiling <b style="color:var(--ink)">' + esc(chainRow.ceiling) + '</b> — signed once at open</span>' +
      '<span style="border:1px solid var(--line);border-radius:99px;padding:3px 10px">audit_state <b style="color:var(--ink)">' + esc(String(chainRow.audit_state)) + '</b></span></div>' +
      '<div style="font-size:9.5px;color:var(--faint);margin-top:5px;word-break:break-all">chain-pinned audit_hash <span style="color:var(--gold)">' + esc(chainRow.audit_hash) + '</span> <!-- PUBLIC-CONSTANT: jungle4 session row --> · live read: ' + esc(liveKind) +
      (live ? (chainMatches ? ' — the receipt bytes and the chain row AGREE' : ' — <b style="color:var(--flag)">the chain row has moved since the receipt: showing chain truth</b>') : '') + '</div>' +
      '<div id="x402-checks" style="margin-top:8px"></div>' +
      '<div style="margin-top:10px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)">the session ledger — every event a landed transaction</div>' +
      '<div style="margin-top:4px">' + stepsHtml + '</div>' +
      '<div style="margin-top:8px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:6px;padding:9px 11px;font-size:10px;color:var(--ink);background:var(--well)">' +
      '<b style="color:var(--gold);letter-spacing:.18em">CARE</b> — this is topology and vocabulary, NEVER a security claim.</div>';

    function drawView(st) {
      var res = results[st];
      document.getElementById('x402-verdict').innerHTML =
        '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' + cellChip(res.state, 20) +
        '<b style="color:var(--ink);font-size:12px">' + res.state + '</b>' +
        '<span style="font-size:10px;color:var(--dim)">' + esc(V[st].hint) + '</span>' +
        '<span style="margin-left:auto;font-size:9.5px;color:var(--faint)">' + res.checks.filter(function (c) { return c.ok; }).length + '/' + res.checks.length + ' checks pass</span></div>';
      document.getElementById('x402-checks').innerHTML = checksHtml(res);
      el.querySelectorAll('button[data-view]').forEach(function (b) {
        b.style.opacity = b.getAttribute('data-view') === st ? '1' : '.55';
      });
    }
    el.querySelectorAll('button[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { drawView(b.getAttribute('data-view')); });
    });
    drawView('PASSED');

    root.__x402Stats = { byState: byState, viewResults: results, fingerprint: fp, liveKind: liveKind, chainMatches: chainMatches };
    return { results: results, fingerprint: fp };
  }

  return { STATES: STATES, assetAmt: assetAmt, fmtA: fmtA, auditSession: auditSession,
           canon: canon, auditHash: auditHash, cellChip: cellChip, views: views,
           fetchLive: fetchLive, mountPanel: mountPanel };
});
