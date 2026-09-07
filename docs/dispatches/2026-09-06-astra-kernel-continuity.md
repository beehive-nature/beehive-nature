# BNRoSe continuity audit — primitives before providers

**Serves L1 (eternal data) and L2 (rebuildable runtime); identifies L3 resource
constraints.** Read against base `526d90eb367b164dab765ae54c6023bfe07d484e`.
Scope: source review of the seams cited below and an additive offline archive
verifier. This is neither a new constitution nor a completed distributed runtime.

The founder's targets are at least 1,000 years and 10 billion users. They are
design requirements to falsify with evidence, not results established by this
audit. The production server is a replaceable bootstrap resource. Its loss must
eventually be an ordinary provider failure; today that property is incomplete.

## Authority read before implementation

- [CONSTITUTION](../CONSTITUTION.md), Articles I–VII: exactly **Identity, Intent,
  Event, Evidence, Knowledge, Resource, Settlement**. Capability is reserved,
  not an eighth primitive added by an implementer. Reputation is recomputed
  from evidence; the kernel does not mandate a universal score.
- [Article VI §3](../article-vi-s3.md) is ratified despite the constitution's
  older draft heading. Amendment authority moves through measured epochs.
  Evidence/reputation parameters and amendment rules are meta-tier content.
  This audit changes none of them. A self-learning adapter cannot amend them.
- [BNRoSe-0 §0.1](../SPEC-BNROSE-0-CHARTER.md): eternal data, deterministic
  replay, and metered ephemeral compute are three separate obligations.
- [BNRoSe-3 §§1.3, 2.2](../SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md): archived
  history is not the live chain tip; external notaries anchor commitments,
  not bulk data. The epoch format and full-chain cold-start procedure remain
  explicitly undrafted there. This patch does not silently fill those rulings.
- [Storage split §1](../storage-substrate-split.md) and
  [`atmirror::route`](../../crates/atmirror/src/route.rs): identity records use
  Arweave primary/Autonomi mirror; browser-readable content and bulk have their
  own routing rules. The Charter's shorthand cannot replace this detailed rule.
- [BNR OSe reproducibility constraints](../architecture/bnr-ose-spec.md): a
  replaceable runtime needs a pinned, reproducible build and a fresh-install
  receipt. A drafted image recipe is not a booted system.

## Seven primitives: observed mechanism and the remaining proof

| Primitive | Source observed | What remains to demonstrate |
|---|---|---|
| Identity | `onboarding::RootIdentity`, `Enrolment`, persona bindings; `atmirror::restore::Authorship` distinguishes supplied-key verification from no authorship check | Recover and rotate a root on a new device using independently verified history. `RootIdentity.anchored` remains a public boolean; it does not implement an anchor witness. The storage-split document already records this debt. No newly invented DID method is assumed. |
| Intent | `dro_signer::settlement_intent` is a pure decision; `ZanoSigner` is the execution seam. `banchor::approval::PlanGate` handles application plans | General planning/admission and durable execution receipts must preserve attribution, expiry and authorization across restart. A narrow settlement intent is not evidence that every workload already follows the same discipline. |
| Event | `shared_types::CanonicalEvent`; `event_bus::EventBus`; `escrow_engine::EscrowEngine::apply` | A durable event journal, cursor recovery, gap detection and duplicate-safe replay in the composed runtime. The in-memory bus explicitly drops events with no subscribers and reports lag to slow subscribers. Its tests prove those limited semantics. |
| Evidence | `shared_types::Evidence`, `Provenance`, `ViewGrade`; `sense-atproto` boundary; `reputation_engine::compute` | Preserve provenance and validator versions through archival/replay; demonstrate independent witnesses at the required grade. A recorded `signed`/`verified` field is a claim from a producer, not a substitute for verification at its trust boundary. |
| Knowledge | Constitution Article II requires attributable versions linked to predecessors; spend receipts expose a narrower `prior_receipt_id` | A general Knowledge reconstruction path was not demonstrated in the inspected seams. A transcript, index, or mutable database alone does not establish the constitutional predecessor invariant. This is a coverage limit, not a claim that no application stores knowledge. |
| Resource | `shared_types::spend::{ResourceClass, LineItem, Rate}`; `atmirror::route`; `bmesh-meter` | Provider selection and admission must budget connection state, bandwidth, memory, disk, queue depth and cost, including recovery work. The router incident demonstrates that a time limit or peer-count setting alone is insufficient evidence. |
| Settlement | `escrow_core` state transitions and snapshot tests; `dro_signer::{settlement_intent, settle_transition}` | Independent chain reconciliation, durable duplicate prevention and actual signer integration. `composition::dro_loop` still uses `MockChainView`/`MockSigner`; no live settlement capability is inferred from it. |

