# bTunGsTeN workbenches

The executable arm of SPEC-BTUNGSTEN-1: every claimed property of the
standard reduces to a reproducible adversarial test with explicit
assumptions, pass/fail criteria, evidence, and a machine-verifiable
receipt. A workbench is where a property stops being prose.

```
Foundation (Cryptol + SAW)      → prove the formal invariant
Emissary-style hostile workflow → attack the living distribution
Autonomi / x0x / BNR stack      → the sovereign substrate under test
bTunGsTeN receipt               → verdict computed from observations only
```

All three tool rows are REPLACEABLE test infrastructure, never
dependencies of the standard (SPEC-BTUNGSTEN-1 §toolchain): if NSA
deletes Foundation or SAW disappears, the workbench migrates to whatever
formal system replaces them — the ≥1000-year clause applies to bTunGsTeN's
own tooling first.

## WB002 — the extinct-infrastructure specimen (CURRENT, founder order 2026-10-07)

**Invariant (the killer one):** no change of implementation, network,
author, storage provider, cryptographic algorithm, or execution
environment may transfer sovereign authority without the currently
authorized sovereign action.

**Specimen:** SimpleAssets frozen at upstream `e6a042f` (2021-03-17,
v1.6.1, LGPL-2.1), vendored verbatim under `wb002-specimen/` with
provenance and file hashes (`wb002-specimen/PROVENANCE.md`). Do not
modernize it; do not build it; do not depend on it. Attack the port,
preserve the artifact. Upstream field evidence for the failure classes
under test: issues #26, #19, #21, #6 (all still open, re-verified
2026-10-07 — see PROVENANCE.md).

