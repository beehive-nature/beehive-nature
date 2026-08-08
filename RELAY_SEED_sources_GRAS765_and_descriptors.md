# RELAY · THE SEED SOURCES — GRAS 765, THE MOLECULES REVIEW, AND THE USDA DESCRIPTOR SCHEMA

> ## ✅ VERIFIED 2026-07-19 BY CODE (compile gate) — three corrections, one ruling closed
>
> Code read **GRAS 765 in full** (I had 78%) and found the handbook as **V3 (2023), read in full via pdftotext** (I had 53% of what the URL calls V1; V1 was not findable as a readable file). Results:
>
> - **GRAS 765: 9/9 claims verbatim-confirmed** from the primary filing. §3's attestation finding stands on primary-source ground.
> - **CORRECTION 1 — chlorophyll.** The green-colour fact is confirmed; **the review never calls chlorophyll "lipophilic."** That was my own chemistry inference wearing the review's attribution. Chemistry correct, citation wrong. **Cite the review for the colour only; the lipophilicity stands uncited.**
> - **CORRECTION 2 — the cannabinoid panel is 20 standards, not 16**, each with a CAS number. **And the citable document is V3, not V1.** §5c is corrected below.
> - **CORRECTION 3 — `THC + 0.877 × THCa` confirmed** verbatim in the handbook and arithmetically (314.46 / 358.47 = 0.8772).
> - **THE SOIL RULING — CLOSED.** Two adversarial passes hunted the full text: `heavy metal` = 0, `cadmium` = 0, `arsenic` = 0, `phytoremediation` = 0. Only a growing-medium mention and a descriptive collecting-site note. **§4a-i's `SoilPanel` is a genuine BNR extension — and §5d's public-honesty risk is now closed with a complete read behind it.**
>
> **The ruling got stronger, not weaker.** GRAS 765 rests "seed is the lowest-risk tissue" on an unstated baseline soil — **and the national descriptor set has no soil field either.** The panel supplies a premise *neither* document establishes. That is the gold-standard argument, and it is now evidenced rather than asserted.
**From:** Cowork/design seat · **To:** founder + Code · **Date:** 2026-07-19
**Extends:** `RELAY_SEED_lipid_cannabinoid_taxonomy.md` (same day)
**Axis A throughout. The effect-claim register in these sources is Axis B and is quarantined in §6 — it does not enter the repo.**

---

## 0. READING COVERAGE — stated before any conclusion

| Source | Read | Not read |
|---|---|---|
| **FDA GRAS Notice 765** (1,620 lines) | lines 1–820, 1,180–1,620 ≈ **78%** | lines 820–1,180 (§3.4 hemp protein exposure → §5.2 safety overview, plus intervening tables) |
| **Molecules 2024;29(9):2097** (PMC11085560) | abstract, §2 physical, §3.1.1 protein, **§3.1.2 lipids**, §3.1.3 carbohydrate, §3.1.4 vitamins/minerals ≈ lines 1–400 of 597 | §§ on terpenes, flavonoids, phytosterols, carotenoids, phytocannabinoids, antinutritional factors, functional-food applications |
| **USDA Hemp Descriptor & Phenotyping Handbook v1** (Stansell & Osatuke, 2021-09-30) | **READ ~53%** (50,000 of 95,151 chars) via rendered-page extraction after the raw fetch failed — ABOUT, data types, PASSPORT, ARCHITECTURE, LEAF, SEX & INFLORESCENCE, **SEED**, FIBER, **SECONDARY METABOLITES**, start of PATHOGEN/PEST | remainder of PATHOGEN/PEST, any abiotic-stress section, reference list |
| Remaining ARS program/project/people pages | not fetched | — |

**The descriptor list is the single most important document of the eight and I do not have it.** §5 says why and what to do.

---

## 1. Your fat answer, independently corroborated — and one thing I missed

**GRAS 765, §2.2, verbatim:**

> *"THC is not found in the interior of hemp seed unless there has been physical cross contamination of the seed hull with cannabinoid-containing resins in bracts and leaves during maturation, harvesting and processing."*

