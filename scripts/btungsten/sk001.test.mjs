// sk001.test.mjs — the SK001 battery: SPEC-SKAITS-SEAT-SOVEREIGNTY-1
// made executable (founder order 2026-10-07 — the lane-opening message
// is the ruling; this file receipts it at model scale).
//
// THE INVARIANT UNDER TEST: one living human -> one active Skaists seat
// -> one canonical energy type -> one governance constituency, at every
// governance epoch, with no verifier needing the human's biometric or
// civil identity.
//
// Rows (each prints its own 0 -> N count; CI's own lines are the
// ratchet's evidence, never a local run):
//   1  the cap is the structure        6^5 = 7,776 derived; no equal fifths exist
//   2  nearest integer fifths          {1556,1555x4} recorded, NOT constitutional
//   3  weight is ⊥ population          adversarial population vectors; weight constant
//   4  one human, one seat             double-seat and seat-taken refused; bijection holds
//   5  one canonical type              8 malformed types refused; 1 and 5 accepted
//   6  the five predicates             exact frozen shape; stale-epoch/vacant/not-live refused
//   7  PROVE minimality                evidence bytes absent from proof and era export
//   8  the cap breathes                7,776 filled, the 7,777th refused, one release+re-admit
//   9  COMPRESS exactness              7,776-vote fold exact; verdict on constant weights
//   10 TEETH                           population governor + float weights convicted by name
//
// Model-scale honesty: this receipts the MODEL (in-memory registry,
// sha256 binding placeholder). No live proof system, circuit, or chain
// settlement exists for Skaists seats yet — those are later beats and
// carry UNVERIFIED until they run. Hiding is NOT claimed for the
// placeholder commitment (see sk001-seat.mjs header); the boundary
// row 7 receipts is structural: evidence never crosses.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginEpoch, occupy, depart, release, carrySeat, prove, compress,
  constitutionalWeights, populationShares, exportEra, commitmentOf,
  SEAT_CAP, ENERGY_TYPES, NEAREST_INTEGER_FIFTHS, PROOF_KEYS, Refusal,
} from './sk001-seat.mjs';

const refused = (fn, code) => {
  try { fn(); } catch (e) {
    assert.ok(e instanceof Refusal, `not a Refusal: ${e}`);
    assert.equal(e.refusal, `bt-sk01:${code}`, e.message);
    return;
  }
  assert.fail(`expected a bt-sk01:${code} refusal`);
};
const ev = (label) => Buffer.from(`private-evidence:${label}`, 'utf8'); // stands in for civil/biometric material the chain never sees
const ratEq = (a, b) => a.num === b.num && a.den === b.den; // exact rational equality — no floats anywhere near the constitution
const FIFTH = { num: 1n, den: 5n };

// ——— 1  the cap is the structure ———————————————————————————————

test('the cap is the structure: 6^5 = 7776, derived not hardcoded, and no equal integer fifths exist', () => {
  assert.equal(SEAT_CAP, 7776n);
  assert.equal(SEAT_CAP, 6n ** 5n);
  // factorization: 2^5 · 3^5 — five is NOT a factor
  let n = SEAT_CAP, twos = 0n, threes = 0n;
  while (n % 2n === 0n) { n /= 2n; twos++; }
  while (n % 3n === 0n) { n /= 3n; threes++; }
  assert.equal(twos, 5n); assert.equal(threes, 5n); assert.equal(n, 1n);
  // the impossibility, by exhaustion over the whole cap: no integer k with 5k = 7776
  let candidates = 0;
  for (let k = 0n; k <= SEAT_CAP; k++) { candidates++; assert.notEqual(5n * k, SEAT_CAP, `5*${k} === 7776 would make equal fifths exist`); }
  console.log(`bT-SK001: cap derived 6^5 = ${SEAT_CAP}; factorization 2^5*3^5 carries no five; equal-fifth candidates exhausted 0 -> ${candidates}, none equal`);
});

// ——— 2  nearest integer fifths ——————————————————————————————————

test('nearest integer fifths: the tightest packing is {1556,1555,1555,1555,1555}, recorded and NOT constitutional', () => {
  const packing = NEAREST_INTEGER_FIFTHS;
  assert.equal(packing.reduce((a, b) => a + b, 0n), SEAT_CAP);
  const uniq = [...new Set(packing.map(String))].map(BigInt);
  assert.equal(uniq.length, 2);
  assert.deepEqual(uniq.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), [1555n, 1556n]);
  const max = Math.max(...packing.map(Number)), min = Math.min(...packing.map(Number));
  assert.equal(max - min, 1); // provably the tightest: any tighter packing would be equal fifths
  // constitutional weight is the constant rational, never a seat count
  const w = constitutionalWeights();
  assert.ok(w.every((x) => ratEq(x, FIFTH)));
  for (const c of packing) assert.ok(!w.some((x) => x.num === c && x.den === 1n), `no seat count ${c} may appear as a weight`);
  console.log('bT-SK001: nearest integer fifths recorded {1556,1555,1555,1555,1555}; constitutional weight stays the exact rational 1/5 — 0 -> 1 structure, 0 seat counts as weight');
});

