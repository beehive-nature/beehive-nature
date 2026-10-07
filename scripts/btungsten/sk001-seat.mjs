// sk001-seat.mjs — SK001: the Skaists seat-sovereignty model, the
// executable arm of SPEC-SKAISTS-SEAT-SOVEREIGNTY-1 riding the bTunGsTeN
// workbench runner (it instantiates SPEC-BTUNGSTEN-1 §measurability: a
// claimed property with no receipt is a hypothesis).
//
// THE INVARIANT (founder ruling 2026-10-07, quoted in the spec):
//   one living human -> one active Skaists seat -> one canonical energy
//   type -> one governance constituency, at every governance epoch, and
//   no verifier needs the human's biometric or civil identity to
//   establish eligibility.
//
// The four verbs (the identity pipeline this model stages):
//   COMMIT  — the caller holds the private evidence; the registry stores
//             only a binding commitment. The evidence bytes have nowhere
//             to go inside the registry (isolated by design — see the
//             boundary note below; hiding is NOT claimed for the model's
//             placeholder hash).
//   PROVE   — prove() emits ONLY the five public predicates + public
//             bindings: UNIQUE, LIVE, SEAT, ENERGY_TYPE ∈ {1..5},
//   CURRENT_EPOCH. Its input is (era, seat) — it structurally cannot
//             reach evidence that was never stored.
//   COMPRESS— compress() folds a full-registry vote into five
//             per-constituency tallies plus one fixed-weight verdict.
//   SETTLE  — future beat: an Antelope/Vaulta multisig or whatever
//             successor exists centuries later. NOT MODELED HERE; the
//             spec names it, no code claims it.
//
// THE ARITHMETIC (part of the constitution, not an implementation
// detail): SEAT_CAP = 6^5 = 7,776, DERIVED at load from the sixfold
// five-layer geometry, never hardcoded. 7,776 has no factor of five, so
// equal integer fifths do not exist: the nearest packing is
// {1556, 1555, 1555, 1555, 1555}. Constitutional weight is therefore
// NOT a seat count: each constituency carries exactly the rational 1/5,
// CONSTANT in the population vector. Population-weighted governance is
// a DIFFERENT constitution and lives only as populationShares(), the
// battery's sabotage control (the WB001 naiveConcat precedent).
//
// No float ever represents constitutional weight: 1/5 is inexact in
// binary and the constitution does not round. Weights are exact
// rationals {num, den} in BigInt.

import { createHash } from 'node:crypto';

export const REFUSAL_PREFIX = 'bt-sk01';

export class Refusal extends Error {
  constructor(code, message) { super(message); this.refusal = code; }
}
const refuse = (code, message) => { throw new Refusal(`${REFUSAL_PREFIX}:${code}`, message); };

// ——— the arithmetic of the cap ————————————————————————————————

export const ENERGY_TYPES = 5;                // five constitutional constituencies (Human Design energy types, held abstractly as 1..5)
export const SEAT_CAP = 6n ** 5n;             // 7,776 — the sixfold, five-layer tree; derived, never hardcoded
export const WEIGHT_NUM = 1n;                 // constitutional weight per constituency: exactly
export const WEIGHT_DEN = 5n;                 //   1/5, constant in population
export const NEAREST_INTEGER_FIFTHS = [1556n, 1555n, 1555n, 1555n, 1555n]; // the tightest integer packing — recorded, NOT constitutional

// Constitutional weight: CONSTANT in the population vector. Population
// is a measured variable, never a power variable.
export function constitutionalWeights() {
  return Array.from({ length: ENERGY_TYPES }, () => ({ num: WEIGHT_NUM, den: WEIGHT_DEN }));
}

