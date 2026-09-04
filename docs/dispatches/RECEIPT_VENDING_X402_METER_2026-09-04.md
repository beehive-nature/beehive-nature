# RECEIPT — the x402 meter rules landed: ONE METERED SESSION, paused not killed, audited to a state (2026-09-04)

The founder's four x402 items (docs/raids/X402-SORT-2026-09-01.md — RULES
only, never Hedera code) are in SPEC-VENDING-1 §x402, the contract's meter
actions, and `tool/x402audit.mjs`. Receipt = session 42 on Jungle4, every
load-bearing step a landed tx with a render-verified monitor deep-link.

## THE SESSION (id 42, agent vendingtest2, rail vaulta @ basis 0.6000 A + tithe 1000 bp, ceiling 5.0000 A)

| step | tx (all Irreversible; monitor deep-link = `monitor.jungletestnet.io/#accountActions:<txid>`) |
|---|---|
| rate row v2 (cost basis + tithe field) | `b0e9b16b619e2e9556f3fa64d701a8a6329736030ba2853b7c2f5cd3c803e1da` <!-- PUBLIC-CONSTANT: jungle4 txid --> |
| opensess — the upto CEILING signed once | `2d022d4f990f5037e3bd7eb005c1410f025f55edf09e6030f08121e977391400` <!-- PUBLIC-CONSTANT --> — rendered: block 285027916, 115 µs |
| settle ZERO — the nonce burns anyway (Tally rule) | `c952fd825f0e16219ed0916c875c1e8d07cc166500fa85aad25b746e695826f1` <!-- PUBLIC-CONSTANT --> — rendered: block 285027917, 60 µs; the nonce table row reads `{value:420001, amount:"0.0000 A"}` |
| settle REPLAY same nonce | **REFUSED** — "nonce spent — replay refused" (pushed through cryptolions; the same probe through greymass served a CACHED identical-txid "OK" — cache trap banked: refusal probes must never share an RPC with the original) |
| settle 3.0000 A (the real credit) | `cc776c19c663621c5da5fb7dcfcdf08115345823d8044415a79e821a19bde3f1` <!-- PUBLIC-CONSTANT --> |
| charge 2 units → burned 1.2 | `e8c5e437e626e3f5089f410d116e919099e5a58b6e162ca3756e318388ce50ae` <!-- PUBLIC-CONSTANT --> |
| charge 1000 units (600 A) | **REFUSED** — "over ceiling — upto max refused (verifyAgainst rule)" |
| charge 2 units at the edge → **PAUSE AT ZERO, committed** | `5f0315c47ab5903ea687c309b9490b0d3aa640a0c12f29ea14f521bbdcd46fb3` <!-- PUBLIC-CONSTANT --> — rendered: block 285028052; session state → 1 (PAUSED), burned 4.8, NOTHING killed |
| charge 1 unit WHILE PAUSED | **REFUSED** — "session paused — resume first (pause, not kill)" |
| settle 2.0000 A top-up WHILE PAUSED | `571dcea745e572d2ebf6f17c0234838e9c443a56a315ca40496fd9102a649320` <!-- PUBLIC-CONSTANT --> — the session LIVES while paused |
| resume → ACTIVE | `3847107ab6a450767d8a89cd86ab58ef1fa72fb2bcf3b7221f2ee8320dfa7bc5` <!-- PUBLIC-CONSTANT --> |
| auditmark pass 1 → **PENDING_ANCHOR (honey)** | `925a7f43621a78cde850f72070de350012cf42784e1516d775b7c5fac690ebf9` <!-- PUBLIC-CONSTANT --> — record sha256 `9003f12af1da77e732ef10b6cd09588efe43a0a4369b8a3056e8928c688754ae` <!-- PUBLIC-CONSTANT --> |
| auditmark pass 2 (record anchored) → **PASSED (capped)** | `de9cc2028645f98d0a9a8c0167b0a87fdc8b99fb8a75cfcbece26d8b6ad4a87b` <!-- PUBLIC-CONSTANT --> — rendered: block 285028345; record sha256 `5900f0543b84a696fe44539347c880000894d64b461c1519b1f8a22a8f5c069f` <!-- PUBLIC-CONSTANT --> |

**FINAL session row (chain truth):** `{state: 0 (ACTIVE), credit: 7.0000 A,
burned: 4.8000 A, ceiling: 5.0000 A, audit_state: 0 (PASSED), audit_hash:
5900f054…}` — four burned nonces on chain (one at zero).

## THE PURE 9-CHECK AUDIT (tool/x402audit.mjs — Tally audit.ts shape, z3.2 comb states)

Pass 2 verdict, 9/9 ok: `arithmetic_fraud` 0.6000 A × 8 = 4.8000 A (BigInt) ·
`over_capture` 4.8 ≤ 7.0 · `over_max` 4.8 ≤ ceiling 5.0 · `terms_mismatch`
rail vaulta @ basis + 1000 bp · `nonce_replay` 4 settlements 4 distinct ·
`pause_integrity` no charge under pause · `tithe_split` 4.3200 + 0.4800 =
4.8000 · `anchor_pending` 9003f12a… · `clock_sanity` 16 monotonic.

**The four states, all demonstrated:** PENDING_ANCHOR = honey (pass 1,
auditmarked) → PASSED = capped (pass 2, auditmarked) → **FAILED = the --flag
hue #c07f1c** (a forged charge event appended to the log trips
arithmetic_fraud: 6.6000 ≠ 4.8000 — proven, never a new red) → INCONCLUSIVE
= nectar (the not-evaluable class: missing tithe field / malformed anchor /
empty record — a bill with a truly EMPTY event log audits FAILED, correctly:
that is a discrepancy, not nectar).

## Deploy notes (traps banked)

- v2 setcode bills ~441 KB (wasm 43.3 KB → the ~10× Spring rule holds);
  funded by 28.4990 A + 7.6729 EOS in RAM buys (`606be5ba…` 20 A,
  `5d8d8228…` 7 EOS, `1020d177…` 8.4 A — quota → 465,180 B).
- setcode v2 `cd7f5ac8d7f990fc83f2624c299b423f616e6efe14227b69aaaf540b6948a1df` (1445 µs of powerup CPU) · cleos setabi `f0616006…`. <!-- PUBLIC-CONSTANT: jungle4 txid -->
- Old-shape rates row cleared (`rmrate 448d7fee…`) BEFORE setcode — a
  struct change without the sweep breaks table reads (migration law).
- eosio::buyrambytes began refusing EOS mid-window while eosio::buyram
  (quant form) still worked — same account, same balance; noted, not
  explained.

## The one-line

The stateful party is the contract on Vaulta: credit lands only from settled
nonces (zero-amount burns included), charges clamp under a once-signed
ceiling, exhaustion PASES instead of killing, and a pure 9-check audit walks
the four comb states — honey, capped, flag, nectar — with the verdict
hash-pinned on the session row.
