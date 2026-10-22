# 2026-10-02 — zBlood PR #296 review repair (two rounds) + evidence stack PR #298 + wallet flake diagnosis

Founder order (verified against live Git/GitHub, two corrections accepted):
the three bGenealogy evidence receipts were never a stack (siblings/off-stack:
`3c33cb77d` on `0a75283b1`; `b4faf7a01` and `f92181a5f` both on `53116c460`),
and PR #296 was not ready to merge (findings + CI). Safe sequence executed:
fix findings → CI → reconstruct the stack → Edition v2 questions held at the
approval gate.

## Round 1 @09d0a237a — the five findings on the terminal-state head

1. **P1 atomic lock acquisition** — exclusive O_EXCL create for fresh claims;
   holder refresh = atomic replace + re-read verification; takeover with
   `previousWriter` audit.
2. **P1 outcome ALLOWLIST** — `checkpointState` accepts ONLY `xml-NNN(-all)`;
   `'downloaded'` must arrive via `checkpointDownload`; unknown states
   rejected (allowlist, not denylist).
3. **P1 ark↔apid binding verified at save** — `checkpointDownload` requires
   binding evidence `{url, response}`; the guard reconstructs the das/v2
   binding URL from the ark and requires the response to normalize to the
   entry apid (bare-apid gotcha honored). A neighboring filmstrip apid can
   no longer pass; persisted rows carry `binding` + `ark-bound` attestation.
4. **P2 atomic manifest/lock writes** — every save goes through
   temp+rename replace (crash leaves old-or-new, never truncated).
5. **P2 retry logs assert queue membership** — `recordObservation` /
   `recordWalkerFailure` reject out-of-queue AND already-resolved arks.

`sweep-walker.mjs` (private tier) passes the binding evidence. Suite 438/438.

## Round 2 @dc0c91192 — the five findings of the re-review of 09d0a237a

1. **P1 takeover race FIXED (conditional takeover)** — the stale-takeover
   path now RENAMES the lock into a quarantine name (atomic; exactly one of
   N contenders can win the rename), inspects the quarantined content, and
   RESTORES-and-refuses if it stole a FRESH claim (the reviewer's unlink
   race — a contender deleting a fresh claimant's lock — is closed). Tests
   prove refusals leave the holder's lock byte-unchanged and takeovers
   leave zero quarantine/temp residue.
2. **P2 outcome finality FIXED** — `saveEntry` rejects any save for an ark
   already in `manifest.images`: a late `xml-403` can no longer erase a
   download's apid/sha256/binding (the reviewer's exact scenario, tested
   both as late-negative and late-duplicate-download).
3. **P1 superseded pkg3 spend path DEAD BY CODE** — `preserve-service.mjs`
   v2.0 is EDITION-GATED: it consumes `ETERNALIZATION-EDITION-V2.json` and
   refuses every quote/upload while the gate is absent, unreadable, or not
   `APPROVED` (fail-closed). When approved, it binds the GATE's own
   `tarSha256` (resolved by hashing the candidate tars — the approved bytes
   or nothing) and the gate's separated ceilings; the hardcoded
   September hash + 3.2 ANT bound are gone. 4 tests
   (`preserve-service.test.mjs`), service import-safe (no port bind).
4. **P2 retry-log membership — already addressed** in round 1
   (`assertQueueMember` at both retry-log entry points, incl.
   already-resolved rejection); the re-review re-flagged the pre-fix text.
5. **P1 records.json `evidence[].value` privacy — ESCALATED, not
   unilaterally changed.** That file is the #244-merged PUBLIC layer that
   passed the merge-time privacy battery (living-name redaction armed,
   5 names, 0 hits). Whether transcription values belong in the ANT
   edition is precisely the pkg4 approval question standing before the
   founder. If the founder rules them out: remove
   `sources/records.json` from `preserve.mjs`'s declared evidence (one
   line) and rebuild the edition — the gate re-binds the new hash.

Suite 444/444 at this commit (walker-guard 20/20, preserve-service 4/4).

## PR #298 — the evidence receipts as a real stack

`zcode/bgenealogy-evidence-stack` (worktree `wt-zcode-evstack`), three
commits on current main, each dispatch byte-identical to its original blob
(verified post-commit), messages verbatim + a RECONSTRUCTION NOTE naming
the original sha and parent. Narrative order: spine sub-trunk audit →
corrective v1 → corrective v2. CI settled green (the wallet flake passed on
retry — below). Open blockers unchanged (R2.1 A/B; CP d.s.p. scope read;
Earl's Colne search).

## Wallet CI flake — diagnosed, wallet seat's battery

`e2e/wallet-arweave.mjs:285`, section E (inject publish): the `#arw-go`
button never becomes enabled; the 30s click timeout throws an uncaught
exception that kills the script mid-battery (bee register) — no summary
printed, `|| rc=1` fails the step. Fired 3× across 5 runs tonight (both
#296 runs, one #298 run) while the identical code passed on
main @5fbf436ac and on #298's second run — nondeterministic timing flake.
NEXT OWNER: the wallet seat (await the enabled state / settle before the
click). No genealogy-diff involvement is possible (markdown + guard +
summary only).

## Standing decisions left to the founder

- Merge order/authorization for #298 and #296 (both pended CI green;
  merges held for founder word per the merge-field law).
- pkg4 approval (or rebuild after the records.json privacy ruling and/or
  after the merges change `docs/` content — the bundle includes docs/).
  pkg4's hash does NOT cover `tools/` (bundle = assets/docs/surfaces
  only), so the guard fixes never touched it.
- No spend anywhere: the gate is fail-closed and AWAITING FOUNDER
  APPROVAL.
