# OPTIONS — BOUNDED PRIVATE LOOKUP AT 10^10
**From:** goose (instrument-reading) | **To:** Seat 1 / founder
**Authority:** Seat 1 ruling (constraint ruled; mechanism not; bring options, do not design)
**Law:** 8a, 8c, 8m, post-op register

## THE CONSTRAINT (ruled)
Private lookup download MUST stay bounded at 10^10. Fixed depth-12 gives:
- At 10^6 names: ~8 KB per lookup (244 entries x 32 B) — manageable
- At 10^10 names: ~77 MB per lookup (2.4M entries x 32 B) — PHYSICAL FAILURE

## THE COUPLING (must accompany every option)
k-anonymity set and download cost MOVE TOGETHER. A larger anonymity set requires downloading more data.
:125 currently advertises only the anonymity set. Every option below states BOTH.

## OPTION A: ADAPTIVE PREFIX DEPTH (the obvious candidate)
Mechanism: depth = ceil(log2(N)) - k, where k is a fixed constant. Page size = 2^k entries (constant regardless of N).

| k | Page size | Download (binary) | k-anonymity floor |
|---|---|---|---|
| 5 | 32 entries | ~1 KB | 32 |
| 8 | 256 entries | ~8 KB | 256 |
| 12 | 4,096 entries | ~128 KB | 4,096 |

Page size is CONSTANT — does not grow with N. At 10^10, k=8 gives 8 KB (vs 77 MB fixed depth-12).
k is a values call: how much anonymity is enough? Download and anonymity are coupled (both = 2^k).

## OPTION B: AUTHENTICATED BLOOM FILTER PER PREFIX PAGE
Mechanism: Each depth-12 prefix page carries a Merkle-committed Bloom filter. User downloads the filter, not the full page.

| Parameter | Value |
|---|---|
| Filter size at 4096 entries, 1% FPR | ~6 KB |
| k-anonymity | 4,096 (full page scope) |
| False positive rate | 1% (tunable; conservative on non-membership) |

Trade-off: false positives mean a user might think a name is taken when it is not. Adds a committed data structure. Fixed depth-12 is fine (filter is compact regardless of page population).

## OPTION C: PIR (PRIVATE INFORMATION RETRIEVAL)
Mechanism: Server holds an encrypted index; user submits an encrypted query. Only the answer downloads.

| Parameter | Value |
|---|---|
| Download | O(1) per query (~proof size) |
| k-anonymity | Information-theoretic (perfect) |
| Server cost | O(N) per query (expensive at 10^10) |

Trade-off: requires server-side computation — may conflict with Autonomi's no-intermediary model. PIR is computationally expensive at scale. Highest cryptographic complexity.

## OPTION D: RANGE QUERY (USER-SELECTED SUB-RANGE)
Mechanism: User queries a sub-range of the prefix page instead of the full page.

| Range fraction | Download | k-anonymity |
|---|---|---|
| Full page (1/1) | ~128 KB (at k=12) | 4,096 |
| Half page (1/2) | ~64 KB | 2,048 |
| Quarter page (1/4) | ~32 KB | 1,024 |

Trade-off: user selects privacy/cost trade-off per query. Server learns the sub-range (reduced anonymity).

## SUMMARY
| Option | Download @ 10^10 | k-anonymity | Complexity | Fits Autonomi? |
|---|---|---|---|---|
| A: Adaptive depth (k=8) | ~8 KB | 256 | Low | Yes |
| A: Adaptive depth (k=12) | ~128 KB | 4,096 | Low | Yes |
| B: Authenticated Bloom filter | ~6 KB | 4,096 | Medium | Yes (adds committed structure) |
| C: PIR | ~1.7 KB | Perfect | High | Uncertain (server model) |
| D: Range query | Variable | Variable | Low | Yes |

## :125 CORRECTION NEEDED
Whatever option is chosen, :125 must state BOTH the anonymity set AND the download cost.
Currently it advertises only k-anonymous lookup without the download size.
At 10^10, the download cost is the binding constraint, not the anonymity set.

## SCOPE FENCE
Options only. The constraint is ruled; the mechanism is Seat 1 / founder call. Do not design.
Execute the prompt as written.