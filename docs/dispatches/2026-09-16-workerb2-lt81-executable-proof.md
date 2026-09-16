# WORKERB2 — LT-8.1 placeholder replaced with executable proof + LU/CD behavioral audit · 2026-09-16

**Seat:** Workerb 2 (one writer on the lane; other agents elsewhere). **Mission
(founder, verbatim):** *"replace the placeholder clock-failure test with an
actual injected failure through the NWC request path. Prove zero published
requests, zero ledger mutation, and unchanged payment identity. Include a
deliberately broken implementation that the test must catch. Then check the
new LU/CD tests for the same problem: exercise implementation behavior, not
assertions about fixtures. Keep hold/MPP capabilities explicitly mock-only
until backend support is demonstrated. … Run default and live-nwc suites
against the same final SHA. Live sends remain OFF; no production changes."*

**LANDED:** `codex/z2b-bpay-rail` @ `8ea738c6`, CI all-green. **Both default
and live-nwc suites ran against this exact SHA: 12/12 result-lines green each
(105 tests total = 91 prior + 3 LT-8.1 + 11 behavioral), clippy clean both
configs, fmt clean, live sends OFF, zero production changes.**

## The tautology and the executable proof that replaced it

The old `lt8_1` test: `let ok: Result<u64,String> = Err(...);
assert!(ok.is_err())` — proved nothing (deleted).

The real suite (`tests/lt8_clock_failure.rs`, live-nwc gated) drives
`NwcRail::pay` → `LiveNwcTransport::request` with an injected failing clock
and proves the three claims through a new **inert-by-default `connect_log`
test seam** (records every relay-connect attempt; `None` in production):

1. **Zero published requests** — no socket connect is even attempted
   (the log stays empty; nothing reaches the unreachable loopback relay).
2. **Zero ledger mutation** — the intent stays exactly `Intent`; never
   InFlight/Unknown/Failed.
3. **Unchanged payment identity** — the same `PaymentHash` survives the
   outage (duplicate refusal names it; no re-minted identity exists), and
   the recovery probe pins the identity intact across the outage.

## The deliberately broken implementation was the code itself — RED proven

**RED receipt:** against the unmodified code, the new suite failed with
`pay()` returning `Ok(Unknown)` — a clock failure was typed
`NwcError::Other`, rode the LU-6 total map into `MarkUnknownHumanGate`,
and **mutated a payment that was never sent**. Exactly the class the
founder flagged.

**GREEN fix:** `NwcError::ClockUnavailable(String)` → `LeaveOpenAtIntent`
(a LOCAL failure is pre-send: zero requests, zero mutation, intent open);
the live edge retyped; plus an **epoch-0 guard** — a clock returning
`Ok(0)` is refused as a clock failure BEFORE any event is built (never
`created_at=0`), with its own zero-publish probe.

## LU/CD audit — behavior, not fixtures

- **Every table-only NIP-47 code now has behavioral coverage** through
  the real `pay()` path asserting actual ledger state
  (`tests/lu6_behavioral.rs`, 11 probes): QUOTA_EXCEEDED / RESTRICTED /
  INSUFFICIENT_BALANCE / NOT_IMPLEMENTED / UNSUPPORTED_ENCRYPTION /
  NOT_FOUND → Intent; UNAUTHORIZED → Unknown; PAYMENT_FAILED → Failed;
  plus the ClockUnavailable map regression at rail level.
- The LU-7.2 one-conversion-site grep now covers `nwc.rs` beside `ln.rs`.
- **Hold/MPP are explicitly MOCK-ONLY:**
  `CapabilityManifest::validate` refuses ANY `Live` identity claiming
  Hold or Mpp until backend support is demonstrated (mock may; Live with
  NONE stays lawful — pinned by test).

**One-writer honored: lane tip re-verified immediately before push.**
