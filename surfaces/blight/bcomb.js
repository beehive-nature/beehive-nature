/*! bcomb.js — the bComb codec (BNR, part of the bLighTnetWorK)
 *
 *  MONOCHROME v2 (founder ruling 2026-08-15): "remove all color from it and just
 *  white hexagons flashing light/data. the color is fucking up the receiving
 *  camera/process." Correct on two counts, one physical and one doctrinal:
 *
 *   PHYSICS — a bright saturated halo on a dark page makes a camera's auto
 *   exposure hunt upward and its auto white balance chase the hue; the founder
 *   watched a clean capture drift to washed-out white mid-beam. Luminance-only
 *   is the channel every camera agrees on.
 *   DOCTRINE — v1 LOCATED the comb by magenta hue, so colour carried meaning:
 *   a straight D-1 violation hiding inside the decoder. The finder is now
 *   STRUCTURAL (a lit centre inside a dark collar) and reads on luminance alone.
 *
 *  GEOMETRY — flat-top axial hex grid, 6 rings, 127 cells:
 *    ring 0    ·  1 cell  · FINDER CORE  — always LIT
 *    ring 1    ·  6 cells · FINDER COLLAR — always DARK (the bullseye)
 *    rings 2-5 · 84 cells · DATA — 1 luminance bit per cell
 *    ring 6    · 36 cells · RIM  — always LIT; zero bits. Optionally tinted with
 *                                  the mandala gradient for brand renders, which
 *                                  the decoder never looks at.
 *  Cell layout: x = C + size*1.5*q, y = C + size*sqrt(3)*(r + q/2), size = W/23.
 *
 *  FRAME — the 84 data bits are [6 index][6 total-1][64 payload = 8 bytes][8 CRC],
 *  so one beam carries up to 64 frames x 8 bytes = 512 bytes, and any single
 *  frame teaches a late joiner the whole shape. (v1 carried 5 bytes/frame; the
 *  collar cost 6 cells and the freed halo ring gave back 24, so payload grew.)
 *
 *  RATE, honestly: 84 bits/frame x 7 Hz = 588 bits/sec (~73 bytes/sec). The
 *  "~420" brand came from v1's 60 bits x 7 Hz and is now a floor, not a ceiling.
 *  Never conflate either figure with decimen's 418.5 KB/s on a dense QR frame.
 */
