# BNR-K — canonical biometric key and the public duplicate-prevention set

<!-- 9 agents: 3 survey, 3 constructions, 2 adversarial, 1 spec. 2026-08-04.
     [M] measured  [D] derived  [E] estimate  [U] unmeasured but load-bearing.
     HEADLINE: a trilemma with an information-theoretic proof (Bogdanov-Mossel,
     IEEE-IT 2011). Enforced duplicate prevention + no operator + non-oracular
     publication are jointly unsatisfiable. Pick two. The design gives up the
     third because it was never actually held. -->

# BNR-K v2 — Canonical Biometric Key and the Public Duplicate-Prevention Set

Notation: **[M]** measured in literature · **[D]** derived here from [M] · **[E]** engineering estimate · **[U]** unmeasured, load-bearing.

---

## 1. Does it work

**No — not with publication limited to exact hashes of a canonical key. Yes — with one change to what is published, and that change costs a privacy property the architecture never actually had.**

### 1.1 The impossibility, stated so it cannot be argued around

Three properties are jointly unsatisfiable:

| | property |
|---|---|
| **(i)** | duplicate prevention is *enforced*, not merely computed by the enrollee |
| **(ii)** | no operator, issuer, committee, matcher-holder, or witness |
| **(iii)** | published data is not a biometric identification oracle |

**Pick two.** Proof sketch, both directions:

