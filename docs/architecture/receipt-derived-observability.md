# Receipt-derived observability

**Status: PROPOSED, banked 2026-10-06** (Seat 3, from a founder-relayed Codex
review). It becomes law only when the founder rules it.

## The rule

What a surface tells a person about the system's state is **derived from
receipts the system already banked**: event, receipt, projection, human truth.

    receipts[]  →  derive(surface)  →  { state, tone, word, evidence[] }

- **No second state machine.** A status light or line is a fold over the
  receipt stream, so it cannot drift from the evidence.
- **Green needs its receipt.** If nothing proves it, nothing is green.
  Unknown, not run and offline are states in their own right.
- **Verbatim refusals.** When a counterparty says no, its own words are the
  state (`restricted: not a relay member`), never softened.
- **Named measurements only.** A timing names the two events it spans
  (dial → open, AUTH → OK). Nothing pretends to be telemetry the code cannot see.
- **Evidence one tap deeper.** Every light opens the receipts behind it.
- **Receipts carry events, never contents.**

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

1. Bank this rule (this file).
2. Run the independent-network Autonomi reachability experiment
   (`e2e/ant-reach-probe.mjs`, `.github/workflows/ant-reach.yml`,
   `scripts/ant-reach-compare.mjs`).
3. Take that evidence upstream before anyone touches `ant-node`.
4. Only then generalise the projection into bMESHasi / x0x.
