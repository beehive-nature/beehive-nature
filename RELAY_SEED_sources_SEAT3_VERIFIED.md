# Seat 3 · compile-gate verification of `RELAY_SEED_sources_GRAS765_and_descriptors.md`

From: Code / Seat 3 (compile gate) · To: founder + Cowork · Date: 2026-07-19
Method: (1) full-text independent read of all three primary sources — 5 agents, 72 tool calls,
incl. a two-agent adversarial pass on the soil question; (2) type-consistency of the §7 deltas
against the actual `fat-profile` and `food-composition` crates. Status: DRAFT on the mount,
un-landed (§F). The §7 deltas remain **queued behind F-4** — this receipt records, it does not
build.

## A · Source verification — the reading gaps Cowork flagged are now closed

Cowork stated its coverage honestly (GRAS ~78%, handbook ~53% of V1, Molecules ~2/3). The
verification read all three **in full**, and the relay holds up almost entirely.

**FDA GRAS Notice 765** (`fda.gov/media/117790/download`, 153 pp., read in full) — **9/9
verbatim-confirmed.** Every claim G1–G9 matched the primary filing, including §2.2 (THC hull-
contamination), §1.9 balance certification, the "no questions / not an affirmation" letter, the
risk-based testing-frequency statements, the 0.29/0.31/4.95 µg/g means and NMT specs, and the
Battista 2014 milk citation. Three-notice numbering confirmed: **765 hulled seed, 771 protein
powder, 778 oil.** No contradictions.

**Molecules 2024** (PMC11085560, read in full) — **5/6 confirmed, one overstatement:**
- **M3 correction.** The green colour of fresh oil = chlorophyll from mature seeds is confirmed
  verbatim. But the review **does not call chlorophyll "lipophilic."** That attribution is the
  relay's own (correct) chemistry — chlorophyll *is* fat-soluble, which is why it partitions
  into the oil — but **Molecules is not the witness for it.** Cite the review only for "green
  colour = chlorophyll in mature seeds"; the lipophilicity stands on chemistry, uncited.
- Minor: the abstract keyword is "antinutritional **compounds**," not "factors" (that is the
  §3.3 heading); the five bioactives are each discussed but not listed in one sentence. Neither
  weakens §4c.

**USDA Hemp Descriptor & Phenotyping Handbook** — read **in full** (V3, 2023-06-07,
`ars.usda.gov/ARSUSERFILES/80600500/HDM_DATA/HDMV3.PDF`, 3121 lines via pdftotext). **9/10
verbatim-confirmed, one number wrong, one version caveat:**
- Confirmed verbatim: the `trait_name [datatype; units]` format, SI-unless-noted, PUID fallback
  (institute+accession+genus); the SEED methods (Soxhlet 10 g/0.5 mm/100 mL hexane/24 h/70 °C;
  NMR <8% moisture/5 MHz/4 scans/40 °C; **seed_fatty_acid = ISO 12966-1:2014 FAMEs**; protein
  combustion 960 °C or AOAC 991.20, N×6.25; moisture 105 °C/20 h; germ 4×50); method-recorded-
  in-`seed_remarks`; tocopherols (α/β/γ/δ + Plastochromanol-8) on the **terpene GC/MS** list,
  not the FAME run; the chemotype 1–6 table with **no zero category**, B/O loci; the vial-
  carryover "sticky compound" warning; the "Dry inflorescences" flower-not-seed protocols; the
  GRIN-Global export shape (trait_name columns × PUID rows, emailed to the curator).
- **U5 correction: the cannabinoid panel is 20 standards, not 16.** V3 lists 20, each with a
  CAS number (CBDVA, CBGVA, CBDV, CBV, CBDA, CBGA, THCV, CBG, CBD, THCVA, CBCVA, CBN, CBNA,
  THC-d9, THC-d8, THCA, CBL, CBC, CBCA, CBLA). The relay's list of 16 (8 acid + 8 decarb) is
  incomplete.
- **U6 confirmed verbatim: `THC_total.potential = THC + 0.877 · THCa`.** (0.877 also checks out
  arithmetically as the THC/THCa molar-mass ratio, 314.46/358.47 = 0.8772.)
- **Version caveat:** the cited V1 (2021-09-30) was not locatable as a readable file; V3 states
  V1.0 was Sept 2021. Everything above is stable schema, but the 16-vs-20 standards count is
  exactly the kind of thing that could differ between V1 and V3 — recorded, not smoothed. Any
  public citation should say **V3 (2023)**, the version actually read.

## B · THE SOIL RULING — §4a-i's extension claim is HONEST, verified

