# SPEC_LEXICON-1 — `com.beehivenature.receipt`

**An open AT Protocol Lexicon for permanently anchored, independently verifiable receipts.**

| | |
|---|---|
| Status | DRAFT v0.1 — awaiting founder ratification |
| Ruled | 2026-07-25 (GO; NSID ruled `com.beehivenature.*`) |
| Author seat | chat-Opus (Seat 1) |
| Deliverable class | Specification + schema. **Not host code.** |
| Supersedes | nothing |
| Depends on | `com.atproto.repo.strongRef` (dual MIT/Apache-2.0) |

---

## 1. Purpose

Any AT Protocol record — a post, a custom feed definition, an Attie Quest result, a Leaflet document — is **host-dependent**. It lives in a Personal Data Server. If that PDS goes away, or its operator declines to serve it, the record is gone. AT Protocol gives portability; it does not give permanence.

This Lexicon closes that gap. It defines a record type that binds an existing atproto record to:

- a **content hash** that anyone can recompute,
- an **Arweave transaction** holding the exact bytes,
- a **Hive `custom_json` anchor** giving public, ordered, timestamped existence.

The result: a researcher takes an ephemeral finding and makes it **citable and durable, for free, without anyone's permission.**

### 1.1 What this is not

- Not a fork of AT Protocol. It is additive — a new NSID in a namespace we control.
- Not a permission request. Custom-NSID records propagate through the standard firehose without allow-listing; AppViews ignore kinds they do not recognise.
- Not a competitor to Bluesky, Leaflet, or Attie. It supplies the permanence layer those products structurally lack.
- Not a signature-attestation scheme. `badge.blue` and `atproto-attestation` already occupy that space and do it well. **This anchors to external immutable ledgers; they attest with keys.** Different job, no duplication.

---

## 2. Inherited law

This spec is bound by the following standing constraints. Any implementation violating one of these is out of compliance regardless of whether it satisfies the schema.

| Law | Binding effect here |
|---|---|
| **No user incarceration** | Receipts must be verifiable by third parties with no BNR software, account, or cooperation. |
| **SCALE / DURABILITY / COST** | 10^10 users; 1,000 years; adds nothing beyond existing spend. Forces free-at-point-of-use anchoring rails. |
| **Free at point of use** | No `b` token charge at time of service. `b` accrues to contributors; it is never spent for access. |
| **L-SPLIT** | Permanence (Arweave/Autonomi) is separated from live sync (relay/firehose). This record is the *binding* between them, and does neither job itself. |
| **L-SCHEMA** | Standardise early, before adoption spreads. Hence: publish the Lexicon before shipping the tooling. |
| **L-VERIFY** | Every license claim in §8 was read from the LICENSE file in the repo tree, not a sidebar label. |
| **Mirror-by-law** | The record of truth is the BNR-controlled rail. ATProto is a broadcast mirror, never the record. |
| **Media-as-pointers** | No rail stores media inline. Every rail stores a content-address pointer. See §6. |

---

## 3. Namespace

**Ruled NSID root: `com.beehivenature.*`**

AT Protocol NSIDs are the **reverse** of a domain the authority controls (`bsky.app` → `app.bsky.*`). Authority is rooted in DNS control of the domain.

- `beehivenature.com` → `com.beehivenature.*` ✅ — domain is already held and already proven to AT Protocol via bQueenBee's domain handle.
- `bnature.social` → `social.bnature.*` — equally valid technically; **not** chosen.

**Rationale for the `.com`:** the NSID is a public contract other Atmosphere apps adopt, and it cannot be changed without a hard fork of the schema and loss of continuity for every record and adopter. It must be rooted in the domain most likely to be held indefinitely.

**Do not add a sub-segment** (e.g. `com.beehivenature.receipt.create`) — per the NSID spec that would additionally require control of `receipt.beehivenature.com`.

Primary type: **`com.beehivenature.receipt`**

> ⚠️ **One-way door.** Once published — or once adopted by a third party, which may happen without our permission — the NSID and its constraints are effectively immutable. See §9.

---

## 4. Schema

**The normative schema is the artifact, not this document.**

