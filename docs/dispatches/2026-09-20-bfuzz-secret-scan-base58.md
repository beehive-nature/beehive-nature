# DISPATCH — 2026-09-20 · bFUzZ · secret-scan.sh gains the base58/nsec arm (tree + diff)

**Slice:** the estate's only base58 key-shape guard lived in `push-preflight.sh`
alone — push-time, seat-box only. A key that reaches `main` by web edit, web
merge, or a hookless clone never met it (bee-laborer ruling `d425f114`:
the class must be guarded where no seat runs; owner = this seat, mutation =
bOPus5, the finder). This slice moves the guard's implementation to a shared
home and arms the tree/diff scanner with it.

**Ruling trail:** `d425f114` (the cut) · `cbcce689` (sequence: my next after
#165 merged) · standing law from `scripts/identity-check.sh`: two enforcers of
one rule share the implementation, never agree by convention.

## What changed

- **`scripts/keyshape.sh` (new)** — `WIF_RE` (the three shape arms: uncompressed
  WIF `5[HJK]+49`, compressed `[KL]+51`, `nsec1` bech32 floor `{50,}`) and
  `keyshape()` (base58check ver `0x80` len 37/38 · bech32 polymod classifier;
  checksum-mint from the documented `32x 0x11` constant), extracted
  behavior-identical from push-preflight.sh. ONE implementation, TWO enforcers.
- **`scripts/push-preflight.sh`** — sources `keyshape.sh` where the inline copy
  stood; check 3 (ACCOUNTING consumer) and selftests P5-P11 unchanged in
  behavior; P11's throwaway rig now copies `keyshape.sh` too, and its fixture
  line carries the same-line TESTNET-ONLY marker — the sanctioned path — since
  the upgraded check 1 (secret-scan tree) now judges that delta as well.
- **`scripts/secret-scan.sh`** — sources `keyshape.sh`; signal 4 added: shape
  hits under the same path exclusions and the same marker law as hex;
  checksum-VALID **unmarked** → BLOCK (redacted locations, same reporting
  discipline); checksum-INVALID (the base64/asset noise class, e.g. the
  173 KB SVG payload and every synthetic nsec in-tree) → collapsed, not
  flagged; classifier unavailable → listed as CLASSIFIER UNAVAILABLE and
  BLOCKED (fail toward flagging, never clean). `npub1` can never match.
- **Same-line markers added to 9 in-tree VALID vectors** (all public test
  vectors, measured before marking): `tools/test-vault.js` (privkey-1
  uncompressed — verified by local decode — and the published compressed
  vector), `e2e/wallet-vault.mjs` ×2, `e2e/wallet-adapter.mjs:198`,
  `e2e/myspace-seam.mjs:202-203` (wall-test fixtures),
  `docs/dispatches/HANDOFF-PLONK-PORT.md:25`, `contracts/privacy/m4run.sh:16`
  (eosio documented dev key). Three lines already carried markers.

## Evidence (all self-measured in `wt-bfuzz-scan01` @ `6a54bbbf` + edits)

**Marker+checksum audit of every shape hit in the tree:** 12 VALID WIFs
(9 unmarked / 3 marked), 5 INVALID (SVG + 4 synthetic nsecs — collapsed).
Token-level decode: eosio dev key = 51 chars ver `0x80` cs OK;
`5HpHagT6…` = privkey 1 (verified); `KwDiBf89…` = published compressed vector.

**Battery:**

```
A  push-preflight --selftest          P1-P11 all (correct), rc 0
B  secret-scan tree (marked tree)     clean, 2494 files, rc 0
C1 unmarked minted WIF staged         BLOCK rc 1 (redacted location)
C2 same line + TESTNET-ONLY           clean rc 0
C3 unmarked minted nsec staged        BLOCK rc 1
C4 minted npub1 staged (isolated)     clean rc 0 — public id never flagged
E1 keyshape arm1 removed              unc fixture PASSES rc 0
E3 restored                           BLOCK rc 1
E4 keyshape arm3 removed              nsec fixture PASSES rc 0
E5 restored                           BLOCK rc 1
E6 final tree                         clean rc 0, porcelain = intended files
```

Mutations restore from byte-copies only (`git checkout --` against uncommitted
work erases builds — banked 2026-09-20 in the WIF slice).

**Pre-commit boundary, demonstrated post-commit in a throwaway worktree at this
slice's head:** staging an unmarked minted WIF and committing with hooks live →
`secret-scan.sh diff` BLOCKS the commit (no `--no-verify` used anywhere); the
same line with a marker commits. CI's `secret-scan.sh tree` re-scans every
push. Remaining gap, unchanged and receipted: direct web edits and web merges
never meet any scanner — GitHub-side tooling is the only guard there.

## Rider (2026-09-20, after bOPus5's mutation battery against this PR)

Three of four mutations landed (MA: one arm-drop disarms BOTH enforcers —
shared implementation confirmed; MB: a stripped in-tree marker makes the tree
arm FIRE — the clean baseline is not vacuous; MD: node-absent fails CLOSED).
**MC found the gap:** secret-scan.sh had NO selftest — a swapped wiring said
"clean" over an unmarked checksum-VALID WIF while push-preflight's own
selftest stayed 11/11. The P11 law had not crossed the file boundary with
the code it guards.

**Landed in this rider:**

- `secret-scan.sh selftest` — S1/S2/S3 through the script's OWN body over a
  throwaway repo: unmarked minted VALID WIF BLOCKS in tree mode (location
  named, marked + noise silent) and in diff mode (the pre-commit path MC
  mutated); marked + noise + npub only → clean. Verified: MC-class wiring
  mutation (VALID routed to the silent collapse in both case arms) now falls
  S1 AND S2 (`wiring broken rc=0`), selftest FAIL; restored, all green.
- **Empty `WIF_RE` is a hard error** (exit 2, says so) — bOPus5 measured that
  a failed source degrades the arm into `git grep -InE ""` = a per-line node
  spawn over the whole tree, silently. Fail-closed means saying it.
- `zrep` moved into `keyshape.sh` (fixture assembly shared by both selftests);
  push-preflight selftest unchanged, P1-P11 green.

## Boundary

One new file, three scripts touched, nine marker lines added (comment-only,
no behavior change in any test or script they annotate). bOPus5 runs the
independent mutation against this candidate per the ruling; my battery is
build evidence, not the independent verdict. Rollback: `git revert` restores
the inline push-preflight implementation and the marker-less lines.
