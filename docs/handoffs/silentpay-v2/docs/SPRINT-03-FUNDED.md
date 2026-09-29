# Sprint 03: local funded notes and recovery

Continues `a320429` on the separate branch `codex/silentpay-sprint03`. Both `a320429` and `c79f23d`, their source trees, the original handoff and all pre-existing receipts are preserved. New implementation lives under `sprint03/`; new receipts live under `verification/sprint03/`.

All transactions and deployments in this milestone use a disposable, single-producer localhost Spring chain and issuer-controlled, valueless test tokens. No public RPC transaction, public deployment, public test-asset spending, code publication or paid service was used. `bcodexjungle` was not contacted or changed.

## What the inspected Sprint 02 circuit actually proves

`proof02/src/circuit.rs` has 114,079 constraints and 12 public inputs. It proves knowledge of the preimage of a SHA-256 commitment, computes a statement authorization hash, and constrains billing/conservation arithmetic. It does not prove deposit membership or the provenance of its budget. Sprint 02's contract supplies that budget from synthetic configuration. Its statement digest is opaque inside the circuit; the native adapter constructs the typed statement and public economic inputs together.

Sprint 03 keeps that suite intact and creates a different circuit, key and schema. It adds authenticated note membership and binds the note's owner, amount, identifier and funding domain inside the R1CS. Typed reservation serialization still belongs to the native/Rust adapter boundary and is checked end to end. This is not a claim that the circuit alone authenticates a blockchain or parses a token notification.

## Reproduction and preservation

The [Sprint 02 reproduction runner](../sprint03/tools/reproduce02.cjs) reads the original checkpoint scripts and redirects only their output paths into a new receipt directory. It does not overwrite old receipts, alter the old suite or regenerate its setup. It runs the original builds, native/EVM tests and offline EVM bytecode comparison; it deliberately does not invoke the public RPC audit.

Actual reproduction: four Sprint 02 circuit tests, 45 proof/integration checks, five historical guards and three decoded EVM path diagnostics passed. See [local output](../verification/sprint03/reproduction/sprint02/local.cjs.txt), [Rust output](../verification/sprint03/reproduction/sprint02/rust-tests.txt), and [EVM comparison](../verification/sprint03/reproduction/sprint02/sprint02-evm-correspondence.cjs.txt). The reconstructed Sprint 02 WASM and ABI hashes match the checkpoint.

All five original native/EVM spike checks also passed with new receipts: [output](../verification/sprint03/reproduction/sprint02/legacy-spike-command.txt). The original handoff ZIP still hashes to `cdb2a03d364f48768e1e6ce662a17054124994e7e4e26fbcaa73573cb0546b38`.

The older baselines were also rerun: [40 core Rust tests](../verification/sprint03/reproduction/core-rust-tests.txt), [59 Python tests](../verification/sprint03/reproduction/baseline-python.txt), [18 schema tests](../verification/sprint03/reproduction/schema-tests.txt), and the [41-entry original manifest](../verification/sprint03/reproduction/manifest.txt). Three original durable demos reproduced [unknown](../verification/sprint03/reproduction/demo-unknown.json), [partial](../verification/sprint03/reproduction/demo-partial.json) and [recovered](../verification/sprint03/reproduction/demo-recovered.json) modes. The [local correspondence audit](../verification/sprint03/correspondence.json) checks that no original checkpoint path has changed. No current public-chain state is inferred from these local reproductions.

## Authenticated funding and ownership

The local token fixture performs actual native token-balance mutations, requires the sender's native authority, and sends transfer notifications. The pool accepts funding only from its configured token contract (`get_first_receiver`), with the exact symbol and precision, a positive bounded amount, and the sender's authorization. A fake token with the same ticker fails and its transfer rolls back. Different actors have distinct ephemeral signing keys.

A deposit creates an authoritative, owner-scoped receipt containing a client deposit ID, amount and secret commitment. Receipt IDs cannot be reused for that owner. An owner-authorized `importnote` consumes that receipt exactly once and appends a funded note. There is no API that imports an arbitrary caller-asserted balance or funding commitment. A second import fails even after node replay.

The pool records three outstanding liabilities: authenticated but unimported deposits, available notes, and pending reservations. Their sum must equal escrow. The escrow counter must equal the actual configured token balance. Mutating exits schedule a final native audit after inline token/EVM actions, so failed backing checks revert the transaction. The harness independently folds every note, deposit and reservation and compares those totals with token balances.

Available notes have an immutable amount, owner, commitment and funding leaf plus a separate authoritative consumption status. Only the owner can reserve or withdraw them. A reservation additionally requires a genuine proof of secret knowledge and membership. Recovery withdrawal of an available note requires native owner authority and does not require a prover; that deliberate recovery path makes the account authority part of the funding trust model.

