# FOUNDER GESTURE UX LAW — constitution-rank operating ruling + zBlood gate amendment + the Bux MVP ceremony chartered

Founder order 2026-09-17, after the W@tch intake closed GREEN (@a0cbd14b) and the zBlood
wake landed (@8f35b48c). Three things happen in this dispatch: the law is recorded
(canonical text at `docs/FOUNDER-GESTURE-UX-LAW.md`), the zBlood wake order's return gate
is AMENDED, and the Bux-video payment becomes the first Founder-Gesture MVP ceremony
with its acceptance test.

## 1. The law

Canonical text: `docs/FOUNDER-GESTURE-UX-LAW.md` (founder block verbatim). Core
inversion: once a founder-facing product surface exists, the canonical founder gesture
occurs THROUGH THE SURFACE — agents prepare up to the gate, verify and resume after it,
and never substitute founder-authored chat text for an available product authorization.
Economic authorization binds the exact PricingCommitment/Invoice DISPLAYED. Wallet and
hardware confirmation remain independently meaningful. Chat rulings stay valid for
architecture, governance, and exceptional recovery where no surface exists.

Gate classes: **product-action gates migrate into MVP UI/UX** (spending ANT, Trezor
signing, invoice approval, external publishing, budget changes, disputed-hypothesis
choices, destructive actions); **architecture/governance gates stay conversational.**

Label convention from today: `FOUNDER ACTION SURFACE: bPay → Invoice → Pay with Trezor`
replaces `FOUNDER ACTION:` — a missing surface is MVP work, not a chat fallback.

## 2. AMENDMENT to the zBlood wake order (supersedes its RETURN-GATE pointer)

`docs/dispatches/2026-09-17-zblood-wake-quote-only.md` remains in force for the MISSION
(QUOTE ONLY; every stop-boundary unchanged). Its return gate is amended from:

`QUOTE → STOP → bring it back to the founder (chat)`

to:

`QUOTE → populate bPay MVP → founder reviews quote/invoice in UI → founder chooses`

- zBlood still RETURNS the quote exactly per the wake block's schema (STATE / CLAIM /
  EVIDENCE / QUOTE / VALIDITY / BOUNDARY NOT CROSSED / NEXT OWNER / FOUNDER ACTION).
- The final field re-keys per the new convention: **FOUNDER ACTION SURFACE:
  bPay → Invoice → Pay with Trezor** (for this ceremony).
- The quote's identity tuple flows MECHANICALLY into the MVP surface (the 2026-09-17
  identity law) — the surface displays the piped tuple, never a retyped one.
- Astra/founder chat inspection of every ANT quote is NOT the standing mechanism; what
  must be validated is that the PRODUCT presents the decision correctly (UI + economic
  invariants), with assets visually separate (ANT storage vs native fee — never one
  synthetic number).

## 3. The Bux payment — first Founder-Gesture MVP ceremony (chartered)

The ANT payment is HELD after the quote only long enough to wire the quote into the MVP
payment surface. **No seat spends the ANT from terminal competence** — knowing how is
not authorization. The bPay/INVOICE-1 lane's next deliverable is this surface:

- Quote screen shows: object identity (machine-piped), size, live ANT storage amount,
  native-fee representation (`Y ETH maximum` or actual applicable form), quote expiry
  (clock), and what-happens (`Upload original → receive Autonomi address → add to
  W@tch`).
- Then `[ Review invoice ]` → `[ Pay with Trezor ]` — human-readable invoice; the
  founder presses.
- **Trezor screen is part of the UI contract:** the two-step Autonomi transaction shape
  is prepared in the UI before the hardware screens appear — `1 of 2 — Approve bounded
  ANT allowance`, `2 of 2 — Pay this exact storage plan`. Trezor is the independent
  physical confirmation surface. If `payForQuotes` is blind-signed, the UI says so
  honestly rather than showing a reassuring green check; ERC-7730 clear signing is the
  future Understand layer.
- Settlement states in UI are earned: `PAID / PARTIAL / FAILED / REFUND DUE` only when
  evidence supports them (measured-states discipline, UI-grade).

## 4. MVP ACCEPTANCE TEST (the Bux video; founder-defined, verbatim)

The founder, WITHOUT terminal commands, can:

1. Open W@tch.
2. See Bux's video waiting for preservation.
3. Request/refresh its live ANT quote.
4. See exact object identity and size.
5. See ANT storage obligation separately from native fees.
6. Open the generated invoice.
7. Understand quote expiration.
8. Press **Pay/Preserve**.
9. Review the corresponding action in the wallet.
10. Confirm it physically on Trezor.
11. Watch the UI progress through truthful states.
12. Receive the Autonomi address.
13. See W@tch become playable.
14. Play the video on the Google TV.
15. Later retrieve it independently and verify the preserved bytes.

**No SSH. No copying hashes. No telling a bee "approved." No manually moving receipts
between agents.** That is the MVP.

## 5. Ledger of temporary chat gates → their intended surfaces (UX backlog, opening)

| Chat gate still in force | Intended surface |
|---|---|
| Bux ANT quote return → founder chat review | bPay → Quote/Invoice → Pay with Trezor |
| Streamer intake runbook (idle-check + adb) | W@tch intake UI (Add to W@tch, file pick) |
| Founder relays wake orders between seats | seat-porch DM (x0x porch, when canonicalized) |

(Entries append as gates are identified; each retired chat gate gets a receipt.)

## State board delta

ANT quote NEXT (unchanged) · **ANT spend/upload NOT AUTHORIZED — and when it becomes
authorized, the authorization gesture is a button press on the MVP surface bound to the
displayed PricingCommitment/Invoice, physically confirmed on Trezor — never chat.**
