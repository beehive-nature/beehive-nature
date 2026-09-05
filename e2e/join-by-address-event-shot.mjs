// join-by-address-event-shot.mjs — ORDER D RECEIPT (buzz join-by-address,
// the EVENT path, 2026-09-05). The wss:// URL is now a WHOLE invitation:
// the community's owner-signed join material (kind 34550) is fetched off
// the relay wire — unauthenticated — and the join runs from IT, not from
// join.json.
//
// Proven here, live against the throwaway rotate stack (its owner key
// signs the event; the prod publish awaits the founder's owner-key
// gesture — ops/join-event-publish.mjs, the invite-re-mint law):
//   1. a COLD phone context (no storage, no extension) opens the fork's
//      join page and TYPES the one thing it has: ws://127.0.0.1:3311
//   2. the page resolves over THE WIRE (data-join-source=event asserted —
//      the event served, join.json never consulted)
//   3. the key is made on the phone; the standing invite is claimed;
//      NIP-42 auth passes; the room goes LIVE
//   4. the phone SENDS a message and watches it arrive
// Shots → e2e/shots-buzz/
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'shots-buzz');
await mkdir(OUT, { recursive: true });

// the fork's join page runs locally (dev server); the ADDRESS is the
// throwaway relay (ssh-tunneled to the box)
const JOIN = process.env.JOIN_PAGE ?? 'http://localhost:5173/join';
const ADDRESS = process.env.JOIN_ADDRESS ?? 'ws://127.0.0.1:3311';

const browser = await chromium.launch();
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

// THE PHONE: cold context, 390px, nothing but the address.
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

const input = page.locator('input[inputmode="url"]');
await input.fill('');
await input.type(ADDRESS, { delay: 24 });
await page.screenshot({ path: join(OUT, 'join-event-390-address-only.png') });
console.log('shot → e2e/shots-buzz/join-event-390-address-only.png');

await page.getByRole('button').click();
await page.waitForFunction(
  () => document.body.innerText.includes('#') || document.body.innerText.includes('does not offer') || document.body.innerText.includes('refused'),
  null, { timeout: 30000 },
);

// THE ASSERT OF THIS LANE: the material came off the WIRE.
const source = await page.evaluate(() => document.body.dataset.joinSource || undefined);
ok('the join material came off the relay wire (kind 34550)', source === 'event', `data-join-source=${source}`);

await page.waitForFunction(
  () => document.body.innerText.includes('write something') || document.body.innerText.includes('#'),
  null, { timeout: 20000 },
);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, 'join-event-390-room-live.png'), fullPage: false });
console.log('shot → e2e/shots-buzz/join-event-390-room-live.png');
ok('the room went live from the event path', true);

// the write path: type, send, watch it arrive
const composer = page.locator('input[placeholder^="message #"], textarea').last();
const marker = `event-path ${Date.now()}`;
await composer.fill(marker);
await page.keyboard.press('Enter');
await page.waitForFunction(
  (m) => document.body.innerText.includes(m),
  marker, { timeout: 20000 },
);
ok('the phone SENT over the event-joined identity and SAW it arrive', true, marker);
await page.screenshot({ path: join(OUT, 'join-event-390-sent.png') });
console.log('shot → e2e/shots-buzz/join-event-390-sent.png');

ok('zero page errors', errors.length === 0, errors.join('; '));

await browser.close();
console.log(fail === 0 ? 'EVENT-PATH JOIN: ALL PASS' : `EVENT-PATH JOIN: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
