# READER NOTES: BNRoSe (BNR's sovereign Rust execution environment)

Reader seat, read-only. Tree: `C:/Users/travi/beehive-nature/.claude/worktrees/pq-buzz-upgrade-0948b3` at `69ef2c717` (= origin/main at read time, 2026-10-16T02:04Z). All paths below are repo-relative unless absolute. I did not design anything.

Labels: **RULED** = founder or governing text. **MEASURED** = a receipt with real output. **SOURCE** = seen directly in code at `69ef2c717` (no run by me). **CLAIMED** = asserted with no receipt. **UNVERIFIED** = open or unknown.

---

## 1. What BNRoSe is: the charter, verbatim

**The only ruled definition is the Eternal Computer one-liner** (RULED, R7 Item A, founder 2026-08-07). It appears in `docs/SPEC-BNROSE-0-CHARTER.md:22-25` and `docs/dispatches/DISPATCH_CLAUDECODE_BNROSE_ADDENDUM_R7.md:11`:

> **The Eternal Computer** = eternal data (Autonomi primary + Arweave mirror) + eternal runtime (BNRoSe deterministic-replay discipline) + b-metered ephemeral compute (bTiMe vouchers on bMeshLLM). Storage that never forgets; a runtime that can always be rebuilt; compute rented by the mesh-second in b.

**The three legs** (`docs/SPEC-BNROSE-0-CHARTER.md:30-34`):
- **L1, eternal data:** Autonomi primary plus Arweave mirror.
- **L2, eternal runtime:** the BNRoSe deterministic-replay discipline.
- **L3, ephemeral compute:** bTiMe vouchers on bMeshLLM, metered in b.

Every downstream BNRoSe document has to say which leg(s) it serves (`:36-39`). A Buzz design that calls itself BNRoSe falls under this rule.

**The charter is a skeleton** (`:7-9`, "Status: SKELETON"). Four sections are still placeholders: §1 purpose and scope, §2 relationship to the Constitution and FOUNDER-RIGHT-1, §3 the document series map, and §4 ratification (`:45-48`). The header asks for a founder read (`:3`). The COURSE_SYNC acceptance box is unchecked (`:60`). **No ruled text defines BNRoSe's purpose or scope beyond the one-liner.**

**Second usage of the name: "BNRoSE" the onboarding surface.** `docs/SPEC-BNROSE-ONBOARD.md` (R3, 2026-07-26) uses the name for the onboarding watcher. It calls BNRoSE "a checklist that can see the chains" that "never holds, converts, or forwards a user's assets" (`:17-21`). Its absences are explicit: "no key custody, no signing on behalf of users, no receiving addresses owned by BNR anywhere in the flow" (`:74-76`).

R3 says, verbatim (RULED, `docs/RULINGS-2026-07-26.md:48`): "**BNR is never in the flow of funds.**"

Article V.1 says, verbatim (RULED, `docs/CONSTITUTION.md:83`, draft v0.1): "Users fund the resources they consume; nodes are paid for capabilities they provide. The paymaster *abstracts* user-funded payment; it must never *absorb* cost."

**The "BNRoSe autonomy doctrine" ("no custodian, no gallery, no operator")** is quoted in `docs/SPEC-ORIGINATION-1.md:857` and `:2681`. I did not find its primary source (CLAIMED).

## 2. BNRoSe-3: eternal data (L1)

From `docs/SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md`. The spec is a SKELETON (`:9`).

