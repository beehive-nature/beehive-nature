# DISPATCH MAILBOX — INDEX
**Maintained by:** Cowork (document seat) — **STANDING DUTY**, ruled 2026-08-09 under
delegated authority. Updated on **every** mailbox change: addressee · status · gating word ·
receipt commit.
**Authorization:** founder word "index and whatever" (2026-08-07); endorsed Seat 1; made a
standing duty by Seat 1 under the AUTONOMY DIRECTIVE (2026-08-09).
**Rule:** the bus carries its own state. A seat opening this directory reads status here
before acting, killing the stale-board error class at the root.

**Last updated: 2026-08-09** — autonomy directive landed; R1a/R6 format lane recorded;
push state refreshed against `origin/main`.

**📖 THE LAW LIVES IN [`DIRECTIVE_AUTONOMY_2026-08-09.md`](DIRECTIVE_AUTONOMY_2026-08-09.md),
NOT IN THIS HEADER.** Determination by Cowork, per Seat 1's "whichever you determine is the
durable home": **the directive is the law book; this INDEX is a board.** Rows here churn and
get rewritten — a law parked in a manifest expires with the manifest, which is 8s exactly.
So both new laws — **POST-PUSH REVIEW** (named second-seat reader on any consensus-critical
or spec-ruled push; a review, **never a gate**) and the **LINEAR-HISTORY DOCTRINE** (two
seats holding unpushed commits: **hold**, or **publish under explicit attribution**; no
third option) — are recorded there in full. **This board carries the pointer, because this
board is what a seat reads at push time.**

**⚠ GATING-WORD COLUMN, READ THIS FIRST:** under the AUTONOMY DIRECTIVE the **per-push
founder word is RETIRED**. Rows below whose gate reads "founder word" are **historical
records of how that item cleared at the time**, not live gates. Current gate for a push =
**Seat-1 ruling + standing pre-flight** (secret scan · 48-hex accounting · never
`--no-verify`). Founder retains veto. **Absolute and NOT delegated: mainnet untouched, no
mainnet key in any seat.**

## Live dispatches

