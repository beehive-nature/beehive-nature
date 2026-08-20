# HANDOFF → zCode · Sprint Lead, 2026-08-19
### From the Cowork session (design + verification track). Everything in this bundle is self-contained; no chat context needed. The founder ratified what's marked ratified; everything else is yours to run.

---

## 0 · JOB ONE, before standup (10 minutes)

**Land `LAND-FIRST.patch`** (in this bundle's root — identical to the one in the founder's Cowork chat):

```bash
cd beehive-nature && git checkout main && git pull
git am LAND-FIRST.patch     # already rebased onto YOUR 3e108d5 — applies clean, verified
git push origin main        # Pages redeploys itself ~1 min
```

Then verify live: `https://beehive-nature.github.io/beehive-nature/surfaces/` → 18 hub cards, all resolving (your Catalog + Organ included and badged). What it lands: the **surfaces hub** (`surfaces/index.html`), the **4-page hardware surface** (`surfaces/hardware/`: guide · security · build · lab), the **live key-build onboarding** (`surfaces/onboarding/index.html` + `bdid-key.js` — real WebAuthn PRF ceremony, real 24-word BIP39, PREVIEW auto-retires when the engine file is present), the **offline recovery tool** (`surfaces/recover.html`, zero network requests), and ⌂ hub badges on every existing surface including your two new pages.

⚠️ **Ordering with your own staged work:** your explorer layer (level badges, trait chips, patch ops, JEDi) is staged to rebase onto the landed tree. Land this patch FIRST, then rebase yours on top — this patch doesn't touch explorer internals (only a fixed-position badge div before `</body>` on blight pages), so your rebase stays trivial.

## 1 · What this bundle contains

```
LAND-FIRST.patch      job one (above)
README.md             original sprint-pack map (paths, run commands)
docs/
  SPRINT-FINISH-LINE-MAP.md    ← THE SPRINT PLAN: gates G1–G6, workstreams WS-1–WS-8, day sequencing
  WORKLOAD-DISTRIBUTION.md     agent assignments (you = heavy build lead; goose = adversarial verify)
  BNR-LAB-1.md                 hardware lab charter — L-1..L-4 RATIFIED by founder 2026-08-18
  BSAFE-DEVICE-1.md            bee-native device seed spec (three-lane sensor law; founder gates FD-1..5)
  HARDWARE-CUSTODY-REVIEW.md   full open-hardware review behind the /hardware pages
  filekey-*.md, trezor-repos-* the research record (why every choice was made)
key-build/bdid-key/   the engine: src + vendored bundles + 26-test suite (all green)
surfaces/             pre-patch copies of every page (reference; the patch is canonical)
rust/bsafe-host/      THP frame codec + Noise XX channel workspace — cargo test = 4/4
e2e/e2e.mjs           Chromium e2e incl. CTAP2 virtual authenticator WITH PRF — 6/6
```

## 2 · The contract between all agents — pinned vector

Any port (your Rust port of the engine is WS-2/WS-4 adjacent work) must reproduce this **byte-identically** or it does not ship:

```
prf_secret   = 0x01 × 32
master_prk   = d54134a6b181fd7af5a3870446d9a91b73b551ed3ef52f153841a73be093d4ac PUBLIC-CONSTANT
context      = "bnr.b"
ed25519_pk   = 761e0ec527d094b3b5afe40a5f8c78b0be8c54e7c9cf6d79bf62255625a84591 PUBLIC-CONSTANT
fingerprint  = "lock robust differ helmet baby stable"  (hex 837768f7)
phrase[0..3] = "stem answer claim"
```

Re-verify anytime: `cd key-build/bdid-key && npm i @noble/curves @noble/hashes @scure/bip39 @scure/base && node test/test.mjs` → 26/26.

## 3 · Standing rulings (settled — do not relitigate)

- **Crypto doctrine (founder-ratified):** measure against David Irvine's practice — boring primitives only (Ed25519, SHA-256, HKDF, BIP39, Noise/ChaCha20-Poly1305, X25519, BLAKE2s), invent protocols/formats never primitives, self-authentication (identity derives client-side from what the human holds). Current codebase contains zero novel cryptography; keep it that way.
- **BNR-LAB-1 L-1..L-4 ratified:** ethics law verbatim; six comb axes with the Art cell scored by the founder by name; retention menu (return / retain-for-regression / raffle-to-students) declared per-review in the disclosure line; vendor right-of-reply appended verbatim.
- **Root-door policy as built:** PRF-capable passkey ⇒ root derives from PRF (two doors, one root). No PRF ⇒ fresh-entropy root, phrase is the only root door, passkey is authn-only. Trezor rung ⇒ device seed, phrase skipped (founder ruling 2026-08-14).
- **Founder-directed addition:** WS-8 dice-roll entropy (post-Coldcard-RNG) — dice always XOR-mixed with hardware RNG, never replacing it; CI must assert the HW RNG flag is ON, not merely present.

