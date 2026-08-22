# RECEIPT — JUNGLE ARMED · bmesh-ram conformance on the b-build's home chain (zCode)

**Founder word:** *"go"* (2026-08-22, after the fleet went public and the two-track
ruling named Jungle the b-build's forge). **Seat:** zCode (GLM 5.3).
**Status:** LANDED — `crates/bmesh-ram/tests/jungle_conformance.rs`, 4 tests, all green
(crate total **17 passed**).

## 1 · Live capture (keyless, pinned endpoint)

`jungle4.api.eosnation.io` (the jungle-account postop's pin), 2026-08-22 ~05:4x UTC:

| field | value |
|---|---|
| rammarket base | 58,110,658,174 RAM |
| rammarket quote | 11,825,629.6455 EOS (= 118,256,296,455 raw) |
| global max_ram_size | 68,719,476,736 (64 GiB) |
| global reserved | 10,608,818,562 |
| global total_ram_stake | 18,256,296,455 |
| derived spot | ≈ 0.2084 core/KiB (mainnet tonight: 0.3399) |

## 2 · Cross-chain findings, all measured before any assertion was written

1. **`max − reserved == relay base` holds exactly on Jungle too** — the invariant is
   structural, not mainnet's accident.
2. **The virtual seed is per-chain:** Jungle's `quote − stake` = **100,000,000,000 raw
   = 10,000,000.0000** — exactly **10× mainnet's** — because init seeds
   `token_supply/1000` and Jungle's genesis supply differed. The LAW (seed = genesis
   supply/1000, conserved by lockstep) is structural; the NUMBER is genesis.
3. **Round-trip loss on 100.0000 = 9,977 raw — identical to mainnet TO THE UNIT**
   (both ceil'd fees 9,975 + exactly 2 truncation units).
4. **`buyrambytes(4096)` → 4095 again** — the double-fee one-byte undershoot
   reproduces on an independent chain.

## 3 · Acceptance

```
running 4 tests   (jungle_conformance)  test result: ok. 4 passed; 0 failed
crate total: 6 + 4 + 3 + 4 = 17 passed · 0 failed
```

Vectors derived independently in WSL python3 first (session pasted in the work log);
assertions written after, from those numbers only.

## 4 · Honest blockage, named not guessed around

**POWERUP state on Jungle is NOT captured:** the pinned node's HTTP plugin rejects
dotted 14-char table names (`powerup.state`/`powerup.config` → "Name is longer than
13 characters" / "Unsupported table name"). Per the anti-guess law, one focused
attempt per lane; the bmesh-meter Jungle vectors are **deferred** until a node or
method that accepts dotted table names is pinned (a different public Jungle host, or
cleos against a local node). No workaround was improvised.

## 5 · What this arms

Per the two-track ruling: the b-build forges on Jungle. Its pricing brain
(bmesh-ram) now holds live conformance on BOTH chains — mainnet (A-prototype reads)
and Jungle (b-build forge) — so the b-token contract's RAM interactions can be
conformance-tested against these vectors before it ever signs anything on either.

**Execute the prompt as written.**
