# Multi-channel coherence and longitudinal accumulation — ruling

<!-- 7 agents: 4 measurement (PTT coherence, joint PAD, accumulation math,
     species+normalization), 2 adversarial, 1 synthesis. 2026-08-04.
     [M] measured/cited  [D] derived  [E] estimate.
     VERDICT: coherence half holds and is worth building; the
     'ever-increasing with age' half saturates and must be rewritten. -->

# Ruling — multi-channel coherence and longitudinal accumulation

Labels used throughout: **[M]** measured/cited, **[D]** derived arithmetic from cited inputs, **[E]** estimate, mark of uncertainty explicit.

---

## 1. Does the thesis hold

**Partly — the coherence half holds and is worth building; the accumulation half does not hold as stated and must be rewritten before it is built.**

The number that decides it: **the separability of a genuine joint capture is AUC ≈ 1 − 10⁻¹³ (d′ ≈ 10, 60 s) against an *assembled* pair, and AUC ≈ 0.5 (d′ ≈ 0) against a *single-source coordinated synthesis*.** [D] Both are true of the same statistic. The entire security value of the founder's coherence design is the gap between those two numbers, and that gap is not purchased by biometrics — it is purchased by hardware attestation of the capture seam. With attestation, the cheapest joint spoof is **$150k–500k / 3–9 months** for the full four-channel PAI, or **$15k–50k / 4–8 weeks** for the reduced two-artifact pulse rig [E, costed build]. Without attestation it is **~$3,000 and a few days**. That is a **50–170× swing on one architectural decision** and ~0× on any sensor upgrade.

The second deciding number: **LLR_∞ = llr₁ / ρ**, and accumulation reaches ~95% of its asymptote at **N ≈ 3/ρ sessions**. At a charitable ρ = 0.1 that is **30 sessions ≈ 2.3 years**, with credited N_eff capped at 10. "Ever increasing" is not buildable. Independently corroborated by the aged-account market, which prices history at a **~6× premium earned almost entirely in the first 90 days** (Gmail 6.0× for 12 years; LinkedIn 6.7× for 90 days) [M] — the market discovered the saturation before we did.

The third: **against a rented or coerced live human, every measurement in this basket returns exactly 0 bits, forever, by construction.** Measured floor for that attack: **US$310–2,200 one-off** (Singapore Anti-Scam Command, May 2025 — 49 arrests, Singpass + wallet control surrendered for S$400–3,000, >6,000 KYC records, S$148k seized) [M]. No sensor and no amount of history moves this.

What survives the ruling, and it is real: **joint coherence does not stop farming, but it stops *resale*.** A buyer operating a farmed account fails the continuity check at ~10⁻⁷ [D], so a farm must sell the human, not the credential. That converts a $3 data market into a $310–2,200 labour market — a **100–700× price-floor lift** into conduct existing trafficking and mule statutes already reach. That is the prize. It is destroyed by any account-recovery path that works without the original body.

---

## 2. Coherence, quantified

**Statistic:** Pearson r between face-rPPG and contact-PPG inter-beat-interval series after removing one constant ΔPTT offset, Fisher-z transformed.

**Inputs [M]:** latent IBI SD s = 52 ms (SDNN, n = 2,143, ages 10–89); contact-PPG IBI noise σ_c ≈ 12 ms; face-rPPG IBI noise σ_r ≈ 25 ms (both consistent with the measured 16–20 ms PRV RMSE floor at 30 fps). Genuine-pair agreement empirically near-ceiling: rPPG↔contact PRV correlation **0.98–1.0**, Pearson r > 0.96 across three datasets [M].

ρ_H₁ = s²/√((s²+σ_c²)(s²+σ_r²)) = **0.878**, z₁ = 1.372 [D].

| H₀ | 30 s (N=30) | 60 s (N=60) | 90 s |
|---|---|---|---|
| **Assembled pair** (two independently sourced recordings) | d′ **7.14**, EER 1.8×10⁻⁴ | d′ **10.35**, EER 1.1×10⁻⁷ | d′ 12.7 |
| **Library selection**, 10⁹ pre-recorded face videos, r ≥ 0.80 | — | ~6×10⁻⁸ chance the library contains a passer; genuine FNMR 2.0% | — |
| **Single-source coordinated synthesis** (one controller, one live pulse, both renderers) | **d′ ≈ 0, AUC ≈ 0.5** | **d′ ≈ 0** | **d′ ≈ 0** |
| **Dual synchronised physical phantoms**, attested seam | ~2–4 bans [E] | — | — |

