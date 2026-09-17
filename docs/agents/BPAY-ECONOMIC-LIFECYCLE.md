# SPEC BPAY-LIFECYCLE-1 — the general bPay economic artifact model

**Born 2026-09-17 by founder routing**: this seat (zCode) is the
**bPay / bMeter / POS / Wallet economic-systems seat**, WAIT on exactly two
triggers (Gesture D next lawful pass; VV-1 builder GREEN → this seat
verifies). The frontier: the GENERAL economic primitive — not a
vending-machine behavior, not a genealogy payment hack — with zGenealogy as
its first demanding consumer:

> `62.1 MB family archive → ANT quote → invoice → Trezor authorization →
> Autonomi settlement → receipt → retrieval/hash reconciliation`

**The lifecycle and its distinctions** (founder law, verbatim substance):

```
QUOTE   — current offer/rates (mutable, fresh, may expire)
  ↓ customer opens a transaction
PRICING COMMITMENT — immutable open-time economic promise
  ↓ derived from the applicable commitment
INVOICE — what is owed/authorized and WHY
  ↓ bounded permission to satisfy it
AUTHORIZATION — bounded authority to spend
  ↓ what the selected rail actually executes
SETTLEMENT — rail execution/result
  ↓ immutable evidence of what actually happened
RECEIPT — evidence of what actually settled
  ↓ did economic reality satisfy the committed obligation?
RECONCILIATION — verdict incl. actual fees/refunds/failures/finality
```

**Boundary law** (VV-1, frozen @59b02491, reused NOT reopened):
> Governance may change tomorrow's offer. It cannot change yesterday's
> promise.

The QUOTE→COMMITMENT transition is exactly the frozen `PricingCommitment`
law: self-sufficient, immutable, snapshot-executed; the invoice is DERIVED
FROM the commitment, never from today's table. This spec consumes that law;
it does not modify the VV-1 oracle, the vending contract, or its builder
lane.

**Accounting separation law** — these are DISTINCT books, never collapsed:

| book | exists today | where | missing |
|---|---|---|---|
| provider expense | cited only (`cost_basis_ref`, posted-USD refs) | `scripts/buzz-meter/meter.py:99-150` | not BOOKED as a field on any event |
| customer charge | line items + computed total (never stored) | `meter.py:112-139`, `scripts/buzz-meter/voucher_escrow.py:294-300` | — |
| tithe calculated | per-line at charge | `voucher_escrow.py:294-300`, `crates/voucher-escrow/src/lib.rs:463-469` | — |
| tithe accrued | tithebook (computed, never typed) | `meter.py:685-700` | — |
| tithe settled | — (founder-word-only movement, `voucher_escrow.py:61`) | — | the WHOLE book: no payout event type |
| network fees actual | `FeeEvidence::Paid` vs `AbsentBounded` (absent≠zero) | bpay-rail `units.rs:27-43` (branch); `chain_fee` enum'd but unused (`voucher_escrow.py:66-70`) | booking into meter events |
| retries / failure charges | AV-6a ceiling (door branch; IF-4 = unreachable at seam) | `ops/x402-door` tests | trustworthy monetary failure-fee evidence (AV-6b specified-only) |
| refunds / credits | — | — | no event type exists (DEPOSIT/CHARGE only) |
| conversion | explicit `rate_a_per_usdc` + `rate_ref` on deposit | `voucher_escrow.py:223-257` | pricing-side conversion ref (`a_conversion_reference` null) |

**Two-representation law**: every artifact carries a friendly POS/wallet
rendering AND a cypherpunk evidence depth (hashes, chains, signed bytes) —
layered disclosure, no consumer forced to expose all depth. Existing shapes
to compose: voucher view (`meter.py:893-950`) vs hash-chain verification
(`test_voucher_escrow.py:75-117`); spend-audit recomputed bills
(`surfaces/spend-audit.js:250-340`); BOLT-11/12 decode card
(`surfaces/wallet.html:1982-2110`).

---

