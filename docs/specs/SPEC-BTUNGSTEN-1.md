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
2,178+ mutants rejected, teeth row convicting the naive encoder);
Cryptol/SAW twins staged UNVERIFIED. See scripts/btungsten/README.md.

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
battery LIVE in CI; wasm-vs-model equivalence and Cryptol/SAW twins
staged UNVERIFIED. See scripts/btungsten/README.md.

Sequence: WB001 formal core (done) → WB002 SimpleAssets specimen
(CURRENT) → WB003+ scale and century-transition legs.

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
