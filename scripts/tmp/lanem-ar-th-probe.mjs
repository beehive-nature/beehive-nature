// quick acceptance probe: AR + Thai (long translation) lead rendering and RTL
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.cwd();
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = createServer(async (req, res) => {
  try {
    const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`http://127.0.0.1:${server.address().port}/surfaces/music.html`);
await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
await page.locator('#blangsel').selectOption('ar');
await page.waitForTimeout(300);
const ar = await page.locator('.lead[data-reg="bee"]').innerText();
const dirAr = await page.evaluate(() => getComputedStyle(document.documentElement).direction || getComputedStyle(document.body).direction);
await page.locator('#blangsel').selectOption('th');
await page.waitForTimeout(300);
const th = await page.locator('.lead[data-reg="bee"]').innerText();
const dir = await page.evaluate(() => getComputedStyle(document.documentElement).direction || getComputedStyle(document.body).direction);
console.log('AR lead:', ar);
console.log('AR Arabic script:', /[\u0600-\u06FF]/.test(ar));
console.log('TH lead:', th);
console.log('TH Thai script:', /[\u0E00-\u0E7F]/.test(th));
console.log('RTL direction under AR:', dirAr);
await browser.close(); server.close();