## The reconciliation map — what EXISTS, per stage (main @22af64fb unless noted)

| stage | verdict | strongest existing primitives | the gap this spec owns |
|---|---|---|---|
| QUOTE | **strong, fragmented** | QuotingDesk + Quote (price pinned at birth, single-use, ttl 600s) `scripts/buzz-meter/x402_meter.py:144-193`; AV-2 freshness law `rate_set_in_force` TTL 300s wired through serve `/v1/pricing/admit` + gate admission (DEPLOYED, AV-2=D, ASSURANCE-LEDGER); `PinnedOffer` canonical bytes + pre-sig gate on bpay-rail branch (`x402.rs:49-125`, no TTL field); human quote views (`vending.html:226-238,442-461`, `wallet.html:705,782-783`); `PLAN_TTL` 600s single-use redeem `crates/banchor/src/approval.rs:117` | one quote vocabulary spanning rails; TTL laws unified (600 desk / 300 gate / 86400 lane-stale are three regimes) |
| PRICING COMMITMENT | **fragments, unnamed as one thing** | buzz-meter Quote consumed single-use = de-facto commitment (TermsMismatch + ceiling clamp + nonce=quote_id `voucher_escrow.py:339-347`); watchpay `ValidatedPlan.sealed_hash` + `approve_ceiling` (immutable ceiling at validation, `crates/watchpay/src/plan.rs:31-109`); bpay-rail `manifest_snapshots` (exact manifest preserved at authz, `capability.rs:307-313`); VV-1 `PricingCommitment` law FROZEN (builder pending) | the generic commitment object: rate + basis + unit semantics + tithe_bp + deterministic hash, self-sufficient across persistence — VV-1's law generalized off-chain |
| INVOICE | **ABSENT** | zero invoice structs on main (grep verdict: prose + a BOLT-11 decoder for OTHERS' invoices only); nearest = post-charge receipt line items (`meter.py:99-150`), mock-minted `LnInvoice` (bpay-rail branch, not derived from authz) | the WHOLE stage: an issued, durable, commitment-derived statement of owed-and-why; distinct from receipt |
| AUTHORIZATION | **deep but fenced** | bpay-rail R19 `SignedAuthorization` + `LegBinding` + journal (branch, writer re-frozen: F1 domain tag + F2 canonicalization + R20 durability + parent-scope DG); wallet spend-cap `capAssert` (`wallet.html:4283-4355`); vending plan approve; EIP-3009 payer auth static-call PASS (Gesture D, live-verified once) | NOT the signing machinery (owned). The economic boundary: invoice→bounded-authority DERIVATION contract — what an authorization must reference to be "for" a committed obligation |
| SETTLEMENT | **pockets, three vocabularies** | voucher engine charge/`settle_upto` (idempotency, refuse-before-write, restart-surviving `voucher_escrow.py:271-409`); bpay-rail `RailLedger` Intent/Staged/InFlight/Settled/Failed/Unknown + LN pay/reconcile/pay_upto (branch); watchpay EVM receipt validation + file-backed attempt journal (`crates/watchpay/src/{receipt,ledger}.rs`); funding rails chainpoll/basepoll (`meter.py` chainpoll/basepoll, `cmd_charge` :630) | shared settlement-OUTCOME vocabulary across the three ledgers (map, not merge — each keeps its states; the RECEIPT speaks one language) |
| RECEIPT | **strongest artifact family** | hash-chained voucher ledger + Rust conformance core (`crates/voucher-escrow/src/lib.rs`, live-ledger fixture, verify-from-stored-bytes); `build_receipt` line items + tithe line + provenance chain (`meter.py:84-190`); `SyntheticReceipt` + fee evidence (`watchpay/src/receipt.rs`); lexicon `dockets/lexicon/com.beehivenature.receipt.json`; human: voucher itemized, spend-audit recomputed bills, meter's own receipt (`x402-meter.js:222-313`) | the accounting books above (provider expense, tithe settled, refunds); receipt family unified under the lifecycle |
| RECONCILIATION | **deep, per-seam** | 4-state audit `arithmetic_fraud/tithe_mismatch/over_capture/over_max/backdated` (`x402_meter.py:307-376`); AV-3 park/resume-no-backfill (D) + AV-5 reorg flag-not-credit + AV-6a (branch `test_av*.py`, on main); bpay-rail `reconcile_with_evidence` + HumanGate (branch); live-vs-embedded chain compare (`x402-meter.js:236-239`) | the CLOSURE predicate: one check that commitment→invoice→authz→settlement→receipt all agree — "did economic reality satisfy the committed obligation" as a first-class verdict |

## Collision fences (checked 2026-09-17, all standing)

- **bpay-rail branch (`codex/z2b-bpay-rail`, R20 chartered)** — signed
  authorization, rail ledger, journal durability: ANOTHER SEAT'S, fenced.
  This spec composes WITH `SignedAuthorization` (an economic authorization
  references an invoice/commitment; the signing machinery stays theirs).
- **AV world + ASSURANCE-LEDGER + door + IF-1..IF-4** (`docs/agents/`
  on main; door + IF queue on `zcode/gesture-d-disposition-2026-09-17`) —
  standing note verbatim: *none of IF-1..IF-4 authorizes implementation*.
  Not touched.
- **VV-1 frozen lane** (`zcode/vv1-vending-pricing-2026-09-16` @59b02491+)
  — law reused, oracle untouched, Jungle4 untouched, VV-2 unopened.
- **zArcheology VV-2..VV-6** (`docs/agents/ADVERSARIAL-VENDING-SPECS.md`
  @a0f8de3b on main) — their roll re-scopes only after builder GREEN.
- **zGenealogy** — CONSUMER. This seat produces generic primitives; the
  archive lane owns preservation-specific invoice/receipt CONTENT and
  Autonomi/Trezor/retrieval evidence.
- **⚠ discovered naming overlap, flagged for the merge**: TWO VV rolls exist
  — this seat's `VV-SPECS.md` (unmerged branch; VV-1 = the frozen
  founder-ruled battery) and zArcheology's `ADVERSARIAL-VENDING-SPECS.md`
  (on main; VV-1..VV-6 spec roll, overlapping VV-1 content, no battery).
  Both are honest parallel lanes; the VV-n ID space needs reconciliation at
  merge time (prefix or renumber) so builder GREEN maps to exactly one
  VV-1. Flagged here, resolved by neither seat unilaterally.

