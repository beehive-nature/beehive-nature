# bnrose-evolve: the bounded evolution controller

Serves **L2 (eternal runtime)** of SPEC-BNROSE-0 §0.1. Agents may repair the
estate's services without becoming their own authority:

```
observe → reproduce → propose → verify → canary → promote | roll back | hold
```

Rust only. Its storage is the embedded `adapter-store` seam (SQLite reference,
SurrealKV candidate; NO-SERVER-DB). Its signatures are bsigner
`bheart.signature/1` envelopes (ML-DSA-65), verified here and never made here.

## Where the ideas come from, and what was refused

Four mechanisms were studied as design input in an external self-modifying
agent runtime (Ouroboros v7.6.0) and reimplemented here in Rust. Nothing of
that runtime is imported: no code, no process, no dependency. Its mode that
lets an agent make its own permissions and review rules advisory is
**deliberately not reproduced**. An agent here can improve an
implementation. It cannot widen its own permissions, raise its ceiling, or
redefine what passing means. The enforcement sits in code outside the
candidate's writable tree. It is not recurring founder approval.

| mechanism | here |
|---|---|
| evidence apart from conclusions | claims, execution records, verdicts and decisions are separate types with crate-private constructors; missing or partial evidence stays NOT_RUN / DEGRADED; raw stdout/stderr kept as digest-bound blobs |
| attempts accounted, not successes | every physical attempt is reserved before it runs (the reservation is also its wall-time bound), settled after with measured usage, and an unknown cost is charged at the full reservation, never zero; spending reads the journal, never a snapshot |
| recovery that keeps responsibility | an exclusive claim on the state dir; Dispatched and CancelIntent are durable before the act; no result before the worker is observed dead; at open, unresolved attempts go into a rescue record **before** anything new, settled UNKNOWN, never re-run, orphaned pids named as owed cleanup |
| failure classes closed by evidence | a class closes only when a policy-required check reproduced it on the implementation in force and the same check passes in a PROMOTE verdict under the policy in force; a stronger verifier that fails it later reopens it; a reflection can never close it |

## The four authorities

- **Proposal** (agent key): a signed proposal names the base and candidate
  by digest and declares its change set. The controller **computes** the
  change set. Any path under a protected prefix is refused, and protected
  beats writable: the verifier, required tests, the policy and CI. A
  declaration that differs from the computed set is refused too.
- **Execution** (this process): only commands whose digest equals the one the
  policy pins run. The digest covers the verifier revision, the program
  bytes and the arguments. They run against the exact admitted bytes,
  re-hashed before every run.
- **Verification**: a record counts only if bound to the subject, the check,
  the pinned command, the verifier revision, the policy and the artifact.
  Any FAIL wins over a later passing retry.
- **Promotion**: promote only on every required check PASS and a bound canary
  PASS. The candidate must have been admitted under the policy in force,
  against the implementation still in force, with no unresolved attempt. A
  failed canary rolls back and the current implementation stays. Anything
  else holds. The decision binds policy, source revision, verifier revision,
  artifact, verdict, canary, usage and scope (`Decision::statement`).

The **sovereign** key alone writes policy. Ceilings carry no defaults:
choosing them is the sovereign's act (ORDERS-1:61).

## Receipts (this beat)

`cargo test -p bnrose-evolve`: 8 unit + 23 battery rows, both engines,
real processes. `scripts/bnrose-evolve/bsigner-xcheck.sh`: envelopes from
the real `bsigner` binary verify by role and fail closed.
`scripts/bnrose-evolve/teeth.sh`: 12 planted faults, each convicted by its
row. CI: `.github/workflows/bnrose-evolve.yml`. Local receipts are in
`docs/receipts/bnrose-evolve/`.

## Boundaries, named

- **Journal tamper-evidence is an unkeyed SHA3 chain.** It convicts
  unchained edits, reordering and truncation. A writer with store access can
  rewrite it consistently. Catching that needs `Journal::head()` anchored
  where that writer cannot reach (Vaulta, Autonomi, a peer over x0x): the
  next beat, not built.
- **Workers are bounded by wall time and reaped, not sandboxed.** There is no
  namespace and no syscall filter, and a worker's own children are not
  tracked. After a controller crash, an orphaned worker is named and never
  signalled (pid reuse makes a stale pid unsafe to kill).
- **Units are measured wall-time milliseconds** for local checks. Model-call
  or network cost metering is a later adapter. The meter semantics already
  carry `Unknown`.
- The fixture service's durability defect is a **process-crash** model.
  Power-loss durability is not exercised (the same TAM boundary as
  adapter-store's SKV-1).
- Single controller per state directory. Multi-controller agreement on a
  promotion (consensus, ZK-validated verdicts) is not claimed.
- Nothing here signs, holds a key, opens a socket, or spends. The authority
  test enforces this from the manifest and the source.
