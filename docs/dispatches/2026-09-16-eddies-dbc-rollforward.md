# EDDIES → DBC ROLL-FORWARD — `/api/dbc/*` examined, both closed · 2026-09-16

**Order (founder, verbatim):** *"Eddies verdict accepted: close Eddies itself
as a bPay protocol-reuse candidate. Do not spend further effort on its
server-side €$/invoice/farm model."* / *"Roll forward only into an independent
technical examination of `/api/dbc/*`: determine what the DBC primitive
actually is, its cryptographic construction, issuance/transfer/double-spend
model, whether verification is independent of the Eddies server, and whether
any reusable primitive exists. Research/read-only only."* / *"If DBC authority
ultimately reduces to the same server, close that too and move on."*
**Seat:** zCode, continuing the reverse-engineering lane (same scratch dir,
same deployment). **Constraint compliance:** asset GETs + static analysis
only; the wasm binary was downloaded and string-scanned, never executed; no
API mutations (the `/api/dbc/*` story is read entirely from client code);
dan-gould/dbc checked by one WebFetch (404). **Companion dispatch:**
`2026-09-16-eddies-reverse-engineering.md` (the Eddies closure evidence).

## 0 · One-screen read

| question | answer |
|---|---|
| What is the DBC primitive? | A **client-side Rust→wasm bearer e-cash wallet**: self-signed ed25519 "DBC" tokens (window classes 0h/1h/24h built into the coin), P2P transfer receipts, bloom-filter spentbook |
| Cryptographic construction | wasm-bindgen module `eddies_chain` (binary 505,476 B at `/wasm/eddies_chain_bg.wasm`); crate stack verbatim from the binary: `ed25519_dalek`/`curve25519` (×58 refs), `blake3`, `bloom`, `sha2`, `getrandom`; the JS glue imports only `crypto.getRandomValues` — ALL crypto inside the wasm |
| Issuance | **GENESIS = client-side self-mint** (verbatim app strings: guard `"Genesis already minted. Wallet holds €$…. Cannot mint again."` then `mintDbc(10^19, 0)` → `"✓ Genesis mint complete — 10,000,000,000,000,000,000 Eddies (0h) minted to chain wallet"`); user-facing issuance gated by the SERVER (mintDbc docstring verbatim: *"Used after the server has deducted the equivalent from the user's server-side balance. The DBC is signed by this wallet's key."*) |
| Transfer | P2P, server-free cryptographically: `createTransferReceipt(recipient_pubkey, amount)` → JSON receipt (sender/recipient three-word addresses, DBC payloads as bearer bytes, spent+created IDs, **bloom-filter snapshot**, ed25519 signature over the whole receipt); `receiveTransferReceipt` verifies signature + checks bloom + imports |
| Double-spend | **Probabilistic and local**: bloom snapshots in receipts + gossip-propagated spentbook (`markSpent` — *"received via gossip from desktop node"*; `unmarkChainSpent`, `getSpentbookStats`). No global consensus, no server registry in the client; a recipient with a stale filter accepts a double-spend — by construction |
| Verification independent of server? | **Signatures: YES** — `verifyDbc(dbc_bytes, signer_pubkey_hex)`, `verifyTransferReceipt(receipt_json)`, `verifyThreeWordAddress` are standalone wasm functions taking the signer key as a PARAMETER (no global mint key exists client-side). **Value: NO** — see §2 |
| Reusable primitive? | As Eddies code: **NO** (Rust source unpublished; wasm-only distribution; no license found). As a design pattern: the shape is real but every element exists with source + license in open-source e-cash kin — the reusable primitives live THERE, not here |

## 1 · What the DBC primitive actually is

A Rust→wasm (wasm-bindgen) wallet class exported by `/wasm/eddies_chain.js`
(full API read from the glue, which carries complete docstrings):
`EddiesWallet` with `new / fromSecretKey(32-byte hex) / serialize /
deserialize (IndexedDB persistence) / publicKey / secretKey / mintDbc(amount,
window_hours 0|1|24) / exportDbc / importDbc / splitDbc / createTransferReceipt
/ receiveTransferReceipt / isSpent / markSpent / unmarkChainSpent /
getSpentbookStats / getBalance / listFunds / getMiningStatus /
recordValidation / getThreeWordAddress`, plus standalone
`verifyDbc / verifyTransferReceipt / verifyThreeWordAddress /
threeWordAddressFromPubkey` and the chain-wallet family
(`verifyChainDbc(FromBase64)`, `splitChainDbc`, `restoreChainWallet(State)`,
`recordChainValidation`). Addresses are deterministic three-word forms of the
ed25519 pubkey (docstring example: "tiger-ocean-mint"). The wasm binary is
served only to browser-shaped requests (plain curl receives the SPA fallback;
browser headers return the real 505,476-byte module — receipt in scratch).

