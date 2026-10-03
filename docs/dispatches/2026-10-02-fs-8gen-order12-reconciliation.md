# Order #12 — the 8-gen evidence order, verbatim re-issue; reconciled to a terminal-stage wake

**Date:** 2026-10-02 · **Seat:** zCode (bGenealogy/zBlood) · **Order (verbatim):**
"scrape every bit of familysearch.com material evidence for at least 8 dead (grandparents on)
blood relative generations. we will stage it here and github and later ANT."

**Standing law applied** (banked wave 27, ratified every wake since): a verbatim re-issue of an
already-executed order = verify-fresh + complete any missing staging step + name the unlock
gestures. NEVER re-scrape.

---

## Reconciliation (all verified fresh this session, not inherited)

| Order leg | State | Evidence |
|---|---|---|
| **Scrape** — every bit of FS material evidence, 8+ dead grandparent generations | **DONE, FROZEN, MERGED** | 809 deceased persons depths 2–9 (4/8/16/32/60/112/203/374); 23,673 entity refs · 13,589 attached · 13,249 unique records · 0 missing · 0 refused; harvest merge `140d5e802` verified an ANCESTOR of origin/main today. Founder ruling stands: no seventh scrape. |
| **Stage here** | **DONE** | Public tier in-tree: sources manifest/index/records (iid-keyed), image evidence summary (counts+sha256+ark pointers, bytes private-tier), relationship-audit v1 (935 edges graded), evidence packs, 10K+ staged person objects. Private tier at `C:/Users/travi/family-lineage/` (raw dump + 307 record images / 83,088,795 B, byte-audited 0 mismatches). |
| **Stage github** | **DONE — main tip green** | PRs #244 (harvest corpus), #296 (image archive + guarded eternalization; MERGED 2026-10-02T05:09Z), #298 (evidence stack as real descendant commits; MERGED 04:24Z), #303 (corrected edition v2 + capability stop; MERGED 10:09Z). Main tip `5ef4472ab`: all 10 CI checks SUCCESS (deploy/build/static/test/meter/eternal/node/wallet/scan/report-build-status). |
| **Later ANT** | **Correctly staged + code-stopped, no spend** | `ETERNALIZATION-EDITION-V2.json` on main: 22,108 files / 86,331,542 declared B, manifest `d8f78218…`, reproducible tar 106,833,920 B (`34511423…`), privacy projection 13,249 records / 49,342 evidence descriptors / **0 raw evidence values**; 307 images excluded from the bundle (counts/digests/pointers only). Live quote (ant 0.3.9, keyless): **2.825569772 ANT storage + 0.00015 ETH gas — EXCEEDS the 2.5 ANT storage ceiling**; and the client cannot apply both ceilings atomically → gate `QUOTE EXCEEDS CEILING + PAYMENT CLIENT CAPABILITY REQUIRED`. Upload endpoint code-disabled; a ledger edit cannot re-enable payment. No wallet touched. |
| **Image queue** | **Terminal, 364/366 (99.5%)** | Manifest-true via `walker-guard.mjs::loadState/nextPending()` from the imgqueue worktree: 307 downloaded / 83,088,795 B; 64 explicit denials in-queue (58 xml-403 + 6 xml-403-all); **2 pending**: `3QS7-89WB` (nextPending #1) and `3QSQ-G983` — persistent binding-400, retryable-observation class, never outcomes. |

## This wake's one live action — the session gate (image work standing-authorized)

- Pane mortality confirmed a 4th time: both tab lists empty on a fresh process (tabs die with the
  ZCode process; the founder's in-pane FS session died with them).
- **SESSION ORACLE** on the first pending viewer ark (`…/ark:/61903/3:1:3QS7-89WB`): bounced to
  `ident.familysearch.org` login form and STAYED at +4s/+8s → **SIGNED OUT** (cookie presence was
  never evidence; the oracle is the law).
- Login pane STAGED: one tab parked ON the login form, its `state` param carries the bounce-back to
  the first pending viewer ark; browser session named **"FamilySearch — image queue — KEEP"**.
- ~5-minute sign-in poll (4 rounds): negative — no sign-in during the window.

## Residue named (not touched — shared checkout, untracked)

`docs/dispatches/2026-09-27-bgenealogy-{mvb-corrective,mvb-corrective-v2,spine-subtrunk-audit}.md`
exist untracked in the shared checkout. Main's landed versions (via PR #298) are the canon:
`mvb-corrective.md` byte-identical (CR-only diff); `mvb-corrective-v2.md` and
`spine-subtrunk-audit.md` are **stale pre-correction drafts** (main carries the harder corrected
verdicts: g18→g19 and g20→g21 re-graded X-class chronology/identity contradictions; mixed tally
labels unflattened; the untracked drafts predate those corrections). Superseded residue — left in
place per the shared-checkout law, named here for a future tidy decision.

## Unlock gestures (unchanged in shape, one per lane)

1. **Image frontier (2/366):** founder signs in inside the staged pane → guarded file-walker
   retries `3QS7-89WB` + `3QSQ-G983` under writer-lock takeover (current lock heartbeat stale
   since 2026-10-02T01:04Z), no ceremony, no re-audit. If they 400 again they stay pending —
   retryable, never outcomes.
2. **ANT (later, per the order):** payment-client capability that enforces both ceilings
   atomically + a quote back inside ≤2.5 ANT / ≤0.0002 ETH (live pricing moves; re-quote on any
   artifact/client change) + founder approval of the successor exact hash and bounds. Until then
   the spend path stays code-disabled.

## Claim boundaries

- No scrape, no new harvest, no corpus mutation, no manifest write, no lock acquisition, no
  wallet/payment/upload — this wake was read-only on every tier plus the staged pane and this
  dispatch.
- Counts quoted are manifest/queue-derived (script-reconciled), not prose arithmetic.
- The 09-26 privacy battery remains a historical baseline for a superseded head; the merge-gate
  form of that verification was executed at the exact merged heads per the closeout binding
  (receipts in the #296/#298/#303 PR threads).

**Dispatch:** this file. **Worktree:** wt-zcode-zblood, branch `zcode/dispatch-8gen-order12`.

---

## Addendum 2026-10-03 ~00:35–00:57Z — founder signed in; frontier arks retried authed; binding-400 persists

The founder signed in inside the staged pane ("you logged in"): the tab bounced ident → the
3QS7-89WB viewer = **AUTHED** (oracle law satisfied). Standing disposition applied — no ceremony,
no re-audit, guarded file walker from disk.

- **One-writer stand-down first:** my initial sweep was REFUSED at lock acquisition —
  imgqueue-owner/GLM-session had refreshed a heartbeat at 00:34:49Z (fresh). Per the coordination
  protocol I stood down read-only and polled; the holder never refreshed again (its single
  refresh remains its only write — manifest byte-unchanged across the window; observed, not
  inferred). At 10-min staleness I took the conditional takeover.
- **claimId law exercised (honest gotcha):** the #296/#298 hardening binds each acquisition to a
  process-local claim — my first sweep cell's kernel died holding the claim, so the follow-on
  kernel was refused against MY OWN lock until the 10-minute staleness elapsed; the run then
  completed as takeover → sweep → control → release inside ONE kernel.
- **Both frontier arks retried under auth, same verdict:** `3QS7-89WB` (attempts at 00:45 and
  00:56; 17 lifetime observations) and `3QSQ-G983` (00:56; 8 lifetime observations) —
  **binding-400 persists on both**. Control ark `33S7-9GY8-1XT` (a known-downloaded record)
  returned **200 on the same binding wire between the 400s** → the endpoint is healthy; the
  rejection is specific to these two short-form arks. They stay **retryable observations, never
  outcomes** (09-29i law). Any future cure likely needs the long/full ark form for these two
  records, not another same-form retry.
- **Terminal state unchanged:** 307 downloaded / 83,088,795 B · 364/366 resolved (99.5%) ·
  2 pending. No downloads this wake. Lock released (verified absent). Zero repo writes beyond
  this addendum.

