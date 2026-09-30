# SPEC-BPAY-DOCS-1 — the bPay papers: generic INVOICE / RECEIPT / CREDIT-NOTE artifacts + the reconciliation taxonomy

**Status:** SPEC v1 (claimed 2026-09-17 by the bPay/bMeter economic-frontier
seat; docs-only — ZERO production code in this claim). Consumers-to-be:
zGenealogy (preservation invoices/receipts), wallet/POS surfaces, watch, the
mission desk. Nothing here moves money — papers DESCRIBE; rails EXECUTE (the
meter's baton fence, generalized to the whole layer).

## 0 · Position in the seven-state line

```
QUOTE → PRICING COMMITMENT → INVOICE → AUTHORIZATION → SETTLEMENT → RECEIPT → RECONCILIATION
 (exists)   (VV-1, spec'd+       THIS        (exists)       (exists)    THIS        THIS
 rate_set    frozen, builder      SPEC                                SPEC        SPEC
 + vending   unclaimed)                                              (+credit
 rows, TTL                                                            notes)
```

The papers sit ABOVE rails and BELOW consumers. They REFERENCE the owned
primitives by hash/id — never re-implement them:

- **commitment_ref** → VV-1 PricingCommitment semantics (immutable open-time
  promise, self-sufficient, snapshot execution; spec frozen on
  `zcode/vv1-vending-pricing-2026-09-16` awaiting its builder). The paper
  carries `{kind, hash}` and treats the commitment as an opaque sealed
  promise. "Governance may change tomorrow's offer. It cannot change
  yesterday's promise" is INHERITED, not restated.
- **authorization_ref** → the signed permission that answers the invoice:
  capability-binding ids (bpay-rail `capability.rs`), EIP-3009 nonces (x402
  door), Permit2 witnesses, spend-cap ids (wallet capGate), vending upto
  ceilings. Referenced, never embedded (the paper is not a bearer
  authorization).
- **settlement evidence** → rail receipts: tx hashes + explorer/evidence refs,
  voucher-escrow event hashes, meter receipt ids, watchpay receipt shapes.
  Evidence is CITED with its trust class named (watchpay receipt.rs law:
  "RPC responses are evidence, not independent cryptographic proof").

## 1 · The three artifacts

### 1.1 `bpay.invoice.v1` — what is owed and why

A human/machine-readable description of an obligation, GROUNDED in a
commitment. Immutable once issued; corrections are credit notes referencing
the prior paper (append-only document lineage, the RETAIN/FORGET law's
publication-consent shape — nothing is ever edited in place).

```
invoice_id            # content-derived id (see §3 encoding)
issuer                # estate org + surface identity
payer_ref             # may be a pseudonym/key id — R4 law: no cross-rail joins
lines[]               # {description, qty, unit, amount_basis, tithe_bp, amount_line_total}
asset                 # settlement asset for the headline figure
conversion_quote?     # {quoted_asset, rate, quoted_at, expires_at, source} —
                      #   OPTIONAL; when present, an EXPIRED quote is displayed
                      #   as stale and never silently re-derived (AV-2 law shape)
commitment_ref        # {kind:"pricing-commitment", hash} — the sealed promise
authorization_ref?    # present once an authorization answers (id + scheme + ceiling)
totals                # {basis, tithe_calculated, grand}
                      #   LAW: grand = basis + tithe_calculated, exactly, at
                      #   issue time — single rounding, floor identity, the
                      #   vending tithe conservation law lifted to papers
issued_unix, valid_before?
status                # draft → issued → authorized → settled | partial | credited | void
```

**Laws.** (i) The tithe is its OWN line, never buried (rate_set founder law,
lifted verbatim). (ii) Provider cost basis is COST, never customer revenue —
a paper that cannot show basis≠revenue decomposition is malformed (the API-lane
law made structural). (iii) An invoice with no commitment_ref is `draft` only
— it may not be authorized or settled (no floating obligations).

### 1.2 `bpay.receipt.v1` — what actually settled

Evidence describing actual settlement. SEPARATE first-class artifact: a happy
path may render both behind one "PAID" surface, but they never merge in data.

```
receipt_id, invoice_ref
settlement[]          # per rail used: {rail, evidence_ref, asset, amount_settled,
                      #   fees[{class, amount}], finality{depth_or_confirmations,
                      #   policy_note, as_reported}}
decomposition         # {basis_charged, tithe_accrued, tithe_settled,
                      #   refunds, credits}   — the founder's accounting axes
reconciliation        # §2 record (state + deltas vs the invoice totals)
issued_unix
anchors?              # optional durability anchors (Autonomi/chain) — the
                      #   zGenealogy ceremony's domain, referenced not specified
```

**Laws.** (i) `tithe_settled ≤ tithe_accrued ≤ tithe_calculated` with each
inequality's violation a named defect class (accrual happens per charge;
settlement happens when a rail actually moves the tithe — the meter's
computed tithe book made a typed field, not a comment). (ii) Fees ride by
FeeClass (bpay-rail vocabulary: L2Gas / L1FoldedGas / L1Surcharge /
LnroutingMsat / ChannelOpL1) so EVM-pays-on-failure vs LN-owes-nothing is
never flattened. (iii) Evidence carries its trust class; finality is
as-reported with the policy note (the watchpay honesty law).

