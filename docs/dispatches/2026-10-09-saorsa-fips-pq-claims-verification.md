# 2026-10-09 — Saorsa FIPS/PQ claims: first-session independent verification of the handed analysis

zCode seat, new lane, first session. The founder handed this seat another seat's
analysis (recovered below where load-bearing) of Irvine's "check GitHub"
instruction: an inspection of `saorsa-pqc` and `self_encryption` that found real
post-quantum implementations and a FIPS claim needing qualification. Estate law
says a pasted receipt authorizes nothing, so this session re-verified every
load-bearing line at the pinned revisions before landing anything. **Every
technical claim in the handoff reproduced. None was weakened by reproduction;
several were sharpened.** No upstream issue, repository change, or engineering
lane beyond this dispatch was created; nothing in BNR's tree changed except this
file.

## Method

Fresh clones of `saorsa-labs/saorsa-pqc` and `WithAutonomi/self_encryption`
on 2026-10-09, checked out at the handoff's pinned revisions. Both pins are the
repository tips as fetched today (not stale pins — this is sharper than the
handoff knew):

| repo | pinned revision | full sha | position today |
|---|---|---|---|
| `saorsa-labs/saorsa-pqc` | `b8afcd4f61` | `b8afcd4f61a4c56ac212f94fa0d41b7873795bec` | `origin/main` tip, 0 commits ahead |
| `WithAutonomi/self_encryption` | `eb95108a6e` | `eb95108a6eb8f1012ff2499c1cbb830aed8392a8` | `origin/master` tip, 0 commits ahead |

Tip-of-repo ≠ deployed-fleet version; that caveat from the handoff stands. This
is a source inspection: no builds, no test runs, no network call-site census, no
fleet version evidence.

## What was verified, claim by claim

### saorsa-pqc @ `b8afcd4f61` (manifest version 0.5.2, `Cargo.toml:3`)

| handoff claim | evidence exercised this session | verdict |
|---|---|---|
| deps are `fips203`/`fips204`/`fips205` 0.4 | `Cargo.toml:51-53` (ML-KEM/Kyber, ML-DSA/Dilithium, SLH-DSA/SPHINCS+) | REPRODUCED |
| `MlKem768` wraps `fips203::ml_kem_768` | `src/api/kem.rs:64` import; `src/pqc/ml_kem.rs:36,60` (`try_keygen_with_rng`, `try_encaps_with_rng`) | REPRODUCED |
| `MlDsa65` wraps `fips204::ml_dsa_65` | `src/api/sig.rs:65` import; `src/pqc/ml_dsa.rs:36,57` (`try_keygen_with_rng`, `try_sign_with_rng`) | REPRODUCED |
| README advertises "FIPS-Certified Implementations" | `README.md:14` verbatim: "**FIPS-Certified Implementations**: Uses NIST FIPS-certified crates for ML-KEM, ML-DSA, and SLH-DSA" | REPRODUCED |
| README advertises "FIPS 140-3 Compliant RNG" | `README.md:13` verbatim: "ChaCha20-based DRBG with continuous health monitoring per NIST SP 800-90A/B"; `README.md:357`: "(approved for FIPS 140-3)" | REPRODUCED |
| RNG doc/implementation mismatch | `src/pqc/fips_rng.rs:8` module doc: "Uses approved DRBG mechanisms (CTR_DRBG with AES-256)" — but `fips_rng.rs:255-257`: `struct DrbgState { … rng: ChaCha20Rng }` (`rand_chacha::ChaCha20Rng`, seeded at `:281,:312`) | REPRODUCED — a three-way contradiction: module doc says CTR_DRBG/AES-256, README says ChaCha20-is-approved, the code stores ChaCha20Rng |
| `fips205` availability ≠ use everywhere | dep present; no census of network call sites attempted | REPRODUCED as scoped |
| wrappers call `OsRng` directly | `src/pqc/ml_kem.rs:9,36,60`; `src/pqc/ml_dsa.rs:9,36,57`; `src/api/sig.rs:60,525,539` — and `FipsRng` is only re-exported (`src/pqc/mod.rs:147`), never called by the library's own crypto paths | REPRODUCED and SHARPENED: the default keygen/sign/encaps paths bypass `fips_rng.rs` entirely |
| `UPSTREAM_VERIFICATION.md` is honest about limits | dated **2025-01-08**, 7× "assumed" re constant-time properties, upstream = `integritychain` crates | REPRODUCED and SHARPENED: the CAVP/CMVP items at `docs/fips/UPSTREAM_VERIFICATION.md:138-139` are **unchecked checkboxes** — "Consider CAVP testing", "Document verification evidence for CMVP" — the repo's own tracker says validation work has not been done |

### self_encryption @ `eb95108a6e` (manifest version 0.36.1, `Cargo.toml:16`)

| handoff claim | evidence exercised this session | verdict |
|---|---|---|
| chunk cipher is ChaCha20-Poly1305, 32-byte key, 12-byte nonce | `src/cipher.rs:11-12` (`chacha20poly1305` crate), `:34-35` (`KEY_SIZE: usize = 32`, `NONCE_SIZE: usize = 12`) | REPRODUCED |
| pipeline = compress → encrypt → XOR obfuscation pad | `src/encrypt.rs:23-35`: compress into `compressed`, `cipher::encrypt(Bytes::from(compressed), …)`, then `xor(&encrypted, &pad)`; pad sized at `cipher.rs:37` | REPRODUCED |
| content addressing = BLAKE3 → `XorName` | `src/hash.rs:5-7`: `content_hash()` = `blake3::hash(content)` → `XorName`, explicitly "replaces the SHA3-256 hashing previously done by `XorName::from_content`" | REPRODUCED |

### NIST standards facts (checked against NIST pages this session)

