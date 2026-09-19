/* Source checks for blanguage.html's three views (the BlanguageDOCK). The page
   is already composed; this gate pins that composition so a later edit
   cannot silently drop a view. Views change which blocks show, never the
   facts: <body data-reg="bee"> is the arrival, four sections are
   cypherpunk-only, THE WORD ENTRY carries one register body per view, and
   the keyed strings, external links and workshop controls are pinned. The
   page is not edited by this gate. No colour pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/blanguage.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const floors = JSON.parse(read('e2e/lang-coverage-floors.json'));

const body = page.slice(page.indexOf('<body'), page.indexOf('<script src="tour.js'));
const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const sections = [...body.matchAll(/<section([^>]*)>\s*<h2><span data-i18n="([^"]+)"/g)].map(m => ({ attrs: m[1], key: m[2] }));

const KEYS = [
  'plur.dockWelcome', 'plur.dockFloor', 'bld.title', 'plur.dockIntro', 'plur.words', 'plur.conversation', 'plur.raverIntro', 'bld.lede',
  'h.050', 'bld.unesco', 'bld.cmp.trad', 'bld.cmp.dock', 'bld.cmp.locales', 'bld.cmp.locales.t', 'bld.cmp.locales.d',
  'bld.cmp.strings', 'bld.cmp.strings.t', 'bld.cmp.strings.d', 'bld.cmp.absence', 'bld.cmp.absence.t', 'bld.cmp.absence.d',
  'bld.cmp.removal', 'bld.cmp.removal.t', 'bld.cmp.removal.d', 'bld.cmp.improve', 'bld.cmp.improve.t', 'bld.cmp.improve.d', 'bld.spec',
  'h.051', 'bld.consent.law', 'bld.consent.neg', 'h.052', 'bld.dock.law', 'bld.control.h', 'bld.control.law',
  'h.053', 'bld.corpus.banner', 'bld.corpus.law', 'h.054', 'bld.sweeps.law', 'h.055',
  'w.skaists.h', 'bld.sk.bee', 'bld.sk.raver', 'bld.sk.cypher', 'bld.sk.etym.h', 'bld.sk.etym', 'bld.sk.senses.h',
  'bld.sk.s1', 'bld.sk.s2', 'bld.sk.s3', 'bld.sk.s4', 'bld.sk.s3.law', 'bld.sk.decl.h', 'bld.sk.case', 'bld.sk.masc', 'bld.sk.fem',
  'bld.sk.decl.law', 'bld.sk.around', 'bld.sk.source', 'h.043', 'h.056', 'bld.ws.banner', 'h.057', 'h.058',
  'bld.ws.create', 'bld.ws.create.d', 'bld.ws.merge', 'bld.ws.merge.d', 'bld.ws.migrate', 'bld.ws.migrate.d',
  'bld.ws.remove', 'bld.ws.remove.d', 'law.hive', 'bld.foot.dock',
];

const EXTERNAL = [
  'https://www.unesco.org/en/articles/towards-world-atlas-languages',
  'https://en.wikipedia.org/wiki/Atlas_of_the_World%27s_Languages_in_Danger',
  'https://github.com/beehive-nature/beehive-nature/blob/main/docs/DESIGN-BRIEF-04-blanguagedock.md',
  'https://doi.org/10.5334/dsj-2020-043',
  'https://www.gida-global.org/careprinciples',
  'https://www.ohchr.org/en/instruments-mechanisms/instruments/united-nations-declaration-rights-indigenous-peoples',
  'https://unesdoc.unesco.org/ark:/48223/pf0000183699',
  'https://www.unesco.org/en/articles/unesco-hosts-ad-hoc-expert-meeting-world-atlas-languages',
  'https://iso639-3.sil.org/',
  'https://github.com/beehive-nature/beehive-nature/blob/main/docs/register/FATHER-SET-1.md',
  'https://en.wiktionary.org/wiki/skaists',
  'https://github.com/beehive-nature/beehive-nature/blob/main/docs/specs/SPEC-AUTONOMI-TREZOR-1.md',
  'https://github.com/beehive-nature/beehive-nature/blob/main/surfaces/lang-corpus.json',
  'https://github.com/beehive-nature/beehive-nature',
  'https://endangeredlanguages.com/elp-language/1212',
  'https://www.bunka.go.jp/english/policy/japanese_language/policy/',
  "https://iso639-3.sil.org/code/'+l.code+'",
  'https://glottolog.org/',
  'https://beehive-nature.github.io/beehive-nature/surfaces/',
  'https://github.com/beehive-nature/beehive-nature/blob/main/docs/dispatches/DISPATCH_BTRANSLATED_B_NAMES_2026-08-20.md',
  'https://github.com/beehive-nature/beehive-nature/blob/main/docs/register/SPEAKER-COUNT-RULER-OPTIONS.md',
];

test('bee is the arrival register; the register machinery is the shared one', () => {
  assert.match(page, /<body data-reg="bee">/);
  assert.match(page, /<script src="tour\.js\?v=42"><\/script>/);
  assert.match(tour, /register\.js\?v=\d+/);
  assert.match(register, /\[data-reg\]:not\(body\)\{display:none\}/);
  assert.match(page, /body\[data-reg="bee"\]\{--ink:/);
  assert.match(page, /body\[data-reg="raver"\] header\{/);
  const regs = [...body.matchAll(/data-reg="(\w+)"/g)].map(m => m[1]);
  const count = r => regs.filter(x => x === r).length;
  assert.deepEqual([count('bee'), count('raver'), count('cypherpunk'), regs.length], [4, 3, 7, 14]);
  const h1 = [...body.matchAll(/<h1 data-reg="(\w+)">/g)].map(m => m[1]);
  assert.deepEqual(h1, ['bee', 'raver', 'cypherpunk']);
});

test('four sections are cypherpunk-only, the other five show in every view', () => {
  assert.equal(sections.length, 9);
  const cypher = sections.filter(s => /data-reg="cypherpunk"/.test(s.attrs)).map(s => s.key);
  assert.deepEqual(cypher, ['h.050', 'h.051', 'h.054', 'h.055']);
  const open = sections.filter(s => !/data-reg=/.test(s.attrs)).map(s => s.key);
  assert.deepEqual(open, ['h.052', 'h.053', 'w.skaists.h', 'h.043', 'h.056']);
});

test('THE WORD ENTRY carries one register body per view', () => {
  const entry = body.slice(body.indexOf('<section id="skaists">'), body.indexOf('</section>', body.indexOf('<section id="skaists">')));
  const bodies = [...entry.matchAll(/<div class="law" data-reg="(\w+)" data-i18n="(bld\.sk\.[a-z]+)">/g)].map(m => m[1]+'='+m[2]);
  assert.deepEqual(bodies, ['bee=bld.sk.bee', 'raver=bld.sk.raver', 'cypherpunk=bld.sk.cypher']);
  assert.equal((entry.match(/data-reg=/g) || []).length, 3);
});

test('keyed strings are pinned in order, above the floor, and none live in the inline scripts', () => {
  const keys = [...body.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(keys, KEYS);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.length >= floors['blanguage.html'], `75 keys must stay at or above the floor ${floors['blanguage.html']}`);
  assert.equal(inline.length, 2);
  for (const s of inline) assert.doesNotMatch(s, /data-i18n/);
});

/* the full sequence of the 42 external hrefs (static markup and script-built),
   in source order, as indexes into EXTERNAL */
const EXTERNAL_ORDER = [0, 1, 2, 3, 4, 5, 1, 6, 7, 8, 9, 10, 11, 12, 13, 1, 1, 1, 14, 15, 9,
  9, 9, 9, 9, 9, 16, 0, 1, 6, 7, 14, 15, 3, 4, 5, 8, 17, 18, 9, 19, 20];

test('external links are pinned byte-equal: all 42, in source order', () => {
  const ext = [...page.matchAll(/href="(https?:[^"]+)"/g)].map(m => m[1]);
  assert.equal(EXTERNAL_ORDER.length, 42);
  assert.deepEqual([...new Set(ext)], EXTERNAL);
  assert.deepEqual(ext, EXTERNAL_ORDER.map(i => EXTERNAL[i]));
});

test('the workshop controls are present and the workshop script drives them', () => {
  const ws = body.slice(body.indexOf('<section id="workshop">'));
  for (const id of ['ws-from', 'ws-code', 'ws-name', 'ws-rtl', 'ws-own', 'ws-comm', 'ws-reason']) {
    assert.match(ws, new RegExp(`id="${id}"`), id);
    assert.match(inline[1], new RegExp(`\\$\\('${id}'\\)`), id+' is read by the workshop script');
  }
});
