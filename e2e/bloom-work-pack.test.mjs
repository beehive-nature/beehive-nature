/* Companion bloom presentation checks.
   Canonical work id is bnr-genesis-bloom-v1 on first-work.html.
   This pack must not ship a second Keep identity or wrap the #35 controller. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const bin = p => readFileSync(resolve(root, p));

const work = read('docs/mvp-walk/works/bloom-genesis.html');
const share = read('docs/mvp-walk/works/bloom-genesis-share.html');
const js = read('docs/mvp-walk/works/bloom-genesis.js');
const index = read('docs/mvp-walk/index.html');
const bloom = read('docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg');
const still = bin('docs/mvp-walk/assets/genesis-3d/stills/green-teal-bloom.jpg');
const kandi = read('surfaces/kandi.html');
const firstWork = read('docs/mvp-walk/first-work.html');
const firstWorkJs = read('docs/mvp-walk/assets/first-work/work.js');
const receiveJs = read('docs/mvp-walk/assets/first-work/receive.js');
const collection = read('docs/mvp-walk/assets/artist-audio/collection.js');
const register = read('surfaces/register.js');
const CANONICAL = '../first-work.html#work=bnr-genesis-bloom-v1';

function extractById(html, id) {
  const open = html.match(new RegExp(`<(?<tag>[a-z][a-z0-9]*)([^>]*\\sid="${id}"[^>]*)>`, 'i'));
  assert.ok(open, '#' + id + ' must exist');
  const tag = open.groups.tag;
  const start = open.index;
  let depth = 1;
  const finder = new RegExp('<' + tag + '\\b[^>]*>|</' + tag + '>', 'gi');
  finder.lastIndex = start + open[0].length;
  let next;
  while ((next = finder.exec(html))) {
    if (next[0].startsWith('</')) depth--;
    else depth++;
    if (depth === 0) return html.slice(start, next.index + next[0].length);
  }
  return html.slice(start);
}

function firstScreen(html) {
  const details = html.indexOf('<details');
  return details === -1 ? html : html.slice(0, details);
}

test('New bee is the default; shared register host; three authored views on both interactive pages', () => {
  for (const page of [work, share]) {
    assert.match(page, /<body data-reg="bee" data-bee-theme="custom">/);
    assert.match(page, /data-register-host/);
    assert.match(page, /surfaces\/register\.js\?v=9/);
    assert.match(page, /data-view="bee"/);
    assert.match(page, /data-view="raver"/);
    assert.match(page, /data-view="cypherpunk"/);
    assert.match(page, /body\[data-reg=raver\]/);
    assert.match(page, /body\[data-reg=cypherpunk\]/);
  }
});

test('the same work and full maker credit sit in unmarked shared prose', () => {
  const credit = extractById(work, 'bloom-heading');
  assert.match(work, /<b>LoVis and his mother<\/b>/);
  assert.doesNotMatch(work.slice(work.indexOf('<p class="credit">'), work.indexOf('</p>', work.indexOf('<p class="credit">')) + 4), /data-view=/);
  assert.match(work, /Original artwork/);
  assert.match(work, /Motion study by Astra/);
  assert.match(share, /<strong>LoVis<\/strong>/);
  assert.match(share, /<span>and his mother<\/span>/);
  assert.match(share, /Genesis bloom/);
  assert.equal(credit.includes('Green–teal–purple bloom'), true);
  assert.doesNotMatch(share, /text-overflow:\s*ellipsis/);
  assert.match(share, /\.credit-block\{[\s\S]*overflow:\s*visible/);
});

test('colour meaning is named in words, not hue alone', () => {
  assert.match(work, /Purple — humans/);
  assert.match(work, /Teal — AI/);
  assert.match(work, /Green — biomass/);
  assert.match(share, /Purple — humans/);
  assert.match(share, /Teal — AI/);
  assert.match(share, /Green — biomass/);
  assert.match(work, /named in words as well as hue/);
});

test('one canonical work identity; this pack does not wrap Keep or invent a second record', () => {
  assert.match(work, new RegExp(CANONICAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(share, new RegExp(CANONICAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(js, /bnr-genesis-bloom-v1/);
  assert.match(firstWorkJs, /const id = 'bnr-genesis-bloom-v1'/);
  assert.doesNotMatch(js, /bloom-genesis-lovis-mother/);
  assert.doesNotMatch(js, /WORK_REF/);
  assert.doesNotMatch(js, /saveItem/);
  assert.doesNotMatch(js, /BNRListenLater/);
  assert.doesNotMatch(js, /removeItem/);
  assert.doesNotMatch(work, /keep-reference/);
  assert.doesNotMatch(work, /forget-reference/);
  assert.doesNotMatch(work, /artist-audio\/collection\.js/);
  assert.doesNotMatch(share, /artist-audio\/collection\.js/);
  assert.doesNotMatch(work, /assets\/first-work\/work\.js/);
  assert.doesNotMatch(work, /assets\/first-work\/receive\.js/);
  assert.doesNotMatch(share, /assets\/first-work\/work\.js/);
  assert.doesNotMatch(share, /assets\/first-work\/receive\.js/);
  assert.match(work, /Keep or share this bloom/);
  assert.match(share, /Open the connected bloom/);
});

test('loaded artwork keeps an accessible named image; SVG is not aria-hidden', () => {
  assert.match(work, /aria-labelledby="bloom-heading bloom-desc"/);
  assert.match(work, /id="bloom-desc"/);
  assert.match(work, /alt="Original green–teal–purple bloom by LoVis and his mother/);
  assert.match(js, /setAttribute\('role', 'img'\)/);
  assert.match(js, /setAttribute\('aria-label', named\)/);
  assert.match(js, /removeAttribute\('aria-hidden'\)/);
  assert.doesNotMatch(js, /bloom\.setAttribute\(['"]aria-hidden['"]/);
  assert.match(js, /nameLoadedArtwork/);
});

test('New bee first screen stays visual; engineering notes are folded', () => {
  const beeLead = work.match(/<span data-view="bee">([\s\S]*?)<\/span>/)[1];
  const open = firstScreen(work);
  assert.doesNotMatch(beeLead, /<ol[\s>]/i);
  assert.doesNotMatch(beeLead, /<(p|div|li)[^>]*>\s*\d+[\.\)]\s/);
  assert.doesNotMatch(open, /Pending Astra/i);
  assert.doesNotMatch(open, /bnr-listen-later/);
  assert.doesNotMatch(open, /PR #31/);
  assert.doesNotMatch(open, /Artist support/i);
  assert.doesNotMatch(open, /destination pending/i);
  assert.match(open, /Preview · not a live campaign/);
  assert.match(open, /The bloom they made together/);
  assert.match(work, /<details[\s\S]*bnr-genesis-bloom-v1/);
  assert.match(work, /<summary>About this preview<\/summary>/);
  assert.doesNotMatch(share, /<ol[\s>]/i);
  assert.match(share, /The bloom they made together/);
});

test('no empty artist-support call-to-action; no invented shop', () => {
  assert.doesNotMatch(work, /Artist-selected destination pending/);
  assert.doesNotMatch(share, /artist-selected destination pending/i);
  assert.doesNotMatch(work, /Artist support/);
  assert.doesNotMatch(work, /href=["'][^"']*bandcamp/i);
  assert.doesNotMatch(share, /href=["'][^"']*bandcamp/i);
  assert.doesNotMatch(work, /bandcamp\.com/i);
  assert.doesNotMatch(share, /bandcamp\.com/i);
});

test('hero reuses the original still and optional breathing SVG; Blender builders are untouched', () => {
  assert.match(work, /assets\/genesis-3d\/stills\/green-teal-bloom\.jpg/);
  assert.match(work, /assets\/genesis-3d\/motion\/green-teal-breathing\.svg/);
  assert.match(share, /assets\/genesis-3d\/stills\/green-teal-bloom\.jpg/);
  assert.equal(still.slice(0, 3).toString('hex'), 'ffd8ff');
  assert.ok(still.length > 8000 && still.length < 40000, 'lightweight still, not a 1MB relief');
  assert.match(bloom, /class="bnr-breathing-bloom"/);
  assert.match(bloom, /prefers-reduced-motion: reduce/);
  assert.match(js, /is-paused/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(work, /build-breathing-blender|build-study\.py/);
  assert.ok(bloom.includes(still.toString('base64')));
});

test('share card print layout stays light; QR is not printed as a real code', () => {
  assert.match(share, /@media print/);
  assert.match(share, /#bregbar,#bregctl,\[data-register-host\],\.preview,\.crumb,\.lead,\.actions,\.bound,details\.tool,footer,#copy-status\{display:none/);
  assert.match(share, /QR is not printed/);
  assert.doesNotMatch(share, /<img[^>]+qr/i);
  assert.doesNotMatch(share, /native re-import/i);
  assert.doesNotMatch(work, /native re-import/i);
  assert.doesNotMatch(share, /public social rendering was observed/i);
});

test('supersession is named: withdrawn draft id is not the receive path', () => {
  assert.match(work, /bloom-genesis-lovis-mother/);
  assert.match(work, /is superseded/);
  assert.match(share, /withdrawn draft id/);
  assert.match(firstWork, /bnr-genesis-bloom-v1/);
  assert.doesNotMatch(firstWork, /bloom-genesis-lovis-mother/);
});

test('externals open in a new tab with a visible new-tab label; BNR stays here', () => {
  const ext = [...work.matchAll(/<a\b([^>]*)>/g)].filter(m => /https?:\/\//.test(m[1]));
  assert.ok(ext.length >= 1, 'at least one external link');
  ext.forEach(m => {
    assert.match(m[1], /target="_blank"/);
    assert.match(m[1], /rel="noopener noreferrer"/);
  });
  assert.match(work, /opens in a new tab/);
  assert.match(work, /Your BNR page stays here/);
});

test('optional media is folded; visual-first journey does not require sound', () => {
  assert.match(work, /<summary>Optional listen<\/summary>/);
  assert.doesNotMatch(work, /<details[^>]*open[^>]*>[\s\S]*Optional listen/);
  assert.match(work, /Sound is not required to meet this work/);
  assert.match(work, /TEST AUDIO — not an authorized release/);
});

test('walk index lists connected work then companion; live kandi and #35 controller bytes are not this change', () => {
  assert.match(index, /first-work.html#work=bnr-genesis-bloom-v1/);
  assert.match(index, /works\/bloom-genesis.html/);
  assert.match(index, /works\/bloom-genesis-share.html/);
  assert.match(index, /canonical receive path/);
  assert.doesNotMatch(kandi, /bloom-genesis/);
  assert.doesNotMatch(kandi, /Keep a reference/);
  assert.match(work, /does not edit <code>surfaces\/kandi\.html<\/code>/);
  assert.match(firstWorkJs, /root\.BNRFirstWork/);
  assert.match(receiveJs, /keep-work/);
  assert.match(collection, /BNRListenLater/);
  assert.match(register, /bregister/);
});
