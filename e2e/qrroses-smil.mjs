// qrroses-smil.mjs — LANE D GATE: the two-decoder SMIL frame proof.
//
// THE PILOT LAW UNDER TEST: every sampled frame of the animated SVG reads
// back the EXACT payload in BOTH oracles. Frames are sampled on the page's
// own SMIL clock via svg.setCurrentTime(t) — deterministic, the same t always
// renders the same frame. Also proves: SMIL actually advances on its own,
// reduced-motion yields a paused still that decodes, and a 390px phone-width
// frame (dpr 2) decodes. Rasterization is the real renderer (element
// screenshot), which is exactly what a camera would see.
//
// Oracles: jsQR (Apache-2.0) and zxing-js/library (MIT) — decoder-only,
// machine-resolved the same way design-acceptance resolves playwright.
//
//   node e2e/qrroses-smil.mjs [--live https://skaists.dev]
//
// Without --live, serves the repo root over localhost http.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import * as ZXing from '@zxing/library';
import { PNG } from 'pngjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'surfaces/blight/qrroses-smil.html';
const LIVE = process.argv.includes('--live') ? process.argv[process.argv.indexOf('--live') + 1] : null;

const TIMES = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6, 6.4, 6.6, 7.0, 8.5, 10, 12, 15, 20, 30, 45, 60, 90, 120, 180, 240];

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  cond ? pass++ : fail++;
};

function decodeBoth(buf) {
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  const jsqrRes = jsQR(new Uint8ClampedArray(data), w, h);
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0; i < lum.length; i++) {
    const j = i * 4;
    lum[i] = (data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000;
  }
  // RGBLuminanceSource(lum, w, h) — the arg order burned the qrtree lane once
  const src = new ZXing.RGBLuminanceSource(lum, w, h);
  const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src));
  const reader = new ZXing.MultiFormatReader();
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  let zxRes = null;
  try { const res = reader.decode(bitmap); zxRes = res ? res.getText() : null; } catch (e) { zxRes = null; }
  return [jsqrRes ? jsqrRes.data : null, zxRes];
}

async function serveRoot() {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  const srv = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'content-type': MIME[(rel.match(/\.[a-z0-9]+$/)||[])[0]] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}

const { srv, base } = LIVE ? { srv: null, base: LIVE.replace(/\/$/, '') } : await serveRoot();
const url = `${base}/${PAGE}`;
console.log(`\n### qrroses-smil frame gate · ${url}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(500);

const payload = await page.evaluate(() => window.__qrrosesSMIL && window.__qrrosesSMIL.url);
ok('payload planted', !!payload, String(payload).slice(0, 60));

// SMIL must actually run on its own clock
const t1 = await page.evaluate(() => document.getElementById('qrs').getCurrentTime());
await page.waitForTimeout(800);
const t2 = await page.evaluate(() => document.getElementById('qrs').getCurrentTime());
ok('SMIL advances on its own', t2 > t1, `currentTime ${t1.toFixed(2)}s -> ${t2.toFixed(2)}s`);

// the plate group carries zero animation children (not one module moves)
const animInPlate = await page.evaluate(() => document.querySelectorAll('#plate animate, #plate set, #plate animateMotion, #plate animateTransform').length);
ok('plate group is animation-free', animInPlate === 0, `${animInPlate} animation children`);

// THE FRAME GATE — every sampled frame, both oracles, exact payload
let frames = 0, frameFails = [];
for (const t of TIMES) {
  await page.evaluate(tt => document.getElementById('qrs').setCurrentTime(tt), t);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await page.locator('#qrs').screenshot();
  const [a, z] = decodeBoth(buf);
  if (a === payload && z === payload) frames++;
  else frameFails.push(`t=${t}s jsQR=${a === payload ? 'ok' : JSON.stringify(a && a.slice(0, 24))} zxing=${z === payload ? 'ok' : JSON.stringify(z && z.slice(0, 24))}`);
}
ok(`every frame decodes (${TIMES.length} frames, growth through 4 minutes of forage)`, frames === TIMES.length, frameFails.join(' | ') || `${frames}/${TIMES.length} exact-payload in BOTH oracles`);

await browser.close();

// reduced motion — a paused still that decodes
const b2 = await chromium.launch();
const ctx2 = await b2.newContext({ viewport: { width: 1280, height: 940 }, reducedMotion: 'reduce' });
const p2 = await ctx2.newPage();
await p2.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await p2.waitForTimeout(600);
const paused = await p2.evaluate(() => document.getElementById('qrs').animationsPaused());
const stillCt = await p2.evaluate(() => document.getElementById('qrs').getCurrentTime());
const buf2 = await p2.locator('#qrs').screenshot();
const [ra, rz] = decodeBoth(buf2);
ok('reduced-motion: SMIL paused', paused === true, `clock held at ${stillCt.toFixed(2)}s`);
ok('reduced-motion: still frame decodes in both oracles', ra === payload && rz === payload, `jsQR ${ra === payload ? 'ok' : 'FAIL'} · zxing ${rz === payload ? 'ok' : 'FAIL'}`);
await b2.close();

// phone width — 390 css px at dpr 2, mid-forage frame
const b3 = await chromium.launch();
const ctx3 = await b3.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p3 = await ctx3.newPage();
await p3.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await p3.waitForTimeout(400);
await p3.evaluate(() => document.getElementById('qrs').setCurrentTime(12));
await p3.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const buf3 = await p3.locator('#qrs').screenshot();
const [ma, mz] = decodeBoth(buf3);
ok('390px @dpr2 mid-forage frame decodes', ma === payload && mz === payload, `jsQR ${ma === payload ? 'ok' : 'FAIL'} · zxing ${mz === payload ? 'ok' : 'FAIL'}`);
await b3.close();

if (srv) srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
