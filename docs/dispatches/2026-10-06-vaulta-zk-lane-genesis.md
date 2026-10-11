# Vaulta/ZK lane genesis — aggregate claims over private receipt sets; research receipts first, tungsten gate before any coupling

Seat: zCode (GLM). Date: 2026-10-06. Founder split, verbatim: "Vaulta/ZK
lane → prove aggregate claims about private receipt sets … No reason to
couple those two efforts until the ZK lane has its own tungsten result."
Opened as a SEPARATE lane (zcode/vaulta-zk-2026-10-06) immediately after
the receipt-observability spec amendment was ratified green
(run 37530921572).

## What this genesis is (and deliberately is not)

LANDED: the source study (docs/raids/RAID-VAULTA-ZK-1.md) and the law
(docs/specs/SPEC-ZK-RECEIPT-AGGREGATES-1.md). NOT landed: any circuit,
prover, or verifier — this lane's technology choices are UNVERIFIED until
its own §checks close, and per the read-first law the claims stay capped.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

**CLAIM 1 — the synergy is real and already precedented in-tree.**
EVIDENCE: the estate already publishes aggregates over private data and
discards the raw — docs/receipts/ant-reach-2026-10-06.json (365/365
concordance public; endpoint identities as 16-hex fingerprints; raw
addresses never published). BOUNDARY: that aggregate is procedural
(trusted party computes it); NOTHING cryptographic exists yet in this
lane. The ZK question is whether the same statement becomes verifiable
without the receipts — asked, not answered.

**CLAIM 2 — the verifier venue hypothesis is pinned with sources.**
EVIDENCE: searches found NO Vaulta-native zkSNARK precompile; the credible
path is Vaulta EVM (github.com/VaultaFoundation/evm-contract — the
authoritative precompile source; evm-node exposes Ethereum-style RPC via
SHiP) + a standard snarkjs Groth16 verifier over alt_bn128 precompiles
0x06–0x08. Ethereum-side planning figure: Groth16 verify ≈100k+ gas floor
(7blocklabs). BOUNDARY: whether Vaulta EVM actually wires those
precompiles is UNVERIFIED — named as check #1 with the exact greps and a
testnet-deploy alternative. No Vaulta gas claim is made.

**CLAIM 3 — the lane knows its own gate.**
EVIDENCE: RAID §tungsten defines four receipts before any coupling:
forgery (mutation-proven, bmesh-meter discipline), leak (bounded
distinguisher, wording capped at "sound by construction against the
pinned test set"), cost (Vaulta EVM testnet gas receipt), scale (n=1k,
n=10k proof times). BOUNDARY: none of the four exist yet.

## Conditions, named not hidden

This genesis was authored during a local outage: the seat's shell hung
(even `echo` timed out) and DNS resolution failed (EAI_AGAIN on external
fetches) — files were written via direct file tools; the commit/push
happens when the shell recovers. Research completed before the outage
worsened; the docs.eosnetwork.com precompile page could NOT be fetched
(one more reason check #1 stays open).

## Next owners / beats (spec §sequence)

2 ← CURRENT: precompile confirmation (evm-contract source grep or
testnet deploy); EVM-side testnet account (Jungle4 EOS-side identities
do not automatically carry — faucet may be a founder gesture); tooling
pick (circom+snarkjs for the first proof; arkworks if it graduates into
crates/). 3: count-only circuit (kind-predicate + Merkle fold; sums are
the SECOND circuit). 4: testnet verify + cost/scale receipts. 5: only
after full tungsten — revisit coupling with the Autonomi upstream lane.
