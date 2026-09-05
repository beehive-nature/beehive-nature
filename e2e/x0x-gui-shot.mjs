// x0x GUI receipt — opens /gui?token=<session-token-file> and screenshots.
// The token file is read and used in the URL only; it is never printed.
// usage: node e2e/x0x-gui-shot.mjs <base-url> <token-file> <out-png> [wait-ms]
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [base, tokenFile, out, waitMs = '6000'] = process.argv.slice(2);
if (!base || !tokenFile || !out) {
  console.error('usage: node e2e/x0x-gui-shot.mjs <base-url> <token-file> <out-png> [wait-ms]');
  process.exit(2);
}
const token = readFileSync(tokenFile, 'utf8').trim();
const url = `${base.replace(/\/$/, '')}/gui?token=${token}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(Number(waitMs));
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: false });
const title = await page.title().catch(() => '');
await browser.close();
console.log(JSON.stringify({ shot: out, title, pageErrors: errors.length }));