The third row is the adversarial finding and it is correct: coherence is a *self-consistency* test between two channels the attacker controls. One controller driving a face renderer (rPPG embedded per Li et al., *Video is All You Need*, Asia CCS 2022 — 3 ODEs, no contact with the victim) and a finger PPG stream lagged 100 ms from the *attacker's own live pulse* satisfies every constraint below simultaneously and for free.

**Equity cost [D]:** at Fitzpatrick V–VI (σ_r → 60 ms), ρ_H₁ = 0.638 and d′ at 60 s falls **10.35 → 5.70**. Restoring d′ = 10.35 needs **N ≈ 191 beats ≈ 3.2 min**. Mitigation: never a per-cohort threshold (that requires storing ethnicity — refuse). Use a **sequential probability ratio test on measured per-subject SNR**, terminating when z crosses a fixed bound. Self-calibrating, no demographic label, converts an accuracy disparity into a disclosable ~3× **duration** disparity.

### Every coupling an assembler must reproduce

Ordered by whether a *coordinated* attacker also gets it free (F) or not (X).

| # | Coupling | Physical basis | Number | Free to coordinated attacker? |
|---|---|---|---|---|
| 1 | Beat-by-beat IBI trajectory | shared cardiac phase | ρ = 0.878; 285 ms cumulative phase wander over 30 beats | **F** |
| 2 | ΔPTT sign + magnitude window | vascular propagation, PEP cancels in the differential | 80–140 ms, SE 3.6 ms/60 beats; window is a **6% pass rate alone** | **F** |
| 3 | ΔPTT within-capture stability | same | genuine drifts a few ms; assembled drifts 285 ms | **F** |
| 4 | Three-way RSA | autonomic coupling | HRV modulated 0.15–0.4 Hz, phase-locked to BCG head micro-motion and to PPG baseline | **F** |
| 5 | Pupillary hippus ↔ cardiac | harmonic entrainment | hippus 0.04–2 Hz (modal 0.3–0.5), coherent with PPG in 0.8–3 Hz | **X** (needs a pupil actuator phase-locked to a blood pump) |
| 6 | Bilateral consensual PLR | iris sphincter neurology | 200–250 ms latency, SD ~20 ms within-subject, *both* eyes from one stimulus | **X** |
| 7 | 850/950 nm spectral ratio at finger | haemoglobin NIR absorbance vs. flat gelatin/carbon-black | **cheapest, highest-yield vein liveness test; one extra LED** | **X** |
| 8 | Tapetal absence | retinal anatomy | orders-of-magnitude retroreflectance difference under coaxial flash | **X** |
| 9 | Mayer wave (~0.1 Hz vasomotor) common to both sites | sympathetic outflow | shared low-frequency envelope | **F** |
| 10 | **Rolling-shutter per-row phase structure** | progressive readout, ~10–25 µs/row | shifts "of the same order of magnitude as physiologically caused phase shifts" [M] | **X — and this is the one an assembler would not think of** |
| 11 | **IMU ↔ PPG motion artefact ↔ facial BCG** | one body, one accelerometer | three-way correlation of the same micro-motion | **X** |
| 12 | **Torch-induced perfusion creep** | 0.5–1 W LED warms the finger; perfused tissue DC baseline rises over 30–60 s, a phantom's does not | slow, monotonic, hard to script | **X** |
| 13 | **SE-issued post-capture optical challenge** | randomised torch/exposure code whose effect must appear jointly in rPPG and contact-PPG *in that session* | not pre-renderable | **X — load-bearing** |

**Engineering ruling:** #1–4 and #9 are free to any coordinated attacker and must not be counted as security. #5–8 and #10–13 are the real ones. **Specify AND-gating explicitly** — the multimodal literature (Rodrigues, Akhtar) shows score-level fusion lets one forged high-confidence channel outvote the others, making the basket *weaker* than a single well-defended channel [M]. Under AND-gating with #13 present, coherence inherits the attested-seam cost floor instead of costing $3k.

