/* bmesh-lights.test.mjs — THE FOUNDER'S RULE, CODE-ENFORCED (2026-10-06):
   "a light only turns on when something real was measured. That rules out a
   timer like doxx's '39s' key timer, since nothing tells us what it counts."

   This suite holds the rule in CI on every push:
     1 · the receipts file is well-formed: exactly the five lights, legal states,
       and every 'measured' light carries a non-empty measurement, a source and a
       dated receipt — a lit light without a citation cannot exist.
     2 · NO TIMERS: the page source contains zero setInterval/setTimeout — nothing
       on this board counts time; states change by receipt, never by tick.
     3 · SYNC: the page's embedded copy is IDENTICAL to surfaces/bmesh-lights.json
       (the hand-kept source of truth); drift is a red, not a silent fork.
     4 · RENDER: the page builds its lights FROM the receipts (a light present in
       the file is present in the DOM; the not-measured state renders as words,
       dashed, no fill — never as an empty space pretending).
     5 · POSTURE: renders with no request (rub law), one shared shell (tour.js?v=42),
       tokens sheet, register scoping, no unexplained countdown strings.
   Run: node --test e2e/bmesh-lights.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const file = JSON.parse(read('surfaces/bmesh-lights.json'));
const page = read('surfaces/bmesh.html');

test('receipts: exactly the five capability lights, legal states only', () => {
  assert.deepEqual(Object.keys(file.lights).sort(),
    ['authority', 'identity', 'meter', 'proof', 'route']);
  for (const [k, L] of Object.entries(file.lights)) {
    assert.ok(['measured', 'not-measured', 'probe-on-visit'].includes(L.state),
      k + ' has illegal state ' + L.state);
  }
  /* probe-on-visit is a PRIVILEGE of the route light only — no other light may
     claim visit-liveness without a receipts-backed reason */
  for (const [k, L] of Object.entries(file.lights))
    if (L.state === 'probe-on-visit') assert.equal(k, 'route', 'only route may probe');
});

test('THE RULE: every lit light carries measurement + source + a dated receipt', () => {
  for (const [k, L] of Object.entries(file.lights)) {
    if (L.state === 'measured') {
      assert.ok(L.what && L.what.length > 40, k + ': the measurement itself must be stated');
      assert.ok(L.source && /[a-z]/.test(L.source), k + ': a lit light cites its source');
      assert.match(L.measuredAt || '', /^\d{4}-\d{2}-\d{2}$/, k + ': a lit light carries a dated receipt');
    }
  }
  /* and the dark rows stay honest: each names WHAT is unmeasured and WHY */
  for (const d of file.lights.proof?.dark || []) {
    assert.ok(d.what && d.why && d.source, 'a dark row names its absence');
    assert.match(d.why, /not measured/i, 'a dark row says NOT MEASURED in the words');
  }
});

test('NO TIMERS: nothing on this board counts time', () => {
  assert.doesNotMatch(page, /setInterval/, 'setInterval is how the 39s-class theater starts');
  assert.doesNotMatch(page, /setTimeout\(/, 'no delayed ticks either — states change by receipt');
  assert.doesNotMatch(page, /requestAnimationFrame/, 'no animation frames standing in for a timer');
  /* the anti-pattern is named in the law text, never instantiated as a widget */
  assert.match(page, /39s/);
  assert.match(page, /counts nothing we can name|measures nothing we can name/);
});

test('SYNC: the page\'s embedded copy is identical to the receipts file', () => {
  const m = page.match(/<script id="bmesh-lights-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'the embedded receipts block exists');
  assert.deepEqual(JSON.parse(m[1].replace(/<\\\//g, '</')), file,
    'surfaces/bmesh.html embeds an identical copy of surfaces/bmesh-lights.json — mirror edits or the gate goes red');
});

test('RENDER: the page builds its lights from the receipts, not from opinions', () => {
  assert.match(page, /<script id="bmesh-lights-data" type="application\/json">/);
  /* the render order array lists exactly the file's lights */
  const orderMatch = page.match(/var order=\[([^\]]*)\]/);
  assert.ok(orderMatch, 'the page names its light order');
  const listed = orderMatch[1].split(',').map(s => s.trim().replace(/'/g, '')).sort();
  assert.deepEqual(listed, Object.keys(file.lights).sort(),
    'every receipts light is rendered, and nothing else is');
  assert.match(page, /data-light="/, 'lights are tagged for the DOM');
  assert.match(page, /dot-off/, 'the not-measured rendering exists (dashed, no fill)');
  assert.match(page, /NOT MEASURED/, 'the words themselves render for unmeasured state');
  assert.match(page, /dot-on/, 'the measured rendering exists');
});

test('POSTURE: rub law, one shell, tokens, registers, external-link law', () => {
  assert.match(page, /data-no-request-on-load/);
  const shells = [...page.matchAll(/<script\b[^>]*\bsrc=["']([^"']*\b(?:tour|register)\.js(?:\?[^"']*)?)["'][^>]*>/gi)];
  assert.equal(shells.length, 1, 'must load the shared shell once');
  assert.match(shells[0][1], /tour\.js\?v=42$/);
  assert.match(page, /tokens\.css/);
  assert.match(page, /data-reg/);
  assert.match(page, /register pre-hide guard/);
  for (const a of page.match(/<a [^>]*href="https?:[^"]*"[^>]*>/g) || []) {
    assert.match(a, /target="_blank"/, a);
    assert.match(a, /rel="noopener/, a);
  }
});

test('ROUTE: the probe is opt-in, no-cors, and never writes back', () => {
  const R = file.lights.route;
  assert.ok(R.probe && R.probe.targets.length >= 2, 'the probe names its targets');
  assert.match(page, /mode:'no-cors'/, 'the probe is no-cors — learns answered, reads nothing');
  assert.match(page, /AbortSignal\.timeout/, 'the probe has a timeout');
  assert.match(page, /receipts file is unchanged/, 'a visit probe is ephemeral by design');
  assert.match(page, /a refusal is a measurement too/, 'refusals render verbatim');
});