## The next smallest builds (queue — specified, NOT implemented)

1. **INVOICE-1** — ✅ CLAIMED 2026-09-17, RED-first battery landed (§INVOICE-1
   below); builder lane pending.
2. **VOCAB-1**: the settlement-outcome crosswalk (voucher/RailLedger/
   watchpay states → one receipt vocabulary) — a table artifact first.
3. **RECON-1**: the closure predicate spec — the reconciliation verdict as
   a pure function over (commitment, invoice, authorization, receipt,
   fee/refund evidence); red-first battery against existing engines.

Each is a bounded order in the ATTACK→RULE→FREEZE→CLAIM→BUILD→VERIFY→
ADVANCE shape when claimed.

---

## INVOICE-1 — the reconciliation with the zGenealogy reference + the red-first law

**Founder order (2026-09-17)**: reconcile the reference implementation at
`lane/zcode-lineage-import` @`68fdae20` (`tools/genealogy/bpay.mjs`, the
`skaists.bpay-invoice/1` artifact) BEFORE implementing; zGenealogy = first
reference consumer, NEVER canonical generic law; do not refactor it. Battery:
`scripts/inv1-bpay-invoice.mjs` (CI-wired), attacking the reference VENDORED
BYTE-EXACT (`fixtures/inv1/bpay-reference.mjs` +
`fixtures/inv1/invoice-real.json`, sha-pinned — drift fails hard). If the
lane's originals change, the pin forces re-reconciliation.

