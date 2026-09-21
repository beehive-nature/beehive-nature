/* bnamesday-sky.js — the sky half of bNames Day's core. Pure: no DOM, no storage, no network.
   FROM THE PRIMITIVES, not from anyone's book:
   · the planets — VSOP87 (bnamesday-sky.json); the Moon and its node — Meeus, Astronomical Algorithms
     ch. 47; Pluto — Standish's mean elements. Every one is checked against JPL Horizons in
     e2e/bnamesday-sky.test.mjs, and the measured error is what decides when a result is flagged.
   · the wheel of 64 — the Yijing hexagrams in Shao Yong's Xiantian circle (11th c.), which is binary
     counting: 0…31 up one side, 63…32 down the other. wheelIsBinary() proves it at load. The modern
     systems pin that circle to the tropical zodiac with hexagram 41 opening at 2° Aquarius; the pin is
     stated as their convention, the circle is a thousand years older than they are.
   · the five types — read from which of nine centres two sky-moments join (birth, and the Sun 88° of
     arc earlier). The names Generator / Manifesting Generator / Manifestor / Projector / Reflector are
     the Human Design System's words (Ra Uru Hu, 1987), used to say which system this lens belongs to.
   · China — the lunisolar calendar COMPUTED from the Sun and Moon (month 11 holds the winter solstice;
     the leap month is the first without a principal term), and the four pillars of stems and branches.
   Constitution Art. VII.1: this is an interpretation lens. It never scores, ranks or gates anyone. */
