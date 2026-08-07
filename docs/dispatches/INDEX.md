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
| 1 | Cadence rule (docs-only push when scan clean) | founder word — **GIVEN** | **ACTIVE — first run HELD, see below** |
| 2 | A1 Layer-1 rewording | founder word — GIVEN | Executed (Fable courier) |
| 3 | INDEX manifest | founder word — GIVEN | **This file** |
| 4 | ORDERS-1 v0.8 re-commit | founder keyboard (self-bootstrapping clause) | Parked |
| 5 | BIO-1 v0.2 read + ratify | Code prints path/text | Parked on Code |
| 6 | w / T0 + Design D picks | Code presents plain-language options | Parked on Code |
| 7 | (row-7 gate, goose/Code) | founder word | Parked |

## Push state — HELD, and why (cadence rule working as designed)

`main` is ahead of `origin/main` by 7 (incl. this INDEX). **The push is HELD, not clean.**

Commits `77bb420`, `4c6eabc`, `df197de` contain full descriptions of the three
genesis-integrity bugs — including exploit magnitudes (backdated `first_minted_at`
→ 374 b; `AcceptNonEmptyProof` → mint 420e18 in one call). The go-order's fixes have
**not** landed. Repo is PUBLIC (A52). Go-order condition #3 forbids bug-docs reaching
the public remote before their fixes.

**The cadence rule's precondition ("scan is clean") is therefore not met.** Holding IS
the rule executing — the bug-doc carve-out riding along exactly as ruled. No history
surgery to selectively hide commits (the bug-doc commits are mid-range; and concealing
vulns is not a hands-seat move).

**Release condition:** the go-order's three fixes land in the same tree, tests green
under their own names. Then docs and fixes push together in one clean range, and the
cadence rule self-executes from that point on.