- **Universal chain mirror** (RULED, R7 Item B, `:21-28`). Each adapter chain's entire chain goes to Autonomi plus Arweave, on a per-chain epoch cadence.
- **The two-part sandwich, verbatim** (`:33-36`): "The eternal store anchors verifiable HISTORY up to the last mirrored epoch; the LIVE TIP (current state, fresh consensus) requires a thin live layer per chain". And at `:38`: "This spec does not claim the mirror alone provides live full-node capability."
- **Standing rule** (`:50-51`): "a new adapter chain requires a **named capture adapter** before mirroring is claimed for it."
- **External notary** (RULED IN, R7 Item C, `:63-103`). An optional OP_RETURN on BCH, or OpenTimestamps on BTC, per epoch. The doctrine is "ANCHOR, NOT WAREHOUSE" (`:74-77`), with a cost ceiling of "pennies per epoch" (`:102`).
- **Open:**
  - The epoch record format (§3), the cold-start verifier (§4) and owned archival nodes (§5) are placeholders (`:109-111`).
  - Every per-chain cadence is TBD (`:55-59`).
  - Zano retention is UNVERIFIED (`:134-137`).
  - Cold-start acceptance is unchecked (`:121`).

## 3. What exists in code: crates `bnrose-exec-core`, `bnrose-exec-wasm`, `bnrose-exec-host`

The dispatch is `docs/dispatches/2026-10-12-bnrose-rust-001.md`. It serves L2 (`:7`). The crates have no README; the lane README is `scripts/bnrose-rust-001/README.md`.

### 3.1 Components

**`bnrose-exec-core`** (`crates/bnrose-exec-core/src/lib.rs:1-46`), SOURCE:
- It is `no_std` with `forbid(unsafe_code)`.
- It holds no keys, no clock and no I/O; time is an input (`:13-16`).
- It is the single authority for admission, the state machine and the digests.
- Its intent format is a **WB001 envelope**, decoded by the SAW-proven `btungsten-wb001-core` decoder. `MAX_ENV = 4626` bytes (`crates/btungsten-wb001-core/src/lib.rs:47`).

**The state machine** (`lib.rs:23-35`). Admitted, then Reserved, then Dispatched, then Completed, Failed or Unknown. Unknown resolves to Completed{recovered} only through ledger evidence.

Two laws are written into it (`:37-43`):
- "A missing response is a STATE (`Unknown`), never an authorization".
- `Dispatched` comes before the effect, and binds the only digest the ledger will accept.

**Digests and domain tags** (`lib.rs:246-296`; also `docs/specs/SPEC-RUSTEOSVM-1.md:31-36`):
- `op_id = SHA-256("bnrose-exec/op-id/1"||authority||envelope)`
- `env_sha`
- `effect_digest`
- `step_op_id` and `step_effect_digest`, for multi-step work
- `record_digest`
- `policy_digest`
- `STMT_TAG "bnrose-exec/receipt/1"`

**`bnrose-exec-wasm`** (`crates/bnrose-exec-wasm/src/lib.rs:1-33`), SOURCE:
- A C-ABI shim exposing 5 exports.
- "THE MODULE HAS NO IMPORTS. No WASI, no host functions, no environment".
- **It is the sandbox for the core's own verdict function only. It is not a general application sandbox.**

**`bnrose-exec-host`** is the trusted supervisor (`crates/bnrose-exec-host/src/lib.rs:1-23`), SOURCE. It contains the worker, journal, ledger, receipt, keys, opexec and cli modules.
- The CLI commands are `init | make-fixture | run-op | recover | verify-receipt | status | dest-init | dest-apply` (`cli.rs:57`).
- Exit codes are a contract: 0 ok, 1 refusal, 3 lost response, 4 UNKNOWNs kept (`scripts/bnrose-rust-001/README.md`).

**Worker sandbox** (`worker.rs:1-53`), SOURCE:
- Pinned `wasmtime =49.0.2`.
- Bounded by fuel, by an epoch watchdog (250 ms ticks) and by a memory-cap ResourceLimiter. The default cap is 8 MiB and 2e9 fuel.
- The Linker is empty.
- `ParanoidWorker` runs the native worker beside the wasm one and requires byte equality; any disagreement traps.
- "the NATIVE worker is bounded only by the OS" (CLAIMED boundary, `2026-10-12-bnrose-rust-001.md:157-160`).

