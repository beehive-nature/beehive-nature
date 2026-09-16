#!/usr/bin/env node
// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this battery is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// vv1-vending-pricing.mjs — SPEC VV-1: an open session must have IMMUTABLE
// pricing semantics (docs/agents/VV-SPECS.md). Target: the on-chain vending
// meter contract, contracts/vending/src/vending.cpp — the Jungle4 rehearsal
// under bnrapolltest, mainnet home founder-gated (deploy posture, :29-31).
//
// FOUNDER ORDER (2026-09-16, verbatim shape): open a session under rate R1,
// mutate the governed rate row to R2, then settle the original session — the
// result must use an open-time committed pricing snapshot or REFUSE because
// the historical pricing commitment cannot be proven; never silently R2.
// Bind every price-affecting input, not merely a rate-row identifier. Inverse
// control: post-mutation sessions price at R2. Attack delete/recreate of the
// same key, mutation immediately before settlement, and mutation/reversion
// R1→R2→R1 — equality of the final table must not erase the authorization
// fact. Tithe arithmetic conserves in integers at the smallest unit with an
// explicit rounding law. tithe_bp > 10000 refuses before state mutation; 0
// and 10000 are boundary controls. A negative control proves the battery
// convicts deliberate live-table settlement.
//
// MAPPING: the order's "settle the original session" is the meter's PRICED
// CONSUMPTION action — `charge` (vending.cpp:272-292), the only action whose
// semantics the governed rate row enters. `settle` (:254-266) is the credit
// path; it reads no rate and is probed only for its own bounds.
//
// HARNESS: zero network. A line-cited BigInt transcription of the contract
// (amounts are int64 smallest-units, 0.0001 A — vending.cpp:42) runs the
// attack scenarios; two law-reference implementors (snapshot; refuse-on-
// unprovable) and one sabotage implementor (live read) calibrate the oracle.
// The transcription is PINNED to the source by sha256 + structural markers:
// if vending.cpp changes without this battery being re-derived, the pin FAILS
// (never silently test a stale model).
//
// CI DISCIPLINE (AV-11 law): RED verdicts are REGISTERED in the ledger below
// with their charter — registered reds pass and print; an UNREGISTERED red
// fails (future defect or regression); a registered red gone green fails as
// STALE (promote the row — good news still gets recorded); a failed pin or a
// failed oracle self-test fails hard, never ledger-able.
//
// Run:  node scripts/vv1-vending-pricing.mjs   (exit 0 = structure sound)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'contracts/vending/src/vending.cpp');

// ── 1. the source pin ───────────────────────────────────────────────────────
// The model below is a transcription of vending.cpp at this exact content.
const PINNED_SHA = '9869f77f95e615ad5819633c03d372e9455ddfd01c2d4a7f93c7ff1f6ba25034'; // PUBLIC-CONSTANT — the pinned vending.cpp sha256 this battery was derived from
// Structural markers of the semantics under attack — when the fix lands these
// flip and the battery demands re-derivation (the pin is how a red-first
// battery charters a fix without this seat writing production code).
const STRUCTURAL_PINS = [
  // charge prices against the LIVE governed row (the live read itself)
  { id: 'live-read-in-charge',
    test: (s) => s.includes('rs.require_find(sitr->rail.value, "rate row vanished")') },
  // the session row binds ONLY the rail key — no basis/tithe snapshot fields
  { id: 'session-row-unbound',
    test: (s) => /TABLE session_row\s*\{[^}]*name\s+rail;[^}]*\}/.test(s)
              && !/TABLE session_row\s*\{[^}]*asset\s+basis;/.test(s) },
  // no tithe arithmetic rides any settlement path — charge never consults tithe
  { id: 'charge-tithe-silent',
    test: (s) => {
      const m = s.match(/\[\[eosio::action\]\] void charge[\s\S]*?\n    \}/);
      return !!m && !/tithe/i.test(m[0]);
    } },
];

function checkPins() {
  const src = readFileSync(SRC, 'utf8');
  const sha = createHash('sha256').update(src).digest('hex');
  const fails = [];
  if (sha !== PINNED_SHA)
    fails.push(`source drifted: vending.cpp is now ${sha} (battery derived from the pinned digest) — re-derive the model and update pin+ledger together`);
  for (const p of STRUCTURAL_PINS)
    if (!p.test(src))
      fails.push(`structural pin '${p.id}' no longer holds — the attacked semantics changed; re-derive the model, re-run every probe, and promote/demote ledger rows to match reality`);
  return fails;
}

// ── 2. the model — a faithful transcription (line-cited) ────────────────────
// int64 smallest-unit amounts as BigInt. Asset ops in CDT throw on overflow;
// the model checks the same bounds where the contract relies on them.
const INT64_MAX = 2n ** 63n - 1n;
class Refused extends Error {}
const check = (c, msg) => { if (!c) throw new Refused(msg); };

