# STATUS — honest done / not-done ledger

The one-line summary for any new reader or AI:

> **The cryptographic design is source-confirmed, the wire contract is frozen,
> and the host-side derivation is PROVEN against stock Zano — publicly
> reproducible: `cargo test -p chain-zano` (committed vector, 2026-07-03). The
> firmware and the legal review are the unstarted work between here and
> anything a user touches.**

Do not let AI-to-AI review re-open the items under "Done." If you believe one is
wrong, cite the Zano source file/line and stop — do not rewrite it.

## Repo state — last known good

One line per milestone; newest first. This section, not any AI's memory, is the
authoritative record of where `origin/main` sits.

**Evidence tiers (read the vocabulary before the claims).** Per the doc-audit
F5 finding, this ledger distinguishes two kinds of evidence, and the word
choice is deliberate:
- **PROVEN / reproducible** — anyone can re-run it and get the same result.
  Each such claim names its command (e.g. `cargo test --workspace`;
  `cargo test -p chain-zano` for the stock-Zano derivation vector). A command
  can't lie; run it and trust rises.
- **LIVE / dev-chain observed** — observed against a *local* dev or testnet
  node (real bytes, real chain state) but **not publicly reproducible**: a
  stranger has no access to that node. These entries are marked
  `(dev-chain observed)`. They are real and were captured, but they are
  weaker than a proof a reviewer can re-run, and are labelled so no reader
  mistakes one for the other.
Counts follow the same rule: a number is stated as the command that produces
it — currently `cargo test --workspace` → **179 passed; 1 ignored**.

- `2026-07-08` — **Machine-economy vision batch captured:** QueenBee
  420-quantum direction (TE collision named, F-Q1 founder-gated);
  CD-27 machine-seat OPEN answered (singular machine quantum;
  companions custody, never mint; supply 420 × (verified humans + 1));
  CD-1 jurisdiction docket extended (custody = money-transmission-class
  surface); CD-28 inference-provider adapter doctrine captured
  (intimate-tier inference self-hostable-only; D-6 docketed). Margin
  law banked: anchors land verbatim, enrichment beside never inside.

- `2026-07-08` — **M-1 GLM consumption audit CLEAN 0/0/0** (transport:
  arbiter-verified reconstruction). The A-B-C developer arc closes:
  seven audits, zero findings (T-1, T-2, T-3, T-3.1v2, T-4, T-5, M-1).
  Report banked verbatim: docs/audits/glm-m1-consumption-audit-report.md
  (4d226930… @ 7,444 B, landing instrument = advisory digest, exact).

- `2026-07-07` — **GLM verbatim returns banked — audit trail
  tree-carried.** docs/audits/ created (founder-ruled scanner exemption,
  fixtures/ precedent, own disclosed commit): t31-v2 + t4 + t5
  consumption audits, all "CLOSED — 0/0/0", banked byte-faithful and
  digest-stamped (d45347d0… / 2b4fd366… / e9ff11df…). The emission
  red-team memo banked in the LOVErnment-DAO tree's docs/audits/ (its
  own commit there).

- `2026-07-07` — **M-1 FOUNDER-PASSED** (device eyes, all seven tabs):
  verdict verbatim — "no appreciable bugs." GLM consumption audit pending
  (T-3.1 pattern + the new mobile-law section in ui/src/styles.css).
  Gate sequence: FAILED 5-of-7 → fix cfab957 → instrument 7/7 → founder
  device PASS.

- `2026-07-07` — **fractally whitepaper retrieved founder-hands,
  hash-pinned (efe0698d…7663696); D-1 closing final.** The 55→5 Respect
  conflict resolved against BOTH candidates — canonical schedule is
  2,3,5,8,13,21 (WP source). Geometry source-pinned (7,776 = headwater's
  own cap); GLM F-4/SE-2 prior-art appends landed; CD-26/CD-27
  whitepaper appends landed (source invitation pinned; 420 cap named as
  deliberate divergence from perpetual issuance).

- `2026-07-07` — **CD-26 fractally-engine-as-OS-feature + CD-27
  b-distribution evolution captured** (420 lifetime cap + genesis leg,
  founder what-if NOT RULED); CD-23 surface named: Beehive Nature Quest
  (circle = community lane, Quest = personal lane). License STEP
  executed: Eden = MIT (consumable); gofractally/fractally = NO license
  file (unconsumable until relicensed). Full text:
  docs/feature-backlog.md CD-26 / CD-27 / CD-23.

- `2026-07-07` — **M-1 mobile fix landed — instrument-verified 7/7,
  HOLDING for founder device re-gate** (the eyes-gate belongs to the
  eyes-holder). Root causes: Dispute/Profiles 430px + Listings 380px grid
  minimums forced page-level panning; Escrow/Orders fixture-path
  breadcrumbs bled across card borders. Fix is one mobile media layer
  (≤640px): grids release to one column, paths gain overflow-wrap,
  tables become their own scroll surfaces — render-in-full law holds by
  its layout-changes clause, hash-chip nowrap law untouched. At 375px
  all seven tabs: page scroll-width = viewport, zero elements clipping
  own content; desktop untouched by media-query construction.

- `2026-07-07` — **First mobile gate FAILED 5-of-7** (founder device eyes,
  2026-07-07): Escrow, Dispute, Listings, Profiles, Orders broken; Browse,
  Reputation clean. M-1 investigate→fix→re-gate queued.

- `2026-07-07` — **Second tree registered: skaists/LOVErnment-DAO** —
  genesis bd37420 → research crossing 8502cfa (D-1/D-2/D-3 landed,
  landing-instrument digests final) → scaffold 4f9f4bb → logo 6f5cef2
  (founder-opened gate: skaists mark landed at assets/, README header;
  byte-exact to the 64f35bee pin; formal Design lap remains gated). First
  out-of-tree consumer: 1 passed / 0 failed / 0 ignored against pinned kernel-v0.1.0,
  CI green on the tree's first run. The tree is the relay of record — now
  trees, plural; every seat-stamp names its tree.

- `2026-07-07` — **kernel-v0.1.0 cut @ 590832d.** TRUE-UP: live CI (run
  28900422647) counts 180 passed / 0 failed / 1 ignored — prior STATUS
  said 179; one test added since last count. Live counts rule; 180/0/1 is
  the number of record.

- `2026-07-07` — **CD-25 QueenBee capture banked, frame founder-gated**
  (genesis Aigentic seat: organ-not-member candidate frame, zero votes,
  never an attester, supersedure law; boundary law vs CD-1 bLoveRai).
  Full text: docs/feature-backlog.md CD-25.

- `2026-07-07` — **GLM red-team return + senary delta appended to CD-23**
  (2 RED / 4 YELLOW / 2 QUESTION; SE-1..SE-6 candidate invariants
  founder-gated, none promoted; F-8(c) reopened — attestation quorum +
  voter set unruled).

- `2026-07-07` — **CD-23 fractal co-creation circles captured (circle
  size RULED six — fractally original design, triple-anchored; supersedes
  same-day eight) + CD-24 LOVErnment treasury inflows captured + CD-1
  bLoveRai amended** (instrument named "bLoveRai stock"; jurisdiction
  review extended to instrument characterization). Full text:
  docs/feature-backlog.md CD-23 / CD-24 / CD-1.

- `2026-07-07` — **CD-22 registered — proof-of-unique-personhood grounded
  in current literature; the honest path is fusion + on-device + ZK-dedup,
  not one-sensor magic.** Full text: docs/feature-backlog.md CD-22.

- `2026-07-07` — **CD-21 MoC reference-image pin landed in full** (re-serve;
  the prior cut carried the hash ellipsized — relay elision). The CD-17
  visual-identity addendum from the same re-serve was HELD as already
  landed: the lead's partial-landing check ran against `7b53796` while the
  tree of record stood at `a394168` (relay crossing, nothing lost).

- `2026-07-07` — **CD-21 Q-1 CLOSED (MoC = Hawkins' Map of Consciousness,
  filed as an interpretive-system attestation, never
  biometric/instrument-verified; Hawkins-estate IP check gates branding) +
  CD-17 visual-identity candidate pinned** (family geometry, distinct
  colorway; formal Design lap founder-gated). Full text:
  docs/feature-backlog.md CD-21 / CD-17.

- `2026-07-07` — **CD-21 registered — the quest has a constitution.**
  Cooperative GameFi under skaists: non-zero-sum quest economy, the
  Sovereignty Score as a vertical attestation policy (not a kernel
  primitive), BIO-1 proposed (raw biometrics never leave the device —
  irrevocable therefore unstorable), "quantum secure" capped to
  PQC-pending per house law. Q-1–Q-5 open. Full text:
  docs/feature-backlog.md CD-21.

