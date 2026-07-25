# RECEIPT — ATProto repo → permanence mirror (atmirror), first live lap

**Date:** 2026-07-25 · **Seat:** 3 (Claude Code, sole tree-pusher) · **Tree at dispatch:** `9eec2d6`
**Docket:** the CAR-file permanence mirror SPEC_LEXICON-1 §12 ruled a separate TAKE — mirror an AT Protocol repo (DID/handle in, rail in) to Arweave/Autonomi, emit a `com.beehivenature.receipt` manifest binding the signed commit CID to the permanence addresses of the CAR and every blob.
**Session model note:** ORDERS-1 v0.8 §1 pins Seat 3 primary = Opus 4.8; this session ran **Claude Fable 5** (relay-invoked). Noted for the record — a re-pin is a founder one-line diff, not this seat's call.

---

## What landed

`crates/atmirror` — library + CLI (`check` / `mirror` / `restore` / `verify`), workspace member, AGPL-3.0-only like the rest of the tree.

The K-4 predicate, network side, enforced **before any upload**:
1. every CAR block re-hashes to its claimed CID (sha256, CIDv1, dag-cbor/raw only);
2. root commit parses (v3), binds to the requested DID, and its signature verifies
   against the DID document's `#atproto` key (secp256k1 or P-256, **low-S enforced**;
   unsigned bytes recovered by surgical `sig`-entry splice — never re-encoded);
3. MST walks complete (every node + record present; per-node prefix compression;
   keys strictly ascending) — or the repo is **REFUSED** and nothing uploads.

Blob discovery does not trust the PDS: references are extracted from the verified
records ($type:blob, legacy {cid,mimeType}, bare raw links) and **unioned** with
`listBlobs`. Every blob re-hashes to its CID before upload; lying bytes are refused
per-blob. Idempotency keys on **commit CID** (never CAR sha256 — block order is not
canonical), with blob-level reuse across commits.

Rails behind one trait. Arweave: ANS-104 DataItem, RSA-PSS-SHA256 (salt 32) over the
deep-hash, signed **client-side** (wallet JWK loaded locally, or an in-process
throwaway key); the DataItem id `sha256(sig)` is computed **locally before upload**
and the bundler's answer must equal it or the upload is refused (hash at the source,
before transport). Autonomi: the `ant` network-client CLI as a **subprocess** — the
GPL-3.0 crate is **not linked**, per the standing D-2 gate; parser is fail-closed
(one unambiguous address or refusal, never a guess); live exercise gates on a funded
`ant` wallet (spends ANT — founder step).

**Tests: 41 passed / 0 failed** (32 unit + 9 pipeline), no network in any test.
Adversarial gates proven: tampered CAR refused · wrong signer refused · high-S
(mathematically valid) refused · lying blob bytes refused per-blob · hidden blob
found via record scan · denied blob non-fatal and reported · re-run uploads nothing ·
restore rejects wrong key, bad binding, tampered rail copy.
Repro: `cargo test -p atmirror` (CI is the authoritative runner per tests.yml;
locally this lap ran the suite in WSL — Smart App Control blocks fresh test
binaries on the Windows host, as tests.yml already documents).

---

## The live lap — bQueenBee, pasted receipts

Subject: `did:plc:77xbxwg7vh3wh5pmzvid65hc` (bQueenBee, D-009c) · PDS
`phellinus.us-west.host.bsky.network` · signing key (pin)
`zQ3shUnRWRGC4gAxvoP57iHnjHsmCRQGZeTdud6GgsXXvhAYt` (secp256k1).

**1 · check (verify only, nothing uploaded):**
```
CHECK PASS did:plc:77xbxwg7vh3wh5pmzvid65hc
  commit bafyreiajejx7wg72eixbjpvip7lq4ml47qve7axbn45xtrut6z3uhd75lq rev 3mqicxzdw7o22 (secp256k1 signature valid, low-S)
  car: 2391 bytes, 9 blocks, every block re-hashed to its CID
  mst: complete, 4 records
  record: app.bsky.actor.profile/self
  record: app.bsky.feed.post/3mqicxz6xds2o
  record: app.bsky.graph.follow/3mqhz5gqpgd2o
  record: social.skaists.alpha.audit.entry/3mqicxz2vxe22
```
(The first-word post and its audit entry — the D-009c matched pair — verified at source.)