---

## 3. The accumulation formula

**LLR_N = llr₁ · N_eff, N_eff = N / (1 + (N−1)ρ) → 1/ρ. Hence LLR_∞ = llr₁ / ρ.** Units: bans (log₁₀ LR).

### Defensible per-session llr₁ for this basket

Factorise **LR = LR_match × LR_live × LR_bind**, then apply the adversary-mixture cap **llr ≤ log₁₀(1/π_top)**.

| Adversary class | llr₁ (bans) | Basis |
|---|---|---|
| Photo / video replay / library selection | 10–12 | coherence + PAD, d′ 10 @60 s [D] |
| Coordinated synthesis, **seam not attested** | **0.5–1.0** | injection bypasses all four channels at once; synthetic-iris APCER 0.044% → 39.18% [M] |
| Coordinated synthesis, attested seam + challenge #13 | **4.0–4.5** | iris pair 7.0 + face 5.0 + finger 3–4 naive ⇒ 16, minus 3–5 for shared capture-quality latent (cross-modality score r ≈ 0.3–0.5), then mixture-capped [D] |
| Dual physical phantom rig, attested | 3.0–4.0 | $15–50k build [E] |
| Witnessed in-person circle | **6.0–6.5** | witness set removes the injection class outright; +1.5–2.0 over remote [D] |
| **Rented / coerced live human** | **0.0, exactly** | genuine coherent body ⇒ L = 1 [analytic] |

Use **llr₁ = 4.5** for remote attested sessions, **6.0** for circle sessions.

### The independence assumption and what violating it costs

ρ is the intraclass correlation of per-session log-evidence, driven by persistent attacker capability and by shared context: same device, same secure element, same enrolment anchor, same circle, same operator.

| ρ | N_eff ceiling | LLR_∞ @ llr₁=4.5 | Time to saturation |
|---|---|---|---|
| 0.01 | 100 | 450 bans | 23 yr (unphysical) |
| **0.10** | **10** | **45 bans** | **30 sessions ≈ 2.3 yr** |
| 0.30 | 3.3 | 15 bans | 10 sessions ≈ 9 mo |
| 0.50 | 2.0 | 9 bans | 6 sessions ≈ 5 mo |
| 1.00 (coerced/complicit) | 1.0 | 4.5 bans | never accumulates |

**The gap between ρ = 0.1 and ρ = 0.5 is 36 bans — larger than any sensor upgrade can deliver.** Engineering effort belongs on ρ, not on sensors. Levers with estimated effect [E]: randomised active challenge HMAC'd to a fresh SE nonce (0.60→0.35); enforced environment variation vs. last k sessions (0.35→0.25); random 3-of-5 channel subset chosen by nonce (0.25→0.18); rotating matcher version across years, exploiting 20–60% cross-architecture transferability (0.18→0.12); device rotation + per-session hardware attestation (largest single term). **Achievable ρ ≈ 0.10–0.15.**

**ρ is currently a guess and it is the highest-value open measurement in the design** (see §8).

### Net against template aging

Aging rates [M]: iris **+0.0077 genuine HD/yr** (NIST IREX VI finds the effect small relative to operating thresholds, mostly dilation/lens artefacts); fingerprint stable to 12 yr @ FMR 10⁻⁴ (Yoon & Jain, PNAS 2015); face FNMR roughly doubles per 5–6 yr; finger vein τ ≈ 20 yr with high seasonal capture variance; **PPG identity τ ≈ 0.5 yr — cross-day EER up to 23.2%.** Composite loss for an iris+vein-anchored basket: **≈0.2 bans/yr** [E]. ΔPTT drifts **−1.4 ms/yr** [D from cfPWV 6.2 → 10.9 m/s across age bands].

Model: LLR(t) = 4.5 · N_eff(13t) − 0.2t, ρ = 0.1.

| Elapsed | Sessions | N_eff | Gross LLR | Aging loss | **Net** |
|---|---|---|---|---|---|
| 1 yr | 13 | 5.9 | 26.6 | −0.2 | **26.4 bans** |
| 5 yr | 65 | 8.8 | 39.5 | −1.0 | **38.5 bans** |
| 20 yr | 261 | 9.7 | 43.5 | −4.0 | **39.5 bans** |

