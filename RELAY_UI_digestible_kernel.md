# RELAY · THE DIGESTIBLE KERNEL — composition on the bar, claims in the drawer
**From:** Cowork/design seat · **To:** Code · **Date:** 2026-07-19
**Founder:** *"how do we take this critical knowledge and produce digestible kernels users can comprehend. Your colored FAT bar to show the different types is classic."*
**Lineage:** D-1 (colour law) · D-12 (composition surfaces) · k001 (the health-claim wall) · `RELAY_SEED_lipid_cannabinoid_taxonomy.md` · `RELAY_SEED_sources_GRAS765_and_descriptors.md`

---

## 1. The unit, and why the pun is load-bearing

A **Kernel** is the seed's edible core and a unit of knowledge small enough to digest. **One food fraction, one bar, one drawer.**

```
┌─────────────────────────────────────────┐
│  KERNEL                                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ COMPOSITION — the bar             │  │  ← Axis A. What is in it.
│  │ measured, method-stamped, in grams│  │     Measured<T>. On-repo.
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ CLAIMS — the drawer               │  │  ← Axis B. What people say it does.
│  │ each graded, each sourced         │  │     GRADE-badged. Off-kernel.
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**The founder's message contained three effect claims** — THC and longevity, CBD and a term needing clarification, MCT versus carbohydrate energy. **None of them may touch the bar.** They live in the drawer, graded and sourced. That is not a refusal — it is the only structure in which they can be shown *at all* without BNR asserting health outcomes.

**The invariant:** `the drawer never changes the bar.` A claim cannot recolour, resize, reorder, or annotate a composition segment. **Serialisation test: a `Claim` reachable from a `Composition` type → fail.**

---

## 2. The bar — a universal vocabulary, not a hemp chart

**Every food fills the same slots.** That is what makes it teach: the user learns one bar once, then every food they scan speaks it.

| Slot | Hemp hearts /100 g | Where it dominates |
|---|---|---|
| Saturated | 4.6 g | butter, coconut |
| **MCT (C6–C12)** | **0.0 g** | coconut, palm kernel |
| Monounsaturated | 5.4 g | olive oil |
| **Omega-6** | 28.5 g | **hemp, most seed oils** |
| **Omega-3** | 8.7 g | **hemp, flax** |
| **In the oil, not fats** | **1.6 g** | every whole-food oil |

**FOUNDER CORRECTION — MCT is not a hemp seed fat.** MCTs are C6–C12; hemp seed is dominated by C18 polyunsaturates. Hemp reads **~0** for MCT. **The slot still ships** — because a slot that reads zero teaches as much as one that reads high, and because the bar has to work for coconut too. **Keep the slot, keep it honest, and let the comparison do the teaching.** (Whether MCT is *essential* is an Axis B claim; it goes in the drawer with everything else.)

**Cannabinoids belong in the sixth slot, not in a fat slot.** "In the oil, not fats" is where the phytocannabinoids, tocopherols, phytosterols, glycerol, waxes and chlorophyll live — the §2 residual from the taxonomy relay. It is hatched, not solid, because **it is defined by what the fatty-acid panel cannot see.** ISO 12966-1:2014 measures FAMEs; everything in that slot is outside its scope by the standard's own definition. **The 1.6 g finally has a home that explains itself.**

**Endocannabinoids, when ever measured, are lipids and would sit in the fat region — not the hatched slot.** Two chemically different families under one word; the bar must not merge them (see taxonomy §3A).

---

## 3. The drawer — how a claim is allowed to appear

Every `Claim` renders with three things, always, no exceptions:

1. **The claim text**, stated as a claim: *"What people claim about this."*
2. **A GRADE badge** — `High | Moderate | Low | Very low | Ungraded`
3. **A source**, or the visible absence of one — `No source attached`

**`Ungraded` + `No source attached` is the correct default and it must be visible.** A claim with no evidence behind it is neither hidden nor promoted — it is shown wearing exactly what it has, which is nothing. **That is the disclosure mission applied to the claim layer: nothing is suppressed, and nothing is dressed up.**

**Negative controls:**

| Control | Must |
|---|---|
| A `Claim` rendered without a grade badge | **fail** |
| A `Claim` rendered without a source slot (even an empty one) | **fail** |
| A grade assigned without a completed assessment record | **fail** — no inventing "Low" to look rigorous |
| A `Claim` reachable from `Composition` | **fail** — serialisation test |
| Drawer content altering any bar segment | **fail** |
| BNR listed as the attestor of any Axis B claim | **fail** — BNR hosts claims, never makes them |

---

## 4. Digestibility is a reading level, and reading level is a preference

The same Kernel renders at **plain / standard / technical**. Identical numbers, identical method stamp — only the prose changes.

- Plain: *"Your body cannot make this. Food is the only way."*
- Standard: *"Linoleic acid, plus a little GLA. Essential — the body has no pathway to build it."*
- Technical: *"Linoleic (18:2 n-6) + γ-linolenic (18:3 n-6). ~58% of total fatty acids."*

**Reuses `Preferences.reading_level` — already ratified. Access is a preference, never a credential.** Nobody proves anything to read the plain version, and the technical version is not a reward. **Negative control: reading level altering any displayed value → fail.** Prose changes; numbers never do.

---

## 5. Accessibility — colour is never the only channel

Carried from the F-4 audit and D-1:

- Every segment carries **colour + text label + gram value**; the non-fat slot additionally carries a **hatch pattern**. Remove all colour and the bar still reads.
- Segments are **buttons with `aria-label`** naming type and value — the bar is keyboard-navigable and screen-reader legible.
- Zero-value slots render as a **dashed outline in the legend**, never as an invisible gap. **An absent nutrient and an unmeasured nutrient must not look the same** — the same rule as `NotMeasured`, at the pixel level.
- Palette from the Forest categorical set; contrast verified in both modes before the surface is granted.

---

## 6. Build order

**Not now.** This is queued behind the C-5 palette pass, the multi-source backbone, and the RELAY_09 reassessment. Recorded so the types are right when their turn comes.

1. `Composition` + `FatSlot` types; the six-slot vocabulary; ISO 12966 method stamp.
2. The serialisation test **first** — `Claim` unreachable from `Composition` — before any rendering code exists.
3. Bar rendering with the four-channel encoding (colour, label, value, pattern).
4. `Claim` + `Grade` + `Attestor` types; the drawer; the six negative controls.
5. Reading-level binding to existing `Preferences`.

---

## 7. Open, for the founder

**"CBD Regard to prevent ACiD" — I do not know what ACiD refers to.** Acidosis? Alzheimer's? Something else? **I have left it as `[term needs clarification]` rather than guess**, because guessing at a health claim and then building a container around the guess is how a wrong claim gets structural support. Tell me the term and it goes in the drawer properly, graded like the rest.

---

*Composition on the bar; claims in the drawer; the drawer never moves the bar. Founder rulings are law; the tree is the oracle.*