**2 · mirror (rail=arweave, ephemeral client-side signer, Turbo free tier):**
```
MIRROR did:plc:77xbxwg7vh3wh5pmzvid65hc: commit bafyreiajejx7wg72eixbjpvip7lq4ml47qve7axbn45xtrut6z3uhd75lq rev 3mqicxzdw7o22
  blocks verified: 9  records: 4
  blobs: 1 uploaded, 0 reused, 0 missing, 0 corrupt-refused
CAR  → ar txId 55ICOKgVH8Q3G91fSxwxOH_XosMMcbx5yUSqWowtdTU   (2391 B, sha256 c2912a07…5fdfb0ba)
blob → ar      Wh6UzLsP1raIAT3OwRHmQlkKT0V1Dxk46BAcLf9Ztgs   (90302 B, image/jpeg,
        sourceBlobCid bafkreiare5s6suafmdfaxycfva5ehyyl7giunrxaf7nzb6bkdfg262ugui,
        sha256 112765e9…af6a86a2)
```
Bundler returned the **locally pre-computed** DataItem ids (the address-mismatch
gate passed) — the ANS-104 deep-hash/PSS/id chain is confirmed against production.
Upload cost, Turbo's own status endpoint:
```
{"status":"CONFIRMED","info":"new","winc":"0"}
```
`winc: 0` — zero Winston charged. **A8 confirmed live: no key custody by any third
party (client-side throwaway signer), free under 100 KiB.**

**3 · restore — acceptance A, from the rail alone (no PDS contact):**
```
RESTORE-VERIFY did:plc:77xbxwg7vh3wh5pmzvid65hc: commit bafyreiajejx7wg72eixbjpvip7lq4ml47qve7axbn45xtrut6z3uhd75lq rev 3mqicxzdw7o22
  blocks: 9  records: 4  blobs verified: 1  blob failures: 0
RESTORE_EXIT=0
```
CAR fetched from `arweave.net` by txId, held to the receipt's sha256/byteLength,
every block re-hashed, MST re-walked complete, **commit signature re-verified**
against the DID-directory key; blob re-hashed to both the receipt sha256 and its
source blob CID. Gateway note: the item served on arweave.net ~6 min after upload;
`permagate.io` (fallback) answered 502/504 during the window — gateway list is
`--gateway`-configurable.

**4 · idempotency, live:** immediate re-run against the unchanged repo:
```
car reused: true      (zero uploads; receipt re-emitted byte-stable)
```

---

## The manifest (acceptance C artifact)

A `com.beehivenature.receipt` per SPEC_LEXICON-1 §4/§5.1 (repo-state form: subject =
repo root, `contentCid` = the CAR's root commit CID = `subject.cid`; binding rule A5
holds). Canonical byte form:
`dockets/atproto-car-mirror/receipt-bqueenbee-3uhd75lq.json`, sha256
`95f303db7a42c28bfa3917d253521556290e597f9521b01690224c091ca32d0f` <!-- PUBLIC-CONSTANT: sha256 of the public manifest file -->
— **on disk beside this file, deliberately untracked** pending the scanner ruling in
flag 7 (its sha256 value lines are 64-hex, and adding markers inside canonical JSON
would change the artifact). Content, verbatim except for the two marked lines:

```
{
  "$type": "com.beehivenature.receipt",
  "subject": {
    "uri": "at://did:plc:77xbxwg7vh3wh5pmzvid65hc",
    "cid": "bafyreiajejx7wg72eixbjpvip7lq4ml47qve7axbn45xtrut6z3uhd75lq"
  },
  "contentCid": "bafyreiajejx7wg72eixbjpvip7lq4ml47qve7axbn45xtrut6z3uhd75lq",
  "arweave": {
    "txId": "55ICOKgVH8Q3G91fSxwxOH_XosMMcbx5yUSqWowtdTU",
    "bundled": true,
    "sha256": "c2912a079f8a8c8a86ef781db31fd11f822c697a5dd62e536b079fd75fdfb0ba",  PUBLIC-CONSTANT: content hash of the public CAR
    "byteLength": 2391
  },
  "media": [
    {
      "scheme": "ar",
      "address": "Wh6UzLsP1raIAT3OwRHmQlkKT0V1Dxk46BAcLf9Ztgs",
      "sha256": "112765e9500560ca0be045a83a43e30bf99146c6e02fdb90f82a194daf6a86a2",  PUBLIC-CONSTANT: content hash of the public avatar blob
      "mimeType": "image/jpeg",
      "sourceBlobCid": "bafkreiare5s6suafmdfaxycfva5ehyyl7giunrxaf7nzb6bkdfg262ugui",
      "byteLength": 90302
    }
  ],
  "createdAt": "2026-07-25T15:44:44Z"
}
```

## Third-party verification — §8, no BNR software (acceptance B)

