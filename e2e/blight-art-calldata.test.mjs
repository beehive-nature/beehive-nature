import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLIGHT = join(ROOT, 'surfaces', 'blight');

/* Z5 gate (Refill 5 cut 4753a636): founder eye-catch #6 calldata defect
   (7e530f28, verified against each contract's own Sourcify source).
   getSvg/getMeta take a single STATIC SeedData struct - all-uint256 fields
   encoded back to back with NO leading 0x20 offset word. farmers.html and
   hearth.html were the last two art consumers still building
   `sel+W(0x20)+W(seed)+W(0)` (bea6cdf9 shape); the fix routes them through
   the shared level-truth.js svgCallData/decodeString (market.html:108
   precedent). Offender class = offset word after a VARIABLE selector
   (`col.sel`, `h.col.sel`, `.selector`); a literal-selector offset call
   (Multicall3 aggregate3, profile.html:487 - a dynamic array whose offset
   word is CORRECT) does not match the pattern. */
const OFFSET_ART_CALL = /(sel|selector)[^;\n]{0,20}\+\s*[wW]\(\s*(?:0x20|32)\s*\)/;
const OFFSET_ART_CALL_G = new RegExp(OFFSET_ART_CALL.source, 'g');

/* Z6 (same cut) fixes inscription-explorer.html and profile.html - six call
   sites (4 + 2) - stacked on Z3. Until Z6 lands, their rows are carried
   here; Z6 DELETES both rows and this pinned key list together (do not
   widen this ledger).
   Z5 harden (order 6306a899): the rows are LOAD-BEARING. Each row carries
   the measured offender call-site count it stands for at this pin. A stale
   row (page fixed while the row remains), a widened row (page added), an
   unlisted offender, or in-page drift (count moved) must RED - never mask.
   Still-matching alone cannot catch a widened row that carries a fresh
   defect (bFUzZ probe 2), so the key set itself is pinned. */
const EXEMPT = new Map([
  ['inscription-explorer.html', 4], // -> Z6, 4 call sites
  ['profile.html', 2],              // -> Z6, 2 call sites
]);

test('blight art pages: no offset-word (0x20) art calldata outside the Z6 exemptions', () => {
  const files = readdirSync(BLIGHT).filter((f) => f.endsWith('.html')).sort();
  const offenders = [];
  for (const f of files) {
    const text = readFileSync(join(BLIGHT, f), 'utf8');
    if (OFFSET_ART_CALL.test(text)) offenders.push(f);
  }
  const actionable = offenders.filter((f) => !EXEMPT.has(f));
  const exempt = offenders.filter((f) => EXEMPT.has(f));
  assert.deepEqual(
    actionable,
    [],
    'offset-word art calldata (7e530f28 defect class) in: '
      + (actionable.join(', ') || '(none)')
      + (exempt.length ? ` | carried by Z6 exemptions: ${exempt.join(', ')}` : '')
      + ' - build art calls with level-truth.js svgCallData (market.html precedent)'
  );
});

test('Z5 harden (6306a899): exemption rows load-bearing - no stale row, no widened row, no unlisted offender, no count drift', () => {
  const counts = new Map();
  for (const f of readdirSync(BLIGHT).filter((f) => f.endsWith('.html')).sort()) {
    const n = (readFileSync(join(BLIGHT, f), 'utf8').match(OFFSET_ART_CALL_G) || []).length;
    if (n > 0) counts.set(f, n);
  }
  const stale = [...EXEMPT.keys()].filter((f) => !counts.has(f));
  assert.deepEqual(
    stale,
    [],
    'stale exemption row: ' + (stale.join(', ') || '(none)')
      + ' no longer carries the 7e530f28 pattern - if Z6 landed, delete the row and the pinned key in the same commit; do not leave the row riding a clean page'
  );
  const unlisted = [...counts.keys()].filter((f) => !EXEMPT.has(f));
  assert.deepEqual(
    unlisted,
    [],
    'offset-word art calldata in a page with NO exemption row: ' + (unlisted.join(', ') || '(none)')
      + ' - fix it with level-truth.js svgCallData (market.html precedent) or re-cut the ledger with a measured count; never widen silently'
  );
  for (const [f, expected] of EXEMPT) {
    const got = counts.get(f) ?? 0;
    assert.equal(
      got,
      expected,
      `${f}: offender call-site count drifted - ledger ${expected}, page ${got}.`
        + ' If the edit that moved it is legitimate, re-pin this row to the measured count in the same commit as the change'
        + ' (or land Z6, which deletes both rows); a drifted page must not silently ride its row'
    );
  }
  assert.deepEqual(
    [...EXEMPT.keys()].sort(),
    ['inscription-explorer.html', 'profile.html'],
    'exemption ledger widened/narrowed beyond the two Z6 rows - the key set is pinned.'
      + ' Adding a row here masks exactly the 7e530f28 defect class this gate exists for (bFUzZ probe 2);'
      + ' Z6 deletes both rows and this literal together'
  );
});

test('farmers.html and hearth.html consume the shared level-truth module (market precedent)', () => {
  for (const f of ['farmers.html', 'hearth.html']) {
    const text = readFileSync(join(BLIGHT, f), 'utf8');
    assert.match(
      text,
      /<script src="\.\.\/level-truth\.js\?v=2"><\/script>/,
      `${f} must load ../level-truth.js?v=2 (Z5 fix: one svgCallData/decodeString law, 128 KB cap)`
    );
  }
});
