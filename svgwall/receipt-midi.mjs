// receipt-midi.mjs — TWO DIFFERENT SEEDS, both channels, against the LIVE URL:
//   per seed: a screen-capture video of the performance (play pressed by the
//   script, ~8s) + the SAME score rendered offline to WAV by the page's own
//   synth code (OfflineAudioContext). no ffmpeg on this box, so video and WAV
//   are siblings — exactly like the channels they carry.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const LIVE = "https://skaists.dev/surfaces/blight/midi.html";
const OUT = "docs/midi-receipt";
mkdirSync(OUT, { recursive: true });
const SEEDS = [
	{ seed: "91986401", name: "holderA" },
	{ seed: "13179325", name: "holderB" },
];
const wavEncoder = `
async (seed) => {
  const P = buildPattern(Number(seed));
  const secs = 8, sr = 44100;
  const oc = new OfflineAudioContext(2, secs * sr, sr);
  const v = makeVoicing(oc);
  v.delay.delayTime.value = P.delayBeats * P.beatDur;
  const total = Math.floor(secs / P.stepDur);
  for (let gs = 0; gs < total; gs++) scheduleStep(oc, v.input, P, gs, 0.05 + gs * P.stepDur, v.delay);
  const buf = await oc.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const n = buf.length, bytes = new Uint8Array(44 + n * 4);
  const dv = new DataView(bytes.buffer);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + n * 4, true); ws(8, "WAVEfmt "); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  ws(36, "data"); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let rms = 0; for (let i = 0; i < n; i++) rms += L[i] * L[i];
  window.__wavChunks = [];
  for (let o = 0; o < bytes.length; o += 0x8000) window.__wavChunks.push(btoa(String.fromCharCode(...bytes.subarray(o, o + 0x8000))));
  return { chunks: window.__wavChunks.length, rms: Math.sqrt(rms / n), mode: P.mode.n, bpm: P.bpm, root: P.root };
}`;

const browser = await chromium.launch();
for (const { seed, name } of SEEDS) {
	const context = await browser.newContext({ recordVideo: { dir: OUT, size: { width: 560, height: 900 } } });
	const page = await context.newPage();
	const errs = [];
	page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
	await page.goto(LIVE, { waitUntil: "load" });
	await page.fill("#in", seed);
	await page.click("#read");
	await page.waitForFunction(() => document.getElementById("st-seed").textContent.includes("· typed"), null, { timeout: 30000 });
	await page.waitForTimeout(800);
	await page.click("#voice"); // the only thing that ever starts sound
	await page.waitForTimeout(8000);
	const audio = await page.evaluate(`(${wavEncoder})(${seed})`);
	const parts = [];
	for (let i = 0; i < audio.chunks; i++) parts.push(Buffer.from(await page.evaluate((k) => window.__wavChunks[k], i), "base64"));
	const wavBuf = Buffer.concat(parts); // per-chunk decode: each chunk's btoa padding is its own, never mid-string
	console.error(`[diag] seed ${seed}: chunks=${audio.chunks} wavBuf=${wavBuf.length}`);
	writeFileSync(`${OUT}/${name}-seed${seed}.wav`, wavBuf);
	await page.click("#voice").catch(() => {});
	await page.waitForTimeout(600);
	const video = page.video();
	await context.close();
	const vidPath = await video.path();
	console.log(JSON.stringify({
		seed, name,
		mode: audio.mode, bpm: audio.bpm, root: audio.root,
		wavRMS: +audio.rms.toFixed(4),
		wavSha256: createHash("sha256").update(wavBuf).digest("hex").slice(0, 16),
		wavBytes: wavBuf.length,
		videoPath: vidPath,
		errors: errs.length ? errs : "none",
	}));
}
await browser.close();