| File | To | Kind | Gating word | Status | Receipt |
|---|---|---|---|---|---|
| `DIRECTIVE_AUTONOMY_2026-08-09.md` | **all seats** | ⭐ **OPERATING LAW** | Seat 1 (delegated) | **IN FORCE 2026-08-09.** Autonomous building. Authority resolves at Seat 1 by the founder's algorithm (10B users / 1000 yr / no centralized bottleneck-gate-MiM / performance improves with user count; tiebreaker: WWDLD). Founder interrupted ONLY for manual tasks — credentials, accounts, hardware, values/names. **Per-push founder word RETIRED**; pushes clear on Seat-1 ruling + standing pre-flight. **Founder retains veto. NOT DELEGATED, ABSOLUTE: mainnet untouched, no mainnet key in any seat.** Post-op notes, 8a receipts, 8c flag-don't-absorb unchanged | landed this turn |
| `SPEC_RESOLVER_VALIDITY_RULES_2026-08-08.md` (rev 6+) | Code / all | **Spec — R0–R6 NORMATIVE** | Seat 1 | **CANON, and the format is now fully pinned.** R1a: 4-byte **BE** length prefix on **every** field **without exception** (fixed-width integers included — `_lp(int8(v))`); integer field bytes = **8-byte BE unsigned** (4-byte overflows 2106, fails the 1000-year test); **`sig` length-prefixed**. R1b: reject non-canonical `S` (`s < L`) explicitly — never rely on library accident. R6a tags `0x00`/`0x01`; R6b **promote-unchanged** (CVE-2012-2459); R6c binary proof encoding; R6d k=10 / page 1,024 / `d = ceil(log2 N) − 9`. ⚠ **Working copy is UNCOMMITTED in-tree** (goose's lane) — the ruled text above is committed only where the post-ops quote it | see post-ops |
| **R1a/R6 FORMAT LANE — RECONCILED** | Code + Cowork | **Cross-implementation proof** | Seat 1 | ✅ **CLOSED, MATCH 2026-08-09.** RECONCILE-V1 record through **both** implementations: canon **113 B** identical; leaf ed25519(64 B) `092eac0e…` and leaf DER(71 B) `eff1e56e…` identical. Cross-**CONSTRUCTION**, stronger than each-runs-the-other's-vector. **EPOCH LADDER (standing, keep in the header): 147–149** valid for ordering/inclusion/lifecycle ONLY · **150–152** commit to records under a **non-final integer encoding** · **153+** commit under the **fully pinned format** (153/154/155 landed, chain-linked, foreign-oracle verified, 8s surface PASS) | `POSTOP_COWORK_RECONCILE_V1` · `_UNCONDITIONAL_PREFIX` |
| `021c013` — canon reconciliation harness | Code (Seat 3) | Commit — push ruling | **Seat 1: PUSH** | **RULED PUSH — awaiting Code's execution + remote sha.** Adds `tests/r6/reconcile.py` + `xcheck.py`. ⚠ **Cowork review, recorded not absorbed:** (a) `xcheck.frames()` parses both sides as uniformly length-prefixed, so under an **exception-class** divergence — the framing case it exists to diagnose — it mislocalises fields rather than reporting the real fault; **fix dispatched to Code** (assert 7 frames on both sides first, else report *"framing itself diverged"*). (b) The harness needs **both repos**: Windows here has no Python on PATH and the sandbox does not mount `b-domain`, so **Cowork could not run it** — the proof is committed but still not re-runnable from this repo alone. goose holds the expected-value fixture that closes (b) | pending Code |
| **SECOND READ — `atmirror` record-sig · epoch-funding · rail** | **goose** | ⭐ **POST-PUSH REVIEW (first one live)** | Seat 1 | **OPEN — goose executing.** Verify against the **construction, not the post-op's word**, VERIFIED/REFUTED per claim: (1) `atmirror::record_sig` — `s < L` runs on the **raw scalar BEFORE any library call**, `L_LE` cross-validation is real, and the `s+L` control proves **genuine** malleability rather than a strawman; (2) `atmirror::epoch_funding` — the invariant fires on **leader-delegate AND on no-delegate**, both 8r controls failing if the breach stops being detectable; (3) **rail construction** — delegate path **per claimant**. **One leader-delegate rail across per-name items is the breach (8s/8t)** | pending |
| `SPEC_RESOLVER_VALIDITY_RULES` — uncommitted diff | goose | Provenance determination | Seat 1 | ✅ **CLOSED.** goose committed it — **revs 7–17** landed in `d221c0d` (R1a format pins, R1b canonical scalar, R6c–e, depth rule, occupancy threat, vector criterion). Working tree verified clean of it this turn. The ruled R1a text is now a **committed** file and safe to quote as canon | `d221c0d` |
| **Expected-value fixture** — `tests/r6/expected_values.py` | goose; **Code (Seat 3) = named post-push reviewer** | Fixture + single-repo checker | Seat 1 | ✅ **COMMITTED AND VERIFIED BY COWORK, single-repo.** `PASS: canon 113B, both leaves match`, exit 0, with **no `b-domain` and no second implementation present** — which is exactly the residual it was built to close. **Control run on the checker itself:** flipping `INT_PACK` to little-endian makes it exit 1 on all three lines, so it is **not vacuously passing.** Code's post-push review still owed | `d221c0d` |
| **`atmirror` — record-sig + per-claimant funding** | Code (Seat 3) | Implementation, awaiting second read | Seat 1 | **LANDED, UNREVIEWED.** `9239609` ed25519 record-sig with explicit R1b `s>=L` reject; `8feaa79` per-claimant funding wiring + the 8s `epoch_funding` invariant with two 8r controls (`one_leader_rail_across_items_is_the_breach`, `no_delegate_is_a_breach`). Code reports 3/3 epoch_funding, 43/43 atmirror lib. **Not read by Cowork — Rust is outside this seat's lane; goose holds the second read** | `9239609` · `8feaa79` |
| **COWORK R6/R1a SUITE** — `tests/r6/` | all seats | **Standing conformance suite** | — | ▶ **ENTRY POINT: `python tests/r6/run_suite.py`** — exit 0 = **4/4 suites** (canon 32/32 · R6 93/93 · sig 10/10 · fixture PASS) **AND the bytecode guard confirmed engaged.** ✅ **PYCACHE HAZARD NOW STRUCTURALLY PREVENTED, not just documented** (ruled by Seat 1). Mechanism: **`PYTHONPYCACHEPREFIX` to a fresh temp dir per run** — `rm -rf __pycache__` **rejected** (undeletable on the mount that produced the bug) and **`-B` rejected** (stops *writing* bytecode, not *reading*); both tried against the live failure. The 8r control reproduces **the dangerous direction** — source BAD, cached bytecode GOOD, metadata forged current → **unguarded run PASSES, guarded run FAILS.** ⚠ Direct `python test_canon.py` is still foolable, deliberately (keeps suites usable standalone) | `POSTOP_COWORK_PYCACHE_GUARD` | Carries the negative controls per 8r — pipe-join collisions, CVE-2012-2459 duplication, permissive-Ed25519 `s+L`, exception-class framing. **DO NOT delete a control to make a failing test pass; its job is to accept/exhibit what the ruled format must reject** | `f906c3a` |
| `DISPATCH_BNR_INVITE_ONBOARD_2026-08-08.md` | **unrouted** — Seat 0/1 to docket the spec draft | Dispatch (6 invite/onboard directives, creatormagic recon of Buzz) | — | **LANDED 2026-08-08** by Seat 3 (founder relay; verbatim; provenance grep clean). Items 3/4/6 ALIGNED with CD-13 / `identity.mobile` Tier-1 / KISS canon. **2 escalations open:** E1 — adopted invite-rationing-by-rank (`b-tokenomics.md` §2.10) vs owner-set use-count sliders (items 1b/5): does rationing govern Buzz-surface invites?; E2 — invite-join identity mint lands on the funded-wallet composition question **in flight** ("no seat builds against either reading"). Fences recorded: F1 P-13 (invite gates a community's door, never THE door), F2 P-1 (redemption emits nothing), F3 Art. V.1 (service-layer, never subsidized). **No implementation until routed + E1/E2 worded** | `RECEIPT_COURSE_SYNC_INVITE_2026-08-08.md` |
| `GO_ORDER_THREE_BUGS_2026-08-07.md` | Code | Go-order (3 fixes) | founder "go" — **GIVEN** | **OPEN — awaiting Code execution.** Each fix needs its named test (fail→pass), receipts pasted, all three land before any tokenomics constant. **Bug #2 now has constitutional backing — `RULING_REPLAY_WORLD_A`: fail-closed refusal is canon, no replay lane.** These fixes lift the push hold (below) | — |
| `A1_LAYER1_AMENDMENT_2026-08-07.md` | Code | Spec amendment | founder "A1 go" — **GIVEN** | **LIFTED.** R8 Layer-1 rewritten to frozen-selection wording; collision closed on paper, register closes on Code's COURSE_SYNC | — |
| `RULING_REPLAY_WORLD_A_2026-08-07.md` | Code | **Constitutional ruling** | founder "World A" — **GIVEN** | **CANON.** Forward-only time; backdated/out-of-order `EmissionMinted` refused always; no replay lane. Backs go-order bug #2 (`first_minted_at`) — Code's fail-closed refusal is now constitutional, not just a bug fix. **Closes the last open escalation (bug 2, 70f812b)** | committed here |
| `DISPATCH_MIRROR1_BUZZ_REPOS_2026-08-07.md` | Cowork (Stage 1) / Code (Stage 2, post-bug-1) | Dispatch (mirror agent) | Seat 0 GO | **Stage 1 Part A DONE** — `block/buzz` L-VERIFY: Apache-2.0 (tree file), pin `02f640bc…`, no NOTICE, named docs present. **Stage 1 CLOSED 2026-08-08** — founder forked manually to **https://github.com/skaists/buzz** (org `skaists`, founder's choice, recorded as-is). ⚠ **Pin not enforced by repo:** fork main HEAD is `60dbdaaf…`, not the declared pin `02f640bc…` (upstream has NOT drifted — still at the pin). Fix = annotated tag at the pin commit; command in the receipt. Cowork cannot tag (no GitHub write tools, twice confirmed). **Custody escalation (how the Stage-2 agent funds spend) CLOSED architecturally by `RULING_BDID_HIERARCHY`** — agent self-funds from earned resources under a bDiD; no founder-signs-per-upload. Stage 2 waits on bug 1 | `RECEIPT_MIRROR1_STAGE1_2026-08-07.md` |
| **`waits` FINDING** (goose + Code, receipted 2026-08-08) | all seats | **Verified dead** | — | ⛔ **Antelope `waits` is DEAD on Vaulta mainnet.** `DISABLE_DEFERRED_TRXS_STAGE_1` (ordinal 19) and `STAGE_2` (ordinal 20) both activated at **block 396,090,329**, confirmed via a mainnet BP node. **`waits` still validates but can never be satisfied — and fails SILENTLY.** That silence is the hazard: a law-10 false signal, correct-looking in source and in the checker, dead in production. Both seat reads were right at different layers (LAW 8a). **Do not design a time-delay on `waits`.** |
| **SUCCESSION PHASE ONE** (shape FINAL) | all seats | Architecture | Seat 0 | **FINAL IN SHAPE.** Role = **mutating account-set under a fixed identifier** — native, self-amending (min authority to change P is P itself), linkauth-bounded to enumerable `contract::action` pairs, **untouched by the deferred-trx kill switch**. Dead-man half moves to **`eosio.msig` + `delay_sec`** (contract-based, **45-day cap**, exec **permissionless**). **Exclusions:** `eosio.any` **PROHIBITED** for bDiD role actions; **key loss is FINAL** (15-of-21 BP override fails the standing bar) |
| `RULINGS_8C_RENEW_POSTOP_ROUTING_2026-08-08.md` | all seats / Code | **Rulings ×4** | Seat 0 | **CANON.** **LAW 8c ADOPTED** — provenance survives the relay; addressed-to ≠ originated-by; flag miscredit, don't absorb. **`renew` CLOSED — already ruled** (28-day change / 365-day renew): v3's 3,650-day unlimited stacking call is a **DEFECT AGAINST THE RULED DESIGN**, and the exact leak that drains the per-bDiD cap — *a bound one call can bypass is not a bound*. 5 v4 items → **Code's lane, open it**. **POST-OP NOTE RATIFIED** → [`docs/POST-OP-NOTE-TEMPLATE.md`](../POST-OP-NOTE-TEMPLATE.md). **SPEC ROUTING:** onboard/invite → **kernel docs**, not BNRoSe-N (*don't bend a taxonomy to fit a document*) | committed here |
| `POST-OP-NOTE-TEMPLATE.md` (in `docs/`) | all seats | **Standing template** | Seat 0 ratified | 8 fields, every operation on code/doc/media: PRE-OP · POST-OP · PROCEDURE · SEATS PRESENT · FINDINGS · SPECIMENS · COMPLICATIONS · DISPOSITION. Empty stated as empty — **an omitted field reads as "not considered."** SPECIMENS carry crate+ref (8a); SEATS PRESENT carries authorship (8c). Forbids **the clean note** (complications smoothed away) and **the changelog in disguise** (fields 1–3 fat, 4–8 thin). **Naming variance is not ambiguity — do not ask which seat is meant** | committed here |
| **⏳ `owner` SUCCESSION — OPEN** | Code | Founder word outstanding | — | On Antelope `owner` sits **above any custom role and can always override it** — a successor-able role under a non-successor-able `owner` **still dies with whoever holds that key**. Phase one is **final in shape but MORTAL AT THE ROOT** until ruled. Not a flaw in the role mechanism; a property of the layer above it |
| `RULINGS_HARDLINE_METHOD_ADOPTION_2026-08-08.md` | all seats | **Rulings ×3 + seat derivation** | Seat 0 | **CANON.** ⭐ **THE HARDLINE (LAW 8d):** BNR/founder funding must never gate user count — **disqualifier applied before merit**, test = *"does the cost of the 10-billionth user land on BNR?"* Sponsored/metered **DEAD**; credit systems survive **only if users buy credits**. **LAW 8e:** build the full user-selectable surface, don't elect one mechanism — **8d disciplines the menu**. **LAW 8f:** *"summary that is true alone, depth that is reachable"* (3rd instance of one shape → named). **§4 Vaulta re-derivation:** tree already agrees — keypair-first identity costs **0 Vaulta rows**; binding constraint is **`registeracc`'s `require_auth(registrant)`**, not `max_ram_size`. **§5:** Q4 stands (loop does NOT close), **Q1–Q3 errored — re-run**, carry **0.0402** ANT/chunk |
| **FLOAT ≠ DEPTH** (in `RULING_RAIL_C…` update) | all seats | **Architectural finding** | Code reframe + measurement | ⭐ **The surviving constraint is FLOAT, not depth.** At 10^10: one payment's ANT each ≈ **9.8% of total supply**; a hundred each ≈ **10× more ANT than exists**. Reads as **"per-identity float is the WRONG SHAPE,"** not "no rail clears this" — **a bigger-supply rail moves the number without changing the form.** Shape problems are not solved by rail shopping. Code volunteered this **against its own headline**. Depth workflow must state **market-cap vs acquirable-liquidity** explicitly |
| **⏳ FOUNDER QUESTION IN FLIGHT** | all seats | Hypothesis — **NOT a ruling** | Fable | KISS says wallet ships **funded**; rail (C) says **don't front-load**. Candidate reconciliation: **front-load the GAS** (scales: 10^10 × a penny), **never the RESOURCE TOKEN** (doesn't: ≈9.8% of all ANT); resource token is **EARNED, not issued**. **Awaiting founder word — no seat builds against either reading** |
| **PROVENANCE CORRECTION** | all seats | Correction | Seat 0 | The four earn-ANT/spend-ANT questions were **Fable's**, addressed to Code — not Code's. Same class as the escrow-line error. **Cowork corrected its own RAIL-C courier**, whose "HYPOTHESIS FOR CODE" heading read as Code-originated. Candidate **LAW 8c** recorded in standing laws (*awaiting word, not adopted*) |
| `RULING_RAIL_C_NO_FRONTLOAD_2026-08-08.md` | all seats / Code | **Ruling** (rail class) | Seat 0 | **CANON.** Class (C) — issuance that does not front-load tokens; (A) pre-purchase, (B) different rail, (D) smaller target all declined. Thesis: **BNR is a demand source, not a passive consumer of depth.** Corollary the spec must carry: depth follows demand **with lag**; design must **degrade gracefully**, never assume depth, never fail closed on an unfillable swap. **Code holds 4 questions — HYPOTHESIS not finding** (same-rail ANT earn→spend may mean no per-cycle swap; would move ~1,000 agent-cycles to ~52,000). LAW 8b executing. **Couriered by Cowork** — research seat's DC lane timed out 3× | committed here |
| `CONCEPT_B_COMPUTE_BID_WORKERBEE_2026-08-08.md` | all seats | **Concept — FILED, NOT SPECCED** | Seat 0 | Rent the surgical code team via Buzz community: **b** for resources + **Tether-Gold escrow** for engagement value. **Needs no new primitive** — composes b-spend boundary + dual-currency + tiered multi-asset escrow as already ruled. 5 questions recorded, unanswered; sharpest: **who is the dispute agent when the escrowed work is BNR's own team** (conflict of interest, not a mechanism gap). **Do not design until opened** | committed here |
| **PRIVACY CLOSED** (in `SPEC-SPEND-RECEIPT-1` §3a/§3b) | implementers | Ruling applied | Seat 0 | ✅ **FENCE-HOLD CLOSED.** All three ship (`private`/`parent`/`public`), **default = `private`**, move to `public` gated by **informed consent showing privacy AND cost together** (one without the other fails the ruling). `public` is **genuinely cheaper** (public bData vs zbData self-encrypted) — **no synthetic subsidy**, so the default is self-enforcing without a rule. **Invertibility disclosure binding:** a public total may be invertible to line items on simple single-rail ops, and the consent surface must say so | committed here |
| `SURFACED_SPEND_RECEIPT_PRIVACY_2026-08-08.md` | Seat 0 | Options surface | Cowork | **NARROWED 2026-08-08 — one question left.** Settled: spender always sees its own accounting; **privacy comes from RAIL SELECTION, not from hiding receipts** (want privacy → use a private rail); persona-scoping unchanged. My "conceal the linkage" framing is **superseded** by that. **Open: VISIBLE TO WHOM** — spending bDiD only / bDiD + parent / public. Carry-forward that survives: widening visibility later cannot un-publish what was already written | committed |
| `RULING_KISS_BDID_PASSKEY_WALLET_2026-08-08.md` | all seats | Ruling | Seat 0 | **CANON.** bDiD ships with passkey + funded wallet; genesis funding IS issuance (bootstrap deadlock answered at the identity layer). Spend view = total first, per-adapter itemized beneath. **§3 discharged by Cowork** → `docs/SPEC-SPEND-RECEIPT-1.md` | drafted this turn |
| `SPEC-SPEND-RECEIPT-1.md` (in `docs/`) | implementers | **Spec skeleton** | L-SCHEMA | **DRAFTED.** Total computed from line items; each line carries exact resource `quantity` + `charged` + explicit versioned `rate`. ⚠ **Structural finding §4:** a single total needs a resource→b/A rate, and that rate is unruled tokenomics — resolved by making rate an opaque versioned ref, so the schema freezes now and values land later **with no schema change and no tokenomics constant in the doc**. Rails/resource-classes are closed enums (caller-supplied classification is not a classification) | drafted this turn |
| `RULING_BDID_HIERARCHY_AGENT_AUTHORITY_2026-08-07.md` | all seats | Ruling | Seat 0 | **CANON.** bQueenBee is the only agent with its own bDiD; all others root under it or a human. Access universal; authority axis = SOVEREIGN vs SUPERVISED-by-`lovis.b`. Agents self-fund from earned resources. Closes MIRROR-1 custody. Research owed (Fable): tiering, attenuation (EIP-2255 fit — cite-or-stop), earning→spending loop | committed here |
| `RULING_B_SPEND_BOUNDARY_MULTIASSET_ESCROW_2026-08-07.md` | all seats | Ruling | Seat 0 | **CANON.** b spent ONLY where a function consumes physical resources (kernel/RAM/CPU/NET/DATA); A-first for MVP; "free at point of use" governs ACCESS not consumption. Escrow must be multi-asset/multi-rail. **b/A denominate as RESOURCE QUANTITIES, never fiat-pegged** | committed here |
| `RULINGS_TESTNET_A_MVP_CUSTODY_2026-08-07.md` | all seats | Ruling | Seat 0 | **CANON.** TESTNET-FIRST standing law (nothing touches live before Vaulta testnet); MVP denominates in `A`; self-heal-to-10^10-users/1000-yr test reaffirmed. Autonomi custody reframe = research (scoped-delegation premise UNVERIFIED, cite-or-stop before any `pay`-verb spec) | committed here |
| `RULING_REPO_IS_THE_RECORD_2026-08-07.md` | all seats | Ruling | Seat 0 | **CANON.** `docs/ledger/` in the tree IS record-of-truth; memory store is working copy; repo wins on conflict; append-only deltas, never re-export whole. **Cowork closed the ledger README open question this turn** | committed here |
| `AMENDMENT_STRIKE_EIP2255_2026-08-07.md` | all seats | **Law-book amendment** | Seat 0 (on goose/Fable finding) | **IN FORCE — STANDS after 2026-08-08 recheck.** ERC-7710/7715 **exist** (`github.com/ethereum/ERCs`; earlier 404 was the repo split) — **both DRAFT, not Final**; caveats are absent from **7710's normative Specification entirely**, present only in MetaMask's non-normative reference impl. **CUSTODY CONVERGENCE:** both payment paths auto-top-up to `U256::MAX` (`wallet.rs:430-441` regular, `:201-204` merkle), so a finite approval is erased on first payment — **the external-signer path is the ONLY finite-approval path**, making key-isolation and approval-bounding **one seam, not two**. Stage-2 `pay` blocked on **gas alone** now. Original text preserved. |
| ~~(prior status)~~ | | | | **IN FORCE.** EIP-2255 STRUCK as the named attenuation primitive (not a delegation standard, no fork exists, `wallet_grantPermissions` renamed). Real = **ERC-7710 + Delegation Manager enforcers**; caveat = contract address + calldata, not JSON. **ERC-7715 human-gated — do not use.** Autonomi seam = finite ERC-20 allowance + remote KMS signer (EOA, not 4337); **never the merkle path (≥64 chunks = infinite allowance)**. 3 blockers open: autonomi repo archived, gas unsolved, succession. Earning-loop bound: only ANT is a verified earn rail. Pointer notes appended to both citing rulings; ruled text left verbatim | committed here |
| `RULING_CREDIT_FORMAT_2026-08-07.md` | Code / all | Ruling | Seat 0 | **CANON (answers Code §3).** `Co-authored-by: Claude Opus 5 <noreply@anthropic.com>` is compliant, keep it. `.social`/bDiD-handle credit + surgical-masthead titles are DIRECTION, not canon — no trailer change until bDiD handles are real and ruled | committed here |
| `RULING_BIO1_V02_2026-08-07.md` · `RULING_COMMIT_ATTRIBUTION_2026-08-07.md` | Code / all | Rulings | Seat 0 | Landed to tree this turn (were couriered, uncommitted). BIO-1 execution commit still unverified from this seat (see push-state note) | committed here |
| `DISPATCH_CLAUDECODE_BDOMAIN_ADDENDUM_R8.md` | Code | Addendum | — | RAM receipt **COMPLETE** (commit 8840740); Layer-1 hold **LIFTED** by A1 | 8840740 |
| `DISPATCH_CLAUDECODE_BNROSE_ADDENDUM_R7.md` | **Cowork** (reassigned from Code, founder word "INDEX row 4 → Cowork" 2026-08-07) | Addendum (spec skeletons) | — | **DRAFTED** — `SPEC-BNROSE-0-CHARTER.md` (Item A) + `SPEC-BNROSE-3-ETERNAL-DATA-ARCHIVAL.md` (Items B, C). Acceptance met for A/B/C draftable parts; cold-start-verifier + COURSE_SYNC owed to committing/Code seat | pending commit |
| `FABLE_STANDING_LAWS_S2.md` | Fable/all | Standing laws | — | ADOPTED — CLAUDE.md §2 slot; ledger authoritative on conflict | — |
| `ACK_COWORK_SEAT_2026-08-07.md` | Seat 0 | Seat ACK | — | FILED — Cowork seat wired, fences on record | 3f12c7d |

