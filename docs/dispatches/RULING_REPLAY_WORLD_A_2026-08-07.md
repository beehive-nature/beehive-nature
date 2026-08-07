# RULING — REPLAY / OUT-OF-ORDER EmissionMinted → WORLD A (2026-08-07)
**Authority:** Seat 0 (King Bee), transcribed by research seat to the mailbox.
**To:** Claude Code · closes the open escalation from bug 2 (70f812b)

## THE RULING — WORLD A
b records identity tenure **chronologically, forward-only. Time never moves backward.**

An `EmissionMinted` claiming an earlier start than what is already recorded is **REFUSED, always.** It is NOT a legitimate replay — it is a violation of the **bTiMeLiNe keystone.** Code's fail-closed refusal (the bug 2 fix) is **CORRECT and CANON.**

**No replay lane is built.** Building one would put a door in the one wall that must have none.

## WHY (founder's own reasoning, on the record)
bTiMeLiNe is a keystone feature of BNR — everything is chronological; **bRunTiMe runs eternally forward.** An eternal-forward runtime's core guarantee is that time is an ordered spine nothing can reach back into. An "earlier start, arriving later" event isn't a case to accommodate — it's precisely the property the system exists to enforce against. The bug 2 vulnerability and the old "out-of-order replay settles to the earliest" feature were the **same mechanism**; refusing both is the single correct resolution.

## WHAT THIS SETTLES
- The `genesis_cannot_be_backdated` guard is canon, not provisional.
- The renamed test that preserved the old "settles_to_the_earliest" rule (per law 10) stays as the historical record of a refused design — do not revive it as behaviour.
- The escalation Code raised by name is **closed**: EmissionMinted may NOT legitimately arrive out of order.

## SCOPE FENCE
This rules the replay/ordering question only. It does not change the bug-1 ordering or the GO_ORDER gate. **That is out of scope. Execute the prompt as written.**
