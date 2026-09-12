/* Source + small DOM-boundary checks for the dynasty profile three first paints.
   Same published records — views change first paint, not the houses.
   LIABILITY FENCE: published snapshots, not a profile editor, not a live
   presence list. Guest can read with no wallet. No enrichment APIs.
   Cite-or-silent. Date disagreements stay printed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/profile.html');
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
  const start = html.indexOf('function restoreVisibleFocus');
  const end = html.indexOf('applyReading();');
  assert.ok(start > 0 && end > start, 'beat machine must sit above boot');
  return 'var $=function(i){return document.getElementById(i);};\n'
    + html.slice(start, end) + '\napplyReading();\n';
}

const FENCE = /0x[0-9A-Fa-f]{8}|online now|last-seen|who's in the room|profile editor|CREATE2|generation 2/i;

test('New bee first paint is one calm sentence, one takeaway, and three doors', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /These are published name records — who holds a house — not a chat list and not a profile editor\./);
  assert.match(bee, /You can read as a guest with no wallet\. A lost key stays lost; a name is a lease\./);
  assert.match(bee, /data-prof-go="house"/);
  assert.match(bee, /Read the founder house/);
  assert.match(bee, /href="buzz-directory\.html"/);
  assert.match(bee, /People journey/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /0x[0-9A-Fa-f]{8}/);
  assert.doesNotMatch(bee, /bqueenbee\.base\.eth|bClaude\.a|bloverai|guest\.citizen/);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-prof-beat="arrival" data-experience="profile">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-prof-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /<span data-i18n="prof\.foot\.door">Published records\. A guest can read with no wallet\.<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="lantern-scene"/);
  assert.match(raver, /One name, every generation kept\. Nothing quietly rewritten\./);
  assert.match(raver, /Open a house story/);
  assert.doesNotMatch(raver, /0x[0-9A-Fa-f]{8}/);
  assert.doesNotMatch(raver, /<table/i);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-prof-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('founder house beat is one story door — not a multi-house wallet grid', () => {
  const house = extractById(page, 'layer-house');
  assert.match(house, /skaists — the founder house/);
  assert.match(house, /Travis Mark Remington holds this house/);
  assert.doesNotMatch(house, /0x[0-9A-Fa-f]{8}/);
  assert.doesNotMatch(house, /bqueenbee\.base\.eth|bClaude\.a|bloverai|guest\.citizen|北方國王/);
  assert.doesNotMatch(house, /generation 1|generation 2|Name history/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-prof-beat="house"\] #layer-house\{display:block\}/);
});

test('Raver tap opens art first; ledger one tap away', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /Names are stories\. Holders are portraits/);
  assert.match(figure, /The ledger waits one tap away/);
  assert.doesNotMatch(figure, /0x[0-9A-Fa-f]{8}/);
  assert.match(page, /body\[data-reg="raver"\]\[data-prof-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Cypherpunk still reaches the full house instrument, same honesty', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /1 · record law/);
  assert.match(instrument, /Published snapshots/);
  assert.match(instrument, /2 · append-only holder ledger/);
  assert.match(instrument, /3 · house instrument/);
  assert.match(instrument, /id="name-record-1"/);
  assert.match(instrument, /skaists/);
  assert.match(instrument, /bqueenbee\.base\.eth/);
  assert.match(instrument, /bClaude\.a/);
  assert.match(instrument, /bloverai\.base\.eth/);
  assert.match(instrument, /北方國王bclaude\.base\.eth/);
  assert.match(instrument, /北方國王zbcode\.base\.eth/);
  assert.match(instrument, /guest\.citizen/);
  assert.match(instrument, /0xFbD201472d5A439f1F0E408EB5dfaF6eA3687876/);
  assert.match(instrument, /4 · key \/ name separation/);
  assert.match(instrument, /Name and key must never share a single point of failure/);
  assert.match(instrument, /5 · guest citizenship/);
  assert.match(instrument, /6 · agent bounds/);
  assert.match(instrument, /page-local knowledge base/);
  assert.match(instrument, /7 · date reconciliation honesty/);
  assert.match(instrument, /29 August 2026/);
  assert.match(instrument, /27 August 2026/);
  assert.match(instrument, /data-view-disclosure="history"/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.doesNotMatch(instrument, /people online|currently online|X members online/i);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, /if\(reading==='cypherpunk'\) beat='deeper'/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #instrument\{display:block\}/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'prof.mark', 'prof.bee.calm', 'prof.bee.takeaway', 'prof.bee.house',
    'prof.bee.back', 'prof.raver.feel', 'prof.raver.tap',
    'prof.raver.consciousness', 'prof.house.lead', 'prof.house.holder',
    'prof.foot.door'
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
  assert.match(page, /<script src="tour\.js\?v=\d+"><\/script>/);
  assert.match(page, /\[data-reg\]:not\(body\)\{display:none\}/);
  assert.match(page, /body\[data-reg="bee"\] \[data-reg="bee"\],\s*body\[data-reg="raver"\] \[data-reg="raver"\],\s*body\[data-reg="cypherpunk"\] \[data-reg="cypherpunk"\]\{display:revert\}/);
  assert.match(page, /class="sub" data-reg="cypherpunk"/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.match(tour, /assetBase\+'register\.js\?v=\d+'/);
  assert.match(tour, /assetBase\+'lang\.js\?v=\d+'/);
  assert.match(register, /an authored theme can use data-bee-theme="custom"/);
});

test('beats and history disclosure remember per view instead of resetting', () => {
  assert.match(page, /var readingChoices=new Map\(\)/);
  assert.match(page, /var beatChoices=new Map\(\)/);
  assert.match(page, /function restoreVisibleFocus\(focus\)/);
  assert.match(page, /function applyReading\(event\)/);

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
      closest(s) {
        for (let n = this; n; n = n.parentElement) if (matches(n, s)) return n;
        return null;
      },
      getAttribute(name) {
        if (name === 'data-reg') return this.dataset.reg;
        if (name === 'data-prof-beat') return this.dataset.profBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-prof-beat') this.dataset.profBeat = value;
        this.attrs[name] = value;
      },
      focus({preventScroll} = {}) { document.activeElement = this; this.preventScroll = preventScroll; }
    };
    all.push(e);
    return e;
  }
  function matches(e, selector) {
    if (selector === 'summary') return e.tagName === 'SUMMARY';
    if (selector === '[data-view-disclosure]') return Boolean(e.dataset.viewDisclosure);
    if (selector === 'meta[name="theme-color"]') return e.tagName === 'META' && e.attrs.name === 'theme-color';
    if (selector === '[data-dir-go],[data-prof-go]') return Boolean(e.attrs['data-dir-go'] || e.attrs['data-prof-go']);
    return false;
  }
  const document = {
    body: element('body'),
    activeElement: null,
    querySelectorAll: s => all.filter(e => matches(e, s)),
    querySelector: s => all.find(e => matches(e, s)) || null,
    getElementById: id => all.find(e => e.attrs.id === id) || null,
    addEventListener: (k, fn) => { (events[k] ??= []).push(fn); }
  };
  document.body.dataset.reg = 'bee';
  document.body.dataset.profBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-prof-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const history = element('details');
  history.dataset.viewDisclosure = 'history';
  history.appendChild(element('summary'));
  document.body.appendChild(history);
  const goHouse = element('button');
  goHouse.attrs['data-prof-go'] = 'house';
  document.body.appendChild(goHouse);
  const ctx = { document, Map, location: { hash: '' } };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(history.open, false, 'New bee default: history collapsed');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(history.open, true, 'cypherpunk default: history open');
  assert.equal(document.body.getAttribute('data-prof-beat'), 'deeper');
  for (const fn of events.click || []) fn({ target: goHouse });
  assert.equal(document.body.getAttribute('data-prof-beat'), 'deeper', 'cypherpunk refuses a house trim');
  history.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-prof-beat'), 'arrival');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(history.open, false, 'returning to cypherpunk restores collapsed history');
});
