/* Does bComb decode at the Trezor Safe 7's actual screen geometry?
   T3W1 is 380 wide x 520 tall (portrait). The codec draws a SQUARE comb, so the
   comb is 380x380 inside a 380x520 frame with letterbox above and below.
   Answering this BEFORE writing firmware Rust: if the geometry fails here, no
   amount of correct rendering code helps. */
const { createCanvas } = require('canvas');
global.window = {};
global.document = { createElement: () => createCanvas(600, 600) };
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
require('/mnt/c/Users/travi/beehive-nature/surfaces/blight/bcomb.js');
const b = window.bcomb;

const W = 380, H = 520;                       // T3W1 panel, verified from the device itself
console.log('self-test:', b.selfTest().ok ? 'PASS' : 'FAIL');
console.log('T3W1 panel ' + W + 'x' + H + ', cell size = ' + (W / 23).toFixed(2) +
            'px (decoder floor is 3.2px)\n');

// A realistic device-side payload: a signed challenge response.
const PAYLOAD = JSON.stringify({ v: 1, k: 'device-attest', n: 'CHAL-7Q2M', s: 'MEUCIQD8kL3mNpQ' });
const frames = b.framesFor(PAYLOAD);
console.log('payload ' + PAYLOAD.length + 'B -> ' + frames.length + ' frames @ 8 B/frame\n');

function render(frameBits, opts) {
  opts = opts || {};
  const cv = createCanvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);          // letterbox is black
  const comb = createCanvas(W, W);
  b.draw(comb.getContext('2d'), W, frameBits, { lit: opts.lit });
  g.drawImage(comb, 0, Math.round((H - W) / 2));          // centred vertically
  if (opts.dim) { g.fillStyle = 'rgba(0,0,0,' + opts.dim + ')'; g.fillRect(0, 0, W, H); }
  if (opts.wash) { g.fillStyle = 'rgba(255,255,255,' + opts.wash + ')'; g.fillRect(0, 0, W, H); }
  return g.getImageData(0, 0, W, H);
}

// 1 — every frame decodes at native panel geometry
let ok = 0;
for (const f of frames) if (b.decode(render(f))) ok++;
console.log('1. native 380x520, all frames:      ' + ok + '/' + frames.length +
            (ok === frames.length ? '  PASS' : '  FAIL'));

// 2 — full beam assembles (a camera sees each frame repeatedly)
{
  const asm = new b.Assembler(); let out = null;
  for (let pass = 0; pass < 2; pass++)
    for (const f of frames) { const fr = b.decode(render(f)); if (fr) out = asm.push(fr) || out; }
  console.log('2. beam assembles byte-perfect:     ' + (out === PAYLOAD ? 'PASS' : 'FAIL ' + JSON.stringify(out)));
}

// 3 — the device screen is not a monitor: it is dimmer, and a camera sees it
//     through glass. Sweep brightness and glare.
console.log('\n3. robustness sweep (device screens are dim and glossy)');
for (const [label, opts] of [
  ['full brightness            ', {}],
  ['lit=180 (dimmer panel)     ', { lit: 180 }],
  ['lit=120 (much dimmer)      ', { lit: 120 }],
  ['45% dimmed by camera       ', { dim: 0.45 }],
  ['35% glare wash             ', { wash: 0.35 }],
  ['55% glare wash             ', { wash: 0.55 }],
  ['dim panel + glare          ', { lit: 150, wash: 0.30 }],
]) {
  const r = b.inspect(render(frames[0], opts));
  console.log('   ' + label + (r.ok ? 'OK  ' : 'MISS') +
              '  cell=' + (r.finder ? r.finder.size.toFixed(1) + 'px' : '—') +
              '  ' + (r.ok ? 'decoded' : r.stage));
}

// 4 — how far can the comb shrink before it fails? A camera across a room sees
//     the whole phone, so the comb is a fraction of the captured frame.
console.log('\n4. distance proxy — comb shrunk inside a 640px capture');
for (const scale of [380, 300, 240, 200, 160, 130, 110]) {
  const cap = createCanvas(640, 640), g = cap.getContext('2d');
  g.fillStyle = '#0C1412'; g.fillRect(0, 0, 640, 640);
  const t = createCanvas(scale, scale);
  b.draw(t.getContext('2d'), scale, frames[0]);
  g.drawImage(t, (640 - scale) / 2, (640 - scale) / 2);
  const r = b.inspect(g.getImageData(0, 0, 640, 640));
  console.log('   comb ' + String(scale).padStart(3) + 'px in 640px frame: ' +
              (r.ok ? 'OK  ' : 'MISS') + '  cell=' +
              (r.finder ? r.finder.size.toFixed(1) + 'px' : '—') + '  ' + (r.ok ? 'decoded' : r.stage));
}
