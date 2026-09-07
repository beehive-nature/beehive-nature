/* Social door three presentations and per-view disclosure memory.
   Directory/Buzz stay Astra's five-door canvas. These are source and small
   DOM-boundary checks, not a rendered screenshot or a live Buzz conversation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const social = read('surfaces/doors/bnature-social.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const gallery = read('surfaces/blight/gallery.html');
const studio = read('surfaces/blight/studio-music.html');
const directory = read('surfaces/buzz-directory.html');

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

function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]);
}

function inline(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
}

const startHere = extractById(social, 'start-here');

test('New bee social door is one light room; the hex band and scanline hide', () => {
  assert.match(social, /body\[data-reg="bee"\]\{[^}]*background:#f6f7f2/);
  assert.match(social, /body\[data-reg="bee"\] #start-here\{background:#fff/);
  assert.match(social, /body\[data-reg="bee"\] #veil,body\[data-reg="bee"\] #bandwrap\{display:none\}/);
  assert.match(social, /body\[data-reg="bee"\] #tbar\{background:#f6f7f2!important/);
  assert.match(social, /<meta name="theme-color" content="#f6f7f2">/);
});

test('raver keeps the hex band and restyles the arrival strip to the dark panel', () => {
  assert.doesNotMatch(social, /body\[data-reg="raver"\] #bandwrap\{display:none\}/);
  assert.match(social, /body\[data-reg="raver"\] #start-here\{background:var\(--panel\)/);
  assert.match(social, /body\[data-reg="raver"\] #start-here .start-link,body\[data-reg="raver"\] #start-here .honesty\{/);
});

test('cypherpunk keeps scanline density and a dark terminal arrival strip', () => {
  assert.match(social, /body\[data-reg="cypherpunk"\]\{color-scheme:dark\}/);
  assert.match(social, /body\[data-reg="cypherpunk"\] #start-here\{background:var\(--panel\)/);
  assert.match(social, /body\[data-reg="cypherpunk"\] #start-here h2\{[^}]*var\(--mono\)/);
});

test('arrival copy stays keyed; catalogue density is progressive disclosure', () => {
  assert.match(social, /data-i18n="d.social.who"/);
  assert.match(social, /data-i18n="d.social.what"/);
  assert.match(startHere, /data-i18n="social.arrival.kicker"/);
  assert.match(startHere, /data-i18n="social.arrival.honesty.body"/);
  assert.match(social, /<details class="density" id="everything-box" data-view-disclosure="catalogue">/);
  assert.match(social, /<summary>Everything behind this door<\/summary>/);
  assert.match(social, /data-view-disclosure="honesty"/);
});

test('choose-click destinations and this-browser-only honesty are unchanged', () => {
  const startLinks = hrefs(startHere);
  assert.ok(startLinks.includes('../buzz-directory.html'));
  assert.ok(startLinks.includes('../buzz-directory.html#people-agents'));
  assert.ok(startLinks.includes('../index.html'));
  assert.match(social, /<a class="act secondary" href="\.\.\/forge\/room\.html"/);
  assert.match(social, /<em data-i18n="social.arrival.browserOnly">this browser only<\/em>/);
  assert.match(social, /LIVE on this door means the page is published/);
  assert.match(social, /does not send or deliver messages/);
});

test('this door remembers disclosure open-state per view instead of resetting on toggle', () => {
  assert.doesNotMatch(social, /d\.open = r==='cypherpunk' \|\| r==='raver'/);
  assert.match(social, /const readingChoices=new Map\(\);/);
  assert.match(social, /function restoreVisibleFocus\(focus\)/);
  assert.match(social, /function applyReading\(event\)/);
  assert.match(social, /readingChoices\.set\(lastReading,details\.map\(d=>d\.open\)\)/);
  assert.match(social, /d\.open=previous\?previous\[i\]:\(reading==='cypherpunk'\|\|reading==='raver'\)&&d\.dataset\.viewDisclosure==='catalogue'/);
});

test('manual honesty and catalogue choices survive a round-trip through other views', () => {
  const ids = new Map();
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
  const honesty = element('details');
  honesty.dataset.viewDisclosure = 'honesty';
  honesty.id = 'honesty';
  honesty.appendChild(element('summary'));
  const catalogue = element('details');
  catalogue.dataset.viewDisclosure = 'catalogue';
  catalogue.id = 'everything-box';
  catalogue.appendChild(element('summary'));
  document.body.appendChild(honesty);
  document.body.appendChild(catalogue);
  ids.set('honesty', honesty);
  ids.set('everything-box', catalogue);
  const context = { document, Map };
  vm.createContext(context);
  vm.runInContext(inline(social), context);
  assert.equal(honesty.open, false, 'New bee default: honesty collapsed');
  assert.equal(catalogue.open, false, 'New bee default: catalogue collapsed');
  honesty.open = true;
  document.body.dataset.reg = 'cypherpunk';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(honesty.open, false, 'cypherpunk default: honesty collapsed until saved');
  assert.equal(catalogue.open, true, 'cypherpunk default: catalogue open');
  assert.equal(theme.content, '#06110c');
  catalogue.open = false;
  document.body.dataset.reg = 'raver';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(catalogue.open, true, 'raver default: catalogue open when no saved choice');
  document.body.dataset.reg = 'bee';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(honesty.open, true, 'returning to New bee restores opened honesty');
  assert.equal(catalogue.open, false, 'returning to New bee restores collapsed catalogue');
  document.body.dataset.reg = 'cypherpunk';
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(catalogue.open, false, 'returning to cypherpunk restores the collapsed catalogue choice');
});

test('this lane does not rewrite Astra gallery, studio, directory or the shared shell', () => {
  assert.doesNotMatch(gallery, /body\[data-reg="bee"\] #tbar/);
  assert.doesNotMatch(studio, /body\[data-reg="bee"\] #tbar/);
  assert.match(directory, /data-experience="directory"/);
  assert.match(directory, /data-view-disclosure/);
  assert.doesNotMatch(directory, /d\.open = r==='cypherpunk' \|\| r==='raver'/);
  assert.equal(register.includes("route==='buzz-directory.html'?'directory'"), true);
  assert.match(tour, /register\.js\?v=9/);
});