## Founder word-stack (open gates)

| # | Item | Needs | State |
|---|---|---|---|
| 1 | Cadence rule (docs-only push when scan clean) | founder word — GIVEN | **ACTIVE — held on bug 1 only, see below** |
| 2 | A1 Layer-1 rewording | founder word — GIVEN | CLOSED — executed |
| 3 | INDEX manifest | founder word — GIVEN | CLOSED — this file, self-maintaining |
| 4 | ORDERS-1 v0.8 re-commit | founder keyboard | **CLOSED — ratified `49803b9`, founder's hand** |
| 5 | BIO-1 v0.2 read + ratify | Code | **RATIFIED (founder board 2026-08-07).** Executing commit reported as `23f03ff` — **NOT present in this tree** (`cat-file`: malformed object name; BIO-1 spec here still reads "proposed", `7b53796`). Ruling made ≠ verified-executed from this seat. Reconciliation owed by Code/Fable — see push-state note |
| 6 | w / T0 + Design D picks | Code presents | **CLOSED — w = attested-capture full weight; T0 = 45-min interim; Design D = 0%/defer canon (founder board 2026-08-07)** |
| 7 | (row-7 gate) | founder word | **CLOSED — dual-currency: b for compute, stablecoin for service; commit-format kept as-is (founder board 2026-08-07)** |

