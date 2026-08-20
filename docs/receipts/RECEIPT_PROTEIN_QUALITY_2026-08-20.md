# RECEIPT — protein quality: the fourth instance of the error class, caught on our own hero food

**Founder's order, verbatim:** *"don't forget all the protein (especially essential proteins)
fiber and whatever effects actually pathophysiology and or outcomes"*

**Verdict: the order surfaced a defect in this project's own headline number.**
Hemp hearts' protein figure, as this tree has published it, overstates usable protein by
close to a factor of two in a single-food idealisation. Corrected forward on the surface
in the same commit that found it (`79db636`).

---

## 1 · THE FINDING

**Hemp's first limiting amino acid is LYSINE.** Two independent sources:

- **Nosworthy et al. 2023**, *Food Science & Nutrition*, DOI 10.1002/fsn3.3652 — full text
  read. Verbatim: *"The first limiting amino acid for all hemp samples in this study was
  lysine"*, amino acid scores 0.43–0.50 across three preparations.
- **Herreman et al. 2020**, *Food Science & Nutrition*, DOI 10.1002/fsn3.1809 — full text
  read. Independently lists hemp's limiting amino acid as lysine.

| preparation | PDCAAS | DIAAS | true digestibility | what it is |
|---|---|---|---|---|
| **defatted hemp hearts** | **44.0%** | **0.45** | 90.4% | **dehulled hemp seed — maps to FDC 170148, the record this tree already uses** |
| hemp protein concentrate 1 | 42.3% | 0.43 | 91.9% | air-classification, 66.2% protein |
| hemp protein concentrate 2 | 43.9% | 0.45 | 87.0% | air-classification, 53.6% protein |
| casein — reference | 100% | 1.03 | 96.3% | what 1.00 means |

**One dissenting source, recorded rather than buried:** a hemp protein *isolate*
characterisation (PMC9656340) names tryptophan as limiting. Weighted lower for two
reasons — a single isolate preparation, where processing can selectively deplete an
amino acid, and a Table 2 that reports "Leucine + Isoleucine" as one combined row, which
is not a standard pairing. **Two independent sources say lysine; one non-standard source
says tryptophan.** Published as lysine, with the exception on the record.

## 2 · THE MECHANISM — and why it is Axis A, not Axis B

A ribosome needs the exact amino acid its codon calls for, at the moment it reads it.
No substitution, no skipping. So complete proteins built from a meal are capped by the
indispensable amino acid that runs out first relative to need. Humans have **no storage
depot for amino acids** — nothing analogous to glycogen. Surplus is deaminated, the
nitrogen fixed into urea and excreted, the carbon skeleton burned or stored.
**The excess delivers calories and no protein.**

This is **established biochemistry, not an outcome claim**, so it sits on Axis A and may
be stated on a surface. What a given DIAAS *does to a person* remains Axis B.

## 3 · THE BRAKE — which is larger than the finding

**The limiting amino acid is a property of the whole day's amino acid supply, not of any
one food.** Academy of Nutrition and Dietetics, current position paper (2016), fetched and
read, verbatim:

> *"The terms complete and incomplete are misleading in relation to plant protein. Protein
> from a variety of plant foods, eaten during the course of a day, supplies enough of all
> indispensable (essential) amino acids when caloric requirements are met."*

**"During the course of a day" — not at the same meal.** The combine-at-every-meal rule
was retracted decades ago.

**Binding consequence, now enforced in `bfood.html`:** the surfaces will **never** print an
"incomplete protein" warning beside an individual food. It would be mechanically derivable
from data we hold and substantively false. A per-food adequacy *display* is fine; a per-food
*warning* is not.

**Precision note against our own convenience:** the frequently-quoted sentence *"it is not
necessary to combine specific foods at the same meal"* does **not** appear in the 2016
paper. It is from earlier ADA position papers (2009 is the usual citation), which was
**not** fetched. Anyone quoting that exact sentence must cite 2009, not 2016.

## 4 · THE FOURTH INSTANCE — the error class now has four members

`RECEIPT_CANNABINOID_PANEL_UNDERCOUNT` §5.1 recorded three instances sharing one grammar.
**This is the fourth, and it is the first to land on our own reference commodity.**

| # | domain | the total that is not a total | the honest rendering |
|---|---|---|---|
| 1 | cannabinoids | "total cannabinoids" = a sum over 4–16 analytes of ~160 known | name the panel size |
| 2 | fat | "saturated fat" = MCT and LCT, routed differently, collapsed | three rows: C6–C10, C12, C14+ |
| 3 | basket sums | a total over foods where one has no published row | render `≥`, a floor not a total |
| 4 | **protein** | **grams of protein = an upper bound on usable protein** | **carry the limiting amino acid and DIAAS** |

