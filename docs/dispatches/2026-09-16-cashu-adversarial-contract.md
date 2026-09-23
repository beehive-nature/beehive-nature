# CASHU ADAPTER — ADVERSARIAL TEST CONTRACT (CA-1..CA-7) · design only · 2026-09-16

**Order (founder, verbatim):** *"Turn the capability-snapshot/drift-watch
design into an adversarial test contract, not implementation. Attack: lying
NUT-06 support, enforcement disappearing after issuance, keyset retirement
with outstanding notes, signatory change across upgrade, management-RPC
capability drift, unreachable mint during redemption, and snapshot/reality
disagreement. Then compare those failure states directly with bPay's
existing UNKNOWN / HumanGate / bounded-exposure machinery so a future Cashu
adapter can reuse our recovery semantics rather than inventing another state
machine. No integration. Roll forward automatically."*
**Method:** extends the estate's adversarial tradition —
`docs/agents/ADVERSARIAL-BPAY-QUEUE.md` (AV-1..AV-11, MISSING-INVARIANT
shape) and workerb2's x402-door D-1..D-7 battery — under its pipeline law:
*specs seat attacks → builder proves RED → builder fixes GREEN → CI
arbitrates.* This contract is the attack layer ONLY: every CA names its
RED-when. Nothing is implemented. Fixture note: a **mutable-mint fixture**
(one that can flip NUT-06 flags, swap enforcement, retire keysets, and lie
— `cdk-fake-wallet` plus stubs) is named as the harness prerequisite, not
built here.

## 0 · The contract, one screen

| # | attack | RED-when (the test fails the adapter if…) | reuses |
|---|---|---|---|
| CA-1 | lying NUT-06 support | nut06 claims `10/11/12: supported` AND the behavioral probe (dust condition-carrying proof → wrong-witness swap) does NOT return a typed refusal | D-4 lying-RPC, CD-4 |
| CA-2 | enforcement vanishes after issuance | drift-watch fails to classify a probe/MintVersion change as SEMANTIC (new issuance continues, or redemption proceeds un-gated) | flag-not-credit, AV-8 |
| CA-3 | keyset retirement w/ outstanding notes | retired-keyset notes are auto-reissued under a fresh keyset without an explicit carry-or-drain decision | terminal-state law, AV-8 |
| CA-4 | signatory change across upgrade | post-upgrade carry proceeds when old keysets are not byte-equal-listed, or a NEW signing lineage appears without a human-gated succession event | HumanGate (D-7), read-back |
| CA-5 | management-RPC capability drift | an RPC mutation of fees/limits/info passes unnoticed (classified BENIGN) — only `motd`/description may pass | A3 fee-cap family, AV-6 |
| CA-6 | unreachable mint during redemption | a redemption attempt under UNKNOWN proof-state re-spends the same proof with a fresh blind message instead of reconciling via NUT-07 | **AV-8 verbatim**, D-6 |
| CA-7 | snapshot/reality disagreement | a torn/corrupted snapshot (truncated, wrong version, identity mismatch, garbage bytes) is accepted | torn-journal modes verbatim |

## 1 · Per-vector specifications (setup → stimulus → expectation → RED-when)

**CA-1 · Lying NUT-06.** Setup: mutable-mint fixture declaring
`nuts.10/11/12.supported = true` with enforcement stubbed out (or laxer
than declared — e.g., accepts the `required_sigs == 0` refund path).
Stimulus: adapter's issuance gate runs the probe — mint a dust
condition-carrying proof, attempt a wrong-witness swap. Expectation: typed
refusal observed AND recorded in `CapabilitySnapshot.probe`; issuance
proceeds only on refusal-present. RED-when: probe succeeds (no refusal)
while nut06 claims support — declared-capability-without-behavior must
never issue. *Extension named honestly: CD-4 cross-checks manifest↔behavior
in-process; the probe is CD-4 executed against a LIVE counterparty. Same
law, new target.*

**CA-2 · Enforcement disappears after issuance.** Setup: healthy snapshot
anchored; notes issued under it. Stimulus: swap the fixture's enforcement
(forget `verify_p2pk`, loosen locktime) WITHOUT changing nut06 (or with a
MintVersion bump — run both arms). Expectation: drift-watch classifies
SEMANTIC (probe arm) or version-drift; new issuance REFUSED; outstanding
notes enter redemption-gate; alert carries the snapshot diff as evidence.
RED-when: issuance continues, or redemption proceeds un-gated, after
enforcement changed. Mapping: the note's conditions are immutable bytes —
the failure belongs to the mint and is FLAGGED, never credited (meter.py
flag-not-credit shape); the note is never re-minted to "fix" drift (AV-8's
no-fresh-idempotency law, restated for proofs: **reconcile the original
proof, never re-issue under a fresh blind message to paper over drift**).

