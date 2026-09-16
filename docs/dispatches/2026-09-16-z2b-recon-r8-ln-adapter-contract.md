# Z2.B recon round 8 — LN lifecycle types + the LIVE Alby Hub adapter contract (design, build-ready)

Seat z2.b (GLM/zCode), 2026-09-16. Founder order: "Design the LN
invoice/offer lifecycle types, then map the LIVE Alby Hub integration
surface onto the bPay rail trait. Cover BOLT11 + BOLT12/Offers where
supported, NWC, payment hash/idempotency, expiry, partial/in-flight/
settled/failed states, fee evidence, and spend-cap enforcement. Reuse
Alby Hub rather than rebuilding Lightning. Design/recon only — no
production changes. The goal is a build-ready adapter contract for the
existing LIVE node."

## Evidence pins (2026-09-16, source-fetched)

- **Alby Hub** (github.com/getAlby/hub): "an NWC wallet service";
  default backend = "the embedded LDK based lightning node", with LND,
  CLN (gRPC + optional hold-invoice plugin), Phoenixd, Cashu, and Bark
  (an Ark client) as alternative backends. HTTP API exists but "is not
  a public spec, and only works over HTTP" — apps are told to prefer
  NIP-47. **Per-app connections carry NATIVE budgets**: `max_amount`
  ("maximum amount in millisats that can be sent per renewal period"),
  `budget_renewal` (never/daily/weekly/monthly/yearly), `expires_at`,
  scoped `request_methods` and `notification_types`, and **`isolated`
  connections "with its own balance and only access to its own
  transaction list"**. Per-app NIP-04 encryption keys; seed
  AES-encrypted under the unlock password; "Do not expose it directly
  to the public internet".
