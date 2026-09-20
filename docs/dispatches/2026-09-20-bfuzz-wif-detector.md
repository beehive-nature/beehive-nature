# DISPATCH — 2026-09-20 · bFUzZ · WIF/nsec key-shape arms in push-preflight

**Slice:** `scripts/push-preflight.sh` — the estate's only base58/bech32 key detector
was `{48}`-shaped and measured DEAD on every real WIF form; this slice replaces it
with three live shape arms behind a checksum classifier, in ACCOUNTING form.
**Lane:** `bfuzz/wif-detector-2026-09-20` off `420c05f3` (main at slice start).
**Rulings consumed:** LoVis bee-laborer `5c405c79` (three arms; accounting path
like the 64-hex check; the six vector files stay committable; the SVG case
resolved, not tolerated; npub never blocked) and `0f8d72f1` (two-arm re-cut,
superseded by the three-arm cut); bOPus5 `6af38b6a` (checksum-minted fixtures,
the disjoint-remedy measurement, 12 VALID / 1 INVALID in-tree) and `d3037a1d`
(the compressed-arm hole that started this).

## What changed (one file)

- **`WIF_RE`** — three shape arms, one implementation shared by check 3 and the
  selftest (the I-1 standing law: enforcers share code, never agree by
  convention):
  - arm1 uncompressed WIF: `5` + `[HJK]` + 49 base58 = 51 chars
  - arm2 compressed WIF: `[KL]` + 51 base58 = 52 chars
  - arm3 nostr secret: literal `nsec1` + bech32, floor `{50,}` (real shape is
    58 after the prefix; the floor routes the two in-tree 61-char near-shape
    fixtures through the classifier instead of around the arm)
- **`keyshape()`** — a `node -e` classifier/minter (no new file, no new
  dependency beyond node, which the estate's scripts already assume):
  base58check verify (BigInt decode, sha256d, version 0x80, length 37/38) and
  bech32 verify (BIP-173 polymod) for classify; checksum-mint from the
  documented non-secret constant `32 x 0x11` for fixtures. `ERR` (node absent
  or broken) degrades check 3 toward LISTING every shape hit.
- **Check 2** loses the dead `{48}` arm (measured 0 hits on 51- and 52-char
  real shapes; a 50-char match it could block is not a key). PVT[_K1_] / xpr[v] / PEM
  stay hard-block.
- **Check 3 (new, ACCOUNTING class — the 64-hex model, never a block):** shape
  hits on added lines are classified; checksum-VALID hits become ACCOUNT FOR
  EACH rows (token prefix, validity detail, delta line); checksum-INVALID hits
  collapse to one count line — the base64/asset noise class, resolved by
  construction, not tolerated. Classifier failure lists everything and says so.
- **Checks renumbered 3-6 → 4-7** (tmp files follow); P2's selftest regex
  `^[1-6])` → `^[1-7])`; the closing JUDGEMENT line now reads 3, 4, 5 and 7.
- **Selftest P5-P10** (the founder known-BAD/known-GOOD law, extended): every
  BAD fixture is MINTED at runtime — shape-only fixtures would pass the arms
  and die in the classifier, a green selftest over a blind gate (the vacuity
  trap bOPus5 named). P5/P6/P7 per-arm non-emptiness; P8 minted npub1
  (checksum-VALID, public) must hit NO arm; P9 shape-only noise must classify
  INVALID; P10 classifier non-vacuity (minted VALID, one char flipped INVALID).

## Evidence (all self-measured in `wt-bfuzz-wif01` @ `420c05f3` + fixed file)

**Baseline RED at pristine main** (`.scratch/wif-baseline.sh`, synthetic
runtime-built shapes): today's `{48}` hits 0 on every form — uncompressed,
compressed, nsec, and all GOODs; HEX_RE hits 0 on all (base58/bech32 are
invisible to hex). My whole-tree sweep (`.scratch/wif-sweep.sh`): arm1 8 hits /
6 files, arm2 5 hits / 4 files (incl. `assets/museum/luna-seals/blunatic.cardImage.svg`),
arm3 4 full-shape runs + 1 partial (2× 58-after-prefix real shape, 2× 61 —
`e2e/buzz-guard-shot.mjs:22,:73`; 1× 39 partial). bOPus5's 4-hit count
reproduced; the lengths are mine.

**Selftest:** P1-P10 all `(correct)`, rc 0 (`sh scripts/push-preflight.sh
--selftest`, Git-for-Windows sh; `sh -n` clean).

**Mutation battery** (restore from a byte-copy, NEVER `git checkout --` — which
against uncommitted work erases the build; learned mid-slice when the first
battery destroyed the edits and they were rebuilt):

| mutation | falls | correct rows |
|---|---|---|
| arm1 removed | P5 MISSED only | 9/10 |
| arm2 removed | P6 + P9 MISSED (P9's noise fixture is arm2-shaped — extra sensitivity) | 8/10 |
| arm3 removed | P7 MISSED only | 9/10 |
| restored | none | 10/10, rc 0 |

**Committability demo** (scratch worktree @ `420c05f3` + the fixed preflight,
one never-pushed commit, pre-commit hook fired — no `--no-verify` — then torn
down and verified gone): delta touching the eosio dev-vector line in
`e2e/wallet-adapter.mjs`, the compressed vector in `tools/test-vault.js`, the
SVG's payload line (viewBox edit), a minted-npub file, a minted-nsec file.
Result: check 3 lists THREE rows — `5KQwrPbw… VALID ver=0x80 paylen=33`,
`KwDiBf89… VALID ver=0x80 paylen=34`, `nsec1zyg3… VALID bech32(nsec)` — plus
`(1 checksum-INVALID shape run(s) — base64/asset noise class — collapsed, not
listed)` for the SVG; the minted npub1 (63 chars, checksum VALID) produces NO
row anywhere; **PREFLIGHT_RC=0**. The six vector files stay committable; the
SVG class is collapsed; a real nsec in a delta would be an accounting row.

**Known limits, receipted not hidden:** the classifier anchors on well-formed
keys — a mangled (corrupted) WIF/nsec passes as noise (bOPus5's stated trade:
a malformed key is not spendable); the shape arms are preflight-only — CI's
tree scan (secret-scan.sh) still carries no base58 rule, so the re-scan-on-push
backstop does not cover these forms; node absence degrades to listing.

## Boundary

One file. No spec, no surface, no payment code, no wallet. bOPus5 runs the
independent mutation against this candidate per bee-laborer's routing (the
writer does not prove his own gate); my battery above is build evidence, not
the independent verdict.

Rollback: `git revert` of the slice commit restores the `{48}` arm and the old
numbering.