// Pricing source of a consumption: 'live' (the transcribed contract), or the
// two lawful references — 'snapshot' (price only the open-time committed
// inputs) and 'snapshot-refuse' (snapshot; refuse when the live row can no
// longer PROVE the open-time commitment by content digest).
class VendingModel {
  constructor(pricing = 'live') {
    this.pricing = pricing;
    this.config = null;                    // config singleton  (:45-51)
    this.tithe = null;                     // tithe singleton    (:94-98)
    this.rates = new Map();                // rates rows         (:55-62)
    this.sessions = new Map();             // session rows       (:67-81)
    this.nonces = new Map();               // nonce rows         (:85-91)
    this.clock = 0n;                       // current_time_point() — advances ONLY
                                           // on state-landing mutations, so a
                                           // refused action leaves rows byte-identical
    this.history = [];                     // append-only governance observation
                                           // (the harness's ground truth; the
                                           // contract itself records nothing here)
  }
  now() { return this.clock; }

  // ── governance (admin-gated; founder word without redeploy) ──────────────
  init(admin, maxCerts) {                                  // :125-130
    check(this.config === null || !this.config.initialized, 'already initialized');
    this.config = { admin, max_certs: BigInt(maxCerts), certs_count: 0n, initialized: true };
  }
  setrate(rail, basis, titheBp, label) {                   // :140-157
    check(this.config !== null && this.config.admin === 'admin', 'require_auth(admin)');
    check(basis >= 0n && basis <= INT64_MAX, 'basis must be core A');
    check(titheBp <= 10000, 'tithe is basis points, max 10000');   // BEFORE any write
    const prior = this.rates.get(rail) || null;
    this.clock += 1n;   // a landed write advances observable time — a refusal must not
    const stamp = this.now();
    if (prior === null) {
      let n = 0; for (const _ of this.rates.values()) { n++; if (n > 32) break; }
      check(n <= 32, 'rate table bounded at 32 rails');
      this.rates.set(rail, { rail, basis, tithe_bp: titheBp, label, updated: stamp });
    } else {
      this.rates.set(rail, { ...prior, basis, tithe_bp: titheBp, label, updated: stamp });
    }
    this.history.push({ op: 'setrate', rail, before: prior, after: this.rates.get(rail) });
  }
  rmrate(rail) {                                           // :159-164
    check(this.config !== null && this.config.admin === 'admin', 'require_auth(admin)');
    check(this.rates.has(rail), 'no such rail rate');
    const before = this.rates.get(rail);
    this.rates.delete(rail);
    this.clock += 1n;
    this.history.push({ op: 'rmrate', rail, before, after: null });
  }
  settithe(percentBp, destination) {                       // :166-172
    check(this.config !== null && this.config.admin === 'admin', 'require_auth(admin)');
    check(percentBp <= 10000, 'percent is basis points, max 10000'); // BEFORE any write
    const before = this.tithe;
    this.clock += 1n;   // landed write advances observable time — a refusal must not
    this.tithe = { percent_bp: percentBp, destination, updated: this.now() };
    this.history.push({ op: 'settithe', before, after: this.tithe });
  }

