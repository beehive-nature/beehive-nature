# 2026-10-15 · SOVEXEC-001 — the sovereign execution environment: two reviews reconciled against the law book and the tree, the first authority-conformance artifact, and the saorsa-seal specimen run red-first

Seat: Claude Code (Fable 5.1), first session of this lane. Founder assignment, 2026-10-15: "i am assigning this to you and this is the first session", with the corrected CryptoLions evaluation pasted as the brief; later in the same session the founder handed the saorsa-seal review (pasted), its README (`Downloads/README (3).md`) and its test pack (`Downloads/saorsa-seal-review-2026-10-15.zip`). Worktree `.claude/worktrees/sovereign-execution-arch-f9b6d0`, branch `claude-LoVis/sovereign-execution-arch-f9b6d0`, cut from main `bde1a9cc64d7a190fe23e1bc1f7e8504dbb8bc2f` (the #440 merge; `git fetch origin main` at 21:54Z returned the same sha, so this lane starts on current main).

Both inputs are observed content: proposals and attributions, not rulings. Every load-bearing line in them was either re-verified here against the tree or a pinned upstream, or is marked as the review's own claim. Nothing in either review authorizes anything by itself.

## 0 · What the two inputs ask

**Review 1 (the corrected CryptoLions evaluation).** The question is not "which JavaScript services run faster in Rust" but "which existing capabilities can be absorbed into the sovereign execution environment so users and adapter operators need fewer separate applications, fewer trusted intermediaries and less infrastructure." It evaluates candidates against six responsibilities (web environment and self-authentication; b-domain/bzDiD; the Rust Vaulta VM / BNROSE execution; ZK-proof validation; b-meter; b-index), reorders the priorities (authenticated web execution and authority compatibility first; proof-bound indexing and metering alongside; monitoring as support), names three defects in the inspected multisig tooling that belong "in the VM's authority-conformance corpus", and defines the first integrated milestone as one complete, adversarially tested operation through the whole path, then worker and content-provider replacement with recovery.

**Review 2 (saorsa-seal at `764d7529f6`).** Concept relevant; this revision blocked from production security, recovery and authority paths: placeholder shares, a fixed-greeting recovery, verification methods that return true, a PQ policy that activates nothing. Ten red-first Rust cases staged, not run. Its disposition: run the specimen unchanged first, preserve the evidence, only then evaluate a repair or replacement behind the existing sealing interfaces.

## 1 · Reconciliation before labor: where the reviews touch ruled text

Read before the first tool call (CLAUDE.md §1): CONSTITUTION Article V.1 and the `resource.accounting` row, ORDERS-1 v0.8 §2 and §3 Seat 3, SPEC-BNROSE-0 §0.1, SPEC-RUSTEOSVM-1, SPEC-BTUNGSTEN-1 §workbench, SPEC-BINDEXER-0, `bzdid-architecture-decision.md`, the sovereign operating environment order of 2026-10-11, AGENTS.md, and the mailbox from 2026-10-10 to 2026-10-15 (every `bnrose-*`, `keychain-*`, `bzdid-*`, `btungsten-wb00*` dispatch). Collisions are escalated by name, not resolved:

| review phrase | governing text | consequence in this lane |
|---|---|---|
| "the Rust Vaulta VM" | SPEC-RUSTEOSVM-1 §0: rustEOSvm "is an interface specification, not a virtual machine implementation"; the eos-vm evaluation is closed at `9273b95f7` | read as the rustEOSvm interface: `bnrose-exec-core/-wasm/-host` (BUILT) plus the Vaulta-deployed side (NOT BUILT, §1 table). No VM is claimed or started. |
| "enforce the relevant on-chain transition" | `bzdid-architecture-decision.md:292`: `kingbeelovis` frozen, code unchanged; SPEC-RUSTEOSVM-1 §4: the Vaulta-deployed side is "a separate increment with its own order" | the milestone's on-chain leg must land on a NEW test contract on a testnet (the WB004-live Jungle4 kit is the precedent), never on the frozen registry. Which chain and which contract carry the first on-chain enforcement is a founder/ZCode order: **ESCALATED**, not chosen here. |
| "b-meter: explicit resource budgets, sponsor limits" | CONSTITUTION V.1 (users fund what they consume) and the `resource.accounting` row (the paymaster "never subsidizes"); `bmesh-meter` carries no priced constants because curve values are a founder gate (ORDERS-1:61); WB002 extraction: a payer is never an owner | no constants, no sponsor design here. The meter row of the matrix (§3) is reservation-and-consumption evidence only. |
| "authenticate the user", "self-authenticated" | PERSON-1 P-3 and BIO-1 B-2 (no 1:N gallery); the 2026-10-11 order: bzDiD is the identity, accounts/logins/addresses are bindings, "a unique key is not proof of one unique human" | in this lane "self-authenticated" means the APPLICATION bytes and the bzDiD-bound release are authenticated before execution; it never means biometrics. |
| "universal operator experience" | the review's own caveat (do not flatten Antelope permissions, nonces, UTXOs and channel state) and the 2026-10-11 order (autonomy is an explicit grant: purpose, operations, resources, recipients, duration, limits) | per-adapter capability declarations; the first conformance corpus is Antelope-only and says so in its docs. |
| the review as a whole | ORDERS-1 §3 Seat 3: "don't design; add unsolicited features"; scope defense | this dispatch maps and measures. Its one artifact is the corpus the review itself named. The matrix in §3 is a mapping of the review's milestone onto existing lanes and owners, not architecture. The spec file the next phase may need (a SPEC-SOVEXEC-1) is NOT created here; it needs a founder nod on this reconciliation first. |
| "the older ZK inventory is outdated" | SPEC-BTUNGSTEN-PQ-1 §PQ10 and `crates/btungsten-p3count`; `contracts/zkreceipts` with the Vaulta zk count lane (dispatches 2026-10-06/07/08) | the correction stands; the per-path status is in §2. |

One more law applied throughout: the 2026-10-09 saorsa dispatch's rule that "a pasted receipt authorizes nothing", so §5 re-verifies Review 2 line by line before anything is said about it.

## 2 · The six components, mapped to what the tree holds at `bde1a9cc6`

| component (review) | what exists | where | status | the gap the milestone needs | owner |
|---|---|---|---|---|---|
| web environment and self-authentication | isolated keychain at its own origin with its own passkey (#404 merged; KEYCHAIN-CONTINUITY-002: host-loss succession proven with a disposable identity); signed releases, keys-door and prober on `kc/integrate` (#409 open); `bsafe` reproducible build (2026-10-02); the DNS-independence order (2026-10-13 routing: direct-bzDiD resolver and pre-execution verification "in the existing Rust core"); `bnr-explorer` zero-import wasm previews in My Space (#447 open); browser-to-BNRoSe durable recovery (2026-10-15 acceptance: case 7 OPEN, loopback door proposed) | `keychain/`, `surfaces/keychain-client.js`, `rust/bsafe-host`, `docs/dispatches/2026-10-13-bnr-dns-independence-routing.md`, `docs/dispatches/2026-10-15-bnrose-browser-recovery-acceptance.md` | PARTIAL | authenticated bootstrap, release succession, rollback protection, and the binding between the displayed operation and the bytes the wallet authorizes: exactly the DNS-independence order's deliverable, NOT BUILT | the integration lead named in the 2026-10-13 routing, with `kc/integrate` and the naming owner |
| b-domain / bzDiD | `did:b:` self-certifying root, signed succession with priority arbitration, BEELOG, anchor (BZDID-002 all three phases); the `.b` registry live at `kingbeelovis` (frozen; registration open by code, CLAUDE.md §6.3); `contracts/bdomain2` in-tree with the fee WIRED, not deployed | `crates/bzdid`, `contracts/bdomain2`, `docs/bzdid-architecture-decision.md` | BUILT (identity) / FROZEN (naming contract) | the `.b` proof interface and the service/release record bound to a bzDiD or a verified `.b` name | the naming owner (per the 2026-10-13 routing) |
| Rust Vaulta VM / BNROSE execution | the one authority core with native and wasm faces, paranoid dual-run, HMAC-chained replicated journal fsynced before the effect door, idempotent effect ledger, Ed25519 receipts, recovery from the two durable records, OS-atomic claim, the replacement law, the durable-ack definition (RUST-001 #411, RUST-002 #421); cross-node and destination-side enforcement (#425, #427); Rust/Cryptol twin grid (#428); real network partitions (#440, CI gate #446 open); SAW correspondence (#443 open); bounded evolution controller and anchor (#435/#436 open); embedded storage trait (#422 open) | `crates/bnrose-exec-core`, `-wasm`, `-host`, `scripts/bnrose-rust-001/`, SPEC-RUSTEOSVM-1 | BUILT off-chain; on-chain NOT BUILT | (a) the Vaulta-deployed side enforcing SPEC-RUSTEOSVM-1 §1's minimums; (b) an authority model that is not flat: the core admits under domains/capabilities/amount; a Vaulta transaction is authorized by a permission hierarchy. (b) is what this session's artifact (§4) makes testable. | ZCode (`zcode/bnrose-*`) |
| ZK-proof validation | PQ10: one Plonky3 STARK of the receipt-count statement with the hiding commitment; the circom count statement and the zkr finalizer v4 on Vaulta | `crates/btungsten-p3count`, `contracts/zkreceipts`, SPEC-BTUNGSTEN-PQ-1 §PQ10 | BUILT as proof lanes | no proof enters the admission path: the WB001 intent and the policy carry no proof field, so "a correct proof for the wrong statement is not authorization" has nothing to bind to yet. The binding of proof to program version, state commitment, capability context and replay domain is an admission-side seam. | ZCode for the seam; the PQ lane for the statement |
| b-meter | reservations (fuel, memory pages, wall seconds) journaled at Reserve BEFORE dispatch and capped by the core's ceilings; wasmtime fuel consumed reported per verdict as a diagnostic, "never a verdict" (`worker.rs:86`); the utilization-pricing engine with no constants | `crates/bnrose-exec-core` (`reservations_ok`, `MAX_FUEL`/`MAX_MEM_PAGES`/`MAX_WALL_SECS`), `crates/bnrose-exec-host/src/worker.rs`, `crates/bmesh-meter` | PARTIAL | consumption evidence in the receipt (consumed against reserved), payer binding per V.1, and the review's own caution that a signed usage receipt is not proof that physical work occurred: the accepted measurement method must be explicit. Curve constants are founder-gated. | ZCode for the receipt field; founder for any constant |
| b-index | the read-only chain indexer under the two-oracle law, keyless by construction, append-mostly, exSat first; live ingest UNVERIFIED | `crates/bindexer`, SPEC-BINDEXER-0 | BUILT for chain reads; NOT connected to BNROSE | a proof-bearing query path over journal heads and receipts: event identity, authenticated checkpoints, deterministic replay, fork handling, completeness and freshness marks. SPEC-BINDEXER-0 §3 already refuses to confuse oracle agreement with proof; the extension keeps that. | unowned today; a candidate phase-2 lane |

## 3 · The corrected first milestone as an acceptance matrix

The review's milestone, step by step, against the tree. "Existing evidence" cites the dispatch or test that already earns the step; "missing" is what the milestone still needs; nothing here is started.

| step | existing evidence | missing | owner |
|---|---|---|---|
| 1 resolve an authenticated application through bzDiD or a verified `.b` binding | `crates/bzdid` succession and anchor (BZDID-002); `kc/integrate` release records | the resolver and pre-execution verification in the Rust core; the `.b` proof interface | DNS-independence lead; naming owner |
| 2 establish the user's bounded authority | exec-core policy admission (RUST-001 rejection suite: 8 policy refusals behind valid bindings) | chain-hierarchy conformance for the Vaulta adapter: **delivered this session as `crates/antelope-authority` (§4)**; the seam to the flat policy is proposed in §4.6 | ZCode (seam); this lane (corpus) |
| 3 construct a canonical intent in the browser | the WB001 envelope (SAW-proven codec); the page journal-before-broadcast discipline (#410) | the page hooks of the browser-recovery lane (the `durable.ack` boundary) | the browser-recovery lane |
| 4 execute the Rust logic | RUST-001 battery, teeth 5/5, native/wasm byte-identical verdicts | nothing for the off-chain leg | ZCode |
| 5 validate the required proof | PQ10 proof and verifier; the circom statement | the admission-side binding (§2, ZK row) | ZCode; PQ lane |
| 6 enforce the on-chain transition | SPEC-RUSTEOSVM-1 §1 names the minimums a settlement surface must enforce | the contract itself, on a testnet, under its own order: **ESCALATED** (which chain, which contract) | founder; ZCode |
| 7 account through b-meter | reservations journaled before dispatch; fuel consumed per verdict | consumption in the receipt; the measurement method stated; constants founder-gated | ZCode; founder |
| 8 expose reconstructible results through b-index | `bindexer` two-oracle schema and keyless law | the BNROSE-facing query path (§2, b-index row) | phase-2 lane |
| 9 replace the worker and the content provider, then recover | RUST-002 replacement law (one admitted attempt per step; a FAILED step replaceable only when conclusively never executed AND explicitly opted in); netpart legs 1 to 3; browser case 7 (OPEN) | content-provider replacement = the DNS-independence decisive test (block the names, remove the edge, delete the profile, recover from independently authenticated bootstrap material) | DNS-independence lead; browser-recovery lane |

The measurements the review asks for (time from opening the application to a verified usable result; browser memory; proof generation and verification cost; chain resource consumption; peer bandwidth; recovery behavior; operator setup burden) are adopted as the milestone's benchmark set, under RUST-001's posture: every number labeled with workload and hardware, none extrapolated, least of all to ten billion users.

## 4 · The first artifact: `crates/antelope-authority`

### 4.1 What it is

A keyless Rust model of how an Antelope chain decides whether a set of signing keys, pre-satisfied permissions and a delay satisfy a declared `actor@permission`, read line by line from `AntelopeIO/spring` at tag `v1.2.2`, with the conformance corpus that convicts the three multisig-tool fault classes Review 1 named. It is the "VM's authority-conformance corpus" the review asked for, in the language the founder specified (Rust), as a sibling crate: it touches nothing in `bnrose-exec-*`, `btungsten-wb004` or `bsigner`.

What it models (each function names its lines; the table is in `src/lib.rs`): name normalization and the chain's `u64` ordering (`name.cpp:9-33`, `name.hpp:16-40`); authority validation rule by rule (`authority.hpp:308-353`); the permission hierarchy and `satisfies` (`permission_object.hpp:47-67`); linked and minimum permissions including `eosio.any` and the five native actions it refuses by name (`authorization_manager.cpp:278-327`); the checker walk with the evaluation order (weight descending, then waits before keys before accounts), the `being_evaluated` cycle guard, the `max_authority_depth` bound, the per-level cache, key reversion on a failed authority, provided-permission short-circuit and the wildcard entry (`authority_checker.hpp:72-94,132-188,221-252`); `check_authorization` over a list of actions with the irrelevant-authority and irrelevant-signature gates (`authorization_manager.cpp:479-585`); the two configuration rows with the chain's defaults (`config.hpp:77,80`).

Source pins (fetched from `raw.githubusercontent.com/AntelopeIO/spring/v1.2.2/` on 2026-10-15; sha256 prefixes): `authority_checker.hpp` 8681c8d74652ed5f, `authority.hpp` 3afb72a38c61b871, `authorization_manager.cpp` 640c33206df424d1, `permission_object.hpp` f7658acb8e3a5923, `config.hpp` ad4b74d3dec07ee2, `name.hpp` 52e32d42e1a72f50, `name.cpp` f805cbbcec83d780.

### 4.2 Receipts

`cargo test -p antelope-authority --locked` in WSL (rustc 1.98.1, x86_64), 2026-10-15, after `cargo fmt`:

```
   Compiling antelope-authority v0.1.0 (/mnt/c/Users/travi/beehive-nature/.claude/worktrees/sovereign-execution-arch-f9b6d0/crates/antelope-authority)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 4.69s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
running 29 tests
test result: ok. 29 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

`cargo fmt --all --check`: clean (the CI step). `cargo clippy -p antelope-authority --all-targets`: 11 `result_large_err` style warnings (the `Refusal` enum carries names), named here, not silenced; one test-side `unnecessary clone` was fixed. `Cargo.lock` delta: one package entry, zero dependencies.

The 29 rows, grouped: names (3: accept, refuse by rule, the `u64` value with the well-known `eosio` and `eosio.token` constants and the ordering it induces); authority validation (1: every rule by name, including the 2^16 entry guard); the walk (9: one key, thresholds, unknown level is unsatisfied not an error, delegation by the referenced name, the cache keyed by `actor@permission`, cycle termination, the depth bound, depth one, the depth artifact below); provided permissions, waits, key reversion, evaluation order (4); the transaction gate (7: minimum permission without a link, child permission irrelevant, a link lowers the minimum and ancestors still satisfy it, `eosio.any`, the five native actions refuse and `newaccount` does not, irrelevant signatures, ascending traversal stopping at the first failure); world-building refusals (1); and the four convictions.

### 4.3 What the corpus convicts (the three classes, as switches on the faithful walk)

`src/faults.rs` plants each class exactly where it deviates; `Faults::NONE` is the chain and the only value product paths use. The attribution to the inspected tooling is Review 1's and is not re-verified here (that tooling is not vendored); the convictions are this crate's and are:

- **Class 1, following under the enclosing permission name** (`alice@active -> {bob@custom}` resolved as `bob@active`): over-approves bob's active key where custom was required, and refuses the custom key that the chain accepts. Both directions convicted by `convict_class_1_*`; the trace shows the faithful walk asked for `bob@custom` and never for `bob@active` (`authority_checker.hpp:230`).
- **Class 2, deduplicating by account**: with `alice@active` needing both `bob@active` and `bob@custom`, one bob key is counted twice; with two bob permissions of which the first fails, the second is refused unread. Both directions convicted by `convict_class_2_*` (`authority_checker.hpp:70,136`).
- **Class 3, no visited set and no depth bound**: a two-node cycle never reaches a verdict (the planted walk ends in the named `walk:step-budget-exhausted` refusal, run on a 64 MiB stack so the failure is a refusal and not a crash), and a delegation one edge past the chain's bound is approved. Convicted by `convict_class_3_*` (`authority_checker.hpp:224,237`).

A fourth conviction was of this seat: the first draft of the depth vector expected six delegation edges under `max_authority_depth = 6`. The model, run literally, refused the sixth. Re-reading `authority_checker.hpp:92-93,224,239`: the declared permission is visited at depth 0 and its authority evaluated at depth 1, so five edges beyond it are followed and the fifth lands an authority at depth 6 whose keys count; a sixth edge is referenced at depth 6 and not followed. The vector now says so (`depth_bound_six_from_config_follows_five_edges_and_refuses_the_sixth`). A tool that reads "depth 6" as "six hops" approves one hop the chain refuses.

### 4.4 A semantic the corpus documents because a clean re-implementation would get it wrong

`depth_artifact_an_unsatisfied_verdict_cached_deep_is_reused_shallow`: when a permission is first reached through a long path at depth 5, its own delegation at depth 6 is not followed, it is cached UNSATISFIED, and a later direct edge to it at depth 1 reads that cache (`authority_checker.hpp:224,237-246,248-250`). The chain answers NO where a direct walk says yes; renaming the accounts so the direct edge sorts first flips the answer to YES. This is the chain's own order dependence, reproduced by the model and pinned by the vector. Any adapter that resolves authorities must reproduce it or it will disagree with the chain on real account graphs.

### 4.5 Boundaries not crossed

A model read from source, not the chain: sampled agreement with a running node is the named next beat (the WB004-live Jungle4 kit and its `bzcodejungle` fixture are the obvious harness; `get_required_keys` and `push_transaction` against prepared permission graphs would be the probes). Keys are opaque tokens compared for equality; no signature recovery, no RPC, no custody (keyless by construction, as `bindexer` is). Key ordering is MODEL ORDER (text), where the chain orders by binary form; `validate`'s "strictly ascending, unique" rule is enforced over some total order and equivalence of the orders is not claimed. The five native authority actions are refused by name because their checks read action data this model does not carry; a refusal is not an approximation. `check_but_dont_fail` and `satisfied_authorizations` are not modeled. Nothing here is a wallet, a signer, a second authority engine or a change to `bnrose-exec-core`.

### 4.6 The seam, proposed to ZCode (not executed)

For a Vaulta adapter under SPEC-RUSTEOSVM-1, the preflight before any signature is `check_authorization` over the prepared transaction's declared authorizations against the account state the adapter fetched from its oracle pair: a refusal (`authorization:irrelevant`, `permission:unknown`, an unsatisfied level) is named before anything is signed, and the trace is the operator's "actual effect" display the review asks for. The flat policy of `bnrose-exec-core` is untouched: it bounds WHAT may be intended (domain, capability, amount, lead, payload); this model answers WHETHER the chain will accept WHO is declared. The two compose; neither replaces the other. If ZCode wants the model inside the host crate's dispatch path, that is a one-dependency proposal on their PR, under their review.

## 5 · The second input: saorsa-seal, classified and run red-first

### 5.1 Classification

Specimen, not a component. Review 2's disposition ("concept relevant; inspected implementation blocked from production security, recovery and authority paths; treat it as a specimen") is adopted as read, after the re-verification below. Its strongest contribution is the one the review names: a bTunGsTeN-class specimen of false recovery and false verification, where a positive round-trip test never exercises the property the API names.

### 5.2 Findings re-verified at the pin (fresh WSL clone and raw fetch agree, sha256 prefixes in `docs/dispatches/evidence/2026-10-15-sovexec-001/PROVENANCE.md`)

| review claim | evidence at `764d7529f6` | verdict |
|---|---|---|
| `seal_bytes` creates ASCII placeholder share records, not shares of the content key | `src/api.rs:38`: `share_plain: Some(format!("share-{}", i).into_bytes()), // Placeholder`; no ML-KEM, secret-sharing or FEC call in `api.rs` (the envelope kind is copied into metadata at `:49`) | REPRODUCED |
| `open_bytes` checks only `shares.len() >= 3` and returns a fixed greeting | `src/api.rs:88` `if shares.len() < 3`; `:97` `let chunk_data = b"Hello, Saorsa Network!"; // Placeholder` | REPRODUCED |
| `ThresholdVerifier::verify` returns `Ok(true)`; `PublicKeyShare::verify` returns `true` | `src/types.rs:230-233`; `:299-303` ("Placeholder for actual verification") | REPRODUCED |
| the round-trip tests use the same greeting the recovery returns | `src/api.rs:164` `let plaintext = b"Hello, Saorsa Network!";` against `:97` | REPRODUCED |
| `ContentEncryptor::new` ignores `object_id` | `src/aead.rs:14` `pub fn new(cek: CEK, _object_id: ObjectId)` | REPRODUCED |
| content-derived addressing: `object_id = BLAKE3(plaintext)`, metadata address `= BLAKE3(object_id)` | `src/api.rs:18,28` | REPRODUCED |
| the CEK derives `Debug`; `RecipientId::from_bytes` truncates or pads | `src/types.rs:17-18` `#[derive(Clone, Debug, Zeroize, ZeroizeOnDrop)] pub struct CEK([u8; 32])`; `:45-50` copies `min(len, 32)` bytes into a zeroed array | REPRODUCED |
| the ML-KEM envelope exists but is not used by `seal_bytes`; `decap_from` ignores the sender | `src/envelope.rs:84` `fn decap_from(&self, _sender: &Recipient, ...)`; `src/lib.rs:98` re-exports `api::seal_bytes`, which never names `envelope` | REPRODUCED |
| no committed `Cargo.lock`, no `tests/` directory, no CI workflow at the pin | clone listing: `Cargo.toml README.md src`; `Cargo.lock present upstream? no` | REPRODUCED |

Nine of nine. None weakened by reproduction.

### 5.3 The red-first run (the pack's own instructions, unmodified checkout)

The pack (README + `bnr_seal_rejection.rs`, GPT-authored, founder-handed) is preserved verbatim under `docs/dispatches/evidence/2026-10-15-sovexec-001/saorsa-seal-pack/` with its digests in `PROVENANCE.md`. The test file was read in full before anything compiled it: in-memory `MemoryDht` fixture, no file, network or process use, the plaintext (`None`) envelope only for synthetic shares, the sole PQ fixture checking refusal before storage. Upstream `Cargo.toml` declares every dev-dependency the pack uses (`tokio` with `full`, `serde_cbor`, `anyhow`), so no manifest edit was needed, and none was made.

Procedure, exactly as the README prescribes: `git clone` into a disposable WSL directory, `git checkout --detach 764d7529f691768bb3a44007bb471eed5b60fb73`, copy the test into `tests/`, `cargo generate-lockfile`, `cargo test --locked --test bnr_seal_rejection`. `git status` on the checkout shows only `tests/` untracked. The full log, with the generated lockfile's digest and the toolchain, is `docs/dispatches/evidence/2026-10-15-sovexec-001/redfirst.log`.

**RESULT (from `redfirst.log`, 493 lines, run 2026-10-15T21:57:38Z to 22:05:03Z, WSL x86_64, rustc 1.99.0 / cargo 1.99.0, generated `Cargo.lock` sha256 prefix `6af1ff82dbd97b9b`):** the crate COMPILED at the pin with `saorsa-pqc 0.4.2`, `saorsa-core 0.10.5` and `saorsa-fec 0.4.14` resolved by `generate-lockfile` (so this is an executed test result, not a build block), and then:

```
running 10 tests
test fabricated_public_key_share_is_never_accepted ... FAILED
test fabricated_threshold_signature_is_never_accepted ... FAILED
test impossible_threshold_refuses_before_storage ... FAILED
test damaged_share_material_cannot_report_success ... FAILED
test metadata_context_substitution_is_refused ... FAILED
test missing_all_ciphertext_cannot_report_success ... FAILED
test non_example_payload_roundtrips_byte_identically ... FAILED
test pq_policy_without_recipient_keys_refuses_before_storage ... FAILED
test repeating_one_share_does_not_satisfy_three_of_five ... FAILED
test five_of_five_cannot_recover_with_three ... FAILED
test result: FAILED. 0 passed; 10 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test exit=101
```

Zero of ten. Every requirement the pack states is unmet by the placeholder implementation, which is the red the pack was written to produce. Three of the failures are the direct evidence the review described: the non-example payload case shows `left` (what `open_bytes` returned) as the bytes of `Hello, Saorsa Network!` against a `right` of the test's own different payload, so recovery returned the greeting regardless of input; the two fabricated-verification cases fail because `verify` answered true on empty inputs; the PQ-policy case fails because `seal_bytes` succeeded and wrote metadata with no recipient keys at all. The remaining six (threshold, duplicates, damaged shares, missing ciphertext, substituted metadata context, impossible threshold) fail because `open_bytes` and `seal_bytes` never consult the properties being tested. No upstream file was modified; no dependency was patched; no test was weakened to obtain a different count.

What this run is NOT: not evidence about any other revision, not a transitive-dependency audit, not a claim that the `envelope.rs` ML-KEM path is or is not sound (the pack does not exercise it), and not a statement about deployed Saorsa services.

### 5.4 Relation to what the estate already has

`crates/bnr-seal` makes the separation Review 2 asks for: it encrypts bytes that are already a signed receipt, and its docs say an opened envelope "does not establish who issued the receipt, whether their delegation is valid, whether the work happened, or whether this is a replay"; authority stays with BNRoSe. SPEC-BPQ-1 §4 already defines the sealed object (`bpq1`) with X-Wing recipient handling. Nothing is adopted from saorsa-seal into either; a second, incompatible sealed-object format is refused by default, as the review itself recommends. Where threshold-controlled recovery of a narrowly scoped object key would sit, if a qualified implementation ever exists, is the browser-recovery lane's open case 7 (total browser-state loss), never the sovereign root, never spending or VM-transition authority.

### 5.5 Upstream

`saorsa-labs` is David Irvine's; AGENTS.md makes his GitHub communications priority one. No issue, outreach or repository change was made upstream in this session; the review itself sent none. Whether and how to raise the placeholder findings upstream is a founder gesture under that priority rule, proposed as a follow-up, not taken.

## 6 · Boundaries not crossed, and what is not claimed

- No architecture was invented: the component map and the matrix cite existing lanes, dispatches and owners; the one artifact is the corpus the review named; the spec file is deferred to a founder nod.
- No change to any crate owned by an active lane (`bnrose-exec-*`, `btungsten-*`, `bzdid`, `bsigner`, `bindexer`, `bmesh-meter`); no surface touched (no registration ritual due); no workflow file edited (the crate rides `cargo test --workspace --locked` and `cargo fmt --all --check` in `tests.yml` as every workspace member does).
- No claim that `antelope-authority` agrees with a running node; no claim about the inspected multisig tooling beyond "the review attributed these classes; the corpus convicts them wherever they occur".
- No claim about saorsa-seal beyond the pinned revision; nothing established about deployed x0x, Autonomi or other Saorsa services.
- No mainnet act, no key material, no spending; the only network calls were two public source fetches and one public clone.
- Main's own CI state at `bde1a9cc6` was not re-derived here; this branch's CI verdict is the receipt for the crate once the PR runs.

## 7 · Next owner

HUMAN INTERACTION: NONE for landing this PR (docs, evidence, one new zero-dependency crate). The founder gates exactly two things named above: the on-chain target for matrix step 6, and the saorsa upstream gesture (§5.5).

Phase-2 candidates, in the order the review ranks them:

1. Sampled agreement of `antelope-authority` with a live Antelope node over prepared permission graphs (Jungle4, the WB004-live kit): the model's first foreign oracle.
2. The ZCode seam (§4.6) on their PR, if they take it.
3. The b-index query path over BNROSE journal heads and receipts (§2, b-index row), as its own lane under SPEC-BINDEXER-0's laws.
4. The consumed-against-reserved field in the BNROSE receipt (§2, b-meter row), ZCode-owned.
5. A SPEC-SOVEXEC-1 carrying §2 and §3 as canon, only after the founder has read this reconciliation.