| artifact | status |
|---|---|
| `wb002-specimen/simpleassets-e6a042f/` + `PROVENANCE.md` | PRESERVED — 17 files incl. the 2021-era wasm/abi; nothing built or executed |
| `wb002-simpleassets.mjs` — faithful port of the 2021 state machine (SA.cpp line refs), two profiles: `specimen` (upstream quirks intact) and `bnr-adapter` (the extracted BNR semantics); anchored event log with periodic state checkpoints; export/import migration surface; truth-lattice observers (Indexer / SpecimenUI / AdapterUI) | RUNS — imported by the battery |
| `wb002.test.mjs` — the battery: faithful-port row, idata byte-stability, the killer invariant over 600-step hostile histories on BOTH profiles (specimen violations must be NAMED or the battery fails), 26/27-row wrong-signer matrix, F-1..F-4/F-8 A/B convictions, the truth lattice (consensus = log fold; drop/corrupt/replay/lag; adapter disputes, never lies), 7 torture rows (kill author / lose contract / fragment recovery / re-key + algorithm rotation / partition-reorg / contract replacement + chain migration + tamper refusal + naive-importer conviction / marketplace death), the 1,000-year leg, and the TEETH row | RUNS in CI (same globbed step as WB001) — green locally 2026-10-07: 14/14 |
| `wb002-cryptol/BTungstenWB002.cry` (was `Sovereign.cry`; renamed to its module name) — formal twin; `sovereignContinuity` for ALL states/actions of the abstraction, plus the F-1 TEETH machine `stepSpecimen` | RUNS in the CI formal job via `wb002-formal-check.sh` (cryptol 3.6.0 pinned). Local receipt 2026-10-07 on the same pinned bundle: **TYPECHECK PASS; CHECK-SAMPLED PASS (100 random + constructed F-1 row); PROVE-UNIVERSAL `sovereignContinuity` PROVEN (Q.E.D., 0.071s, Z3); TEETH PASS (the solver refutes `continuityOf stepSpecimen`)**. The staged file had never parsed (landed RED first). Sabotage control: a planted borrower-theft seam passed 100 random samples and was REFUTED by the prove leg. EQUIVALENCE not attempted — the proof covers the Cryptol abstraction, not the JS port or the wasm |
| `wb002-rust/` — the Rust twin of `sovereign`/`step` (idiomatic: decoded phase/head enums, one guarded `match`; standalone crate, no dependencies, not a workspace member) | RUNS — `cargo test`: named seams + continuity exhaustive over a 4-actor universe (131,072 transitions; sampled class) |
| `wb002-saw/sovereign.saw` + `sovereign-defs.saw` + `sovereign-teeth.saw`, run by `wb002-saw-check.sh` in `.github/workflows/wb002-saw.yml` (SAW 1.6 by digest; mir-json at SAW 1.6's own submodule pin `8cbf9af1`, schema 13) | Local receipt 2026-10-07 on the same pins: **EQUIVALENCE PROVEN, three mir_verify obligations** — `step_matches_spec` (tag < 5, head < 16), `step_refuses_rest` (every other input is a no-op), `sovereign_matches` (all of [3]); together every raw input of the Rust `step`. **TEETH PASS** (the same obligation against `stepSpecimen` fails with a counterexample). Sabotage control: a planted Claim-by-holder guard was REFUTED with an exact counterexample (tag 2, holder 64 ≠ offeree 16). Scope: twin ≡ spec, so continuity holds of the Rust function; NOT the JS port, NOT the wasm |
| `wb002-hardening.test.mjs` — the model-hardening beat (founder review of the merged landing, 2026-10-07): the two review findings R-1/R-2 as red-first regressions, fingerprint-stability over every refusing seam, multi-action `tx()` bundle atomicity, content-authenticated display (checkpoint body via parent root; suffix bounded by a trusted tip), lag-at-authenticated-height, fail-closed root-only anchor | RUNS in CI — green locally 2026-10-07: 10/10 (landed RED first: 6 failing cases + 3 controls, receipt in the dispatch) |
| `wb002-wasm-equiv.mjs` + `wb002-wasm-receipt.json` — the WASM-vs-model beat: the VENDORED 2021 wasm+abi deployed VERBATIM (never rebuilt) onto a fresh local dev chain under **Antelope Spring 1.2.2** (this box's WSL; isolated :8889/:9899 + own dirs — a sibling lane's chain owns :8888), a 46-step deterministic corpus executed on BOTH the chain and the HARDENED specimen-profile model with one shared clock (chain head time), compared on accept/refuse class + full state projection after EVERY step | EXECUTED 2026-10-07 — three consecutive fresh-chain runs: **46/46 matched, 0 class mismatches, 0 state mismatches, final projections agree; 14 refused steps proven atomic ON CHAIN (the R-1 class against the real rollback boundary); F-1 issuer confiscation ACCEPTED live; F-3 owner-attach refused live.** Corpus-sampled evidence, NOT a proof (result-class law); local dev chain only — no testnet claim |

### §model-hardening (founder review 2026-10-07 — R-1/R-2, both repaired)

- **R-1 transactional atomicity.** The port had no rollback boundary: a
  refused action retained mutations made before its refusal (the
  return-to-lender path deleted the delegation + emitted `delegateclose`
  before `requireAuth`; partial batches committed their prefix). Antelope
  specifies failed transactions restore prior state — the vendored C++
  relies on that boundary. REPAIR: every public action now runs inside
  `tx()` — state tables, counters AND committed event-log effects roll
  back on any throw; nested action calls (delegate→transfer,
  undelegate→transfer, issuef→transferf) join the outer transaction
  (inline-action semantics); `tx()` is public so a caller can bundle
  several actions into one atomic unit. The battery now demands, after
  refused attempts as well as successful ones, that the ENTIRE pre-state
  and log are preserved (fingerprint-stable; 240 refused transactions
  rolled back whole in the adapter history alone). The specimen's
  authorctrl policy is untouched — rollback fidelity is not
  modernization.
- **R-2 authenticated display.** The AdapterUI compared a matching ROOT
  STRING against the trusted checkpoint and folded indexer-supplied
  contents: a substituted checkpoint BODY behind a genuine root was
  believed, and a self-consistent but unconfirmed log extension was
  promoted to current ownership. REPAIR, two obligations: (a)
  authenticate the checkpoint CONTENTS — `Chain.checkpointAnchor()`
  carries the checkpoint's parent root so the UI recomputes the root
  from the event body; (b) bound displayed state to an authenticated
  history — `display()` answers either at the authenticated TIP
  (bracketed by a trusted `{seq, root}` tip anchor with every link
  verified: current truth) or CHECKPOINT-SCOPED at its explicit height
  (never promoting an arbitrary suffix); a root-only anchor fails
  closed. Links prove self-consistency, not consensus acceptance — that
  sentence is now executable.
- Red-first receipt: the hardening suite landed against the MERGED
  module with the founder's counterexamples failing (delegated-transfer
  refusal and partial batch × both profiles; checkpoint-body
  substitution; unconfirmed extension) and the honest controls passing;
  the repair turned all rows green. Dispatch:
  `docs/dispatches/2026-10-07-btungsten-wb002-model-hardening.md`.

