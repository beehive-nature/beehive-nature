/* Source checks for devroom.html's three views. Views change density, never
   the design: §2 (the findings ledger) and §3 (the Sophia gate) are
   <details data-reg-disclose> (register.js collapses them for bee/raver and
   opens them for cypherpunk); §0 (the pipeline canvas and its counts) and §1
   (the articles) stay open, and the three article drafts keep their own plain
   <details>. The page carries no per-view markup, so every fact, count and
   link is identical in all three views by construction. The h2 strings are
   unkeyed English and are pinned byte-equal. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/devroom.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');

const body = page.slice(page.indexOf('<body>'), page.indexOf('<script src="tour.js'));
const beforeMain = body.slice(0, body.indexOf('<main>'));
const sections = [...body.matchAll(/<section>([\s\S]*?)<\/section>/g)].map(m => m[1]);

test('no per-view markup: every view renders the same facts, counts and links', () => {
  assert.doesNotMatch(body, /data-reg=/);
  assert.doesNotMatch(page.slice(page.indexOf('<script src="tour.js')), /data-reg|bregister/);
  const links = [...body.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, [
    'https://github.com/beehive-nature/beehive-nature/tree/main/docs/wiki',
    'https://github.com/aautonomicc/Watch-It',
    'https://github.com/aautonomicc/Watch-It',
    'https://github.com/aautonomicc/Watch-It',
    'https://github.com/aautonomicc/Watch-It',
    'https://github.com/aautonomicc/Watch-It',
    'biq.html',
    'https://github.com/beehive-nature/beehive-nature/blob/main/docs/wiki/IQWIKI-SUBMISSION-BRIEF.md',
    'index.html',
  ]);
  assert.equal(sections.length, 4);
  const stats = [...sections[0].matchAll(/<div class="n" id="(s-[a-z]+)">(\d+)<\/div>/g)].map(m => m[1]+'='+m[2]);
  assert.deepEqual(stats, ['s-sub=0', 's-find=4', 's-draft=3', 's-cite=0']);
});

test('§2 and §3 are view disclosures with their unkeyed heading as the summary', () => {
  const blocks = [...body.matchAll(/<details data-reg-disclose>\s*<summary><h2>([^<]+)<\/h2><\/summary>/g)].map(m => m[1]);
  assert.deepEqual(blocks, [
    '2 · THE FINDINGS LEDGER — their finding, our write-up',
    "3 · THE SOPHIA GATE — what iq.wiki requires, and the fork we're standing at",
  ]);
  assert.equal((body.match(/<details data-reg-disclose/g) || []).length, 2);
  assert.doesNotMatch(body, /<details data-reg-disclose open/);
  for (const s of sections.slice(2)) assert.match(s, /^\s*<details data-reg-disclose>[\s\S]*<\/details>\s*$/);
  assert.equal((sections[2].match(/class="finder"/g) || []).length, 4);
  assert.equal((sections[3].match(/<tr>/g) || []).length, 6);
  assert.match(sections[3], /class="never"[\s\S]*founder's word picks the lane/);
  assert.match(register, /details\[data-reg-disclose\]/);
  assert.match(register, /d\.open=\(r==='cypherpunk'\)/);
  assert.match(tour, /register\.js\?v=\d+/);
});

test('the pipeline and the articles stay open; the article drafts stay plain', () => {
  assert.doesNotMatch(beforeMain, /<details/);
  assert.doesNotMatch(sections[0], /<details/);
  assert.match(sections[0], /^\s*<h2>0 · THE PIPELINE — where everything stands<\/h2>\s*<canvas id="pipe"/);
  assert.match(sections[1], /^\s*<h2>1 · THE ARTICLES — each opens with the symptom, in the words someone would search for<\/h2>/);
  assert.doesNotMatch(sections[1], /data-reg-disclose/);
  const drafts = sections[1].match(/<details><summary>read the full pre-wiki draft<\/summary><div class="art-body">/g) || [];
  assert.equal(drafts.length, 3);
  assert.equal((sections[1].match(/<details\b/g) || []).length, 3);
  assert.equal((sections[1].match(/class="art" id="a\d"/g) || []).length, 3);
});
