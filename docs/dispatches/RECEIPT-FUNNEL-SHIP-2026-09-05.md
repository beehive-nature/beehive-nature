# RECEIPT — z3.3 Order C: wallet SHIPPED live + the broadcast runner armed (2026-09-05)

## Part 1 — SHIPPED and confirmed LIVE

wallet.html (with §peer-funnel FIAT IN) deployed by the pages build after
`@ddfb9833` and confirmed FROM THE LIVE URL, not the worktree:
`https://skaists.dev/surfaces/wallet.html` at 390px — heading "🏧 FIAT IN —
the Peer funnel (SPEC-PEER-FUNNEL-1)", the bare-`to` receive address
`0x89881F83…d7C6` with copy, the read-the-funnel button, the intent-shape
card; ZERO page errors. Shot: `e2e/shots-peer/peer-funnel-LIVE-390.png`.

## Part 2 — the broadcast runner: BUILT, VECTOR-PROVEN, ARMED (not fireable yet)

`scripts/funnel/broadcast.mjs` (zero deps: BigInt ECDSA sign AND pubkey
recover, RLP, keccak via the vendored bnr-sign). Selftest green on the box
and in CI (static, if:always()):

- keccak empty-hash vector · EIP-155 RLP hash vector `daf5a779…` ·
  sign→recover roundtrip on the example key AND the real funnel-test key
  (`0xb43b…37af`).
- Every built tx self-checks by RECOVERING its sender before anything is
  sent; a mismatch aborts.

Two traps fixed in the open: the low-s flip inverts recovery parity (v must
flip with s — the roundtrip caught it); and a from-memory "published
signature" vector failed while the math was right — the selftest now
CONSTRUCTS its vector (a recalled constant rots, a constructed one cannot).

**Guards, per the order's own conditions** — the ONE broadcast fires only
when BOTH founder inputs exist, and refuses by name otherwise (measured
today):

1. `~/funnel-test/tithe-address.txt` (one line, 0x address) — **NOT POSTED**
   → "TITHE ADDRESS NOT POSTED … Refusing."
2. Testnet ETH on `0xb43b…37af` — **0.0 ETH ×3 RPCs** (sepolia.base.org,
   publicnode, drpc; nonce 0) → the funds guard would refuse after the
   tithe file exists.

The broadcast itself: ONE legacy EIP-155 tx on Base Sepolia (84532) from
the throwaway key to itself carrying the composed instruction as UTF-8
calldata — the `referralFees` entry (tithe, 1000 basisPoints) and the
exact-multi split (seller 0.90 / tithe 0.10, sum invariant) VISIBLE in the
decoded input on any explorer. Fire: `node scripts/funnel/broadcast.mjs
--compose` (print, no send) then `--broadcast` (the one send). A tithe
address equal to the seller `to` is refused (a referral to self is a
no-op).

## Re-check

docs/dispatches/ re-checked after the Order A and B landings and again for
this order — no new z3.3 dispatch; newest file is z3.1's headroom receipt.
