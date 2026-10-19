# Peer-owned repository storage and checkpoint replicas

GitHub remains stage one: source hosting, PRs and live merge authority. These
commands operate a **shadow replica on the user's device**. There is no HTTP
server, estate endpoint, global user database, wallet creation, background
service or founder funding source in this layer. The repository/ref is the
transaction scope; replicas subscribe to the repositories their users choose.

## Contracts reused

| Responsibility | Existing implementation and this consumer |
| --- | --- |
| Identity | `crates/bzdid::resolve_did`; `repository-owner` checks the sovereign user's proof, exact independently pinned head/sequence and explicit clock. `providers.mjs::verifyOwner` matches its current ML-DSA-65 key to an already trusted repository policy. A DID cannot authorize its own policy. No Vaulta account is required to create/verify a DID or read. |
| Repository authority | Unchanged `contract.mjs::acceptUpdate`, bPay canonical commitments and frozen bSigner envelopes. Owner and executor thresholds still apply after decryption. |
| Confidential bytes | `privacy.mjs` consumes `surfaces/bpq.js::seal/open`: the existing BPQ format, hybrid X-Wing (ML-KEM-768 + X25519) recipient wrapping, AES-256-GCM segments, and the wallet's existing self-vault option. No new cipher implementation. Rust `bsigner bpq-open` independently opens a repository fixture in CI. |
| ANT/AR retrieval | `repository-rail` invokes `atmirror::autonomi::AntCli` or `atmirror::arweave::ArweaveRail`, read-only, with an explicit client/gateway. The caller rehashes every response. AR stream and ANT in-process read buffers have a caller ceiling. The external ANT client's download disk/network budget remains its own responsibility. |
| User-funded publication | `publishBundle` requires explicit wallet-owned `put/get` capabilities; the supplied writer owns the existing bPay/AntPay invoice, bounded authorization and reconciliation. There is no default paid writer, key, gas sponsor, native CLI upload or funding fallback. The built-in reader cannot write. |
| x0x discovery | Existing `/direct/send` request and history payload shapes. Logical ID is the notice byte digest, persisted per authenticated sender. A transport ID, delivery or acknowledgement never changes repository authority. |
| Hive witness | Existing custom_json and LIB model, and `keychain-release::normalizeNodes`. All configured operators must agree on complete ordered block operations, not just a filtered candidate. Posting is an unsigned wallet operation; no broadcast occurs here. |
| rustEOS / Vaulta / EVM | Existing `SPEC-RUSTEOSVM-1` operation identity, bounded authority, replicated dispatch journal and UNKNOWN recovery remain the execution/settlement boundary. This replica neither executes recipes nor turns a local SQLite commit into a rustEOS durable acknowledgement. Wallet-owned RAM/CPU/NET and EVM settlement stay with those adapters. |

## Storage and privacy

`publishBundle` requires a `repositoryPrivacy(...)` instance. No plaintext or
unverified plugin claiming to encrypt is accepted. The private root contains
the manifest, policy, signed proposal, signed qualifications and pointers to
encrypted payloads. Source objects and observations are encrypted individually;
their plaintext size/digest inventory is inside the encrypted root.

Plaintexts are framed and padded to power-of-two buckets (minimum 4 KiB), then
sealed using BPQ. Reader cards are verified with BPQ's existing card verifier.
The user's wallet supplies an existing self-vault key or recipient cards and
opener credentials; this code never generates a production identity. Local
sealed-byte reuse is keyed by plaintext digest and audience commitment, so a
restart does not re-encrypt/re-upload unchanged objects for the same audience.
Changing the audience creates fresh ciphertext. This cannot revoke plaintext
or keys a previous reader already obtained.

The database is **private local working state**, including decrypted accepted
objects and checkpoints. Use the user's encrypted device storage; SQLite here
does not provide disk encryption. Wallet secrets are never stored in it.

Public notices carry only a wallet-chosen random routing topic and encrypted
root locator. Never derive the topic from a guessable name, repository or DID.
They omit names, refs, identities, policy keys and plaintext commitments.
Ciphertext buckets, object counts/access patterns, repeated locators, the Hive
posting account and timing remain observable. This is content confidentiality,
not full anonymity or traffic-analysis resistance.

The existing ZK `contracts/zkreceipts/count.circom` proves cohort counts over
private receipts. It does **not** prove repository acceptance, and a
`zk_verified:true` field is refused rather than treated as evidence. Its PLONK
proof is not a PQ proof system. A private/PQ repository validity circuit,
qualified verifier, anonymous ordering and metadata protection need their own
scoped implementation and evidence before any “full privacy” claim. No
classical chain signature is promoted to a PQ authorization: repository
authorization still comes from the pinned ML-DSA-65 policy.

## Atomicity and ordering

`CheckpointStore` uses SQLite WAL, `synchronous=FULL`, `BEGIN IMMEDIATE` and an
explicit predecessor compare-and-swap. Accepted state, verified payloads and
decision are one transaction. The race test starts two independent OS
processes with different eligible proposals: exactly one wins. The crash
tests exit the worker immediately before/after its actual COMMIT and reopen
the database: all of the checkpoint and its objects, or none, survive.
This is process-crash testing; hardware/OS power-loss guarantees remain those
of SQLite and the underlying filesystem. A replica's local writer is trusted;
unkeyed database hashes do not protect against an owner rewriting that database.

