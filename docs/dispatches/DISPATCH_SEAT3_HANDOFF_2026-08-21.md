# DISPATCH — Seat 3 → zCode (LEAD) · handoff, 2026-08-21

Founder pushing usage ceiling; Seat 3 handing the load. All state below is disk-verified,
not session-recalled. Three threads open. Nothing here needs Seat 3 to re-derive.

---

## THREAD A · BuzzForge (freqlab pattern, sound + visual creation forge)

**State:** GO approved, **PF-1 RULED (CLAP-default)**. Spec drafted by Seat 3 as first lap
(cadence: spec before code): `docs/specs/SPEC-BUZZFORGE-1.md`. Work order + obstacle table:
`docs/dispatches/WORKORDER_FREQLAB_PLUGINFORGE_2026-08-21.md`. Ledger candidate recorded:
`docs/ledger/pirate-haul-candidates.md` (2026-08-21 FREQLAB entry, Remotion-class, LEAVE-code/TAKE-pattern).

**Licenses already L-VERIFIED (raw, 2026-08-21 — SHA-pinning still owed):** nih-plug **ISC**;
its VST3 bindings (RustAudio/vst3-sys) **GPLv3** (per nih-plug README §Licensing); CLAP
(free-audio/clap) **MIT**. Receipts quoted verbatim in SPEC-BUZZFORGE-1 §3.

**zCode next (as LEAD):** refine/ratify SPEC-BUZZFORGE-1 — it's yours to own, not to start
cold. Then open gates **BF-1** (build lap) and **BF-2** (visual-render dep choice + its
L-VERIFY; Seat-3 rec: platform Canvas/SVG, no license question). Keep §3b artist-first
(freedom/guidance/learning/fork) and §5 DSP safety wrapper load-bearing — founder's core ask.

## THREAD B · ANT/ETH split receipt (your dispatch — verified, held)

**State:** commit `5771781` on branch `zcode/ant-eth-split`, file
`docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md`. **Seat 3 gate-verified:**
applies clean vs main, touches exactly one file (+103/−0), scope fence held, arithmetic
re-checked independently and consistent (55/45 @1MB → 96/4 @1TB). tx-hash rows carry
`PUBLIC-CONSTANT`. **Push is on Seat-3 hold pending founder word.** `origin/main` has since
advanced (…→`070b142`, PLUR mUseUm); patch is conflict-free by construction, pull-before-`am`
covers it.

**zCode next:** none required — this is Seat-3's to `git am` + push on the founder's go.

## THREAD C · Doc-correction pass (founder-gated, NOT yet done)

Named in receipt; **no edits applied** (measure-and-report only). On founder word:
- `docs/storage-substrate-split.md` — stale: $0.25/batch → $0.040; $0.000122/chunk → ~$0.0035;
  batch width "undocumented" → **256**; §3 "$39M gas/yr" → **~$158K**.
- `surfaces/bantfarm.html:117` — "a little ETH for gas": correct at archive scale (gas ~4%),
  wrong only for <~50 MB (gas 38–49%). Founder decides whether to clause it. Line 126 is fine.
- **False-signal fix (k001):** the "64" in our tree is the Merkle *threshold*, not the batch
  *width* (256). Correct wherever it misreads.

**zCode next (on founder word):** execute the correction pass as one scoped spec/patch;
Seat 3 gates + pushes.

## OUTWARD-FACING — needs founder, not a seat

Corrected Discord reply is drafted and numbers-endorsed (supersedes Seat 3's earlier draft,
which under-weighted ANT at scale). Founder posts it. Do not auto-send.

---

**Attestation:** no machine-seat `Signed-off-by`; zCode credited `Co-authored-by` on its own
commit; Seat 3 appends the founder trailer only on a King-Bee-gated merge. Seat 3 stepping
back to conserve founder usage. 🐝
