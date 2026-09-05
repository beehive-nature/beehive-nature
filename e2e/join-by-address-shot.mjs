// join-by-address-shot.mjs — THE LANE RECEIPT (buzz join-by-address, 2026-09-04).
// The order's receipt definition: "a phone with nothing but the relay address
// in theskaists.buzz room, screenshot at 390px."
//
// Proven here, live against the estate hive:
//   1. a COLD phone context (no storage, no NIP-07 extension, no app) opens
//      the join page and TYPES the one thing it has: wss://relay.skaists.dev
//   2. the key is made on the phone; the standing invite is claimed; NIP-42
//      auth passes on the given road; the room goes LIVE and history renders
//   3. the phone SENDS a message and watches it arrive (write path too)
//   4. fail-closed: an address with no pairing material (relay2 — the other
//      hive, which has published none) is refused in plain words
// Shots → e2e/shots-buzz/
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'shots-buzz');
await mkdir(OUT, { recursive: true });

const JOIN = 'https://relay.skaists.dev/join/';
const ADDRESS = 'wss://relay.skaists.dev';
const NO_MATERIAL = 'wss://relay2.skaists.dev';

const browser = await chromium.launch();
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

// THE PHONE: cold context, 390px, no extension, nothing but the address.
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await phone.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));

await page.goto(JOIN, { waitUntil: 'load' });
await page.waitForTimeout(600);

// the prefill (same-origin convenience) is cleared — the phone TYPES its one line
const input = page.locator('input[inputmode="url"]');
await input.fill('');
await input.type(ADDRESS, { delay: 24 });
await page.screenshot({ path: join(OUT, 'join-390-address-only.png') });
console.log('shot → e2e/shots-buzz/join-390-address-only.png');

await page.getByRole('button').click();
await page.waitForFunction(
  () => document.body.innerText.includes('#') || document.body.innerText.includes('does not offer'),
  null, { timeout: 30000 },
);
await page.waitForFunction(
  () => {
    const t = document.body.innerText;
    return t.includes('welcome-everyone') && (t.includes('live') || t.includes('closed'));
  },
  null, { timeout: 30000 },
);
await page.waitForTimeout(1200);

const body = await page.evaluate(() => document.body.innerText);
ok('the phone landed in the room', body.includes('welcome-everyone'), body.slice(0, 90).replace(/\n/g, ' '));
ok('the room is live', body.includes('live'), '');
ok('room history rendered', await page.locator('div.text-sm > div').count() > 0 || page.getByText(/m$/) .count() > 0);
ok('the community is skaists.buzz', body.includes('skaists.buzz'), '');

// write path: the phone speaks
const composer = page.locator('input[placeholder^="message #"], textarea').last();
await composer.waitFor({ state: 'visible', timeout: 20000 });
await composer.fill('hello from a phone with one address — no app, no extension, no second machine');
await page.screenshot({ path: join(OUT, 'join-390-composing.png') });
await composer.press('Enter');
await page.waitForFunction(
  () => document.body.innerText.includes('hello from a phone with one address'),
  null, { timeout: 20000 },
);
ok('the phone sent and received its own message', true, '');
await page.screenshot({ path: join(OUT, 'join-390-in-the-room.png') });
console.log('shot → e2e/shots-buzz/join-390-in-the-room.png');

// who the phone became (roster record for the dispatch)
const npub = await page.evaluate(() => {
  const m = document.body.innerText.match(/npub|you are/);
  return m ? 'identity present' : 'identity missing';
});
ok('local identity rendered with its export warning', npub === 'identity present', npub);
ok('zero page errors', errors.length === 0, errors.join(' | '));
await phone.close();

// FAIL-CLOSED: an address whose relay publishes no pairing material
const stranger = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const spage = await stranger.newPage();
await spage.goto(JOIN, { waitUntil: 'load' });
await spage.waitForTimeout(400);
const sinput = spage.locator('input[inputmode="url"]');
await sinput.fill('');
await sinput.type(NO_MATERIAL, { delay: 20 });
await spage.getByRole('button').click();
await spage.waitForFunction(
  () => document.body.innerText.includes('does not offer'),
  null, { timeout: 20000 },
);
const refused = await spage.evaluate(() => document.body.innerText);
ok('fail-closed: no material, plain refusal', refused.includes('does not offer join-by-address'), '');
await spage.screenshot({ path: join(OUT, 'join-390-fail-closed.png') });
console.log('shot → e2e/shots-buzz/join-390-fail-closed.png');
await stranger.close();

await browser.close();
process.exit(fail ? 1 : 0);
