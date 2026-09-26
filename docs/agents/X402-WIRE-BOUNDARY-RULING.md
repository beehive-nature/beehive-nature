# X402-DOOR WIRE BOUNDARY — ARCHITECTURE RULING (one family: IF-5, IF-1..IF-4, F3/F5)

**Ruling seat:** Astra, 2026-09-17, on founder order. **Input evidence:** the
Gesture-D rerun receipt (PR #98) — live-proven: the repaired door boots, and
every real x402 v2 payer request (fresh exact leg, the prior pass's
on-chain-validated stored exact leg, an upto leg) is refused at leg extraction
with `400 missing path /paymentPayload/payload/from`, journal pristine. **Every
source claim below was re-verified by this seat at source this pass** (cargo
registry 2.0.2 sources on the box + a Windows compile/decode check) — nothing
is inherited from the executor's report unverified. No implementation ships
from Astra (lane law); this ruling decomposes into builder claims.

## 0 · Source truth this ruling stands on (all first-hand)

1. The upstream v2 envelope is GENERIC: `v2::VerifyRequest{ x402Version,
   paymentPayload: PaymentPayload{ accepted, payload, … }, paymentRequirements
   }` — the scheme payload is a type parameter; each scheme module binds it
   (`v2_eip155_exact/types.rs`, `v2_eip155_upto/types.rs`).
2. `ExactEvmPayload` is an untagged enum with exactly two variants:
   `Eip3009(ExactEvmPayload{ signature, authorization{ from, to, value,
   validAfter, validBefore, nonce } })` and `Permit2(Permit2Payload<
   ExactPermit2Witness>{ signature, permit2Authorization{ deadline, from,
   nonce: decimal-u256, permitted{ amount: MAX, token }, spender, witness } })`.
   The requirements' `extra.assetTransferMethod` (`eip3009{name,version}` vs
   `permit2`) binds which variant is consistent.
3. Upto is **Permit2-only** (`UptoPermit2Payload`, witness binds `to` +
   `facilitator` + `validAfter`); upto `requirements.amount` IS the maximum.
4. `UptoSettleResponse` carries `amount` = the ACTUAL settled figure
   (atomic units) — real evidence exists for reconciling down; the door's imp
   currently discards it (`actual_amount: None`).
5. **$0 settlements exist upstream**: a zero `required_amount` upto settle
   returns `success:true` with an EMPTY transaction hash and NO on-chain
   interaction (documented as letting unused authorizations expire).
6. **No `Ok(error-shaped)` settle response is constructed anywhere in 2.0.2**
   — `UptoSettleResponse::error()` exists as a constructor with ZERO call
   sites; facilitator-local returns every failure as `Err`
   (`FacilitatorLocalError::Settlement`, incl. `UnsupportedScheme`). F5
   re-verified and stands, refined (see §5).
7. `x402-chain-eip155` 2.0.2 default features (types only, no
   facilitator/client) **compiles and decodes the real wire on Windows** —
   verified this pass with the exact leg shape the door refused live
   (checksummed `from`, `value`, `validBefore` all decoded).
8. Door side (verified in the builder pass): `wire.rs::extract_leg` reads only
   flat `paymentPayload.payload.{from,nonce,validBefore,value|maxAmount}`;
   handlers extract-first; imp maps every settle `Err` → `Ambiguous`; journal
   `LegKey{ chain, scheme, auth_nonce, payer, amount_authorized,
   valid_before_unix, pay_to, asset }` with the upto law (actual ≤ ceiling,
   human gate included) and evidence-gated reconcile-down already in force.

**The flat shape exists only in the door's own test fixtures. It is not a wire.**

## 1 · THE RULING (the canonical boundary)

```
UPSTREAM WIRE PAYLOAD (verbatim raw JSON)
  → door typed decode (UPSTREAM types, scheme-dispatched)     [one dialect]
  → canonical internal settlement leg (LegKey, unchanged law)
  → verbatim raw request passes UNTOUCHED to the facilitator seam
  → evidence returns (typed) → economic/accounting semantics (journal law)
```

