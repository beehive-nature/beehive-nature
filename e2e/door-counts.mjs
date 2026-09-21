/* door-counts.mjs — THREE NUMBERS, ONE TRUTH.

   Every door on this estate states how much is open behind it in THREE
   independent places, and nothing has ever compared them:

     1 · surfaces/doors/index.html   the row for that door:  <s>N open now</s>
     2 · the door page itself        .shead's count:         <span class="n">N</span>
     3 · the door page itself        THE REAL ANCHORS:       a.t inside section.d

   THE THIRD NUMBER IS WHY THIS IS A GATE AND NOT A COMPARISON. With two
   numbers you learn that they disagree and NOT which one is lying — the seat
   is left guessing, which is how cc0909a0 shipped "28 open now" against 38
   tiles with no gate seeing it (fixed at fe40aa20, whose own message names it:
   "doors/index: beehivenature row counts 38 open now — the fourth content
   red"). At fe40aa20^ the triple reads 28 · 38 · 38: the anchors settle the
   argument — the DOOR was right and the INDEX was stale. This gate reports
   the odd one out by name, and says NO MAJORITY when all three disagree
   rather than picking one.

   THE ANCHORS ARE COUNTED INSIDE section.d AND NOWHERE ELSE. Every door
   carries a .notyet block of things that are NOT open, and every page carries
   navigation and a footer — beehivenature.html has 42 <a href> in total
   against 38 that are open. Counting anchors page-wide is a broken
   instrument, so the scope is the section the .n belongs to.

   EXEMPTIONS ARE BY NAME, NEVER BY ABSENCE. surfaces/doors/ also holds two
   hive pages that are not doors and declare no section.d. If "declares no
   section.d" were the exemption rule, deleting the section from a real door
   would delete it from this gate's sight — a gate that erases itself when the
   thing it guards is removed. So the two are listed below by filename, and
   ANY OTHER page in that directory without a section.d is a hard failure.

   usage:  node e2e/door-counts.mjs [--root <dir>] [--selftest]
     --root      judge the doors under <dir>/surfaces/doors (default: repo root)
     --selftest  spawn THIS FILE over throwaway fixture trees — the agreeing
                 trio, each of the three drifts, a three-way split, and the
                 structural refusals. Today all six doors agree 3/3, so a
                 natural exam proves nothing about this gate; every fixture
                 below is a DRIFTED pair or a refusal. */
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = join(HERE, 'door-counts.mjs');

/* the two pages in surfaces/doors/ that are NOT doors — hive pages, no
   section.d, no count to state. Named, so that a door losing its section
   fails instead of vanishing. */
const NOT_DOORS = new Set(['beehivenature-buzz.html', 'skaists-buzz.html']);
const LIST = 'index.html';

