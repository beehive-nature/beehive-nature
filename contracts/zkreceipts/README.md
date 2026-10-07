# contracts/zkreceipts — count-only aggregate claims over private receipt sets

Lane: SPEC-ZK-RECEIPT-AGGREGATES-1 (zCode seat, 2026-10-06). The Vaulta/ZK
lane's v1: a prover who HOLDS a private receipt set publishes a COUNT —
not the set — and anyone verifies it against the committed root, on-chain,
with the estate's own nine-phase PLONK verifier.

```
cohort receipt (docs/receipts/ant-reach-cohort-2026-10-06.json)
   40 members, fingerprints only, raw addresses discarded (ant-reach law)
        │ zkrprep.cjs  — encode leaves, cross-check every aggregate
        ▼
count.circom — FULL-TREE fold: root derives from exactly this leaf set;
   per-leaf kind logic: kept = (≥1 settled run) ∧ (zero flips)
        │ prove (snarkjs plonk, pot17 one-honest-seat rehearsal ceremony)
        ▼
proof π + public claim (root, kind K, count N)
        │
        ▼
zkrcount.cpp — anchor(root,K,N) [M9-bounded: the head, never the set]
   → verify(seq, π): nine-phase PLONK over publics FROM THE ANCHOR ROW
```

SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.

## The claim shape (the spec's law)

An aggregate claim may state counts, sums-bounds, and commitment roots —
never contents, identities, or raw addresses. v1 is COUNT-ONLY: two live
claims over the 2026-10-06 cohort are "20 dead-baseline members kept their
phenotype" (kind=0) and "20 live-baseline members kept it" (kind=1), both
under one root committing all 40 fingerprints + verdicts. The receipt's
43/50 settled-observation figures are SUMS — the SECOND circuit, not this
one (the spec's count-first law).

## Files

- `count.circom` — the circuit. 101,275 constraints, 3 publics, measured
  at compile (receipt in the dispatch). Full-tree fold, not per-member
  paths: the root provably derives from EXACTLY the 64-leaf witness (40
  members + 24 constrained zero pads). **THE SELECTOR LAW (2026-10-06
  repair):** `picked = dOut + kind·(lOut − dOut)` — K selects its OWN
  baseline's counter. The first build muxed with `IsEqual(kind,0)` whose
  output is 1 at kind=0, so every claim counted the OPPOSITE baseline;
  the cohort's 20/20 symmetry hid it (found in the founder-ruled source
  review; both labels verified while swapped). Pinned by the asymmetric
  fixture below — reversed claims have NO satisfying witness.