// ——— 3  weight ⊥ population ————————————————————————————————————

test('constitutional weight is orthogonal to population: adversarial occupancy vectors never move it off exactly 1/5', () => {
  const vectors = [
    [1556n, 1555n, 1555n, 1555n, 1555n],   // the tightest packing — STILL not equal fifths
    [1300n, 2000n, 1800n, 1500n, 1176n],   // the founder's skew example shape (sums to the cap)
    [7776n, 0n, 0n, 0n, 0n],               // one constituency holds every seat
    [0n, 0n, 0n, 0n, 7776n],               // ...and the mirrored extreme
    [1n, 1n, 1n, 1n, 7772n],               // near-empty state
    [0n, 0n, 0n, 0n, 0n],                  // the empty organism, weights still exactly 1/5
    [1300n, 2000n, 2000n, 1500n, 976n],    // a second skew
  ];
  // weights serialize as exact rational pairs (BigInts never ride JSON or floats)
  const wjson = (ws) => ws.map((w) => `${w.num}/${w.den}`).join('|');
  const reference = wjson(constitutionalWeights());
  let measured = 0, disagreements = 0;
  for (const v of vectors) {
    const total = v.reduce((a, b) => a + b, 0n);
    assert.ok(total <= SEAT_CAP);
    assert.equal(wjson(constitutionalWeights()), reference, 'weights are a constant function of nothing');
    assert.ok(constitutionalWeights().every((x) => ratEq(x, FIFTH)));
    assert.equal(constitutionalWeights().reduce((a, x) => a + x.num, 0n), 5n); // five exact fifths sum to one (numerator 5 over den 5)
    if (total === 0n) continue; // the empty organism measures no shares; its weights are still 1/5
    const shares = populationShares(v); // accepted as a MEASUREMENT (the sabotage governor only)
    measured++;
    if (shares.some((s) => !ratEq(s, FIFTH))) disagreements++;
  }
  assert.equal(measured, vectors.length - 1);
  assert.equal(disagreements, measured); // every real population deviates — even the tightest packing
  console.log(`bT-SK001: population vectors held at exactly 1/5 per constituency 0 -> ${vectors.length}; the population governor measured on ${measured} and deviated on ${disagreements} (the two governors are not the same constitution)`);
});

// ——— 4  one human, one seat ————————————————————————————————————

test('one living human holds exactly one active seat; the registry is a bijection between active seats and humans', () => {
  const era = beginEpoch(1n);
  for (let i = 1; i <= 8; i++) occupy(era, i, ev(`human-${i}`), (i % ENERGY_TYPES) + 1);
  // the same human (same evidence -> same commitment) cannot take ANY other seat
  let doubleSeats = 0;
  for (const seat of [9, 10, 4242, 7776]) {
    refused(() => occupy(era, seat, ev('human-3'), 2), 'double-seat');
    doubleSeats++;
  }
  // a different human cannot take an occupied seat
  refused(() => occupy(era, 3, ev('stranger'), 1), 'seat-taken');
  // bijection: every commitment unique, every active seat a distinct human
  const recs = [...era.seats.values()];
  assert.equal(new Set(recs.map((r) => r.commitment.toString('hex'))).size, recs.length);
  assert.equal(era.byCommitment.size, recs.length);
  console.log(`bT-SK001: double-seat refusals 0 -> ${doubleSeats} + 1 seat-taken; active seats ${recs.length} <-> ${era.byCommitment.size} humans, bijection holds`);
});

// ——— 5  one canonical type ————————————————————————————————————

test('every seat carries exactly one canonical energy type, an integer in 1..5', () => {
  const era = beginEpoch(1n);
  const malformed = [0, 6, -1, 2.5, NaN, '3', null, 5.5];
  for (const t of malformed) refused(() => occupy(era, 1, ev(`t-${String(t)}`), t), 'type');
  occupy(era, 1, ev('t-low'), 1);   // the inclusive bounds are legal
  occupy(era, 2, ev('t-high'), ENERGY_TYPES);
  assert.equal(era.seats.get(1).energyType, 1);
  assert.equal(era.seats.get(2).energyType, ENERGY_TYPES);
  console.log(`bT-SK001: malformed energy types refused 0 -> ${malformed.length}; inclusive bounds 1 and ${ENERGY_TYPES} accepted`);
});