`local-shadow` allows local CAS experiments. `hive-shadow` refuses that entry
point and advances in contiguous finalized block/transaction/operation order
from an **externally pinned block ID and repository state**. It rechecks the
cursor inside the transaction after network reads. Complete ordered operations
from every configured node must agree; duplicate host spellings do not count
twice. A gap, finalized fork, irreversible-height regression, disagreeing or
unavailable operator refuses. This is configured RPC agreement, not a Hive
light client or proof of independent operators.

Every matching proposal's private bytes must be available before the block
can commit. Missing/corrupt/unreadable bytes stop the block, so arrival speed
cannot let a later competitor overtake an earlier one. Invalid signatures
refuse; the first eligible proposal wins; another proposal naming its old
checkpoint refuses as stale. This fail-closed availability choice permits a
publisher to stall its repository by publishing an unreadable bundle. It does
not create an estate sequencer or affect other repositories.

Upload reservation is persisted **before** the wallet writer is called. After
an unknown outcome, another attempt refuses `PUBLICATION_UNKNOWN`.
`reconcilePublication` must retrieve exact ciphertext at an explicitly supplied
location before publication can continue. A successful put response never
counts as retrieval. Readback is a point-in-time observation, not retention.

## Running a replica

Node 22.13+ (built-in SQLite), Git, and the existing Rust workspace:

```sh
cargo build --locked -p atmirror --bin repository-rail -p bzdid --bin repository-owner
node tools/repository-contract/storage-cli.mjs init --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json
node tools/repository-contract/storage-cli.mjs status --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json
```

Write JSON with the existing `canonicalDocument` function. Bootstrap fields:
`{state, trusted_state_digest, ordering}`. `state` is the prior contract's
state; its digest must come through a trusted channel outside the package.
Ordering is `{mode:'local-shadow'}` or
`{mode:'hive-shadow', account, topic, nodes:[twoOrMoreExplicitOrigins],
cursor:{height,block_id}}`. The entire bootstrap is pinned on first open and
must remain identical on reopen. There are no default node URLs/accounts.

```sh
node tools/repository-contract/storage-cli.mjs apply --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --package /private/package --packet /private/packet.json --checkpoint sha256:TRUSTED_PREDECESSOR
node tools/repository-contract/storage-cli.mjs fetch --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --pointer /private/root-pointer.json --readers /private/readers.json --vault-env REPOSITORY_VAULT_KEY --out /private/new-package
node tools/repository-contract/storage-cli.mjs sync-hive --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --readers /private/readers.json --vault-env REPOSITORY_VAULT_KEY
node tools/repository-contract/storage-cli.mjs hive-op --database /private/replica.sqlite --bootstrap /trusted/bootstrap.json --pointer /private/root-pointer.json --topic sha256:RANDOM_ROUTING_TOPIC --account USER_CHOSEN_ACCOUNT
node tools/repository-contract/storage-cli.mjs owner --owner /private/owner-proof.json --policy /trusted/policy.json
```

Readers JSON is an array of `{binary,scheme,endpoint}`. `binary` is the built
repository-rail, scheme is `ant` or `ar`; endpoint is an explicit installed ANT
binary or AR origin, including a user's loopback node. CLI self-reader mode
reads a base64url 32-byte **wallet-derived vault key** from the named environment
variable, never argv or a file in the package. Shared X-Wing readers use the
module API with the existing wallet's decapsulator. Owner-proof JSON carries
`{binary,did,genesis,rotations,head,sequence,clock}`: public proof paths, not keys.
`owner` checks identity-to-policy compatibility; it does not update policy,
rotate repository authority or create a Vaulta/EVM account.

The publish module is called by the user's wallet integration with explicit
authorized writers; there is deliberately no CLI that silently discovers a
funded key. The wallet still owns the exact artifact/invoice/payment consent.
Returned bytes can be restored by the existing package CLI into a fresh bare
Git repo without GitHub or a remote/alternates dependency.

## Scale and measured scope

The ten-billion-user target follows `docs/bzdid-architecture-decision.md`:
free off-chain identities, no compulsory native Vaulta account per person,
user-funded updates/resources, and existing BEELOG proof/epoch-root work for
batched naming. This lane adds no O(all users) registry, heartbeat, per-user
chain row, founder subsidy or required central server. Replica storage grows
with repositories and changes a user elects to keep; encrypted unchanged
objects avoid duplicate upload. CI reuses the existing workspace build/jobs.

This block-scanning Hive adapter is a correctness/reference replica. Having
ten billion wallets scan every Hive block is not the scaling plan. Production
batch ordering/proofs, permissionless proof availability, pruning, pagination,
publisher throughput, paid storage capacity and end-to-end latency/cost at
that scale remain unqualified. The local CAS and mocked rail/Hive tests do
not establish distributed consensus capacity, live ANT/AR retention, mainnet
settlement, a deployed Vaulta repository contract, or full privacy.
