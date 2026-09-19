/* Source checks for b4b.html (the BNR × Base application appendix) and its
   three views. The page carries no per-view markup: three keyed notes are
   <details data-reg-disclose> (register.js collapses them for bee/raver and
   opens them for cypherpunk), so every receipt, row and link is identical in
   all three views by construction. Every heading closes with its own level:
   §5 once closed <h2> with </h5>, which browsers repair as a parse error and
   nothing else would have caught. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/b4b.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const floors = JSON.parse(read('e2e/lang-coverage-floors.json'));

const body = page.slice(page.indexOf('<body>'), page.indexOf('<script src="tour.js'));
const sections = [...body.matchAll(/<section>([\s\S]*?)<\/section>/g)].map(m => m[1]);

test('every heading level balances, and each heading closes its own tag', () => {
  for (let n = 1; n <= 6; n++) {
    const open = (page.match(new RegExp(`<h${n}\\b`, 'g')) || []).length;
    const close = (page.match(new RegExp(`</h${n}>`, 'g')) || []).length;
    assert.equal(close, open, `h${n}: ${open} open, ${close} close`);
  }
  for (const m of page.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h([1-6])>/g)) {
    assert.equal(m[3], m[1], `<h${m[1]}> closed by </h${m[3]}>`);
  }
});

test('no per-view markup: every view renders the same receipts and links', () => {
  assert.doesNotMatch(body, /data-reg=/);
  assert.match(page, /<script src="tour\.js\?v=42"><\/script>/);
  assert.equal((page.match(/<script\b/g) || []).length, 1);
  assert.equal(sections.length, 5);
  const links = [...page.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, [
    'tokens.css',
    'https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/RECEIPT_ERC8004_E1_READ_FIRST_2026-08-20.md',
    'https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/erc8004-e1-read-first.mjs',
    'https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/RECEIPT_ERC20I_S10_LOCKED_SEED_2026-08-20.md',
    'https://github.com/beehive-nature/beehive-nature/blob/main/docs/receipts/erc20i-s10-sources/',
    'https://github.com/beehive-nature/beehive-nature/blob/main/docs/dispatches/DISPATCH_SOULCATS_HUNT_ROSE_OFFER_2026-08-19.md',
    'https://github.com/beehive-nature/beehive-nature/tree/main/crates/bindexer',
    'bigen.html',
    'https://github.com/beehive-nature/beehive-nature',
    'https://github.com/beehive-nature/beehive-nature/tree/main/docs/receipts',
    'index.html',
    'https://github.com/beehive-nature/beehive-nature',
  ]);
  assert.equal((sections[1].match(/class="rc"/g) || []).length, 4);
  assert.equal((sections[2].match(/<tr>/g) || []).length, 4);
});

test('three keyed notes are view disclosures; the headings stay open in every view', () => {
  const notes = [...body.matchAll(/<details class="tnote" data-reg-disclose><summary data-i18n="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(notes, ['bb.d.how', 'bb.d.what', 'bb.d.road']);
  assert.equal((body.match(/<details\b/g) || []).length, 3);
  assert.equal((body.match(/<\/details>/g) || []).length, 3);
  assert.doesNotMatch(body, /data-reg-disclose open/);
  const heads = sections.map(s => (s.match(/^\s*<h2>(\d) · (?:<span data-i18n="([^"]+)">)?/) || []).slice(1).join('='));
  assert.deepEqual(heads, ['1=h.001', '2=h.002', '3=h.003', '4=h.004', '5=']);
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
});

test('keyed strings are pinned in order and above the floor', () => {
  const keys = [...body.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(keys, ['bb.d.how', 'h.001', 'bb.d.what', 'h.002', 'h.003', 'h.004', 'bb.d.road', 'law.hive']);
  assert.ok(keys.length >= floors['b4b.html'], `keys must stay at or above the floor ${floors['b4b.html']}`);
});
