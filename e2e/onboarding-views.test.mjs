/* Source + small DOM-boundary checks for onboarding's three first paints.
   Same join ceremony — views change first paint, not the custody facts.
   LIABILITY FENCE: never custody theater. Seat prepares UNSIGNED only.
   Preview prop words ≠ backup. ZERO b = self-funded law, not a starter grant.
   PLANNED / REFUSED / SIMULATED / Declared vs Known stay honest. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/onboarding/index.html');
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

const FENCE = /SIMULATED|PLANNED|REFUSED|wallet-relay|LARVA|PUPA|ROYAL GUARD|T-F|AIR-GAP|FIDO2|did:webvh|bchip|id="lang"|I'm new here — start free|preview prop|starter grant/i;

test('New bee first paint is one calm sentence, one takeaway, and one short CTA', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /This is how you join the hive — your keys stay yours; nobody in between holds them for you\./);
  assert.match(bee, /Start free in this browser in about two minutes\. You can add stronger custody later; your identity does not restart\./);
  assert.match(bee, /I'm new/);
  assert.match(bee, />Start free</);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /I'm new here — start free/);
  assert.doesNotMatch(bee, FENCE);
  assert.doesNotMatch(bee, /<select|id="lang"|LARVA|Trezor Connect|recovery phrase/i);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-onb-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-onb-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-choice,#layer-figure,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="onb.foot.door">Your keys stay yours\. Nobody here holds them\.<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and Step in', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="threshold-scene"/);
  assert.match(raver, /come as you are — the floor already said accept you/);
  assert.match(raver, /Step in/);
  assert.doesNotMatch(raver, /One soft door into your own keys/);
  assert.doesNotMatch(raver, /<select|id="lang"/i);
  assert.doesNotMatch(raver, FENCE);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-onb-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('Start free discloses one plain custody choice and one real-vs-preview line', () => {
  const choice = extractById(page, 'layer-choice');
  assert.match(choice, /Hold your keys on this device — face, fingerprint, or Windows Hello/);
  assert.match(choice, /labeled preview on a static host/);
  assert.match(choice, /Preview is not a completed join/);
  assert.match(choice, /Continue with this device/);
  assert.doesNotMatch(choice, /LARVA|PUPA|ROYAL GUARD|T-F|AIR-GAP|FIDO2|Trezor|did:webvh|recovery phrase|bchip/i);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-onb-beat="choice"\] #layer-choice\{display:block\}/);
});

test('Step in opens one vivid custody choice behind the tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /One soft door into your own keys — no app store, no account desk, no one holding the bag\./);
  assert.match(figure, /labeled preview unless a live wallet host is serving it/);
  assert.match(figure, /Preview is not a completed join/);
  assert.doesNotMatch(figure, /LARVA|PUPA|ROYAL GUARD|id="lang"|wallet-relay/i);
  assert.match(page, /body\[data-reg="raver"\]\[data-onb-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Cypherpunk still reaches the full ceremony instrument, same honesty', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /id="instrument-map"/);
  assert.match(instrument, /data-onb-jump="welcome"/);
  assert.match(instrument, /data-onb-jump="returning"/);
  assert.match(instrument, /data-onb-jump="custody"/);
  assert.match(instrument, /data-onb-jump="passkey"/);
  assert.match(instrument, /data-onb-jump="optical"/);
  assert.match(instrument, /data-onb-jump="trezor"/);
  assert.match(instrument, /data-onb-jump="recovery"/);
  assert.match(instrument, /data-onb-jump="ready"/);
  assert.match(instrument, /data-onb-jump="net"/);
  assert.match(instrument, /data-onb-jump="seams"/);
  assert.match(instrument, /id="net"/);
  assert.match(instrument, /wallet-relay/);
  assert.match(instrument, /SIMULATED/);
  assert.match(instrument, /PLANNED\/REFUSED/);
  assert.match(instrument, /skaists\.dev static host does not complete WebAuthn\/Trezor native/);
  assert.doesNotMatch(instrument, /id="lang"/);
  assert.match(page, /I'm new here — start free →/);
  assert.match(page, /const LADDER = \[/);
  assert.match(page, /rung:'🐛 LARVA · T-F'/);
  assert.match(page, /rung:'AIR-GAP · T-H-grade'/);
  assert.match(page, /rung:'🛡 PUPA · T-F roaming'/);
  assert.match(page, /rung:'🐝 BEE → 👑 ROYAL GUARD'/);
  assert.match(page, /doPasskey/);
  assert.match(page, /trezorNativeReal/);
  assert.match(page, /verifyReply/);
  assert.match(page, /These 12 words are stage props/);
  assert.match(page, /seams\(\)\{ return `/);
  assert.match(page, /Cite-or-silent/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, /if\(reading==='cypherpunk'\) beat='deeper'/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #instrument\{display:flex/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'onb.mark', 'onb.pair', 'onb.bee.calm', 'onb.bee.takeaway', 'onb.bee.support',
    'onb.bee.start', 'onb.bee.deeper', 'onb.bee.choice', 'onb.bee.preview',
    'onb.bee.continue', 'onb.raver.feel', 'onb.raver.tap', 'onb.raver.choice',
    'onb.raver.preview', 'onb.foot.door'
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

test('language-first shell hosts register and language; local #lang is retired', () => {
  assert.match(page, /<script src="\.\.\/tour\.js\?v=41"><\/script>/);
  assert.match(page, /\[data-reg\]:not\(body\)\{display:none\}/);
  assert.match(page, /body\[data-reg="bee"\] \[data-reg="bee"\],\s*body\[data-reg="raver"\] \[data-reg="raver"\],\s*body\[data-reg="cypherpunk"\] \[data-reg="cypherpunk"\]\{display:revert\}/);
  assert.doesNotMatch(page, /id="lang"|APP\.setLang|onchange="APP\.setLang/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"|id="net"/);
  assert.doesNotMatch(bee, FENCE);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, FENCE);
  assert.match(tour, /assetBase\+'register\.js\?v=9'/);
  assert.match(tour, /assetBase\+'lang\.js\?v=25'/);
  assert.match(register, /an authored theme can use data-bee-theme="custom"/);
});

test('beats remember per view and Cypherpunk refuses a first-paint trim', () => {
  assert.match(page, /var beatChoices=new Map\(\)/);
  assert.match(page, /function restoreVisibleFocus\(focus\)/);
  assert.match(page, /function applyReading\(event\)/);
  assert.match(page, /document\.addEventListener\('bregister',applyReading\)/);
  assert.match(page, /function jumpInstrument\(id\)/);
  assert.match(page, /function enterPlain\(id\)/);

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
      hasAttribute(name) { return this.getAttribute(name) != null; },
      getAttribute(name) {
        if (name === 'data-reg') return this.dataset.reg;
        if (name === 'data-onb-beat') return this.dataset.onbBeat;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-onb-beat') this.dataset.onbBeat = value;
        this.attrs[name] = value;
      },
      focus({preventScroll} = {}) { document.activeElement = this; this.preventScroll = preventScroll; },
      scrollIntoView() { this.scrolled = true; }
    };
    all.push(e);
    return e;
  }
  function matches(e, selector) {
    if (selector === 'meta[name="theme-color"]') return e.tagName === 'META' && e.attrs.name === 'theme-color';
    if (selector === '[data-onb-go]') return Boolean(e.attrs['data-onb-go']);
    if (selector === '[data-onb-enter]') return Boolean(e.attrs['data-onb-enter']);
    if (selector === '[data-onb-jump]') return Boolean(e.attrs['data-onb-jump']);
    if (selector === '[data-onb-go],[data-onb-enter],[data-onb-jump]') {
      return Boolean(e.attrs['data-onb-go'] || e.attrs['data-onb-enter'] || e.attrs['data-onb-jump']);
    }
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
  document.body.dataset.onbBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-onb-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  for (const id of ['first-bee','first-raver','layer-choice','layer-figure','instrument','stage','net']) {
    const n = element(id === 'stage' ? 'main' : 'div');
    n.attrs.id = id;
    document.body.appendChild(n);
  }
  const goChoice = element('button');
  goChoice.attrs['data-onb-go'] = 'choice';
  document.body.appendChild(goChoice);
  const goDeeper = element('button');
  goDeeper.attrs['data-onb-go'] = 'deeper';
  document.body.appendChild(goDeeper);
  const goes = [];
  const picks = [];
  const ctx = {
    document, Map, Math, URL,
    location: { href: 'http://127.0.0.1:8765/onboarding/index.html', hash: '' },
    window: {},
    APP: {
      current: 'welcome', ctx: { persona: null, custody: null }, hist: [],
      go(screen) { goes.push(screen); this.current = screen; },
      pick(id) { picks.push(id); this.current = id; }
    },
    SCREENS: { welcome(){return 'w';}, custody(){return 'c';}, passkey(){return 'p';}, hardware(){return 'h';} },
    render() {}
  };
  ctx.window.APP = ctx.APP;
  const start = page.indexOf('function restoreVisibleFocus');
  const end = page.indexOf('applyReading();\n(function bootHash');
  assert.ok(start > 0 && end > start, 'beat machine must sit above hash boot');
  vm.createContext(ctx);
  vm.runInContext(page.slice(start, end) + '\napplyReading();\n', ctx);
  assert.equal(document.body.getAttribute('data-onb-beat'), 'arrival');
  for (const fn of events.click || []) fn({ target: goChoice });
  assert.equal(document.body.getAttribute('data-onb-beat'), 'choice');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(document.body.getAttribute('data-onb-beat'), 'deeper');
  assert.equal(theme.content, '#06110C');
  for (const fn of events.click || []) fn({ target: goChoice });
  assert.equal(document.body.getAttribute('data-onb-beat'), 'deeper', 'cypherpunk refuses a choice trim');
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-onb-beat'), 'arrival');
  assert.equal(theme.content, '#0c1412');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-onb-beat'), 'choice', 'New bee remembers the Start free beat');
});
