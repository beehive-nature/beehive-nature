/* Source + small DOM-boundary checks for the dynasty profile three first paints.
   Same published records — views change first paint, not the houses.
   LIABILITY FENCE: published snapshots, not a profile editor, not a live
   presence list. Guest can read with no wallet. No enrichment APIs.
   Cite-or-silent. Date disagreements stay printed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extractKeyedText } from './i18n-extract.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/profile.html');
const register = read('surfaces/register.js');
const tour = read('surfaces/tour.js');
const corpus = JSON.parse(read('surfaces/lang-corpus.json'));
const crestBytes = readFileSync(new URL('../assets/profile-archive/house-crest-von-zutphen-DESIGN.svg', import.meta.url));
const crest = crestBytes.toString('utf8');
const crestManifest = JSON.parse(read('assets/profile-archive/house-crest-von-zutphen.json'));
const separatorsBytes = readFileSync(new URL('../assets/brand/skaists-separators.svg', import.meta.url));
const separators = separatorsBytes.toString('utf8');
const fullCrestBytes = readFileSync(new URL('../assets/seals/house-crest-von-zutphen-DESIGN.svg', import.meta.url));
const fullCrest = fullCrestBytes.toString('utf8');
const breathingBloomBytes = readFileSync(new URL('../docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg', import.meta.url));

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
  assert.match(bee, /Welcome\. Every name on this page is a house — a story kept in public\./);
  assert.match(bee, /Start with one house: the founder's\./);
  assert.match(bee, /These are published records, not a live guest list and not an editor\. You can read as a guest with no wallet\. A lost key stays lost; a name is a lease\./);
  assert.match(bee, /data-prof-go="house"/);
  assert.match(bee, /Read the founder house/);
  assert.match(bee, /href="buzz-directory\.html"/);
  assert.match(bee, /People journey/);
  assert.match(bee, /Go deeper/);
  // the honesty caveat is support-sized, never the largest first-screen promise
  const take = bee.match(/class="take"[^>]*>([^<]+)</)[1];
  assert.ok(!/guest|wallet|lease|records/i.test(take), 'takeaway leads with purpose, not the caveat');
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
  // dynasty lineage composition: one thread, generations, a human holder, a machine companion, roots
  assert.match(raver, /id="name-thread"/);
  assert.match(raver, /class="lantern gen"/);
  assert.match(raver, /class="person"/);
  assert.match(raver, /class="machine"/);
  assert.match(raver, /class="tether"/);
  assert.match(raver, /url\(#lineage-roots\)/);
  assert.doesNotMatch(raver, /0x[0-9A-Fa-f]{8}/);
  assert.doesNotMatch(raver, /<table/i);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /body\[data-reg="raver"\]\[data-prof-beat="arrival"\] #first-raver\{display:flex\}/);
});

test('founder house beat is one story door — not a multi-house wallet grid', () => {
  const house = extractById(page, 'layer-house');
  assert.match(house, /skaists — the founder house/);
  assert.match(house, /Travis Mark Remington holds this house/);
  // F1: the mid-beat founder story sentence is keyed (renders translated, not English)
  assert.match(house, /data-i18n="prof\.house\.story">Founder of the Beehive Nature Reserve\. Builds dynasties\./);
  assert.doesNotMatch(house, /0x[0-9A-Fa-f]{8}/);
  assert.doesNotMatch(house, /bqueenbee\.base\.eth|bClaude\.a|bloverai|guest\.citizen|北方國王/);
  assert.doesNotMatch(house, /generation 1|generation 2|Name history/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-prof-beat="house"\] #layer-house\{display:block\}/);
});

test('house archive uses the founder-supplied v2 crest bytes with portable provenance', () => {
  const archive = extractById(page, 'house-archive');
  const digest = createHash('sha256').update(crestBytes).digest('hex').toUpperCase();
  assert.equal(digest, crestManifest.artifact['sha256-PUBLIC-CONSTANT']);
  assert.equal(digest, '6303A84263857D62568613F9929B33E0F74076A6640CEDF0D643BEB30E579088'); // PUBLIC-CONSTANT: v2 crest digest
  assert.equal(crestManifest.release, 'v2');
  assert.equal(crestManifest.artifact.marketplace.listed, false);
  assert.equal(crestManifest.artifact.license, 'Rights reserved until the holder publishes a license');
  assert.match(archive, /\.\.\/assets\/profile-archive\/house-crest-von-zutphen-DESIGN\.svg/);
  assert.match(archive, /\.\.\/assets\/profile-archive\/house-crest-von-zutphen\.json/);
  assert.match(archive, /href="\.\.\/assets\/profile-archive\/house-crest-von-zutphen\.json">Open provenance/);
  assert.doesNotMatch(archive, /house-crest-von-zutphen\.json" target="_blank"/);
  assert.match(archive, /family-authored interpretation &middot; not a title certificate/);
  assert.doesNotMatch(crest, /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|xlink:href)\s*=/i);
});

test('house archive gives New bee, Raver, and Cypherpunk distinct value at the same record', () => {
  const archive = extractById(page, 'house-archive');
  assert.match(archive, /data-reg="bee">A family profile can hold more than a name/);
  assert.match(archive, /data-reg="raver">A house mark made to travel/);
  assert.match(archive, /data-reg="cypherpunk" id="profile-display-bio">The full ceremonial master is shown here/);
  assert.match(archive, /data-reg="raver" aria-labelledby="symbol-title"/);
  assert.match(archive, /data-reg="cypherpunk" aria-labelledby="privacy-title"/);
  assert.match(archive, /Privacy seam matrix/);
  assert.match(page, /body:not\(\[data-reg="cypherpunk"\]\)\[data-prof-beat="house"\] #house-archive/);
  assert.match(page, /body\[data-reg="cypherpunk"\] #house-archive\{display:block\}/);
  assert.match(page, /@media\(max-width:720px\)/);
});

test('SKAISTS separator specimen pins the .a cell and .b bond identity grammar', () => {
  const archive = extractById(page, 'house-archive');
  const digest = createHash('sha256').update(separatorsBytes).digest('hex').toUpperCase();
  assert.equal(digest, crestManifest.brandSpecimen['sha256-PUBLIC-CONSTANT']);
  assert.equal(digest, 'B0D7BA18BA028A6313A29288EBDAC0E77EEE73153344CD866756D3006329EE75'); // PUBLIC-CONSTANT: SKAISTS separator specimen digest
  assert.equal(crestManifest.brandSpecimen.kind, 'vector-path-specimen');
  assert.equal(crestManifest.brandSpecimen.webfont, false);
  assert.equal(crestManifest.brandSpecimen.semantics['.a'], 'the cell · structure, the hive');
  assert.equal(crestManifest.brandSpecimen.semantics['.b'], 'the bond · love, the link');
  assert.match(archive, /data-reg="cypherpunk">\s*<img src="\.\.\/assets\/brand\/skaists-separators\.svg"/);
  assert.match(archive, /identity specimen, not an installable webfont/);
  assert.match(separators, /the cell — structure, the hive/);
  assert.match(separators, /the bond — love, the link/);
  assert.match(separators, /the header of the realm, both hands/);
  assert.doesNotMatch(separators, /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|xlink:href)\s*=/i);
});

test('Cypherpunk receives the full shield achievement and the house carries the breathing nature mark', () => {
  const archive = extractById(page, 'house-archive');
  const fullDigest = createHash('sha256').update(fullCrestBytes).digest('hex').toUpperCase();
  const bloomDigest = createHash('sha256').update(breathingBloomBytes).digest('hex').toUpperCase();
  assert.equal(fullDigest, crestManifest.ceremonialMaster['sha256-PUBLIC-CONSTANT']);
  assert.equal(fullDigest, 'F9B2CE8428FFFC8FE215754858AB6F8DEB8691FB766CA16D226272F7A8331F40'); // PUBLIC-CONSTANT: full achievement digest
  assert.equal(bloomDigest, crestManifest.natureMark['sha256-PUBLIC-CONSTANT']);
  assert.equal(bloomDigest, '9971D2CA697797AF7430B062CA1842AB063BA3746418E8963A527BD4BF017FE3'); // PUBLIC-CONSTANT: breathing bloom digest
  assert.match(fullCrest, /clipPath id="shieldClip"/);
  assert.doesNotMatch(fullCrest, /<script\b|<foreignObject\b|\bon\w+\s*=/i);
  assert.ok([...fullCrest.matchAll(/\bhref="([^"]+)"/gi)].every(match => match[1].startsWith('#')), 'full achievement references only its own SVG definitions');
  assert.match(archive, /class="crest-full" data-reg="cypherpunk" src="\.\.\/assets\/seals\/house-crest-von-zutphen-DESIGN\.svg"/);
  assert.match(archive, /shield, nine quarters, supporters, coronet, crest, motto, and compartment/);
  assert.match(archive, /href="\.\.\/docs\/BLAZON\.md">Read the blazon/);
  assert.match(archive, /data="\.\.\/docs\/mvp-walk\/assets\/genesis-3d\/motion\/green-teal-breathing\.svg"/);
  assert.match(archive, /no network or presence signal/);
  assert.match(archive, /reduced-motion preferences show the resting artwork/);
});

test('profile editor is a bounded local preview with no publication claim', () => {
  const archive = extractById(page, 'house-archive');
  assert.match(archive, /<summary>Edit your profile<\/summary>/);
  assert.match(archive, /Changes remain in this open page, create no account, upload nothing/);
  assert.match(archive, /maxlength="60"/);
  assert.match(archive, /maxlength="120"/);
  assert.match(archive, /maxlength="240"/);
  assert.match(archive, /type="color" value="#E8B54B"/);
  assert.match(page, /\.textContent=name/);
  assert.match(page, /\.textContent=motto/);
  assert.match(page, /\.textContent=bio/);
  assert.match(page, /archive\.style\.setProperty\('--profile-accent'/);
  assert.match(page, /Local preview applied · not saved or published/);
  assert.match(page, /Preview reset to the published blueprint · not saved or published/);
});

test('disclosure preview is consent-first and .a lineage cannot impersonate family lineage', () => {
  const archive = extractById(page, 'house-archive');
  assert.match(archive, /data-audience="public"/);
  assert.match(archive, /Living relatives stay private until each person says yes/);
  assert.match(archive, /data-scope="circle"/);
  assert.match(archive, /data-scope="private"/);
  assert.match(archive, /DNA \+ health/);
  assert.match(archive, /\.a secret or key/);
  assert.match(archive, /never claims a blood relationship/);
  assert.match(archive, /preview changes what is shown here; publishing comes later/);
  assert.match(page, /archive\.setAttribute\('data-audience',choice\)/);
  assert.match(page, /panel\.hidden=panel\.getAttribute\('data-profile-schema'\)!==selected/);
  assert.equal(crestManifest.privacyDefaults.livingPeople, 'private-until-each-person-consents');
  assert.match(crestManifest.agentLineage.rule, /never a fabricated blood relationship/);
});

test('Raver tap opens art first; ledger one tap away', () => {
  const figure = extractById(page, 'layer-figure');
  assert.match(figure, /Names are stories\. Holders are portraits/);
  assert.match(figure, /The ledger waits one tap away/);
  // the raver path reaches the founder house story layer, not only the ledger
  assert.match(figure, /data-prof-go="house"/);
  assert.match(figure, /Open the founder house/);
  // lineage portrait: generations held by a human, machine companion tethered
  assert.match(figure, /class="thread"/);
  assert.match(figure, /class="person"/);
  assert.match(figure, /class="machine"/);
  assert.match(figure, /class="tether"/);
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
  // F5: every numbered section heading and every law div is keyed (translation hooks)
  assert.doesNotMatch(instrument, /<h2>\d/, 'no unkeyed numbered instrument headings');
  assert.doesNotMatch(instrument, /<div class="law">/, 'no unkeyed instrument law copy');
});

test('routine New bee labels read at 14px minimum, bee-scoped only (F4)', () => {
  assert.match(page, /body\[data-reg="bee"\] \.holder \.bio \.bdesc\{font-size:\.875rem/);
  assert.match(page, /body\[data-reg="bee"\] \.holder \.bio \.bmeta\{font-size:\.875rem\}/);
  // the override is scoped: the compact instrument register survives for Cypherpunk
  assert.doesNotMatch(page, /body\[data-reg="cypherpunk"\][^{]*\.bdesc/);
  assert.match(page, /\.holder \.bio \.bdesc\{font-size:10\.5px/);
  assert.match(page, /\.holder \.bio \.bmeta\{font-size:9\.5px/);
});

test('keyed first-paint English matches the corpus; every tongue has a cell', () => {
  const keys = [
    'prof.mark', 'prof.bee.calm', 'prof.bee.takeaway', 'prof.bee.support', 'prof.bee.house',
    'prof.bee.back', 'prof.raver.feel', 'prof.raver.tap', 'prof.raver.openhouse',
    'prof.raver.consciousness', 'prof.house.lead', 'prof.house.holder', 'prof.house.story',
    'prof.inst.h1', 'prof.inst.law1', 'prof.inst.h2', 'prof.inst.law2', 'prof.inst.h3',
    'prof.inst.law3', 'prof.inst.h4', 'prof.inst.law4', 'prof.inst.h5', 'prof.inst.law5',
    'prof.inst.h6', 'prof.inst.law6', 'prof.inst.h7', 'prof.inst.law7', 'prof.inst.law7src',
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
