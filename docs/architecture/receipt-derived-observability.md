# Receipt-derived observability

**Status: RATIFIED 2026-10-06 by founder word ("Ratify it.") in the Seat 3
session.** A BNR architectural law. The full text, proven instances and
sequence live in `docs/specs/SPEC-RECEIPT-OBSERVABILITY-1.md`; this file is
the short form.

## The rule

What a surface tells a person about the system's state is **derived from
receipts the system already banked**:

    event → receipt → deterministic projection → human-visible state
    receipts[]  →  derive(surface)  →  { state, tone, word, evidence[] }

- **No second state machine.** A status light or line is a fold over the
  receipt stream, so it cannot drift from the evidence.
- **Green needs its receipt.** If nothing proves it, nothing is green.
  Unknown, not measured and offline are first-class states.
- **Verbatim refusals.** When a counterparty says no, its own words are the
  state (`restricted: not a relay member`), never softened.
- **Named measurements only.** A timing names the two events it spans
  (dial → open, AUTH → OK). Nothing pretends to be telemetry the code cannot see.
- **Evidence one tap deeper.** Every light opens the receipts behind it.
- **Receipts carry events, never contents.**
- **Precision.** Evidence may localise a fault without claiming its cause:
  "129 of 131 failed attempts never reached ICE-connected" localises the
  failure to connection setup; it does not tell a closed port from a NAT,
  a firewall, a stale candidate or a wrong advertisement.

There is no universal status schema. Each domain keeps its own receipts; the
shared part is only the rule that user-facing state must be derivable from them.

## Where it stands

| surface | receipts | projection |
|---|---|---|
| bChat | `relay-dial`, `nip42-challenge`, `nip42-verdict`, `dm-published`, … | `surfaces/bchat-cockpit.js`, five lights + connection info |
| bViEw | `RTCPeerConnection` dial → ICE → DTLS → channel → answer | `surfaces/ant-transport.js`, "N of M nodes answered", dial funnel |
| bPay / bMeter | AUTHORIZATION → SETTLEMENT → RECEIPT | not yet |
| x0x / bMESHasi | capability granted → route → exercise → revoked | not yet; extract the shared contract first |

## Order of work

1. Done: this rule, ratified 2026-10-06.
2. Done: the independent-network Autonomi reachability experiment
   (`e2e/ant-reach-probe.mjs`, `.github/workflows/ant-reach.yml`,
   `scripts/ant-reach-compare.mjs`, `scripts/ant-reach-cohort.mjs`).
3. Current: take that evidence upstream before anyone touches `ant-node`
   (`docs/upstream/2026-10-06-autonomi-webrtc-endpoint-reachability.md`).
4. Later: extract the smallest common projection contract first. Ratification
   does not bring back the reverted bMESH dashboard.
