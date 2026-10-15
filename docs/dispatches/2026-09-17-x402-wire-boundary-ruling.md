# X402-DOOR WIRE BOUNDARY — the Astra family ruling (2026-09-17)

**Founder order:** reconcile IF-5 + IF-1..IF-4 + the downstream F3/F5 seams
as ONE family; define the canonical boundary; decompose into the smallest
independently testable builder claims; no implementation from Astra.

**The ruling lives in-tree:**
[docs/agents/X402-WIRE-BOUNDARY-RULING.md](../agents/X402-WIRE-BOUNDARY-RULING.md).
This dispatch is the pointer and the evidence ledger for how it was reached.

## What this seat re-verified at source (nothing inherited unverified)

- Upstream 2.02 sources on the box (x402-types, x402-chain-eip155,
  x402-facilitator-local): the generic v2 envelope, `ExactEvmPayload`'s two
  untagged variants, upto's Permit2-only payload with the actual-amount
  settle response, the zero-call-site status of `UptoSettleResponse::error()`
  (no `Ok(error-shaped)` settles exist — F5 stands, refined), and the $0
  settlement path (success + EMPTY transaction + no chain interaction).
- A Windows compile-and-decode check of `x402-chain-eip155` default features
  against the EXACT leg shape the door refused live on the box (scratch
  crate, scripts/tmp — not product code): the upstream types are the door's
  cross-platform decode path. W1's dependency claim is proven, not assumed.

## The ruling in one paragraph

One authoritative parse: the door decodes requests with the SAME upstream
types the facilitator uses (scheme-dispatched by requirements), derives its
internal LegKey from the TYPED values (payer, nonce-verbatim, ceiling,
valid-before; payTo/asset/chain from the seller's requirements), passes the
raw request through the seam untouched, and takes evidence back typed: upto
settle amount becomes `actual_amount` (IF-2 closed), settle errors split
Definitely-Not-Executed → Error (AV-6a reachable) vs Possibly-Executed →
Unknown (the never-auto-retry law untouched), $0 legs are refused at reserve
(the empty-transaction success is never reached), and truth-rate gas rides a
separable receipt-fetch claim (W4, deferrable behind the ceremony rerun).
The flat wire shape is ruled an obsolete fixture dialect — no compatibility
surface exists (live-proven: no real payer can send it), fixture helpers
migrate upstream-shaped, and a negative test pins flat refusal.

## Builder claims (the GREEN line for the family)

**W1** typed decode module (repo, platform-independent) → **W2** handlers +
fixture migration + zero-amount reserve refusal (repo) → **W3** imp evidence
mapping + error taxonomy (unix live-wiring) — W1→W2→W3 is the family GREEN;
**W4** receipt-fetched gas actual is separable and deferrable.

## Hand-off

- Builders take W1..W3 (W4 optional/deferred) per the ruling's claim list;
  each claim lands RED-first in its own right where a law changes (the house
  pattern proven on F1).
- After builders return GREEN: the **Gesture-D executor wakes and reruns the
  SAME ceremony order** (founder's chain). Kit/driver/binary staged; the
  kit's `upto` dispatcher arg bug is fixed at the rerun.
- The INTEGRATION-FINDINGS-QUEUE (PR #93, unmerged) items IF-1..IF-5 are
  reconciled BY this ruling; its owner marks them ruled with a pointer here.
- D(testnet) promotion only from the live ceremony itself — unchanged.

— Astra ruling seat (zCode session), 2026-09-17 (UTC).
