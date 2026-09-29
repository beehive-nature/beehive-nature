# NUT-10/CDK DEEP READ + NUT-24 × OUR X402 DOOR CROSSWALK · 2026-09-16

**Order (founder, verbatim):** *"Deep-read Cashu NUT-10 + Rust CDK against
bPay's capAssert/capability tiers and private SpendReceipt. Focus on whether
spending conditions can provide a useful offline-bearer adapter without
leaking bearer semantics into bPay's core. Also crosswalk NUT-24 HTTP 402
directly against our implemented x402 door—identify genuine reuse versus two
protocols merely sharing HTTP 402. Treat `cdk-mintd` as a
replaceable/self-hostable adapter, never required infrastructure. Do not
integrate yet. Produce ADOPT / ADAPT / WRAP / WATCH / BUILD findings and roll
forward."* **Mode:** research only — specs read at source (raw `10.md`,
`11.md`, `24.md`), our side read in-tree at `9d4ccd58` (`crates/bsigner/
src/x402.rs`, `ops/x402-door/src/wire.rs`, `crates/capability/src/lib.rs`,
`scripts/buzz-meter/x402_meter.py`). Zero integration. **Branch**
`zcode/nut10-cdk-deepread-2026-09-16`, worktree `../wt-zcode-eddies`.

## 0 · Findings, one screen

| # | finding | class |
|---|---|---|
| 1 | Nothing enters bPay core; the gate stands | — (ADOPT: none) |
| 2 | NUT-10/11 condition grammar = the projection language for time-bounded delegations in any future offline-bearer adapter | **ADAPT** |
| 3 | The adapter seam: settlement-ring placement, self-hosted `cdk-mintd`, SpendReceipt untouched | **ADAPT** (design) |
| 4 | A future Cashu rail rides NUT-24 behind our existing `Door`/`FacilitatorSettle` abstraction — WRAP cdk crates, never import its wire into the door | **WRAP** (declared, not built) |
| 5 | NUT-24 × our x402 door = **two rails sharing status 402, not reuse** — the shared thing is the door PATTERN we already implemented | crosswalk banked |
| 6 | cdk ALPHA maturity, NUT-18/26 encodings, NUT-12 DLEQ | **WATCH** |
| 7 | Fail-closed on undeclared NUT-06 support (the anyone-can-spend degradation has no open fix — inherent to optional NUTs) | **BUILD-rule** (a law we would write, not import) |

## 1 · NUT-10/11 at source — what spending conditions actually are

**NUT-10:** conditions live in each `Proof.secret` as
`[kind, {nonce, data, tags}]` — **per-Proof, not per-transaction**; "for a
transaction to be valid, all Proofs in that transaction must be unlocked
successfully"; the MINT enforces at spend/unlock time only (never at
minting); tags are committed key-value extensions. **Sharp edge #1
(citation law):** unsupported conditions may make proofs "regular
anyone-can-spend tokens" — *condition declared ≠ condition enforced*; the
enforcer's NUT-06 declaration is the ground truth.

**NUT-11 (P2PK):** `data` = recipient secp256k1 key; tags `sigflag`
(SIG_INPUTS/SIG_ALL), `pubkeys` + `n_sigs` (n-of-m multisig), `locktime`
(Unix ts), `refund` + `n_sigs_refund`. Witness = `{"signatures":[Schnorr-hex]}`
over SHA256 of the secret. Lock semantics: active lock → multisig rules;
expired lock → refund-tag pathway opens (refund keys may include the
original holders), and — **sharp edge #2 (citation law): expired
locktime WITHOUT a refund tag = spendable without any witness** —
locktime-without-refund is a booby trap, not a lock.

## 2 · NUT-10/11 vs capAssert + capability tiers — the crosswalk

**They bound different moments.** `bsigner/x402.rs` bounds AUTHORITY AT
ISSUANCE: `Policy`/`AllowEntry` live in "the member's hand", per-call +
cumulative caps (`DEFAULT_PER_SIGNATURE_CAP_ATOMIC = 10_000`, ≈$1-class per
signature) are checked **before signing** — the bound exists before any rail
object does. NUT-10 bounds the BEARER INSTRUMENT AT REDEMPTION: the mint
checks conditions when proofs unlock — the bound travels WITH the token.