### 3.2 The interfaces a messaging system could use

**`journal::Journal`** (`journal.rs:100-170`), SOURCE:
- One append-only file. Each record is tagged with HMAC-SHA256 over the label `bnrose/journal/1`, the previous tag and the body.
- `append` does a `write_all` and then `sync_data` (fsync) before it returns.
- `load` reads the whole file and re-verifies every tag. A flip, insert or reorder fails as `Tampered`.
- **The chain is keyed by a supervisor MAC key, so a stranger cannot verify it without that key.**

**`journal::ReplicatedJournal`** (`journal.rs:260-422`), SOURCE:
- `append` writes and fsyncs to every replica in turn. It returns Ok only if all of them succeed.
- Load rules:
  - all replicas agree: Healthy;
  - some are missing or unreadable and the survivors agree: Degraded, recover from survivors;
  - any replica fails its own chain: fail closed;
  - survivors disagree: fail closed.
- A lost replica is rebuilt byte-identically on open ("AUTONOMOUS HEALING", `:301-317`).
- **The replicas are two files in one state directory:** `journal.bin` and `replica/journal.bin` (`opexec.rs:103-108`). The comment there reads "two files stand for two hosts; the definition is the hosts'". The test that "destroys the host" does it with `remove_file` on the same temp directory (`tests/rusteosvm.rs:116-121`).
- The `append` comment says a mid-write failure "poisons further appends". I found no poison flag in `append` (`journal.rs:341-355`). Divergence is caught at the next load (`:385-404`). SOURCE observation.

**The durable-ack definition** (RULED, founder order 2026-10-13, `docs/specs/SPEC-RUSTEOSVM-1.md:65-71`, §2 item 4):

> An operation's recovery material is **durably acknowledged** when the records through Dispatch (identity, scope, reservations, progress) are fsync-complete on **two independent durable stores** — distinct failure domains — BEFORE the effect door opens, and are chain-verifiable independently on each. A hash commitment without retrievable state does NOT satisfy this definition.

**`keys::SupervisorKeys`** (`keys.rs:1-88`), SOURCE:
- One 32-byte root, stored raw in `supervisor.root`, derives everything through HMAC-SHA256 labels: an Ed25519 receipt seed, `journal_mac`, `ledger_mac` and a public fingerprint.
- `init` refuses to overwrite an existing root. A missing root is an error, never a fresh key (`:53-81`).
- **All of it is classical.** SPEC-RUSTEOSVM-1 §3 (`:85-91`) says CLASSICAL is used. It says PQ is "NOT USED here — no PQ claim rides on this spec".

**`supervisor.claim`** (`opexec.rs:50-101`), SOURCE:
- Created as an OS-atomic `create_new`, before any journal write, signature or effect.
- A stale claim can only be taken over through an explicit `adopt_stale`.
- **It gives local, single-node exclusivity only** (`2026-10-14-bnrose-crossnode.md:12-19`).

**`ledger::EffectLedger`** (`ledger.rs:1-24,189-201`), SOURCE:
- Bound to the effect digest, idempotent per `op_id` (Applied or Already), HMAC-chained.
- It is non-spending by construction: the effect is a stand-in record.
- **It is one file, `effects.bin`, and it is not replicated.**

**Receipts** (`receipt.rs:1-30`), SOURCE:
- An Ed25519 signature over `op`, `env_sha`, `state`, `recovered`, `fail`, `effect`, `journal_head`, `completed_at` and `seq_head`.
- They verify with the public key alone.
- **They carry no consumed-resource fields.** "consumed-vs-reserved in the BNROSE receipt (ZCode)" is a named next item (CLAIMED, memory `handoff-2026-10-15-sovexec-001.md:30`).
- The Reserve record does journal `fuel u64 | mem u32 | secs u32` (`journal.rs:24`).

