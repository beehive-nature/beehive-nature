# 2026-10-16 — ant-protocol v5 compatibility watch: the final-pointer semantic boundary, verified in source; pins audited; no upgrade ordered

**Seat:** zCode (autonomi watch). **Disposition: Beacon unchanged; no production
upgrade, no funds movement, zero mutations to `ops/` or the box.** The incoming
October-17 digest arrived as a founder paste with ChatGPT-provenance UTM links;
per the verification-timing and claim-evidence laws, every load-bearing claim
was re-verified against primary sources (`gh api` on tags, changelogs, ADR, and
source files at exact tags) before being repeated here. Two of its framings are
corrected below (§5, §1); the rest reproduced exactly.

## 1. Verified release train (gh api: tag + published_at)

| Release             | Tag                  | Published (UTC)       | Notes |
| ------------------- | -------------------- | --------------------- | ----- |
| ant-protocol v3.0.0 | `v3.0.0`             | 2026-09-24T04:38:29Z  | first 3.x major |
| ant-protocol v3.1.0 | `v3.1.0`             | 2026-10-01T00:31:55Z  | **BNR's pin** |
| ant-protocol v4.0.0 | `v4.0.0`             | 2026-10-08T21:49:50Z  | pointers on the wire + settlement-version scheme (§5) |
| ant-protocol v5.0.0 | `v5.0.0`             | 2026-10-16T02:01:44Z  | final-state rule (§2) |
| ant-node v0.23.0    | `v0.23.0`            | 2026-10-16T02:27:41Z  | depends `ant-protocol = "5.0.0"` (its Cargo.toml at tag, line 38) |
| ant-cli 0.3.11      | `ant-cli-v0.3.11`    | 2026-10-16T03:05:19Z  | lives in the **ant-client** repo; a standalone `WithAutonomi/ant-cli` repo 404s |

The digest's dates all reproduce. The v5 release was published 2026-10-16 UTC,
not Oct 17 (the digest itself already carried that correction).

## 2. The semantic boundary — code receipts, boundary located exactly at v4→v5

The digest said "the critical issue" is that older nodes apply a different
replacement rule to the same serialized pointer. Verified in source, at exact
tags, file `src/pointer.rs` of `WithAutonomi/ant-protocol`:

