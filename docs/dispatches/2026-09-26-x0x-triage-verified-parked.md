# x0x triage: five fixes verified on the candidate branch; lane parked (2026-09-26)

**Status: PARKED.** No new worker. No repeat "unchanged" updates.

## Verified on the candidate branch, not deployed

A Cursor triage specced fork fixes for #877, #870, #836, #806 and #797. All five are already merged upstream on `codex/final-acceptance-candidate`. They are **not** on `main`, **not** in any release (v0.45.0 is still the latest), and **not** on our box.

| issue | fixed by | merge commit | regression tests |
|---|---|---|---|
| #877 | PR #879 | `d73915aa47` | 2 passed |
| #870 | PR #874 | `91203b5abf` | 3 passed |
| #836 | PR #847 | `a9265758ea` | 2 passed |
| #806 | PR #834 | `2633c38342` | 1 passed |
| #797 | PR #872 | `0e1053b4ab` | 3 passed |

**Tested tree:** `0bd10ee278aab900bbf4a41d28eb9fb8165c65f3` (candidate tip at test time), built in WSL with stable 1.98.1. All five merge commits are ancestors of this tree (`git merge-base --is-ancestor … ; echo $?` gave 0) and **not** of `main` at `a42b5d99c7` (gave 1). At the later tip `6779e11552`, none of the fix sites had changed.

**Receipt (11/11 passed), verbatim `test result` lines:**

```
=== $ cargo test --lib issue877_
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 3671 filtered out; finished in 3.05s
=== $ cargo test --lib issue870_
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 3670 filtered out; finished in 0.05s
=== $ cargo test --lib kv::sync::tests::encrypted_admin_withdrawn_during_store_lock_wait_cannot_merge
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3672 filtered out; finished in 0.01s
=== $ cargo test --lib kv::sync::tests::encrypted_retained_revocation_and_reauthorization_cycle_reject
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3672 filtered out; finished in 0.01s
=== $ cargo test --lib kv::sync::tests::group_signed_retained_revocation_while_waiting_for_store_write_rejects
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 3672 filtered out; finished in 0.01s
=== $ cargo test --lib own_agent_certificate_lookup_797
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 3670 filtered out; finished in 0.07s
```

These runs are pass-after only. Fail-before rests on the upstream PR bodies and was not re-run here.

**Still open under #797 (main ask fixed):** `GET /identity/revocations` still hides binding tombstones (`src/revocation.rs:619-625`), and `GET /agent` still has no `agent_public_key` field.

## Held privately

One candidate authorization-tier question came out of the adversarial review. It is held as a private draft outside every public repo, reproduced in an isolated local test only, and scoped node-local. It will not be filed without founder approval.

## Box traffic: fresh baseline (read-only, no change, no restart)

Taken on host `bnr` running x0xd 0.45.0 with systemd `IPAccounting` counters (unit up since 2026-09-26 08:17:04Z). Two samples: 20:21:48Z and 20:26:57Z (309 s apart).

| | 309 s window | average since start (12.1 h) |
|---|---|---|
| egress | 61.67 MB/min | 55.11 MB/min (~79 GB/day) |
| ingress | 177.66 MB/min | 154.12 MB/min |

These are whole-unit IP bytes. They are **not** the same measure as the 2026-09-15 figure of 86.33 MB/min, which was x0x's own `epidemic_forward` counter; that figure is historical. No tuning is proposed from this reading yet.

## Unassigned candidates (only non-duplicate fork work found)

The other 59 open issues were swept. These are the only narrow, unclaimed bugs:

- #976: KV put reports success when publish times out or is refused.
- #979: relay fan-out runs serially per obligation.
- #702: the nextest override attribution is unverified.

Each needs a maintainer's nod first.

## Setup corrections to the Cursor report

- Qwen does not travel over `x0x forward`; users reach it via HTTPS at `skaists.buzz/compute`.
- The laptop uses SSH tunnels and runs no x0x daemon.
- Buzz does not use x0x.
- No Hostinger host runs x0x. x0x and the model share the Oracle box.
- The report said "five issues" affect us but listed three.

## Open, founder-only

- Cancel Cursor's Monday 9:10 AM MT duplicate-fix launch. It is not a scheduled task on this machine, so the Cursor-side owner must cancel it and return a receipt.
- Approve or decline filing the private draft.

## Update 2026-09-28 (read 2026-09-29 01:17Z)

The sections above are the 2026-09-26 record and stay as written. Since then, upstream moved:

- **Closed upstream.** #877, #870, #836, #806 and #797 (plus #961) were closed COMPLETED on 2026-09-28 between 09:55:06Z and 09:55:16Z. #623 and #945 remain open.
- **On `main` now.** Upstream `main` is at `30c57d2439`. All five fix merge commits, and the tested tree `0bd10ee278`, are ancestors of it (`git merge-base --is-ancestor <sha> 30c57d2439; echo $?` gave 0 for all six). Upstream deleted `codex/final-acceptance-candidate`. So the line "not on main" above is superseded.
- **Still not released, still not on our box.** v0.45.0 remains the latest upstream release, and the box still runs x0xd 0.45.0.

**Monday launch, GitHub side (foreign oracle: the GitHub API).** Nothing shows that the duplicate-fix launch fired:
- The fork still has only its two old PRs (#1 and #2, both from September 15 or earlier).
- No fix branches exist on the fork.
- Our account opened no upstream PR. Its only upstream activity since 09-26 is a comment on #504.
- The fork's only `cursoragent@cursor.com` commits (`ad33b67192`, `12b65fbd2a`) are upstream history from 2026-09-06.
- The fork's 2026-09-28 activity is unrelated: a `main` sync to `30c57d2439`, a `vendor-deps-e803709` pre-release ("vendored crates, offline build"), and a `codex/final-acceptance-candidate` mirror at `e803709f23`.

**Monday launch, Cursor side: NOT RECONCILED.** The agent runs in the founder's Cursor cloud account, not on this machine; this machine has no scheduled tasks. The in-browser Cursor dashboard is not signed in, and this seat does not sign in. The premise of the launch is now void, because the issues are closed upstream. But only the Cursor owner can stop the schedule and return a cancellation receipt.
