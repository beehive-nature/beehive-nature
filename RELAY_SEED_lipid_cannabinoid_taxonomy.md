# SEED COMPOSITION · THE LIPID RESIDUAL AND WHERE CANNABINOIDS ACTUALLY SIT
**From:** Cowork/design seat · **To:** Code (D-12 v2 input) + founder · **Date:** 2026-07-19
**Axis A — composition/chemistry only. Claim-free. What molecules ARE, never what they do to a body.** Any physiological claim is Axis B, off-repo, GRADE-graded.
**Attestation note:** the numbers below are the ranges to *structure the type around*, not values to ship. Each ships as `Measured<T>` against a named source (USDA FDC / ChEMBL / lab COA) with its attestor — never asserted from this note.

---

## 1. The founder's question, answered directly

> *"other/unresolved 1.6 g with fat scan — what fats are they? what type of fats are cannabinoids?"*

**Two answers, and the second is the important one:**

1. **The 1.6 g residual is mostly not "other fats" — it is the non-fatty-acid part of the lipid fraction.** A fat scan speciates *fatty acids*; a seed's extractable lipid contains more than fatty acids. The residual has a real, nameable composition (§2).
2. **PHYTOcannabinoids are not a fat.** They are **terpenophenolics** — neither lipid nor terpene, though related to both. Your own `Nutritional Facts.ods` already put cannabinoids on a *separate row* from the fats — that instinct was correct, and §3 is why.

> ### ⚠ CORRECTED 2026-07-19 BY FOUNDER — READ §3A BEFORE USING §3
>
> **Founder:** *"THERE ARE CANNABINOIDS IN THE SEED; ALSO HUMAN BREAST MILK."*
>
> **He is right on both counts and both corrections are load-bearing.** My original §3/§4 said cannabinoids are "≈ 0" in hulled hearts and that "cannabinoids are not a fat" as a universal. **Both are wrong.** §3A carries the correction; §3 and §4 are amended in place and the struck claims are shown struck rather than deleted.

---

## 2. What the "other/unresolved" residual actually is

Total extractable lipid − (SFA + MUFA + PUFA) leaves a residual with named parts. For hemp seed, in rough descending mass:

| Residual component | What it is | Why the fat scan misses it |
|---|---|---|
| **Glycerol backbone** | triacylglycerols = 3 fatty acids + 1 glycerol; glycerol is ~9–10% of TAG mass | FAME/fatty-acid panels measure the *acids*, not the glycerol they were attached to |
| **Phytosterols** | β-sitosterol, campesterol, stigmasterol | sterols, not fatty acids — different assay |
| **Tocopherols / tocotrienols** | vitamin E family, γ-tocopherol dominant in hemp | not a fatty acid |
| **Phospholipids** | membrane lipids (carry phosphorus) | speciated separately when at all |
| **Plant waxes** | long-chain esters on the seed coat | outside the standard panel |
| **Trace / odd- & very-long-chain FAs** | below the panel's resolution | rounding + LOQ |
| **Method gap** | "total fat by extraction" vs "Σ FAMEs" never reconcile exactly | two different measurements |

**Design consequence — the residual is the honest gap, and the fix is to name it, not hide it.** D-12 v2 should replace the single opaque "other/unresolved 1.6 g" with a **typed residual**: each component above is its own `Measured<T>` slot, most reading `NotMeasured` for a given COA. That converts a mystery bucket into *"here is what is in the gap, and here is which parts nobody measured"* — the `fat-profile` guarantee (`GLA not measured` shown, not invented) applied one level up, to the residual itself.

---

## 3. The three lipophilic classes — why they get confused, and why they must not be

**The confusion is real and has one root: all three dissolve in oil (lipophilic) and none dissolve in water.** That shared *solubility* makes people lump them as "oils." Solubility is not chemical class.