### The five identifications

**1. Fields/invariants that belong in generic bPay INVOICE-1** — everything
the reference PROVES transportable (acquitted green in the battery):
per-asset line items with independent bounds ("never one dollar figure" as
structure: INV-1.2); receipt-from-evidence-only, no code path mints a
receipt from an invoice (INV-1.3, the measured-states law as code);
versioned schema id; identity bound to the underlying priced job;
issuer-provenance incl. keyless quoting; buyer role WITHOUT a paying
address (privacy law); measured-states labels inside the artifact
(quote ≠ purchased; settlement not-yet; token-native units, no fiat fields:
INV-1.6); declared persistence law + expiration model; embedded ceiling +
authorizedBy + stopConditions; conflation-refusing validators;
reconcile-as-comparison (never assumes equality).

**2. Fields that remain genealogy/Autonomi-specific** (stay in zGenealogy;
the generic object carries them as an opaque domain-extension block):
ARCHIVE_CONTEXT (edition/manifest/files/tar details), `data_map_address`,
the Autonomi payment vault + `payForQuotes` + ERC-20 approve wallet
actions, Trezor custody + ERC-7730 Clear-Signing assessment (UNVERIFIED
stays labeled), chunk counts / `already_stored`, the job-bound expiration
semantics (`upload_id`), the specific stop-condition texts, and
`planDigest`'s exact inputs (the per-chunk Autonomi quote-hash list — the
SHAPE is generic: a digest over the priced plan; the inputs are domain).

**3. Binding an immutable PricingCommitment WITHOUT duplicating R20** —
separation of authority from economics. The invoice binds ECONOMICS by
value + content digest (VV-1's self-sufficiency law: verifiable with the
rate table thrown away); R20 binds AUTHORITY by signature (capability
manifests, LegBinding, domain tags — untouched, their lane). The reference
is one-way: an authorization NAMES its invoice (scope ⊇ invoice id +
ceilings); the invoice never signs anything, never carries permissions,
never mentions rail capabilities. Invoice immutability comes from
content-addressing, not cryptography — an invoice that needs a signature
to be believed has failed content-addressing; an authorization that cannot
name its invoice is unbound. No LegBinding/BIP-340/domain-tag work here.

**4. Referencing multiple assets/ceilings without a misleading aggregate** —
one priced asset per line item; every ceiling per-asset per-line; NO
cross-asset total field in the canonical object; aggregates only within
one (asset, unit); fiat-reference fields forbidden in token-native
artifacts; display layers may render convenience figures but they NEVER
enter canonical bytes or digests. The reference ACQUITTED this law
(ANT storage line + ETH gas line, separate bounds — INV-1.2 green, the
battery's aggregate/unit detectors enforcing it structurally).

**5. The persistence/restart invariant — "yesterday's invoice still means
yesterday's promise"** — three legs: (a) content-addressed identity:
canonical serialization + self-digest over the bytes INCLUDING the
commitment digest, so re-derivation from different content yields a
DIFFERENT identity — detected as a new invoice, never silently "the same
one"; (b) offline verifiability: the commitment (quote set or pricing
inputs) carried in the artifact or durably content-addressed beyond the
issuing machine, so reopen-verify works without the machine or any live
table; (c) evidenced terminality: issued/settled/void each carry evidence,
each irreversible across restart — void→settled is conflation. The
reference's P1 recovery proof (24/24 identical quote hashes across bridge
death, persisted plan swapped in, fresh quotes discarded) proves the
BRIDGE-MACHINE leg; legs (a)-(c) are the generic advance.

### Battery verdict @ pin (2026-09-17) — 3 registered reds, 4 greens

