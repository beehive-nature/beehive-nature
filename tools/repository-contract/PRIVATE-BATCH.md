# Private acceptance and batched checkpoint ordering

GitHub remains stage-one source/PR/merge authority. This is a peer-local
private shadow replica and a portable proof organ. The user selects the
repositories, trust pins, readers and funded wallet writer. No central
server, estate prover, default payer, global user census or compulsory
per-person chain account is introduced.

## What is proved and what authorizes acceptance

Private replicas decrypt the existing BPQ objects, run
`contract.mjs::acceptUpdate` on **every** update, and reconstruct the exact
receipt transcript before consuming its STARK. That contract verifies the
complete declared Git graph, pinned policy, ML-DSA-65 owner threshold and
signed suite qualifications through `signature.mjs::verifyEnvelope`.
`private-batch.mjs::verifyPrivateBatch` mints a local capability only after
those checks, native STARK verification, transcript binding and BEELOG
verification. The database rechecks the actual current checkpoint and batch
pin inside its transaction. A package cannot bootstrap its own authority.

The NEW repository AIR is
`crates/btungsten-p3count/src/repository/air.rs::RepositoryAir::eval`:

- A verifier-fixed schedule folds context and private receipt records through
  the existing Poseidon2 permutation (`statement.rs::Hasher::compress` and
  upstream `Poseidon2Air::eval` constraints), using a separate repository
  domain and protocol version. Every SHA-256 byte is represented by one of
  sixteen range-constrained 16-bit limbs; there is no modular hash reduction.
- Private old/new state digests form a contiguous chain. Private u64 sequence
  arithmetic increments exactly once per real slot, with explicit carries
  and overflow refusal. Policy and repository/ref scope stay constant.
- Real slots are a nonempty prefix. Padding is a neutral suffix: unchanged
  state/sequence and zero proposal, manifest and qualification digests.
  Per-slot salts, policy, scope and private state stay hidden in the witness.
- The transcript binds proposal, policy, manifest and signed qualification
  digests as well as those transitions. Public values are only the opaque
  batch context and receipt root; the chosen capacity is public.

This is a **receipt-chain relation**, not a zkVM execution proof of Git,
SHA-256 or ML-DSA. Those complete acceptance checks remain mandatory in the
private verifier. `verifyOpaqueReceipt` returns `valid_relation`, never
`accepted`; it cannot mint a checkpoint capability. It verifies the hiding
relation and append evidence against an independently supplied prior pin.
An observer without repository plaintext/authority cannot infer that the
full acceptance contract was executed from that opaque proof alone.

The cohort-count circuit is unchanged and never substituted for this AIR.
There is no `zk_verified` override, user-selected verifier key, arbitrary
proof plugin, pairing wrapper or production signing key in this layer.

## Hiding composition and native organ

`repository::setup` reuses `config.rs::hiding_labeled`: `HidingFriPcs`, both
`MerkleTreeHidingMmcs` layers, the degree-four KoalaBear challenge field and
Keccak transcript at the existing pinned Plonky3 revision. Private main-trace
blinding uses operating-system entropy. Only the **public preprocessed
schedule** uses reproducible commitment randomness, so another process can
derive the same verifier key; that config never proves private rows.

The repository label includes its version, bucket and fixed parameters.
Hiding-budget padding is enforced. Supported capacities are 8/16/32/64,
default 32. Real update count is private inside that capacity. Proof bytes
are excluded from logical batch identity and replay keys.

`repository-proof` accepts bounded stdin JSON and performs `prove`, `commit`,
`verify`, `check`, `log-extend` or `log-verify`. There is no endpoint, signer,
wallet creation, upload or payment operation. The JavaScript adapter spawns
the explicitly configured built binary, bounds input/output and runtime,
and does not copy native stderr/private witness into receipts.

The same upstream security calculator (`security.rs::figure_for_air`)
checks this AIR's actual dimensions and parameters against the existing
100-bit proven-argument target. These calculator values are model-specific,
not an end-to-end audit, quantum security certificate or proof of anonymity.
Crypto wording remains **sound by construction / isolated by design**.

## Compact ordering and atomicity

`bzdid::beelog::Frontier::append` extends the existing stored-byte BEELOG
format. It retains 64 optional subtree roots rather than the leaf history.
Each batch appends exactly one canonical opaque header; the existing
`verify_inclusion` and `verify_consistency` independently check the paths.
The header binds stream, epoch, previous header digest and proof statement.
No source bytes, repository name, DID, policy keys or true update count
enter this leaf. The frontier does not confer authority: its old root and
the repository checkpoint must already be pinned by the user.

`local-batch-shadow` and `hive-batch-shadow` bootstraps additionally pin
`ordering.batch = {pin, frontier}`. `pin` is
`{stream, epoch, digest, head:{size,root}}`; size equals epoch. Genesis is
epoch zero, digest null and the canonical empty BEELOG root. `initialBatch`
constructs that shape for an already chosen opaque random stream.
Existing databases retain their pinned mode; there is no silent upgrade.

`CheckpointStore::applyPrivateBatch` commits every accepted update's objects
and decision, the final repository checkpoint, proof document, epoch pin
and compact frontier in **one** WAL/FULL transaction. Replay fails even
when a caller supplies a current predecessor for an old proof. No ordinary
single-update entry point can advance a batch-mode database.