// ——— 6  the five predicates ————————————————————————————————————

test('PROVE emits exactly the five predicates; stale epoch, vacant seat and not-live seat prove nothing', () => {
  const era = beginEpoch(7n);
  occupy(era, 11, ev('proven-human'), 4);
  const proof = prove(era, 11, 7n);
  assert.deepEqual(Object.keys(proof).sort(), PROOF_KEYS.slice().sort());
  assert.equal(proof.UNIQUE, true);
  assert.equal(proof.LIVE, true);
  assert.equal(proof.SEAT, 11);
  assert.equal(proof.ENERGY_TYPE, 4);
  assert.equal(proof.CURRENT_EPOCH, 7n);
  assert.ok(Object.isFrozen(proof), 'the proof is frozen — a verifier cannot edit it in place');
  // CURRENT_EPOCH is a real predicate: epoch 8 refuses epoch 7's proof
  refused(() => prove(era, 11, 8n), 'stale-epoch');
  // LIVE is a real predicate: a departed human proves nothing
  depart(era, 11);
  refused(() => prove(era, 11, 7n), 'not-live');
  release(era, 11);
  refused(() => prove(era, 11, 7n), 'vacant');
  // sovereignty is re-established per epoch: the seat carries forward by explicit re-COMMIT
  const next = beginEpoch(8n);
  refused(() => carrySeat(era, next, 11, ev('proven-human')), 'vacant'); // released in 7, nothing to carry
  const era2 = beginEpoch(7n);
  occupy(era2, 11, ev('proven-human'), 4);
  const era2next = beginEpoch(8n);
  carrySeat(era2, era2next, 11, ev('proven-human'));
  assert.deepEqual(Object.keys(prove(era2next, 11, 8n)).sort(), PROOF_KEYS.slice().sort());
  console.log('bT-SK001: five-predicate proofs 0 -> 2 (epoch 7 and the explicitly carried epoch 8), both frozen-shape; stale-epoch / not-live / vacant refusals 0 -> 4');
});

// ——— 7  PROVE minimality: the private-evidence boundary ——————————

test('no biometric or civil material crosses COMMIT: proof and era export are byte-scanned against the evidence', () => {
  const era = beginEpoch(3n);
  const secretFields = {
    civil: 'civil-registry:TRL-XXXX-1983;name=Travis Mark Remington',
    biometric: 'biometric:iris-template:9f2c7e51',
    key: 'PRIVATE-KEY-MATERIAL-NEVER-CROSSES',
  };
  const evidence = Buffer.from(JSON.stringify(secretFields), 'utf8');
  occupy(era, 1, evidence, 2);
  occupy(era, 2, ev('ordinary-human'), 3);
  // proofs and exports carry BigInts; the wire form stringifies them —
  // the scan must see exactly what a third party would receive
  const wire = (v) => Buffer.from(JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x)), 'utf8');
  const proofBytes = wire(prove(era, 1, 3n));
  const exportBytes = wire(exportEra(era));
  let scans = 0;
  for (const [field, value] of Object.entries(secretFields)) {
    for (const [name, bytes] of [['proof', proofBytes], ['era-export', exportBytes]]) {
      assert.ok(!bytes.includes(Buffer.from(value, 'utf8')), `${field} leaked into the ${name}`);
      scans++;
    }
    assert.ok(!proofBytes.includes(Buffer.from(field, 'utf8'))); // not even the field NAME crosses
    scans++;
  }
  // the commitment DID bind the evidence (COMMIT is real, not a no-op)
  assert.deepEqual(era.seats.get(1).commitment, commitmentOf(evidence));
  assert.ok(!era.seats.get(1).commitment.equals(era.seats.get(2).commitment));
  console.log(`bT-SK001: private-evidence byte-scans clean 0 -> ${scans}; commitment bound and distinct across humans`);
});

// ——— 8  the cap breathes ————————————————————————————————————————

test('the cap is fixed and the occupancy breathes: 7,776 admitted, the 7,777th refused, one release re-admits one new human', () => {
  const era = beginEpoch(1n);
  for (let seat = 1; seat <= Number(SEAT_CAP); seat++) {
    occupy(era, seat, ev(`genesis-${seat}`), (seat % ENERGY_TYPES) + 1);
  }
  assert.equal(era.seats.size, Number(SEAT_CAP));
  refused(() => occupy(era, Number(SEAT_CAP) + 1, ev('seat-7777'), 1), 'seat-range'); // no seat 7,777 exists at all
  refused(() => occupy(era, 4242, ev('the-extra-human'), 1), 'seat-taken');           // and no free seat to take
  // a genesis human departs; a NEW human takes the freed seat — same cap, new occupancy
  release(era, 4242);
  occupy(era, 4242, ev('the-successor'), 5);
  assert.equal(era.seats.size, Number(SEAT_CAP));
  assert.deepEqual(prove(era, 4242, 1n), { UNIQUE: true, LIVE: true, SEAT: 4242, ENERGY_TYPE: 5, CURRENT_EPOCH: 1n });
  console.log(`bT-SK001: seats filled 0 -> ${era.seats.size} of cap ${SEAT_CAP}; out-of-range and full-cap refusals 0 -> 2; one breath (release + successor) proven`);
});

