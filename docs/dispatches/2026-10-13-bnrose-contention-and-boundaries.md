# 2026-10-13 · BNROSE-RUST-002 — contention, the durable-ack boundary matrix, and the exact replacement law

Founder order of 2026-10-13 (CONTINUE, same lane; no -002 PR until #411
lands — held). Sequencing note honored: `zcode/bnrose-rust-002` stays
un-PR'd; when #411 merges, this branch rebases onto the exact merge SHA
and the full battery reruns there before any PR.

## The claim (the concurrency proof the order demanded)

Authority over a state directory is an OS-atomic exclusive create
(`supervisor.claim`), acquired BEFORE any journal, admission, signature,
or effect. The DECISIVE row runs two OS PROCESSES spawned concurrently
against the same pre-dispatch durable state: exactly one exits 0 with a
completed receipt; the other is refused `state:already-claimed` BEFORE it
can produce any signed attempt — the enforcement is the claim, not
ledger idempotency absorbing a second effect after both acted. In-process
second opens refuse identically; clean drop releases; a crashed holder's
stale claim adopts only through the EXPLICIT gesture (never automatic,
never a retry loop).

## The durable-ack boundary matrix (all four, asserted per boundary)

| boundary | reconstructed | dispatch permitted | new signature/effect |
|---|---|---|---|
| 1 · before durable admission | nothing | yes — the first attempt | the first signature would be the first |
| 2 · admission durable, before dispatch | FAILED (conclusively never executed) | no | none: the authorization's one admission is spent; zero rows |
| 3 · after effect, before completion record | DISPATCHED → recovered COMPLETED by evidence | no (re-run refused; record count frozen) | no new effect — one row throughout |
| 4 · after completion record | COMPLETED | no (recovery idempotent, invents nothing) | none; one row |

Boundary 2 exposed and closed a real hole while writing it: a worker
DYING mid-step journaled nothing, replaying as unresolved; worker death
is now journaled as a bounded failure (host fail-codes ≥1000; the core's
refusal space stays 0..=22), so replay reconstructs conclusively FAILED,
which is exactly the state the replacement law keys on.

## The replacement law, exactly as ordered

One admitted attempt per step. A FAILED step may be replaced ONLY when
(a) no ledger row exists for ANY attempt of that step (conclusively
never executed) AND (b) the caller explicitly set
`replace_never_executed_failed_steps` (default FALSE — the conservative
default refuses even a never-executed replacement). A replacement is a
NEW ATTEMPT entity (attempt index in the step byte's high nibble; both
attempts remain journaled — reconstructions are never erased); only the
executed attempt produces an effect. A failed step WITH a recorded
effect, and any unresolved step, are never replaceable at any setting.
Convicted: default-refuses; opt-in replaces attempt 0 with attempt 1,
one effect, two journaled attempts.

## Evidence classes, separated (and the wording caution adopted)

The recovery report now carries per-operation evidence:
`submitted`/`observedLocal`/`recovered` as LOCAL facts;
`included`/`executed`/`final` as explicit nulls marked
"not claimable from a local ledger row." The earlier "absorbed by ledger
idempotency" phrasing is hereby scoped as a LOCAL ledger property — a
local ledger can suppress duplicate local application; it cannot prove
an external chain did not accept another independently signed
transaction. Destination-side enforcement is the adapters' order, not
claimed here.

## Standing constraints honored

#413 stays with Agent 30; no timeout widening entered this lane. #378,
aggregation cryptography, and signer work stay outside. Non-spending
fixtures only. Battery: 16 suites green locally (44 tests, 0 failures);
teeth re-convicted 5/5. CI record kept mixed where mixed: local green is
this box; #411's checks were still settling when this was written.