That is an FDA-filed statement of exactly what I told you this morning: **cannabinoids in a whole-seed COA are hull-surface contamination, not kernel content.** I asserted it from chemistry; this is an independent witness for it, and the sentence is worth keeping verbatim because a notifier wrote it under a certification of balance.

**And the data proves the lipophilicity claim empirically.** Fresh Hemp Foods' historical third-party means, across their three products:

| Fraction | Mean THC | Why |
|---|---|---|
| Hulled hemp seed | **0.29 µg/g** | kernel — resin mechanically removed with the hull |
| Hemp protein powder | **0.31 µg/g** | kernel, de-oiled |
| **Hemp oil** | **4.95 µg/g** | **~17× the seed** |

**The oil concentrates cannabinoids roughly seventeen-fold, from the same starting material.** That is lipophilicity doing exactly what §3 of the taxonomy note said it does: cannabinoids are not fats, but they *dissolve* in fat, so any process that concentrates the lipid fraction concentrates them along with it. Their own specification concedes the point — NMT 4 µg/g for seed and powder, but **NMT 10 µg/g for the oil.** The looser limit on oil is the chemistry admitted in a spec sheet.

**What I missed in the residual table: chlorophyll.** The Molecules review notes the green colour of fresh-pressed hemp oil is chlorophyll from mature seeds. It is lipophilic, extracts with the oil, is not a fatty acid, and therefore sits in the unresolved remainder. **Add it to the `LipidResidual` type.** Corrected here rather than quietly in the other file.

**Otherwise the residual table holds.** The review independently names **γ-tocopherol as the predominant tocopherol** and **phytosterols** as present — two of the seven slots I listed, confirmed by a peer-reviewed source I had not read when I wrote them.

---

## 2. Your three-panel structure was already built — by the filers, in 2018

GRAS 765 is one of **three interrelated notices filed together**: hulled hemp seed, hemp oil, hemp protein powder. Their own words:

> *"All three notified substances are from the same material, hemp seed, but extract or used different components."*

**One seed, decomposed into fractions, each characterised separately, each with its own specification — and the exposure assessment then re-aggregates them because a person eating one probably eats the others.** That is the D-12 v2 three-panel design arriving at the same shape from the regulatory side, four years before we drew it. Worth knowing: the fraction-based decomposition is not our invention, it is the industry's own filing structure, which means a COA built this way reads as native to anyone in the trade.

**Design consequence — the aggregation is the part we would have missed.** Their cumulative estimate (0.1938 mg THC/person/day across all three at the 90th percentile) exists because assessing one fraction alone understates a real person's exposure. A `fat-profile` that characterises fractions but cannot sum them across a basket has the same gap.

---

## 3. GRAS is an attestation structure — and it is the one we already built

**This is the most important finding in the eight links, and it is architectural, not nutritional.**

Read what the GRAS mechanism actually is:

- **The notifier concludes.** Fresh Hemp Foods determines its own product is GRAS. FDA does not determine it.
- **FDA responds with "no questions."** The agency never says *safe*. It says it has no questions about the notifier's conclusion.
- **The notifier certifies balance**, verbatim: *"a complete, representative, and balanced submission that includes unfavorable information, as well as favorable information."*
- **The basis is named and enumerable** — exposure estimates, literature, an expert panel, and an established identity meeting a written specification.

**That is `Attestor` with no `Verified` variant, exactly as ratified.** The whole federal food-ingredient system runs on *"someone competent asserted this, here is who, here is on what basis, and the regulator declined to object"* — never on *"the state certified it true."* We built that type because the epistemics demanded it. It turns out to be the incumbent design too.

**And the balance certification is a negative control in regulatory clothing.** A filing that shows only favourable data is defective *by the filer's own oath*. Law 2, in a 1958 statute.

**Concretely, for the `attestation-core` docs:** GRAS is the worked real-world example the neutral layer has been missing. It is not a metaphor — it is a live, load-bearing, sixty-year-old system with the same shape, and citing it answers "why doesn't your type have a Verified variant?" better than any argument I have written.

---

## 4. Three findings that change D-12, in order of sharpness

### 4a · A COA does not test everything, every lot — and the honest surface must say so

