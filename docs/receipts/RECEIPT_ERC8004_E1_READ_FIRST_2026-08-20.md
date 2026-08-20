# RECEIPT — ERC-8004 E-1, the read-first pass: what actually lives at the canonical registries

**zbCode/zAgent (GLM seat), 2026-08-20 late night.** First deliverable of the ruled N-3
evaluation lane (`SPEC-ERC8004-EVAL-0.md`). Method: the house standard — two
operator-class-diverse RPCs per chain (Ethereum: mevblocker + publicnode; Base:
mainnet.base.org + publicnode), every read cross-verified on both (mismatch = abort),
failures recorded as failures, honest absences by name. **Read-only: no registration,
no keys, no transactions.** Tool (re-runnable): `docs/receipts/erc8004-e1-read-first.mjs`.

Canonical addresses two-sourced before any call (eips.ethereum.org/EIPS/eip-8004 for
interfaces · awesome-erc8004 README · erc-8004/erc-8004-contracts README):
Identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`,
Reputation `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` — the vanity pair, identical on
both mainnets. The Validation Registry has **no canonical address in either source**
("under active revision") — honest absence, not zero.

## 1 · What is deployed (code + storage, two oracles, byte-equal everywhere)

| layer | Ethereum + Base (identical) | size | keccak256(runtime) |
|---|---|---|---|
| Identity proxy | `0x8004A169…432` | 130 B | `d0e45b1d89fa9b6cc7e97c1f155d64180e5c232aaccf9900ef9d4fd738c02b41` <!-- PUBLIC-CONSTANT: keccak of deployed runtime bytecode, on-chain digest --> |
| Reputation proxy | `0x8004BAa1…b63` | 130 B | `d0e45b1d…` (same proxy bytecode) |
| Identity impl | `0x7274e874ca62410a93bd8bf61c69d8045e399c02` (ERC-1967 slot) | 14,474 B | `a5f9624ea85e45b3f4b8558581f03bfb3e6cefab278d7bf0500ec9bd065dc16f` | <!-- PUBLIC-CONSTANT: on-chain implementation address + runtime digest -->
| Reputation impl | `0x16e0fa7f7c56b9a767e34b192b51f921be31da34` | 10,491 B | `38602de97f1bd86f0a4729f7f3c0a78b1d27892e6eb581272cce5504a68fd00b` | <!-- PUBLIC-CONSTANT: on-chain implementation address + runtime digest -->

The singletons are **130-byte ERC-1967 upgradeable proxies** (Solady-style; `solc 0.8.24`
in the metadata) pointing at **chain-identical shared implementations**; the ERC-1967
admin slot reads **empty on both chains** — no upgrade path is armed tonight. The
first-pass appearance of "stub" (every call erroring) dissolved on inspection into three
separate facts below — the read-first discipline working as designed.

## 2 · What the Identity registry answers

- `name()` / `symbol()` answer **empty strings** — a minimal registry, unnamed.
- **No `totalSupply()`** — the implementation is not ERC-721 Enumerable: there is **no
  count surface** on-chain. (Reverts surface as provider JSON-RPC errors — the tool's
  retry classifier initially labeled them RPC failures; direct-on-implementation probes
  returned clean `execution reverted`. Conclusion unchanged: function absent.)
- `tokenURI(id)` **reverts for existing tokens with unset URIs** — URI-optional behavior.
- **Registrations are real and live on both chains.** Bounded existence scan (ownerOf,
  second-oracle walk):

| token | Ethereum owner | Base owner |
|---|---|---|
| 1,2,3,5,10 | `0x9ce70828…` (one wallet holding the early run) | distinct owners per id (`0x89e9e1ab…`, `0x6f0fabeb…`, `0x67722c82…` ×3) |
| 100 | `0xc34a355c…` | `0x67722c82…` |
| 1000 | `0x20d9c44c…` | `0x7236a6e3…` |
| 25331 | `0x0677cc37…` | **`0xc5b29033e63a986b601fe430806a2c9735f2ea97`** |

**The cross-source hit:** awesome-erc8004 documents a "Prover Agent … token ID 25331,
address `0xc5B29033…`" on Base — measured on-chain, exact match. The third-party
literature and the canonical chain agree.

## 3 · What this means for the lane

- The canonical rail is **real, correctly layered (proxy + shared impls), cross-chain by
  vanity deployment, and carries live registrations** — but it is deliberately minimal:
  no name, no count surface, URI-optional. Anything the house builds on it supplies its
  own indexing (b-indexer pattern) and treats URIs as optional pointers (pointer-never-
  identity, fence 1, holds by construction).
- The earlier "138K+ agents" figures in the literature belong to **third-party ecosystem
  contracts and aggregator oracles** (Base `0xD5fdccD4…`, 2,829 B, rate-limited before
  answering tonight — unverified, recorded as failure), not to the canonical singletons.
- Reputation: `getSummary`/`readFeedback` reverted for the sampled agent on both chains
  tonight (reason unretrieved without revert-data decode — improvement owed); the
  implementation exists and is shared cross-chain. Score distributions remain unread —
  a bounded follow-up once a registered-with-feedback agent is identified by id-scan.
- QuickNode's add-on ("15+ networks") is consistent with the measured cross-chain vanity
  deployment; it remains a convenience window, not the source of truth (rail 1 reads
  these registries directly, keyless — demonstrated by this very receipt).

## 4 · Method notes (the gates earning their keep)

- The keccak self-test gate caught **a second one-bit RC[23] retyping error** in this
  tool before any chain read (`0x0000000080008008` vs canonical `0x8000000080008008` —
  third catch of its kind tonight). Standing rule now written into the tool header:
  constants are copied programmatically from the verified §10 implementation, never
  retyped.
- EVM reverts surface as JSON-RPC provider errors on several public endpoints; the
  classifier distinguishes them from rate limits (`over rate limit` = failure-never-
  answer; wrapped `execution reverted` = chain answer after inspection).

**Gate E-1: CLOSED — receipted.** E-2 (founder key ceremony) remains the gate before
anything registers anywhere. Nothing was registered by this pass.