### §findings — the specimen's convictions (each = one BNR adapter requirement)

- **F-1** `authorctrl=true` FTs: the issuer's signature ALONE moves or
  burns any holder's balance (SA.cpp:692-695, 787). REJECTED for BNR
  sovereign funds by founder ruling (issuer authority ≠ confiscation
  authority); kept as an adversarial vector — the battery proves the
  confiscation succeeds on the specimen profile and refuses on the
  adapter profile.
- **F-2** the delegation return path in `transfer` accepts the LENDER's
  signature without undelegate's period check (SA.cpp:261 vs :514) —
  bounded tenure is not enforced on every exit path. Adapter enforces it
  (the borrower may still return at any time).
- **F-3** `attach`/`detach` (and `attachf`/`detachf`) require the
  AUTHOR's signature, not the sovereign's (SA.cpp:537, 568, 874) — the
  author can lock a sovereign's assets and value into containers the
  sovereign cannot unlock. Adapter binds composition to the sovereign.
- **F-4** offers never expire — a standing claim from 2019 is claimable
  in 3019 (1,000-year consent hazard, convicted in the millennium leg).
  Adapter offers carry TTL.
- **F-8** `changeauthor` moves the mdata-authority envelope on the
  author's signature alone (SA.cpp:14). Adapter requires the sovereign's
  co-signature.
- **Field evidence, not model inventions:** upstream issues #26/#19
  (indexer/UI truth diverging from consensus — the truth-lattice rows),
  #6 (author-side freeze — the marketplace-death torture row), #21 (CDT
  rot — the wasm+source preservation answer).

### §extractions — the semantics BNR keeps (founder mapping, 2026-10-07)

`idata` → COMMIT (commitment only; no identity/personal material —
COMMIT owns that boundary) · `mdata` → mutable status pointer ·
NTT → credential/capability primitive · `offer→claim` → consent ·
`delegate(period, redelegate)` → bounded authority (the Silent-Pay
lineage: owner → bounded authority → temporary executor → receipt) ·
`attach/attachf` → capability composition · author RAM payer →
sponsored sovereignty (payer is never an owner — proven in the
faithful-port row).

### §wasm-beat — what running the 2021 artifact on the 2026 client taught (2026-10-07)

- The wasm runs UNMODIFIED on Antelope Spring 1.2.2 (Savanna-era) once
  its OWN documented deployment link is applied (`set account permission
  … --add-code`): the contract's `sendEvent` deferred transactions act
  as the contract account and every Antelope since eosio.code requires
  the link. That link is deployment configuration, not artifact
  modification.
- Bring-up receipts, honestly: Spring's keosd serves the wallet API on
  its unix socket (HTTP wallet endpoints 404); a fresh wallet is born
  unlocked; WSL's poor timer accuracy needs `--max-transaction-time`
  raised or the subjective deadline kills heavier calls
  nondeterministically; and a failed `get table` must NEVER read as an
  empty table (the harness fails loudly instead).
