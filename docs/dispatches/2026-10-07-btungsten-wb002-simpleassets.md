# 2026-10-07 — bTunGsTeN Workbench 002: SimpleAssets as the extinct-infrastructure specimen

zCode seat, branch `zcode/btungsten-wb002-2026-10-07`. Founder order
2026-10-07 (opening this lane): turn SimpleAssets into a legacy
sovereign-state specimen inside bTunGsTeN — preserve upstream untouched
at `e6a042f`, do NOT modernize it, put its state machine through the
standard, attack it, migrate it, replace it, prove ownership/capability
continuity — and extract its best semantics into BNR adapters while
explicitly REJECTING `authorctrl` for sovereign funds ("issuer authority
must not equal confiscation authority").

## Upstream priority check (before lane start, per AGENTS.md)

`gh api notifications` pass at lane start: no dirvine / maidsafe /
autonomi items outstanding. The daily 09:00 automation owns the deep
check; this pass clears the lane-start bar. Main CI at lane start: green
(`4fac40d18`).

## Reconciliation before labor

- SPEC-BTUNGSTEN-1 §workbench (landed 2026-10-06) had reserved "WB002"
  for the hostile distributed leg. The founder's 2026-10-07 order names
  WB002 = the SimpleAssets specimen; that leg is ABSORBED (kill /
  partition / heal / reorg / replay are torture rows of this battery)
  and the Emissary leg stays open under its own future number. The spec
  and README are amended in this commit to say exactly that.
- "Tungsten" naming law respected: bTunGsTeN is the BNR-internal
  umbrella; this workbench instantiates SPEC-BTUNGSTEN-1 axes 1, 3 and 6.

## Upstream claims re-verified first (claim → evidence)

Every upstream fact in the founding brief was re-checked before being
relied on (all receipts in `scripts/btungsten/wb002-specimen/PROVENANCE.md`):

- upstream HEAD IS `e6a042f75256008edf38c73cc55f6499fc306a7a`, dated
  2021-03-17, tagged v1.6.1 — `git clone` + `git log -1` 2026-10-07.
- license LGPL-2.1 — `LICENSE` file + hpp §LICENSE header.
- issues #26 (API-visible ownership mis-assignment), #19 (API metadata
  diverging from table state), #21 (build failures on newer CDT), #6
  (author contract can freeze trading): all four fetched via the GitHub
  API 2026-10-07, all four still OPEN, titles matching the brief's
  failure-class descriptions.
- `authorctrl` issuer-move/issuer-burn enforced at `src/SimpleAssets.cpp`
  lines 692-695 (transferf) and 787 (burnf).

## What landed

1. **The specimen, preserved verbatim** — `scripts/btungsten/wb002-specimen/
   simpleassets-e6a042f/`: all 17 upstream files including the 2021-era
   compiled `build/SimpleAssets/SimpleAssets.wasm` + `.abi` (the epoch's
   deployed-bytecode artifact), nothing removed but `.git/`, nothing
   modified. `PROVENANCE.md` pins the retrieval method, the re-verified
   upstream facts, and sha256 file hashes for the load-bearing files.
2. **The faithful port** — `scripts/btungsten/wb002-simpleassets.mjs`:
   the 2021 state machine (NFT, NTT, FT incl. authorctrl, offer/claim,
   delegation with periods and re-delegation, attach/detach,
   attachf/detachf, changeauthor, author RAM sponsorship), ported with
   SA.cpp line citations, typed refusals, an injectable clock, TWO
   profiles — `specimen` (upstream quirks intact) and `bnr-adapter` (the
   extracted BNR semantics) — plus the WB002-owned surfaces: an anchored
   hash-chained event log with periodic state checkpoints, a
   commitment-anchored export/import migration bundle, and the truth
   lattice (Indexer / SpecimenUI / AdapterUI). Deviations and exclusions
   are named in the file header (port honesty clause).
