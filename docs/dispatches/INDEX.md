# DISPATCH MAILBOX — INDEX
**Maintained by:** Cowork (document seat), on every mailbox change.
**Authorization:** founder word "index and whatever" (2026-08-07). Endorsed Seat 1.
**Rule:** the bus carries its own state. A seat opening this directory reads status here
before acting, killing the stale-board error class at the root.

Last updated: 2026-08-07, at commit of this file.

## Live dispatches

| File | To | Kind | Gating word | Status | Receipt |
|---|---|---|---|---|---|
| `GO_ORDER_THREE_BUGS_2026-08-07.md` | Code | Go-order (3 fixes) | founder "go" — **GIVEN** | **OPEN — awaiting Code execution.** Each fix needs its named test (fail→pass), receipts pasted, all three land before any tokenomics constant. **Bug #2 now has constitutional backing — `RULING_REPLAY_WORLD_A`: fail-closed refusal is canon, no replay lane.** These fixes lift the push hold (below) | — |
| `A1_LAYER1_AMENDMENT_2026-08-07.md` | Code | Spec amendment | founder "A1 go" — **GIVEN** | **LIFTED.** R8 Layer-1 rewritten to frozen-selection wording; collision closed on paper, register closes on Code's COURSE_SYNC | — |
| `RULING_REPLAY_WORLD_A_2026-08-07.md` | Code | **Constitutional ruling** | founder "World A" — **GIVEN** | **CANON.** Forward-only time; backdated/out-of-order `EmissionMinted` refused always; no replay lane. Backs go-order bug #2 (`first_minted_at`) — Code's fail-closed refusal is now constitutional, not just a bug fix. **Closes the last open escalation (bug 2, 70f812b)** | committed here |
| `DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8.md` | Code | Addendum | — | RAM receipt **COMPLETE** (commit 8840740); Layer-1 hold **LIFTED** by A1 | 8840740 |
| `DISPATCH_CLAUDECODE_BNROSE_ADDENDUM_R7.md` | **Cowork** (reassigned from Code, founder word "INDEX row 4 → Cowork" 2026-08-07) | Addendum (spec skeletons) | — | **DRAFTED** — `SPEC-BNROSE-0-CHARTER.md` (Item A) + `SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md` (Items B, C). Acceptance met for A/B/C draftable parts; cold-start-verifier + COURSE_SYNC owed to committing/Code seat | pending commit |
| `FABLE_STANDING_LAWS_S2.md` | Fable/all | Standing laws | — | ADOPTED — CLAUDE.md §2 slot; ledger authoritative on conflict | — |
| `ACK_COWORK_SEAT_2026-08-07.md` | Seat 0 | Seat ACK | — | FILED — Cowork seat wired, fences on record | 3f12c7d |

## Founder word-stack (open gates)

| # | Item | Needs | State |
|---|---|---|---|
| 1 | Cadence rule (docs-only push when scan clean) | founder word — GIVEN | **ACTIVE — held on bug 1 only, see below** |
| 2 | A1 Layer-1 rewording | founder word — GIVEN | CLOSED — executed |
| 3 | INDEX manifest | founder word — GIVEN | CLOSED — this file, self-maintaining |
| 4 | ORDERS-1 v0.8 re-commit | founder keyboard | **CLOSED — ratified `49803b9`, founder's hand** |
| 5 | BIO-1 v0.2 read + ratify | Code | **RATIFIED (founder board 2026-08-07).** Executing commit reported as `23f03ff` — **NOT present in this tree** (`cat-file`: malformed object name; BIO-1 spec here still reads "proposed", `7b53796`). Ruling made ≠ verified-executed from this seat. Reconciliation owed by Code/Fable — see push-state note |
| 6 | w / T0 + Design D picks | Code presents | **CLOSED — w = attested-capture full weight; T0 = 45-min interim; Design D = 0%/defer canon (founder board 2026-08-07)** |
| 7 | (row-7 gate) | founder word | **CLOSED — dual-currency: b for compute, stablecoin for service; commit-format kept as-is (founder board 2026-08-07)** |

*Word-stack closures above are recorded from Seat 0's board of 2026-08-07; canonical text lives in the Fable ledger / Code filings. This table is the pointer, not the canon.*

## Push state — HELD, and why (cadence rule working as designed)

`main` is ahead of `origin/main` by **13** (verified `git rev-list --count`, 2026-08-07). **The push is HELD, and the hold has narrowed to bug 1 only.**

**Open reconciliation (flagged by Cowork, owned by Code/Fable):** the BIO-1 executing
commit `23f03ff` reported on the board is **absent from this working tree** — `cat-file`
returns *malformed object name*, and it is not in the ahead-13 log, though other Code
commits (`efad970`, `70f812b`, `49803b9`) are present. Either the hash was mis-transcribed
in relay, or the commit lives in a copy that hasn't reached this mount. Until it resolves,
BIO-1 is ratified-but-execution-unverified here. Not Cowork's to fix — recorded so no seat
reads it as landed.

Update 2026-08-07: `70f812b` fixed **bug 2** (`first_minted_at` not backdatable —
now constitutional under `RULING_REPLAY_WORLD_A`) **and bug 3** (mint gate no longer
caller-supplied). Their doc descriptions are therefore publishable — fix has landed.
**Bug 1** (`registration_fee` never read → unbounded RAM vector) is **not yet fixed** —
it opens on Code's next fresh sitting against the Antelope contract. The docs describing
bug 1's vector must not reach the PUBLIC remote (A52) ahead of its fix.

**Release condition (single pin):** bug 1 lands tests-green in the same tree. Then the
whole ~12-ahead range pushes in one clean flip and the cadence rule self-executes from
that point on. No history surgery; concealing an open vuln is not a hands-seat move.