**Each is the same move: a quantity summed over an incomplete or heterogeneous set,
presented under a name that implies completeness.** That the fourth one indicts our own
headline number is the only reason it carries weight — a project that finds this defect
only in other people's data has found a rhetorical device, not a law.

## 5 · FIBRE — and a correction owed on hemp hearts before any outcome talk

**Hemp's fibre is in the hull.** Hulls run 77–84% dietary fibre, whole seed 28–36%, and
**hearts — the dehulled fraction — measure 4.0 g per 100 g** (FDC 170148). Whole-seed fibre
figures must never be quoted for hearts. **Hemp hearts are a poor fibre source**, and the
surface now says so plainly.

Outcome evidence is **Reynolds & Mann et al., *The Lancet* 2019** (185 prospective
publications, ~135 million person-years, 58 RCTs, WHO-commissioned), rendered **with the
authors' own GRADE ratings as its most important column**. Accepted manuscript read in
full via the Dundee repository; the publisher page returned 403 and PubMed a cookie wall.

**The brake is the shape of the table.** Every disease endpoint is observational — no trial
has randomised people to high or low fibre and counted deaths — while every High or
Moderate certainty outcome has a *small* effect: body weight 0.37 kg, systolic BP
1.27 mmHg with a CI barely clearing zero. **The outcomes with big effects have the weakest
evidence; the outcomes with the strongest evidence have small effects.** The authors write
only that the relationships *"may be"* causal.

**Two limits recorded because they cut against this project's interests:**
1. The review states data on fibre *subtypes* were limited and the signal is dominated by
   **cereal fibre**. **Hemp fibre cannot inherit these outcomes**, and the surface does not
   let it.
2. The trials **excluded powdered fibre supplements by design**, and the authors note
   supplemental-fibre reviews show *"only small effects."* **This evidence supports
   fibre-rich foods, not isolated fibre** — cutting against any supplement this project
   might later sell.

Also recorded: one named harm (high intakes may be deleterious where iron or mineral
status is borderline), and the identified optimum of **25–29 g/day** against typical
population intakes below 20.

**Where Axis A stops:** SCFA production and butyrate as the colonocyte's primary fuel are
established biochemistry. That any *specific* clinical outcome is *mediated by* SCFAs in
humans is a hypothesis, not a demonstrated chain. Mechanism and outcome are joined by
inference, and that seam is the BiGen boundary.

## 6 · WHAT WAS NOT SHIPPED, AND WHY

**The nine essential amino acids are not yet cells on the hexagon.** Research could not
primary-verify the adult mg/kg/day DRI table. Only **leucine (EAR 34, RDA 42)** is
confirmed, from the AHRQ/NASEM 2024 review; the remaining eight trace to a wiki column,
and **phenylalanine+tyrosine carries an unresolved conflict — 33 vs 44 mg/kg/d** from two
sources that cannot both be right.

Every route to NAP report 10490 failed: the online reader serves pages as images, not text.

**Under `cite or the cell stays silent`, those numbers do not go on a page whose entire
premise is that a stranger can recheck its arithmetic.** A resolution pass across five
independent routes with per-value adversarial verification is running. The scoring pattern
in mg per gram of protein **is** verified (His 18, Ile 25, Leu 55, Lys 51, SAA 25, AAA 47,
Thr 27, Trp 7, Val 32) — but it is derived from the 1–3 year child EAR and **is not the
adult mg/kg table**; publishing it as one would be exactly the substitution this receipt
exists to prevent.

**Also verified and worth recording:** **no UL exists for any amino acid.** The NASEM text
is explicit that data were insufficient to set one — that is an *absent* UL, not a UL of
infinity, and the report adds that caution may be warranted for supplemental L-forms.

## 7 · OWED

- **A free FDC API key and a re-pull of 170148 / 170495 / 171412.** Every food figure
  currently on the surface is mirror-sourced; the API returned HTTP 429 on the demo key and
  the food-details path 404'd. Five-minute fix, removes a whole class of doubt.
- **Chlorella has no USDA record at all** — literature only, with large between-product
  variance. It must be rendered as estimated, visibly distinct from the USDA-backed foods.
  Not yet done.
- The adult amino acid table, pending the resolution pass.

**Seat 3 (Opus 5), 2026-08-20.** The founder asked for protein and got a defect in our own
number. That is the order working as intended. 🐝