**Net evidence peaks around year 10 at ≈40 bans and is flat-to-declining thereafter. Year 5 → year 20 buys +1.0 ban gross, ≈0 net.** [D, model — the aging coefficient is the weakest input.]

Two aging traps, both with fixes:

- **Enrolment-anchored ΔPTT gate dies at ~20 years** (−28 ms drift vs. a ±25 ms window, and 1.04× the 27 ms between-person SD). Fix: gate against enrolment **plus a published, non-adaptive −1.4 ms/yr allowance**, residual tolerance ±20 ms.
- **Never let the account's own history widen its own envelope.** With an EMA template at α = 0.1/session, an attacker in control migrates 50% in **6.6 sessions = 6.4 months**, 90% in 20 months, at a per-step increment of 3.9 ms — *below the 10 ms cross-session noise floor, invisible by construction*. With the fixed published drift model, traversing one between-person SD takes **19 years instead of 6.4 months: a 35× attack-cost increase from a config change.**

### The bound the formula cannot escape

Because the rented-human tier has non-zero mass and llr = 0, **P(genuine | k attestations) ≤ 1 − q_enrol for all k.** The accumulator converges to the enrolment prior and can never exceed it. Therefore: **split the ledger.** Three accumulators — *liveness* (biometrics may write), *uniqueness/sybil* (biometrics **must not** write; their power is 0), *conduct*. Enforce the bound in code and publish q_enrol.

---

## 4. Security-scales-with-stake

The founder's instinct — value at risk should demand more evidence — is right, but the function is not `evidence(age)`. Evidence saturates; cost does not.

**Attacker participates iff expected gain exceeds cost:**

> **V_irrev(cycle) ≤ (C_acq + B + E[penalty]) / (10^m · P_undetected)**

where
- **V_irrev(cycle)** = value that becomes *irreversible* within one 28-day cycle (not account balance),
- **C_acq** = cheapest identity acquisition = **$310** [M, measured mule-market floor], not $150k — the minimum over attack tiers governs,
- **B** = slashable bond posted from enrolment,
- **m** = deterrence margin, take m = 1 ban,
- **P_undetected** = 10^(−LLR_cycle,sybil), and **the biometric contribution to LLR_sybil is 0**, so this term is set entirely by non-biometric per-cycle tests.

Three consequences, all actionable:

1. **An unbonded account can never safely carry more than ~$31 of per-cycle irreversible outflow.** Everything above that is bought with bond, not with history. Privilege = f(attestations **and** staked-slashable value), never attestations alone. Set **B ≥ 3× the marginal privilege granted by age**; pre-farm economics then go from "$260 buys a 5-year account worth ≫$260" to strictly loss-making at any discount rate ≤ 30%.
2. **Make the 28-day circle a settlement-finality clock, not just a ritual.** Value becomes irreversible only after one in-person circle re-attests the enrolled body. This is the only mechanism that turns the cadence into economics rather than evidence, and it is what caps V_irrev without capping balances.
3. **P_undetected must be driven by a test with power against the *farm* hypothesis.** Attendance alone yields LLR = k·ln(1/(1−h)); at h = 1%/cycle, 5 years = **0.94 bits** [D] — worthless. **Randomised cross-circle attestation** (the holder must appear at a circle drawn from outside their lineage) raises h to 10–20% [E] because a farm's humans cannot be in many places. At h = 15%, 5 years = **≈15 bits** — a 16× improvement, and the only construction under which the longitudinal thesis becomes true. Note honestly: this is a **locality** test, powered by geography, not biology.

**Pre-farm economics, measured [M/D]:** click-farm labour $2–10/day; a 1-hour circle appearance ≈ $4 at floor rates, ≈$25 fully loaded. A 5-year pre-farmed account costs **$260 (floor) to $1,089 (NPV @15%)**. Any privilege curve that grants more than that in value is a direct subsidy to the farm. **Sequence the bond before the age-privilege curve** — accounts enrolled before bonding is live are free options a farmer can never be charged for.

---

## 5. The new-account problem

**Risk is bimodal in account age, not monotone.** Two peaks, one trough.

