# chain-exsat-evm

The exSat EVM log adapter (C-1) — the kernel's third chain adapter, and its
first EVM one. It watches exSat EVM contract logs and turns recognized ones
into `CanonicalEvent`s on the existing bus.

**Status: the decoder works and is pinned to published vectors. The BNRi
signature table is placeholders, and against a real chain this adapter
currently indexes nothing.** That is the intended state, not a gap left by
accident — see below.

---

## VERIFIED

Claims backed by a cited source or an executable check in this crate.

| Claim | How it is verified |
|---|---|
| `topic0` = `keccak256("EventName(type1,type2,...)")` for non-anonymous events | Solidity ABI specification, "Events". Pinned by known-answer tests against **published** vectors: ERC-20 `Transfer(address,address,uint256)` → `0xddf252ad…3b3ef` and `Approval(address,address,uint256)` → `0x8c5be1e5…3b925`. `abi.rs` |
| Keccak256 is original-padding Keccak, not NIST SHA3-256 | Known-answer test: `keccak256("")` = `0xc5d24601…5a470`. `abi.rs`. The two differ; the test fails if the code reaches for `sha3::Sha3_256` |
| Indexed params occupy `topics[1..=3]`; ≤ 4 topics total | ABI spec rule; enforced by `AbiError::TooManyTopics` |
| Non-indexed params are 32-byte big-endian words in `data` | ABI spec; enforced by `AbiError::UnalignedData` + `ArityMismatch` |
| Indexed *dynamic* params store `keccak256` of the value, not the value | ABI spec. This decoder refuses dynamic types outright rather than pretend to recover them |
| Routing EVM logs through `normalizer::normalize()` would collapse distinct logs onto one `event_id` | Read from `crates/normalizer/src/lib.rs`: `event_id = {chain_slug}-{tx_id}-{action_name}`, and `RawChainAction` has no `log_index` field. Hence direct construction (the `sense-atproto` / `adapter-arweave` pattern) |
| Adding `EventPayload::Bnri` breaks no existing consumer | `EventPayload` is not `#[non_exhaustive]`, but every in-workspace consumer uses `let…else` / `if let`, and the two `match` sites (`sense-atproto/src/lib.rs:606`, `zano-watcher/examples/live_observe.rs:88`) both carry wildcard arms (`sense-atproto/src/lib.rs:608`, `zano-watcher/examples/live_observe.rs:90`). Grep-verified, then confirmed by a green workspace build |
| exSat mainnet chainId is 7200; gas is BTC | Project law (dispatch constant), pinned in `IndexerConfig::chain_id` and never inferred from an RPC URL. *Verifying it against `eth_chainId` is a **caller obligation**, not a claim this crate can back — see "Caller obligations"* |
| Reorg rollback drops orphaned blocks from `pending` | `reorg_drops_orphaned_logs_from_pending_rather_than_holding_them`. Verified to fail when the rollback is removed |
| The confirmation gate keeps a reorg from *reaching* an emitted block, at the configured depth | `reorg_of_depth_n_emits_no_contradictory_event`. Verified to fail when the gate is removed. It is not what *carries* "never contradicts itself" — the `ReorgBelowEmitted` halt is, and it is what holds at depth 0 where the gate does nothing |
| A refused `ReorgBelowEmitted` stays refused, and does not mutate the tracker | `a_refused_reorg_below_an_emitted_block_stays_refused_when_replayed`. Verified to fail both when the tracker is mutated before the check (the replay then answers `Ok`, and `confirmed_through` regresses 107 → 101 on a refusal) and when the halt is not latched (an ordinary next block walks the indexer out of it) |
| A held block re-delivered with divergent logs is refused, and an identical re-delivery is still a no-op | `a_held_block_re_delivered_with_different_logs_is_refused`, `..._with_a_contradicting_log_is_refused`, `..._identically_is_still_a_noop`. Verified to fail when the log comparison is removed |
| A **drained** block re-delivered with a log the drain would have emitted is refused, and one whose logs already emitted is still a no-op | `a_drained_block_re_delivered_with_a_log_it_did_not_carry_is_refused`, `a_drained_block_re_delivered_identically_is_still_a_noop`. Verified to fail when the drained-block check is removed (the re-delivered log is then silently dropped and `Ok` returned). Scoped to divergence *above* the cursor — the residue below it is stated under "Operational consequences", not claimed here |
| A resume starting above the cursor's block is refused | `a_resume_that_starts_above_the_cursor_block_is_refused`. Verified to fail when the check is removed (the indexer then indexes the competing branch and returns `Ok`) |
| The cursor is position-granular, not block-granular | `crash_mid_block_resumes_without_skipping_or_duplicating`. Verified to fail when the cursor is made block-granular |
| `drive` does not lose events it already emitted when it fails | `a_drive_that_fails_mid_stream_carries_out_the_events_it_already_emitted`, `a_drive_halted_by_the_indexer_also_carries_out_what_it_emitted`. Verified to fail when `DriveError` is built without the local event buffer |

## UNVERIFIED

Everything this crate does **not** know. Each item is marked in the code too.

