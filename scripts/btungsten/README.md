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
| `wb002-cryptol/Sovereign.cry` — formal twin; `sovereignContinuity` for ALL states/actions | STAGED — NOT-RUN under cryptol (result-class law); TYPECHECK/CHECK-SAMPLED/PROVE-UNIVERSAL all pending the CI ubuntu beat |
| `wb002-saw/sovereign.saw` — equivalence-plan against a future Rust twin | STAGED — NOT-RUN (result-class law); EQUIVALENCE pending, vectors-first when the twin exists |
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
2. **Cryptol typecheck + `:check sovereignContinuity`** (with WB001's
   container beat; SAW = Linux x86_64).
3. **Rust twin of sovereign/step**, then the SAW equivalence
   (wb002-saw plan) — after which the battery's sampled histories
   become provable corollaries.
4. **Live leg**: the same torture rows against a deployed Vaulta
   contract (bzcodejungle testnet), not only the local dev chain.
5. **CI leg**: run wb002-wasm-equiv.mjs on the CI ubuntu runner (it
   needs a Spring install; the sibling-isolation ports/dirs are
   already parameterized).
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
| `wb001-cryptol/Intent.cry` — formal twin, ALIGNED 2026-10-07: meaningful lengths, valid-input constraints (canonical zero padding, wellFormedUtf8 as the pinned abstract predicate), padded wire whose meaningful prefix is exactly the deployed envelope, `wireInjective` for all VALID pairs | STAGED — written, not run; UNVERIFIED |
| `wb001-saw/intent.saw` — equivalence-proof plan against a future Rust twin, vector-first | STAGED — written, not run; UNVERIFIED |

### §result-classes (founder ruling 2026-10-07)

Four distinct results, recorded separately; NO one of them is ever
recorded as another:

| class | meaning | status |
|---|---|---|
| TYPECHECK | the .cry parses and typechecks | pending (CI ubuntu beat) |
| CHECK-SAMPLED | `:check` over sampled cases — with CONSTRUCTED related pairs (boundary twins, surrogate rows), not random sampling alone | pending |
| PROVE-UNIVERSAL | `:prove` across the stated input domain | pending |
| EQUIVALENCE | SAW: implementation == spec (vectors first, then the proof) | pending |

A missing tool, a skipped obligation or a solver timeout is NOT-RUN,
never success. `:check` is testing; `:prove` is the proof step.

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