(function (root) {
  'use strict';

  var RINGS = 6, DATA_BITS = 84, PAYLOAD_BYTES = 8;

  /* mandala gradient — DECORATION ONLY. The decoder never reads a hue. */
  var STOPS = [[0,254,222,250],[0.06,229,58,174],[0.10,246,68,196],[0.14,235,68,198],
    [0.19,197,38,177],[0.24,204,118,211],[0.30,140,87,193],[0.36,144,156,215],[0.42,66,167,242],
    [0.48,41,200,246],[0.55,126,215,212],[0.62,116,212,140],[0.70,154,227,81],[0.78,149,220,114],
    [0.86,181,241,49],[0.93,230,247,58],[1,251,251,159]];
  function haloColor(t) {
    var i = 0;
    while (i < STOPS.length - 2 && STOPS[i + 1][0] < t) i++;
    var a = STOPS[i], b = STOPS[i + 1];
    var k = Math.max(0, Math.min(1, (t - a[0]) / ((b[0] - a[0]) || 1)));
    return 'rgb(' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' +
                    Math.round(a[2] + (b[2] - a[2]) * k) + ',' +
                    Math.round(a[3] + (b[3] - a[3]) * k) + ')';
  }

  var CELLS = (function () {
    var c = [];
    for (var q = -RINGS; q <= RINGS; q++)
      for (var r = -RINGS; r <= RINGS; r++) {
        var s = -q - r;
        if (Math.abs(s) > RINGS) continue;
        c.push({ q: q, r: r, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) });
      }
    c.sort(function (x, y) { return x.ring - y.ring || Math.atan2(x.r, x.q) - Math.atan2(y.r, y.q); });
    return c;
  })();
  var DATA_CELLS = CELLS.filter(function (c) { return c.ring >= 2 && c.ring <= 5; });
  var COLLAR     = CELLS.filter(function (c) { return c.ring === 1; });

  function cellXY(c, C, size) {
    return { x: C + size * 1.5 * c.q, y: C + size * Math.sqrt(3) * (c.r + c.q / 2) };
  }

  /* ---------- frame packing: [6 idx][6 tot-1][64 payload][8 CRC] = 84 ---------- */
  function crc8(bytes) {
    var c = 0, i, j;
    for (i = 0; i < bytes.length; i++) {
      c ^= bytes[i] & 0xff;
      for (j = 0; j < 8; j++) c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
    }
    return c & 0xff;
  }
  function packFrame(index, total, payload) {
    if (total < 1 || total > 64) throw new Error('total must be 1..64');
    var bits = [], i, b, bytes = [];
    for (b = 0; b < PAYLOAD_BYTES; b++) bytes.push(payload[b] === undefined ? 0 : payload[b] & 0xff);
    var crc = crc8([index, total - 1].concat(bytes));
    for (i = 5; i >= 0; i--) bits.push((index >> i) & 1);
    for (i = 5; i >= 0; i--) bits.push(((total - 1) >> i) & 1);
    for (b = 0; b < PAYLOAD_BYTES; b++) for (i = 7; i >= 0; i--) bits.push((bytes[b] >> i) & 1);
    for (i = 7; i >= 0; i--) bits.push((crc >> i) & 1);
    return bits;                                  // exactly 84
  }
  function unpackFrame(bits) {
    if (!bits || bits.length !== DATA_BITS) return null;
    var idx = 0, tot = 0, crc = 0, i, b, bytes = [];
    for (i = 0; i < 6; i++) idx = (idx << 1) | bits[i];
    for (i = 6; i < 12; i++) tot = (tot << 1) | bits[i];
    tot += 1;
    for (b = 0; b < PAYLOAD_BYTES; b++) {
      var v = 0;
      for (i = 0; i < 8; i++) v = (v << 1) | bits[12 + b * 8 + i];
      bytes.push(v);
    }
    for (i = 0; i < 8; i++) crc = (crc << 1) | bits[12 + PAYLOAD_BYTES * 8 + i];
    if (idx >= tot) return null;
    if (crc8([idx, tot - 1].concat(bytes)) !== crc) return null;
    return { index: idx, total: tot, bytes: bytes };
  }
  /* ---------- beam envelope: length + CRC-32 over the WHOLE message ----------
     Per-frame CRC-8 is a cheap filter, not a guarantee: 1 in 256 corrupt frames
     passes it. Confirm-then-store catches RANDOM noise, because random garbage
     rarely repeats byte-identically — but it does NOT catch a SYSTEMATIC misread.
     If one cell reads wrong every time (glare sitting on one part of the screen
     while the phone moves), the same wrong frame is seen twice and gets confirmed.
     Founder receipt 2026-08-15: a beam assembled with intact ends and garbage in
     the middle, caught only by the outer nonce check. The codec must never hand
     up bytes it cannot vouch for.
       [2 bytes length][payload][4 bytes CRC-32 of the payload]
     zero-padded to the frame boundary. Explicit length replaces tail-padding
     stripping, which could not tell a real trailing zero from padding. */
  var HEADER_BYTES = 2, TRAILER_BYTES = 4, ENVELOPE = HEADER_BYTES + TRAILER_BYTES;
  var MAX_BEAM_BYTES = 64 * PAYLOAD_BYTES - ENVELOPE;          // 506

  var CRC32_TABLE = (function () {
    var t = new Int32Array(256), c, i, k;
    for (i = 0; i < 256; i++) {
      c = i;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function framesFor(text) {
    var payload = new TextEncoder().encode(text);
    if (payload.length > MAX_BEAM_BYTES)
      throw new Error('payload too long for one bComb beam (max ' + MAX_BEAM_BYTES + ' bytes)');
    var sum = crc32(payload), body = [], i;
    body.push((payload.length >> 8) & 0xff, payload.length & 0xff);
    for (i = 0; i < payload.length; i++) body.push(payload[i]);
    body.push((sum >>> 24) & 0xff, (sum >>> 16) & 0xff, (sum >>> 8) & 0xff, sum & 0xff);
    var total = Math.max(1, Math.ceil(body.length / PAYLOAD_BYTES)), out = [];
    for (i = 0; i < total; i++)
      out.push(packFrame(i, total, body.slice(i * PAYLOAD_BYTES, i * PAYLOAD_BYTES + PAYLOAD_BYTES)));
    return out;
  }

  /* Verify and unwrap an assembled body. Returns the text, or null if the beam
     did not survive the trip — never a guess. */
  function openEnvelope(body) {
    if (body.length < ENVELOPE) return null;
    var len = (body[0] << 8) | body[1];
    if (len > MAX_BEAM_BYTES) return null;
    if (body.length < HEADER_BYTES + len + TRAILER_BYTES) return null;
    var payload = body.slice(HEADER_BYTES, HEADER_BYTES + len);
    var o = HEADER_BYTES + len;
    var want = ((body[o] << 24) | (body[o + 1] << 16) | (body[o + 2] << 8) | body[o + 3]) >>> 0;
    if (crc32(payload) !== want) return null;
    return new TextDecoder().decode(new Uint8Array(payload));
  }

  /* ---------- draw ----------
     opts.brand : tint the rim with the mandala gradient (decoration; the decoder
                  ignores it). Default OFF — monochrome is the transport default
                  because a camera's AE/AWB stay still when nothing is saturated.
     opts.lit   : luminance of a lit cell (default 235, not 255 — a slightly
                  softened white gives a camera's auto-exposure less to bloom). */
  function draw(ctx, W, bits, opts) {
    opts = opts || {};
    var size = W / 23, C = W / 2, R = size * 0.92, di = 0;
    var lit = opts.lit || 235, LIT = 'rgb(' + lit + ',' + lit + ',' + lit + ')';
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, W);
    for (var i = 0; i < CELLS.length; i++) {
      var cell = CELLS[i], p = cellXY(cell, C, size), fill;
      if (cell.ring === 0) fill = LIT;                       // finder core: lit
      else if (cell.ring === 1) fill = '#000000';            // finder collar: dark
      else if (cell.ring <= 5) fill = bits[di++] ? LIT : '#000000';
      else fill = opts.brand ? haloColor(cell.ring / RINGS) : LIT;   // rim
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 3 * k, px = p.x + R * Math.cos(a), py = p.y + R * Math.sin(a);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.strokeStyle = 'rgba(128,128,128,0.55)';            // neutral seam, no hue
      ctx.stroke();
    }
  }

  /* ---------- decode: LUMINANCE ONLY ----------
     Find the bullseye — a lit hexagon blob whose surrounding collar is dark —
     then sample the data rings. No hue is read anywhere in this path. */
  function luma(d, o) { return 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; }

  function frameExposure(img) {
    var d = img.data, n = 0, sum = 0, i;
    for (i = 0; i < d.length; i += 64) { sum += luma(d, i); n++; }
    return n ? sum / n : 0;
  }

  /* Locating the comb, assuming NOTHING about connectivity.
     Cells are drawn at R = 0.92*size, which leaves a deliberate gap, so the rim
     is 36 SEPARATE blobs at close range and one merged mass once a camera blurs
     them together. A finder that assumes either regime breaks in the other. So
     we read the comb as a CLUSTER of lit hexagons and offer both readings as
     hypotheses, then let the known-value cells (lit core, dark collar, lit rim)
     vote. Ring 6 is always lit and always outermost, which is what makes either
     bound independent of the data:
       cell CENTROIDS span  18.000*size wide, 20.784*size tall
       merged OUTER edges span 19.84*size wide, 22.379*size tall            */
  var CEN_W = 18.0, CEN_H = 20.784, RIM_W = 19.84, RIM_H = 22.379;

  function findFinder(img) {
    var d = img.data, W = img.width, H = img.height, N = W * H, i;
    // adaptive: "lit" is relative to this frame, so exposure drift cannot break it
    var lo = 255, hi = 0;
    for (i = 0; i < N; i += 7) { var L = luma(d, i * 4); if (L < lo) lo = L; if (L > hi) hi = L; }
    if (hi - lo < 25) return null;
    var cut = lo + (hi - lo) * 0.55;

    var mask = new Uint8Array(N);
    for (i = 0; i < N; i++) if (luma(d, i * 4) > cut) mask[i] = 1;

    var seen = new Uint8Array(N), stack = new Int32Array(N), blobs = [];
    for (i = 0; i < N; i++) {
      if (!mask[i] || seen[i]) continue;
      var sp = 0, n = 0, sx = 0, sy = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
      stack[sp++] = i; seen[i] = 1;
      while (sp > 0) {
        var p = stack[--sp], px = p % W, py = (p / W) | 0;
        n++; sx += px; sy += py;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        if (px > 0     && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (px < W - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (py > 0     && mask[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
        if (py < H - 1 && mask[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
      }
      if (n < 5) continue;
      blobs.push({ n: n, cx: sx / n, cy: sy / n, x0: x0, x1: x1, y0: y0, y1: y1 });
    }
    if (!blobs.length) return null;

    var cands = [];

    /* H1 — separated regime: the lit hexagons are individually visible. Keep the
       hexagon-shaped ones, size from their MEDIAN area (robust to a stray UI
       shape), then bound the ones that agree on size. Ring 6 is lit and outermost,
       so that bound is the rim's however the data bits fall. */
    var hexes = [];
    for (i = 0; i < blobs.length; i++) {
      var b = blobs[i], bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      var aspect = bw / bh, fill = b.n / (bw * bh);
      if (aspect < 0.72 || aspect > 1.62) continue;
      if (fill < 0.55 || fill > 0.98) continue;
      hexes.push(b);
    }
    if (hexes.length >= 10) {
      var areas = hexes.map(function (b) { return b.n; }).sort(function (a, z) { return a - z; });
      var med = areas[areas.length >> 1];
      var keep = hexes.filter(function (b) { return b.n >= med * 0.45 && b.n <= med * 2.2; });
      if (keep.length >= 10) {
        var mx0 = Infinity, mx1 = -Infinity, my0 = Infinity, my1 = -Infinity;
        for (i = 0; i < keep.length; i++) {
          if (keep[i].cx < mx0) mx0 = keep[i].cx; if (keep[i].cx > mx1) mx1 = keep[i].cx;
          if (keep[i].cy < my0) my0 = keep[i].cy; if (keep[i].cy > my1) my1 = keep[i].cy;
        }
        var byCell = Math.sqrt(med / 2.598) / 0.92;
        var bySpan = ((mx1 - mx0) / CEN_W + (my1 - my0) / CEN_H) / 2;
        cands.push({ cx: (mx0 + mx1) / 2, cy: (my0 + my1) / 2, size: bySpan, px: keep.length, how: 'cluster' });
        cands.push({ cx: (mx0 + mx1) / 2, cy: (my0 + my1) / 2, size: byCell, px: keep.length, how: 'cell' });
      }
    }

    /* H2 — merged regime: distance or blur has fused the comb into one mass, so
       the largest blobs are read as the comb's outer bounds. */
    blobs.sort(function (a, b) { return b.n - a.n; });
    for (i = 0; i < Math.min(4, blobs.length); i++) {
      var m = blobs[i], mw = m.x1 - m.x0 + 1, mh = m.y1 - m.y0 + 1;
      if (mw / mh < 0.70 || mw / mh > 1.14) continue;
      cands.push({ cx: (m.x0 + m.x1) / 2, cy: (m.y0 + m.y1) / 2,
                   size: (mw / RIM_W + mh / RIM_H) / 2, px: m.n, how: 'merged' });
    }

    var best = null;
    for (i = 0; i < cands.length; i++) {
      if (cands[i].size < 1.4) continue;
      var f = refine(img, cands[i]);
      if (!f || f.lock < 25) continue;                   // core/collar/rim never agreed
      if (!best || f.lock > best.lock) best = f;
    }
    return best;
  }

  /* Lock centre and scale against the cells whose value is KNOWN — lit core,
     dark collar, lit rim (43 anchors). A blob centroid is good to a pixel or
     two and its area-derived radius is biased by the threshold; that error is
     harmless at ring 1 and fatal by ring 5, which is where the data now
     reaches. This search buys back the small-comb envelope outright. */
  var LIT_ANCHORS  = CELLS.filter(function (c) { return c.ring === 0 || c.ring === 6; });
  function refine(img, f) {
    var d = img.data, W = img.width, H = img.height;
    function at(cx, cy, size, c) {
      var x = Math.round(cx + size * 1.5 * c.q);
      var y = Math.round(cy + size * Math.sqrt(3) * (c.r + c.q / 2));
      if (x < 0 || y < 0 || x >= W || y >= H) return -1;
      return luma(d, (y * W + x) * 4);
    }
    function score(cx, cy, size) {
      var litSum = 0, litN = 0, darkSum = 0, darkN = 0, v, i;
      for (i = 0; i < LIT_ANCHORS.length; i++) { v = at(cx, cy, size, LIT_ANCHORS[i]); if (v >= 0) { litSum += v; litN++; } }
      for (i = 0; i < COLLAR.length; i++)      { v = at(cx, cy, size, COLLAR[i]);      if (v >= 0) { darkSum += v; darkN++; } }
      if (litN < LIT_ANCHORS.length * 0.6 || darkN < 4) return -1e9;
      return litSum / litN - darkSum / darkN;          // maximise known contrast
    }
    var best = { cx: f.cx, cy: f.cy, size: f.size, s: score(f.cx, f.cy, f.size) };
    var step = Math.max(0.4, f.size * 0.18), scales = [0.95, 0.97, 0.99, 1.0, 1.01, 1.03, 1.05];
    for (var pass = 0; pass < 4; pass++) {
      var moved = false, base = { cx: best.cx, cy: best.cy, size: best.size };
      for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++)
        for (var k = 0; k < scales.length; k++) {
          var cx = base.cx + dx * step, cy = base.cy + dy * step, sz = base.size * scales[k];
          var s = score(cx, cy, sz);
          if (s > best.s) { best = { cx: cx, cy: cy, size: sz, s: s }; moved = true; }
        }
      if (!moved && pass > 0) break;
      step *= 0.5; scales = [0.985, 0.995, 1.0, 1.005, 1.015];
    }
    f.cx = best.cx; f.cy = best.cy; f.size = best.size; f.lock = best.s;
    return f;
  }

  function cellStats(img, cx, cy, size) {
    var d = img.data, W = img.width, H = img.height, lum = [], i, c, x, y, dx, dy, o, sum, cnt;
    for (i = 0; i < DATA_CELLS.length; i++) {
      c = DATA_CELLS[i];
      x = Math.round(cx + size * 1.5 * c.q);
      y = Math.round(cy + size * Math.sqrt(3) * (c.r + c.q / 2));
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return null;
      sum = 0; cnt = 0;
      for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
        o = ((y + dy) * W + (x + dx)) * 4; sum += luma(d, o); cnt++;
      }
      lum.push(sum / cnt);
    }
    var min = Math.min.apply(null, lum), max = Math.max.apply(null, lum);
    return { lum: lum, min: min, max: max, range: max - min };
  }

  function sampleBits(img, cx, cy, size) {
    var st = cellStats(img, cx, cy, size);
    if (!st || st.range < 25) return null;
    var mid = (st.min + st.max) / 2;
    return st.lum.map(function (v) { return v > mid ? 1 : 0; });
  }

  function inspect(img) {
    var f = findFinder(img);
    if (!f) {
      var ex = frameExposure(img);
      return { ok: false, stage: 'finder', quality: 0, exposure: ex,
        hint: ex > 195 ? 'Washed out — turn the OTHER screen DOWN (this reads contrast, not brightness), or tilt away from the light.'
            : ex < 22  ? 'Too dark — turn the other screen UP, or move closer.'
            : 'Aim at the other screen — fill more of the frame with it.' };
    }
    if (f.size < 3.2) return { ok: false, stage: 'too-small', finder: f, quality: 0.25,
      hint: 'Got it, but tiny — move closer, or make the beam bigger over there.' };
    var st = cellStats(img, f.cx, f.cy, f.size);
    if (!st) return { ok: false, stage: 'edge', finder: f, quality: 0.3,
      hint: 'The comb is running off the edge — centre it in view.' };
    if (st.min > 150) return { ok: false, stage: 'glare', finder: f, stats: st, quality: 0.4,
      hint: 'GLARE — the dark cells are washing out. Turn the other screen DOWN, or tilt it a few degrees.' };
    if (st.max < 60) return { ok: false, stage: 'dark', finder: f, stats: st, quality: 0.4,
      hint: 'Too dark — turn the other screen UP.' };
    if (st.range < 25) return { ok: false, stage: 'contrast', finder: f, stats: st, quality: 0.45,
      hint: 'Washed out — turn the other screen DOWN and cut any glare.' };
    var mid = (st.min + st.max) / 2;
    var fr = unpackFrame(st.lum.map(function (v) { return v > mid ? 1 : 0; }));
    if (!fr) return { ok: false, stage: 'checksum', finder: f, stats: st, quality: 0.7,
      hint: 'Nearly — that frame failed its checksum. Hold it there for one beat.' };
    return { ok: true, stage: 'decoded', finder: f, stats: st, quality: 1, frame: fr };
  }
  function decode(img) { var r = inspect(img); return r.ok ? r.frame : null; }

  /* ---------- assembly: progress is sacred ---------- */
  function Assembler() {
    this.total = 0; this.parts = []; this.got = 0;
    this.seen = {}; this.rejected = 0; this.wrongTotal = 0;
    this.corrupt = 0;            // completed assemblies that failed the beam CRC
    this.confirmAt = 2;          // sightings required before a frame is trusted
    this.lastFailure = null;
  }
  Assembler.prototype.reset = function () {
    this.total = 0; this.got = 0; this.parts = []; this.seen = {};
  };
  Assembler.prototype.push = function (fr) {
    if (!fr) return null;
    if (this.total && this.got > 0 && fr.total !== this.total) {
      this.wrongTotal++; this.rejected++;
      if (this.wrongTotal < 12) return null;                     // noise — keep progress
      this.reset();
    }
    this.wrongTotal = 0;
    var key = fr.total + '|' + fr.index + '|' + fr.bytes.join(',');
    this.seen[key] = (this.seen[key] || 0) + 1;
    if (this.seen[key] < this.confirmAt) return null;             // confirm-then-store
    if (this.total !== fr.total) { this.total = fr.total; this.parts = new Array(fr.total); this.got = 0; }
    if (this.parts[fr.index] === undefined) { this.parts[fr.index] = fr.bytes; this.got++; }
    if (this.got < this.total) return null;

    var body = [], i;
    for (i = 0; i < this.total; i++) body = body.concat(this.parts[i]);
    var text = openEnvelope(body);
    if (text === null) {
      /* Every frame passed its own CRC-8 and the beam still did not survive —
         so at least one frame was a systematic misread that slipped the 1-in-256.
         Refuse it. Delivering bytes we cannot vouch for is the worst outcome
         available: worse than a slow beam, worse than no beam. Start over, and
         demand one more confirming sighting per frame, because this channel has
         now PROVEN it repeats its mistakes. */
      this.corrupt++; this.lastFailure = 'beam-checksum';
      this.confirmAt = Math.min(this.confirmAt + 1, 5);
      this.reset();
      return null;
    }
    this.lastFailure = null;
    return text;
  };

  /* ---------- self-test: proof without a camera ---------- */
  function selfTest(text) {
    text = text || 'bLighTnetWorK · bComb mono v2 · luminance only';
    var W = 600, cv = document.createElement('canvas');
    cv.width = cv.height = W;
    var ctx = cv.getContext('2d');
    var frames = framesFor(text), asm = new Assembler(), out = null, decoded = 0;
    for (var i = 0; i < frames.length; i++) {
      draw(ctx, W, frames[i]);
      for (var pass = 0; pass < 2; pass++) {          // a camera sees each frame repeatedly
        var fr = decode(ctx.getImageData(0, 0, W, W));
        if (fr) { if (pass === 0) decoded++; out = asm.push(fr) || out; }
      }
    }
    return { frames: frames.length, decoded: decoded, recovered: out, ok: out === text,
             bitsPerFrame: DATA_BITS, dataCells: DATA_CELLS.length, cells: CELLS.length,
             payloadBytes: PAYLOAD_BYTES };
  }

  root.bcomb = {
    CELLS: CELLS, DATA_CELLS: DATA_CELLS, COLLAR: COLLAR, DATA_BITS: DATA_BITS,
    PAYLOAD_BYTES: PAYLOAD_BYTES, MAX_BEAM_BYTES: MAX_BEAM_BYTES,
    crc32: crc32, openEnvelope: openEnvelope, haloColor: haloColor,
    draw: draw, decode: decode, inspect: inspect,
    packFrame: packFrame, unpackFrame: unpackFrame, framesFor: framesFor,
    findFinder: findFinder, sampleBits: sampleBits, cellStats: cellStats,
    Assembler: Assembler, selfTest: selfTest
  };
})(typeof window !== 'undefined' ? window : globalThis);
