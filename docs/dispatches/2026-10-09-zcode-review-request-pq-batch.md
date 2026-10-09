# 2026-10-09 — zCode review request: the PQ proof batch, two pins

From the PQ implementation seat (Seat 3) to the zCode review seat, per the
founder-relayed closeout order of 2026-10-09. Read-only, in your own
worktree; touch no author tree. The review is evidence for the record, not a
permission step.

## The two references

1. **Proof code: `c631108baaccf9504b6105f4fff0bda00588499b`.** The batch
   `2014a067c..c631108ba` (PQ06 ML-DSA NTT, PQ02 Keccak loop and both
   sponges, PQ03 HKDF-Expand). All eight workflows `success` on this exact
   SHA; bTunGsTeN PQ SAW run 37985787272 (jobs `saw`, `saw-ntt`,
   `saw-ntt-dsa`).
2. **Claims and assumption ledger: `7c0fcb9e823cdbc27546b0f8fdeecee04586d954`.**
   `docs/dispatches/2026-10-09-pq-proof-batch-closeout.md` (evidence
   inventory, assumption ledger A1 to A5, classification, execution
   boundary, remaining obligations), and the corrected SPEC-BTUNGSTEN-PQ-1
   and bTunGsTeN README entries. Reading only the first pin misses these
   corrections.

Between the two, the proof scripts differ in two comments only (plus a merge
of main that touches no PQ lane):

    git diff c631108ba 7c0fcb9e8 -- 'scripts/btungsten/pq0*'

shows `pq05-field-check.sh` and `pq05-saw/field-release.saw`, comment lines.

## The task

Assess the corrected claims at pin 2 against the proof code at pin 1.

Priorities, in order:

1. **ML-DSA multiplication and the overflow boundary (A1).** The NTT lane
   assumes `Elem` mul = `dsaMul` on a debug build; the base-field lane ties
   mul for builds with overflow checks off in three links (SAW on the
   overflow-checks-off MIR; z3 over the integers; one argued no-wrap step).
   The debug build's overflow assertion at x - t q is disclosed as open, and
   the bsigner CI exercises (`tests.yml:51`) is a debug build. Is the NTT
   result stated as conditional on that specification everywhere it
   appears, and is the three-link argument sound for the builds it names?
2. **The assumed interfaces (A2 to A5)**: each `mir_unsafe_assume_spec`
   against what discharges it (function, argument shapes, preconditions,
   memory behaviour, arithmetic semantics); the **separately compiled**
   implementations (the loop proofs and the sponges compile the same
   checksum-pinned source in different crates); **backend selection**
   (keccak 0.2.2's soft path on x86_64; sha2's SHA-NI probe as a scope).
3. **Fixed-length scope**: no claim restated beyond its named shapes.
4. **Result classification**: symbolic versus concrete negative controls;
   shake 0.1.0 unproved by this method (not defective, not equivalent);
   timeouts never counted as refutations.

Please distinguish a **reproducible defect** (a command and its unedited
output) from an **accurately disclosed open obligation**. Rerunning the
whole batch only to restate an elementary equality step is not needed;
reproduce a specific step when a finding depends on it.

Out of scope: `hkdf32` (a separate local branch, `pq03-hkdf32-local` at
`01aac1714`, not in this batch); rustls RUSTSEC-2026-0285 (PR #375, its own
owner); the bsigner `CONTRACT.md` freeze (escalated by name in
`2026-10-09-pq-status-verification.md` §4.1; this batch changes no bsigner
surface).

Return: a dispatch with findings, each with its disposition.
