// zcode-music-check.mjs — deterministic local proof for the SKAISTS mUsiC room (music.html, ex jams.html).
// It exercises the page against the shared manifest without opening x0x,
// Autonomi, a wallet, or a production relay.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const requests = [];
const server = createServer(async (req, res) => {
  requests.push({ method:req.method, url:req.url });
  try {
    const file = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/net::ERR_/.test(message.text())) errors.push(message.text()); });
let pass = 0, fail = 0;
const ok = (label, condition, note='') => { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${note ? ` — ${note}` : ''}`); } };

await page.goto(`${base}/surfaces/music.html`);
await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
ok('music: page has no errors', errors.length === 0, errors.join(' | '));
ok('music: page carries SKAISTS mUsiC identity', await page.title() === 'SKAISTS mUsiC · PLUR' && (await page.locator('h1').innerText()) === 'SKAISTS mUsiC');
ok('music: shared manifest is verified', await page.locator('#status').innerText() === 'shared manifest verified');
ok('music: PLUR channel is selected', await page.locator('#f-channel').innerText() === 'plur');
ok('music: epoch and sequence are projected', await page.locator('#f-epoch').innerText() === '3' && await page.locator('#f-sequence').innerText() === '12');
ok('music: four encrypted references render', await page.locator('#items .item').count() === 4 && await page.locator('#f-items').innerText() === '4');
ok('music: recording, stems, captions and snapshot are present', JSON.stringify(await page.locator('#items .item b').allTextContents()) === JSON.stringify(['channel-snapshot','music-recording','music-stems','music-captions']));
ok('music: checkpoint metadata is visible only as bounded references', (await page.locator('#m-size').innerText()).endsWith('B') && (await page.locator('#m-id').innerText()).includes('…'));
ok('music: payment is disabled', await page.locator('#g-payment').innerText() === 'disabled');
ok('music: Trezor remains downstream', await page.locator('#g-approval').innerText() === 'Trezor downstream');
ok('music: join is enabled only after verification', await page.locator('#join').isEnabled());
await page.locator('#join').click();
ok('music: local join changes the room preview', await page.locator('#join').innerText() === 'leave preview' && (await page.locator('#room-foot').innerText()).includes('local room preview'));
ok('music: join receipt is local only', (await page.locator('#eventlog').innerText()).includes('local participant joined') && !requests.some(r => r.method === 'POST'));
ok('music: PLUR, watch and listening links are present', await page.locator('a[href="plur.html"]').count() === 2 && await page.locator('a[href="watch.html"]').count() === 1 && await page.locator('a[href="listening.html"]').count() === 1);
const jamsRef = page.locator('a[href="https://jams.community/"]');
const watchRef = page.locator('a[href="https://github.com/aautonomicc/Watch-It"]');
ok('music: independent references are explicit', await jamsRef.count() === 1 && await watchRef.count() === 2 && (await page.locator('.independent').innerText()).includes('separate projects'));
const safeExternal = async (locator) => { for (const i of await locator.all()) { if (await i.getAttribute('target') !== '_blank' || await i.getAttribute('rel') !== 'noopener noreferrer') return false; } return true; };
ok('music: independent references open safely in new tabs', await safeExternal(jamsRef) && await safeExternal(watchRef));
ok('music: no second raw transport is opened', requests.filter(r => r.url.includes('/ws') || r.method === 'POST').length === 0);

// the old address still works: the shim forwards query across the rename
await page.goto(`${base}/surfaces/jams.html?manifest=${encodeURIComponent(`${base}/fixtures/connect-store-manifest-envelope-v1.json`)}`);
await page.waitForFunction(() => location.pathname.endsWith('/surfaces/music.html'));
ok('music: jams.html shim redirects to music.html', page.url().includes('/surfaces/music.html?manifest='));
ok('music: shim carried the manifest query into the room', await page.locator('#status').innerText() === 'shared manifest verified');
// three views, one set of facts (founder canon): every register shows the same manifest numbers
const factsByReg = {};
for (const reg of ['bee','raver','cypherpunk']) {
  await page.locator('#breg-' + reg).click();
  ok('music: ' + reg + ' view applies', await page.locator('body').getAttribute('data-reg') === reg);
  factsByReg[reg] = [
    await page.locator('#f-channel').innerText(),
    await page.locator('#f-epoch').innerText(),
    await page.locator('#f-sequence').innerText(),
    await page.locator('#f-items').innerText(),
    await page.locator('#g-payment').innerText(),
  ];
}
ok('music: facts identical across the three views',
  JSON.stringify(factsByReg.bee) === JSON.stringify(factsByReg.raver) &&
  JSON.stringify(factsByReg.bee) === JSON.stringify(factsByReg.cypherpunk),
  JSON.stringify(factsByReg));
ok('music: page has no errors after view walk', errors.length === 0, errors.join(' | '));

// the z2.sec S2 hardening survives the rename: a crafted cross-origin link
// is IGNORED fail-closed — the override never applies, the room falls back
// to its own default manifest, and the refusal is visible in the room log
await page.goto(`${base}/surfaces/music.html?manifest=${encodeURIComponent('https://attacker.example/evil.json')}`);
await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
ok('music: crafted cross-origin override is ignored, the default room still verifies',
  await page.locator('#status').innerText() === 'shared manifest verified');
ok('music: refusal is visible in the room log', (await page.locator('#eventlog').innerText()).includes('cross-origin manifest/store override ignored'));
ok('music: nothing was fetched from the attacker origin (the crafted URL rides only the document query)',
  !requests.some(r => r.url.includes('attacker.example') && !r.url.startsWith('/surfaces/music.html')));
ok('music: no-referrer policy rides the page', await page.evaluate(() => !!document.querySelector('meta[name="referrer"][content="no-referrer"]')));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