### 1.3 `bpay.credit-note.v1` — the correction primitive

Refunds, overpayments, rebates, and post-issue corrections are all ONE shape:
a credit note referencing the source paper(s), with its own lines/decomposition
and its own settlement evidence when redeemed. Overpay NEVER silently kept:
an overpaying settlement forces a credit note or a refund line in the
reconciliation record.

## 2 · The reconciliation taxonomy (the missing state machine)

Rail ledgers own transport states; PAPERS own obligation resolution. The
paper-level states and their rail-state feeds:

| paper state | meaning | feeds from (examples) |
|---|---|---|
| `satisfied` | settled == owed, within tolerance law | door Settled; bpay-rail Settled; escrow burn |
| `partial` | settled < owed; invoice stays open with balance | upto reconciled-down; MPP one-of-many parts |
| `overpaid` | settled > owed → credit note FORCED | — (nowhere modeled today) |
| `refunded` | rail returned funds | — (nowhere modeled today) |
| `credited` | estate issued credit (goodwill/voucher) | voucher pool allocation |
| `failed` | rail-terminal failure; charges per FeeClass | bpay-rail Failed; door FailedKeep |
| `unknown` | outcome undetermined — human gate only | door Unknown; bpay-rail Unknown; AV-8 |
| `finality-pending` | settled-but-reorg-class risk | door ReorgFlagged |
| `void` | cancelled before authorization | invoice `void` |

**Laws.** (i) `unknown` and `finality-pending` DECIDE NOTHING (the AV-5 law:
flag stops credit, resolves nothing). (ii) Transitions are evidence-gated —
no paper state changes without cited settlement evidence or a credit note.
(iii) The taxonomy is paper-level and rail-agnostic: adding a rail must not
add states, only evidence kinds.

## 3 · Encoding + possession

- Canonical JSON with **length-prefixed or strictly-typed field encodings**
  (the corpus F2 canonical-ambiguity lesson: NUL-free constrained alphabets
  for ids, length-prefixed concatenations for any signed digest preimage).
- Ids are content-derived (sha256 over canonical bytes); document lineage is
  append-only and hash-reference back.
- Papers are self-contained single files: renderable to HTML server-side,
  downloadable as JSON + rendered, viewable offline. No Stripe clone — the
  information architecture only (total, state, date, method, reference,
  details, download) in the estate's own palette and register law.
- **Dual-register law:** every rendered paper carries the friendly layer
  (PAID/SETTLED, total, invoice ref, date, route, View details / Download
  invoice / Download receipt) and the cypherpunk depth layer (signed
  authorization identity/evidence, commitment hash, cost/tithe decomposition,
  settlement asset, conversion evidence, rail + evidence references, actual
  fees by class, retries/failure charges, finality, reconciliation record) —
  the estate's existing bee/raver/cypherpunk `data-reg` pattern.

## 4 · Non-goals (fences)

No rail changes; no VV-1 edits or builder work; no bpay-rail crate changes;
no IF-1..IF-4; no zGenealogy surfaces or preservation-specific content; no
money movement; no on-chain mutation; no new state machines below the paper
layer. This spec is the CONTRACT the future builder and consumers code
against.

## 5 · Test shape (for the future builder; red-first)

1. Canonical-encoding vectors incl. adversarial NUL/unicode fields (F2 law).
2. Conservation identities: grand = basis + tithe_calculated; decomposition
   inequalities; partial sums never exceed owed without forced credit note.
3. Reconciliation transition battery: every illegal transition refused loud
   (e.g. `satisfied → partial`, evidence-less `refunded`).
4. Immutability: any in-place mutation of an issued paper is detectable
   (content-id mismatch).
5. Register rendering: friendly layer shows no fee jargon; cypherpunk layer
   shows every accounting axis — both from ONE artifact.

## 6 · Open questions routed to Astra (reconciliation/control seat)

- Invoice↔commitment cardinality (one commitment, many invoices —
  subscriptions/metering — vs one-to-one for POS).
- Conversion-quote ownership: does the quote live in the invoice (embedded,
  expiring) or beside it (referenced artifact)?
- Tithe settlement rail policy: where accrued tithe actually moves, and how
  often (the founder's word governs; the paper only records).
- Whether `finality-pending` needs a depth parameter exposed to consumers.
