# SPEC-AUTONOMI-TREZOR-1 — the founder's personal data lane: Autonomi storage, every signature inside the Trezor

**Status: DRAFT — gates AT-1…AT-5 open.** Seat 3 (Fable 5), 2026-08-21.
**Founder's order, verbatim:** *"lets start connecting to my autonomi account for per
data storage protocol I can sign uploads to ANT with my trezor"* — and, same hour:
*"very big updates with x0x with a demo"* plus the community release relay (verified
below).

**The binding law this spec is built around:** no seat holds, requests, or transmits
private key material — ever. The finding that makes the founder's plan lawful **by
construction, not by discipline**: Autonomi ships an official external-signer seam.

---

## 0 · RELAY VERIFICATION — checked before anything was built on it

The pasted community updates were verified against the release pages from this host,
2026-08-21 (HTML pages; the API was rate-limited by our own research fleet):

| claim | status |
|---|---|
| ant-ui **v0.9.7** release exists | **VERIFIED** — 200, tag page live |
| ant CLI **v0.3.3** release exists | **VERIFIED** — 200 |
| ant-node **v0.17.1** release exists | **VERIFIED** — 200 |
| x0x / x0xd public repo | **404 today** — announced in the weekly update, not yet public. Watch item, not a build target. |

v0.9.7's release notes matter to this spec directly: batched payments for >1 GiB
(approve total once, then per-batch), **cancelling keeps completed batches and retry
pays only the remainder**, an upload can no longer report complete when storage
partially failed (**the DataMap is kept for re-pay-the-missing-part retry**), and the
5-minute wallet-prompt timeout that could cause double payment is gone.

## 1 · THE ARCHITECTURE — three phases, and the key never leaves the device

Autonomi's own documentation provides the shape (their guide
`use-external-signers-for-upload-payments.md`, WithAutonomi/autonomi-developer-docs):

1. **PREPARE — no identity, Seat 3 runs it.** `antd` started **without**
   `AUTONOMI_WALLET_KEY`. `POST /v1/upload/prepare` self-encrypts, quotes every chunk,
   and returns the full payment structure. No key exists anywhere in this phase.
2. **SIGN — the founder's hand, on the Trezor.** The wallet signs an ERC-20 `approve`
   and the payment call on **Arbitrum One**. The daemon never sees a key; the seat
   never sees a key; the Trezor screen is the gate.
3. **FINALIZE — Seat 3 again.** `POST` the transaction hashes (or merkle
   `winner_pool_hashes`) back; the daemon completes storage against the paid quotes.

This is not our workaround — it is the vendor's own answer. Their wallet-prep doc says
it plainly: if you do not want the daemon holding a key, *"use the external-signer flow
instead."*

**Payment shapes, and why the seat always inspects `payment_type` before handing
anything to the founder:**

| shape | when | Trezor confirmations |
|---|---|---|
| merkle (`payForMerkleTree2`) | ≥64 chunks, ~256 chunks (~1 GiB) per batch | **~2 per GiB** (approve + batch) |
| wave (`payForQuotes`) | <64 chunks | **one per quote** — hostile to a hardware wallet |

A large upload can silently flip to wave when preflight finds chunks already stored —
so the seat's harness **refuses to forward a session to the founder without printing
the shape and the exact expected number of device confirmations first.** Sixty
surprise confirmations is how a person gets trained to click through a hardware
wallet, and that habit is worth more protecting than any single upload.

## 2 · THE TREZOR MECHANICS — what works and what does not

> **⟳ AMENDED 2026-08-21 — founder's ruling, verbatim:** *"i don't want to use
> metamask or trezor [suite] first. i want our wallet and trezor integration."*
> **MetaMask is struck from the path.** The lane is now **our own signing wing** (on
> the bANTfarm) talking to the device through **Trezor Connect — Trezor's own official
> web bridge**, no third-party wallet between our page and the hardware. The flow:
> our page composes the unsigned transaction from the daemon's prepare output →
> Trezor Connect passes it to the device → **the device displays and signs; the page
> receives only a signed raw transaction** → our page broadcasts via public RPC.
> No key material ever exists outside the device; our code handles signatures, never
> secrets — the law holds by construction, now with our UI as the whole cockpit.
> **Disclosed dependency, the only one of its kind in the estate:** the signing wing
> loads Trezor's official Connect script (connect.trezor.io) — on user gesture only,
> never at page load — and says so on its face. A signing surface that hid its bridge
> would be a wallet asking for blind trust; this one names it.
> The MetaMask pairing remains below as the *documented-but-rejected* alternative.

- **Trezor Suite alone is NOT sufficient.** Suite sends and receives; it does not
  expose arbitrary contract calls and takes no custom RPC. ~~The working, documented
  path is **Trezor paired with MetaMask**~~ — rejected by the founder's ruling above;
  retained here only as the fallback of record if Connect ever fails us.
