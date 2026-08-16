# RECEIPT — LANE R-2 · bmesh-meter built, tested, mutation-proven (zCode)

**Lane:** R-2 (`DISPATCH_BMESHASI_SUPPLY_RESEARCH_2026-08-16` §5) · **Seat:** zCode (GLM 5.3)
**Status:** BUILT — staged on the mount, **not committed**; Seat 3 spot-verifies and lands per
the R-1 precedent (one seat, one tree). Files: `crates/bmesh-meter/` (new), `Cargo.toml`
(+1 member line), `Cargo.lock` (+4 lines, zero dependencies added).
**INDEX note:** indexing is Cowork's standing duty; this receipt is not yet indexed.

---

## 1 · Read first, then written (law 3)

The pinned source was fetched and read in full before any code existed:

```
$ gh api "repos/AntelopeIO/reference-contracts/git/trees/c526479a48370981a1e9f0ac6b3bb0e4f737afa2?recursive=1" --jq '.tree[].path' | grep -i powerup
contracts/eosio.system/src/powerup.cpp            ← 402 lines, read in full
contracts/eosio.system/include/eosio.system/powerup.results.hpp
$ gh api ".../contents/contracts/eosio.system/src/powerup.cpp?ref=c526479a…" \
    -H "Accept: application/vnd.github.raw" > /tmp/powerup.cpp && wc -l → 402
$ gh api ".../contents/contracts/eosio.system/include/eosio.system/eosio.system.hpp?ref=c526479a…" \
    → powerup_state_resource (eosio.system.hpp:721-755): exponent double · decay_secs uint32 ·
      utilization/adjusted_utilization/weight int64_t
```

Five facts the staging prose compressed, all encoded (source over prose, per the lane):

1. **The fee path is `double` arithmetic with ONE `std::ceil` at the end**
   (powerup.cpp:300-314) — not integer math with intermediate rounding.
2. **The flat-below-watermark rule lives inside `calc_powerup_fee`** (304-308):
   below the watermark the stretch pays flat `price_function(adjusted_utilization)`,
   then the price integral above it.
3. **A guard the prose did not name:** `exponent == 1.0` forces
   `min_price == max_price` (cfgpowerup, 210-211). This is *why* flat-at-max at
   `e = 1` is consistent. Encoded as its own rejection (`ExponentOneRequiresEqualPrices`).
4. **The ratchet decay truncates then clamps** (111-114):
   `int64(diff · exp(−elapsed/decay_secs))`, clamped to `[0, diff]`.
5. **`utilization_increase <= 0` returns 0, not an error** (263) — mirrored
   literally in `calc_fee`; the *action layer* rejects negatives
   (`net_frac can't be negative`, 345-346), mirrored in `record_rental`.

Also mirrored from the action layer: `check(f > 0 …)` (362) — a rental whose
ceiled fee is zero is refused, not recorded (`FeeBelowMinimum`, with a
reachable test via f64 underflow).

## 2 · The crate

Zero dependencies (pure `std`), so `Cargo.lock` gains only the package entry.
No default parameter values anywhere in `src/` — curve values are a founder
gate (§6.1 of the staging dispatch); the live mainnet numbers exist only in
`tests/` as conformance vectors.

| file | contents |
|---|---|
| `src/lib.rs` | provenance docs, fence note, module wiring |
| `src/params.rs` | `PriceCurveParams` + `validate()` mirroring the cfgpowerup guards **in the source's order** (203-212) |
| `src/curve.rs` | `price_at` (284-298, incl. the flat-at-max `e=1` branch) and `price_integral_delta` (274-280, term-for-term) |
| `src/market.rs` | `ResourceMarket`: `update_utilization` (105-117), `calc_fee` (262-315), `record_rental` (355-365 essentials), `price_now` + ratchet accessors — the autoscaler's input signal, exposed readably per §5.2 |

Stub law §0.7: `grep -rn "allow(dead_code)\|allow(unused" crates/bmesh-meter/` →
no matches. Unbuilt parts are absent (the stake-weight transition machinery is
out of scope and not present at all).

## 3 · Acceptance — `cargo test -p bmesh-meter`, WSL, real and unedited (final run)

