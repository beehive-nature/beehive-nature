# SPEC-BTUNGSTEN-1 — the bTunGsTeN Standard Test

Status: GENESIS 2026-10-06 (zCode seat, branch zcode/btungsten-2026-10-06).
Founder order 2026-10-06: Tungsten is formalized as an umbrella standard,
"much broader than an identity-security benchmark … closer to a
civilization-scale survivability/conformance standard," and it must stay
"a measurable conformance system rather than a slogan."

## THE STANDARD

**bTunGsTeN Standard Test** — a civilization-scale conformance framework
for sovereign digital systems, testing decentralization, Sybil/MiM
resistance, autonomous healing, autonomous learning, operation beyond 10
billion users, and continuity across at least 1,000 years of
technological and institutional change.

Top-level requirement, in one sentence:

> bTunGsTeN proves that a sovereign digital system can preserve identity,
> authenticity, continuity, recoverability, and verifiability across
> adversarial attack, infrastructure loss, technological replacement,
> planetary scale, and generational time.

That is much stronger than "can it authenticate somebody."

## §measurability (the law that keeps it from being a slogan)

Every claimed property reduces to a reproducible adversarial test with:
explicit assumptions, pass/fail criteria, evidence, and a
machine-verifiable receipt (verdict computed from observations only —
the `tools/net-doxx` tungsten harness law; an agent's say-so is prose).

- "Immunity" ALWAYS means immunity within the explicitly published
  bTunGsTeN adversarial model (TAM), never in the absolute.
- Crypto wording caps at "sound by construction / isolated by design"
  (crypto language law); claims cite file+function or stop at UNVERIFIED.
- A property with no receipt is a hypothesis, not a result. Lane-level
  tungsten gates (see §precedents) stay binding and cite the axis they
  exercise.

## §axes — the six hard properties

1. **Decentralization.** No indispensable corporation, server,
   validator, identity provider, administrator, jurisdiction, or master
   key. Test family: deliberately REMOVE major components and prove the
   system continues operating.
2. **Sybil/MiM resistance.** One-human/appropriate-entity uniqueness
   where required; liveness; authenticator binding; verifier/transaction
   binding; replay resistance; relay resistance; unlinkability — each an
   explicit adversarial test, each "immune" only within the TAM.
3. **Autonomous healing.** Kill nodes, corrupt replicas, partition
   networks, poison routes, lose regions, retire providers, introduce
   incompatible versions. The network must detect damage, reconstruct
   trustworthy state, reroute, and recover WITHOUT a privileged human
   operator.
4. **Autonomous learning.** The system may learn attack patterns and
   improve routing, anomaly detection, resource allocation, defenses —
   but learning must never silently rewrite constitutional/security
   invariants. Learned changes are bounded, testable, reversible,
   attributable, and receipted.
5. **>10 billion-user capacity** — not "10 billion records": identity
   population, active-device population, concurrent authentication load,
   transactions/proofs per second, geographic partitions, storage
   growth, recovery load, adversarial load. Passing requires credible
   mathematical scaling bounds PLUS progressively larger physical tests.
6. **≥1,000-year continuity** — the unusual part and potentially the most
   important. Assume today's cryptography, hardware, companies,
   governments, networks, languages and storage will all eventually
   disappear. Passing requires crypto-agility, protocol migration,
   replaceable adapters, self-describing data, long-lived verification
   formats, key succession/recovery, epoch and clock rollover handling,
   archival reconstruction, fork reconciliation, and no permanent
   dependence on any vendor.

**Honesty clause (axis 6):** the 1,000-year test does not pretend to run
a thousand-year experiment. It tests what makes survival plausible:
repeated simulated century transitions, dependency extinction, algorithm
deprecation, validator population replacement, hardware generations,
state reconstruction from surviving fragments, protocol evolution, and
recovery after long partitions. bTunGsTeN does not certify an
implementation forever — it certifies that the architecture CONTAINS THE
MECHANISMS needed to survive replacing essentially everything underneath
it.

## §watch — government-procurement relevance

The procurement watch treats as bTunGsTeN-relevant requirements:
decentralization, autonomous healing/learning, >10B-user scale, and
millennium-class infrastructure continuity. A tender carrying any of
these is a bTunGsTeN conversation; a system that cannot name its receipts
for them does not qualify itself by slogan.

## §precedents — the instances this umbrella names

bTunGsTeN-1 does not replace the estate's existing tungsten usage; it is
the standard those gates instantiate:

- `tools/net-doxx/` — "the tungsten test harness": adapter evidence with
  verdict-from-observations receipts; live FAIL verdicts are published
  (doxx run `tt-20261005031759-e336b5`). Axes exercised: 1, 3.
- SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten — the ZK lane's four-receipt
  gate (forgery mutation-proven, leak bounded-distinguisher, testnet
  cost, scale) before ANY upstream coupling. Axes exercised: 2, 5.
- `docs/research/2026-10-05-autonomi-10-100gb.md` — the storage-scale
  tungsten ladder (free stages, then paid 250 MB → 100 GB). Axis: 5.
- SPEC-SKAISTS-SEAT-SOVEREIGNTY-1 + `scripts/btungsten/sk001*` — the
  first bounded DEPLOYMENT instance: the Skaists LOVERnment DAO's
  7,776-seat (6⁵) seat-sovereignty law made executable (one living
  human → one seat → one canonical energy type → one constituency at
  every epoch; governance weight ⊥ population; evidence never crosses
  COMMIT). Axes exercised: 2, 5, 6 — model scale; live layers stay
  UNVERIFIED until their own beats run.
- A failed tungsten test is never quietly turned into integration work
  (doxx FAIL precedent; the failed-test-to-integration move has no
  written precedent and stays UNVERIFIED/unlawful until ruled).

## §workbench — where properties become tests

```
BNR intent → canonical domain+nonce+epoch+action hash → signed
authorization/receipt → Cryptol spec → implementation → SAW
equivalence proof → adversarial mutation → proof must fail →
distributed execution → node/service failure + replacement → healed
execution → same invariant still verifies → bTunGsTeN receipt
```

**WB001 — the first invariant (deliberately small and vicious):** no
valid receipt may authorize any intent other than the exact intent the
human/agent cryptographically committed to. One bit of drift in
destination, capability, amount, domain, nonce, expiry, payer or
execution payload must fail verification. This aims the Foundation
workbench at the MiM/intent-substitution axis instead of a generic crypto
demo. Status: executable battery LIVE in CI (scripts/btungsten/ —
2,178+ mutants rejected, teeth row convicting the naive encoder); the
Cryptol twin RUNS in the CI formal job (TYPECHECK + CHECK-SAMPLED all
arms + a budgeted PROVE attempt), and since the B1 repair (2026-10-07)
the formal-wire bridge is EXECUTABLE — the runtime bytes of every
constructed term pinned on both legs, which convicted the pre-B1 wire
as a padded lookalike (counterexample bridgeIBase = False) and drove
the true-stream rewrite. SAW equivalence staged UNVERIFIED. See
scripts/btungsten/README.md.

**Input-boundary law (founder ruling 2026-10-07, from the genesis
review):** the canonical form binds every ACCEPTED intent uniquely —
which makes the accepted-input boundary part of the invariant. The
genesis accepted unpaired UTF-16 surrogates, which encode silently to
the same replacement bytes, so distinct accepted strings shared one
authorization (a many-to-one conversion before signing, not a signature
forgery). Law: ill-formed strings are REFUSED at encode, malformed
UTF-8 REFUSED at decode — never silently replaced; valid international
text, supplementary characters and a legitimate U+FFFD stay accepted.
The same review closed the model gap: the formal twin must mirror the
variable-length wire (meaningful lengths, valid-input constraints, exact
serialized bytes), not a padded lookalike.

**Result-class law (founder ruling 2026-10-07):** typechecking, sampled
checking (`:check`), universal proof (`:prove`), and implementation
equivalence are four SEPARATE results; no one is ever recorded as
another, `:check` never as proof. A missing tool, a skipped obligation
or a solver timeout is NOT-RUN, never success. Shared byte-for-byte
vectors are pinned before any equivalence claim, and a green workflow
wrapper is never a substitute for an executed proof obligation.


**Right-language law (founder ruling 2026-10-07):** a universal proof
receipt is canonical only if the theorem is about the DEPLOYED accepted
language — the validity predicate is concrete inside the formal model,
or connected to the runtime validator by a separately proved
refinement. A proof can be correct about the wrong accepted language;
that is the exact class of mistake the Beat 2 counterexample eliminated.

**Formal-assurance ladder (founder ruling 2026-10-07 — the default
sequence for every bTunGsTeN workbench):**

```
RED counterexample → accepted-language repair → shared vectors →
formal wire alignment → TYPECHECK → CHECK-SAMPLED (adversarial +
constructed + random arms) → PROVE-UNIVERSAL → eventually
implementation/model EQUIVALENCE
```

No step substitutes for a later one. WB001 is the reference instance;
the CI `formal` job (cryptol pinned 3.6.0) gates on TYPECHECK,
CHECK-SAMPLED and the pinned-vector reproduction (`vectorsHold` — the
model must produce every pinned envelope byte-for-byte: length word,
every meaningful byte, zero tail) every push, and re-proves
`wireInjective` + `wireZeroTail` on the ALIGNED compact wire. Receipt
history, honestly scoped: the 2026-10-07 Q.E.D. (23.7s z3 in-PR, 17.6s
post-merge) proved injectivity of the CAPACITY-PADDED representation —
a valid receipt for that theorem only; founder review B1 found the
model's packing was not the deployed wire (tag offsets displaced by
per-field padding, nonzero bytes past envLen, all 10 pinned vector
prefixes disagreeing at offset 27), the packing was repaired
(tag-after-meaningful-bytes, zeros only past the compact envelope), the
vectors moved from comment to executed check, and the re-proof on the
aligned wire is the canonical receipt. A solver timeout is NOT-PROVEN,
a recorded state, never success and never a CI wedge.