**CA-3 · Keyset retirement with outstanding notes.** Setup: notes under
keyset K; snapshot lists K. Stimulus: retire K (fixture). Expectation:
drift-watch classifies HARD → redemption-only mode; outstanding notes
either drain against K while it still redeems, or an EXPLICIT reissue
creates a NEW obligation under a NEW capability snapshot — a carry-or-drain
decision, logged, never automatic. RED-when: auto-reissue under the new
keyset without the explicit decision. Mapping: expire-release-then-
re-reserve-refused (the door's terminal-state law) — retirement is
terminal for the issuance path; recovery is a new obligation, not a
resurrection.

**CA-4 · Signatory change across upgrade.** Setup: snapshot anchors keyset
PUBLIC KEYS (NUT-01 fetch, hashed). Stimulus: run the v0.17-shape migration
with a legacy remote signatory (the verified path that nulls local
seed/mnemonic) → new keysets arrive from a different signing lineage.
Expectation: carry requires (a) every snapshot keyset still listed with
byte-equal public keys, and (b) any NEW lineage recorded as a **human-gated
succession event** — signing-authority rotation is RED-class under the
autonomy addendum, so the adapter must stop and gate, not adopt.
RED-when: carry proceeds on lineage change without the gate, or on any
old-keyset mutation. Mapping: HumanGate (D-7 immutability — the gate
decision itself can't be silently bypassed) + the safe-address read-back
family (verify the new signer before trusting it).

**CA-5 · Management-RPC capability drift.** Setup: healthy snapshot.
Stimulus: live RPC mutation — `input_fee_ppk`, `Limits`, quote TTLs
(one arm each), plus a `motd`-only control arm. Expectation: fee/limit
arms classify SEMANTIC (issuance refused — fee drift is cap drift);
motd arm classifies BENIGN and continues. RED-when: any fee/limit mutation
passes unnoticed. Mapping: A3/AV-6 — fees count against ceilings; a mint
that moves its fees has moved the adapter's caps.

**CA-6 · Unreachable mint during redemption.** Setup: mid-swap kill of the
mint between submission and response; proof state is UNKNOWN (spent or
not). Stimulus: adapter's next redemption attempt. Expectation: reconcile
first — NUT-07 state by Y (`State::{Unspent, Pending, Spent, …}`) decides;
UNKNOWN-that-stays-unknown fails closed after bounded retries; the SAME
proof is never re-blinded-and-resubmitted blind. RED-when: any blind
re-spend under unknown state. Mapping: **AV-8 verbatim, transposed from
transactions to proofs** (original obligation → original proof; no fresh
idempotency key → no fresh blind message) + D-6 web-unreachability +
A8's crash-reconciliation posture.

**CA-7 · Snapshot/reality disagreement.** Setup: the snapshot store.
Stimulus: torn writes / corruption in four modes (truncated, wrong
version, identity mismatch, garbage bytes) — plus a stale snapshot against
a moved mint (reality changed, snapshot didn't). Expectation: all fail
closed; identity-mismatched snapshots never load; staleness is caught by
the drift-watch arms of CA-2/5. RED-when: any corrupted snapshot is
accepted. Mapping: the door journal's torn-write corruption modes,
adopted verbatim for the snapshot store.

## 2 · The comparison the founder ordered — reuse verdict

| bPay machinery | absorbs | verdict |
|---|---|---|
| **UNKNOWN reconciliation** (AV-8: original obligation, no fresh key; flag-not-credit; D-6) | CA-2, CA-3, CA-6 | **reused verbatim** — the proof replaces the tx as the reconciled object; no new state machine |
| **HumanGate** (D-7 immutability; RED-class ops in the autonomy addendum) | CA-4 (signing-lineage succession) | **reused with one named extension**: "signing-lineage succession" joins credential-rotation as RED-class |
| **bounded exposure** (gas-cap admits exactly cap/1; fees-in-ceiling; MeterReceipt cumulative law; AV-6 aspiration) | CA-5 (fee drift = cap drift) + the standing worst-case backstop for every CA | **reused**; the capped-issuance backstop is what makes every SEMANTIC/HARD class tolerable |
| lying-RPC/manifest contradiction (D-4, CD-4) | CA-1 | **extended**: cross-check executed against a live counterparty (behavioral probe), not just a local manifest |
| torn-journal corruption modes | CA-7 | **reused verbatim** for the snapshot store |

**Net: a future Cashu adapter invents ZERO new state machines.** It adds
two extensions to existing ones — the live behavioral probe (CD-4 against
a counterparty) and human-gated signing-lineage succession (HumanGate's
RED list) — and otherwise runs on AV-8/flag-not-credit/terminal-state/
bounded-exposure semantics the estate already owns. That is the reuse
answer the mission asked for.

## 3 · Harness prerequisite (named, not built)

One **mutable-mint fixture** — a controllable stand-in that can lie on
NUT-06, drop enforcement, retire keysets, rotate signers, mutate via an
RPC-shaped surface, and go unreachable on cue. `cdk-fake-wallet` is the
natural seed (it already carries `with_keyset_rotation` scaffolding);
the lying/laxer-enforcement arms need stubs. Estimated as the FIRST build
item if this lane is ever chartered — before any gate code, per the
red-first pipeline law.

## 4 · Landing receipt

Queue item #4 updated with the CA contract pointer. Everything above is
design; zero implementation; the AV/D tradition's pipeline law governs any
future build. §7 seat shape, four pre-push checks, pushed branch + main.
Rolling forward hot.
