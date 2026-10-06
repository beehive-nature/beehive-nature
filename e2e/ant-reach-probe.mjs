// ant-reach-probe.mjs — one run of the Autonomi WebRTC Direct reachability experiment.
// Opens the LIVE bViEw page in Chromium on whatever network this machine is on, plays a public
// video on the direct-only route (no relay), waits, then saves the page's own reach() export:
// each dialled endpoint as a SHA-256 of "ip:port" with every attempt's furthest step. Run it on
// two independent networks at about the same time and compare with scripts/ant-reach-compare.mjs.
// Read-only: a public read, no key, no wallet, no payment.
// Run: node ant-reach-probe.mjs --label laptop --out reach-laptop.json [--seconds 120]
//        [--address <64 hex>] [--url https://skaists.dev/surfaces/bview.html]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg('url', 'https://skaists.dev/surfaces/bview.html');
// try_autonomi.mp4, 214,091,829 bytes (surfaces/bdata-stored-bux-try-autonomi.json)
const address = arg('address', '7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78'); // PUBLIC-CONSTANT: public DataMap address of a published video
const seconds = Number(arg('seconds', '120'));
const label = arg('label', 'unlabelled');
const out = arg('out', `reach-${label}.json`);
if (!/^[0-9a-f]{64}$/.test(address)) throw new Error('address must be 64 hex');

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { localStorage.setItem('bnr.bview.route', 'direct-only'); localStorage.setItem('bregister', 'cypherpunk'); });
  const page = await ctx.newPage();
  await page.goto(`${url}?reach=${Date.now()}#${address}`);
  await page.waitForFunction(() => window.__antTransport && window.__antTransport.reach, null, { timeout: 30000 });
  const startedAt = new Date().toISOString();
  await page.waitForTimeout(seconds * 1000);
  const r = await page.evaluate(l => window.__antTransport.reach(l), label);
  r.startedAt = startedAt; r.seconds = seconds; r.page = url;
  await writeFile(out, JSON.stringify(r, null, 1) + '\n');
  const s = r.summary;
  console.log(`${label}: ${s.dials} dials · ${s.opened} opened · ${s.dead} dead · ${s.waiting} waiting · ` +
    `${s.endpointsReachable}/${s.endpointsReachable + s.endpointsUnreachable} settled endpoints reachable · ` +
    `dead: ${s.deadAt.dial} never ICE-connected, ${s.deadAt.ice} ICE no DTLS, ${s.deadAt.dtls} DTLS no channel → ${out}`);
} finally {
  await browser.close();
}
