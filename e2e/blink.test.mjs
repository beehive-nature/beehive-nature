// bLink (surfaces/blink.js): one public record for a file on Autonomi. Pure parse and format;
// no browser, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const BLink = createRequire(import.meta.url)('../surfaces/blink.js');
const A = 'ab'.repeat(32);

test('an address alone: bare, autonomi://, upper case; no label is invented', () => {
  for (const raw of [A, 'autonomi://' + A, '  ' + A.toUpperCase() + '\n']) {
    assert.deepEqual(BLink.parse(raw), { adapter: 'autonomi', address: A, name: '', size: null, type: '', handler: null });
  }
});

test('refuses anything without a complete address', () => {
  for (const raw of ['', null, undefined, 'autonomi://' + A.slice(2), A + 'ab', 'a=' + A.slice(1), 'https://example.org/d/?n=x.zip', 'g'.repeat(64)]) {
    assert.equal(BLink.parse(raw), null, String(raw));
  }
  assert.throws(() => BLink.format({ address: 'nope' }, ''), /complete 64-character address/);
});

test('reads the query form other Autonomi download buttons publish', () => {
  const link = BLink.parse('https://example.org/mirror/d/?a=' + A + '&n=my-mod-v1.2.zip&s=1048576&v=compact');
  assert.equal(link.address, A); assert.equal(link.name, 'my-mod-v1.2.zip'); assert.equal(link.size, 1048576);
  assert.equal(link.handler, 'download');
});

test('reads its own fragment form, the bare fragment, and round-trips every label', () => {
  const link = { address: A, name: 'a & b 100%.webm', size: 7, type: 'video/webm', handler: 'download' };
  const url = BLink.format(link, 'https://skaists.dev/surfaces/bview.html?x=1#old');
  assert.equal(url, 'https://skaists.dev/surfaces/bview.html#a=' + A + '&n=a%20%26%20b%20100%25.webm&s=7&t=video%2Fwebm&h=download');
  assert.deepEqual(BLink.parse(url), { adapter: 'autonomi', ...link });
  assert.deepEqual(BLink.parse(url.slice(url.indexOf('#') + 1)), { adapter: 'autonomi', ...link });
  assert.equal(BLink.parse('https://skaists.dev/surfaces/bview.html#' + A).address, A);
  assert.equal(BLink.parse('https://skaists.dev/surfaces/bview.html#autonomi%3A%2F%2F' + A).address, A);
  assert.equal(BLink.format({ address: A }, 'bview.html'), 'bview.html#a=' + A);
});

test('labels are cleaned, never trusted: paths, control and direction characters, bad sizes and types', () => {
  const q = new URLSearchParams({ a: A, n: '../..\\evil‮gnp.exe. ', s: '-5', t: 'text/html; charset=x', h: 'run' });
  const link = BLink.parse('?' + q);
  assert.equal(link.name, 'evilgnp.exe'); assert.equal(link.size, null); assert.equal(link.type, '');
  assert.equal(link.handler, 'download');
  assert.equal(BLink.parse('a=' + A + '&s=99999999999999999').size, null);
  assert.equal(Array.from(BLink.parse('a=' + A + '&n=' + 'é'.repeat(500)).name).length, 200);
});

test('handler: explicit and known wins, then type, then name; otherwise the surface decides', () => {
  const h = extra => BLink.parse('a=' + A + extra).handler;
  assert.equal(h(''), null);
  assert.equal(h('&n=clip.MP4'), 'watch'); assert.equal(h('&n=song.opus'), 'watch');
  assert.equal(h('&n=photo.jpg'), 'view'); assert.equal(h('&n=Welcome.md'), 'view');
  assert.equal(h('&n=data.bin'), 'download'); assert.equal(h('&n=noextension'), 'download');
  assert.equal(h('&n=data.bin&t=video/mp4'), 'watch'); assert.equal(h('&n=clip.mp4&t=application/zip'), 'download');
  assert.equal(h('&n=clip.mp4&h=download'), 'download'); assert.equal(h('&n=data.bin&h=WATCH'), 'watch');
});

test('the name on disk: the label, else the network name, else the address', () => {
  assert.equal(BLink.saveName(BLink.parse('a=' + A + '&n=x.zip'), 'net.bin'), 'x.zip');
  assert.equal(BLink.saveName(BLink.parse(A), '../net.bin'), 'net.bin');
  assert.equal(BLink.saveName(BLink.parse(A), ''), 'autonomi-abababab.bin');
});

test('a bLink has no field for payment, receipt, sponsor or person', () => {
  const link = BLink.parse('a=' + A + '&n=x.zip&receipt=r1&sponsor=bnr&payer=0xabc&did=someone');
  assert.deepEqual(Object.keys(link).sort(), ['adapter', 'address', 'handler', 'name', 'size', 'type']);
  assert.doesNotMatch(BLink.format({ ...link, receipt: 'r1', sponsor: 'bnr' }, ''), /receipt|sponsor|r1|bnr/);
});

test('format writes a handler only when the type and the name do not already say it', () => {
  assert.equal(BLink.format(BLink.parse('a=' + A + '&n=clip.webm'), ''), '#a=' + A + '&n=clip.webm');
  assert.equal(BLink.format(BLink.parse('a=' + A + '&n=clip.webm&h=download'), ''), '#a=' + A + '&n=clip.webm&h=download');
});