The 62-bit per-note/escrow range is enforced. Cumulative paid amounts use checked uint64 accounting; a lifetime acceptance cap refuses deposits that could no longer be fully accounted for on exit. A separate pool tests four maximum-asset deposit/import/withdraw cycles, the final three units up to `UINT64_MAX`, and rejection of the next unit without accepting custody. These are valueless inventory fixtures, not a financial capacity claim.

## Funding commitments and circuit constraints

[Exact suite manifest](../sprint03/fixtures/suite.json):

| Pin | Value |
|---|---|
| Suite | `d2875a59ac1abf6b92718190eb1474486baa9adff6e1ff86abbc1330e9e43393` |
| R1CS matrices SHA-256 | `c953cfc563f1357ffb0be17db7582a887888d063b94819867c7df23041c6ff83` |
| Verification key SHA-256 | `540487adb7c11b30301a18fd9ec86538e94d80c0cc547e73e760c776a8ead594` |
| Public proving key SHA-256 | `161e2e56c8803d99cbd66c8047f70ec123ea24e3c12a153dc6a46ff9cb8a3fca` |
| Schema SHA-256 | `38432aad188499ce27f938d671dbae268f7708215b89e9f7eac004bfc5be03ca` |

The [new circuit](../sprint03/src/circuit.rs) has **352,976 constraints** and **18 public inputs** over BLS12-381 Fr:

| Inputs | Meaning and constraints |
|---|---|
| 0–1 | Two 128-bit limbs of SHA-256(secret) |
| 2–3 | Two limbs of the bound statement digest |
| 4–5 | Two limbs of SHA-256(secret || statement digest) |
| 6–7 | Units and price, each constrained to 32 bits |
| 8–11 | Reserved service charge, fee, immediate change and input-note budget, each constrained to 62 bits |
| 12–13 | Two limbs of the full funding-domain digest |
| 14–15 | Note ID and native owner value, each constrained to 64 bits |
| 16–17 | Two limbs of the authenticated funding root |

The arithmetic equations are `units * price = charge` and `charge + fee + change = budget`. Bounds make these integer equalities rather than modular wraparound equalities. Every public input is constrained. Hashes retain all 256 bits as two 128-bit limbs.

The funding leaf is:

```text
SHA256("SP03-NOTE" || domain32 || note_id_LE64 || owner_LE64
       || budget_LE64 || SHA256(secret))
```

Each funding bucket contains four leaves. A branch is `SHA256("SP03-BRANCH" || left32 || right32)`. The two private path selectors are constrained to the low two bits of the public note ID. The circuit derives the leaf from the same commitment and budget used by the spend constraints, then derives the public root from two sibling hashes. Zero bytes represent an unused leaf.

The contract assigns monotonically increasing note IDs; bucket ID is `note_id / 4`. It appends deposit imports, change and refunds, computes roots itself, and retains at most four authenticated historical roots per bucket. Buckets can continue to be created; the circuit does not impose a four-note limit on the pool. This is a bounded-depth forest, not a global private state tree.

An older registered root remains acceptable after an unrelated import changes the bucket root. The native adapter also checks that the exact note exists, belongs to the owner, matches the budget and is still available. Thus historical membership cannot revive a consumed note. The executable tests exercise both an unrelated same-bucket root change and a subsequent attempt to reuse the consumed input.

The new statement binds the funding domain, note ID, owner, provider, EVM runtime/target, recipient, root, reservation ID, deadline and all economic fields. The funding domain includes the full chain ID, pool account, token account and symbol/precision. The successful native statement digest must match Rust's exact fixed-width serialization. The manifest contains the complete layout.

The proof remains an actual 384-byte Groth16 proof. The native verifier checks canonical field encodings, non-infinity, curve and subgroup membership, canonical public scalars, the input MSM and the pairing equation. Its VK is checked at initialization. The off-chain prover validates the pinned public proving key once per process and reuses immutable parameters; each request still checks its own constraints, matrix identity and proof. Proof outputs additionally record rejection of all 18 individually changed public inputs.

The retained public proving key is 109,224,816 bytes. Setup used OS randomness once and refuses to replace an existing key. It remains a single-party test setup without a ceremony or audit. The original Sprint 02 key is untouched. Alice/Bob secrets in this fixture are deliberately public constants; they are not private user-wallet material.

## Reservation, claim, change and competing exits

For the ordinary fixture, all quantities below are **base units** of a local 4-decimal test token. A 100-unit deposit is `0.0100 EOS` in that fixture, not 100 public-chain EOS.

An owner reserves 60 units of service (`20 * 3`) plus a 2-unit fee from a 100-unit input. The input is consumed and an immediately available 38-unit change note is appended. The 62-unit reservation becomes the sole remaining authority for that reserved amount.