- **Blind-signing is the residual risk, named rather than hidden.** The device will
  likely render `payForMerkleTree2` calldata as an opaque blob. Our law protects the
  key; it does not protect against signing a malformed transaction. Mitigation is
  structural: the seat's harness **decodes the prepare output and prints a
  human-readable payment summary** — token, spender, exact ANT amount, batch count —
  which the founder compares against what MetaMask shows *before* touching the
  device. Approvals are for the **exact quoted amount, never unlimited.**
- **Addresses are re-derived from the installed binary at setup, never trusted from
  a document** — including this one. The research pass read the ANT token and
  payment-vault addresses out of source, and then flagged its own reading as
  not-a-payment-authority because the org is mid-migration. That caution is adopted
  as law here.

## 3 · THE KEY MAP — because "the key" is three different things

| material | role | where it lives |
|---|---|---|
| EVM key | **pays** — spends ANT + gas | **inside the Trezor. Nowhere else, ever.** |
| DataMap | **retrieves private data** — a capability: whoever holds it reads the data | client-side, generated by self-encryption. **Sealed to the founder** (AT-3 decides the vessel). Never enters any repo, any page, any seat report. |
| public address | retrieves public uploads | freely recordable |

**Two hard walls found by the research and adopted as law:**

1. **VAULTS ARE FORBIDDEN in this lane.** The legacy client's `vault_derive_key`
   takes the **raw EVM private key as a hex string** to derive the vault data key —
   structurally incompatible with a hardware wallet and with our law, and it welds
   the data layer to a court-compellable, chain-traceable payment key (a defect the
   Autonomi community has itself flagged). We use chunks, files, archives, DataMaps.
   No Vaults until an external-signer-compatible vault derivation exists upstream.
2. **The DataMap is guarded like seed material.** It is too large for the device and
   the Trezor cannot help here — its custody is its own ceremony. Personal-data
   DataMaps never touch the PUBLIC repos; loss of a DataMap is loss of the data;
   the founder's escrow arrangement for them is gate AT-3.

## 4 · THE STRANDED-PAYMENT RULE — the one open upstream defect, designed around

`ant-client` issue #140 (open, verified): in the CLI/SDK external-signer flow, a
storage failure **after** on-chain payment can strand the payment — quotes are
timestamped and signed, so a re-prepare cannot match the paid transactions. The fix
(PR #172, resumable finalize) is approved but blocked on an unrelated dependency
audit. Meanwhile ant-ui v0.9.7 shipped exactly these semantics in the App.

**Rules until #172 lands:**
- CLI/daemon lane: **every finalize is treated as non-retryable.** Bench uploads and
  small public artifacts only. The harness records tx hashes + prepare output to a
  receipt *before* finalize, so if a payment ever strands, the loss is documented to
  the atto-token, not vibes.
- **Large personal uploads go through the App (v0.9.7+)** the founder already runs,
  which keeps completed batches on cancel and re-pays only what is missing.

## 5 · THE ROLLOUT — gates, and who does what

| gate | what | whose hand |
|---|---|---|
| **AT-1** | **Sepolia bench.** Full prepare→Trezor-sign→finalize on Arbitrum Sepolia testnet. Answers the blind-signing question on a real device screen for zero money. | seat builds; **founder signs** |
| **AT-2** | First mainnet upload — founder picks the payload. Recommended first act: a PUBLIC artifact (a receipts snapshot), so the ceremony is rehearsed before personal data rides it. | founder |
| **AT-3** | Personal-data policy: what goes up first, and the DataMap custody vessel. | founder |
| **AT-4** | **x0x watch.** The live layer (local daemon `x0xd`, post-quantum P2P, no intermediary) is announced with a demo coming. *Corrected same day: no repo exists under WithAutonomi (404 verified), because the x0x agent-gossip work lives under the **saorsa-labs** org — that is where the watch points.* When it lands it is a candidate transport for **bMessenger** and the **buzz-studio sync lane** (Yjs documents over x0x instead of — or beside — LiveKit rooms: no server in the middle is the bLighTnetWorK doctrine wearing Autonomi's coat). Nothing is built against it until code is public and licenses are read. | seat watches |
| **AT-5** | Counsel/`ant update` cadence: pin client versions in receipts; `ant update` runs only after release notes are read — this week's notes changed payment semantics materially, which is exactly why. | seat |

**The founder's own acts, one line each (nothing here needs a terminal):**
1. Update the Autonomi App to **v0.9.7** (top-left "Update Available" → Update & Restart).
2. Pair the Trezor with MetaMask and add **Arbitrum One** (Trezor's own guide; the seat
   supplies the ANT token address *read from the installed client* at AT-1 time).
3. Sign the Sepolia bench when the seat hands over a session with its printed payment
   summary.

**Seat work queued behind no gate (starts now):** install ant CLI v0.3.3 in WSL; run
`ant file cost` against real payloads for true numbers (the only cost figure in the
wild is folklore); build the prepare/decode/finalize harness with the
human-readable-summary law above.

🐝