  // ── the meter ────────────────────────────────────────────────────────────
  opensess(sess, owner, agentName, rail, ceiling) {        // :235-249
    check(this.rates.has(rail), 'no such rail rate');
    check(!this.sessions.has(sess), 'session id exists');
    // THE BINDING QUESTION (VV-1.2): what the session row records about the
    // pricing it was opened under. The transcription binds ONLY the key —
    // exactly what the struct at :67-81 carries. The law references bind the
    // full price-affecting input set + a content digest over it.
    let bound = { rail };                                  // the contract's row
    if (this.pricing !== 'live') {
      const row = this.rates.get(rail);
      bound = { rail, basis: row.basis, tithe_bp: row.tithe_bp,
                commitment: digestPricing({ rail, basis: row.basis, tithe_bp: row.tithe_bp }) };
    }
    this.sessions.set(sess, {
      id: sess, owner, agent_name: agentName, rail,
      state: 0, credit: 0n, burned: 0n, ceiling,
      audit_state: 255, audit_hash: '',
      opened: this.now(), updated: this.now(),
      _bound: bound,                                       // the row's attestation surface
    });
    this.history.push({ op: 'opensess', sess, rail, bound });
  }
  settle(sess, payer, nonce, amount) {                     // :254-266
    const s = this.sessions.get(sess);
    check(s !== undefined, 'no such session');
    check(s.state !== 2, 'session closed');
    check(amount >= 0n, 'settle in core A');
    check(!this.nonces.has(nonce), 'nonce spent — replay refused');
    this.nonces.set(nonce, { value: nonce, session: sess, amount, at: this.now() }); // BURN, even at zero
    this.clock += 1n;
    s.credit += amount; s.updated = this.now();
  }
  charge(sess, units) {                                    // :272-292
    const s = this.sessions.get(sess);
    check(s !== undefined, 'no such session');
    check(s.state === 0, 'session paused — resume first (pause, not kill)');
    check(units >= 1n && units <= 1000000000n, 'units 1..1e9');
    // VENDING.CPP :279-280 — the live read. The transcription consults the
    // table AS IT IS NOW. The law references consult the open-time commitment.
    let perUnit, titheBp;
    if (this.pricing === 'live') {
      const r = this.rates.get(s.rail);
      check(r !== undefined, 'rate row vanished');
      perUnit = r.basis; titheBp = r.tithe_bp;
    } else {
      const b = s._bound;
      const r = this.rates.get(s.rail);
      if (this.pricing === 'snapshot-refuse') {
        check(r !== undefined, 'rate row vanished');
        const now = digestPricing({ rail: s.rail, basis: r.basis, tithe_bp: r.tithe_bp });
        check(now === b.commitment,
              'historical pricing commitment cannot be proven — the governed row no longer matches the open-time pricing this session authorized');
      }
      perUnit = b.basis; titheBp = b.tithe_bp;
    }
    check(perUnit > 0n, 'rate basis is zero');
    const cost = perUnit * units;
    check(s.burned + cost <= s.ceiling, 'over ceiling — upto max refused (verifyAgainst rule)');
    const available = s.credit - s.burned;                 // never negative by construction
    const payableUnits = available / perUnit;
    const burnUnits = payableUnits < units ? payableUnits : units;
    s.burned += perUnit * burnUnits;
    if (s.credit - s.burned < perUnit) s.state = 1;        // PAUSE AT ZERO
    this.clock += 1n;
    s.updated = this.now();
    return { burned: s.burned, pricedPerUnit: perUnit, pricedTitheBp: titheBp };
  }
  pause(sess) {                                            // :294-300
    const s = this.sessions.get(sess); check(s !== undefined, 'no such session');
    check(s.state === 0, 'not active'); s.state = 1; this.clock += 1n; s.updated = this.now();
  }
  resume(sess) {                                           // :302-308
    const s = this.sessions.get(sess); check(s !== undefined, 'no such session');
    check(s.state === 1, 'not paused'); s.state = 0; this.clock += 1n; s.updated = this.now();
  }
}

function digestPricing(p) {
  return createHash('sha256').update(JSON.stringify([p.rail, p.basis.toString(), p.tithe_bp])).digest('hex');
}

// ── 3. the tithe split law (the charter arithmetic — VV-1.5) ────────────────
// EXPLICIT ROUNDING LAW, integer arithmetic at the actual smallest unit:
//   tithe_leg  = (total × bp) / 10000   — BigInt division = truncation toward
//                                      zero (floor for non-negative values);
//                                      the sub-unit remainder stays with the
//                                      member leg;
//   member_leg = total − tithe_leg      — computed ONCE by subtraction, never
//                                      an independently rounded second leg.
// Conservation member + tithe == total is then true BY CONSTRUCTION — no
// value appears or disappears through independently rounded legs.
export function splitTithe(total, bp) {
  if (total < 0n) throw new Error('total must be non-negative');
  if (bp < 0 || bp > 10000) throw new Error('bp out of governed bounds');
  const tithe = (total * BigInt(bp)) / 10000n;
  const member = total - tithe;
  return { tithe, member };
}

// ── 4. the oracles ──────────────────────────────────────────────────────────
// VV-1 oracle: a priced consumption on session `open` (the inputs in force at
// opensess) is lawful IFF it priced the open-time inputs, OR refused while
// NAMING the historical-pricing commitment. Silent use of any other figure
// (including the current table's) is a defect.
function judgePricedConsumption(openInputs, result) {
  if (result.refused) {
    const names = /historical pricing commitment|open-time pricing/i.test(result.refusal || '');
    return { ok: names, why: names
      ? `lawful refusal naming the commitment: "${result.refusal}"`
      : `refused without naming the historical pricing commitment ("${result.refusal}") — a refusal must prove it is THE pricing refusal, not an unrelated check` };
  }
  const expected = openInputs.basis * result.units;
  if (result.burnDelta !== expected)
    return { ok: false, why: `silent repricing: burned ${result.burnDelta} smallest-units; the open-time committed price was ${expected} (basis ${openInputs.basis} × ${result.units} units) — the current governed row was consumed, not the session's authorization` };
  return { ok: true, why: `priced at the open-time commitment (${expected})` };
}
// VV-1.2/1.4c attestation oracle: what the session can PROVE it was opened
// under. Lawful surfaces expose the full price-affecting input set; the
// contract's row exposes only the rail key.
function judgeBinding(model, sess) {
  const b = model.sessions.get(sess)._bound;
  const need = ['rail', 'basis', 'tithe_bp'];
  const missing = need.filter((k) => b[k] === undefined);
  return { ok: missing.length === 0, why: missing.length === 0
    ? `session attests the full price-affecting input set (rail, basis ${b.basis}, tithe_bp ${b.tithe_bp})`
    : `session binds only { ${Object.keys(b).join(', ')} } — price-affecting input(s) ${missing.join(', ')} unattestable; governance can mutate them mid-session with zero session-row delta` };
}

