# Phase A receipt — Arweave permanence mirror (2026-07-23, Cowork seat)

Docket DOCKET_BUZZ_SOVEREIGN_RELAY_1 Phase A honesty-gate, proven locally (no AR spent, no VPS, no Vaulta):

```
arlocal started on port 1984
Arweave(local) up on :1984
nostr identity d43412b6d740d6a3...
  relay: connected ws://localhost:3000
  relay: EVENT accepted OK
signed event b9545eb2c6ecbb2b... verifies at source
mirrored to Arweave tx ySi4HHbrdxVR827O...
read back from Arweave: b9545eb2c6ecbb2b...
SIGNATURE RE-VERIFIED FROM ARWEAVE COPY: PASS
tamper detection (mutate the Arweave copy): PASS (rejected)
PHASE_A_RECEIPT: PASS
```

What this proves (the sovereignty claim): a signed Nostr event published through the
live local relay, mirrored to Arweave, read back FROM the Arweave copy, and its Schnorr
signature re-verified with NO relay and NO trust in the mirror. Tampering is caught.
=> If every relay vanished, the signed log is reconstructable + independently verifiable
from Arweave. The relay is now a disposable hot cache over permanent truth.

## Honest scope (what is proven vs pending)
- PROVEN local: mirror + trustless re-verify + tamper-evidence, one event, arlocal.
- PENDING for mainnet: (1) a funded Arweave wallet (real AR) — a money step, not a code
  step; (2) ANS-104 bundling to amortize fee across many events (docket A-2) — batching,
  not architecture; (3) the subscribe-all-and-stream loop (this proves one event; the
  worker generalizes to the REQ firehose). None change the architecture just proven.

## The Vaulta correction (ruled 2026-07-23, receipts)
A relay is a live WebSocket SERVER PROCESS; a blockchain is not a host for processes.
Vaulta "RAM" is on-chain smart-contract STATE storage priced by a Bancor market
(docs.eosnetwork.com/.../resources) — you cannot run buzz-relay "in Vaulta RAM".
b-indexer is a query process, not a relay host either. Decentralization here = (a) the
log self-verifies off any relay (proven above) + (b) permanence mirror (proven above).
The relay still needs a reachable host (cheap VPS or a tunnel) — that is the ONLY thing
Vaulta/b-indexer do NOT replace. Amendment V (Vaulta-native) applies to settlement/
economics + hosting the b-indexer, NOT to hosting the websocket relay.
