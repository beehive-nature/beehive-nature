// Live-verification shots for the market USDC price fix (founder eye-catch #7,
// 2026-08-29): confirms real, timestamped, on-chain-sourced numbers render on
// the actual cards, not just that the code parses. Throwaway, not wired to CI.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'shots-lane-a');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = createServer(async (req, res) => {
  try {
    const body = await readFile(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    res.writeHead(200, { 'Content-Type': MIME[extname(req.url)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
const base = await new Promise(r => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));

const browser = await chromium.launch();
for (const [label, w, h] of [['1280', 1280, 900], ['390', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${base}/surfaces/blight/market.html`, { waitUntil: 'load', timeout: 20000 });
  // wait for the live inventory + live price reads to settle
  await page.waitForFunction(() => {
    const n = document.getElementById('liveListings');
    return n && n.textContent !== '…' && document.querySelectorAll('.card .price .p').length > 0;
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const cards = await page.$$eval('.card', els => els.map(el => ({
    sym: el.querySelector('.n')?.textContent,
    price: el.querySelector('.price .p')?.textContent,
    unit: el.querySelector('.price .u')?.textContent,
  })));
  console.log(`=== ${label} ===`);
  cards.forEach(c => console.log(`  ${c.sym}: ${c.price} (${c.unit})`));
  console.log(`  console errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  await page.screenshot({ path: join(OUT, `market-AFTER-local-${label}.png`), fullPage: false });
  await ctx.close();
}
await browser.close();
s.close();
