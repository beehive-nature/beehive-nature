# Base Sepolia smoke — AUTHORIZED, testnet-only

Authority: founder order 2026-09-19T22:01:56Z (bGENEaLOGy `cc437e91`) — no
gating ahead of a successful testnet run; the wallet/bPay work blocks are
lifted for testnet scope. Mainnet funds, the vending treasury and the meter
treasury are out of scope here and stay untouched.

Preconditions (execute them; there is no gesture to wait for):
1. A dedicated ops wallet (throwaway, testnet-only, agent-held) floated with
   Base Sepolia ETH.
2. Its key exported as `X402_OPS_WALLET_KEY` (env-only; root-owned shell, never files/git).
3. Testnet USDC carrying EIP-3009 on 84532 minted to a payer throwaway
   (verify the deployment address against Circle's published Base Sepolia
   USDC at execution time — never from memory).

Smoke (zero production):
```
X402_OPS_WALLET_KEY=0x… cargo run --locked --manifest-path ops/x402-door/Cargo.toml \
  --features live-wiring -- ops/x402-door/sepolia/door.config.example.json
```
Then, from a payer throwaway:
1. POST /verify with an exact EIP-3009 authorization (small amount) → expect
   `{valid: true}` and a Reserved journal row.
2. POST /settle → expect Success with a tx hash; confirm the receipt on the
   public Base Sepolia explorer; journal row Settled with evidence.
3. POST /settle again (same nonce) → the SAME evidence replayed, one
   execution.
4. An upto authorization settled at less than max → reconciled-down row.
5. Negative: expired validBefore → verify refusal naming expiry.

Receipts: journal tree + explorer txids into docs/dispatches/ when run.
