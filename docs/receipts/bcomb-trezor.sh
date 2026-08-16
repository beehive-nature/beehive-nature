#!/bin/sh
# bcomb-trezor.sh — encode a message, render it on the Trezor Safe 7 emulator,
# capture the screen, decode it back, and prove the bytes are identical.
#
#   wsl -e sh /mnt/c/Users/travi/bcomb-trezor.sh
#   wsl -e sh /mnt/c/Users/travi/bcomb-trezor.sh "your own message here"
#
# Refuses loudly if a precondition is missing rather than half-running.
# Nothing here touches mainnet, keys, or the founder's Safe 7 hardware.

set -e

MSG="${1:-bLighTnetWorK on a Trezor screen}"

FW=/mnt/c/Users/travi/source/trezor-firmware
BN=/mnt/c/Users/travi/beehive-nature
EMU="$FW/core/build/unix/trezor-emu-core"
CODEC="$BN/surfaces/blight/bcomb.js"
WORK="$HOME/.bcomb-trezor"
SHOTS="$WORK/shots"

say() { printf '%s\n' "$*"; }
die() { printf '\n  REFUSED: %s\n\n' "$*" >&2; exit 1; }

say ""
say "  bComb -> Trezor Safe 7 -> camera-free decode"
say "  ============================================"
say ""
say "  message: $MSG"
say ""

# ---- preconditions, each named ----------------------------------------------
[ -f "$CODEC" ] || die "codec not found at $CODEC"
[ -x "$EMU" ] || {
  [ -f "$EMU" ] && die "emulator at $EMU is not executable (the exec bit is lost crossing /mnt/c — run: chmod +x $EMU)"
  die "no emulator at $EMU — build it first:
    export PATH=\$HOME/tzenv/bin:\$HOME/.local/bin:\$PATH
    cd $FW/core && make -f Makefile.scons build_unix UNIX_PORT_OPTS=\"DISABLE_TROPIC=1\""
}
command -v node >/dev/null 2>&1 || die "node is not on PATH"
# find the 'canvas' module wherever it was installed, so this needs no setup
for d in "$HOME/bt/node_modules" "$HOME/node_modules" "$PWD/node_modules"; do
  [ -d "$d/canvas" ] && { NODE_PATH="$d"; export NODE_PATH; break; }
done
node -e "require('canvas')" 2>/dev/null || die "node cannot load 'canvas'.
    Install it once with:  mkdir -p ~/bt && cd ~/bt && npm install canvas"

mkdir -p "$WORK" "$SHOTS"
rm -f "$SHOTS"/*.png

# ---- 1. encode + render to the JPEG the firmware will accept -----------------
say "  [1/4] encoding and rendering to JPEG ..."
cat > "$WORK/encode.cjs" <<'ENCEOF'
const fs = require('fs');
const { createCanvas } = require('canvas');
global.window = {}; global.document = { createElement: () => createCanvas(600, 600) };
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
require(process.env.CODEC);
const b = window.bcomb;
const MSG = process.env.MSG, W = 380, H = 520;
const frames = b.framesFor(MSG);
const cv = createCanvas(W, H), g = cv.getContext('2d');
g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
const comb = createCanvas(W, W);
b.draw(comb.getContext('2d'), W, frames[0]);
g.drawImage(comb, 0, Math.round((H - W) / 2));
const jpg = cv.toBuffer('image/jpeg', { quality: 0.9 });
fs.writeFileSync(process.env.WORK + '/frame.jpg', jpg);
console.log('        ' + Buffer.byteLength(MSG) + ' B -> ' + frames.length +
            ' frames -> JPEG ' + jpg.length + ' B (device limit 65536)');
ENCEOF
CODEC="$CODEC" MSG="$MSG" WORK="$WORK" node "$WORK/encode.cjs"

# ---- 2. render it on the device framebuffer ---------------------------------
say "  [2/4] painting on the T3W1 framebuffer ..."
cat > "$WORK/paint.py" <<PYEOF
import sys
sys.path.insert(0, ".")
import trezorui, trezorui_api
jpg = open("$WORK/frame.jpg", "rb").read()
if not trezorui_api.check_homescreen_format(jpg):
    raise SystemExit("        firmware REFUSED the image (format/size/mcu_height)")
print("        check_homescreen_format: True  <- the device's own gate")
d = trezorui.Display()
d.record_start(b"$SHOTS", 0)
lay = trezorui_api.confirm_homescreen(title="bLighTnetWorK", image=jpg)
lay.attach_timer_fn(lambda t, dur: None, None)
lay.request_complete_repaint()
print("        painted:", lay.paint(), "at", d.WIDTH, "x", d.HEIGHT)
d.record_stop()
PYEOF
( cd "$FW/core/src" && timeout 90 "$EMU" -X heapsize=20M "$WORK/paint.py" ) \
  || die "the emulator did not complete — see the output above"

PNG=$(ls "$SHOTS"/*.png 2>/dev/null | head -1)
[ -n "$PNG" ] || die "the emulator painted but wrote no PNG to $SHOTS"
say "  [3/4] captured $(basename "$PNG")"

# ---- 4. decode the capture and compare bytes --------------------------------
say "  [4/4] decoding the capture ..."
cat > "$WORK/decode.cjs" <<'DECEOF'
const { createCanvas, loadImage } = require('canvas');
global.window = {}; global.document = { createElement: () => createCanvas(600, 600) };
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
require(process.env.CODEC);
const b = window.bcomb;
(async () => {
  const img = await loadImage(process.env.PNG);
  const cv = createCanvas(img.width, img.height), g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const r = b.inspect(g.getImageData(0, 0, img.width, img.height));
  console.log('        capture ' + img.width + 'x' + img.height +
              '   stage=' + r.stage +
              (r.finder ? '   cell=' + r.finder.size.toFixed(1) + 'px' : ''));
  if (!r.ok) { console.log('        ' + r.hint); process.exit(1); }
  const got = r.frame, want = b.unpackFrame(b.framesFor(process.env.MSG)[0]);
  const same = JSON.stringify(got) === JSON.stringify(want);
  console.log('        frame ' + (got.index + 1) + '/' + got.total);
  console.log('        read     [' + got.bytes.join(', ') + ']');
  console.log('        encoded  [' + want.bytes.join(', ') + ']');
  console.log('');
  console.log(same ? '  ==> BYTE-IDENTICAL. The device rendered it and the decoder read it back.'
                   : '  ==> MISMATCH. The bytes differ — report this.');
  process.exit(same ? 0 : 1);
})();
DECEOF
CODEC="$CODEC" MSG="$MSG" PNG="$PNG" node "$WORK/decode.cjs"

say ""
say "  the captured screen: $PNG"
say ""
