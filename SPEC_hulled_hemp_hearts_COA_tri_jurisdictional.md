# ANALYTICAL SPECIFICATION & RFQ — COMPLETE COMPOSITION PANEL, HULLED HEMP SEED (HEMP HEARTS)
**Tri-jurisdictional · lot-level · method-cited**
**Issued by:** Beehive Nature Reserve · **Date:** 2026-07-19 · **Version:** 1.0
**Purpose:** commission the first complete, publicly-reproducible lot-level composition record for hulled hemp seed. **No such record was locatable in public sources at the time of issue.**

---

## 0. WHY THIS DOCUMENT EXISTS

A search of federal databases, primary literature and 91 supplied certificates found **no complete lot-level nutritional COA for hulled hemp seed from any jurisdiction.** What exists is: aggregated national database entries (USDA FDC 170148, flagged not-updated since 2018), scattered primary studies each covering a fraction of the analyte set, and cannabinoid-potency certificates that contain no nutrients at all.

**This specification defines what "complete" means and commissions it.**

---

## 1. SCOPE AND JURISDICTIONS

**Three jurisdictions, selected from actual US import data** (USDA AMS FVHEMP, HTS 1207990360, 2026 YTD) — these are the origins that actually supply the market, not arbitrary choices:

| # | Jurisdiction | Rationale | Share of US consumption-seed imports |
|---|---|---|---|
| 1 | **Canada (Manitoba)** | dominant supplier | **87% by weight** |
| 2 | **European Union** (Romania / Lithuania / Italy) | second cluster; independent regulatory regime | ~6% combined |
| 3 | **United States** (domestic) | domestic baseline; USDA descriptor alignment | n/a |

**Minimum sampling: 3 lots per jurisdiction = 9 lots. 3 analytical replicates per lot** (per USDA Hemp Descriptor Handbook triplicate discipline). Cultivar recorded per lot; same cultivar across jurisdictions where obtainable, otherwise cultivar difference is documented, not hidden.

---

## 2. THE ANALYTE SCHEDULE

### 2.1 Proximate

| Analyte | Method | Notes |
|---|---|---|
| Moisture | AOAC 925.10 / 934.01, or 105 °C × 20 h | USDA handbook protocol |
| **Crude protein** | **AOAC 991.20 (Kjeldahl) or 992.15 (combustion)** | **See §2.2 — critical** |
| Total fat | AOAC 920.39 (Soxhlet, hexane) | Handbook: 10 g ground to 0.5 mm, 100 mL hexane, 24 h, 70 °C |
| Ash | AOAC 923.03 | |
| Total dietary fibre | AOAC 991.43 or 2011.25 | soluble/insoluble split required |
| Carbohydrate | by difference | must be labelled as derived, not measured |

### 2.2 ⚠ THE NITROGEN-CONVERSION TRAP — mandatory reporting rule

**Protein is not measured. Nitrogen is measured and multiplied.** The conventional factor is **6.25**; a body of seed literature argues **5.30** for hemp. **The same seed reports ~15% different protein depending on an assumption the number does not carry.**

**REQUIRED: report raw N%, and BOTH conversions, explicitly labelled.**

```
Nitrogen           x.xx %
Protein (N × 6.25) xx.xx g/100 g
Protein (N × 5.30) xx.xx g/100 g
```

**A single protein figure with no stated factor is a non-conforming result.** This alone makes the record reconcilable against USDA, EU and Canadian entries that chose differently.

### 2.3 Fatty acids

**Method: ISO 12966-1:2014 / -2 / -4 (FAMEs by GC).**

Report individually, g/100 g and % of total FAME:
`C6:0 · C8:0 · C10:0 · C12:0` **(explicitly, to document MCT absence — do not omit as "not detected")** · `C14:0 · C16:0 · C18:0 · C18:1 n-9 · C18:2 n-6 (LA) · C18:3 n-6 (GLA) · C18:3 n-3 (ALA) · C18:4 n-3 (SDA) · C20:0 · C22:0 · C24:0`

**Also required:** sum SFA / MUFA / PUFA · **LA:ALA ratio** · **total FAME recovery as % of gravimetric total fat** — the difference is the unsaponifiable residual and must be stated, not absorbed silently.

### 2.4 Unsaponifiables — the residual, itemised

`Total unsaponifiable matter` (AOCS Ca 6a-40) · `phytosterols` (β-sitosterol, campesterol, stigmasterol; GC-FID) · `tocopherols α/β/γ/δ` (HPLC, AOAC 971.30 / EN 12822) · `chlorophyll a/b` (spectrophotometric) · `phospholipids` · `waxes`