- **(ii)+(iii) ⇒ ¬(i).** If the only published object is `H(K)`, the second-enrolment test is `H(K') ∈ Set?`. `K' ≠ K` whenever *anything* differs — capture, helper data, spec version, grid tie-break. The test passes and the duplicate is minted. The only escape is that `K'` *cannot* differ, i.e. zero helper data anywhere, i.e. pure canonical quantization. Bogdanov–Mossel (IEEE-IT 2011) [M] forbids that: `P[exact agreement] ≤ 2^(−k·ε/(1−ε))`, so `q ≤ 1e-7` at `k = 128` requires `ε ≤ 1.13e-9` against a measured floor of `ε ≈ 2e-2` — seven orders, information-theoretic, closed to all future invention. Both horns are shut. This is the $0 break the adversarial pass found twice (forged helper data; unenforced client-side probe), and it is not an implementation bug — it is this theorem.
- **(i)+(iii) ⇒ ¬(ii).** A fuzzy same-person test requires distance-bearing data. If that data is not public, some party holds it. That party is the operator. (Worldcoin's MPC committee is exactly this.)
- **(i)+(ii) ⇒ ¬(iii).** What remains, and what BNR must build.

### 1.2 Why losing (iii) costs less than it looks

The exact-hash architecture **already** fails (iii) in its only working form. Pure canonical `K = F(capture)` with `F` public and parameterless means any NIR capture yields `K` yields a set lookup: an exact, offline, unlogged, unrateable membership oracle over 10^10 humans. Removing the gallery operator removed the only party who could rate-limit queries. The founder's "published set is uniform noise" claim is **true against a ledger-only observer and false against anyone holding a capture** — and NIR captures at ≥200 px iris diameter are obtainable covertly at 1–3 m with ~$250 of COTS parts, and already exist at scale (Aadhaar ~1.3e9).

So (iii) was never held. What changes is *how good a capture* the attacker needs. That is a quantitative degradation, priced in §4, not a categorical loss — and §5–6 buy back the part that actually mattered (permanence of theft) by making identity revocable.

### 1.3 The decisive number: the feasible radius band

Three constraints must hold at one radius `r` (fractional Hamming distance over `n` retained degrees of freedom):

1. **Reproducibility floor** — `r ≥ μ + z·σ` for target per-attempt failure `q`.
2. **Entropy ceiling** — residual min-entropy after publishing the syndrome and bucket must be ≥128 bits, because the digest is public.
3. **Discriminability ceiling** — `f(r) ≤ 2e-17`.

**Constraint 3 never binds.** It is 40 orders slack at the operating point. Constraints 1 and 2 are the entire problem, and they are in direct opposition: ECC cost `n·h(r)` rises with `r`, residual entropy falls.

**The single structural move that opens the band:** with a fuzzy duplicate test at enrolment, a re-derivation failure is a *retry*, not a duplicate. `q` drops from `1e-7` (the founder's target, which must hold for *duplicates*) to `1e-2` per attempt (session availability, `1e-8` over 4 retries). This is the whole payoff and it is worth ~5σ of radius.

Regime A throughout (28-day cadence maintained, syndrome re-issued each cycle, so drift never accumulates): `μ = 0.05`, `σ_joint ≈ 0.021` [D from M].

| pipeline | n (DoF) | floor (q=1e-2) | ceiling (128 b residual) | **band** |
|---|---|---|---|---|
| phase-only, inner annulus, both eyes | 300 | 0.101 | 0.109 | **[0.101, 0.109]** — width 0.008 ≈ 2.4 bit-positions. Exists; **zero margin.** |
| + coarse amplitude quantization [E] | 400 | 0.099 | 0.144 | **[0.099, 0.144]** — width 0.045. Workable. |
| full band, no lens-immunity | 498 | 0.098 | 0.175 | wide, but reopens the contact-lens sybil vector (§3.4) |

**Design point: `n = 400`, `r = 0.12`.** The 300-DoF number is what a phase-only inner-annulus pipeline gives today and it is a razor. Reaching 400 requires the amplitude augmentation in §2.3, which is **[E], unmeasured**, and is the first thing the build plan validates.

**The decisive number is therefore not one radius but two:** key decoding at `r = 0.12`, duplicate detection at `t = 0.30`. The 0.18 gap between them is the entire (c) enforcement margin and it exists only because their error budgets are different (§3.1).

---

## 2. The construction

### 2.1 What enters the key

| channel | in K? | role | reason |
|---|---|---|---|
| Iris L, Iris R | **yes** | key material | 249 DoF/eye [M]; no voluntary DoF after §2.2 |
| Retinal vasculature | no | independent anchor record | untouched by cataract surgery — the single largest lockout cause |
| Finger-vein pair | no | independent anchor record | 30–50 b [M], too weak for a public digest; *which finger* is elective |
| Dorsal hand vein | no | independent anchor record | survives ocular trauma |
| PPG morphology | **never** | liveness gate only | net entropy ≈ 0 b after ECC, and voluntarily modulable (breath-hold, cold, posture) — a channel you can move past the decoding radius is a key mint |

**Admission law:** a channel enters `K` only if (1) per-decade drift-beyond-radius ≤ 1e-3, (2) ≥100 b residual after ECC, (3) **no degree of freedom the subject can voluntarily move.** PPG fails all three; it fails (3) fatally.

**F1, absolute:** no user-held value XORs into any secret, anywhere. The vein-substitution helper `d_VL = S ⊕ PRF(·)` from earlier drafts is deleted. Any user-held addend is a user-*chosen* secret and yields unlimited keys for $0. Multi-anchor availability is provided by **independent records** (§6), never by a reconstruction share.

### 2.2 Feature extraction — every elective DoF removed or rejected

Frozen, versioned, published, **integer-only fixed-point** (no floating point anywhere; bit-exact across hardware not yet invented), with published test vectors.

| stage | specification | elective DoF closed |
|---|---|---|
| Capture | NIR 850 nm, ≥200 px iris diameter (ISO/IEC 19794-6 high tier), **binocular, 15-frame burst over 3 s** | — |
| Roll | derotate by the **inter-pupil line measured in the same frame**; head tilt is common-mode and cancels exactly. Never by alignment to a stored reference (that is helper data in disguise) | head tilt |
| Torsion | decoder-side search over fixed ±4°/1° grid, minimum-distance, lexicographic tie-break — deterministic function of the capture | ocular counter-roll (involuntary) |
| **Radial band** | **annulus 1.0 → 2.2 pupil radii, clipped at limbus.** The radial coordinate is referenced to the **pupil**, not the pupil-to-limbus band, so the limbus radius estimate never enters the key. | **contact-lens outer-boundary attack (§3.4)** |
| Dilation | Wyatt/Thornton biomechanical stretch to canonical p/i = 0.40; **gate [0.30, 0.50], reject outside** | tropicamide / mydriatics |
| Segmentation | frozen integro-differential operator, fixed parameters, lexicographic tie-break | — |
| Occlusion | ECC **erasures**, recomputed per capture, **never stored**; reject if erasure fraction > 0.30 or erasure geometry inconsistent with the eyelid/lash arc model | eyelid/gaze steering (partially) |
| Reliability mask | **global, population-derived, published, identical for every human.** A per-user mask is enrolment randomness and a choosability handle. Forfeits the 2–4× per-user radius gain — correct price. | per-user tuning |

> **The reject-don't-degrade law.** For every elective degree of freedom, the response to an out-of-band value is *no key*, never *a different key*. Rejection is (c)-safe; graceful degradation is (c)-fatal. Every gate above is a reject.

### 2.3 Quantization and the bit budget

Per eye, inner annulus: fixed Gabor bank, phase-quadrant bits (Daugman) → ~180 DoF [D from 249 whole-band [M]; the collarette region carries disproportionate texture].
**Amplitude augmentation [E]:** add 1 coarse amplitude bit per patch (above/below a global per-radius median). Claimed +30% independent DoF. **This is [E] and the band in §1.3 depends on it.**

| quantity | value | basis |
|---|---|---|
| raw DoF, two eyes | 480 | [D] |
| after fragile-bit erasure gating (τ global, target 20%) | **n = 400** | [D] |
| population non-uniformity charge | −8% | [E] |
| `H_∞(w)` | **368 bits** | [D] |
| decoding radius `r` | **0.12** | §1.3 |
| syndrome length `n − k = n·h(0.12)` | **212 bits** | [D] |
| codeword / key length `k` | **188 bits** | [D] |
| bucket `b` (published, §2.5) | **24 bits** | [D] |
| **residual min-entropy of K given all public data** | **368 − 212 − 24 = 132 bits** | [D], leakage bound is additive-upper |
| effective vs. offline brute force, +Argon2id(4 GiB, t=10) | ≈152 bits | [E] |
| honest collision `f = 2^−n(1−h(r))` | **2e-57** | [D] — clears 2e-17 by 40 orders |

**Code:** concatenated — inner repetition/Hadamard against bit noise, outer Reed–Solomon with **erasure** decoding (1 symbol per erasure vs 2 per error; worth ~0.03–0.05 of radius [M]). Bounded-distance decoding at radius `r ≤ d/2`, with explicit **ambiguity detection**: two or more codewords in range → `⊥`, never a guess.

### 2.4 Key derivation

```
w        = canonical gated feature vector, 400 coords, per-capture erasure set E
s        = H · wᵀ                                  # deterministic syndrome, 212 b — NOT the randomized code-offset sketch
c        = Decode_C(w, E, s)                       # ⊥ on failure or ambiguity
K_eye2   = c                                       # 188 b codeword index
D        = Argon2id(K_eye2, salt = "BNR|v1|iris2", m = 4 GiB, t = 10, p = 4)   # 256 b
```

Identity head, over the anchor set: `D₀ = Argon2id( MHF("bnr|v1|head" ‖ sorted anchor digests) )`.

**There is no `Gen`/`Rep` asymmetry.** Enrolment and re-derivation run byte-identical code. That symmetry *is* canonicality.

### 2.5 The published record — this is the duplicate-prevention set

Per anchor:

```
R = ( ver , ctx , B[40] , s[212] , D[256] , π )
```

- **`ctx`** — domain tag (`iris2` / `retina` / `veinpair`), so namespaces can never collide.
- **`B`** — canonical bucket, 40 bits stored, readers use the first `b = ⌈log₂N⌉ − 10` (b = 24 at N=1e10 → ~600 records/bucket). **`b` grows with `N` by taking more prefix bits, so bucket occupancy is constant and the test is genuinely O(1) at any scale, with no reindexing.** `B` is built from 24 globally-ranked coordinate *groups*, each majority-voted 8-fold across the burst, giving `ε_B ≈ 0.005` [E] → `P[B reproduces exactly] ≈ 0.92`, and ≥0.9999 within Hamming radius 2.
- **`s`** — the deterministic syndrome. Public. This is the object that makes (i)+(ii) possible and (iii) impossible.
- **`D`** — the digest.
- **`π`** — a **transparent** (STARK-class, no trusted setup) proof that `(B, s, D)` was derived by `Canon_v1` from a single capture that passed `Gates_v1`, and that the enrolment probe was exhaustive over the published grid `G`. Verification is O(1) from a published verifying key — data, not an institution.

**Duplicate rule (evaluable by any reader of the log, forever, with no operator):**

```
ENROL(R_new):
  Buckets ← union of B(g) over all g in the published nuisance grid G     # ~1e4 distinct buckets [E]
  Buckets ← Buckets ∪ Hamming-ball(B_new, 2)                              # ~301 buckets
  for each existing R_old with B_old ∈ Buckets and ctx_old = ctx_new:
      if SyndromeDecode(s_new − s_old) succeeds at weight ≤ t·n:   REJECT
  if π invalid:                                                     REJECT
  else append R_new
```

`t = 0.30`. Cost: ~1e4 buckets × 600 records ≈ 6e6 syndrome-difference decodes ≈ **12 s, once, per enrolment** [E]. O(1) in N.

**F3 — quantize the nuisance space, do not sample it.** `G` is *exhaustive on the modelled axes*, not a random 2^20 sample: 1024 rotation offsets × 9 torsion cells × 7 dilation cells × 5 segmentation hypotheses × 2^8 anatomical-wedge erasure patterns (8 published wedges, not 2^373 free positions) ≈ 2^23.5 hypotheses, collapsing to ~1e4 distinct buckets. Probe-miss residual on those axes is **zero**, not "estimated 1e-4, unmeasured."

---

## 3. Property (c), the sybil-critical one

### 3.1 The mechanism, and why it is enforced rather than trusted

A second enrolment by the same body is prevented by the fuzzy test in §2.5, and — this is the load-bearing point — **the test is re-runnable by every reader of the log from public data alone.** A record whose probe-set contains a colliding earlier record is *invalid*, syntactically, checkable independently by anyone, forever. There is no party to trust and no party to bribe. This is the exact difference from the exact-hash architecture, where a hash carries no provenance and a cheating enrolment is indistinguishable from an honest one by construction.

The two error budgets are different, and that is where the margin comes from:

| test | radius | error consequence | tolerable rate |
|---|---|---|---|
| key decoding | `r = 0.12` | `⊥` → retry | 1e-2/attempt |
| duplicate detection | `t = 0.30` | false flag → one person wrongly told "already enrolled" | ~1e-9/enrolment |

False-duplicate rate at `t = 0.30`, n = 400: per-pair `2^−400(1−h(0.30))` = 4e-15 [D]; × 1.8e5 comparisons = 7e-10/enrolment; × 1.25e8 enrolments/yr = **0.09 false lockouts per year, globally.** Negligible — which is exactly why `t` can be 2.5× `r`.

### 3.2 What an attacker must do

**Produce a capture of their own body at Hamming distance > 0.30 from their own prior enrolment, that still passes all gates and yields a valid `π`.**

| vector | Δ HD achievable | total from μ=0.05 | vs t = 0.30 |
|---|---|---|---|
| honest retries (Gaussian core) | — | 0.05 ± 0.021 | **blocked**, ~11σ |
| tropicamide 1 % dilation [M] | +0.06 | 0.11 | **blocked** (and gate-rejected anyway) |
| plano contact-lens ladder, pupil-referenced annulus | +0.02 [E] | 0.07 | **blocked** — see §3.4 |
| cross-sensor, two device builds [M] | +0.06 | 0.11 | **blocked** |
| eyelid/gaze erasure steering | +0.03 [E] | 0.08 | **blocked** — wedges are enumerated exhaustively |
| **all four stacked** | +0.17 | **0.22** | **blocked, margin 0.08** |
| stacked + full-band pipeline (i.e. if F4 is dropped) | +0.31 | 0.36 | **BREAKS** — this is why §2.2's pupil-referenced annulus is mandatory, not optional |
| **segmentation-failure mode** | +0.40 | **0.45** | **EVADES — this is the residual** |

### 3.3 The residual, stated plainly, and it is the crux

Genuine-pair iris HD is **not Gaussian**. It is a mixture: a tight core plus a failure mode in which the segmenter confidently locks a wrong boundary (limbus vs. eyelid, lens edge vs. sclera) and produces near-impostor distance. Every 7–14σ tail figure in the earlier constructions (2.6e-12, 7.8e-13, 1e-18) is a Gaussian extrapolation into a region the mixture dominates. **Empirical mass in that mode is ~1e-3 to 1e-4 [E], not 1e-12.** That single modelling error is ~9 orders and it is load-bearing.

A segmentation failure lands at HD ≈ 0.45 > t, *and* throws the bucket far outside the radius-2 ball. It evades the duplicate test.

Two mitigations, both implementable:

1. **`π` certifies segmentation self-consistency** — the pupil/limbus boundaries must be consistent with the eyelid-arc model, and the two eyes must agree on inter-pupil geometry to within a published tolerance. A wrong-boundary lock is *detectable in-frame* even when it is confident, because a binocular capture over-determines the geometry. [E] catches 90–99 %.
2. **Union-of-grid buckets** (§2.5) — the 5 segmentation hypotheses in `G` are probed exhaustively, so the *induced* failures on the modelled axis are covered.

**Residual after mitigation: [U] 1e-5 to 1e-6 per enrolment attempt.** At 1.25e8 enrolments/yr that is **125–1,250 undetected sybils per year**, against a founder budget of 1,000 *total, forever*.

> **This is the number that decides whether the architecture stands, and it is unmeasured.** It is not a Gaussian tail; it must be counted. §8 gives the experiment, and it costs $0 to run a first estimate.

### 3.4 The contact-lens fix, named

A clear plano soft lens perturbs the **limbus** estimate, which nothing in the earlier designs corrected: a 2–4 % outer-radius error rescales the rubber-sheet radial coordinate and flips quadrant bits at ~1/π on the finest bands, giving Δ HD +0.08 to +0.16 [D], **durably and reproducibly** — a permanent second identity, not a per-attempt mis-decode. No error model in any prior draft captures persistent-state perturbation.

Fix: **reference the radial coordinate to the pupil, not the limbus.** The annulus 1.0 → 2.2 pupil radii never uses the outer boundary estimate. Residual +0.02 [E] from tear-film and edge shadow. Add a limbus specular-ring and lens-edge shadow reject gate at 850 nm (clear-lens EER 1–3 % [M]) as defence in depth — but do not rely on it, because rejecting clear lenses excludes ~140 M wearers.

Cost: DoF 498 → 400 (with amplitude augmentation) or 300 (without). That cost is the razor-thin band in §1.3 and it is the price of closing this vector.

### 3.5 (c) as revocability, and why absolute (c) is a mistake

Absolute (c) — "the subject can *never* derive `K' ≠ K`" — is simultaneously a proof that a compromised `K` can **never be rotated**. A leaked NIR image becomes a permanent, unrecoverable seizure of identity and funds, for life, with no issuer to appeal to. The stronger (c) is made, the more permanent theft becomes.

The requirement is not "K is immutable." It is **"one live human ↔ at most one *live* identity slot."** Those differ. §6's succession chain keeps the live-slot count at exactly 1 while letting the key move. (c) survives in the only form that matters; revocability is regained.

---

## 4. The published set

### 4.1 What is published

`(ver, ctx, B[40], s[212], D[256], π)` per anchor, plus succession records `SUCC = (D_old, {new anchor digests}, D_new, σ, T)`.

### 4.2 Uniform noise — the honest accounting

**`D` is uniform noise. `B` and `s` are not.** Stating otherwise would be false, and the earlier drafts' "the published set is uniform noise" claim does not survive the move to enforced (c). Precise leakage:

| object | leaks | to whom |
|---|---|---|
| `D` (256 b) | nothing without a capture | — |
| `B` (24 b) | 24 bits of identifying information: an unknown NIR capture narrows to **~600 candidates out of 10^10** | anyone with any NIR capture, even poor |
| `s` (212 b) | coset of `w`. Combined with a capture at HD < 0.12 → `K` exactly. Combined with a capture at HD < **0.27** → `K` under list decoding, because the public `D` adjudicates the list for free | anyone with a mediocre NIR capture |
| `π` | derivation validity only | — |

### 4.3 The list-decoding inversion — the sharpest form of the privacy loss

The honest user must land on the correct codeword in one shot under a UX budget: unique-decoding radius `(1−R)/2 = 0.12`. An attacker need only produce a *list* containing it and filter against the public `D` at zero false-accept cost: Johnson list-decoding radius `1 − √R = 1 − √0.47 = 0.31`.

**The attacker reproduces your key from a capture 2.6× noisier than you need.** That inversion is the whole privacy break in one line, and it is not fixable — it follows from `D` being public, which is what makes the set queryable, which is the architecture.

### 4.4 What a holder of the entire set plus a photograph can and cannot do

**Can:** confirm whether a named person is enrolled (1:1, essentially certain); narrow an unknown capture to ~600 candidates, then confirm; derive `K` and hence the identity anchor; do all of this offline, unlogged, unrateable, in O(1), for ~$0.0002 per identity tested after a cheap prefilter.

**Cannot:** enrol as that person (the duplicate test rejects, publicly and verifiably); reconstruct a shareable iris *image*; move funds (§5 requires device + body); take over the identity without surviving the 90-day challenge window (§5.4); find anyone at all from the set alone — **the set without a capture is inert.**

### 4.5 What is bought back

Because identity is revocable (§6), a compromised anchor is *retired forward*, not seized forever. The exchange rate: absolute (c) buys ≤1,000 duplicates of protection and costs both permanent unrevocable theft and 4.5e10 lockouts (§6.1). Revocable (c) costs the oracle — which was already present — and buys back both. **Take the trade.**

---

## 5. Full custody

### 5.1 What the user stores

| item | size | secret? | replaceable? |
|---|---|---|---|
| chain signing key `sk_t` | 32 B | **yes** | **yes** — via biometric succession, 90-day window |
| spec version tag | 4 B | no | recoverable by trying published versions |
| recovery seed (optional, opt-in) | 16 B | yes | yes |

**No helper data. No template. No syndrome. No record pointer.** All of that is published — that is the point of §4, and it is what makes the backup problem trivial. `s` is not lost when a device is lost, because `s` was never on the device.

### 5.2 Spending requires two-of-two

`sk_t` **and** a fresh biometric-derived signature over the same nonce. Consequence:

- Stolen backup (`sk_t` alone) → useless without the body.
- Stolen NIR image (biometric alone) → useless without the device.
- Lost device → recoverable by biometric succession, with delay.
- Lost eyes → recoverable by 2-of-5 anchors (§6).

**Proof the backup is useless to anyone else:** the backup contains only `sk_t`. `sk_t` authorizes nothing on its own — every spend transcript requires a co-signature under a key that exists only transiently inside a live gated capture, and every succession requires either two anchor signatures or a seed reveal that is override-able by anchors (§5.4). A thief holding a perfect copy of every byte the user stores can produce no valid transcript. The backup can therefore be replicated **without limit** — paper, steel, relatives, any cloud, any number of copies — which is exactly what a crypto seed phrase cannot be. That asymmetry is the custody win, and it is the honest thing to compare against.

### 5.3 Lost-device recovery, no trusted party

1. Capture 2 of 5 anchors on any conforming device.
2. Fetch the published `s_i` for those anchors from the log. Decode → `K_i`.
3. Sign `SUCC(D_old → D_new)` with the two anchor keys.
4. Append. After the challenge window, `D_old` is dead and `sk_new` is live.

No issuer, no queue, no witness, no meetup, no appeal.

### 5.4 The challenge window — theft defence with no arbiter

Every `SUCC` carries a **90-day challenge window**. During it:

- a competing `SUCC` signed by **2 biometric anchors** deterministically overrides a **seed-based** one;
- a competing `SUCC` signed by the **incumbent `sk_t`** deterministically overrides an **anchor-only** one.

Both are priority rules any reader of the log evaluates independently. Not a judge, not a committee, not a threshold. A photo-thief's anchor-only succession is vetoed by your device; a device-thief's key-only spend is blocked by the missing body; a genuine loss has no veto and completes.

**Cost, stated:** funds are illiquid for 90 days after any recovery event. That is the price of arbiter-free theft defence and it is not negotiable downward without introducing a party.

---

## 6. Lockout and recovery

### 6.1 The rate the single-key architectures produce

Population model: N = 1e10, 80-year life → **1.25e8 people/yr** entering.

| cause | mechanism | lockouts/yr, single-key architecture |
|---|---|---|
| cataract surgery | ~6,000 procedures/M/yr at universal access → 3e7 persons/yr; ~1/3 of operated eyes exceed threshold post-phaco [M, Roizenblatt 2004]; **binocular-mandatory capture makes failure a union over eyes** → P ≈ 0.55 | **1.7e7** |
| cadence lapse | 780 consecutive 28-day captures over 60 adult years, no gap > 2 yr; 10 % lifetime lapse (hospitalisation, incarceration, war, displacement, dementia, poverty) | 1.25e7 |
| aging drift off cadence | 1.6 % lifetime [D from Fenker & Bowyer +153 % FNMR/3 yr [M]] | 2e6 |
| trauma, enucleation, corneal opacity, trachoma, iridotomy, chemical burn | ~1e-4/yr bilateral | 1e6 |
| **total** | | **~4.5e7/yr** |

Per-person hazard 4.5e-3/yr → **24 % lifetime lockout probability** (band 11–45 %).

Against a duplicate budget of **1,000 people, total, forever**, that is 4.5e4 lockouts per year per unit of the entire lifetime duplicate budget. The single-key design manufactures the failure it exists to prevent, at 10^7× the rate, pointed at innocent people, with no appeal path because the absence of an issuer was the design goal.

### 6.2 The fix: five anchors, 2-of-5 succession

Anchors chosen for **independent failure modes**, which is the property nothing prior optimized for:

`A1` iris L · `A2` iris R · `A3` finger-vein pair · `A4` dorsal hand vein · `A5` **retinal vasculature**

Retina is load-bearing: cataract is a *lenticular* opacity and cataract surgery *improves* retinal imaging. The largest lockout term is removed by an anchor the causal event does not touch. Vein anchors survive ocular trauma, chemical burn, trachoma, enucleation. No single medical event takes 4 of 5.

- **Each anchor is a separate published record** with its own `(B, s, D, π)` and its own fuzzy duplicate test. Enrolment rejected if **any** anchor collides. This is *strictly stronger* anti-sybil (a sybil now needs five different body parts) and *strictly weaker* as a lockout cause (losing one anchor loses nothing).
- **No reconstruction shares, no XOR helper, no polynomial.** Availability comes from record independence, not from secret sharing. This is F1 and it is what closes the $0 forge.
- Succession `SUCC = (D_old, {new anchors}, D_new, σ, T)` signed under any 2 surviving anchor keys. **Retire-forward:** `D_old` dies the instant `SUCC` lands. Live slots stay at 1 — a syntactic property of the log, checkable by anyone, not a policy enforced by anyone. A succession *cannot* mint a duplicate.
- **28-day cadence emits a succession**, not a local state update. Correction radius spans 28 days, never 40 years → Regime A permanently. This also answers the "two disjoint chains" objection: a second chain's *root* anchors are already in the set and are fuzzily detected at enrolment. First-writer-wins on anchors; chain-forward on keys.
- **Verified list decoding for the honest user**, reclaiming §4.3's inversion: a returning user decodes **1:1 against their own published head** with list size 2^20–2^30 and the full grid. A 1:1 test against a named record cannot mint anything, so it is safe at any `f`. Worth 2–4 orders on `q` for lapsed users. Rate-limit with proof-of-work, not an operator.

### 6.3 Residual rate

| cause | after fix | lockouts/yr |
|---|---|---|
| cataract | retina + vein anchors untouched by the causal event | ~0 |
| cadence lapse | public chain + 1:1 list decode against own head | ~1e5 |
| aging drift | 28-day published re-centering | ~0 |
| trauma/enucleation | 2-of-5 across independent failure modes | ~2e4 |
| **total** | | **~1e5/yr** [E] |

**4.5e7/yr → ~1e5/yr. 450×, 2.6 orders. Lifetime lockout 24 % → 0.06 %.** Trusted parties added: zero. Meetups: zero.

### 6.4 The irreducible residue, stated plainly

> **Approximately 30,000 people per year — band 10,000 to 100,000 — lose four or more anchors while incapacitated, hold no recovery seed, and are permanently locked out. Over the thousand-year horizon that is roughly 3×10^7 people.**

That floor is 10–100× the founder's *total lifetime duplicate budget*, per year. It cannot be removed without a trusted party. The design must choose which tail it eats; this makes the choice explicit and 2.6 orders cheaper than leaving it implicit.

The optional seed (§5.1) reduces it further for opt-in users. Anti-sybil guard: **revealing the seed cannot mint** — it can only execute `SUCC(D_old → D_new)`, retiring `D_old`. Live-slot count unchanged. Structurally incapable of duplication.

---

## 7. The thousand-year test

| dependency | survives a century with no company, state, or protocol? | note |
|---|---|---|
| Frozen spec: Gabor bank, `W_v1`, global mask `M_v1`, τ, gate thresholds, code `C`, torsion grid, wedge definitions, Argon2 params | **yes** — data. Engravable, mirrorable, publishable into the log itself | requires integer-only fixed-point throughout; floating point anywhere is a thousand-year bug |
| Bit-exact integer test vectors | **yes** | mandatory; without them the pipeline is not reproducible on unbuilt hardware |
| SHA3-512 | **probably** | version-tagged; a break is survivable *only because* succession allows migration — another reason absolute (c) is wrong |
| Argon2id 4 GiB memory-hardness | **no** — erodes to zero | charge **no** Argon2 credit on the long horizon. Residual falls to 132 b raw. Still ≥128, but the margin is gone. Raising `n` is the only durable answer. |
| **Transparent proof system for `π`** | **yes, if STARK-class.** **NO if Groth16** | a Groth16 verifying key requires a trusted setup ceremony — an institution, permanently trusted. **Do not use it.** Named explicitly as a thing that fails the test. |
| NIR 850 nm sensors, ≥200 px optics | **yes** — commodity physics, refabricable | but bit-exactness needs a **published physical calibration target spec**, not just a software spec. This is currently missing and must be written. |
| **The append-only log** | **NO — this is the one genuine institutional dependency** | ordering and liveness require an ongoing protocol with participants. Mitigation: append-only + mirrorable; forks reconcile by union with first-writer-wins on proof-of-publication timestamp. But *someone must keep running it*. There is no version of operator-free duplicate prevention without a persistent shared log. **State this to the founder as the one constraint that cannot be met.** |
| Population reference corpus used to derive `M_v1`, τ | **yes** — frozen once, published as constants; the corpus itself need not survive | |
| Human iris anatomy | yes | |

**Named failures: (1) the log's liveness requires an ongoing protocol; (2) Argon2's work-factor credit decays to zero; (3) Groth16 (if chosen) requires a permanently-trusted setup — use STARKs.**

---

## 8. Build order

### 8.1 The cheapest experiment that would falsify this — run it first, it costs $0

**F6: measure the genuine-pair Hamming-distance tail on the frozen pipeline.**

- **Falsifier:** if `P(genuine self-HD ≥ 0.30 | gates passed, π valid, pupil-referenced annulus) > 1e-5`, the duplicate test is evadable at scale and **the architecture does not stand.**
- **Prediction:** 1e-5 to 1e-6 after §3.3's mitigations; 1e-3 to 1e-4 without them. **[U] — every (c) number in every prior draft is a 7–14σ Gaussian extrapolation of a distribution that is empirically a mixture.**
- **Data, already existing, free:** ND-CrossSensor-2013, ND-Iris-Template-Aging-2008-2010, NDCLD15 (contact lens), CASIA-Iris-Thousand, IITD. Yields ≥1e6 genuine cross-session pairs stratified by lens on/off, sensor, and ≥5-year gap.
- **Cost:** $0, ~3 weeks, one engineer. **There is no reason to build anything before this runs.**

### 8.2 Prototype order

| # | build | why first |
|---|---|---|
| 1 | Frozen integer-only pipeline + published test vectors, pupil-referenced annulus, global mask | everything else is defined relative to it; also the F6 substrate |
| 2 | **Amplitude-augmentation measurement** — does the coarse amplitude bit deliver DoF 300 → 400? | the §1.3 band is razor-thin without it. **[E], and it gates the whole entropy budget.** |
| 3 | Bucket + syndrome + duplicate test over 1e6 real + 1e9 synthetic records | validates O(1) claim, `b` growth rule, `t = 0.30` false-flag rate |
| 4 | Succession-chain log with retire-forward and the two priority rules | this is what makes lockout survivable and (c) revocable |
| 5 | STARK circuit for `Gates_v1` + probe-exhaustiveness | converts a client-side check into an enforced one; ~1e8–1e9 constraints, minutes today, seconds by 2030, once per enrolment |

### 8.3 Physical experiments, in cost order

| experiment | subjects | hardware | cost | decides |
|---|---|---|---|---|
| Contact-lens ladder — 7 lens states (bare, 13.8/14.0/14.2 mm × 8.4/8.6 BC) × 10 captures | **30** | 1 open NIR rig, $16–35 BOM | ~$5 k | whether §3.4's pupil-referenced annulus kills the **durable** second-key vector. Predicted Δ HD +0.02 vs +0.16 full-band. |
| Cross-sensor — 3 independent device builds | **100** | 3 rigs | ~$25 k | whether the +0.06 cross-sensor term [M] stays inside `t`; also whether bit-exact integer arithmetic actually cancels optical variation (it does not — this measures the gap) |
| Gate efficacy — tropicamide, gaze, eyelid, at all reject thresholds | **50** | 1 rig + supervising clinician | ~$60 k | whether reject-don't-degrade holds in practice |
| Longitudinal Regime-A confirmation — 28-day cadence | **500 × 24 months** | 500 rigs | ~$400 k | the entire `μ = 0.05, σ = 0.021` premise. Everything in §1.3 rests on it. Start recruiting on day one; results arrive last. |

### 8.4 Order of work

**F6 (free, day one) → amplitude DoF measurement → F1/F2 code changes (delete every user-held XOR; add `π`) → bucket+syndrome architecture → contact-lens ladder → succession log → cross-sensor → longitudinal.**

---

## Uncertainty register

| # | claim | status | consequence if wrong |
|---|---|---|---|
| U1 | `P(genuine self-HD ≥ 0.30 \| gates)` ≈ 1e-5–1e-6 | **[U], unmeasured, the crux** | at 1e-3 the sybil rate is 1.25e5/yr vs a 1,000 budget — architecture fails |
| U2 | amplitude augmentation delivers 300 → 400 DoF | **[E]** | band collapses to [0.101, 0.109], width 2.4 bit-positions, no margin |
| U3 | pupil-referenced annulus cuts the contact-lens term from +0.16 to +0.02 | **[E]** | stacked physical attack reaches 0.36 > `t` — durable sybils for $25 |
| U4 | binocular geometry over-determination catches confident wrong-boundary segmentation | **[E]** | U1's mitigation fails; U1 stands at 1e-3 |
| U5 | 28-day cadence holds Regime A (`μ=0.05, σ=0.021`) over decades | **[E]**, extrapolated from [M] short-lapse data | reproducibility floor rises to Regime B/C; band empties |
| U6 | `ε_B ≈ 0.005` for the majority-hardened 24-bit bucket | **[E]** | duplicate test misses; radius-2 ball must widen; enrolment cost rises |
| U7 | population non-uniformity charge of 8 % | **[E]** | residual min-entropy falls below 128 |
| U8 | ~1e5/yr residual lockout | **[E]**, built on medical incidence [M] and cadence-lapse [E] | the irreducible residue in §6.4 moves |
| U9 | the append-only log persists 1,000 years | **structural, not measurable** | the one dependency that is honestly an institution |