GRAS 765 states plainly that **heavy metals are not tested per lot**, **aflatoxins are not tested every lot** (both risk-based frequency), and **pesticide/herbicide residues are not tested at all** — the last because the contract prohibits their use, so the control is contractual rather than analytical.

**Their reasoning is sound.** Heavy-metal uptake in *Cannabis sativa* runs **roots > stems > leaves > seed** (Angelova et al. 2004), so seed is the lowest-risk tissue; aflatoxin risk tracks moisture at 20–25%, so verifying moisture at intake manages it upstream.

**But it means "know everything about the seed" collides with what a real COA contains.** A lot certificate showing no heavy-metal row is not a clean lot — it is an untested lot, and the reason may be a perfectly good risk argument that lives in a quality manual the buyer never sees.

**Ruling needed, and it is the whole thesis in miniature:** D-12 must render **`NotMeasured` with its reason** — `NotMeasured { basis: RiskBased | ContractualControl | NotRequested | BelowLOQ }` — never a blank cell and never a zero. **The absence of a test and the absence of a contaminant must not be able to render the same way.** That is the `fat-profile` guarantee generalised to the whole certificate, and it is the difference between a COA that informs a buyer and one that flatters a seller.

### 4a-i · FOUNDER RULING 2026-07-19 — SOIL ANALYSIS IS A DEFAULT COA REQUIREMENT

> *"One big reason I want to be the architect in these DEX markets is I can ensure setting a new 'gold standard.' … proving high confidence helpful COAs that default require full soil analysis (can be done by the DAO)."*

**Ratified. And it closes the exact hole §4a opens, which is why it is the right move rather than merely a strict one.**

**The structural argument, stated plainly.** GRAS 765's reasoning is *relative*: uptake runs roots > stems > leaves > seed, so seed is the lowest-risk tissue, so per-lot heavy-metal testing is not warranted. **That inference is only valid over a baseline soil, and the document never establishes one.** *Cannabis sativa* is a known phytoaccumulator — it is deliberately planted to pull metals out of ground. On contaminated land the lowest tissue can still carry a real load, and "lowest of four" says nothing about the absolute number. **The seed COA inherits an assumption about dirt that the seed COA does not contain.**

**Soil analysis supplies the missing premise.** It converts *"we don't test because the risk is low"* into ***"here is the evidence the risk is low."*** Same conclusion, but now with an exhibited witness instead of a plausible argument — Law 1, applied to a field.

**Why the economics work, which is the part that makes it a standard and not a wish:**

- **Soil is a fixed cost per field per season; lot testing is a marginal cost per lot, forever.** One soil panel amortises across every lot that ground produces. The gold standard is *cheaper* than per-lot analytics at any real volume — which is why it can be a default rather than a premium tier.
- **It is a shared good, so the DAO is the right payer.** No single grower captures the full value of their own soil panel; every buyer downstream does. That is a textbook commons underinvestment, and it is exactly the class of cost a treasury exists to carry. **Funding it from the pool is not charity to growers — it is the DAO buying the credibility of its own market.**
- **It runs upstream of the harvest, so it gates rather than reacts.** A soil result arrives before planting; a lot result arrives after a crop exists and someone is holding it. Testing that can change a decision is worth more than testing that can only condemn inventory.

**And it is a moat, not a burden.** Any venue can list lots. A venue where **every lot carries its ground's provenance** is offering something a competitor cannot retrofit — the soil evidence had to exist before the crop did. **That is the gold standard being architectural rather than aspirational: it is unfakeable after the fact.**

**Types:**

- `SoilPanel { field_id, sampled, method, attestor, analytes: Vec<Measured<T>> }` — heavy metals at minimum; the full analyte list waits on the descriptor schema (§5).
- A `SeedLot` **references** its `SoilPanel`; it does not embed a copy. One field, many lots, one panel — and a lot whose field has no panel renders as `NotMeasured { basis: NoSoilPanel }`, **visibly, never silently.**
- **Default-required means the type makes its absence loud, not that the market refuses the lot.** A grower without a panel can still sell; the buyer simply sees that they are buying an assumption. **Disclosure, not exclusion — the founder's own standing rule.** The DAO-funded panel is then the offer that closes the gap, and growers take it because it prices their lot better.