- **BOLT12/offers: NOT evidenced** anywhere in the Hub README/API
  surface → designed but PARKED in the adapter (matches the lightning
  lane's standing "BOLT-12 parked").
- **NIP-47 core** (nips/47.md): `pay_invoice {invoice, amount?,
  metadata?} → {preimage, fees_paid?}` with `PAYMENT_FAILED`
  ("timeout, exhausting all routes, insufficient capacity or similar");
  `make_invoice {amount, description?, expiry?…} → {invoice,
  payment_hash, amount, created_at, expires_at, …}`;
  `lookup_invoice {payment_hash | invoice} → {…, settled_at?, state}`
  with states **pending | settled | accepted (hold) | expired
  (invoices) | failed (payments)** and `NOT_FOUND`;
  `get_balance → {balance}`; `get_info → {alias, network,
  block_height, methods[], extensions?}` (capability discovery).
  Error codes: RATE_LIMITED, NOT_IMPLEMENTED, INSUFFICIENT_BALANCE,
  QUOTA_EXCEEDED, RESTRICTED, UNAUTHORIZED, INTERNAL,
  UNSUPPORTED_ENCRYPTION, OTHER. Transport: Nostr kinds 13194/23194/
  23195, NIP-44 v2 preferred, request `expiration` tags.
- **NWC extensions** (nostr-wallet-connect/nwc): 02.md notifications
  (payment_received/payment_sent — field detail at README level only,
  flagged), 05.md `list_transactions` with params `from/until/limit/
  offset/unpaid/type` and the transaction object `{type incoming|
  outgoing, state?, invoice?, description?, preimage?, payment_hash,
  amount(msat), fees_paid(msat), created_at, expires_at?, settled_at?,
  metadata?}`; same five-state vocabulary.

## Part 1 — Lifecycle types (technology-neutral, NWC-vocabulary-faithful)

```
LnInvoice {                     // BOLT11, issued (incoming)
  payment_hash: Hash32, amount_msat: u64, description: Str,
  created_at: UnixS, expires_at: UnixS,          // make_invoice param/result
  bolt11: String,
  state: InvoiceState,
}
InvoiceState = Pending | Settled { settled_at, preimage } | Expired
                                     // + Accepted (hold) — CLN-plugin path only

LnPayment {                     // outgoing; THE rail send unit
  payment_hash: Hash32,         // NATIVE idempotency key (R7 descriptor)
  amount_msat: u64, fee_limit_msat: u64,        // declared bounds (capGate)
  created_at: UnixS, invoice_expiry: UnixS,     // invoice's expiry
  state: PaymentState,
}
PaymentState =
  | Intent                      // persisted before send (watchpay law)
  | InFlight                    // sent; no result yet (covers MPP shards —
                               //   internal to the node, ONE payment here)
  | Settled { preimage, fees_paid_msat? }       // fees_paid OPTIONAL (NIP-47)
  | Failed { code: PayFailure }                 // PAYMENT_FAILED class
  | Unknown                     // result unavailable — human gate, never
                               //   auto-retry (R1 law)

LnOffer { … }                   // BOLT12/Offers — DESIGNED, PARKED:
                                // no Hub support evidenced; adapter
                                // answers a named NOT_IMPLEMENTED refusal

Expiry taxonomy (THREE expiries, kept distinct):
  1. invoice expiry   (expires_at) — after it, incoming: Expired;
     outgoing intents on an expired invoice MUST refuse pre-send
  2. request expiration (NWC transport tag) — replay window only
  3. HTLC timeout     (internal) — surfaces as Failed, never as a fee
```

**State mapping is one-to-one with the proven ledger**: Intent/InFlight
↔ intent/signed, Settled ↔ mined (evidence = preimage, the strongest
possible — knowledge of the payment secret), Failed ↔ reverted (with
the asymmetry: nothing owed), Unknown ↔ unknown (human gate).
NIP-47's own five-state vocabulary maps cleanly; nothing invented.

## Part 2 — The adapter contract (build-ready sketch, no code shipped)

```
trait LnRail {                                 // the bPay rail trait, LN member
  // identity/capabilities
  fn info(&mut self) -> Result<NodeInfo>;      // get_info; methods[] drives
                                               // capability gating (fail-closed
                                               // on missing method)
  // "addresses" (ephemeral by nature)
  async fn make_invoice(&mut self, req: InvoiceRequest)
      -> Result<LnInvoice>;                    // make_invoice; expiry REQUIRED
  async fn lookup(&mut self, by: PaymentHashOrInvoice)
      -> Result<TxState>;                      // lookup_invoice; NOT_FOUND →
                                               // Unknown, never a new payment
  // send
  async fn pay(&mut self, req: PayRequest)     // PayRequest { bolt11,
      -> Result<PaymentHandle>;                //   amount?, fee_limit_msat,
                                               //   idem: payment_hash }
  // history / balance / events
  async fn transactions(&mut self, q: TxQuery) -> Result<Vec<LnTx>>;
                                               // list_transactions (ext 05)
  async fn balance(&mut self) -> Result<Msat>;
  fn events(&mut self) -> EventStream;         // 02.md notifications →
                                               // estate event-bus (push law)
}
```

Binding rules (each is an existing law restated for this seam):
1. **Idempotency**: the ledger is keyed by `payment_hash`; a duplicate
   intent for the same hash routes to `lookup`, NEVER to a second
   `pay_invoice`. `pay` refuses an expired invoice pre-send (named
   refusal).
2. **Fee evidence**: `Settled.fees_paid_msat` is optional — when
   absent, the reservation (amount + fee_limit) stands; when present it
   reconciles the window DOWN. Possible-evidence law: `fees_paid >
   fee_limit` is contradictory → refuse the record, flag the node.
3. **Spend caps — dual layer, one binding law**: OUR capGate window
   reservation (R7) is binding; the Hub's NATIVE per-connection budget
   (`max_amount`, `budget_renewal`, `expires_at`, scoped
   `request_methods`/`notification_types`) is defense-in-depth. Every
   bPay surface gets its own Hub app-connection whose native budget
   equals our declared cap; guest surfaces get **`isolated`**
   connections (own balance + own transaction list — the onboarding
   law's guest tier, natively supported). Hub `QUOTA_EXCEEDED`/
   `RESTRICTED` errors map to our named cap refusals (fail-closed
   alignment both ways).
4. **Transport**: NWC over **our own Nostr relay** (relay.skaists.dev —
   the estate already runs the relay infrastructure) → first-party
   transport; no third-party relay sits in the payment path
   (first-party-only law). Kinds 23194/23195, NIP-44 v2.
5. **Error mapping**: NIP-47 codes → named refusals (UNAUTHORIZED →
   connection ceremony breach = RED; RATE_LIMITED/INTERNAL → retryable
   transport error, payment state UNTOUCHED; INSUFFICIENT_BALANCE →
   liquidity YELLOW (channel-op coordination, R6/7 ladder);
   NOT_IMPLEMENTED → capability gate, incl. parked Offers).
6. **Custody**: the box-resident node + on-box ceremony (R7 policy);
   channel/liquidity operations are NOT this adapter's surface — they
   are YELLOW-ladder, organ-signed ChannelOpL1 legs.

## Rail-trait ↔ NWC mapping (the checklist lands)

addresses→make_invoice/lookup · balance→get_balance · history→
list_transactions · node/health→get_info (capability discovery) ·
sync status→notifications→event-bus · fees→fees_paid evidence +
fee_limit declaration · send→pay_invoice · PendingTransaction→LnPayment
(abort = our cancel/timeout handling; HTLC timeout ≠ fee) · custody→
box node + dual-layer caps.

## Reuse verdict

Wrap NWC ONLY (the public-spec surface; the Hub's HTTP API is
explicitly not a public spec — not used). The adapter is
backend-agnostic over the Hub (LDK default / LND / CLN …), so backend
choice stays a deployment detail. Rebuild nothing: LDK routing,
MPP, invoice handling are all node-side; our code is the typed seam,
the caps, the ledger, and the relay transport.

## Not done / open

No implementation, no production change, no connection created.
Open: 02.md notification FIELD-level pin (README-level this round);
`multi_pay_invoice` batch semantics (ext) — design deferred until a
batching need is real; hold-invoice `Accepted` state depth (CLN-plugin
path) — design parked with Offers.
