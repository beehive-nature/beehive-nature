/* Source + small DOM-boundary checks for the kandi bar's three presentations.
   Gift identity lives in one engine — views change prose/density, not rules. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/kandi.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const pointers = read('surfaces/blight/pointers.js');
const corpus = JSON.parse(read('surfaces/lang-corpus.json'));

function extractById(html, id) {
  const open = html.match(new RegExp(`<(?<tag>[a-z][a-z0-9]*)([^>]*\\sid="${id}"[^>]*)>`, 'i'));
  assert.ok(open, '#'+id+' must exist');
  const tag = open.groups.tag;
  const start = open.index;
  let depth = 1, cursor = start + open[0].length;
  const finder = new RegExp('<'+tag+'\\b[^>]*>|</'+tag+'>', 'gi');
  finder.lastIndex = cursor;
  let next;
  while ((next = finder.exec(html))) {
    if (next[0].startsWith('</')) depth--;
    else depth++;
    if (depth === 0) return html.slice(start, next.index + next[0].length);
  }
  return html.slice(start);
}

test('New bee uses the shared light canvas; raver and cypherpunk keep this page\'s dark reading', () => {
  assert.match(page, /<body data-reg="bee" data-bee-theme="shared">/);
  assert.match(page, /<meta name="theme-color" content="#f6f7f2">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-bee-theme="shared"\] #comet\{display:none\}/);
  assert.match(page, /data-reg="bee">String beads, name it/);
  assert.match(page, /data-reg="raver">make it\. name it\. do the handshake/);
  assert.match(page, /data-reg="cypherpunk">Format: <code>KND1\|maker\|for\|ts36\|beads\|fnv<\/code>/);
});

test('one gift engine: identity, token guard, animation does not splice', () => {
  assert.match(page, /function pieceKey\(k\)\{ return encode\(k\); \}/);
  assert.match(page, /var token=\+\+giftGen;/);
  assert.match(page, /if\(!giving \|\| giving\.token!==token\) return;/);
  assert.doesNotMatch(page, /function gift\(idx\)/);
  const gift = page.slice(page.indexOf('function gift(k)'), page.indexOf('$(\'copygift\')'));
  assert.doesNotMatch(gift, /S\.right\.splice/);
  assert.doesNotMatch(gift, /S\.given\.push/);
  assert.match(page, /\$\('finishgift'\)\.onclick/);
  assert.match(page, /writes the full KND1 to the memory line, then removes the piece/);
});

test('crossing stays local and is not advertised as escrow', () => {
  assert.match(page, /there is no escrow and no one in the middle/);
  assert.match(page, /Crossing is two local handoffs/);
  assert.match(page, /No remote atomic exchange/);
  assert.doesNotMatch(page, /escrow service|atomic swap on a server/i);
  assert.match(pointers, /kandi:function\(str,note\)/);
  assert.match(pointers, /#k=/);
});

test('keyed New bee gift labels match the corpus English; every tongue has a cell', () => {
  const keys=['kandi.gift.ready','kandi.gift.copied','kandi.gift.copyNeed','kandi.gift.done','kandi.gift.finish','kandi.rcv.look','kandi.show.hint'];
  for (const key of keys) {
    const idx = page.indexOf('data-i18n="'+key+'"');
    assert.notEqual(idx, -1, key+' missing on the page');
    const en = extractKeyedText(page, page.lastIndexOf('<', idx));
    assert.equal(en, corpus.strings[key].en, key);
    for (const language of corpus._meta.langs) {
      assert.ok(corpus.strings[key][language]?.trim(), key+' '+language);
    }
  }
});

test('view toggle remembers limits disclosure and does not own a second gift engine', () => {
  assert.match(page, /readingChoices=new Map\(\)/);
  assert.match(page, /data-view-disclosure="limits"/);
  assert.match(page, /document\.addEventListener\('bregister',applyReading\)/);
  assert.equal((page.match(/function gift\(/g)||[]).length, 1);
  assert.match(tour, /register\.js\?v=9/);
  assert.match(register, /body\[data-reg="bee"\]\[data-bee-theme="shared"\]/);
  /* page-local display: on [data-reg] children would beat register.js hide */
  const phaseCss = page.slice(page.indexOf('.giftphase .gp b'), page.indexOf('#giftstr.copy-needed'));
  assert.doesNotMatch(phaseCss, /display\s*:/);
});
