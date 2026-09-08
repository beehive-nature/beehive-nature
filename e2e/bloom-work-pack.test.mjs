/* Source checks for the draft bloom work pack.
   Not a live work URL, receive path, mint, or human observation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const bin = p => readFileSync(resolve(root, p));

const work = read('docs/mvp-walk/works/bloom-genesis.html');
const share = read('docs/mvp-walk/works/bloom-genesis-share.html');
const js = read('docs/mvp-walk/works/bloom-genesis.js');
const index = read('docs/mvp-walk/index.html');
const bloom = read('docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg');
const still = bin('docs/mvp-walk/assets/genesis-3d/stills/green-teal-bloom.jpg');
const kandi = read('surfaces/kandi.html');

function extractById(html, id) {
  const open = html.match(new RegExp(`<(?<tag>[a-z][a-z0-9]*)([^>]*\\sid="${id}"[^>]*)>`, 'i'));
  assert.ok(open, '#' + id + ' must exist');
  const tag = open.groups.tag;
  const start = open.index;
  let depth = 1;
  const finder = new RegExp('<' + tag + '\\b[^>]*>|</' + tag + '>', 'gi');
  finder.lastIndex = start + open[0].length;
  let next;
  while ((next = finder.exec(html))) {
    if (next[0].startsWith('</')) depth--;
    else depth++;
    if (depth === 0) return html.slice(start, next.index + next[0].length);
  }
  return html.slice(start);
}

test('New bee is the default; shared register host; three authored views', () => {
  assert.match(work, /<body data-reg="bee" data-bee-theme="custom">/);
  assert.match(work, /data-register-host/);
  assert.match(work, /surfaces\/register\.js\?v=9/);
  assert.match(work, /data-view="bee"/);
  assert.match(work, /data-view="raver"/);
  assert.match(work, /data-view="cypherpunk"/);
  assert.match(work, /<meta name="theme-color" content="#f6f7f2">/);
});

test('the same work and credits sit in unmarked shared prose', () => {
  const credit = extractById(work, 'bloom-heading');
  assert.match(work, /<b>LoVis and his mother<\/b>/);
  assert.doesNotMatch(work.slice(work.indexOf('<p class="credit">'), work.indexOf('</p>', work.indexOf('<p class="credit">')) + 4), /data-view=/);
  assert.match(work, /Original artwork/);
  assert.match(work, /Motion study by Astra/);
  assert.match(share, /LoVis and his mother/);
  assert.match(share, /Green–teal–purple bloom/);
  assert.equal(credit.includes('Green–teal–purple bloom'), true);
});

test('colour meaning is named in words, not hue alone', () => {
  assert.match(work, /Purple — humans/);
  assert.match(work, /Teal — AI/);
  assert.match(work, /Green — biomass/);
  assert.match(share, /Purple — humans/);
  assert.match(share, /Teal — AI/);
  assert.match(share, /Green — biomass/);
  assert.match(work, /named in words as well as hue/);
});

test('New bee first action is Keep a reference; share is choose-click, not a numbered how-to', () => {
  assert.match(work, /id="keep-reference">Keep a reference/);
  assert.match(work, /href="bloom-genesis-share.html">Share with someone/);
  const beeLead = work.match(/<span data-view="bee">([\s\S]*?)<\/span>/)[1];
  assert.doesNotMatch(beeLead, /<ol[\s>]/i);
  assert.doesNotMatch(beeLead, /<(p|div|li)[^>]*>\s*\d+[\.\)]\s/);
  assert.doesNotMatch(work, /Three calm steps/i);
  assert.doesNotMatch(share, /<ol[\s>]/i);
  assert.match(share, /A piece of this bloom, for you to keep or to give/);
});

test('hero reuses the original still and optional breathing SVG; Blender builders are untouched', () => {
  assert.match(work, /assets\/genesis-3d\/stills\/green-teal-bloom\.jpg/);
  assert.match(work, /assets\/genesis-3d\/motion\/green-teal-breathing\.svg/);
  assert.match(share, /assets\/genesis-3d\/stills\/green-teal-bloom\.jpg/);
  assert.equal(still.slice(0, 3).toString('hex'), 'ffd8ff');
  assert.ok(still.length > 8000 && still.length < 40000, 'lightweight still, not a 1MB relief');
  assert.match(bloom, /class="bnr-breathing-bloom"/);
  assert.match(bloom, /prefers-reduced-motion: reduce/);
  assert.match(js, /is-paused/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(work, /build-breathing-blender|build-study\.py/);
  assert.ok(bloom.includes(still.toString('base64')));
});

test('keep is a browser reference, not ownership or a licensed copy', () => {
  assert.match(js, /id: 'bloom-genesis-lovis-mother'/);
  assert.match(js, /medium: 'visual'/);
  assert.match(js, /links: \[\]/);
  assert.match(js, /later\.saveItem/);
  assert.match(work, /not a copy of the artwork and not a license/);
  assert.match(share, /not a licensed media copy/);
  assert.match(share, /Reference, not ownership/);
});

test('artist support is empty; no invented shop', () => {
  assert.match(work, /Artist-selected destination pending/);
  assert.match(share, /artist-selected destination pending/i);
  assert.doesNotMatch(work, /href=["'][^"']*bandcamp/i);
  assert.doesNotMatch(share, /href=["'][^"']*bandcamp/i);
  assert.doesNotMatch(work, /bandcamp\.com/i);
  assert.doesNotMatch(share, /bandcamp\.com/i);
});

test('public URL and QR stay draft until Astra ships a stable work URL', () => {
  assert.match(work, /Not a public work URL/);
  assert.match(work, /docs\/mvp-walk\/works\/bloom-genesis\.html/);
  assert.match(share, /Draft \/ local until Astra ships a stable work URL/);
  assert.match(share, /QR reserved/);
  assert.doesNotMatch(share, /<img[^>]+qr/i);
  assert.doesNotMatch(work, /https:\/\/skaists\.dev\/works\/bloom/);
});

test('receive, kandi, and listen-later are labeled real vs pending', () => {
  assert.match(work, /Pending Astra’s connected receive release/);
  assert.match(work, /Live bracelet gift on this origin/);
  assert.match(work, /It is not a receive path for this artwork/);
  assert.match(work, /Real in this browser, from the artist audio showcase on main/);
  assert.match(work, /href="\.\.\/artist-audio-showcase.html"/);
  assert.match(work, /href="\.\.\/\.\.\/\.\.\/surfaces\/kandi.html">Kandi \(live, untouched\)/);
});

test('externals open in a new tab with a visible new-tab label; BNR stays here', () => {
  const ext = [...work.matchAll(/<a\b([^>]*)>/g)].filter(m => /https?:\/\//.test(m[1]));
  assert.ok(ext.length >= 1, 'at least one external link');
  ext.forEach(m => {
    assert.match(m[1], /target="_blank"/);
    assert.match(m[1], /rel="noopener noreferrer"/);
  });
  assert.match(work, /opens in a new tab/);
  assert.match(work, /Your BNR page stays here/);
});

test('optional media is folded; visual-first journey does not require sound', () => {
  assert.match(work, /<summary>Optional listen<\/summary>/);
  assert.doesNotMatch(work, /<details[^>]*open[^>]*>[\s\S]*Optional listen/);
  assert.match(work, /Sound is not required to meet this work/);
  assert.match(work, /TEST AUDIO — not an authorized release/);
});

test('walk index lists the pack; live kandi gift engine is not this change', () => {
  assert.match(index, /works\/bloom-genesis\.html/);
  assert.match(index, /works\/bloom-genesis-share\.html/);
  assert.doesNotMatch(kandi, /bloom-genesis/);
  assert.doesNotMatch(kandi, /Keep a reference/);
  assert.match(work, /does not edit <code>surfaces\/kandi\.html<\/code>/);
});