(function (root) {
  'use strict';
  var D = Math.PI / 180, TAU = 2 * Math.PI;
  function n360(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function n180(x) { x = n360(x); return x > 180 ? x - 360 : x; }
  var sin = function (d) { return Math.sin(d * D); }, cos = function (d) { return Math.cos(d * D); };

  /* ── time ── */
  function jd(y, m, d, hours) { if (m <= 2) { y--; m += 12; } var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + (hours || 0) / 24; }
  function fromJd(j) { var z = Math.floor(j + 0.5), f = j + 0.5 - z, a = z; if (z >= 2299161) { var al = Math.floor((z - 1867216.25) / 36524.25); a = z + 1 + al - Math.floor(al / 4); }
    var b = a + 1524, c = Math.floor((b - 122.1) / 365.25), dd = Math.floor(365.25 * c), e = Math.floor((b - dd) / 30.6001), day = b - dd - Math.floor(30.6001 * e), mo = e < 14 ? e - 1 : e - 13;
    return { y: mo > 2 ? c - 4716 : c - 4715, m: mo, d: day, hours: f * 24 }; }
  /* ΔT = TT − UT, seconds. Observed values by decade (USNO / Espenak-Meeus), interpolated; 2030+ is a forecast. */
  var DT = [[1800, 13.7], [1820, 12.0], [1840, 5.7], [1860, 7.9], [1880, -5.4], [1900, -2.8], [1910, 10.4], [1920, 21.2], [1930, 24.0], [1940, 24.3], [1950, 29.1], [1960, 33.1], [1970, 40.2], [1980, 50.5], [1990, 56.9], [2000, 63.8], [2010, 66.1], [2020, 69.4], [2030, 70.0], [2050, 72.0], [2100, 90.0]];
  function deltaT(year) { if (year <= DT[0][0]) return DT[0][1]; for (var i = 1; i < DT.length; i++) if (year <= DT[i][0]) { var a = DT[i - 1], b = DT[i]; return a[1] + (b[1] - a[1]) * (year - a[0]) / (b[0] - a[0]); } return DT[DT.length - 1][1]; }
  function ttOf(jdUT) { return jdUT + deltaT(2000 + (jdUT - 2451545) / 365.25) / 86400; }

  /* a wall-clock time in a named zone → UT. The browser's own tz database does the history (DST,
     old offsets); "+07:00" style fixed offsets are taken as written. */
  function offsetMinutes(tz, ms) {
    var m = /^([+-])(\d\d):?(\d\d)$/.exec(tz || ''); if (m) return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]);
    if (!tz || tz === 'UTC') return 0;
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = +x.value; });
    return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms) / 60000);
  }
  function localToJd(y, m, d, hh, mm, tz) { var wall = Date.UTC(y, m - 1, d, hh, mm), ms = wall, off = 0;
    for (var i = 0; i < 3; i++) { off = offsetMinutes(tz, ms); ms = wall - off * 60000; }
    return { jd: 2440587.5 + ms / 86400000, offsetMinutes: off }; }

  /* ── the planets (VSOP87D, of date) ── */
  var SKY = null;
  function load(payload) { if (!payload || payload.v !== 1 || !payload.bodies || !payload.bodies.earth) throw new Error('not a bnamesday-sky payload (v:1)'); SKY = payload; }
  function series(s, t) { var sum = 0, tp = 1; for (var p = 0; p < s.length; p++) { var terms = s[p], x = 0; for (var i = 0; i < terms.length; i++) x += terms[i][0] * Math.cos(terms[i][1] + terms[i][2] * t); sum += x * tp; tp *= t; } return sum; }
  function helio(body, jdTT) { var t = (jdTT - 2451545) / 365250, b = SKY.bodies[body]; return { L: series(b.L, t), B: series(b.B, t), R: series(b.R, t) }; }
  /* Pluto: Standish's mean Keplerian elements (JPL "approximate positions", 1800–2050 table), J2000 ecliptic,
     carried to the equinox of date by the general precession. slow enough that its gate lasts years. */
  function plutoHelio(jdTT) { var T = (jdTT - 2451545) / 36525, a = 39.48211675 - 0.00031596 * T, e = 0.24882730 + 0.00005170 * T, I = 17.14001206 + 0.00004818 * T,
      L = 238.92903833 + 145.20780515 * T, wb = 224.06891629 - 0.04062942 * T, Om = 110.30393684 - 0.01183482 * T, M = n180(L - wb), w = wb - Om, E = M + e / D * sin(M);
    for (var i = 0; i < 8; i++) E += (M - (E - e / D * sin(E))) / (1 - e * cos(E));
    var xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E), r = Math.sqrt(xp * xp + yp * yp), v = Math.atan2(yp, xp) / D, u = v + w;
    var x = r * (cos(Om) * cos(u) - sin(Om) * sin(u) * cos(I)), y = r * (sin(Om) * cos(u) + cos(Om) * sin(u) * cos(I)), z = r * sin(u) * sin(I);
    var lon = Math.atan2(y, x) / D + (1.396971 * T + 0.0003086 * T * T);
    return { L: lon * D, B: Math.asin(z / r), R: r }; }
  function nutation(T) { var Om = 125.04452 - 1934.136261 * T, L = 280.4665 + 36000.7698 * T, Lm = 218.3165 + 481267.8813 * T;
    return (-17.20 * sin(Om) - 1.32 * sin(2 * L) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * Om)) / 3600; }
  function sunLon(jdTT) { var T = (jdTT - 2451545) / 36525, e = helio('earth', jdTT); return n360(e.L / D + 180 - 0.09033 / 3600 + nutation(T) - 20.4898 / 3600 / e.R); }
  function planetLon(body, jdTT) { var T = (jdTT - 2451545) / 36525, e = helio('earth', jdTT), tau = 0, x, y, z, p;
    for (var i = 0; i < 3; i++) { p = body === 'pluto' ? plutoHelio(jdTT - tau) : helio(body, jdTT - tau);
      x = p.R * Math.cos(p.B) * Math.cos(p.L) - e.R * Math.cos(e.B) * Math.cos(e.L); y = p.R * Math.cos(p.B) * Math.sin(p.L) - e.R * Math.cos(e.B) * Math.sin(e.L); z = p.R * Math.sin(p.B) - e.R * Math.sin(e.B);
      tau = 0.0057755183 * Math.sqrt(x * x + y * y + z * z); }
    var lam = Math.atan2(y, x) / D, beta = Math.atan2(z, Math.sqrt(x * x + y * y)) / D, sunTrue = e.L / D + 180,
      ecc = 0.016708634 - 0.000042037 * T, peri = 102.93735 + 1.71946 * T, k = 20.49552 / 3600;
    return n360(lam + (-k * cos(sunTrue - lam) + ecc * k * cos(peri - lam)) / cos(beta) + nutation(T)); }

  /* ── the Moon (Meeus ch. 47, longitude) and its true node ── */
  var ML = [[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],
    [0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
    [2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],
    [1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
    [2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],[4,-1,0,0,520],[1,0,-2,0,-487],
    [2,1,0,-2,-399],[0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294]];
  function moonArgs(T) { return { Lp: 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841 - T * T * T * T / 65194000,
    Dm: 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868 - T * T * T * T / 113065000, M: 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000,
    Mp: 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699 - T * T * T * T / 14712000, F: 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000 + T * T * T * T / 863310000 }; }
  function moonLon(jdTT) { var T = (jdTT - 2451545) / 36525, a = moonArgs(T), E = 1 - 0.002516 * T - 0.0000074 * T * T, s = 0;
    for (var i = 0; i < ML.length; i++) { var r = ML[i], c = r[4]; if (r[1] === 1 || r[1] === -1) c *= E; else if (r[1] === 2 || r[1] === -2) c *= E * E; s += c * sin(r[0] * a.Dm + r[1] * a.M + r[2] * a.Mp + r[3] * a.F); }
    s += 3958 * sin(119.75 + 131.849 * T) + 1962 * sin(a.Lp - a.F) + 318 * sin(53.09 + 479264.290 * T);
    return n360(a.Lp + s / 1e6 + nutation(T)); }
  function nodeLon(jdTT) { var T = (jdTT - 2451545) / 36525, a = moonArgs(T), Om = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T * T * T * T / 60616000;
    return n360(Om - 1.4979 * sin(2 * (a.Dm - a.F)) - 0.1500 * sin(a.M) - 0.1226 * sin(2 * a.Dm) + 0.1176 * sin(2 * a.F) - 0.0801 * sin(2 * (a.Mp - a.F)) + nutation(T)); }

  /* how far each body may be from the truth, in degrees — MEASURED against JPL Horizons (see the test), then rounded up.
     A body closer than this to a gate's edge is flagged; the page never claims a gate it cannot stand behind. */
  var TRUST = { sun: 0.002, earth: 0.002, moon: 0.01, node: 0.2, snode: 0.2, mercury: 0.003, venus: 0.003, mars: 0.003, jupiter: 0.003, saturn: 0.003, uranus: 0.003, neptune: 0.003, pluto: 0.03 };
  var BODY = [['sun', '☉', 'Sun'], ['earth', '⊕', 'Earth'], ['moon', '☽', 'Moon'], ['node', '☊', 'north node'], ['snode', '☋', 'south node'], ['mercury', '☿', 'Mercury'], ['venus', '♀', 'Venus'], ['mars', '♂', 'Mars'],
    ['jupiter', '♃', 'Jupiter'], ['saturn', '♄', 'Saturn'], ['uranus', '♅', 'Uranus'], ['neptune', '♆', 'Neptune'], ['pluto', '♇', 'Pluto']];
  function lonOf(id, jdTT) { if (id === 'sun') return sunLon(jdTT); if (id === 'earth') return n360(sunLon(jdTT) + 180); if (id === 'moon') return moonLon(jdTT);
    if (id === 'node') return nodeLon(jdTT); if (id === 'snode') return n360(nodeLon(jdTT) + 180); return planetLon(id, jdTT); }

  /* ── the wheel of 64 ── */
  var TRI = [ /* lines bottom→top */
    { id: 'qian', zh: '乾', py: 'qián', en: 'heaven', sym: '☰', l: [1, 1, 1] }, { id: 'zhen', zh: '震', py: 'zhèn', en: 'thunder', sym: '☳', l: [1, 0, 0] }, { id: 'kan', zh: '坎', py: 'kǎn', en: 'water', sym: '☵', l: [0, 1, 0] },
    { id: 'gen', zh: '艮', py: 'gèn', en: 'mountain', sym: '☶', l: [0, 0, 1] }, { id: 'kun', zh: '坤', py: 'kūn', en: 'earth', sym: '☷', l: [0, 0, 0] }, { id: 'xun', zh: '巽', py: 'xùn', en: 'wind', sym: '☴', l: [0, 1, 1] },
    { id: 'li', zh: '離', py: 'lí', en: 'fire', sym: '☲', l: [1, 0, 1] }, { id: 'dui', zh: '兌', py: 'duì', en: 'lake', sym: '☱', l: [1, 1, 0] }];
  /* King Wen number by [lower][upper], trigram order as TRI */
  var KW = [[1, 34, 5, 26, 11, 9, 14, 43], [25, 51, 3, 27, 24, 42, 21, 17], [6, 40, 29, 4, 7, 59, 64, 47], [33, 62, 39, 52, 15, 53, 56, 31], [12, 16, 8, 23, 2, 20, 35, 45], [44, 32, 48, 18, 46, 57, 50, 28], [13, 55, 63, 22, 36, 37, 30, 49], [10, 54, 60, 41, 19, 61, 38, 58]];
  /* the name as written, how to say it, and a plain gloss of the character (ours — not a quotation of any translation) */
  var HEX = [null, ['乾', 'qián', 'heaven, the creative force'], ['坤', 'kūn', 'earth, the receiving field'], ['屯', 'zhūn', 'the sprout pushing through hard ground'], ['蒙', 'méng', 'the unknowing of the young'], ['需', 'xū', 'waiting for the rain'], ['訟', 'sòng', 'dispute'], ['師', 'shī', 'the host, a people organised'], ['比', 'bǐ', 'standing close together'],
    ['小畜', 'xiǎo chù', 'the small gathers and tames'], ['履', 'lǚ', 'treading, where to put the foot'], ['泰', 'tài', 'peace, heaven and earth in exchange'], ['否', 'pǐ', 'standstill, the blocked way'], ['同人', 'tóng rén', 'people of one heart'], ['大有', 'dà yǒu', 'great holding'], ['謙', 'qiān', 'modesty'], ['豫', 'yù', 'delight that moves a crowd'],
    ['隨', 'suí', 'following'], ['蠱', 'gǔ', 'rot to be mended'], ['臨', 'lín', 'drawing near'], ['觀', 'guān', 'beholding'], ['噬嗑', 'shì kè', 'biting through'], ['賁', 'bì', 'adornment'], ['剝', 'bō', 'peeling away'], ['復', 'fù', 'the return'],
    ['無妄', 'wú wàng', 'without falseness'], ['大畜', 'dà chù', 'the great gathers and tames'], ['頤', 'yí', 'the jaws, what feeds us'], ['大過', 'dà guò', 'the great goes too far'], ['坎', 'kǎn', 'the pit, water upon water'], ['離', 'lí', 'clinging fire, brightness'], ['咸', 'xián', 'mutual feeling'], ['恆', 'héng', 'what endures'],
    ['遯', 'dùn', 'withdrawal'], ['大壯', 'dà zhuàng', 'great strength'], ['晉', 'jìn', 'advance, the sun rising'], ['明夷', 'míng yí', 'the light wounded'], ['家人', 'jiā rén', 'the household'], ['睽', 'kuí', 'estrangement, eyes that look apart'], ['蹇', 'jiǎn', 'limping, the hard road'], ['解', 'xiè', 'untying'],
    ['損', 'sǔn', 'lessening'], ['益', 'yì', 'increase'], ['夬', 'guài', 'the resolute break'], ['姤', 'gòu', 'the unexpected meeting'], ['萃', 'cuì', 'gathering together'], ['升', 'shēng', 'rising'], ['困', 'kùn', 'hemmed in'], ['井', 'jǐng', 'the well'],
    ['革', 'gé', 'molting, the hide changed'], ['鼎', 'dǐng', 'the cauldron'], ['震', 'zhèn', 'thunder, the shock'], ['艮', 'gèn', 'the mountain, stilling'], ['漸', 'jiàn', 'gradual advance'], ['歸妹', 'guī mèi', 'the younger sister marries'], ['豐', 'fēng', 'fullness'], ['旅', 'lǚ', 'the traveller'],
    ['巽', 'xùn', 'the gentle wind that enters'], ['兌', 'duì', 'the lake, joy shared'], ['渙', 'huàn', 'dissolving'], ['節', 'jié', 'the joints of bamboo, measure'], ['中孚', 'zhōng fú', 'truth at the centre'], ['小過', 'xiǎo guò', 'the small goes too far'], ['既濟', 'jì jì', 'already across the river'], ['未濟', 'wèi jì', 'not yet across']];
  var LINES = {}; KW.forEach(function (row, lo) { row.forEach(function (n, up) { LINES[n] = TRI[lo].l.concat(TRI[up].l); }); });
  /* Shao Yong's circle, starting where the modern pin puts 2° Aquarius */
  var WHEEL = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
  var PIN = 302, ARC = 5.625;
  function binaryOf(n) { var l = LINES[n], v = 0; for (var i = 0; i < 6; i++) v = v * 2 + l[i]; return v; } /* bottom line is the high bit */
  /* THE GENESIS PROOF: from 坤 (0) the circle counts 0,1,2…31, then 63,62…32 back to 坤 — pure binary, no one's invention */
  function wheelIsBinary() { var at = WHEEL.indexOf(2); for (var i = 0; i < 64; i++) { var want = i < 32 ? i : 95 - i; if (binaryOf(WHEEL[(at + i) % 64]) !== want) return false; } return true; }
  function hexagram(n) { var h = HEX[n], l = LINES[n], lo = TRI.filter(function (t) { return t.l.join() === l.slice(0, 3).join(); })[0], up = TRI.filter(function (t) { return t.l.join() === l.slice(3).join(); })[0];
    return { n: n, zh: h[0], py: h[1], en: h[2], lines: l, lower: lo, upper: up, binary: binaryOf(n), glyph: String.fromCodePoint(0x4DC0 + n - 1) }; }
  function gateOf(lon) { var x = n360(lon - PIN), i = Math.floor(x / ARC), within = x - i * ARC; return { gate: WHEEL[i], line: Math.floor(within / (ARC / 6)) + 1, edge: Math.min(within, ARC - within), lineEdge: Math.min(within % (ARC / 6), ARC / 6 - within % (ARC / 6)) }; }
  /* the six places of a hexagram, as the tradition reads them bottom to top */
  var PLACE = [null, ['初', 'the beginning, the ground underfoot'], ['二', 'the inner centre, the one who serves well'], ['三', 'the threshold, leaving the inner for the outer'], ['四', 'the minister, close to the ruler'], ['五', 'the ruler, the outer centre'], ['上', 'the sage, beyond the matter']];

  /* ── the nine centres and the thirty-six channels between them ── */
  var CENTRES = { head: [64, 61, 63], ajna: [47, 24, 4, 17, 43, 11], throat: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16], g: [7, 1, 13, 10, 15, 2, 46, 25], heart: [21, 40, 26, 51],
    sacral: [5, 14, 29, 59, 9, 3, 42, 27, 34], solar: [6, 37, 22, 36, 30, 55, 49], spleen: [48, 57, 44, 50, 32, 28, 18], root: [58, 38, 54, 53, 60, 52, 19, 39, 41] };
  var CENTRE_EN = { head: 'crown', ajna: 'mind', throat: 'throat', g: 'self', heart: 'will', sacral: 'life-force', solar: 'feeling', spleen: 'instinct', root: 'pressure' };
  var MOTORS = ['heart', 'solar', 'root', 'sacral'];
  var CHANNELS = [[64, 47], [61, 24], [63, 4], [17, 62], [43, 23], [11, 56], [31, 7], [8, 1], [33, 13], [10, 20], [45, 21], [16, 48], [20, 57], [20, 34], [35, 36], [12, 22], [15, 5], [2, 14], [46, 29], [10, 34],
    [10, 57], [25, 51], [26, 44], [37, 40], [27, 50], [34, 57], [59, 6], [42, 53], [3, 60], [9, 52], [18, 58], [28, 38], [32, 54], [19, 49], [39, 55], [41, 30]];
  var CENTRE_OF = {}; Object.keys(CENTRES).forEach(function (c) { CENTRES[c].forEach(function (g) { CENTRE_OF[g] = c; }); });
  var TYPES = {
    reflector: { en: 'Reflector', share: '~1%', color: '#C0C8D4', glyph: '☽', way: 'waits a full turn of the Moon before a large decision', work: 'give them time and changing company; never force a quick yes. they mirror the health of the whole team — ask them how the group is doing, and believe the answer.' },
    manifestor: { en: 'Manifestor', share: '~9%', color: '#E63946', glyph: '♂', way: 'starts things, and keeps the peace by telling people first', work: 'do not ask them to ask permission. ask them to tell you before they move — then get out of the way. they open doors; others carry the work through.' },
    mg: { en: 'Manifesting Generator', share: '~33%', color: '#FF6B1A', glyph: '♂☉', way: 'responds with the gut, moves fast, then tells people what changed', work: 'offer options and watch the gut response. expect skipped steps and several tracks at once; agree how they will tell you when they change course.' },
    generator: { en: 'Generator', share: '~37%', color: '#FFD60A', glyph: '☉', way: 'responds with the gut to what life puts in front of them', work: 'ask yes-or-no questions and listen for the sound before the words. do not ask them to start from nothing; give them something to respond to, and they will outlast everyone.' },
    projector: { en: 'Projector', share: '~20%', color: '#00BFB2', glyph: '◉', way: 'waits to be recognised and invited, then guides', work: 'invite them by name for their view — they see how others could work better. do not measure them in hours; their energy is not the sustained kind. one invited insight can save the team a week.' } };
  var AUTHORITY = { solar: ['the feeling wave', 'no truth in the moment — sleep on it, let the wave pass, then decide'], sacral: ['the gut response', 'an immediate bodily yes or no, in the moment'], spleen: ['instinct', 'a quiet first knowing, said once — trust it then, it will not repeat'],
    ego: ['the will', 'what the heart is truly willing to commit to'], self: ['the voice of the self', 'talk it out loud to someone and hear what you say'], outer: ['the sounding board', 'talk it through with trusted people in the right place; clarity comes from outside'], moon: ['the lunar month', 'about twenty-eight days, and many conversations'] };

  function chart(jdUT) {
    if (!SKY) throw new Error('sky payload not loaded');
    var tB = ttOf(jdUT), target = n360(sunLon(tB) - 88), tD = tB - 89.3;
    for (var i = 0; i < 8; i++) tD += n180(target - sunLon(tD)) / 0.98565;
    var acts = [], gates = {}, flags = [];
    [['birth', tB], ['before', tD]].forEach(function (m) { BODY.forEach(function (b) { var lon = lonOf(b[0], m[1]), g = gateOf(lon), near = g.edge <= TRUST[b[0]];
      var a = { moment: m[0], body: b[0], glyph: b[1], name: b[2], lon: lon, gate: g.gate, line: g.line, edge: g.edge, nearEdge: near }; acts.push(a); gates[g.gate] = true; if (near) flags.push(a); }); });
    var defined = {}, channels = [], adj = {};
    CHANNELS.forEach(function (c) { if (gates[c[0]] && gates[c[1]]) { var a = CENTRE_OF[c[0]], b = CENTRE_OF[c[1]]; channels.push({ gates: c, centres: [a, b] }); defined[a] = defined[b] = true; (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); } });
    var seen = {}, q = ['throat'], motorToThroat = false, selfToThroat = false, egoToThroat = false;
    if (defined.throat) { seen.throat = true; while (q.length) { var c = q.shift(); if (MOTORS.indexOf(c) >= 0) motorToThroat = true; if (c === 'g') selfToThroat = true; if (c === 'heart') egoToThroat = true; (adj[c] || []).forEach(function (n) { if (!seen[n]) { seen[n] = true; q.push(n); } }); } }
    var any = Object.keys(defined).length > 0, type = !any ? 'reflector' : defined.sacral ? (motorToThroat ? 'mg' : 'generator') : motorToThroat ? 'manifestor' : 'projector';
    var auth = !any ? 'moon' : defined.solar ? 'solar' : defined.sacral ? 'sacral' : defined.spleen ? 'spleen' : defined.heart ? 'ego' : (defined.g && selfToThroat) ? 'self' : 'outer';
    /* would the type change if a flagged body sat on the other side of its edge? if so, say so */
    var sun = acts[0], sunB = acts[13];
    return { jdUT: jdUT, jdTT: tB, jdBefore: tD, deltaT: (tB - jdUT) * 86400, activations: acts, flags: flags, channels: channels, defined: Object.keys(CENTRES).filter(function (c) { return defined[c]; }),
      type: type, authority: auth, lines: sun.line + '/' + sunB.line,
      four: [acts[0], acts[1], acts[13], acts[14]] };
  }
  /* no birth hour? read every two hours of that local day and report what stays true */
  function chartsOfDay(y, m, d, tz) { var seenT = {}, list = []; for (var h = 0; h < 24; h += 2) { var c = chart(localToJd(y, m, d, h, 0, tz).jd); seenT[c.type] = (seenT[c.type] || 0) + 1; list.push(c); }
    return { types: Object.keys(seenT), certain: Object.keys(seenT).length === 1, noon: chart(localToJd(y, m, d, 12, 0, tz).jd), sunGates: list.map(function (c) { return c.four[0].gate; }).filter(function (g, i, a) { return a.indexOf(g) === i; }) }; }

  /* ── China: the calendar from the sky, and the four pillars ── */
  var STEMS = [['甲', 'jiǎ', 'wood', 1], ['乙', 'yǐ', 'wood', 0], ['丙', 'bǐng', 'fire', 1], ['丁', 'dīng', 'fire', 0], ['戊', 'wù', 'earth', 1], ['己', 'jǐ', 'earth', 0], ['庚', 'gēng', 'metal', 1], ['辛', 'xīn', 'metal', 0], ['壬', 'rén', 'water', 1], ['癸', 'guǐ', 'water', 0]];
  var BRANCHES = [['子', 'zǐ', 'Rat', '🐀'], ['丑', 'chǒu', 'Ox', '🐂'], ['寅', 'yín', 'Tiger', '🐅'], ['卯', 'mǎo', 'Rabbit', '🐇'], ['辰', 'chén', 'Dragon', '🐉'], ['巳', 'sì', 'Snake', '🐍'], ['午', 'wǔ', 'Horse', '🐎'], ['未', 'wèi', 'Goat', '🐐'], ['申', 'shēn', 'Monkey', '🐒'], ['酉', 'yǒu', 'Rooster', '🐓'], ['戌', 'xū', 'Dog', '🐕'], ['亥', 'hài', 'Pig', '🐖']];
  var ELEMENT = { wood: ['木', 'mù', '#2f9e55'], fire: ['火', 'huǒ', '#d7263d'], earth: ['土', 'tǔ', '#b8860b'], metal: ['金', 'jīn', '#8a94a3'], water: ['水', 'shuǐ', '#2f6fd8'] };
  var FEEDS = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' }, CHECKS = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
  function pillar(stem, branch) { var s = STEMS[stem], b = BRANCHES[branch]; return { stem: stem, branch: branch, zh: s[0] + b[0], py: s[1] + ' ' + b[1], element: s[2], yang: !!s[3], animal: b[2], emoji: b[3] }; }
  function solveSun(angle, jdGuess) { var t = jdGuess; for (var i = 0; i < 8; i++) t += n180(angle - sunLon(ttOf(t))) / 0.98565; return t; } /* → JD UT */
  function newMoonNear(jdGuess) { var t = jdGuess; for (var i = 0; i < 8; i++) { var tt = ttOf(t); t -= n180(moonLon(tt) - sunLon(tt)) / 12.1907; } return t; }
  var chinaDay = function (jdUT) { return Math.floor(jdUT + 8 / 24 + 0.5); }; /* civil day number at UTC+8 */
  var termIndexAtChinaMidnight = function (day) { return Math.floor(sunLon(ttOf(day - 0.5 - 8 / 24)) / 30); };
  function chineseNewYear(year) {
    var w1 = chinaDay(solveSun(270, jd(year - 1, 12, 21, 12))), w2 = chinaDay(solveSun(270, jd(year, 12, 21, 12)));
    var starts = function (w) { var m = newMoonNear(w - 15); while (chinaDay(m) > w) m = newMoonNear(m - 29.53); while (chinaDay(newMoonNear(m + 29.53)) <= w) m = newMoonNear(m + 29.53); return m; };
    var m0 = starts(w1), m11 = starts(w2), n = Math.round((m11 - m0) / 29.530588), months = [m0];
    for (var i = 1; i <= n + 1; i++) months.push(newMoonNear(months[i - 1] + 29.53));
    var num = 11, leapUsed = n !== 13;
    for (var k = 1; k < months.length - 1; k++) { var a = chinaDay(months[k]), b = chinaDay(months[k + 1]), hasTerm = termIndexAtChinaMidnight(a) !== termIndexAtChinaMidnight(b);
      if (!leapUsed && !hasTerm) { leapUsed = true; continue; } num = num % 12 + 1; if (num === 1) return fromJd(a); }
    throw new Error('no first month found for ' + year);
  }
  function china(y, m, d, hh, mm, tz) {
    var hasTime = typeof hh === 'number' && !isNaN(hh), t = localToJd(y, m, d, hasTime ? hh : 12, hasTime ? mm : 0, tz).jd, lon = sunLon(ttOf(t));
    var cny = chineseNewYear(y), beforeNY = m < cny.m || (m === cny.m && d < cny.d), yy = beforeNY ? y - 1 : y, popular = pillar(((yy - 4) % 10 + 10) % 10, ((yy - 4) % 12 + 12) % 12);
    var lichun = solveSun(315, jd(y, 2, 4, 6)), py = t < lichun ? y - 1 : y, year = pillar(((py - 4) % 10 + 10) % 10, ((py - 4) % 12 + 12) % 12);
    var mi = Math.floor(n360(lon - 315) / 30), month = pillar(((year.stem % 5) * 2 + 2 + mi) % 10, (2 + mi) % 12);
    var dayNum = Math.floor(jd(y, m, d, 12) + 0.5) + (hasTime && hh >= 23 ? 1 : 0), di = ((dayNum + 49) % 60 + 60) % 60, day = pillar(di % 10, di % 12), hour = null;
    if (hasTime) { var hb = Math.floor((hh + 1) / 2) % 12; hour = pillar(((day.stem % 5) * 2 + hb) % 10, hb); }
    return { popular: popular, newYear: cny, bornBeforeNewYear: beforeNY, year: year, month: month, day: day, hour: hour, lichun: fromJd(lichun + offsetMinutes(tz, (lichun - 2440587.5) * 86400000) / 1440), yearsDiffer: popular.zh !== year.zh, hasTime: hasTime };
  }
  /* how two year-animals sit together, by the three old relations */
  var TRINES = [[8, 0, 4, 'water'], [11, 3, 7, 'wood'], [2, 6, 10, 'fire'], [5, 9, 1, 'metal']], PAIRS = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  function relation(a, b) { if (a === b) return { kind: 'same', zh: '同', en: 'the same animal' }; if ((a + 6) % 12 === b) return { kind: 'clash', zh: '六沖', py: 'liù chōng', en: 'opposite on the wheel — they sharpen each other; give them separate ground' };
    for (var i = 0; i < TRINES.length; i++) if (TRINES[i].indexOf(a) >= 0 && TRINES[i].indexOf(b) >= 0 && typeof TRINES[i][TRINES[i].indexOf(b)] === 'number') return { kind: 'trine', zh: '三合', py: 'sān hé', en: 'one of the three harmonies (' + TRINES[i][3] + ') — easy allies' };
    for (var j = 0; j < PAIRS.length; j++) if ((PAIRS[j][0] === a && PAIRS[j][1] === b) || (PAIRS[j][0] === b && PAIRS[j][1] === a)) return { kind: 'pair', zh: '六合', py: 'liù hé', en: 'one of the six pairings — a quiet bond' };
    return { kind: 'none', zh: '', en: '' }; }

  var WIKI = 'https://en.wikipedia.org/wiki/';
  var DEEPER = { zodiac: [WIKI + 'Chinese_zodiac', 'the twelve animals'], cycle: [WIKI + 'Sexagenary_cycle', 'the cycle of sixty: stems and branches'], stems: [WIKI + 'Heavenly_Stems', 'the ten heavenly stems'], branches: [WIKI + 'Earthly_Branches', 'the twelve earthly branches'],
    pillars: [WIKI + 'Four_Pillars_of_Destiny', 'the four pillars'], wuxing: [WIKI + 'Wuxing_(Chinese_philosophy)', 'the five phases'], lichun: [WIKI + 'Lichun', 'lì chūn, the start of spring'], solarTerm: [WIKI + 'Solar_term', 'the twenty-four solar terms'], calendar: [WIKI + 'Chinese_calendar', 'the Chinese calendar'],
    iching: [WIKI + 'I_Ching', 'the Yì Jīng, the Book of Changes'], hexagrams: [WIKI + 'List_of_hexagrams_of_the_I_Ching', 'all sixty-four hexagrams'], shaoYong: [WIKI + 'Shao_Yong', 'Shao Yong, who drew the circle'], bagua: [WIKI + 'Bagua', 'the eight trigrams'], humanDesign: [WIKI + 'Human_Design', 'the Human Design System'] };
  function hexLink(n) { return WIKI + 'List_of_hexagrams_of_the_I_Ching#Hexagram_' + n; }
  function animalLink(branch) { return WIKI + BRANCHES[branch][2] + '_(zodiac)'; }

  root.bNamesSky = { DEEPER: DEEPER, hexLink: hexLink, animalLink: animalLink, load: load, jd: jd, fromJd: fromJd, deltaT: deltaT, ttOf: ttOf, offsetMinutes: offsetMinutes, localToJd: localToJd, sunLon: sunLon, moonLon: moonLon, nodeLon: nodeLon, planetLon: planetLon, lonOf: lonOf,
    BODY: BODY, TRUST: TRUST, TRI: TRI, WHEEL: WHEEL, PIN: PIN, ARC: ARC, PLACE: PLACE, hexagram: hexagram, binaryOf: binaryOf, wheelIsBinary: wheelIsBinary, gateOf: gateOf,
    CENTRES: CENTRES, CENTRE_EN: CENTRE_EN, CENTRE_OF: CENTRE_OF, CHANNELS: CHANNELS, MOTORS: MOTORS, TYPES: TYPES, AUTHORITY: AUTHORITY, chart: chart, chartsOfDay: chartsOfDay,
    STEMS: STEMS, BRANCHES: BRANCHES, ELEMENT: ELEMENT, FEEDS: FEEDS, CHECKS: CHECKS, pillar: pillar, chineseNewYear: chineseNewYear, china: china, relation: relation, solveSun: solveSun, newMoonNear: newMoonNear };
})(typeof globalThis !== 'undefined' ? globalThis : this);
