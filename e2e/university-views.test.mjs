/* Source + small DOM-boundary checks for Beehive University's three first paints.
   Same literacy instrument — views change first paint, not the receipts.
   LIABILITY FENCE: education / cite-or-silent only. Quest arithmetic is a
   hypothesis receipt you compose and hold (tier 0 plan ≠ tier 3 assay).
   Cannabis framing off first paint. No outcome theater. Open gates stay exhibits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/university/index.html');
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
  const end = html.indexOf('/* boot */');
  assert.ok(start > 0 && end > start, 'beat machine must sit above boot');
  return 'var $=function(i){return document.getElementById(i);};\n'
    + html.slice(start, end) + '\nfunction renderReg(){}\napplyReading();\n';
}

const FENCE = /THE CHARTER|father language|mother language|student language|#q-wt|id="gradProse"|id="transcript"|U-1|U-2|U-3|\bLOQ\b|\bEAR\b|ΔE|Poseidon|cannabis|#rg-bee|#rg-raver|#rg-cyper|function setReg|healthier|prove-adequacy|graduate holds/i;

test('New bee first paint is one calm sentence, one takeaway, and one choice', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /Beehive University teaches you to read this estate.s own receipts — every lesson ends in a signed act you hold, not a certificate\./);
  assert.match(bee, /You learn evidence literacy by checking <i>our<\/i> lab panels, requirement bars, and chain reads — with sources, or silence\./);
  assert.match(bee, /Sources, or silence — never a certificate\./);
  assert.match(bee, /Start with a lab report/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /how to read a lab report \(/);
  assert.doesNotMatch(bee, FENCE);
  assert.doesNotMatch(bee, /<input|<select|type="range"/i);
  assert.doesNotMatch(bee, /<table/i);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-uni-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-uni-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-lesson,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="uni.foot.door">Education — cite, or silent\.<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="floor-scene"/);
  assert.match(raver, /the curriculum is the receipts — a quiet floor where every lesson ends in something you can hold/);
  assert.match(raver, /Feel the first act/);
  assert.doesNotMatch(raver, /Not a content silo/);
  assert.doesNotMatch(raver, /<input|<select|type="range"/i);
  assert.doesNotMatch(raver, /<table/i);
  assert.doesNotMatch(raver, FENCE);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-uni-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and honest receipt sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /Not a content silo — a room where checking our own material is the dance\./);
  assert.match(figure, /Three moves on one of <i>our<\/i> lab panels/);
  assert.match(figure, /RECEIPT_CANNABINOID_PANEL_UNDERCOUNT_2026-08-20/);
  assert.match(figure, /opens in a new tab/);
  assert.match(figure, /Go deeper/);
  assert.doesNotMatch(figure, /id="q-wt"|id="gradProse"|id="tlines"|U-1/);
  assert.match(page, /body\[data-reg="raver"\]\[data-uni-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Start with a lab report is one first-lesson beat — not charter, quests, gates, or graduation', () => {
  const lesson = extractById(page, 'layer-lesson');
  assert.match(lesson, /how to read a lab report/);
  assert.match(lesson, /A lab report is a photograph of one sample, taken by one method, at one sensitivity\./);
  assert.match(lesson, /what was measured/);
  assert.match(lesson, /below the floor/);
  assert.match(lesson, /RECEIPT_CANNABINOID_PANEL_UNDERCOUNT_2026-08-20/);
  assert.doesNotMatch(lesson, /THE CHARTER|father language|#q-wt|GRADUATION|THE TRANSCRIPT|U-1|U-2|U-3|\bLOQ\b|\bEAR\b|ΔE|Poseidon/);
  assert.doesNotMatch(lesson, /id="rg-bee"|function setReg/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-uni-beat="lesson"\] #layer-lesson\{display:block\}/);
});

test('Cypherpunk still reaches the full literacy instrument, same grammar and honesty', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /THE CHARTER — what this is, and what it is not/);
  assert.match(instrument, /COMMISSION_BEEHIVE_UNIVERSITY_2026-08-20/);
  assert.match(instrument, /SERVING-BASIS-1/);
  assert.match(instrument, /id="father"/);
  assert.match(instrument, /id="mother"/);
  assert.match(instrument, /id="students"/);
  assert.match(instrument, /THE QUESTS/);
  assert.match(instrument, /1\.25 g per kg/);
  assert.match(instrument, /id="q-wt"/);
  assert.match(instrument, /GRADUATION — the credential nobody can print/);
  assert.match(instrument, /id="gradProse"/);
  assert.match(instrument, /\[bX review\]/);
  assert.match(instrument, /id="transcript"/);
  assert.match(instrument, /localStorage/);
  assert.match(instrument, /U-1/);
  assert.match(instrument, /U-2/);
  assert.match(instrument, /U-3/);
  assert.match(instrument, /RULED — the receipt is the whole credential/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(page, /var COURSES=/);
  assert.match(page, /id:'c1'/);
  assert.match(page, /id:'c7'/);
  assert.match(page, /sec\.setAttribute\('data-uni-injected','course'\)/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, /if\(reading==='cypherpunk'\) beat='deeper'/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : \(beatChoices\.get\(reading\)\|\|defaultBeat\(reading\)\)/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #instrument\{display:block\}/);
  assert.match(page, /opens in a new tab/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'uni.mark', 'uni.pair', 'uni.bee.calm', 'uni.bee.takeaway', 'uni.bee.support',
    'uni.bee.start', 'uni.bee.deeper', 'uni.raver.feel', 'uni.raver.tap',
    'uni.raver.consciousness', 'uni.lesson.name', 'uni.lesson.lead', 'uni.opens',
    'uni.foot.door', 'uni.foot.learn', 'uni.foot.verify'
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
  assert.match(page, /<script src="\.\.\/tour\.js\?v=41"><\/script>/);
  assert.match(page, /\[data-reg\]:not\(body\)\{display:none\}/);
  assert.match(page, /body\[data-reg="bee"\] \[data-reg="bee"\],\s*body\[data-reg="raver"\] \[data-reg="raver"\],\s*body\[data-reg="cypherpunk"\] \[data-reg="cypherpunk"\]\{display:revert\}/);
  assert.match(page, /class="sub" data-reg="cypherpunk"/);
  assert.doesNotMatch(page, /id="rg-bee"|id="rg-raver"|id="rg-cyper"|function setReg|onclick="setReg/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  assert.doesNotMatch(bee, FENCE);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, FENCE);
  assert.match(tour, /assetBase\+'register\.js\?v=9'/);
  assert.match(tour, /assetBase\+'lang\.js\?v=25'/);
});

test('beats and sources disclosure remember per view instead of resetting', () => {
  assert.match(page, /var readingChoices=new Map\(\)/);
  assert.match(page, /var beatChoices=new Map\(\)/);
  assert.match(page, /function restoreVisibleFocus\(focus\)/);
  assert.match(page, /function applyReading\(event\)/);
  assert.match(page, /document\.addEventListener\('bregister',applyReading\)/);
  assert.match(tour, /register\.js\?v=9/);
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
        if (name === 'data-uni-beat') return this.dataset.uniBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-uni-beat') this.dataset.uniBeat = value;
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
    if (selector === '[data-uni-go]') return Boolean(e.attrs['data-uni-go']);
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
  document.body.dataset.uniBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-uni-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  for (const id of ['father','mother','students','q-wt','gradProse','tlines','courses']) {
    const n = element(id === 'father' ? 'select' : id === 'q-wt' ? 'input' : 'div');
    n.attrs.id = id;
    document.body.appendChild(n);
  }
  const goLesson = element('button');
  goLesson.attrs['data-uni-go'] = 'lesson';
  document.body.appendChild(goLesson);
  const ctx = {
    document, Map, Math, URL,
    location: { href: 'http://127.0.0.1:8765/university/index.html' },
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-uni-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-uni-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  for (const fn of events.click || []) fn({ target: goLesson });
  assert.equal(document.body.getAttribute('data-uni-beat'), 'deeper', 'cypherpunk refuses a lesson trim');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-uni-beat'), 'arrival');
  assert.equal(theme.content, '#0c1412');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-uni-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