let pass = 0, fail = 0;
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${note ? ' — ' + note : ''}`); }
};

/* --- reading the page ---------------------------------------------------- */

/* the section.d block, matched to ITS OWN close tag — depth-counted, not
   regex-to-the-first-</section>, because a nested section would end the
   block early and silently shrink the anchor count. */
function sectionD(html) {
  const open = /<section\b[^>]*\bclass="[^"]*\bd\b[^"]*"[^>]*>/.exec(html);
  if (!open) return null;
  const from = open.index + open[0].length;
  const tag = /<section\b[^>]*>|<\/section>/g;
  tag.lastIndex = from;
  let depth = 1, m;
  while ((m = tag.exec(html))) {
    depth += m[0] === '</section>' ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index);
  }
  return null;   // unclosed — caller reports it, never treats it as empty
}

/* <a …>…</a> blocks whose class list carries the token t. No nested anchors
   exist in HTML, so the next </a> is this anchor's own. */
function tiles(html) {
  const out = [];
  const open = /<a\b[^>]*>/g;
  let m;
  while ((m = open.exec(html))) {
    const cls = /\bclass="([^"]*)"/.exec(m[0]);
    if (!cls || !cls[1].split(/\s+/).includes('t')) continue;
    const end = html.indexOf('</a>', open.lastIndex);
    const href = /\bhref="([^"]*)"/.exec(m[0]);
    out.push({ href: href ? href[1] : null, inner: end < 0 ? '' : html.slice(open.lastIndex, end) });
  }
  return out;
}

const sheadN = s => { const m = /<span\b[^>]*\bclass="n"[^>]*>\s*(\d+)\s*<\/span>/.exec(s); return m ? Number(m[1]) : null; };
const openNow = s => { const m = /<s\b[^>]*>\s*(\d+)\s+open now\s*<\/s>/.exec(s); return m ? Number(m[1]) : null; };

/* --- the verdict --------------------------------------------------------- */

/* three numbers, three labels. Returns the odd one out BY NAME, or agreement,
   or no majority. This is the whole reason the third number is collected. */
function verdict(nums, labels) {
  const [a, b, c] = nums;
  if (a === b && b === c) return { agree: true, note: `${a} · ${b} · ${c} agree` };
  const odd = a === b ? 2 : b === c ? 0 : a === c ? 1 : -1;
  const said = nums.map((n, i) => `${labels[i]} says ${n}`).join(', ');
  if (odd < 0) return { agree: false, note: `${said} · NO MAJORITY — all three sources disagree` };
  return { agree: false, note: `${said} · the odd one out is ${labels[odd].toUpperCase()}` };
}

/* --- the run ------------------------------------------------------------- */

const argv = process.argv.slice(2);
const rootArg = argv.indexOf('--root');
const ROOT = rootArg >= 0 ? resolve(argv[rootArg + 1]) : resolve(HERE, '..');
const DOORS = join(ROOT, 'surfaces', 'doors');

function run() {
  if (!existsSync(DOORS)) {
    console.log(`FAIL door-counts — no such directory: ${DOORS}`);
    return 1;
  }
  const files = readdirSync(DOORS).filter(f => f.endsWith('.html')).sort();
  const pages = files.filter(f => f !== LIST && !NOT_DOORS.has(f));

  /* the list page states its own three numbers */
  const listHtml = readFileSync(join(DOORS, LIST), 'utf8');
  const listSec = sectionD(listHtml);
  if (listSec === null) {
    ok(`${LIST} declares its section.d`, false, 'no section.d, or it is never closed');
    return 1;
  }
  const rows = new Map();
  let malformed = 0;
  for (const t of tiles(listSec)) {
    const n = openNow(t.inner);
    if (!t.href || n === null) { malformed++; continue; }
    rows.set(t.href, n);
  }
  ok(`${LIST} — every tile carries an href and an "N open now"`, malformed === 0, `${malformed} tile(s) missing one or both`);

  const listV = verdict([sheadN(listSec), rows.size, pages.length],
    ["the list's own .n", "the list's tiles", 'the door pages on disk']);
  /* the numbers ride in the ROW NAME, not in ok()'s note, because ok() drops
     the note when a row passes — and for a counting gate a green line that
     never says what it counted cannot be audited afterwards. */
  ok(`${LIST} — the list counts the doors it lists · ${listV.note}`, listV.agree);

  /* every door page: three numbers, one truth */
  let judged = 0, anchorsTotal = 0;
  for (const f of pages) {
    const html = readFileSync(join(DOORS, f), 'utf8');
    const sec = sectionD(html);
    if (sec === null) {
      ok(`${f} — declares a section.d`, false,
        'no section.d, or it is never closed. A door with no section states no count; ' +
        'if it is not a door, name it in NOT_DOORS — never let it fall out of sight');
      continue;
    }
    const n = sheadN(sec);
    if (n === null) {
      ok(`${f} — its section.d carries <span class="n">`, false, 'the door states no count of its own');
      continue;
    }
    const anchors = tiles(sec).length;
    const row = rows.get(f);
    if (row === undefined) {
      ok(`${f} — the list carries a row for this door`, false,
        `${LIST} lists ${[...rows.keys()].join(', ') || 'nothing'} — a door nobody can reach from the list`);
      continue;
    }
    const v = verdict([row, n, anchors], ['the index row', "the door's own .n", 'the real anchor count']);
    ok(`${f} — ${v.note}`, v.agree);
    judged++; anchorsTotal += anchors;
  }

  /* every row must point at a door that exists */
  for (const href of rows.keys()) {
    if (!existsSync(join(DOORS, href))) {
      ok(`${LIST} — the row for ${href} points at a page that exists`, false, `no such file under surfaces/doors/`);
    }
  }

  /* NON-VACUITY. An empty scan is not a clean one: with no doors judged, or
     no anchors seen, every comparison above is a comparison of nothing. */
  ok('non-vacuity — doors judged, with real anchors behind them',
    judged === pages.length && judged > 0 && anchorsTotal > 0,
    `judged ${judged} of ${pages.length} door page(s), ${anchorsTotal} anchor(s) counted`);

  /* the exempt number is COUNTED ON DISK, never read off NOT_DOORS.size — a
     constant printed in a COUNT line is a borrowed number, true of the source
     it was typed from and not of the tree being judged. */
  const exempt = files.filter(f => NOT_DOORS.has(f)).length;
  console.log(`\nCOUNT ${files.length} page(s) in surfaces/doors/ · ${exempt} exempt by name · ` +
    `${pages.length} door(s) · ${judged} judged on three numbers · ${anchorsTotal} anchors counted`);
  console.log(`${pass} passed, ${fail} failed`);
  return fail ? 1 : 0;
}

/* --- selftest ------------------------------------------------------------ */

/* Every fixture is written as REAL FILES and judged by SPAWNING THIS FILE, so
   each row runs the gate's whole body — arg handling, reading, the verdict,
   the exit code. A selftest that calls the helpers directly proves the
   helpers and never the wiring (#165, P5–P10). */

const door = (n, anchors, { notyetInside = 0 } = {}) => {
  const tile = i => `<a class="t big" href="../x${i}.html"><b>thing ${i}</b><s>x${i}.html</s></a>`;
  const inner = Array.from({ length: anchors }, (_, i) => tile(i)).join('\n');
  const stowed = Array.from({ length: notyetInside }, (_, i) => tile(100 + i)).join('\n');
  return `<!DOCTYPE html><html><body>