**Multi-step work under one authorization** (`E_STEP_ADMITTED`, `step_op_id`): propose, approve and execute run as ordered steps, with one admission, dispatch and effect per step (`2026-10-13-bnrose-wb004-handoff-received.md:24-31`). MEASURED locally: 39 rows, 0 failures.

**The replacement law** (RULED, founder 2026-10-13, `2026-10-13-bnrose-contention-and-boundaries.md:36-48`). A FAILED step may be replaced only when:
- (a) no ledger row exists for any attempt, and
- (b) the caller explicitly opted in (default FALSE).

The replacement is a new attempt entity, stored in the high nibble and saturating at 15.

**Custody transfer: `migrate_root` / `E_MIGRATION`** (`opexec.rs:1365-1440`), SOURCE:
- Re-chains the state under a new root and carries UNKNOWN forward as UNKNOWN.
- Its "replay-verify before custody moves" loop body is `let _ = r;`, so it does nothing. The comment defers legality to `recover()` (`opexec.rs:1383-1391`). The chain tags are verified by `load_state`. SOURCE observation.

**Destination surface** (`dest-init`, `dest-apply`; `2026-10-14-bnrose-crossnode-procs.md:12-24`). `dest-apply` verifies the receipt under a named public key before applying anything, then applies idempotently. Its doc comment says one row "does not establish globally exactly-once execution".

**The event space** (`crates/bnrose-exec-core/src/lib.rs:91-112`):

| code | event |
|---|---|
| 0 | `E_ADMITTED` |
| 1 | `E_RESERVE` |
| 2 | `E_DISPATCH` |
| 3 | `E_RESPONSE` |
| 4 | `E_BOUNDED_FAIL` |
| 5 | `E_LOST_RESPONSE` |
| 6 | `E_RECOVERY_EVIDENCE` |
| 7 | `E_RECOVERY_NONE` |
| 8 | `E_MIGRATION` |
| 9 | `E_STEP_ADMITTED` |

Other code spaces:
- Core refusals: 0 to 22.
- Host fail codes: 1000 and up (`contention-and-boundaries.md:31-33`).

### 3.3 Maturity: what is measured and what is only claimed

**MEASURED on CI (on main):**
- The workflow `.github/workflows/bnrose-rust-001.yml` runs, in order: wasm build, battery, teeth, recovery demo, cross-node demo, bench, sampled-agreement grid, Cryptol twin.
- Recent completed `BNROSE-RUST-001` runs on main all succeeded (`gh run list`):
  - `bde1a9cc6`: run 38801113252.
  - `032b0e1aa`, `de36ef416`, `8b2cfe606`: also success.
  - `69ef2c717`: run 38833009420 was still queued when I read it.
- **The netpart demo is NOT in the main workflow yet.** It is wired in by PR #446, which is open.

**MEASURED locally, from the dispatches:**
- **Battery:** 29/0 at the first landing (`2026-10-12-bnrose-rust-001.md:112`); 44/0 (`contention:66`); 56/0 (`crossnode:44-45`, `twin-grid:77`). PR #443 claims 59/0 (open).
- **Teeth:** 5 of 5 planted faults convicted (`rust-001:125-129`).
- **Cryptol twin:** 7 of 7 obligations Q.E.D., with 2 controls counterexampled (`twin-grid:72-74`).
- **Sampled-agreement grid:** 58 of 58 cells agree (`:75-76`). Stated as "an **intermediate gate**, not SAW implementation correspondence" (`:62-64`).

**MEASURED benchmarks** (`docs/receipts/bnrose-rust-001/bench-local-release.json`; one Windows 11 development box):

| quantity | value |
|---|---|
| full lifecycle | 56 ops/s, fsync-dominated |
| warm wasm admit | 30.8 µs (p99 87.2 µs) |
| native admit | 8.4 µs |
| paranoid admit | 26.9 µs |
| cold wasm | 32 ms |
| 4-store concurrent admits | 4,280/s |
| recovery of 100 ops (400 records) | 45 ms |
| fuel per admission | 260,974 |
| wasm peak linear memory | 1,114,112 B |

