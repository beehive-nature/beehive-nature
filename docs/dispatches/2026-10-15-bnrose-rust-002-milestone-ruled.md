# 2026-10-15 · BNROSE-RUST-002 — the qualification milestone RULED (historical; the law preserved; the next qualification named)

**Ruling received** (founder, 2026-10-15): the contention/recovery/
replacement work is a **historical qualification milestone, not a current
merge blocker**. The achievement it certifies: **enforcing authority
BEFORE signing or executing**, rather than relying exclusively on
duplicate-effect detection afterward — three safeguards at that stage:

1. **Exclusive local claim** — competing OS processes cannot both acquire
   authority over the same state directory.
2. **Durable recovery and replacement** — a failed step may be replaced
   only under an explicit policy AND when the required evidence
   establishes the earlier attempt did not execute.
3. **Evidence classification** — local submission and recovery
   observations are never misrepresented as blockchain execution or
   finality.

The landed progression (verified on main this day, in order):

| PR | Merge SHA |
|---|---|
| #411 — Rust execution core | `f731b174f` |
| #421 — contention, recovery, replacement | `1692c2629` |
| #425 — cross-node reconciliation | `5c24bb044` |
| #427 — independent-process enforcement | `1f163522a` |

The old branch tip `e3a676a62` is milestone history — it is NOT to be
rebased or reopened as though #411 were pending; the progression landed
through the later work above.

## THE LAW preserved (ruling, verbatim in force)

> One technical distinction deserves preservation: worker death alone
> does not universally prove that an external effect never happened. That
> conclusion is valid only when the execution boundary and durable
> evidence establish that the worker could not have crossed the effect
> boundary. Otherwise, the outcome must remain `UNKNOWN`.

Where the merged core stands under this law: its never-executed
classification is keyed to the execution BOUNDARY, not to death as a
category — the bounded-failure record is written when the worker dies
*before its dispatch verdict*, the effect door opens only after the
durably-acknowledged Dispatched record, and a worker that never returned
a dispatch verdict cannot have crossed that door. The law binds hardest
on what comes NEXT: with real settlement adapters, a worker that dies
after a request left the process but before any durable record is
`UNKNOWN` — never never-executed — no matter how it died.

## The next qualification (named, outside all current receipts)

**Real network partitions between sovereign hosts, followed by
independently verified destination-side execution and finality on each
supported settlement adapter.**

The governing rule, verbatim:

> Local exclusion protects a process. Destination idempotency protects
> an effect. Consensus and finality must be established independently.