| | |
|---|---|
| File | `dockets/lexicon/com.beehivenature.receipt.json` |
| sha256 | `76119cb4e35f73eaf1b270b5096b21fe5db818926e6d44cd500f8f338b298dd9` | <!-- PUBLIC-CONSTANT: sha256 of the public Lexicon schema artifact -->
| Bytes | 6,501 |
| Landed | commit `1001e07` |
| License | CC0-1.0 (`dockets/lexicon/LICENSE-CC0`), schema file only |

**Why a pointer and not an inline copy.** An earlier draft of this spec carried the schema inline. Within one session the artifact and the inline copy disagreed — the artifact gained anchor `byteLength` and an `autonomi` ref that the markdown did not. Two copies of a schema drift; one copy and a pointer cannot. This is the same instinct as preferring an absent import to a present test: make the property structural rather than maintained.

If this table's sha256 and the artifact's actual hash ever disagree, **the artifact is correct and this table is stale.** Fix the table.

### 4.1 Shape, for readers (non-normative)

`main` is a `record` with `key: "tid"`. Required: `subject` (a `com.atproto.repo.strongRef`), `contentCid` (`format: cid`), `createdAt` (`format: datetime`). Optional: `arweave`, `hive`, `autonomi`, `media`. Five defs: `main`, `#arweaveAnchor`, `#hiveAnchor`, `#autonomiAnchor`, `#mediaPointer`.

**Read the artifact for anything you intend to implement.** This paragraph exists to orient, not to specify.

### 4.2 Why only three required fields

`subject`, `contentCid`, `createdAt` are required. **`arweave` and `hive` are deliberately optional.**

A receipt is created at the moment of intent; the anchors land asynchronously (Arweave settlement, Hive block inclusion). Making them required would force either a blocking write or a lie. A receipt with no anchors is a *claim*; a receipt with anchors is a *proof*. Both are legitimate states and the schema must express both.

This also preserves forward extensibility: further anchor rails (Autonomi, OpenTimestamps, a second chain) are added as **new optional fields**, which is the only non-breaking change permitted (§9).

---

## 5. What exactly gets hashed

**Rule: hash the canonical DAG-CBOR serialization of the subject record — i.e. exactly the bytes its CID already commits to.**

Rationale:

1. AT Protocol records are stored as DAG-CBOR; the record CID is computed over those bytes. Reusing it means the receipt **inherits atproto's own verification chain for free**: record bytes → record CID → MST node → commit `data` CID → signed commit → account signing key.
2. The JSON representation is explicitly **not** byte-deterministic. Hashing JSON would produce a hash that different implementations compute differently.
3. Inventing a separate hash algorithm would create a second source of truth that can disagree with the first.

Therefore `contentCid` **MUST** equal `subject.cid`. A receipt where they differ is invalid and MUST be rejected by verifiers.

> **Carried correction (from the Leaflet-on-Hive assessment):** the anchor must carry content hashes of **both** the record and its media — not merely a pointer. That is why `mediaPointer.sha256` is present. A pointer alone breaks when a gateway renames or a rail re-addresses; a hash is self-healing, because any copy of the bytes anywhere satisfies it.

### 5.1 Receipting a set

To receipt multiple records or a whole repo state, receipt a **CAR slice** rather than N individual records: upload the CAR to Arweave, and set `contentCid` to the CID of the CAR's root commit. The subject strongRef then points at the repo root. (Collection-scoped partial CAR export is specified/in-progress upstream — see §11.)

---

## 6. Media rule

**No rail stores media inline. Every rail stores a content-address pointer.**

This is the single architectural rule that survives contact with every network audited: media is the recurring failure mode everywhere except Arweave and Autonomi. Hive images die with `imagehoster`. ATProto blobs are PDS-host-dependent and migrate one-by-one. Nostr has no blob layer at all.

Accordingly, for every blob referenced by a subject record, the receipt SHOULD carry a `mediaPointer` with `scheme` = `ar` or `ant`, plus its `sha256`. A receipt whose subject references blobs and which carries no `media` array is **incomplete**, not invalid — implementations SHOULD warn.

---

## 7. Anchor flow

Order matters. It follows mirror-by-law: **the owned rail first, the mirror second.**

