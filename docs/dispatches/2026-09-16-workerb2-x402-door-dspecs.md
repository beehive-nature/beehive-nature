# WORKERB2 — x402-door: D-3/D-4/D-5 + crash-Settling + D-6/D-7/D-2 consumed · 2026-09-16

**Seat:** Workerb 2. **Mission (founder, verbatim):** *"Consume D-3, D-4,
and D-5 RED-first now: settle-time float drain, contradictory/lying RPC
release evidence, and concurrent journal open/start. Preserve the new
`Settling` invariant and specifically attack crash while Settling →
restart → UNKNOWN/reconciliation so the race fix cannot create permanently
stranded authority. Then consume D-6/D-7/D-2 automatically. Do not run
Sepolia yet. No production deployment."*

**LANDED:** main @ `4708f8af` (CI all-green incl. the door step).
**Door now 30/30: 11 acceptance + 9 adversarial + 10 d_specs.**

## The laws added (each test-pinned; RED → GREEN same lane)

- **D-3 settle-time float drain.** The float is now a DYNAMIC injectable
  `FloatSource` (tests inject a live atomic; the binary wires the
  configured figure until the testnet slice reads the wallet), checked
  BEFORE the `Settling` transition: a drained wallet refuses LOUD naming
  both numbers, the record stays **byte-identical** (asserted by file
  bytes), and float recovery settles the SAME nonce — nothing transitioned,
  nothing consumed.
- **D-4 lying-RPC release evidence.** The bare `bool` is now a typed
  `ReleaseVerdict { UnspentOnChain, SpentOnChain, RpcUnavailable }`:
  `RpcUnavailable` is a **typed HOLD** (loud refusal naming the class,
  byte-identical, retryable — then the genuine verdict releases exactly
  once, second release refused terminal); `SpentOnChain` **parks to
  Unknown** for the human gate (never releases); and the CONTRADICTION LAW
  runs FIRST — a leg the journal knows is settled refuses every verdict.
  **The suite caught my own first implementation running the park before
  the terminal check — exactly the spec's named attack — and the fix
  orders state-check-first.**
- **D-5 concurrent journal open/start.** `Journal::open_exclusive`
  try-locks the OS lock for the instance lifetime (std `try_lock`, no new
  deps): a second live opener **refuses by name** (D-5 cited), the hold
  dies with the instance (drop → reopen green; kernel-released on process
  death), per-op multi-handle journals still compose (the AV-7 contract),
  and an unlockable root refuses to open at all — an unlocked journal is
  not a journal. The BINARY now opens exclusively.
- **Crash while Settling → restart → UNKNOWN (founder order).**
  `recover_stranded_settling()` runs at binary startup BEFORE serving:
  stranded `Settling` records park to `Unknown` with a named note, are
  NEVER auto-retried (`begin_settle` demands the gate), reconcile through
  the bounded human gate with evidence, and the recovery is idempotent —
  Reserved legs untouched. **The race fix can no longer strand authority.**
- **D-6 journal web-unreachability.** `RunConfig` validation moved INTO
  the library (testable on every platform): journal roots under `/var/www`,
  `/srv/http`, `/srv/www`, `/usr/share/nginx`, `/public_html` refuse
  named (D-6); RELATIVE roots refuse (the quiet cwd variant of the same
  hole); lawful absolute roots pass. The binary validates at load. The
  Caddy-side review row remains the SRE seat's counterpart, per the spec.
- **D-7 HumanGate auditability.** `HumanGate` is `#[track_caller]`: every
  resolution appends an attributable line (timestamp, file:line, chain,
  nonce) to `<root>/human-gates.log` under the exclusive lock —
  programmatic misuse is at least attributable, testably so.
- **D-2 rollover exposure — defined by test.** Yesterday's settled
  actuals expire with the UTC day (today's full-cap reserve admitted);
  OPEN reservations count across rollover (live exposure never expires
  with the calendar).

## En-route facts

- The Linux-only live wiring caught one CI-only error (the new
  `Option<PathBuf>` config field) — fixed with a named requirement.
- Concurrent landings classified docs-only each time (zArcheology sixth
  roll LU/CD specs; the Eddies×DBC double closure); zero overlap, rebased
  clean.
- **Sepolia NOT run, per order.** The smoke prep from the previous mission
  stands ready.

**No production deployment. 30/30 green. Roll-forward: the specs seat's
next rolls (LU-5 hold-invoice upto, LU-6 NIP-47 vocabulary, LU-7/LU-8
typed rail units + absent-vs-zero) are watchlist material for the door's
LN-facing sibling when chartered; the door's own next natural gate is the
founder's Sepolia gesture.**
