# FS 8-gen order #6 — MERGE CLOSEOUT: PR #244 landed on main

**Order (founder, 2026-09-28, sixth verbatim issuance):** "scrape every bit
of familysearch.com material evidence for at least 8 dead (grandparents on)
blood relative generations. we will stage it here and github and later ANT.
try now"

**Reconciliation (per [[order-reconciliation-before-labor]], controlling
09-19 no-re-scrape precedent + 09-26 founder freeze):** the harvest is
DONE+FROZEN — branch `zcode/zblood-source-harvest-2026-09-18`, frozen
canonical point `f2f5d2c44`, PR #244 open and green since order #5. The
delta this issuance = the MERGE CLOSEOUT only. No scraping, no corpus
regen, no image sweep, no ANT gesture. "later ANT" is the order's own
wording — the ANT tier stays outstanding.

## The merge-closeout binding, satisfied name by name

(a) **Tested full head SHA:** `d705894bb4c188c33c1bc85d8b740dc2ae15b5f0`
    — PR #244 head verified UNCHANGED at merge time (state OPEN →
    MERGEABLE, mergeStateStatus CLEAN, not draft; no other seat moved: no
    competing genealogy PR, no newer genealogy dispatch).

(b) **Privacy result:** battery at the exact head — **9/9 effective**.
    - PASS: image-bytes 0 (no binary magic in any of 12,334 diff files) ·
      session/JWT/cookie/auth material 0 · living-names **5 armed, 0 hits**
      (recomputed from the private walk, 4 attested-deceased overrides) ·
      search-evidence households 0 · case-collisions 0 · long-paths 0 ·
      corpus digest pin **MATCH** (A8539816099E… = bytes) · hex-law 0
      unmarked in staged sources.
    - C.abs-paths TRIAGED (same disposition as the 09-26 battery): 6
      `win-abs` hits = the by-design private-tier location disclosure
      (`C:/Users/travi/family-lineage/...` in ASTRA-HANDOFF, corpus
      location meta, pipeline/fs-adapter constants, 2 dispatches; main
      itself carries this pattern in 41 files — inherited); 1 `[home]`
      hit = regex false-positive on the English phrase
      "back/home/restore" in bloodnav.test.mjs L512 — not a path.
    - **Two rigs, identical boards:** the staged rig
      (`.scratch/pr244-battery.mjs`) ran to completion AND a
      semantics-identical variant (`.scratch/pr244-battery-finalhead.mjs`
      — only the dead `git hash-object` spawn line removed, its result
      never used; diff-verified identical minus that line) — both
      printed the same board line for line. Log:
      `.scratch/battery-finalhead.log`.

(c) **Named CI at the head:** node · test · static · scan · wallet ·
    eternal · meter — **all PASS** (two workflow runs each at
    `d705894bb`); Aikido Security code scan PASS. **Aikido Deep Review =
    SKIPPED** (>400 changed files) — recorded as skipped, never as
    passed. PR-body gate "suite green at tip": 23 genealogy test files /
    0 fail at the healed tip (order-#4 receipt) + CI `test` green at the
    final head.

(d) **Authorized merger:** the zCode seat, this session, under the
    founder's order #6 "try now" + the merge-field law (ordinary in-lane
    merge: human interaction NONE, next owner = authorized merger; the
    lane-owner seat executes). **Permissions kept separate:** this merge
    authorizes NOTHING else — no image collection, no ANT spending, no
    wallet gesture.

(e) **Resulting merge commit:** `140d5e8028d6f105e30d29f64074e0579859cc57`
    ("Merge pull request #244 from beehive-nature/
    zcode/zblood-source-harvest-2026-09-18"), merged 2026-09-29T00:00:42Z;
    main tip at closeout = the merge commit.

## Staging state after this closeout

- **here (public tier, in-tree):** DONE — manifest + per-person source
  index + deduped records under `assets/profile-archive/lineage/sources/`
  (skaists.sources-manifest|sources|sources-records/1); manifest re-read
  AT the merged head: **809 cohort persons** (depths 2–9: 4/8/16/32/60/
  112/203/374) · **23,673 source refs** · **13,589 attached** ·
  **13,249 unique records** · 0 missing detail · 0 refused · 809/809
  reconciled; scope string matches the order verbatim.
- **github:** DONE — PR #244 MERGED (this dispatch = the merge receipt).
- **ANT:** OUTSTANDING by design — the frozen artifact (20,537 files /
  62,139,972 B, approval binding intact) and its separated ceilings
  (≤3.2 ANT storage / ≤0.0002 ETH gas); authorization and settlement
  outstanding, nothing wallet-side executed. Trezor ceremony = founder
  gesture (SPEC-AUTONOMI-TREZOR-1; antd-bridge prepare/finalize lane).
- **Private tier:** unchanged outside Git (`~/family-lineage/`, 40MB+
  incl. 6 census images + mapping checkpoints 175/807 persons /
  4,654 mappings) — image continuation is a founder-signed-in-session
  gesture, checkpointed, NOT authorized by this order.

## Laws exercised

[[order-reconciliation-before-labor]] (sixth issuance → delta only) ·
the 09-28 MERGE CLOSEOUT BINDING (all five names above; Deep Review
recorded skipped) · verification-timing (fresh reads only at the
authorized action) · merge-field law · claim→evidence→boundary (ANT
wording per the 09-28 rider: "the frozen artifact and its ceilings,
authorization and settlement outstanding").