| Item | Why it cannot be verified today | What would settle it |
|---|---|---|
| **The BNRi event signatures** | **No BNRi contract exists** — no Solidity source, no ABI JSON, no deployment record anywhere in this tree. The ten event *names* are founder-settled; the signature *strings* are not knowable | The real BNRi ABI. Replace each `signature` in `BNRI_GENESIS_V0_UNVERIFIED` and flip its mark to `Verification::Verified { source }` citing contract file + event declaration at a pinned commit |
| **`confirmation_depth`** | An N-1 measurement item on a Savanna-finality chain. This crate ships **no default** and makes no claim about what is safe | Measured fork depths against a real endpoint, plus the finality rule as implemented |
| exSat **testnet** chainId | Reported variously as 839999 and 840000. This crate deliberately ships **neither** as a constant | `eth_chainId` against the actual testnet endpoint |
| Whether exSat's RPC implements `removed`, `logIndex`, `blockHash` per the Ethereum JSON-RPC spec | No verified endpoint was contacted; tests are fixtures-only by requirement | Observation against a real endpoint |
| That parent-hash linkage is sufficient to detect every exSat reorg | The linkage rule is checked here; exSat's actual reorg behaviour is not observed | N-1 measurement |

**Audited is not proven.** The ceiling for anything here is *sound by
construction / isolated by design*.

---

## Caller obligations

Things this crate needs, states plainly, and **cannot enforce**. They are not
fail-closed properties — nothing here blocks if you skip them.

| Obligation | Why the crate cannot do it for you |
|---|---|
| **Call `IndexerConfig::verify_observed_chain_id(observed)` against the endpoint's `eth_chainId` before feeding the first block, and refuse the endpoint on `Err`** | This crate ships no RPC `LogSource`, so no code path in it can obtain an observed chain id — blocks arrive via `observe_block` already stripped of endpoint identity. `chain_id` is inert config after construction; the only in-tree callers of the check are its own unit tests. A mismatch is fail-closed **when checked**, and unnoticed when not |
| **Restart a resuming feed at `resume_block()`, or below it — never above** | Partially enforced: a first-observation-after-resume *above* the cursor's block is refused (`ResumeAboveCursor`), because the cursor's block-hash guard can only fire at exactly that height. Starting below is fine and is the ordinary backfill path. What is *not* checked is history below the cursor's block |
| **Publish `DriveError::emitted` when `drive` returns `Err`** | `drain_confirmed` commits the cursor as it emits, so events emitted earlier in a failed `drive` call are already past the cursor and no retry produces them again. The type carries them out; only the caller can put them on the bus |

---

## Why the signature table is placeholders

The honest line runs between two halves:

- **`abi.rs` is verifiable.** EVM log layout is frozen by spec and pinned by
  published vectors. It does not change when the BNRi ABI lands.
- **`signatures.rs` is not.** It is declarative data: signature string →
  `EventType`.

Every genesis entry is a visibly-fake `PLACEHOLDER_*` name marked
`Verification::Unverified`. Two layers, and they are not equal:

1. **What enforces default-deny:** `SignatureTable::new` **refuses** unverified
   entries unless the caller sets `allow_unverified_signatures`. Production
   config leaves it off, so placeholder-derived events cannot reach the bus.
   The test suite opts in to exercise the machinery. This is code, and tested.
2. **What the names buy:** a `PLACEHOLDER_` signature hashes to a topic0 that
   no contract *we know of* emits, so against a live chain the table is
   unlikely to match anything by accident. This is legibility, not a guarantee
   — `PLACEHOLDER_InscriptionMinted` is a legal Solidity event identifier and
   nothing stops a contract emitting it. Default-deny does not rest on it.

A plausible-looking invented signature — `InscriptionMinted(address,uint256)` —
would be indistinguishable from a real one to the next reader. That is exactly
how an invented ABI gets mistaken for a real one, and it is what these
placeholders exist to prevent.

## Identity and idempotency

Idempotency key: `(block_number, tx_hash, log_index)`.

- `event_id`  = `exsatevm-{block_number}-{tx_hash}-{log_index}`
- `source_ref` = `{block_number}:{tx_hash}#{log_index}`

`source_ref` merges two in-tree precedents: the `{block}:{tx}` shape from
`normalizer::normalize()`, and the `#`-fragment disambiguator from
`sense-atproto`'s `at://<did>/<collection>/<rkey>#<cid>`. There the fragment
pins *which version* of a record; here it pins *which log* of a transaction.

## Fail-closed properties

Each of these is enforced by `observe_block` / `drain_confirmed` and has a test
that fails without it. (The chain-id check is *not* in this list — it is real,
but it is a caller obligation; see above. Mixing the two would make this list
unreadable as a ledger, which is the one thing it is for.)

- Ambiguous reorg (no common ancestor in the retained window) → **blocked**.
- Fork below an already-emitted block → **blocked** (`ReorgBelowEmitted`), and
  **latched**: the indexer halts and stays halted, because a refusal a retry
  can flip to `Ok` is not a refusal. The bus has no retraction; there is no
  sound continuation. This is the halt that carries "never contradicts itself"
  — `confirmation_depth` is what makes it *rare*, not what makes it hold (at
  depth 0, an accepted config, logs emit at the tip and it is all there is).