<section class="d">
  <div class="shead"><span class="dot"></span><h2>Everything behind this door</h2><em>open now</em><span class="n">${n}</span></div>
${inner}
${stowed}
</section>
<div class="notyet"><h2>not yet</h2>
${notyetInside ? '' : '<a class="t" href="../later.html"><b>later</b></a>'}
</div>
</body></html>`;
};

const list = (n, entries) => `<!DOCTYPE html><html><body>
<section class="d">
  <div class="shead"><span class="dot"></span><h2>Pick the one that sounds like you</h2><span class="n">${n}</span></div>
${entries.map(([href, cnt]) => `  <a class="t" href="${href}"><b>${href}</b><s>who it is for</s><s>${cnt} open now</s></a>`).join('\n')}
</section>
</body></html>`;

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'doorgate-'));
  const d = join(dir, 'surfaces', 'doors');
  mkdirSync(d, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(d, name), body);
  return dir;
}

/* the base tree: two doors that agree 3/3, one hive page exempt BY NAME, and
   a .notyet anchor sitting outside each section where it belongs. */
const base = () => ({
  'index.html': list(2, [['alpha.html', 3], ['beta.html', 1]]),
  'alpha.html': door(3, 3),
  'beta.html': door(1, 1),
  'beehivenature-buzz.html': '<!DOCTYPE html><html><body><h1>a hive, not a door</h1></body></html>',
});

function probe(files) {
  const dir = fixture(files);
  let out = '', rc = 0;
  try { out = execFileSync(process.execPath, [SELF, '--root', dir], { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); rc = e.status === undefined ? -1 : e.status; }
  rmSync(dir, { recursive: true, force: true });
  return { out, rc };
}

function selftest() {
  let good = 0, bad = 0;
  const row = (name, cond, note = '') => {
    if (cond) { good++; console.log(`PASS selftest ${name}`); }
    else { bad++; console.log(`FAIL selftest ${name}${note ? ' — ' + note : ''}`); }
  };

  /* S1 · the agreeing trio passes LOUDLY, names its exemption, and prints a
     non-vacuous COUNT. Without this row every refusal below could be a gate
     that simply always fails. */
  {
    const { out, rc } = probe(base());
    row('S1 agreeing trio passes, and says what it counted',
      rc === 0 && /PASS alpha\.html/.test(out) && /3 · 3 · 3 agree/.test(out) &&
      /1 exempt by name/.test(out) && /2 judged on three numbers · 4 anchors counted/.test(out),
      `rc=${rc} ${out.trim().split('\n').slice(-3).join(' | ')}`);
  }

  /* S2 · THE REAL DEFECT'S SHAPE — fe40aa20^: the index went stale at 28
     while the door and its anchors both said 38. The row asserts WHICH source
     was named, not merely that something went red: a gate that blames the
     door here would be exactly as wrong as no gate at all. */
  {
    const f = base();
    f['index.html'] = list(2, [['alpha.html', 28], ['beta.html', 1]]);
    f['alpha.html'] = door(38, 38);
    const { out, rc } = probe(f);
    const line = out.split('\n').find(l => l.startsWith('FAIL alpha.html')) || '';
    row('S2 index row stale (28 vs 38 vs 38) — the INDEX ROW is named',
      rc === 1 && /the odd one out is THE INDEX ROW/.test(line) &&
      /says 28/.test(line) && /says 38/.test(line) && !/THE DOOR|THE REAL ANCHOR COUNT/.test(line),
      `rc=${rc} ${line}`);
  }

  /* S3 · the same drift pointed at the door's own number. */
  {
    const f = base();
    f['alpha.html'] = door(9, 3);
    const { out, rc } = probe(f);
    const line = out.split('\n').find(l => l.startsWith('FAIL alpha.html')) || '';
    row("S3 door .n stale (3 vs 9 vs 3) — THE DOOR'S OWN .n is named",
      rc === 1 && /the odd one out is THE DOOR'S OWN \.N/.test(line) && !/THE INDEX ROW|THE REAL ANCHOR COUNT/.test(line),
      `rc=${rc} ${line}`);
  }

  /* S4 · and at the anchors: a tile added to the section without either
     number being updated — the shape a seat actually produces by hand. */
  {
    const f = base();
    f['alpha.html'] = door(3, 4);
    const { out, rc } = probe(f);
    const line = out.split('\n').find(l => l.startsWith('FAIL alpha.html')) || '';
    row('S4 a fourth tile added, both counts left behind — THE REAL ANCHOR COUNT is named',
      rc === 1 && /the odd one out is THE REAL ANCHOR COUNT/.test(line) && !/THE INDEX ROW|THE DOOR/.test(line),
      `rc=${rc} ${line}`);
  }

  /* S5 · no majority. The gate must refuse to elect a winner from three
     different numbers rather than quietly trusting whichever it read first. */
  {
    const f = base();
    f['index.html'] = list(2, [['alpha.html', 7], ['beta.html', 1]]);
    f['alpha.html'] = door(9, 3);
    const { out, rc } = probe(f);
    const line = out.split('\n').find(l => l.startsWith('FAIL alpha.html')) || '';
    row('S5 three different numbers — NO MAJORITY, no winner elected',
      rc === 1 && /NO MAJORITY/.test(line) && !/the odd one out is/.test(line), `rc=${rc} ${line}`);
  }

  /* S6 · THE SCOPING PAIR, and it is a pair on purpose. The base tree already
     carries a .notyet anchor outside every section and passes (S1); move that
     SAME anchor inside section.d and the anchor count must move with it. A
     single "it passed with the anchor outside" row is satisfied by a gate that
     never counts anchors at all. */
  {
    const f = base();
    f['alpha.html'] = door(3, 3, { notyetInside: 1 });
    const { out, rc } = probe(f);
    const line = out.split('\n').find(l => l.startsWith('FAIL alpha.html')) || '';
    row('S6 the .notyet anchor moved INSIDE section.d is counted (pairs with S1)',
      rc === 1 && /the odd one out is THE REAL ANCHOR COUNT/.test(line) && /says 4/.test(line), `rc=${rc} ${line}`);
  }

  /* S7 · a door whose section lost its <span class="n">. Unreadable is not
     agreement: it must be named, and no verdict line may claim it agrees. */
  {
    const f = base();
    f['alpha.html'] = door(3, 3).replace(/<span class="n">3<\/span>/, '');
    const { out, rc } = probe(f);
    row('S7 a door with no .n is refused by name, never read as agreement',
      rc === 1 && /FAIL alpha\.html — its section\.d carries <span class="n">/.test(out) &&
      !/PASS alpha\.html/.test(out) && /judged 1 of 2 door page\(s\)/.test(out), `rc=${rc}`);
  }

  /* S8 · THE SELF-ERASING EXEMPTION. A page in surfaces/doors/ that declares
     no section.d and is not named in NOT_DOORS is a hard failure — otherwise
     deleting a door's section is how a door leaves this gate's sight. The
     named hive page in the base tree has the same shape and passes (S1), so
     the two rows together prove the exemption is BY NAME. */
  {
    const f = base();
    f['stray.html'] = '<!DOCTYPE html><html><body><h1>no section here</h1></body></html>';
    f['index.html'] = list(3, [['alpha.html', 3], ['beta.html', 1], ['stray.html', 0]]);
    const { out, rc } = probe(f);
    row('S8 an unnamed page with no section.d fails (the named hive page does not)',
      rc === 1 && /FAIL stray\.html — declares a section\.d/.test(out) &&
      !/FAIL beehivenature-buzz\.html/.test(out), `rc=${rc}`);
  }

  /* S9 · a door on disk that the list never lists. Caught twice on purpose:
     by name at the page, and by the list's own third number. */
  {
    const f = base();
    f['gamma.html'] = door(2, 2);
    const { out, rc } = probe(f);
    const listLine = out.split('\n').find(l => l.includes('the list counts the doors it lists')) || '';
    row('S9 an unlisted door is named, and the list\'s third number moves',
      rc === 1 && /FAIL gamma\.html — the list carries a row for this door/.test(out) &&
      /the odd one out is THE DOOR PAGES ON DISK/.test(listLine), `rc=${rc} ${listLine}`);
  }

  /* S10 · a row pointing at a page that does not exist. */
  {
    const f = base();
    f['index.html'] = list(3, [['alpha.html', 3], ['beta.html', 1], ['ghost.html', 5]]);
    const { out, rc } = probe(f);
    row('S10 a list row pointing at no page is named',
      rc === 1 && /FAIL index\.html — the row for ghost\.html points at a page that exists/.test(out), `rc=${rc}`);
  }

  /* S11 · non-vacuity has teeth: a doors directory holding only the list and
     the named hive page judges nothing, and must not exit 0. */
  {
    const f = { 'index.html': list(0, []), 'beehivenature-buzz.html': '<html><body>hive</body></html>' };
    const { out, rc } = probe(f);
    row('S11 a doors directory with no doors is vacuous, not clean',
      rc === 1 && /FAIL non-vacuity/.test(out) && /judged 0 of 0 door page\(s\), 0 anchor\(s\)/.test(out), `rc=${rc}`);
  }

  console.log(`\n${good} passed, ${bad} failed — door-counts selftest`);
  return bad ? 1 : 0;
}

process.exit(argv.includes('--selftest') ? selftest() : run());
