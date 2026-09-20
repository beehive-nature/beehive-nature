/* bnamesday.test.mjs — bNames Day holds to what it says. No browser: the core is pure by design.
   Three things are on trial:
   1. THE FACTS — the thaksa table, the Thai day's two boundaries, the two old calendars. Each is
      asserted against the value a named source publishes, not against our own output.
   2. THE PAYLOAD — bnamesday-data.json is what the State Language Centre's CSVs say, and the
      numbers the page states out loud are the payload's own.
   3. THE CANON — one set of facts and capabilities in three authored views (register canon
      2026-08-28), and the family a reader adds never rides anything but their own browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const read = (p) => readFileSync(ROOT + '/' + p, 'utf8');
/* the core runs in its own realm, so arrays it returns are spread into ours before a deep compare */
const sandbox = {}; vm.runInNewContext(read('surfaces/bnamesday.js'), sandbox);
const B = sandbox.bNamesDay;
const data = JSON.parse(read('surfaces/bnamesday-data.json'));
const ix = B.buildIndex(data);
const html = read('surfaces/bnamesday.html');

test('thaksa: all eight กาลกิณี rows equal the published table', () => {
  /* thaibabyname.com/astrology_mahataksa.asp and อำนาจ ปักษาสุข, VANNAVIDAS (ThaiJO) — birth day → letters to leave out */
  const published = { Sunday: 'ศษสหฬฮ', Monday: 'VOWELS', Tuesday: 'กขคฆง', Wednesday: 'จฉชซฌญ', Thursday: 'ดตถทธน', Friday: 'ยรลว', Saturday: 'ฎฏฐฑฒณ', 'Wednesday night': 'บปผฝพฟภม' };
  B.DAYS.forEach((d, i) => {
    const rows = B.thaksa(i), k = rows[7];
    assert.equal(k.kalakini, true); assert.equal(k.house.th, 'กาลกิณี');
    assert.equal(k.group.show ? 'VOWELS' : k.group.letters.join(''), published[d.en], d.en);
    assert.equal(rows[0].group.id, d.planet.id, d.en + ': บริวาร is the day’s own planet');
    assert.equal(new Set(rows.map((r) => r.group.id)).size, 8, d.en + ': eight distinct houses');
  });
  assert.deepEqual([...B.RING.map((g) => g.id)], ['sun', 'moon', 'mars', 'mercury', 'saturn', 'jupiter', 'rahu', 'venus'], 'ring order is the mechanism');
});

test('the Thai day turns at 06:00, and Wednesday night is Rahu’s', () => {
  const d = (y, m, dd, hh) => B.thaiDay(y, m, dd, hh, 0).day.id;
  assert.equal(B.thaiDay(1979, 1, 5).day.id, 'fri');
  assert.equal(d(2026, 9, 21, 2), 'sun', 'Monday 02:00 still belongs to Sunday');
  assert.equal(d(2026, 9, 23, 17), 'wed'); assert.equal(d(2026, 9, 23, 18), 'rahu');
  assert.equal(d(2026, 9, 24, 5), 'rahu', 'Thursday 05:00 is still Wednesday night');
  assert.equal(d(2026, 9, 24, 6), 'thu');
  assert.equal(d(2026, 9, 23, 3), 'tue', 'Wednesday 03:00 is Tuesday, not Rahu');
  /* without a time the function must SAY what it cannot know */
  assert.deepEqual([...B.thaiDay(2026, 9, 23).open], ['dawn', 'rahu']);
  assert.deepEqual([...B.thaiDay(2026, 9, 24).open], ['dawn', 'rahu-before-dawn']);
});

test('a Thai name is read letter by letter; tone marks carry no house', () => {
  const x = B.xray('สมชาย', 3); /* born Wednesday: leave out จ ฉ ช ซ ฌ ญ */
  assert.equal(x.kalakini, 1); assert.equal(x.cells.find((c) => c.kalakini).ch, 'ช');
  assert.equal(B.xray('กมล', 1).kalakini, 0, 'a Monday name written without vowels');
  assert.ok(B.xray('สมชาย', 1).kalakini >= 1, 'Monday leaves out every written vowel');
  assert.equal(B.xray('ต้น', 0).cells[1].skip, true, 'mai tho is silent');
  assert.equal(B.xray('Anna', 0).thai, false);
});