```
1. IDENTIFY   Resolve subject record → fetch its DAG-CBOR bytes → obtain CID.
              Enumerate referenced blobs.

2. PERMANENCE Upload record bytes to Arweave (free under 100 KiB via Turbo;
              no key custody — client-side signing).
              Upload each blob to Arweave or Autonomi; record sha256 per blob.
              → yields arweave.txId and media[].address

3. LEDGER     Broadcast Hive custom_json id "bnr.anchor" carrying:
              { v, type:"receipt", cid, ar, media:[{sha,addr}], ts }
              Posting authority only. Feeless (RC-metered).
              → yields hive.trxId, hive.blockNum

4. PUBLISH    Write the com.beehivenature.receipt record to the user's own PDS.
              This is the LAST step, not the first — the atproto record is the
              broadcast mirror, never the record of truth.
```

**Step 4 may be omitted entirely.** A receipt whose anchors exist on Arweave and Hive is complete and verifiable without any atproto record at all. The atproto record exists for *discovery* within the Atmosphere. This is what makes the design fail-safe rather than fail-dependent.

### 7.1 Hard limits on the Hive leg (confirmed from live chain config)

Read from `database_api.get_config` (api.hive.blog, 2026-07-25T15:38:03Z, chain 1.28.7 / HF 1.28.0) — chain constants, not documentation:

| Constant | Value | Binds |
|---|---|---|
| `HIVE_CUSTOM_OP_ID_MAX_LENGTH` | **32** chars | The `id` namespace. `bnr.anchor` = 10. |
| `HIVE_CUSTOM_OP_DATA_MAX_LENGTH` | **8,192** bytes | **The real ceiling on a single anchor payload.** Distinct from — and far below — the 65,536-byte block limit. |
| `HIVE_CUSTOM_OP_BLOCK_LIMIT` | **5** ops | Per block, per account. Bounds burst anchoring at ~5 per 3-second block. |

**Design consequence of the 8,192-byte ceiling:** an anchor payload carries hashes, never content. A receipt referencing many media blobs could approach the ceiling if it inlines every `sha256`. If a batch would exceed it, anchor a **merkle root** over the receipt set and publish the leaf list to Arweave — one anchor, unbounded set. This is the same batching shape the founder design law already forces for user-scale writes.

### 7.2 Resource budgeting

Hive `custom_json` is feeless but RC-metered. **Exact live cost must be measured, not estimated** — the RC-estimate-versus-receipt error has already been made once on this project and the lesson is ledgered. See acceptance criterion **A7**.

Two figures remain open and must not be assumed:
- **RC regeneration rate.** A community-documented 432,000 s (5-day, ≈20 %/day) figure and a chain-parameter-derived ~21.6-day figure are both in circulation. They may describe different mechanisms — resource-pool decay versus per-account manabar regeneration. Unresolved; do not build cadence math on either until settled.
- **Cost of a 150-byte payload.** Currently a proportional estimate scaled from the one measured data point (620 bytes / 368,692,399 RC at genesis). Not a measurement.

Both resolve with a single operation: broadcast one 150-byte anchor, wait 24 hours, measure the mana delta. Two unknowns, one action, no formula.

---

## 8. Verification procedure (third-party, no BNR software)

A verifier holding only a receipt MUST be able to complete this unaided:

1. **Fetch the anchored bytes** — `GET https://<any-arweave-gateway>/<arweave.txId>`.
2. **Recompute the CID** — DAG-CBOR → CIDv1, codec `0x71`, multihash sha-256 `0x12`. Assert it equals `contentCid`.
3. **Confirm the binding** — assert `contentCid` equals `subject.cid`.
4. **Confirm existence and ordering** — read the Hive `custom_json` at `hive.trxId` / `hive.blockNum` via any public Hive API node; assert the payload's `cid` matches. The Hive block timestamp is the public existence proof.
5. **Verify media** — for each `mediaPointer`, fetch by `address`, compute SHA-256, assert equality with `sha256`.
6. *(Optional)* **Verify authorship** — verify the ECDSA signature chain to `subject.cid` against the account's signing key. The key comes from one of two places, and the difference is the finding: **pinned offline** (a key the verifier already holds — in the reference tool, `--signing-key <zMultibase>`), or **network-resolved** (a DID directory such as `plc.directory` — in the reference tool, explicit opt-in via `--resolve-did`). A resolver is a party the verifier is choosing to trust for this step.

