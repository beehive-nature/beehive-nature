# WB004 live lane — the website-independent Jungle4 multisig lifecycle

Order (founder, 2026-10-12): prove the native Antelope `eosio.msig` path
end-to-end on Jungle4 under one dedicated delegated authority, with every
negative control a real chain refusal, a cold-recovery proof that needs no
browser / coordinator / MSIG.app, and an honest statement of how BNR
authorization becomes enforceable on-chain. MSIG.app stays an optional view.

## Files

- `codec.mjs` — pure Antelope wire codec (node:crypto only; CI-safe).
- `keys.mjs` — DPAPI custody loader (in-memory pipes; plaintext never on
  disk, never printed), WIF handling, both pubkey encodings, fc-canonical
  K1 signing (sources cited inline).
- `rpc.mjs` — minimal Jungle4 RPC client (CryptoLions primary, Greymass
  secondary).
- `selftest.mjs` — offline pinned vectors (LEB128, name shapes, TAPOS,
  base58, the account's own public key encodings as real anchors).
- `run-lifecycle.mjs` — the staged live run: `--stage NAME` resumes; every
  refusal is a first-class expectation; every acceptance is block-inclusion
  verified (phantom-acceptance guard).
- `cold-recover.mjs` — the replacement-worker proof: reconstructs and
  verifies the whole lifecycle from `receipt-wb004-live.json` (public data)
  plus the chain. No keys, no session state.
- `probe-sig-layout.mjs` — the ground-truth probe that fixed the K1 wire
  layout against real chain signatures (4/4 recovered signers matched the
  accounts' on-chain keys).
- `probe-exec-auth.mjs` — the discriminator that proved the deployed
  contract gates `exec` on stored approvals.
- `state.json` / `receipt-wb004-live.json` — run journal and public receipt
  (exempt from the hex marker law as generator-owned public-chain-data JSON;
  see scripts/secret-scan.sh).

## Authority

One test account: `bzcodejungle` (this seat's Jungle4 account, keys in
CurrentUser DPAPI per the 2026-09-08 custody receipt). One delegated
permission `wbfoursignr` (parent `active`), `linkauth`-bounded to
`eosio.msig::approve`, `eosio.msig::unapprove` and `eosio.token::transfer`,
rotated K2 → K3 mid-lane. No production authority touched; the bounded inner
action is a 0.0001 EOS donation to `junglefaucet` per proposal.

## Run

```
node selftest.mjs                      # offline vectors
node run-lifecycle.mjs --stage p1      # (or no --stage: all, resumable)
node cold-recover.mjs                  # chain-only verification
```