## 2 · The founder's binary, answered for DBC

**Signature verification is independent of the Eddies server; VALUE authority
reduces to the same server — so DBC closes too, per the founder's rule.**
The chain of evidence:

1. The **money supply originates from a client-side self-mint** — genesis is
   `mintDbc(10_000_000_000_000_000_000, 0)` into the local "chain wallet",
   guarded ONLY by a local already-minted check. Nothing external anchors it.
2. **User-facing issuance is explicitly server-gated** — the wasm docstring
   says the DBC is minted *"after the server has deducted the equivalent from
   the user's server-side balance"*. Self-signed by the user's own key.
3. **No mint authority key exists client-side** — `verifyDbc` takes the
   signer pubkey as a parameter; anyone with the wasm can mint
   signature-valid DBCs of any amount. A DBC proves *who signed it*, never
   *that anything backs it*.
4. **Redemption/exchange flows through `/api/dbc/*`**
   (`supply / borrow / exchange/all / exchange/execute / wallet / wallet/create`)
   — server records convert DBCs to and from the server-side €$ ledger that
   the parent dispatch already established as the authority.

So the DBC layer is a well-built **bearer-note format + local ledger +
probabilistic spentbook** riding on top of the same server-authoritative
accounting — cryptographically honest about what it is (the docstrings never
claim backing), but adding no trustless primitive.

## 3 · Issuance / transfer / double-spend / destruction — the full model

- **Issuance:** genesis self-mint (§2.1); exchange-mint after server
  deduction (§2.2); window class (0h/1h/24h) is minted INTO the coin —
  this is where the acceptance-window classes live (connects to the
  `(0)/(24)` funds and `/api/swap/to-0h|from-0h` of the parent dispatch).
- **Transfer:** wallet-to-wallet, offline-capable: signed receipt + bearer
  DBC bytes; `importDbc(exportDbc(bytes))` is node-to-node by design.
- **Double-spend:** bloom-filter snapshots carried IN each receipt +
  gossip-fed local spentbook; probabilistic, eventually-consistent at best;
  no revocation/consensus mechanism anywhere in the client.
- **Destruction/expiry:** window expiry (the 0/1/24h classes are spendability
  windows) + spentbook marking. No on-chain event at any point.

## 4 · Reusable-primitive verdict

- **From Eddies: nothing adoptable** — the Rust source is unpublished
  (wasm-only distribution, no license anywhere in the served assets), so
  there is no code to reuse even if we wanted it.
- **As a design pattern, one honest note for the reuse seat:** the composite
  shape — *window-classed self-signed bearer notes + ed25519 transfer
  receipts + bloom-gossip spentbook + wasm client custody* — is a coherent
  offline-P2P IOU construction that rhymes with machine-economy obligation
  ideas already in the queue's working hypotheses (Eddies item #1's
  obligation/receivable candidate). But every component exists WITH source
  and license in the open-source e-cash family (blind-signature DBC designs,
  Cashu/Fedi-class mints, bloom spent-registries). Design-kinship pointer
  recorded: the `mintDbc/verifyDbc/spentbook` vocabulary matches the
  dan-gould DBC design family — that GitHub repo now 404s (checked this
  session); lineage UNVERIFIED, no claim made.
- **Standing conclusion (founder's rule applied): DBC authority reduces to
  the same server → CLOSED.** The interesting cryptography got its one fair
  look; the reusable versions of these primitives live outside Eddies.

## 5 · Closures banked

1. **EDDIES: CLOSED as a bPay protocol-reuse candidate** (founder verdict
   accepted + parent-dispatch evidence: server-database authority, dead-EOA
   chain leg, encrypted-private persistence, no decentralized primitive).
2. **DBC: CLOSED as an Eddies-sourced reuse candidate** (this dispatch).
   No further workerb capacity on Eddies per founder order. Queue item #1
   carries both closures; the one carried-forward artifact is the §4
   design-pattern note for the reuse seat.

## Landing receipt

Scratch `/tmp/eddies-recon/` (glue + binary + bundles). Landed from
`../wt-zcode-eddies` on `zcode/eddies-reverse-2026-09-16`, §7 seat shape,
four pre-push checks, pushed branch + main. Read-only throughout; the wasm
was analyzed statically, never executed.