Steps 1–5 require **no BNR infrastructure, no account, and no cooperation from any party.** That is the test of the no-incarceration law, and it is the acceptance bar.

**Step 6 is optional and mode-honest (ratified 2026-07-25, DISPATCH-2026-07-25-B CC-1).** A conforming verifier's default is **offline-or-fail**: with no key supplied, it completes steps 1–5 and reports step 6 as **not performed** — it does not silently resolve a DID over the network and then present the result as if it were offline. The report must state which mode ran, so a green result is legible as independence **proven** (pinned key) versus **granted** (a resolver was trusted). The defect this rule closes is epistemic, not cryptographic: a verifier who cannot tell those apart has not measured what this section exists to measure.

### 8.1 Security-property language

This design is **sound by construction and isolated by design**: the binding between record, permanence rail, and ledger is content-addressed, so substitution of any component invalidates the receipt. No stronger claim is made. It is not "mathematically proven" and not "unhackable." Known residual risks are enumerated in §11.

---

## 9. Publishing, discovery, and evolution

**Publishing.** Write the Lexicon JSON as a record in the special collection `com.atproto.lexicon.schema`, with **record key = the NSID**, in a BNR-controlled repo. Then create DNS TXT `_lexicon.beehivenature.com` containing `did=<the publishing DID>`. Resolution is non-hierarchical: NSID authority → DNS TXT → DID → PDS → schema record.

**Discovery.** `com.atproto.sync.listReposByCollection` lets anyone enumerate every repo holding `com.beehivenature.receipt` records. No registry, no gatekeeper.

**Evolution policy — binding.** Once published, the only permitted changes are:

- adding **optional** fields;
- adding refs to **open** unions.

Everything else — removing a field, renaming, changing a type, adding a required field, tightening a constraint — is **breaking and requires a new NSID**. Deprecated fields are retained and marked, never deleted. Experimental iterations, if any, carry a `.temp.` segment until stable.

**License posture.** Publish the schema JSON under **CC0**. A schema is an interface; maximum permissionless adoption is the entire point, and CC0 removes all friction (it is also what Bluesky chose for its own interop test vectors). Accompanying reference code, when written, ships **dual MIT/Apache-2.0** to mirror the atproto reference implementation and carry its patent grant. Include a NOTICE file with the Apache-2.0 half.

---

## 10. Acceptance criteria

The spec is satisfied when all of the following hold. Each is independently checkable.

**Each criterion states its STRUCTURAL half and its DEMONSTRABLE half separately.** Ruled 2026-07-25 after the first full audit of these criteria found that six of ten had a structural half and **not one was fully structural** — every greppable form carried a residual needing demonstration. The split does not run between criteria; it runs through the middle of each one. The two halves are verified by different people at different times, and the structural half can usually be checked today.

| # | Criterion |
|---|---|
| **A1** | The Lexicon JSON validates against the AT Protocol Lexicon spec: `lexicon: 1`, valid NSID, at least one def, `main` is a `record` with `key: "tid"`. |
| **A2** | `com.beehivenature.receipt` resolves end-to-end: `_lexicon.beehivenature.com` TXT → DID → PDS → schema record whose rkey equals the NSID. |
| **A3** | A record written with this Lexicon is accepted by a stock PDS and appears on the standard firehose without allow-listing. |
| **A4** | For a real receipt, an independent party completes §8 steps 1–5 using only public gateways and public Hive API nodes, with no BNR software. Demonstrated at least once end-to-end, with the transcript ledgered. |
| **A5** | `contentCid` equals `subject.cid` in every emitted receipt; a deliberately mismatched receipt is rejected by the verifier. |
| **A6** | Every blob referenced by a receipted subject has a `mediaPointer` with a `sha256` that matches the fetched bytes. |
| **A7** | Actual measured RC cost of one `bnr.anchor` receipt broadcast is recorded from a live mana delta — **not estimated**. Sustainable daily cadence computed from the measurement. |
| **A8** | Arweave upload path confirmed to require no key custody by any third party, and confirmed free for payloads under 100 KiB. |
| **A9** | A receipt with `arweave` and `hive` present but **no** atproto record still verifies (§7 step 4 omitted). Proves fail-safe independence. |
| **A10** | Schema published under CC0; license text archived at the pinned revision. |
| **A11** | `verify --car FILE` completes §8 steps 2–5 with **zero outbound network calls**, given a CAR file already in hand. **Structural half:** no network client of any kind in scope on that code path. **Demonstrable half:** a run with the network unavailable exits 0. Ruled 2026-07-25 as a criterion distinct from A9 — A9 is *independent of Bluesky*, A11 is *independent of all networks*, and neither may borrow the other's evidence. A9's scope is unchanged. |