*Word-stack closures above are recorded from Seat 0's board of 2026-08-07; canonical text lives in the Fable ledger / Code filings. This table is the pointer, not the canon.*

**⚠ THE WORD-STACK IS NOW A HISTORICAL TABLE, not a live queue.** Under the AUTONOMY
DIRECTIVE (2026-08-09) the founder is interrupted only for **manual tasks** — credentials,
accounts, hardware, values/names. Design questions and pushes resolve at Seat 1. Rows above
record how each item cleared under the old regime; **do not add a design or push item to
this stack.** Only genuinely manual items belong here now.

## Push state — CURRENT (2026-08-09)

Verified this turn, not carried forward:

```text
origin/main 021c01342225d430256510548d755e7b827f7dcd   <- Code executed the ruled push
ahead 1 · behind 0
unpushed    this INDEX/directive commit (Cowork)
working     M docs/dispatches/SPEC_RESOLVER_VALIDITY_RULES_2026-08-08.md   (uncommitted)
```

**`021c013` is PUSHED — Seat 1 ruled it, Code executed it.** Remote sha
`021c01342225d430256510548d755e7b827f7dcd`, confirmed on `origin/main` by
`git branch -r --contains`. **Recorded as Code's execution, not Cowork's** (8c).

**Coupling, resolved before it mattered:** while `021c013` sat unpushed it was an
**ancestor** of Cowork's commit, so any push of `main` would have carried it. Cowork **held**;
Code pushed first and the coupling dissolved. **This is now the LINEAR-HISTORY DOCTRINE —
full text in [`DIRECTIVE_AUTONOMY_2026-08-09.md`](DIRECTIVE_AUTONOMY_2026-08-09.md)**, not
here. Short form for push time: **hold, or publish under explicit attribution. No third
option — and "push and say nothing" is not one.**

