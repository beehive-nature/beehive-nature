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

```json
{
  "lexicon": 1,
  "id": "com.beehivenature.receipt",
  "description": "A permanent, independently verifiable receipt anchoring an AT Protocol record to Arweave permanence and a Hive custom_json ledger entry.",
  "defs": {
    "main": {
      "type": "record",
      "description": "Binds one atproto record to its content hash and its external anchors.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["subject", "contentCid", "createdAt"],
        "properties": {
          "subject": {
            "type": "ref",
            "ref": "com.atproto.repo.strongRef",
            "description": "Strong reference (uri + cid) to the exact version of the record being receipted."
          },
          "contentCid": {
            "type": "string",
            "format": "cid",
            "description": "CIDv1 (dag-cbor 0x71, sha-256 0x12) over the canonical DAG-CBOR encoding of the subject record. MUST equal subject.cid."
          },
          "arweave": {
            "type": "ref",
            "ref": "#arweaveAnchor",
            "description": "Arweave anchor holding the exact receipted bytes. Omitted until settled."
          },
          "hive": {
            "type": "ref",
            "ref": "#hiveAnchor",
            "description": "Hive custom_json anchor. Omitted until broadcast."
          },
          "media": {
            "type": "array",
            "items": { "type": "ref", "ref": "#mediaPointer" },
            "description": "Content-address pointers for every blob referenced by the subject record."
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "When this receipt was created. RFC 3339, uppercase T, timezone REQUIRED, 'Z' preferred."
          }
        }
      }
    },

    "arweaveAnchor": {
      "type": "object",
      "required": ["txId"],
      "properties": {
        "txId": {
          "type": "string",
          "minLength": 43,
          "maxLength": 43,
          "description": "Arweave transaction or ANS-104 DataItem id. 43-character Base64URL."
        },
        "bundled": {
          "type": "boolean",
          "description": "True if this is an ANS-104 DataItem inside a bundle rather than a base-layer transaction."
        },
        "settledAt": {
          "type": "string",
          "format": "datetime",
          "description": "When the transaction was observed mined. Advisory only; not a consensus fact."
        }
      }
    },

    "hiveAnchor": {
      "type": "object",
      "required": ["account", "customJsonId"],
      "properties": {
        "account": {
          "type": "string",
          "maxLength": 16,
          "description": "Hive account that broadcast the anchor."
        },
        "customJsonId": {
          "type": "string",
          "maxLength": 32,
          "description": "The custom_json id namespace. For this spec: 'bnr.anchor'."
        },
        "trxId": {
          "type": "string",
          "description": "Hive transaction id, lowercase hex."
        },
        "blockNum": {
          "type": "integer",
          "minimum": 1,
          "description": "Block containing the anchor transaction."
        }
      }
    },

    "mediaPointer": {
      "type": "object",
      "required": ["scheme", "address"],
      "properties": {
        "scheme": {
          "type": "string",
          "knownValues": ["ar", "ant"],
          "description": "Permanence rail. 'ar' = Arweave TXID. 'ant' = Autonomi DataMap address."
        },
        "address": {
          "type": "string",
          "description": "Content address on that rail."
        },
        "sha256": {
          "type": "string",
          "description": "SHA-256 of the blob bytes, lowercase hex. Lets a verifier confirm the fetched blob without trusting the rail."
        },
        "mimeType": { "type": "string" },
        "sourceBlobCid": {
          "type": "string",
          "format": "cid",
          "description": "The blob's CID in the subject's PDS, if it originated there."
        }
      }
    }
  }
}
```

### 4.1 Why only three required fields

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

### 7.1 Resource budgeting

Hive `custom_json` is feeless but RC-metered; RC regenerates linearly to full over 432,000 s (≈20 %/day). Anchor-class operations are cheap relative to post-class operations, so a modest stake sustains a meaningful daily anchor cadence. **Exact live cost must be measured, not estimated** — the RC-estimate-versus-receipt error has already been made once on this project and the lesson is ledgered. See acceptance criterion **A7**.

---

## 8. Verification procedure (third-party, no BNR software)

A verifier holding only a receipt MUST be able to complete this unaided:

1. **Fetch the anchored bytes** — `GET https://<any-arweave-gateway>/<arweave.txId>`.
2. **Recompute the CID** — DAG-CBOR → CIDv1, codec `0x71`, multihash sha-256 `0x12`. Assert it equals `contentCid`.
3. **Confirm the binding** — assert `contentCid` equals `subject.cid`.
4. **Confirm existence and ordering** — read the Hive `custom_json` at `hive.trxId` / `hive.blockNum` via any public Hive API node; assert the payload's `cid` matches. The Hive block timestamp is the public existence proof.
5. **Verify media** — for each `mediaPointer`, fetch by `address`, compute SHA-256, assert equality with `sha256`.
6. *(Optional)* **Verify authorship** — resolve `subject.uri`'s DID, fetch the signed commit, verify the Schnorr/ECDSA signature chain to `subject.cid`.

Steps 1–5 require **no BNR infrastructure, no account, and no cooperation from any party.** That is the test of the no-incarceration law, and it is the acceptance bar.

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

---

## 11. Open items and UNVERIFIED

Marked rather than asserted, per standing law.

| Item | Status |
|---|---|
| Hive `custom_json` **`id` maximum length** | UNVERIFIED against canonical chain constants. `maxLength: 32` in §4 is provisional. Confirm before publishing. |
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

*End SPEC_LEXICON-1 v0.1 — draft, awaiting ratification.*
