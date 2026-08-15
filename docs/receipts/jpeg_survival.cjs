/* Does a bComb frame survive JPEG encoding at T3W1 homescreen constraints?
   The firmware accepts ONLY JPEG, exactly 380x520, mcu_height <= 16
   (layout_eckhart/firmware/homescreen/helpers.rs:11). JPEG is lossy and a bComb
   is nothing but high-contrast edges, which is the worst case for DCT ringing.
   If this fails there is no no-Rust path to the receipt. */
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
global.window = {};
global.document = { createElement: () => createCanvas(600, 600) };
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
require('/mnt/c/Users/travi/beehive-nature/surfaces/blight/bcomb.js');
const b = window.bcomb;

const W = 380, H = 520;
const PAYLOAD = 'bLighTnetWorK on a Trezor screen';
const frames = b.framesFor(PAYLOAD);
console.log('payload ' + PAYLOAD.length + 'B -> ' + frames.length + ' frames');
console.log('self-test:', b.selfTest().ok ? 'PASS' : 'FAIL');

function frameCanvas(bits) {
  const cv = createCanvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const comb = createCanvas(W, W);
  b.draw(comb.getContext('2d'), W, bits);
  g.drawImage(comb, 0, Math.round((H - W) / 2));
  return cv;
}

(async () => {
  console.log('\nJPEG quality sweep — does the frame survive the round trip?');
  const results = [];
  for (const q of [1.0, 0.95, 0.9, 0.8, 0.7, 0.5]) {
    const cv = frameCanvas(frames[0]);
    const jpg = cv.toBuffer('image/jpeg', { quality: q });
    const img = await loadImage(jpg);
    const back = createCanvas(W, H), bg = back.getContext('2d');
    bg.drawImage(img, 0, 0);
    const r = b.inspect(bg.getImageData(0, 0, W, H));
    results.push({ q, size: jpg.length, ok: r.ok });
    console.log('  q=' + q.toFixed(2) + '  ' + String(jpg.length).padStart(6) + ' B  ' +
      (r.ok ? 'DECODED' : 'MISS (' + r.stage + ')') +
      (jpg.length > 65536 ? '   ** OVER 64 KiB LIMIT **' : ''));
  }

  // full beam through JPEG at the best size-safe quality
  const q = 0.9;
  const asm = new b.Assembler(); let out = null, ok = 0;
  for (let pass = 0; pass < 2; pass++) for (const f of frames) {
    const jpg = frameCanvas(f).toBuffer('image/jpeg', { quality: q });
    const img = await loadImage(jpg);
    const c2 = createCanvas(W, H), g2 = c2.getContext('2d');
    g2.drawImage(img, 0, 0);
    const fr = b.decode(g2.getImageData(0, 0, W, H));
    if (fr) { ok++; out = asm.push(fr) || out; }
  }
  console.log('\nfull beam through JPEG q=' + q + ': ' + ok + '/' + (frames.length * 2) +
    ' frames decoded, assembled=' + (out === PAYLOAD ? 'PASS' : 'FAIL'));

  // emit frame 0 for the emulator, and check the firmware's size ceiling
  const outJpg = frameCanvas(frames[0]).toBuffer('image/jpeg', { quality: q });
  fs.writeFileSync(process.env.HOME + '/bcomb_home.jpg', outJpg);
  console.log('\nwrote ~/bcomb_home.jpg  ' + outJpg.length + ' B  (T3W1 limit 65536)  ' +
    (outJpg.length <= 65536 ? 'FITS' : 'TOO BIG'));
  console.log('dimensions ' + W + 'x' + H + ' — firmware requires exactly this');
})();