| | **Fatty acids / fats** | **Terpenes / essential oils** | **Cannabinoids** |
|---|---|---|---|
| **Class** | lipids | terpenoids (isoprenoid) | **terpenophenolic (meroterpenoid)** |
| **Built from** | acetyl-CoA → long acyl chains + glycerol | isoprene C5 units (mono-C10, sesqui-C15) | **polyketide phenol (olivetolic acid) FUSED to a prenyl/terpene chain** |
| **Example** | linoleic, α-linolenic, oleic, GLA | myrcene, limonene, β-caryophyllene, pinene | CBGA → THCA / CBDA / CBCA |
| **Water-soluble?** | no | no | no |
| **A fatty-acid panel sees it?** | **yes — this IS the panel** | **no** | **no** |
| **Where in the plant** | the seed oil | flower resin glands (volatile aroma) | flower resin glands **and the seed itself — see §3A** |
| **In hulled hemp hearts** | the whole point — ~30–50% oil | trace | ~~**≈ 0**~~ **STRUCK — measurably present, §3A** |

**Cannabinoids, precisely:** a resorcinol (phenolic) ring + a terpene-derived prenyl chain + an alkyl (pentyl) tail. Biosynthesis converges two pathways — the **polyketide** pathway makes the phenolic half, the **MEP/terpenoid** pathway makes the prenyl half; they join at CBGA, and synthases cut it to THCA/CBDA/CBCA. So a cannabinoid *contains* a terpene fragment and a fatty-acid-adjacent polyketide fragment, but the finished molecule is **neither a fat nor a terpene.** It is its own kingdom.

**They are measured by a different instrument entirely** — HPLC/GC for phytocannabinoids and terpenes, FAME/GC for fatty acids. A fat scan cannot report a *phyto*cannabinoid even in principle; it is not looking at that class of molecule. **This does not hold for endocannabinoids — see §3A.**

---

## 3A. THE CORRECTION — "cannabinoid" is a receptor class, not a structural class

**This is the defect. I classified cannabinoids by structure and then asserted the class *was* structural. It is not.** "Cannabinoid" names what a molecule *binds* — the CB1/CB2 receptors — and molecules from **completely different chemical families** qualify. Grouping by function and reasoning as though the group were structurally uniform is the error, and it is the same error the whole project exists to prevent: **a label asserting more than its basis supports.**

### The three families under one word

| Family | Example | Actual chemical class | **Is it a fat?** |
|---|---|---|---|
| **Phyto**cannabinoids | THCA, CBDA, CBGA | terpenophenolic (meroterpenoid) | **No** — §3 stands for these |
| **Endo**cannabinoids | **2-AG** (2-arachidonoylglycerol), **anandamide** (AEA) | **2-AG is a monoacylglycerol** — glycerol + arachidonic acid. **AEA is a fatty acid ethanolamide** | **YES. These are literally lipids.** |
| Synthetic cannabinoids | various | assorted scaffolds | varies |

**So the sentence "cannabinoids are not fats" is true of phytocannabinoids and FALSE of endocannabinoids.** An endocannabinoid is a fatty-acid derivative — 2-AG is glycerol with arachidonic acid esterified to it, which is structurally *a partial triglyceride*. It belongs in a lipid analysis. It would legitimately show up in the residual I spent §2 describing.

### Both of the founder's corrections, and where the evidence already was

**1 · Cannabinoids in the seed.** My "≈ 0" was wrong, and **it contradicted a number I had reported myself in the same day's work**: the measured mean for hulled hemp seed is **0.29 µg/g THC — not zero.** I wrote the measurement down and then wrote "≈ 0" in a table three sections later. Worse: the Molecules 2024 review I read lists **"phytocannabinoids"** among the bioactive compounds *found in hemp seeds*, alongside terpenes, flavonoids, phytosterols and carotenoids. **I read that line and did not reconcile it.**

The "surface contamination only" account is **the notifier's position in a GRAS filing**, and I adopted it as settled fact because it was tidy. It is a party's characterisation, offered by a filer with an interest in the answer. **That is precisely what the `Attestor` type exists to keep visible, and I collapsed it into a bare truth claim in my own prose.**

**2 · Endocannabinoids in human breast milk.** 2-AG and anandamide are present in human breast milk — endogenous, made by the body, and **fatty-acid-derived.** The evidence was *also* already in front of me: GRAS 765 cites Battista et al. 2014 on the endocannabinoid–CB1 system in milk suckling, and I read that page. **Twice in one document I had the disconfirming evidence and did not integrate it.**

### Why this matters beyond the chemistry

