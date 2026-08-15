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

  /* ---------- frame packing ---------- */
  function packFrame(index, total, sixBytes) {
    if (total < 1 || total > 64) throw new Error('total must be 1..64');
    var bits = [], i, b;
    for (i = 5; i >= 0; i--) bits.push((index >> i) & 1);
    for (i = 5; i >= 0; i--) bits.push(((total - 1) >> i) & 1);
    for (b = 0; b < 6; b++) {
      var byte = sixBytes[b] === undefined ? 0 : sixBytes[b] & 0xff;
      for (i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    }
    return bits; // exactly 60
  }
  function unpackFrame(bits) {
    if (!bits || bits.length !== DATA_BITS) return null;
    var idx = 0, tot = 0, i, bytes = [];
    for (i = 0; i < 6; i++) idx = (idx << 1) | bits[i];
    for (i = 6; i < 12; i++) tot = (tot << 1) | bits[i];
    tot += 1;
    for (var b = 0; b < 6; b++) {
      var v = 0;
      for (i = 0; i < 8; i++) v = (v << 1) | bits[12 + b * 8 + i];
      bytes.push(v);
    }
    if (idx >= tot) return null;            // structurally impossible → refuse
    return { index: idx, total: tot, bytes: bytes };
  }

  /* split a string into 6-byte frames */
  function framesFor(text) {
    var bytes = new TextEncoder().encode(text), out = [];
    var total = Math.max(1, Math.ceil(bytes.length / 6));
    if (total > 64) throw new Error('payload too long for one bComb beam (max 384 bytes)');
    for (var i = 0; i < total; i++) out.push(packFrame(i, total, bytes.slice(i * 6, i * 6 + 6)));
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
  function findFinder(img) {
    var d = img.data, W = img.width, H = img.height;
    var sx = 0, sy = 0, n = 0;
    for (var y = 0; y < H; y += 2) {
      for (var x = 0; x < W; x += 2) {
        var o = (y * W + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
        // magenta: strong red + strong blue, weak green
        if (r > 150 && b > 110 && g < r - 70 && g < b - 20) { sx += x; sy += y; n++; }
      }
    }
    if (n < 12) return null;
    var cx = sx / n, cy = sy / n;
    // radius of the finder blob → cell size (a hex cell's R ≈ 0.92*size)
    var far = 0;
    for (var yy = 0; yy < H; yy += 2) {
      for (var xx = 0; xx < W; xx += 2) {
        var oo = (yy * W + xx) * 4, rr = d[oo], gg = d[oo + 1], bb = d[oo + 2];
        if (rr > 150 && bb > 110 && gg < rr - 70 && gg < bb - 20) {
          var dist = Math.hypot(xx - cx, yy - cy);
          if (dist > far) far = dist;
        }
      }
    }
    if (far < 3) return null;
    return { cx: cx, cy: cy, size: far / 0.92 };
  }

  function sampleBits(img, cx, cy, size) {
    var d = img.data, W = img.width, H = img.height, bits = [];
    for (var i = 0; i < DATA_CELLS.length; i++) {
      var c = DATA_CELLS[i];
      var x = Math.round(cx + size * 1.5 * c.q);
      var y = Math.round(cy + size * Math.sqrt(3) * (c.r + c.q / 2));
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return null;   // off-frame → refuse
      // 3x3 median-ish average of luminance at the cell centre
      var sum = 0, cnt = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var o = ((y + dy) * W + (x + dx)) * 4;
        sum += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; cnt++;
      }
      bits.push((sum / cnt) > 128 ? 1 : 0);
    }
    return bits;
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
    findFinder: findFinder, sampleBits: sampleBits,
    Assembler: Assembler, selfTest: selfTest
  };
})(typeof window !== 'undefined' ? window : globalThis);
