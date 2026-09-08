/* Source checks for the draft artist-audio showcase.
   Not a live upload, mint, or rendered-device acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const bin = p => readFileSync(resolve(root, p));
const page = read('docs/mvp-walk/artist-audio-showcase.html');
const js = read('docs/mvp-walk/assets/artist-audio/showcase.js');
const manifest = JSON.parse(read('docs/mvp-walk/assets/artist-audio/TEST-AUDIO-not-authorized-release.json'));
const wav = bin('docs/mvp-walk/assets/artist-audio/TEST-AUDIO-not-authorized-release.wav');
const bloom = read('docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg');
const kandi = read('surfaces/kandi.html');
const midivault = read('surfaces/blight/midivault.html');

test('New bee is the default; shared register host and custom theme', () => {
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom">/);
  assert.match(page, /data-register-host/);
  assert.match(page, /surfaces\/register\.js\?v=9/);
  assert.match(page, /<meta name="theme-color" content="#f6f7f2">/);
  assert.match(page, /data-view="bee"/);
  assert.match(page, /data-view="raver"/);
  assert.match(page, /data-view="cypherpunk"/);
});

test('every view keeps Play, Watch, named sources, credits, and storage details', () => {
  assert.match(page, /id="play-pause"/);
  assert.match(page, /id="watch"[^>]*disabled/);
  assert.match(page, /title="No video on this board"/);
  assert.match(page, /Other ways to listen/);
  assert.match(page, /id="volume"/);
  assert.match(page, /id="fixture-audio"/);
  assert.match(page, /TEST AUDIO — not the authorized release/);
  assert.match(page, /rights <code>unconfirmed<\/code>/);
  assert.match(page, /id="credits-heading">Artist credits/);
  assert.match(page, /id="receipts-heading">Storage receipts/);
  assert.match(page, /id="storage-panel"/);
  assert.match(page, /data-view-disclosure="storage"/);
  assert.match(page, /Autonomi/);
  assert.match(page, /Arweave/);
  const credits = page.slice(page.indexOf('id="credits-heading"'));
  assert.doesNotMatch(credits.slice(0, 400), /data-view=/);
  assert.equal((page.match(/TEST AUDIO — not the authorized release/g) || []).length >= 2, true);
});

test('fixture audio is short, labeled, and not autoplayed', () => {
  assert.match(page, /preload="none"/);
  assert.doesNotMatch(page, /<audio[^>]*\bautoplay\b/i);
  assert.match(js, /audio\.autoplay = false/);
  assert.match(js, /audio\.play\(\)/);
  assert.equal(wav.slice(0, 4).toString(), 'RIFF');
  assert.ok(wav.length > 1000 && wav.length < 200000, '1–2s-scale fixture, not a full track');
  const digest = createHash('sha256').update(wav).digest('hex');
  assert.equal(manifest.content.sha256, digest);
  assert.equal(manifest.content.bytes, wav.length);
  assert.ok(manifest.content.durationSeconds > 1 && manifest.content.durationSeconds <= 2);
  assert.match(read('docs/mvp-walk/assets/artist-audio/TEST-AUDIO-not-authorized-release.json'), /PUBLIC-CONSTANT: source content digest/);
});

test('empty Autonomi and Arweave receipts stay null — no fake ids', () => {
  assert.equal(manifest.schema, 'bnr-audio-release/1');
  assert.equal(manifest.status, 'prepared-local-only');
  assert.equal(manifest.rights.basis, 'unconfirmed');
  assert.equal(manifest.storage.autonomi.address, null);
  assert.equal(manifest.storage.autonomi.retrievedSha256, null);
  assert.equal(manifest.storage.autonomi.status, 'not-uploaded');
  assert.equal(manifest.storage.arweave.transactionId, null);
  assert.equal(manifest.storage.arweave.retrievedSha256, null);
  assert.equal(manifest.storage.arweave.status, 'not-uploaded');
  assert.match(page, /null — not uploaded \/ pending authorized release/);
  assert.match(page, /prepared-local-only/);
  assert.match(page, /upload not performed/);
  assert.doesNotMatch(page, /\b0x[a-fA-F0-9]{40,}\b/);
  assert.doesNotMatch(JSON.stringify(manifest.storage), /"[a-zA-Z0-9_-]{20,}"/);
});

test('bloom is reused, not rebuilt; reduced motion and pause are honored', () => {
  assert.match(page, /assets\/genesis-3d\/motion\/green-teal-breathing\.svg/);
  assert.match(bloom, /class="bnr-breathing-bloom"/);
  assert.match(bloom, /prefers-reduced-motion: reduce/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /is-paused/);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(page, /build-breathing-blender|build-study\.py/);
});

test('Play, Watch, and Other ways to listen stay honest about availability', () => {
  assert.match(page, /Play is the local test-audio action/);
  assert.match(js, /applySource\('local'/);
  assert.match(page, /id="watch"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(js, /Watch is unavailable\. This board has no video file/);
  assert.match(page, /<button type="button" data-source="local" data-available="true"/);
  assert.match(page, /<button type="button" data-source="youtube" data-available="true"/);
  assert.match(page, /<p class="slot" data-source="autonomi" data-available="false">/);
  assert.match(page, /<p class="slot" data-source="arweave" data-available="false">/);
  assert.doesNotMatch(page, /<button[^>]*data-source="autonomi"/);
  assert.doesNotMatch(page, /<button[^>]*data-source="arweave"/);
  assert.match(js, /querySelectorAll\('button\[data-source\]'\)/);
  assert.match(js, /This is not a playback source yet/);
});

test('YouTube is a named external source; embed is not claimed on skaists.dev', () => {
  assert.match(page, /Named external listen — not this page’s audio/);
  assert.match(page, /https:\/\/www\.youtube\.com\/watch\?v=pb6OqIyyLAk/);
  assert.match(page, /YouTube embed is not guaranteed on this host or on skaists.dev/);
  assert.match(page, /DNS alone cannot guarantee playback/);
  assert.match(page, /valid client\/referrer and per-video embed permission/);
  assert.match(page, /referrerpolicy="strict-origin-when-cross-origin"/);
  assert.match(page, /id="youtube-player"/);
  assert.match(js, /unloadYouTube/);
  assert.match(js, /stopLocalAudio/);
  assert.match(page, /[Nn]ot a rights clearance/);
  assert.match(page, /does not claim CJ Bolland/);
  assert.match(page, /does not claim a YouTube embed will play on skaists.dev/);
});

test('skin changes re-apply the chosen source and do not reset the local playhead', () => {
  assert.match(js, /applySource\(source, \{ silent: true \}\)/);
  assert.doesNotMatch(js, /audio\.currentTime\s*=\s*0/);
  assert.match(js, /if \(reading === lastReading\) return/);
  assert.match(js, /document\.addEventListener\('bregister', applyReading\)/);
});

test('live kandi gift engine and midivault 32 KiB path are not this change', () => {
  assert.match(midivault, /bytes\.subarray\(0,0x8000\)/);
  assert.match(page, /midivault’s simulated first-32-KiB/);
  assert.match(page, /does not edit <code>surfaces\/kandi\.html<\/code>/);
  assert.doesNotMatch(kandi, /artist-audio-showcase/);
  assert.doesNotMatch(kandi, /TEST-AUDIO-not-authorized-release/);
});