| Cohort | Exposure | Driver |
|---|---|---|
| **Peak A — new × accelerator-granted privilege** | A document accelerator buys day-1 privilege worth ~12 months of attestation for **$50–1,500** (stolen/synthetic scan) to **$500–3,000** (physical forgery) [M market ranges]. That is within ~3× of the $260–1,089 farm route — the two paths are accidentally priced the same and neither was priced deliberately. | privilege decoupled from attestation count |
| **Trough — the boring 2-year account** | lowest risk | saturated N_eff, no accumulated liquidity, no drift headroom |
| **Peak B — old × high liquidity × drift-walked template** | 6.4-month template migration below the noise floor; account-adaptive envelopes widen with history (**~1.5–1.8 dB security loss with age — wrong sign**) | adaptive template + adaptive envelope |

A design that hardens by age hardens the trough and leaves both peaks exposed.

**Fixes:**

- **Accelerators grant velocity, never ceiling.** A document may shorten time-to-privilege but must never exceed the bond/attestation ceiling, and the grant must be **retroactively revocable with clawback on document revocation** — which discounts its farm value by P(doc later found forged), high for stolen or synthetic documents.
- **Bound q_enrol with a graph constraint, because no biometric can.** Require the k attesting circle members to have **non-overlapping attestation lineage — no common ancestor within d generations.** Publish d and k. Treat q_enrol as a first-class, monitored, disclosed system parameter. This is the only lever on the term that bounds the entire posterior.
- **Fixed physiological drift model, never an account-adaptive envelope** (kills Peak B; see §3).
- **Every account-recovery path must require the original body.** Social recovery, custodian reset, and admin override each restore transferability and collapse the resale floor from the rented-human rate ($310–2,200) back to the aged-Gmail rate ($3). One escape hatch destroys the single most valuable property in the design.

---

## 6. Species and edge humans

Rejecting an unusual human is the failure that matters most, and the naive versions of every liveness test in §2 reject one.

**The dog — comfortably solved, and mostly for free.**

| Test | Human | Dog | Note |
|---|---|---|---|
| Tapetum lucidum under coaxial flash | absent (dim choroidal red) | present, orders-of-magnitude brighter eyeshine | **single flash frame, one LED, effectively zero overlap** [M] |
| Heart rate | 60–100 resting | medium/large breeds **60–100** | **HR is not a discriminator** |
| CV_RR = SDNN/mean RR | **3–8%** | **20–40%** (SDNN ≈ 268 ± 75 ms vs human 30–70 ms) | d′ ≈ 3–5, per-capture error 10⁻²–10⁻³ [D] |
| Respiration | HF band 0.15–0.4 Hz | panting 3.3–6.7 Hz | free at 30 fps |
| Pupil shape | round | **round** — shape catches cats and goats, not dogs | eyeshine is the discriminator |
| rPPG acquisition | works | **no exposed perfused skin through hair** | the attack fails at signal acquisition, before any classifier |

Human-vs-non-human LR on this basket exceeds 8 bans. **Build the explicit ocular classifier anyway** — a species reject that emerges as a byproduct of an identity model has a different adversarial failure mode from a designed one. Keep the head small, auditable, conservatively thresholded. Run it at enrolment and on anomalous/remote paths, **not on every 28-day re-attestation.**

**The edge humans — where the design actually breaks.**

