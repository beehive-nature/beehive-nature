/* Fixture checks for the two-tab room's three presentations.
   Source + small DOM-boundary only — not a live two-tab BroadcastChannel
   receipt or a rendered-device acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const room = read('surfaces/forge/room.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const hexfield = read('surfaces/forge/hexfield.html');

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

function coreOf(html) {
  return html.match(/\/\/ ---- CORE START ----([\s\S]*?)\/\/ ---- CORE END ----/)?.[1] || '';
}

test('New bee is a cream room with rem type, a calm lead, and 44px primary knobs', () => {
  assert.match(room, /<body data-reg="bee" data-bee-theme="custom">/);
  assert.match(room, /<meta name="theme-color" content="#f6f7f2">/);
  assert.match(room, /body\[data-reg=bee\]\{[^}]*background:#f6f7f2/);
  assert.match(room, /body\[data-reg=bee\]\{[^}]*font:1\.125rem/);
  assert.match(room, /Open a second tab\. Turn a knob\. Watch it move\./);
  assert.match(room, /<span data-view="bee" data-i18n="room.title">The two-tab room<\/span>/);
  assert.match(room, /body\[data-reg=bee\] input,body\[data-reg=bee\] button\{min-height:44px/);
  assert.match(room, /body\[data-reg=bee\] input\[type=range\]\{min-height:44px/);
  assert.match(room, /body\[data-reg=bee\] #tbar\{background:#f6f7f2!important/);
  assert.match(extractById(room, 'pDensity'), /id="pDensity"/);
  assert.match(extractById(room, 'pHue'), /id="pHue"/);
  assert.match(extractById(room, 'pSym'), /id="pSym"/);
});

test('raver keeps an instrument floor with vivid accents and the same knobs', () => {
  assert.match(room, /<span data-view="raver" data-i18n="room.raverTitle">Jam the field\.<\/span>/);
  assert.match(room, /body\[data-reg=raver\] h1\{font-size:clamp\(2rem,5vw,4\.4rem\)/);
  assert.match(room, /body\[data-reg=raver\] \.knobs\{[^}]*border-block-start:3px solid var\(--hot\)/);
  assert.match(room, /body\[data-reg=raver\]\{[^}]*--hot:#FF3DB0/);
  assert.match(room, /id="pDrift"/);
  assert.match(room, /id="seed"/);
  assert.match(room, /id="roll"/);
});

test('cypherpunk keeps dense mono source foot and opens tech subtext by default', () => {
  assert.match(room, /body\[data-reg=cypherpunk\]\{[^}]*--font:var\(--mono\)/);
  assert.match(room, /body\[data-reg=cypherpunk\] \.foot\{/);
  assert.match(room, /<div class="foot" data-view="cypherpunk">Stack: forge\/visual\/shared\.js/);
  assert.match(room, /if\(reading==='cypherpunk'\) return kind==='tech'\|\|kind==='how'/);
  assert.match(extractById(room, 'tech-panel'), /Yjs 13/);
  assert.match(extractById(room, 'tech-panel'), /LiveKit/);
  assert.match(extractById(room, 'tech-panel'), /jsDelivr/);
});

test('honesty is plain up front, with transport and persistence limits in details', () => {
  assert.match(room, /<em data-i18n="social.arrival.browserOnly">this browser only<\/em>/);
  assert.match(extractById(room, 'honesty-line'), /Only tabs in this browser share this composition/);
  assert.doesNotMatch(extractById(room, 'honesty-line'), /BroadcastChannel|Yjs/);
  assert.match(room, /Changes live in these tabs and are not saved/);
  assert.match(extractById(room, 'tech-panel'), /does not connect people across devices/);
  assert.match(room, /new BroadcastChannel\('bBuzz-forge-room-presence'\)/);
  assert.match(room, /new BroadcastChannel\('bBuzz-forge-room'\)/);
});

test('CRDT jargon sits in expandable details; New bee has no numbered procedure', () => {
  const how = extractById(room, 'how-panel');
  const tech = extractById(room, 'tech-panel');
  const seed = extractById(room, 'seed-panel');
  assert.match(seed, /data-view-disclosure="seed"/);
  assert.match(how, /data-view-disclosure="how"/);
  assert.match(tech, /data-view-disclosure="tech"/);
  assert.match(tech, /createSharedPiece/);
  assert.match(tech, /CRDT/);
  const beeLead = room.match(/<span data-view="bee" data-i18n="room.beeLead">Open a second tab\. Turn a knob\. Watch it move\.<\/span>/);
  assert.ok(beeLead);
  assert.doesNotMatch(room, /<ol[\s>]/i);
  assert.doesNotMatch(how, /<(li|p|div)[^>]*>\s*\d+[\.\)]\s/);
  assert.doesNotMatch(how, /\b1\s*\.\s/);
});

test('hexfield CORE and runtime pin remain; a joining tab never writes a competing default', () => {
  const core = coreOf(room);
  assert.ok(core.includes('function hashSeed') && core.includes('function mulberry32') && core.includes('function buildArt'));
  assert.doesNotMatch(core, /\b(document|window|globalThis|location|navigator)\b/);
  assert.match(core, /density:11, hueBase:168, hueDrift:72, symmetry:1/);
  assert.match(coreOf(hexfield), /function buildArt/);
  assert.match(room, /createSharedPiece/);
  assert.match(room, /forge\/visual\/shared\.js/);
  assert.match(room, /yjs@13\.6\.20/);
  assert.doesNotMatch(room, /piece\.setSeed\('hive-1000'\)/);
  assert.match(room, /type:'state-request'/);
  assert.match(room, /piece\.snapshot\(\)/);
  assert.match(room, /\['density','pDensity'\],\['hueBase','pHue'\],\['hueDrift','pDrift'\],\['symmetry','pSym'\]/);
});

test('disclosures remember open-state per view instead of resetting on toggle', () => {
  assert.match(room, /const readingChoices=new Map\(\);/);
  assert.match(room, /function restoreVisibleFocus\(focus\)/);
  assert.match(room, /function applyReading\(event\)/);
  assert.match(room, /document\.addEventListener\('bregister',applyReading\)/);
  assert.doesNotMatch(room, /d\.open = r==='cypherpunk' \|\| r==='raver'/);
});

test('manual seed and tech choices survive a round-trip through other views', () => {
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
      focus({preventScroll} = {}) { document.activeElement = this; this.preventScroll = preventScroll; }
    };
    all.push(e);
    return e;
  }
  function matches(e, selector) {
    if (selector === 'summary') return e.tagName === 'SUMMARY';
    if (selector === '[data-view-disclosure]') return Boolean(e.dataset.viewDisclosure);
    if (selector === 'meta[name="theme-color"]') return e.tagName === 'META' && e.attrs.name === 'theme-color';
    return false;
  }
  const document = {
    body: element('body'),
    activeElement: null,
    querySelectorAll: s => all.filter(e => matches(e, s)),
    querySelector: s => all.find(e => matches(e, s)) || null,
    addEventListener: (k, fn) => { (events[k] ??= []).push(fn); }
  };
  document.body.dataset.reg = 'bee';
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const seed = element('details');
  seed.dataset.viewDisclosure = 'seed';
  seed.id = 'seed-panel';
  seed.appendChild(element('summary'));
  const how = element('details');
  how.dataset.viewDisclosure = 'how';
  how.id = 'how-panel';
  how.appendChild(element('summary'));
  const tech = element('details');
  tech.dataset.viewDisclosure = 'tech';
  tech.id = 'tech-panel';
  const techSummary = element('summary');
  tech.appendChild(techSummary);
  const techLink = element('a');
  tech.appendChild(techLink);
  document.body.appendChild(seed);
  document.body.appendChild(how);
  document.body.appendChild(tech);
  const ctx = { document, Map };
  vm.createContext(ctx);
  vm.runInContext(inline(room), ctx);
  assert.equal(seed.open, false, 'New bee default: seed collapsed');
  assert.equal(how.open, false, 'New bee default: how collapsed');
  assert.equal(tech.open, false, 'New bee default: tech collapsed');
  seed.open = true;
  document.body.dataset.reg = 'cypherpunk';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(seed.open, false, 'cypherpunk default: seed collapsed until saved');
  assert.equal(how.open, true, 'cypherpunk default: how open');
  assert.equal(tech.open, true, 'cypherpunk default: tech open');
  assert.equal(theme.content, '#0e141a');
  tech.open = false;
  document.body.dataset.reg = 'raver';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(seed.open, true, 'raver default: seed open when no saved choice');
  assert.equal(theme.content, '#111018');
  document.body.dataset.reg = 'bee';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(seed.open, true, 'returning to New bee restores opened seed');
  assert.equal(tech.open, false, 'returning to New bee restores collapsed tech');
  document.body.dataset.reg = 'cypherpunk';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(tech.open, false, 'returning to cypherpunk restores the collapsed tech choice');
  document.body.dataset.reg = 'raver';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  techLink.focus();
  document.body.dataset.reg = 'cypherpunk';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(document.activeElement, tech.querySelector('summary'),
    'closed content returns focus to its visible summary');
});

test('room authors its own theme and uses the shared shell', () => {
  assert.match(room, /tour\.js\?v=41/);
  assert.match(tour, /register\.js\?v=9/);
  assert.match(register, /an authored theme can use data-bee-theme="custom"/);
  assert.doesNotMatch(register, /forge\/room\.html/);
});

test('opening another tab is one action; controls have labels and honest startup status', () => {
  assert.match(room, /<a[^>]*href="room.html"[^>]*target="_blank"[^>]*rel="noopener"[^>]*data-i18n="room.open">Open a second tab<\/a>/);
  assert.match(room, /<label for="seed"[^>]*data-i18n="room.seed">Shared seed<\/label>/);
  for (const id of ['seed','roll','pDensity','pHue','pDrift','pSym']) {
    assert.match(room, new RegExp('<(?:input|button)[^>]*id="'+id+'"[^>]*\\bdisabled[ >]'));
  }
  assert.match(room, /id="room-status" role="status" aria-live="polite"/);
  assert.match(room, /id="err" role="alert"/);
  assert.match(room, /\[hidden\]\{display:none!important\}/);
});
