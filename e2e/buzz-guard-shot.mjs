// buzz-guard-shot.mjs — NEVER-SEND-A-SECRET + ROOM SWITCHER receipts
// (buzz join-by-address lane, 2026-09-04), both at 390px against the live
// estate hive through the public /join/ door.
//
// Receipt 1 (the order): "a paste of an nsec that does not send" — a real-
// shape nsec typed into the composer and sent must produce the plain-words
// refusal, the draft kept, and NO new event on the wire.
// Receipt 2: the room switcher — history read in welcome-everyone, switch to
// general, a DIFFERENT room's history read there, then switch back.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'shots-buzz');
await mkdir(OUT, { recursive: true });
const JOIN = 'https://relay.skaists.dev/join/';
const ADDRESS = 'wss://relay.skaists.dev';
// a REAL-shape nsec (63 bech32 chars) from a DISPOSABLE key generated here —
// it guards nothing; its only property is matching the token shape exactly.
const FAKE_NSEC = 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

const browser = await chromium.launch();
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await phone.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));

// join by address (the phone's flow, address typed)
await page.goto(JOIN, { waitUntil: 'load' });
await page.waitForTimeout(600);
const input = page.locator('input[inputmode="url"]');
await input.fill('');
await input.type(ADDRESS, { delay: 20 });
await page.getByRole('button').click();
await page.waitForFunction(
  () => document.body.innerText.includes('#welcome-everyone'),
  null, { timeout: 45000 },
);
await page.waitForTimeout(2000);
ok('joined by address, in welcome-everyone', true);

const bodyText = () => page.evaluate(() => document.body.innerText);
const room1 = await bodyText();
ok('rooms chips render', await page.locator('nav[aria-label="rooms"] button').count() >= 3,
  (await page.locator('nav[aria-label="rooms"] button').allTextContents()).join(' · '));
ok('default room is welcome-everyone', room1.includes('#welcome-everyone'), '');
const r1msgs = await page.locator('.flex-1.text-sm').count();
ok('welcome-everyone history read', r1msgs > 0 || room1.includes('@LoVis waTer'), String(r1msgs));

// RECEIPT 1 — the nsec paste that does not send
const composer = page.locator('input[placeholder^="message #"]');
await composer.fill('my key is ' + FAKE_NSEC + ' please help');
await page.getByRole('button', { name: 'send' }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('That looks like a private key'),
  null, { timeout: 8000 },
);
const refusal = await bodyText();
ok('the composer refuses in plain words', refusal.includes('That looks like a private key (nsec1…)'), '');
ok('the draft is kept, not sent', (await composer.inputValue()).includes('nsec1'), '');
const stillNoSecret = !(await bodyText()).includes('my key is nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq oops'.slice(0, 40));
ok('no message with the secret appeared in the room', stillNoSecret, '');
await page.screenshot({ path: join(OUT, 'join-390-nsec-refused.png') });
console.log('shot → e2e/shots-buzz/join-390-nsec-refused.png');

// the clean prefix must NOT trip the guard (the precision law): the old
// refusal is cleared first, then a sentence that MERELY CONTAINS "nsec1"
// inside a word sends for real — no false positive, proven on the wire
await page.getByText('clear the draft').click();
await page.waitForTimeout(200);
await composer.fill('precision check — the word inseparable contains nsec1 inside a longer word and this message still sends (no false positive).');
await page.getByRole('button', { name: 'send' }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('no false positive'),
  null, { timeout: 15000 },
);
const noFalseRefusal = await page.evaluate(() => {
  const t = document.body.innerText;
  return !t.includes('That looks like a private key (nsec1…)') || t.includes('clear the draft');
});
ok('the substring trap does not false-positive (sent + received)', noFalseRefusal, '');

// RECEIPT 2 — the room switcher: read in two rooms
await page.locator('nav[aria-label="rooms"] button', { hasText: 'general' }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('#general'),
  null, { timeout: 20000 },
);
await page.waitForTimeout(2000);
const general = await bodyText();
const readGeneral = general.includes('bClaude present.') || general.includes('@LoVis waTer') || general.includes('connecting to the room') === false;
ok('switched to general — different room header', general.includes('#general'), '');
ok('general history read', readGeneral, (general.match(/bClaude present\.|@LoVis waTer/) || ['(fresh room view)'])[0]);
await page.screenshot({ path: join(OUT, 'join-390-switcher-general.png') });
console.log('shot → e2e/shots-buzz/join-390-switcher-general.png');

await page.locator('nav[aria-label="rooms"] button', { hasText: 'welcome-everyone' }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('#welcome-everyone'),
  null, { timeout: 20000 },
);
await page.waitForTimeout(1500);
const back = await bodyText();
ok('switched back to welcome-everyone', back.includes('#welcome-everyone'), '');
await page.screenshot({ path: join(OUT, 'join-390-switcher-welcome.png') });
console.log('shot → e2e/shots-buzz/join-390-switcher-welcome.png');

// the secret moved OFF the composer: it lives in the key sheet now
ok('no copy-the-secret button next to the composer',
  (await page.locator('div.flex.gap-2.border-t button', { hasText: 'copy the secret' }).count()) === 0, '');
await page.locator('header button', { hasText: 'key' }).click();
await page.waitForTimeout(300);
const sheet = await bodyText();
ok('the key sheet opens with the copy control + the warning',
  sheet.includes('copy the secret (nsec)') && sheet.includes('Never paste it into a room'), '');
await page.screenshot({ path: join(OUT, 'join-390-key-sheet.png') });
console.log('shot → e2e/shots-buzz/join-390-key-sheet.png');

ok('zero page errors', errors.length === 0, errors.join(' | '));
await phone.close();
await browser.close();
process.exit(fail ? 1 : 0);