The dispatch is explicit: "**No extrapolation: none of these numbers is a capacity claim of any kind.**" (`rust-001:146-147`).

**MEASURED recovery demo** (`docs/receipts/bnrose-rust-001/recovery-demo.txt`, 2026-10-13T05:55:18Z):
- Exit 3, then recovered to the same op with 1 effect row.
- The receipt verified under the public key alone.
- Nonce reuse was refused.
- UNKNOWN was preserved.
- A flipped byte failed closed.

**MEASURED network partitions** (`docs/receipts/bnrose-rust-001/netpart-demo-local.txt` and `netpart-metrics-local.json`, run 2026-10-15T17:48:54Z):
- Setup: one rootless network namespace, independent processes, real TCP through a Python courier, and partitions made with `iptables OUTPUT DROP`.
- 3 legs, all PASS.
- 10 dual dispatches: p50 38 ms, p95 and p99 142 ms.
- Courier traffic: 25 PUT, 25 GET, 17,405 B in, 17,630 B out.
- Node B peak RSS: 4,076 KiB.
- **The metrics file's `nodeC-lose-response` RSS field holds the text "Command exited with non-zero status 3" instead of a number.** PR #446 fixes this (CLAIMED, open).
- Boundary (`2026-10-15-bnrose-netpart-001.md:49-51`): "One namespace with per-link packet drops is a private segment, not multi-host WAN physics".

**CLAIMED, open PRs, not merged** (`gh pr list --search bnrose`, read 2026-10-16T02:04Z):

| PR | what it claims | checks |
|---|---|---|
| #444 | a two-host partition harness, `crates/bnrose-netpart` | 52 queued |
| #443 | SAW correspondence of the compiled Rust against the twin, plus `crates/bnrose-replacement-law` | 54 queued |
| #446 | netpart as a CI gate | 51 success, 8 skipped, 1 in progress |
| #439 | milestone ruling record, docs only | 52 success, 8 skipped |
| #449, #451 | `bindex-bnrose`, a keyless read path, and SSE (stacked on #448) | #449: 52 queued; #451: not checked |
| #435, #436 | `bnrose-evolve` (draft) | — |
| #422 | SKV storage trait | — |

## 4. Ownership seams (do not collide)

- **ZCode owns** `crates/bnrose-exec-core`, `-wasm` and `-host`: "admission, state machine, journal, ledger, receipts, CLI, `dest-*`". ZCode also owns "the record formats inside those crates, the event-code space `E_*`, `scripts/bnrose-rust-001/`, the lane workflow" and "the Cryptol twin, the grid, the cross-node harness" (`docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md:11-15`).
- **The consumer pattern is already set** (`:14`, `:83`):
  - a new Rust **consumer** crate of `bnrose-exec-host`, reusing `journal::ReplicatedJournal` and `keys::SupervisorKeys` (both public);
  - "The door's event code lives in the door's own file, not in the core's `E_*` space; if a shared code is wanted, that is a one-line proposal to ZCode."
- **The founder's mission text** (RULED as relayed, `:3`): "Do not build a competing execution core, journal, or storage abstraction." A related founder order says "no competing storage abstraction" (memory `bnr-explorer-lane.md:13`).
- **bSigner is frozen** (RULED, `crates/bsigner/CONTRACT.md:3-7`, founder 2026-10-06):
  - "**Signs, never submits.** Submission is the rail adapters' job. The organ has no network code at all." (`:43-44`)
  - Its algorithms are ML-DSA-44/65/87 and ML-KEM-512/768/1024 (`:37-38`).
  - Rail payload signing stays with the rail vaults (`:58-61`).
  - The BNRoSe exec crates do not use bsigner (`2026-10-12-bnrose-rust-001.md:78-79`, "`bsigner` untouched").
  - The memory paraphrase of the 2026-10-11 order (CLAIMED, `sovereign-operating-environment-order.md:18`) reads: "bSigner stays frozen: it signs authorization artifacts and never submits. Rail signers sign payloads, and adapters submit."