- `fixtures/asym-cohort.json` — TEST FIXTURE (synthetic, derived from the
  real receipt by flipping one live member's settled verdict): deadKept=20,
  liveKept=19. The regression ladder: both correct claims prove and
  verify; kind=0/count=19 and kind=1/count=20 are REFUSED at witness
  generation (`picked === count` unsatisfiable); tampered kind/count on a
  real proof fails verification.
- `zkrprep.cjs` — witness builder; every aggregate cross-checked against
  the receipt's own numbers (fails loud on any disagreement).
- `gen_vk_count_cpp.js` — vk → `vk_count_constants.hpp` (decimal bytes;
  copy of the M4 generator, provenance lines only).
- `plonk_verify_count.hpp` — VERBATIM copy of `../privacy/plonk_verify.hpp`
  with exactly three cited divergent lines (includes + N_PUBLIC assert).
- `zkrcount.cpp` — the on-chain gate: `init(max_anchors)` + `anchor` +
  `verify`, root as RAW BYTES (the fixed_bytes T-laws never touch the
  transcript), one proof per anchor, alg id 2 shared with note.cpp's law
  row. v1.1 (review 2026-10-07): `anchor()` stays permissionless BY
  DESIGN but the table is BOUNDED by the law row's cap — the
  contract-RAM budget refuses in the open ("anchor table FULL (bounded
  resource budget)") instead of growing without bound; the exhaustion
  regression (fill to cap, controlled refusal) is a leg of the enforcing
  self-paid runner.
- `zkrself-run.sh` / `zkrself-recheck.sh` — the ENFORCING self-paid
  testnet runners (zkrtst111111): a negative test passes ONLY on its
  specified failure reason; positive tests assert execution AND the
  verified_at transition; prerequisite anchors are reconciled against
  chain state with bounded recorded retries (state-visibility rule);
  exit 0 ⇔ every leg passed. (The print-only v1 forms, reviewed at
  31ec63316, are superseded.)
- `zkrself-final.sh` + `final-find.mjs` — the FINALIZER (v4, review
  orders 2026-10-07 round 4): reconciles STANDING anchors (no deploy, no
  RAM) — parent-owned failure accounting (discovery NEVER records inside
  a subshell), a required-leg ledger (a leg that never ran is a
  failure), EXACT build identity, and the asserted final state through
  the shared helper. v4 closes three further v3 failure modes, each
  offline-proven before this runner's next live use: (1) THE IDENTITY
  GATE — identity is read-only and completes BEFORE any wallet access or
  action push; failed, absent or unreadable identity ends the run
  nonzero with ZERO action calls (v3 recorded the FAIL and pushed 7
  verify + 1 anchor against an unidentified build); (2) STATUS
  PROPAGATION — a refusal is nonzero command status PLUS the contract's
  own message (exit 0 with error-like text fails), and a state-bearing
  read whose COMMAND failed can never establish state (raw read and
  parse are separate; v3's final-table pipeline took the parser's
  status, not cleos's); (3) RUN-LOCAL STATE — a private per-run mktemp
  dir replaces the fixed /tmp/zkr-* paths (another run's startup
  truncation once emptied the discovery log, the spec became [], and the
  helper graded a bare row count green), the assertion spec is built
  from the PARENT-OWNED discovery record with one checked write +
  read-back, and coverage is MANDATORY: the spec must carry exactly the
  claims discovery recorded this run — an empty record fails the final
  leg instead of shrinking the work. `W=` is env-honored (v3 silently
  ignored it).
- `reconcile_row.mjs` / `final_table_assert.mjs` — the shared
  read-side helpers: `readFileSync(0)` blocks to EOF (the stdin race
  that misparsed valid responses is structurally gone, not retried
  away), failure classes named and exit-coded (malformed · transport ·
  missing · mismatch; the final-table helper adds verified_at-class and
  row-count), `verified_at` must be a VALID uint32 timestamp BEFORE
  the positive-vs-zero assertion (missing/null/nonnumeric/negative all
  fail — review order 3), and the final-table helper validates the SPEC
  itself (review order 4): unreadable, non-array, EMPTY, malformed
  entries and duplicate seqs all exit 8 — an empty spec once graded a
  perfect table green on row count alone, a check of nothing.
- `zkrself-parse-test.sh` / `zkrself-final-offline-test.sh` +
  `zkrself-final-v4-offline-test.sh` + `fixtures/parse/` +
  `fixtures/final/` — the OFFLINE proofs (no network, no chain, no
  RAM): 15/15 parser/timestamp cases including the reviewer's four
  timestamp mutations; the finalizer's accounting proven by stub replay
  (happy green, a MISSING row fails its leg and the run, a wrong merely
  non-empty code hash fails identity); and the round-4 counterexample
  battery — SELF-CONTAINED (synthesizes its own lab stand-in; runs
  wherever bash + node run) — which first reproduced all three v3
  failure modes red (actions after failed identity, exit-0 refusals
  graded green, a failed final read passed through the pipeline, an
  empty discovery record graded on row count, shared /tmp state) and
  proves them closed in v4: 23/23. Harness changes prove out here
  BEFORE any chain use.
- `prove_count.sh` — pipeline: compile → ceremony → setup → vk → witnesses
  → TWO proofs (kind 0/1) → off-chain verifies → calldata → the FORGERY
  set → the ASYM regression. `PTAU=` selects the ceremony: default is the
  lab's one-seat rehearsal pot17; the RELEASE artifacts are derived with
  `PTAU=hez17.ptau` (see the ceremony section).
- `zkrrun.sh` — the acceptance pass (the m4run discipline): rehearsal
  chain boot + activation ladder → deploy → both real proofs verify →
  every refusal: forged / mutated count / mutated root / mutated kind /
  re-verify / bad kind at anchor time → the ASYM legs (fixture-root proofs
  verify; reversed-count anchors are refused by the pairing).

## The ceremony (two tiers, 2026-10-06 ruling)

- **REHEARSAL tier:** `pot17_final.ptau`, ONE honest participant (this
  seat) — rehearsal-labeled, the standing estate law until a witnessed
  multi-party sealing is ruled for anything BNR-originated.
- **RELEASE tier:** the PUBLIC multi-party transcript — Hermez
  `powersOfTau28_hez_final_17.ptau` (54 contributions + a beacon; the
  perpetual-powersoftau lineage), power 17 = 128k constraints ≥ the
  circuit's 116,537 PLONK constraints. Verified three independent ways:
  (1) blake2b-512 matches the hash published in the iden3/snarkjs
  README's ceremony table byte-for-byte; (2) the hermez S3 original
  and the circom.info mirror are byte-identical (two independent
  download locations); (3) `snarkjs powersoftau verify` ran to
  completion 2026-10-07 — "Powers of Tau Ok!", exit 0, snarkjs 0.7.6,
  ≈1 h 45 m unrestarted. RELEASE artifacts
  (zkey, vk, vk_count_constants.hpp, proofs) are derived with
  `PTAU=hez17.ptau`. Multiple agents on one shared host are NOT
  independent trust domains (ruling); a fresh BNR ceremony would need
  human participants on separate machines — the witnessed-sealing kit
  stays a named future lane. Nothing here authorizes mainnet deposits.

## Labeled boundaries (what this does NOT prove)

- Measurement ORIGIN: the circuit proves the claim about the witness set;
  it cannot prove a browser really dialed anything. The origin question
  needs seat-signed receipts feeding the commitment (the founder split's
  named boundary; second circuit lane).
- Vantage independence: out of proof scope without cryptographic vantage
  identities (the ant-reach precision stands).
- The ceremony tier per artifact is stated with it (see above): rehearsal
  proofs ride the one-seat pot17; release artifacts ride the public
  Hermez transcript (all three verification checks green). A witnessed
  multi-party BNR sealing remains
  the named future lane for anything needing estate-originated setup.
- On-chain verification is MEASURED on BOTH the local Spring v1.2.2
  rehearsal chain (9,629 / 12,427 µs billed) and VAULTA PUBLIC TESTNET
  (jungle4, `zkrtst222222`, code hash identical: 12,071 / 10,647 µs
  billed) — `zkrrun-jungle4.sh` is the sponsored testnet runner (the
  spladder recipe). Vaulta mainnet: out of scope until a witnessed
  ceremony ruling.

## Kin

- `../privacy/` — the verifier engine (M4–M10), the anchor law (M9), the
  UB/aliasing/T laws this lane inherits verbatim.
- `docs/raids/RAID-VAULTA-ZK-1.md` — the source study + §tungsten gate.
- `docs/receipts/ant-reach-cohort-2026-10-06.json` — the evidence set
  whose published summary this circuit makes cryptographic.
