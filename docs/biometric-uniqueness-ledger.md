# Multi-biometric public uniqueness ledger — ruling

<!-- 8 agents: 4 measurement (template protection, fusion math, modalities,
     prior art + law), 3 adversarial (enrolment attacker, surveillance,
     false-flag griefing), 1 synthesis. 2026-08-04.
     Assessed as a dedup index per the founder's framing, NOT as a login. -->

# RULING — Experimental Multi-Biometric Public Uniqueness Ledger

*Seat 3, 2026-07-27. Assessed as a dedup index, per the framing. Not straw-manned as a login.*

---

## 1. The verdict

**Partly — and the part that fails is the part that is written in capital letters.** A multi-biometric uniqueness oracle at 10^10 is buildable and is the correct answer to the earlier undecidability ruling; a *published* one is not, and the six words "ALL SIGNATURES ALREADY PUBLIC" are the only clause that has to die.

The insight is right and it is the strongest thing in the spec: a bDiD is a self-certifying hash with no issuer and no registry, so a second creation emits no observable — and biometric enrolment genuinely is that missing observable. That was the open hole and this closes it. But "public" and "matchable" compose into "identification oracle" definitionally, not incidentally: an adversary who holds the gallery chooses the gallery, partitions it, and binary-searches to the exact record in ⌈log₂10^10⌉ ≈ 34 matcher evaluations. No cancelable transform, fuzzy extractor, or fuzzy vault escapes this, because matchability requires distance preservation and distance preservation *is* the leak. Publication also hands the attacker an offline copy of the matcher, which converts enrolment evasion from a 37%-success gamble into a scripted certainty at ~$11 per fake identity, and it converts one photograph into a wallet balance for a $100 one-time index build. Three separate lanes — surveillance, false-flag griefing, and self-evasion — all trace back to the same clause, and all three close when it goes. Separately and independently: the auto-merge fires on a measurement whose false-positive tail is 6×10^7 to 3.4×10^8 innocent humans, and the −50% penalty is 20:1 in the attacker's favour. Both are fixable without touching the founder's intent.

**Governance note, stated plainly before anything else:** this proposal is already prohibited four times over by text the founder signed. `C:\Users\travi\LOVErnment-DAO\specs\BIO-1.md` B-1 (no template, embedding, hash, or "irreversibly transformed" derivative), B-2 ("no 1:N comparison, at any gallery size, for any purpose, ever"), B-3 (no biometric-derived provenance identifiers, K-4 founder gate must refuse), and `C:\Users\travi\LOVErnment-DAO\specs\PERSON-1.md` P-3 ("no global biometric template registry. Ever."). A *published* 1:N gallery is a strict superset of what B-1/P-3 already refuse. Proceeding requires a version bump and a re-gate of both APPROVED documents — not an exception, and not a footnote.

---

## 2. The numbers

This is the section that decides everything, so here is the arithmetic in full.

### 2.1 The bar

Let `f` = per-comparison false match rate, `N` = 10^10. Enrolment *k* faces a gallery of size *k*, so total wrongful merges across the full build = Σk·f = **f·N²/2 = 5×10^19 · f**. Build-average false-flag rate per enrolment = 5×10^9·f; at a mature gallery, 10^10·f.

| Target | Required f |
|---|---|
| < 1 false match per enrolment | 1e-10 |
| < 10^-3 per enrolment | 1e-13 |
| < 10^6 wrongful merges over the build (0.01% of humanity) | **2e-14** |
| < 1 wrongful merge, ever | 2e-20 |

### 2.2 Measured f, by modality

Convert published 1:N results as `f ≈ FPIR / N_gallery`.

| Modality | Source | f | Flag rate at N=10^10 |
|---|---|---|---|
| Fingerprint, best single index | NIST FpVTE 2012 (NISTIR 8034), 5M, FNIR 1.9% @ FPIR 1e-3 | 2e-10 | 200% |
| Face, best | NIST FRTE/FRVT 1:N, 12M mugshot, FNIR 1.15% @ FPIR 1e-3 | 8.3e-11 | 83% |
| Iris, single eye | Daugman, 2.0×10^11 impostor cross-comparisons, 0 false matches → rule of three | <1.5e-11 | 15% |
| **Fused, 10 fingers + 2 irises** | **UIDAI Aadhaar, 8.4e7 gallery** | **1.2e-12 – 6.8e-12** | **1.2% – 6.8%** |
| Two-eye iris, independence-extrapolated | model, not measurement | 2.25e-22 | passes on paper |

The Aadhaar band is real uncertainty, not sloppiness: UIDAI publishes FPIR 1e-4 in one place and 5.7e-4 in another, from PoC samples of ~20,000 people extrapolated to 1.2 billion. **Both numbers are gallery-size dependent and degrade monotonically with N**, so both are optimistic for 10^10. Below ~10^-12 nothing in the biometrics literature has ever been *measured*; you are trusting a binomial tail model where real impostor tails are heavy. Mark the two-eye figure as model output, not evidence.

### 2.3 Independence is wrong by ~50 orders — this is the single most important number here

Naive product for 2 irises + 10 fingers: (1.5e-11)² × (1e-4)^10 ≈ **1e-62**. Actually measured on a real diverse population with the same instruments: **~1.2e-12**. The gap decomposes as:

- **Fusion rule (~40 orders).** You cannot AND 12 instances, because acquisition fails on some of them for a large fraction of people. Real systems score-fuse with weights and fall back; the fused tail is governed by the best-available subset, not the product.
- **Failure-to-acquire (~several orders).** 2–5% fingerprint, 1–2% iris. At 10^10 that is **2×10^8 to 5×10^8 people** who cannot complete a full-basket enrolment and get adjudicated on a degraded basket where f is orders worse.
- **Subject-level correlation, the Doddington "lambs" effect (~3.5 orders).** Model log₁₀f per modality with SD σ=1 and pairwise correlation ρ. Var(Σlog₁₀f) = mσ² + m(m−1)ρσ². For m=3: ρ=0 → Var 3, σ_Y=3.99, inflation e^7.95 = 2.8e3; ρ=0.5 → Var 6, σ_Y=5.64, inflation e^15.9 = 8.0e6. Ratio ≈ 2,900×.