**Post-push review applies to this surface.** Any push touching a consensus-critical or
spec-ruled surface gets a **named second-seat reviewer**, identified when the push lands.
**Review, never a gate — nothing waits on the reviewer.** Currently named: **Code (Seat 3)
reviews goose's expected-value fixture commit.**

**Uncommitted working state flagged, not touched:** `SPEC_RESOLVER_VALIDITY_RULES` carries
modifications in the working tree. That file is goose's lane. A seat reading the ruled R1a
text from the tree is reading an **uncommitted** copy — worth knowing before quoting it as
canon.

**Standing pre-flight for every push** (replaces the per-push founder word): secret scan ·
48-hex accounting · **never `--no-verify`**. Annotate legitimate public constants
**same-line** (`PUBLIC-CONSTANT`, `TESTNET-ONLY`) rather than bypassing the hook.

---

## HISTORICAL — push state as of 2026-08-07/08 (kept as record, superseded above)

## Push state — HELD, and why (cadence rule working as designed)

`main` is ahead of `origin/main` by **13** (verified `git rev-list --count`, 2026-08-07). **The push is HELD, and the hold has narrowed to bug 1 only.**

**Open reconciliation (flagged by Cowork, owned by Code/Fable):** the BIO-1 executing
commit `23f03ff` reported on the board is **absent from this working tree** — `cat-file`
returns *malformed object name*, and it is not in the ahead-13 log, though other Code
commits (`efad970`, `70f812b`, `49803b9`) are present. Either the hash was mis-transcribed
in relay, or the commit lives in a copy that hasn't reached this mount. Until it resolves,
BIO-1 is ratified-but-execution-unverified here. Not Cowork's to fix — recorded so no seat
reads it as landed.

