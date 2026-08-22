// huddle-local.mjs — THE LIVEKIT LOCAL-VENUE RECEIPT (NAV SWEEP + LIVEKIT GO, task 2).
// Proves the seam end-to-end: two independent browser contexts join a real livekit-server
// (dev mode, WSL) and converge on one shared composition over the data channel.
// Not a standing gate (needs the local venue running); run manually:
//   wsl -e bash -lc '~/livekit-server --dev --bind 0.0.0.0 & '   # or docs/runbooks/huddle-venue.sh
//   node e2e/huddle-local.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const VENUE = process.env.HUDDLE_VENUE || 'ws://localhost:7880';
const ROOM = 'forge-receipt-' + Date.now().toString(36);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };

// dev-mode venue token: livekit-server --dev accepts HS256 JWTs signed with 'secret',
// issuer 'devkey' — well-known public defaults, TESTNET-grade, local only.
function devToken(identity) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iss: 'devkey', sub: identity, name: identity, exp: Math.floor(Date.now() / 1000) + 3600, video: { roomJoin: true, room: ROOM } });
  const sig = createHmac('sha256', 'secret').update(head + '.' + body).digest('base64url');
  return head + '.' + body + '.' + sig;
}

const server = createServer(async (req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  const f = existsSync(p) && !p.endsWith('/') ? p : join(p, 'index.html');
  try {
    const data = await readFile(f);
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); cond ? pass++ : fail++; };

const browser = await chromium.launch();
const url = `http://127.0.0.1:${PORT}/surfaces/forge/huddle.html`;
const mkPage = async name => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  [' + name + '] pageerror: ' + String(e).slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [' + name + '] ' + m.type() + ': ' + m.text().slice(0, 140)); });
  await page.goto(`${url}?url=${encodeURIComponent(VENUE)}&token=${encodeURIComponent(devToken(name))}&room=${ROOM}&name=${name}&autostart=1`);
  return { ctx, page };
};

try {
  const A = await mkPage('founder-tab');
  const B = await mkPage('agent-tab');
  // Wait for both to be IN the room (stage unhidden = connected + rendered).
  await A.page.waitForSelector('#stage-wrap:not(.hidden)', { timeout: 30000 });
  ok('participant A joined the venue and rendered', true);
  await B.page.waitForSelector('#stage-wrap:not(.hidden)', { timeout: 30000 });
  ok('participant B joined the venue and rendered', true);

  // The roster shows each other (real presence, not a heartbeat trick).
  await A.page.waitForFunction(() => document.getElementById('peers').textContent.includes('agent-tab'), null, { timeout: 15000 });
  ok('A sees B in the huddle roster', true);
  await B.page.waitForFunction(() => document.getElementById('peers').textContent.includes('founder-tab'), null, { timeout: 15000 });
  ok('B sees A in the huddle roster', true);

  // THE CONVERGENCE: A rolls a seed; B's field re-derives from it across the venue.
  const PROBE_SEED = 'converged-' + Date.now().toString(36);
  await A.page.fill('#seed', PROBE_SEED);
  await A.page.dispatchEvent('#seed', 'change');
  await A.page.waitForTimeout(2500);
  const hkA = await A.page.evaluate(() => window.__hk);
  const hkB = await B.page.evaluate(() => window.__hk);
  console.log('  telemetry A:', JSON.stringify(hkA), ' B:', JSON.stringify(hkB));
  await B.page.waitForFunction(s => document.getElementById('meta').textContent.includes(s), PROBE_SEED, { timeout: 15000 });
  ok('seed set on A reached B over the LiveKit data channel', true, 'seed=' + PROBE_SEED);

  // And a knob: A turns density; B's state carries it.
  await A.page.fill('#pDensity', '17');
  await A.page.dispatchEvent('#pDensity', 'input');
  await B.page.waitForFunction(() => document.getElementById('meta').textContent.length > 0, null, { timeout: 15000 });
  // Canvas painted on both sides (non-blank): sample some pixels.
  for (const [nm, pg] of [['A', A.page], ['B', B.page]]) {
    const painted = await pg.evaluate(() => {
      const c = document.getElementById('stage');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] !== 0) n++;
      return n > 20;
    });
    ok(nm + "'s canvas painted", painted);
  }
  await A.ctx.close(); await B.ctx.close();
} catch (e) {
  console.log('ERROR: ' + String(e).slice(0, 300));
  fail++;
}
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
