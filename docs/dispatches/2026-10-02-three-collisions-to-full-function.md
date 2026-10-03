# Three collisions: founder ruling, three lanes to full function

Seat: Claude (Seat 3), worktree `claude-LoVis/v0-46-release-verify-cda39f`.
Date: 2026-10-02.

## Ruling (founder, chat, verbatim)

> all three collisions need to be escelated to improved with full function

> also we/codex is upgrading our crypto stack to full PQ

The three collisions were filed earlier the same day in this seat's stack
assessment (Buzz, Autonomi, x0x). They stop being open escalations and become
three lanes. Each lane's target is full function, not a parked note.

## Lane 1 — Buzz identity is secp256k1; the stack is going post-quantum

Facts from source, 2026-10-02:

- block/buzz identity is NIP-01 secp256k1 with Schnorr signatures, read at
  upstream commit `8af2d91f` (`ARCHITECTURE.md:159-163`, `:413`;
  `crates/buzz-core/src/verification.rs:11` `verify_event`). No post-quantum issue, PR or
  code exists upstream (`gh search issues` and `gh search code` on block/buzz
  for post-quantum, ML-DSA, fips204: zero results).
- Nostr itself has an open PQ discussion only for NIP-44 encryption
  (nostr-protocol/nips #1971, open). Identity keys are untouched.
- Our PQ primitives already exist: `crates/bsigner/src/pq.rs` (ML-DSA, ML-KEM,
  host seed files) and the x0x owner key (ML-DSA-65).
- Ruled constraint that still binds: a free identity needs no authoritative
  store anywhere (`docs/bzdid-architecture-decision.md:390`: "No authoritative
  store must exist for a free identity to work"). A Buzz relay is
  an authoritative store, so a Buzz key may be a room identity but never the
  record of truth.

Owner: **Codex's full-PQ crypto lane.** This is not a separate lane and this
seat does not design the binding. Acceptance for full function, stated so the
reviewer can check it: a Buzz room identity is verifiably bound to a PQ root
held by the user, the binding is verifiable by a third party from the event
log alone, and losing the relay loses nothing about who the user is. Until
that lands, Buzz rooms are a coordination surface inside the perimeter, with
the record of truth on bzDiD, ANT and AR.

## Lane 2 — ANT upload is code-disabled

Fact: `ant 0.3.9 file upload` exposes no storage-price and no gas ceiling
(tag `ant-cli-v0.3.9` and `main`, `ant-cli/src/commands/data/file.rs`); only a
non-binding `file cost`. Hence the capability stop in
`2026-10-02-zblood-edition-v2-capability-stop.md`.

The library is not the blocker. Verified on WithAutonomi/ant-client main:

- `ant-core/src/data/client/file/native.rs:1912` `file_prepare_upload_with_mode`
  returns `PreparedUpload` with quotes before any payment; `:2171`
  `finalize_upload(prepared, &tx_hash_map)`; `:2356`
  `finalize_upload_merkle_multi`. Same three signatures `ops/ant-extsig/src/main.rs`
  already calls at `:59`, `:127`, `:130`.
- `evmlib/src/transaction_config.rs:10` `TransactionConfig { max_fee_per_gas:
  MaxFeePerGas }` with market-with-limit and custom-wei variants.
- `evmlib/src/external_signer.rs:65` `pay_for_quotes_calldata` builds calldata
  for exactly the quoted amounts.
- `ops/ant-extsig/Cargo.toml` pins `ant-node = "0.18.1"`, `ant-protocol =
  "2.3.5"`, `ant-core` as a git dependency. Current stable set: ant-node
  0.21.0, ant-protocol 3.1.0, ant-cli 0.3.9 (WithAutonomi org, all published
  2026-10-01). ant-cli is a binary, not a pin.

Owner: the seat that volunteered on 2026-10-02 authors in its own worktree.
This seat found the shape, so it reviews read-only against the exact head
and never presses. Acceptance for full function:

1. Re-pin ant-extsig to ant-node 0.21.0, ant-protocol 3.1.0 and a recorded
   ant-core commit; it builds and the LocalDevnet proof from 2026-09-04
   still passes.
2. Before entering either payment arm, meaning before any approval or
   payment transaction is signed: the sum of prepared quotes in atto-ANT
   must be at or below the 2.5 ANT ceiling, or the run refuses with the
   exact overage. A check that runs only before `finalize_*` is a receipt,
   because the payment is already irreversible by then.
3. Gas ceiling is an aggregate, not a unit price and not per transaction:
   the sum of `gas_limit × max_fee_per_gas` over every transaction of the
   upload (the approval and each payment batch) must be at or below
   0.0002 ETH, checked before the first one is signed, or the run refuses.
   This matches `tools/genealogy/bpay.mjs::reconcile` (`:286-288`), which
   compares the receipt's aggregate `gasUsedWei` against `maxGasETH`.
4. The estate client never holds the paying key (ant-extsig custody law).
5. Only after review does `tools/genealogy/preserve-service.mjs` re-enable
   `/api/preserve/upload`, and the first mainnet upload is a test artifact
   paid by the founder's wallet, not promoted.

## Lane 3 — Buzz was absent from the stack inventory

Done in this change. `scripts/build-stack-inventory.mjs` gains a `buzz` row
under Coordination, state `implemented`, source
`docs/agents/BUZZ-BOX-SRE-SEAT.md`, door `buzz-directory.html`. Its evidence
text cites upstream at a pinned commit: secp256k1 identity, no federation,
one community per relay URL by default with multi-community mode sharing one
Postgres keyed by `community_id`, an optional per-channel member cap and no
fixed room limit. Our own relay version and disk state are marked UNVERIFIED
until the host inspection runs. `surfaces/stack.html` is regenerated by the
script and `--check` passes. Component count moves from 20 to 21.

## Corrections, 2026-10-03 (review of PR #320)

Fixed forward after review; the earlier wording was this seat's error.

- **Community model.** "One Postgres per community" was wrong. Upstream's
  multi-community mode stores many communities in shared tables keyed by
  `community_id` (`ARCHITECTURE.md:564` at `8af2d91f`). Deleted from the
  inventory row and from this dispatch.
- **Identity citation.** The inventory row linked a seat charter as evidence
  for a cryptography claim. It now cites the upstream file and function at a
  pinned commit, and links this dispatch as its local source.
- **bzDiD citation.** `:245` pointed at an unrelated passage. The sentence is
  at `:390`.
- **Storage ceiling timing.** Acceptance point 2 said "before `finalize_*`".
  That is after payment. It now says before either payment arm.
- **Gas ceiling scope.** Acceptance point 3 said per transaction. The
  estate's own reconciliation is aggregate, so the criterion is now the sum
  across all transactions of the upload.
- **Box state.** The relay version and disk figures came from a 2026-09-18
  audit and are not re-measured; see `2026-10-02-box-ssh-banner-control.md`.

## Box inspection, pending

The read-only disk and container inspection of the Buzz box was refused to
this seat by its permission classifier (production read). A refusing,
read-only script is staged for the founder's hand:

```
wsl -e sh /mnt/c/Users/travi/buzz-box-inspect.sh
```

Cleaning and the relay upgrade are YELLOW and RED under the SRE addendum and
wait for those numbers.

## Not done, by law

No upstream message to block/buzz, WithAutonomi or saorsa-labs was sent. No
payment, upload, approval, restart or deletion occurred. x0x v0.46.0 is still
waiting on the `release` environment gate held by dirvine; builds passed,
signing has not run.