| Case | Signature | Which gate misfires | Handling |
|---|---|---|---|
| **Pacemaker (VVI/fixed-rate)** | CV_RR ≈ 0, near-perfectly periodic PPG | **Identical to a synthetic-pulse spoof.** Any HRV-magnitude liveness test rejects paced patients outright. Hardest collision in the design. | (i) Never use low HRV as a sole spoof signal — require PTT and spatial-coherence failure too. (ii) Medical-device flag set **only at the in-person circle**, never self-serve, swapping to an HRV-independent policy (PLR + spatial rPPG coherence + vein + spectral ratio). |
| **AF / arrhythmia** (~2–4% of adults, ~10% over 80) [M] | irregularly irregular, CV_RR can exceed 20–30% — dog territory | variance-magnitude species test | Dog variability is **respiratory-phase-locked**; AF variability is **aperiodic with no respiratory peak**. Test RR↔respiration *coherence*, not variance. Same fix covers high-RSA athletes. |
| **Infant** | HR 80–160, HRV **low** (immature vagal tone) | overlaps feline HR band | Infant = high HR + *low* CV_RR; dog = human HR + *very high* CV_RR — **orthogonal in (HR, CV_RR); use a 2-D region, never a threshold.** Separately, iris texture is not stable below ~2 yr and pediatric permanence evidence starts at age 4 [M, 9-yr study, 276 subjects enrolled 4–12] ⇒ **no biometric enrolment under ~4**; guardian attestation + age-triggered re-baseline. |
| **Beta blockers** | HR down; RMSSD, pNN50, HF and LF power all **up** | drifts the user toward the canine end of the variance axis | same respiratory-coherence test; re-baseline on drug initiation |
| **Fitzpatrick V–VI** | rPPG amplitude ~10× lower (FP I 42–48 vs FP IV 0–4 a.u.); HR MAE 5.2 → 14.1 bpm [M] | SNR-driven rejection becomes demographic exclusion | adaptive-duration SPRT (§2). ~3× longer capture, disclosed. |
| **Aphakia, iridectomy, pharmacological mydriasis** | PLR absent or abnormal | gates #5, #6 | declared at circle; substitute #7, #10, #12 |
| **Amputation, severe tremor, Parkinson** | no finger channel / motion floor exceeded | contact-PPG and the motion gate | declared at circle; substitute contralateral site or drop to 3-of-5 |

**Structural rule:** run the general population at **4-of-5 gates, not 5-of-5.** At per-gate genuine failure 2%, all-5 AND gives FRR **9.6%**; 4-of-5 gives **0.39%** — a **25× reduction** — at a cost of APCER 3.1×10⁻⁷ → 3.0×10⁻⁵ (~96×) [D]. That trade is worth taking because the residual is still four orders below the rented-human floor that actually governs.

But note the nuance that matters: an edge human does not fail a *random* gate — they fail a *specific, predictable* gate every time. So N-of-M alone is not sufficient. Pair it with **declared, circle-set substitution**, where the substituted gate is of equal or greater strength. The substitution must be settable only in person, or attackers will simply claim the exclusion.

**And say plainly what the equity residual is:** F3's tightened drift gate falls hardest on fast-stiffening individuals (hypertension, diabetes, CKD, smoking — 2–3× the cohort drift rate), who correlate with age and medical vulnerability. Stack the FP V–VI duration penalty on top and dark-skinned older users face the longest captures *and* the highest re-enrolment rate simultaneously. The mitigation converts an error-rate disparity into a duration-and-inconvenience disparity. That is honest, but it is still a cost, and it must be disclosed rather than engineered out of view.

---

## 7. What survives normalisation

The founder's "ID frequency/signature will resonate in a range/spectrum; with the proper resolution one HUman" — **as a claim about uniqueness this is false and must not be built on or marketed.** There is no resolution that recovers 1:N identity from a non-stationary state variable. Cross-session ΔPTT carries d′ ≈ 1.9, **FMR ≈ 40% at FNMR 5%** [D] — roughly 1–2 bits. Measured PPG biometrics: same-session EER 1.0% (controlled) to ~8% (real-world); **cross-day EER up to 23.2%**; one system 1.37% EER → 4.99% FRR after one week; ECG better but one study fell 98% → 40% at ~1,054 days mean gap [M]. **The cardiac channel does not carry stable identity over months.**

What *does* survive normalisation, ranked, concretely:

| Rank | Feature | Entropy / stability | Verdict |
|---|---|---|---|
| 1 | **Iris texture** | ~249 independent DoF (Daugman); drift **+0.0077 HD/yr**; IREX VI finds aging small vs. operating thresholds; pediatric permanence to 9 yr | **The only channel with decade-scale stability and real entropy. Criterion (b) rides here.** |
| 2 | **Finger / palm vein** | subdermal, unaffected by moisture/wrinkling; **longitudinal literature is thin — treat "stable for life" as an unverified vendor claim**; open-set unknown-PAI APCER **unmeasured — plan 1–5%** | second anchor for (b); also the strongest anti-remote-attack channel (no public conditioning signal exists, so identity-conditioned synthesis is information-theoretically unavailable) |
| 3 | **Beat-normalised PPG contour / SDPTG landmarks (a,b,c,d,e; b/a)** | correlates with age at **r ≈ 0.80**; rises with diabetes, hypertension, IHD | that correlation *is* the problem — it tracks vascular age, so it drifts fastest in people whose health is changing. **Coarse consistency check, not an identity anchor.** |
| 4 | **ΔPTT / relative PWV between two simultaneously captured sites** | between-person SD 27 ms; within-person cross-session SD ~10 ms; drift −1.4 ms/yr | **1–2 bits. A plausibility band, not a fingerprint.** Its value is anti-spoof geometry, not identity. |