The founder's compounding intuition is arithmetically correct *for independent, individually high-entropy, stable channels*. Aadhaar is the proof it works at all. It is also the proof it works ~50 orders worse than the naive model. **Use 1.2e-12 as the design number and do not let an independence product appear anywhere in the whitepaper.**

### 2.4 False flags per million enrolments

| f | per 1M, build-average (gallery 5e9) | per 1M, mature (10^10) | **total wrongful merges** |
|---|---|---|---|
| Face only, 8.3e-11 | 415,000 | 830,000 | 4.2e9 |
| Aadhaar-grade, 6.8e-12 | **34,000** | 68,000 | **3.4e8** |
| Aadhaar-grade, 1.2e-12 | **6,000** | 12,000 | **6.0e7** |
| Required (2e-14) | 100 | 200 | 1.0e6 |

**Shortfall: 60× to 340×** against the "<10^6 wrongful merges" bar. That is 1.8–2.5 decades of threshold tightening. At the FRVT/FpVTE-observed 1.3–2× FNIR per decade of FPIR, Aadhaar's FNIR goes from 1e-3 to roughly **2.6e-3 – 5e-3**, i.e. **2.6×10^7 to 5×10^7 genuine duplicates walk through undetected** at 10^10.

**The base-rate kill.** Undisclosed re-enrolment is rare by construction — the onboarding disclosure exists to make it rare. Let *d* be the genuine re-enrolment fraction; build-average false flags per enrolment = 3.4e-2 (upper band):

| d | true flags | false flags | **precision** |
|---|---|---|---|
| 10% | 1.0e9 | 3.4e8 | 75% |
| 1% | 1.0e8 | 3.4e8 | 23% |
| 0.1% | 1.0e7 | 3.4e8 | **2.8%** |

At any plausible base rate the *majority of everyone the system automatically penalizes did nothing*. At the lower f band (1.2e-12) precision at d=1% is 62%, at d=0.1% it is 14%. The conclusion does not depend on which UIDAI figure you believe.

### 2.5 Compute and cost per enrolment

Templates: 2 IrisCodes (2×512 B) + 10 minutiae (~10×600 B) + face embedding (512 B int8) ≈ 7.5 KB/subject → **75 TB resident** at 10^10 (raw imagery ~10 PB).

Brute force per enrolment: face 5.12e12 MACs, memory-bound at 5.12 TB read → 64× 80 GB HBM GPUs at 2 TB/s = 40 ms wall, ~$0.001. Iris 1.6e11 popcount ops ≈ 160 core-s, ~$0.003. **Minutiae is the killer**: 1e10 / 5e4 pairs·s⁻¹·core⁻¹ = 2e5 core-s ≈ 55 core-hours ≈ **$2–5 per enrolment, $20–50B total. Not viable.**

Cascade (what Aadhaar actually does): ANN retrieval on iris/face → top-K 10^3–10^4 → minutiae verify on K only.

```
Cascaded compute:      $0.005 – $0.02 / enrolment   →  ~$1e8 total
Adjudication:          $10 – $30 / flagged case
  at f=1.2e-12:        $0.06 – $0.18 / enrolment    →  $0.6 – 1.8B
  at f=6.8e-12:        $0.34 – $1.02 / enrolment    →  $3.4 – 10B
```

**Adjudication outruns compute by 1–2 orders and scales with f.** The dominant cost of this system is human labour the spec does not contain. Throughput: 10^10 over 10 years = 32/s mean, ~300/s peak → 2,000–15,000 GPUs, ~$0.5–2B capex.

Two structural consequences fall straight out of the compute:

1. **A single globally-consistent ANN index over 75 TB is a centralized datacentre service.** The chain can hold the outcome; somebody operates the index, and that somebody is a trusted party. The undecidability problem is not solved by this design, it is *relocated to an operator*. That is a real improvement over undecidable — but say it out loud.
2. **ANN recall is a hard floor on FNIR.** HNSW / IVF-PQ at 10^10 on a practical memory budget runs recall@K of 0.90–0.99, and it drops the *atypical* enrolments preferentially — exactly the tail. **1–10% of true duplicates are never retrieved into the candidate set at all**, independent of matcher quality. Hold that number; §7 needs it.

### 2.6 Demographics

NIST FRVT Part 3 (NISTIR 8280), reaffirmed in NIST IR 8429: **FMR varies 10× to 100× across demographic cohorts** — highest for East African, West African and East Asian subjects, lowest for Eastern European. FNMR differentials are much smaller (≤3×).

Applied to a 0.6–3.4% build-average false-flag rate, a conservative 10× across ~2.5×10^9 people of African and East Asian descent yields **~1.5×10^8 wrongful flags in that cohort** versus ~1.5×10^7 for an equal-sized Eastern European cohort. The −50% unlock penalty therefore lands roughly an order of magnitude more often on specific ethnic groups, denominated in a lifetime cap, applied automatically, recorded immutably, on a public ledger. Compounding: fingerprint FTA correlates with manual labour and age, so the flagged population is also systematically poorer and older. The standard mitigation — per-cohort threshold calibration — requires storing and publicly attaching ethnic classification to 10 billion people. **Both branches are unacceptable. This is a fork in the design, not a tuning parameter.**

---

## 3. Public vs published

**No. The ledger cannot be public without becoming a photograph-to-finances lookup, and there is no construction that separates the two.** This is the fatal finding.

### 3.1 The impossibility

Let `P` be the published ledger and `M(P, probe) → bit` the matcher. "Public" means `M` is computable by anyone from `P` with no secret. Then:

- Anyone with a photograph computes a probe and evaluates `M`. That answers "is Alice enrolled?" immediately.
- Restricting the interface to an OR across all records does not help, because the adversary holds `P` and therefore chooses the gallery. Partition and binary-search: **34 evaluations recover the exact record index.**
- The only escape is that `M` requires a secret. At which point the templates are not public.

Not a limitation of any scheme. It is what the two words mean when composed.

