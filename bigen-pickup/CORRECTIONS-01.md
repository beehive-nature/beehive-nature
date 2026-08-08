# BIGEN CORRECTIONS 01 — ECS/telomerase evidence map

**ROUTING** · **Destination:** the BIGEN seat. Correspondence — **do not commit.**
**Delivery:** paste to the BIGEN session. Delete after the edits land.
**Founder read required:** no. Four verified edits; nothing here needs a ruling.

**Method:** every claim below was checked against source via PubMed, not against recollection.

---

## EDIT 1 — remove the AMPK attribution (factual error)

**Current text:** *"…increased hTERT mRNA (p<0.05) and preserved relative telomere length in normal human mesenchymal stem cells via an **AMPK→SIRT1/autophagy** pathway."*

**Source:** Chueaphromsri et al., *In Vivo* 2026;40(1):222–234, [DOI 10.21873/invivo.14186](https://doi.org/10.21873/invivo.14186), PMID 41482390.

**AMPK appears in none of:** the abstract, the author keywords (*Cannabidiol, SIRT1, autophagy, mesenchymal stem cells, stemness*), or the MeSH terms. SIRT1 and autophagy are correct. **AMPK looks imported from adjacent literature** — plausibly Vara 2011's CaMKKβ/AMPK finding or the MCFA/ketone arm.

**Replace with:** `via SIRT1 and autophagy`.

**Downstream:** the Caveats bullet reading *"attributes effects to AMPK/SIRT1 rather than CB1/CB2"* → `attributes effects to SIRT1/autophagy rather than CB1/CB2`. The Stage 1 receptor-dependency design is scoped around the AMPK claim and needs re-reading once the attribution is corrected.

---

## EDIT 2 — drop the CRUX from MIXED to UNTESTED

**Current tier:** `MIXED / largely UNTESTED, leaning weak`.

**Two facts from the source that justify the drop:**

1. **The paper is not a telomerase study.** Its title, keywords and framing are SIRT1/autophagy/stemness. Telomerase expression and relative telomere length are two endpoints among six.
2. **The authors' own result sentence is materially softer than our rendering.** They claim CBD *"supported telomere function"* — **not that hTERT rose significantly.** The `hTERT ↑, p<0.05, 0.08 µg/ml, n=3` figures may be in the full text; they are not verifiable from the abstract, and the authors did not summarise their work as a telomerase finding.

**Ruling: no study exists whose primary question is whether cannabinoids raise telomerase in normal cells. That is UNTESTED, not weakly-supported.**

**This is not a downgrade of a positive result — it is the absence of a study, which is the map's own point stated more exactly.**

**And state the real finding plainly, because the map undersells it:** in normal human stem cells CBD reduced SA-β-gal, delayed senescence, maintained proliferation, and preserved telomere length. **That is a genuine anti-senescence result in normal cells.** It is good. It is not evidence for a telomerase set-point. *The result is sound; the frame it was recruited into is wrong* — and that is the more useful sentence for a reviewer than either cheerleading or debunking.

---

## EDIT 3 — Hussein 2014 keeps SUPPORTED, gains a methods-quality flag

**Full text read.** Hussein et al., *Alexandria J Med* 2014;50(3):241–251, [DOI 10.1016/j.ajme.2014.02.003](https://doi.org/10.1016/j.ajme.2014.02.003). TERT is the primary endpoint — the citation is correct and the tier is earned.

**Hepatic TERT mRNA (copies), n=15/group:**

| Group | TERT mRNA | vs DMNA |
|---|---|---|
| Control | 1.22 ± 0.62 | — |
| DMNA | 116.13 ± 61.47 | **95× over control** |
| Cannabis before DMNA | 2.29 ± 1.52 | **−98.0%** |
| Cannabis with DMNA | 3.08 ± 4.25 | **−97.3%** |
| Cannabis after DMNA | 9.60 ± 7.0 | **−91.7%** |

All three arms statistically indistinguishable from healthy control (p = 1.000, 1.000, 0.952).

**Four flags to record — the first is a failure of our own stated standard:**

1. **mRNA, not enzymatic activity — and the map penalised Chueaphromsri for exactly this while giving Hussein a pass.** The paper concludes the extract "inhibits TERT mRNA expression level which leads to down regulation of telomerase activity." **No TRAP assay was run.** Apply the standard symmetrically. → `results_conclusions_gap: conclusion_overstates`
2. **ANOVA is the wrong test here.** Group IV is 3.08 ± 4.25 — SD exceeds mean. SDs span 0.62 to 61.47, ~100×. Normality and variance homogeneity are both violated. The direction survives any test; **the printed p-values do not.** Needs log-transform or Kruskal-Wallis.
3. **The apoptosis half of the mechanism does not hold.** Caspase-8 fell in every group vs control. Only the pre-treatment arm rose significantly vs DMNA (0.35 vs 0.11, p=0.031); concurrent (0.15) and post (0.12) did not differ from untreated cancer. The abstract's *"coordination between inhibition of telomerase activity and induction of apoptosis"* holds in **one of three arms.**
4. ~~**GC/MS was run and never reported.**~~ **RETRACTED 2026-07-21 — this flag was false.**

> **Type B self-correction (design seat).** I wrote that the composition was "absent from the paper." **It is stated four times** — §3.1 Chromatography Results and twice more in the Discussion: *"67.9% for D9THC and 32.1% for CBD. The phenotype ratio of cannabis extract = THC%/CBD% = 67.9%/32.1% > 1."*
>
> **How the error happened:** I read the methods and the results table, searched the PDF for `telomer|TERT`, never searched for composition, then asserted a universal negative. **Law 1 — a universal requires an exhibited witness, and I exhibited none.** Logged because the instrument must point inward first.

**Replaced by C-1 and C-2 (below), which are correct:**

- **Composition IS reported** — **67.9% Δ9-THC / 32.1% CBD of the cannabinoid fraction. ~2:1 THC-DOMINANT**, classified by the authors as the "drug phenotype" (THC%/CBD% > 1).
- **Absolute dose is NOT derivable.** The paper gives administered volume (0.5 mL/kg, oral, every other day, in corn oil) and relative cannabinoid percentages — **but no mg/kg THC mass.** Back-calculation requires the extraction yield of 100 g dry plant into 100 mL corn oil, which is never reported. **That is the real reproducibility gap**, and it is narrower and more precise than what I originally claimed.

**Extract classification, corrected:** not full or broad spectrum. The water boil is a **discarded wash**; the actual extraction is ethanol, then thermal fractionation at 180–220 °C with the hydrocarbon fraction deliberately trapped and thrown out (benzopyrene, benzene, toluene, naphthalene). **Classify as `thermally_fractionated_distillate`, ~2:1 THC-dominant (67.9/32.1), decarboxylated, probable partial CBN degradation at 220 °C.**

> ⚠ **Indirectness consequence — the important one.** ~2:1 THC-dominant is the **near-inverse** of Avidekel 30:1, LiBBY 50:1, and T2:C100. **Hussein does not sit near the dementia corpus on the gap map; it occupies a different quadrant.** Indirectness to those formulations is **HIGH**.

---

## EDIT 4 — add `evidence-maps/` as a sibling of `synthesis/`

**This corpus is in-vitro and mouse. Nothing in it is poolable.** Filing it under `synthesis/comparisons/*.yaml` would assert a poolability that does not exist — the same category error the map itself warns about.

```
bigen/
├── synthesis/comparisons/*.yaml     forest plots — RCTs only
└── evidence-maps/*.yaml         ← NEW · mechanistic corpora, tier table as output
```

**The tier-tagged claim table is the correct output artifact and the map already built it.** It has no home in the tree yet. Give it one.

**Also add** `integrity:` blocks per `bigen/integrity/SCHEMA.md` (shipping alongside this doc). Studies flagged in EDIT 3 are the first entries.

---

*Four edits. Two are corrections of our own output, and the AMPK error is the more important one to log — a library that only runs its instruments on other people's work has not implemented them.*