Normalisation methods that make the above usable [M]: **POS** (Wang 2017, projection orthogonal to a skin-tone vector) over **CHROM** (de Haan 2013) — POS is the current default and relaxes CHROM's skin-tone assumption. Lock exposure/AWB/ISO for the capture window (AWB actively fights rPPG); learn a per-device colour-correction matrix at first enrolment; bind device ID to the attestation. Gate on motion and re-prompt rather than accept low SNR (CHROM: 92% agreement stationary, 79→98% modest motion, 11→48% vigorous). **Never use absolute PPG amplitude** — it varies with skin colour, nail, finger size, and cold-site vasoconstriction erases the dicrotic notch, i.e. destroys exactly the morphology you would want. Use timing and shape ratios only.

**Two mandatory corrections nobody would think to make:** (i) **rolling-shutter row timestamps** — progressive readout produces phase shifts "of the same order of magnitude as physiologically caused phase shifts"; any face-region PTT computed without per-row correction is measuring the sensor, not the subject. (ii) **Do not attempt intra-facial PTT** — Moco et al. (CVPR-W 2018, 21 subjects) found it not reliably recoverable; skin variability and ballistocardiographic head motion swamp the few-ms true delays. Face-to-finger ΔPTT at 80–140 ms is **20–50× larger** and sits well above that noise floor. That is the whole reason the two-site geometry works.

**So state it correctly in the design doc:** the resonating spectrum is **2–4 bits of vascular geometry and autonomic coupling structure** — a real, useful *plausibility and freshness* signal, and a genuine anti-spoof constraint. It is not an identifier and there is no resolution at which it becomes one. **The correct framing for the whole cardiac basket is proof-of-freshness, not proof-of-uniqueness** — which is precisely the property a weak-entropy channel *can* supply, and precisely why it belongs in the design.

One honest counterweight on the freshness claim: Speth et al. (WACV 2022, Notre Dame) drove **a strong periodic pulse onto a 3D-printed mask with visible-spectrum LEDs**, imperceptible to the eye, and defeated rPPG estimators digitally with imperceptible periodic noise [M]. "An attacker cannot produce a coherent live pulse" is empirically false for the single-channel case, and a patterned LED array could in principle fake a per-ROI phase profile, i.e. a fake PTT. The margin therefore comes from (i) the number of *independently randomised runtime* constraints, (ii) the **ocular** channel where tapetal absence and true retinal PLR are physically much harder to counterfeit than skin colour modulation, and (iii) simultaneity in an attacker-unchosen window.

---

## 8. Build order

### The cheapest experiment that falsifies the thesis if it is wrong

**E0 — Coordinated-synthesis red team. ~$3,000, 2 person-weeks, n = 1 attacker, zero new hardware. Run this before writing any other line of code.**

One operator, one live pulse source (their own), drives a face renderer built from public photos with an embedded rPPG waveform (3-ODE method) and a finger-PPG stream delayed by a fixed 100 ms, with a shared respiration oscillator driving RSA into both, injected through a virtual camera into both concurrent MultiCam streams on a rooted commodity phone.

- **Falsification criterion:** if the resulting r ≥ 0.80 at 60 s (prediction: **r > 0.95**, and the ΔPTT window, RSA, and phase-wander checks all pass), then coherence is confirmed to be **seam-dependent**, contributes ~0 bits without attestation, and **the entire build budget must go to attestation, not to sensors.**
- This experiment costs 0.1% of the sensor programme and determines where 100% of it should go. Nothing else should be funded until it has run.

