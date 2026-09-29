# zCode — dead-host call-site inventory + bounded sweep proposal — 2026-09-13

Assignment: #10 c5649682632 — read-only inventory of the six remaining
`api.eosn.io` call sites BEFORE proposing replacements; no blind changes
because wallet/adapter behavior may differ; no production node changes.
Tree examined: `3d76632e`. Method: full-tree `git grep`, code reading of
every site, and a runtime emission check (localhost build of the tree,
Chromium, 10s dwell per page, every request watched).

## Headline: it is seven browser-side sites, not six

The full-tree sweep found one call site beyond the assignment's list:
`crates/bmesh-serve/assets/page.html` — the box crate's embedded page
asset (a diverged copy of bmeshasi, 331/198-line diff) carrying the same
dead-first VH list. The Rust side's two mentions
(`crates/bmesh-serve/src/main.rs:182,208`) are **`#[cfg(test)]` fixtures
only** — a label in test data, no fetch; the crate's non-test code makes
no outbound HTTPS call at all.

## The inventory

| # | Site | Var | dead position | selection semantics | feeds | emits on bare load (10s) | estate | tests today |
|---|------|-----|--------------|--------------------|-------|------------------------|--------|-------------|
| 1 | `surfaces/bmeshasi.html:332` | VH | **FIRST** | fixed-order failover | live dials poll (`get_info`, amber degrade, visibility-gated) | **YES** — 1× get_info, then eosnation answers | roadmap | none |
| 2 | `surfaces/wallet.html:1522` | VH | tail | probe-once-cache (`get_info`, 6s timeout, first OK wins → LIVE_HOST) | wallet chain reads | no — eosnation answers first; dead tail only reachable if both live hosts fail | working | wallet-* suite |
| 3 | `surfaces/wallet-adapter-vaulta.js:27` | MAIN_HOSTS | tail | **Fisher-Yates shuffle per `railPost`** — the "tail" leads **1-in-3 calls** | ALL vaulta rail traffic incl. `send_transaction` (worker) | no on bare load — worker spawns at load but idles until a rail action | worker of wallet.html | e2e/wallet-adapter.mjs, wallet-vault/matrix/fund |
| 4 | `surfaces/bantfarm.html:462` | VAPI | middle | fixed-order failover (its comment "the estate's proven three-host failover" is now stale) | cockpit reads (`get_table_rows`, `get_account`) | **YES** — 3× in 10s | working | none |
| 5 | `surfaces/blight/workbench.html:302` | VAPI | middle | fixed-order failover inside `resolveDotB` | .b domain resolution reads | no — **on-demand** (user action) | working | none |
| 6 | `surfaces/blight/vaulta-reader.html:106` | VAPI | middle | **round-robin (`vidx`)** — dead leads every 3rd call start | table reader auto-load | **YES** — 2× get_table_rows in 10s | working | none |
| 7 | `crates/bmesh-serve/assets/page.html:181` | VH | **FIRST** | fixed-order failover (diverged bmeshasi copy) | the crate-served page's dials | **YES** — 2× (get_info, get_table_rows) | box asset, not in estate.json | cargo tests don't cover the asset |

Zero page errors anywhere except the crate page under static serving
(`Cannot read properties of undefined` — its `/api/tick` is crate-served
and absent in the static context; likely an artifact of the test rig,
flagged not diagnosed). Every list **already contains both live hosts**;
no site needs a replacement endpoint — the dead literal is pure
subtraction. NXDOMAIN fails fast, so today's cost is wasted attempts and
stale comments, not hangs; sites 1/4/6/7 burn those attempts on real
visitors.

**Behavioral map (the "may differ" warning, made concrete):** four
distinct selection semantics share the dead literal — fixed-order
failover (1,4,5,7), probe-once-cache (2), random shuffle (3),
round-robin (6). All four self-adjust to a shorter array; the sweep must
REMOVE only, never reorder, and must re-prove each semantics after.

**Non-call-site mentions, to leave alone:** the two regression files
`e2e/bnames-rpc.test.mjs` + `e2e/bnames-gate.mjs` (they detect the
literal — they need it), `scripts/buzz-meter/meter.py:290` (the comment
that documents the death), `surfaces/onboarding/vendor/BUILD-NOTES.md`
(historical vendor note), two historical dispatches (records). One
judgment call surfaced: `surfaces/workbench.tmp` is a **tracked** temp
file carrying the same dead VAPI — deletion candidate, Astra's call, not
silently done.

## The bounded sweep proposal (one PR, not yet executed)

1. **Subtract the literal from all seven browser-side sites.** Each array
   keeps exactly its two confirmed hosts **in the file's existing order**
   (eosnation-first stays eosnation-first, greymass-first stays
   greymass-first). No reordering, no additions, no UI copy changes.
   Fix the now-stale "proven three-host failover" comment on bantfarm.
2. **The crate lands in-tree only.** `crates/bmesh-serve/assets/page.html`
   gets the same subtraction; the two `#[cfg(test)]` fixture labels change
   to a live host string. **No rebuild, no redeploy of the running box
   service** — the crate change rides the next natural deploy, per the
   no-production-node-changes order.
3. **One fleet regression, deterministic and offline:** extend the
   `bnames-rpc` pattern — scan `surfaces/**` + `crates/*/assets/**` for
   `api.eosn.io`; zero hits allowed outside an explicit ALLOWLIST (the two
   regression files themselves). CI-wired into the existing front-door
   line.
4. **Per-site re-proof, seat-side:** the wallet adapter battery
   (`wallet-adapter.mjs`, `wallet-vault/matrix/fund`) re-run to prove the
   shuffle-over-two and send path intact; the localhost emission rig
   (this inventory's method, script preserved in the worktree) re-run to
   show zero dead-host requests across all seven pages.
5. **Out of scope:** workbench.tmp deletion (flagged, ruled separately),
   any third host (a new host joins only with a live probe receipt, the
   #67 law), any box redeploy.

Estimated shape: ~9 files (7 sites + gate + dispatch), zero doc changes
beyond the dispatch, CI 8/8 expected unchanged.
