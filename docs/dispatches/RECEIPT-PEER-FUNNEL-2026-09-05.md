# RECEIPT — z3.3 Order B: PEER FUNNEL, the seller-side receive path (2026-09-05)

Order: docs/dispatches/2026-09-04-order-z3.3.md Order B — PEER FUNNEL per
docs/raids/PEER-SORT-2026-09-02.md §1 + §5, "the seller-side receive path
against zkp2p-contracts V2 on Base (bare `to`, LP required, estate never the
LP), tithe attached as `referralFees` at signal time, exact-multi split after
settlement. Land as a spec section + the wallet's receive call; testnet
receipt."

## LANDED

- **SPEC-PEER-FUNNEL-1 §receive** (docs/specs/SPEC-PEER-FUNNEL-1.md) — the
  roles (LP required / customer = taker / estate = bare `to`), the receive
  address, the ONE seller-side event, tithe as one `referralFees` entry at
  signal time (no second transaction), the exact-multi-after-settlement
  fallback with the post-intent-hook limit stated (V3 whitelists no hook),
  and the SERVER class the estate does not operate.
- **The wallet's receive call** — surfaces/wallet.html §peer-funnel: keyless
  `eth_getLogs`, topics pinned to Transfer(USDC) from OrchestratorV3 to the
  estate address, random public Base RPC per lookup with a failover walk
  (one refusing host never ends the read), chunk-refusals disclosed in the
  status line, and the no-wrong-blame law: a fully-walled network says
  "could not be read" — it NEVER says "no settlements" when the record was
  never read. The intent shape card shows `referralFees` with the tithe
  recipient UNFILLED (founder word, never invented).

## RECEIPTS (three layers)

1. **Live Base mainnet, in a real browser at 390px** — the receive call run
   end-to-end (e2e/shots/peer-funnel-390.png + peer-funnel-after-read-390.png):
   *"read complete — no funnel settlements yet (6 chunks read clean, 4
   chunk(s) refused by this RPC — their range was skipped)"* — the
   honest-empty truth (no customer intent has named the estate address yet),
   with 1rpc's 50-block getLogs cap disclosed as skipped chunks. Zero page
   errors. Read this machine cannot reach the RPC hosts directly (the ISP
   wall) — the probe rode the box as a SOCKS egress; the box independently
   confirmed the same getLogs rows 0 on mainnet.base.org AND base.drpc.org
   (two RPCs agreeing).
2. **Base Sepolia (84532), from the box** — chainId agreed ×3 hosts
   (sepolia.base.org, publicnode, drpc, tip 46410614); the same
   topics-pinned receive-call shape answered on testnet (honest empty, no
   error swallowed).
3. **Testnet key + paste-ready instruction** — throwaway secp256k1 key
   ISSUED on-box (address `0xb43b94ae967f0ae2e1bc7b5453086ab308f537af`,
   keccak derivation guarded against the EVM canonical empty-hash vector
   BEFORE use; key file 600, never printed). The exact-multi instruction
   (sum(outputs)==amount, seller 0.90 + tithe 0.10, feePayer ∉ outputs) and
   the signalIntent shape composed at ~/funnel-test/instruction.json.

## THE HONEST WALL (flagged, non-blocking)

**No funded testnet broadcast.** Every public Base Sepolia faucet measured
auth/wallet-gated: Alchemy's "no account" page never enables Send without a
session, Bitbond wants wallet-connect, QuickNode wants a wallet, Google
Cloud is Ethereum-Sepolia-only. zkp2p has NO testnet deployment (the raid's
deployments/* are Base mainnet only), so a real signalIntent on testnet does
not exist to run. The funnel's live rail is mainnet and the receive call is
proven there. A 0.1 testnet-ETH drop to the issued address arms the
broadcast the same hour.

## Tithe recipient

Unfilled by founder word in both the spec card and the instruction — the 10%
law is law, the ADDRESS is the founder's to name.
