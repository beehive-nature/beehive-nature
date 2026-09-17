# ORDER — X402-DOOR BOOT DEADLOCK: RED-FIRST BUILDER MISSION (2026-09-17)

**From the founder (verbatim, 2026-09-17), routed to a FRESH builder seat.**
Context: Gesture D is frozen at the stop receipt
([2026-09-17-gesture-d-stop-at-boot-receipt.md](2026-09-17-gesture-d-stop-at-boot-receipt.md),
PR #91, merged). This seat does not continue Gesture D and does not
"fix forward" a ceremony.

---

> **X402-DOOR BOOT DEADLOCK — RED-FIRST BUILDER MISSION**
>
> Gesture D is frozen at PR #91's stop receipt.
>
> Reproduce the startup deadlock from a fresh journal using the real
> exclusive-open startup path:
> `open_exclusive → recover_stranded_settling`
>
> Required RED: startup hangs because the process already owns the lifetime
> flock and recovery performs a second blocking acquisition.
>
> Repair the locking architecture with the smallest coherent change. Do not
> weaken single-process exclusivity. Recovery under an already-exclusive
> journal must use the lock already held, rather than silently opening an
> unlocked path or dropping the process-lifetime ownership guarantee.
>
> Acceptance:
> - fresh-journal binary reaches listening state;
> - restart with existing journal reaches listening state;
> - actual stranded-Settling recovery executes under the exclusive ownership;
> - second process is still refused while first owns journal;
> - crash/restart laws remain green;
> - existing door suites green;
> - no Base Sepolia transaction;
> - no Gesture-D promotion.
>
> Return GREEN to the Gesture-D seat; it reuses the already-staged kit and
> ceremony order unchanged.

---

**The binding sentence:** *"Do not weaken single-process exclusivity."* A
tempting fix — making the second lock non-blocking, bypassing it, or loosening
`open_exclusive` — could make the binary boot while destroying the very
journal-ownership invariant the lock exists to enforce (D-5). The repair must
keep one live opener per root, kernel-released on death, and let recovery run
UNDER the already-held ownership.

**Evidence already banked for the RED** (receipt §3, first-hand): kernel stack
`locks_lock_inode_wait` ← `__do_sys_flock` on `/var/lib/x402-door/.lock` with
the flock held by the same process; the RPC/facilitator build had already
succeeded (socket established — not an RPC hang); library-level reproduction
via the ceremony driver (`open_exclusive` → `recover_stranded_settling`,
scratch root, killed by a 10s timeout, exit 124). The builder must land the
RED as a test in the door's suite (crash/restart laws stay green), not just
cite the box transcript.

**Scope fence:** the four additional findings from the same receipt (upto
live-wire incompatibility; actual-amount discarded; gas accounting at
reserve-rate; AV-6a unreachable at the real seam) are NOT part of this
mission — they are separately queued for architecture reconciliation before
any implementation: see
[docs/agents/INTEGRATION-FINDINGS-QUEUE.md](../agents/INTEGRATION-FINDINGS-QUEUE.md).
Do not bundle them into the deadlock repair.

**Hand-back:** GREEN returns to the Gesture-D seat, which re-runs the staged
ceremony order unchanged (multi-leg → AV-6a → AV-5 → AV-8 → AV-4 →
reconciliation) using the kit/driver already on the box — grading F2/F3/F5
bars honestly as structurally unmet on the current build unless the
architecture seat has re-ruled them first.