**Negative controls:** a `SeedLot` rendering a clean heavy-metal status with no `SoilPanel` and no lot assay → **fail**. A `SoilPanel` from a different `field_id` than the lot's → **refuse** (Law 1d). A panel with zero analytes loaded rendering as "clean" → **refuse** (Law 1a).

**On the petrochemical thesis — noted as yours, and the ruling does not rest on it.** The industrial-competition account of 1937 (Hearst, DuPont, Anslinger) is widely held and has real documentary threads; most historians of the period give more causal weight to racial politics and moral panic, and treat the industrial motive as contested rather than established. **You flagged it as opinion and it can stay opinion — because the soil standard stands entirely on its own merits.** A market that proves its ground is better than one that assumes it, whatever anyone concludes about why prohibition happened. **Keep the two arguments separate in any public copy: the standard is defensible to a regulator; the history is a position, and mixing them lets someone dismiss the first by disputing the second.**

### 4b · Specification, regulatory limit, and measurement are three different types

One document, one analyte, three numbers:

| Number | What it is | Type |
|---|---|---|
| **10 µg/g** | Health Canada regulatory maximum | `RegulatoryLimit { jurisdiction }` |
| **4 µg/g** | Fresh Hemp Foods' tighter self-imposed spec | `Specification { set_by }` |
| **0.29 µg/g** | historical measured mean, third-party lab | `Measured<T> { method, attestor }` |

**A surface that shows "4 µg/g" where the measured value is 0.29 is displaying a ceiling as though it were a reading — a 14× overstatement of what is actually in the food.** They did this deliberately and correctly for a conservative safety assessment; a *consumer-facing* surface doing it would be lying with true numbers.

**Never let a limit and a measurement share a display slot.** Add it to the negative controls: a limit rendering where a measurement is expected must **fail**, not coerce.

### 4c · Two of your own sources disagree — and this is the source-badge case, live

- **GRAS 765 (2018, notifier-authored):** *"There are no known anti-nutritional properties."*
- **Molecules 2024 (peer-reviewed review):** antinutritional factors are named in the abstract as a keyword and given their own section as an aspect that **"require[s] further investigation."**

**Both are real sources; they do not agree; and the disagreement is legible from who wrote them.** One is a filer asserting sufficiency about its own product to a regulator, in 2018. The other is an academic review surveying the field six years later. **Neither is lying. The provenance explains the gap.**

**This is the D-12 source-badge design's first genuine worked example, and it should ship as the fixture.** A surface that silently picks one and renders it as *the* answer is doing the thing the badges exist to prevent. Two badges, both shown, the reader decides — that is the whole argument for the multi-source backbone, and now it has a case that is not hypothetical.

---

## 5. The descriptor list is the document you actually want — and I could not read it

**USDA-ARS Plant Genetic Resources Unit, Geneva NY** (Zachary Stansell, curator) maintains the hemp germplasm collection. A **descriptor list** is a controlled vocabulary for characterising accessions — the agreed field names, units, and permitted values by which any two people describe the same seed and mean the same thing.

**That is the germplasm-side D-12: a schema, not a dataset.** For "know everything about the seed," a national curator's controlled vocabulary is worth more than any number of individual COAs, because it tells us **what the fields are supposed to be** and gives our types a public, citable origin instead of a shape we invented.

**GOT IT — read ~53% via the rendered page after the raw fetch failed.** The real title is the **USDA Hemp Descriptor and Phenotyping Handbook**, Zachary Stansell & Anya Osatuke, 30 Sep 2021. It is better than I hoped, and it is close to a drop-in specification for `SeedDescriptor`.

### 5a · It is already a type system, written in our notation

The handbook's own descriptor format:

```
trait_name [datatype; units]

elevation_meters [decimal; m]
    Elevation of collecting site above sea level.
```

**Name, datatype, unit, prose definition.** It declares its datatypes explicitly (`datetime`, `decimal`, `int`, `nvarchar`, with precision stated for each), fixes **"All units are SI unless otherwise indicated,"** and keys every row to a **PUID** — a persistent unique identifier, with an explicit fallback construction (institute code + accession number + genus) when no true PUID exists.