const attempt = (fn) => { try { const r = fn(); return { refused: false, ...r }; }
  catch (e) { if (e instanceof Refused) return { refused: true, refusal: e.message }; throw e; } };

// byte-snapshot for row-identity checks (BigInt-exact)
const rowBytes = (x) => JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? `${v}n` : v));

// ── 5. the probes ───────────────────────────────────────────────────────────
// Every probe returns { verdict: 'GREEN' | 'RED', why, charter? }. REDs must
// be registered in LEDGER below or CI fails; the charter string in the ledger
// is what a fix must make true.
const R1 = 6000n, R2 = 12000n, R3 = 24000n;   // 0.6000 / 1.2000 / 2.4000 A
const CEIL = 500000n;                          // 50.0000 A — generous, never the limiter

function freshContract() {
  const m = new VendingModel('live');
  m.init('admin', 100);
  return m;
}
const credit = (m, sess, nonce, amt) => { const r = attempt(() => m.settle(sess, 'alice', nonce, amt));
  if (r.refused) throw new Error(`probe setup refused: ${r.refusal}`); };

// VV-1.1 — the core: open under R1, mutate to R2, consume. Snapshot or
// refusal; never silent R2.
function probe_1_1() {
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m, 1, 101n, CEIL);
  m.setrate('vaulta', R2, 1000, 'compute');              // the governed mutation
  const before = m.sessions.get(1).burned;
  const r = attempt(() => m.charge(1, 1n));
  const j = judgePricedConsumption({ basis: R1 }, { ...r, units: 1n,
    burnDelta: r.refused ? null : m.sessions.get(1).burned - before });
  return { verdict: j.ok ? 'GREEN' : 'RED', why: j.why,
    evidence: r.refused ? `charge refused: "${r.refusal}"` : `charge burned ${(m.sessions.get(1).burned - before)} (R2 = ${R2}; R1 = ${R1})` };
}

// VV-1.2 — full-input binding: hold basis byte-equal, mutate ONLY tithe_bp.
// The session must attest the input set it authorized; adjacent mutation must
// not be able to shift pricing inputs invisibly.
function probe_1_2() {
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  m.setrate('vaulta', R1, 2500, 'compute');              // adjacent mutation, same key, same basis
  const j = judgeBinding(m, 1);
  const row = m.rates.get('vaulta');
  return { verdict: j.ok ? 'GREEN' : 'RED', why: j.why,
    evidence: `rate row now { basis ${row.basis} (unchanged), tithe_bp ${row.tithe_bp} (was 1000) }; session row delta across the mutation: none` };
}

// VV-1.3 — inverse control: a session opened AFTER the mutation prices at R2.
// Expected GREEN — proves the battery demands session-scoped immutability,
// not frozen governance.
function probe_1_3() {
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.setrate('vaulta', R2, 1000, 'compute');
  m.opensess(2, 'alice', 'agent', 'vaulta', CEIL);       // opened under the R2 regime
  credit(m, 2, 102n, CEIL);
  const before = m.sessions.get(2).burned;
  const r = attempt(() => m.charge(2, 1n));
  const delta = r.refused ? null : m.sessions.get(2).burned - before;
  const ok = !r.refused && delta === R2;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? `post-mutation session priced at the governing R2 (${delta}) — current pricing for current sessions is the lawful live behavior`
    : `post-mutation session did not price at R2 (${r.refused ? `refused: ${r.refusal}` : `burned ${delta}`})` };
}

