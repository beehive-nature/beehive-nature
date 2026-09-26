// bview-prebuffer-shot.mjs — the 390 px before/after receipt for the time-based prebuffer lane
// (docs/dispatches/2026-09-26-bview-time-prebuffer.md). Not a CI gate: e2e/bview.test.mjs is.
//
// One large moov-first MP4 is served through a MOCKED ant door (/stream, honest Content-Length),
// paced in the page at a fixed fraction of the file's own bitrate (default 0.5 = the network is
// half as fast as the video plays, which is how an 8K file meets a real door). The real relay is
// touched zero times. The page under test is any bview.html (the old one from git, or the tree's).
//
// The fixture is NOT committed (30 MB). Make it with any ffmpeg that has libvpx-vp9 + libopus:
//   ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=30,noise=alls=60:allf=t" \
//     -f lavfi -i "sine=frequency=330:sample_rate=48000" -t 30 \
//     -c:v libvpx-vp9 -b:v 8000k -minrate 8000k -maxrate 8000k -g 30 -deadline realtime -cpu-used 8 \
//     -c:a libopus -b:a 64k -movflags +faststart big30.mp4
// VP9 because Playwright's Chromium ships without H.264; the page logic is codec-blind.
//
// Run:  git show HEAD~1:surfaces/bview.html > /tmp/old-bview.html
//       node e2e/bview-prebuffer-shot.mjs --page /tmp/old-bview.html --fixture big30.mp4 --out shots --label before
//       node e2e/bview-prebuffer-shot.mjs --page surfaces/bview.html --fixture big30.mp4 --out shots --label after
// Writes <out>/<label>-<t>s.png at each --at second (default 12,48) and <out>/<label>-timeline.json,
// sampled once a second until --until (default: the last --at + 1).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PAGE = resolve(arg('page', join(SURF, 'bview.html')));
const FIX = await readFile(resolve(arg('fixture', 'big30.mp4')));
const OUT = resolve(arg('out', 'shots'));
const LABEL = arg('label', 'shot');
const REG = arg('reg', '');   // bee | raver | cypherpunk (register.js reads localStorage 'bregister')
const AT = arg('at', '12,48').split(',').map(Number);
const FRACTION = +arg('rate', '0.5');
const UNTIL = +arg('until', String(Math.max(...AT) + 1));
const PORT = 8874, ORIGIN = `http://127.0.0.1:${PORT}`;
const DOOR = 'https://relay.skaists.dev/ant/v1/data/public/';
const ADDR = 'ef'.repeat(32);

// The file's own bitrate from its moov (mvhd duration) — the pace is a fraction of it.
const u32 = i => FIX.readUInt32BE(i);
let dur = 0;
for (let i = 0; i + 8 <= FIX.length;) {
  const sz = u32(i), t = FIX.toString('latin1', i + 4, i + 8);
  if (t === 'moov') {
    for (let j = i + 8; j + 8 <= i + sz;) {
      const s2 = u32(j);
      if (FIX.toString('latin1', j + 4, j + 8) === 'mvhd') {   // v0: timescale @+20, duration @+24; v1: @+28, 64-bit @+32
        dur = FIX[j + 8] === 1 ? (u32(j + 32) * 2 ** 32 + u32(j + 36)) / u32(j + 28) : u32(j + 24) / u32(j + 20);
        break;
      }
      if (s2 < 8) break; j += s2;
    }
    break;
  }
  if (sz < 8) break; i += sz;
}
if (!(dur > 0)) throw new Error('fixture has no moov duration');
const RATE = FRACTION * FIX.length / dur;          // bytes/s the mock door delivers
const PIECE = 64 << 10, GAP = Math.round(PIECE / RATE * 1000);

const srv = createServer(async (q, s) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
  try {
    const body = rel === 'bview.html' ? await readFile(PAGE) : await readFile(join(SURF, rel));
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : rel.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
    s.writeHead(200, { 'content-type': ct }); s.end(body);
  } catch { s.writeHead(404); s.end(); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN)) return route.continue();
  if (url === DOOR + ADDR + '/stream') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': ORIGIN, 'content-type': 'application/octet-stream', 'content-length': String(FIX.length) }, body: FIX });
  return route.abort('blockedbyclient');
});
if (REG) await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch {} }, REG);
await ctx.addInitScript(([door, piece, gap]) => {
  window.__fed = 0;
  const real = window.fetch;
  window.fetch = async (u, o) => {
    const r = await real(u, o);
    if (!String(u).startsWith(door)) return r;
    const slow = r.body.pipeThrough(new TransformStream({ async transform(c, out) {
      for (let i = 0; i < c.length; i += piece) { await new Promise(z => setTimeout(z, gap)); const x = c.subarray(i, i + piece); window.__fed += x.length; out.enqueue(x); }
    } }));
    return new Response(slow, { status: r.status, headers: new Headers(r.headers) });
  };
}, [DOOR, PIECE, GAP]);
const p = await ctx.newPage();
await p.goto(`${ORIGIN}/surfaces/bview.html`, { waitUntil: 'domcontentloaded' });
await p.fill('#addr', 'autonomi://' + ADDR);
await p.click('button[type=submit]');
await mkdir(OUT, { recursive: true });
const t0 = Date.now(), line = [], stop = Math.max(UNTIL, ...AT);
console.log(`# ${LABEL}: ${(FIX.length / 1048576).toFixed(1)} MB, ${dur.toFixed(1)} s, bitrate ${(FIX.length / dur / 1048576).toFixed(2)} MB/s, door ${(RATE / 1048576).toFixed(2)} MB/s (${FRACTION}x)`);
for (let s = 1; s <= stop; s++) {
  await p.waitForTimeout(t0 + s * 1000 - Date.now());
  const row = await p.evaluate(() => {
    const v = document.getElementById('v'), vis = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
    return {
      fed: +(window.__fed / 1048576).toFixed(1), got: document.getElementById('got').textContent,
      t: +v.currentTime.toFixed(2), paused: v.paused, err: v.error ? v.error.code : 0,
      rows: ['s-slow', 's-wait', 's-rough', 's-fail'].filter(vis).map(id => id + ': ' + document.getElementById(id).textContent.trim()),
    };
  });
  line.push({ s, ...row });
  console.log(`${String(s).padStart(3)} s  fed ${String(row.fed).padStart(5)} MB  video ${String(row.t).padStart(6)} s ${row.paused ? 'paused ' : 'PLAYING'}${row.err ? ' err' + row.err : ''}  ${row.rows.join(' | ')}`);
  if (AT.includes(s)) await p.screenshot({ path: join(OUT, `${LABEL}-${s}s.png`) });
}
const shown = relative(join(HERE, '..'), PAGE);
await writeFile(join(OUT, `${LABEL}-timeline.json`), JSON.stringify({ page: shown.startsWith('..') ? '(outside the tree) ' + basename(PAGE) : shown, bytes: FIX.length, dur, rateBps: Math.round(RATE), samples: line }, null, 1) + '\n');
await b.close(); srv.close();