## 5. Governing laws a messaging design inherits from BNRoSe

**1. The three-boundary rule** (RULED; founder 2026-10-14 per `2026-10-14-bnrose-twin-grid.md:65-68`; repeated at `netpart-001.md:55-57`). The PR #439 verbatim form:

> Local exclusion protects a process. Destination idempotency protects an effect. Consensus and finality must be established independently.

**2. The death-is-not-proof law** (RULED as relayed, founder 2026-10-15). It is in the dispatch on PR #439's head `3b2c264`, file `docs/dispatches/2026-10-15-bnrose-rust-002-milestone-ruled.md:33-37`. The PR is not merged:

> worker death alone does not universally prove that an external effect never happened … Otherwise, the outcome must remain `UNKNOWN`.

**3. UNKNOWN is never authorization.** A fresh attempt needs a fresh nonce (`2026-10-12-bnrose-rust-001.md:50-53`).

The transport form of this law is in `docs/dispatches/2026-10-12-btmd-mesh-dependability.md:38-43` (adopted from WB004): "missing observation = **UNKNOWN** … reconciliation may re-deliver **identical bytes only** … Transport recovery must not manufacture new authorization or repeat an external operation."

**4. No exactly-once claim from a local journal** (`crates/bnrose-exec-host/src/lib.rs:20-23`; `ledger.rs:17-21`).

A duplicate response is "a reconciliation OBSERVATION — not proof of inclusion" (`wb004-handoff-received.md:55-57`).

Evidence classes stay separate:
- `submitted`, `observedLocal` and `recovered` are local facts.
- `included`, `executed` and `final` are null unless destination evidence shows them (`contention-and-boundaries.md:52-60`).

**5. DNS independence** (RULED, founder block of 2026-10-12/13, `docs/dispatches/2026-10-13-bnr-dns-independence-routing.md`):
- "Make naming, application loading, and recovery independent of the original DNS and hosting stack." (`:17-18`)
- "Implement the resolver and pre-execution verification in the existing Rust core." (`:35-36`)
- The decisive test (`:52-57`): "block the original DNS names, remove the original hosting edge … start a clean replacement".
- The governing rule (`:90-92`): "names help people find the system; cryptographic authority determines what the system accepts. Losing the name must not mean losing the sovereign."
- **This bears directly on tonight's SNI block of `skaists.buzz`.** The lane belongs to the integration lead; SPEC-RUSTEOSVM-1 §4 (`:98-101`) consumes none of it.

**6. Non-goals** (RULED order, `SPEC-RUSTEOSVM-1.md:93-97`; `rust-001:84-87`): "No new wallet, identity system, cryptographic primitives, consensus chain, production authority changes, or mainnet spending."

## 6. What BNRoSe explicitly is NOT

| claim | source |
|---|---|
| Not a VM implementation: "rustEOSvm … is an interface specification, not a virtual machine implementation" | `SPEC-RUSTEOSVM-1.md:8-12` |
| Not the `AntelopeIO/eos-vm` library | `:14-17` |
| The Vaulta-side contract is "NOT BUILT" | `:24` |
| Not consensus, not global exclusivity, not global exactly-once | `crossnode.md:12-19,64-65`; `netpart-001.md:54-57` |
| Not PQ: the classical evidence class only | `SPEC-RUSTEOSVM-1.md:85-91` |
| Not live-chain: "LIVE-CHAIN … NOT USED here"; every effect is a non-spending fixture | `:91` |
| Not multi-host or WAN-tested on main: one namespace; two-host work is PR #444, open | — |
| Not formally proven against the compiled Rust: sampled agreement only; SAW is PR #443, open | — |
| Not a custodian and not in the flow of funds | ONBOARD `:17-21,74-76`; R3 |
| Not durable through browser `localStorage`: a 12 s survival was "nondeterministic on the same box" | `browser-recovery-acceptance.md:58` |
| The browser-to-BNRoSe door does not exist yet: "the OPEN case is still OPEN" | `:99` |
| Not a messaging, pub/sub or gossip layer: `grep` for x0x, nostr, gossip, MLS and ML-DSA in `crates/bnrose-exec-*` finds nothing | SOURCE |