The bound provider may claim at most the authorized units through the deadline. A partial eight-unit claim pays 24 tokens to the provider and 2 to the configured fee recipient, appends a 36-unit unused-refund note for the owner, and closes the reservation. This claim does not prove eight units of real work; provider-reported usage is trusted within the owner's signed/proven ceiling.

After the deadline, the owner may cancel a still-pending reservation and receive its entire reserved balance as a new available note. No fee is charged for an unused timed-out reservation. Both claim and refund close the same authoritative reservation; a terminal reservation cannot be claimed or refunded again. The original reserved input cannot be withdrawn separately.

The implemented boundary rule is **provider claim allowed at `now <= deadline`; timeout refund allowed only at `now > deadline`**. Six executed cases cover both orderings:

| Time | Claim first, then refund | Refund first, then claim |
|---|---|---|
| D−1 | Claim commits; refund sees closed reservation | Refund is early; claim commits |
| D | Claim commits; refund sees closed reservation | Refund is early; claim commits |
| D+1 | Claim is expired; refund commits | Refund commits; claim sees closed reservation |

These exact boundary tests use the separate `testclock.cpp` fixture, configured in the disposable pool. The claim/refund functions execute on the chain; their clock input is controlled. An empty clock configuration uses actual block time, but actual producer scheduling at a wall-clock deadline is not qualified by these controlled-clock tests.

## Atomic native/EVM integration

The pinned exSat mutating `call` is used on the same Spring 1.2.2 host. The EVM fixture authenticates the pool's reserved native sender address. It records a pending entitlement on reserve, exact credit on claim, and a terminal cancellation on timeout. These EVM records are non-transferable test entitlements; token custody and payouts remain native.

Executed rollback paths include:

- Valid membership proof, input consumption and change creation, followed by an EVM reserve write/revert.
- Successful EVM state change followed by an invalid funded proof and actual native pairing rejection.
- Provider token payouts and unused-refund creation followed by EVM claim failure.
- Timeout-refund note creation followed by EVM cancellation failure.

Each failure requires identical before/after snapshots covering native liabilities, notes, roots, reservations, deposit receipts, token balances, EVM nonces/balances/code/storage. The same valid transition can then succeed. Rejection paths distinguish authority, funding/root metadata, actual verifier, deadlines and consumed/terminal state; gate rejections are not counted as pairing coverage.

The final EVM storage audit compares every reservation's recipient, cap, paid amount and terminal state with native state, and checks 120 total entitlement units. The ordinary funding fixture deposits 1,000 base units in total and finishes with zero escrow and 1,000 paid/returned units: 120 provider, 10 fee, 770 Alice and 100 Bob. The maximum-value regression uses a separate pool and is not mixed into that accounting.

The correspondence audit checks all eight genuine proof receipts against their native reservation statements and the current source/key pins. It also matches the Solidity compiler input to the current source, inserts the exact immutable constructor arguments and compares all 1,915 deployed EVM runtime bytes.

| Rebuilt and locally deployed artifact | SHA-256 |
|---|---|
| Funded native WASM | `1c6e7d5f9ae0d9138afe6b482b6fc298745e0cc5bcae492a7d802d35ae762f96` |
| Serialized native ABI | `f5ded795a0e81dd4208e767afbc0c3336ef37dbc66b72628d19860d4f5916b12` |
| EVM runtime with constructor immutables | `b481a4872b327c349d6654dd63b593e0982369d3c72fa4b6b1b8d33bf818accf` |

## Restart and coordinator-unavailable recovery

The harness leaves an expired reservation and an authenticated unimported deposit pending. It cleanly terminates the actual prover process, stops the node, and restarts it with `--replay-blockchain`. All authoritative funding/exit snapshots must match before and after disk replay.

It then launches new owner processes with only their own ephemeral native signing key over stdin, the pinned local chain identity and expected pool code hash. These clients load no proving key, witness or coordinator cache. They read the chain's notes, deposit receipts, reservations and configured clock, ask the separate Rust recovery planner for actions, and submit native imports, refunds and withdrawals. After importing or refunding, they scan fresh state to discover the new output notes. Table reads paginate; unsupported non-exact JSON ID ranges fail closed rather than truncate.

A change withdrawal is deliberately committed before simulating loss of its acknowledgement. After restart, the old output remains consumed and cannot be withdrawn twice. The fresh recovery plan uses observed state rather than assuming that the lost acknowledgement meant failure. A transport failure during recovery is not blindly retried; a later process must reread authoritative state.

This demonstrates recovery from coordinator/prover loss and restart with locally available chain history and owner keys. It does not demonstrate recovery from permanent chain loss, lost owner authority, withheld public history, compromised token code, unavailable EVM execution, or corrupt consensus state.

## Commands and actual output

