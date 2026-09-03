/* spend-audit.js — THE SPEND-RECEIPT AUDITOR (z3.2 surfaces rider, 2026-09-03).
   One engine behind two surfaces: the receipts panel on wallet.html and the
   verifier lane on comb.html. It reads the estate's PUBLIC spend-receipt
   ledger (SPEC-SPEND-RECEIPT-1; meter.py shape) and RECOMPUTES every bill —
   price × burned = owed — with no keys, no server, no trust in the stored
   numbers. The rules it enforces, lifted from the x402 raid's RULE rows
   (docs/raids/X402-SORT-2026-09-01.md §RULES → estate seats, z3.2):

   · owed is COMPUTED from line items (quantity × rate, summed) — never read
     from a stored total (pinout paymentContext / the spec's own §1 law)
   · exact decimal arithmetic on BigInt, scale 1e12 — no float ever touches a
     resource quantity or an amount (spec §7)
   · every line's rate_set_ref must resolve; an unresolvable rate is
     INCONCLUSIVE, not a guess
   · the tithe is a distinct line audited like any other (founder law: never
     buried in the rate)
   · receipt_id = sha256 over the canonical JSON (the estate's content-hash
     law) — recomputed here, keylessly
   · the chain is forward-only: occurred_at may not run backwards against
     prior_receipt_id (bTiMeLiNe law)
   · anchoring: covered by an anchor → settled; past the anchor head with the
     chain intact → PENDING_ANCHOR; no anchor record at all → INCONCLUSIVE

   THE FOUR VERIFIER STATES, drawn as comb cells (CANON-COMB vocabulary):
     PASSED          = capped   — sealed gold with the ⬡ glyph
     PENDING_ANCHOR  = honey    — amber, ripening
     FAILED          = flag     — the validated --flag/--cat-bug hue #c07f1c,
                                 NEVER a new red (founder hue-correction)
     INCONCLUSIVE    = nectar   — translucent; the record does not carry the
                                 verdict yet

   CARE (verbatim, wherever these states are drawn):
   this is topology and vocabulary, NEVER a security claim.

   UMD-shaped: browser attaches window.SpendAudit; node (the fixture
   generator) gets module.exports — the audit core is pure. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SpendAudit = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* ── exact decimals: BigInt, scale 1e12. Amounts parse from string or int;
     rates likewise. No float accumulation anywhere. ─────────────────────── */
  var SCALE = 1000000000000n;                       // 1e12
  function toS(v) {                                 // → scaled BigInt
    if (typeof v === 'bigint') return v * SCALE;
    var s = String(v == null ? 0 : v).trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;    // NaN-ish → caller flags
    var neg = s[0] === '-', t = neg ? s.slice(1) : s;
    var i = t.indexOf('.'), whole = i < 0 ? t : t.slice(0, i), frac = i < 0 ? '' : t.slice(i + 1);
    frac = (frac + '000000000000').slice(0, 12);    // pad/truncate at scale
    var n = BigInt(whole || '0') * SCALE + BigInt(frac || '0');
    return neg ? -n : n;
  }
  function fromS(n) {                               // scaled BigInt → plain string
    var neg = n < 0n; if (neg) n = -n;
    var w = n / SCALE, f = (n % SCALE).toString().padStart(12, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + w.toString() + (f ? '.' + f : '');
  }
  function fmtA(n) { return fromS(n) + ' A'; }

  /* ── canonical JSON — sorted keys, no whitespace (the estate's content-hash
     law: self-describing canonical-JSON + sha256) ───────────────────────── */
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
  async function sha256Hex(str) {
    var buf = await subtle().digest('SHA-256', new TextEncoder().encode(str));
    var h = '', u8 = new Uint8Array(buf);
    for (var i = 0; i < u8.length; i++) h += u8[i].toString(16).padStart(2, '0');
    return h;
  }
  async function receiptId(receipt) {               // id over the receipt WITH the id + scan-law markers removed
    var c = JSON.parse(JSON.stringify(receipt));
    var strip = function (o) { if (o && typeof o === 'object') { delete o._hexlaw; Object.keys(o).forEach(function (k) { strip(o[k]); }); } };
    strip(c);
    delete c.receipt_id;
    return 'sha256:' + await sha256Hex(canon(c));
  }

  /* closed enums (spec §2 — a caller-supplied classification is not one) */
  var RAILS = { vaulta: 1, autonomi: 1, arweave: 1, arbitrum: 1, hive: 1, zano: 1, exsat: 1, mesh: 1, other: 1 };
  var CLASSES = { mesh_second: 1, vram_byte_second: 1, ram_byte: 1, cpu_microsecond: 1,
                  net_byte: 1, chunk_count: 1, storage_byte: 1, chain_fee: 1,
                  prefill_token: 1, decode_token: 1 };
  var STATES = ['PASSED', 'PENDING_ANCHOR', 'FAILED', 'INCONCLUSIVE'];

  /* rate lookup: ledger.rate_sets[ref].tiers → the tier whose rates carry the
     line's resource_class. Returns {value} or null. */
  function resolveRate(rateSets, line) {
    var rs = rateSets && rateSets[line.rate && line.rate.rate_set_ref];
    if (!rs || !rs.tiers) return null;
    for (var t in rs.tiers) {
      var r = rs.tiers[t].rates && rs.tiers[t].rates[line.resource_class];
      if (r) return r;
    }
    return null;
  }

  /* ── auditReceipt — the pure four-state verdict for one receipt.
     ledger = {rate_sets, receipts, anchors}. Everything recomputed; nothing
     displayed is read from the receipt's own totals. ───────────────────── */
  async function auditReceipt(r, ledger) {
    var checks = [], failed = false, inconclusive = false;
    var F = function (name, ok, note) { checks.push({ name: name, ok: ok, note: note || '' }); if (!ok) failed = true; };

    /* schema: closed enums */
    F('closed_enums', !!(r.line_items && r.line_items.every(function (l) { return RAILS[l.rail] && CLASSES[l.resource_class]; })),
      'rail and resource_class are closed enums — unknown values are rejected, never coerced');

    /* arithmetic: per line owed = quantity × rate; Σ = the bill */
    var owed = 0n, lines = [], rateMissing = false, basis = 0n;
    for (var i = 0; i < r.line_items.length; i++) {
      var l = r.line_items[i];
      var rate = resolveRate(ledger.rate_sets, l);
      if (!rate && !(l.quantity_unit === 'tithe' && l.tithe)) { rateMissing = true; lines.push({ i: i, cls: l.resource_class, qty: l.quantity, note: 'rate set ' + (l.rate && l.rate.rate_set_ref) + ' not in the public record' }); continue; }
      if (l.quantity_unit === 'tithe') {
        /* the tithe line: charged must equal basis × percent — founder law,
           audited. if the basis lines were unpriceable, the tithe cannot be
           checked either — it is INCONCLUSIVE with the rest of the bill */
        if (rateMissing) { lines.push({ i: i, cls: 'tithe', qty: l.quantity, note: 'basis unpriceable — the tithe cannot be checked either' }); continue; }
        var want = basis * toS(String(l.tithe.percent)) / toS('100');
        var got = toS(l.charged.value);
        F('tithe_line', got === want, 'the tithe is a distinct line: charged ' + fromS(got == null ? 0n : got) + ' vs basis ' + fromS(basis) + ' × ' + l.tithe.percent + '%');
        owed += got; lines.push({ i: i, cls: 'tithe', qty: l.quantity, rate: l.tithe.percent + '% of basis', calc: fromS(want), charged: l.charged.value, ok: got === want });
        if (got !== want) continue;
      } else {
        var rv = toS(rate.value), q = BigInt(Math.trunc(l.quantity));
        var calc = rv * q, got2 = toS(l.charged.value);
        var ok = got2 !== null && calc === got2;
        F('line_' + i + '_arithmetic', ok, l.quantity + ' × ' + fromS(rv) + ' = ' + fromS(calc) + ' — charged ' + (got2 == null ? '?' : fromS(got2)));
        owed += got2 == null ? 0n : got2; basis += got2 == null ? 0n : got2;
        lines.push({ i: i, cls: l.resource_class, qty: l.quantity, rate: fromS(rv) + ' A/' + l.quantity_unit, calc: fromS(calc), charged: l.charged.value, ok: ok });
      }
    }
    if (rateMissing) inconclusive = true;

    /* the stored total (if any) may not disagree with the recomputed bill —
       but an unresolvable rate set means the bill CANNOT be recomputed; that
       is INCONCLUSIVE, not a failed sum */
    if (!rateMissing && r.total_computed && r.total_computed.value != null) {
      var claimed = toS(r.total_computed.value);
      F('total_matches_sum', claimed === owed, 'claimed ' + fromS(claimed == null ? 0n : claimed) + ' vs recomputed ' + fromS(owed) + ' — the total is COMPUTED, never stored');
    }

    /* content hash: receipt_id = sha256(canonical receipt sans id) */
    var rid = await receiptId(r);
    F('content_hash', rid === r.receipt_id, r.receipt_id + (rid === r.receipt_id ? ' ✓' : ' ≠ recomputed ' + rid));

    /* forward-only chain: a receipt citing a prior may not occur before it */
    if (r.provenance && r.provenance.prior_receipt_id) {
      var prior = (ledger.receipts || []).find(function (x) { return x.receipt_id === r.provenance.prior_receipt_id; });
      if (prior) F('forward_only', r.occurred_at >= prior.occurred_at,
        'occurred_at ' + r.occurred_at + ' vs prior ' + prior.occurred_at + ' — bTiMeLiNe runs one way');
      else F('forward_only', false, 'prior_receipt_id not in the record');
    }

    /* anchoring */
    var covered = false, anchorsExist = (ledger.anchors || []).length > 0;
    for (var a = 0; a < (ledger.anchors || []).length; a++)
      if ((ledger.anchors[a].covers || []).indexOf(r.receipt_id) >= 0) covered = true;
    if (!anchorsExist) inconclusive = true;

    var state = failed ? 'FAILED' : inconclusive ? 'INCONCLUSIVE' : covered ? 'PASSED' : 'PENDING_ANCHOR';
    return { state: state, checks: checks, owed: owed, owedA: fmtA(owed), lines: lines, covered: covered };
  }

  /* ── auditLedger — every receipt + per-seller scores from THIS record only
     (reputation = clean settlements replayed from the public topic) ────── */
  async function auditLedger(ledger) {
    var out = [];
    for (var i = 0; i < ledger.receipts.length; i++)
      out.push(await auditReceipt(ledger.receipts[i], ledger));
    var sellers = {};
    ledger.receipts.forEach(function (r, j) {
      var s = (r.seller && r.seller.name) || 'unnamed seller';
      sellers[s] = sellers[s] || { passed: 0, failed: 0, pending: 0, inconclusive: 0 };
      sellers[s][{ PASSED: 'passed', PENDING_ANCHOR: 'pending', FAILED: 'failed', INCONCLUSIVE: 'inconclusive' }[out[j].state]]++;
    });
    return { receipts: out, sellers: sellers };
  }

  /* ── liveness from timestamps ONLY (xorv deriveStatus rule: never a
     self-declared flag) — evaluated against the record's as_of ─────────── */
  function deriveStatus(beats, asOf) {
    if (!beats || !beats.length) return 'offline';
    var last = beats[beats.length - 1], t = Date.parse(asOf) - Date.parse(last);
    if (!(t >= 0)) return 'offline';
    var s = t / 1000;
    return s <= 90 ? 'online' : s <= 900 ? 'busy' : 'offline';
  }

  /* ── the comb-cell chip — one receipt, one cell, state-coloured.
     Pointy-top like the estate's hexes. All hues from tokens.css. ───────── */
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

  /* ── the panel — one renderer, two surfaces. Aggregate first (one total,
     recomputed), itemized beneath (spec §1 UX law). ────────────────────── */
  async function fetchLedger(path) {
    var r = await fetch(path || 'spend-ledger.json');
    if (!r.ok) throw new Error('the ledger copy is unreadable (HTTP ' + r.status + ')');
    return r.json();
  }

  function lineRowsHtml(rec) {
    var h = '';
    rec.audit.lines.forEach(function (l) {
      h += '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--dim);padding:3px 0;border-top:1px solid var(--line)">' +
        '<span style="color:var(--ink);min-width:120px">' + esc(l.cls) + '</span>' +
        (l.note ? '<span style="color:var(--flag)">' + esc(l.note) + '</span>' :
          '<span>' + esc(l.qty) + ' × ' + esc(l.rate) + ' = <b style="color:var(--ink)">' + esc(l.calc) + '</b> A</span>' +
          '<span style="margin-left:auto">charged ' + esc(l.charged) + ' A ' + (l.ok === false ? '<b style="color:var(--flag)">✗ mismatch</b>' : '✓') + '</span>') +
        '</div>';
    });
    return h;
  }
  function checksHtml(rec) {
    return rec.audit.checks.map(function (c) {
      return '<div style="font-size:10px;color:' + (c.ok ? 'var(--dim)' : 'var(--flag)') + ';padding:2px 0">' +
        (c.ok ? '✓' : '✗') + ' <b style="color:var(--ink)">' + esc(c.name) + '</b>' + (c.note ? ' — ' + esc(c.note) : '') + '</div>';
    }).join('');
  }

  async function mountPanel(el, opts) {
    opts = opts || {};
    var ledger, result;
    el.innerHTML = '<div style="color:var(--dim);font-size:11px">reading the public ledger…</div>';
    try { ledger = await fetchLedger(opts.ledgerPath); }
    catch (e) { el.innerHTML = '<div style="color:var(--amber);font-size:11px">' + esc(e.message) + ' — the panel rests rather than guess</div>'; return; }
    result = await auditLedger(ledger);

    var tot = 0n, byState = { PASSED: 0, PENDING_ANCHOR: 0, FAILED: 0, INCONCLUSIVE: 0 };
    result.receipts.forEach(function (a) { byState[a.state]++; if (a.state !== 'FAILED') tot += a.owed; });

    /* the comb strip — every receipt one cell; clicking opens its audit */
    var cells = ledger.receipts.map(function (r, j) {
      var a = result.receipts[j];
      return '<button type="button" data-rc="' + j + '" aria-label="receipt ' + (j + 1) + ': ' + a.state + '"' +
        ' style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:30px;min-height:30px">' +
        cellChip(a.state, 26, r.operation && r.operation.kind) + '</button>';
    }).join('');

    var rows = ledger.receipts.map(function (r, j) {
      var a = result.receipts[j];
      return '<details style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-top:6px">' +
        '<summary style="cursor:pointer;display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:11px">' +
        cellChip(a.state, 18) + '<b style="color:var(--ink)">' + esc((r.operation && r.operation.kind) || 'spend') + '</b>' +
        '<span style="color:var(--dim)">' + esc((r.seller && r.seller.name) || '') + '</span>' +
        '<span style="color:var(--faint);font-size:10px">' + esc(r.occurred_at) + '</span>' +
        '<span style="margin-left:auto;color:var(--gold)">' + a.owedA + '</span>' +
        '<span style="font-size:9px;letter-spacing:.12em;color:var(--dim);border:1px solid var(--line);border-radius:99px;padding:2px 8px">' + a.state + '</span>' +
        '</summary>' +
        '<div style="margin-top:7px">' + lineRowsHtml({ audit: a }) + checksHtml({ audit: a }) +
        '<div style="font-size:10px;color:var(--ink);margin-top:5px">recomputed bill: <b style="color:var(--gold)">' + a.owedA + '</b> · state <b>' + a.state + '</b> · anchored: ' + (a.covered ? 'yes' : a.state === 'PENDING_ANCHOR' ? 'not yet — honey' : 'n/a') + '</div>' +
        '</div></details>';
    }).join('');

    /* liveness + seller score — timestamps and this record only */
    var asOf = ledger.as_of || new Date().toISOString();
    var svcs = (ledger.services || []).map(function (s) {
      var st = deriveStatus(s.heartbeats, asOf);
      var col = st === 'online' ? 'var(--leaf)' : st === 'busy' ? 'var(--amber)' : 'var(--faint)';
      return '<span style="font-size:10px;color:var(--dim);border:1px solid var(--line);border-radius:99px;padding:3px 10px">' +
        esc(s.name) + ' · <b style="color:' + col + '">' + st + '</b> <span style="color:var(--faint)">· last beat ' + esc((s.heartbeats && s.heartbeats.length && s.heartbeats[s.heartbeats.length - 1]) || '—') + '</span></span>';
    }).join(' ');
    var score = Object.keys(result.sellers).map(function (s) {
      var v = result.sellers[s], audited = v.passed + v.failed;
      return '<span style="font-size:10px;color:var(--dim)">' + esc(s) + ': <b style="color:' + (v.failed ? 'var(--flag)' : 'var(--leaf)') + '">' + v.passed + '/' + (audited || 0) + ' clean</b>' +
        ' <span style="color:var(--faint)">(' + v.passed + ' passed · ' + v.failed + ' failed · ' + v.pending + ' pending · ' + v.inconclusive + ' inconclusive — from this record only)</span></span>';
    }).join(' · ');

    el.innerHTML =
      '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">' +
      '<span style="font-size:26px;font-weight:600;color:var(--gold);font-variant-numeric:tabular-nums">' + fromS(tot) + ' A</span>' +
      '<span style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)">recomputed total — Σ quantity × rate, never the stored number</span></div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:10px 0 2px">' + cells + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:9.5px;color:var(--dim);letter-spacing:.06em">' +
      '<span>' + cellChip('PASSED', 13) + ' PASSED = capped</span><span>' + cellChip('PENDING_ANCHOR', 13) + ' PENDING_ANCHOR = honey</span>' +
      '<span>' + cellChip('FAILED', 13) + ' FAILED = flag #c07f1c</span><span>' + cellChip('INCONCLUSIVE', 13) + ' INCONCLUSIVE = nectar</span></div>' +
      (opts.showPaste !== false ?
        '<div style="margin-top:10px"><textarea id="sa-paste" rows="3" placeholder="paste any spend receipt (SPEC-SPEND-RECEIPT-1 JSON) — a stranger can audit any session, keylessly"' +
        ' style="width:100%;box-sizing:border-box;background:var(--well);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px;font:11px \'IBM Plex Mono\',monospace"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button type="button" id="sa-paste-go" style="background:var(--well);color:var(--gold);border:1px solid var(--line);border-radius:8px;padding:8px 14px;cursor:pointer;font:11px \'IBM Plex Mono\',monospace;min-height:34px">audit it</button>' +
        '<span id="sa-paste-out" style="font-size:10px;color:var(--dim)"></span></div></div>' : '') +
      '<div style="margin-top:10px">' + rows + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' + svcs + '</div>' +
      '<div style="margin-top:8px">' + score + '</div>' +
      '<div style="margin-top:10px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:6px;padding:9px 11px;font-size:10px;color:var(--ink);background:var(--well)">' +
      '<b style="color:var(--gold);letter-spacing:.18em">CARE</b> — this is topology and vocabulary, NEVER a security claim.</div>' +
      '<div style="margin-top:7px;font-size:9.5px;color:var(--faint);line-height:1.8">' + esc((ledger._note && ledger._note[0]) || '') + '</div>';

    var pasteOut = el.querySelector('#sa-paste-out');
    var go = el.querySelector('#sa-paste-go');
    if (go) go.addEventListener('click', async function () {
      var t = el.querySelector('#sa-paste').value.trim();
      if (!t) { pasteOut.textContent = 'paste a receipt first'; return; }
      try {
        var r = JSON.parse(t);
        var a = await auditReceipt(r, ledger);
        pasteOut.innerHTML = cellChip(a.state, 14) + ' <b style="color:var(--ink)">' + a.state + '</b> · recomputed ' + esc(a.owedA) +
          ' · ' + a.checks.filter(function (c) { return c.ok; }).length + '/' + a.checks.length + ' checks pass';
      } catch (e) { pasteOut.textContent = 'not a readable receipt: ' + e.message; }
    });
    el.querySelectorAll('button[data-rc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = el.querySelectorAll('details')[+b.getAttribute('data-rc')];
        if (d) { d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      });
    });

    /* the gate's census hook — same class as __combStats: the renderer's own
       count of what is on screen, for the receipt script to assert against */
    root.__spendAuditStats = { byState: byState, totalA: fromS(tot), ledger: ledger.ledger };
    return result;
  }

  return { toS: toS, fromS: fromS, canon: canon, sha256Hex: sha256Hex, receiptId: receiptId,
           auditReceipt: auditReceipt, auditLedger: auditLedger, deriveStatus: deriveStatus,
           cellChip: cellChip, mountPanel: mountPanel, fetchLedger: fetchLedger, STATES: STATES };
});
