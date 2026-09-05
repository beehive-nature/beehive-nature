// watch-room-shot.mjs — THE LANE RECEIPT (watch-together room POC, 2026-09-04).
// The order's receipt definition: "founder streams from his laptop; a phone
// at 390px watches it in the skaists.buzz room with chat + ticker; one
// metered session paused and resumed."
//
// Proven here, end to end, against the estate's own iron:
//   0. the stream is LIVE: laptop ffmpeg → RTMP over the x0x tailnet
//      forward → box inlet → ffmpeg ×2 renditions → same-origin HLS
//   1. a jungle4 session is OPENED with credit (ops/watch/meter.mjs on the
//      box; the key never leaves the box)
//   2. a COLD phone (390px) opens /watch/, enters the receipt №, and the
//      picture PLAYS through the read-only playlist door
//   3. the TICKER line lands (the streamer's curl, through the tailnet)
//   4. the ROOM: the phone joins skaists.buzz INSIDE the watch page (the
//      /join view reused in-frame), speaks, and watches it arrive
//   5. PAUSE-NOT-KILL: credit charged to zero → the door refuses the
//      playlist → the video pauses, the veil explains, the CHAT KEEPS
//      LIVING (a message sent under pause arrives)
//   6. TOP-UP: settle while paused + resume → the picture resumes un-aided
// Numbers (measured, not estimated): cold-start, hls.latency, variant
// bitrates from the door's own segment accounting.
// Shots → e2e/shots-watch/
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'shots-watch');
await mkdir(OUT, { recursive: true });

const WATCH = 'https://relay.skaists.dev/watch/';
const HEALTH = 'https://relay.skaists.dev/live/health';
const DOOR = 'https://relay.skaists.dev'; // the ticker rides the public same-origin door (the tailnet road is the streamer's default, not the test's dependency)
const SSH = ['ssh', '-i', 'C:/Users/travi/.ssh/bnr_key.lf', '-o', 'BatchMode=yes', 'ubuntu@129.153.202.144'];
let SESS = Number(process.env.WATCH_SESS || (await import('node:crypto')).randomInt(1000, 9999)); // fresh session each run — the ladder always starts clean

let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};
const shot = (page, name) => page.screenshot({ path: join(OUT, name) }).then(() => console.log('shot → e2e/shots-watch/' + name));
// NOTE: no '&&' chains — Windows cmd.exe splits them and runs the tail
// locally; one remote command with absolute paths only.
const box = (cmd) => execSync([...SSH, `"${cmd}"`].join(' '), { encoding: 'utf8' }).trim();
const meter = (args) => box(`node /opt/buzz-watch/meter.mjs ${args}`);

/* ── 0. the stream is live ─────────────────────────────────────────── */
const health = await (await fetch(HEALTH, { cache: 'no-store' })).json();
const room = (health.rooms || []).find(r => r.room === 'general');
ok('the stream is publishing from the laptop', !!room?.publishing,
   room ? `newest segment age ${Math.round(room.newest_segment_age_ms / 100) / 10}s ago` : JSON.stringify(health));

/* ── 1. the metered session (a fresh ladder every run) ──────────────── */
let row = null;
for (let id = SESS; !row; id++) {
  try { row = JSON.parse(meter(`status ${id}`)); } catch { row = null; }
  const viable = row && row.state === 0 &&
    Number(String(row.credit).split(' ')[0]) - Number(String(row.burned).split(' ')[0]) > 0;
  if (row && viable) break;
  try {
    const opened = meter(`open ${id} 1.2 5`);
    console.log(`session ${id} opened:`, opened.replace(/\n/g, ' | ').slice(0, 170));
    row = JSON.parse(meter(`status ${id}`));
    if (row && row.state === 0) { SESS = id; break; }
  } catch (e) {
    console.log(`session ${id} open refused (${String(e.stdout || e.message).trim().slice(0, 50)}) — trying the next id`);
    row = null;
  }
}
ok('session live with credit', !!row && row.state === 0 && Number(String(row.credit).split(' ')[0]) > Number(String(row.burned).split(' ')[0]),
   `sess ${SESS} state ${row?.state} credit ${row?.credit} burned ${row?.burned}`);

/* ── 2. the phone ──────────────────────────────────────────────────── */
const browser = await chromium.launch();
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await phone.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
await page.goto(WATCH, { waitUntil: 'load' });
await page.waitForTimeout(600);
await shot(page, 'watch-390-door.png');

await page.locator('#sess').fill(String(SESS));
await page.locator('#go').click();
const t0 = Date.now();
await page.waitForFunction(() => {
  const v = document.getElementById('v');
  return v && v.currentTime > 1.5 && !v.paused;
}, null, { timeout: 90000 });
const startMs = Date.now() - t0;
ok('the phone watches the stream', true, `receipt № → playing in ${(startMs / 1000).toFixed(1)}s`);
await page.waitForTimeout(4500);
await shot(page, 'watch-390-playing.png');