**One authoritative parse.** The door decodes the request with the SAME
upstream types the facilitator will decode it with, derives its internal leg
from the TYPED values, and hands the raw request through the existing seam
untouched (the facilitator's own decode is unchanged; double-decode of raw
JSON at the seam is the accepted price of seam isolation — the door never
re-serializes payer material). The door's JSON-path dialect (`extract_leg`)
is RETIRED as the wire interpreter.

## 2 · The six questions, answered explicitly

**Q1 — what is reused:** the scheme payload types and envelope from
`x402-chain-eip155` (new plain dependency, DEFAULT features — Windows-verified
§0.7; the existing `cfg(unix)` facilitator-feature dep stays for the imp).
NOT duplicated: no second JSON-path interpreter, no local mirror structs.

**Q2 — authoritative enum first:** YES. Decode order: (a) requirements
(scheme, CAIP-2 network, `extra.assetTransferMethod`); (b) scheme-dispatched
payload decode — `exact` → `ExactEvmPayload` (untagged, both variants; variant
cross-checked against `assetTransferMethod`), `upto` → `UptoPermit2Payload`;
(c) `LegKey` derived from the typed payload + requirements. Only then journal,
gates, facilitator.

**Q3 — common vs scheme-specific:** COMMON (journal/LegKey): `payer`,
replay `nonce` (STRING, verbatim — EIP-3009 is 0x-hex-32, Permit2 is
decimal-u256; both are the idempotency key, never parsed further), amount
CEILING (EIP-3009 `value` | Permit2 `permitted.amount`), `valid_before`
(`validBefore` | `deadline`), and — from REQUIREMENTS, the seller's terms,
never from the payload — `pay_to`, `asset`, `chain`, `scheme`. SCHEME-SPECIFIC
(pass-through, never journal-parsed): `signature`, `witness`, `spender`,
`validAfter`, the EIP-712 structure, `requirements.extra`. The raw request is
the evidence carrier.

**Q4 — four figures stay distinct:**
1. `requirements.amount` — the seller's ask (exact: price; upto: max). The
   facilitator enforces the match; the door checks payload-vs-requirements
   ceiling consistency at decode (upto: `permitted.amount` ≤
   `requirements.amount`) and logs, never invents.
2. `amount_authorized` (LegKey) — the ceiling booked at RESERVE (Q3 mapping).
3. `actual_amount` — ONLY from settle evidence: upto →
   `UptoSettleResponse.amount` (the imp MUST map it — closes IF-2); exact →
   the payload value the settle confirmed. Never defaulted from the ceiling
   when evidence carries a different figure.
4. gas — `reserved_gas_wei` stays the pre-flight config reserve (budget law
   unchanged); `gas_actual_wei` is evidence-only. Upstream settle responses
   carry NO gas figure (verified §0.4/§0.6), so truth-rate gas requires a
   receipt fetch (`eth_getTransactionReceipt.gasUsed`) at the imp — builder
   claim W4, explicitly SEPARABLE and deferrable behind the ceremony rerun;
   until it lands the journal's conservative reserve-rate booking stays but
   is never CLAIMED as reality-rate in any receipt.
5. **$0 settles:** the door REFUSES zero-amount legs at RESERVE (named
   refusal — a $0 authorization is not a payment this door serves). Upstream's
   empty-transaction $0-success path is thereby never reached; the journal's
   evidence law (tx hash + actual gas) is never asked to represent a
   no-evidence settle. No new journal state.