// VV-1.4a — delete/recreate of the same rate key, two legs.
function probe_1_4a() {
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m, 1, 103n, CEIL);
  m.rmrate('vaulta');
  const midRefusal = attempt(() => m.charge(1, 1n));
  const midOk = midRefusal.refused && /rate row vanished/.test(midRefusal.refusal);
  // leg 2: recreate at R3 — the open session must not silently adopt it
  m.setrate('vaulta', R3, 1000, 'compute');
  const before = m.sessions.get(1).burned;
  const r = attempt(() => m.charge(1, 1n));
  const j = judgePricedConsumption({ basis: R1 }, { ...r, units: 1n,
    burnDelta: r.refused ? null : m.sessions.get(1).burned - before });
  // leg 3: recreate at the SAME values — outcome equality must not acquit
  const m2 = freshContract();
  m2.setrate('vaulta', R1, 1000, 'compute');
  m2.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m2, 1, 113n, CEIL);
  m2.rmrate('vaulta');
  m2.setrate('vaulta', R1, 1000, 'compute');             // byte-equal values, NEW provenance
  const bindJudge = judgeBinding(m2, 1);
  const verdict = (midOk && j.ok && bindJudge.ok) ? 'GREEN' : 'RED';
  const fails = [];
  if (!midOk) fails.push('delete-phase charge did not produce the lawful "rate row vanished" refusal');
  if (!j.ok) fails.push(j.why);
  if (!bindJudge.ok) fails.push(`same-values recreate: ${bindJudge.why}`);
  return { verdict, why: fails.join('; ') || 'all three legs lawful',
    evidence: `mid-delete: ${midRefusal.refused ? `"${midRefusal.refusal}"` : 'NOT refused'}; after R3 recreate: ${r.refused ? `"${r.refusal}"` : `burned ${m.sessions.get(1).burned - before} (R3 = ${R3}, open-time R1 = ${R1})`}; same-values recreate: outcome would equal R1 with no attestation` };
}

// VV-1.4b — mutation immediately before settlement (the governance race).
function probe_1_4b() {
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m, 1, 104n, CEIL);
  m.setrate('vaulta', R2, 1000, 'compute');              // the immediately-preceding action
  const before = m.sessions.get(1).burned;
  const r = attempt(() => m.charge(1, 1n));              // the very next action
  const j = judgePricedConsumption({ basis: R1 }, { ...r, units: 1n,
    burnDelta: r.refused ? null : m.sessions.get(1).burned - before });
  return { verdict: j.ok ? 'GREEN' : 'RED', why: j.why,
    evidence: r.refused ? `charge refused: "${r.refusal}"` : `adjacent-block mutation priced: burned ${m.sessions.get(1).burned - before} at R2` };
}

// VV-1.4c — mutation/reversion R1→R2→R1. Equality of the final table must not
// erase the authorization fact. Two legs: (1) no consumption during the R2
// window — outcome equality is COINCIDENCE unless attested; (2) consumption
// DURING the R2 window then reversion — intermediate state definitely matters.
function probe_1_4c() {
  // leg 1: revert before any consumption
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m, 1, 105n, CEIL);
  m.setrate('vaulta', R2, 1000, 'compute');
  m.setrate('vaulta', R1, 1000, 'compute');              // reversion — final table == open table
  const before = m.sessions.get(1).burned;
  const r = attempt(() => m.charge(1, 1n));
  const j1 = judgePricedConsumption({ basis: R1 }, { ...r, units: 1n,
    burnDelta: r.refused ? null : m.sessions.get(1).burned - before });
  const bind = judgeBinding(m, 1);                        // can the session ATTEST why equality holds?
  // leg 2: consume DURING the R2 window, then revert, then consume again —
  // intermediate state that mattered: the mid-window consumption
  const m2 = freshContract();
  m2.setrate('vaulta', R1, 1000, 'compute');
  m2.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m2, 1, 106n, CEIL);
  m2.setrate('vaulta', R2, 1000, 'compute');
  const preMid = m2.sessions.get(1).burned;
  const mid = attempt(() => m2.charge(1, 1n));           // during the mutated window
  const postMid = m2.sessions.get(1).burned;
  m2.setrate('vaulta', R1, 1000, 'compute');             // reversion
  const after = attempt(() => m2.charge(1, 1n));         // after reversion
  const j2 = judgePricedConsumption({ basis: R1 }, { ...mid, units: 1n,
    burnDelta: mid.refused ? null : postMid - preMid });
  const ok = j1.ok && bind.ok && j2.ok;
  return { verdict: ok ? 'GREEN' : 'RED',
    why: [
      j1.ok ? null : `leg-1 ${j1.why}`,
      bind.ok ? null : `leg-1 attestation: ${bind.why} — the final table's equality with the open-time table is coincidence, not proof of the authorization`,
      j2.ok ? null : `leg-2 mid-window consumption: ${j2.why} — the intermediate state mattered and the live table priced it`,
    ].filter(Boolean).join('; ') || 'both legs lawful',
    evidence: `leg-1: ${r.refused ? `refused "${r.refusal}"` : `burned ${m.sessions.get(1).burned - before} (== R1 only because the live table was reverted)`}; leg-2: mid-window ${mid.refused ? `refused "${mid.refusal}"` : `burned ${postMid - preMid} (R2 = ${R2}) silently`}, post-reversion ${after.refused ? 'refused' : 'burned at R1'} — one session, two pricing regimes, no per-consumption attestation` };
}

