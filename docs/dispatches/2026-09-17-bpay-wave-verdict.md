# BPAY WAVE VERDICT — banked @68fdae20 · routing to Astra + economic seat · 2026-09-17

**Seat:** zBlood (`lane/zcode-lineage-import` @`68fdae20`, pushed). **Source:** founder-relayed acceptance verdict on the bPay evidence layer + P1 recovery wave (receipt: docs/dispatches/2026-09-17-bpay-evidence-layer.md). This dispatch records the verdict verbatim in its operative parts so the next seats read the same gates from the tree.

## The promotion ledger (as ruled — no state promoted beyond its evidence tier)

| State | Verdict | Evidence tier |
|---|---|---|
| Prepare/recovery (P1 prepared-plan durability) | **GREEN** | LIVE keyless Autonomi prepare/recovery — real 24-chunk plan at 1.910261 ANT, process killed, fresh bridge, same upload_id + total + **24/24 original quote hashes**; `force_fresh` control = new id, 0/24 overlap |
| Invoice generation | **GREEN** | LIVE-QUOTE — derived from an actual network plan, not synthetic economics |
| Authorization | **NOT YET** | no Trezor authorization occurred |
| Settlement | **NOT YET** | no transaction evidence exists |
| Receipt | **STRUCTURE/NEGATIVE TEST GREEN** | buildReceipt refuses without settlement evidence (tested); **live receipt NOT EARNED** |
| Reconciliation | **STRUCTURE GREEN** | breach detection tested on labeled-simulated fixtures; **live reconciliation NOT EARNED** |
| Retrieval survival | **NOT YET** | no retrieval/hash/restoration occurred |

**Explicit non-promotion:** `finalize` being wired to the real `Client::finalize_upload` is **CODE, not evidence** that finalize succeeds after payment. No paid upload was finalized. The whole ceremony is NOT promoted because its hardest pre-payment problem is solved.

## Rulings recorded

1. **Bank `68fdae20`; stop adding architecture.** No further genealogy-side bPay work before the reconciliation below.
2. **Money movement is NOT authorized by the wave report.** Before any founder gesture, the next seat reconciles the exact Trezor/payment ceremony and confirms today's implementation changed none of the previously-reviewed transaction semantics. The founder gesture binds the EXACT invoice/plan — never "go upload the genealogy."
3. **`tools/genealogy/bpay.mjs` stays in genealogy.** It is the first concrete bPay REFERENCE CONSUMER — evidence for the economic/POS/wallet seat, not a second canonical architecture, and NOT refactored into shared infrastructure yet. The economic seat inspects it during frontier reconciliation against the existing primitives (`PricingCommitment`, FeePlan, bMeter, wallet/settlement) and answers: what graduates into generic bPay primitives, what is legitimately genealogy-specific.
4. **Generic lifecycle (as recorded by the economic seat):** QUOTE → **PRICING COMMITMENT** → INVOICE → AUTHORIZATION → SETTLEMENT → RECEIPT → RECONCILIATION. Genealogy today runs QUOTE → INVOICE directly; its plan digest + job-bound persistence + separated ceiling are concrete evidence for what `PricingCommitment → Invoice` needs — that mapping is the economic seat's call, not genealogy's.
5. **The ride-along cleanup (hex-law marker heal; 27 pre-existing §7-trailer-less commits left unrewritten) is NOT evidence for payment durability** — noted as fix-forward behavior, kept out of the acceptance claim.

## Implementation discovery worth preserving (founder-highlighted)

Serializing only `PaymentIntent` would have been INSUFFICIENT: the authorization binding lives down in each prepared chunk's quote/proof metadata (`quotes`, `peer_quotes`, commitment sidecars, PUT targets — the tx-hash→chunk binding and the proof-of-payment material). Those had to survive too, and the recovery swap verifies the re-attached set reproduces the persisted intent exactly. Architecture-by-assumption would have missed this; implementation found it.

## zGenealogy's next boundary (named, not started)

Review with wallet → Understand → Confirm on Trezor → settlement evidence → finalize the exact recovered plan → fresh retrieval → every-artifact hash verification → restored genealogy journey (`profile → crest → Rockwood/Donna → person archive → blood fractal → evidence/lore`). The archive may be called **ANT retrieval-verified** only after independent retrieval and verification.

**Handoff:** `68fdae20` → Astra + the economic/POS/wallet seat for reconciliation before zGenealogy advances toward payment.
