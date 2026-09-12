/* Source + small DOM-boundary checks for the buzz directory three first paints.
   Same door instrument — views change first paint, not the receipts.
   LIABILITY FENCE: page fetches nothing. Statuses are hand-verified receipts,
   not a live API. No online dots, last-seen, or who's-in-the-room theater.
   Estate does not proxy/mirror buzz.directory — it links. Cite-or-silent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/buzz-directory.html');
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

const FENCE = /wss:\/\/|buzz:\/\/|✓ verified|✗ failing|online now|last-seen|who's in the room|member count/i;

test('New bee first paint is one calm sentence, one takeaway, and three doors', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /Welcome\. This page is the estate's front porch — the place to find our community rooms\./);
  assert.match(bee, /Come meet the hive\./);
  assert.match(bee, /The doors here were checked by hand when this page was published\. This list cannot see who is online, and it does not pretend to\. If \.buzz is filtered, a clean-name door opens the same hive\./);
  assert.match(bee, /data-dir-go="hives"/);
  assert.match(bee, /data-i18n="social\.arrival\.dir\.hives">OUR HIVES</);
  assert.match(bee, /href="profile\.html"/);
  assert.match(bee, /data-i18n="experience\.profile">People and names</);
  assert.match(bee, /data-dir-go="deeper"/);
  assert.match(bee, /Go deeper/);
  // the receipts warning is support-sized, never the largest first-screen promise
  const take = bee.match(/class="take"[^>]*>([^<]+)</)[1];
  assert.ok(!/receipt|online|checked/i.test(take), 'takeaway leads with purpose, not the warning');
  assert.doesNotMatch(bee, FENCE);
  assert.doesNotMatch(bee, /<table/i);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-dir-beat="arrival" data-experience="directory">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-dir-beat="arrival"\] #first-bee,/);
  assert.match(page, /#first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#layer-hives,#layer-house,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="dir\.foot\.door">Hand-checked receipts\. This page fetches nothing\.<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="hive-scene"/);
  assert.match(raver, /Find your people\. The floor already has doors\./);
  assert.match(raver, /Step into OUR HIVES/);
  // people/relationship composition: humans purple and linked, machine companions teal and tethered, green biomass
  assert.match(raver, /class="people"/);
  assert.match(raver, /class="person"/);
  assert.match(raver, /class="kin"/);
  assert.match(raver, /class="machine"/);
  assert.match(raver, /class="tether"/);
  assert.match(raver, /url\(#biomass\)/);
  assert.doesNotMatch(raver, FENCE);
  assert.doesNotMatch(raver, /<table/i);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-dir-beat="arrival"\] #first-raver,/);
  assert.match(page, /#first-raver\{display:flex\}/);
});

test('OUR HIVES beat is doors and stories — no raw host stack', () => {
  const hives = extractById(page, 'layer-hives');
  assert.match(hives, /These are the estate's own community doors/);
  assert.match(hives, /skaists\.buzz — the founder's hive/);
  assert.match(hives, /beehivenature\.buzz — the science hive/);
  assert.match(hives, /relay\.skaists\.dev/);
  assert.match(hives, /relay2\.skaists\.dev/);
  assert.match(hives, /opens in a new tab/);
  // F1: the mid-beat door-card sentence is keyed (renders translated, not English)
  const cards = hives.match(/data-i18n="dir\.hives\.doorcard"/g) || [];
  assert.equal(cards.length, 2, 'both door cards carry dir.hives.doorcard');
  assert.doesNotMatch(hives, FENCE);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-dir-beat="hives"\] #layer-hives\{display:block\}/);
});

test('Raver tap opens the relationship picture first; hosts one tap away', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /People and their machine companions, named honestly, around two estate hives\. Presence is not claimed — connection is\./);
  // the raver path reaches the estate's own story doors, not only the ledger
  assert.match(figure, /data-dir-go="hives"/);
  assert.match(figure, /Meet the hosts/);
  // relationship portrait: two hives, humans linked, machine companion tethered, green floor
  assert.match(figure, /class="person"/);
  assert.match(figure, /class="kin"/);
  assert.match(figure, /class="machine"/);
  assert.match(figure, /class="tether"/);
  assert.doesNotMatch(figure, FENCE);
  assert.match(page, /body\[data-reg="raver"\]\[data-dir-beat="figure"\] #layer-figure,/);
  assert.match(page, /#layer-figure\{display:block\}/);
});

test('Cypherpunk still reaches the full door instrument, same honesty', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /1 · receipt law/);
  assert.match(instrument, /fetches nothing/);
  assert.match(instrument, /2 · estate dual-home table/);
  assert.match(instrument, /id="our-hives"/);
  assert.match(instrument, /wss:\/\/skaists\.buzz/);
  assert.match(instrument, /3 · public directory instrument/);
  assert.match(instrument, /buzz:\/\//);
  assert.match(instrument, /4 · invite \/ expiry honesty/);
  assert.match(instrument, /If the door does not open/);
  assert.match(instrument, /5 · people \/ agents roster/);
  assert.match(instrument, /id="people-agents"/);
  assert.match(instrument, /6 · connection details/);
  assert.match(instrument, /7 · cite-or-silent/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(instrument, /data-view-disclosure="connection"/);
  assert.match(instrument, /no invented uptime, member counts/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, /if\(reading==='cypherpunk'\) beat='deeper'/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #instrument\{display:block\}/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  // F5: every numbered section heading and every law div is keyed (translation hooks)
  assert.doesNotMatch(instrument, /<h2>\d/, 'no unkeyed numbered instrument headings');
  assert.doesNotMatch(instrument, /<div class="law">/, 'no unkeyed instrument law copy');
  assert.match(instrument, /<span data-i18n="dir\.inst\.law5a">Named seats, not presence\. Published records deepen at<\/span>/);
  assert.match(instrument, /data-i18n="experience\.profile">People and names<\/a>\.<\/p>/);
});

test('routine New bee labels read at 14px minimum, bee-scoped only (F4)', () => {
  assert.match(page, /body\[data-reg="bee"\] \.listing \.lrelay\{font-size:\.875rem/);
  assert.match(page, /body\[data-reg="bee"\] \.listing \.chip\{font-size:\.875rem\}/);
  // the override is scoped: the compact instrument register survives for Cypherpunk
  assert.doesNotMatch(page, /body\[data-reg="cypherpunk"\][^{]*\.lrelay/);
  assert.match(page, /\.listing \.lrelay\{font-size:10\.5px/);
  assert.match(page, /\.listing \.chip\{display:inline-flex[^}]*font-size:9\.5px/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'dir.mark', 'dir.bee.calm', 'dir.bee.takeaway', 'dir.bee.support',
    'dir.raver.feel', 'dir.raver.tap', 'dir.raver.consciousness',
    'dir.hives.lead', 'dir.hives.skaists', 'dir.hives.science',
    'dir.hives.visit', 'dir.hives.hosts', 'dir.hives.doorcard',
    'dir.inst.h1', 'dir.inst.law1', 'dir.inst.h2', 'dir.inst.h3', 'dir.inst.law3',
    'dir.inst.h4', 'dir.inst.h5', 'dir.inst.law5a', 'dir.inst.h6', 'dir.inst.law6',
    'dir.inst.h7', 'dir.inst.law7',
    'dir.opens', 'dir.foot.door'
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
  assert.doesNotMatch(bee, FENCE);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.match(tour, /assetBase\+'register\.js\?v=\d+'/);
  assert.match(tour, /assetBase\+'lang\.js\?v=\d+'/);
  assert.match(register, /an authored theme can use data-bee-theme="custom"/);
});

test('beats and connection disclosure remember per view instead of resetting', () => {
  assert.match(page, /var readingChoices=new Map\(\)/);
  assert.match(page, /var beatChoices=new Map\(\)/);
  assert.match(page, /function restoreVisibleFocus\(focus\)/);
  assert.match(page, /function applyReading\(event\)/);
  assert.match(page, /document\.addEventListener\('bregister',applyReading\)/);

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
        if (name === 'data-dir-beat') return this.dataset.dirBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-dir-beat') this.dataset.dirBeat = value;
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
  document.body.dataset.dirBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-dir-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const connection = element('details');
  connection.dataset.viewDisclosure = 'connection';
  connection.appendChild(element('summary'));
  document.body.appendChild(connection);
  const goHives = element('button');
  goHives.attrs['data-dir-go'] = 'hives';
  document.body.appendChild(goHives);
  const ctx = { document, Map, location: { hash: '' } };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(connection.open, false, 'New bee default: connection collapsed');
  assert.equal(document.body.getAttribute('data-dir-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(connection.open, true, 'cypherpunk default: connection open');
  assert.equal(document.body.getAttribute('data-dir-beat'), 'deeper');
  for (const fn of events.click || []) fn({ target: goHives });
  assert.equal(document.body.getAttribute('data-dir-beat'), 'deeper', 'cypherpunk refuses a hives trim');
  connection.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-dir-beat'), 'arrival');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-dir-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(connection.open, false, 'returning to cypherpunk restores collapsed connection');
});