**We do not need to invent `SeedDescriptor`. We need to implement this one.** Field names come from the handbook verbatim — `oil_content`, `seed_fatty_acid`, `hundred_seed_weight`, `percent_germ`, `chemotype` — which means a BNR seed record and a GRIN-Global record describe the same seed in the same words. **That is interoperability obtained by adopting a public schema rather than negotiating with one.**

**Sections:** PASSPORT · ARCHITECTURE · LEAF · SEX & INFLORESCENCE · **SEED** · FIBER · **SECONDARY METABOLITES** · PATHOGEN/PEST.

### 5b · The SEED section answers the fat question with a citable method

| Descriptor | Method the handbook specifies |
|---|---|
| `oil_content [decimal; %]` | Soxhlet (10 g ground to 0.5 mm ± 0.1, 100 mL hexane, 24 h, 70 °C) **or** NMR (moisture < 8%, 5 MHz, 4 scans, 40 °C) |
| **`seed_fatty_acid`** | **ISO 12966-1:2014** — GC of fatty acids as **FAMEs** |
| `combustion_analysis` / Kjeldahl | combustion at 960 °C, **or** AOAC 991.20; crude protein = Kjeldahl N × 6.25 |
| `seed_moisture [%]` | 105 °C for 20 h; `(wet − dry)/wet × 100%` |
| `percent_germ [%]` | 4 × 50 seeds, 16 h dark 20 °C / 8 h light 30 °C, counted at 7/14/21 d |
| `hundred_seed_weight [g]`, `seed_size_length/width`, `seed_image`, `grain_yield`, `shattering` | specified |

**Two rulings fall straight out of this.**

**1 · The method is a recorded field, not an assumption.** The handbook instructs: *"Indicate whether measurement was made using Nuclear Magnetic Resonance (NMR) imaging, or using a Soxhlet extractor in seed_remarks"* — and if you deviate, record solvent (IUPAC name), volume, time, and temperature. **Two valid methods for one number, and the number is not interpretable without knowing which.** That is `Measured<T> { value, method, attestor }` written as lab policy by a federal curator. Our type was right; now it has a citation.

**2 · `seed_fatty_acid` is ISO 12966-1:2014 — FAMEs — which is exactly why the residual exists.** The national standard for seed fat *is* a fatty-acid-methyl-ester panel. It measures fatty acids. **The glycerol, sterols, tocopherols, phospholipids, waxes and chlorophyll of §2 are outside its scope by the standard's own definition.** Your "other/unresolved 1.6 g" is not a lab failing — it is the difference between total lipid and the analyte set ISO 12966 covers, and now we can say so with the standard's number attached.

**And a detail worth catching:** the handbook puts **α-, β-, γ-, δ-tocopherol and Plastochromanol-8 in the TERPENE GC/MS standard list**, not the fatty-acid run. So tocopherols are measured — just on a different instrument, in a different section. **A residual slot can read `NotMeasured` on the fat panel while the same compound sits measured two sections away.** Cross-panel reconciliation is a real requirement, not a nicety.

### 5c · The cannabinoid section supports your correction — and names the contamination artifact

`cannabinoids [decimal; μg/mg]` is a **first-class descriptor**, measured by UPLC or HPLC against **twenty standards, each with a CAS number** *(corrected from "sixteen" — Code, full V3 read)*. Alongside it:

- **`chemotype [int; 1-6]`** — 1 mostly THC(A) · 2 ≈1.5:1 CBD(A):THC(A) · 3 mostly CBD(A) · 4 mostly CBG(A) · **5 low overall cannabinoid content** · 6 other. **Note there is no "zero" chemotype.** The lowest category is *low*, and it is driven by allele segregation at the *B* and *O* loci — cannabinoid content is a genetic trait of the plant, not an external contaminant.
- **`THC_total.potential = THC + 0.877 × THCa`** — the exact total-THC formula, matching what HR 5371 will require from Nov 12 2026. **Our `Eligibility` calculation should use this expression verbatim, cited here.**
- *"living tissues synthesize acid forms of most cannabinoids… decarboxylated to non-acid forms during evaluation"* — and the handbook **advises against decarboxylating before analysis**, because volatilisation introduces error. Compute total; don't cook the sample.
- **`chemotype_segregation`** — measure **10 individual plants, not a pooled sample**, *"to not mask chemotype."* Pooling hides variance. A negative control for us: an aggregate that cannot show its dispersion is not a characterisation.