```
# 1. fetch the anchored CAR bytes
curl -L -o repo.car https://arweave.net/55ICOKgVH8Q3G91fSxwxOH_XosMMcbx5yUSqWowtdTU
# 2. hash them — must equal arweave.sha256 in the manifest
sha256sum repo.car   # c2912a079f8a8c8a86ef781db31fd11f822c697a5dd62e536b079fd75fdfb0ba  PUBLIC-CONSTANT: content hash of the public CAR
# 3. the CAR's root is the manifest's contentCid (any CAR tool, e.g. `ipfs-car ls`
#    or `go-car inspect`), and contentCid == subject.cid by inspection
# 4. each mediaPointer: fetch, hash, compare
curl -L -o avatar.jpg https://arweave.net/Wh6UzLsP1raIAT3OwRHmQlkKT0V1Dxk46BAcLf9Ztgs
sha256sum avatar.jpg # 112765e9500560ca0be045a83a43e30bf99146c6e02fdb90f82a194daf6a86a2  PUBLIC-CONSTANT: content hash of the public avatar blob
# 5. (authorship) resolve the DID's signing key and verify the commit signature:
curl https://plc.directory/did:plc:77xbxwg7vh3wh5pmzvid65hc
#    → verificationMethod #atproto, zQ3shUnRWRGC4gAxvoP57iHnjHsmCRQGZeTdud6GgsXXvhAYt
#    commit sig = 64-byte r‖s secp256k1 over sha256(dag-cbor commit minus `sig`)
```
Steps 1–4 need curl + sha256sum + any CAR inspector. The Hive-anchor step of §8 is
not yet applicable (see flags).

## Acceptance mapping

- **A — round-trip proven:** mirror → reconstruct from rail alone → commit
  signature still validates. **PASS** (transcript above, exit 0).
- **B — third-party verifiable, no BNR software:** procedure above; manifest is
  plain JSON of public primitives. **PASS** (§8 steps 1–5 sans Hive).
- **C — bQueenBee's manifest, ledgered:** the JSON beside this file, this commit.
  **PASS** (with the Hive/PDS-publish flags below open).

## Flags for Seat 1 / founder — open, not hidden

1. **Proposed SPEC_LEXICON-1 v0.2 additive fields** (per §9, additive-optional is
   the only permitted change; the docket's step-4 demands per-artifact sha256 +
   byte length): `arweaveAnchor.sha256`, `arweaveAnchor.byteLength`,
   `mediaPointer.byteLength`, and an `autonomi` anchor def
   `{address, sha256, byteLength}` (§4.1 names Autonomi as exactly this future
   rail). The emitted manifest carries them; a v0.1 verifier ignoring them loses
   nothing. **Ratification pending.**
2. **`hive` anchor omitted** — broadcasting `bnr.anchor` takes the founder-held
   posting key (@loviswater). Legal state per §4.1 (claim → proof; anchors land
   asynchronously). Named next action: one `custom_json` carrying
   `{cid: bafyreiajejx7…, ar: 55ICOKg…, media:[{sha,addr}], ts}`.
3. **§7 step 4 (publish receipt record to a PDS) omitted** — bQueenBee's
   credentials are ceremony-gated (D-009c pattern); §7 explicitly permits omission.
4. **Autonomi rail implemented, not live-exercised** — `ant` CLI subprocess only
   (no GPL linking; D-2 gate respected). Live run spends ANT from the `ant`-side
   wallet: founder go required. Output-schema parse is fail-closed and flagged
   UNVERIFIED in-source until a live receipt pins it.
5. **Ephemeral uploader identity** used for this lap (throwaway RSA-4096,
   client-side, free tier — winc 0). If receipts should carry a persistent
   uploader identity, that is a founder wallet decision (`--wallet jwk.json` is
   already supported).
6. **SPEC_LEXICON-1.md was untracked in `Downloads/`** (no ROUTING header at
   origin). Landed byte-faithful at `dockets/SPEC_LEXICON-1.md`, sha256
   `1bcf0a0a52f1ae7960320b4fd5a676451e8fcb79930f20b08c93f0743cda0f9d` <!-- PUBLIC-CONSTANT: sha256 of the landed public spec file -->
   — DRAFT status preserved; landing ≠ ratification.
7. **Scanner ruling requested (one line, fixtures-class):** receipt manifests are
   pure public primitives, but their `sha256` fields are 64-hex lines the secret
   scan rightly flags, and same-line markers cannot be added inside canonical
   JSON without changing the artifact. Request: path-scoped exemption for
   `dockets/*/receipt-*.json` (rationale identical to the founder-ruled
   `fixtures/` exemption: content hashes of public material, never key
   material). Until ruled, the canonical JSON sits beside this file untracked,
   pinned by the sha256 above; this file carries the annotated copy. On ruling:
   `git add -f` the JSON, one commit, done.

## Repro

```
cargo test -p atmirror
cargo run --release -p atmirror -- check   --actor did:plc:77xbxwg7vh3wh5pmzvid65hc
cargo run --release -p atmirror -- mirror  --actor did:plc:77xbxwg7vh3wh5pmzvid65hc --rail arweave --ephemeral-key --out mirror-out
cargo run --release -p atmirror -- restore --manifest dockets/atproto-car-mirror/receipt-bqueenbee-3uhd75lq.json --out restored
```
(Idempotency: run `mirror` twice; the second run reports `car reused: true` and
uploads nothing.)