Update 2026-08-07: `70f812b` fixed **bug 2** (`first_minted_at` not backdatable —
now constitutional under `RULING_REPLAY_WORLD_A`) **and bug 3** (mint gate no longer
caller-supplied). Their doc descriptions are therefore publishable — fix has landed.
**Bug 1** (`registration_fee` never read → unbounded RAM vector) is **not yet fixed** —
it opens on Code's next fresh sitting against the Antelope contract. The docs describing
bug 1's vector must not reach the PUBLIC remote (A52) ahead of its fix.

**Release condition — SUPERSEDED 2026-08-07, and the seat holding the gate says so.**
The old condition ("bug 1 lands tests-green") assumed bug 1's fix was a fee handler.
**The fee verdict rejected that: NO fee on `.b`** — all five jobs fail, WAX's 81–85%
collapse is the empirical case, and `renew` makes any `registeracc`-only fee decorative.
Namespace bounding went to founder as a **menu** (per-bDiD cap / contested-name auction /
expiry / structural off-chain). **So bug 1 no longer has a code fix pending — it has a
founder design decision pending, and the old release condition can never be met as
written.**

**Current basis for lifting, verified by Cowork:**
- Fable's "registration closed by policy" was **withdrawn** — goose is right, `registeracc`
  carries `require_auth(registrant)` only, **no gate**. The vector is reachable.
