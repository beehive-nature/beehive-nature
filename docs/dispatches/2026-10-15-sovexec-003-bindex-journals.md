# 2026-10-15 · SOVEXEC-003 — b-index over BNROSE: the keyless, stranger-auditable read path over a BNRoSe state directory

Seat: Claude Code (Fable 5.1), the SOVEXEC-001 session continued. Order: the SOVEXEC-001 dispatch ranked "the b-index query path over BNROSE journal heads and receipts" third among phase-2 candidates and proposed it as its own lane; the founder chose to do it in this session ("Do this task here", 2026-10-15). Branch `claude-LoVis/sovexec-003-bindex-journals`, stacked on PR #448 (`3283d2032`, itself on main `bde1a9cc6`): this lane reads #448's dispatch and shares nothing else with it; the stack is for review order only.

## 0 · The question this crate answers

SPEC-BINDEXER-0 built `bindexer` for chain reads under three laws (keyless by construction, the two-oracle law at schema level, append-mostly honesty) and the SOVEXEC-001 map found it NOT connected to BNROSE execution: nobody could obtain a result about an executed operation whose origin, relevant state and verification status can be checked independently of the machine that served it. `crates/bindex-bnrose` is that read path. The question it answers, per entity, is: what do the supervisor's own durable records establish about this operation, and which of those facts can a stranger verify without trusting the indexer or the supervisor's host?

## 1 · Ownership, reconciled first

ZCode owns `crates/bnrose-exec-core`, `-wasm`, `-host` (`zcode/bnrose-*`). This crate changes none of them. It consumes their PUBLIC types read-only: `bnrose_exec_core::{op_id, env_sha, effect_digest, record_digest, step_op_id, transition, OpState, E_*, S_*}` and `bnrose_exec_host::receipt::{Receipt, state_word}` (`from_json`, `verify(pk)`, `to_json`). The tests drive `bnrose_exec_host::opexec::Supervisor` with fixture roots to generate REAL state directories, then index them keyless; the crate itself never names the root key file, never derives a key, never holds a MAC, never signs, enforced by the source scan in `tests/keyless.rs` exactly as `bindexer` enforces it.

Two things the crate had to do itself, each a named proposal to the owner rather than a fork around them:

1. **Frame parsing.** The owner's loaders (`journal::load`, `ledger::load`) take the MAC key and verify the chain as they read. A keyless reader cannot call them. `src/journal_read.rs` therefore re-parses the documented frames (`len u32 | body | tag 32`; the journal body `version u8 | seq u64 | op_id 32 | event u8 | payload_len u32 | payload`; the ledger body `version u8 | seq u64 | op_id 32 | env_sha 32 | effect_digest 32 | wall u64`) with the owner's own structural checks and KEEPS the tag as served. Proposal: export key-free `load_served` readers of the same bodies from the host crate, after which this file shrinks to the replica logic.
2. **A public chain head.** The receipt statement binds `journal_head`, which is the HMAC tag. A keyless verifier can check that the record at `seq_head - 1` carries that tag, but cannot recompute any tag. Proposal: bind the public `record_digest` chain head (the core already defines `record_digest`; its doc comment says "the receipt binds the head of these", which the host does not yet do) into a `bnrose-exec/receipt/2` statement. That closes the one gap the acceptance matrix pins (§4, the `limitation_*` row).

## 2 · The verification ladder, rung by rung, with what each can and cannot see

| rung | verified from | class |
|---|---|---|
| receipt signature | the handed receipt PUBLIC key (`bnrose-exec status` prints it as `receiptPublicKey`); nothing else | `receipt`, VERIFIED |
| operation identity: `op_id = SHA-256("bnrose-exec/op-id/1" ‖ authority ‖ env)`, `env_sha`, `effect_digest`; for a step entity `step_op_id(root, step)` | recomputed through `bnrose-exec-core` from the Admitted record's own bytes | `recomputed`, VERIFIED |
| WB001 binding: the envelope verifies under the authority the record names, and decodes through the SAW-proven decoder | `btungsten_wb001::{verify_envelope, decode}` (the public key is in the record) | `recomputed`, VERIFIED |
| the state machine: the entity's records replayed through `bnrose_exec_core::transition` with the relaxed clock the supervisor's own `recover` uses (clock 0, expiry max: transitions that already happened must reproduce) | the core, no keys | `recomputed`, VERIFIED |
| receipt ↔ replay: op, env_sha, state, recovered, fail and effect agree; `seq_head` covers the entity; the record at `seq_head - 1` carries the `journal_head` the receipt names | the two rungs above | `receipt`, VERIFIED |
| the journal's chain tags (HMAC-SHA256 under the supervisor's journal key) | not verifiable here, by construction | `served`, UNVERIFIED |
| the effect ledger row for the entity (its digest equals the recomputed effect digest) and its chain tag | the row body is served; the tag is the same HMAC class | `served`, UNVERIFIED |
| `included`, `executed`, `final` on any external system | no destination record is read | explicit `null` |