- Block hash changed under a persisted cursor → **blocked**.
- Resume starting above the cursor's block → **blocked** (`ResumeAboveCursor`).
  The hash guard above can only fire at the cursor's block; a feed that starts
  past it would skip the check and index onward from an unverified branch.
- A **held** block re-delivered with a different log set → **blocked**
  (`DuplicateBlockLogsDiffer`). The chain tracker compares hash and parent hash
  only and never sees logs, so "identical re-delivery" is a claim about the
  `BlockRef` alone; accepting a divergent one would silently drop a log set.
- An **already-drained** block re-delivered carrying a log the drain would have
  emitted — past the cursor, allowlisted address, known `topic0` — → **blocked**
  (`DrainedBlockLogWouldHaveEmitted`). The block drained, so such a log was not
  there at the time: it would have emitted or halted the drain, and neither
  happened. **Scoped, and the scope is the point:** this covers divergence
  *ahead of* the cursor only. A divergent log at or behind the cursor is not
  covered — see "Operational consequences".
- Recognized event, payload that does not fit its signature → **halt**, not
  skip. `drain_confirmed` is atomic: it emits nothing and moves the cursor
  nowhere. See "Operational consequences" — this one has teeth.
- Corrupt cursor → error, never a silently-fresh cursor (which would re-emit
  history).
- Source error → propagates. It **never** reads as "done" — that is how a
  transport failure would otherwise become a green light.
- A log flagged `removed` → refused. Reorg truth comes from parent-hash
  linkage this crate checks itself, not from an unverifiable transport claim.

## Operational consequences

Fail-closed is a choice with a bill attached. Paying it knowingly is the point;
being surprised by it at 3am is not. Two halts here are unrecoverable in-process
and will page someone:

- **One undecodable log wedges the indexer permanently.** `drain_confirmed` is
  atomic, and the offending log stays in `pending`, so every later call
  re-attempts it and fails identically. The indexer makes no further progress —
  not for that log, not for any log behind it — until the signature table is
  fixed and the process restarted. That is deliberate: a recognized event whose
  payload does not fit its signature means the table disagrees with the chain,
  which is a bug to fix, not a log to skip. But it is a **halt**, and a halt
  stops the pipeline.
- **`ReorgBelowEmitted` halts that `Indexer` for good.** It latches; no retry
  and no later block clears it. Recovery is an operator decision (what to do
  about events that already crossed the bus from a branch that no longer
  exists), and this adapter deliberately does not make it for you.

Both are the fail-closed doctrine working as designed. Neither degrades to
"proceed anyway", and that is exactly why they cost what they cost.

### One limit that is not a halt

The two above are refusals with a bill. This one is the opposite shape — a
silent drop — and it is the residue of a guard that is real but partial:

- **A divergent re-delivery of an already-drained block is only detected above
  the cursor.** `DrainedBlockLogWouldHaveEmitted` catches a re-delivered log
  that is past the cursor, allowlisted, and known to the table: the block
  drained without it, so it was not there. A divergent log at a position **at or
  behind** the cursor is not caught, and it is *not* harmless. The cursor is a
  single `(block, log_index)` position advanced by whatever emitted last, so a
  later block's emission leaves the cursor sitting ahead of an earlier block's
  never-emitted positions: a lagging per-address `eth_getLogs` filter that
  re-delivers that earlier block with a log the first delivery lacked has that
  log silently dropped, and no event reaches the bus for it.

  Why it is not cured: detecting it means comparing against what the block
  carried when it drained, and this adapter retains nothing for drained blocks
  — `pending` holds a block's logs only until it confirms. Closing the residue
  means retaining every drained block's log set (or a digest of it) for the
  whole `retain_blocks` window, moving the retained-log footprint from
  *confirmation_depth*-many blocks to *retain_blocks*-many. That is a real,
  bounded cost, and taking it is a design decision with a founder gate on it —
  **not one this crate takes silently**. It is stated here instead.

## Dependencies

No `alloy`, no `ethers` — following the `chain-eos` hand-rolled-codec
precedent. EVM log decoding is a small frozen slice of spec; those crates are
full node-interaction stacks and would import a **signing surface into a
read-only indexer**. Keccak256 comes from `sha3` (already a workspace
dependency).

## `b` boundary

BNRi is an EVM-layer artifact. `b` is the kernel's earned-only metabolic
energy, accounted kernel-side (SPIRIT-1) — never an EVM token, never bridged,
never gas. Gas on exSat is BTC. Nothing in this crate touches `b`, and the
adapter holds no keys and signs nothing.

## Testing

Fixtures only; never a live RPC. `cargo test -p chain-exsat-evm`.

The real RPC `LogSource` is a named trait seam, not a `todo!()` — there is no
verified endpoint to write one against. Backfill and live subscription are the
same state machine behind that trait, which is why a backfill that catches up
and becomes a live feed needs no handoff.