**E0b — Measure ρ from existing attestation logs. ~$0, days.** Same-device / same-circle / same-template correlation of per-session log-evidence. This single scalar sets the entire shape of the age-privilege curve. Precision [D]: SE(ρ) ≈ 0.074 at n = 30 subjects × k = 5 sessions; ≈ 0.040 at n = 100 × k = 5. Either distinguishes ρ = 0.1 from ρ = 0.3 at >2.7σ, which is the decision that matters (credited ceiling 10 sessions vs 3.3; plateau at 9.3 months vs 3 months).

### Then, in order

| # | Experiment | Hardware | Subjects | Duration | Decides |
|---|---|---|---|---|---|
| **E1** | **Seam attestation feasibility** — can shipping silicon deliver sensor-signed frames with genuine per-row timestamps bound to the SE? | iPhone A12+ (`AVCaptureMultiCamSession`, hardware-cost budget ≤1.0, practical envelope 1080p30 both streams) and Android 11+ Camera2 concurrent-camera | n/a — 2 devices per platform | 3–4 weeks | **Load-bearing. If per-row timestamps are not attestable, the whole design changes.** This is the largest technical unknown in the programme: frame presentation timestamps are available, attested row-readout structure is not a documented primitive on either platform. Flag as **high uncertainty**. |
| **E2** | Genuine-pair coherence baseline + cross-session ρ per channel | same dual-camera rigs, rear torch, 850/950 nm LED pair added to the finger site | **n = 30 minimum, n = 100 preferred; k = 5 sessions at 28-day spacing** (impostor side is combinatorial: 435 pairs at n = 30) | 5 months (cadence-bound) | confirms ρ_H₁ = 0.878 and the d′ 7/10 figures on real hardware; yields ΔPTT cross-session SD directly |
| **E3** | Skin-tone stratified duration study + SPRT calibration | as E2, plus calibrated illuminance 30 / 100 / 300 lux | **n = 40, stratified Fitzpatrick I–VI, ≥6 per stratum** | 6 weeks | sets the adaptive-capture stopping rule; validates the predicted 3× duration disparity rather than assuming it |
| **E4** | Edge-human panel | as E2 | **n ≈ 60: 15 paced, 15 AF, 15 beta-blocked, 15 controls** (recruit via cardiology clinic; the paced arm is the hard one) | 8 weeks | proves the pacemaker/synthetic-pulse collision is resolved *before* anyone is rejected in production. Non-negotiable prerequisite to launch. |
| **E5** | Physical dual-artifact red team, attested pipeline | LED-modulated silicone face mask + pulsatile silicone finger phantom, one MCU driving both | n = 1 attacker, budget $15–50k | 4–8 weeks | measures the actual APCER floor under attestation; the $150k–500k full-basket figure is an estimate and should be treated as unvalidated until this runs |
| **E6** | Open-set finger-vein PAI competition (or a proxy with ≥3 unseen PAI species) | NIR transilluminator | ≥3 novel PAI species | 3 months | closes the acknowledged measurement gap. **There has been no LivDet-equivalent for finger vein; every published near-zero HTER is closed-set on VERA. Treat any vendor claim below 1% as unvalidated; plan 1–5%.** |

### Non-negotiable preconditions before any of E2–E6 is worth running

1. **Attest the sensor seam.** Digital injection is now **5× more common than presentation attacks**, with a **2,665% surge in native virtual-camera attacks** and one financial institution logging **8,065 AI-generated injection attempts in Jan–Aug 2025** [M]. Attested capture is the system root, not an implementation detail.
2. **AND-gate the channels, with declared N-of-M substitution for edge humans.** Score-level fusion makes the basket weaker than one good channel.
3. **Split the ledger** (§3): biometrics write to liveness, never to sybil.
4. **Ship the bond before the age-privilege curve** (§4), or the farm gets a head start it can never be charged for.

### The residual, stated so it is not claimed away

A rented or coerced human presenting genuinely passes everything in this document at 100%, forever, for a measured **US$310–2,200**. Mule networks grew 168% in H1 2025 (~2M accounts, $3.1T flows) [M]. No sensor, no coherence test, and no amount of history touches this. It is bounded only by the in-person cross-circle challenge, the bond, and the settlement-finality clock — social and economic instruments, not biometric ones. Budget for it explicitly, and never let the 40-ban figure obscure that it is a liveness number, not a sybil number.