**WB002 — the extinct-infrastructure specimen (founder order
2026-10-07):** SimpleAssets frozen at upstream commit `e6a042f` (2021,
v1.6.1, LGPL-2.1) is preserved verbatim as the standard's first
"extinct infrastructure" reference specimen — an older EOSIO epoch,
attacked, not adopted. The killer invariant: no change of
implementation, network, author, storage provider, cryptographic
algorithm, or execution environment may transfer sovereign authority
without the currently authorized sovereign action. The battery drives a
faithful port of the 2021 state machine through torture (kill the
author, lose the contract, re-key, partition/reorg, corrupt indexers,
replace the contract, migrate chains, advance the clock a millennium)
and requires `canonical sovereignty == reconstructed sovereignty` at
every stage — or bTunGsTeN goes RED. The specimen FAILS parts of the
invariant by design (issuer confiscation via authorctrl, composition
authority held by the author, tenure not enforced on the delegation
return path, consent that never expires); each failure is convicted by
name and becomes a BNR adapter requirement (issuer authority ≠
confiscation authority for sovereign funds — founder ruling 2026-10-07).
The same order fixes the BNR semantic extractions: idata → COMMIT,
mdata → mutable status pointer, delegate → bounded authority,
attach → capability composition, offer→claim → consent, author RAM
payer → sponsored sovereignty. The previously named "WB002 hostile
distributed specimen" leg (kill/reroute/replay/partition/heal) is
absorbed here: those are rows of this battery. Status: executable
battery LIVE in CI; the wasm-vs-model beat EXECUTED 2026-10-07 (the
vendored 2021 wasm, verbatim, on Antelope Spring 1.2.2: a 46-step
corpus at 46/46 verdicts, 0 class/state mismatches, 14 refused steps
atomic on chain — corpus-sampled, local dev chain, NOT a proof);
Cryptol twin RUN in the CI formal job: TYPECHECK + CHECK-SAMPLED pass,
`sovereignContinuity` PROVEN for the abstraction with a TEETH control;
SAW EQUIVALENCE RUN in its own workflow (wb002-saw.yml, SAW 1.6 over
mir-json schema 13): a Rust twin of `step`/`sovereign` proven equal to the
Cryptol spec for all inputs, with a TEETH run that must fail — so
continuity holds of the Rust function. Neither proof reaches the JS port
or the 2021 wasm; those links stay sampled (result-class law).
Model-hardening beat (founder review 2026-10-07, same day):
transactional rollback fidelity (refused actions preserve the whole
pre-state and log) and authenticated display truth (checkpoint
contents verified, suffixes bounded to an authenticated tip) — the
landing closed, the model-correctness claim kept open. See
scripts/btungsten/README.md.