Source map: [onboarding](../../crates/onboarding/src/lib.rs),
[events](../../crates/shared-types/src/events.rs),
[evidence](../../crates/shared-types/src/evidence.rs),
[spend](../../crates/shared-types/src/spend.rs),
[escrow engine](../../crates/escrow-engine/src/lib.rs),
[signer](../../crates/dro-signer/src/lib.rs),
[composition](../../crates/composition/src/lib.rs),
[reputation](../../crates/reputation-engine/src/lib.rs),
[application approval](../../crates/banchor/src/approval.rs).

## What already provides independence, and what does not

`atmirror::restore::restore` receives a rail and optional caller-supplied
signing key. It checks CAR/block/MST/blob integrity and reports authorship
separately; this module imports no DID resolver or PDS client. The July 25
receipt and tests describe a real social-repository recovery mechanism.
That scoped success must be preserved. It is not a recovery receipt for the
whole production estate or every chain's block history.

`reversibility::Quorum` counts declared operator independence and refuses
configurations one operator can satisfy. The declaration itself is not proof
of independent ownership. Two URLs controlled by the same party are not two
independent recovery sources. See [source](../../crates/reversibility/src/lib.rs).

`reputation_engine::EventStore` still has `MockStore` as its implementation in
that crate. `composition::run` accumulates process-local state and passes `None`
as the SHIP watermark. Its consumers break on broadcast receive errors; the
claimed shutdown drain does not establish lossless recovery after lag or
process death. Those facts make persistence/replay an open build requirement,
not a reason to choose a permanently centralized message broker.

## Implemented now: verify the archive before exposing records

The existing `bnr-archive::batch::build_batches` writes deterministic v1 batches
and a manifest, with pinned golden digests. Its reader existed only as a test
helper. This audit adds [verify_archive](../../crates/bnr-archive/src/verify.rs)
without changing any producer bytes, canonical event fields, or constitutional
semantics, and without adding a dependency.

The caller supplies the expected manifest and fetched batches. Verification
requires exactly the complete batch set, sequence from one, matching SHA-256
digests, matching member counts/byte totals, valid framing, strictly increasing
names across every batch, and explicit byte/record/name budgets. Truncation,
trailing bytes, huge declared lengths and duplicates are refused. It returns
borrowed records only after the whole archive passes; it writes no filesystem
paths and executes no records. Receiving adapters must bound downloads and
manifest parsing before handing already-allocated bytes to this function.

**Trust boundary:** SHA-256 here checks bytes against a supplied manifest
(`verify_archive`, `Sha256::digest`). It does not establish who issued the
manifest, its freshness, a record's truth, or availability for a millennium.
A provider replacing both the manifest and its bytes can make a different
self-consistent archive. An authenticated expected manifest, its discovery,
key history, and independent availability are still required above this seam.
Record names are opaque archive identifiers; extraction needs receiving-OS
path and collision checks. No safe disk-extraction API is claimed.

Reproduce: `cargo test -p bnr-archive --locked` → **14 passed, 0 failed** on
Windows in this audit: six existing producer tests plus eight receiving tests.
One serializes batches/manifest, removes its temporary source directory, drops
the producer result, reloads only saved artifacts, then recovers exact records.
Others reject missing/reordered/modified batches, every truncated prefix,
oversized lengths, unknown versions, malformed names and exceeded budgets.
The existing golden vectors pass unchanged. This is an offline library test;
it is not a multi-provider retrieval or whole-runtime disaster rehearsal.

