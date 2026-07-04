# `crates/dro-signer` — design brief (Option 2)

Status: **design, not yet built.** This brief exists so the coding prompt
targets a *buildable slice*, not the whole firmware crypto layer by
accident.

## Role

The DRO (`bnature.dro`) is a non-custodial, automated escrow co-signer.
On an escrow state transition that moves funds — `Expired → Refunded`,
`Delivered/Timeout → Completed`, `Disputed → Refunded|Completed|Resolved`
— the DRO must cause the correct settlement transaction to exist, signed
with its own key, and broadcast it. Per the `sign_multisig_proposal`
refutation (see `zano-timelock-findings.md`), there is no stock RPC for
this: the DRO is a **full transaction constructor on the frozen
`messages-zano.proto` v0.3 coordinator path**, the same path buyer and
seller use.

## The reality constraint (why this is sliced)

Producing broadcastable Zano multisig bytes requires three things STATUS
lists as **not done / unread crypto**:
1. the tx-prefix serialization contract (byte-exactness + vector test),
2. `generate_CLSAG_GGX` signing (firmware-spec; the proto drives it but
   no host/device implementation exists),
3. Zarcanum BP+ (`bppe`) range proofs.

These are the firmware milestone. A single "emit the tx bytes" prompt
would demand all three and produce `todo!()` wearing a signer's name.
So `dro-signer` is cut at the honest seam.

## Scope — v1 (buildable now, pure logic + typed seam)

**In:**
- `SettlementIntent` — the deterministic decision: given an `Escrow` +
  the transition that fired, produce *what must happen* — refund to
  buyer / release to seller / split, with the exact `(amount, asset_id)`
  and destination(s). Pure function of escrow state; fully unit-testable;
  this is the DRO's actual decision authority and it is 100% buildable
  today.
- A `ZanoSigner` **trait** (the typed seam): takes a `SettlementIntent`
  plus the multisig context (`zano-watcher` supplies inputs/ring state)
  and returns signed tx bytes. v1 ships a `MockSigner` that records what
  it was asked to sign and returns a labelled placeholder — enough to
  drive and test the *orchestration* end-to-end without inventing crypto.
- Orchestration: wire an `EscrowEngine` verdict → `SettlementIntent` →
  `ZanoSigner`, and prove (test) that the right intent reaches the signer
  for every fund-moving transition, and that NON-fund transitions produce
  no intent.

**Out (gated on the firmware track, named explicitly so nobody fakes it):**
- Real CLSAG_GGX signing, BP+ proofs, tx-prefix serialization — these
  land as a `TrezorSigner` / `SoftwareSigner` implementing `ZanoSigner`,
  after the firmware crypto exists and is vector-tested. v1's trait
  boundary is exactly where they plug in.
- Broadcasting — trivial daemon RPC (`sendrawtransaction`), added with
  the first real signer, not before there are real bytes to send.

## Coordinator path (what a real `ZanoSigner` will drive)

The frozen proto sequence, per input:
`ZanoSignInit → ZanoSignInitAck → ZanoSignSetInput(+ring, blinded_asset_id
[1/8]) → ZanoSignSetInputAck(pseudo_out RAW) → ZanoSignSetOutput →
ZanoSignSetOutputAck → ZanoSignRangeProof(bppe) → …`. The 1/8-torsion
convention is pinned per field in the proto; a real signer honors it. The
DRO's Tier decides the signer: software key (Tier 1) or Trezor (Tier 2).

## Acceptance (v1)

`SettlementIntent` decision table unit-tested against every fund-moving
transition (and the non-moving ones producing none); `MockSigner`
orchestration test showing engine verdict → correct intent → signer;
clippy + fmt clean; CI green. No `todo!()` in shipped paths — the
unbuilt crypto lives behind the trait, not behind a panic.

## Non-goals

No `wallet2` C++ linkage. No dependence on the refuted RPC. No real key
material in v1. No broadcasting until there are real bytes.