- Code's argument stands instead: **`beehive-nature/b-domain` is a PUBLIC repo** —
  independently verified via GitHub API (`"private": false`, `"visibility": "public"`),
  so the contract source is already world-readable.

**Honest residual, recorded not hidden:** public *source* is not the same as a published
*worked exploit analysis with magnitudes*, and goose established registration is **ungated
in code**. Narrowing fact from Seat 0: the contract is **not accepting registrations, with
nothing expired until 2027-08-01** — so the vector is not practically reachable today even
though the code carries no gate. The gap is real but small. **The founder weighed it and
gave the word.**

## RELEASED — founder word 2026-08-08 ("full steam")

**The hold is LIFTED and the range is PUSHED.** Receipt:

```
push:        3a1af37..7c858b7   main -> main
HEAD:        7c858b78628f8c977176e51c717ad259b4b7df5b
origin/main: 7c858b78628f8c977176e51c717ad259b4b7df5b   (ls-remote verified)
ahead 0 · behind 0
```

**Release condition REPLACED (Cowork finding adopted by Seat 0).** The prior condition —
*"hold lifts when bug 1 lands tests-green"* — was **dead**, not merely unmet: the fee
verdict removed the fix it assumed, so no future event could ever satisfy it. It is
replaced by: **released by founder word, 2026-08-08.** No seat should wait on a milestone
that can never arrive.

**Basis of record:** Code's public-repo argument, independently verified by Cowork via the
GitHub API (`beehive-nature/b-domain` → `"private": false`). Not the freeze — Fable's
"registration closed by policy" was withdrawn as unsupported by the code.

**Cadence rule now self-executing** for docs-only ranges with a clean scan; no further word
needed per push. Bug 1 remains **DO-NOT-WRITE**; the GO_ORDER gate is unaffected; no
tokenomics constant was in the pushed range (verified: the sole `420e18` match was a code
*comment* describing the closed attack).
