// Opt-in one-viewer public acceptance. No audience load generation.
// node e2e/bview-adaptive-live.mjs --out NEW_RECEIPT.json
import { chromium, devices } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (!values.out) throw Error('--out required');
const sha = data => createHash('sha256').update(data).digest('hex');
const html = await readFile(new URL('../surfaces/bview.html', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../fixtures/bview/adaptive/package.json', import.meta.url)));
const expected = new Map(pkg.files.map(f => [f.path, f.sha256]));
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage(), checks = [], assets = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', response => {
  const prefix = 'https://skaists.dev/fixtures/bview/adaptive/';
  if (!response.url().startsWith(prefix)) return;
  const name = response.url().slice(prefix.length);
  if (!expected.has(name)) return;
  checks.push(response.body().then(body => assets.push({ name, bytes: body.length, matches: sha(body) === expected.get(name) })).catch(() => assets.push({ name, matches: false })));
});
try {
  const response = await page.goto('https://skaists.dev/surfaces/bview.html');
  const htmlSha256 = sha(await response.body()), htmlMatches = htmlSha256 === sha(html);
  if (!htmlMatches) throw Error('Hosted HTML does not match this checkout');
  await page.locator('.stream-help a').click();
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    if (await page.locator('#tap').isVisible()) await page.locator('#tap').click();
    const e = await page.evaluate(() => window.__bviewEngine());
    if (e.video.ended || e.fail) break;
  }
  await Promise.all(checks);
  const e = await page.evaluate(() => window.__bviewEngine());
  const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  const accepted = htmlMatches && e.video.ended && e.playhead >= 47.5 && e.adaptive?.mode === 'mse' && e.video.srcChanges === 1
    && assets.length > 0 && assets.every(a => a.matches) && !e.fail && errors.length === 0 && layout.width === layout.scrollWidth;
  const result = { observedAt: new Date().toISOString(), browser: browser.version(),
    boundary: 'one public Chrome viewer with Pixel 7 emulation; not a physical phone or capacity test',
    htmlSha256, htmlMatches, accepted, layout, assets, errors, startupMs: e.playStartMs, previewMs: e.ttffMs,
    stalls: e.stalls, stallMs: e.stallMs, video: e.video, adaptive: e.adaptive, 'PUBLIC-CONSTANT': 'public HTML digest' };
  await writeFile(resolve(values.out), JSON.stringify(result) + '\n', { flag: 'wx' });
  await page.screenshot({ path: resolve(values.out) + '.png', fullPage: true });
  console.log(JSON.stringify(result));
  if (!accepted) process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
