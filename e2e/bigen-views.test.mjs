/* Source + small DOM-boundary checks for BiGen's three first paints.
   Same evidence-library instrument — views change first paint, not the map.
   LIABILITY FENCE: New bee / Raver first paints are the library door + empty
   cells. Cochrane contrast, verdict grids, Lundh tables, study-card walls and
   YAML stay on Cypherpunk + deepen. No pooled-estimate theater. No medical advice. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/bigen.html');
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

const FENCE = /Cochrane|Lundh|MR000033|manufacturer-sponsored|WHY THIS EXISTS|id="tiers"|id="tiers2"|id="yaml"|id="cards"|id="srctab"|RR 1\.27|forest plot|verdict set|STUDY CARDS/;

test('New bee first paint is one calm sentence, one takeaway, and one choice', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /This is an evidence library you can re-run — not a brochure you have to trust\./);
  assert.match(bee, /Empty cells are findings — not failures\./);
  assert.match(bee, /exhibit 001 is early-phase and honestly not poolable — cannabis &amp; cancer, named once\./);
  assert.match(bee, /Claims arrive graded or not at all — not medical advice\./);
  assert.match(bee, /Open the map/);
  assert.match(bee, /Go deeper/);
  assert.equal((bee.match(/cannabis(?: &amp; | and )cancer/gi) || []).length, 1);
  assert.doesNotMatch(bee, /glioblastoma|cachexia|temozolomide|nabiximols|lung-cancer/i);
  assert.doesNotMatch(bee, /<input|<select|type="range"/i);
  assert.doesNotMatch(bee, /<table/i);
  assert.doesNotMatch(bee, FENCE);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-bigen-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-bigen-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-map,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="bigen.foot.library">an evidence map, not medical advice<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="mark-scene"/);
  assert.match(raver, /A soft search and mark glow — library as garden, not a courtroom/);
  assert.match(raver, /What if the empty cells were the most honest answer\?/);
  assert.match(raver, /Walk the map/);
  assert.doesNotMatch(raver, /A pooled number on an evidence map is a category error/);
  assert.doesNotMatch(raver, /<input|<select|type="range"/i);
  assert.doesNotMatch(raver, /<table/i);
  assert.doesNotMatch(raver, FENCE);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bigen-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and New bee choice sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /A pooled number on an evidence map is a category error — this page refuses it\./);
  assert.match(figure, /Empty cells are findings — not failures\./);
  assert.match(figure, /Open the map/);
  assert.match(figure, /Go deeper/);
  assert.doesNotMatch(figure, FENCE);
  assert.doesNotMatch(figure, /id="tiers"|id="yaml"|id="cards"|Lundh/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bigen-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Open the map is one calm empty-cell beat — not Cochrane, Lundh, verdicts, or YAML', () => {
  const map = extractById(page, 'layer-map');
  assert.match(map, /Empty cells are findings — not failures\./);
  assert.match(map, /id="calm-gapmap"/);
  assert.match(map, /No evidence in this collection/);
  assert.match(map, /It does not show that a treatment works/);
  assert.match(map, /Empty cells are the finding — this corpus is early-phase and honestly not poolable\./);
  assert.doesNotMatch(map, /<input|<select/i);
  assert.doesNotMatch(map, FENCE);
  assert.doesNotMatch(map, /id="tiers"|id="tiers2"|id="yaml"|id="cards"|id="srctab"|Lundh|Cochrane/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-bigen-beat="map"\] #layer-map\{display:block\}/);
});

test('Cypherpunk still reaches the full evidence-library instrument, same grammar and honesty', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /WHY THIS EXISTS — the four things Cochrane cannot retrofit/);
  assert.match(instrument, /id="tiers"/);
  assert.match(instrument, /id="tiers2"/);
  assert.match(instrument, /id="gapmap"/);
  assert.match(instrument, /id="queries"/);
  assert.match(instrument, /id="cards"/);
  assert.match(instrument, /Lundh et al\. 2017, MR000033/);
  assert.match(instrument, /id="yaml"/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(instrument, /id="srctab"/);
  assert.match(instrument, /id="lv-p"/);
  assert.match(instrument, /not poolable/);
  assert.match(instrument, /preclinical/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, /if\(reading==='cypherpunk'\) beat='deeper'/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : \(beatChoices\.get\(reading\)\|\|defaultBeat\(reading\)\)/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #instrument\{display:block\}/);
  assert.match(page, /opens in a new tab/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'bigen.mark', 'bigen.pair', 'bigen.bee.calm', 'bigen.bee.takeaway', 'bigen.bee.support',
    'bigen.bee.fence', 'bigen.bee.map', 'bigen.bee.deeper', 'bigen.raver.feel', 'bigen.raver.walk',
    'bigen.raver.consciousness', 'bigen.map.caption',
    'bigen.foot.library', 'bigen.foot.learn', 'bigen.foot.verify'
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
  assert.match(page, /Cochrane tradition/);
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
      closest(s) {
        for (let n = this; n; n = n.parentElement) {
          if (matches(n, s)) return n;
        }
        return null;
      },
      getAttribute(name) {
        if (name === 'data-reg') return this.dataset.reg;
        if (name === 'data-bigen-beat') return this.dataset.bigenBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-bigen-beat') this.dataset.bigenBeat = value;
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
    if (selector === '[data-bigen-go]') return Boolean(e.attrs['data-bigen-go']);
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
  document.body.dataset.bigenBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-bigen-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  for (const id of ['tiers','tiers2','gapmap','queries','cards','yaml','srctab','lv-p','lv-s','lv-t','state-prose']) {
    const n = element(id === 'lv-p' || id === 'lv-s' || id === 'lv-t' ? 'button' : 'div');
    n.attrs.id = id;
    document.body.appendChild(n);
  }
  const goMap = element('button');
  goMap.attrs['data-bigen-go'] = 'map';
  document.body.appendChild(goMap);
  const ctx = { document, Map, Math, URL, location: { href: 'http://127.0.0.1:8765/bigen.html' }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-bigen-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-bigen-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  for (const fn of events.click || []) fn({ target: goMap });
  assert.equal(document.body.getAttribute('data-bigen-beat'), 'deeper', 'cypherpunk refuses a map trim');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-bigen-beat'), 'arrival');
  assert.equal(theme.content, '#0c1412');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-bigen-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
