/*! bcomb.js — the bComb codec (BNR, part of the bLighTnetWorK)
 *
 *  Claude Design's visual language, made READABLE. Until now bComb could be
 *  drawn but not decoded ("no way to verify" — founder, 2026-08-15). This is
 *  the encoder AND the decoder, plus a self-test that proves the round trip
 *  without any camera.
 *
 *  GEOMETRY (Design §1, verbatim): flat-top axial hex grid, 6 rings, 127 cells.
 *    ring 0    · 1 cell   · FINDER  — mandala magenta rgb(229,58,174), 0 bits,
 *                                     the orientation/scale anchor
 *    rings 1-4 · 60 cells · DATA    — luminance only: pure white = 1, black = 0
 *    rings 5-6 · 66 cells · HALO    — mandala gradient at true radius, 0 bits
 *  Cell layout: x = C + size*1.5*q, y = C + size*sqrt(3)*(r + q/2), size = W/23.
 *
 *  FRAME PAYLOAD (ours): the 60 data bits are
 *    [6 bits index][6 bits total][48 bits = 6 bytes of payload]
 *  so one beam carries up to 64 frames x 6 bytes = 384 bytes, and a receiver
 *  can join at any frame and learn the whole shape from the frame it caught.
 *
 *  RATE, honestly: 60 bits/frame x 7 Hz = 420 BITS/sec (~52 bytes/sec). The
 *  "~420" brand is numerically real but it is bits — not decimen's 418.5 KB/s,
 *  which is a different unit on a different (dense QR) frame. Both true; never
 *  conflate them in copy.
 */
