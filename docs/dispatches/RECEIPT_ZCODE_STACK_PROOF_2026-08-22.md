# RECEIPT — STACK PROOF · bmesh-serve: htmx + AlpineJS + sqlite/postgres, each at its polar strength (zCode)

**Founder order, verbatim (2026-08-22):** *"try to use htmx/AlpineJS and sqlite/postgress ?
each to their polar strengths"* · **Seat:** zCode (GLM 5.3)
**Status:** BUILT, TESTED, RUN LIVE — `crates/bmesh-serve/` (axum, the estate's server
pattern per wallet-relay), workspace member wired, runtime artifacts cleaned.

---

## 1 · The design — four technologies, four polar strengths, one loop

The loop is the estate's architecture in miniature:

1. **The visitor's browser** reads the live Vaulta rammarket keylessly (failover trio
   eosn → eosnation → greymass; the same reader as the bANTfarm dial) — free
   distribution, zero server egress (dangling-art lane).
2. **htmx** POSTs the reading (`hx-post` with `hx-vals` pulled from Alpine's state) and
   polls server-rendered fragments back (`hx-get /api/ticks` every 5s) — polar strength:
   **the server owns the HTML; the client only swaps it.** No client render layer, no
   JSON→DOM glue, no framework state to keep in sync.
3. **AlpineJS** owns the register toggle (🐝 bee / 🎛 raver / ⚗ cypherpunk — the estate's
   register law carried verbatim: *a register changes prose and density, never a number*)
   and the live formatting of the reading — polar strength: **small declarative state,
   living in the markup.**
4. **sqlite** (default): the journal — embedded, one file, zero administration —
   polar strength: **per-lane state without a DBA.**
5. **postgres** (`--features postgres`): same `Journal` contract, compiled ONLY on
   demand — polar strength: **many concurrent writers / rich queries**, armed
   deliberately when a lane's function demands it. The page carries the **honest
   absence** when not compiled: that absence is the design, not an omission.

Vendored and SHA-pinned (offline-capable, no CDN at runtime):
`htmx.org@2.0.4` — `e209dda5c8235479f3166defc7750e1dbcd5a5c1808b7792fc2e6733768fb447` PUBLIC-CONSTANT
`alpinejs@3.14.9` — `3ed1eed252488921df65e363d6715deb04d7f92aaedb9e52199fdf73cb1e0ad3` PUBLIC-CONSTANT

## 2 · Acceptance

**`cargo test -p bmesh-serve` (WSL, real, unedited):**

```
running 2 tests
test tests::fragment_renders_rows_server_side ... ok
test tests::sqlite_journal_roundtrip ... ok
test result: ok. 2 passed; 0 failed; 0 ignored
```

**Postgres lane compile proof:** `cargo check -p bmesh-serve --features postgres` →
`Finished dev profile in 12.73s` (compiles; not run — no postgres server on this box,
and running it would be theater without one).

**Live run (WSL, `./target/debug/bmesh-serve`, then curl):**

```
POST /api/tick {"core_units_per_name":0.8421,…,"source_host":"api.eosn.io"}
→ <tr><td>1</td><td>0.8421</td><td>75,800,886,740</td><td>251,602,894,241</td><td>api.eosn.io</td></tr>
GET /api/ticks  → same row, persisted in sqlite
GET /api/status → <b>sqlite</b> journal · 1 ticks · up 0m 2s · postgres lane: honest
                  absence — armed by --features postgres; its polar strength (many
                  concurrent writers) is not this lane's demand
```

Runtime `bmesh-serve.db` created during the run was **deleted after receipting** —
runtime state never enters the tree.

## 3 · Residuals, recorded not hidden

1. The postgres `Journal` impl bridges async→sync via `block_in_place`; correct under
   the multi-thread runtime, documented in-code. It has **no live-server test** — an
   honest gate: first real postgres lane runs its own conformance receipt.
2. `group()` helper exists because rust format strings carry no thousands grouping;
   tested via the fragment assertion (`75,800,886,740`).
3. The page hard-codes the register trio's law in prose; if the estate's register.js
   ever lands server-side, unify (follow-up, not a defect).

## 4 · Fences

No keys, no secrets, no chain writes — the server never reads the chain at all (the
browser does). No priced constants (the reading is computed from live state in the
visitor's browser). axum/tokio versions mirror wallet-relay. Stub law: nothing silenced.

**Execute the prompt as written.**
