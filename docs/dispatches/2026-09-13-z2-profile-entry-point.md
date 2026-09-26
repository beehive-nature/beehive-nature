# z2.profile BUILD RECEIPT — the five-rail capability entry point + vending payment-copy truth · 2026-09-13

**Order:** build the profile capability entry point from the accepted vending map ([#10 c5650107791](https://github.com/beehive-nature/beehive-nature/issues/10#issuecomment-5650107791) + this session). **Seat:** z2.profile. **Branch:** `zcode/z2-profile-entry-point-2026-09-13`, **stacked on PR #70's branch** (the band and registers land there first); **DRAFT PR only** — not for merge until #70 settles.

## what landed

**Both profile surfaces — five separate capability cards, five rails, no collapse:**
1. **.b** (live) — unchanged from #70: in-page registry checker on the dynasty, address-book resolution on the holder.
2. **.a** (live) — now carries the vending deep-link with the boundary verbatim: "mint an agent on the .a rail ↗ — jungle4 rehearsal today: **testnet money, real law rows**." (relative links: `vending.html` / `../vending.html`; canonical URL `https://skaists.dev/surfaces/vending.html`; same-host links ride the session tab per the estate external-link law).
3. **Silent Payments** (coming soon) — unchanged and display-only by construction: no keys, no scanning, no signing, no balances, no payment claims; asserted by test (P4: no balance/received/confirmed words in the card; D3/H1c: no address-shaped string, no QR, nothing interactive; exactly one coming-soon card per surface).
4. **ERC20i** (new card) — dynasty links the holder wall (`blight/profile.html`); holder card points at the wall below on the same page. JEDI law rides in the cypherpunk register: "the profile reads; the market sells; never the twain."
5. **bnr://** (new card) — links the resolver prefilled: `../r/index.html?u=bnr%3A%2F%2Fskaists.dev` (resolves to `/r/index.html` from both surfaces — asserted). "this card links the resolver; it registers nothing."

Band intros rewritten in all three registers for five rails; register law holds — prose and density change, numbers never.

**vending.html — payment copy corrected to the truth map** (the z2.sec finding, now fixed at source):
- Step-2 note: "Pay with your card, PayPal, or any wallet — one tap" **replaced** with: rehearsal free today (testnet A, memo-bound); **USDC on Base and PYUSD on its official chains are HELD** until the founder names the machine's payment seat; **"Card and PayPal are not available"** — no card processor wired, nothing touches a PayPal account (PYUSD is PayPal-issued but rides its own chains).
- Plan-screen rail labels: "USDC · Base — **held** until the founder names the seat" · "PYUSD — **held** until the founder names the seat"; PYUSD description now says plainly "Not a PayPal checkout: the stablecoin, not the account." PYUSD-not-on-Base truth retained verbatim.

## verification (local, this seat)

- `node e2e/profile-caps.mjs` → **54 passed, 0 failed** (was 30): +12 new — V1a–V2b vending copy truths (not-available wording present, old line gone, both rails held at the label), V3 vending @390 clean, P1–P5 both surfaces (five cards, exactly one soon card, vending deep-link href + boundary verbatim, resolver path, ERC20i/JEDI, SP never-claims, zero page errors). One test-harness lesson banked: register-gated copy must be asserted via `textContent` — `innerText` hides non-active registers (caught by the JEDI-law check failing under default bee).
- `node scripts/estate-check.mjs` → PASS (93, unchanged) · `node e2e/estate-source.mjs` → PASS · `node e2e/university-smoke.mjs` → **78/78**.
- 390px overflow probe: dynasty, holder, vending — all clean; 10 screenshots in `e2e/shots-profile-caps/` (six register shots from #70 re-taken + vending 390/1440).
- cargo/shell CI untouched (content-only edits).

## carried

- PR #70 must settle first (this PR is stacked on its branch and shows only the delta).
- The vending paid rails remain held on the founder PAY_SEAT ceremony — copy now says so everywhere a price is shown.
- SP configured-state (artist-pasted `sp1q…`) stays parked behind the blueprint's acceptance contract.
