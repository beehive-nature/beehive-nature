# RECEIPT — LAND-FIRST reconciliation: the engine half lands, the surfaces half already lived

**From:** zCode (GLM 5.3) · **2026-08-19** · against `HANDOFF_COWORK_KEYBUILD_2026-08-18.md` (verbatim, landed this commit)
**Status:** LANDED — key-build + rust/bsafe-host + e2e + sprint docs + CI lanes. Job One as written was impossible and force-landing it would have been destructive; this is the record of why, and what landed instead.

---

## 1 · What the handoff ordered vs what the tree said

The handoff ordered `git am LAND-FIRST.patch` onto main. Law #9 (check whether it already
landed) applied before the `am`:

- The patch's rebase base `3e108d5` (authored by this seat, 2026-08-18 04:37) is 15+
  commits behind main (`3e108d5..HEAD` = c370410 → aff8569).
- The patch's **surfaces half already landed and evolved past it**: the hub
  (`surfaces/index.html`) via 4b2d1c4, renamed/extended via 2f0d886 and 0ab62e4;
  `hardware/`, `onboarding/`, `recover.html` on the same lineage, continued by 16c659a.
  The bDiD→bzDiD rename (2f0d886, VOCABULARY Law 6) renamed the engine file
  `bdid-key.js` → `bzdid-key.js` and the global `BDIDKEY` → `BZDIDKEY`; the onboarding
  wiring is consistent post-rename (loads `bzdid-key.js` at index.html:190, reads
  `window.BZDIDKEY` at :202 — verified on disk). ⌂ hub badges present on the blight
  pages (`grep -c '⌂|hub-badge'`: blight/index.html 1, inscription-explorer.html 2,
  museum.html 1).
- The patch's **engine half never landed**: no `key-build/`, `rust/`, `e2e/` anywhere in
  history (`git log --all -- key-build/` is empty); the sprint docs — including the
  **RATIFIED** BNR-LAB-1 charter — lived only inside the handoff zip.
- `git apply --check` on the patch fails on all ten badge hunks (every blight page moved
  since 3e108d5). `git am` refuses; force-applying would revert the founder-directed
  rename and the visual-layer fixes. The patch itself was honest on its own base —
  verified in a throwaway worktree (2026-08-19): it applies cleanly onto `3e108d5`.
  It is main that moved, not the patch that lied.

## 2 · Receipts — all from the landed tree, 2026-08-19

*Run provenance (precision pass, same day): every run below is environment-labeled —
node and e2e legs ran Windows-side (node v24, Git Bash, playwright chromium); the cargo
leg ran in WSL. The Cowork seat separately reports 26/26 from its Linux sandbox on both
the pack original and the landed tree (their ledger, 2026-08-19). Two machines, three
independent engines, one contract.*

**Node engine** (`key-build/bdid-key`, Windows-side node in Git Bash): `npm ci && node
test/test.mjs` →
**26 passed, 0 failed**, pinned cross-implementation vector regenerates byte-identically:

```
prf_secret  0101…01 (0x01 × 32)
master_prk  d54134a6b181fd7af5a3870446d9a91b73b551ed3ef52f153841a73be093d4ac PUBLIC-CONSTANT
context     "bnr.b"
record_pub  761e0ec527d094b3b5afe40a5f8c78b0be8c54e7c9cf6d79bf62255625a84591 PUBLIC-CONSTANT
fp_words    "lock robust differ helmet baby stable"   fp_hex 837768f7
first3      "stem answer claim"
```

**Rust** (`rust/bsafe-host`, WSL): `cargo test` → **4/4** —
`frame_roundtrip_and_refusals`, `prologue_mismatch_fails_handshake`,
`noise_xx_handshake_transport_and_tamper_refusal` (thp);
`full_stack_over_mem_transport` (host).

**E2e** (`e2e/e2e.mjs`, Windows-side playwright chromium, run against the live tree's
surface): **6/6** — engine loaded
(`BZDIDKEY` truthy, `PREVIEW=false`); phrase-only root = 24 valid BIP39 words; restore
via the DOM rebuilds the same fingerprint; bad checksum refused honestly; full passkey
ceremony (authMode=real, door=passkey+phrase, 24 words → recovery screen); PRF
determinism (re-assertion → identical fingerprint) with the CTAP2 virtual authenticator
**with** `hasPrf:true`.

**Live hub** (WebFetch, 2026-08-19): `surfaces/` serves **30 cards across 7 wings, zero
broken** — the handoff's "18" predates the design-unify sprint's additions (gallery,
apiary/farmers/coop, bFood Hexagon, MAKE wing, review deck…).

## 3 · What landed (this commit)

- `key-build/bdid-key/` — engine src, dist (vendored ESM + IIFE), 26-test suite,
  package.json + lockfile. Name kept `bdid-key`/`bdidrec` pending gate **G2** (labels
  are rename-now-or-never by founder ruling); the surface global is `BZDIDKEY` — the
  seam is exercised by the e2e.
- `rust/bsafe-host/` — THP frame codec + Noise XX workspace with its own lockfile,
  deliberately outside the kernel workspace's members list.
- `e2e/` — the suite ported from the pack: root parametrized (`E2E_ROOT`, defaults to
  in-repo `surfaces/onboarding`), Cowork chromium path dropped, `BDIDKEY`→`BZDIDKEY`
  throughout. 6/6 above is the ported version.
- `docs/` — SPRINT-FINISH-LINE-MAP (gates G1–G6, workstreams WS-1–8), WORKLOAD-
  DISTRIBUTION, **BNR-LAB-1 (ratified 2026-08-18 — now on the wall, not in a zip)**,
  BSAFE-DEVICE-1, HARDWARE-CUSTODY-REVIEW, the FileKey and trezor research record,
  SPRINT-PACK-2026-08-18 (the pack map).
- `.github/workflows/tests.yml` — new `node` lane (engine 26 + e2e 6, chromium via
  playwright) and a bsafe-host lane (`--manifest-path`, own lockfile). **WS-1 closed.**
- `.gitignore` — `node_modules/`.

**Not landed, on purpose:** the pack's `surfaces/` pre-patch copies and
`onboarding.patch` — main is ahead of them; landing them would revert founder-directed
work (§1).

*Scanner markers:* the pre-commit secret-scan gate (correctly) hex-flagged the pinned
vector and noble's Ed25519 curve constants; per its protocol they carry same-line
`PUBLIC-CONSTANT` markers — 6 doc lines (including two in the otherwise-verbatim
handoff) and block comments in the vendored dist bundles and the src (the engine
inlines noble's group order). Both dist files verified byte-identical to the pack
originals with markers stripped; the 26/26 suite re-run green after src marking.

## 4 · Open for the founder / next seats

- Gates **G1–G6** stand as the map writes them (24-word root ratification; `BDID-v1/…`,
  `bdidrec`, `BSAFE7-THP-v0` labels; BC-UR framing; context registry; root-door matrix;
  `Enrolment.code_hash`). G2 note: engine + e2e now pin the seam names in-tree.
- **Verification law:** goose independently reproduces 26/26 + 4/4 + 6/6 — every command
  is now in-tree and copy-pasteable from §2.
- **WS-2 anchoring** remains the only PREVIEW left. **WS-4**: the `fingerprint()` Rust
  port should target the pinned vector (now in-tree at `key-build/bdid-key/test/test.mjs`).
- The two reconciliations flagged in DISPATCH_HW_WALLET_BZDID_LEVERAGE §6 (Safe 5/7
  label staleness; `t3w1/authenticity.json` 404 upstream) are unchanged.

**zCode, 2026-08-19.**