**The genuine mapping (why ADAPT):** P2PK `locktime`+`refund`+`n_sigs_refund`
is exactly a time-bounded delegation grammar on a token — holder-key = the
delegated agent (spends before expiry), refund-keys = the owner's recovery
quorum after expiry. That is our $1/24h spend-permission pattern and the
linkauth bounded-authority family, expressed as token locks. In a bPay
offline-bearer adapter, OUR authority model stays the source of truth
(policy at signing), and the NUT-10 condition is its **downstream
projection** onto the bearer instrument — the same relation escrow-leg locks
already have to signing authority. Never the reverse: no bPay semantics
ever derive FROM a mint condition.

**Capability crate asymmetry (recorded, honest):** `capability`'s model
(`Capability{with, can}`, `EvidenceClass`, `Tier`, `Presentation` — DID +
attestation) is richer than NUT-10's key-set grammar (no resource/ability
vocabulary, no tiers). NUT-10's `tags` COULD carry capability-shaped data
(committed into the secret), but only a mint that understands them enforces
them — and unknown conditions degrade per sharp edge #1. Consequence: bPay
authority semantics ride NUT-10 tags only on a mint WE operate (the
self-hosted adapter), never on third-party mints. This is the adapter-ring
law arriving at the same conclusion from the protocol side.

**SpendReceipt: untouched by construction.** The receipt stays non-bearer,
hash-chained, private-by-default; proof secrets never appear in it. The
e-cash layer would occupy only the offline window BETWEEN metered sessions.

## 3 · NUT-24 × our x402 door — the crosswalk, honestly

| axis | our door (`ops/x402-door`, in-tree) | Cashu NUT-24 (spec) |
|---|---|---|
| trigger | HTTP 402 + offer (`payment_requirements`) | HTTP 402 + `X-Cashu` header (`creqA` NUT-18 / `creqB` NUT-26) |
| request fields | network (CAIP-2, R4-refused if malformed), EIP-3009-shaped authorization (`from, nonce, validBefore, value` exact / `maxAmount` upto) | `{a, u, m[], nut10?}` — amount, unit, accepted mints, optional token lock |
| payment instrument | signed EVM authorization, verified against payer VK | `cashuB` ecash token in `X-Cashu` on retry |
| verification | facilitator verify + `verify_payment` sig check; offer-hash idempotency | mint-list membership, unit match, amount ≥; token inherently single-use at melt/swap; NUT-12 DLEQ |
| failure law | fail-closed extraction naming the missing path; R4 no cross-chain correlation | HTTP 400; no expiry/retry semantics specified |
| abstraction home | `Door`/`VerifyOutcome`/`SettlementFacilitator` orchestrator traits | — (spec only) |

**Verdict: two rails sharing a status code.** The genuinely shared artifact
is the DOOR PATTERN (402 → priced request → retry-with-instrument → verify →
settle → receipt), which our door already implements for its rail — NUT-24
would be a second RAIL behind the same `Door` trait, not a change to the
first. One small idea worth having noticed: NUT-24's optional `nut10` field
(payer-lock at request time) parallels our payer binding — noted, nothing
imported.

## 4 · cdk-mintd as replaceable adapter — the placement

Verified placement constraints (all already our law, now with the protocol
facts behind them): Apache-2.0/MIT, ALPHA-labelled ("does however work with
real sats"), self-hostable; behind the adapter ring it is the ONLY
ring-compatible shape (third-party mints are third-party endpoints); and it
carries sharp edges #1/#2 that OUR wrapper would have to fail-close
(NUT-06 `"10"/"11": supported:true` required before any condition-carrying
token is minted; refund-tag required whenever locktime is used). The
`Door`/`FacilitatorSettle` seam in `ops/x402-door` is where such an adapter
would one day plug — declared here, built never (this cycle).

## 5 · Laws banked from the source read

1. **Condition declared ≠ condition enforced** — the enforcing mint's NUT-06
   declaration is ground truth; unsupported = anyone-can-spend.
2. **Locktime without refund = post-expiry anyone-can-spend** (NUT-11's own
   words) — always pair locktime with refund keys.
3. NUT-10 bounds are **per-Proof** and **redemption-time** — they can never
   substitute for issuance-time authority (that asymmetry IS the design).

## Landing receipt

Queue item #4 updated with this receipt + the findings table. Specs read at
`raw.githubusercontent.com/cashubtc/nuts/main/{10,11,24}.md`; our side at
in-tree `9d4ccd58`. §7 seat shape, four pre-push checks, pushed branch +
main. `sn_dbc` remains historical/reference per founder order. Eddies
dependency: zero.