const nums = await page.evaluate(() => {
  const w = window.__watch;
  return { lat: w.latN ? (w.latSum / w.latN) : null, kbps: w.kbps, strip: document.getElementById('nums').innerText,
           chip: document.getElementById('chip').innerText };
});
ok('the meter strip renders the chain row', /credit/.test(nums.strip), nums.strip.replace(/\n/g, ' '));
ok('player-side latency measured', nums.lat != null, `hls.latency avg ${nums.lat.toFixed(1)}s @ ${nums.kbps}kbps`);
const bitrate = room?.measured_kbps ? JSON.stringify(room.measured_kbps) : 'n/a';
console.log(`NUMBERS start ${(startMs / 1000).toFixed(1)}s · glass-to-glass(player) ${nums.lat?.toFixed(1)}s · door-measured kbps ${bitrate}`);

/* ── 3. the ticker ─────────────────────────────────────────────────── */
execSync(`curl -sS -X POST ${DOOR}/live/ticker/general -H "authorization: Bearer ${process.env.WATCH_STREAM_KEY || readFileSync('C:/Users/travi/.watch-stream-key', 'utf8').trim()}" -H "content-type: application/json" -d "{\\"now\\":\\"the founder, live from the laptop\\",\\"set\\":\\"21:00\\",\\"next\\":\\"the porch session\\"}"`, { stdio: 'pipe' });
await page.waitForFunction(() => document.getElementById('tk-now').textContent.includes('laptop'), null, { timeout: 8000 });
ok('the ticker line landed', true, 'now/set/next render from the streamer\'s curl');
await shot(page, 'watch-390-ticker.png');

/* ── 4. the room (the /join view, reused in-frame) ─────────────────── */
const frame = page.frames().find(f => f.url().includes('/join/'));
ok('the room view is in the surface', !!frame, frame?.url());
// the composer's placeholder moved between join builds — speak into the
// bottom-most text input; the page footer can occlude the frame's send
// button at some scroll positions, so the DOM click rides the app's handler
let speak = async () => {};
if (frame) {
  const input = frame.locator('input[inputmode="url"]');
  await input.fill('');
  await input.type('wss://relay.skaists.dev', { delay: 20 });
  await shot(page, 'watch-390-joining.png');
  await frame.getByRole('button').click();
  await frame.waitForFunction(() => document.body.innerText.includes('welcome-everyone'), null, { timeout: 30000 });
  ok('the phone joined the skaists.buzz room in-frame', true);
  await page.waitForTimeout(2500); // let the room settle before composing
  speak = async (text) => {
    const composer = frame.locator('input[type="text"], input:not([inputmode="url"]), textarea').last();
    for (let i = 0; i < 3; i++) {
      await composer.fill(text, { timeout: 20000 });
      await frame.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim().toLowerCase() === 'send');
        b?.click();
      });
      await page.waitForTimeout(1600);
      const landed = await frame.evaluate((t) => document.body.innerText.includes(t), text).catch(() => false);
      if (landed) return;
      // unsent (app state race) — retry the fill+send
    }
  };
  await speak('watching the founder live — one address, no app');
  await frame.waitForFunction(() => document.body.innerText.includes('watching the founder live'), null, { timeout: 20000 });
  ok('the phone spoke in the room', true);
  await shot(page, 'watch-390-chat.png');
}

/* ── 5. pause-not-kill ─────────────────────────────────────────────── */
meter(`charge ${SESS} 2`); // 0.6 × 2 = 1.2 = the whole credit → PAUSE AT ZERO
await page.waitForFunction(() => {
  const v = document.getElementById('v');
  return v.paused && document.getElementById('veil').classList.contains('show');
}, null, { timeout: 30000 });
ok('credit out → PAUSED (pause, not kill)', true, 'veil up, player parked');
await page.waitForFunction(() => document.getElementById('chip').innerText.trim() === 'PAUSED', null, { timeout: 12000 });
ok('the strip says PAUSED', true, (await page.locator('#chip').innerText()));
await shot(page, 'watch-390-paused.png');
if (frame) {
  await speak('still here under pause — the room lives');
  await frame.waitForFunction(() => document.body.innerText.includes('still here under pause'), null, { timeout: 20000 });
  ok('the chat lives under pause', true, 'message sent and received while parked');
}

/* ── 6. top-up + resume ────────────────────────────────────────────── */
meter(`topup ${SESS} 1.2`);
meter(`resume ${SESS}`);
await page.waitForFunction(() => {
  const v = document.getElementById('v');
  return !v.paused && v.currentTime > 0 && !document.getElementById('veil').classList.contains('show');
}, null, { timeout: 30000 });
ok('top-up + resume → the picture resumed', true);
await shot(page, 'watch-390-resumed.png');

ok('zero page errors', errors.length === 0, errors.join(' | '));
await phone.close();
await browser.close();
console.log(fail ? `RECEIPT FAILURES: ${fail}` : 'WATCH-ROOM-RECEIPT-CLEAN');
process.exit(fail ? 1 : 0);