// SABOTAGE governor — population shares. Exists ONLY so the battery can
// convict it (the teeth row): on any non-uniform occupancy it transfers
// constitutional power toward the populous. Nothing may import it for
// real work.
export function populationShares(population) {
  if (!Array.isArray(population) || population.length !== ENERGY_TYPES) refuse('population', 'population must be exactly 5 bigint counts');
  for (const p of population) if (typeof p !== 'bigint' || p < 0n) refuse('population', 'population counts are non-negative bigints');
  const total = population.reduce((a, b) => a + b, 0n);
  if (total > SEAT_CAP) refuse('population', `population ${total} exceeds the cap ${SEAT_CAP}`);
  return population.map((p) => ({ num: p, den: total })); // exact rationals, so the conviction is exact too
}

// ——— COMMIT: the era registry ——————————————————————————————————

// The commitment is a BINDING placeholder only (sha256 over the
// caller-side evidence bytes). Hiding is NOT claimed — sha256 is not a
// hiding commitment against low-entropy evidence — and a live
// deployment binds a hiding+binding commitment scheme instead. What the
// model receipts is the STRUCTURAL boundary: the evidence bytes never
// enter the registry, the proof, or the export.
export function commitmentOf(privateEvidence) {
  if (!Buffer.isBuffer(privateEvidence) || privateEvidence.length === 0) refuse('evidence', 'private evidence is non-empty bytes held by the caller');
  return createHash('sha256').update(privateEvidence).digest();
}

export function beginEpoch(epoch) {
  if (typeof epoch !== 'bigint' || epoch < 1n) refuse('epoch', 'epoch is a positive bigint');
  return {
    epoch,
    seats: new Map(),   // seatId -> { commitment, energyType, live }
    byCommitment: new Map(), // commitment hex -> seatId (the uniqueness index; keyed by hex because Map identity-compares Buffers)
  };
}

const assertSeatId = (seat) => {
  if (!Number.isInteger(seat) || seat < 1 || BigInt(seat) > SEAT_CAP) refuse('seat-range', `seat ${seat} outside 1..${SEAT_CAP}`);
};
const assertEnergyType = (t) => {
  if (!Number.isInteger(t) || t < 1 || t > ENERGY_TYPES) refuse('type', `energy type ${t} is not an integer in 1..${ENERGY_TYPES}`);
};

// COMMIT/occupy one seat for one living, authorized human. The evidence
// itself stays caller-side; only its commitment crosses.
export function occupy(era, seat, privateEvidence, energyType, { authorized = true } = {}) {
  if (era.seats.has(seat)) refuse('seat-taken', `seat ${seat} already resolves to a human this epoch`);
  assertSeatId(seat);
  if (authorized !== true) refuse('not-authorized', 'occupancy requires an authorized living human');
  assertEnergyType(energyType);
  const commitment = commitmentOf(privateEvidence);
  const key = commitment.toString('hex');
  if (era.byCommitment.has(key)) refuse('double-seat', `this human already controls seat ${era.byCommitment.get(key)} this epoch`);
  era.seats.set(seat, { commitment, energyType, live: true });
  era.byCommitment.set(key, seat);
  return { seat, epoch: era.epoch };
}

// Two distinct exits, both part of the law:
//   depart   — the human leaves; the seat stays occupied but NOT live,
//              so it can prove nothing (LIVE is a real predicate).
//   release  — the seat becomes vacant and re-admissible (the cap is
//              fixed; the occupancy breathes — SPEC-LOVERNMENT-DAO-1).
export function depart(era, seat) {
  const rec = era.seats.get(seat);
  if (!rec) refuse('vacant', `seat ${seat} is vacant`);
  rec.live = false;
}
export function release(era, seat) {
  const rec = era.seats.get(seat);
  if (!rec) refuse('vacant', `seat ${seat} is vacant`);
  era.seats.delete(seat);
  era.byCommitment.delete(rec.commitment.toString('hex'));
}