Sequence: WB001 formal core (done: input boundary repaired in beat 2;
the formal ladder climbed in beat 3 — TYPECHECK, CHECK-SAMPLED and
PROVE-UNIVERSAL all receipted in the CI formal job) → WB002
SimpleAssets specimen (CURRENT) → WB003+ scale and century-transition
legs.


## §toolchain — Foundation, Emissary, and replaceability

- **Foundation** (NationalSecurityAgency/Foundation, Apache-2.0):
  Cryptol formal specifications + SAW assurance tooling + SAT/SMT solvers
  — the formal-invariant axis. PRECISION (checked 2026-10-06): the repo
  carries Cryptol specs and tests for AES, ECDSA (P-192…P-521), HMAC,
  KMAC, SHA2, SHA3, Keccak, key wrapping… but NO ECDSA-specific SAW
  proof artifact exists there today. Foundation provides machinery and
  methodology; we apply them ourselves. Anything we have not run carries
  UNVERIFIED.
- **Emissary** (NationalSecurityAgency/emissary): distributed P2P,
  data-driven workflow framework with dynamic agent discovery and
  directory topology — a sacrificial workbench specimen for the
  decentralized/self-healing axis, attacked, not adopted.
- **Autonomi / x0x / BNR stack** — the sovereign substrate under test.
- **Replaceability law (founder, 2026-10-06):** Foundation, Emissary and
  every other tool here are REPLACEABLE test infrastructure. If NSA
  deletes the repo in 50 years or Cryptol/SAW disappears, the standard
  survives and migrates to whatever replaces them — axis 6 applies to
  bTunGsTeN's own tooling first.

Composition:

```
Foundation formal assurance
+ Emissary distributed failure/recovery
+ x0x/Autonomi/Vaulta/BNR actual sovereign stack
→ bTunGsTeN receipt
```

## §receipt — what a bTunGsTeN receipt carries

Verdict computed from observations only; explicit assumptions (the TAM
slice claimed); pass/fail criteria named BEFORE the run; findings with
severity and source (docs/live/harness — the doxx findings discipline);
counts printed by the run itself (CI's own 0→N lines are the ratchet's
evidence, never a local run); secrets asserted absent; boundary not
crossed stated for every claim.
