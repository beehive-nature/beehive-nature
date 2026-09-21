/* bnamesday.js — the shared core of bNames Day. ONE set of facts for three views
   (register canon 2026-08-28: views change prose and density, never constants).
   Everything here is pure: no DOM, no storage, no network — so e2e/bnamesday.test.mjs
   can hold it to account without a browser, and no view can quietly disagree with another.

   Two houses:
   · LATVIA gives a NAME its day — the State Language Centre's calendar (bnamesday-data.json).
   · THAILAND gives a DAY its name — the weekday you were born under rules a colour, a
     planet, a posture of the Buddha, and (ทักษา, thaksa) which letters lift a name and
     which to leave out.
   Sources are named in bnamesday.html's cypherpunk view; nothing here is invented.
   Where tradition and arithmetic part ways, the function says so in its return value. */
(function (root) {
  'use strict';

  /* ── Thailand: the eight of the thaksa ring, IN RING ORDER (clockwise). The order is the
     whole mechanism: a birth day's own planet is บริวาร, and the eight houses are read
     clockwise from there, so the eighth — กาลกิณี — is always the planet just behind you. ── */
  var VOWELS = ['อ', 'ะ', 'ั', 'า', 'ำ', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'เ', 'แ', 'โ', 'ใ', 'ไ'];
  var RING = [
    { id: 'sun',     th: 'อาทิตย์',   en: 'Sun',     glyph: '☉', color: '#d7263d', letters: VOWELS, show: 'อ + สระทั้งหมด' },
    { id: 'moon',    th: 'จันทร์',    en: 'Moon',    glyph: '☽', color: '#e0a800', letters: ['ก', 'ข', 'ค', 'ฆ', 'ง'] },
    { id: 'mars',    th: 'อังคาร',    en: 'Mars',    glyph: '♂', color: '#e0559a', letters: ['จ', 'ฉ', 'ช', 'ซ', 'ฌ', 'ญ'] },
    { id: 'mercury', th: 'พุธ',       en: 'Mercury', glyph: '☿', color: '#2f9e55', letters: ['ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ'] },
    { id: 'saturn',  th: 'เสาร์',     en: 'Saturn',  glyph: '♄', color: '#7b4fc9', letters: ['ด', 'ต', 'ถ', 'ท', 'ธ', 'น'] },
    { id: 'jupiter', th: 'พฤหัสบดี',  en: 'Jupiter', glyph: '♃', color: '#e8772e', letters: ['บ', 'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม'] },
    { id: 'rahu',    th: 'ราหู',      en: 'Rahu',    glyph: '☊', color: '#6b7480', letters: ['ย', 'ร', 'ล', 'ว'] },
    { id: 'venus',   th: 'ศุกร์',     en: 'Venus',   glyph: '♀', color: '#2f8fd8', letters: ['ศ', 'ษ', 'ส', 'ห', 'ฬ', 'ฮ'] }
  ];
  var HOUSES = [
    { th: 'บริวาร',   rom: 'boriwan',  en: 'those in your care' },
    { th: 'อายุ',     rom: 'ayu',      en: 'life and health' },
    { th: 'เดช',      rom: 'det',      en: 'standing and honour' },
    { th: 'ศรี',      rom: 'si',       en: 'fortune and grace' },
    { th: 'มูละ',     rom: 'mula',     en: 'inheritance and roots' },
    { th: 'อุตสาหะ',  rom: 'utsaha',   en: 'effort and work' },
    { th: 'มนตรี',    rom: 'montri',   en: 'elders who lift you' },
    { th: 'กาลกิณี',  rom: 'kalakini', en: 'letters to leave out' }
  ];
  /* the birth days. `ring` is that day's seat on RING; index = JS getDay(), plus Rahu at 7 */
  var DAYS = [
    { id: 'sun', en: 'Sunday',    th: 'วันอาทิตย์',   lv: 'svētdiena',   ring: 0, colorName: 'red',     colorTh: 'สีแดง',   posture: { th: 'ปางถวายเนตร',  en: 'standing, gazing at the Bodhi tree' } },
    { id: 'mon', en: 'Monday',    th: 'วันจันทร์',    lv: 'pirmdiena',   ring: 1, colorName: 'yellow',  colorTh: 'สีเหลือง', posture: { th: 'ปางห้ามญาติ',  en: 'standing, a hand raised to calm a family quarrel' } },
    { id: 'tue', en: 'Tuesday',   th: 'วันอังคาร',    lv: 'otrdiena',    ring: 2, colorName: 'pink',    colorTh: 'สีชมพู',  posture: { th: 'ปางไสยาสน์',   en: 'reclining' } },
    { id: 'wed', en: 'Wednesday', th: 'วันพุธ',       lv: 'trešdiena',   ring: 3, colorName: 'green',   colorTh: 'สีเขียว',  posture: { th: 'ปางอุ้มบาตร',  en: 'standing, holding the alms bowl' } },
    { id: 'thu', en: 'Thursday',  th: 'วันพฤหัสบดี',  lv: 'ceturtdiena', ring: 5, colorName: 'orange',  colorTh: 'สีส้ม',    posture: { th: 'ปางสมาธิ',     en: 'seated in meditation' } },
    { id: 'fri', en: 'Friday',    th: 'วันศุกร์',     lv: 'piektdiena',  ring: 7, colorName: 'blue',    colorTh: 'สีฟ้า',    posture: { th: 'ปางรำพึง',     en: 'standing, hands folded on the chest, in reflection' } },
    { id: 'sat', en: 'Saturday',  th: 'วันเสาร์',     lv: 'sestdiena',   ring: 4, colorName: 'purple',  colorTh: 'สีม่วง',   posture: { th: 'ปางนาคปรก',    en: 'meditating, sheltered by the naga' } },
    { id: 'rahu', en: 'Wednesday night', th: 'วันพุธกลางคืน', lv: 'trešdienas nakts', ring: 6, colorName: 'grey', colorTh: 'สีเทา', posture: { th: 'ปางป่าเลไลยก์', en: 'seated in the forest, an elephant and a monkey bringing gifts' } }
  ];
  DAYS.forEach(function (d) { d.color = RING[d.ring].color; d.planet = RING[d.ring]; });
  /* every word carries how to say it (RTGS romanisation) and what it means — learning the words is the point.
     Latvian weekdays simply count: first day … sixth day, then the holy day. */
  var SAY = { sun: ['wan athit', 'si daeng', 'pang thawai net', 'the holy day'], mon: ['wan chan', 'si lueang', 'pang ham yat', 'the first day'], tue: ['wan angkhan', 'si chomphu', 'pang saiyat', 'the second day'],
    wed: ['wan phut', 'si khiao', 'pang um bat', 'the third day'], thu: ['wan pharuehatsabodi', 'si som', 'pang samathi', 'the fourth day'], fri: ['wan suk', 'si fa', 'pang ramphueng', 'the fifth day'],
    sat: ['wan sao', 'si muang', 'pang nak prok', 'the sixth day'], rahu: ['wan phut klang khuen', 'si thao', 'pang pa lelai', 'the night of the third day'] };
  DAYS.forEach(function (d) { var s = SAY[d.id]; d.rom = s[0]; d.colorRom = s[1]; d.posture.rom = s[2]; d.lvEn = s[3]; });
  var PLANET_TH = { sun: ['พระอาทิตย์', 'phra athit'], moon: ['พระจันทร์', 'phra chan'], mars: ['พระอังคาร', 'phra angkhan'], mercury: ['พระพุธ', 'phra phut'], saturn: ['พระเสาร์', 'phra sao'], jupiter: ['พระพฤหัสบดี', 'phra pharuehatsabodi'], rahu: ['พระราหู', 'phra rahu'], venus: ['พระศุกร์', 'phra suk'] };
  RING.forEach(function (g) { g.thFull = PLANET_TH[g.id][0]; g.rom = PLANET_TH[g.id][1]; });

  /* the eight houses for a birth day: [{house, group}] — a rotation of RING, nothing more */
  function thaksa(dayIndex) {
    var start = DAYS[dayIndex].ring;
    return HOUSES.map(function (h, i) { return { house: h, group: RING[(start + i) % 8], kalakini: i === 7 }; });
  }

  /* Which birth day rules a moment. Two things tradition holds that a wall clock does not:
     the day turns at 06:00, not midnight; and Wednesday from 18:00 to Thursday 06:00 is
     Rahu's. Without a time we cannot know either, so we say which answers stay open. */
  function thaiDay(y, m, d, hh, mm) {
    var hasTime = typeof hh === 'number' && !isNaN(hh);
    var dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    var out = { index: dow, hasTime: hasTime, beforeDawn: false, open: [] };
    if (hasTime) {
      if (hh < 6) { out.beforeDawn = true; dow = (dow + 6) % 7; out.index = dow; }
      if (dow === 3 && (out.beforeDawn || hh >= 18)) out.index = 7;
    } else {
      out.open.push('dawn');                       /* born before 06:00 → the day before */
      if (dow === 3) out.open.push('rahu');        /* born Wed after 18:00 → Rahu */
      if (dow === 4) out.open.push('rahu-before-dawn'); /* Thu before 06:00 → Rahu */
    }
    out.day = DAYS[out.index];
    return out;
  }

  /* A Thai name read against a birth day, letter by letter. Tone marks and ์ carry no house.
     This is the letter-table only — an astrologer or a monk weighs far more than this. */
  var SILENT = /[\u0E47-\u0E4E\u0E3A\s\-.]/;
  function xray(name, dayIndex) {
    var table = thaksa(dayIndex), map = {};
    table.forEach(function (row, i) { row.group.letters.forEach(function (ch) { map[ch] = i; }); });
    var cells = Array.from(String(name || '')).map(function (ch) {
      if (SILENT.test(ch)) return { ch: ch, skip: true };
      if (!/[\u0E00-\u0E7F]/.test(ch)) return { ch: ch, foreign: true };
      var i = map[ch];
      return i === undefined ? { ch: ch, unplaced: true } : { ch: ch, house: table[i].house, group: table[i].group, kalakini: i === 7 };
    });
    return { cells: cells, kalakini: cells.filter(function (c) { return c.kalakini; }).length,
      thai: cells.some(function (c) { return c.house; }) };
  }

  /* ── Latvia: the calendar ── */
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  }
  /* The ending is the gender in Latvian names, almost always. "Almost" is stated, not hidden:
     -o names are masculine in the traditional list (all 12) but mixed beyond it. */
  function ending(name) {
    var c = name.slice(-1).toLowerCase();
    if (c === 's' || c === 'š') return 'm';
    if (c === 'a' || c === 'e') return 'f';
    if (c === 'o') return 'o';
    return '?';
  }
  function buildIndex(data) {
    var all = [], byFold = new Map();
    Object.keys(data.days).sort().forEach(function (key) {
      ['t', 'x'].forEach(function (list) {
        data.days[key][list].forEach(function (name) {
          var e = { name: name, key: key, list: list, f: fold(name), end: ending(name), ltg: (data.ltg || {})[name] || null };
          all.push(e);
          if (!byFold.has(e.f)) byFold.set(e.f, []);
          byFold.get(e.f).push(e);
        });
      });
    });
    return { all: all, byFold: byFold, data: data };
  }
  /* exact first (diacritics forgiven: janis → Jānis), then names that begin the same way */
  function findName(ix, q) {
    var f = fold(q);
    if (!f) return { exact: [], near: [] };
    var exact = ix.byFold.get(f) || [];
    var near = exact.length ? [] : ix.all.filter(function (e) { return e.f.indexOf(f) === 0 || (f.length > 3 && f.indexOf(e.f) === 0); }).slice(0, 8);
    return { exact: exact, near: near };
  }
  /* Spellings a clerk might have used: same day, same opening. A heuristic, labelled as one —
     the Centre groups a name's forms on one date, which is what makes this worth showing. */
  function variants(ix, entry) {
    var stem = entry.f.slice(0, 3), d = ix.data.days[entry.key];
    return d.t.concat(d.x).filter(function (n) { return n !== entry.name && fold(n).slice(0, 3) === stem; });
  }

  /* ── the year as a wheel: 366 seats, 29 February always has one (and is always empty) ── */
  var MLEN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(m, d) { return pad(m) + '-' + pad(d); }
  function seatOf(key) { var m = +key.slice(0, 2), d = +key.slice(3), s = 0; for (var i = 0; i < m - 1; i++) s += MLEN[i]; return s + d - 1; }
  function keyOfSeat(seat) { var s = ((seat % 366) + 366) % 366, m = 0; while (s >= MLEN[m]) { s -= MLEN[m]; m++; } return keyOf(m + 1, s + 1); }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  /* next time a day comes round, from `from` (a {y,m,d}); 29 Feb waits for a leap year */
  function nextOccurrence(key, from) {
    var m = +key.slice(0, 2), d = +key.slice(3), y = from.y;
    for (var i = 0; i < 9; i++, y++) {
      if (m === 2 && d === 29 && !isLeap(y)) continue;
      var t = Date.UTC(y, m - 1, d), f = Date.UTC(from.y, from.m - 1, from.d);
      if (t >= f) return { y: y, m: m, d: d, inDays: Math.round((t - f) / 86400000) };
    }
    return null;
  }

  /* ── old records speak in other calendars ── */
  function jdnFromJulian(y, m, d) { var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083; }
  function gregorianFromJdn(j) { var a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4),
    d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
    return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: 100 * b + d - 4800 + Math.floor(m / 10) }; }
  function jdnFromGregorian(y, m, d) { var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045; }
  /* Old Style (Julian) → New Style. Church books in the Russian Empire's Baltic provinces
     were kept Old Style; the gap is 12 days through the 1800s and 13 from 1 March 1900. */
  function oldStyleToNew(y, m, d) {
    var j = jdnFromJulian(y, m, d), g = gregorianFromJdn(j);
    g.gap = j - jdnFromGregorian(y, m, d);
    return g;
  }
  /* A Thai year → the common era. พ.ศ. − 543, EXCEPT that until 1940 the Thai year turned
     on 1 April: January–March of those years belong to the NEXT common-era year (− 542).
     B.E. 2483 was nine months long. Before 1889 the year turned with the moon: ± 1. */
  function thaiYearToCE(year, era, month) {
    if (era === 'rs') return { ce: year + 1781, rule: 'ร.ศ. + 1781', caveat: month && month <= 3 ? 'The Rattanakosin year turned on 1 April: January–March fall in ' + (year + 1782) + '.' : '' , ceJanMar: year + 1782 };
    var early = year <= 2483, janMar = month >= 1 && month <= 3;
    var ce = year - 543 + (early && janMar ? 1 : 0);
    var caveat = '';
    if (early && !month) caveat = 'Before 1941 the Thai year turned on 1 April: a January–March date is ' + (year - 542) + ', not ' + (year - 543) + '.';
    if (year < 2432) caveat = 'Before 1889 the year turned with the lunar calendar — treat the result as ± 1 year.';
    return { ce: ce, rule: early && janMar ? 'พ.ศ. − 542 (January–March, before 1941)' : 'พ.ศ. − 543', caveat: caveat };
  }

  /* ── the family calendar, as a file any calendar app will take ── */
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function ics(events, stamp) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//beehive-nature//bNames Day//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:bNames Day — family'];
    events.forEach(function (e) {
      var m = +e.key.slice(0, 2), d = +e.key.slice(3), y = (m === 2 && d === 29) ? 2024 : 2025;
      var end = gregorianFromJdn(jdnFromGregorian(y, m, d) + 1);
      L.push('BEGIN:VEVENT', 'UID:' + e.uid + '@bnamesday', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + y + pad(m) + pad(d), 'DTEND;VALUE=DATE:' + end.y + pad(end.m) + pad(end.d),
        'RRULE:FREQ=YEARLY', 'SUMMARY:' + icsEscape(e.summary), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  /* ── the people you keep: shape-checked on the way in, so an import cannot smuggle markup
     or a foreign schema into the page. Payloads carry v. ── */
  var SIDES = ['lv', 'th', 'other', 'agent'];
  var TZ = /^(UTC|[+-]\d\d:?\d\d|[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){0,2})$/;
  function cleanPeople(payload) {
    if (!payload || payload.v !== 1 || !Array.isArray(payload.people)) throw new Error('not a bNames Day family file (v:1 with a people list)');
    return { v: 1, people: payload.people.slice(0, 500).map(function (p, i) {
      if (!p || typeof p.name !== 'string' || !p.name.trim()) throw new Error('person ' + (i + 1) + ' has no name');
      var born = /^\d{4}-\d\d-\d\d$/.test(p.born || '') ? p.born : '';
      return { id: /^[a-z0-9]{6,24}$/.test(p.id || '') ? p.id : 'p' + Math.random().toString(36).slice(2, 12),
        name: p.name.trim().slice(0, 80), th: typeof p.th === 'string' ? p.th.trim().slice(0, 80) : '',
        rel: typeof p.rel === 'string' ? p.rel.trim().slice(0, 60) : '', side: SIDES.indexOf(p.side) >= 0 ? p.side : 'other',
        born: born, time: /^\d\d:\d\d$/.test(p.time || '') ? p.time : '', tz: typeof p.tz === 'string' && p.tz.length <= 40 && TZ.test(p.tz) ? p.tz : '', lit: /^\d{4}-\d\d-\d\d$/.test(p.lit || '') ? p.lit : '' };
    }) };
  }
  /* every day the family keeps: a name day if the calendar holds the name (22 May if it does
     not — the calendar's own rule), and a birthday if one was given */
  function familyDays(ix, people) {
    var out = [];
    people.forEach(function (p) {
      var hit = findName(ix, p.name.split(/\s+/)[0]).exact[0];
      out.push({ person: p, kind: 'name', key: hit ? hit.key : '05-22', entry: hit || null });
      if (p.born) out.push({ person: p, kind: 'birth', key: p.born.slice(5), entry: null });
    });
    return out;
  }

  var api = { RING: RING, HOUSES: HOUSES, DAYS: DAYS, MLEN: MLEN, thaksa: thaksa, thaiDay: thaiDay, xray: xray,
    fold: fold, ending: ending, buildIndex: buildIndex, findName: findName, variants: variants,
    keyOf: keyOf, seatOf: seatOf, keyOfSeat: keyOfSeat, isLeap: isLeap, nextOccurrence: nextOccurrence,
    oldStyleToNew: oldStyleToNew, thaiYearToCE: thaiYearToCE, ics: ics, cleanPeople: cleanPeople, familyDays: familyDays };
  root.bNamesDay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