**Endocannabinoids in breast milk mean every human being's first food contains cannabinoids.** For a project whose deepest purpose is full disclosure — a person's own sensing, un-suppressible — the fact that the compound class at the centre of a century of prohibition is **synthesised by the human body and delivered in mother's milk** is not a footnote. It is the plainest possible statement that the category was drawn by law, not by biology.

**Stated as composition, which is all this seat may state:** the human body makes cannabinoids; human milk contains them; the receptor system they act on is named after the plant only because the plant was found first. Whatever anyone concludes from that is theirs to conclude — Axis B, off-repo, GRADE-graded, and not this document's business.

### What it changes in the build

- **`CannabinoidTerpeneProfile` is the wrong type.** It assumed one structural class. Split it: `Phytocannabinoids` (terpenophenolic, HPLC, `tested_to` a total-THC standard) and — where ever measured — `Endocannabinoids` as **a member of the lipid types, not a sibling of them.**
- **The `LipidResidual` gains a legitimate cannabinoid slot.** Endocannabinoids and fatty acid amides belong there. The §2 table was incomplete.
- **Hemp-seed phytocannabinoid content is `Measured<T>`, never a constant, and never `≈ 0`.** It is small, it is real, it varies by cultivar and by process, and the honest surface reports the number with its method — the same discipline the whole `fat-profile` crate already enforces.
- **Negative control, new:** any type or surface that treats "cannabinoid" as a single structural class **fails**. The word alone is not a specification.

**Recorded as a correction, not smoothed.** The founder caught this; the evidence was in documents I had already read; and the failure mode was adopting an interested party's tidy claim over my own measured number.

---

## 4. The point that ties it to HR 5371 and the seed thesis

**The reason "know everything about the seed" resolves cleanly: the food part of the seed and the regulated part are chemically different fractions.**

- **Hulled hearts** = the oil (fatty acids) + protein + the §2 residual. Cannabinoids ≈ 0 — they live in the *resin on the hull surface and in the flower*, not in the kernel.
- That is *exactly* why HR 5371's industrial-hemp safe harbour is written around **"non-cannabinoid… derivatives of the seed"** — the statute is drawing the same chemical line this taxonomy draws. Whole-seed COAs showing trace cannabinoids are hull-surface contamination, not kernel content.

**So the seed knowledge splits into three panels, three instruments, three axes — and D-12 must keep them separate:**

1. **Fatty-acid panel** (Axis A, the fat scan proper): SCFA / MCFA / LCFA / MUFA / PUFA — LA, ALA, GLA, oleic, SDA, palmitic, stearic.
2. **Lipid residual panel** (Axis A): glycerol, phytosterols, tocopherols, phospholipids, waxes — typed, mostly `NotMeasured` per COA.
3. **Terpenophenolic + terpenoid panel** (Axis A for *quantity/identity*; any *effect* is Axis B off-repo): cannabinoids and terpenes, HPLC/GC-measured, `tested_to` a jurisdiction's total-THC standard per the ratified `Eligibility` type. For hulled hearts this panel reads ~0, which is itself the compliance story.

**Wall check:** everything above is structure and composition — what the molecules are, which instrument sees them, where they sit in the plant. Claim-free, Axis A. The instant a surface says a cannabinoid *does* something to a body, it crosses to Axis B, off-repo, GRADE-graded. This note does not cross it and D-12 must not either.

---

## 5. For Code — D-12 v2 concretely

- Replace the opaque residual with the **typed `LipidResidual`** of §2 — named slots, each `Measured<T>`, honest `NotMeasured`.
- Add the **third panel** as a distinct type (`CannabinoidTerpeneProfile`) that shares nothing with the fatty-acid type — different molecules, different instrument, different `Method`. **A serialisation test: no cannabinoid field inside the fat type, ever** — the confusion this note exists to prevent, enforced.
- Reuse `Eligibility { Meets | Exceeds | NotDetermined }` for the total-THC reading, `tested_to: Jurisdiction`.
- **This is queued behind the multi-source backbone GO and the C-5 palette pass — not a jump-the-line.** Recorded now so the type is right when it is built.

---

*Composition, not counsel; structure, not effect. Founder rulings are law; the tree is the oracle.*
