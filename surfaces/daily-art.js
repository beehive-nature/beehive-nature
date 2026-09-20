/* daily-art.js - THE DAILY ART MANIFEST ENGINE (bUi Slice 01, queen order daec663b/1822fa54).
   Page-asset in the register.js/tour.js class (not a counted surface; surface-count.mjs
   counts .html only). Self-contained by law: zero external requests (P9), zero deps,
   classic script in the browser AND module.exports under node (the e2e static suite
   proves the engine from the same bytes the browser runs - one implementation, two
   hosts, never agreeing by convention).

   THE LAW THIS MODULE CARRIES (queen order 1822fa54):
   - manifest = f(protocol version, UTC day, state root, previous accepted manifest
     hash). Art parameters ONLY. It may never touch payment authority, wallet
     bindings, privacy boundaries, route truth, counts, provenance or permissions.
   - The clock enters as an EXPLICIT INPUT (bFUzZ build req 1): the only new Date()
     in this file is at the page boundary (todayUTC); the derive path is pure and
     day-injectable.
   - Replay is from RECORDED INPUT HASHES (bFUzZ build req 2): the chain folds from
     a FIXED GENESIS DAY with prev = a documented constant. History is recomputed,
     never fetched, never trusted from storage - a local cache is speed and never
     authority (cache-never-authority by construction: the chain IS the recompute).
   - Integer-seeded derivation only: the derive path uses integer PRNG arithmetic
     (Math.imul + >>>); floats appear only in the RENDER layer (SVG coordinates),
     never in manifest bytes.
   - Determinism: canonical serialization (sorted keys, no whitespace) and the hash
     over those exact bytes; the manifest hash is its own receipt.

   PROVENANCE FIELD SHAPE mirrors surfaces/atlas-art/provenance.json (PUBLIC-CONSTANT
   sha256 fields): every manifest carries date, input hashes (state root, previous
   manifest hash), generator version, protocol version, and its own hash. */