// Epoch transition: sovereignty is re-established per epoch. Carrying a
// seat is an explicit re-COMMIT in the new era (authorization and
// uniqueness re-checked against the NEW epoch's registry); anything not
// carried is vacant and its old-era proofs are stale. Whether a live
// deployment carries automatically is a deployment beat — the LAW is
// per-epoch, and this model enforces it in every era.
export function carrySeat(oldEra, newEra, seat, privateEvidence, { authorized = true } = {}) {
  if (newEra.epoch <= oldEra.epoch) refuse('epoch', 'carry moves forward in epochs only');
  if (!oldEra.seats.has(seat)) refuse('vacant', `seat ${seat} is not occupied in epoch ${oldEra.epoch}`);
  return occupy(newEra, seat, privateEvidence, oldEra.seats.get(seat).energyType, { authorized });
}

// ——— PROVE: the five predicates, nothing else ————————————————————

export const PROOF_KEYS = ['UNIQUE', 'LIVE', 'SEAT', 'ENERGY_TYPE', 'CURRENT_EPOCH'];

export function prove(era, seat, currentEpoch) {
  if (typeof currentEpoch !== 'bigint') refuse('epoch', 'currentEpoch is a bigint');
  if (era.epoch !== currentEpoch) refuse('stale-epoch', `proof from epoch ${era.epoch} refused at ${currentEpoch}`);
  const rec = era.seats.get(seat);
  if (!rec) refuse('vacant', `seat ${seat} is vacant in epoch ${era.epoch}`);
  if (!rec.live) refuse('not-live', `seat ${seat} is occupied but not live`);
  // UNIQUE and SEAT hold by construction here: the registry's
  // uniqueness index refused every double-seat and double-human at
  // COMMIT time, and the seat resolved above is the one the index maps.
  const proof = Object.freeze({
    UNIQUE: true,
    LIVE: true,
    SEAT: seat,
    ENERGY_TYPE: rec.energyType,
    CURRENT_EPOCH: era.epoch,
  });
  const keys = Object.keys(proof).sort().join(',');
  const want = PROOF_KEYS.slice().sort().join(',');
  if (keys !== want) refuse('proof-shape', `proof keys ${keys} != ${want}`);
  return proof;
}

// ——— COMPRESS: the fixed-weight fold ————————————————————————————

// Fold a full-registry vote (seat -> yes/no) into five exact
// per-constituency tallies plus the constitutional verdict: each
// constituency decides internally by member majority, the federation
// decides by the five equal rational weights — population never enters.
export function compress(era, votes, currentEpoch) {
  if (era.epoch !== currentEpoch) refuse('stale-epoch', `tally from epoch ${era.epoch} refused at ${currentEpoch}`);
  const tallies = Array.from({ length: ENERGY_TYPES }, (_, i) => ({ constituency: i + 1, yes: 0n, no: 0n }));
  for (const [seat, vote] of votes) {
    const rec = era.seats.get(seat);
    if (!rec || !rec.live) refuse('vacant', `vote from seat ${seat} carries no live member`);
    if (vote !== 0n && vote !== 1n) refuse('vote', `seat ${seat} vote ${vote} is not 0n|1n`);
    if (vote === 1n) tallies[rec.energyType - 1].yes += 1n; else tallies[rec.energyType - 1].no += 1n;
  }
  const weights = constitutionalWeights();
  let weightYes = 0n;
  const weightDen = weights[0].den; // 5n, uniform by construction
  for (let i = 0; i < ENERGY_TYPES; i++) {
    if (tallies[i].yes > tallies[i].no) weightYes += weights[i].num;
  }
  return {
    tallies,
    weights, // the constant 1/5 rationals, carried in the receipt
    verdict: weightYes * 2n > weightDen ? 'YES' : 'NO', // strict majority of the five equal weights
  };
}

// ——— export: what a third party may see of an era ————————————————

// Commitments and types only. There is no code path from evidence bytes
// to this object — the battery byte-scans it to hold the line.
export function exportEra(era) {
  const seats = [];
  for (const [seat, rec] of [...era.seats.entries()].sort((a, b) => a[0] - b[0])) {
    seats.push({ seat, commitment: rec.commitment.toString('hex'), energyType: rec.energyType, live: rec.live });
  }
  return { epoch: era.epoch, seatCap: SEAT_CAP.toString(), energyTypes: ENERGY_TYPES, seats };
}
