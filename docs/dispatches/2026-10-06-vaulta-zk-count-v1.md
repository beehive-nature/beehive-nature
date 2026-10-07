# 2026-10-06 — Vaulta/ZK lane: the count-only aggregate proof, first light on-chain

zCode seat, branch zcode/vaulta-zk-2026-10-06. SPEC-ZK-RECEIPT-
AGGREGATES-1 §sequence 2–3: the v1 circuit is built, proven over the
ant-reach cohort, and the estate's own nine-phase PLONK verifier ACCEPTED
both real proofs and REFUSED every forgery ON-CHAIN — on the Spring
v1.2.2 rehearsal chain, the same client family as Vaulta's public
endpoints.

SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

**CLAIM.** A prover holding the private 40-member ant-reach cohort
receipt set can publish only (root, kind, count) and a proof, and the
chain verifies the count claim against the anchored root — the receipts,
the fingerprints, and the verdicts never leave the prover.

**EVIDENCE (all from this seat's runs, 2026-10-06, WSL lab on the
founder's laptop).**

Circuit — `contracts/zkreceipts/count.circom`:
- 101,278 constraints (48,057 non-linear), 3 publics (root, kind,
  count), 320 private inputs; circom compile receipt in
  `prove_count.sh` step [1] output.
- FULL-TREE fold, not per-member paths: the root provably derives from
  EXACTLY the 64-leaf witness (40 members + 24 constrained zero pads);
  per-leaf kept = (≥1 settled run) ∧ (zero flips), folded with both
  counters up the same tree.
- Witness builder `zkrprep.cjs` cross-checks EVERY member row and every
  aggregate against the receipt (members 40; settled 43 dead + 50 live;
  flipped 0; kept-members 20+20) — it fails loud on any disagreement.
- Commitment root for the 2026-10-06 cohort:
  `0x2e6bc682087a3c07baafea8502ba7d2ae10e6f02ff9bf0edceaf2a29df59f98d` (PUBLIC-CONSTANT: this lane's cohort commitment root, published by design).

Ceremony — pot17 bn128, ONE honest participant, REHEARSAL-labeled (the
estate law): contribution response `2bfb5bd63e2a1a65…7305ec10`, next
challenge `2bb7b3577878d1e7…eb6cc02c`. (`zkey verify` is groth16-only —
"zkey file is not groth16" — the M-lane `|| true` law carried forward.)

Off-chain (snarkjs 0.7.6 plonk): both real proofs verify —
`OFFCHAIN-DEAD-OK`, `OFFCHAIN-LIVE-OK` (claims: kind 0 → count 20,
kind 1 → count 20, same root). Forgeries, all REJECTED: tampered proof
word (eval_zw+1), mutated count, mutated root, mutated kind.

On-chain — `contracts/zkreceipts/zkrcount.cpp` (anchor + verify; root
rides the table as RAW BYTES so the fixed_bytes T-laws never touch the
transcript; one proof per anchor; alg id 2 shared with note.cpp's law
row). Deployed on the Spring v1.2.2 rehearsal chain after the minibios
ladder + CRYPTO_PRIMITIVES activation; code hash
`eb4d61c98fad1c4c3611a57d6a89e98938eaf455688150c37489df4acaf576e5` (PUBLIC-CONSTANT: zkrcount wasm code hash, on-chain readable by anyone).
Account `zkreceipts33`; table rows read back with verified_at set.

| leg | result |
|---|---|
| anchor 1 (root, kind=0, count=20) | executed `b380522d…49881` |
| REAL PROOF dead-baseline | executed `824d77d3…4339e` — **billed 9,629 µs** (blk 4708) |
| anchor 2 (root, kind=1, count=20) | executed `970702d4…ce8d6` |
| REAL PROOF live-baseline | executed `071c23d0…1fd82` — **billed 12,427 µs** (blk 4723) |
| forged proof (eval_zw+1), fresh anchor 3 | REFUSED — "count proof REJECTED — plonk pairing false" |
| mutated COUNT (anchor says 21) | REFUSED — plonk pairing false |
| mutated ROOT (last byte flipped), anchor `86b4bba9…3c45` | REFUSED — plonk pairing false |
| mutated KIND (anchor says live, dead proof) | REFUSED — plonk pairing false |
| re-verify anchor 1 | REFUSED — "anchor already verified (one proof per anchor)" |
| bad kind at anchor time (kind=2) | REFUSED — "kind must be 0 or 1" |

The mutated-claim legs are the load-bearing ones: the publics the
pairing checks are assembled FROM THE ANCHOR ROW, so a real proof
cannot ride a mutated claim — the pairing itself refuses.

**BOUNDARY NOT CROSSED.**
- Rehearsal chain: one local Spring node, dev keys, /tmp state. A
  Vaulta PUBLIC-testnet verify is NOT yet done — the estate's jungle4
  accounts are CPU-dry (notelab11111 171 µs, bnrapolltest 0 µs,
  bzcodejungle 2 µs; the 2026-09-03 powerup expired). FOUNDER GESTURE,
  asked and answered mid-lane: faucet `monitor.jungletestnet.io/#faucet`
  → account `bnrapolltest` (the proven sponsor payer; one drip covers
  the pass).
- Measurement ORIGIN: the proof says the CLAIM follows from the witness
  set; it cannot say a browser really dialed anything. Seat-signed
  receipts feeding the commitment are the named next lane.
- §tungsten 2 (leak distinguisher), 3 (testnet cost figure), 4 (scale
  1k/10k) remain OPEN — the coupling ban with the Autonomi upstream
  lane STANDS.
- The ceremony is one honest participant — rehearsal-labeled until a
  witnessed multi-party sealing is ruled.

## The live-proof billing line

Both verifies billed on the rehearsal chain, uncontended single node:
dead-baseline 9,629 µs (blk 4708), live-baseline 12,427 µs (blk 4723) —
the second sits a little above the M4–M10 payment lane's 6.9–10.4 ms
band (5 publics there, 3 here) and under the 15 ms tripwire; labeled
host variance per the M4/M5 contention law rather than claimed as a
tighter figure. The verifier cost is O(1) in circuit size — 101k
constraints verified at the same price class as the 12k payment circuit.

## Found live and banked (the ladder's own lessons)

- A cleos wallet FILE survives WSL restarts in ~/eosio-wallet but its
  password lived in /tmp — a wallet without its password is
  unrecoverable; wipe and recreate (only ever public dev + fresh bench
  keys). Symptom: every later push silently unsigned.
- zkbench's full `eosio.bios.wasm` demands `env.bls_pairing` this node
  does not expose — use `minibios` (the handoff's ladder was right).
- snarkjs `powersoftau contribute` BLOCKS on the entropy prompt under a
  closed stdin — pipe it (the committed script does).
- `zkey verify` is groth16-only; `|| true` carried.
- `cleos push action` takes `[args]`, not `[[args]]`; and the ACTION
  NAME is not optional — say() swallowed both failures silently.

## ADDENDUM (same night): the pass on VAULTA PUBLIC TESTNET — §tungsten-3 COST earned

The founder powered up the estate's testnet accounts mid-lane (faucet +
powerup on bnrapolltest + bzcodejungle; 2.27 s CPU each observed), so the
§sequence-4 testnet verify ran immediately — `zkrrun-jungle4.sh`, the
spladder sponsor recipe (every tx = [core.vaulta deposit(bnrapolltest,
varying 4-decimal amount), real action], signed by both — self-stake on
jungle4 buys ~28 µs: measured; only_bill_first_authorizer makes the
sponsor's rented CPU pay). Contract account `zkrtst222222` (sponsor
created it with stakes + 1 MB RAM — the pot17-era vk costs ≈498 KB of
RAM: nodeos said "needs 510,526 bytes").

Code hash on jungle4 = `eb4d61c98fad…caf576e5` — BYTE-IDENTICAL to the
rehearsal chain deploy.

| leg | result (jungle4, via greymass) |
|---|---|
| sponsored setcode | OK `c4c7f4bb…` billed 2,301 µs |
| anchor 1 (root, kind=0, count=20) | OK `a78d85c1…` 403 µs |
| REAL PROOF dead-baseline | OK `10198154…` **billed 12,071 µs** |
| anchor 2 (root, kind=1, count=20) | OK `a3241fd8…` 392 µs |
| REAL PROOF live-baseline | OK `a7e7ae05…` **billed 10,647 µs** |
| forged proof (eval_zw+1) @ fresh anchor 3 | REFUSED (eosio_assert_message) |
| real proof vs mutated count 21 @4 | REFUSED |
| real proof vs mutated root @5 | REFUSED |
| real dead proof vs mutated kind @6 | REFUSED |
| re-verify @1 | REFUSED |
| bad kind (2) at anchor time | REFUSED (anchor 7 never lands) |

Anchors table on-chain: seq 1/2 verified_at set (1791346680/81); seq
3–6 remain verified_at 0 — claims without proofs stay unverified, by
construction. Batch amortization NOT measured (single verifies only) —
named, not claimed.

**COST receipt (the Vaulta figure this gate needed): one count-proof
verify bills ≈10.6–12.1 ms CPU on jungle4** — same class as the local
rehearsal (9.6/12.4 ms) and the M-lane payment verifier (6.9–10.4 ms).

Found live and banked (testnet ladder):
- cleos prints the UNSIGNED TRANSACTION JSON to STDERR — the `2>&1` in
  spladder's skeleton capture is load-bearing; dropping it yields empty
  base txs.
- An action pushed to an account with ABI but NO CODE executes as a
  NO-OP and reports OK — a codeless deploy can masquerade as a green
  pass. The runner now hard-gates on a non-zero code hash before any
  acceptance leg (found live: one such phantom pass, discarded).
- core.vaulta deposit amounts must stay 4-decimal-valid and vary per tx
  (0.00010 A asserts; duplicates assert).
- jungle4 RAM: a pot17-vk verifier contract needs ≈498 KB — budget it
  at account creation, the 128 KB drip does not cover it.

## SECOND ADDENDUM: the SELF-PAID pass on zkrtst111111 (founder loaded it)

The founder then loaded `zkrtst111111` — the account that had stalled on
RAM (2.27 s CPU, 2.8 GB NET, 100 A liquid; RAM still 129 KiB). Self-buy
400,000 B ≈ 82 A (rammarket: 11.83M A / 58.08B RAM ≈ 0.0002 A/B), self
setcode/setabi — **code hash `eb4d61c9…` identical on the THIRD deploy**
(rehearsal → zkrtst222222 → zkrtst111111). No sponsor anywhere: plain
self-signed pushes, whose receipts carry the contract's own assertion
messages (the sponsored wrapper only surfaces generic
eosio_assert_message):

| leg | result (zkrtst111111, plain pushes) |
|---|---|
| anchor 1 (root, kind=0, count=20) | OK `3ea61238…` 175 µs |
| REAL PROOF dead-baseline | OK `e0ef7c3f…` **billed 11,075 µs** |
| anchor 2 (root, kind=1, count=20) | OK `b9dee49f…` 139 µs |
| REAL PROOF live-baseline | OK `95e33a65…` **billed 10,795 µs** |
| forged proof (eval_zw+1) @3 | REFUSED "count proof REJECTED — plonk pairing false" |
| real proof vs count 21 @4 | REFUSED pairing false |
| real proof vs mutated root @5 | REFUSED pairing false (settled re-check, below) |
| real dead proof vs kind=1 @6 | REFUSED pairing false (settled re-check, below) |
| re-verify @1 | REFUSED "anchor already verified (one proof per anchor)" |
| bad kind (2) at anchor time | REFUSED "kind must be 0 or 1" |

Anchors table: seq 1/2 verified_at 1791347511/12; seq 3–6 remained
UNVERIFIED at the recorded observation (there is no permanent-rejection
state in this contract: the verifier binds the public claim
(root, kind, count), not the sequence — anchor 6 carries the same claim
as anchor 2 and CAN be verified later by a valid live proof; that is
expected behavior, not evidence of invalidity).

State-visibility observation (WORDING CORRECTED 2026-10-07 per review:
the original text attributed the incident to greymass's load balancer,
which exceeds the recorded evidence): immediate verification attempts
for anchors 5 and 6 returned `anchor not found`; later attempts returned
the intended pairing rejection. A state-visibility or transaction-
ordering race is CONSISTENT with these observations; the precise cause
is UNVERIFIED. Operational rule (v2 runners enforce it): RECONCILE the
prerequisite anchor against chain state — with bounded, recorded
retries — before classifying any refusal; if visibility cannot be
established, the negative test is INCONCLUSIVE, never passed.

Runner: `contracts/zkreceipts/zkrself-run.sh` (+ `zkrself-recheck.sh`)
— both REWRITTEN 2026-10-07 as enforcing runners (see the review
reconciliation below; the print-only v1 forms remain at 31ec63316).

## REVIEW RECONCILIATION (2026-10-07 — the formal review of 31ec63316)

The review found the count selector INVERTED in the circuit, and this
lane re-derived and CONFIRMED it: the pre-fix line muxed on
`IsEqual(kind,0)`, so kind=0 returned the LIVE count and kind=1 the
DEAD count — opposite to the documented mapping. The symmetric 20/20
cohort masked it completely: both counts equal, so every proof,
refusal, and kind-tamper leg of all three prior passes is consistent
with EITHER selector. **All receipts above (rehearsal 44d484fbc,
sponsored testnet 1fd2c8e04, self-paid testnet 31ec63316) are
measurements of the PRE-FIX BUILD — kept as evidence, not as a green
claim.** The pairing machinery, billing figures, code-hash identity,
sponsor recipe, and ladder laws stand as measured; the CLAIM SEMANTICS
of every pre-fix proof are inverted relative to its label.

Repairs executed per the review order:
1. SELECTOR — count.circom now muxes on `kind` directly
   (`picked = deadCount + kind·(liveCount − deadCount)`): kind=0 counts
   dead-baseline, kind=1 live-baseline, matching README/contract. Pinned
   by the ASYMMETRIC FIXTURE (fixtures/asym-cohort.json: deadKept=20,
   liveKept=19, flipped=1 — synthetic, labeled, root distinct from the
   receipt's): correct claims (0,20) and (1,19) prove and verify;
   the INVERSION PROBES (0,19) and (1,20) — exactly the claims the
   pre-fix selector accepted — now fail AT WITNESS GENERATION, and the
   prove script HARD-FAILS if either passes (prove_count.sh §9b). The
   same reversed claims are refused ON-CHAIN by the rebuilt verifier
   (zkrself-run.sh §5, anchors 203/204).
2. ENFORCING RUNNERS — zkrself-run.sh v2 and zkrself-recheck.sh v2
   assert outcomes: a negative test passes ONLY on its specified
   failure reason (exact message match); wrong reason, transport
   failure, absent anchor, or unexpected execution = FAIL with the
   captured output; positive tests assert execution AND the
   verified_at table transition; exit 0 ⇔ every leg passed. The
   prereq-reconcile helper (bounded 5-attempt, recorded) implements the
   state-visibility rule above. The print-only v1 runners remain at
   31ec63316 as the reviewed artifacts; zkrrun.sh and zkrrun-jungle4.sh
   carried the pre-fix passes and are being extended for the corrected
   build by the parallel session — the ENFORCING zkrself pair is the
   acceptance authority for this lane.
3. RESOURCE BOUND — zkrcount v1.1: anchor() is permissionless BY
   DESIGN but the anchor table is now BOUNDED by a law row
   (init(max_anchors), owner-set once); a finite contract-RAM budget
   produces the CONTROLLED refusal "anchor table FULL (bounded
   resource budget)" instead of unbounded contract-funded growth. The
   exhaustion regression (fill to cap, refuse in the open) is a leg of
   the enforcing runner (§6).
4. CEREMONY — the corrected artifacts are derived from the verified
   PUBLIC multi-party transcript (powersOfTau28_hez_final_17, 54
   contributions + beacon, sha256 pinned and transcript re-verified)
   instead of the one-honest-seat rehearsal pot — the rehearsal-label
   boundary on the ceremony retires with the rebuild.

Rebuild + remeasure receipts for the corrected build land in the next
addendum (the enforcing pass above). Leak (§tungsten 2) and scale
(§tungsten 4) gates remain OPEN; the Autonomi coupling ban STANDS.

## Next

1. §tungsten 2 leak distinguisher; §tungsten 4 scale beats (1k/10k).
2. Second circuit: sums/bounds (the 43/50 settled-observation figures).
3. Mainnet Vaulta: not in scope until a witnessed ceremony ruling.

## CLOSING ADDENDUM (2026-10-07): the corrected-build pass on zkrtst111111 — finalizer green, 9/9, exit 0

The corrected build (selector-repaired circuit, v1.1 bounded contract,
code hash 7a86ac34… identity-gated as == the built wasm's sha256) ran
its enforcing acceptance on the founder-loaded account as a two-part
composite, because the account's anchor table reached its law-row cap
mid-pass — the bound working exactly as designed:

- POSITIVES (zkrself-run.sh, this build): canonical (R,0,20) and
  (R,1,20) anchors landed and verified — billed 10,277 / 11,391 µs,
  verified_at transitions asserted (read attempt 2 — the visibility
  retry earning its keep); asym (fRoot,0,20)/(fRoot,1,19) verified
  earlier in the session at 9,924 / 10,823 µs.
- NEGATIVES + EXHAUSTION (zkrself-final.sh, 9/9 PASS, exit 0): every
  prerequisite anchor DISCOVERED by exact (root,kind,count) match
  against standing rows — not assumed seqs — then each refusal
  asserted on its SPECIFIED reason: forged eval_zw+1, mutated count,
  mutated root, mutated kind, re-verify, BOTH asym REVERSED claims
  (0,19)/(1,20) — all "count proof REJECTED — plonk pairing false";
  "anchor already verified (one proof per anchor)"; and the resource
  bound: table at 27/27 rows → "anchor table FULL (bounded resource
  budget)". Final state: 27 rows, 9 verified, 18 unverified at this
  observation.

The finalizer's own ladder lessons (its red runs were load-bearing):
hardcoded run-epoch seqs break when anchors span runs — discover by
claim; inline `node -e` scripts are a quoting trap (one missing paren
silently failed every reconcile — helpers now live in files:
final-find.mjs); reads belong on a second endpoint (the write endpoint
throttles read bursts into empty outputs that masquerade as
"not visible"); REPO= must point at the worktree that owns the
helpers.

Both enforcing runners, the finalizer, and the v1.1 contract are
in-tree; the review order's four items are closed on this account,
with the sibling session's parallel receipts on zkrtst222222
(dispatch 2026-10-06-vaulta-zk-selector-fix.md §7) as the
sponsored-lane corroboration. Leak (tungsten 2) and scale (tungsten 4)
remain OPEN; the Autonomi coupling ban STANDS.