test('old records: Old Style → New Style, and the Thai year', () => {
  const j = (y, m, d) => { const g = B.oldStyleToNew(y, m, d); return [g.y, g.m, g.d, g.gap].join(' '); };
  assert.equal(j(1850, 6, 12), '1850 6 24 12'); assert.equal(j(1900, 2, 28), '1900 3 12 12');
  assert.equal(j(1900, 3, 1), '1900 3 14 13', 'the gap widens on 1 March 1900'); assert.equal(j(1799, 12, 31), '1800 1 11 11');
  assert.equal(B.thaiYearToCE(2569, 'be', 9).ce, 2026);
  assert.equal(B.thaiYearToCE(2470, 'be', 2).ce, 1928, 'before 1941 January–March belong to the next common-era year');
  assert.equal(B.thaiYearToCE(2470, 'be', 5).ce, 1927); assert.equal(B.thaiYearToCE(2484, 'be', 2).ce, 1941, 'from 1941 the year turns on 1 January');
  assert.match(B.thaiYearToCE(2470, 'be', 0).caveat, /1 April/); assert.equal(B.thaiYearToCE(131, 'rs', 0).ce, 1912);
});

test('the payload is the Centre’s, and the page’s numbers are the payload’s', () => {
  assert.equal(data.v, 1, 'payloads carry v');
  const keys = Object.keys(data.days); assert.equal(keys.length, 366);
  const t = keys.flatMap((k) => data.days[k].t), x = keys.flatMap((k) => data.days[k].x);
  assert.deepEqual([t.length, x.length], [data._meta.counts.traditional, data._meta.counts.extended_only]);
  assert.equal(new Set(t).size, t.length, 'a calendar name has one day');
  assert.deepEqual(data.days['02-29'], { t: [], x: [] }, '29 February is the one empty day — the page says so');
  assert.equal(data.notes['05-22'].lv, 'Visu neparasto un kalendāros neierakstīto vārdu diena');
  for (const n of [...t, ...x]) assert.match(n, /^\p{Lu}[\p{L}'’-]*$/u, 'a name is letters, never markup: ' + n);
  for (const k of keys) if (k !== '02-29') assert.ok(data.days[k].t.length, k);
  assert.match(data._meta.licence, /^CC0/); assert.match(data._meta.caveat, /2026-01-01/, 'the 2026 additions are declared missing, not silently absent');
  assert.deepEqual(data.days['06-24'].t, ['Jānis']); assert.deepEqual(data.days['09-20'].t, ['Guntra', 'Ginters', 'Marianna']);
  /* the ending rule the page calls an inference: all twelve -o names of the printed calendar are masculine */
  assert.equal(ix.all.filter((e) => e.list === 't' && e.end === 'o').length, 12);
  assert.equal(ix.all.filter((e) => e.list === 't' && e.end === '?').length, 0);
});

test('a name finds its day with diacritics forgiven; an unwritten name gets 22 May', () => {
  assert.deepEqual([...B.findName(ix, 'janis').exact.map((e) => e.name + ' ' + e.key + ' ' + e.list)], ['Jānis 06-24 t', 'Janis 08-27 x']);
  assert.equal(B.findName(ix, 'INGA').exact[0].key, '12-28');
  assert.equal(B.findName(ix, 'Remington').exact.length, 0);
  const fam = B.familyDays(ix, B.cleanPeople({ v: 1, people: [{ name: 'Remington' }, { name: 'Anna Marija', born: '1902-03-14' }] }).people);
  assert.deepEqual([...fam.map((e) => e.kind + ' ' + e.key)], ['name 05-22', 'name 07-26', 'birth 03-14'], 'the calendar’s own rule, and the first given name');
  assert.ok(B.variants(ix, B.findName(ix, 'mara').exact[0]).includes('Mārīte'));
  assert.equal(B.findName(ix, 'Mora').exact[0].ltg, 'Muora', 'Latgalian written forms ride with their name');
});

test('the wheel has 366 seats and 29 February waits for a leap year', () => {
  for (let s = 0; s < 366; s++) assert.equal(B.seatOf(B.keyOfSeat(s)), s);
  assert.equal(B.keyOfSeat(-1), '12-31'); assert.equal(B.seatOf('02-29'), 59);
  assert.deepEqual({ ...B.nextOccurrence('02-29', { y: 2026, m: 9, d: 20 }) }, { y: 2028, m: 2, d: 29, inDays: 527 });
  assert.equal(B.nextOccurrence('09-20', { y: 2026, m: 9, d: 20 }).inDays, 0);
});

test('the family file: shape-checked in, a real calendar out', () => {
  assert.throws(() => B.cleanPeople({ v: 2, people: [] }), /v:1/); assert.throws(() => B.cleanPeople({ v: 1, people: [{ name: '  ' }] }), /no name/);
  const p = B.cleanPeople({ v: 1, people: [{ name: ' Anna ', side: 'mars', born: 'yesterday', id: '<script>', rel: 'x'.repeat(200), extra: 1 }] }).people[0];
  assert.equal(p.name, 'Anna'); assert.equal(p.side, 'other'); assert.equal(p.born, ''); assert.match(p.id, /^[a-z0-9]{6,24}$/); assert.equal(p.rel.length, 60); assert.equal(p.extra, undefined);
  const cal = B.ics([{ key: '06-24', uid: 'p1-name', summary: 'Vārda diena: Jānis, (vectēvs)' }, { key: '02-29', uid: 'p2-birth', summary: 'x' }], '20260920T000000Z');
  assert.ok(cal.endsWith('END:VCALENDAR\r\n')); assert.equal(cal.split('\r\n').filter((l) => l === 'RRULE:FREQ=YEARLY').length, 2);
  assert.ok(cal.includes('DTSTART;VALUE=DATE:20250624\r\nDTEND;VALUE=DATE:20250625')); assert.ok(cal.includes('SUMMARY:Vārda diena: Jānis\\, (vectēvs)'));
  assert.ok(cal.includes('DTSTART;VALUE=DATE:20240229\r\nDTEND;VALUE=DATE:20240301'), '29 February anchors on a leap year');
});

test('one set of capabilities in three authored views — and nothing leaves the device', () => {
  const views = {}; for (const r of ['bee', 'raver', 'cypherpunk']) {
    const i = html.indexOf('<div data-view="' + r + '">'); assert.ok(i > 0, r + ' view exists');
    const next = ['raver', 'cypherpunk'].map((n) => html.indexOf('<div data-view="' + n + '">')).filter((j) => j > i)[0] || html.indexOf('</main>');
    views[r] = html.slice(i, next);
  }
  const must = { 'find a name': /data-form="(name|rtools|cq)"/, 'read a birth day': /data-form="(birth|rtools)"/, 'keep someone': /data-form="add"/,
    'old style → new style': /data-form="os"/, 'a Thai year → CE': /data-form="be"/, 'calendar file': /data-act="ics"/, 'save a copy': /data-act="export"/, 'bring a copy back': /data-act="import"/ };
  for (const [r, body] of Object.entries(views)) for (const [cap, re] of Object.entries(must)) assert.match(body, re, r + ' can: ' + cap);
  for (const act of ['light', 'hold']) assert.ok(html.includes('data-act="' + act + '"'), 'a candle can be lit: ' + act);
  /* the private lane: one same-origin read, and no way out but a file the reader asks for */
  assert.deepEqual([...html.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1].split(',')[0]), ["'bnamesday-data.json'"]);
  assert.doesNotMatch(html, /XMLHttpRequest|sendBeacon|WebSocket|EventSource|<form[^>]+action=/i);
  assert.doesNotMatch(read('surfaces/bnamesday.js'), /fetch|localStorage|document\.|window\./, 'the core stays pure');
  for (const m of html.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href)="(https?:)?\/\//g)) assert.fail('remote asset: ' + m[0]);
  for (const m of html.matchAll(/<a [^>]*href="https?:[^>]*>/g)) assert.match(m[0], /target="_blank" rel="noopener noreferrer"/, 'external links open a new tab: ' + m[0].slice(0, 80));
});

test('house laws the page keeps', () => {
  assert.equal([...html.matchAll(/<script[^>]+src="[^"]*(?:tour|register)\.js[^"]*"/g)].length, 1); assert.ok(html.includes('<script src="tour.js?v=42"></script>'));
  assert.match(html, /<body data-experience="bnamesday" data-bee-theme="custom" data-reg="bee">/, 'the page authors its own New bee palette');
  assert.doesNotMatch(html, /text-transform\s*:/, 'casings are payload — never forced in CSS');
  assert.doesNotMatch(html, /genealogy/i, 'this is a complement; bGENEaLOGy is its own keeper and is not claimed here');
  assert.match(html, /prefers-reduced-motion/); assert.match(html, /id="loadfail"[^>]*hidden/, 'a failed load shows nothing rather than something guessed');
});
