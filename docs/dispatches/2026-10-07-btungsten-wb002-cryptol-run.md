# 2026-10-07 — bTunGsTeN WB002: the Cryptol twin RUN (README §WB002 §next 2)

Seat 3 (Claude Code), branch `claude-LoVis/btungsten-wb002-cryptol-2026-10-07`,
base `08d11832b`. Founder order this session: take the WASM-vs-model beat,
then the Cryptol/SAW container beat. Check-before-acting (Law 11): the
WASM-vs-model beat had already landed (zCode, PR #359, 46/46 on Spring
1.2.2), so it was not redone. WB001's Cryptol leg is zCode's live lane
(#357, `wire-align`); this beat touches no WB001 file and inserts its CI step
away from #357's hunk.

## CLAIM

`sovereignContinuity` — sovereignty of a SimpleAssets asset changes only
under the acting sovereign's signature, or by the offeree cashing the
standing consent the sovereign signed — is **PROVEN for ALL states and
actions of the Cryptol abstraction `step`** (Q.E.D., Z3), and the same
words are shown to have TEETH: the solver REFUTES them on the specimen
machine (`step` + the F-1 issuer head that the 2021 wasm accepted live).

**EVIDENCE** `scripts/btungsten/wb002-cryptol/BTungstenWB002.cry`,
`scripts/btungsten/wb002-formal-check.sh`, the CI `formal` job's WB002
step (cryptol 3.6.0, bundle sha256 `621860aa…` — the same asset the job
installs; the local copy was checked against the digest CI printed).

| class | local (WSL, pinned bundle) | CI — run 37705766658, formal job 113079637803, head `d54e8ce26` |
|---|---|---|
| TYPECHECK | PASS | PASS |
| CHECK-SAMPLED | PASS — 100 random (0.00% of 2^^47) + constructed F-1 row | PASS — same |
| PROVE-UNIVERSAL `sovereignContinuity` | PROVEN — Q.E.D. 0.071s Z3 | **PROVEN — Q.E.D. 0.019s Z3** |
| TEETH `continuityOf stepSpecimen` | PASS — counterexample `{tag=0x6,…}` / `{head=0xb, signer=0xa1, …}` | PASS |
| EQUIVALENCE | NOT ATTEMPTED | NOT ATTEMPTED |

## RED first

The staged `Sovereign.cry`, loaded exactly as landed, never parsed:

```
Parse error at …/wb002-cryptol/Sovereign.cry:33:28,
  unexpected: ;
  expected: a declaration
```

Three parse classes in order, each repaired syntax-only (`step`'s
clauses are byte-for-byte the same guards, parenthesized):

1. `module BTungstenWB002 where;` — no semicolon (WB001 round-2 class).
2. `Actor : Type` / `Actor = [8]` — a type synonym is `type Actor = [8]`;
   the old form parsed as a VALUE and died at the first record comma.
3. `sovereign s == a.signer && s.tag != T_GONE` — Cryptol binds `&&` /
   `||` tighter than `==` / `!=` (both non-associative at precedence 20),
   so every compound guard needs parentheses. The tool refuses the
   ambiguity rather than mis-parsing it.

File renamed to its module name (`BTungstenWB002.cry`, the WB001 round-4
lesson). The header's "NOT-RUN" line was false the moment this ran and
is replaced, not patched.

## Sabotage control

A planted borrower-theft seam (`A_RETURN` → `free a.signer` instead of
`free s.lender`) **passed 100 random samples** and was **REFUTED by the
prove leg** (`{tag=0x1, holder=0xaf, lender=0x50, …}` / `{head=0x5,
signer=0xaf, …}`), turning the runner red. Recorded because it is the
honest case for the universal leg: at 47 bits, random sampling is
decoration; the solver is the gate. File restored before commit.

## Boundary not crossed

- The proof is about the Cryptol `step` as written. It says NOTHING yet
  about `wb002-simpleassets.mjs` or the 2021 wasm — linking them is the
  EQUIVALENCE class (Rust twin + `wb002-saw/sovereign.saw`), not run.
- `step` models the bnr-adapter profile's attach (sovereign composes);
  upstream gates attach to the author (F-3). Not changed here — semantics
  were out of scope for a syntax repair.
- No WB001 file, no runtime code, no surfaces, no live chain.

## NEXT OWNER

- CI green on #361 → this seat merges.
- WB002 §next 3: Rust twin of `sovereign`/`step`, then SAW equivalence.
  SAW needs its own pinned Linux x86_64 install in the `formal` job.

HUMAN INTERACTION: NONE.
