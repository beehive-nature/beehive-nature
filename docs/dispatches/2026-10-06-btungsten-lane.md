# 2026-10-06 — bTunGsTeN lane genesis: the standard named, WB001 live in CI

zCode seat, branch `zcode/btungsten-2026-10-06`. Founder order 2026-10-06
(relayed design, verbatim intents preserved): formalize Tungsten as
**bTunGsTeN Standard Test** — "a civilization-scale conformance framework
for sovereign digital systems" — kept "a measurable conformance system
rather than a slogan," with Workbench 001 = the intent-binding invariant
through the Foundation (Cryptol+SAW) methodology.

## Upstream priority check (before lane start, per AGENTS.md)

`gh api notifications` full pass 2026-10-06: no dirvine / maidsafe /
autonomi items outstanding. Repos with unread items: beehive-nature,
block/buzz, ggml-org/llama.cpp, loviswaternakamoto/x0x, saorsa-labs/x0x,
skaists/*, aautonomicc/Watch-It, sprksocial/client. The daily 09:00
upstream automation owns the deep check; this pass clears the lane-start
bar. Main CI at lane start: green (tests + secret-scan success,
2026-10-07T00:47Z runs on `4593411fe`).

## Reconciliation before labor

"tungsten" was already live estate vocabulary — this lane did not coin it,
it named the umbrella:

- `tools/net-doxx/` — the tungsten test harness (verdict from
  observations; live FAIL `tt-20261005031759-e336b5` published).
- SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten (origin/main `4593411fe`, landed
  hours before this lane): the ZK lane gates ANY upstream coupling on its
  own four-receipt tungsten result. bTunGsTeN-1 is now the standard that
  gate instantiates; nothing about that gate changes.
- `docs/research/2026-10-05-autonomi-10-100gb.md` — the storage-scale
  tungsten ladder.

## Receipts (claim → evidence → boundary not crossed)

**CLAIM** SPEC-BTUNGSTEN-1 canon landed — the standard, its six hard
properties (decentralization; Sybil/MiM; autonomous healing; autonomous
learning with bounded/testable/reversible/attributable/receipted changes;
>10B capacity as population×load×partitions, math bounds + physical
ladder; ≥1000-year continuity with the honesty clause), the measurability
law (immunity only within the published adversarial model; receipt or it
is prose), the procurement watch clause, the precedent reconciliation,
the WB pipeline, and the toolchain replaceability law.
**EVIDENCE** `docs/specs/SPEC-BTUNGSTEN-1.md`, this commit.
**BOUNDARY** a spec is law, not result; no system is bTunGsTeN-conformant
today, and the spec says so by construction (every property demands its
receipt).

**CLAIM** WB001's executable battery runs green: the intent-binding
invariant holds under the full mutation matrix.
**EVIDENCE** `node --test scripts/btungsten/wb001.test.mjs` — 10/10
tests: injectivity corpus 25/25 distinct canonical forms (incl.
nested-envelope, boundary-shift twins, u32/u64 boundaries, multibyte
UTF-8); 21 field-move mutants rejected across all ten fields;
1,640 one-bit envelope mutants (205 bytes × 8) rejected; 512 one-bit
signature mutants rejected; 5 structural forgeries refused by name
(reorder / unknown tag / duplicate / length-splice / truncation);
domain/nonce/epoch participation; cross-key; TEETH row convicting the
naive length-free encoder on BOTH adjacent-variable-field collision
pairs (destination/capability, payer/payload) — if that row ever goes
green the battery lost its teeth.
**BOUNDARY** sampled mutants, not a proof for all intents — that is the
Cryptol/SAW leg below; Ed25519 itself is used as shipped (node:crypto),
assumed-correct within the model, not re-verified here.

**CLAIM** the battery is CI-wired, globbed with a non-vacuity guard.
**EVIDENCE** tests.yml static job, step "bTunGsTeN WB001 — intent-binding
mutation matrix (globbed, never listed)": `if: always()`, count guard
refuses an empty glob by name, `node --test $(ls
scripts/btungsten/*.test.mjs)`. `node scripts/lint-ci-shape.mjs`:
123/123 suite steps guarded. YAML parsed with js-yaml 4 (out-of-repo
temp install): parse OK, step present, `if: always()`.
**BOUNDARY** the counts the suite prints are the ratchet baseline source;
this dispatch's numbers are informational until CI prints its own.

**CLAIM** the formal leg is staged with named gaps, honestly.
**EVIDENCE** `scripts/btungsten/wb001-cryptol/Intent.cry` (P2
injectivity for ALL intents; P3 binding over an assumed signature
primitive) and `scripts/btungsten/wb001-saw/intent.saw` (equivalence
plan against a future Rust twin) — both headed STAGED/UNVERIFIED.
**BOUNDARY NOT CROSSED** neither file has executed under cryptol/SAW:
SAW ships Linux x86_64 binaries; this seat is Windows and the box is
aarch64. Named next beats: (1) cryptol typecheck + `:check
canonicalInjective` on the CI ubuntu runner, (2) Rust twin of
canonical/decode proven against shared pinned vectors (bpq precedent),
(3) SAW equivalence proof, (4) WB002 hostile-distribution leg.

**CLAIM** Foundation posture verified first-hand, with the precision
correction banked.
**EVIDENCE** github.com/NationalSecurityAgency/Foundation fetched
2026-10-06: Apache-2.0; dev containers carry "the tooling (Cryptol,
SAW, supported SAT/SMT solvers…)"; `algorithms/ECDSA/` = Cryptol specs
for all five NIST curves (p192…p521.cry, ECDSA.cry, Routines.cry) and
NO .saw assurance artifact at that level.
**BOUNDARY** we therefore do NOT claim NSA formally proved ECDSA via
SAW — the machinery exists, the application is ours to run (UNVERIFIED
until our own SAW runs). Emissary is positioned as a sacrificial
distributed-workflow specimen to attack, never a dependency; Foundation
likewise — axis 6 applies to bTunGsTeN's own tooling first.

## Laws honored

Worktree law (all staging from `wt-zcode-btungsten`, explicit pathspecs);
reports-in-tree (this file); crypto wording caps held; no surfaces
touched (no registration ritual due); secrets none (keys made in-process
by the battery); CI-shape and YAML parse gates run before push; landed
via PR so the workflow edit's true parse gate is the PR run itself.

## NEXT OWNER

- CI merge of this PR once green: the authorized merger (this seat, per
  the no-stall law, merges on green).
- Beat 2 owner (any seat): cryptol typecheck + `:check` run on CI ubuntu;
  then the Rust twin + SAW equivalence (README §next names the order).

HUMAN INTERACTION: NONE.

## Carry-overs

- WB002 (hostile distribution via an Emissary-style specimen) — design
  exists in SPEC §workbench; build after WB001's formal leg closes.
- bTunGsTeN surface page (the standard deserves a public face; not this
  beat — no product to render yet, and the registration ritual is
  heavyweight).
- Vaulta/ZK lane note: §tungsten of SPEC-ZK-RECEIPT-AGGREGATES-1 can now
  cite SPEC-BTUNGSTEN-1 §axes 2+5 as its umbrella when its receipts land.
