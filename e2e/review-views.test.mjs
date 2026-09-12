/* Source + small DOM-boundary checks for the Royal Review's three first paints.
   Same attestation instrument — views change first paint, not the grammar.
   PRODUCT FENCE: attestation, never telemetry. Recovery phrases never enter
   the page. Guest unsigned receipts marked unverified. No observation of
   visitors. No medical advice. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/review.html');
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
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1])
    .filter(src => src.includes('function applyReading'))
    .join('\n');
}

const FENCE = /passkey|Ed25519|WebLLM|wake the pocket|bLOVErAi|listen to the rails|\bidle\b|unbound — receipts compose as UNSIGNED|recovery phrases/;
const TELEMETRY = /attestation, never telemetry|telemetry/;

test('review preview stays local and a failed clipboard write never reports success', async () => {
  const fields = Object.fromEntries(['surf','verdict','rnote','reviewOut','review-ready','review-copied','review-copy-failed','cpReview','mkReview'].map(id => [id, {
    value: '', textContent: '', style: {}, hidden: true, focus(){ this.focused=true; }
  }]));
  fields.surf.value = 'university/index.html';
  fields.verdict.value = '💡 idea';
  fields.rnote.value = 'Make the next step clearer.';
  let copied;
  const context = {
    $: id => fields[id], ID: null,
    PTR: { review: (surface, verdict, note) => `[bX review] ${verdict} ${surface} — note: ${note}` },
    show: (id, text) => { fields[id].textContent=text; fields[id].style.display='block'; },
    navigator: { clipboard: { async writeText(){ throw new Error('denied'); } } }
  };
  const start = page.indexOf("  $('mkReview').onclick=async function(){");
  const end = page.indexOf('  var lastVerified=null;', start);
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(page.slice(start, end), context);
  await fields.mkReview.onclick();
  assert.match(fields.reviewOut.textContent, /💡 idea university\/index.html/);
  assert.match(fields.reviewOut.textContent, /UNSIGNED/);
  assert.equal(fields['review-ready'].hidden, false);
  await fields.cpReview.onclick();
  assert.equal(fields['review-copied'].hidden, true);
  assert.equal(fields['review-copy-failed'].hidden, false);
  assert.equal(fields.reviewOut.focused, true);
  context.navigator.clipboard.writeText = async text => { copied=text; };
  await fields.cpReview.onclick();
  assert.equal(copied, fields.reviewOut.textContent);
  assert.equal(fields['review-copied'].hidden, false);
  assert.equal(fields['review-copy-failed'].hidden, true);
  assert.equal(fields.rnote.value, 'Make the next step clearer.');
});

test('New bee first paint is one calm sentence, one takeaway, and one choice', () => {
  const bee = extractById(page, 'first-bee');
  assert.match(bee, /Help make this place better\./);
  assert.match(bee, /Tell us what you noticed\./);

  assert.match(bee, /Your draft stays on this page until you choose to copy and share it\./);
  assert.match(bee, /Write a review/);
  assert.match(bee, /Go deeper/);
  assert.doesNotMatch(bee, /nothing on this page watches you[\s\S]*nothing on this page watches you/);
  assert.doesNotMatch(bee, TELEMETRY);
  assert.doesNotMatch(bee, /attestation/);
  assert.doesNotMatch(bee, FENCE);
  assert.doesNotMatch(bee, /star|score|rating|telemetry/i);
  assert.doesNotMatch(bee, /id="listen"|id="bindBtn"|id="gCheck"|id="w1wake"|id="tallySt"/);
  assert.doesNotMatch(bee, /<table/i);
  assert.match(page, /<body data-reg="bee" data-bee-theme="custom" data-review-beat="arrival">/);
  assert.match(page, /body\[data-reg="bee"\]\[data-review-beat="arrival"\] #first-bee\{display:block\}/);
  assert.match(page, /#first-bee,#first-raver,#layer-figure,#instrument\{display:none\}/);
  assert.match(page, /<span data-i18n="review.foot.attest">attestation, never telemetry — not medical advice<\/span>/);
});

test('Raver first paint is atmosphere, one feeling line, and one tap', () => {
  const raver = extractById(page, 'first-raver');
  assert.match(raver, /id="crown-scene"/);
  assert.match(raver, /aria-hidden="true"/);
  assert.match(raver, /What if your feedback were a gift\?/);
  assert.match(raver, /Give your feedback/);
  assert.doesNotMatch(raver, /A walker who publishes nothing appears nowhere/);
  assert.doesNotMatch(raver, /<input|<select|type="range"/i);
  assert.doesNotMatch(raver, /<table/i);
  assert.doesNotMatch(raver, FENCE);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-review-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('consciousness beat and New bee choice sit behind the Raver tap, not on first paint', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /A walker who publishes nothing appears nowhere — that is the design\./);
  assert.match(figure, /Tell us what you noticed\./);
  assert.match(figure, /One page you visited\. One mark: works, idea, bug, or gap\. Only if you publish\./);
  assert.match(figure, /Write a review/);
  assert.match(figure, /Go deeper/);
  assert.doesNotMatch(figure, FENCE);
  assert.doesNotMatch(figure, /id="listen"|id="bindBtn"|id="gCheck"|id="w1wake"/);
  assert.match(page, /body\[data-reg="raver"\]\[data-review-beat="figure"\] #layer-figure\{display:block\}/);
});

test('Write a review is one calm compose beat — not passkey, rails, verify, or WebLLM', () => {
  const compose = extractById(page, 'layer-compose');
  assert.match(compose, /Choose the page, say what happened, then copy your review if you want to share it\./);
  assert.match(compose, /id="mark-words"/);
  assert.match(compose, />It worked</);
  assert.match(compose, />I have an idea</);
  assert.match(compose, />Something broke</);
  assert.match(compose, />Something is missing</);
  assert.ok(compose.indexOf('id="mark-words"') < compose.indexOf('id="surf"'), 'human marks come before the surface picker');
  assert.match(compose, /id="surf"/);
  assert.match(compose, /id="verdict"/);
  assert.match(compose, /id="rnote"/);
  assert.match(compose, /id="mkReview"/);
  assert.match(compose, /TASK/);
  assert.doesNotMatch(compose, /id="listen"|id="bindBtn"|id="gCheck"|id="w1wake"|id="tallySt"/);
  assert.doesNotMatch(compose, /passkey|Ed25519|WebLLM|wake the pocket|bLOVErAi|listen to the rails|\bidle\b/);
  assert.doesNotMatch(compose, /star|score|rating/i);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #mark-words\{display:flex\}/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #mark-words\{display:none\}/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #layer-compose\{display:block\}/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #tally,/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #bind,/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #guard,/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #ai,/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-review-beat="compose"\] #sources-panel\{display:none\}/);
});

test('Cypherpunk still reaches the full attestation instrument, same grammar and honesty', () => {
  const instrument = extractById(page, 'instrument');
  assert.match(instrument, /id="tally"/);
  assert.match(instrument, /id="listen"/);
  assert.match(instrument, /id="bindBtn"/);
  assert.match(instrument, /id="guestBtn"/);
  assert.match(instrument, /id="compose"/);
  assert.match(instrument, /id="gCheck"/);
  assert.match(instrument, /Ed25519/);
  assert.match(instrument, /id="w1wake"/);
  assert.match(instrument, /bLOVErAi/);
  assert.match(instrument, /TASK/);
  assert.match(instrument, /pretending it is wired/);
  assert.match(instrument, /recovery phrases never enter this page/);
  assert.match(instrument, /guards will mark them unverified/);
  assert.match(instrument, /data-view-disclosure="sources"/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : 'arrival'/);
  assert.match(page, /if\(reading==='cypherpunk'\) beat='deeper'/);
  assert.match(page, /reading==='cypherpunk' \? 'deeper' : \(beatChoices\.get\(reading\)\|\|defaultBeat\(reading\)\)/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #tally,/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #guard,/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #ai,/);
  assert.match(page, /opens in a new tab/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'review.mark', 'review.pair', 'review.bee.calm', 'review.bee.takeaway', 'review.bee.marks', 'review.bee.support',
    'review.bee.leave', 'review.bee.deeper', 'review.raver.feel', 'review.raver.offer',
    'review.raver.consciousness', 'review.compose.caption',
    'review.foot.attest', 'review.foot.learn'
  ];
  keys.push("review.bee.calm","review.bee.takeaway","review.bee.support","review.bee.leave","review.raver.offer","review.compose.caption","review.compose.heading","review.compose.page","review.compose.note","review.compose.make","review.compose.copy","review.compose.copied","review.compose.copyFailed","review.compose.ready","review.compose.share","review.mark.works","review.mark.idea","review.mark.bug","review.mark.gap","review.raver.feel");
  for (const key of new Set(keys)) {
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
  assert.match(page, /attestation, never telemetry/);
  const bee = extractById(page, 'first-bee');
  assert.doesNotMatch(bee, /data-language-host|data-register-host|id="blangsel"/);
  assert.doesNotMatch(bee, FENCE);
  const bar = extractById(page, 'bregbar');
  assert.match(bar, /data-register-host/);
  assert.match(bar, /data-language-host/);
  assert.doesNotMatch(bar, FENCE);
  assert.match(tour, /assetBase\+'register\.js\?v=\d+'/);
  assert.match(tour, /assetBase\+'lang\.js\?v=\d+'/);
});

test('beats and sources disclosure remember per view instead of resetting', () => {
  assert.match(page, /var readingChoices=new Map\(\)/);
  assert.match(page, /var beatChoices=new Map\(\)/);
  assert.match(page, /function restoreVisibleFocus\(focus\)/);
  assert.match(page, /function applyReading\(event\)/);
  assert.match(page, /document\.addEventListener\('bregister',applyReading\)/);
  assert.match(tour, /register\.js\?v=\d+/);
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
        if (name === 'data-review-beat') return this.dataset.reviewBeat;
        if (name === 'data-view-disclosure') return this.dataset.viewDisclosure;
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        if (name === 'data-reg') this.dataset.reg = value;
        if (name === 'data-review-beat') this.dataset.reviewBeat = value;
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
    if (selector === '[data-review-go]') return Boolean(e.attrs['data-review-go']);
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
  document.body.dataset.reviewBeat = 'arrival';
  document.body.setAttribute('data-reg', 'bee');
  document.body.setAttribute('data-review-beat', 'arrival');
  document.activeElement = document.body;
  const theme = element('meta');
  theme.attrs.name = 'theme-color';
  theme.content = '#f6f7f2';
  const sources = element('details');
  sources.dataset.viewDisclosure = 'sources';
  sources.attrs.id = 'sources-panel';
  sources.appendChild(element('summary'));
  document.body.appendChild(sources);
  for (const id of ['surf','verdict','rnote','mkReview','listen','bindBtn','gCheck','w1wake']) {
    const n = element(id === 'surf' || id === 'verdict' ? 'select' : id === 'rnote' ? 'input' : 'button');
    n.attrs.id = id;
    document.body.appendChild(n);
  }
  const goCompose = element('button');
  goCompose.attrs['data-review-go'] = 'compose';
  document.body.appendChild(goCompose);
  const ctx = { document, Map, Math, URL, location: { href: 'http://127.0.0.1:8765/review.html' }, window: {} };
  vm.createContext(ctx);
  vm.runInContext(inline(page), ctx);
  assert.equal(sources.open, false, 'New bee default: sources collapsed');
  assert.equal(document.body.getAttribute('data-review-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, true, 'cypherpunk default: sources open');
  assert.equal(document.body.getAttribute('data-review-beat'), 'deeper');
  assert.equal(theme.content, '#0d1410');
  for (const fn of events.click || []) fn({ target: goCompose });
  assert.equal(document.body.getAttribute('data-review-beat'), 'deeper', 'cypherpunk refuses a compose trim');
  sources.open = false;
  document.body.dataset.reg = 'raver';
  document.body.setAttribute('data-reg', 'raver');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'raver' } });
  assert.equal(document.body.getAttribute('data-review-beat'), 'arrival');
  assert.equal(theme.content, '#0c1412');
  document.body.dataset.reg = 'bee';
  document.body.setAttribute('data-reg', 'bee');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'bee' } });
  assert.equal(document.body.getAttribute('data-review-beat'), 'arrival');
  document.body.dataset.reg = 'cypherpunk';
  document.body.setAttribute('data-reg', 'cypherpunk');
  for (const fn of events.bregister || []) fn({ detail: { reg: 'cypherpunk' } });
  assert.equal(sources.open, false, 'returning to cypherpunk restores collapsed sources');
});
