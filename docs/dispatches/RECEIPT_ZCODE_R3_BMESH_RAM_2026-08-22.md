# RECEIPT — LANE R-3 · bmesh-ram built, tested, mutation-proven (zCode)

**Lane:** R-3, opened by founder word 2026-08-22 (*"are we modeling Vaulta's RAM:A market?
create the gold standard the first time so claude code doesn't have to fix it later"*)
· **Seat:** zCode (GLM 5.3)
**Status:** BUILT — committed with this receipt; the STOCK-resource sibling of
`bmesh-meter` (POWERUP = flow resources; RAM relay = stock resources — the doctrine
DISPATCH_BMESHASI_SUPPLY_RESEARCH §1.4 set and this lane completes).
Files: `crates/bmesh-ram/` (new: lib.rs, market.rs, 3 test files, Cargo.toml),
root `Cargo.toml` (+1 member line). Zero dependencies added.

---

## 1 · Read first, then written (law 3)

Pinned (same commit as R-2): **AntelopeIO/reference-contracts @
`c526479a48370981a1e9f0ac6b3bb0e4f737afa2`**, fetched via `gh api`, read in full:

- `contracts/eosio.system/src/exchange_state.cpp` (110 lines) — the whole Bancor math
- `contracts/eosio.system/include/eosio.system/exchange_state.hpp` — the `rammarket` table
- `contracts/eosio.system/src/delegate_bandwidth.cpp` — `buyram` :49-100, `buyrambytes` :25-31, `sellram` :115-146
- `contracts/eosio.system/src/eosio.system.cpp` :578-586 — relay init (quote seeded `token_supply/1000`)

Facts the source forced (all encoded; each one my memory would have gotten wrong):

1. **The deployed path is `double` arithmetic, not uint128** — `get_bancor_output`
   (es:81-94) promotes int64→double, computes `in·ob/(ib+in)`, casts back with
   TRUNCATION. The pow-based `convert_to/from_exchange` exist but the RAM market
   calls `direct_convert`, the constant-product shortcut. Weights (0.5/0.5) are
   never read on this path.
2. **Fee = integer ceil, and it leaves the curve** — `(x + 199)/200` (db:60,140);
   reserves move only by the fee-net amount.
3. **`buyrambytes` takes the fee twice, approximately** — `cost / 0.995` as double,
   truncated to int64 (db:30), then `buyram` applies its own ceil'd 0.5% on top.
4. **The virtual seed is exact arithmetic** — init quote = `supply/1000` (sys:583);
   buy/sell move quote and `total_ram_stake` in lockstep, so `quote − stake` is
   invariant forever.

## 2 · Live capture (conformance anchor)

2026-08-22 ~03:15 UTC. `POST /v1/chain/get_table_rows` — **greymass and eosphere
returned byte-identical rows**; chain `aca376f2…` head 516,155,085. Rows still carry
the historical "EOS" symbol (Vaulta "A" = same unit, same 4-dp — recorded so nobody
"corrects" it wrongly later).

| field | value |
|---|---|
| rammarket base | 75,800,886,740 RAM |
| rammarket quote | 25,160,289.4241 core (= 251,602,894,241 raw) |
| global max_ram_size | 418,945,440,768 |
| global total_ram_bytes_reserved | 343,144,554,028 |
| global total_ram_stake | 241,602,894,241 |

**Both §2c invariants reproduced exactly, tonight:** base = `max − reserved`
(75,800,886,740 ✓ to the byte) and `quote − stake` = 10,000,000,000 raw =
**1,000,000.0000 core** — the never-deposited genesis seed, still exact.

## 3 · Independent derivation (before any Rust)

WSL python3 (an IEEE-754 double machine — replicates the C++ promotions faithfully);
session pasted in the work log. Key results, all encoded as test vectors:

```
V1  buyram 100.0000 (quant=1,000,000): fee=5,000 · after_fee=995,000 · bytes_out=299,764
    state → B=75,800,586,976 · Q=251,603,889,241
V2  sellram(299,764): tokens_out=994,998 · fee=4,975 · proceeds=990,023
    ROUND-TRIP LOSS = 9,977 = both fees (9,975) + exactly 2 truncation units
V3  buyrambytes(4096): cost=13,595 · cost_plus_fee=13,663 (int(13595/0.995))
    → buy() yields bytes_out = 4,095  — ★ THE DEPLOYED "EXACT BYTES" ACTION
      UNDERSHOOTS BY ONE BYTE at live state (double-fee approximation, measured)
V3' trunc discriminator: cost_for_bytes(5) → exact 16.596… trunc 16 (round would give 17)
V4  invariants above; sell(1 byte) at live prices = legal: out 3, fee 1, net 2
    (spot ≈ 0.3399 core/KiB — coherent with R8's 0.3373 a fortnight earlier)
```

## 4 · The crate

Pure `std`, no dependencies (`Cargo.lock` unchanged in substance). No priced constants
in `src/` — live numbers live only in `tests/`. `RamMarket { base_bytes, quote_units,
total_ram_stake }` with `buy` / `sell` / `cost_for_bytes` / `spot_units_per_byte`;
guards `BuyBelowMinimum` (db:85), `SellBelowMinimum` (db:128), `NonPositivePayment`
(db:57). `sell` guards BEFORE mutating — an `Err` leaves state untouched, mirroring
the chain's transaction revert (see §7.1: the first test run caught me mutating
first; fixed against my own first draft).