// VV-1.5 — tithe conservation. The law above is exact by construction; the
// probe (a) sweeps the law for conservation and the truncation property, and
// (b) proves the CONTRACT has no tithe leg at all — conservation is currently
// unprovable, and the arithmetic stands as the charter.
function probe_1_5() {
  const bad = [];
  for (let total = 1n; total <= 4096n; total += 1n) {
    for (const bp of [0, 1, 999, 1000, 3333, 5000, 9999, 10000]) {
      const { tithe, member } = splitTithe(total, bp);
      if (member + tithe !== total) bad.push(`total ${total} bp ${bp}: ${member}+${tithe} != ${total}`);
      if (tithe !== (total * BigInt(bp)) / 10000n) bad.push(`total ${total} bp ${bp}: truncation law violated`);
      if (member !== total - tithe) bad.push(`total ${total} bp ${bp}: member leg not by-subtraction`);
    }
  }
  // named vectors at the ruled figures (0.6000 A basis, 10.00% founder tithe)
  const vectors = [
    { total: 6000n, bp: 1000, tithe: 600n,  member: 5400n },  // 0.6000 A, 10% — exact
    { total: 6000n, bp: 3333, tithe: 1999n, member: 4001n },  // remainder 1998… → truncation, member absorbs
    { total: 1n,    bp: 1000, tithe: 0n,    member: 1n },     // one smallest unit: sub-unit tithe stays with member
    { total: 42000n, bp: 3333, tithe: 13998n, member: 28002n }, // 7 units of 0.6000 A
    { total: 6000n, bp: 10000, tithe: 6000n, member: 0n },    // 100% boundary conserves
    { total: 6000n, bp: 0,     tithe: 0n,    member: 6000n }, // 0% boundary conserves
  ];
  for (const v of vectors) {
    const s = splitTithe(v.total, v.bp);
    if (s.tithe !== v.tithe || s.member !== v.member)
      bad.push(`vector total ${v.total} bp ${v.bp}: got tithe ${s.tithe}/member ${s.member}, want ${v.tithe}/${v.member}`);
  }
  // the contract leg: does ANY settlement path consult tithe? (structural pin
  // already proves charge does not; the probe demonstrates it behaviorally —
  // a charge under a mutated tithe_bp produces an identical burn)
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m, 1, 107n, CEIL);
  const b1 = m.sessions.get(1).burned;
  attempt(() => m.charge(1, 1n));
  const d1 = m.sessions.get(1).burned - b1;
  const m2 = freshContract();
  m2.setrate('vaulta', R1, 2500, 'compute');             // identical basis, different tithe
  m2.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
  credit(m2, 1, 108n, CEIL);
  const b2 = m2.sessions.get(1).burned;
  attempt(() => m2.charge(1, 1n));
  const d2 = m2.sessions.get(1).burned - b2;
  const titheLegAbsent = d1 === d2;                      // burn blind to tithe_bp ⇒ no leg
  const lawOk = bad.length === 0;
  const verdict = lawOk && !titheLegAbsent ? 'GREEN' : 'RED';
  return { verdict, why: [
    lawOk ? null : `the split LAW itself is unsound: ${bad.slice(0, 3).join('; ')}`,
    titheLegAbsent ? 'the contract HAS NO tithe leg — no action computes or moves a split (charge is blind to tithe_bp: identical burns under 1000bp and 2500bp), so conservation is UNPROVABLE end-to-end; the integer law above (truncating tithe, member by subtraction) is the charter for the leg' : null,
  ].filter(Boolean).join('; ') || 'tithe leg conserves under the explicit law',
  evidence: `sweep 4096 totals × 8 bp values: ${bad.length === 0 ? 'conservation exact, truncation law exact, member leg always by subtraction' : 'UNSOUND'}; contract: burn(tithe_bp=1000)=${d1} == burn(tithe_bp=2500)=${d2} ⇒ ${titheLegAbsent ? 'no tithe arithmetic exists anywhere on the settlement path' : 'tithe consulted'}` };
}