---

## 11. Open items and UNVERIFIED

Marked rather than asserted, per standing law.

| Item | Status |
|---|---|
| Hive `custom_json` **`id` maximum length** | ✅ **CONFIRMED — `HIVE_CUSTOM_OP_ID_MAX_LENGTH = 32`**, read from live chain config (`database_api.get_config`, api.hive.blog, 2026-07-25T15:38:03Z, chain 1.28.7 / HF 1.28.0). `maxLength: 32` in §4 is no longer provisional. `bnr.anchor` is 10 chars. |
| Live per-operation **RC cost** of the anchor | UNVERIFIED — load-dependent. Must be measured (A7). |
| Whether `community.lexicon.*` ratifies a shared provenance schema | Open. If it merges, **align to it rather than minting ours** and re-issue under that namespace. |
| Native atproto **timestamping** (upstream discussion, unresolved) | Open. If it ships, fold into it. |
| Collection-scoped **CAR slices** (Sync v1.1) | In progress upstream. When available, prefer receipting a verifiable slice over a single record for multi-record findings. |
| **Autonomi `ant://` addressing form** in `mediaPointer.address` | UNVERIFIED — pin the exact DataMap serialization before first use. Note Autonomi is **GPL-3.0**; use the network-API path, not in-process linking (see license gate). |
| Attie/Bluesky reception risk | A BNR surface leaning visibly on Attie inherits its adoption headwind. Not a schema concern; a product-surface one. |

### 11.1 Residual risks

- **Arweave permanence is an economic guarantee, not a physical one** (endowment model, ~200-year explicit floor). Mitigated by dual-anchoring to Hive and by Autonomi as a second permanence rail.
- **Hive is DPoS with a small consensus witness set.** It provides ordering and existence, not storage. Its role here is deliberately narrow.
- **Receipt creation is not authorisation.** Anyone may receipt any public record. A receipt asserts *this content existed at this time*, never *this content is endorsed*.

---

## 12. Out of scope

Explicitly not covered by this spec, to prevent scope drift:

- The editor/UI that produces receipts.
- The b-indexer firehose ingestion (deferred; promotes after this lands).
- The CAR-file permanence mirror (ruled TAKE separately; adjacent, not this).
- Any `b` token mechanics. Receipts are free at point of use, permanently.
- Signature-based attestation. That space is occupied and we do not duplicate it.

---

---

## 13. v0.2 additive fields — RATIFIED (spec authority, no founder decision required)

Proposed by the `crates/atmirror` implementation. All three are **optional additive** fields, which §9's evolution policy permits without a new NSID. Ratified as spec-authority; they do not require a founder ruling.

- `mediaPointer.byteLength` (integer, optional) — byte length of the blob. Lets a verifier detect a truncated fetch before hashing.
- `byteLength` on **anchors** (integer, optional) — same truncation-detection rationale, on `#arweaveAnchor`, `#hiveAnchor` and `#autonomiAnchor`. On `#hiveAnchor` it is bounded at **8192**, the confirmed `HIVE_CUSTOM_OP_DATA_MAX_LENGTH`. Ruled 2026-07-25: the implementation already emitted these and the pinned bQueenBee manifest already carries them, so the spec describes what is true rather than making a committed artifact non-conformant with its own schema.
- Per-artifact `sha256` on the Arweave anchor (optional) — complements `txId` so the anchored bytes are verifiable independent of gateway behaviour.
- `autonomi` anchor def (optional) — mirrors `#arweaveAnchor` for the Autonomi rail, carrying a DataMap address plus `sha256`. Scheme `ant`, consistent with `#mediaPointer.scheme`.

None are required; a v0.1 receipt remains valid under v0.2. Implementations MUST NOT reject a receipt for omitting them.

---

*End SPEC_LEXICON-1 v0.2 — draft, awaiting founder ratification of the document as a whole.*
