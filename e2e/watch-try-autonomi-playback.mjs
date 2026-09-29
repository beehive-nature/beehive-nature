// W@tch media-object playback verification — original bytes, no transcode.
// Serves WATCH_FILE over a local Range-capable HTTP server and proves a real
// browser (chromium, 390px) decodes and plays it: clock advance, decoded frame
// counts, play-to-end at the tail, zero page/video errors. Prints one JSON
// receipt line; exit 0 only if every assertion holds.
//
//   WATCH_FILE=/path/to/video.mp4 node e2e/watch-try-autonomi-playback.mjs
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const WATCH_FILE = process.env.WATCH_FILE;
if (!WATCH_FILE) {
  console.error('WATCH_FILE env is required (absolute path to the original MP4)');
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'shots-watch-try-autonomi');

const fstat = await stat(WATCH_FILE);
const total = fstat.size;

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<title>W@tch playback verification</title>
<style>body{margin:0;background:#111;color:#eee;font:13px system-ui}video{width:390px;display:block}</style>
<video id=v controls preload="auto" playsinline src="/v.mp4"></video>
<div id=stat>boot</div>
<script>
window.__vlog = [];
const v = document.getElementById('v');
for (const ev of ['error','stalled','waiting','suspend','abort','emptied']) {
  v.addEventListener(ev, () => window.__vlog.push(ev + '@' + v.currentTime.toFixed(2)));
  window.addEventListener('error', e => window.__vlog.push('window-error:' + (e.message || 'unknown')), true);
}
</script>`);
    return;
  }
  if (req.url === '/v.mp4' || req.url.startsWith('/v.mp4?')) {
    const range = req.headers.range;
    let start = 0, end = total - 1, status = 200;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) { res.writeHead(416); res.end(); return; }
      if (m[1] === '' && m[2] !== '') {           // suffix: last N bytes
        start = Math.max(0, total - Number(m[2]));
      } else {
        start = m[1] === '' ? 0 : Number(m[1]);
        end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
      }
      status = 206;
    }
    const headers = {
      'content-type': 'video/mp4',
      'accept-ranges': 'bytes',
      'content-length': String(end - start + 1),
    };
    if (status === 206) headers['content-range'] = `bytes ${start}-${end}/${total}`;
    res.writeHead(status, headers);
    createReadStream(WATCH_FILE, { start, end }).pipe(res);
    return;
  }
  res.writeHead(404); res.end('no');
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('pageerror', e => consoleErrors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const receipt = { file: WATCH_FILE.split(/[\\/]/).pop(), bytes: total, port, samples: [], tail: null, errors: null };
let exit = 0;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const v = document.getElementById('v');
    return v && v.readyState >= 3;
  }, null, { timeout: 60000 });

  const meta = await page.evaluate(() => {
    const v = document.getElementById('v');
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
  });
  receipt.meta = meta;

  // muted autoplay is the automation-safe path; the AUDIO CODEC itself is
  // receipted by ffprobe — this harness proves the video decode clock.
  await page.evaluate(() => { const v = document.getElementById('v'); v.muted = true; v.play(); });
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    receipt.samples.push(await page.evaluate(() => {
      const v = document.getElementById('v');
      const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
      return { t: +v.currentTime.toFixed(3), paused: v.paused, readyState: v.readyState,
               frames: q.totalVideoFrames ?? null, dropped: q.droppedVideoFrames ?? null };
    }));
    if (i === 1) await page.screenshot({ path: join(shots, 'play-2s-390.png') });
    if (i === 6) await page.screenshot({ path: join(shots, 'play-7s-390.png') });
  }

  // tail: seek near the end and play to 'ended' — exercises range requests
  // and decode at the file's tail, not just the buffered head.
  await page.evaluate(() => { const v = document.getElementById('v'); v.currentTime = 50; });
  await page.waitForFunction(() => document.getElementById('v').readyState >= 2, null, { timeout: 30000 });
  await page.evaluate(() => document.getElementById('v').play());
  await page.waitForFunction(() => document.getElementById('v').ended, null, { timeout: 30000 })
    .catch(() => {});
  await page.screenshot({ path: join(shots, 'play-ended-390.png') });
  receipt.tail = await page.evaluate(() => {
    const v = document.getElementById('v');
    const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
    return { ended: v.ended, t: +v.currentTime.toFixed(3), frames: q.totalVideoFrames ?? null };
  });

  receipt.errors = await page.evaluate(() => window.__vlog);
  receipt.consoleErrors = consoleErrors;

  const first = receipt.samples[0], last = receipt.samples[receipt.samples.length - 1];
  const advanced = last.t - first.t;
  const checks = {
    dimensions: meta.w === 3318 && meta.h === 2132,
    duration: Math.abs(meta.duration - 52.488) < 0.1,
    advanced_8s_wall: advanced >= 6,
    frames_decoded: (last.frames ?? 0) > 200,
    played_to_end: receipt.tail.ended === true,
    no_video_events: receipt.errors.filter(e => e.startsWith('error')).length === 0,
    no_console_errors: consoleErrors.length === 0,
  };
  receipt.checks = checks;
  receipt.verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  if (receipt.verdict !== 'PASS') exit = 1;
  console.log(JSON.stringify(receipt, null, 1));
} catch (e) {
  receipt.fatal = String(e);
  receipt.consoleErrors = consoleErrors;
  console.log(JSON.stringify(receipt, null, 1));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.close();
}
process.exit(exit);
