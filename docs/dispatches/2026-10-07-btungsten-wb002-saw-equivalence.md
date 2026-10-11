# 2026-10-07 — bTunGsTeN WB002: Rust twin + SAW EQUIVALENCE (README §WB002 §next 3)

Seat 3 (Claude Code), branch `claude-LoVis/btungsten-wb002-saw-2026-10-07`,
stacked on #361 (merged `7f9bc6e26`). Founder order this session: after the
Cryptol beat, take the Rust twin + SAW. zCode confirmed nothing in flight on
this lane.

## CLAIM

The Rust twin `scripts/btungsten/wb002-rust` (`step`, `sovereign`) is
**proven equal to the Cryptol spec** `BTungstenWB002.cry` by SAW, over the
twin's MIR, for **every raw input of `step`** and the whole Cryptol domain of
`sovereign`. With `sovereignContinuity` PROVEN in Cryptol (#361), sovereign
continuity therefore holds of the Rust function. A TEETH run shows the same
obligation separates the twin from the specimen machine (the F-1 issuer
head).

**EVIDENCE** CI run 37717055542, job `saw` 113115826461 (head `312d36d5f`),
and the twin run 37717078357 / job 113115901086, both green:

```
/tmp/saw.tar.gz: OK                        (SAW 1.6 release asset, pinned digest)
1.6 (68eed5f release-1.6)
mir-json 0.1.0 (JSON schema version 13)    (built at SAW 1.6's own submodule pin 8cbf9af1)
test result: ok. 2 passed; 0 failed        (cargo test: named seams + 131,072-transition universe)
SAW-BUILD WB002: PASS (2518896 bytes of linked MIR)
SAW-EQUIVALENCE step_matches_spec: PROVEN (mir_verify, z3)
SAW-EQUIVALENCE step_refuses_rest: PROVEN (mir_verify, z3)
SAW-EQUIVALENCE sovereign_matches: PROVEN (mir_verify, z3)
Subgoal failed: wb002_twin/15e1cc6d::step[0] Literal equality postcondition
SAW-TEETH WB002: PASS (the solver separates the Rust twin from the F-1 specimen machine)
```

| obligation | domain | CI |
|---|---|---|
| `step_matches_spec` | tag < 5, head < 16 | PROVEN |
| `step_refuses_rest` | tag ≥ 5 or head ≥ 16: the input comes back unchanged | PROVEN |
| `sovereign_matches` | tag < 8 (all of Cryptol's `[3]`) | PROVEN |
| TEETH vs `stepSpecimen` | must fail | PASS (counterexample) |

The local run on the same pins (WSL) gave the same four results first.

## Sabotage control

Planted in the twin: `Claim` honoured for the holder as well as the offeree
(`if a.signer == s.offeree || by_holder`). Locally, SAW refused
`step_matches_spec` with the exact witness: tag 2 (Offered), holder 64,
offeree 16, head 2 (Claim), signer 64. The twin was restored from a saved
copy before commit. Recorded because a first-try all-green deserved a
control that could have gone red.

## Design notes worth keeping

- **The twin is not a transliteration.** It decodes bytes into `Phase` /
  `Head` enums and runs one guarded `match`, so SAW bridges two genuinely
  different shapes (byte struct vs `[3]`/`[4]` record) through an explicit
  Cryptol bridge (`toStatus`, `toAction`).
- **Malformed input is a separate obligation, not a precondition hiding
  it.** The twin refuses tags it never constructs; the spec does not (it
  lets the holder act on tags 5..7). So equivalence is stated where they
  agree, and `step_refuses_rest` proves the twin is a no-op everywhere
  else. Together they cover all 2^56 inputs.
- **mir-json pin.** The `ghcr.io/galoisinc/mir-json:13` image is built
  from `ece1622c` (2026-09-24), not SAW 1.6's own `8cbf9af1`. Both emit
  schema 13, but the translated std libraries differ, so CI builds
  mir-json from source at SAW's pin (cached by commit + toolchain) instead
  of trusting the moving tag.
- **Own workflow.** `wb002-saw.yml`, not a step in tests.yml's `formal`
  job, so a cold mir-json build can never eat WB001's prove budget.

## Correction carried in this PR

The README's §next 3 said that once the twin and SAW landed "the battery's
sampled histories become provable corollaries." They do not: the battery
runs against the JS port, and nothing proves the port equal to the twin.
The line is replaced with the true scope and what would close it.

## Boundary not crossed

- Twin ≡ spec. NOT the JS port, NOT the 2021 wasm: those links stay
  sampled (the battery, the wasm corpus).
- No workspace crate, no runtime code, no surfaces, no live chain.

## Observed in passing

#367's first `formal` run (37717078434) went red when the hosted runner
was shut down (exit 143) during WB001's prove, after every WB001 check and
the whole WB002 ladder had passed. Same class as the kills recorded in the
WB001 wire-alignment dispatch; not this PR's change.

## NEXT OWNER

- CI green on #367 → this seat merges.
- Open (named, not started): a port-to-twin bridge, either the battery
  driving the Rust twin or shared vectors from the JS port, so the
  battery's histories inherit the proof. Until then they are samples.

HUMAN INTERACTION: NONE.