// ——— 9  COMPRESS exactness ——————————————————————————————————————

test('COMPRESS folds a full-capacity vote into five exact tallies plus one fixed-weight verdict', () => {
  const era = beginEpoch(2n);
  const votes = new Map();
  // seat%5+1 cycles types 1..5 over seats 1..7776, giving type populations
  // {2:1556, 1:1555, 3:1555, 4:1555, 5:1555} — the nearest-integer-fifths
  // packing itself, arrived at by cycle, not by quota
  for (let seat = 1; seat <= Number(SEAT_CAP); seat++) {
    const t = (seat % ENERGY_TYPES) + 1;
    occupy(era, seat, ev(`voter-${seat}`), t);
    // constituencies 1,2,4 vote yes internally; 3,5 vote no — verdict must be YES on 3/5 weights
    votes.set(seat, (t === 1 || t === 2 || t === 4) ? 1n : 0n);
  }
  const result = compress(era, votes, 2n);
  assert.equal(result.tallies.length, ENERGY_TYPES);
  let totalYes = 0n, totalNo = 0n;
  const expectedYes = [1555n, 1556n, 0n, 1555n, 0n];
  for (let i = 0; i < ENERGY_TYPES; i++) {
    assert.ok(result.tallies[i].yes + result.tallies[i].no > 0n);
    totalYes += result.tallies[i].yes; totalNo += result.tallies[i].no;
  }
  assert.equal(totalYes + totalNo, SEAT_CAP); // the fold is exact: every seat counted exactly once
  assert.deepEqual(result.tallies.map((t) => t.yes), expectedYes);
  assert.ok(result.weights.every((w) => ratEq(w, FIFTH)), 'the verdict rode the constant weights');
  assert.equal(result.verdict, 'YES'); // 3 of 5 equal constituencies > strict majority
  // a vote from a departed seat compresses nothing — LIVE participates in COMPRESS too
  depart(era, 1);
  refused(() => compress(era, votes, 2n), 'vacant');
  refused(() => compress(era, new Map(), 3n), 'stale-epoch');
  console.log(`bT-SK001: COMPRESS folded ${SEAT_CAP} member votes into ${ENERGY_TYPES} exact tallies; verdict ${result.verdict} on constant 1/5 weights; departed-seat and stale-epoch refusals 0 -> 2`);
});

// ——— 10 TEETH ———————————————————————————————————————————————————

test('TEETH: the population governor and float weights are convicted by name — kept only as sabotage controls', () => {
  // conviction 1: populationShares transfers constitutional power toward the populous
  const skew = [1300n, 2000n, 1800n, 1500n, 1176n];
  const shares = populationShares(skew);
  const biggest = shares.reduce((a, b) => (a.num * b.den > b.num * a.den ? a : b));
  const smallest = shares.reduce((a, b) => (a.num * b.den < b.num * a.den ? a : b));
  // 2000/7776 > 1/5 and 1176/7776 < 1/5 — exact rational comparisons, no floats
  assert.ok(biggest.num * 5n > biggest.den, `the biggest constituency should exceed 1/5: ${biggest.num}/${biggest.den}`);
  assert.ok(smallest.num * 5n < smallest.den, `the smallest should fall below 1/5: ${smallest.num}/${smallest.den}`);
  assert.ok(constitutionalWeights().every((w) => ratEq(w, FIFTH))); // the constitutional governor never moves
  // conviction 2: a float cannot even carry the constitution's own arithmetic
  const floatWeight = 1 / 5;
  assert.notEqual(floatWeight * 3, 0.6, 'the float weight must be convicted of inexactness (3*(1/5) is 0.6000000000000001)');
  assert.ok(3n * 2n > 1n * 5n); // the exact rational 3/5 > 1/2 by cross-multiplication — the arithmetic the constitution actually uses
  console.log(`bT-SK001: TEETH — population governor convicted on the skew vector (max ${biggest.num}/${biggest.den} > 1/5 > min ${smallest.num}/${smallest.den}); float weight convicted (3*(1/5) !== 0.6); sabotage controls 0 -> 2, nothing imports them`);
});
