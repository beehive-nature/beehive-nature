# zBlood image queue — stand-down, preservation, and handoff (two-writer incident receipt)

Date: 2026-09-30. Founder order to this session: stand down as an image
writer; preserve this session's three downloads and hand off; do not resume
after another quiet window; identify the active walker from local evidence
without stopping it; record unconfirmed ownership if identification fails;
correct the receipt (two claims withdrawn); preserve the exclusive-writer-lock
requirement; no further walker launches, no harvest repeat.

## 1. Preservation (verified at stand-down, re-verified 16:08:36Z)

This session's total footprint on the image lane — exactly three downloads,
one walker batch, then stand-down:

| Ark | Outcome | Verified |
|---|---|---|
| 3QHK-G31H-SNNH | downloaded 1556×2048, 0.18MB | row present · file on disk · sha256 match YES |
| 3QHK-P31H-SJNB | downloaded 1550×2048, 0.17MB | row present · file on disk · sha256 match YES |
| 3QHK-P31H-SJYT | downloaded 1572×2048, 0.19MB | row present · file on disk · sha256 match YES |

All three saved through the guard (queue-member verified, binding apid,
sha256). Last write by this session: 15:57:41Z. Zero writes after the
stand-down order; no walker launched after stand-down; the harvest was never
repeated and will not be.

## 2. WITHDRAWN claims (corrective receipt discipline — withdrawn named withdrawn)

- **WITHDRAWN: "exclusive ownership confirmed by the three-minute quiet
  window."** Quiet timestamps establish only the absence of writes inside the
  observed window — never the absence of a writer. The concurrent writer had
  been dispatched at 15:00:29Z and had already written through 15:41:12Z
  before my quiet window; I mistook an active writer's pause for the writer's
  absence. Exclusivity requires positive mutual exclusion (a lock), never
  inference from silence.
- **WITHDRAWN: "nothing lost through 173 — the guard's read-at-save kept
  every write."** Increasing totals establish only that some writes landed.
  Interleaved read-modify-write cycles on the unlocked manifest can lose
  writes invisibly (a clobbered checkpoint would surface as an orphan .jpg
  with no manifest row, an ark silently reverting to pending, or a lost
  side-log entry). Point-in-time observation at 16:08:36Z: 175 .jpg files ↔
  175 downloaded rows, zero orphans in either direction, and this session's
  three rows byte-verified — consistent with no loss up to that instant, and
  proof of nothing beyond it. The continuing owner's overlap reconciliation
  is the authoritative audit of the overlap window (15:56–16:00Z).

## 3. The active walker — IDENTIFIED (process/session); dispatch provenance UNCONFIRMED

- **Session identity: CONFIRMED** — `sess_83cb52c8-dffd-4b00-9535-85b766ba279e`,
  live at handoff (transcript mtime advancing through 10:12 local; manifest
  writes through 16:14Z). Its transcript tail is saturated with walker
  fingerprints (110× "downloaded", 91× "walker-guard", 24× "sweep-walker",
  24× "nextPending", 34× "images-manifest"). It holds the live writer lock as
  `writerId: imgqueue-owner/GLM-session`. It was NOT stopped, per order.
- **Dispatch provenance: UNCONFIRMED.** The automation registry
  (CronList) shows the daily 09:00 "family search" automation
  (automation-a7a2be3b, enabled, recurring, runCount 10) with
  lastRunAt 2026-09-30T15:00:29Z — exactly the sweep window, and every
  foreign manifest write falls inside its run. BUT the session transcript
  does not contain the automation's order text (0 matches over the full
  file), so the registry correlation does not close the tie; a
  founder-driven interactive session is the alternative. Recorded as
  unconfirmed rather than inferred, per order. Ownership of the lane by that
  session is likewise not asserted by this receipt — its self-identification
  (`imgqueue-owner`) and its lane commits today (c65686ddc guard extension 2,
  854b4aa16 file-walker closeout, 33212fdc9 writer lock) are facts; its
  authority to hold the lane is the founder's to confirm, not mine.

## 4. Exclusive writer lock — REQUIRED, and now CODE

The continuing owner requires an exclusive writer lock before any further
overlapping execution is possible. That requirement is now satisfied in code
by the active session's commit **33212fdc9** (skaists.writer-lock/1:
acquireWriterLock/assertWriterLock/releaseWriterLock over
`images-harvest/.writer-lock.json`, 10-minute heartbeat staleness with
takeover audit trail; every save path — checkpointState, checkpointDownload,
recordWalkerFailure, recordObservation — refuses a writerless save and a
non-holder save; guard suite 13/13, all suites 25/25). The lock is LIVE at
handoff (acquired 16:14:02Z, heartbeat current). Standing rule preserved:
**no walker runs without holding the lock; a session finding a live lock
stands down — this incident is the second concurrent-writer event on this
manifest today and the law is now code-enforced.**

## 5. Board at handoff (manifest-derived, snapshot reads)

- 16:08:36Z — 175 downloaded · 231/366 resolved · 175 .jpg ↔ 175 rows.
- 16:14:13Z — 176 downloaded · 225/366 resolved · first pending
  `3Q9M-C9B2-P3NG-9` (from `nextPending()` — the only lawful resume source;
  remembered positions are void).
- The resolved-count delta (231 → 225) between the snapshots is the
  continuing owner's action during its overlap reconciliation; this session
  did not inspect or interpret it. Its dispatch owns that accounting.
- Harvest: FROZEN + MERGED (PR #244 @140d5e802, ancestor of origin/main);
  no repeat. ANT deferred; ceilings unchanged.

## 6. This session's lane footprint (complete list)

1. Order-#10 gate dispatch (d50786bdb — accurate at its writing; its
   "resume @156" checkpoint is superseded; nextPending() supersedes all
   positions).
2. Three downloads (§1).
3. Zero writes after stand-down; this handoff is the final write.