## 7. Adjacent facts for a Buzz-over-x0x/BNRoSe design

**LOADMODEL-1M** (`docs/specs/LOADMODEL-1M.md`) is "BNRoSe Realtime Layer", L3. Its status is "MODEL DRAFTED — no receipts" (`:4`).
- `:50`: "signaling/membership rides Buzz signed events (human plane, per the x0x ruling's PLANE LAW). Buzz's own relay target is 10K humans + 50K agents, and single-relay = single-community today". CLAIMED; it cites Downloads artifacts that are not in the repo.
- G-6, control-plane federation across 100 or more relay communities, is open (`:139`).
- The ruled direction (`:92`): "TAKE iroh-gossip/gossipsub mesh pub/sub; BUILD fan-out on the Nostr/Buzz + x0x rails" (CLAIMED citation).
- The forwarding price is symbolic: p in b per GB (`:116-122`).
- Treasury §11.10 tension: "b never pays for infrastructure; b authorizes → treasury spends A" (`:18`, FLAG-2, unresolved).

**bTunGsTeN axes** (`docs/specs/SPEC-BTUNGSTEN-1.md`):
- Axis 5 (`:61-65`): "Passing requires credible mathematical scaling bounds PLUS progressively larger physical tests."
- L1 (`:87-91`): "at least 10 billion unique, ACTIVE sovereign users continuously across a 1,000-year operational horizon."
- The scale legs (axis 5) are "box-gated", not run (`:386-387`; `rust-001:161-164`).

The memory note on the 2026-10-11 order (CLAIMED paraphrase, `sovereign-operating-environment-order.md:23`): "10B users needs a declared workload model (about 115,741 ops/s average at 1 op/user/day). A single-host test is not a mesh result."

**Scale-relevant source facts** (SOURCE):
- Every `run` reloads and re-verifies both full journal replicas to build the nonce set (`opexec.rs:235-240`, called at `:281` and `:892`). Admission cost therefore grows with history.
- The journal and the ledger load whole files into memory.

**bnr-seal** (`docs/dispatches/2026-09-27-bnr-seal.md:39-46`): "whether this is a replay all stay with BNRoSe" (CLAIMED assignment).

## 8. Gaps

1. The charter's §1 to §4 (purpose and scope) are unwritten. BNRoSe-3's §3 to §5 (epoch format, cold-start verifier) are unruled.
2. The §2.4 "distinct failure domains" are not demonstrated. The replicas are two files in one directory, and the effect ledger is not replicated.
3. Nothing in BNRoSe is PQ. Receipts and journal use Ed25519 and HMAC-SHA256. bsigner, the estate's ML-DSA signer, is frozen, has no network code, and BNRoSe does not consume it.
4. No multi-host or WAN partition test is merged. The netpart CI gate, the SAW correspondence and the keyless reader are all in open PRs.
5. The journal's HMAC chain cannot be verified by a stranger. #449 proposes a keyless `load_served` and a `receipt/2` head; neither is landed.
6. Receipts have no consumed-resource accounting, and nothing links the BNRoSe fuel reservations to bTiMe or b metering. The user-pays link is not built.
7. No BNRoSe interface exists for messaging, fan-out or pub-sub. Any Buzz integration is a new consumer crate under the ZCode seam.
8. The primary source of the "autonomy doctrine" was not found. The R3 economics constants and the b price are unruled.
