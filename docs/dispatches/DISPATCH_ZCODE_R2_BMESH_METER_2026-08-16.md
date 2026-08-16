# DISPATCH — LANE R-2 GO · bmesh-meter utilization-pricing engine (zCode)

**From:** Seat 3 (Claude Code) — drafted in the zCode seat (GLM 5.3) on the founder's
word · **2026-08-16**
**Status:** OPEN — **GO.** The lane was staged in
`DISPATCH_BMESHASI_SUPPLY_RESEARCH_2026-08-16.md` §5; this order starts it. The mailbox
check below found nothing that supersedes, amends, or fences it further.
**INDEX note:** indexing is Cowork's standing duty; this dispatch is not yet indexed.

---

## 0 · Mailbox check — cut clean, with receipts

Run 2026-08-16, after the 07:39 bMeshAsi landing (`34bb50c`) and before this order was cut.

| checked | receipt | finding |
|---|---|---|
| new commits | `git log --oneline -5` → HEAD still `34bb50c` | nothing landed since the staging dispatch |
| working tree | `git status --short` → empty | no untracked arrivals anywhere in the tree |
| the mount | `find /c/Users/travi -maxdepth 1 -type f -newermt "2026-08-16 07:39"` → `.claude.json` only | harness state, not a mailbox item; no seat dropped anything since this morning |
| `bigen-pickup/` | unchanged since 2026-08-15 23:11 | only `CORRECTIONS-01.md`, routed to the BIGEN seat — not zCode traffic. Observed residual: still tracked, though `ROUTING.md` routes it paste-then-delete; Cowork's/Code's call, recorded not actioned |
| lane already started? | `ls crates/ \| grep bmesh` → `bmesh-hwfit` only | `crates/bmesh-meter` **absent** — R-2 unstarted (orientation law 9: check whether it already landed) |

**Result: this order is cut against exactly the state the staging dispatch defined. No
status note supersedes the lane.**

---

## 1 · The order

**zCode takes LANE R-2 exactly as staged** —
`DISPATCH_BMESHASI_SUPPLY_RESEARCH_2026-08-16.md` §5 is the lane definition and is not
restated here (its live `powup.state` conformance numbers included — they are not
re-transcribed, so they cannot drift). One-line scope: **build `crates/bmesh-meter`, a
pure-library utilization-pricing engine** — the PowerUp-derived price/fee family
`p(u) = min + (max − min)·u^(e−1)` with the exact integral fee and ceil semantics, the
ratchet-and-decay hysteresis object with the flat-price-below-watermark rule,
conformance vectors verified against independently hand-derived arithmetic written into
the test comments, the four property tests, and the negative control. **Derive semantics
from the pinned source** (`reference-contracts @ c526479a…`, powerup.cpp:262-315), not
from any prose rendering — including the `e = 1` flat-`max_price` edge the source
actually produces.

**Fences carried forward from the staging (§5's NOT-in-scope, standing unchanged):**

- no voucher struct, and no primitive named voucher/bTiMe/workerbee — the §4 fence;
  the founder's word opens it, nothing else;
- no pricing constant values committed — curve parameters are a founder gate (§6.1);
  all parameters injected;
- no Verda/RunPod/provider API calls; no on-chain read or write;
- nothing denominated in b — the S-1 grep applies: a `b` amount in any identifier in
  this crate is a defect;
- stub law §0.7: no `#[allow(dead_code)]`, no underscore-silencing; unbuilt parts are
  absent, not silenced.

**House terms, unchanged:** build/test in WSL (`. ~/.cargo/env` first); acceptance is
the pasted, real, unedited `cargo test` output from WSL; hand back as a diff or a
dispatch — **one seat, one tree.** Seat 3 spot-verifies before landing, per the R-1
precedent.

---

## 2 · Why this lane, why this seat

R-2 was staged for zCode at 07:39 and nothing has moved since. The R-1 landing
(2026-08-16, spot-verified) exhibited the pattern this lane needs twice over: semantics
pinned to a source that was opened, not assumed (the NIP-42 → membership-mode
correction), and validation run where the artifact will live before it was believed
(the `depends_on` compose-merge catch). The meter engine is exactly that shape — a
small pure library whose every semantic claim must trace to `powerup.cpp` at the pinned
commit, with test vectors derived by hand rather than by the function under test.

---

## 3 · Standing rules

Orientation §1 laws and bullpen §5 apply unchanged — the receipt rule on everything, a
failed fetch is never a value, read the code before reasoning about it, quote whole
sentences, never `--no-verify`, corrections in place on the wall. **Execute the prompt
as written.**
