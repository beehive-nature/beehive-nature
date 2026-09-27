/* bui-daily-art.test.mjs - THE DAILY ART MANIFEST ENGINE, static proofs (bUi
   Slice 01, queen order 1822fa54; writer zCode; PROVE contract bFUzZ 9e333cf7).
   Runs the SAME bytes the browser runs (surfaces/daily-art.js via require - one
   implementation, two hosts). No browser here; the rendered gate is
   e2e/bui-daily-art-gate.mjs.

   Proves, per the order + PROVE contract:
   - sha256 correctness against node:crypto (known vectors + randomized strings)
   - canonical serialization: key-order independence, integer-only law
   - manifest determinism: same inputs -> byte-identical manifest + hash
   - pinned golden vectors (PUBLIC-CONSTANT) for genesis and day 2
   - chain truth: chainTo == day-by-day fold; genesis prev; length; pre-genesis refusal
   - replay from RECORDED input hashes is byte-identical (bFUzZ build req 2)
   - the fast fold equals the generic canonical path across a date sweep
   - tamper rejection: every field mutation breaks validate()
   - P4: synthetic 1,826-manifest chain within the pinned budget (<=150ms desktop)
   - parameter legality across a multi-year sweep
   - calendar purity: year/leap boundaries via integer civil math */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const art = require('../surfaces/daily-art.js');
const nodeSha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/* Synthetic, forever-stable root: sha256('bui-slice01-synthetic-root'). Never a
   real registry digest - a TEST VECTOR, so these goldens are stable across
   registry evolution. */
const ROOT = art.sha256('bui-slice01-synthetic-root');

