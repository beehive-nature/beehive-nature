/* Source + small DOM-boundary checks for bFood's three first paints.
   Same Hexagon instrument — views change first paint, not facts.
   LIABILITY FENCE: New bee / Raver first paints are measurement grammar only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/bfood.html');
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

const OUTCOME = /Lancet|GRADE|all-cause mortality|coronary heart disease|type 2 diabetes|colorectal cancer|stroke mortality|PDCAAS|DIAAS/;
const INSTRUMENT = /id="sex"|id="age"|id="ht"|id="wt"|id="pal"|id="tab"|id="you"|class="bar"/;

test('New bee first paint is one calm sentence, one takeaway, and one choice', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /This is your food, drawn honestly — for your body, not an average person\./);
  assert.match(bee, /A blank stays blank — never drawn as zero\./);
  assert.match(bee, /Where science doesn't know a number, the cell says so\./);
  assert.match(bee, /Draw my hexagon/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /<input|<select|type="range"/i);
  assert.doesNotMatch(bee, /<table/i);
  assert.doesNotMatch(bee, OUTCOME);
  assert.doesNotMatch(bee, INSTRUMENT);
  assert.doesNotMatch(bee, /spreadsheet|NotMeasured ≠ 0|n\/m/);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-bfood-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-bfood-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-draw,#layer-inputs,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="bfood.foot.measure">composition and published reference intakes only<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="hex-scene"/);
  assert.match(raver, /A living hexagon in a soft plant-body wash from biomass green through teal into purple/);
  assert.match(raver, /What if the plate told the truth — including the blanks\?/);
  assert.match(raver, /Touch the drawing/);
  assert.doesNotMatch(raver, /A blank that stayed blank is reverence/);
  assert.doesNotMatch(raver, /<input|<select|type="range"/i);
  assert.doesNotMatch(raver, /<table/i);
  assert.doesNotMatch(raver, OUTCOME);
  assert.doesNotMatch(raver, INSTRUMENT);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bfood-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and New bee choice sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /A blank that stayed blank is reverence — not a zero\./);
  assert.match(figure, /A blank stays blank — never drawn as zero\./);
  assert.match(figure, /Draw my hexagon/);
  assert.match(figure, /Go deeper/);
  assert.doesNotMatch(figure, OUTCOME);
  assert.doesNotMatch(figure, INSTRUMENT);
  assert.match(page, /body\[data-reg="raver"\]\[data-bfood-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Draw my hexagon is one calm step — no five dials and no 40-cell ledger on that beat', () => {
  const draw = extractById(page, 'layer-draw');
  assert.match(draw, /id="calm-hex"/);
  assert.match(draw, /Seven cells\. Some filled\. One blank on purpose\./);
  assert.match(draw, /Open the inputs/);
  assert.doesNotMatch(draw, /<input|<select/i);
  assert.doesNotMatch(draw, /<table/i);
  assert.doesNotMatch(draw, OUTCOME);
  assert.doesNotMatch(draw, INSTRUMENT);
  assert.match(page, /body\[data-bfood-beat="draw"\] #layer-draw\{display:block\}/);
  assert.match(page, /body\[data-bfood-beat="inputs"\] #layer-inputs\{display:block\}/);
  const inputs = extractById(page, 'layer-inputs');
  assert.match(inputs, /id="you"/);
  assert.match(inputs, /id="sex"/);
  assert.doesNotMatch(inputs, /id="tab"/);
  assert.doesNotMatch(inputs, /id="comb"/);
  assert.doesNotMatch(inputs, /PDCAAS|The Lancet|GRADE/);
});

test('Cypherpunk still reaches the full Hexagon instrument, same constants and sources', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /id="comb"/);
  assert.match(instrument, /id="tab"/);
  assert.match(instrument, /id="basket"/);
  assert.match(instrument, /PDCAAS/);
  assert.match(instrument, /The Lancet/);
  assert.match(instrument, /GRADE/);
  assert.match(instrument, /all-cause mortality/);
  assert.match(instrument, /lauric/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(page, /id="sex"/);
  assert.match(page, /id="age"/);
  assert.match(page, /id="ht"/);
  assert.match(page, /id="wt"/);
  assert.match(page, /id="pal"/);
  assert.match(page, /var NUT=/);
  assert.match(page, /var FOODS=/);
  assert.match(page, /function render\(\)/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'bfood.mark', 'bfood.pair', 'bfood.bee.calm', 'bfood.bee.takeaway', 'bfood.bee.support',
    'bfood.bee.draw', 'bfood.bee.deeper', 'bfood.raver.feel', 'bfood.raver.touch',
    'bfood.raver.consciousness', 'bfood.draw.caption', 'bfood.draw.continue',
    'bfood.foot.measure', 'bfood.foot.learn'
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
  assert.match(page, /NotMeasured \(dashed, empty, n\/m/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  assert.doesNotMatch(bee, OUTCOME);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, OUTCOME);
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
        if (name === 'data-bfood-beat') return this.dataset.bfoodBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-bfood-beat') this.dataset.bfoodBeat = value;
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
    if (selector === '[data-bfood-go]') return Boolean(e.attrs['data-bfood-go']);
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
  document.body.dataset.bfoodBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-bfood-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  for (const id of ['sex','age','ht','wt','pal','derived','comb','key','vbig','vtxt','tab','ulnote','fat','arb','diaas','quests','src','basket']) {
    const n = element(id === 'tab' ? 'table' : id === 'sex' || id === 'pal' ? 'select' : 'div');
    n.attrs.id = id;
    if (id === 'sex') n.value = 'm';
    if (id === 'age') n.value = '49';
    if (id === 'ht') n.value = '180';
    if (id === 'wt') n.value = '80';
    if (id === 'pal') n.value = '1';
    if (id === 'tab') n.tBodies = [{ innerHTML: '', appendChild(){ return {}; } }];
    document.body.appendChild(n);
  }
  for (const id of ['g-hemp','g-chlo','g-coco','g-spir']) {
    const n = element('input');
    n.attrs.id = id;
    n.value = id === 'g-hemp' ? '100' : id === 'g-chlo' ? '5' : id === 'g-coco' ? '15' : '10';
    n.dataset.auto = id === 'g-hemp' ? 'on' : '';
    document.body.appendChild(n);
  }
  const ctx = { document, Map, Math, URL, location: { href: 'http://127.0.0.1:8765/bfood.html' }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-bfood-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-bfood-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-bfood-beat'), 'arrival');
  assert.equal(theme.content, '#0c1412');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-bfood-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
