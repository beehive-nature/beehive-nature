# 2026-10-17 · BNROSE-ADAPTERS-REAL — settlement adapters under partition (the successor lane opens)

Founder order: the fresh session after BNROSE-RUST-001's verified closure
("THIS IS THE FRESH NEW LANE"). The named successor qualification, verbatim
from the milestone ruling (`2026-10-15-bnrose-rust-002-milestone-ruled.md`):

> Real network partitions between sovereign hosts, followed by
> independently verified destination-side execution and finality on each
> supported settlement adapter.

Governing rule carried in force: **local exclusion protects a process;
destination idempotency protects an effect; consensus and finality must be
established independently.** And the law that binds hardest here: a worker
that dies after a request left the process is `UNKNOWN` — never
never-executed.

## Honesty commitments, written BEFORE the run

1. **The loopback destination's finality model is never promoted.** The
   landed `bnrose-dest` ladder (`advance` admin) stays what it is: a test
   model. Real rails answer finality only from the chain's own markers —
   Hive's `last_irreversible_block_num`, an EVM node's `finalized` block
   tag — each labeled with its exact semantics.
2. **Transaction ids are recomputed from canonical bytes, never trusted
   from a label.** Hive: `sha256(chain_id ∥ serialized)[0..20]` over the
   graphene serialization (differentially pinned to @hiveio/dhive 1.3.6
   reference bytes and the live chain's own record). EVM: `keccak256(raw
   envelope)` over the journaled signed bytes. A destination that cannot
   recompute the id from the submitted bytes refuses the submission.
3. **Evidence classes stay separate and named** — per rail and per
   scenario: acceptance (a node verdict), destination-side idempotency
   (duplicate delivery produces no second effect, observed at the
   destination), inclusion (membership in the documented container), and
   finality (the chain's own irreversibility marker). None implies
   another; a `duplicate` response is a reconciliation observation, never
   a success.
4. **UNVERIFIED stays UNVERIFIED.** No funded settlement key exists in
   this environment (checked: none delivered). Therefore: fresh
   production writes on Hive mainnet and Arbitrum One are NOT claimed,
   not simulated as if real, and not faked with fixtures. They are built,
   fail closed, and named for a founder key gesture.
5. **What runs real without keys, honestly labeled:**
   - the estate's own already-executed Hive mainnet transaction
     (bDroP 0001, tx `503a…1626`, block 110730400) re-verified live:
     inclusion by the documented `get_block` container, finality by LIB,
     txid recomputed from the re-serialized chain-held record;
   - a re-broadcast of that already-executed transaction — effect-free by
     construction — to witness the node's own refusal classes live;
   - Arbitrum One read legs (chain-id pinning, inclusion container,
     `finalized`-tag finality) on public transactions, node-supplied
     preimages labeled the weaker evidence class they are;
   - the full partition battery against REAL EVM node software: the
     estate's Nitro-calibrated Anvil devnet (`ops/ant-extsig`) — real
     wire, real receipts, **devnet finality explicitly labeled
     (single-node topology, not Arbitrum One production finality)**;
   - a wire-shape mock of Hive's documented JSON-RPC (the e2e mock-chain
     shapes) for adapter logic — **wire-mock class, never chain
     evidence**.
6. **The harness laws carry over unchanged:** exact signed bytes journaled
   BEFORE submission; recovery sources bytes from the authenticated
   journal and refuses without it; died-after-send = UNKNOWN; one signed
   attempt per admission; the host's local ledger stays OFF this seam.
7. Receipts land in `docs/receipts/bnrose-adapters-real/` with source,
   time, and hashes; failures are reported with their output; skipped
   steps get named.

## The build (this lane's shape)

- `crates/bnrose-settle-adapters` — Rust adapters OUTSIDE the no_std
  kernel (read paths key-free by construction, like `bindexer`'s oracle):
  Hive serializer + evidence ladder, EVM typed-transaction + keccak +
  evidence ladder, JSON-RPC clients (positional params for Hive per the
  live-earned API realities).
- `bnrose-dest-arb` / `bnrose-dest-hive` — destination binaries speaking
  the landed netpart line protocol, so the existing harness (hosts,
  `bnrose-proxy` fault modes, layer-2 test helpers) drives real rails
  unchanged. `advance` is refused: block production belongs to the chain.
- Scenario battery per rail through the proxy: healthy acceptance;
  drop-ack → UNKNOWN → journal-borne identical rebroadcast → duplicate →
  one effect; duplicate delivery; died-after-send; inclusion and finality
  observed separately, each attributed.
- Live probes (effect-free legs above) + the named founder-gesture legs.

## Residual watch item (inherited, not this lane's work)

#439's post-merge main CI was mid-flight at the predecessor's close. First
check this session: 3 success / 1 in progress / rest queued, zero
failures. Standing law: red on the merge commit heals as a descendant,
never a rerun-until-green; green owes nothing. One bounded re-check at
dispatch completion.

## The run — what landed, with receipts

Crate `crates/bnrose-settle-adapters` (workspace member 80; stack
inventory regenerated), four binaries (`bnrose-dest-arb`,
`bnrose-dest-hive`, `bnrose-rail-host`, `bnrose-adapter-probe`),
batteries `tests/mockhive.rs` and `tests/anvil.rs`, lane workflow
`bnrose-adapters-real.yml`, anvil weld in `tests.yml` (pinned foundry
v1.8.5 bundle, checksum-guarded, fail closed).

**Differentials (offline, pinned):** the Hive serializer reproduces
@hiveio/dhive 1.3.6 reference bytes AND digest byte for byte (transfer
ops; comment ops added for the chain-record path); RLP against the spec
vectors; keccak-256 against the canonical vectors AND foundry's own
`cast keccak` independently. lib suite 16/16.

**Wire-mock battery (adapter-logic class, labeled): 6/6** — healthy
acceptance with the honest pending word; duplicate delivery (one effect);
identity-binds-to-bytes conflict; hived refusal classes traveling
(expiration exits 2, conclusively); gateway-no-verdict = UNKNOWN (exit 3)
resolved later by the chain's own record; journal refuses to invent.

**Anvil devnet battery (real EVM node, devnet class, labeled): 7/7** —

- a1 acceptance is not inclusion: mempool ack, honest `pending`,
  inclusion after the node's own `evm_mine`, the node's receipt
  answering under OUR locally-computed keccak (the identity
  differential), finality honestly NOT final (the devnet's finalized
  tag stays at genesis).
- a2 duplicate delivery of UNMINED identical bytes = the node's own
  `already known` word; one admission; after the mine exactly one
  effect.
- a3 drop-ack = UNKNOWN (exit 3) while the node HOLDS the transaction;
  healing + journal-borne rebroadcast meets `duplicate`; the chain's
  record resolves. The law, exercised on real wire.
- a4 drop = UNKNOWN with the node holding NOTHING (receipt AND pending
  both absent); healing; the SAME journaled bytes accepted fresh.
- a5 the chain law: a destination pinned to the wrong chain id refuses
  to start.
- a6 a lying txId label is a CONFLICT and nothing is sent.
- a7 died-after-send: the host KILLED mid-flight; a fresh host on the
  same state observes `pending` (the node holds the dead host's
  bytes), then `included`; the journal holds ONE admission. Worker
  death never classified the effect never-executed.

**Live production receipts (effect-free, committed under
`docs/receipts/bnrose-adapters-real/`):**

- `hive-verify-bdrop0001.json` — the estate's own executed mainnet
  transaction (tx `503a…1626`, block 110730400), re-verified on THREE
  providers (api.deathwing.me, api.hive.blog, api.openhive.network):
  chain-held record re-serialized canonically in Rust, txid RECOMPUTED
  from those bytes and matching, membership in the documented top-level
  `transaction_ids` container, finality by LIB. Cross-provider
  agreement recorded as corroboration, never consensus.
- `hive-dup-probe-bdrop0001.json` — the chain's own signed record
  re-broadcast to production: hived's OWN verdict
  (`hived-refusal:expiration`, code 4030100, the now-less-than
  runtime_expiration assert) refusing re-delivery of the executed
  transaction. Effect class: none — witnessed, nothing created.
- `arb-verify-read-legs.json` — Arbitrum One read legs: chain id
  pinned 0xa4b1 on two providers; an older transaction (block
  515772085) final by the node's real `finalized` tag (515798940),
  member of its block container; a fresh transaction honestly NOT final
  (the tag has not reached it); publicnode's 403 recorded as the error
  row it is. Preimage node-supplied on this probe — the weaker class,
  labeled in the receipt.

**UNVERIFIED stays UNVERIFIED (named, fail closed, not simulated):**
fresh production writes on Hive mainnet and Arbitrum One — acceptance,
fresh-tx idempotency, and the partition battery against production
endpoints. No funded settlement key exists in this environment. The
build is complete and red-gated: deliver a key by env (the founder
gesture) and the same binaries run the battery against production
endpoints with zero new engineering.

## Live-earned lessons this lane (worth keeping)

- anvil's `finalized`/`safe` tags stay at block 0 — devnet finality
  via the tag is honestly never-final; the SAME code path reads the
  production tag in the probes (final=true on Arbitrum One).
- anvil refuses a resubmit of MINED bytes with the nonce class; the
  `already known` duplicate word belongs to UNMINED identical bytes.
  Both are pinned in the battery.
- hived's refusal message spells the expiration class with SPACES
  (`transaction expiration exception`) — underscore-only patterns
  miss it; and a `duplicate` verdict must be read from the MESSAGE,
  not the structured data (an assert's data blob can carry such a
  field).
- ureq's pooled keep-alive once hung against anvil while the
  transaction landed: the rail sends `Connection: close` — one
  complete round trip per call, no pool.
- hex ids on the EVM wire carry a `0x` prefix; every comparison trims
  both sides (three defects in this family were caught by the battery,
  never by review).
- `std::process::exit` skips Drop: the claim must release before the
  exit (the landed layer-2 law, relearned in the rail host), and a
  KILLED holder's claim is adopted explicitly on recovery — never
  automatically.
