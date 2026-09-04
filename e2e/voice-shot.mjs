// voice-shot.mjs — THE LANE RECEIPT (buzz voice lane, 2026-09-04).
// The order's receipt definition: "a Latvian transcript in #general from
// the phone, 390px."
//
// Proven here, live against the estate hive, through the REAL phone UI:
//   1. a COLD phone context opens /join/, types the one address it has,
//      claims the standing invite, lands LIVE in the default room
//   2. the room switcher moves the phone to #general
//   3. the mic (rendered ONLY because join.json declares the voice door —
//      fail-closed capability) records ~15s of REAL Latvian speech —
//      the LibriVox Lāčplēsis reader (public domain), fed to Chrome's
//      fake capture device exactly as a microphone would deliver it
//   4. tap-to-stop hands the note to the community's scribe
//      (relay.skaists.dev/voice → whisper.cpp, -l lv pinned); the
//      TRANSCRIPT is posted as the message carrying the audio's sha256
//   5. the shot lands at 390px with the Latvian message on screen
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
// 14s of real Latvian: the LibriVox disclaimer + title, cut in the lane
const LATVIAN_WAV = join(HERE, 'receipt-lv-chrome.wav');

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${LATVIAN_WAV}`,
  ],
});
let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await phone.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

await page.goto(JOIN, { waitUntil: 'load' });
await page.waitForTimeout(600);

// the phone TYPES its one line (prefill cleared — cold, like the order says)
const input = page.locator('input[inputmode="url"]');
await input.fill('');
await input.type(ADDRESS, { delay: 24 });
await page.getByRole('button', { name: /join the room/ }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('#welcome-everyone'),
  null, { timeout: 30000 },
);
ok('joined by address alone', true, 'cold context → live in #welcome-everyone');

// the switcher moves the phone to #general (the receipt's room)
await page.getByRole('button', { name: 'general', exact: true }).click();
await page.waitForFunction(
  () => document.body.innerText.includes('#general'),
  null, { timeout: 15000 },
);
ok('switched to #general', true);

// THE FAIL-CLOSED CAPABILITY, visible: the mic renders ONLY because the
// community's join material declares a voice door
const mic = page.locator('button[aria-label="record a voice note"]');
ok('mic rendered (join.json declares the door)', await mic.count() === 1);
ok('tongue chip reads lv (tongue order lv·th·ru·uk)', await page.locator('button[aria-label="voice note language"]').innerText() === 'lv');

// the tongue sheet shows the community's order, in order
await page.locator('button[aria-label="voice note language"]').click();
await page.waitForTimeout(400);
const sheetText = await page.evaluate(() => document.body.innerText);
ok('tongue sheet lists the order', ['latviešu · lv', 'ไทย · th', 'русский · ru', 'українська · uk'].every((t) => sheetText.includes(t)));
await page.screenshot({ path: join(OUT, 'voice-390-tongues.png') });
await page.getByRole('button', { name: 'close', exact: true }).click();
await page.waitForTimeout(300);

// RECORD: tap the mic, let the fake microphone deliver the Latvian clip
// (14s of audio — record a beat past it), then tap again to hand it over
await mic.click();
await page.waitForFunction(
  () => document.body.innerText.includes('recording ('),
  null, { timeout: 10000 },
);
ok('recording started', true);
await page.waitForTimeout(15500);
await page.locator('button[aria-label="send the voice note"]').click();
await page.waitForFunction(
  () => document.body.innerText.includes('transcribing your voice note'),
  null, { timeout: 10000 },
);
ok('handed to the scribe', true, 'transcribing state shown honestly');

// the scribe is a 1.7×real-time whisper on 4 ARM cores — a 14s note is
// ~30-60s of transcription; wait generously, then verify the message
await page.waitForFunction(
  () => document.body.innerText.includes('voice→text · lv · sha256:'),
  null, { timeout: 240000 },
);
const body = await page.evaluate(() => document.body.innerText);
ok('transcript posted with digest', body.includes('voice→text · lv · sha256:'));
ok('Latvian speech became Latvian text', body.includes('LibriVox ieraksts'));
const message = body
  .split('\n')
  .filter((line) => line.includes('LibriVox') || line.includes('sha256:'))
  .join(' | ');
console.log('MESSAGE:', message);

// THE ORDER'S RECEIPT: the Latvian transcript in #general from the phone
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'voice-390-general-transcript.png') });
console.log('shot → e2e/shots-buzz/voice-390-general-transcript.png');

ok('no page errors', errors.length === 0, errors.join(' ;; '));

await browser.close();
console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