- `2026-07-07` — **CD-17 identity claims COMPLETE — all five anchors live**
  (domain · email · Bluesky handle+DID · X handle · GitHub org, the last
  parked empty by design with both seats' 404→200 instrument pairs closed).
  Full text: docs/feature-backlog.md CD-17.

- `2026-07-07` — **CD-20 registered — the estate has a map.** Five domains,
  five roles (study central · governance home · the marketplace · the
  biologic futures exchange · the rave ecosystem), two cross-domain
  mechanisms, four founder-gated questions, one estate-wide renewal date.
  Full text: docs/feature-backlog.md CD-20.

- `2026-07-07` — **CD-17 identity claims executed and verified — genesis
  LOVErnment skaists is now publicly resolvable.** Domain skaists.social
  owned + active, email live, Bluesky handle @skaists.social verified via
  `_atproto` DNS TXT (social-layer DID `did:plc:gnsiwyuiw4swvqnjlnacytaz`,
  lead-verified by profile resolution AND Code-verified independently via
  public XRPC — the R-006 double-verification standard applied to an
  identity), X handle claimed (founder-attested), GitHub org pending on a
  confirmed-free namespace. Social DID is presence-layer only; kernel root
  remains did:autonomi. Full text: docs/feature-backlog.md CD-17.

- `2026-07-07` — **CD-19 REGISTERED — the creative/festival economy under
  skaists.** Tickets as an identity-bound asset class (anti-scalping via
  authenticated humans + escrow + provenance-verified resale), digital
  production goods delivered through Autonomi (the storage layer as the
  fulfillment layer), and performance bookings — which **promote the
  service-escrow semantics question to priority** (the goods-shaped state
  machine has no Shipped for a DJ set; kernel-roadmap item, architecture
  stays closed). Q-1–Q-3 open. Full text: docs/feature-backlog.md CD-19.

- `2026-07-07` — **CD-18 REGISTERED — the Indigo Index.** Creativity-measured
  regional value, **derivable at render time from public settlement events in
  creative verticals — computed, never asserted** (the
  computation-vs-invention law at macro scale). Q-1–Q-3 open (inputs,
  regional attribution, platform metric vs civic artifact). Full text:
  docs/feature-backlog.md CD-18.

- `2026-07-07` — **CD-17 AMENDED per tonight's founder rulings.** Genesis
  LOVErnment named (**skaists** · skaists.social), jurisdiction ruled (the
  metaphysical + creative vertical as ONE entity: community, marketplace,
  adjudication; capped 7777 authenticated humans), **LOVErnment doctrine
  banked** (a vertical-flavored commerce community that adjudicates the trade
  it understands; the DRO layer as a competitive market of sovereign
  verticals, the kernel neutral among all), **persona direction ruled** (dev
  mode = the audit dashboard; consumer lenses are the next UI arc on the same
  audited substrate), and the **did:plc / did:autonomi lane ruling** (Bluesky
  did:plc = skaists' social-presence layer only; kernel identity remains
  did:autonomi). Q-2–Q-5 open. Full text: docs/feature-backlog.md CD-17.

- `2026-07-07` — **ARC CLOSED — A→Profiles, B→Orders, C→Browse, plus two
  eyes-forced micro-laps.** Seven public tabs, three fixtures, three pins,
  five consumption audits, **0/0/0 across the entire arc** — one coffee
  question to a connected marketplace in one continuous run. The stranger's
  demo now runs: `git clone` → `cargo test --workspace --locked` (180 passed /
  1 ignored) → `npm run dev` in `ui/` → walk the marketplace: browse the
  storefront, open a listing, meet the seller's composed profile, follow an
  order's whole life through its guards, watch a dispute split settle to the
  adjudicated ratio. Checked, not believed, at every layer.

- `2026-07-07` — **T-5 loop CLOSED — the storefront.** `a003a8c` (four files,
  founder-eyed interactive pass, CI-green): 24 cards in fixture order,
  render-time filters/sort labeled while active in the blue transformation
  banner, censuses computed from the loaded fixture. **GLM audit: CLEAN
  (0/0/0)** with **computed-census independence proven** — all five counts
  derived from the loaded fixture, zero references to the fixture's own
  `variety` block. Third pin `BROWSE_PIN` lawful (R1-class). **Cross-asset
  sort doctrine on the record:** ordering integers is computation; pretending
  they're one currency would be invention.

- `2026-07-07` — **T-4 loop CLOSED — Orders.** `3f82cf7` (three files,
  founder-eyed, CI-green): one order, whole life — seven events with both
  guard refusals in-timeline (the Q-D10 identity-vs-order distinction),
  settlement reconciliation computed at render, scenario_2's caselessness an
  honest labeled absence. **GLM audit: CLEAN (0/0/0)** — one-subject
  composition confirmed as fixture truth, unexercised dispute branches
  **disclosed-not-discovered**, and the seven-count correction crediting
  founder eyes (the implementer's "eight" died against `len(steps)=7`).

- `2026-07-06` — **T-3.2 CLOSED — the tab row yields.** `8f53965` (+4/−1,
  `ui/src/styles.css` only, founder-eyed): the render-in-full law applied one
  layer up — pills stay unbreakable (T-3.1), the ROW yields instead, wrapping
  whole to right-anchored lines at narrow widths; masthead composes, no
  mid-label clipping. CI green.

- `2026-07-06` — **T-3.1 micro-lap CLOSED, with its lesson.** v1 (CSS-only
  nowrap) cured the mid-string wrap but **lied by clipping** on narrow cards —
  **REFUSED at founder eyes**, and the law refined in refusal: **THE COLLAPSED
  FORM RENDERS IN FULL OR THE LAYOUT CHANGES** (mid-string wrap forbidden AND
  clipping forbidden). The pre-authorized layout clause fired; **v2 landed
  `f337f13`** (four files: the comp-row rules + row markup in Reputation /
  Dispute / Profiles — the hash on its own full-width row wearing its verbatim
  §9.3 name inline). Crossing gated 4/4 per-file sha256 + whole-pack concat
  MATCH. **GLM audit: CLEAN (0/0/0)**, the no-datum-lost check verified
  colSpan-by-colSpan. **Derivation-gating doctrine banked:** deriving a
  crossing file once from a digest-verified base and gating against the
  author's digest is sound — the hash arbitrates; iterating edits until a
  digest passes is forgery. CI green.

- `2026-07-06` — **T-3 loop CLOSED — the machine's first cross-fixture
  composition.** Design's pack landed on the **third serve** (two in-channel
  paste serves REFUSED at the digest gates — elision, then newline
  destruction; fenced per-file chunks landed 3/3 with the body-concat pin
  exact; **channel law banked**: fenced/file couriers earn their MATCHes,
  naked paste is a paraphraser). Landed **`2747b44`** founder-eyed (Profiles:
  reputation ∪ listings joined on exact DID string equality, per-datum
  provenance chips, the ghost's honest zero) after a delta-audit triage
  cleared the T-3 delta of a flagged rendering issue (pre-existing, filed
  T-3.1). **GLM audit: CLEAN (0/0/0)** including independent combinator-scope
  confirmation — auditor walked the DOM ancestry from scratch and met the
  implementer's triage verdict. The night's arc: **the eyes-gate caught three
  defects the digest gates never could** — bytes can be faithful while the
  rendering lies. CI green on all heads.

- `2026-07-06` — **T-2 loop CLOSED — the marketplace surface, second full lap,
  second clean audit.** Design crossing pack **6/6 digest-verified**
  (whole-pack `7862c35d…` @ 22195 B) · landed **`2868c26`** (six files,
  +240/−2, founder-eyed with a T-1 regression glance, CI-green, **R2 closed**:
  index.html SPDX rider) · **GLM consumption audit: CLEAN (0/0/0)** — the
  format.js truncation guard **PROVEN behavior-preserving** for 64-hex, all
  founder rulings Q-D8–Q-D11 verified with citations (timestamp sentinel as
  labeled absence, null optionals as first-class states, refusals as a guards
  panel never as cards, raw atomic units labeled) · seal proceeded under
  **v2.2 MISMATCH-PP** (93 B attributed gateway whitespace drift; docket
  `0ea5fed6…` public-pinned). **Convention v2.2 banked:** seal verification
  returns MATCH / UNCOMPUTABLE / MISMATCH, and a MISMATCH-PP proceed requires
  public-pinned artifacts plus an attributed delta — never an unexplained one.
  Also this commit: docs sweep replacing short-sha regeneration commands with
  the `$(git rev-parse <short>)` form (state-freshness class, founder-hit —
  an ellipsized sha in a repro command is a command that cannot be pasted).

- `2026-07-06` — **T-2 fixture minted — the marketplace listing substrate,
  computed through the real normalizer.** **`5595492`** — new
  `listings-fixture` bin (demo.rs untouched, **zero dependency movement**);
  **`b42c25b`** — `fixtures/listings-fixtures.json` (`b69a1992…` @ 136 lines,
  **double-verified lead-from-public-record + author-from-disk**), four cases
  mirroring proven normalizer tests: fully-populated, minimal (absent
  timestamp → documented 0 default), and two typed REFUSALS as first-class
  outcomes (`MissingField: seller_did`, `BadFieldType: amount/u64`). Y-1 law
  carried forward: inputs echo the identical `RawChainAction` instances
  consumed (zero transcription), hand-mapped scalars round-trip-verified,
  nonzero-exit contract. Provenance `generated_from=5595492` (full sha);
  regenerate-at-named-head diff empty; two-run determinism diff empty. Repro:
  `DEMO_GENERATED_FROM=$(git rev-parse HEAD) cargo run -q -p composition --bin
  listings-fixture | diff - fixtures/listings-fixtures.json` (empty at
  `5595492`). Display questions **Q-D8–Q-D11 filed, not improvised**
  (timestamp-0 sentinel, null optionals, refusal surface, native-unit display)
  and founder-ruled same day. CI green.

- `2026-07-06` — **T-1 loop CLOSED — the kernel's first frontend, five seats,
  every gate exercised.** Design's crossing pack **15/15 digest-verified**
  (whole-pack `0517309f…`, per-file manifest, one extraction-side terminator
  fix, no re-serve needed) · landed **`0572efd`** — 16 files (15-file manifest
  + `package-lock.json` as the lead-ruled disclosed artifact), founder-eyed on
  the live dev server, CI-green, rulings R1 (FIXTURE_PIN accepted as
  provenance literal), R2 (index.html SPDX joins Design's next pack), R3
  (toolchain-prerequisite doctrine ratified) carried in the commit message ·
  battery: zero fixture values hardcoded, single-source fixture import,
  `vite build` 39 modules / three views, dev boot HTTP 200, workspace
  `--locked` untouched (`cargo test --workspace --locked` → 180 passed / 1
  ignored) · **GLM consumption audit: CLEAN (0 red / 0 yellow / 0 cosmetic)**,
  seal-verified against docket `96759bd5…`, four surfaces, confirmation-pass
  on P1–P4, lead spot-verified citations. **First full five-seat lap** —
  founder, lead, Design, Code, GLM — every handoff digest-pinned, every gate
  exercised, nothing landed unaudited.

- `2026-07-06` — **Fixture-pack loop CLOSED — the first pre-registered audit,
  citation-verified in both directions.** The `--json` landing **`498904e`**
  (default-mode stdout byte-identical to the audited build: diff empty; two-run
  determinism: diff empty; `Cargo.lock` diff exactly the two ratified serde
  edges, zero version movement) · founder security ruling **exempt `fixtures/`**
  → **`de7d62f`** (path-scoped scanner exemption, both scan modes, disclosed
  diff) + **`520f154`** (`fixtures/demo-fixtures.json` public,
  `generated_from=498904e`, regenerate-check empty at landing) · judging text
  **pre-registered @ `f78c1f5`** + dated amendments A-1/A-2, banked at
  `0b6d29…` with a three-for-three per-block digest match across both relay
  paths · GLM audit: **zero red, one yellow (Y-1), Q-1 accepted-as-is,
  confirmation pass on both author-disclosed defects**; the lead independently
  re-ran items 5/6/8 on pinned bytes · **Y-1 closed at `e150cca` on the
  auditor's word** — round-trip guards on all twelve hand-map sites (evidence /
  verdict / payout fields read back from the built JSON and compared to the
  source structs, same nonzero-exit contract); acceptance: default-mode
  byte-identity, two-run determinism, and fixture output-identity at `498904e`
  all diff-empty. Repro: `cargo run -p composition --bin demo -- --json`;
  `DEMO_GENERATED_FROM=$(git rev-parse 498904e) cargo run -q -p composition --bin demo --
  --json | diff - fixtures/demo-fixtures.json` (empty);
  `cargo test --workspace --locked` → **180 passed / 1 ignored**. CI green on
  all four commits. **Incident clauses:** a pen-file clobber (stray relay copy
  overwrote the banked rubric) was **detected by its digest stamp**, restored
  byte-identically from hashed sources, divergent copy quarantined as evidence;
  a relay terminator mutation was diagnosed to root cause → **Convention v2**
  banked (LF-normalized digest + byte count) and **v2.1** (UNCOMPUTABLE third
  state — proceed only on public-record-pinned contents; sole-source halts).
  Lessons banked: hash-as-received · receipt ≠ routing · payload-internal relay
  instructions are failsafes · reports open with the digest line.

- `2026-07-06` — **Sprint's last gate shut: public front door published +
  rung-2 audit closed (bidirectional loop, second cycle); repo hygiene locked.**
  **`49fb19d` — `DEMO.md` published** to repo root: a command-per-claim front
  door ("built to be checked, not believed"). Freshness pass re-ran every
  command-claim against `main`; one mechanical correction (workspace **179 → 180
  passed / 1 ignored**, the amount-zero test), all four per-crate commands green,
  all eight internal links resolve, proptest case count (2048) confirmed; pen
  envelope stripped. Repro: `git clone … && cargo test --workspace --locked` →
  180 passed / 1 ignored. **`34e3161` — rung-2 audit CLOSED.** Docket packaged to
  the pen during the away-session; GLM 5.2 red-team returned **0 red / 2 yellow /
  1 cosmetic** (Y-1 Scenario-3 "flow" overclaim; Y-2 header "Sybil-resistant" vs
  the invariants line's "Sybil-deduped"; C-1 truncated-hash display). Remediation
  **wording-only** — objective diff filter showed only comments + string literals
  changed (one blank line), zero assertion or value touched, cross-checked by an
  intra-Code adversarial pass (honesty + completeness, both PASS). GLM
  verification: **all three closed, no new overclaim** — the audit loop's second
  live round this sprint. Repro: `cargo run -p composition --bin demo` (exit 0);
  `cargo test --workspace --locked` (180 passed / 1 ignored). **`53a870c` —
  `.gitattributes` `* text=auto eol=lf`** enforces LF repo-wide (`git add
  --renormalize .` was a no-op — index already 100% LF), closing the recurring
  CRLF relay churn; hook chain confirmed post-switch. **`f78c1f5` — CD-9
  annotated** with the GLM 5.2 red-team as its stress-test of record (verbatim
  R-2 sentence + Q-1–Q-4 from the pen source; capture status UNCHANGED, not
  scheduled). All four commits CI-green (tests + secret-scan).

- `2026-07-05` — **Away-relay solo session: amount-zero hardening, rung 2
  (reputation flow), Trezor vector-test spec. Hard holds honored; audits
  queued.** Executed under the founder's away-relay rules (hard holds replace
  escalate-then-execute; no cross-seat loop; land on green or in the pen).
  **`942757e`** — escrow-core hardened against a zero-amount (valueless) escrow:
  the §9.2 check `asset_amount >= self.amount` is trivially satisfied when
  `self.amount == 0`, so a zero-value escrow funded to Funded on `asset_amount
  0`. Test-first (red captured: `Ok(Funded)` vs `Err(ZeroAmountEscrow)`); green
  via a new `EscrowError::ZeroAmountEscrow` guard before the comparison; `new()`
  stays a total constructor (no caller ripple). Unit test
  `zero_amount_escrow_cannot_be_funded` + proptest `funding_is_a_pure_comparison`
  refined ("fundable" now requires `amount > 0`). Repro: `cargo test -p
  escrow-core`; `cargo test --workspace --locked` → **180 passed / 1 ignored**.
  CI green. **`5f4e335`** — composition/demo rung 2: Scenario 3 drives the real
  reputation-engine from the three lifecycle outcomes; reputation emergent
  (recomputed via `recompute`/`MockStore`, never written), component vector
  canonical (score = one clamped projection), attestations Sybil-deduped per
  attester (10-from-one + 1-from-another → 2 components), unknown DID → 0; seller
  floored 0 / buyer 30, all asserted (nonzero exit on any breach). Rung-1
  audited code untouched. Repro: `cargo run -p composition --bin demo` (exit 0).
  CI green. **Audit docket** packaged + QUEUED (no cross-seat loop while dark):
  `docs/findings/rung-2-audit-docket.md` (gitignored pen, self-contained per the
  C-1 lesson). **Trezor vector-test procedure** written spec-only to
  `docs/findings/trezor-vector-test-procedure.md` (companion to Cowork's delta
  brief) — **BLOCKED on the §3 seed-class pin** (SLIP39 vs BIP39;
  founder/firmware decision); no CLI/firmware download (spec-only, per orders).
  Founder one-word items still open + HELD: `.gitattributes` `* text=auto
  eol=lf`; seat attribution for the pre-landing review.

- `2026-07-05` — **Rung-1 dispute-branch audit closed; bidirectional
  verification demonstrated live.** `5b994c2` hardened
  `composition/src/bin/demo.rs` against GLM's adversarial audit: **4 findings
  fixed** — R-1 (2b now proves each payout leg matches the adjudicated split
  ratio *before* the trace claims it, closing a 50/50-masking vector), Y-2
  (converse half of the §9.2 dual-balance AND — a zero-asset/fee-present funding
  is refused), Y-1 (literal error, no asserted cause), C-2 (`escrow_to_disputed`
  returns `Result`, one failure contract) — and **1 rejected on source-cited
  evidence**: C-1 claimed `reconcile()` was nonexistent; it exists (`pub fn
  reconcile`, `dro-signer/src/lib.rs:393`, invoked by `sign_settlement:444`), so
  the accurate reference was kept, not the false "fix." GLM ruling:
  R-1/Y-1/Y-2/C-2 **CLOSED**, C-1 **OVERTURNED as a false positive** (auditor
  owned it plainly). The loop ran both directions — auditor caught the
  implementer's unverified trace claim (R-1); implementer caught the auditor's
  unverified nonexistence claim (C-1); symmetric, evidence-ruled, no seat grading
  its own work. Citations adversarially re-verified (8 agents, 0 disagreements):
  `escrow-engine` apply OrderFunded arm `lib.rs:69-74` (`asset_amount ←
  order.amount`, `zano_amount ← order.fee_buffer_zano.unwrap_or(0)`),
  `escrow-core` funding guard `lib.rs:310`, `dro-signer` `Payout`/`Party` `:46-57`
  + `settlement_intent_for_split` (buyer,seller) `:161-187`. Repro: `cargo run -p
  composition --bin demo` (exit 0); `cargo test --workspace --locked` → **179
  passed; 1 ignored**. CI green (tests + secret-scan) on `5b994c2`. **`15bee80`** —
  CD-9 capture (tiered dispute-resolution pricing, "bSAFE") added to the backlog
  quarantine, capture-only, separate commit; CI green on `15bee80`. Open (founder
  one-word calls, HELD): `.gitattributes` `* text=auto eol=lf` (CRLF relay-churn
  recurs until added); seat attribution for the pre-landing review. DEMO.md
  founder-eyes vs this post-fix trace is the last gate.

- `2026-07-05` — **Captured designs (07-04 session) committed to the
  quarantine; clean tree before the next work session.** `feature-backlog.md`
  gains **CD-1…CD-7** (bLoveRai bounded affect companion; the cross-cutting
  privacy invariant as a candidate Art. VI amendment; proof-gated earn-classes;
  LOVErnment emission-split; the health-biomarker reward-trigger **BAR**) —
  all DEFERRED, orientation-only, under the standing scope-defense rules; none
  is an implementation target. Verified intact (ends on the pre-existing
  Standing-rules section, 59 additive lines) before commit. Docs only.
  *(Self-correction, 2026-07-05: this line originally read "CD-1…CD-8" — a
  miscount. `git show 29cfdb6` confirms the commit added seven entries,
  CD-1…CD-7; no design was dropped. The api surface added later is the
  legitimate CD-8; the "CD-9" some dispatches used descended from this
  miscount.)* *(Noted,
  not fixed this turn: this section's newest-first ordering has drifted — the
  "Reviewer contract adopted" entry below sits above newer ones from a stale
  insert anchor; a cleanup pass is due.)*
- `2026-07-04` — **Reviewer contract adopted: SECURITY.md + REVIEWING.md at
  root, R-004 in the register.** Cowork drafts, one-door reviewed and
  adopted. SECURITY.md: the private channel is GitHub Private
  Vulnerability Reporting — ENABLED, API-verified `true` (no email to
  publish or leak); scope is the fund-moving/ledger-integrity workspace;
  good-faith safe harbor excludes live funds and sanctions-violating
  tests. REVIEWING.md: the authority hierarchy (ledger beats memory,
  including the author's), the mechanism-not-worldview boundary per
  Art. VII, the three-way response norm, the absent/lie-to/become-it
  audit lens. risk-register **R-004 adopted** (Cowork edit to a tracked
  file, reviewed): the DRO must never trust the indexer's view alone —
  Kelp DAO class, Apr 2026, INDEPENDENTLY VERIFIED before adoption
  (~$290M; poisoned RPC binaries + DDoS-forced failover behind a 1-of-1
  DVN confirmed an rsETH mint that never happened; Chainalysis/SlowMist/
  Chainstack post-mortems concur). Adoption repairs, named: crate list
  completed against the tree (draft missed `escrow-engine` +
  `shared-types` — 2 of 14); dangling references removed (untracked
  hemp briefing → generic sanctions wording; `docs/findings/` →
  `docs/`); meta-tier citation corrected to the ratification DRAFT (not
  yet constitution); email/PGP placeholders dropped (PVR needs
  neither). The hemp-seed compliance briefing stays UNTRACKED —
  FOR-COUNSEL founder material, not published.
- `2026-07-04` — **Affect-inference layer routed to the quarantine (parked, not
  built).** Per scope-defense + GLM/founder sign-off, the affect/emotion-
  inference design goes into `feature-backlog.md` as one routing row (L5
  `interpretation.affect`, Capability-gated), capturing the cross-cutting
  privacy invariant — *minimum-sufficient derived inference; raw signal never
  leaves the vault; derivation is a capability-gated operation; the derived
  class carries provenance, not source* ("help you without seeing you"). Named
  the F5 correction in the row: the "evidence-vault / threshold-encryption" it
  would reuse is spec-stage, NOT built (`dispute-engine` is pure adjudication
  + an `EvidenceProvider` seam). Constitution promotion = Article VI amendment
  (founder's, not builder's). No code; vision stays quarantined.
- `2026-07-04` — **Reproduction-command rule adopted (doc-audit F1 + F5).** A
  count is now stated as the command that produces it, and a "proven" declares
  its reproduction path or is downgraded to "dev-chain observed." Applied:
  README reviewer count `146 → cargo test --workspace → 179 passed; 1 ignored`,
  with the stock-Zano claim given its repro (`cargo test -p chain-zano`) and
  the SHIP codec split into reproducible (mock server) vs dev-chain observed
  (local nodeos). STATUS header gained an **evidence-tiers legend** defining
  PROVEN/reproducible vs LIVE/dev-chain observed, and the four dev-chain LIVE
  entries (zano-watcher, item-4 block 2832, fUSD fee buffer, SHIP ingestion)
  are tagged `(dev-chain observed)` — additive labels, the dated facts stand.
  REVIEWING.md carries the standing rule. Historical dated counts left intact
  (they record the true number at their commit; the legend reframes them).
- `2026-07-04` — **Renamed to "Beehive Nature Reserve Kernel".** Proper-noun
  name adopted in the three canonical places: CONSTITUTION.md title + preamble
  (the categorical "is a coordination kernel" stays — accurate, lowercase),
  README title + lede, and workspace `Cargo.toml` (header comment +
  `[workspace.metadata].name`; the `[workspace]` table has no `name` field of
  its own). Manifest re-validated (`cargo metadata` resolves). Descriptive
  lowercase "coordination kernel" left intact in SECURITY.md/REVIEWING.md —
  out of the rename's scope and still accurate. No crate/repo identifier
  changed (still `beehive-nature`); this is a display-name change only.
- `2026-07-04` — **Tree cleaned; test count re-pinned to the live number.**
  Inventory at HEAD `1a2eb20`: **zero tracked modifications** (C1–C6 already
  committed the dirty tracked files the doc-audit F2 flagged); the only
  uncommitted paths were research-lane DRAFTS under `docs/findings/` and
  `docs/design/`. Routed per one-door: those dirs are the untracked draft
  staging pen — an adopted finding graduates to `docs/`/`docs/architecture/`
  with its own ledger line — so they are now `.gitignore`d (non-destructive;
  files stay on disk). FOR-COUNSEL (hemp) and founder-decision drafts
  (tokenomics emission, Article VI parameters, fUSD ratio) are deliberately
  NOT published by the builder. `git status` now clean. **Actual count
  re-pinned: `cargo test --workspace` → 179 passed, 1 ignored** (the
  firmware-gated `slip0010` e2e) — the public "146" was pinned to a
  pre-hardening run; the adversarial-hardening sprint grew it to 179.
  doc-audit **F2 retired**: the number now matches a re-run at the committed
  HEAD.
- `2026-07-04` — **escrow-core: snapshot-resumption durability + named vector
  guards.** Re-issued "Century Durability" directive re-ran the C1–C6 sprint's
  three Task-1 vectors (funding overflow, out-of-order reachability, replay
  determinism) — all already closed and property-proven, so **no red→green**
  here. Additive, honest: (1) one genuinely-new property,
  `snapshot_resumption_is_deterministic` — persist an escrow mid-stream,
  reload from bytes across a simulated restart, resume, and demand equality
  with the uninterrupted fold; proves `Escrow` is a lossless state snapshot
  (the persistence boundary a 100-year replay actually lives on). (2) Four
  explicit **named** guards for the directive's exact vectors —
  deliver-before-shipped, refund-after-completed (terminal absorption),
  u64::MAX funding no-overflow, and overfunded-fee-cannot-mask-underfunded-asset
  (independent thresholds, no cross-subsidy). All PASS on arrival; they pin
  the named cases so a future change can't reopen them silently. Task 2 (DRO
  interface boundary) was already delivered as C5. One file
  (`tests/properties.rs`). **escrow-core 43 unit + 10 property; fmt clean.**
  Open consideration flagged to founder: `deny_unknown_fields` (C4) closes the
  schema for replay-determinism, but Article VI mandates *additive* evolution —
  the two pull opposite ways for `EscrowEvent` if it is ever cross-version
  persisted (it isn't today; `CanonicalEvent` is the wire format). Founder call,
  not changed unilaterally.
- `2026-07-04` — **Adversarial hardening sprint — capstone + R-005 pinned.**
  Six commits (C1–C6) hardening the settlement-critical core against an
  attacker's tests, driven by a 5-lens adversarial red-team workflow whose
  every finding was verified against the compiler (not reasoning) before a
  fix was written. Panic-safety: the escrow machine is now **total** — no
  crafted timestamp (overflow) and no forged/deserialized record (missing
  anchor) can panic `transition`; a proptest proves it over 2048 generated
  adversarial inputs per run. Integrity: non-decreasing lifecycle timestamps
  (window-relocation closed), closed serde schema, and the settlement seam
  refuses caller-decoupled or unfunded payouts. R-004 is now a **type
  boundary** (C5). Method note for reviewers: the sprint corrected *itself*
  twice on the record — C3's funding-monotonicity was over-strict (caught by
  composition's daemon, refined in C4), and the overfunding gap is **pinned,
  not silently fixed** because it is a founder economic decision (R-005: add
  `funded_asset_amount` / reject overfunding / treat surplus as tip). Net:
  **escrow-core 43 unit + 5 property, dro-signer 15, full workspace green,
  clippy + fmt clean.** No shipped-path `todo!()`; every reality gate still
  behind its named trait seam.
- `2026-07-04` — **dro-signer C5: R-004 made a type boundary — the DRO cannot
  sign what it hasn't independently confirmed.** Sprint item 2 (R-004's
  structural consequence). New `IndependentChainView` trait — the DRO's own
  eye, a seam deliberately DISJOINT from `zano-watcher`/the event bus — plus
  `ConfirmedMultisigState`, an unforgeable token (private fields, sole
  constructor is the sealed `confirm` wrapper). `ZanoSigner::sign_settlement`
  now REQUIRES that token, so "sign off the indexed/escrow view alone" is
  unrepresentable. The shared `reconcile()` every signer runs: wallet + asset
  must match the intent and the independently-observed balance must cover the
  payouts (checked-sum) — a valid signature over a balance that isn't there
  (the Kelp-DAO failure) can no longer be produced. `settle_transition` takes
  the view and **fails closed** (`Unavailable`) if chain can't be reached —
  never signs blind. Honest boundary, documented on the trait: the type
  enforces *that* a confirmation happened; it CANNOT enforce the view's nodes
  are truly disjoint from the pipeline — that's the deployment contract in
  risk-register R-004, not a compile-time guarantee. Also closed two
  DRO-trusts-caller holes the red-team found (compiler-confirmed): the
  decision now refuses a `new_state` decoupled from `escrow.state`, and
  refuses any terminal payout for an escrow with no `funded_at`. `MockChainView`
  stub (proves the seam, not independence — the firmware/indexer gate).
  Rippled through composition's daemon + both integration tests. +6 dro-signer
  tests (unbacked-refused, asset-mismatch, exact-backed-signs, fail-closed,
  state-decoupled-refused, unfunded-refused). **Full workspace green;
  clippy clean.**
- `2026-07-04` — **escrow-core hardening C4: property-based invariants +
  closed schema; C3 monotonic floor refined (funding exempt).** New
  `tests/properties.rs` (proptest, 2048 cases each): **totality** —
  `transition` never panics for any forged escrow × any event with
  near-ceiling timestamps (the invariant C1/C2/C3 restore; the machine-
  generated adversary a century of contributors won't hand-write);
  **legal-edge** — every accepted transition follows the §9.1 graph and
  terminals absorb; **error-leaves-unchanged**; **replay determinism** —
  identical streams fold byte-identical; **funding is a pure comparison** —
  no overflow/rounding at any u64. Plus `#[serde(deny_unknown_fields)]` on
  Escrow + EscrowEvent (closed schema: an unknown key is rejected, not
  silently dropped — a cross-implementation canonical-parse hazard for
  replay) with 2 tests. **Refinement, named:** the C4 full-workspace run
  caught that C3's `funded_at ≥ created_at` check was over-strict — it
  broke composition's daemon, because `created_at` is the record's
  bookkeeping time while the funding `at` is the observed on-chain
  confirmation, which legitimately predates the record on catch-up/replay.
  Funding is now exempt from the monotonic floor (the lifecycle checks
  ship/deliver/dispute — the window-relocation-relevant ones — stay).
  composition daemon green again. **43 unit + 5 property tests; full
  workspace green.**
- `2026-07-04` — **escrow-core hardening C3: lifecycle timestamps must be
  non-decreasing.** Red-team (reachability lens) found the stored anchors
  (`funded_at`/`shipped_at`/`delivered_at`) took the event's timestamp
  verbatim with no ordering check — so a delivery stamped before shipping,
  or a delivery stamped far in the future, relocated the 7-day dispute /
  auto-release window (compiler-confirmed: delivery@2999 then a 2027 dispute
  both accepted). Fix: `require_monotonic(at, anchor, event)` on all four
  storing arms (funding≥creation, shipping≥funding, delivery≥shipping,
  dispute≥delivery) → new `EscrowError::NonMonotonicTime`. Now a backwards
  stamp is rejected and a future-dated delivery can no longer admit an
  earlier dispute. Honest residual, documented in the error's doc: the
  machine is **clock-free** so it cannot bound a timestamp's *future* — that
  plausibility check belongs to the ingestion layer, which has a real clock.
  +5 tests. (The C1 dispute-overflow test now uses a monotonic `at`, since
  the floor is checked before the deadline.) **41 tests.**
- `2026-07-04` — **escrow-core hardening C2: a forged/deserialized escrow can
  no longer panic transition().** `Escrow` derives `Deserialize` with public
  fields, so the DRO replaying a stream can hold `state = Funded,
  funded_at = None` (and the Shipped/Delivered analogues) — a combination
  `new()` + `transition` can never produce. Four `.expect("state X is only
  reachable by setting X_at")` calls turned that corrupt record into a panic
  that aborts the replay. Fix: a total `require(anchor, state)` helper
  returning the new `EscrowError::InconsistentState { state }` instead of
  `.expect()`. +4 tests, each round-tripping a forged record through serde
  and asserting Err (confirmed PANIC pre-fix via the red-team harness).
  **36 tests.**
- `2026-07-04` — **escrow-core hardening C1: deadline arithmetic can no longer
  panic.** Red-team (5-lens adversarial workflow + compiler-confirmed) found
  `anchor + WINDOW` uses `OffsetDateTime`'s panicking `Add`: a far-future
  timestamp (crafted event `at`, or a deserialized/replayed escrow near the
  year-9999 ceiling) aborts the DRO's replay by panic instead of erroring —
  a liveness DoS in a machine that must fold a century of events. Fix: a
  total `deadline(anchor, window, state)` helper using `checked_add`, routed
  through all 5 sites (Created/Funded/Shipped/Delivered timeouts + the
  Delivered→DisputeOpened deadline, which is computed before the window
  check so even an in-window dispute panicked). New typed
  `EscrowError::DeadlineOverflow { state }`. +5 tests (each confirmed
  PANIC pre-fix via the red-team harness, Err post-fix). **32 tests.**
- `2026-07-04` — **Peer review begun.** Pinned issue #1 ("Peer review open —
  start here") is the front door: ledger-first orientation, the one-command
  verification run, and the claims most worth attacking. GitHub Discussions
  enabled as the second channel. Post-flip CI green on the public repo
  (tests + secret-scan both ✓ on `d94cd57`); README badges live. (Ledger
  repair in this same commit: the PUBLIC entry below was first committed
  mid-file — a mis-anchored insert, same failure class as the d8dd5d7
  blind commit: trusting an edit's anchor instead of checking the result.
  Moved to the top per this section's newest-first rule.)
- `2026-07-04` — **🌍 PUBLIC.** Repository flipped public at HEAD `792f6df`
  on the founder's direct instruction ("we need the repo public today"),
  under the founder's standing interpretation that the §8 legal-review
  flag attaches to **operating the venue**, not to publishing code —
  open-sourcing escrow state machines, DID specs, and indexer code that
  will someday serve a marketplace is ordinary open source, and §8's
  flag remains open for the venue itself. What published: 14 crates
  (146 tests, 1 firmware-gated ignore), the constitution (draft, five
  founder decisions pending), all findings and runbooks, and the
  sanctioned TESTNET-ONLY vectors. Pre-flip audit: full-history secret
  scan clean, single deliberate author identity, licensing structural
  (AGPL-3.0-only / DCO / CC-BY-4.0). Post-flip: GitHub secret scanning
  + push protection ENABLED (now free on public); description + topics
  set; README gained CI badges and a "For reviewers" section. **Peer
  review is open.**
- `2026-07-04` — **dual-chain daemon + permanence anchor.** (1) `composition`
  now ingests from BOTH sense organs: a `zano_loop` polls the view-only
  wallet RPC per watch target (spawn_blocking around the sync client;
  once-per-order emission; outages logged and retried) feeding the SAME
  bus — consumers never learn which chain produced an event. Deviation,
  API-forced: no `view_key` in config (it belongs to the wallet-RPC
  process, not this client); watch targets carry the order context the
  watcher actually consumes. 2 new integration tests: dual-chain (EOS
  block + Zano balance → both escrows Funded on one bus) and
  Zano-outage-500 (EOS path unaffected, poll task retries, no crash).
  (2) `adapter-arweave` (permanence.anchor, built by the review session
  via connected folder, reviewed + adopted here): domain-separated
  Merkle bundles, time-bound versioned header, tamper-refusing mock
  weave; real Arweave gates on gateway + funded AR wallet. Repairs made
  during adoption: the root manifest arrived truncated (whole
  `[workspace.dependencies]` section gone — restored) + one clippy nit.
  **14 crates, 146 tests, 1 ignored.** (An earlier version of this entry
  said 15 — arithmetic error, caught by the review session against the
  directory listing; `ls -d crates/*/ | wc -l` = 14.)
- `2026-07-04` — **§9.3 example set complete: third mapping landed.**
  `arweave:order_shipped → OrderShipped` (the brief's own third example) —
  shipment records from the future arweave watcher carry order context +
  tracking/carrier; `fee_buffer_zano: None` (a shipment is not a funding
  observation). 2 new tests (field-by-field + missing-order_id error).
  All three §9.3-cited mappings now implemented. Chain-reachable escrow
  lifecycle is now Funded + Shipped; Delivered arrives via the carrier
  path, Completed/terminal mappings await schema decisions beyond the
  brief (deliberately NOT invented). **139 tests.**
- `2026-07-04` — **composition: the runtime daemon — the kernel becomes one
  process.** New `crates/composition` (lib + thin binary): EventBus(1024)
  + four wired tasks — ingest (SHIP → extract → embedded zano ABI →
  normalize → publish), escrow consumer (apply + forward Applied), DRO
  consumer (settle_transition + MockSigner over an internal channel: the
  bus carries facts, the channel carries decisions), reputation consumer
  (accumulate → compute at drain). Shutdown discipline: signal stops
  ingest, consumers DRAIN before exit, and the exit report proves it
  (published == escrow_seen == reputation_seen). 2 integration tests
  drive the whole daemon in-process against a mock SHIP server: full
  flow + rejected-second-funding on stream-end, and signal-shutdown
  under a held-open socket exiting in <5s with nothing dropped. Honest
  boundary asserted in-test: only OrderFunded is reachable from chain
  ingest today (§9.3 has two mappings), so settlement intents are
  expected EMPTY — not invented. Binary: `SHIP_WS_URL=… cargo run -p
  composition`. **13 crates, 137 tests, 1 ignored.**
- `2026-07-04` — **adapter-carrier v1: the first real-world evidence sense,
  mock-first.** New `crates/adapter-carrier`: `CarrierApi` trait +
  `MockCarrierApi` (pre-recorded JSON, failure switch) + `map_to_evidence`
  into the dispute engine, and a `CarrierEvidenceProvider` implementing
  the existing `EvidenceProvider` seam. §5's carrier trust model encoded
  as arithmetic, not prose: carrier responses are unsigned →
  `signed:false` caps a lone Delivered scan at effective weight 0.90,
  BELOW the 0.95 auto-enforce gate — one centralized API record supports
  a verdict but can never move money alone; corroborated by a device
  attestation the gate opens (both facts tested). Direction: delivered →
  seller, lost/damaged/returned → buyer, pending/in-transit/unknown →
  weak (0.30) and never promoted. Typed errors for HTTP failure, unknown
  tracking, malformed bodies. Real HTTP client gates on carrier API
  credentials (the named reality gate). 9 tests. **12 crates, 135 tests,
  1 ignored.**
- `2026-07-04` — **reputation-engine v1: the last pure-logic kernel loop.**
  New `crates/reputation-engine`: `compute(&ReputationInput) →
  ReputationScore` — emergent, deterministic, never written directly.
  Constitutional collision resolved and documented: the **component
  vector is canonical** (every point → named source + commitment hash);
  the u64 `score` is one deterministic projection apps may re-weight —
  the kernel computes it, never mandates it. Sybil rule: one attestation
  per unique attester (10-from-one-DID ≤ 1-from-another, tested),
  self-attestation zero, invalid signatures zero. High-provenance
  evidence outranks claims (+15 chain/device vs +2 claim). Bounds
  [0,1000] clamped; zero history → 0 + empty components, no panic.
  Seams: `SignatureVerifier` (real DID sig verification gates on identity
  adapters), `EventStore` (replay gates on b-indexer). Forced additions
  flagged: `as_of_unix` in input (determinism forbids ambient clocks),
  commitment hashes for aggregate components. 12 tests incl. delta →
  `ReputationUpdated` payload round-trip. **11 crates, 126 tests,
  1 ignored. Every remaining milestone now has a reality gate.**
- `2026-07-04` — **dispute-engine v1: Tier-1 adjudication, provenance over
  popularity.** New `crates/dispute-engine`: pure `resolve(&Dispute,
  &[Evidence]) → DisputeVerdict` implementing §5 — provenance-weighted
  confidence (ChainProof .95 > DeviceAttestation .90 > CarrierApi .85 >
  AiInference .60 > UserClaim .30; signed/verified modifiers), same-class
  conflict halves confidence and forces escalation, auto-enforce only at
  conf > 0.95 with an all-high-provenance winning side (AI and user
  claims can support, never authorize — constitution). Split ratios in
  integer math, conservation-guaranteed. Reality (AI inference, vault
  decryption, carrier APIs) gates behind `EvidenceProvider`/`MockProvider`.
  One forced addition to the prompt's structs: `Evidence.favors` (no
  function exists from undirected evidence to a verdict). One flagged
  deviation: additive `dro_signer::settlement_intent_for_split` (ratio →
  payouts, refuses non-conserving ratios) — acceptance #4 required the
  50/50 default to be replaceable, which no integration test could do
  without it. 13 tests incl. ten-claims-vs-one-chain-proof
  (popularity never auto-enforces) and the verdict→settlement full
  circle. **10 crates, 114 tests, 1 ignored.**
- `2026-07-04` — **dro-signer v1: the DRO's decision authority, built at the
  honest seam.** New `crates/dro-signer` per the committed brief:
  `settlement_intent()` — pure function, escrow + new state → payouts
  (Completed→seller, Refunded→buyer, Expired→buyer IFF funded, Resolved→
  50/50 split with odd unit to buyer, everything else → None; fee buffer
  never a payout per §9.2). `ZanoSigner` trait = the typed seam where
  CLSAG_GGX/BP+/tx-serialization plug in when the firmware track exists;
  `MockSigner` proves orchestration with labelled placeholders. 10 tests:
  exhaustive decision table (incl. unfunded-expiry-settles-nothing and
  split conservation), rejected-transition-never-settles, wrong-wallet
  refusal, and the engine→intent→signer full circle (4-transition
  lifecycle → exactly 1 settlement). Zero `todo!()` — unbuilt crypto
  lives behind the trait, not a panic. 9 crates now.
- `2026-07-03` — **zano-watcher: the Zano sense adapter, LIVE-observed.**
  `(dev-chain observed — local testnet, not publicly reproducible)`
  New `crates/zano-watcher` — a **view-only wallet-RPC scanner** (Zano is
  confidential; you scan with a view key, you don't parse blocks). RPC
  shape source-verified (`getbalance` per wallet_rpc_server.h /
  COMMAND_RPC_GET_BALANCE); maps an observed balance → `RawChainAction`
  (contract "zano"/transfer) carrying asset amount AND observed native
  ZANO as `fee_buffer_zano` (zero stays zero — never invented). 6 unit
  tests (source-shaped responses, error typing, normalize round-trip).
  **LIVE**: served a **watch-only** export of the funded testnet buyer
  (spend-incapable — safe to serve auth-off, bound to the WSL vNIC only)
  over real wallet RPC; the WSL-built watcher read **100 fUSD** off it,
  normalized to OrderFunded. **Both halves of the §9.2 check proven on
  live chain state:** (1) while native tZANO was lock-maturing, observed
  `fee_buffer_zano: 0` → escrow-core **refused** (`InsufficientFunding
  zano_provided:0`); (2) after the native unlocked (1 tZANO = 1e12
  atomic), re-observed → escrow-core **accepted** → `Ok(Funded)`.
  Refusal-when-absent AND acceptance-when-present, both real, no mock.
  Next: `crates/dro-signer`.
- `2026-07-03` — **🏁 ITEM 4 COMPLETE — LIVE: chain bytes drive escrow-core.**
  `(dev-chain observed — local dev chain, block 2832; not publicly reproducible)`
  New `crates/escrow-engine`: bus consumer replaying CanonicalEvents into
  `escrow_core::transition` (OrderFunded/Shipped/Delivered/Completed →
  BuyerFunded/SellerShipped/DeliveryConfirmed/BuyerReleased; dispute
  family gates on the DRO milestone; Timeout stays timer-driven). Schema:
  `OrderEvent.fee_buffer_zano: Option<u64>` added (§9.2 dual-balance —
  unobserved = 0, never guessed). 5 unit tests + integration test (mock
  SHIP → state machine: full funding → Funded, partial → refused, state
  untouched). **LIVE PROOF on the real dev chain**: codeless `zano`
  account + on-chain ABI → real `zano::transfer` tx `8f8395be…` in block
  2832 → streamed, extracted, ABI-decoded, normalized, bused →
  `ESCROW order-live: Ok(Funded)`. Recipe in runbook §4b. The five-item
  sequence is now 5/5 ✅.
- `2026-07-04` — **Article VI §3 ratification draft versioned (awaiting founder
  decisions — NOT ratified).** `docs/article-vi-ratification-draft.md`:
  OREC adapted to kernel amendments (Proof gate before any vote; staged
  founder→OREC→sovereign epochs on measurable triggers; steering
  relinquished before the brake) plus the draft's sharpest idea — a
  strictly-hardest **meta-tier** for anything touching reputation-engine,
  its evidence flows, or Article VI itself, because *the component whose
  capture hides itself gets the hardest supermajority*. Door-review fixes:
  OREC citation **pinned** (sim31/ordao@4a10ee55a413, GPL-3.0, cited not
  vendored) and one blocking-fraction arithmetic error corrected
  (K_meta=8 blocks at a ninth of turnout, not a quarter) — with the
  *intent* behind that divergence (ninth vs quarter, K=8 vs K=3)
  escalated into the decisions list rather than silently resolved by
  whichever side of the typo survived. **Five founder decisions**
  enumerated in the draft — the fifth added on review: the meta-tier
  founder co-sign is a Ulysses pact and must carry its own *named,
  measurable* exit condition (candidate: maturity thresholds + N
  incident-free years + K_meta supermajority + founder assent →
  ceremonial guardian-key destruction), because a brake with no exit
  condition has merely renamed the captor. The placeholder retires only
  when all five are made. Conventions hardened alongside: **single-writer per
  draft** and **cite-and-pin, never vendor** (CONTRIBUTING.md).
- `2026-07-04` — **did:autonomi method spec v1 adopted (research lane, one-door
  review).** `docs/architecture/did-autonomi-spec.md` — retires the brief's
  L0 open item ("exact DID linkage proof format"): self-certifying genesis-
  hash identifier, append-only signed rotation log on Autonomi, mandatory
  per-op `keyAlg` (crypto-agility as data), bidirectional-only persona
  links, and a recovery **contest window** (recovery must be slower than
  theft-detection). Standout design move: §6 step 4 cross-checks the log
  head against the daily Arweave anchor and HARD-FAILS on mismatch — which
  downgrades "are Autonomi registers truly append-only?" from load-bearing
  vendor claim to nice-to-know. Review found one §6/§11 contradiction;
  resolved concurrently by the research lane.
- `2026-07-04` — **risk register seeded** (`docs/risk-register.md`, adopted +
  relocated per its own header). Headline: **R-001 — DRO liveness IS the
  refund guarantee** (no chain timeout exists; a vanished seller means
  refund = buyer + DRO signatures, so DRO downtime during a timeout window
  strands buyer funds). Mitigation shape recorded for the future
  `bnature.dro` build: threshold-held signer key, monitored uptime,
  published liveness SLO. R-002 fUSD peg (mechanism live), R-003 off-chain
  timeout is safety-critical code (hermetic, keep it so).
- `2026-07-04` — **fUSD peg monitor: intention → mechanism (§8).**
  `docs/fusd-peg-monitor.md` (research lane, run zero; reviewed and
  committed through the one-door convention now codified in
  CONTRIBUTING.md). Weekly public-data watch on the two things that can
  break an escrow's value: solvency (collateral ratio) and exit
  liquidity (ZANO⇄fUSD DEX depth), with Green/Amber/Red thresholds and
  a founder-attention gate: any Red or double-Amber → pause NEW fUSD
  escrow creation (more conservative lever than §8's suggested
  auto-enforce pause). Baseline 2026-07-04: peg tight ($0.9992); the
  **canonical collateral ratio is UNRESOLVED** — secondary sources span
  1.18×–10×, and the low end already sits Amber/Red — first weekly run
  must pin it from freedomdollar.com's reserve page; if that page won't
  yield a number, the opacity is itself the Amber signal.
- `2026-07-04` — precision amendment to the §1.7 line below: the asset was
  the **official testnet deployment of fUSD** — dispensed by Zano's own
  testnet faucet (`faucet.testnet.zano.org`, ticker FUSD, name "Freedom
  Dollar"), carrying the distinct testnet asset id already recorded — not
  a self-minted stand-in. Same contract semantics, testnet instance;
  mainnet-id observation remains a mainnet-only follow-up.
- `2026-07-03` — **✅ §1.7 FEE BUFFER VERIFIED LIVE WITH fUSD.**
  `(dev-chain observed — local synced testnet node, not publicly reproducible)` Local synced
  testnet + API faucet (dispenses fUSD): buyer held 100 fully-unlocked fUSD
  and exactly 0 native ZANO → fUSD transfer FAILS at the wallet layer
  (`not_enough_money … required: 0.01 (fee)`, wallet2.cpp:7793). The §9.2
  constraint holds for the real marketplace denomination; escrow-core's
  dual-balance funding check is validated against reality. Testnet fUSD
  asset id recorded (differs from mainnet, absorbed by `(amount,
  asset_id)` — zero code changes). Remaining: full 2-of-3 multisig flow
  needs `crates/dro-signer` (no stock RPC surface — see refutation entry).
- `2026-07-03` — **🔗 LIVE SHIP INGESTION: real blocks through our codec.**
  (dev-chain observed — local nodeos; the codec itself is unit-reproducible:
  `cargo test -p chain-eos`)
  Sequence items 2+3. WSL installed (owner reboot) → Ubuntu 26.04 → Spring
  v1.2.2 single-producer nodeos with state_history on `127.0.0.1:8080` →
  chain-eos (built and run inside WSL — Windows cargo is now fully
  SAC-blocked, runbook fallback is the live path) completed the real
  handshake: 35,704-byte SHIP ABI frame, head status, consecutive blocks
  at production rate, ZERO decode errors from the hand-rolled codec. Real
  action proof: `cleos create account` → `Block 682, Action Count: 1,
  actions: eosio::newaccount` — extraction + name codec verified on live
  bytes. All four runbook checklist items ticked. Zano vector tests also
  re-verified on the WSL toolchain (third independent environment):
  9 passed / 1 ignored.
- `2026-07-03` — **DRO signing path DECIDED: Option 2** — the DRO is a full
  transaction constructor on the proto v0.3 coordinator path (same as buyer
  and seller), building its own co-signing txs through its attestation tier.
  No bridge custody, no external RPC dependency, no wallet2 linkage. Scoped
  future milestone: `crates/dro-signer` (after live ingestion). escrow-core
  unchanged — the refutation was about *how* the DRO signs, never *when*.
- `2026-07-03` — **⚠ MULTISIG RPC CLAIM REFUTED + testnet live.** Source
  verification of the §8 claim "DRO signs via standard
  `sign_multisig_proposal` RPC": **that RPC does not exist in master** — no
  raw multisig RPC at all; only the built-in two-party escrow contracts
  (`contracts_*`), which are ZANO-only (no `asset_id`) and have no arbiter
  slot. Consensus `txout_multisig` + wallet-internal machinery DO exist —
  the capability is real, the stock external co-signer API is not. Four
  DRO-integration options recorded in
  `docs/architecture/zano-timelock-findings.md` (decision pending). Also:
  local testnet node UP (official v2.2.0.489, RPC :12111, syncing to
  ~83.6k), buyer wallet faucet-funded with **100 fUSD + 5 tZANO** (faucet
  carries fUSD on testnet — §1.7 fUSD-specific flow is runnable). Seller
  faucet-blocked 24h per IP (escrow funding only needs the buyer).
- `2026-07-03` — **TIME-LOCK QUESTION ANSWERED (source-verified).** Brief §8's
  open item closed against `hyle-team/zano` master with file/line citations —
  `docs/architecture/zano-timelock-findings.md`. Answer: multisig proposals
  are off-chain objects → **no native proposal timeout exists; escrow-core's
  off-chain timeout model is confirmed required** (assumption → verified
  fact). `unlock_time`/`unlock_time2` are spend-delay locks (never refund).
  Bonus: consensus-enforced **transaction expiration**
  (`etc_tx_details_expiration_time`, checked at tx pool AND block inclusion)
  → pre-signed release/refund txs can be made unbroadcastable after a
  deadline — race-condition hardening for the future Zano action adapter.
  Fee-buffer half: already confirmed (§9.2); the fUSD-specific §1.7 rerun
  still needs the testnet (official testnet build v2.2.0.489 downloaded,
  SHA256-verified vs docs.zano.org, daemon syncing; faucet needs a human).
- `2026-07-03` — **DERIVATION PROVEN AGAINST STOCK ZANO.** Sequence item 5,
  done from the session: stock simplewallet v2.2.1.501 downloaded (official
  build server), throwaway never-funded wallet generated offline, secrets
  exported, vector committed (`testvec.rs`, TESTNET-ONLY markers). keys.rs +
  view.rs compatibility tests un-ignored and GREEN — `dependent_key`, S, and
  V all reproduce stock outputs, with expected publics decoded from the
  wallet's own address (CN-base58 + Keccak checksum) for zero circularity.
  chain-zano: 9 passed / 1 ignored (slip0010 e2e, gates on firmware track).
- `2026-07-03` — **local SHIP node runbook written** —
  `docs/runbooks/local-ship-node.md`: WSL install → Spring/nodeos single
  producer with `state_history_plugin` on `ws://127.0.0.1:8080` →
  chain-eos against it → deploy eosio.token for real action data (first
  live ABI decode). Four-point verification checklist. Blocked only on
  the owner's `wsl --install` + reboot (attempted from the session:
  needs elevation).
- `2026-07-03` — **THE SEAM IS GLUED: Antelope ABI decoder (`chain_eos::abi`).**
  Binary action data → JSON: aliases, struct bases, optionals, arrays, and
  the marketplace-relevant built-ins (name/string/asset/symbol/checksums/
  time_point_sec/ints); exotic types (128-bit, keys, variants, binary
  extensions) are typed `Unsupported` errors, never guesses; leftover bytes
  after decode = `TrailingBytes` error (a wrong ABI cannot silently
  mis-decode). 8 unit tests + `tests/full_pipeline.rs`: SHIP block bytes →
  extract → ABI decode → RawChainAction → normalize → event-bus → consumer
  asserts field values traced from the binary payload. chain-eos: 23 tests.
  The pipeline is now COMPLETE in code; runtime ABI *fetching* (get_abi
  RPC or pinned files) lands with the real endpoint. Remaining milestones
  are all reality: WSL/endpoint, live events, escrow wiring, Zano vectors.
- `2026-07-03` — **§6 stretch complete: checkpoint/watermark.** The binary
  persists the last processed block (`SHIP_WATERMARK_FILE`, default
  `chain-eos.watermark`) and resumes from watermark+1 on restart;
  `stream_ship(url, Some(n), …)` skips the status round trip entirely —
  asserted by a second mock-server test (server rejects any first message
  that isn't get_blocks at exactly n). chain-eos: 14 tests. Every §6
  Phase 1 + stretch item is now done except the Redpanda bus (superseded
  locally by event-bus; networked bus = Phase 3 decision).
- `2026-07-03` — **§6 mock-server integration test: the handshake is proven.**
  The stream engine moved out of `main.rs` into the lib (`stream_ship()`,
  event-callback API; binary keeps only retry policy + printing) and is now
  exercised by `tests/mock_ship_stream.rs`: a real tokio-tungstenite SERVER
  speaks the SHIP protocol over a live local socket — ABI frame, asserts
  the client's status request, answers head, asserts the get_blocks request
  starts at that head, streams two blocks, closes. Both protocol directions
  tested; blob builders promoted to `pub mod blobs` (one mirror encoder,
  shared by unit tests, the mock server, and future capture tooling).
  chain-eos: 13 tests. When a real endpoint exists, `main` is a thin shell
  over an engine that has already spoken the protocol end-to-end.
- `2026-07-03` — **§6 stretch: action extraction + name codec + bus proof.**
  chain-eos now *produces* actions, not just counts: EOSIO name codec
  (u64 ↔ "lovismarket", verified against the known `eosio` vector) and
  `extract_actions()` → account/name/tx_id(sha256)/raw data, sharing one
  receipt walker with the summary (4 new tests, 12 total). Integration
  test `normalizer/tests/pipeline_to_bus.rs` proves the nervous system
  end-to-end: RawChainAction → normalize → event-bus → two independent
  consumers see the same CanonicalEvent; chain noise never enters the bus.
  **The one unglued seam is now precisely the ABI decoder** (binary action
  data → JSON fields) — everything on either side of it is built and
  tested. Machine note: no WSL/Docker on this host; the local-SHIP-node
  option needs `wsl --install` + reboot (owner action).
- `2026-07-03` — **tests now gate every push (CI `tests` workflow).** Build +
  test + fmt on ubuntu runners. Motivated by a real failure: Windows Smart
  App Control intermittently blocks freshly built unsigned test exes
  (os error 4551), so local verification on the dev machine is best-effort
  and **CI is authoritative** for test state. (SAC fix is a one-way door —
  owner's call, undecided.)
- `2026-07-03` — **§6 prereq check answered: no public SHIP endpoint exists
  for jungle4.** Verified against the Jungle Monitor, the testnet install
  docs (State History section is empty), and every producer's on-chain
  bp.json (`ship_disclosure` there means *ownership*, not SHIP). Options,
  cheapest first: (a) local single-node Antelope chain with
  `state_history_plugin` via Docker/WSL — full SHIP handshake, zero testnet
  dependency; (b) ask in the Jungle Telegram — operators share SHIP URLs on
  request; (c) paid SHIP (EOS USA) or Pinax substreams (different protocol,
  needs an adapter). Note for (b)/(c): endpoints will be wss:// — add
  tokio-tungstenite's `native-tls` feature (schannel on Windows, no cmake).
- `2026-07-03` — **chain-zano compiles; internal tests green (7 + 3 ignored).**
  The STATUS "do first" `cargo build` item resolved with ZERO code changes —
  the curve25519-dalek 4.x spellings were right all along. Doc-comment lint
  fixes + rustfmt only (semantics untouched per the no-reopening rule). The
  full six-crate workspace now builds clean; README quickstart is literally
  true. The three `#[ignore]`d vector tests remain the reality gate.
- `2026-07-03` — **event-bus: in-memory CanonicalEvent fan-out green.**
  `crates/event-bus` — `EventBus` over `tokio::sync::broadcast`:
  publish/subscribe, no-subscriber publishes drop silently, laggards get
  `Lagged` and skip ahead without blocking anyone, late subscribers see
  only future events (all pinned by 6 tests). `BusError` is an empty enum
  — the in-memory bus has no failure modes; the type keeps `publish`'s
  contract stable for a networked backend (bus choice = Phase 3 per §6).
  Runtime nervous system is now complete in pure logic: chain-eos →
  normalizer → event-bus → consumers. **Pivot point: reality.** Next work
  requires a live SHIP endpoint or Zano testnet, not more logic crates.
- `2026-07-03` — **normalizer: raw actions → CanonicalEvents green (§9.3).**
  `crates/normalizer` — `RawChainAction` + `normalize()` with the two §9.3
  mappings (`lovismarket:addlisting → ProductListed`, `zano:transfer →
  OrderFunded`). Unmapped actions `Ok(None)` by design; recognized-but-
  malformed payloads are typed errors (missing field / bad type), never
  guesses. 7 tests: both mappings, ignore path, both malformed paths,
  timestamp default, serde round-trip. Ingestion pipeline is now complete
  end-to-end in pure logic: SHIP bytes → decode (chain-eos) → normalize →
  CanonicalEvent (shared-types). Next: wire chain-eos action unpacking to
  RawChainAction against a real SHIP endpoint, or Zano findings follow-up.
- `2026-07-02` — **chain-eos Phase 1: SHIP ingest + block decode green (§6).**
  `crates/chain-eos` — hand-rolled minimal SHIP codec (Verification
  Principle: crates.io check showed the `eosio` crate is a contract SDK
  dead since 2020-02, `eosio-shipper` nonexistent). Decodes result
  envelope, block_position, signed_block walk → tx + action counts (block
  num cross-derived from header `previous`). Binary: tokio-tungstenite
  handshake (ABI → status → stream), retry/backoff, `SHIP_WS_URL` env.
  ws:// only (rustls needs cmake/NASM on windows-gnu — TLS deferred).
  8 tests vs synthetic blobs inc. truncation + bad-flag paths. No live
  node tonight → mock path per §6 prereq. Toolchain note: raw-dylib deps
  need mingw binutils — WinLibs installed; add its bin + ~/.cargo/bin to
  PATH (see README). Next: run vs real SHIP endpoint, then normalizer.
- `2026-07-02` — **shared-types: canonical event schema green (§9.3).**
  `crates/shared-types` — `CanonicalEvent` envelope, `SourceChain`, flat
  `EventType` (16 variants, `DIDLinked` JSON rename), family `EventPayload`
  (adjacently tagged `{"type","data"}`). DIDs not raw keys; `(amount,
  asset_id)` never a hardcoded currency; message content never on the bus
  (Autonomi ref only). 5 tests: full round-trips + mock Vaulta
  `lovismarket:addlisting → ProductListed`. Next: normalizer or chain-eos
  Phase 1 (§6), or Zano findings follow-up.
- `2026-07-02` — **escrow-core: state machine + exhaustive tests green.**
  `crates/escrow-core` per brief §9.1–9.2: `EscrowState`, `Escrow` (with
  `fee_buffer_zano` and dual-balance funding check), `transition()` enforcing
  the full table + timeouts, time only via events (hermetic tests). 27 tests:
  every valid transition, exhaustive 9×7 state/event rejection matrix,
  timeout boundaries, partial-funding rejection, dispute-window edge, serde.
  clippy + fmt clean. First `Cargo.lock` committed (tracked per decision).
  Brief + CONSTITUTION now versioned in `docs/`. Next: canonical event types
  (§9.3) or Zano findings follow-up.
- `2026-07-02` — secret scan is now remote-enforced: shared rules live in
  `scripts/secret-scan.sh` (hook delegates in `diff` mode; CI runs `tree` mode
  on every push/PR via `.github/workflows/secret-scan.yml`). Fresh clones that
  skip hook setup are caught server-side. Exemptions: `Cargo.lock` (public
  sha256 checksums), and a **same-line `TESTNET-ONLY` marker** — the sanctioned
  path for the future compat-test vector (an unmarked vector fails CI even if
  committed with `--no-verify`).
- `2026-07-02` — pre-commit secret guard: `.githooks/pre-commit` blocks 48+ char
  hex runs, PEM private-key blocks, and secret-extension files (even `add -f`)
  from entering history. Enable per clone: `git config core.hooksPath .githooks`
  (in README Quickstart). Deliberate exceptions: eyeball, then `--no-verify`.
- `2026-07-02` — `8797d66` initial commit (16 files: chain-zano, docs, proto,
  workspace config) pushed to private `github.com/beehive-nature/beehive-nature`,
  `main` tracking `origin/main`. Staged diff scanned for secret material before
  commit (grep + long-hex pass): clean. **Next file: escrow-core.**

## Done — source-confirmed (staked against `hyle-team/zano/src/crypto`)

- **Key derivation, end to end**
  - `s = sc_reduce(seed[0..32])` — `crypto.cpp keys_from_default`
  - `v = keccak256(s) mod ℓ` — `crypto.cpp dependent_key` (Keccak256, not Sha3_256)
  - `I = s·Hp(P)`, `Hp(P) = mul8(ge_fromfe_frombytes_vartime(keccak256(P)))` — `generate_key_image`
  - Address `{S, V}`, both derivation paths, view-only restore
  - SLIP-44 coin type **1018** (verified against the SLIP-0044 registry by hand)
- **Wire contract — `proto/messages-zano.proto` v0.3 (frozen)**
  - Staged flow; `s` and secret scalars never on the wire
  - `CLSAG_GGX_signature` `{c, r_g[], r_x[], K1, K2}` — matches `clsag.h`
  - `bppe_signature` `{L[], R[], A0, A, B, r, s, δ1, δ2}` — matches `range_proof_bppe.h`
  - `generate_CLSAG_GGX` confirmed **single-pass** (K1/K2 before challenge, no BP+ read) — `clsag.cpp` 189–330
  - `1/8` rule pinned per field (host sends RAW; firmware scales internally)
- **Architecture**
  - Trezor-native decision (`s` never on host)
  - Kernel / adapter separation; identity-less-settlement privacy invariant

## Not done — the real remaining work

### Highest value, cheapest, do first
- [x] **Un-ignore the compatibility tests.** DONE 2026-07-03: throwaway wallet
      generated with stock simplewallet v2.2.1.501 (offline), secrets exported
      via `spendkey`/`viewkey`, vector committed with TESTNET-ONLY markers
      (`chain-zano/src/testvec.rs`, incl. a CN-base58 address decoder so the
      expected publics come from stock's own address, independent of our code).
      Both tests GREEN: `dependent_key` (v = keccak256(s) mod l) and S/V match
      stock. **Derivation claims are now PROVEN, not asserted.** Still ignored
      (correctly): `slip0010::composes_with_keys_module` — the Beehive-specific
      end-to-end (Trezor seed → Zano keys) has no external reference tool; it
      gates on the firmware track.
- [x] **`cargo build` pass.** DONE 2026-07-03: compiled clean on the first
      attempt — the dalek 4.x spellings were correct as written; zero code
      changes needed. 7 internal-consistency tests green, 3 vector tests
      still `#[ignore]`d awaiting reality (correct). Full workspace builds.

### Known, scoped, larger
- [ ] **Trezor firmware app** — on-device `CLSAG_GGX` implementing the proto.
      This is what makes "`s` never leaves the device" *true* rather than
      *specified*. Separate repo (fork of `trezor-firmware`). Unstarted.
- [ ] **Two unread crypto bodies** (fill-in, not architecture):
      balance proof `generate_double_schnorr_sig` (`zarcanum.cpp`) and the
      tx-prefix serialization contract (byte-exactness / vector test).
- [ ] **`mnemonic_encoding` port** — 25-word phrase → 32-byte seed, for full
      stock-wallet restore. Plain encoding, no crypto risk. `common/mnemonic-encoding.h`.
- [ ] **RPC scanner** (`chain-zano` adapter) — reads the chain, emits
      identity-less `CanonicalEvent`s. Pure I/O; needs no firmware.

### Not an engineering task — do not defer indefinitely
- [ ] **Legal review.** Hemp-seed futures as a regulated venue; and keeping any
      "conceal a regulated medical treatment" framing OUT of the design thesis.
      Flagged, not resolved. Needs a lawyer, not another model.

## Known minor cleanups (non-blocking)
- `ZANO_SLIP44_COIN_TYPE` and the `s→v` hash are defined in both `keys.rs` and
  (respectively) `slip0010.rs` / `view.rs`. Harmless duplication; centralize later.
- `slip0010.rs` still exposes `derive_spend_secret` (walk + reduce in one). An
  optional refactor splits out `derive_slip0010_leaf` (raw leaf) from the
  Zano-specific `mod ℓ` step for a cleaner standard/Zano boundary.

## Process note
The multi-model relay was productive early (it caught the ECDH split-brain, the
HMAC-pubkey error, SLIP-0010 misconceptions) but drifts toward re-litigating
settled ground once the design is locked. From here, point the tooling at the
**compiler and the source**, not at another generate/review lap.