Run from `C:\Users\travi\bmeshasi_coding_handoff`. Existing CDT 4.1.1, Spring 1.2.2, Rust 1.98.1, Python test environment, eosjs lock and solc 0.8.30 dependencies are used. No new external service is required.

```powershell
# Preserve prior receipts while reproducing Sprint 02 locally.
node sprint03/tools/reproduce02.cjs
node sprint03/tools/reproduce-demos.cjs

# Build the new circuit/prover/native contracts and run Rust checks.
wsl -d Ubuntu -- bash -lc 'cd /mnt/c/Users/travi/bmeshasi_coding_handoff && bash sprint03/tools/build.sh'
node sprint03/tools/build-evm.cjs

# Disposable funded-note, deadline, atomicity and recovery tests.
node sprint03/tools/local.cjs

# Offline source/build/deployment and final-state correspondence.
node sprint03/tools/correspondence.cjs
```

Do not run `setup` during reproduction. The committed public key and suite pins define this exact suite. The prover can run one request with `target/funded03/release/silentpay-funded03 prove REQUEST OUTPUT`, or accept request/output file-path pairs through the local `serve` stdin protocol. New requests and randomized proofs are generated for the fresh disposable chain; ephemeral keys and witness files are confined to ignored `target` directories.

Actual outputs: [build](../verification/sprint03/build-command.txt), [Rust tests](../verification/sprint03/rust-tests.txt), [clippy](../verification/sprint03/rust-clippy.txt), [chain test log](../verification/sprint03/local-command.txt), [full chain receipt](../verification/sprint03/local-funded.json), [Alice recovery](../verification/sprint03/recovery-sp3alice.json), [Bob recovery](../verification/sprint03/recovery-sp3bob.json), [build/deployment correspondence](../verification/sprint03/correspondence.json), [EVM state correspondence](../verification/sprint03/evm-state-correspondence.json). Seven Rust tests pass: five circuit tests and two recovery planner tests. Individual proof files contain genuine verification and all-public-input negative checks.

The final chain run passed **68 checks**. Actual final output from the chain runner and offline audit:

```text
{"status":"passed","tests":68}
PASS: 200 original checkpoint files preserved; native and EVM deployments match builds; 68 funded/recovery checks passed.
```

The first chain attempt found missing ABI declarations for external token-balance/clock row types; those declarations were added. A serial prover attempt was stopped after identifying repeated public-key validation overhead; the persistent prover preserves full validation while reusing public parameters. The final client's restart initially dropped its local system ABI and failed to deploy the extra overflow fixture after 62 passed checks; the client now restores that ABI after restart. The overflow fixture deployment exercises that correction. These development attempts are retained separately from passing run receipts.

The baseline commands, executed from WSL in the project root, are:

```bash
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
(cd baseline/silentpay_v2 && ../../.venv/testenv/bin/python -m unittest discover -s tests -v)
.venv/testenv/bin/python baseline/bmeshasi_vnext/test_contracts.py
.venv/testenv/bin/python tools/verify-manifest.py
```

## Implemented, mocked and missing

| Implemented and executed | Mocked or missing |
|---|---|
| Authenticated local token custody, deposit receipts and duplicate-import prevention | Token fixture has privileged, unlimited minting; no production asset issuer/upgrade/policy qualification |
| Authoritative funding commitments, genuine membership constraints and owner-bound spend | Public owners/amounts, known fixture secrets, no anonymity set, private state/nullifier tree or privacy claim |
| Conservation, immediate change, capped provider claim, unused refunds and competing exits | Usage is provider-reported; no measurement/delivery proof, production receipt dispute process or complete payment lifecycle |
| Actual native/EVM transaction rollback and matching final state | Single pinned localhost runtime; no external-chain atomicity, public-network finality or multi-producer fault qualification |
| Exact deadline boundary conditions executed natively | Separate controlled clock; real producer scheduling/races at wall-clock boundaries remain unqualified |
| Disk replay and fresh owner recovery with prover/coordinator stopped | Requires owner keys, chain history, token contract and EVM availability; no emergency bypass when EVM execution is unavailable |
| Checked base-unit arithmetic and lifetime capacity | Resource/RAM admission, hostile-load limits, long-lived operation and broad adversarial audit remain unfinished |

No deposit or proof gate in the public Silent Pay contract was enabled. This local suite and its direct-owner recovery path are not a production funding/privacy/escape qualification.

Upstream versions and license findings remain those recorded in [Sprint 02](SPRINT-02-QUALIFICATION.md): pinned arkworks 0.5 dependencies (MIT/Apache options), CDT 4.1.1, the exact exSat source revision and Spring 1.2.2 with their BSL/custom-grant considerations, and solc 0.8.30 targeting Paris. The new Solidity fixture is original MIT code. No upstream implementation was patched or copied beyond the project's own preserved qualification code; the new Cargo lock is separate.