// VV-1.6 — bounds: >10000 refuses BEFORE state mutation; 0 and 10000 boundary
// controls accepted. Expected GREEN (checks precede writes — :143-144, :169).
function probe_1_6() {
  const m = freshContract();
  m.setrate('vaulta', R1, 1000, 'compute');
  const before = { ...m.rates.get('vaulta') };           // includes `updated`
  const clockBefore = m.now();
  const over = attempt(() => m.setrate('vaulta', R2, 10001, 'compute'));   // existing row
  const rowUnchanged = rowBytes(m.rates.get('vaulta')) === rowBytes(before)
    && m.now() === clockBefore;
  const rowsBefore = m.rates.size;
  const overNew = attempt(() => m.setrate('newrail', R1, 10001, 'compute')); // emplace path
  const newNotCreated = m.rates.size === rowsBefore;
  const z = attempt(() => m.setrate('vaulta', R1, 0, 'zero leg'));          // boundary 0
  const t = attempt(() => m.setrate('vaulta', R1, 10000, 'full leg'));      // boundary 10000
  const titheBefore = m.tithe ? { ...m.tithe } : null;
  const tclock = m.now();
  const overTithe = attempt(() => m.settithe(10001, 'kingbeelovis'));
  const titheUnchanged = rowBytes(m.tithe) === rowBytes(titheBefore) && m.now() === tclock;
  // boundary conservations ride VV-1.5's law
  const cz = splitTithe(6000n, 0), ct = splitTithe(6000n, 10000);
  const boundsConserve = cz.tithe + cz.member === 6000n && ct.tithe + ct.member === 6000n;
  const ok = over.refused && overNew.refused && overTithe.refused
    && rowUnchanged && newNotCreated && titheUnchanged
    && !z.refused && !t.refused && boundsConserve;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'tithe_bp=10001 refused on both the modify and emplace paths with rows byte-identical (updated stamp untouched — refusal lands BEFORE state mutation); boundaries 0 and 10000 accepted and both conserve under the VV-1.5 law'
    : [ !over.refused && 'existing-row setrate(10001) not refused',
        !overNew.refused && 'new-rail setrate(10001) not refused',
        !overTithe.refused && 'settithe(10001) not refused',
        !rowUnchanged && 'refusal MUTATED the existing row (or its updated stamp)',
        !newNotCreated && 'refusal CREATED the new-rail row',
        !titheUnchanged && 'refusal mutated the tithe singleton',
        z.refused && 'boundary bp=0 refused',
        t.refused && 'boundary bp=10000 refused',
        !boundsConserve && 'boundary conservation failed' ].filter(Boolean).join('; ') };
}

// VV-1.7 — the negative control / oracle self-test: deliberately settle
// against the live mutable table and prove the battery CONVICTS it; prove the
// two lawful references are ACQUITTED. This can never be ledger-able — a fail
// here means the battery itself is broken (vacuous or indiscriminate).
function probe_1_7() {
  const run = (pricing) => {
    const m = new VendingModel(pricing);
    m.init('admin', 100);
    m.setrate('vaulta', R1, 1000, 'compute');
    m.opensess(1, 'alice', 'agent', 'vaulta', CEIL);
    m.settle(1, 'alice', 109n, CEIL);
    m.setrate('vaulta', R2, 1000, 'compute');
    const before = m.sessions.get(1).burned;
    const r = attempt(() => m.charge(1, 1n));
    return judgePricedConsumption({ basis: R1 }, { ...r, units: 1n,
      burnDelta: r.refused ? null : m.sessions.get(1).burned - before });
  };
  const sabotage = run('live');            // settles against the live mutable table
  const lawSnap = run('snapshot');
  const lawRefuse = run('snapshot-refuse');
  const convicts = !sabotage.ok, acquitsSnap = lawSnap.ok, acquitsRefuse = lawRefuse.ok;
  const ok = convicts && acquitsSnap && acquitsRefuse;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? `oracle calibrated: live-table settlement CONVICTED (${sabotage.why.match(/burned \d+/)?.[0]} ≠ open ${R1}); snapshot reference acquitted (${lawSnap.why}); refuse-on-unprovable reference acquitted (${lawRefuse.why})`
    : `ORACLE BROKEN: ${!convicts ? 'failed to convict deliberate live-table settlement — the battery is vacuous; ' : ''}${!acquitsSnap ? 'failed to acquit the lawful snapshot semantics; ' : ''}${!acquitsRefuse ? 'failed to acquit the lawful refusal semantics' : ''}` };
}

