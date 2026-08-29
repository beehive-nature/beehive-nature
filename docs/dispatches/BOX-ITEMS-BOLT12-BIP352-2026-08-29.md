# BOX ITEMS — escrow snapshot · BOLT-12 mint · BIP-352 scope (2026-08-29)

## 1 · ESCROW SNAPSHOT — DONE
Live ledger (6 events, verbatim, secrets never lived in it) → `crates/voucher-escrow/fixtures/live-ledger-snapshot.jsonl`, with three Rust acceptance tests: the Python chain verifies under the Rust hash law byte-for-byte; balances derive identically (1.0000 / 0.5000 / 1.3400 / 29.3400 A + zero-keys-zero); a tampered snapshot credit is caught. Narrow secret-scanner exemption added on the `dockets/*/receipt-*.json` founder precedent (canonical JSON whose every byte is load-bearing; hashes are public chain values). Commit `3e6c291`.

## 2 · BOLT-12 OFFER MINT — PARKED ON LIQUIDITY (the honest finding)
Everything code-side is verified and works; the node cannot build an offer because it has no channels. **Measured, not guessed:**
- API verified at source (getAlby/hub, `http/http_service.go`): `POST /api/offers {description}` in the fullAccess group; `MakeOffer` in `api/api.go:1281`; `SupportsBolt12 = LDK|CLN backend` (`api.go:1555`). This hub = LDK ⇒ supported.
- Auth verified live: `POST /api/start {unlockPassword}` → JWT (token minted from the box's admin pass, loopback 8081 only).
- Mint attempt (real): `POST /api/offers {"description":"beehive-nature estate — LN rail (skaists)"}` → **500 `OfferCreationFailed`**, and the node's own log names the cause: **LDK `bolt12: Failed to create offer builder: MissingPaths`** — a BOLT-12 offer must carry blinded paths to the recipient, and paths require channel presence.
- Node state: `onchain spendable = 0 sats`, zero channels, zero peers. JIT channels are enabled in hub config but a JIT channel opens when a PAYER triggers it — no path exists until then.

**THE UNBLOCK (one founder gesture, then one command):** put sats on the hub's on-chain wallet (`GET /api/wallet/address` gives the address; the box is ARM/23GB RAM/31GB free — a small channel fund is plenty), let a channel open (peer or LSP JIT triggered by a first payment), then rerun the mint script (`/tmp/hub-mint.sh` on the box) — the `lno1…` offer lands, and the payment-name builder gets its REAL offer. The API call itself is ready.

## 3 · BIP-352 SCANNING — SCOPED, NO BUILD (cite-or-stop held)
**What exists on the box: NOTHING bitcoin.** No bitcoind, no electrs, no Fulcrum, no mempool container (docker ps + units checked). The BTC rail's reads today are Esplora-class public APIs (the museum lane), which cannot serve silent-payments scanning.

**What scanning requires (from BIP-352 itself, read at source, github.com/bitcoin/bips bip-0352.mediawiki):** for every transaction with taproot inputs, the recipient needs the **summed input public key (33 bytes/tx)**, performs one ECDH per tx, then **BIP-158 block filters** confirm the derived output exists — and the BIP's own text: *"It is still an open question as to how Bob can source the 33 bytes per transaction in a trustless manner"* (Appendix A, light clients). No hosted explorer is cited here because none was verified to expose the input-pubkey sum — cite-or-stop.

**Options and costs (box: 4 cores ARM, 19GB RAM available, 31GB disk free):**
| option | serves | cost | verdict |
|---|---|---|---|
| Full archiving bitcoind (+txindex) | full history rescan | chain 700GB+ class in 2026 | **doesn't fit the box** |
| **Pruned bitcoind** (prune≈20GB, `peerblockfilters=1 blockfilterindex=1`) | **live go-forward scanning** — every new block's taproot-input txs: sum keys, ECDH, filter check | ~20GB of the 31GB free, ~2GB RAM, modest CPU | **the one that fits** |
| electrs/Fulcrum | address/script history | they answer questions about KNOWN scripts — silent-payment outputs are unknown until the input-scan | **insufficient by nature** |
| hosted input-pubkey APIs | history backfill | unverified at source | not cited, not recommended |

**THE RECOMMENDATION (one):** pruned bitcoind on the oracle box scanning **live from deployment day** — trustless, fits, and the honest coverage statement is "everything from switch-on." Historical backfill to BIP-352's 2024 activation needs a one-time txindex pass on a bigger machine (or a verified hosted source) — defer until real silent-payment traffic exists, which today is zero: the sp1q receive posture is documented (wallet matrix, workbench) but unused. **Build when the first sender appears; scope recorded now.**
