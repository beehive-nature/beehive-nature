# bPay QUOTE RECEIPT — Bux `try_autonomi.mp4` (live, keyless, production Autonomi)

**Ceremony:** 2026-09-17, zCode bPay/W@tch UI seat (Phase A). **Law:** QUOTE ONLY —
no purchase, no wallet authorization, no Trezor, no upload, no finalize, no pointer,
no rendition, no W@tch mutation. Measured-states law binds: quote ≠ purchased ≠
uploaded ≠ retrieved ≠ hash-verified; this receipt records a QUOTE.

## The run

- **Tool:** `antd-bridge` (keyless prepare/finalize HTTP service over ant-core's real
  `Client`; binary built from `~/family-lineage/antd-bridge`, run with a FRESH state dir
  `C:\Users\travi\bridge-state-bpay-ui`, port 8807) — the same machinery the zBlood
  ceremony proved (real ~2.04 ANT genealogy plan). No key was used at any point; the
  payment plan is persisted on the bridge and survives bridge death.
- **Bootstrap:** 7 production peers from `%APPDATA%\ant\bootstrap_peers.toml` —
  the PRODUCTION Autonomi network, not a devnet.
- **Request:** `POST /v1/upload/prepare {"path":"C:/Users/travi/Downloads/try_autonomi.mp4"}`
- **Result:** HTTP 200 in 41.9 s.
- Raw machine response (uncommitted, local): `C:\Users\travi\bridge-state-bpay-ui\prepare-try-autonomi.json`,
  sha256 `5d080ae9229701e3eb25d32563de90db34ff829aa1153c148d64fe60b38f9aeb` <!-- PUBLIC-CONSTANT: sha256 of the raw bridge prepare response (public payment plan), local provenance pin -->
  (byte-exact copy at that path; the distilled INVOICE-1 artifact carrying all 56 quotes
  IS committed at `surfaces/bpay-invoice.json`).

## Identity binding (machine-verified — never retyped)

- File hashed by the BRIDGE at prepare time: sha256 `338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e` <!-- PUBLIC-CONSTANT: sha256 content pin, Bux community video identity (matches intake receipt PR #102) -->
- Bytes: **214,091,829** (the docket's exact canonical count).
- Pre-flight seat verification of the file matched the intake pin (sha256sum, 2026-09-17).

## The quote (exactly as returned)

| field | value |
|---|---|
| upload_id | `up-1789676174429` |
| chunks | 56 total, 0 already stored |
| payment_type | **wave_batch** |
| total ANT | **4,245,934,921,875,000,000 atto = 4.245934921875 ANT** |
| quotes | 56 × `{quote_hash, rewards_address, amount_atto}` (per-chunk, carried verbatim into `surfaces/bpay-invoice.json`) |
| sample quote[0] | hash `0x59be7e089c7fa3a9240f3aa6362bdbe0af10df8c7b9a9ce93941da21f36260e5` <!-- PUBLIC-CONSTANT: public on-chain payment quote id, wave quote #1 of 56 --> · amount 32,729,542,968,750,000 atto |
| data_map_address | `0x7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78` <!-- PUBLIC-CONSTANT: public self-encrypted data-map address — the deterministic address this exact file will live at once stored --> |
| obtained_at | 2026-09-17T20:16:14.651Z (response file mtime — the network-answer moment) |
| native gas | NOT part of the prepare (no synthetic number invented) — Arbitrum ETH, wallet-side at signing, carried SEPARATELY in the invoice domain block |
| durable reload | yes — the plan persists on the keyless bridge; re-prepare of the same artifact returns the SAME quote hashes (crash-recovery law, 0/24 quote-match proven on the genealogy lane) |

## Invoice-1 binding (the mechanical hand-off)

- Builder: `scripts/bpay-mvp/invoice-from-quote.mjs` (refusal gates: wrong sha / wrong
  bytes / quote-sum mismatch / merkle arm unimplemented → REFUSED).
- Job: `bux-try-autonomi-2026-09-17` · owed derived from the 56 carried quotes ·
  ceiling = exact total (never unlimited) · commitment `sha256:fe58f843117dbbd2a5b197f99d1623f304965458011a90788350e8204ca2fe0e` <!-- PUBLIC-CONSTANT: public commitment digest over the carried quote set -->.
- Artifact revalidates from file: `contentDigest` + `commitment.digest` re-derive
  (INVOICE-1 INV-1.1/1.5 laws hold on the parsed document).

## Load-bearing ceremony findings

1. **WAVE MODE at 204 MiB.** 56 chunks sits UNDER the 64-chunk merkle threshold →
   the network routed this upload to wave_batch = **one device confirmation per quote
   on a hardware wallet (56 confirmations)** — the exact hostile shape
   SPEC-AUTONOMI-TREZOR-1 §1 warns about. Phase E must print the payment shape and
   the exact expected confirmation count BEFORE any signing, and the ceremony design
   should weigh the batching options before the founder touches the Trezor.
2. **Policy is plan-bound.** The bridge prepared with `Visibility::Public` — the quote
   economically binds a PUBLIC plan. The founder's sharing-chooser (public/private/
   cypherpunk presets over one policy object, per the 2026-09-17 rider) must therefore
   run BEFORE prepare/quote in the product path; the invoice records the resolved
   policy (`domain.policy`), never a button label.
3. **Quotes age.** Network quotes are single-use/short-lived; the persisted plan on the
   bridge is the recovery path. The surface displays obtained-at honestly and will
   re-quote at payment time when the persisted plan no longer applies (Phase B/C law).

## BOUNDARY NOT CROSSED

No payment. No wallet authorization. No Trezor ceremony. No upload/finalize. No
pointer creation. No derived rendition. No W@tch mutation. The original media object
was read (hashed), never moved, never re-encoded.