(function (root, factory) {
  var api = factory();
  if (typeof window !== 'undefined') {
    window.buiDailyArt = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { api.boot(); });
    else api.boot();
  } else if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- constants ------------------------------------------------------- */
  var PROTOCOL_VERSION = 1;
  var GENERATOR_VERSION = 1;
  /* The chain begins here. prev for the genesis day is 64 zeros - built, not
     typed, so no literal hex run lives in this source line. Days before the
     genesis day are not defined (the page did not exist). */
  var GENESIS_DAY = '2026-09-19';
  var GENESIS_PREV = new Array(65).join('0');

  /* Legal parameter ranges - the accept gate enforces these; a candidate with
     any param outside its range is broken and falls back. */
  var RANGES = {
    variant: [1, 6], palette: [0, 7], densityPct: [60, 100], swayMs: [3000, 9999],
    starN: [24, 63], ringEmph: [0, 2], drift: [0, 9], glow: [0, 9]
  };

  /* ---- sha256 (FIPS 180-4), synchronous, dependency-free -----------------
     Verified against node:crypto in e2e/bui-daily-art.test.mjs (known vectors +
     randomized buffers) so the browser and the suite run proven-identical code. */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var _w = new Int32Array(64), _buf = new Uint8Array(256), _dv = new DataView(_buf.buffer);
  var HEX = []; for (var _hb = 0; _hb < 256; _hb++) HEX.push((_hb >> 4).toString(16) + (_hb & 15).toString(16));
  /* sha256(str) -> hex digest of the UTF-8 bytes. Scratch buffers, no hot-path
     allocation (the chain folds thousands of these per load - P4 budget);
     single-threaded JS makes the module-level scratch safe. */
  function sha256(str) {
    var s = String(str), n = s.length, i, c, ascii = true;
    for (i = 0; i < n; i++) if (s.charCodeAt(i) > 0x7f) { ascii = false; break; }
    if (_buf.length < n + 72) { _buf = new Uint8Array(((n + 72 + 255) >> 8) << 8); _dv = new DataView(_buf.buffer); }
    if (ascii) { for (i = 0; i < n; i++) _buf[i] = s.charCodeAt(i); }
    else {
      var j = 0;
      for (i = 0; i < n; i++) {
        c = s.charCodeAt(i);
        if (c < 0x80) _buf[j++] = c;
        else if (c < 0x800) { _buf[j++] = 0xc0 | c >> 6; _buf[j++] = 0x80 | c & 63; }
        else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
          var c2 = s.charCodeAt(++i);
          c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
          _buf[j++] = 0xf0 | c >> 18; _buf[j++] = 0x80 | c >> 12 & 63; _buf[j++] = 0x80 | c >> 6 & 63; _buf[j++] = 0x80 | c & 63;
        } else { _buf[j++] = 0xe0 | c >> 12; _buf[j++] = 0x80 | c >> 6 & 63; _buf[j++] = 0x80 | c & 63; }
      }
      n = j;
    }
    var blocks = (n + 9 + 63) >> 6, total = blocks << 6;
    _buf[n] = 0x80;
    for (i = n + 1; i < total - 4; i++) _buf[i] = 0;
    _dv.setUint32(total - 4, (n * 8) >>> 0); /* hi length word zeroed by the gap loop (messages are tiny) */
    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a,
        H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var w = _w, x, y, s0, s1, a, b, c, d, e, f, g, h, t1, t2;
    for (var block = 0; block < total; block += 64) {
      for (i = 0; i < 16; i++) w[i] = _dv.getInt32(block + i * 4);
      for (i = 16; i < 64; i++) {
        x = w[i - 15]; y = w[i - 2];
        s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      a = H0; b = H1; c = H2; d = H3; e = H4; f = H5; g = H6; h = H7;
      for (i = 0; i < 64; i++) {
        t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)))
          + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)))
          + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H0 = (H0 + a) | 0; H1 = (H1 + b) | 0; H2 = (H2 + c) | 0; H3 = (H3 + d) | 0;
      H4 = (H4 + e) | 0; H5 = (H5 + f) | 0; H6 = (H6 + g) | 0; H7 = (H7 + h) | 0;
    }
    var words = [H0, H1, H2, H3, H4, H5, H6, H7], out = '';
    for (i = 0; i < 8; i++) out += HEX[(words[i] >>> 24) & 255] + HEX[(words[i] >>> 16) & 255] + HEX[(words[i] >>> 8) & 255] + HEX[words[i] & 255];
    return out;
  }

  /* ---- canonical serialization: sorted keys, no whitespace ---------------- */
  function canon(value) {
    if (value === null || typeof value === 'boolean') return String(value);
    if (typeof value === 'number') { if (!isFinite(value) || Math.floor(value) !== value) throw new Error('manifest values are integers only'); return String(value); }
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) { var a = [], i; for (i = 0; i < value.length; i++) a.push(canon(value[i])); return '[' + a.join(',') + ']'; }
    var keys = Object.keys(value).sort(), parts = [], j;
    for (j = 0; j < keys.length; j++) parts.push(JSON.stringify(keys[j]) + ':' + canon(value[keys[j]]));
    return '{' + parts.join(',') + '}';
  }

  /* ---- integer PRNG (derive path only; no floats until render) ------------ */
  function prng(seed) {
    var s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0);
    };
  }
  function seedFrom(inputStr) { return parseInt(sha256(inputStr).slice(0, 8), 16) >>> 0; }

  /* ---- UTC day helpers: pure integer civil-calendar math (no Date in the
     derive path; Hinnant algorithms - exact integer epoch-day conversions) --- */
  function civilToEpoch(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400), yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function epochToCivil(z) {
    z += 719468;
    var era = Math.floor(z / 146097), doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp + (mp < 10 ? 3 : -9);
    return [y + (m <= 2 ? 1 : 0), m, d];
  }
  function dayToEpoch(day) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day); if (!m) throw new Error('bad utc day: ' + day); return civilToEpoch(+m[1], +m[2], +m[3]); }
  function epochToDay(n) { var c = epochToCivil(n); return c[0] + '-' + String(c[1]).padStart(2, '0') + '-' + String(c[2]).padStart(2, '0'); }
  function nextDay(day) { return epochToDay(dayToEpoch(day) + 1); }
  function isHex64(s) { return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s); }

  /* ---- foldDay: the canonical-bytes fast fold --------------------------------
     Produces EXACTLY the bytes canon() would serialize for the manifest (key
     order is alphabetical by construction; the e2e suite proves byte-equality
     against the generic canon path across a date sweep). This is the chain's
     per-day hot path: no object churn, no generic serialization. */
  function foldDay(utcDay, stateRoot, prevHash) {
    /* Seed = pure integer mixing of the three inputs (prev hash word, UTC
       epoch day, state-root word). NOT a cryptographic claim - this seeds an
       art PRNG only; the chain's integrity rests entirely on sha256 over the
       canonical manifest bytes. Integer-only by law; deterministic everywhere. */
    var seed = (parseInt(prevHash.slice(0, 8), 16) ^ dayToEpoch(utcDay) ^ parseInt(stateRoot.slice(0, 8), 16)) >>> 0;
    var next = prng(seed);
    var dp = RANGES.densityPct[0] + next() % (RANGES.densityPct[1] - RANGES.densityPct[0] + 1);
    var dr = next() % (RANGES.drift[1] + 1);
    var gl = next() % (RANGES.glow[1] + 1);
    var pa = next() % (RANGES.palette[1] + 1);
    var re = next() % (RANGES.ringEmph[1] + 1);
    var sn = RANGES.starN[0] + next() % (RANGES.starN[1] - RANGES.starN[0] + 1);
    var sw = RANGES.swayMs[0] + next() % (RANGES.swayMs[1] - RANGES.swayMs[0] + 1);
    var va = RANGES.variant[0] + next() % (RANGES.variant[1] - RANGES.variant[0] + 1);
    var bytes = '{"generator_version":' + GENERATOR_VERSION + ',"params":{"densityPct":' + dp + ',"drift":' + dr + ',"glow":' + gl + ',"palette":' + pa + ',"ringEmph":' + re + ',"starN":' + sn + ',"swayMs":' + sw + ',"variant":' + va + '},"prev_manifest_hash":"' + prevHash + '","protocol_version":' + PROTOCOL_VERSION + ',"state_root":"' + stateRoot + '","utc_day":"' + utcDay + '"}';
    return {
      params: { densityPct: dp, drift: dr, glow: gl, palette: pa, ringEmph: re, starN: sn, swayMs: sw, variant: va },
      bytes: bytes, hash: sha256(bytes)
    };
  }

  /* ---- THE ENGINE: manifest = f(v, day, root, prev) ----------------------- */
  function deriveDay(utcDay, stateRoot, prevHash) {
    if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(utcDay)) throw new Error('bad utc day');
    if (!isHex64(stateRoot)) throw new Error('bad state root');
    if (!isHex64(prevHash)) throw new Error('bad prev hash');
    var f = foldDay(utcDay, stateRoot, prevHash);
    return {
      manifest: {
        generator_version: GENERATOR_VERSION, params: f.params, prev_manifest_hash: prevHash,
        protocol_version: PROTOCOL_VERSION, state_root: stateRoot, utc_day: utcDay
      },
      bytes: f.bytes, hash: f.hash
    };
  }

  /* ---- the chain: fold from the FIXED GENESIS, never from storage ----------
     P4 budget: one day = one sha256 over ~300 bytes + a 8-step PRNG; a
     1,826-day synthetic chain is proven <=150ms desktop / 600ms 4x-throttled
     in the e2e gate. The chain IS the history - nothing is fetched, so
     "cache is speed, never authority" holds by construction. */
  function chainTo(utcDay, stateRoot) {
    var day = GENESIS_DAY, prev = GENESIS_PREV, step = null, lastPrev = GENESIS_PREV, n = 0;
    if (dayToEpoch(utcDay) < dayToEpoch(GENESIS_DAY)) throw new Error('day before genesis is not defined: ' + utcDay);
    for (;;) {
      step = foldDay(day, stateRoot, prev);
      n++; lastPrev = prev;
      if (day === utcDay) break;
      prev = step.hash; day = epochToDay(dayToEpoch(day) + 1);
      if (n > 200000) throw new Error('chain runaway');
    }
    return {
      manifest: {
        generator_version: GENERATOR_VERSION, params: step.params, prev_manifest_hash: lastPrev,
        protocol_version: PROTOCOL_VERSION, state_root: stateRoot, utc_day: utcDay
      },
      bytes: step.bytes, hash: step.hash, chainLength: n, day: utcDay, stateRoot: stateRoot
    };
  }

  /* ---- the accept gate: validate a candidate manifest ----------------------
     Recomputes the candidate's own hash from its fields, enforces parameter
     ranges and input shapes. A broken candidate is RECORDED, never rendered. */
  function validate(candidate) {
    try {
      if (!candidate || typeof candidate !== 'object') return { ok: false, reason: 'not an object' };
      if (candidate.protocol_version !== PROTOCOL_VERSION) return { ok: false, reason: 'protocol_version' };
      if (candidate.generator_version !== GENERATOR_VERSION) return { ok: false, reason: 'generator_version' };
      if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(candidate.utc_day)) return { ok: false, reason: 'utc_day' };
      if (!isHex64(candidate.state_root)) return { ok: false, reason: 'state_root' };
      if (!isHex64(candidate.prev_manifest_hash)) return { ok: false, reason: 'prev_manifest_hash' };
      if (!candidate.params || typeof candidate.params !== 'object') return { ok: false, reason: 'params' };
      var keys = Object.keys(RANGES).sort(), i;
      var got = Object.keys(candidate.params).sort();
      if (got.join(',') !== keys.join(',')) return { ok: false, reason: 'params shape' };
      for (i = 0; i < keys.length; i++) {
        var v = candidate.params[keys[i]];
        if (typeof v !== 'number' || Math.floor(v) !== v) return { ok: false, reason: 'params.' + keys[i] + ' not integer' };
        if (v < RANGES[keys[i]][0] || v > RANGES[keys[i]][1]) return { ok: false, reason: 'params.' + keys[i] + ' out of range' };
      }
      var body = {
        generator_version: candidate.generator_version, params: candidate.params,
        prev_manifest_hash: candidate.prev_manifest_hash, protocol_version: candidate.protocol_version,
        state_root: candidate.state_root, utc_day: candidate.utc_day
      };
      if (sha256(canon(body)) !== candidate.manifest_hash) return { ok: false, reason: 'self-hash mismatch' };
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'exception: ' + e.message }; }
  }

  /* ---- pure API (node + browser + tests) ---------------------------------- */
  var api = {
    PROTOCOL_VERSION: PROTOCOL_VERSION, GENERATOR_VERSION: GENERATOR_VERSION,
    GENESIS_DAY: GENESIS_DAY, RANGES: RANGES,
    sha256: sha256, canon: canon, deriveDay: deriveDay, chainTo: chainTo,
    validate: validate, nextDay: nextDay,
    /* replay(inputs): byte-identical derivation from RECORDED inputs - the live
       DOM attribute is never consulted here (bFUzZ attribute-flip attack). */
    replay: function (inputs) { return deriveDay(inputs.utc_day, inputs.state_root, inputs.prev_manifest_hash); },
    todayUTC: function (dateObj) { var d = dateObj || new Date(); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  };

  /* ========================================================================
     RENDER LAYER - browser only. Decorative overlay in the masthead; the
     preserved hex band and every fact row are never touched. Motion honours
     bnr.motion.paused + prefers-reduced-motion; P6 auto-degrade stops the
     animation and logs when median frame time > 32ms over 2s.
     ===================================================================== */
  var state = { booted: false, manifest: null, bytes: '', hash: '', rejected: [], render: null, mode: 'bee', degraded: false, lastGood: null };

  function motionPaused() {
    try { if (localStorage.getItem('bnr.motion.paused') === '1') return true; } catch (e) { /* storage unavailable - keep going */ }
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var CSS = '.bui-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden;contain:layout style paint;z-index:1}' +
    '.bui-overlay svg{width:100%;height:100%;display:block}' +
    '.bui-ring{position:absolute;border-radius:50%;pointer-events:none;z-index:0}' +
    '@media (prefers-reduced-motion: reduce){.bui-anim{animation:none!important}}';

  function paletteOf(p) {
    /* Neutral decorative families - no semantic hue is introduced, repainted or
       carried alone (colour law 2026-08-26). Opacity/softness families only. */
    var families = [
      { o: 0.40, w: 1.0, s: 1 }, { o: 0.28, w: 1.6, s: 2 }, { o: 0.52, w: 0.7, s: 1 },
      { o: 0.34, w: 1.2, s: 3 }, { o: 0.24, w: 2.0, s: 1 }, { o: 0.44, w: 0.9, s: 2 },
      { o: 0.30, w: 1.4, s: 2 }, { o: 0.48, w: 0.8, s: 3 }
    ];
    return families[p % families.length];
  }

  /* FIXED-SKELETON render (PROVE structure/art separation attack, bFUzZ
     41ea55f1): the masthead node tree is structurally identical on every day,
     mode and width - the overlay always carries the SAME element skeleton
     (3 ellipses, 4 rects, 12 lines, 40 circles, in fixed order, plus the
     emphasis ring div). ALL daily variation is attribute-level (geometry,
     opacity, stroke-width, animation). Variant selects which subset is
     visible; density selects how many; nothing structural ever changes. */
  var N_ELL = 3, N_RECT = 4, N_LINE = 12, N_CIRC = 40;

  /* CRANK (founder order eae141a0 2026-09-20, scope = bGrokBot visual read):
     opacity floor raised (families 0.24-0.52, was 0.08-0.22); every shape
     family carries a faint baseline EVERY day - the day's variant BOOSTS its
     own family, never hides another; motes larger (2-6px, was 1-3px); tree
     ring always visible (opacity 0.15-0.39 + wider border by ringEmph).
     Attribute-level only: same skeleton, same counts, manifest bytes and the
     whole derive path UNTOUCHED (no generator_version bump - pre-merge free
     parameter change per the order). */
  var FAINT = 0.35;

  function render(manifest, mode) {
    var host = document.querySelector('header.mast');
    if (!host) return null;
    var old = host.querySelector('.bui-overlay'); if (old) old.remove();
    var oldRing = host.querySelector('.bui-ring'); if (oldRing) oldRing.remove();
    var params = manifest.params, pal = paletteOf(params.palette);
    var modeDensity = mode === 'cypherpunk' ? 0.6 : mode === 'raver' ? 1.3 : 1.0;
    var nVisible = Math.max(8, Math.round(params.starN * (params.densityPct / 100) * modeDensity));
    var next = prng(seedFrom(manifest.manifest_hash));
    var parts = ['<svg viewBox="0 0 390 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">'];
    var i, j, x, y, vis;
    /* 3 ellipses - bloom rings (v3) / soft halos otherwise */
    for (i = 0; i < N_ELL; i++) {
      var r = 30 + i * (18 + (next() % 20));
      vis = params.variant === 3 && i < Math.min(nVisible, 9) ? 1 : 0;
      parts.push('<ellipse class="bui-ell" cx="195" cy="240" rx="' + r + '" ry="' + r + '" fill="none" stroke="currentColor" stroke-width="' + (pal.w * 0.8).toFixed(2) + '" opacity="' + ((vis ? 1 : FAINT) * pal.o * (1 - i / 10)).toFixed(3) + '"/>');
    }
    /* 4 rects - aurora bands (v6) */
    for (i = 0; i < N_RECT; i++) {
      y = next() % 480; vis = params.variant === 6 && i < Math.min(Math.ceil(nVisible / 2), 8) ? 1 : 0;
      parts.push('<rect class="bui-rect" x="0" y="' + y + '" width="390" height="' + (6 + next() % 26) + '" fill="currentColor" opacity="' + ((vis ? 1 : FAINT) * pal.o * 0.35).toFixed(3) + '"/>');
    }
    /* 12 lines - constellation edges (v2) / weave lattice (v5) */
    var px = [], py = [];
    for (i = 0; i < N_CIRC; i++) { px.push(next() % 390); py.push(next() % 480); }
    for (i = 0; i < N_LINE; i++) {
      var x1 = 0, y1 = 0, x2 = 0, y2 = 0, lo = 0;
      if (params.variant === 5) { x1 = -12 + i * 34; y1 = 0; x2 = x1 + 200; y2 = 480; lo = pal.o * 0.4; }
      else {
        var a = (i * 3 + 1) % N_CIRC, bIdx = (i * 3 + 2) % N_CIRC;
        x1 = px[a]; y1 = py[a]; x2 = px[bIdx]; y2 = py[bIdx];
        lo = pal.o * 0.6 * (params.variant === 2 || mode === 'cypherpunk' ? 1 : FAINT);
      }
      parts.push('<line class="bui-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="currentColor" stroke-width="0.4" opacity="' + lo.toFixed(3) + '"/>');
    }
    /* 40 circles - motes (v1/v4) / stars (v2) / accents (v3/v5/v6) */
    var circleCap = params.variant === 1 || params.variant === 4 ? N_CIRC : Math.min(N_CIRC, Math.max(14, Math.ceil(nVisible * 0.5)));
    for (i = 0; i < N_CIRC; i++) {
      var rr = 2 + next() % 4 + (i < circleCap ? 1 : 0), o;
      if (i < circleCap) o = pal.o * (0.4 + (next() % 60) / 100);
      else o = pal.o * FAINT * (0.8 + (i % 5) / 10);
      parts.push('<circle class="bui-dot" cx="' + px[i] + '" cy="' + py[i] + '" r="' + rr + '" fill="currentColor" opacity="' + o.toFixed(3) + '"/>');
    }
    parts.push('</svg>');
    var overlay = document.createElement('div');
    overlay.className = 'bui-overlay bui-anim';
    overlay.setAttribute('data-bui-variant', String(params.variant));
    overlay.setAttribute('data-bui-mode', mode);
    overlay.innerHTML = parts.join('');
    /* decorative emphasis ring around the tree figure (art "emphasis", never a
       fact) - ALWAYS PRESENT structurally; ringEmph varies only its style */
    var ring = document.createElement('div');
    ring.className = 'bui-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.style.cssText = 'left:50%;top:38%;width:210px;height:210px;transform:translate(-50%,-50%);border:' + (1 + params.ringEmph * 0.5) + 'px solid currentColor;opacity:' + (0.15 + params.ringEmph * 0.12).toFixed(2) + ';z-index:0';
    host.appendChild(ring);
    host.appendChild(overlay);
    if (!motionPaused() && !state.degraded) {
      var dur = params.swayMs, dx = (params.drift % 5 - 2), key = 'buisway' + (params.drift % 3);
      overlay.style.animation = key + ' ' + dur + 'ms ease-in-out infinite alternate';
      var styleEl = document.getElementById('bui-motion-css');
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'bui-motion-css'; document.head.appendChild(styleEl); }
      styleEl.textContent = '@keyframes buisway0{from{transform:translateX(' + (-dx) + 'px)}to{transform:translateX(' + dx + 'px)}}' +
        '@keyframes buisway1{from{transform:translateY(' + (-dx) + 'px)}to{transform:translateY(' + dx + 'px)}}' +
        '@keyframes buisway2{from{transform:rotate(' + (-dx * 0.3) + 'deg)}to{transform:rotate(' + dx * 0.3 + 'deg)}}';
      watchFrameTime();
    } else {
      overlay.style.animation = 'none';
    }
    return overlay;
  }

  /* P6 auto-degrade: median frame > 32ms over 2s -> static render + console log */
  var watching = false;
  function watchFrameTime() {
    if (watching || !window.requestAnimationFrame) return;
    watching = true;
    var times = [], start = performance.now();
    function tick(t) {
      times.push(t);
      if (t - start < 2000) { requestAnimationFrame(tick); return; }
      watching = false;
      var sorted = times.slice().sort(function (a, b) { return a - b; });
      var median = sorted[Math.floor(sorted.length / 2)] - sorted[Math.floor(sorted.length / 2) - 1] || 0;
      if (median > 32 && !state.degraded) {
        state.degraded = true;
        var ov = document.querySelector('.bui-overlay'); if (ov) ov.style.animation = 'none';
        console.log('[bui-daily-art] auto-degrade: median frame ' + median.toFixed(1) + 'ms > 32ms over 2s - static render');
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---- page boot ----------------------------------------------------------- */
  function boot() {
    if (state.booted || typeof document === 'undefined') return;
    state.booted = true;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    var root = document.body;
    var stateRoot = root.getAttribute('data-state-root');
    if (!stateRoot) { console.log('[bui-daily-art] no data-state-root on body - daily art idle'); return; }
    var day = api.todayUTC(); /* the ONLY clock read; injectable via tests freezing the page clock */
    var t0 = performance.now();
    var chain = chainTo(day, stateRoot);
    var deriveMs = performance.now() - t0;
    var gate = validate(withHash(chain.manifest, chain.hash));
    if (!gate.ok) { record(chain, 'self-check failed at boot: ' + gate.reason); chain = fallback(day, stateRoot); }
    state.manifest = withHash(chain.manifest, chain.hash); state.bytes = chain.bytes; state.hash = chain.hash; state.chainLength = chain.chainLength;
    state.lastGood = { utc_day: chain.day, manifest_hash: chain.hash };
    state.mode = document.body.getAttribute('data-reg') || 'bee';
    try { localStorage.setItem('bui.cache', JSON.stringify({ d: chain.day, h: chain.hash, n: chain.chainLength })); } catch (e) { /* cache is speed only */ }
    var overlay = render(chain.manifest, state.mode);
    state.render = { deriveMs: deriveMs, chainLength: chain.chainLength, painted: !!overlay };
    document.addEventListener('bregister', function (e) {
      state.mode = (e.detail && e.detail.reg) || 'bee';
      if (state.manifest) render(state.manifest, state.mode);
    });
    console.log('[bui-daily-art] day ' + chain.day + ' manifest ' + chain.hash.slice(0, 8) + ' chain ' + chain.chainLength + ' derive ' + deriveMs.toFixed(1) + 'ms variant ' + chain.manifest.params.variant);
  }
  function withHash(manifest, hash) { var c = {}; Object.keys(manifest).forEach(function (k) { c[k] = manifest[k]; }); c.manifest_hash = hash; return c; }
  function record(chainOrCandidate, reason) {
    var entry = { reason: reason, at: api.todayUTC() };
    try { entry.utc_day = chainOrCandidate.utc_day || chainOrCandidate.day; entry.manifest_hash = chainOrCandidate.hash || chainOrCandidate.manifest_hash || null; } catch (e) { /* keep going */ }
    state.rejected.push(entry);
    try {
      var log = JSON.parse(localStorage.getItem('bui.rejected') || '[]');
      log.push(entry); if (log.length > 50) log = log.slice(-50);
      localStorage.setItem('bui.rejected', JSON.stringify(log));
    } catch (e) { /* record in memory only */ }
    console.log('[bui-daily-art] candidate rejected: ' + reason);
  }
  function fallback(day, stateRoot) {
    /* last good = the previous day's accepted manifest; at genesis day itself
       there is no previous - the genesis manifest IS the floor. */
    if (day === GENESIS_DAY) return chainTo(GENESIS_DAY, stateRoot);
    var prev = chainTo(epochToDay(dayToEpoch(day) - 1), stateRoot);
    return prev;
  }

  /* browser-side test seams (the page never trusts these; they gate, not render) */
  api.boot = boot;
  api.__state = function () { return { hash: state.hash, bytes: state.bytes, chainLength: state.chainLength, rejected: state.rejected.slice(), lastGood: state.lastGood, degraded: state.degraded, render: state.render, mode: state.mode }; };
  api.__accept = function (candidate) {
    var gate = validate(candidate);
    if (!gate.ok) { record(candidate, gate.reason); return false; }
    return true;
  };
  api.__replayLive = function (inputs) {
    /* re-derive from the LIVE body attribute (contrast with replay(recorded)):
       an intraday fork is derived, flagged, and never silently substituted. */
    var live = document.body.getAttribute('data-state-root');
    return api.replay({ utc_day: inputs.utc_day, state_root: live, prev_manifest_hash: inputs.prev_manifest_hash });
  };
  /* The honest end-to-end fallback proof: push a deliberately-broken candidate
     through the REAL accept path (validate -> record -> fallback -> render).
     The page itself never calls this; it exists so the gate can prove the
     queen's acceptance row ("inject a broken candidate -> falls back to the
     last good manifest, kept on record") against the live code path. */
  api.__testBrokenDay = function (day) {
    var root = document.body.getAttribute('data-state-root');
    var chain = chainTo(day, root);
    var candidate = withHash(chain.manifest, chain.hash);
    candidate.params.variant = 99; /* corrupt: out of legal range */
    var gate = validate(candidate);
    if (gate.ok) return { error: 'corruption did not take' };
    record(candidate, gate.reason);
    var fb = fallback(day, root);
    render(fb.manifest, document.body.getAttribute('data-reg') || 'bee');
    return { rejected: state.rejected[state.rejected.length - 1], renderedHash: fb.hash, renderedDay: fb.day };
  };
  return api;
});