```
$ wsl -e sh -c '. ~/.cargo/env && cd /mnt/c/Users/travi/beehive-nature && cargo test -p bmesh-meter 2>&1'
   Compiling bmesh-meter v0.1.0 (/mnt/c/Users/travi/beehive-nature/crates/bmesh-meter)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 4.08s
     Running unittests src/lib.rs (target/debug/deps/bmesh_meter-cc85ab4e8d80729d)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/live_conformance.rs (target/debug/deps/live_conformance-135761bdd73739e1)

running 5 tests
test below_watermark_pays_flat_price_at_watermark ... ok
test exponent_one_prices_flat_at_max_price ... ok
test whole_market_from_zero_costs_min_plus_half_spread ... ok
test ratchet_decay_matches_one_e_fold_per_decay_secs ... ok
test spanning_rental_pays_flat_then_integral ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/negative_controls.rs (target/debug/deps/negative_controls-287809e5564e0c0c)

running 7 tests
test exponent_guard_rejects_below_one ... ok
test record_rental_rejects_negative_increase ... ok
test exponent_one_rejects_unequal_prices ... ok
test fee_function_returns_zero_for_non_positive_increase ... ok
test flat_below_watermark_is_priced_not_vacuous ... ok
test increase_beyond_available_is_rejected ... ok
test record_rental_refuses_fee_below_minimum ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/properties.rs (target/debug/deps/properties-8c80255528fbbb68)

running 5 tests
test empty_rental_costs_nothing ... ok
test ratchet_postconditions_hold_on_every_step ... ok
test fee_is_monotone_in_the_interval ... ok
test split_rentals_match_one_shot_within_one_ceil_unit ... ok
test update_at_or_before_the_timestamp_is_a_no_op ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Doc-tests bmesh_meter

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

**17 passed · 0 failed · 0 warnings.** Additivity held at exactly
`split − one_shot ∈ {0, 1}` across the whole corpus — the ceil tolerance the
source implies, encoded as the assertion.

## 4 · Conformance vectors — independently derived (not by the code under test)

Closed form from the source's own comment (265-269), evaluated in WSL python3
*before* the Rust assertions were written; full session pasted verbatim in
`tests/live_conformance.rs`. Key results:

```
u = 0.04130761629094935 · ua = 0.048450898170702715 · p_adj = 6012.690117375947
case1 whole market [0,1]      = 38750.0            → 38750
case2 below watermark (flat)  = 15.747606913882908 → 16      (curve-only: 14.6398… → 15)
case3 spanning the watermark  = 389.13676519082003 → 390
case4 e=1 trap, half market   = 25000.0            → 25000
ratchet gap 1e6: 1 decay → 367879 (raw .4411…) · 3 decays → 49787 (raw .0683…)
```

Every non-integer raw value sits ≥ 0.25 from an integer boundary — last-ulp
`powf`/`exp` wobble (which the pinned source shares via `std::pow`/`std::exp`)
cannot move a `ceil`. Noted honestly in the crate docs.

## 5 · Negative controls — proven by mutation, receipts real

**Mutant 1 — the `exponent >= 1.0` guard deleted from `validate()`:**

```
$ cargo test -p bmesh-meter --test negative_controls exponent_guard
thread 'exponent_guard_rejects_below_one' panicked at negative_controls.rs:48:48:
called `Result::unwrap_err()` on an `Ok` value: ResourceMarket { params:
  PriceCurveParams { min_price: 2500, max_price: 75000, exponent: 0.5, … } }
test result: FAILED. 0 passed; 1 failed
```

**Mutant 2 — the flat-below-watermark block deleted from `calc_fee()`:**

```
$ cargo test -p bmesh-meter --test negative_controls flat_below_watermark
assertion `left == right` failed
  left: Ok(15)
 right: Ok(16)
test result: FAILED. 0 passed; 1 failed
```

The mutant's `15` is exactly the curve-only integral the independent
derivation predicted — the control fails *and* reconfirms the python
arithmetic in the same breath.

**Restoration:** both files restored from backup, `diff` empty
(`RESTORED_EXACT`), full suite re-run green (§3 is that run).

## 6 · Fences held

- **S-1** — no `b`-denominated amount in any identifier:
  `grep -rniE '([0-9] ?b\b|\bin_b\b|\bb_amount\b|amount_b|b_price|b_fee|b_units)' crates/bmesh-meter/`
  → no matches. (`FeeBelowMinimum` matched a first, looser pattern on the
  letters "FeeB" — a false positive of the grep, not a b amount.)
- **Voucher fence** — `grep -rniE 'voucher|bTiMe|workerbee'` matches only the
  crate-level fence note in `src/lib.rs` docs; zero code identifiers. No
  primitive named or shaped like a voucher exists in the crate.
- **No priced constants** in `src/`; **no provider calls, no chain I/O, no
  clock reads** — time and parameters are injected throughout.

## 7 · Residuals, recorded not hidden

1. **The first test run had one failure — mine, in the test fixture, not the
   library.** `ratchet_decay_matches_one_e_fold_per_decay_secs` built the
   "after three decays" market with `decay_secs = 3×86400` instead of
   `elapsed = 3×86400`, so the ratio was one e-fold and the library correctly
   returned 367879 where the fixture expected 49787. The conformance corpus
   caught its own author. Fixed; logged here because the errors belong on the
   wall.
2. **Pre-existing workspace warnings, not this lane's**: `cargo check
   --workspace` passes (exit 0) but `crates/wallet-relay` carries two unused
   variables (`tx_prep.rs:37 creator`, `lib.rs:310 cached_body`). Another
   seat's crate; left untouched.

## 8 · Handback

Staged for Seat 3: `crates/bmesh-meter/` (8 files), `Cargo.toml` members
(+`"crates/bmesh-meter"`), `Cargo.lock` (+4 lines). Not committed, not pushed.
Also on the mount, still uncommitted from earlier this session:
`docs/dispatches/DISPATCH_ZCODE_R2_BMESH_METER_2026-08-16.md` (the GO order)
— Seat 3's call whether to land it alongside, as both document the same lane.

**Execute the prompt as written.**