### 3.2 Why every candidate construction fails

- **Fuzzy extractors / secure sketches** (Dodis et al.) are 1:1 — they reproduce a key *given the helper data of a claimed identity*. Using them for 1:N means iterating every record's helper data, which is the identification oracle again at cost N. And reusability fails on precisely the case a dedup ledger contains by design: Boyen (CCS'04) showed sketches are not generically reusable; Blanton–Aliasgari (TIFS'13) showed some are not even *weakly* reusable — two sketches of the same biometric within distance t recover the biometric in full.
- **Fuzzy vault** (Juels–Sudan) has a documented attack family: correlation attack (Kholmatov–Yanikoglu 2007, cross-matching two vaults of one finger recovers most minutiae), attack via record multiplicity (Scheirer–Boult), and sub-nominal brute force.
- **Cancelable biometrics** (Ratha et al.) support 1:N only under a single *global* transform key. Global key ⇒ unlinkability gone by construction, and one leak turns the entire ledger into a plaintext face/iris database. Per-user keys restore unlinkability and collapse you to 1:1, which cannot dedup.

The structural bind: **distance preservation is what makes matching work and what makes inversion possible.** Cannot have both.

### 3.3 Irreversibility is not the binding constraint — unlinkability is

ISO/IEC 24745:2022 requires irreversibility, unlinkability, and renewability. A perfectly irreversible template still *identifies*. A global dedup index is by construction a population-wide linkage key — the maximally linkable artifact it is possible to build, and exactly what unlinkability forbids. Renewability fails outright: a published biometric cannot be revoked because the human cannot be reissued.

Irreversibility is weaker than assumed anyway. Face reconstruction from black-box embeddings via adapters to face foundation models (arXiv:2411.03960), GaFaR's geometry-aware NeRF route, and diffusion-based embedding-to-face are current SOTA and routine. Worse: reconstruction **from binary comparison results alone** (arXiv:2601.17620) produces high-resolution faces passing the system >98% of the time. You do not need the template — a public matcher answering yes/no suffices.

### 3.4 What publication actually costs, priced

Face component only, at 10^10 × 512-d fp16:

```
Gallery download        10.2 TB   free (it's public)      ~23 h on 1 Gbps
FAISS IVF-PQ build      2.8 GPU-h → ~$12, call it $100 with retries
Index storage           640 GB at 64 B/vector             one consumer NVMe, ~$60
Marginal query          6.4 ms, 1e3–1e4 QPS/GPU           $4e-7 – $4e-6
```

**The entire global face→wallet index fits on a drive you can buy at a supermarket.** City-scale continuous surveillance (10^5 cameras, 1 face/s each) is ~100 GPUs ≈ **$1.0–1.3M/yr**. A whole-population sweep of all 10^10 probes is **under an hour and under $500**. And it is built once and resold: the retail attacker's cost is one API call at ~$5 or free. Compare the current cost of linking a wallet to a physical identity by conventional means — chain-analysis retainer, PI, subpoena — at $10^3–10^5, jurisdiction-limited and trace-leaving. **Six to nine orders cheaper, global, instantaneous, retroactive, traceless. That is a different threat model, not a worse one.**

### 3.5 The threshold identity — this is the load-bearing sentence

The founder's success criterion *is* the attacker's success criterion, numerically.

- At f = 2e-14 (the value required for <10^6 wrongful merges), a single photograph resolves to a unique human with false-ID rate N·f = **2e-4**. A 99.98%-precision global identification oracle.
- At f = 8.3e-11 (the best face number actually achieved), the attacker gets ~1.8 candidates out of 10^10 — still catastrophic narrowing — while the dedup false-flags 83% of enrolees and is useless.

**There is no operating point where it deduplicates well and identifies poorly. Uniqueness quality and surveillance quality are the same scalar on the same curve.**

And the basket does not have to be defeated, only its weakest-guarded member: score-level fusion publishes each modality separately and separately matchable. Iris and print need proximity; face and body mapping do not, and body/gait extends capture range to 50–100 m where face fails. Every modality added makes the ledger a better remote identifier. **Entropy is symmetric.**

### 3.6 The construction that works — named

**Attested capture + n-party secret-shared gallery + boolean-only MPC uniqueness check + on-chain attestation.** This is AMPC, generalized, and it is deployed.

- **Capture** in an attested TEE on the sensor; PAD (LED/UV, electrophysiologic) runs locally, here.
- **Split** the multi-modal template into additive/replicated secret shares. Each share is statistically independent of the biometric. No party holds a template.
- **Check** by MPC over the shared gallery; reveal **only the OR bit**. No distances, no index, no masks in clear.
- **Publish** nothing biometric — a threshold-signed attestation `("bDiD H passed uniqueness at t")`, optionally with a ZK proof that the MPC ran correctly against a committed gallery.
- **Identity layer unchanged**: bDiD = 256-bit digest of the genesis op, self-certifying. Spend authority stays with the passkey. Personas = context nullifiers `PRF(seed, context)` below the bDiD.

Performance is not the obstacle. Masked fractional Hamming distance over 2048-bit iris codes is cheap: **690,000 comparisons/s on one CPU core**, and **4.29×10^9/s in 3-party MPC on 8× H100 per party** (eprint 2024/705, arXiv:2405.04463; `github.com/worldcoin/mpc-uniqueness-check`) — >1000× over Janus (S&P'24). That is **~2.3 s per enrolment against a 10^10 gallery.** For contrast, homomorphic encryption is not viable here: Blind-Match (arXiv:2408.06167) does 6,144 identifications in 0.74 s on 128-d vectors ≈ 8.3k cmp/s, which extrapolates to **~14 days per single query** at 10^10.

**What the design gives up in exchange:** "no trusted party" becomes "no *single* trusted party." An n-of-n collusion of committee operators reconstructs the gallery and yields a global identification database. Cryptography cannot reduce this. It is bought down only by jurisdictional diversity, adversarial governance, verifiable software, and published operator identities with real legal exposure — raising the attack cost from a $5 API call to compromising k institutions across k legal systems, roughly 8–10 orders. **State it in the whitepaper rather than letting it be discovered.**

### 3.7 Multipersona

"All signatures already public" and "multipersona is legitimate" are not in tension — they are **mutually exclusive**. Personas as context nullifiers below the bDiD (Semaphore / World ID pattern) are free, legitimate, and fully compatible with a uniqueness oracle. A public biometric layer collapses every persona that ever touched enrolment onto one human and onto each other. **Dropping the publication clause is what saves the multipersona ruling.**

---

## 4. The modalities

The spec's phrase "camera LED/UV flash electrophysiologic/iris/fingerprint, facial/body mapping" groups four categories that do not belong together. One correction first: **a camera cannot measure electrophysiology.** It measures optics. That is a category error with engineering consequences, because it decides whether a signal can carry uniqueness bits at all.

| Signal | UNIQUENESS or LIVENESS | Phone in 2026? | Note |
|---|---|---|---|
| **Iris (NIR, 850 nm)** | **UNIQUENESS** — best in class | **No** | ~249 DoF; NIST IREX 10 best ≈ 0.2% FNMR at FMR 1:50M, ~20 µs/comparison. Samsung dropped IR iris at the S10 (2019); Apple's TrueDepth NIR flood is not exposed to third-party apps. Requires purpose-built hardware. This is why World built an Orb. |
| **Vein / vasculature (NIR 760–850 nm)** | **UNIQUENESS** — deployed (PalmSecure, Amazon One) | **No** | Phone cameras have IR-cut filters; the "flash" is a phosphor white LED with a ~450 nm blue pump. No NIR, no UV. LG G8 ThinQ (2019) is the only phone that ever shipped palm-vein; the line is dead. |
| **Fingerprint** | **UNIQUENESS** | **Blocked by design** | Android CDD and iOS both prohibit raw data or templates leaving the TEE/Secure Enclave. `BiometricPrompt` / `LocalAuthentication` return a boolean. Only phone route is contactless rear-camera capture, which is 2–5× worse FNMR than the livescan every NIST number is measured on, with known contactless-to-contact interoperability failure — **so a camera print will not reliably dedup against your own earlier enrolments on a different phone.** Plus 2–5% permanent failure-to-enroll. |
| **Face, 2D RGB** | **UNIQUENESS** (bounded) | **Yes — the only one** | Twin-limited: face and body mapping are near chance on MZ twins, and roughly 3.5–7×10^7 people at N=10^10 have an MZ co-twin. Aging: MSU longitudinal shows 99% still recognized at 0.01% FAR out to ~6 years, decaying after; adolescents unusable. |
| **Face, 3D (TrueDepth)** | marginal | Partial | Apps get a 1,220-vertex expression-dependent mesh + 52 blendshapes, not a recognition-grade scan and explicitly not Face ID's model. Most Android flagships dropped ToF. |
| **rPPG (pulse from video)** | **LIVENESS** | Yes | Identity claims exist (arXiv:2407.04127, signal-morphology auth) on small closed sets under controlled illumination. Entropy orders below iris. |
| **Subsurface scattering under multi-λ LED** | **LIVENESS** | No (needs multi-wavelength source) | Material discrimination — "is this skin?" |
| **UV fluorescence** | **Neither** | **No phone emits UV** | Wood's-lamp dermatology. UV-A does not reach veins; UV-B/C near the eye is an ocular safety hazard. |
| **Electrodermal (EDA/GSR)** | **LIVENESS** at best | No (needs electrodes) | Zero permanence — driven by arousal, temperature, hydration. |
| **Gait / body mapping** | **Neither, at dedup scale** | Yes (capture) | 2025 SOTA in the wild: TrackletGait ~77.8% rank-1 on Gait3D, 80.4% on GREW — on ~26k identities. Anthropometry proper is ~5–6 bits; Bertillon was abandoned c.1903 over exactly this. Useful only as a same-session consistency check. |

**Corrected grouping.** UNIQUENESS: iris, vein, fingerprint, face. LIVENESS: rPPG, EDA, subsurface scattering, UV. NEITHER: gait/body at any usable N.

**Deployable on a commodity phone in 2026: face 2D, and nothing else.** The highest-entropy modality (iris) and the second-best (vein) both require hardware no phone has shipped since 2019; fingerprint is prohibited at the OS level on both platforms. **This converts an undecidable problem into an Orb-class hardware problem, not an app problem.**

**The "dynamic biologics" instinct cuts the wrong way.** Fusion multiplies only when modalities are (a) independent, (b) individually high-entropy, and (c) stable across the retention horizon. rPPG and EDA fail (b) and (c) by definition — they are *defined* by intra-subject variance. Fusing a high-variance channel raises FNMR, which causes **false splits: one human, two bDiDs** — the exact failure the ledger exists to prevent — unless it is weighted to near zero, in which case it contributed nothing. In an AND-fusion rule (which the FAR budget at 10^10 forces) an electrophysiologic channel at ~20% FNMR contributes 20 points of *evasion probability* and nothing to discrimination. **Run the dynamic channels as PAD only, where they are genuinely valuable, and keep them out of the fusion rule.**

Template aging, ranked for a decade-scale ledger: iris ~decades (nine-year pediatric permanence evidence; earlier "iris ages" findings attribute largely to pupil dilation and acquisition variation) → fingerprint pattern decades but capture quality years → face ~6 years → gait/body months → rPPG/EDA minutes to hours.

**One 2026-specific threat note.** ISO/IEC 30107-3 Level 2 PAD certification is now commonplace (iBeta, ~1,500 attacks including silicone masks and deepfakes). **It tests only artefacts presented to a camera. Injection attacks — a virtual camera feeding a generative model — are entirely out of scope, covered separately under CEN/TS 18099.** A system can hold Level 2 with zero injection resistance. iProov reports iOS injection +741% YoY and +1,151% in H2 2025. Unattended self-service mobile enrolment is precisely the threat model injection owns, and nothing binds face #7 to iris #7 unless capture is attested and simultaneous. The only mitigation is hardware-attested capture — i.e. the trusted-hardware dependency the "no private key, all public" framing was trying to escape.

---

## 5. What Aadhaar and Worldcoin actually teach

### Aadhaar — the only billion-scale evidence

10 fingerprints + 2 irises + face, captured at **accredited enrolment centres**, exhaustive 1:N against the whole gallery at each enrolment, three ABIS vendors fused in parallel, **manual adjudication queue** for flagged pairs. ~1.4 billion enrolled.

Published accuracy: FPIR 5.7e-4, FNIR 3.5e-4 (UIDAI, *Role of Biometric Technology in Aadhaar Enrolment*, Jan 2012); a separate UIDAI figure puts person-mistaken-for-person at 2.5e-5. **The proof-of-concept was run on ~20,000 people and extrapolated to 1.2 billion.** Both rates degrade monotonically with N.

Downstream, the *authentication* side (a different operation, same biometrics) produced systematic exclusion: fingerprint and iris failures blocking PDS subsidised rations and MGNREGS wage payments, UIDAI under scrutiny in July 2025 over verification-failure rates, and starvation deaths linked to ration denial in the public record. Failures concentrate on manual labourers, the elderly, and the poor — the population the system was justified by. Security posture: IACR ePrint 2022/481.

**What it teaches:** 10^9-scale biometric dedup is achievable *only* with (i) controlled-environment multi-modal capture on dedicated hardware, (ii) a state-scale manual adjudication backstop, and (iii) tolerance for six- to seven-figure exclusion counts. Camera-flash capture on consumer phones satisfies none of the three. A permissionless protocol has no adjudicator, and ambiguous cases are the majority of the interesting ones.

### Worldcoin / World ID — the closest analogue, and it moved *away* from publishing

Same architecture as proposed here, **except World never publishes the codes** — and that difference is the entire remaining legal defence they have.

- Capture in a TEE on the Orb; iris code converted to statistically random secret shares by verifiable software, returned to the user's phone, distributed to independent node operators (Erlangen-Nuremberg, UC Berkeley RDI, KAIST, Univ. of Tokyo, Nethermind).
- The original SMPC revealed plaintext Hamming distances. **AMPC was a leak *reduction*: masks are now also secret-shared and only a single match/no-match bit is returned.** Old iris codes were deleted. Nothing biometric goes on-chain.
- ~18M verified humans across ~160 countries as of April 2026; >150M credential uses.

They landed on the bit-only oracle because the *distance* was judged too much leakage. Publishing the template is many orders past what they deleted their old codes to avoid.

**And the harder lesson, already banked in PERSON-1 §2b: Worldcoin's dedup worked.** That is exactly why an eye market emerged in Cambodia, Kenya, Indonesia — brokers bought real, unique, correctly-deduplicated humans at ~$30/head. **Perfect dedup is the procurement spec for renting bodies, not a defence against it.**

### The rest of the field, for calibration

Idena (reverse-Turing flips; synchrony presumes one attacker = one body, defeated by a coordinated human farm; generative models erode the premise) — thousands. BrightID (social-graph cut, degrades against a well-connected attacker) — low tens of thousands. Proof of Humanity (Kleros arbitration; ~19,000 registrants, stalled on L1 gas and governance, permanent public gallery of faces and legal names). Humanity Protocol (palm-vein + ZK, ~$1.1B valuation, ~2M "Human IDs" that are largely airdrop-farmed pre-verification signups; no independent FMR/FNMR at scale). **Nothing outside Aadhaar has demonstrated sybil resistance above ~10^5 enrolments.**

---

## 6. The legal surface

### Illinois BIPA (740 ILCS 14) — the sharpest instrument

Requirements: public written retention/destruction policy (§15(a)); **written informed consent before collection** with purpose and retention term (§15(b)); **absolute prohibition on selling, leasing, trading, or otherwise profiting from** biometric identifiers (§15(c)); no disclosure without separate consent (§15(d)); reasonable standard of care (§15(e)).

Damages: **$1,000 per negligent violation, $5,000 per intentional or reckless violation**, plus fees and injunctive relief. *Rosenbach v. Six Flags*, 2019 IL 123186 — **no actual injury required**, bare statutory violation confers standing. *Cothron v. White Castle*, 2023 IL 128004 — per-scan accrual, court acknowledged ~**$17B** exposure against one defendant. *In re Facebook BIPA* — **$650M** settlement, approved 26 Feb 2021. SB 2979 (eff. 2 Aug 2024) limits recovery to one violation per identifier per person, held retroactive by the Seventh Circuit.

**Nothing in this design survives it.** BIPA has **no public-data exception, no consented-publication exception, and no de-identification or irreversibility safe harbour**; "biometric identifier" covers retina/iris scan, fingerprint, voiceprint, or scan of hand or face geometry regardless of transformation. Three specific kills:

1. **§15(c) is unconditional and has no consent cure.** b is fully transferable, sellable and tradable and is issued *in consideration of* biometric enrolment. That is "otherwise profit from" on the face of the statute.
2. **§15(d): publishing to a public ledger is disclosure to every person on Earth.**
3. **§15(a) destruction becomes impossible to perform** on an immutable public ledger — a continuing violation with no cure.

Order-of-magnitude exposure, marked as an estimate: Illinois has ~9.7M adults. At 5% enrolment ≈ 485,000 class members × $5,000 intentional = **~$2.4B**; at 1% ≈ **$485M**. Post-SB 2979 this is per-person, not per-scan, but §15(c) is a separate claim from §15(b).

### GDPR — and the automated-penalty angle, which is the sharpest edge

Templates are Art 9 special-category data; publication requires an Art 9(2) basis that does not exist here. But the specific exposure the founder should focus on is **Article 22: the right not to be subject to a decision based *solely* on automated processing which produces legal effects or similarly significantly affects the data subject.** The spec's own words are "a −50% potential b unlock for the year penalty **automatically included**" — an automated confiscation of a market-priced bearer asset, applied without a human in the loop, on a Art 9 special-category input. Art 22(4) further restricts solely-automated decisions on special-category data. There is no adjudicator in the design and no appeal, so there is no Art 22(3) safeguard to point to.

Compounding: Art 17 erasure is unperformable on an immutable ledger; Art 5(1)(d) accuracy is violated at scale by definition given §2.4; Art 35 DPIA is mandatory and its absence was the first thing Kenya's High Court found. Ceiling: €20M or 4% of global annual turnover.

**Worldcoin's regulatory record is the predictive dataset, and every adverse finding turned on two things this spec has both of — consent validity where value was transferred, and irreversibility of the artefact:**

| Jurisdiction | Action | Theory |
|---|---|---|
| **Kenya** | High Court, 5 May 2025, Aburili J — operations **unconstitutional and unlawful**; permanent deletion of all Kenyan biometric data within 7 days | No DPIA; ~USD 55 in crypto treated as **vitiating** consent, not evidencing it |
| **Brazil (ANPD)** | Jan 2025 **blanket ban**; R$50,000/day (~USD 8,800) if collection resumes | LGPD: consent for sensitive data **cannot be purchased** — payment makes consent non-free |
| **Germany (BayLDA, EU lead)** | 19 Dec 2024 — GDPR non-compliance; GDPR-conforming deletion procedure within one month; **ex officio deletion** of codes collected without sufficient basis. Under appeal. [decision](https://www.edpb.europa.eu/system/files/2025-02/decision1594_0.pdf) | No valid Art 9 basis for the early cohort |
| **Spain (AEPD)** | Mar 2024, 90-day emergency ban (GDPR Art 66 urgency) | Minors' irises scanned; hundreds of complaints |
| **Portugal (CNPD)** | Mar 2024, 90-day suspension | Same |
| **Hong Kong (PCPD)** | May 2024, enforcement notice to cease | Excessive collection, not necessary for purpose |
| Others | Indonesia suspension; Thai police raid; orb withdrawal from France, India, Brazil (Dec 2023); Philippines, Argentina, UK inquiries | — |

**b tokens are the inducement. That is Brazil's and Kenya's exact theory, with a larger number attached.**

### Texas CUBI (Tex. Bus. & Com. Code §503.001)

Consent required before capture for a commercial purpose; **no sale, lease, or disclosure** except in narrow exceptions; destruction within a reasonable time and **not later than one year** after the purpose expires. Penalty **up to $25,000 per violation**, AG-only enforcement, no private right of action — which historically meant it was ignored, and no longer does: the Texas AG settled with Meta for **$1.4B** (2024) and Google for **$1.375B** (2025) on biometric and privacy claims. The one-year destruction mandate is flatly unperformable on an immutable public ledger, and per-violation × 10^7 Texans is not a number worth writing out.

### The composite finding

Even after dropping publication and moving to MPC, the **paid-account + token-grant structure remains the Kenya/Brazil consent theory**, and the **automated −50% penalty remains an Art 22 problem**. Those two survive the cryptographic fix and need separate design answers: a genuine no-token-for-biometrics separation on the enrolment path, and a human-in-the-loop or user-initiated trigger for anything that moves value.

---

## 7. The restorative merge

**The instinct is right and should be kept. The implementation has the wrong trigger, the wrong sign, and the wrong magnitude — all three fixable without touching the philosophy.**

Merging beats excluding: correct, and it is the single best idea in the onboarding spec. Exclusion creates an absorbing failure state (a person refused enrolment has no path back), while merging creates a recoverable one. Operant reward beating punishment: also correct, and steering toward unlock-velocity-increasing actions is a genuinely good mechanism design. Keep both. Here is what breaks around them.

### 7.1 The trigger is a measurement with a 10^8-victim tail

A false positive does not mis-flag one person. Per the spec it **fuses two unrelated humans into one bDiD**:

- Two humans, two 420 caps in — **one 420 cap out.** The lifetime cap is annihilated, not throttled.
- One human is **economically erased**, and the failure is *absorbing*: re-enrolment now hits his own template in the gallery and flags again.
- Survivor takes −50%: year one 10%→5% of 420 = **21 b confiscated in year one**, recurring.
- b is transferable and native to Vaulta, so this is a market-priced bearer asset seized by an automated process.
- The erased party's antisybil fee is forfeited. **The paywall meant to stop Sybils now taxes the victims of the FP path.**

Aggregate at the upper band (3.4e8 events × 420 b): **1.43e11 b destroyed against a legitimate supply of 4.2e12 — 3.4% of the entire monetary base annihilated by measurement error.** At the lower band (6e7 events) it is 2.5e10 b, 0.6%. Year-one unlock confiscation alone: 1.3e9 – 7.1e9 b. Manual adjudication of the appeals the spec does not contain: 6e7–3.4e8 cases at 10 min and $5/hr ≈ **$50M–$283M in labour**, or $0.6–10B at professional rates.

Structurally elevated FP classes, all of whom this design chooses to punish: ~3.5–7×10^7 MZ twins (iris separates them, face and body mapping do not, and score-level fusion drags them into the tail), doppelgängers, and everyone whose dynamic-biologic channels have to be loosened to stay usable — **loosening widens the impostor tail and raises f**.

### 7.2 The sign is inverted

The −50% is a penalty on **disclosure**. Detection probability p is user-influenceable (occlusion, cosmetic contacts, lighting, angle, pose) and p < 1. Non-disclosure dominates whenever p·(forced-merge loss) < 0.5·(unlock). Operant framing does not repair a dominant strategy.

**Fix, cheap and fully in keeping with the founder's intent: invert to a disclosure bonus.** Self-disclosed merges retain, say, 75% of unlock velocity; undisclosed-then-detected merges take the full cut. Same restorative philosophy, incentive-compatible instead of fighting the incentive.

### 7.3 The magnitude is 20:1 in the attacker's favour

Undetected duplicate gains a full **420 b**. Caught duplicate loses **21 b** (5% of 420, one-time). Break-even detection rate:

```
420(1−q) = 21q   →   q* = 420/441 = 95.2%
```

With a $10 Vaulta fee at b=$1: `420(1−q) − 21q − 10 = 0 → q* = 93.0%`.

**The oracle must catch 93–95% of attempts for attacking to be EV-negative.** Now put that next to §2.5: **the ANN recall floor alone caps blind detection at 90–99%.** The break-even sits *inside* the recall uncertainty band. And that is the zero-effort number — the operative p is the *adversarial* one, and NIST publishes zero-effort FMR, not evasion rates.

**Under publication, adversarial q goes to ~0.** The attacker holds the matcher and their own prior record, evaluates `M(r, probe)` offline, perturbs capture conditions (tropicamide at ~$6/bottle for pupil dilation, pose, expression, finger moisture, pre-capture exertion for the electrophysiologic channel), and gradient-searches for maximum distance from their own template — **confirming non-match before burning a submission**. O(1) comparisons against their own record, microseconds, $0. Blind, AND-fusion evasion is already ~37% (face 5% × print 8% × visible-light iris 10% × electrophysiologic 20% FNMR → 1 − 0.95·0.92·0.90·0.80 = 0.37, and **the attacker needs only one channel to miss**). White-box takes it to ~1.0.

Cheapest attack ladder, cheapest first (Vaulta fee assumed $10, unpriced in the spec):

| Lane | Cost/extra bDiD | Notes |
|---|---|---|
| **White-box FNMR self-evasion** | **$11** | fee + ~$1 labour + $0.0001 compute; p≈1.0; fully scriptable |
| Generative/injection, unattested capture | $11–15 | killed outright by TEE capture |
| Blind FNMR evasion (publication dropped) | $27 | = $10/0.37, *only if the fee is charged before the check and forfeited* |
| **Recruit real humans** | **$25–60** | $15–50/head in low-income markets + fee; biometrics genuine, oracle correct, PAD irrelevant |
| Physical presentation artefacts vs LED/UV PAD | $200–5,000 | silicone mask $150–4,000, iris lens $20–50, gelatin finger $1–20 |

**The basket successfully defends the most expensive attack.** Presentation attacks and synthetic irises — what the LED/UV PAD is built for — are 1 to 2.5 orders *more* expensive than simply presenting badly. No rational attacker reaches for them.

Campaign arithmetic at lane 1: $1,000,000 / $11 = 90,909 extra bDiDs = **38.2M b minted**. At b=$1 that is 38× ROI; break-even at b=$0.026. Against 4.2e12 total supply it is 9e-6 — statistically invisible, no anomaly detector fires.

### 7.4 The merge flow needs strictly more than a uniqueness bit

Detect a prior undisclosed bDiD, **retrieve which one**, merge two 420 contracts, apply the penalty. That is 1:N *identification with record retrieval*, strictly stronger than the boolean AMPC provides, and it makes whoever runs the oracle an identification authority over the species. It also hands a griefing attacker the victim's record index as part of the "supportive" merge.

### 7.5 The restructure that keeps everything the founder wants

1. **The oracle returns one bit and takes no action:** `duplicate — enrolment refused`. Never an index, never a merge, never a penalty. False-positive cost collapses from "420 b annihilated, identity erased, no appeal" to "retry enrolment."
2. **Merge becomes user-initiated and cryptographically proved.** The enrollee proves control of the prior bDiD with the existing passkey / self-certifying root; *then* the two 420 contracts merge and the restorative unlock-velocity path runs on that proof. **This kills every poisoning attack at once** — the attacker holding a published template cannot produce the victim's passkey signature. It also removes the Art 22 problem, because the decision is no longer solely automated: the user initiates it. And it is arguably *more* restorative than being told what the machine found.
3. **Recalibrate magnitude to the prize.** Options that preserve the philosophy: (a) the duplicate's 420 is forfeited to the emission pool rather than merged — attacker downside becomes the full 420 and break-even drops to q = 50%; (b) penalty applies to the cap, not the unlock rate; (c) keep the velocity-restoration path but restore toward the *single* 420, never the doubled one.
4. **Fee charged before the check, non-refundable on refusal.** Otherwise failed attempts are free and the fee is not a Sybil tax at all — this is the difference between $11 and $27 per fake identity, and it is a one-line policy decision.
5. **The merge marker must not be a public discriminator.** A visible "−50%, merged" flag is a permanent, machine-readable, globally queryable register of humans who tried to start over — refugees with a discarded pre-flight identity, trafficking survivors, defectors, witnesses, people who transitioned. The restorative intent is real; the target list is real too. Make the unlock curve a private input with a public commitment, or apply the reduction so the resulting schedule is indistinguishable from a normal one.
6. **Add cheaply:** per-account and per-device enrolment rate limits, and a cooling-off window between attempts that defeats same-session dilation/exertion perturbation.

### 7.6 The residuals, to be disclosed rather than discovered

- **Enrolment DoS is irreducible.** Even with refusal-only, a master-print or morph attacker (~$25/shot; DeepMasterPrints matches 23% of subjects at FMR 1e-3, ~1.1% at 1e-4; MIPGAN morphs reach 30–90% MMPMR) can permanently deny a target enrolment — the oracle says duplicate, the victim has no prior bDiD to prove control of, lockout is for life. Rate limits and quarantine reduce throughput, not existence.
- **The recovery path IS the identification oracle.** Someone who genuinely lost their prior passkey can only be reunified by having the committee identify which record they are. That path must exist and must be an explicit, ceremonied, rate-limited, multi-party-authorised exception with published volume statistics. Never the default. A permanent, disclosed hole.
- **The Sybil floor is $25–60/head, set by human recruitment, and no cryptography touches it.** The biometrics are genuine, PAD passes truthfully, attested capture attests truthfully, the oracle returns "unique" and is *correct*. Note that lane 3 (blind evasion, $27) lands in the same band, so **$25–60 is the honest floor whichever fixes ship.** Whether it holds is a token-economics question: a genuine human's lifetime 420 is worth buying at $30 whenever b > $0.072. **Full transferability at genesis is what makes that market clear** — it lets an operator take assignment of a recruit's 420 the moment it exists. The oracle bounds the number of *humans*; transferability means bounding humans does not bound *control of allocations*. The lever is vesting, not enrolment: b non-transferable until unlocked forces the operator to hold custody of a wallet controlled by someone else's passkey for years, with counterparty risk per head. That is a founder ruling to revisit, and it should be stated as the acknowledged Sybil floor.
- **The FNMR side never closes.** At any FP-tolerable operating point, 10^6–10^7 genuine duplicates pass undetected at 10^10. **The oracle is a Sybil dampener, not a uniqueness proof.** Do not price the token as if uniqueness were guaranteed.
- **The root of trust migrates to the sensor vendor.** Enrolment replay survives "there is nothing to authenticate," and the only defence is attested capture — which makes the sensor manufacturer a subpoena target, a supply-chain target, and a governance actor with veto power over who counts as human. Permanent, not transitional. Name it in the trust model.
- **Attestation metadata leaks.** "bDiD H passed uniqueness at t" links enrolment timing, and per-sensor or per-jurisdiction binding links place. Batch, jitter, and use a threshold signature that does not identify the device.

---

## 8. What to build instead, or what to build first

### 8.1 The nearest thing that works

Keep every element of the founder's spec except six words, and change the merge trigger:

| Keep | Change |
|---|---|
| Multi-biometric basket, compounding | Weight toward stable high-DoF channels; dynamic biologics become **PAD-only**, out of the fusion rule |
| LED/UV flash liveness (ISO/IEC 30107-3) | Runs locally, per-capture, inside the TEE — orthogonal to the publish question and genuinely valuable |
| "No private key" bDiD — 256-bit digest of the genesis op, self-certifying | unchanged |
| Passkey as spend authority | unchanged |
| Multipersona as first-class, personas = context nullifiers below the bDiD | **saved** by dropping publication |
| Restorative merge, operant unlock-velocity reward | Trigger becomes **user-initiated on passkey proof**; sign inverted to a **disclosure bonus**; magnitude recalibrated to the 420 prize |
| Paid Vaulta account as budget-bounded Sybil rate-limiter | Charged **before** the check, non-refundable on refusal. Not a uniqueness proof, must not be leaned on as one |
| 420 cap at 18 decimals | Revisit **transferability before unlock** — this is the actual Sybil floor lever |
| ~~ALL SIGNATURES ALREADY PUBLIC~~ | **Delete.** Replace with: attested TEE capture → secret-shared gallery across a jurisdictionally diverse committee → boolean-only MPC check → threshold-signed on-chain attestation of the bit alone |

Publish the operating point. Whatever f and FNMR ship, state them and state **f·N²/2** next to them. If that number is not below 1, the flow is not automatic.

And re-gate BIO-1 and PERSON-1 explicitly, with a version bump, before any of this is built. B-2 says "no 1:N comparison, at any gallery size, for any purpose, ever" — an MPC-shielded boolean-only check is still 1:N and still needs the founder to amend his own ratified text, not to be quietly read around.

### 8.2 The cheapest experiment that settles the open question

**Do not run an FMR study.** The number the design needs — f < 2e-14 — is nine to twelve orders below the deepest impostor measurement ever published (Daugman's 2.0×10^11 comparisons probe to ~10^-11). It is **unmeasurable at any N you can afford, and unmeasurable at any N at all** with fewer than ~10^14 comparisons on real diverse subjects. Any pilot that reports "zero false matches" is reporting the rule of three, not evidence.

**Run an adversarial FNMR study instead, because the binding number is measurable and cheap.** §7.3 reduces the whole security argument to one scalar: **detection rate q must exceed 95.2%** (93.0% with a $10 fee). Unlike f, q is estimable at N = 10^3 with a few dozen paid participants, because it is a *per-subject* rate, not a tail probability.

**Protocol.** 50–100 participants, each enrolled once on the actual proposed commodity-phone stack (2D face + contactless print + visible-light iris + rPPG, with whatever PAD ships). Then each returns and attempts to *evade their own record*, under three arms:

- **Arm A, blind.** No feedback. Estimates the honest baseline (~37% evasion predicted).
- **Arm B, white-box.** Participant is given their own template and the matcher, exactly as publication would provide. Estimates the published-ledger case (~100% evasion predicted).
- **Arm C, MPC-shielded.** One bit per attempt, rate-limited, cooling-off enforced. Estimates the recommended construction.

Also measure, in the same run: per-channel FTA on the phone stack (the 2–5% figure comes from livescan, not from cameras), and ANN recall@K on a synthetic 10^7-record gallery seeded with the real captures — which is the only part of the FNIR floor that *is* extrapolable.

**Cost, rough:** 100 participants × ~2 h × 2 sessions at $50/h ≈ $20k, plus ~$5–15k engineering and $2k compute. **~$25–40k and six to eight weeks.** For that money you learn whether q can clear 95.2% on the hardware the founder actually intends to use, and you learn it before committing to a Vaulta fee level, a penalty magnitude, or an Orb-class hardware programme.

**The decision rule, set in advance:** if Arm A's q is below 93%, the penalty magnitude must be recalibrated to the full 420 (§7.5.3) regardless of anything else. If Arm B's q is materially above Arm A's, the publication clause was never the problem and I am wrong — but the predicted result is that B is near zero, and one afternoon of that data settles the loudest question in the spec on empirical grounds rather than on my say-so.

**Second experiment, if the first passes:** a bounded-N MPC pilot at 10^5–10^6 on the AMPC stack (the code is open: `github.com/worldcoin/mpc-uniqueness-check`), to validate the ~2.3 s/enrolment claim on your own committee topology and to measure the real adjudication rate at a gallery you can label. That is a few months and low six figures — and it is the honest prerequisite for saying anything at all about 10^10.

---

**Bottom line for the record.** The proposal is the correct answer to the undecidability ruling — biometric enrolment genuinely is the missing observable, and that insight should be kept and credited. The only error is publishing the observable instead of computing on it under secret shares. Delete six words, move the merge trigger from a measurement to a passkey proof, price the penalty against the 420 rather than 5% of it, and the design becomes buildable, defensible, and consistent with both the multipersona ruling and the founder's own ratified BIO-1/PERSON-1 — at the honest cost of an Orb-class hardware dependency, a k-of-n trusted committee, and a disclosed Sybil floor of $25–60 per identity that no cryptography will ever remove.
