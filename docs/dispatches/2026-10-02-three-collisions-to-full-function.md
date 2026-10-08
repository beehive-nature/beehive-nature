# Three collisions: founder ruling, three lanes to full function

Seat: Claude (Seat 3), worktree `claude-LoVis/v0-46-release-verify-cda39f`.
Date: 2026-10-02.

## Ruling (founder, chat, verbatim)

> all three collisions need to be escelated to improved with full function

> also we/codex is upgrading our crypto stack to full PQ

The three collisions were filed earlier the same day in this seat's stack
assessment, which covered Buzz, Autonomi and x0x. The collisions themselves
are: Buzz identity is classical while the stack goes post-quantum; ANT upload
is code-disabled; Buzz is absent from the stack inventory. x0x raised no
collision, so it has no lane here; its v0.46.0 release state is recorded at
the end. The three stop being open escalations and become three lanes. Each
lane's target is full function, not a parked note.

## Lane 1 — Buzz identity is secp256k1; the stack is going post-quantum

Facts from source, 2026-10-02:

- block/buzz identity is NIP-01 secp256k1 with Schnorr signatures, read at
  upstream commit `8af2d91f` (`ARCHITECTURE.md:159-163`, `:413`;
  `crates/buzz-core/src/verification.rs:11` `verify_event`).
- Upstream post-quantum work: a search of block/buzz issues and code for
  post-quantum, ML-DSA and fips204 returned nothing on 2026-10-02. That is a
  search result, not a source citation. Absence is UNVERIFIED.
- Nostr: nostr-protocol/nips #1971 is an open proposal about NIP-44
  encryption. Whether any accepted NIP changes identity keys is UNVERIFIED;
  the only cited fact is Buzz's own implementation above.
- Our PQ primitives, in tree: `crates/bsigner/src/pq.rs` `dsa_generate`
  (`:83`), `dsa_sign` (`:101`), `dsa_verify` (`:120`), `kem_generate`
  (`:161`), `kem_encapsulate` (`:182`), `kem_decapsulate` (`:210`), over
  host seed files.
- x0x owner identity, at tag `v0.46.0`: `src/identity.rs:107`
  `UserId::from_public_key(&MlDsaPublicKey)`; `README.md:18` names the
  owner key as `~/.x0x/user.key, ML-DSA-65`.
- Ruled constraint that still binds: a free identity needs no authoritative
  store anywhere (`docs/bzdid-architecture-decision.md:390`: "No authoritative
  store must exist for a free identity to work"). A Buzz relay is
  an authoritative store, so a Buzz key may be a room identity but never the
  record of truth.

Owner: **Codex's full-PQ crypto lane.** This is not a separate lane and this
seat does not design the binding. Acceptance for full function, stated so the
reviewer can check it:

1. A Buzz room identity is bound to a PQ root held by the user.
2. Every event, or an ordered checkpoint that covers every event, carries
   authentication under that PQ key. A one-time binding is not enough: once
   Schnorr forgery is practical, new events under the bound secp256k1 key
   are indistinguishable from real ones to anyone holding only the log.
3. A third party can verify points 1 and 2 from the event log alone.
4. Losing the relay loses nothing about who the user is.

Until
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
   must be at or below the storage ceiling read from the canonical gate,
   `ETERNALIZATION-EDITION-V2.json` `separatedCeilings.storageMaxAnt`, or
   the run refuses with the exact overage. That value is 100 ANT as of
   2026-10-03; 2.5 ANT was retired by founder ruling that day. The client
   reads the gate file; a hard-coded constant goes stale, as 2.5 did. A check that runs only before `finalize_*` is a receipt,
   because the payment is already irreversible by then.
3. Gas ceiling is an aggregate, not a unit price and not per transaction:
   the sum of `gas_limit × max_fee_per_gas` over every transaction of the
   upload (the approval and each payment batch) must be at or below the
   gate's `separatedCeilings.gasMaxEth` (0.0002 ETH), checked before the first one is signed, or the run refuses.
   The budget is plan-wide and persistent. A ledger reserves worst-case
   exposure for every signed attempt, including reverted, dropped, replaced
   and unknown-outcome transactions, and is consulted before every
   signature, not only the first. Exposure is never freed merely because a
   call failed. This failure mode is already on record in
   `docs/dispatches/2026-09-12-z2b-negative-review.md:37-52`.
   This matches `tools/genealogy/bpay.mjs::reconcile` (`:286-288`), which
   compares the receipt's aggregate `gasUsedWei` against `maxGasETH`.
4. The estate client never holds the paying key (ant-extsig custody law).
5. `/api/preserve/upload` in `tools/genealogy/preserve-service.mjs` stays
   disabled. That service reads `SECRET_KEY` in its own process (`:244`),
   which contradicts point 4, and the edition gate requires the upload to
   run repo+gh+CLI directly with no local-server bridge
   (`ETERNALIZATION-EDITION-V2.json:52`). Execution goes through the
   reviewed external-signer client. Founder spending approval is
   standing-granted under the gate (`:51`). Every gate stop condition must
   pass before the first signature (`:40`): tar sha256 mismatch, either
   ceiling exceeded, a chunk count other than the gate's, an artifact
   change, or a client version change. Two of those are already tripped:
   the artifact changed on 2026-10-03, and the re-pinned external-signer
   client is not the `ant 0.3.9` the gate's quote names. So the gate
   (`:52`) requires a rebuild and a fresh quote, and the gate file must be
   re-issued for the new client, before anything is signed. The one
   irreducible act is the key-holder's signature.

## Lane 3 — Buzz was absent from the stack inventory

Done in this change. `scripts/build-stack-inventory.mjs` gains a `buzz` row
under Coordination, state `implemented`, source
`docs/dispatches/2026-10-02-three-collisions-to-full-function.md` (this
file, which carries the pinned upstream citations), door `buzz-directory.html`. Its evidence
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

Second review round, same day:

- **Crypto claims.** Each Lane 1 assertion now cites a file and function, or
  is labelled UNVERIFIED. Two were search results presented as facts.
- **Storage ceiling value.** 2.5 ANT was in force when this dispatch was
  written and was retired by founder ruling a few hours later. The criterion
  now reads the canonical gate (100 ANT as of 2026-10-03) instead of a
  constant, so the next change does not strand it again.
- **Upload path.** Point 5 said the key-holding service endpoint would be
  re-enabled after review. That contradicted point 4 and the gate's
  no-local-server-bridge rule. The endpoint stays disabled.
- **Lane 3 source path.** The receipt still named the seat charter as the
  inventory row's source after the row had been changed.

Third review round, same day:

- **Stop conditions.** Point 5 had narrowed the gate to the hash and two
  ceilings. The gate also stops on chunk-count, artifact and client-version
  change, and two of those are already tripped.
- **Gas across retries.** A single pre-sign sum does not bound reruns. The
  criterion now requires a persistent plan-wide ledger, as the 2026-09-12
  negative review already demanded.
- **PQ authentication.** Lane 1's acceptance accepted a key binding alone.
  It now requires PQ authentication over every event or an ordered
  checkpoint of them.
- **Which three.** The opening named the assessment's subjects (Buzz,
  Autonomi, x0x) as if they were the collisions. x0x had none. The opening
  now lists the actual three.

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