- The corpus validated the model's most consequential claims LIVE: the
  F-1 issuer confiscation is ACCEPTED by the real contract on the
  issuer's signature alone; the F-3 owner-attach is refused (composition
  is author-gated upstream); the partial batch refuses with the WHOLE
  state untouched (Antelope's rollback boundary — the same class the
  hardening beat added to the model); delegation expiry follows real
  chain time; ids match naturally (both sides run the same genesis
  counters — only `offerfs.id` diverges, because upstream allocates
  deferred-event ids from the same counter the model deliberately does
  not port; the harness reconciles it and names that in its header).

### §next (named gaps, in order)

1. ~~wasm-vs-model equivalence~~ **DONE 2026-10-07** (see §wasm-beat +
   the receipt; corpus-sampled, local dev chain).
2. ~~Cryptol typecheck + `:check sovereignContinuity`~~ **DONE
   2026-10-07** — and past it: `:prove sovereignContinuity` PROVEN for
   the abstraction, TEETH green (see the artifact table + the CI formal
   job's WB002 step). SAW = Linux x86_64, still with item 3.
3. ~~Rust twin of sovereign/step, then the SAW equivalence~~ **DONE
   2026-10-07** — the twin is proven equal to the Cryptol spec for all
   inputs (see the artifact table). What it does NOT do: make the
   battery's histories provable. Those run against the JS port, and the
   JS-port-to-twin link is still sampled. Closing it needs either the
   twin driving the battery, or a vectors bridge from port to twin.
4. **Live leg**: the same torture rows against a deployed Vaulta
   contract (bzcodejungle testnet), not only the local dev chain.
5. **CI leg**: `.github/workflows/wb002-wasm.yml` runs the corpus three
   times on fresh local chains, on Ubuntu 22.04 with checksum-pinned
   Spring 1.2.2. Each run uploads fresh JSON receipts (14-day retention).
   This is corpus-sampled evidence, not a proof or testnet acceptance.
   Local runs may set `WB002_HTTP_PORT` and `WB002_P2P_PORT`; state and
   wallet directories are unique per invocation. Cleanup signals only
   owned child processes; occupied ports fail rather than evict siblings.
6. **WB003+**: scale and century-transition legs per SPEC §axes 5-6.

## WB001 — the intent-binding invariant (LIVE in CI)

**Invariant:** no valid signature may authorize any intent other than the
exact intent that was committed to. One bit of drift in domain, nonce,
epoch, action, destination, capability, amount, expiry, payer or payload
must break verification.

**Input-boundary law (repair 2026-10-07, founder review of the genesis):**
text fields accept well-formed Unicode only. The genesis module accepted
unpaired UTF-16 surrogates, which `Buffer.from(value,'utf8')` silently
maps to the same replacement bytes (`efbfbd`) — so `'\uD800'`, `'\uD801'`
and `'\uFFFD'` were three distinct accepted strings sharing ONE
authorization, in every text field. Not an Ed25519 forgery: a many-to-one
conversion BEFORE signing. The twin gap sat in decode
(`toString('utf8')` replaces instead of refusing). Repair: refuse at
encode (`bt-wb01:utf16`), refuse at decode (`bt-wb01:utf8`); valid
international text, supplementary characters and a legitimate U+FFFD
stay accepted, byte-exact. Red-first receipt in
`docs/dispatches/2026-10-07-btungsten-wb001-boundary-repair.md`.

| artifact | status |
|---|---|
| `wb001-intent.mjs` — canonical TLV envelope + Ed25519 binding verifier, fails closed; UTF-16/UTF-8 boundary gates since the 2026-10-07 repair | RUNS — `node --test scripts/btungsten/*.test.mjs` |
| `wb001.test.mjs` — the genesis battery (retained byte-stable): injectivity corpus (25 intents incl. nested-envelope and boundary-shift twins), 21 field-move mutants, 1,640 one-bit envelope mutants (205 bytes × 8), 512 one-bit signature mutants, 5 structural forgeries (reorder / unknown tag / duplicate / length-splice / truncation), domain/nonce/epoch participation, cross-key, and the TEETH row convicting the naive length-free encoder on both adjacent-variable-field collision pairs | RUNS in CI — green 10/10 |
| `wb001-boundary.test.mjs` — the boundary suite (landed RED against the genesis module first): 32 lone-surrogate encodes refused (4 fields × 8 forms), 24 surrogate-class authorization crossings rejected, 8 valid-Unicode controls round-trip byte-exact, 9 malformed-UTF-8 decodes refused with the valid 4-byte and U+FFFD controls passing, malformed-wire verifyEnvelope refusal, and the pinned shared vectors | RUNS in CI — green 6/6 since the repair |
| `wb001-vectors.json` (+ `wb001-gen-vectors.mjs`) — the pinned shared vectors: 10 positives byte-for-byte, 9 refusals by exact code, including the surrogate/invalid-UTF-8 boundary rows. Every twin (Rust, Cryptol) must reproduce these BEFORE any equivalence claim | PINNED, re-derived and compared on every CI run |
| `wb001-cryptol/Intent.cry` — formal twin: meaningful lengths, valid-input constraints (canonical zero padding, wellFormedUtf8 as the concrete DFA with the runtime validator's exact transition law), `wireInjective` for all VALID pairs; the B1 repair made the BRIDGE block EXECUTABLE (every constructed term's runtime bytes pinned as opaque constants, prefix + zero-tail + envLen obligations) — and the bridge's FIRST counterexample (`bridgeIBase = False`, CI run 37692766559) convicted the pre-B1 `wire` as a PADDED LOOKALIKE: it interleaved each field's capacity padding inside the stream, so the deployed envelope was never its prefix. The wire is REWRITTEN as the true variable-length stream (byteAt dispatch over length-derived block offsets, zero tail beyond envLen) | RUNS in the CI formal job — TYPECHECK PASS, CHECK-SAMPLED all arms; the pre-B1 wireInjective Q.E.D. (z3, 23.7s) was a receipt about the lookalike and does NOT carry over: the prove re-attempts on the repaired wire every run and its verdict line is the live record — see §result-classes |
| `wb001-bridge.json` (+ `wb001-bridge-gen.mjs`, `wb001-bridge.test.mjs`) — the formal-wire bridge (founder review B1, 2026-10-07): the 8 constructed terms' runtime canonical() envelopes pinned byte-for-byte; the .cry carries the same hex as opaque constants; the node leg re-derives every run and asserts the .cry literals, the formal leg :checks the bridge properties — any drift on either side goes red. Sampled agreement on pinned terms, never equivalence | PINNED, re-derived and compared on every CI run (both legs) |
| `wb001-saw/intent.saw` — equivalence-proof plan against a future Rust twin, vector-first | STAGED — written, not run; UNVERIFIED |

### §result-classes (founder ruling 2026-10-07)

Four distinct results, recorded separately; NO one of them is ever
recorded as another:

| class | meaning | status |
|---|---|---|
| TYPECHECK | the .cry parses and typechecks | **PASS in CI** — gates every push (cryptol 3.6.0, pinned asset) |
| CHECK-SAMPLED | `:check` — adversarial arm (malformed classes rejected by `validIntent` BEFORE injectivity is evaluated) + constructed arm (closed terms: boundary-shift twins, astral Unicode, legitimate U+FFFD, combining sequences, near-collision payload pairs) + random arm | **WIRED IN CI** — all three arms gate the job |
| PROVE-UNIVERSAL | `:prove` per obligation across the stated domain | **THEOREM CORRECTED 2026-10-08 (founder review, SHA 8b2ac34ae): the original `wireZeroTail` quantified over ALL intents while documented for valid ones — and was REFUTED, executed** (payload len `0xfffffff0` wraps the [32] offset arithmetic so envLen lands inside the later blocks; the witness is the permanent `zeroTailWrapRefuted` regression). The corrected theorem states its valid-intent premise; the proof is now DECOMPOSED into per-obligation lemmas with per-obligation budgets — `validImpliesBounded` (45s), `offsetsOrdered` (90s), `zeroTailFromBounds` (180s), then `wireZeroTail` and `wireInjective` (240s each; 240 not 300 because prove processes died by SIGTERM twice at 269s/289s before a 300s wrapper could classify — signal death is the fact, its sender unevidenced). Live verdicts are the run's own lines. A clean exit with NO recognized verdict is a diagnostic FAILURE (red), never a silent green |
| EQUIVALENCE | SAW: implementation == spec (vectors first, then the proof) | NOT ATTEMPTED — the shared vectors and 8 bridge terms are sampled agreement for those terms, never universal runtime equivalence. And encoding proofs make no signature-scheme claims: Ed25519 stays an assumed primitive, PQ work stays its own lane |

A missing tool, a skipped obligation or a solver timeout is NOT-RUN,
never success. `:check` is testing; `:prove` is the proof step. And per
the Beat 3 scrutiny: a PROVE-UNIVERSAL receipt is canonical only if the
validity predicate is CONCRETE in the model — `wellFormedUtf8` is now
the real DFA with the runtime validator's exact transition law, not an
abstract placeholder — or connected to the runtime validator by a
separately proved refinement. A proof can be correct about the wrong
accepted language; that class of mistake is what Beat 2 eliminated and
this law keeps eliminated.

### §ladder (founder ruling 2026-10-07 — the default sequence for every workbench)

```
RED counterexample
→ accepted-language repair
→ shared vectors
→ formal wire alignment
→ TYPECHECK
→ CHECK-SAMPLED
→ PROVE-UNIVERSAL
→ eventually implementation/model EQUIVALENCE
```

No step substitutes for a later one; the WB001 chain is the reference
instance (surrogate collision → utf16/utf8 gates → wb001-vectors.json →
concrete-DFA Intent.cry → CI formal job). The "formal wire alignment"
step is EXECUTED since the B1 repair (2026-10-07): wb001-bridge.json
pins the runtime bytes of every constructed term, both CI legs
re-derive them every run — before B1 the twin's bridge block was
comment-only and not one Cryptol wire byte had ever been compared to a
runtime byte.

### §next (named gaps, in order)

1. **Cryptol typecheck + `:check wireInjective`** — needs a Linux x86_64
   host with cryptol/SAW release binaries; the CI ubuntu runner is the
   qualified home (add a container step here when the beat lands).
   The check set must include CONSTRUCTED related pairs (boundary-shift
   twins, the surrogate-class rows), not random sampling alone; :check is
   recorded as CHECK-SAMPLED, never as the universal proof.
2. **Rust twin of `canonical`/`decode`** in this repo, reproducing
   `wb001-vectors.json` byte-for-byte (positives exact, refusals by code)
   BEFORE any equivalence claim (the bpq two-implementation precedent).
3. **SAW equivalence proof** (`wb001-saw/intent.saw`): implementation ==
   spec for all VALID intents; then the mutation leg is provable, not
   sampled.
4. **Distributed leg:** the bounded BNR job through a hostile P2P
   workflow — kill services, reroute, replay, fake peer, partition,
   heal — final result must still satisfy this invariant and produce the
   same meter-verifiable outcome (Emissary as sacrificial specimen, not
   dependency). Superseded as "WB002" by the founder's 2026-10-07
   SimpleAssets order; kill/partition/heal/reorg/replay are now torture
   rows of WB002's battery, and the Emissary leg remains open under its
   own workbench number.
5. **Scale/century legs (WB003+):** progressively larger physical runs
   and simulated century transitions per SPEC §axes 5-6.

### Founding receipts

- Origin: founder order 2026-10-06 (bTunGsTeN formalization, six hard
  properties, Workbench 001 design). Dispatch:
  `docs/dispatches/2026-10-06-btungsten-lane.md`.
- Toolchain posture, with precision: NSA's `Foundation` repo (Apache-2.0)
  provides Cryptol specifications + SAW assurance machinery and a
  primitives corpus (AES, ECDSA specs, HMAC, SHA2/3…). It does NOT ship
  an ECDSA SAW proof artifact today — checked 2026-10-06, and we do not
  claim otherwise. We apply the machinery ourselves; anything not yet run
  by us carries UNVERIFIED.
- Precedent instances already in-tree: `tools/net-doxx/` (the tungsten
  test harness — verdict-from-observations receipts, live FAILs
  published) and SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten (the ZK lane's
  four-receipt coupling gate). bTunGsTeN-1 names the umbrella those
  gates instantiate.

## SK001 — the Skaists seat-sovereignty deployment battery (SPEC-SKAISTS-SEAT-SOVEREIGNTY-1)

Not a workbench of the standard's own WB sequence — the first bounded
DEPLOYMENT instance of it: the Skaists LOVERnment DAO's 7,776-seat
(6⁵) organism, whose identity layer must satisfy bTunGsTeN at the
scale where every seat can be exercised exhaustively.

**Invariant (founder ruling 2026-10-07, verbatim in the spec):**
Skaists Seat Sovereignty — at every governance epoch, no natural human
may control more than one active membership seat, every active seat
must resolve to exactly one eligible living human and exactly one of
the five constitutional energy types, and no verifier needs access to
that human's underlying biometric or civil identity to establish
eligibility.

**The arithmetic law:** 7,776 = 6⁵ = 2⁵·3⁵ has no factor of five, so
equal integer fifths do not exist. Membership population is a measured
variable; governance weight is the exact rational 1/5 per constituency,
CONSTANT in population (no float ever represents it — 3 × (1/5) ≠ 0.6).
The nearest packing {1556, 1555, 1555, 1555, 1555} is recorded and NOT
constitutional.

| artifact | status |
|---|---|
| `sk001-seat.mjs` — the model: beginEpoch/occupy/depart/release/carrySeat (COMMIT), prove (PROVE — the five frozen predicates), compress (COMPRESS — the fixed-weight fold), constitutionalWeights vs populationShares (the sabotage governor), exportEra; typed `bt-sk01:*` refusals, fails closed | RUNS — imported by the battery |
| `sk001.test.mjs` — the battery (10 rows, each printing its own 0→N count): 6⁵ derived + equal-fifths impossibility by exhaustion; tightest packing recorded not constitutional; weight ⊥ population over 7 adversarial vectors; double-seat/seat-taken refusals + bijection; 8 malformed types refused; the five predicates frozen-shape with stale-epoch/not-live/vacant refusals and per-epoch carry; private-evidence byte-scan of proof and era export; full-cap fill + the 7,777th refused + one release/re-admit breath; exact COMPRESS fold of all 7,776 votes on constant weights; TEETH — the population governor and float weights convicted by name | RUNS in CI (same globbed step) — green 10/10 |

Model-scale honesty: this receipts the in-memory MODEL. The sha256
commitment is a binding placeholder only — hiding is NOT claimed; the
boundary the battery receipts is structural (evidence bytes have no
code path into the registry, the proof, or the export). No live proof
system, hiding commitment, or SETTLE chain exists for Skaists seats
yet — every live-layer claim stays UNVERIFIED until its own beat runs
(the spec's §deployment-status table is the ledger). Axes exercised:
2, 5, 6 (model scale).

Genesis receipt: the battery caught two of its own bugs before landing
— Buffer identity-comparison defeating the uniqueness index (equal
sha256 digests are distinct Map keys), and the BigInt wire form — both
fixed before the 10/10; see
`docs/dispatches/2026-10-07-skaists-seat-sovereignty.md`.