**The measurement-artifact warning, verbatim and load-bearing:**

> *"THC is a ''sticky'' compound and residues will persist on laboratory equipment and analytical vessels following cleaning. THC carryover onto subsequent samples may erroneously increase the reported THC content. We strongly advise against re-using sample vials."*

**USDA's own curator states that reported THC can be inflated by laboratory carryover.** For low-concentration matrices — which seed is — carryover is proportionally largest. **So a small nonzero seed THC number has at least three candidate origins: genuine seed content, hull-resin transfer, and vial carryover.** A COA reporting `0.29 µg/g` without method and vessel discipline cannot distinguish them.

**That is the honest shape of the seed-cannabinoid question, and it is why `≈ 0` was the wrong answer in either direction.** The number is real, small, and its provenance is genuinely ambiguous — which is an argument for reporting method and LOQ beside it, never for rounding it away.

**Caveat, stated:** the handbook's cannabinoid and terpene protocols both begin *"Dry Inflorescences…"* — **they are written for flower, not seed.** The handbook gives us the analyte list, the total-THC formula, and the contamination discipline, but **not** a seed-specific cannabinoid method. That gap is real and should be recorded as `NotStandardised` rather than papered over with the flower protocol.

### 5d · What is still missing, and what it costs

**~45k characters unread** — the balance of PATHOGEN/PEST and whatever follows. **No soil section appeared in the 53% I read.** If the remainder has none, then §4a-i's soil-panel requirement is **BNR's own extension beyond the federal descriptor set** — which is precisely the "new gold standard" position, and it should be labelled as an extension rather than implied to be USDA practice. **Read the remainder before that claim is made publicly.**

**Also unread and worth having:** GRIN-Global's field definitions themselves, and the handbook's reference list (it cites Carlson et al. 2021 throughout for architecture, Toth et al. 2020 for chemotype loci, Berhow & Gude 2021 for the chromatography).

**One free win:** the handbook says collected data should be submitted as a spreadsheet with **trait_name as column headings and PUID as row names**, emailed to the curator for inclusion in GRIN-Global. **A BNR export that emits exactly that shape makes every characterised lot a potential public-germplasm contribution at zero marginal effort** — the disclosure mission and the seed thesis meeting in a CSV header row.

---

## 6. The wall — quarantined, explicitly

**The Molecules review is saturated with effect claims:** antioxidant, anti-inflammatory, antihypertensive, hypocholesterolemic, hypoglycemic, neuroprotective, "functional foods," RDA-percentage framing. **None of it enters the repo.** It is Axis B — off-repo, GRADE-graded, k001. I used the review for **composition only** (oil %, PUFA %, LA:ALA ratio, γ-tocopherol, phytosterols, chlorophyll, edestin/albumin fractions, PDCAAS).

**And note what GRAS 765 itself does — it is the model, and it is why you called it the good argument.** It argues **safety**, not benefit. Its §5.9 "Nutritional Benefits" is a small part of a document whose spine is exposure math against published effect thresholds. **The claim it makes is "this will not hurt you at these intakes," which is provable from composition and consumption data. It never needs to claim the seed does anything to you.**

**That is precisely the k001 wall, drawn by a food lawyer in 2018.** The complimentary-food argument works *because* it stays on the safe side of the line — and it is the register BNR's own surfaces should copy: composition, exposure, specification, provenance. Never effect.

---

## 7. For Code — deltas to `RELAY_SEED_lipid_cannabinoid_taxonomy.md`

