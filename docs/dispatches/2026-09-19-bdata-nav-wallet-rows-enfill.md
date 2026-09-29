# bData follow-through — nav entry + light bar · wallet plain rows · the two English fills closed

**Seat 3 (Claude Code) · 2026-09-19 · follows `2026-09-18-bdata-a-plus-rebuild.md` (its NOT DONE list).**

## What changed

1. **Bottom nav** — `tour.js` gains `['my data','bdata.html']` at the head of the keys group (one list,
   every page). `register.js`: the bar now follows the LIGHT canvas wherever New bee is light
   (`html[data-bee-light="true"]`, i.e. `data-bee-theme` shared/custom) — not only on
   `data-experience` pages. Dark pages (the wallet) keep the dark bar. **Rider pins untouched**
   (`tour.js?v=42`, `register.js?v=10`): the test suite pins them on purpose (a bump failed 12 tests
   and was reverted); Pages' 10-minute cache carries the change.
2. **Wallet bPay panel** — Only me / Selected people are no longer `<button disabled>` with a
   strike-through: they are plain rows (`role=radio aria-disabled`, no pointer) carrying "Not
   available yet", the plain reason and the technical reason — the SAME corpus keys My Data uses
   (`bd.aud.*`), so the two surfaces cannot drift. `bpay-invoice.js?v=3`.
3. **Corpus** — `bd.price.unreachable.allow` and `bd.price.elsewhere` rendered in all 28 tongues
   (56 cells, machine-drafted ⚙, unattested); the `_meta.enfill['bdata-aplus-2026-09-18']` record is
   closed (56 → 0). Edition script: `scripts/tmp/bdata-enfill-close.mjs` (refuses to overwrite a cell
   that is not an English fill).

## Numbers (this box; CI's verdict is the receipt)

Phase B 17/17 (15 → 17: rows-not-buttons, reasons in sight, no disabled buttons) · Phase A 18/18 ·
bData 85/85 · ownership 2/2 · estate-source 11/11 · node test suite 330/0 · i18n floors PASS.

## Boundary

No payment, no signature, no upload. No press on the live page; no request reached :8807.

## Not done (named)

- The wallet panel still has no `storage` listener and keeps its private view picker.
- `estate-source.mjs` still walks HTML only — keys used from JavaScript are invisible to it.
