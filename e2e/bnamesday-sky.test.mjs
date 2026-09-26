/* bnamesday-sky.test.mjs — the sky lens is held to witnesses that are not us.
   · the planets, Sun and Moon → JPL Horizons (e2e/bnamesday-sky-oracle.json, fetched 2026-09-20)
   · the lunar node → where the real Moon actually crossed the ecliptic (Horizons again)
   · the Moon series → Meeus's own worked example (Astronomical Algorithms, 47.a)
   · the five types → charts published by others for well-documented births
   · the Chinese calendar → sixteen known New Year dates, the awkward leap-month years included
   · the wheel of 64 → arithmetic: Shao Yong's circle IS binary counting, or the claim is false
   "Verify against a foreign oracle, never against our own code." No browser needed: the core is pure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const read = (p) => readFileSync(ROOT + '/' + p, 'utf8');
const sandbox = { Intl, Date, Math }; vm.runInNewContext(read('surfaces/bnamesday-sky.js'), sandbox);
const K = sandbox.bNamesSky, payload = JSON.parse(read('surfaces/bnamesday-sky.json')), oracle = JSON.parse(read('e2e/bnamesday-sky-oracle.json'));
K.load(payload);
const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('the wheel of sixty-four is binary counting — Shao Yong’s circle, no one’s invention', () => {
  assert.equal(K.wheelIsBinary(), true);
  assert.deepEqual([...K.WHEEL].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1), 'every hexagram once');
  assert.equal(K.binaryOf(2), 0); assert.equal(K.binaryOf(1), 63); assert.equal(K.binaryOf(24), 32); assert.equal(K.binaryOf(44), 31);
  for (let n = 1; n <= 64; n++) { const h = K.hexagram(n); assert.equal(h.lines.length, 6); assert.ok(h.zh && h.py && h.en && h.upper && h.lower, 'hexagram ' + n + ' is fully named'); assert.equal(h.glyph.codePointAt(0), 0x4DC0 + n - 1); }
  /* opposite seats are complements: every yang line answers a yin line across the circle */
  K.WHEEL.forEach((n, i) => assert.equal(K.binaryOf(n) + K.binaryOf(K.WHEEL[(i + 32) % 64]), 63, n + ' and its opposite'));
  const g = K.gateOf(223.25 + 0.001); assert.equal(g.gate, 1, 'hexagram 1 opens at 13°15′ Scorpio'); assert.equal(g.line, 1);
  assert.equal(K.gateOf(358.25 + 5.62).gate, 25); assert.equal(K.gateOf(358.25 + 5.62).line, 6); assert.equal(K.gateOf(302).gate, 41);
});

test('nine centres hold the sixty-four once each; thirty-six channels join them', () => {
  const all = Object.values(K.CENTRES).flat(); assert.equal(all.length, 64); assert.equal(new Set(all).size, 64);
  assert.equal(K.CHANNELS.length, 36); assert.equal(new Set(K.CHANNELS.map((c) => [...c].sort((a, b) => a - b).join('-'))).size, 36);
  for (const [a, b] of K.CHANNELS) assert.notEqual(K.CENTRE_OF[a], K.CENTRE_OF[b], a + '-' + b + ' joins two different centres');
  /* every hexagram ends exactly one channel — except the four of the integration circuit, which end three each: 60 + 4×3 = 72 ends */
  const ends = {}; K.CHANNELS.forEach(([a, b]) => { for (const g of [a, b]) ends[g] = (ends[g] || 0) + 1; });
  assert.equal(Object.keys(ends).length, 64, 'no hexagram is left out of the channels');
  assert.deepEqual(Object.keys(ends).filter((g) => ends[g] !== 1).map(Number).sort((a, b) => a - b), [10, 20, 34, 57]);
  for (const g of [10, 20, 34, 57]) assert.equal(ends[g], 3);
});