- **v3.1.0 (BNR's pin)** — merge rule (doc, lines 436-437): `1. larger counter
  2. smaller target bytes`; body (line 457):
  `self.address == other.address && self.rank() > other.rank()`. The doc
  comment states the consequence plainly (lines 450-454): at
  `counter == u64::MAX` "the order still holds … the pointer is **not
  frozen** … a terminal pointer can still be moved — but only ever toward
  smaller target bytes, and never back." ADR-0018's Context quantifies the
  takeover: a former owner "can sign another state at `u64::MAX` whose target
  sorts first — about two tries of grinding — and it displaces the handover on
  every node, deterministically."
- **v4.0.0** — carries the *same* 3.x rule (grep at tag: "terminal pointer can
  still" / `replaces()` at line 457; no `FINAL_COUNTER`). The boundary is
  exactly **v4→v5**, not 3→4.
- **v5.0.0** — rule 0 added (line 483): `0. a final state (counter ==
  u64::MAX) is replaced by nothing`; body:
  `self.address == other.address && !other.is_terminal() && self.rank() > other.rank()`;
  `pub const FINAL_COUNTER: u64 = u64::MAX` (line 111).
- **Wire indistinguishability verified:** `POINTER_FORMAT_VERSION: u8 = 1` in
  v3.1.0 (line 83) **and** v5.0.0 (line 105). The same serialized records
  settle differently under the two rules and nothing on the wire says which
  rule a peer applies.
- **Upstream's own warning** (v5.0.0 CHANGELOG, "Changed"): "a node on the
  3.1.0 rule still lets a smaller-target final state displace the first one,
  so while a network runs both, the same records can settle differently on
  different nodes. Nothing on the wire tells the two rules apart: the pointer
  format version is still 1." — and it names our exact generation: "Under the
  rule published in 3.1.0, which `ant-node` 0.21.0 runs, a former owner could
  grind a smaller target at the same counter and take the address back from
  every node."
- **ADR-0018** (`ant-node` at tag `v0.23.0`,
  `docs/adr/ADR-0018-pointer-transfer-by-final-redirection.md`): Status
  **Proposed**, dated 2026-09-29, amends ADR-0016's merge rule at the final
  counter; acknowledges the residual failure mode by name — "A race is a
  permanent fork" (owner signs two final states; each node keeps whichever it
  took first; readers settle by close-group majority, and a forked read fails
  as `Forked` rather than guesses). Shipped in code while still Proposed, as
  the digest said.

## 3. BNR pins audited (read-only; nothing changed)

| BNR surface | Pin | Resolved | Generation |
| ----------- | --- | -------- | ---------- |
| `ops/ant-extsig/Cargo.toml:11-12` | `ant-node = "=0.21.0"`, `ant-protocol = "=3.1.0"` (exact `=`) | Cargo.lock: ant-protocol 3.1.0 (crates.io) | the 2026-10-01 train (node v0.21.0, protocol v3.1.0, ant-cli 0.3.9 all published Oct 1); upstream itself names node 0.21.0 as running the 3.1.0 rule |
| `ops/ant-extsig/Cargo.toml:10` | `ant-core` git rev `681d48f30b9de50c262ebfc10cce6111cfc878b1` (PUBLIC-CONSTANT recorded commit) | git pin | ant-client, pre-dates the v4/v5 wire additions |
| `tools/antd-bridge/Cargo.toml:8` | `ant-protocol = "2.4.0"` (loose caret) | Cargo.lock: 2.4.0 | **a third in-tree generation** the digest missed; 2.x predates pointers entirely and cannot cross the 3.0 semver edge |

The digest's pin table reproduced exactly. Addition: the exact `=` pins mean
cargo cannot drift the extsig pair — node 0.21.0 and protocol 3.1.0 stay
coherent, so the mixed-rule network state upstream warns about cannot arise
inside BNR's own devnet without a deliberate pin change.

## 4. Blast radius on BNR today: none exercised

- ant-extsig imports (`src/main.rs:66-71`): `ant_core::data::{Client,
  ClientConfig, ExternalPaymentInfo, LocalDevnet, PaymentMode, Visibility}`,
  `ant_node::devnet::DevnetConfig`, `ant_protocol::evm::Wallet`,
  `ant_protocol::transport::MultiAddr`. **No pointer API anywhere in the
  harness.** The single `pointer` token (`src/gate.rs:139`, `v.pointer(ptr)`)
  is `serde_json::Value::pointer` — a JSON-pointer lookup on the spend-gate
  file, unrelated to Autonomi pointers.
- The harness runs its own `LocalDevnet` of the pinned node — a self-contained
  0.21.0/3.1.0 network. Cross-version pointer divergence is an
  **upgrade-time** risk (a migration window running mixed 3.1-rule/5.0-rule
  nodes), not a current-deployment defect.
- Immutable chunks stay clean: the v4 wire additions are appended variants
  ("appended after every existing variant so the discriminants above keep
  their wire values and a peer built before pointers rejects them cleanly as
  unknown rather than misreading them"; "peers built against `2.3.x` decode
  unchanged"), and v5's rule 0 changes nothing below the final counter. Per
  the digest's own framing, held here as law for the follow-on lanes: a
  pointer-only incompatibility must not be reported as a chunk/network
  failure, and the chunk path must not be cited as proof an upgrade is free.

## 5. Digest correction #1: v4 was not merely a transport bump

The digest's table called v4.0.0 "Shared transport dependency upgrade". The
v4.0.0 changelog (at tag) shows v4 = **pointers go on the wire**
(`ChunkMessageBody::{PointerPutRequest, PointerPutResponse, PointerGetRequest,
PointerGetResponse}`) **plus a payment-settlement compatibility scheme**:
`CURRENT_SETTLEMENT_VERSION` / `MIN_SUPPORTED_SETTLEMENT_VERSION`,
`ChunkQuoteRequestV2` / `MerkleCandidateQuoteRequestV2`,
`SettlementCompatibility` (bounded at **both** ends), and
`ClientUpdateRequired` / `StorerUpdateRequired` errors — motivated by
ADR-0008, where older clients kept collecting quotes, paid 1x on-chain, and
had every storer refuse *after the payment had settled and become
unrefundable*. That payment lesson, not the pointer rule, is the part with a
direct BNR-harness analogue: ant-extsig's `Paid::Wave(HashMap<QuoteHash,
TxHash>>` (`src/main.rs:548`) rides the pre-V2 quote path. The "transport
dependency" characterization is neither contradicted nor re-derived — UNVERIFIED
by this seat.

## 6. Substrate doc corrected (digest item, done this commit)

`docs/storage-substrate-split.md` now carries a dated **CORRECTED 2026-10-16**
blockquote under its top NOTE: the August "immutable chunks only" resolution
stands as a dated snapshot; upstream capability moved (pointers on the wire at
v4.0.0; final-state transfer semantics at v5.0.0; format version still 1).
Whether the **live public network** serves pointers today is UNVERIFIED here —
the ant-node v0.23.0 release notes state download/signing facts only (ML-DSA-65
signed artifacts, DigiCert EV on the Windows binary), and network composition
is not derivable from them. Deliberately an upstream-capability correction, not
a live-network claim.

## 7. Follow-on lanes (queued; NEXT OWNER named per the no-stall law)

1. **bTunGsTeN mixed-version adversarial matrix** — NEXT OWNER: bTunGsTeN seat.
   Plan, verdict classes per the acceptance-harness laws (strict validation
   before class assertions, parent-owned FAILS, refusal = nonzero status +
   message):
   - `BASELINE-IMM` — immutable put/get across a mixed 0.21.0/0.23.0 swarm.
     Control leg: proves any later divergence is pointer-only, and that
     immutable chunks are not mislabeled a network failure.
   - `PTR-TERMINAL-BEFORE` — publish a final state (counter `u64::MAX`) via a
     5.x node; record what 0.21.0 nodes hold after replication.
   - `PTR-REPLACE-AFTER-TERMINAL` — publish a successor state post-final:
     v5 nodes must refuse; 3.1-rule nodes must accept an equal-counter
     smaller-target record. This is the divergence receipt.
   - `PTR-RIVAL-FINALS` — two final states raced across a partition, then
     heal: ADR-0018's permanent fork; record the majority/minority split and
     the `Forked` read behavior.
   - `RECONNECT` — restart the minority; divergence persisting is accepted
     upstream behavior, documented as such, not a BNR defect to "repair".
   - `OWNERSHIP-TRANSFER` — `transfer_to` resolution read on both sides.
2. **Migration gate** — NEXT OWNER: node-lane seat, founder trigger only.
   Gate = matrix green + performance measurements + rollback evidence (pin
   restore rebuilds and rejoins), with chunk-path parity reported separately
   from pointer semantics, and the v4 settlement-version scheme exercised
   before any quote-path change.

## 8. Watch: already covered — no new automation

The standing 09:00 daily-review cron's AUTONOMI baseline already reads
"v0.21.0/0.3.9/v3.1.0/v0.28.0/v0.37.0/v0.12.0, ADR 18" — a pin-aware,
ADR-aware targeted watch in substance, exactly what the digest proposed to
create. A second cron would duplicate it, and this seat creates crons it
cannot delete. **No new automation.** New baseline values for the next daily
run to report drift against: node **v0.23.0**, cli **ant-cli-v0.3.11**,
protocol **v5.0.0**. The founder may refresh the cron prompt's embedded
numbers at convenience (one edit); until then the drift report IS the trigger
working.

## 9. Side note, verified

Arweave `N.2.9.7-alpha2`: tag exists, published 2026-10-15T23:22:33Z, GitHub
prerelease flag **false** — consistent with the digest's observation that the
alpha status lives in the maintainers' wording, not the release metadata. No
BNR action.

## UNVERIFIED (named, per law)

- Live public Autonomi network pointer availability/composition — protocol
  capability ≠ network deployment.
- "v4 = shared transport dependency upgrade" framing (v4's pointer +
  settlement content IS verified; the transport characterization is not).
- antd-bridge runtime behavior on 2.x latest — manifest + lock verified; no
  build run (read-only audit).

**Carry-overs:** §7 items (bTunGsTeN matrix, migration gate); cron baseline
refresh (founder convenience, §8).

**HUMAN INTERACTION: NONE** — **NEXT OWNER:** §7 lanes as named; merge of this
PR = this seat (docs + one dated doc correction, no code paths touched).
