/* Source + small DOM-boundary checks for bEarth's three first paints.
   Same demand model and constants — views change first paint, not facts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/bearth.html');
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

test('New bee first paint is one sentence, one fraction-led number, and one door', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /If everyone ate a small handful of hemp hearts each day, how much farmland would we need\?/);
  assert.match(bee, /data-land-value>53%/i);
  assert.match(bee, /A scenario you can change/);
  assert.match(bee, /See the land cost/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /<input|<select|type="range"/i);
  assert.doesNotMatch(bee, /REFUTED|STRONGEST|survived/i);
  assert.doesNotMatch(bee, /N₂O|N2O|IPCC/);
  assert.doesNotMatch(bee, /dial|slider|spreadsheet/i);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-bearth-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-bearth-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-land,#instrument\{display:none\}/);
  assert.match(page, /<span data-reg="cypherpunk">built for the environmental arm · every number here is a dial/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="plant-scene"/);
  assert.match(raver, /Soil, a seed, and a green stalk in soft earth light/);
  assert.match(raver, /What would it cost the planet to feed every body a little more of this plant\?/);
  assert.match(raver, /Touch the numbers/);
  assert.doesNotMatch(raver, /The earth answers in hectares and honesty/);
  assert.doesNotMatch(raver, /<input|<select|type="range"/i);
  assert.doesNotMatch(raver, /REFUTED|N₂O|IPCC/);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bearth-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and New bee choice sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /The earth answers in hectares and honesty — not slogans\./);
  assert.match(figure, /data-land-value>53%/i);
  assert.match(figure, /See the land cost/);
  assert.match(figure, /Go deeper/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bearth-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Cypherpunk still reaches the full instrument, same constants and sources', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /id="pop"/);
  assert.match(instrument, /id="gday"/);
  assert.match(instrument, /id="rec"/);
  assert.match(instrument, /id="yld"/);
  assert.match(instrument, /id="nrate"/);
  assert.match(instrument, /id="ef"/);
  assert.match(instrument, /IPCC Tier 1 default/);
  assert.match(instrument, /REFUTED/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(page, /var CROPLAND=1581/);
  assert.match(page, /var WORLD_N=110/);
  assert.match(page, /var GWP_N2O=273/);
  assert.match(page, /value="8\.2"/);
  assert.match(page, /value="100"/);
  assert.match(page, /value="36"/);
  assert.match(page, /value="1\.0"/);
  assert.match(instrument, /ipcc-nggip\.iges\.or\.jp/);
  assert.match(instrument, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'bearth.mark', 'bearth.bee.calm', 'bearth.land.share', 'bearth.bee.support',
    'bearth.bee.land', 'bearth.bee.deeper', 'bearth.raver.feel', 'bearth.raver.touch',
    'bearth.raver.consciousness'
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
  assert.match(page, /N₂O emission-factor dial/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  assert.doesNotMatch(bee, /N₂O|N2O|IPCC|REFUTED/);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, /N₂O|IPCC|REFUTED/);
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
      querySelector(s) { return this.querySelectorAll(s)[0] || null; },
      querySelectorAll(s) {
        return this.children.flatMap(c => [c, ...c.querySelectorAll('*')]).filter(n => matches(n, s));
      },
      appendChild(n) { n.parentElement = this; this.children.push(n); return n; },
      addEventListener(k, fn) { (this.listeners[k] ??= []).push(fn); },
      getAttribute(name) {
        if (name === 'data-reg') return this.dataset.reg;
        if (name === 'data-bearth-beat') return this.dataset.bearthBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-bearth-beat') this.dataset.bearthBeat = value;
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
    if (selector === '[data-bearth-go]') return Boolean(e.attrs['data-bearth-go']);
    return false;
  }
  const document = {
    body: element('body'),
    activeElement: null,
    querySelectorAll: s => all.filter(e => matches(e, s)),
    querySelector: s => all.find(e => matches(e, s)) || null,
    getElementById: id => all.find(e => e.attrs.id === id) || null,
    createElement: element,
    addEventListener: (k, fn) => { (events[k] ??= []).push(fn); }
  };
  document.body.dataset.reg = 'bee';
  document.body.dataset.bearthBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-bearth-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  const pop = element('input'); pop.attrs.id = 'pop'; pop.value = '8.2';
  const gday = element('input'); gday.attrs.id = 'gday'; gday.value = '100';
  const rec = element('input'); rec.attrs.id = 'rec'; rec.value = '36';
  const yld = element('input'); yld.attrs.id = 'yld'; yld.value = '1.0';
  const nrate = element('input'); nrate.attrs.id = 'nrate'; nrate.value = '130';
  const ef = element('select'); ef.attrs.id = 'ef'; ef.value = '0.0100';
  for (const n of [pop, gday, rec, yld, nrate, ef]) {
    n.addEventListener = function(k, fn){ (this.listeners[k] ??= []).push(fn); };
  }
  const landComb = element('div'); landComb.attrs.id = 'land-comb';
  const combs = element('div'); combs.attrs.id = 'combs';
  const hbig = element('div'); hbig.attrs.id = 'hbig';
  const hsub = element('div'); hsub.attrs.id = 'hsub';
  const landLive = element('p'); landLive.attrs.id = 'land-live';
  const landSupport = element('p'); landSupport.attrs.id = 'land-support';
  const out = element('div'); out.attrs.id = 'out';
  const cmp = element('div'); cmp.attrs.id = 'cmp';
  const animals = element('table'); animals.attrs.id = 'animals';
  animals.tBodies = [{ innerHTML: '' }];
  const ctx = { document, Map, Math, window: {} };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-bearth-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-bearth-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-bearth-beat'), 'arrival');
  assert.equal(theme.content, '#0c120e');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-bearth-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