test('Sun, Moon and planets stay inside their stated trust of JPL Horizons, 1850–2060', () => {
  const worst = {};
  for (const [body, lons] of Object.entries(oracle.lon)) { worst[body] = 0; oracle.jd_ut.forEach((jd, i) => { worst[body] = Math.max(worst[body], apart(K.lonOf(body, K.ttOf(jd)), lons[i])); });
    assert.ok(worst[body] <= K.TRUST[body], `${body}: ${(worst[body] * 3600).toFixed(1)}″ from Horizons, trust is ${(K.TRUST[body] * 3600).toFixed(0)}″`); }
  assert.ok(worst.sun * 3600 < 1 && worst.jupiter * 3600 < 3 && worst.moon * 3600 < 10, 'and the measured errors are arc-seconds, not arc-minutes');
});

test('the true lunar node stays inside its trust of the real Moon’s ecliptic crossings', () => {
  assert.equal(oracle.node_crossings.length, 4);
  for (const c of oracle.node_crossings) assert.ok(apart(K.nodeLon(K.ttOf(c.jd_ut)), c.lon) <= K.TRUST.node, 'node at JD ' + c.jd_ut);
});

test('the Moon series reproduces Meeus 47.a', () => { assert.ok(Math.abs(K.moonLon(2448724.5) - 133.167265) < 0.0001); });

test('wall-clock time in a named zone becomes UT, history included', () => {
  assert.equal(K.localToJd(1961, 8, 4, 19, 24, 'Pacific/Honolulu').offsetMinutes, -600);
  assert.equal(K.localToJd(1964, 7, 26, 3, 15, 'America/New_York').offsetMinutes, -240, 'daylight time in July 1964');
  assert.equal(K.localToJd(1954, 1, 29, 4, 30, 'America/Chicago').offsetMinutes, -360);
  assert.equal(K.localToJd(2000, 1, 1, 12, 0, '+07:00').offsetMinutes, 420); assert.equal(K.localToJd(2000, 1, 1, 12, 0, 'UTC').jd, 2451545);
  assert.throws(() => K.localToJd(2000, 1, 1, 12, 0, 'Not/AZone'));
});

test('published charts reproduce: type, lines and how they decide', () => {
  /* as published by others for these well-documented births */
  const known = [['Ra Uru Hu', 1948, 4, 9, 0, 14, 'America/Toronto', 'manifestor', '5/1', 'spleen'], ['Barack Obama', 1961, 8, 4, 19, 24, 'Pacific/Honolulu', 'projector', '6/2', 'solar'],
    ['Sandra Bullock', 1964, 7, 26, 3, 15, 'America/New_York', 'reflector', '2/4', 'moon'], ['Oprah Winfrey', 1954, 1, 29, 4, 30, 'America/Chicago', 'generator', '2/4', 'solar'],
    ['Angelina Jolie', 1975, 6, 4, 9, 9, 'America/Los_Angeles', 'mg', '3/5', 'solar']];
  for (const [who, y, m, d, hh, mm, tz, type, lines, auth] of known) { const c = K.chart(K.localToJd(y, m, d, hh, mm, tz).jd);
    assert.equal(c.type, type, who); assert.equal(c.lines, lines, who); assert.equal(c.authority, auth, who); assert.equal(c.activations.length, 26); }
  assert.deepEqual([...K.chart(K.localToJd(1964, 7, 26, 3, 15, 'America/New_York').jd).defined], [], 'a Reflector joins no centre');
  const ob = K.chart(K.localToJd(1961, 8, 4, 19, 24, 'Pacific/Honolulu').jd); assert.deepEqual([...ob.defined], ['solar', 'root']); assert.equal(ob.four[0].gate + '.' + ob.four[0].line, '33.6');
  assert.ok(apart(K.sunLon(ob.jdBefore), K.sunLon(ob.jdTT) - 88) < 1e-6, 'the earlier moment is the Sun 88° of arc before, solved not guessed');
});

