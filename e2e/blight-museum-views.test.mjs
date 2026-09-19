/* Source checks for blight/museum.html and its three views. The page carries
   no per-view markup: seven keyed notes are <details data-reg-disclose>
   (register.js collapses them for bee/raver and opens them for cypherpunk).
   Each note is wrapped once. Three of them were once wrapped twice in an
   identical disclosure, which showed the summary row twice and took two taps
   to open for bee and raver. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/blight/museum.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const floors = JSON.parse(read('e2e/lang-coverage-floors.json'));

const body = page.slice(page.indexOf('<body'), page.indexOf('<script'));

const NOTES = ['mu.d.autoglyph', 'mu.d.v2', 'mu.d.seed', 'mu.d.gate', 'mu.d.classes', 'mu.d.record', 'mu.d.origin'];

test('seven notes, each wrapped once: no disclosure nested directly in a twin', () => {
  const notes = [...body.matchAll(/<details class="tnote" data-reg-disclose><summary data-i18n="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(notes, NOTES);
  assert.equal((body.match(/<details\b/g) || []).length, 7);
  assert.equal((body.match(/<\/details>/g) || []).length, 7);
  const sums = [...body.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map(m => m[0]);
  assert.equal(new Set(sums).size, sums.length, 'no summary row appears twice');
  assert.doesNotMatch(body, /<\/summary>\s*<details\b/, 'a disclosure must not open straight into another');
  assert.doesNotMatch(body, /data-reg-disclose open/);
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
  assert.match(page, /<script src="\.\.\/tour\.js\?v=42"><\/script>/);
});

test('no per-view markup; exhibit headings keyed in order, Exhibit 10 unkeyed', () => {
  assert.doesNotMatch(body, /data-reg=/);
  const heads = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => (m[1].match(/data-i18n="([^"]+)"/) || [, 'unkeyed'])[1]);
  assert.deepEqual(heads, ['h.074', 'h.075', 'h.076', 'h.077', 'h.078', 'h.079', 'h.080', 'h.081', 'h.082', 'unkeyed', 'h.083']);
  assert.match(body, /<h2[^>]*>Exhibit 10 · A name that went with the p/);
});

test('keyed strings are pinned in order, each once, above the floor', () => {
  const keys = [...body.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(keys, ['h.074', 'h.075', 'h.076', 'h.077', 'h.078', 'mu.d.autoglyph', 'h.079', 'mu.d.v2', 'h.080',
    'mu.d.seed', 'h.081', 'mu.d.gate', 'h.082', 'mu.d.classes', 'mu.d.record', 'h.083', 'mu.d.origin']);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.length >= floors['blight/museum.html'], `keys must stay at or above the floor ${floors['blight/museum.html']}`);
});

test('links are pinned byte-equal: all 28, in source order', () => {
  const links = [...page.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, [
    'https://etherscan.io/address/0x3103cD1602d5fa8f4b9283F9D5a7fa2290795d51',
    'https://repo.sourcify.dev/contracts/full_match/1/0x3103cD1602d5fa8f4b9283F9D5a7fa2290795d51/',
    'https://pepi.sh/', 'https://pepi.sh/marketplace', 'https://github.com/ERC-20i/Pepi',
    'gallery.html', 'market.html', 'compare.html', 'inscription-explorer.html',
    'https://basescan.org/address/0x28a5e71BFc02723eAC17E39c84c5190415C0de9F', 'https://pepi.sh/', 'https://inscriptions.market/',
    'https://basescan.org/address/0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F', 'https://inscriptions.market/',
    'https://sourcehat.com/audits/Fungi/', '../../docs/receipts/RECEIPT_SOURCEHAT_FUNGI_AUDIT_2026-08-25.md',
    'https://basescan.org/address/0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE', 'https://inscriptions.market/', 'https://inscriptions.app/',
    'https://basescan.org/address/0xA1b9d812926a529D8B002E69FCd070c8275eC73c', 'https://inscriptions.market/',
    'https://basescan.org/address/0xA058c6f2A56BaAFD5dE4BCAD8f2Cb26F6A32b7D1',
    'https://basescan.org/address/0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38',
    'https://basescan.org/address/0x569e1A337b095B1A6c8F206158072cEDb6325b56', 'https://inscriptions.market/',
    'https://basescan.org/address/0xceb9d2886b29ab2b6d429442540e819f578db92a', 'https://inscriptions.market/',
    '../',
  ]);
});
