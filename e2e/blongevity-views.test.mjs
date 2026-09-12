/* Source + small DOM-boundary checks for bLongevity's three first paints.
   Same fat-education instrument — views change first paint, not facts.
   LIABILITY FENCE: New bee / Raver first paints are measurement / receipted
   chemistry only. Graded hypothesis, ACiD unmaking, disease/outcome, dose
   stay on Cypherpunk + deepen. No medical advice. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/blongevity.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
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

function inline(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
}

const FENCE = /CB1|CB2|telomere|FLAGSHIP|PMID|ACiD|Artificial Chronic Inflammatory Disease|dose never renders|upstream medicine|116\.13|UNTESTED/;
const REVERSAL = /run the reversal hypothesis|body\.reversed|#revBtn/;

test('New bee first paint is one calm sentence, one takeaway, and one choice', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /Your body needs two fats it gets from food\. Explore what they do\./);
  assert.match(bee, /Two essential fats\. One starting point\./);
  assert.match(bee, /The research has limits\./);
  assert.match(bee, /See the fat story/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /[Cc]annabinoid/);
  assert.doesNotMatch(bee, /<input|<select|type="range"/i);
  assert.doesNotMatch(bee, /<table/i);
  assert.doesNotMatch(bee, FENCE);
  assert.doesNotMatch(bee, /reversal|six stages|#line|#mirror/);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-blong-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-blong-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-story,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="blong.foot.measure">receipted composition and published reference intakes only — not medical advice<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="oil-scene"/);
  assert.match(raver, /A soft fat and plant wash from seed-oil light through green and teal into purple/);
  assert.match(raver, /What if bliss chemistry started in the plate, not the pill\?/);
  assert.match(raver, /Touch the story/);
  assert.doesNotMatch(raver, /Cannabinoid receptors did not evolve for plants/);
  assert.doesNotMatch(raver, /<input|<select|type="range"/i);
  assert.doesNotMatch(raver, /<table/i);
  assert.doesNotMatch(raver, FENCE);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-blong-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and New bee choice sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /Cannabinoid receptors did not evolve for plants — plants happened to speak the language your fats built\./);
  assert.match(figure, /Two essential fats\. One starting point\./);
  assert.match(figure, /See the fat story/);
  assert.match(figure, /Go deeper/);
  assert.doesNotMatch(figure, FENCE);
  assert.doesNotMatch(figure, /#revBtn|id="mirror"|id="m-wt"/);
  assert.match(page, /body\[data-reg="raver"\]\[data-blong-beat="figure"\] #layer-figure\{display:block\}/);
});

test('See the fat story is one calm beat — two bricks and blank honesty, not the six-stage line', () => {
  const story = extractById(page, 'layer-story');
  assert.match(story, /Linoleic acid/);
  assert.match(story, /Alpha-linolenic acid/);
  assert.match(story, /Your body needs both from food/);
  assert.match(story, /Both fats are essential\. This page does not establish a target ratio/);
  assert.match(story, /Both are found in hemp hearts/);
  assert.doesNotMatch(story, /<input|<select/i);
  assert.doesNotMatch(story, /<table/i);
  assert.doesNotMatch(story, FENCE);
  assert.doesNotMatch(story, /id="revBtn"|id="mirror"|id="m-wt"|STAGE 2|STAGE 3|STAGE 4/);
  assert.match(page, /body\[data-blong-beat="story"\] #layer-story\{display:block\}/);
});

test('Cypherpunk still reaches the full fat-education instrument, same constants and sources', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /THE WALLS, ON THE FACE/);
  assert.match(instrument, /id="line"/);
  assert.match(instrument, /id="revBtn"/);
  assert.match(instrument, /id="mirror"/);
  assert.match(instrument, /id="m-wt"/);
  assert.match(instrument, /id="m-sex"/);
  assert.match(instrument, /CB1 — central/);
  assert.match(instrument, /CB2 — the peripheral-class receptor/);
  assert.match(instrument, /ACiD — Artificial Chronic Inflammatory Disease/);
  assert.match(instrument, /THE FLAGSHIP STUDY/);
  assert.match(instrument, /PMID 41167310/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(instrument, /dose never renders/);
  assert.match(page, /var LA100=27\.358/);
  assert.match(page, /function mirror\(\)/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, REVERSAL);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'blong.mark', 'blong.pair', 'blong.bee.calm', 'blong.bee.takeaway', 'blong.bee.support',
    'blong.bee.story', 'blong.bee.deeper', 'blong.raver.feel', 'blong.raver.touch',
    'blong.raver.consciousness', 'blong.story.caption',
    'blong.foot.measure', 'blong.foot.learn'
  ];
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

test('language-first shell hosts register and language; cypher masthead cannot leak on New bee', () => {
  assert.match(page, /<script src="tour\.js\?v=42"><\/script>/);
  assert.match(page, /\[data-reg\]:not\(body\)\{display:none\}/);
  assert.match(page, /body\[data-reg="bee"\] \[data-reg="bee"\],\s*body\[data-reg="raver"\] \[data-reg="raver"\],\s*body\[data-reg="cypherpunk"\] \[data-reg="cypherpunk"\]\{display:revert\}/);
  assert.match(page, /class="sub" data-reg="cypherpunk"/);
  assert.match(page, /CB1, CB2, the inflammatory tone/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  assert.doesNotMatch(bee, FENCE);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, FENCE);
  assert.match(tour, /assetBase\+'register\.js\?v=10'/);
  assert.match(tour, /assetBase\+'lang\.js\?v=26'/);
});

test('beats and sources disclosure remember per view instead of resetting', () => {
  assert.match(page, /var readingChoices=new Map\(\)/);
  assert.match(page, /var beatChoices=new Map\(\)/);
  assert.match(page, /function restoreVisibleFocus\(focus\)/);
  assert.match(page, /function applyReading\(event\)/);
  assert.match(page, /document\.addEventListener\('bregister',applyReading\)/);
  assert.match(tour, /register\.js\?v=10/);
  assert.match(register, /an authored theme can use data-bee-theme="custom"/);

  const all = [];
  const events = {};
  function element(tag='div') {
    const e = {
      tagName: tag.toUpperCase(), dataset: {}, style: {}, attrs: {}, children: [],
      parentElement: null, open: false, isConnected: true, listeners: {},
      value: '', innerHTML: '', className: '',
      querySelector(s) { return this.querySelectorAll(s)[0] || null; },
      querySelectorAll(s) {
        return this.children.flatMap(c => [c, ...c.querySelectorAll('*')]).filter(n => matches(n, s));
      },
      appendChild(n) { n.parentElement = this; this.children.push(n); return n; },
      addEventListener(k, fn) { (this.listeners[k] ??= []).push(fn); },
      getAttribute(name) {
        if (name === 'data-reg') return this.dataset.reg;
        if (name === 'data-blong-beat') return this.dataset.blongBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-blong-beat') this.dataset.blongBeat = value;
        this.attrs[name] = value;
      },
      focus({preventScroll} = {}) { document.activeElement = this; this.preventScroll = preventScroll; },
      scrollIntoView() { this.scrolled = true; }
    };
    all.push(e);
    return e;
  }
  function matches(e, selector) {
    if (selector === 'summary') return e.tagName === 'SUMMARY';
    if (selector === '[data-view-disclosure]') return Boolean(e.dataset.viewDisclosure);
    if (selector === 'meta[name="theme-color"]') return e.tagName === 'META' && e.attrs.name === 'theme-color';
    if (selector === '[data-blong-go]') return Boolean(e.attrs['data-blong-go']);
    return false;
  }
  const document = {
    body: element('body'),
    activeElement: null,
    querySelectorAll: s => all.filter(e => matches(e, s)),
    querySelector: s => all.find(e => matches(e, s)) || null,
    getElementById: id => all.find(e => e.attrs.id === id) || null,
    createElement: tag => element(tag),
    addEventListener: (k, fn) => { (events[k] ??= []).push(fn); }
  };
  document.body.dataset.reg = 'bee';
  document.body.dataset.blongBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-blong-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  for (const id of ['m-wt','m-sex','mirror','m-line','revBtn','diaas']) {
    const n = element(id === 'm-sex' ? 'select' : id === 'm-wt' ? 'input' : id === 'revBtn' ? 'button' : 'div');
    n.attrs.id = id;
    if (id === 'm-wt') n.value = '80';
    if (id === 'm-sex') n.value = 'm';
    document.body.appendChild(n);
  }
  const ctx = { document, Map, Math, URL, location: { href: 'http://127.0.0.1:8765/blongevity.html' }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-blong-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-blong-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-blong-beat'), 'arrival');
  assert.equal(theme.content, '#0c1412');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-blong-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