test('without a birth hour the lens says what holds all day and what does not', () => {
  const d = K.chartsOfDay(1961, 8, 4, 'Pacific/Honolulu'); assert.ok(d.types.length >= 1); assert.equal(d.certain, d.types.length === 1); assert.ok(K.TYPES[d.noon.type]);
  for (const t of Object.values(K.TYPES)) assert.ok(t.en && t.way && t.work && /^#[0-9A-Fa-f]{6}$/.test(t.color));
  /* a body nearer an edge than its trust is flagged, never silently placed */
  const c = K.chart(K.localToJd(1964, 7, 26, 3, 15, 'America/New_York').jd); for (const f of c.flags) assert.ok(f.edge <= K.TRUST[f.body]);
});

test('the Chinese calendar comes out of the Sun and Moon: sixteen New Years, leap months included', () => {
  const known = { 1899: '2-10', 1900: '1-31', 1902: '2-8', 1931: '2-17', 1954: '2-3', 1961: '2-15', 1968: '1-30', 1979: '1-28', 1985: '2-20', 2000: '2-5', 2023: '1-22', 2024: '2-10', 2025: '1-29', 2026: '2-17', 2033: '1-31', 2034: '2-19' };
  for (const [y, want] of Object.entries(known)) { const c = K.chineseNewYear(+y); assert.equal(c.m + '-' + c.d, want, 'Chinese New Year ' + y); }
});

test('four pillars, and the two ways of turning the year', () => {
  const a = K.china(2000, 1, 1, 12, 0, 'Asia/Shanghai'); assert.deepEqual([a.year.zh, a.month.zh, a.day.zh, a.hour.zh], ['己卯', '丙子', '戊午', '戊午']); assert.equal(a.popular.animal, 'Rabbit');
  const jan = K.china(1979, 1, 5, undefined, undefined, 'Europe/Riga'); assert.equal(jan.popular.animal, 'Horse', 'born before the 28 January New Year: still the Horse, not the Goat'); assert.equal(jan.bornBeforeNewYear, true); assert.equal(jan.hour, null);
  assert.equal(K.china(2024, 2, 4, 10, 0, 'Asia/Shanghai').year.zh, '癸卯', 'before the start of spring'); assert.equal(K.china(2024, 2, 4, 18, 0, 'Asia/Shanghai').year.zh, '甲辰', 'after it (立春 fell at 16:27)');
  const between = K.china(2024, 2, 7, 12, 0, 'Asia/Shanghai'); assert.equal(between.yearsDiffer, true, 'after the start of spring, before the New Year: the two conventions disagree, and the page says so');
  assert.equal(K.china(2000, 1, 1, 23, 30, 'Asia/Shanghai').day.zh, '己未', 'the day turns at 23:00');
  assert.equal(K.relation(0, 6).kind, 'clash'); assert.equal(K.relation(0, 4).kind, 'trine'); assert.equal(K.relation(0, 1).kind, 'pair'); assert.equal(K.relation(0, 2).kind, 'none');
  for (const e of Object.keys(K.ELEMENT)) { assert.ok(K.FEEDS[e] && K.CHECKS[e]); assert.notEqual(K.FEEDS[e], K.CHECKS[e]); }
});

test('the payload says where it came from and what it threw away; the core stays pure', () => {
  assert.equal(payload.v, 1); assert.match(payload._meta.source, /VI\/81/); assert.equal(Object.keys(payload._meta.source_files).length, 8);
  for (const [b, w] of Object.entries(payload._meta.measured_truncation_heliocentric)) assert.ok(w.L_arcsec < 1, b + ' truncation under an arc-second, measured');
  assert.doesNotMatch(read('surfaces/bnamesday-sky.js'), /fetch\(|localStorage|document\.|window\./);
  assert.throws(() => K.load({ v: 2 }), /v:1/);
});