## Acceptance ladder for the decentralized runtime

1. **Recover data without the bootstrap.** On a fresh isolated target, recover
   identity history, canonical events/evidence, user objects, meter state and
   configuration from named independently available copies. Verify expected
   manifests and keys before use. Record which state is authoritative,
   reconstructible cache, chain-recoverable, or irrecoverable without owner keys.
   Exercise unavailable and corrupt providers, not just the healthy primary.
2. **Rebuild state without repeating actions.** From version-pinned inputs and
   code, reproduce state on a second implementation/architecture. Interrupt
   before and after durable append/acknowledgement, duplicate delivery, remove
   a segment, lag a consumer, and supply conflicting tips. Recover or refuse;
   do not silently advance a cursor, mint reputation, or repeat a payout.
   External effects require an idempotent execution boundary and reconciliation;
   replay is not permission to re-execute historical intents.
3. **Replace the provider under bounded resources.** Demonstrate two actually
   independent providers and owner-authorized handover. Enforce aggregate
   household-device network budgets, backlog limits and repair budgets. Pause
   when capacity or verified inputs disappear. Repair traffic must not turn a
   partial outage into the next apartment-router failure.
4. **Learn with accountable authority.** Learning proposes plans and supplies
   `AiInference` evidence. A deterministic admission check consumes authority,
   budget and observed facts; accepted effects generate receipts/events.
   Test forged observations, revoked authority, stale plans and exhausted
   budgets. Policy/model rollback must preserve its history. Reputation and
   constitutional amendment authority remain governed by ratified Article VI.
5. **Exercise evolution, not just uptime.** Archive schema/algorithm identifiers,
   migration tools and build inputs with historical vectors. Prove old records
   remain readable after an additive upgrade and key rotation. Run a clean
   image install before claiming a reproducible shipped OS. Explicitly model
   key loss, cryptographic migration, provider/economic failure and operator
   succession; no current storage network supplies evidence of 1,000-year uptime.

These are engineering acceptance proposals under existing invariants. This
dispatch does not ratify a new epoch wire format, spend policy or amendment.

## Ten-billion-user sizing: declare assumptions before a benchmark

For an illustrative workload of **100 events/user/day, 1,000 bytes/event,
10 billion users**, raw ingest is **1 trillion events/day ≈ 11.6 million/s**
and **1 PB/day** in decimal units, before indexes, evidence objects, signatures,
replication and repair. Three complete copies would be 3 PB/day; 365-day years
over 1,000 years would total 1.095 ZB, assuming that workload remains constant.
These are arithmetic scenarios, not traffic measurements or forecasts.

The relevant benchmark therefore includes bounded per-participant state,
partitioned history/discovery, consumer catch-up, independently verified
checkpoints, repair amplification, and a measured fraction requiring globally
ordered settlement. Broadcasting every event to every user contradicts the
scale target. A snapshot accelerates replay only when its provenance and
relationship to retained history are verifiable; it cannot stand in for missing
history by assertion. Actual formats, workloads and hardware must supply the
next measurements. None of the local tests here demonstrates 10-billion-user
capacity.

## The apartment incident is the first resource-admission case

The [installed SSH helper](../../ops/x0x/LAPTOP-NETWORK.md) makes today's laptop
usable without its helper starting a public mesh node. It is bootstrap access,
not completion of decentralization. The durable lesson is **participation must
fit the owner's network capacity without harming other occupants**. A full
storage/relay node need not run on every user's Wi-Fi for users to retain
identity and verification authority. Replacing the current box with an
independent provider must retain those boundaries and be tested with the box
unavailable. Direct local-node mode remains unverified on this router.

End of dispatch. Operational findings and installed rollback receipts remain
in [the stack audit](2026-09-06-astra-stack-audit.md) and
[change receipt](2026-09-06-astra-change-receipt.md).