test('sha256 matches node:crypto on known vectors and randomized strings', () => {
  assert.equal(art.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); // PUBLIC-CONSTANT: FIPS 180-4 vector for 'abc'
  assert.equal(art.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // PUBLIC-CONSTANT: FIPS 180-4 empty-string vector
  for (let i = 0; i < 300; i++) {
    const len = Math.floor(Math.random() * 400);
    let s = '';
    for (let j = 0; j < len; j++) s += String.fromCharCode(32 + Math.floor(Math.random() * 95));
    assert.equal(art.sha256(s), nodeSha(s), 'mismatch at random string ' + i);
  }
  assert.equal(art.sha256('k\u0101rpus \u00b7 uz austras pusi'), nodeSha('k\u0101rpus \u00b7 uz austras pusi'));
});

test('canonical serialization: sorted keys, integers only', () => {
  assert.equal(art.canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(art.canon({ a: { z: 1, b: [2, 1] } }), '{"a":{"b":[2,1],"z":1}}');
  assert.throws(() => art.canon({ x: 1.5 }), /integers only/);
  assert.throws(() => art.canon({ x: NaN }), /integers only/);
});

test('determinism: identical inputs derive byte-identical manifests', () => {
  const a = art.deriveDay('2027-03-14', ROOT, art.GENESIS_DAY.length ? 'ab'.repeat(32) : '');
  const b = art.deriveDay('2027-03-14', ROOT, 'ab'.repeat(32));
  assert.equal(a.bytes, b.bytes);
  assert.equal(a.hash, b.hash);
  for (let i = 0; i < 25; i++) {
    const again = art.deriveDay('2027-03-14', ROOT, 'ab'.repeat(32));
    assert.equal(again.hash, a.hash);
  }
});

test('golden vectors: genesis and day two, pinned forever', () => {
  const g = art.chainTo('2026-09-19', ROOT);
  const d2 = art.chainTo('2026-09-20', ROOT);
  assert.equal(g.hash, 'dfd7553d0ac9bf9a23d145a1cc8de0389b5146473e6103c0a7cb18790b0d4c37'); // PUBLIC-CONSTANT: pinned golden manifest hash, genesis day, synthetic root
  assert.equal(d2.hash, '6bd1ee9f1da4a32702537cb416811904955f4b9b67106f40048f9b2ad5b437e4'); // PUBLIC-CONSTANT: pinned golden manifest hash, day 2, synthetic root
  assert.equal(d2.manifest.prev_manifest_hash, g.hash);
  assert.equal(d2.chainLength, 2);
  assert.equal(g.manifest.prev_manifest_hash, '0'.repeat(64)); /* genesis prev = the documented 64-zero constant */
});

test('chain truth: chainTo equals the day-by-day fold', () => {
  let day = art.GENESIS_DAY, prev = '0'.repeat(64);
  for (let i = 0; i < 30; i++) {
    const step = art.deriveDay(day, ROOT, prev);
    const viaChain = art.chainTo(day, ROOT);
    assert.equal(viaChain.hash, step.hash, 'day ' + day);
    assert.equal(viaChain.bytes, step.bytes, 'day ' + day);
    assert.equal(viaChain.manifest.prev_manifest_hash, prev, 'day ' + day);
    assert.equal(viaChain.chainLength, i + 1);
    prev = step.hash; day = art.nextDay(day);
  }
  assert.throws(() => art.chainTo('2026-09-18', ROOT), /before genesis/);
});

test('replay from recorded inputs is byte-identical (build req 2)', () => {
  const d2 = art.chainTo('2026-09-20', ROOT);
  const recorded = { utc_day: d2.day, state_root: ROOT, prev_manifest_hash: d2.manifest.prev_manifest_hash };
  const r1 = art.replay(recorded), r2 = art.replay(recorded);
  assert.equal(r1.bytes, d2.bytes);
  assert.equal(r1.hash, d2.hash);
  assert.equal(r2.bytes, r1.bytes);
});

test('fast fold equals the generic canonical path across a date sweep', () => {
  let day = art.GENESIS_DAY, prev = '0'.repeat(64);
  for (let i = 0; i < 120; i++) {
    const viaEngine = art.deriveDay(day, ROOT, prev);
    assert.equal(art.canon(viaEngine.manifest), viaEngine.bytes, 'canon drift at ' + day);
    prev = viaEngine.hash; day = art.nextDay(day);
  }
});

test('tamper rejection: every mutation breaks validate()', () => {
  const good = art.chainTo('2027-06-01', ROOT);
  const candidate = (mutate) => {
    const c = JSON.parse(JSON.stringify(good.manifest)); c.manifest_hash = good.hash;
    mutate(c); return c;
  };
  assert.equal(art.validate(candidate(() => {})).ok, true);
  const tampers = [
    (c) => { c.params.variant = 99; },                     // out of range
    (c) => { c.params.variant = 2.5; },                    // non-integer
    (c) => { delete c.params.glow; },                      // shape
    (c) => { c.params.swayMs = 2999; },                    // below range
    (c) => { c.utc_day = 'not-a-day'; },
    (c) => { c.state_root = 'zz'; },
    (c) => { c.protocol_version = 2; },
    (c) => { c.generator_version = 0; },
    (c) => { c.params.densityPct += 1; },                  // silent param bump - self-hash breaks
    (c) => { c.manifest_hash = c.manifest_hash.slice(0, 63) + '0'; } // forged hash
  ];
  for (const t of tampers) {
    const v = art.validate(candidate(t));
    assert.equal(v.ok, false, 'tamper accepted: ' + JSON.stringify(t));
  }
  assert.equal(art.validate(null).ok, false);
  assert.equal(art.validate('x').ok, false);
});

test('P4: synthetic 1,826-manifest chain within the pinned budget (<=150ms desktop)', () => {
  const lastDay = '2031-09-18'; /* genesis + 1825 */
  const t0 = performance.now();
  const chain = art.chainTo(lastDay, ROOT);
  const ms = performance.now() - t0;
  assert.equal(chain.chainLength, 1826);
  console.log('bui P4: 1,826-manifest chain in ' + ms.toFixed(1) + 'ms (budget 150ms desktop / 600ms 4x-throttled)');
  assert.ok(ms <= 150, 'P4 budget exceeded: ' + ms.toFixed(1) + 'ms');
});

test('parameter legality across a multi-year sweep', () => {
  let day = art.GENESIS_DAY, prev = '0'.repeat(64), seenVariants = new Set();
  for (let i = 0; i < 1095; i++) { /* three years */
    const step = art.deriveDay(day, ROOT, prev);
    for (const [k, [lo, hi]] of Object.entries(art.RANGES)) {
      const v = step.manifest.params[k];
      assert.ok(Number.isInteger(v) && v >= lo && v <= hi, k + '=' + v + ' out of range at ' + day);
    }
    seenVariants.add(step.manifest.params.variant);
    prev = step.hash; day = art.nextDay(day);
  }
  assert.ok(seenVariants.size >= 3, 'three years should visit several variants (visible daily change)');
});

test('calendar purity: integer civil math at boundaries', () => {
  assert.equal(art.nextDay('2026-12-31'), '2027-01-01');
  assert.equal(art.nextDay('2027-02-28'), '2027-03-01');
  assert.equal(art.nextDay('2028-02-28'), '2028-02-29'); /* leap */
  assert.equal(art.nextDay('2028-02-29'), '2028-03-01');
  assert.equal(art.nextDay('2100-02-28'), '2100-03-01'); /* century non-leap */
  assert.equal(art.nextDay('2400-02-28'), '2400-02-29'); /* 400-year leap */
  assert.throws(() => art.chainTo('2026-13-01', ROOT));
});