1. **Add `chlorophyll` to `LipidResidual`** (§1).
2. **`NotMeasured` carries a reason — CORRECTED BY CODE, and the correction is the sharpest finding in the pass.**

   My enum was `{ RiskBased | ContractualControl | NotRequested | BelowLOQ }`. **`BelowLOQ` does not belong in it.** The first three are reasons **a test was never run**. `BelowLOQ` means **the assay ran and the analyte fell under the floor** — a measurement *outcome*, carrying real information (an upper bound). Putting them in one variant makes "not tested" and "tested, found under LOQ" render identically.

   **That is precisely the §4a error, committed inside the fix for §4a.** I wrote a whole section on absence-of-test never looking like absence-of-substance, then built an enum that lets them look the same. Recorded plainly because it is the most instructive mistake in this batch.

   **Ruled:** absence-reasons `{ RiskBased | ContractualControl | NotRequested }` on the not-measured state; **`BelowLoq { loq }` as a distinct measured outcome** carrying its own limit.

2b. **`Measured<T>` is forked three ways and this is a breaking change, not an additive one** (Code, from the crates): `attestation-core`, `fat-profile` and `food-composition` each define their own bare `Value | NotMeasured`. **Make the reason-carrying change once in `attestation-core` and adopt it — do not fork it a fourth time.** Consolidation is a prerequisite to the delta, not a follow-up.
3. **Split `Specification` / `RegulatoryLimit` / `Measured<T>`** into distinct types — **and per Code, `Specification` and `RegulatoryLimit` must not be `Determination`s.** That is what makes "a limit cannot render in a measurement slot" a **compile-time** guarantee instead of a runtime check. Better than what I specified (§4b).
4. **Fixture — and a much smaller lift than I implied.** Code found `food-composition` already carries the multi-source backbone: `NutrientRecord { Vec<Determination> }` with `Origin { determined_by | borrowed }`, plus `Spread` and `Comparison`. **Source disagreement is already modelled.** The GRAS-765-vs-Molecules-2024 antinutritional split is **a fixture for existing machinery, not a new type** (§4c).
5. **Aggregation across fractions** must be expressible — one seed, three panels, summable (§2).
6. **Cite GRAS in `attestation-core` docs** as the incumbent no-`Verified`-variant attestation system (§3).
7. **`SeedDescriptor` is UNBLOCKED — and it is an adoption, not a design.** Implement the USDA handbook's field names, datatypes and units verbatim; PUID as key; SI units; **the method recorded as a field, per the handbook's own instruction** (§5a–5b).
8. **`SoilPanel` + `SeedLot.soil_panel` reference**, default-required, `NotMeasured { basis: NoSoilPanel }` when absent — visible, never silent (§4a-i).
9. **Total THC = `THC + 0.877 × THCa`**, cited to the handbook, feeding `Eligibility` (§5c).
10. **Cross-panel reconciliation:** tocopherols measured on the terpene GC/MS must not render as absent merely because the FAME panel cannot see them (§5b).
11. **GRIN-Global export**: `trait_name` columns × PUID rows. Cheap, and it makes every lot a potential public-germplasm contribution (§5d).
12. **Label the soil requirement as a BNR extension** unless the unread 45% shows a USDA soil section (§5d).

**All queued behind the existing order. Recorded now so the types are right when built, not jumping the line.**

---

*Composition, not counsel. Coverage stated before conclusions; the one document I could not read is named as unread.*

## Sources

- [FDA GRAS Notice 765 — Hulled Hemp Seeds, Fresh Hemp Foods Ltd. (2018)](https://www.fda.gov/files/food/published/GRAS-Notice-765.pdf) — read ~78%
- [Tănase Apetroaei et al., *Hemp Seeds (Cannabis sativa L.) as a Valuable Source of Natural Ingredients for Functional Foods—A Review*, Molecules 2024;29(9):2097](https://pmc.ncbi.nlm.nih.gov/articles/PMC11085560/) — read ~2/3
- [USDA-ARS PGRU Hemp Descriptors v1 (archived 2023-02-16)](https://www.ars.usda.gov/northeast-area/geneva-ny/plant-genetic-resources-unit-pgru/hemp-collection-collaborations/hemp-descriptors-version-1-archived-2023-02-16/) — **not read**
- [USDA-ARS PGRU — Zachary Stansell](https://www.ars.usda.gov/northeast-area/geneva-ny/plant-genetic-resources-unit-pgru/people/zachary-stansell/) — not fetched
- [USDA FoodData Central — Resources](https://fdc.nal.usda.gov/resources#bkmk-1) — not fetched
