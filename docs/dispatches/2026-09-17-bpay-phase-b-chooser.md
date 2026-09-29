# bPay PHASE B — the chooser: audience is a founder gesture; the resolved policy rides the quote

**Seat:** zCode (bPay/W@tch UI). **Branch:** `zcode/bpay-phase-b-2026-09-17`, STACKED on
#113 @`721b81a7` (Phase A + corrections + the orb overflow cure). **Founder charter
(verbatim intent):** *"I want you to select 🌐 Public and watch the number underneath it
change from a historical reference quote into a fresh quote caused by your actual
choice"* — the first complete closed-loop human→policy→network→evidence cycle. This
dispatch builds the road up to that gesture and STOPS THERE; the acceptance is the
founder's alone.

## CLAIM → EVIDENCE → BOUNDARY NOT CROSSED

- **CLAIM: the chooser exists in the actual product, on the corrected two-axis law.**
  EVIDENCE: wallet.html `#bpay-sec` v2 (`surfaces/bpay-invoice.js` v2): "Choose how this
  is shared" — 🌐 **Public** selectable; 🔒 **Only me** / 👥 **Selected people** VISIBLY
  UNAVAILABLE (disabled + struck + reason), never promised — clicking a disabled row
  changes nothing even under a FORCED dispatchEvent click (the handler refuses too, not
  just the native disabled state). The inspection axis (newbee / raver / cypherpunk) is
  separate: it toggles detail visibility (cypherpunk reveals the raw plan + the
  quote-service endpoint) and NEVER alters audience or authority — gate-proven.
- **CLAIM: selecting Public records the gesture and the fresh quote is CAUSED BY it.**
  EVIDENCE: the gesture writes the resolved policy (`bpay-policy-v1` localStorage:
  audience/selectedAt/inspection/bridge) and the screen shows "You chose 🌐 Public ·
  chosen at …"; "♡ Get a fresh quote" then POSTs `{artifact_sha256: <pin>, audience:
  "public", force_fresh: true}` to the quote service — the RESOLVED POLICY RIDES THE
  REQUEST (the mock asserts all three fields server-side); the response renders as
  **"Current storage quote — caused by your choice"** with the owed recomputed in-page
  from the carried quotes, while the Phase-A quote stays labeled **"Reference quote
  (not chosen by you)"** — the provenance transition the founder asked for, visible on
  one screen, ending in **"Nothing has been paid."**
- **CLAIM: the bridge now CONSUMES the resolved policy — no hidden default promoted
  into a choice.** EVIDENCE: antd-bridge v2 (additive, genealogy-compatible):
  `audience:"public"` → response `policy: {audience, binding:"founder-selected:public"}`
  persisted onto the job record; any other audience → **422** with the never-promise
  wording (verified live); absent audience → legacy, recorded honestly as
  `"unspecified-default (Visibility::Public)"` (verified live, 17.9s happy path on a
  test artifact). **Prepare-by-pin:** the Bux artifact tuple is REGISTERED
  (`artifacts.json` in the bridge state dir, written mechanically from the banked
  prepare response) so the product never sends local paths; unknown pin → 404; hashed
  ≠ pin → refused. The artifact never moved, never re-encoded.
- **CLAIM: gates prove it without simulating the acceptance.** EVIDENCE:
  `e2e/bpay-phase-b-chooser.mjs` — 15/15 GREEN against a **MOCK bridge** (labelled
  MOCK-SYNTHETIC in every response): chooser laws, forced-click refusal, gesture
  record, request shape, current-vs-reference split, nothing-paid, no confirmation
  count (obligations ≠ confirmations law held), inspection-neutrality, A9c. Phase A
  gate 18/18 still green; orb-seat 4/4; estate-source 11/11; RECON-1 oracle GREEN;
  scans clean. CI: Phase B gate wired beside the Phase A gate.

## THE NEAR-MISS (receipted, mechanism closed)

During gate development, a post-hoc localStorage poke failed to update the panel's
in-memory state and one test click sent the founder-shaped request
(`audience:public, force_fresh:true`) to the REAL bridge on :8807. The job record
shows what actually happened: the force_fresh pre-step ABANDONED the Phase-A reference
job (persisted), but the prepare never completed (the page closed at 1200ms) — **no
new job, no `founder-selected` binding, the ceremony record stays clean.** The Phase-A
reference quote set survives complete in the committed artifact + receipts (it was
reference-only; recovery-side persistence was the only loss). CURE, structural: the
gate now seeds the mock endpoint via `addInitScript` BEFORE any page script runs —
the misdirected-gesture class is closed by construction, not discipline.

## THE ORB REGRESSION (root-caused in #113 @721b81a7, receipted here for the method)

The Phase A panel broke `orb-seat` mobile: the commitment-digest line
(`sha256:` + 71 unbreakable hex chars) leaked ~35px past the 390px card → document
scrollWidth 425 → Chromium mobile **shrink-to-fit scaled the whole page ~8.8%**
(innerHeight 918 vs the declared 844) → the fixed tour bar and its orb (bottom 911)
fell below the test viewport. This was REAL product damage — every 390px visitor got a
zoomed-out page — caught by the orb test, root-caused by probe (innerHeight/844 +
per-element scrollWidth offenders), bisection (panel off → 4/4), and cured with
`overflow-wrap:anywhere` (+ `defer` on the loader). Probe method preserved in this
dispatch's history; the lesson (unbreakable hex/monospace strings must wrap-anywhere
on mobile panels) applies fleet-wide.

## The founder's ceremony (the acceptance this lane exists for — NOT simulated)

1. The bridge runs keyless on the laptop (v2 binary, port 8807, production peers).
2. Open the wallet surface locally (the page defaults its quote service to
   `http://127.0.0.1:8807` — visible and editable in cypherpunk view).
3. In the bPay panel: **select 🌐 Public** — the gesture is recorded with its
   timestamp.
4. Press **♡ Get a fresh quote** — the resolved policy rides the request; the network
   answers with a fresh plan (the reference 4.245934921875 ANT may differ — that is
   the point).
5. Read the truthful screen: *You chose Public · anyone with the address can retrieve
   it · Current storage quote X ANT (caused by your choice) · Nothing has been paid.*
6. The bridge's job record banks `founder-selected:public` + the fresh quote — the
   durable evidence of the first closed-loop cycle.

After the founder's quote: the canonical INVOICE-1 artifact rebuild follows
mechanically (`scripts/bpay-mvp/invoice-from-quote.mjs` against the new prepare
response, `--prior` the Phase-A invoice for lineage).

## BOUNDARY NOT CROSSED

No payment. No wallet authorization. No Trezor. No upload/finalize. No pointer. No
rendition. No W@tch mutation. The `founder-selected:public + force_fresh` prepare has
NEVER been executed by any agent — the near-miss aborted before binding, and the gate
now cannot reach the real bridge by construction.
