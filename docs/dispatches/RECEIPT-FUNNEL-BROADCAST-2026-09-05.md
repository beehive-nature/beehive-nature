# RECEIPT — z3.3: the ONE testnet broadcast — FIRED and CONFIRMED (2026-09-05)

## The trigger, as ordered

- Tithe address filed by founder word (`9952f366`):
  `0x8fD7252A29FB759755E30A15E966932EaAD91b75` → box runner copy placed.
- Funds: the founder handed the authenticated Coinbase CDP faucet screen
  (Base Sepolia · ETH · `0xb43b…37af`); this seat pressed **Send 0.0001 ETH**
  by desktop control on his word. **0.0012 ETH landed** (08:11:11Z,
  sepolia.base.org) — the queue delivered more than the button asked.

## The broadcast (one, as ordered)

```
tx:      0x24a0c5cf926ba2b746c8d4ac3788ec28452f5500beffcb02cd6d3b66be7e9b7c <!-- PUBLIC-CONSTANT: funnel testnet tx hash, Base Sepolia 84532 -->
link:    https://sepolia.basescan.org/tx/0x24a0c5cf926ba2b746c8d4ac3788ec28452f5500beffcb02cd6d3b66be7e9b7c <!-- PUBLIC-CONSTANT: funnel testnet tx hash, Base Sepolia 84532 -->
chain:   Base Sepolia (84532) · block 46413807 · status 0x1 · gasUsed 43160
from=to: 0xb43b94ae967f0ae2e1bc7b5453086ab308f537af (the issued funnel-test key, nonce 0)
v:       169100 = 2·84532 + 35 + 1  (EIP-155, recovery parity 1)
signed:  locally (broadcast.mjs, self-checked by recovering the sender
         from the signature BEFORE sending); node hash == local hash byte-identical
```

## The decoded input — the referralFees entry visible, verbatim from the chain

```json
{"kind":"peer-funnel/signal-intent+exact-multi","spec":"SPEC-PEER-FUNNEL-1 §receive",
 "to":"0x89881F83A8C9CE06e34cbDD50A612909a784d7C6",
 "referralFees":[{"recipient":"0x8fD7252A29FB759755E30A15E966932EaAD91b75","basisPoints":1000}],
 "exactMultiAfterSettlement":[
   {"role":"seller","address":"0x89881F83A8C9CE06E34cbDD50A612909a784d7C6","share":"0.90"},
   {"role":"tithe.founder","address":"0x8fD7252A29FB759755E30A15E966932EaAD91b75","share":"0.10"}],
 "network":"base-sepolia","note":"testnet proof of the receive-path instruction; zkp2p itself is mainnet-only"}
```

The tithe rides as ONE referralFees entry at 1000 basisPoints (the 10 % law),
and the after-settlement exact-multi split (seller 0.90 / tithe 0.10) rides
the same instruction — both readable by any stranger from the public record
alone.

## State after

- The funnel's live rail remains Base MAINNET (receive call live on
  skaists.dev, honest-empty until a customer intent names the estate
  address); this testnet tx proves the instruction + tithe shape end to end
  with real gas, real signature, real inclusion.
- The funnel-test key's remaining testnet balance stays on the key
  (≈0.0011 ETH after gas) for future funnel proofs.
