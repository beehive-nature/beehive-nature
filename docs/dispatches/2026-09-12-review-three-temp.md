# Royal Review three-temperature adapter — 2026-09-12

Seat: Grok / Cursor cloud agent. Lane: adapter #5 after bEarth #45,
Symposium #46, Hexagon #47, and bLongevity #48. Branch:
`cursor/review-three-temp-beca`.

David Irvine / x0x #622 is still the standing backend priority. This
seat was assigned the Royal Review presentation adapter; no backend,
mesh, or measurement claim is made here. Attestation, never telemetry.
No medical advice.

## What changed

Same attestation instrument: tally rails (Nostr + Bluesky), passkey /
guest bind, compose receipt (≤140), guard Ed25519 verify, bLOVErAi /
WebLLM wake, TASK 6b honesty (in-page publish is not pretended wired).
First paint is what changed. Recovery phrases never enter the page.
Guest unsigned receipts stay marked unverified. Nothing observes a
visitor.

## Visual QA poke

`http://127.0.0.1:8765/review.html` with `surfaces/` as the server
root — the same poke that 404s `/surfaces/register.js`.

Cure, copied from #45 / #46 / #47 / #48:

- `tour.js` sibling riders (`register.js`, `lang.js`, `rails-badge.js`)
  resolve from `document.currentScript.src`. Tour-bar hrefs still use `R`.
- Page-owned `#bregbar` with `data-register-host` and `data-language-host`
  so `#bregctl` and `#blangctl` paint on first-paint chrome.
- Inline `[data-reg]:not(body){display:none}` plus the matching revert,
  so the cypher masthead (attestation / telemetry / observes) cannot
  FOUC onto New bee if register is late or 404s.

## Graded first paints (Chief PASS + two trims, implemented as written)

- **New bee:** calm sentence (“A review is a signed receipt you choose
  to publish — nothing on this page watches you.”), takeaway lead
  (“Only what you choose to publish shows in the tally.”), product
  support (“One page you visited. One mark: works, idea, bug, or gap.
  Only if you publish.”), quieter walker line (“nothing here watches a
  silent walker.”). The walker line does not twin the calm’s
  attestation / telemetry wording. Choice: **Leave a receipt**. **Go
  deeper**. ZERO rails idle dashboard, passkey wall, verify panel,
  WebLLM wake. A receipt is a short signed note about one surface you
  walked (≤140). Marks are works · idea · bug · gap only — not stars,
  scores, or browse telemetry. A silent walker stays invisible.
- After **Leave a receipt:** one calm compose beat — four human-word
  marks first, surface picker second, then the ≤140 note. Passkey bind
  / rails dashboard / Ed25519 verify / WebLLM wake stay deepen or
  Cypherpunk — not the same first gift beat.
- **Raver:** soft crown / receipt glow — keep/share energy, not a
  control room; reduced-motion = one frame. Feeling: “What if a review
  were a gift you signed, not a trail you left?” Tap: **Offer a
  receipt**. Consciousness (“A walker who publishes nothing appears
  nowhere — that is the design.”) is layer 2 only, then the New bee
  takeaway stack.
- **Cypherpunk:** today’s full instrument on contact — tally rails,
  passkey / guest bind, compose, guard verify, bLOVErAi / WebLLM, TASK
  6b honesty, cite-or-silent. Sources use `data-view-disclosure` and
  default open in this view. FOUNDER LOCK (privacy-maximalist target):
  this view is never a trimmed New bee twin. Compose-beat CSS is
  scoped `body:not([data-reg="cypherpunk"])`. Switching into
  Cypherpunk, and any Leave-a-receipt click while already there,
  force `data-review-beat="deeper"` so tally / bind / guard / AI /
  sources cannot be stripped.

Footer keyed leaves (`review.foot.attest`, `review.foot.learn`,
`law.hive`) stay laid out so the first-paint floor of 6 does not drop.
Cypher masthead clauses ride `data-reg="cypherpunk"`.

## Language

Fourteen `review.*` keys were machine-drafted across English plus the 28
docked tongues and marked ⚙. `receipt` means a signed published review.
`tally` is the published count. `walker` is one who walks pages and may
publish nothing. Meaning review is still owed. Existing `h.165`–`h.169`
headings stay on the instrument.

## Verification named here

- `node --test e2e/review-views.test.mjs` 8/8
- `node --test e2e/register.test.mjs` 15/15
- `node scripts/estate-check.mjs` PASS
- `node e2e/estate-source.mjs` 11/11
- `node e2e/university-smoke.mjs` 78/78 (review deck `#surf` roster still
  populates; instrument checks enter via **Go deeper** / Cypherpunk)
- `node e2e/i18n-coverage.mjs` on review.html ru --floors: live census
  **11 keyed / floor 6** PASS (100% keyed, 28 tongues filled)
- live 8765 poke 59/59 PASS (Chrome, localStorage cleared, 1280×800),
  including four-mark first paint, compose marks-above-surface, and
  FOUNDER LOCK: Cypherpunk hides `#mark-words`, keeps the verdict
  select, and still shows tally / bind / guard / AI / sources

Skipped this beat: fleet attestation of the new keys, wiring TASK 6b
in-page publish, any David Irvine / x0x #622 measurement claim, any
medical-advice rewrite (the page is not a treatment instrument).

FOUNDER LOCK applied before marking the PR ready: Cypherpunk first
paint stays the complete attestation instrument. The compose-beat
progressive door is New bee / Raver only.