// ── 6. the red ledger (registered defects; AV-11 discipline) ────────────────
// Each row: the probe that must be RED today, and the charter a fix must make
// true. A row whose probe turns GREEN must be promoted (removed here, verdict
// recorded in the spec) — silently keeping it fails as STALE.
const LEDGER = [
  { probe: 'VV-1.1', name: 'live-read pricing — no open-time commitment',
    charter: 'opensess must commit the session\'s pricing inputs (basis + tithe_bp of the priced row, or a content digest over them) into the session row; charge must price ONLY that commitment, or refuse naming the historical pricing commitment — vending.cpp:279-280 must stop consulting the live row for an open session' },
  { probe: 'VV-1.2', name: 'session binds only the rail key — price-affecting inputs unattestable',
    charter: 'the session row must attest every price-affecting input required for settlement (rail, basis, tithe_bp), so an adjacent governance mutation (same key, same basis, different tithe_bp) cannot shift the authorized inputs with zero session delta — vending.cpp:67-81' },
  { probe: 'VV-1.4a', name: 'delete/recreate of the rate key reprices or de-provens an open session',
    charter: 'rmrate+setrate(R3) must not be silently adopted by a pre-existing session (snapshot prices R1 / refusal names the commitment); recreate-with-same-values must be distinguishable from never-mutated by the session\'s recorded commitment, not by outcome coincidence' },
  { probe: 'VV-1.4b', name: 'governance mutation immediately before settlement lands silently',
    charter: 'a setrate in the action immediately preceding charge must not change that charge\'s price for a session opened earlier — same root as VV-1.1, registered separately because it is the realistic race shape' },
  { probe: 'VV-1.4c', name: 'R1→R2→R1 reversion — outcome equality without provenance',
    charter: 'equality of the final table with the open-time table must not acquit a consumption: the session must PROVE it priced its authorization (snapshot or content-digest match), and a session that consumed across two rate regimes must carry per-consumption pricing evidence — vending.cpp records neither' },
  { probe: 'VV-1.5', name: 'tithe leg absent — conservation unprovable',
    charter: 'settlement must split total into member + tithe legs using the integer law above (tithe = trunc(total×bp/10000), member by subtraction, smallest-unit BigInt), conserving exactly; the two governed tithe knobs (rate_row.tithe_bp and the tithe singleton) need a precedence law, and whichever settlement consults must be inside the VV-1.2 bound' },
];

// ── 7. the run ──────────────────────────────────────────────────────────────
const PROBES = [
  ['VV-1.1', 'snapshot-or-refuse under R1→R2', probe_1_1],
  ['VV-1.2', 'full price-input binding (adjacent mutation)', probe_1_2],
  ['VV-1.3', 'inverse control — post-mutation session prices R2', probe_1_3],
  ['VV-1.4a', 'delete/recreate of the rate key (3 legs)', probe_1_4a],
  ['VV-1.4b', 'mutation immediately before settlement', probe_1_4b],
  ['VV-1.4c', 'reversion R1→R2→R1 (equality ≠ provenance)', probe_1_4c],
  ['VV-1.5', 'tithe integer conservation + leg existence', probe_1_5],
  ['VV-1.6', 'tithe_bp bounds refuse-before-mutation; 0/10000 boundaries', probe_1_6],
  ['VV-1.7', 'negative control — oracle convicts live-table settlement', probe_1_7],
];

const pinFails = checkPins();
const rows = PROBES.map(([id, title, fn]) => { const r = fn(); return { id, title, ...r }; });

console.log('VV-1 — immutable pricing semantics for open sessions');
console.log(`target: contracts/vending/src/vending.cpp (Jungle4 rehearsal bnrapolltest; mainnet founder-gated)`);
console.log('');
for (const r of rows) {
  console.log(`${r.verdict === 'GREEN' ? '✓ GREEN' : '✗ RED  '} ${r.id} ${r.title}`);
  console.log(`         ${r.why}`);
  if (r.evidence) console.log(`         evidence: ${r.evidence}`);
}
console.log('');

const fatal = [];
if (pinFails.length) fatal.push(...pinFails);
const selfTest = rows.find((r) => r.id === 'VV-1.7');
if (selfTest.verdict !== 'GREEN') fatal.push(`oracle self-test RED: ${selfTest.why}`);
const unregistered = rows.filter((r) => r.verdict === 'RED' && !LEDGER.some((l) => l.probe === r.id));
for (const u of unregistered) fatal.push(`${u.id} is RED but NOT registered in the ledger — a future defect or a regression; register it with its charter or fix the cause`);
const stale = LEDGER.filter((l) => { const p = rows.find((r) => r.id === l.probe); return p && p.verdict === 'GREEN'; });
for (const s of stale) fatal.push(`ledger row ${s.probe} (${s.name}) is GREEN today — STALE; promote the row in docs/agents/VV-SPECS.md and remove it here, so the ledger never lags reality`);

if (fatal.length) {
  console.log('VV-1 FAIL:');
  for (const f of fatal) console.log(`  ✗ ${f}`);
  process.exit(1);
}
const reds = rows.filter((r) => r.verdict === 'RED');
console.log(`VV-1 PASS — ${rows.length - reds.length}/${rows.length} probes green; ${reds.length} REGISTERED defect(s) printed above (registered ≠ resolved):`);
for (const l of LEDGER) console.log(`  • ${l.probe} ${l.name}`);
console.log('The charters live in docs/agents/VV-SPECS.md; the fix lane re-derives this battery from the new vending.cpp sha (the pin enforces it).');