## 4 · Rule at sprint open (30 min, all pre-chewed in SPRINT-FINISH-LINE-MAP.md)

**G1** 24-word root (implemented; mock said 12; unfixable after first real enrolment — ratify). **G2** labels: every `BDID-v1/…` string, `bdidrec` HRP, `BSAFE7-THP-v0` prologue become normative bytes — rename now or never. **G3** BC-UR fountain framing for the optical wire (founder leans yes; Coldcard's BBQr is the cautionary tale). **G4** derivation-context registry (who mints context strings like `bnr.b`). **G5** confirm the root-door matrix (§3). **G6** `Enrolment.code_hash` becomes a local write-down check now that the phrase is derivational.

## 5 · Workstreams (full detail in the map; statuses honest)

| WS | What | Status | Note for you |
|---|---|---|---|
| 1 | Land key build in-tree + CI | **≈done by LAND-FIRST.patch** | wire test.mjs + e2e.mjs into the tests workflow |
| 2 | Anchoring (genesis → did log → `Enrolment::anchor`) | **not started — the only PREVIEW left** | design notes in map; also settles did:webvh (surface) vs did:autonomi (crate) naming mismatch — one is wrong on purpose, make it say why |
| 3 | Recovery tool hardening (print stylesheet, in-tree download) | tool works; polish pending | |
| 4 | Safe 7 BLE spike | **needs the physical device** | checklist in `rust/bsafe-host/host/src/lib.rs`; Noise channel + frame codec already pass 4/4; port `fingerprint()` to Rust against the pinned vector for the countersign screen |
| 5 | UR framing over the beam | pending G3 | your qrcodegen stays the renderer; UR is the layer between payloads and it |
| 6 | Tier policy types in crates/capability | not started | delegation-with-ceiling as unforgeable witness (GradeDisclosure idiom); quorum enrollment case included |
| 7 | b-indexer spec (Vaulta + Arbitrum first) | not started (writing) | blockbook = prior art only (Go/AGPL, wrong rails) |
| 8 | Dice entropy | founder-directed, spec'd in map | done-line includes second-device re-derivation check |

**Verification law (keep this or the sprint eats itself):** nothing is *done* until **goose independently reproduces it**. You verifying your own build is the epistemic-capture pattern the whole security page warns about. Branch naming `ws-N-agent`; humans merge.

## 6 · Gotchas that cost us time — so they don't cost you

- `userVerification` MUST stay `"required"` at create AND get — CTAP2 returns a different PRF secret without UV; `"preferred"` is a silent-lockout bug (already fixed in the landed surface; don't regress it).
- `PREVIEW` in the onboarding surface auto-flips off when `window.BDIDKEY` exists — the engine file must sit adjacent as `bdid-key.js`; anchoring keeps its own Working gauge regardless.
- WebAuthn needs https — Pages provides it; `file://` won't.
- 12-word phrases are refused *by design* with the stage-props explanation — that's G1, not a bug.
- Trezor's `t3w1/authenticity.json` is still 404 upstream — bSAFE must own its own signed-definitions/authenticity chain (standing risk in the map).
- The Cowork sandbox can fetch/clone this repo but cannot push (session-scoped credential proxy) — that's why you're landing the patch. Future Cowork sessions started *with the repo attached* push directly.
- Rust workspace deps: noise-protocol 0.2 API wants `<X25519 as DH>::Key::from_slice(&key)` — already handled; don't "simplify" it back to `.into()`.

## 7 · End-of-day demo (the bar for tomorrow)

Enroll on a phone (real passkey, 24 real words) → restore on an air-gapped machine from the phrase alone → anchored root verified from a second machine by chain read (WS-2, the day's real work) → encrypted hello from the Safe 7 with fingerprint words confirmed on its screen (WS-4, hardware permitting). Everything before the arrows already works.

---

*Design and verification stay available from Cowork sessions whenever the founder points one at the repo. The bench is yours — every number regenerable, every ruling written down, nothing load-bearing left in anyone's head. Don't trust this handoff either: run the tests. Verify.* 🐝