- **FIPS 140-2 sunset dates**: csrc.nist.gov/Projects/fips-140-3-transition-effort —
  FIPS 140-2 validations "can remain active for 5 years after validation or
  until **September 21, 2026**"; from **September 22, 2026** all FIPS 140-2
  certificates are on the Historical List. Historical is a status, not
  revocation; CMVP supports purchase/use for existing systems. VERIFIED. Note
  the timing: this transition completed **eighteen days ago** — any "FIPS"
  conversation happening now is happening after the 140-2 sunset.
- **Approved DRBG mechanisms**: csrc.nist.gov/projects/cmvp/sp800-140c §6.2.8
  approves DRBGs per **SP 800-90A Rev. 1**, whose mechanisms are Hash_DRBG,
  HMAC_DRBG, CTR_DRBG. ChaCha20 does not appear on the approved-functions
  material. So "ChaCha20-based DRBG … per NIST SP 800-90A/B" (README:13) and
  "rand_chacha … FIPS-approved DRBG for FIPS 140-3 compliance" (Cargo.toml:72)
  are approval claims the cited standards do not support.
- **FIPS 140-3 ≠ post-quantum, and level ≠ category** (module assurance vs
  algorithm security category): carried from the handoff, consistent with the
  FIPS 140-3 publication scope; not independently re-derived this session.

## The defensible finding (unchanged, now with this session's receipts)

A **documentation/implementation mismatch and unsupported FIPS-approval
assertions** — not a demonstrated compromise of any RNG or of the network:

1. `README.md:14` "FIPS-Certified Implementations" — no CMVP certificate,
   module version, or operating environment is identified anywhere in the
   repo; the repo's own tracker (`UPSTREAM_VERIFICATION.md:138-139`) leaves
   CAVP/CMVP as unchecked future work. Using NIST-standardized algorithms and
   passing ACVP-published vectors (README:221-223) is algorithm validation
   territory at best, and NIST states algorithm validation certificates do
   not by themselves establish FIPS 140 module validation.
2. The RNG story contradicts itself three ways (`fips_rng.rs:8` CTR_DRBG/AES-256
   vs `README.md:13,357` ChaCha20-is-90A-approved vs `fips_rng.rs:257`
   ChaCha20Rng in `DrbgState`), and the module is not even on the default
   keygen/sign path (`OsRng` at `ml_kem.rs:36`, `ml_dsa.rs:36`).
3. Health tests, zeroization, and a `FipsRng` type do not convert ChaCha20Rng
   into an SP 800-90A mechanism.

Wording cap per estate law: the finding is recorded as a mismatch and an
unsupported assertion. **Security consequences remain UNVERIFIED** — no
weakness of ChaCha20Rng-as-RNG is claimed, and none was tested for.

## Separations that must survive any retelling

- ML-KEM/ML-DSA (asymmetric PQ layer, `saorsa-pqc`) and ChaCha20-Poly1305 +
  BLAKE3 (symmetric self-encryption layer, `self_encryption`) are **different
  components**. ML-KEM establishes shared secrets; it does not perform storage
  encryption. Neither description should blur into the other.
- Neither ChaCha20-Poly1305 nor BLAKE3 appears in the current SP 800-140C
  approved-functions material — a standards-approval distinction, **not** a
  finding that either primitive is broken.
- Algorithm validation ≠ module validation: local vector runs ≠ CAVP
  certificate ≠ CMVP certificate. A proof about one implementation of FIPS 203
  (e.g. RustCrypto) proves nothing about a different implementation (`fips203`
  from integritychain) — directly relevant to how BNR's own PQ proof-batch
  closeout wording is scoped.
- "Pay once, use forever" is a separate claim not established by any of the
  above: neither algorithm choice nor FIPS validation speaks to indefinite
  availability, retrieval costs, or thousand-year lifetime. For bDroP these
  remain continuity/migration questions to evidence separately.

## What this means for BNR surfaces (bDroP included)

Per the informed-consent operating rule: any BNR disclosure in this territory
names **what implementation and mode will execute, which evidence applies, and
which assurances have not been established** — a generic "PQC" or "FIPS" badge
is exactly what these findings forbid. The public-evidence record wording from
the handoff is carried forward verbatim as the lane's canon:

> The inspected source includes implementations of NIST-standardized
> post-quantum algorithms and a separate symmetric self-encryption pipeline.
> Source availability, passing tests, and formal proofs do not themselves
> establish FIPS 140-3 module validation. Any validation claim must identify
> its certificate, module version, operating environment, and approved
> services.
>
> A discrepancy between documentation and implementation is recorded as such.
> Security consequences remain unverified unless further evidence establishes
> them.

## Not done in this session (named, not hidden)

- No builds or test suites of either revision were run (source inspection only).
- No census of network call sites: whether every network operation uses these
  wrappers, and which paths (if any) reach `FipsRng`, is unestablished.
- No deployed-fleet version evidence; repo tips ≠ what participants run.
- No CMVP certificate database search beyond the material reviewed — the
  finding is "unestablished validation claim," not "no certificate could exist
  under another module or vendor name."
- No upstream issue filed (an upstream-facing correction of the FIPS wording
  would be a founder-gated gesture; wording above is ready if asked).

## Next owners

| open item | owner |
|---|---|
| upstream FIPS-wording correction (issue/PR to `saorsa-labs/saorsa-pqc`) | founder gesture; this dispatch is the evidence base |
| call-site census (does anything route through `FipsRng`?) | next session this lane, if ordered |
| bDroP/BNR disclosure line using the canon wording above | bDroP lane when its surface next changes |
| Safe 7 PQ-signing zCode review (separate lane, requested in `2026-10-09-zcode-review-request-safe7-step2.md`) | zCode review seat — untouched by this lane |