An entity is **attested** when the receipt verifies under the handed key, agrees with the replay on every bound field, covers the entity, and names the served head. Every other fact is reported with its class; an unverified fact is never dropped and never a refusal, it is a marked fact (the bindexer discipline: the reader sees the epistemic state of every number).

Consequence, stated so nobody reads more into an answer than it holds: a flipped byte in an Admitted envelope, a Dispatch digest or a Response verdict is CONVICTED keyless. A flipped byte in a payload the receipt does not bind (a Reserve reservation, a BoundedFail word) is INVISIBLE keyless and stays `served`; the supervisor's own loader catches it through the HMAC chain, the index cannot, and `tests/acceptance.rs` pins that fact under its own name.

## 3 · The index's own commitment, replicas, forks, freshness

- **`index_head`** = `SHA-256("bindex-bnrose/head/1" ‖ prev ‖ record_digest(seq, op, event, payload))` over the served records. It is THIS INDEX's commitment to what it read, never the supervisor's; it is stored per record and in `meta`, and every answer carries it.
- **Replicas.** Both journal replicas (`journal.bin`, `replica/journal.bin`) are read. Byte-identical → `agree`. One a strict prefix of the other → the common prefix is ingested and the lag is marked `prefix:…:lagging=<path>`. Any other difference → `diverge`: a `divergences` row is written (seq, both paths, both content digests) and the ingest refuses; nothing is merged. One replica unreadable → refused unless `allow_single_replica`, and then ingested with `single_replica = true`, which surfaces must render (SPEC-BINDEXER-0 §3's `single_source`, carried over). No replica readable → refused.
- **Forks.** A re-ingest recomputes the head over the prefix the store already holds; a different head is a fork: refused, recorded in `ingests` as `refused:fork`, the earlier consistent index left standing. A longer prefix-consistent journal extends the index. Re-ingesting the same bytes changes nothing.
- **Freshness.** Every answer carries `coveredThroughSeq`, `readAtUnix`, each replica's byte length at read, the agreement word, and the sentence "an index describes the journal as read at readAtUnix; the supervisor may have appended since". An index is stale by construction and says so.
- **Bounded queries.** `entity(id)`, `by_authority(authority, after_seq, limit)` with the page ceiling `MAX_LIMIT = 1000` and a `truncated` mark, `steps(root)`, and `status()`, which confesses counts (records, entities, attested, identity-or-binding failures, replay refusals, receipts verified/unverified, effect rows, divergences, ingests), the file's page stats, and the last twenty ingests with their outcomes. It never says "OK".
- **The deliverable is one sealed SQLite file** (WAL checkpointed at the end of every ingest) with its receipts in `meta`: `keyless`, `sendtx: NO permanently`, `chain_tags: served UNVERIFIED`, the receipt public key it was handed, the state directory it read.

## 4 · The acceptance matrix (`tests/acceptance.rs`; every row a named test that can go red)

| row | claim | how it can lose |
|---|---|---|
| `a_real_state_directory_indexes_keyless_and_every_entity_is_attested` | four supervisor-run operations index with every rung green; `included/executed/final` are null; chain tags unverified | any rung mislabeled |
| `a_recovered_operation_carries_the_recovered_class_and_still_attests` | a lost response recovered by the supervisor indexes as `recovered = true` and still attests | the replay or receipt disagrees |
| `a_receipt_that_does_not_verify_under_the_handed_key_is_marked_not_dropped` | a wrong key marks every receipt unverified; identity stays verified; nothing is dropped | a refusal or a silent pass |
| `teeth_a_flipped_admitted_envelope_byte_is_convicted_by_identity_recomputation` | identity and binding fail, the receipt mismatches on `envSha256`, the entity is not attested | the lie survives |
| `teeth_a_flipped_response_verdict_is_convicted_by_replay_against_the_receipt` | the core refuses the transition, the replay stops at Dispatched, the receipt mismatches on state | the lie survives |
| `teeth_a_dropped_last_record_leaves_the_receipt_unbound_and_the_entity_unattested` | `headBound` is null (seq_head past the served records), not attested | a missing record is read as a complete one |
| `teeth_a_dropped_middle_record_is_malformed_on_both_replicas_and_refuses` | a sequence gap is malformed on both replicas; the ingest refuses | a gap is ingested |
| `teeth_replica_divergence_is_refused_and_recorded_nothing_merged` | one flipped byte in one replica: refused, one `divergences` row, zero entities | a divergent replica is merged |
| `limitation_a_flipped_reservation_byte_is_invisible_keyless_until_a_public_chain_head_exists` | the gap, pinned: the entity still attests | the row flips when the owner binds a public head (then the crate gains the rung and this row is rewritten) |
| `a_single_readable_replica_is_refused_by_default_and_marked_when_allowed` | default refuses; the flag ingests marked | an unmarked single-source answer |
| `a_lagging_replica_yields_the_common_prefix_marked_as_prefix` | the common prefix is indexed, the lag named | a lag read as divergence or ignored |
| `re_ingest_is_idempotent_and_a_rewritten_prefix_is_a_fork` | same bytes, same head; a longer journal extends; a rewritten prefix refuses with `refused:fork` and the earlier index stands | a fork merged |
| `queries_are_bounded_and_every_answer_carries_coverage_and_freshness` | the page ceiling clamps, `truncated` and `afterSeq` work, every answer carries coverage, an unknown id is `found: false` with coverage | an unbounded or unmarked answer |
| `step_entities_index_under_their_root_and_answer_the_steps_query` | three step entities of one root index with recomputed `step_op_id`, verified bindings and completed replays | a step misattributed |
| `tests/keyless.rs` (2 rows) | no root-key, MAC, loader or signing vocabulary in `src/`; no MAC or signing crate in the manifest | anyone adds custody |

## 5 · Receipts

`cargo test -p bindex-bnrose --locked --no-fail-fast` in WSL (rustc 1.98.1, x86_64), 2026-10-15, after `cargo fmt`; the host crate and its pinned Wasmtime compiled from source for the tests (the state directories are generated by the real supervisor):

```
     Running tests/acceptance.rs (target/debug/deps/acceptance-60e66bdbbdd35984)
test limitation_a_flipped_reservation_byte_is_invisible_keyless_until_a_public_chain_head_exists ... ok
test a_lagging_replica_yields_the_common_prefix_marked_as_prefix ... ok
test a_single_readable_replica_is_refused_by_default_and_marked_when_allowed ... ok
test a_receipt_that_does_not_verify_under_the_handed_key_is_marked_not_dropped ... ok
test a_recovered_operation_carries_the_recovered_class_and_still_attests ... ok
test a_real_state_directory_indexes_keyless_and_every_entity_is_attested ... ok
test queries_are_bounded_and_every_answer_carries_coverage_and_freshness ... ok
test teeth_a_flipped_admitted_envelope_byte_is_convicted_by_identity_recomputation ... ok
test teeth_a_flipped_response_verdict_is_convicted_by_replay_against_the_receipt ... ok
test teeth_a_dropped_middle_record_is_malformed_on_both_replicas_and_refuses ... ok
test teeth_a_dropped_last_record_leaves_the_receipt_unbound_and_the_entity_unattested ... ok
test teeth_replica_divergence_is_refused_and_recorded_nothing_merged ... ok
test re_ingest_is_idempotent_and_a_rewritten_prefix_is_a_fork ... ok
test step_entities_index_under_their_root_and_answer_the_steps_query ... ok
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.28s
     Running tests/keyless.rs (target/debug/deps/keyless-dcc2d35b91cf7ab6)
test the_manifest_pulls_no_mac_or_signing_crate_directly ... ok
test no_root_key_mac_or_signing_vocabulary_in_this_crate ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
exit=0
```

`cargo fmt --all --check`: clean. `cargo clippy -p bindex-bnrose --all-targets`: no findings in this crate (the host crate's own seven warnings are the owner's and untouched). `Cargo.lock` delta: one package entry (`bindex-bnrose`; `rusqlite` was already locked through `bindexer`).

Two convictions of this seat during the build, kept as facts: the first step test asked the host to lose every step's response (its flag means "lose", not "succeed") and to run three steps in one call (the host runs one fresh step per invocation); and the first pass of the step view read the step byte raw where the journal packs `step | attempt << 4`. Both are fixed in the committed code and pinned by the step row.

The happy row also proves the index is read-only against the state directory: every file under it is byte-identical before and after an ingest, and the root key file is present there while the crate never names it.

## 6 · Boundaries not crossed, and what is not claimed

- Nothing in `bnrose-exec-*` changed; the two proposals in §1 are proposals.
- No destination record is read: `included`, `executed`, `final` stay null; the crate claims nothing about any external chain, and the cross-node law stands (a local record cannot prove an external system did not accept another independently signed transaction).
- No HTTP or push surface: SPEC-BINDEXER-0 §5 owes an SSE push surface before any websocket; that is a later beat, after this read path has its CI receipt.
- The chain tags are served and unverified, by construction; the index's own head is the index's commitment, not the supervisor's; neither is a proof of anything beyond "these are the bytes this index read".
- One supervisor's state directory per index; federation across supervisors (two receipts for one destination effect, the two-oracle law applied to execution) is not started.
- The fixture roots in the tests are deterministic and TESTNET-ONLY; nothing spends; nothing touches a network.

## 7 · Next owner

HUMAN INTERACTION: NONE for landing. Next beats, in order: (1) the two owner-side proposals (§1) on ZCode's open PR; (2) the SSE push surface over the sealed file, static-friendly, per SPEC-BINDEXER-0 §5; (3) a `bindexer` route table entry so the chain read path and this execution read path share one `status` vocabulary; (4) federation of two supervisors' receipts under the two-oracle law.