§5d asked that the remaining 45% be read before claiming publicly that a soil-analysis
requirement is a **BNR extension** beyond the USDA set. It is now read in full, and two
independent adversarial agents tried to **refute** the extension claim by hunting for any
soil-contaminant protocol. Both failed to refute it:

```
Full-text keyword hunt across all 3121 lines:
  heavy metal = 0   cadmium = 0   arsenic = 0   mercury = 0   chromium = 0
  phytoremediation = 0   ICP/ppm/mg-kg = 0
  soil = 12 hits, ALL benign:
    · "diameter at soil level" — a stem-height measurement landmark
    · "potting soil" / "soil mix" — growing medium in the Cloning/Tissue-Culture appendices
    · ONE collecting-site note (Feral Collection appendix): "…soil classification from the
      web soil survey" — descriptive passport metadata, NOT a per-sample contaminant assay
  PASSPORT > Sampling & location has NO soil field at all.
```

**Verdict: requiring full soil analysis on every seed COA is a genuine BNR extension.** The
handbook specifies no soil-contaminant / heavy-metal / abiotic-stress protocol for seed. So
§4a-i's `SoilPanel` requirement must be **labelled an extension** in any public copy — and that
label is now backed by a complete read, not an unread remainder. This also *strengthens* the
founder's structural argument: GRAS 765's "seed is lowest-risk tissue" inference is relative to
an unstated baseline soil, and the national descriptor set has no soil-contaminant field either
— so the soil panel supplies a premise **neither document establishes.** Per the founder's own
instruction, keep the standard (defensible to a regulator) separate from the 1937-history
position (contested) in any public text.

## C · Corrections to fold into the deltas when built

1. **Chlorophyll → `LipidResidual`: keep** (correct chemistry), but cite Molecules only for the
   green-colour fact, not for lipophilicity (§A/M3).
2. **Cannabinoid standards = 20, cite handbook V3** (§A/U5) — not 16, not V1.
3. **Soil panel = explicitly an EXTENSION** (§B) — labelled as such, not implied USDA practice.

## D · Compile-gate type-consistency findings (independent of the sources)

Checked the §7 deltas against the built `fat-profile` and `food-composition` crates:

- **§4a `NotMeasured { basis }` is a *breaking* change to a ratified primitive, and it is
  forked three ways.** `Measured<T>` is a bare `Value | NotMeasured` in `attestation-core`,
  `fat-profile`, AND `food-composition` — three definitions. Add the reason **once in
  `attestation-core` and adopt**, or the change diverges across trees.
- **`BelowLOQ` is miscategorized in the relay's own enum.** `RiskBased | ContractualControl |
  NotRequested | NoSoilPanel` are reasons a test **was not run**; **`BelowLOQ` means the assay
  WAS run and the analyte fell under the floor** — a measurement *outcome* that bounds the
  value, not an absence. Splitting them is the §4a thesis applied to itself: recommend absence-
  reasons on the not-measured state, and `BelowLoq { loq }` as a distinct measured outcome.
- **§4c (multi-source badge) is largely already built.** `food-composition` has
  `NutrientRecord { Vec<Determination> }` with `Origin` (`determined_by`/`borrowed`) plus
  `Spread` and `Comparison`. The GRAS-765-vs-Molecules-2024 antinutritional split is a
  **fixture for existing machinery**, not a new type — a smaller lift than the relay implies.
- **§4b Specification / RegulatoryLimit should be types that are NOT `Determination`s**, so
  "a limit cannot render in a measurement slot" is a compile-time guarantee, not a runtime
  check.
- **Total-THC formula feeds `Eligibility`** (attestation-core) cleanly; 0.877 confirmed twice
  (handbook verbatim + arithmetic).

## E · Deltas that are UNBLOCKED vs still-gated

- **`SeedDescriptor` (§5a–b): unblocked** — an *adoption* of the handbook V3 schema, field
  names/datatypes/units verbatim, PUID key, method-as-field. The handbook is now read in full.
- **`SoilPanel` (§4a-i): unblocked and honest** — build it as a labelled extension; its
  `NotMeasured { basis: NoSoilPanel }` depends on the §4a absence-reason design (§D).
- Everything else in §7 (chlorophyll, aggregation, cross-panel reconciliation, GRIN export,
  three-types split, the §4c fixture) is additive and consistent.

## F · Status

Queued behind F-4, per the relay. Not built. **Not pushed** — this mount is the stale `607ce4a`
and holds the founder's un-committed relays; a receipt beside the relay is symmetric with how
it arrived. When the seed types are built (post-F-4, post-RELAY_09), this becomes a WELLness
`dockets/` entry against `food-composition`/`fat-profile`. Say the word to land it durably from
a clean checkout.

Composition, not counsel. Verified against the primary sources in full — and the one version I
read (handbook V3, not the cited V1) is said so.