| probe | law | verdict |
|---|---|---|
| INV-1.1 | commitment retrievability — owed figure verifiable offline | **RED** — amount tampered WITHIN the ceiling and a fabricated plan digest both pass validateInvoice; the artifact carries neither the 24 quote hashes nor pricing inputs — the commitment's evidence lives only in the issuing bridge's local, never-committed job state |
| INV-1.2 | multi-asset separation, no misleading aggregate | GREEN (reference acquitted) |
| INV-1.3 | receipt-from-evidence-only | GREEN (reference acquitted) |
| INV-1.4 | void path = evidenced terminal | **RED** — state:"void" passes unchecked; a voided invoice resurrects to settled with a fabricated receipt id; no void evidence class, while the UI really voids plans via /v1/upload/abandon — document layer disagrees with operational layer |
| INV-1.5 | canonical content-addressed identity | **RED** — same invoiceId across different bytes (issuedAt varies); no canonical serialization, no self-digest; ADDITIVE charter: keep the job-bound id (P1 proof stands on it), ADD content digest |
| INV-1.6 | measured-states labeling, token-native | GREEN (reference acquitted) |
| INV-1.7 | negative control — aggregate smuggler / weakened validator / id-reuser all convicted; reference acquitted | GREEN (oracle calibrated) |

Charters bind the generic INVOICE-1 builder lane (see battery LEDGER).
Battery failure paths (pin drift / unregistered red / stale row) drilled
with named causes before landing.

### Builder closure (2026-09-17, zCode builder lane — GREEN, awaiting the economic seat's independent verification)

The three charters are closed by a GENERIC implementation,
`scripts/lib/bpay-invoice-generic.mjs` (schema `bpay.invoice-generic/1`),
proven by `scripts/inv1-generic-builder.mjs` (CI-wired beside the frozen
battery, which runs BYTE-UNCHANGED — its registered reds remain the record of
the reference's gaps; closure is proven on the generic side, never by
touching the oracle). 9/9 proofs:

- **INV-1.1** — the quote set is CARRIED in the canonical bytes
  (`line.quotes[]`); the owed figure is DERIVED as Σ quotes at build and
  re-derived at validation; `commitment.digest` re-derives from the carried
  set (the planDigest SHAPE with generic inputs). Attacks: amount tampered
  within the ceiling → refused; the same tamper WITH the content digest
  recomputed (canonical integrity green) → refused by the Σ-law
  (`owed ≠ Σ carried quotes`); fabricated commitment digest → refused.
  VV-1 self-sufficiency held live: a fresh child process validates the
  persisted artifact against its durable digest while today's rates file is
  mutated underneath — no pricing state is consulted.
- **INV-1.4** — void is an evidenced terminal: bare `state:"void"` refused;
  `voidEvidence {kind:"abandon"|"superseded", ref, at}` required;
  supersession stays LAWFUL (`successorJobId` named; the successor carries
  `identity.priorDigest`). Resurrection: state-flip keeping evidence →
  refused (evidence-conflict law); a stripped re-forge (evidence removed,
  digest recomputed) passes ONLY unanchored and is REFUSED against
  `validateGenericInvoice(doc, {expectedDigest})` — the which/who separation
  exactly: content identity proves WHICH invoice; authority/anchoring proves
  WHO stands behind it (signature binding stays R20's lane — this module
  contains no signing primitives, asserted structurally).
- **INV-1.5** — canonical serialization is deterministic (recursive
  lexicographic keys, no whitespace, monetary fields string-only);
  `identity.contentDigest` covers the whole document minus itself
  (contradiction-free), INCLUDING the commitment; ADDITIVE charter held:
  `identity.jobId` + `invoiceId` stay job-bound for routing/recovery, and
  wherever bytes differ the content identity differs.

Lifecycle transitions are explicit version-producing operations
(`voidGenericInvoice` / `settleGenericInvoice`) carrying `priorDigest`
lineage — append-only correction, never in-place mutation.

### Standing fences (unchanged)

zGenealogy not refactored (vendored copies only); bpay-rail/R20 untouched;
**quote TTLs observed, NOT normalized** — the three regimes (600s desk /
300s gate / 86400s lane) are three regimes, difference is not defect; IF-1..IF-4
not implemented; VV-2 not opened; Jungle4 untouched.
