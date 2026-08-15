const { createCanvas, loadImage } = require("canvas");
global.window = {}; global.document = { createElement: () => createCanvas(600,600) };
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
require("/mnt/c/Users/travi/beehive-nature/surfaces/blight/bcomb.js");
const b = window.bcomb;
const PAYLOAD = "bLighTnetWorK on a Trezor screen";
(async () => {
  const img = await loadImage(process.env.HOME + "/shots/refresh00-00000000.png");
  console.log("captured PNG: " + img.width + "x" + img.height);
  const cv = createCanvas(img.width, img.height), g = cv.getContext("2d");
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, img.width, img.height);
  const r = b.inspect(data);
  console.log("decode stage : " + r.stage + (r.finder ? "  cell=" + r.finder.size.toFixed(1) + "px" : ""));
  if (!r.ok) { console.log("HINT: " + r.hint); process.exit(1); }
  const fr = r.frame;
  console.log("frame        : " + (fr.index+1) + "/" + fr.total);
  const expect = b.unpackFrame(b.framesFor(PAYLOAD)[0]);
  const same = JSON.stringify(fr) === JSON.stringify(expect);
  console.log("bytes        : [" + fr.bytes.join(", ") + "]");
  console.log("expected     : [" + expect.bytes.join(", ") + "]");
  console.log("\nBYTE-IDENTICAL TO WHAT WAS ENCODED: " + (same ? "YES" : "NO"));
})();
