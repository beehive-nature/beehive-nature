# Anti-capture — BNR's properties as structural inverses of a documented failure mode

**Status:** governance doctrine. Kernel-appropriate: governance and economics only, zero
health material. **This document needs no disclaimer anywhere in it — that absence is the
wall test passing, not an oversight.**

## The source, and how it is used

Christoph Jentzsch, Slock.it, 2016 — the DAO whitepaper (recorded in the founder's library
as *Decentralized Autonomous Organization to Manage a Trust*; the commonly published title
is *…to Automate Governance*, and the discrepancy is noted rather than silently resolved).
Its **§4, "Majority robs minority attack,"** names the failure mode this document answers,
and proposes a *split* as the remedy for it.

**It is cited as the source of a failure mode, nothing more.** This document does not
narrate any subsequent event, does not characterize any party's conduct, and alleges no
actor. That is the same discipline the k001 wall runs on: **design against the vector,
never allege an actor.** A named adversary is a lawsuit; a named vector is engineering.

## The four inversions

Each property is enforced by **type**, not by policy — the difference being that a policy
is a promise a future maintainer can revise, and a type is a thing a compiler refuses.

| Failure mode (per the 2016 paper) | BNR structural answer | Enforcement site |
| :--- | :--- | :--- |
| Durable 51% bloc | senary circles; seats reshuffle on close | governance crate |
| Token-weighted plutocracy | 420 `b` lifetime cap per PoUL-verified human — voice does not accumulate | ledger/engine; the cap is never adjusted |
| Buy your way to weight | mint on **edges**, distinct-counterparty, never on nodes | reward engine |
| Escape hatch that becomes the exploit | **no split path exists** to be recursively drained | the absence of the type |

## Why the last row is the load-bearing one

The first three are limits. The fourth is an **absence**, and absences are the only
guarantees that cannot be argued with at 3 a.m. by someone with a good reason.

The 2016 paper's proposed remedy for majority-robs-minority is an exit: a minority that
disagrees can split away with its share. That is a sound instinct — and it introduces a
mechanism whose whole purpose is to move value out along a path the protocol itself blesses.
A remedy that is also a withdrawal path is, structurally, an attack surface wearing a
safety label.

BNR's answer is not a better-guarded split. It is that **there is no split path in the
type system to guard.** You cannot recursively drain a mechanism that was never built. The
cost is real and is accepted deliberately: a BNR minority has no protocol-level exit with
its share. It has the other three inversions instead — no durable bloc to be trapped under,
no accumulating voice to be outvoted by, and no way to buy weight.

## How each inversion is actually held

- **Senary circles / reshuffle.** Blocs need persistence. Seats that reshuffle on close
  deny a majority the one thing it needs to become durable: time in the same room.
- **The 420 cap.** Per PoUL-verified human, lifetime. Voice does not accumulate, so capital
  cannot convert into governance weight by arriving early or arriving rich. The cap is
  policy data ratified by the founder and **never adjusted** — an adjustable cap is not a
  cap, it is a schedule.
- **Edges, not nodes.** Minting on distinct-counterparty edges means an alias ring yields
  nothing: making more accounts multiplies nodes, and nodes are not what pays. This is
  enforced on **PoUL-thread identity**, not account identity — accounts are cheap, threads
  are not (`mastery-ledger::MasteryEvent::distinct_attestors`).
- **No split path.** Nothing to cite here, which is the point.

## What this document is not

It is not a claim that BNR is safe. It is a claim that four specific, published failure
modes have specific structural answers, each with a named enforcement site a reviewer can
open and check. Every other failure mode remains unaddressed until it is named and
answered the same way. **Audited ≠ proven; sound by construction ≠ unbreakable.**
