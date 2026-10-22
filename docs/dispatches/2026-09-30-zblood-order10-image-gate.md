# zBlood order #10 — reconciliation + image-gate probe (pane rebuilt again, signed-out, staged for one gesture)

Date: 2026-09-30. Order issued verbatim for the tenth time:
"scrape every bit of familysearch.com material evidence for at least 8 dead
(grandparents on) blood relative generations. we will stage it here and github
and later ANT."

Per [[order-reconciliation-before-labor]] (receipts → verify tip → name delta
→ execute delta only), this wake reconciled and probed; **zero new image
bytes, zero new record outcomes, no state changed** — the executable delta is
blocked by access ONLY, and the pane is staged so the unblock costs one
founder gesture.

## 1. Reconciliation (all verified fresh this wake)

- **Harvest: complete, frozen, merged, untouched.** PR #244 merge commit
  140d5e802 verified an ANCESTOR of origin/main tonight. Standing counts: 809
  deceased persons depth 2–9 · 23,673 entity refs · 13,589 attached source
  refs · 13,249 unique records · 0 errors · 0 missing. No seventh scrape
  (founder ruling 2026-09-28).
- **Image queue (manifest-true, read via the guard's own loaders
  `loadState()`/`nextPending()`, never prose):** 113 downloaded /
  27,193,559 bytes (25.93MB) · recorded outcomes 162 = 113 downloaded +
  36 xml-403 + 6 xml-403-all + 7 no-deepzoom-traffic · queue = 366 arks /
  399 mapped records · in-queue resolved 155 ⇒ **211 remaining**. Resume
  position 156; first pending arks read from `nextPending()` (never memory):
  3QSQ-G99B-JQCX (minDepth 8), then 3QSQ-G9DL-X9W5-S, 3QSQ-G9Z8-W79C.
- **Lane branch:** zcode/imgqueue-owner @585e8801b, working tree clean,
  local == origin (verified).
- **Staging:** here (public tier in-tree) + github (main) true. Public
  summary current at 113 entries — nothing to regenerate with no new bytes.
- **ANT:** untouched (deferred per the frozen-edition plan; authorization and
  settlement outstanding; ceilings ≤3.2 ANT / ≤0.0002 ETH).

## 2. The gate: pane died with the process again, oracle says SIGNED OUT

- The 09-29i staged login tab did **not** survive the process restart
  (controlled and user tab lists both empty at wake) — second consecutive
  confirmation of the receipted law: tabs die with the ZCode process, the
  founder's in-pane FS session dies with them, and every new session
  re-probes the oracle before anything else.
- Fresh tab created; SESSION-ORACLE executed per the fs-adapter law:
  navigated the viewer URL for the first pending ark
  (`/ark:/61903/3:1:3QSQ-G99B-JQCX`) → bounced to
  `ident.familysearch.org/en/identity/login/` and STAYED at +4s and +8s =
  **signed out** (signed-in bounces through ident back to the viewer; the
  oracle cannot false-positive).
- Poll window: ~5 minutes (5 rounds × ~60s) watching the login tab's URL —
  no sign-in during the window at report time.

## 3. What is staged (the single founder gesture)

The IAB pane is open with ONE tab sitting ON the FamilySearch sign-in form,
its state parameter carrying the bounce-back to the first pending viewer; the
browser session is named **"FamilySearch — image queue — KEEP"**.

**The one gesture: sign in to familysearch.org inside that pane.** The moment
auth lands, the seat resumes the guarded sweep from queue position 156 with
NO repeated try-now, NO renewed permission ceremony, NO re-audit of the
standing 113, and NO harvest restart (standing disposition 2026-09-28, founder
readback on order #7). Walker failures stay retryable via the guard's
side-log; arks come only from `nextPending()`; every download lands with a
binding-verified apid + sha256.

## 4. Board

| Item | State |
|---|---|
| 8-gen evidence harvest | FROZEN + MERGED (PR #244 @140d5e802, ancestor of origin/main — verified tonight) |
| Image queue | 155/366 resolved · 113 downloaded / 25.93MB · 211 remaining · resume @156 |
| Gate | FS session SIGNED OUT in the rebuilt pane — access block only |
| Pane | Staged on the login form, session "FamilySearch — image queue — KEEP" |
| ANT | deferred (frozen artifact + ceilings; authorization/settlement outstanding) |
| This wake's writes | This dispatch only — no repo/state/byte changes |