3. **The battery** — `scripts/btungsten/wb002.test.mjs`, LIVE in CI via
   the existing globbed btungsten step (no tests.yml edit needed this
   lane; the step's non-vacuity guard covers the new suite for free).
4. **Formal twins staged** — `wb002-cryptol/Sovereign.cry`
   (`sovereignContinuity` for ALL states/actions) and
   `wb002-saw/sovereign.saw` — both STAGED/UNVERIFIED, same posture and
   named gaps as WB001's.
5. **Canon amendments** — SPEC-BTUNGSTEN-1 §workbench WB002 entry +
   sequence line; `scripts/btungsten/README.md` WB002 section with the
   artifact table, the findings (F-numbers), the BNR semantic
   extractions, and §next.

## THE KILLER INVARIANT, made executable

> No change of implementation, network, author, storage provider,
> cryptographic algorithm, or execution environment may transfer
> sovereign authority without the currently authorized sovereign action.

Operationalized as the continuity predicate `unexplained()` in the
model: after EVERY action of EVERY history, each asset's sovereign
(defined through delegation records and container structure, not just
row scopes) may change ONLY under the previous sovereign's signature or
their standing signed consent (an offer). The battery drives 600-step
hostile histories on BOTH profiles with the check after every step.

## Receipts (claim → evidence → boundary not crossed)

**CLAIM** the battery is green: 14/14 tests, invariant held.
**EVIDENCE** `node --test scripts/btungsten/wb002.test.mjs`, local run
2026-10-07 (CI's own run is the ratchet source):
adapter history 242 sovereignty-checked steps / 45 wrong-signer probes
refused / unexplained 0; specimen history 24 violations, ALL named
(F-1 issuer moves/burns, author attachf), unnamed 0 — an unnamed
violation class FAILS the battery by construction; wrong-signer matrix
26 rows (specimen) + 27 (adapter) refused by code; F-1 A/B convictions
exercised 3; truth lattice 4 injections, 2 specimen-UI confident lies,
3 adapter-UI disputes, adapter-UI wrong answers 0; torture rows green
(kill author; lose the contract — 161-event log and 33-event fragment
folds identical; key/algorithm rotation; partition/reorg; contract
replacement + chain migration — tampered bundle refused by commitment
anchor, naive importer convicted, the live delegation migrated with
borrower possession and lender sovereignty both intact; marketplace
death); millennium leg 450 actions across simulated centuries, fold
mismatches 0, F-4 convicted (the specimen honors a 1,000-year-old
standing offer; the adapter refuses it as expired); idata byte-stability
verified across 300 hostile actions; TEETH row green (the
trust-the-indexer UI lies under a dropped event, a flipped sovereign
changes the commitment, a forged root fails verification — if any of
these rows goes quiet the battery lost its teeth).
**BOUNDARY** this is evidence about the MODEL (a faithful port), not the
compiled contract: wasm-vs-model equivalence is a named next beat, and
the histories are sampled, not exhaustive — the Cryptol twin states the
property for all states/actions and remains UNVERIFIED until run.

**CLAIM** the specimen is preserved untouched and pinned.
**EVIDENCE** 17 files copied from the upstream clone at `e6a042f`,
`.git` only removal; sha256 pins in PROVENANCE.md (src/SimpleAssets.cpp,
include/SimpleAssets.hpp, the wasm) PUBLIC-CONSTANT-marked.
**BOUNDARY NOT CROSSED** nothing in the tree is built or executed by the
estate; upstream may move or vanish — this copy is the anchor.

**CLAIM** the scan exemption is scoped and proven, not a hole.
**EVIDENCE** the vendored tree carries 120 lines of upstream 64-hex
(CMake icon-URI hashes, doc pins) that the marker law cannot cover — a
same-line marker would break verbatim preservation, which the founder
order forbids. `scripts/secret-scan.sh` gains a path-scoped exemption
for `scripts/btungsten/wb002-specimen/simpleassets-e6a042f/` ONLY (the
sibling PROVENANCE.md stays scanned and marker-governed), on the
docs/handoffs/silentpay-v2 basis (byte-faithful external material under
a no-edits fence). Proven 2026-10-07: selftest 4/4 green; targeted
known-BAD/known-GOOD — the same 60-hex string commits clean inside the
subtree and BLOCKS outside it, in both diff and tree modes.
**BOUNDARY** the 64-hex arm stays armed everywhere else; CI re-scans
the whole tree on push.

**CLAIM** the specimen's failures are now named BNR adapter requirements.
**EVIDENCE** F-1 authorctrl confiscation (REJECTED for sovereign funds
by founder ruling — the adapter refuses authorctrl at creation AND
refuses issuer-signed moves even for migrated legacy tokens); F-2
delegation tenure not enforced on the transfer return path (SA.cpp:261
vs :514 — adapter enforces the period on lender pulls while the
borrower may still return anytime); F-3 attach/detach authority is the
author's, not the sovereign's (SA.cpp:537/568/874 — the author can lock
a sovereign's assets; adapter binds composition to the sovereign);
F-4 offers never expire (1,000-year consent hazard); F-8 changeauthor
moves the mdata-authority envelope on the author's signature alone
(adapter requires sovereign co-sign). Field evidence backing the model
classes: upstream issues #26/#19 (indexer/UI truth divergence), #6
(author-side freeze), #21 (CDT rot → the wasm+source preservation
answer).
**BOUNDARY** these are convictions of the SPECIMEN profile by design;
upstream documented authorctrl as a feature — we convict it against
BNR's sovereign-funds ruling, not as an upstream bug.

**CLAIM** the BNR semantic extractions are fixed.
**EVIDENCE** README §extractions + SPEC §workbench: idata → COMMIT
(commitment only; COMMIT owns the personal-material boundary), mdata →
mutable status pointer, NTT → credential/capability primitive,
offer→claim → consent, delegate(period, redelegate) → bounded authority
(the Silent-Pay lineage), attach/attachf → capability composition,
author RAM payer → sponsored sovereignty (payer is never an owner —
proven in the faithful-port row).
**BOUNDARY** these are spec-level mappings; no BNR adapter code was
written this lane — the adapter PROFILE in the model is their
executable draft, not production.

## Laws honored

Worktree law (all staging from `wt-zcode` on lane branch, explicit
pathspecs); specimen preserved verbatim (no-edits fence pinned by
hashes); crypto wording caps held ("sound by construction at model
level" only; no claim the wasm or upstream crypto is verified);
reports-in-tree (this file); secrets none (no keys; the battery's
commitments are runtime sha256 over public model state); no surfaces
touched (no registration ritual due); no tests.yml edit (glob picked
the suite up; the YAML double-run trap avoided); scan exemption landed
with selftest + targeted BAD/GOOD proof per the checker-not-landed-
until-both-rows law.

## NEXT OWNER

- CI green on this PR → this seat merges (no-stall law).
- wasm-vs-model equivalence beat (README §next 1): run the vendored
  2021 wasm on a modern Antelope stack (box or CI) against the port's
  verdicts — owner: any seat; the specimen's issue #21 is the epoch's
  own build-rot warning.
- Cryptol/SAW container beat (shared with WB001 §next 1): typecheck +
  `:check sovereignContinuity`.
- Live Vaulta leg (README §next 4): the same torture rows against a
  deployed contract.

HUMAN INTERACTION: NONE.

## Carry-overs

- bTunGsTeN public surface page (carried from WB001; still not this
  beat).
- Emissary sacrificial distributed-workflow leg — open under its own
  future workbench number (WB002's absorption note).
- The 1,000-year claim now has an empirical BEGINNING (fragment
  recovery, millennium history, migration continuity on the model) —
  the millennium receipt stays model-scoped until the wasm and live
  legs land.
