<!--
STATUS: ADOPTED 2026-07-04 (one-door review); relocated to docs/ root per
this header's own request. Living artifact: one line per risk; each names
the finding that raised it and the current control.
-->

# Risk Register (seed)

| ID | Risk | Severity | Raised by | Status / control |
|---|---|---|---|---|
| **R-001** | **DRO liveness is the refund guarantee.** With no chain-level timeout (see §1.8), a buyer's timeout refund needs 2-of-3 sigs and the vanished seller won't sign — so the refund path is **buyer + DRO**. If the DRO is down, unreachable, or its key is mismanaged during a timeout window, buyer funds are stuck with no on-chain escape hatch. | **High** | §1.8 finding (`zano-timelock-findings.md`) promoting off-chain enforcement to permanent | **Named requirement; mitigation shape (build into `bnature.dro`):** (a) **key redundancy** — the DRO's co-signing key is itself **threshold-held** (e.g. multi-party / MPC), never a single secret on a single box, so one compromised or offline node doesn't sink the refund path; (b) **monitored uptime with alerting** on the signer's reachability during any open timeout window; (c) a **published liveness objective (SLO)** — when the venue is real, the refund guarantee's availability story is something users deserve to see stated, not infer. Track as a first-class design input when the DRO contract is built. |
| **R-002** | **fUSD peg / collateral risk.** Escrows hold fUSD for their full duration; a de-peg or unverifiable backing erodes escrow value mid-flight. Collateral ratio currently unresolved across sources (1.18×–10×). | **Medium–High** | fUSD baseline (`fusd-peg-monitor.md`) | **Mechanism in place:** weekly monitor + thresholds; on Red/double-Amber, gate new fUSD escrows **and** pause DRO auto-enforce (human Tier-2 review). Canonical ratio to be pinned on first Monday run. |
| **R-003** | **Off-chain timeout is the only timeout.** Escrow expiry/refund timing lives entirely in `escrow-core`'s timer; the chain will never enforce it. A bug or clock/liveness failure in the timeout path has no on-chain backstop. | **Medium** | §1.8 finding | Confirmed-permanent design (not a stopgap). Control: `escrow-core` timeout logic is unit-tested and time-only-via-events (hermetic); keep it that way and treat the timer path as safety-critical. |

_Not legal or security advice; an internal tracking artifact for design review._