(function (root) {
  'use strict';

  var RINGS = 6, DATA_BITS = 60;

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

  // canonical cell order — identical on both ends, or nothing decodes
  var CELLS = (function () {
    var c = [];
    for (var q = -RINGS; q <= RINGS; q++)
      for (var r = -RINGS; r <= RINGS; r++) {
        var s = -q - r;
        if (Math.abs(s) > RINGS) continue;
        c.push({ q: q, r: r, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) });
      }
    c.sort(function (x, y) {
      return x.ring - y.ring || Math.atan2(x.r, x.q) - Math.atan2(y.r, y.q);
    });
    return c;
  })();
  var DATA_CELLS = CELLS.filter(function (c) { return c.ring >= 1 && c.ring <= 4; });

  function cellXY(c, C, size) {
    return { x: C + size * 1.5 * c.q, y: C + size * Math.sqrt(3) * (c.r + c.q / 2) };
  }

  /* ---------- frame packing ----------
     60 bits = [6 index][6 total-1][40 payload = 5 bytes][8 CRC].
     The CRC is not optional decoration: a camera misreading ONE cell used to
     produce a structurally valid frame full of garbage, which the assembler
     stored and later handed over as mojibake (founder saw exactly that). A
     frame that cannot be checked is worse than a smaller frame — so payload
     dropped 6→5 bytes to buy per-frame integrity. Max beam: 64 × 5 = 320 B. */
  var PAYLOAD_BYTES = 5;

  function crc8(bytes) {                     // CRC-8/ATM (poly 0x07), tiny + adequate
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
    return bits;                             // exactly 60
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
    if (idx >= tot) return null;                                   // impossible → refuse
    if (crc8([idx, tot - 1].concat(bytes)) !== crc) return null;    // misread → refuse
    return { index: idx, total: tot, bytes: bytes };
  }

  /* split a string into payload-sized frames */
  function framesFor(text) {
    var bytes = new TextEncoder().encode(text), out = [];
    var total = Math.max(1, Math.ceil(bytes.length / PAYLOAD_BYTES));
    if (total > 64) throw new Error('payload too long for one bComb beam (max ' + (64 * PAYLOAD_BYTES) + ' bytes)');
    for (var i = 0; i < total; i++)
      out.push(packFrame(i, total, bytes.slice(i * PAYLOAD_BYTES, i * PAYLOAD_BYTES + PAYLOAD_BYTES)));
    return out;
  }

  /* ---------- draw ---------- */
  function draw(ctx, W, bits, opts) {
    opts = opts || {};
    var size = W / 23, C = W / 2, R = size * 0.92, di = 0;
    ctx.fillStyle = opts.light ? '#FFFFFF' : '#000000';
    ctx.fillRect(0, 0, W, W);
    for (var i = 0; i < CELLS.length; i++) {
      var cell = CELLS[i], p = cellXY(cell, C, size), fill;
      if (cell.ring === 0) fill = 'rgb(229,58,174)';
      else if (cell.ring <= 4) {
        var b = bits[di++] ? 1 : 0;
        fill = opts.light ? (b ? '#000000' : '#FFFFFF') : (b ? '#FFFFFF' : '#000000');
      } else fill = opts.strip ? '#202020' : haloColor(cell.ring / RINGS);
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 3 * k, px = p.x + R * Math.cos(a), py = p.y + R * Math.sin(a);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.strokeStyle = opts.light ? 'rgba(6,17,12,0.85)' : 'rgba(255,255,255,0.85)';
      ctx.stroke();
    }
  }

  /* ---------- decode ----------
     Locate the magenta finder (centroid of magenta-ish pixels), estimate the
     cell size from the finder blob's radius, then sample each data cell's
     centre luminance. Upright orientation assumed for v1 — stated, not hidden;
     rotation invariance needs a second anchor and is the next increment. */
  /* CHEAP-PHONE / CROSS-DEVICE ROBUSTNESS (founder 2026-08-15: "interoperable
     with the bulk of raver (broke artists) phones" — and the same weaknesses
     were why a laptop webcam could not read a phone screen):
       1. finder size from blob AREA, not max-distance — one stray magenta pixel
          (a stage light, a lens flare) no longer inflates the estimate;
       2. ADAPTIVE luminance threshold — a dim phone at 20% brightness and an
          overexposed one both failed a fixed 128; the split is now derived from
          the frame's own sampled min/max;
       3. every pixel scanned (not every 2nd) when the blob is small, so a comb
          that occupies a small part of the frame still resolves;
       4. a diagnosis object is always returned, so a surface can TELL the user
          "move closer / raise screen brightness" instead of failing silently. */
  /* The finder must be the LARGEST CONNECTED magenta blob — never a global
     centroid. (Founder 2026-08-15: the laptop ear refused garbage the instant it
     saw the phone. Cause: the receiver's own primary buttons are #D655BB, which
     is magenta by any reasonable test, so a global centroid averaged the real
     finder together with the UI and sampled every cell in the wrong place.
     Stage lights, pink clothing and lens flare are the same failure at a rave.) */
  function isMagenta(r, g, b) {
    return r > 120 && b > 80 && g < r - 60 && g < b - 25 &&      // magenta-ish
           (r - g) > 70;                                          // and saturated
  }

  function findFinder(img) {
    var d = img.data, W = img.width, H = img.height, N = W * H;
    var mask = new Uint8Array(N), i, o;
    for (i = 0; i < N; i++) {
      o = i * 4;
      if (isMagenta(d[o], d[o + 1], d[o + 2])) mask[i] = 1;
    }
    /* Flood-fill each blob and pick the most HEXAGON-LIKE one — not the biggest.
       (Biggest was wrong the moment a UI button out-sized the finder cell, which
       is exactly the founder's phone: a 520x70 magenta button dwarfs a ~13px
       finder. A flat-top hexagon has bbox 2R x 1.73R -> aspect ~1.155 and fills
       ~0.75 of that box; a button is aspect ~7 and fills 1.0. Shape tells them
       apart at any size.) */
    var seen = new Uint8Array(N), stack = new Int32Array(N), best = null;
    for (i = 0; i < N; i++) {
      if (!mask[i] || seen[i]) continue;
      var sp = 0, n = 0, sx = 0, sy = 0,
          x0 = W, x1 = -1, y0 = H, y1 = -1;
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
      if (n < 6) continue;
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      var aspect = bw / bh, fill = n / (bw * bh);
      // distance from the hexagon signature (aspect 1.155, fill 0.75)
      var err = Math.abs(Math.log(aspect / 1.155)) + Math.abs(fill - 0.75) * 2.2;
      if (err > 1.0) continue;                       // not hexagon-shaped at all
      if (!best || err < best.err) best = { n: n, cx: sx / n, cy: sy / n, err: err };
    }
    if (!best) return null;
    var R = Math.sqrt(best.n / 2.598);           // hex area = 2.598*R^2
    if (R < 1.2) return null;
    return { cx: best.cx, cy: best.cy, size: R / 0.92, px: best.n, shapeErr: best.err };
  }

  function sampleBits(img, cx, cy, size) {
    var d = img.data, W = img.width, H = img.height;
    var lum = [], i, c, x, y, dx, dy, o, sum, cnt;
    for (i = 0; i < DATA_CELLS.length; i++) {
      c = DATA_CELLS[i];
      x = Math.round(cx + size * 1.5 * c.q);
      y = Math.round(cy + size * Math.sqrt(3) * (c.r + c.q / 2));
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return null;   // off-frame → refuse
      sum = 0; cnt = 0;
      for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
        o = ((y + dy) * W + (x + dx)) * 4;
        sum += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; cnt++;
      }
      lum.push(sum / cnt);
    }
    // adaptive split: midpoint of this frame's own range, with a contrast floor
    var min = Math.min.apply(null, lum), max = Math.max.apply(null, lum);
    if (max - min < 25) return null;               // washed out → refuse, don't guess
    var mid = (min + max) / 2;
    return lum.map(function (v) { return v > mid ? 1 : 0; });
  }

  /** Full diagnosis — what the camera is actually seeing. Surfaces use this to
   *  coach the user ("move closer", "raise brightness") instead of dying quiet. */
  function inspect(img) {
    var f = findFinder(img);
    if (!f) return { ok: false, stage: 'finder', hint: 'No bComb in view — fill more of the frame with the other screen.' };
    if (f.size < 3.2) return { ok: false, stage: 'too-small', finder: f,
      hint: 'Found it, but too small to read — move closer (or make the beam bigger on the other screen).' };
    var bits = sampleBits(img, f.cx, f.cy, f.size);
    if (!bits) return { ok: false, stage: 'contrast', finder: f,
      hint: 'Comb found but the cells are washed out — raise the other screen\'s brightness or cut the glare.' };
    var fr = unpackFrame(bits);
    if (!fr) return { ok: false, stage: 'frame', finder: f,
      hint: 'Read the cells but the frame header is impossible — hold steadier.' };
    return { ok: true, stage: 'decoded', finder: f, frame: fr };
  }

  /** Decode one bComb frame from ImageData. Returns {index,total,bytes} or null. */
  function decode(img) {
    var f = findFinder(img);
    if (!f) return null;
    var bits = sampleBits(img, f.cx, f.cy, f.size);
    if (!bits) return null;
    return unpackFrame(bits);
  }

  /* ---------- assembly across frames (join anywhere, any order) ---------- */
  function Assembler() { this.total = 0; this.parts = []; this.got = 0; }
  Assembler.prototype.push = function (fr) {
    if (!fr) return null;
    if (this.total !== fr.total) { this.total = fr.total; this.parts = new Array(fr.total); this.got = 0; }
    if (this.parts[fr.index] === undefined) { this.parts[fr.index] = fr.bytes; this.got++; }
    if (this.got < this.total) return null;
    var all = [];
    for (var i = 0; i < this.total; i++) all = all.concat(this.parts[i]);
    while (all.length && all[all.length - 1] === 0) all.pop();      // strip tail padding
    return new TextDecoder().decode(new Uint8Array(all));
  };

  /* ---------- self-test: proof without a camera ---------- */
  function selfTest(text) {
    text = text || 'bLighTnetWorK · bComb self-test · 420 bits/sec';
    var W = 600, cv = document.createElement('canvas');
    cv.width = cv.height = W;
    var ctx = cv.getContext('2d');
    var frames = framesFor(text), asm = new Assembler(), out = null, decoded = 0;
    for (var i = 0; i < frames.length; i++) {
      draw(ctx, W, frames[i]);
      var fr = decode(ctx.getImageData(0, 0, W, W));
      if (fr) { decoded++; out = asm.push(fr) || out; }
    }
    return {
      frames: frames.length, decoded: decoded,
      recovered: out, ok: out === text,
      bitsPerFrame: DATA_BITS, dataCells: DATA_CELLS.length, cells: CELLS.length
    };
  }

  root.bcomb = {
    CELLS: CELLS, DATA_CELLS: DATA_CELLS, DATA_BITS: DATA_BITS,
    haloColor: haloColor, draw: draw, decode: decode,
    packFrame: packFrame, unpackFrame: unpackFrame, framesFor: framesFor,
    findFinder: findFinder, sampleBits: sampleBits, inspect: inspect,
    Assembler: Assembler, selfTest: selfTest
  };
})(typeof window !== 'undefined' ? window : globalThis);