**Rationale:** ISO 12966 measures fatty acids only. Everything above is inside the extracted fat and outside the FAME panel. **This section is what turns "other/unresolved" into a named list.**

### 2.5 Amino acids

**Method: AOAC 994.12 — with two mandatory separate hydrolyses:**

- **Tryptophan: alkaline hydrolysis** (destroyed by acid hydrolysis)
- **Cysteine + methionine: performic acid oxidation** prior to hydrolysis

**A standard acid hydrolysis alone under-reports Trp, Cys and Met. Results from a single acid hydrolysis are non-conforming.**

Report all 20, plus **lysine** flagged (first limiting AA in hemp) and **PDCAAS or DIAAS** where the lab is equipped.

### 2.6 Minerals and heavy metals

**Method: ICP-MS / ICP-OES (AOAC 2011.14 or 984.27), microwave digestion.**

Nutritional: `Ca · Fe · Mg · P · K · Zn · Cu · Mn · Se · Na · I · Cr · Mo`
**Contaminant: `Pb · Cd · As (total + inorganic) · Hg`** — mandatory every lot. *Cannabis sativa* is a documented phytoaccumulator; this is not optional.

### 2.7 Vitamins

`E (as tocopherols, §2.4)` · `B1 thiamin (AOAC 942.23)` · `B2 riboflavin (AOAC 970.65)` · `B3 niacin (AOAC 944.13)` · `B5` · `B6` · `B7 biotin` · `B9 folate (AOAC 2004.05, trienzyme)` · **`B12 (AOAC 2011.10)`** · `A (retinol + carotenoids)` · `C` · `D2/D3` · `K1`

**A, C, D, K and B12 are expected at or near zero. Measure and report them anyway** — the documented gap is the point, and an unmeasured gap is not a gap, it is an absence of information.

### 2.8 ⚠ ANTINUTRIENTS — the differentiator

| Analyte | Method | Why |
|---|---|---|
| **Phytate / phytic acid (IP6)** | **AOAC 986.11 or Megazyme K-PHYT** | **~4 g/100 g reported in primary literature. Binds Fe and Zn; humans lack phytase. This determines whether the mineral figures mean anything.** |
| **Trypsin inhibitor activity** | AOAC 22.7.03 | **directly tests GRAS 765's claim of "no protease inhibitors"** |
| Condensed tannins | vanillin-HCl | |
| Oxalate (total + soluble) | HPLC or enzymatic | |

**No published complete panel pairs full mineral content with phytate on the same lot. That pairing is the single most valuable output of this commission.**

### 2.9 ⚠ CANNABINOIDS — the LOQ specification is the whole point

**Method: HPLC/UPLC per USDA Hemp Descriptor Handbook V3.**

> **MANDATORY: LOQ ≤ 0.1 µg/g (0.00001%) for each analyte.**

**Rationale, stated plainly for the lab:** certificates on this material are commonly issued at **LOQ = 0.010% (100 µg/g)**, against a literature mean for hulled seed of **~0.29 µg/g**. Such an assay is blind by a factor of ~345 and its `<LOQ` result carries essentially no information. **A `<LOQ` result at an inadequate floor will be rejected as non-conforming.**

Report: `THCA · Δ9-THC · Δ8-THC · CBDA · CBD · CBGA · CBG · CBN · CBC · THCV · CBDV`
**Total THC = Δ9-THC + (0.877 × THCA)** — per USDA handbook and H.R. 5371.

**Contamination control, mandatory and auditable:** single-use sample vials (the handbook warns THC is "sticky" and carries over, inflating results); **method blanks between every sample**; **no decarboxylation prior to analysis** (introduces volatilisation error — compute total instead).

### 2.10 Contaminants & microbiology

Aflatoxins B1/B2/G1/G2 + ochratoxin A (AOAC 991.31 / HPLC-FLD) · multi-residue pesticide screen (QuEChERS, ≥200 analytes) · TPC · yeast & mould · *E. coli* · *Salmonella* · coliforms

### 2.11 SOIL PANEL — BNR extension, declared as such

**Accompanying each lot, keyed to the field it came from:** `Pb · Cd · As · Hg` · pH · organic matter · CEC · macronutrients.