## 5 · Acceptance — `cargo test -p bmesh-ram`, WSL, real and unedited (final run)

```
running 6 tests   (live_conformance)   test result: ok. 6 passed; 0 failed
running 3 tests   (negative_controls)  test result: ok. 3 passed; 0 failed
running 4 tests   (properties)         test result: ok. 4 passed; 0 failed
running 0 tests   (doc-tests)          test result: ok. 0 passed; 0 failed
```

**13 passed · 0 failed · 0 warnings.**

## 6 · Mutation proofs (controls are not vacuous)

| mutant (really applied, then restored) | control | failure observed |
|---|---|---|
| fee floor `amount/200` for `(amount+199)/200` | control_1 | `left: 5000, right: 5001` FAILED |
| rounding for truncation in `bancor_input` | control_2 | `left: 17, right: 16` FAILED |
| reserves swapped in the buy direction | control_3 | `left: 3302620, right: 299764` FAILED |

Restoration: `diff` against backup empty (`RESTORED_EXACT`); §5 is the post-restore run.

## 7 · Residuals, recorded not hidden

1. **My first `sell` mutated before guarding, and my first v5 test asserted the
   wrong law** (at live prices selling one byte is legal — 3 units out). The failing
   run caught both; fixed to guard-first transactional `Err` and a measured
   micro-vector, plus a constructed 1:1 relay where the `>1` guard genuinely bites.
2. **The 2^53 band is real and owned, not hidden**: `qaf·base` exceeds 2^53 at
   tonight's magnitudes; the source accepts double rounding and so does the mirror.
   The property suite measures double-vs-u128-exact deviation on the corpus
   (diff = 0 on every vector tonight) — an empirical band, documented as such,
   never claimed as a source guarantee.
3. `buyrambytes`' one-byte undershoot is a fact of the deployed approximation at
   tonight's state, encoded as V3. It is NOT a claim the undershoot is always
   exactly one byte — the vector pins what was measured, nothing more.

## 8 · Fences held

- **S-1** — no `b`-denominated amount in any identifier in `src/`: grep clean.
- **Voucher fence** — `voucher|bTiMe|workerbee` matches only the fence note in
  `lib.rs`; zero code identifiers.
- **Stub law §0.7** — no `allow(dead_code)`, no underscore-silencing; the pow-based
  general-weight functions are absent (not on the RAM path), not silenced.
- **No priced constants in `src/`**; no provider calls, no chain I/O, no clock —
  state in, state out; all live figures in `tests/` with the capture provenance.

## 9 · Handback

Committed with this receipt (one wave): the crate, the workspace member line, this
file. Not pushed — stands down for the founder push-roster word alongside the
session's other local commits (747c3ca · 5acc921 · 3af071e).

**Execute the prompt as written.**