Hive v3 notices carry an opaque topic and encrypted batch-root pointer.
The existing finalized-block adapter retains full block/transaction/
operation order and configured RPC agreement. All referenced private bytes
and proofs are prepared before the block transaction. Missing earlier OR
later bytes stop the entire block. A definite invalid proof refuses; a later
eligible batch may then win. A stale competing batch refuses. Sequential
batches in one block can advance multiple epochs atomically with its cursor.
RPC agreement remains an explicit trust boundary, not a Hive light client.
Private replay also bounds aggregate source bytes, metadata and proof operations
for the entire block. Exceeding a local budget stops the block; it never lets a
later proposal overtake an earlier one.

The plan journal uses logical input identity before any wallet put. A retry
after reopen reuses the original salts, proof, header and encrypted bytes.
Paid puts still use existing durable reservation and exact readback rules;
an ambiguous root upload requires explicit `reconcilePublication`, never
blind payment repetition. Storage/CPU/NET come from the user's own selected
adapters and bounded authorizations. No estate funding fallback exists.

## Running and integrating

```sh
cargo build --locked --release --manifest-path crates/btungsten-p3count/Cargo.toml --bin repository-proof
```

The wallet integration calls `preparePrivateBatch` with its local store,
externally pinned state, prior batch pin/frontier, accepted input candidates,
explicit proof organ, and byte budget. It then calls `publishPrivateBatch`
with the existing private profile and authorized `put/get` rail capabilities.
The default aggregate plaintext budget is 64 MiB and default capacity 32;
there is no implicit cloud prover or writer discovery.

```js
const engine = repositoryProofEngine({ binary: userSelectedBuiltOrgan });
const before = store.current();
const plan = await preparePrivateBatch({ store, engine,
  state: before.state, trustedStateDigest: externallyTrustedStateDigest,
  previous: before.batch.pin, frontier: before.batch.frontier,
  updates, maxBytes: userByteBudget });
const publication = await publishPrivateBatch({ plan, store, rails: walletAuthorizedRails, privacy });
```

CLI consumers use the same bootstrap/readers/vault environment contracts as
`STORAGE.md`. Build the existing read-only native rail organ when remote
ANT/AR retrieval is needed. An empty readers array works for locally cached
encrypted bytes. Commands are local; `hive-op` remains unsigned/unsubmitted.

```sh
node tools/repository-contract/storage-cli.mjs batch-apply --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --checkpoint sha256:TRUSTED_STATE --previous-batch /trusted/prior-batch.json --pointer /private/batch-pointer.json --readers /private/readers.json --vault-env REPOSITORY_VAULT_KEY --proof-binary /built/repository-proof
node tools/repository-contract/storage-cli.mjs sync-hive --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --readers /private/readers.json --vault-env REPOSITORY_VAULT_KEY --proof-binary /built/repository-proof
node tools/repository-contract/storage-cli.mjs batch-receipt --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --pointer /private/batch-pointer.json --readers /private/readers.json --vault-env REPOSITORY_VAULT_KEY --proof-binary /built/repository-proof
node tools/repository-contract/storage-cli.mjs batch-verify --receipt /chosen/disclosure.json --previous-batch /trusted/prior-batch.json --proof-binary /built/repository-proof
```

The last two commands are user-selected disclosure and opaque relation
verification. They grant no repository authority. The ordinary `owner`
command still checks native bzDiD head/sequence against the pinned policy;
identity, Vaulta/EVM account resources and wallet settlement keep their own
existing contracts. This lane performs no live signing or broadcast.

## Scale, privacy and measured limits

There is no O(all users) registration, heartbeat or per-person chain row.
Logs are per chosen repository/stream; any authorized peer can construct its
next batch from compact local state. A batch can carry up to 64 updates
under one ordering leaf/notice. No compulsory estate sequencer or prover is
introduced. A verifier follows chosen repositories, not ten billion users.

The ten-billion-position frontier test uses synthetic previously pinned
subtree hashes to exercise index arithmetic, path bounds and append
verification without materializing that history. It is **not** ten billion
users, messages, stored identities, deployed throughput or retention.
Global adoption, distributed capacity, live fee/latency and provider retention
remain unmeasured. Private replicas still retain their own chosen history;
pruning, selective multi-repository aggregation and production capacity need
separate implementation/evidence. This is per-repository batching.
The Hive scanner remains a correctness/reference adapter that reads full
blocks. Ten billion wallets scanning every Hive block is not a deployment
plan; permissionless selective delivery/indexing and its availability evidence
remain separate work.

Source, identity, receipts and true slot occupancy stay inside encrypted
objects/private witnesses. Public opaque disclosures reveal capacity,
context/root and append linkage. Ciphertext buckets, repeated locators,
reader tags, access patterns, routing topics, Hive account and timing remain
observable. Local plaintext/checkpoints need encrypted device storage. The
composition does not establish traffic anonymity, secure erasure or universal
“full privacy.” No on-chain STARK verifier or paid storage deployment is
claimed. GitHub continues to be stage-one live merge authority.
