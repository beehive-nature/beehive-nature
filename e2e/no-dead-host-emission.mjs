// no-dead-host-emission.mjs — the bounded localhost emission proof (2026-09-13 sweep).
// Serves the repo tree, loads each healed page for 10s in real Chromium, and
// asserts ZERO requests to the NXDOMAIN host reach the network layer. Live-host
// traffic is REPORTED (not asserted — this rig runs seat-side with a real
// network; the CI twin e2e/no-dead-host.test.mjs is the deterministic guard).
// Run:  node e2e/no-dead-host-emission.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const srv = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const b = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const PAGES = [
  'surfaces/bmeshasi.html',
  'surfaces/wallet.html',
  'surfaces/bantfarm.html',
  'surfaces/blight/workbench.html',
  'surfaces/blight/vaulta-reader.html',
  'crates/bmesh-serve/assets/page.html',
];

const { chromium } = await import('playwright');
const browser = await chromium.launch();
let deadTotal = 0;
for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const dead = [], live = new Set(), liveOk = [];
  page.on('request', r => {
    const u = r.url();
    if (u.includes('api.eosn.io')) dead.push(u);
    else if (u.includes('eos.api.eosnation.io') || u.includes('eos.greymass.com')) live.add(new URL(u).host);
  });
  page.on('response', r => {
    if (r.url().includes('eos.api.eosnation.io') || r.url().includes('eos.greymass.com')) liveOk.push(r.status());
  });
  await page.goto(`${base}/${p}`, { waitUntil: 'load' });
  await page.waitForTimeout(10000);
  deadTotal += dead.length;
  const ok = dead.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${p} — dead-host requests: ${dead.length}${dead.length ? ' (' + dead[0] + ')' : ''} · live hosts seen: ${[...live].join(', ') || 'none'} · live 2xx: ${liveOk.filter(s => s < 300).length}`);
  await ctx.close();
}
await browser.close(); srv.close();

console.log('\nRIG LIMITATION (crate page, reported separately per order): crates/bmesh-serve/assets/page.html is served here as a static file, so its crate-served /api/tick endpoint is absent (404) and one pageerror may surface from that missing API — a property of the rig, not of the healed host list. The real crate serves /api/tick alongside this asset in production.');
console.log(deadTotal === 0 ? '\nEMISSION PROOF PASS — zero dead-host requests across every page' : `\nEMISSION PROOF FAIL — ${deadTotal} dead-host requests emitted`);
process.exit(deadTotal === 0 ? 0 : 1);