**Q5 — malformed/unsupported classification:** at the DOOR boundary, before
journal, typed and named (fail-closed preserved): `UnsupportedScheme{scheme}`,
`MalformedPayload{scheme, detail}` (upstream serde detail verbatim),
`VariantMismatch{expected, got}` (assetTransferMethod vs payload variant).
Plus the SETTLE-time taxonomy (F5's cure): the imp splits upstream `Err` into
`DefinitelyNotExecuted` (decode/unsupported-scheme/pre-flight validation —
returned before any chain interaction) → `FacilitatorSettle::Error`
(attempt-counted; AV-6a's ceiling becomes reachable), versus
`PossiblyExecuted` (provider/transport/post-send) → `Ambiguous` → journal
`Unknown` (the never-auto-retry law unchanged). This replaces the
structurally-impossible wait for `success:false` responses.

**Q6 — the flat fixtures:** OBSOLETE WIRE FIXTURES. They encode a wire that
never existed upstream; nothing legitimate consumes them (the door never
served a request; the only producers are the door's own test helpers —
live-proven). They are NOT internal-leg fixtures: the tests that construct
`LegKey` structs directly (av4_disjointness, r4_audit) are the internal-leg
fixtures and remain untouched. NOT a compatibility surface: no external flat
producer exists, so none is preserved. Migration: the shared `request()`
helpers in acceptance/adversarial/d_specs become upstream-shaped builders;
one NEW negative test pins that flat payloads are REFUSED (the fail-closed
proof takes over the coverage the flat positives falsely implied).

## 3 · Builder claims (smallest independently testable; ordered)

- **W1 — typed decode (repo, platform-independent):** plain dep +
  decode module (Q2 order, Q3 mapping, Q5 boundary errors). Tests: EIP-3009
  exact → LegKey; Permit2 exact → LegKey; upto Permit2 → LegKey with ceiling
  consistency; flat REFUSED (negative); unknown scheme refused named;
  malformed per variant refused named; R4 CAIP-2 hostile-string checks
  preserved; nonce-format verbatim (hex vs decimal).
- **W2 — handlers + fixtures (repo):** /verify /settle ride the typed path;
  R4 log line shape preserved (one chain per line, no joins); zero-amount
  legs refused at reserve (Q4.5); the four suites' `request()` helpers
  migrate upstream-shaped; LegKey-direct fixtures untouched; full door suite
  green (Windows local + Linux CI, live-wiring build included).
- **W3 — imp evidence + error taxonomy (unix, live-wiring):** Success
  mapping carries `actual_amount` (upto: response amount; exact: payload
  value) — IF-2 closed; settle-Err taxonomy split per Q5 with per-class unit
  vectors; compiles on CI Linux. Live proof belongs to the ceremony rerun,
  not the builder.
- **W4 — receipt-fetched gas actual (SEPARABLE, deferrable):** imp fetches
  `gasUsed` for `gas_actual_wei` — F3's truth-rate half. Does NOT gate the
  wire-family GREEN; until it lands, reserve-rate stays conservative-but-
  named.

W1 → W2 → W3 is the GREEN line for the family; W4 may ride after. The
ceremony kit already builds upstream shapes (live-proven); its `upto`
dispatcher arg bug is fixed at the rerun, not in builder scope.

## 4 · Preserved invariants (checked against this ruling)

Fail-closed (typed refusals replace path-walk refusals, same law) ·
journal-before/after invariants (no journal change at all in W1–W3) ·
replay/idempotency (LegKey nonce law unchanged; both nonce formats verbatim)
· bounded authorization (upto law incl. human gate untouched) ·
actual-vs-reserved distinctions STRENGTHENED (IF-2 mapping; W4 optional) ·
error classification (Q5 taxonomy; Unknown law untouched) · D-1..D-7, R4,
boot/exclusive laws, config — untouched · the static signature evidence tier
— untouched, not promoted. No production placement; AV-6b stays specified-only.

## 5 · What this ruling closes

IF-5 (wire disjointness — the boundary becomes upstream's own types) · IF-1
(upto rides Permit2 wire; decode covers it; the "EIP-3009-shaped upto"
assumption is corrected as a ceremony-kit assumption, already building
Permit2) · IF-2 (amount mapping lands in W3) · F5/AV-6a seam (Error outcomes
become constructible via Q5 taxonomy; the ceiling is reachable without
error-shaped responses) · F3 half-closed (W3 truth amounts; W4 deferrable
truth gas) · IF-3/IF-4 (reserve-vs-actual + AV-6a production seam) ride W3/W4
and the rerun's evidence. The INTEGRATION-FINDINGS-QUEUE (PR #93, unmerged)
items IF-1..IF-5 are hereby reconciled by this ruling; the queue owner should
mark them ruled with a pointer here.
