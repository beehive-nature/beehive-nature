# bPay PHASE A — the real invoice renders: live quote obtained, machine-bound, understandable; nothing spendable

**Seat:** zCode (bPay/W@tch UI seat, woken by PR #110's charter). **Base:** `a5b201c1`
(main incl. the wake dispatch + RECON-1 merges #107/#109). **Branch:**
`zcode/bpay-ui-phase-a-2026-09-17`.

**Mission (PR #110, founder words):** *"Render one real, machine-bound invoice and let
loVis understand it. Do not enable spending until the surface itself passes review."*
This dispatch receipts Phase A of the chartered A→F ladder, plus the founder's
sharing-policy rider (absorbed below), plus the LIVE QUOTE the zBlood wake order
(#103) was still owed for this exact artifact.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

- **CLAIM: a REAL, live-network storage quote for the exact canonical Bux video was
  obtained keylessly.** EVIDENCE: antd-bridge (ant-core real Client, 7 production
  bootstrap peers, fresh state dir) — `POST /v1/upload/prepare` on
  `try_autonomi.mp4` → HTTP 200 in 41.9 s; the BRIDGE hashed the file itself:
  sha256 `338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e` <!-- PUBLIC-CONSTANT: sha256 content pin, Bux community video identity --> ·
  214,091,829 bytes · **56 chunks, 0 already stored, payment_type wave_batch,
  total 4,245,934,921,875,000,000 atto-ANT (4.245934921875 ANT)** ·
  data_map_address `0x7c4f61ed1c7b950a3043b8a2d1aa9974a24ac6ca274c330e4da1b3a6a61bbb78` <!-- PUBLIC-CONSTANT: public self-encrypted data-map address — the deterministic future live address --> ·
  56 per-chunk `{quote_hash, rewards_address, amount_atto}` quotes, all carried
  verbatim. NOT PROVEN: anything beyond the quote — see BOUNDARY. Receipt:
  `docs/receipts/bpay-quote-try-autonomi-2026-09-17.md` (raw machine response
  pinned by sha256, uncommitted).
- **CLAIM: the quote flowed MECHANICALLY into a valid INVOICE-1 invoice.** EVIDENCE:
  `scripts/bpay-mvp/invoice-from-quote.mjs` — refusal gates (wrong sha / wrong
  bytes / quote-sum≠prepare-total / merkle arm absent → REFUSED, selftest 5/5);
  owed DERIVED from the 56 carried quotes (INV-1.1); ceiling = exact total, never
  unlimited (SPEC-AUTONOMI-TREZOR-1 §2); commitment
  `sha256:fe58f843117dbbd2a5b197f99d1623f304965458011a90788350e8204ca2fe0e` <!-- PUBLIC-CONSTANT: public commitment digest over the carried quote set -->;
  artifact `surfaces/bpay-invoice.json` REVALIDATES FROM FILE (contentDigest +
  commitment re-derive on the parsed document).
- **CLAIM: the invoice renders in the estate's own wallet surface, understandably,
  with nothing spendable.** EVIDENCE: wallet.html `#bpay-sec` panel +
  `surfaces/bpay-invoice.js` loader (the spend-audit separate-file pattern); the
  page RECOMPUTES owed from the carried quotes (never trusts the stored total);
  native gas shown SEPARATELY (Arbitrum ETH, wallet-side — no synthetic number
  invented); quote freshness + commitment digest + honest waiting state. Gate
  `e2e/bpay-invoice-phase-a.mjs`: **RED first (2 failed: panel+artifact absent),
  GREEN after — 14/14**, including "no authorization route strings" (A9c law).
  Shot: `e2e/shots-bpay-phase-a/wallet-bpay-390.png`.
- **CLAIM: every family battery stays green on this tree.** EVIDENCE: INVOICE-1
  reference battery + builder 13/13 + oracle 13/13; VOCAB-1; RECON-1 closure +
  oracle verifier GREEN + sabotage CONVICTED (15 fails incl. all five seductions);
  estate-source 11/11 (after moving the loader to its own JS file — the
  corpus-English stale check reads static markup only); secret-scan diff+tree
  clean (hex-law markers below).
- **NOT PROVEN: that the founder understands it.** That is Phase A's acceptance
  gesture — the founder's eyes on the live surface — and it cannot be receipted
  by this seat.

## The privacy/sharing rider — absorbed as law, chartered as Phase B

The founder's 2026-09-17 rider (sent to this seat and a co-creating seat): the
sharing choice (**Public / Private / Cypherpunk** — three presets over ONE
capability/policy object, "Private · Customized" instead of a product switch) is a
FIRST-CLASS choice BEFORE prepare/quote, with a plain-language "Who can get this?"
line, advanced panels that expose power (identity/access, encryption, storage,
network, payments, proofs, forgetability — never jargon for its own sake), and the
RECEIPT RECORDS THE RESOLVED POLICY, not the button label. Absorbed here:

1. **Machine fact recorded:** the bridge prepared with `Visibility::Public` — the
   carried quote set economically binds a PUBLIC plan. The invoice carries
   `domain.policy` = the resolved policy the quote ACTUALLY bound (preset public,
   access line, self-encryption-is-storage-mechanics honesty, immutable-once-stored
   forgetability honesty) — a receipt fact, not a choice.
2. **The founder's choice is a UI gesture, never agent-inferred:** the panel prints
   the sharing row + "Who can get this?" + the note that the chooser runs before
   quoting. The chooser surface itself is **Phase B work** (it must exist before
   any NEW quote binds a plan; this first Bux quote's public binding matches the
   intake's stated intent — public distribution — and the founder's selection
   gesture is still owed in-product before authorization).
3. Per the rider: no separate architectures — presets over one policy object; the
   invoice's `domain.policy` block is that object's receipt projection.

## Hex-law compliance (new mechanism, within the scanner's own law)

`surfaces/bpay-invoice.json` carries 59 hex runs of 48+ (quote hashes, sha pin,
data-map address, digests) — public chain data, but canonical JSON cannot carry
same-line comments. Solution: each hex-valued key gets a `scan` sibling INSIDE the
document (before the content digest is computed — the digest covers it; the
artifact still revalidates from file), and the builder's serializer keeps the pair
on ONE physical line — the scanner's own sanctioned PUBLIC-CONSTANT marker,
applied per line. The serializer FAILS CLOSED on any hex leaf without its in-object
marker (a file-only marker would break digest re-verification). A dockets-style
path exemption may be ruled by the founder later; none was self-granted.

## CI wiring

- static job: `node scripts/bpay-mvp/invoice-from-quote.mjs --selftest`
  (refusal gates every push).
- playwright job: `node e2e/bpay-invoice-phase-a.mjs` (the Phase A gate —
  serves `surfaces/` from the tree, exercises the real committed artifact).

## Load-bearing findings for the phases ahead

1. **WAVE MODE at 204 MiB** — 56 chunks < the 64-chunk merkle threshold → **one
   Trezor confirmation per quote (56)** — the hostile hardware-wallet shape
   SPEC-AUTONOMI-TREZOR-1 §1 named. Phase E must print shape + exact count before
   any signing; batching options weigh at ceremony design.
2. **Policy is plan-bound** — the chooser must precede prepare (rider law above).
3. **Quotes age** — single-use network-side; the bridge's persisted plan is the
   recovery path; the surface re-quotes at payment time when the plan no longer
   applies (Phase B/C law).
4. **A9c tripwire discipline holds** — no `Review & Pay` route exists in
   `surfaces/`; the verifier stays GREEN on this tree. The Phase C PR will turn
   A9c red BY DESIGN; the cure is the oracle seat's SURFACE_READY re-ruling WITH
   independent live exercise, not a label change.

## Phase ladder state (charter A→F)

- **Phase A — DONE (this dispatch):** quote/invoice visible + understandable.
- **Phase B — NEXT:** exact commitment binding proven + the sharing-chooser
  surface (public/private/cypherpunk presets, one policy object, "who can get
  this?" summary) + quote freshness/re-quote law in-product.
- **Phase C:** the button becomes `SURFACE_READY` (A9c re-ruling ritual).
- **Phase D:** the founder's press creates authorization (product gesture only).
- **Phase E:** Trezor (wave-shape warning printed; blind-signing stated honestly).
- **Phase F:** settlement/reconciliation updates the UI from evidence (RECON-1
  results only; per-asset rendering nuance preserved verbatim).

## BOUNDARY NOT CROSSED

No payment. No wallet authorization. No Trezor ceremony. No upload/finalize. No
pointer. No rendition. No W@tch mutation. The founder's authorization gesture
remains unexercised — by design, it does not exist yet.
