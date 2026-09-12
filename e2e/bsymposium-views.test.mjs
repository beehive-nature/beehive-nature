/* Source + small DOM-boundary checks for bSymposium's three first paints.
   Same dual-receipted discourse — views change first paint, not facts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/bsymposium.html');
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

const DENSE = /Federal Register|EO 14212|90 FR|Axis B|five co-creations|dual-receipt|◐|N₂O|N2O|IPCC/;

test('New bee first paint is one calm sentence, one takeaway, and one choice', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /Two projects care about the same plate\. This page puts them side by side — with a receipt for every claim\./);
  assert.match(bee, /Not a winner — where they strengthen each other\./);
  assert.match(bee, /The leftover questions wait on evidence both sides can check\./);
  assert.match(bee, /See where they meet/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /<table/i);
  assert.doesNotMatch(bee, DENSE);
  assert.doesNotMatch(bee, /settlement/);
  assert.doesNotMatch(bee, /Homeostasis/);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-bsymp-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-bsymp-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-meet,#instrument\{display:none\}/);
  assert.match(page, /<span data-reg="cypherpunk"> · founder-directed discourse/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="listen-scene"/);
  assert.match(raver, /Two voices at one shared plate in a soft room/);
  assert.match(raver, /What if we listened to each other about food\?/);
  assert.match(raver, /Sit with both sides/);
  assert.doesNotMatch(raver, /Homeostasis — each protocol making the other stronger/);
  assert.doesNotMatch(raver, /<table/i);
  assert.doesNotMatch(raver, DENSE);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bsymp-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and New bee choice sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /Homeostasis — each protocol making the other stronger/);
  assert.match(figure, /Not a winner — where they strengthen each other\./);
  assert.match(figure, /See where they meet/);
  assert.match(figure, /Go deeper/);
  assert.match(page, /body\[data-reg="raver"\]\[data-bsymp-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Cypherpunk still reaches the full discourse instrument, same receipts and rows', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /id="rows"/);
  assert.match(instrument, /THE CHARTER/);
  assert.match(instrument, /five co-creations, ready to start/);
  assert.match(instrument, /cite or the row stays silent/);
  assert.match(instrument, /Federal Register/);
  assert.match(instrument, /EO 14212/);
  assert.match(instrument, /Axis B/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(page, /var ROWS=/);
  assert.match(page, /ROWS\.forEach/);
  assert.match(instrument, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'bsymp.mark', 'bsymp.pair', 'bsymp.bee.calm', 'bsymp.bee.takeaway', 'bsymp.bee.support',
    'bsymp.bee.meet', 'bsymp.bee.deeper', 'bsymp.raver.feel', 'bsymp.raver.sit',
    'bsymp.raver.consciousness', 'bsymp.meet.maha', 'bsymp.meet.bfood', 'bsymp.meet.together'
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
  assert.match(page, /Federal Register, govinfo/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  assert.doesNotMatch(bee, DENSE);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, DENSE);
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
        if (name === 'data-bsymp-beat') return this.dataset.bsympBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-bsymp-beat') this.dataset.bsympBeat = value;
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
    if (selector === '[data-bsymp-go]') return Boolean(e.attrs['data-bsymp-go']);
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
  document.body.dataset.bsympBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-bsymp-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  const rows = element('table'); rows.attrs.id = 'rows';
  rows.tBodies = [{ appendChild(){}, innerHTML: '' }];
  const srcs = element('div'); srcs.attrs.id = 'srcs';
  const ctx = { document, Map, Math, URL, location: { href: 'http://127.0.0.1:8765/bsymposium.html' }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-bsymp-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-bsymp-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-bsymp-beat'), 'arrival');
  assert.equal(theme.content, '#16120e');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-bsymp-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