**Declared honestly: this is not a USDA descriptor requirement.** Full-text review of the USDA Hemp Descriptor and Phenotyping Handbook V3 found no soil-contaminant protocol (`heavy metal`, `cadmium`, `arsenic`, `phytoremediation` — zero occurrences). **BNR requires it because the "seed is the lowest-uptake tissue" argument depends on a baseline soil that neither the GRAS filing nor the federal descriptor set establishes.**

---

## 3. ACCEPTANCE CRITERIA — what makes a COA "complete"

A certificate is **conforming** only if all of the following hold:

1. **Every analyte in §2 appears** — with a value, or an explicit non-result carrying its reason: `NotRequested` · `MethodUnavailable` · `<LOQ (state LOQ)`. **No blank cells. A blank is a rejection.**
2. **Every value carries its method reference, LOQ, and measurement uncertainty.**
3. **`<LOQ` results state the LOQ inline.** "<LOQ" alone is non-conforming.
4. **Protein reports raw N% and both conversion factors** (§2.2).
5. **FAME recovery vs gravimetric fat is stated** (§2.3).
6. **Laboratory holds ISO/IEC 17025 accreditation**; scope certificate attached; accredited vs non-accredited analytes distinguished per analyte.
7. **Chain of custody** from lot to lab, with sampling SOP, sample mass, and retained-sample location.
8. **Triplicate analytical replicates** reported individually with mean and RSD — **not pooled.** Pooling masks variance (USDA handbook: measure individuals "to not mask chemotype").
9. **Lot identity:** cultivar, crop year, field/GPS, processor, dehulling date, moisture at receipt.
10. **No result may be reported as `0`** where the true statement is "below the limit of quantitation."

---

## 4. RFQ — what BNR needs back from each laboratory

1. Quotation per lot and per jurisdiction, itemised by §2 subsection, with any analyte you **cannot** perform named explicitly.
2. **Achievable LOQ for each cannabinoid analyte** (§2.9 is a hard gate).
3. ISO/IEC 17025 scope certificate.
4. Turnaround time; sample volume required per lot.
5. Sub-contracting disclosure — which analytes leave your facility and to whom.
6. Confirmation that raw data and method blanks will be released with the certificate.

**Candidate laboratories** *(no relationship, no endorsement — starting points only)*: Eurofins (US/EU/Canada networks) · SGS · Bureau Veritas · Intertek · Medallion Labs (US) · Central Testing Laboratory, Winnipeg (Canada). **Canadian and EU quotes should come from labs domiciled in those jurisdictions — jurisdictional independence is part of what is being purchased.**

**Cost is not estimated in this document.** Full-panel work of this scope varies widely by lab and country; the itemised quotation above is what produces a real number. **Do not proceed on an assumed price.**

---

## 5. OUTPUT AND LICENCE

Results publish as an open dataset — **`trait_name` columns × lot rows**, aligned to USDA Hemp Descriptor Handbook V3 field names where they exist, so any lot characterised here can be submitted to GRIN-Global at zero marginal effort.

**Every figure ships with method, LOQ, uncertainty, lab, accreditation status and date.** The record is intended to be reproducible by a stranger and reusable by anyone, including competitors.

---

## 6. WHAT THIS DOES NOT DO

**This specification measures composition. It makes no health, nutritional-adequacy, or therapeutic claim, and none may be derived from it without separate, separately-graded evidence.**

**Specifically:** mineral content is not mineral absorption — §2.8's phytate exists precisely because the two diverge. A figure from this panel states what is present in the seed. What that does in a body is a different question, requiring different evidence, and is out of scope here.

---

*What is present is not what is absorbed. `<LOQ` is not zero. A blank cell is a rejection.*

## Sources relied on

- [USDA AMS National Weekly Hemp Report (FVHEMP)](https://www.ams.usda.gov/mnreports/fvhemp.pdf) — jurisdiction selection
- [USDA FoodData Central 170148](https://fdc.nal.usda.gov/food-search/?component=1090) — baseline, flagged not-updated
- USDA Hemp Descriptor & Phenotyping Handbook V3 (Stansell & Osatuke) — methods, triplicate discipline, carryover warning, total-THC formula
- [FDA GRAS Notice 765](https://www.fda.gov/files/food/published/GRAS-Notice-765.pdf) — protease-inhibitor claim under test in §2.8
- [Mineral elements and related antinutrients in whole and hulled hemp seeds](https://www.sciencedirect.com/science/article/pii/S088915752200134X) — phytate ~4 g/100 g
- Supplied: 54 PREE Laboratories certificates — the LOQ deficiency that §2.9 corrects
