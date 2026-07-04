# STATUS — honest done / not-done ledger

The one-line summary for any new reader or AI:

> **The cryptographic design is source-confirmed, the wire contract is frozen,
> and the host-side derivation is PROVEN against stock Zano (real vector,
> 2026-07-03). The firmware and the legal review are the unstarted work
> between here and anything a user touches.**

Do not let AI-to-AI review re-open the items under "Done." If you believe one is
wrong, cite the Zano source file/line and stop — do not rewrite it.

## Repo state — last known good

One line per milestone; newest first. This section, not any AI's memory, is the
authoritative record of where `origin/main` sits.

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
- `2026-07-03` — **✅ §1.7 FEE BUFFER VERIFIED LIVE WITH fUSD.** Local synced
  testnet + API faucet (dispenses fUSD): buyer held 100 fully-unlocked fUSD
  and exactly 0 native ZANO → fUSD transfer FAILS at the wallet layer
  (`not_enough_money … required: 0.01 (fee)`, wallet2.cpp:7793). The §9.2
  constraint holds for the real marketplace denomination; escrow-core's
  dual-balance funding check is validated against reality. Testnet fUSD
  asset id recorded (differs from mainnet, absorbed by `(amount,
  asset_id)` — zero code changes). Remaining: full 2-of-3 multisig flow
  needs `crates/dro-signer` (no stock RPC surface — see refutation entry).
- `2026-07-03` — **🔗 LIVE SHIP INGESTION: real blocks through our codec.**
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
