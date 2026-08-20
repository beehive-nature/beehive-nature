# SPEC-BIOMASS-RIVER-1 — one source river, N downstreams, docked autonomously

**Status:** DESIGN, founder-directed 2026-08-20 · **Seat 3 (Opus 5)**

Founder, verbatim: *"think of hemp/cannabis biomass as our source river of 27k different
product downstreams. build our design to accomidate that autonomously."*

---

## 0 · The architecture already exists in this tree — three times

This is not a new pattern to invent. It is the **dock**, which the organism has now built
three times and can build a fourth without new architecture:

| dock | what docks | the law |
|---|---|---|
| **BlanguageDOCK** | every language | docks without asking anyone; withdrawal honored, history kept |
| **the COA record shape** | every food | *"the scalable part of this work is not hemp — it is the record shape that lets any food drop into the same panel. Add a food by adding determinations; the shape does not change."* |
| **the adapter register** | every chain | enters by founder word, additive-only, never re-mints |
| **→ the biomass river** | every downstream product | **this spec** |

**"Autonomously" means: no seat ever hand-curates 27,000 rows.** A downstream docks
itself into a fixed record shape; the surface renders whatever has docked; absence
renders as absence. A registry that requires a human to add each entry is a registry that
stops at the number of entries that human had time for — which is the failure this spec
exists to prevent.

## 1 · THE RIVER MODEL — four coordinates, not a list

A product is not an item on a list; it is a **position in a river**. Four coordinates fix
any downstream, and every one of them is a small closed vocabulary rather than free text:

```
FRACTION → PROCESS → CLASS → PRODUCT
```

1. **FRACTION** — which part of the plant the material came from. Closed set:
   `seed-whole · seed-hulled(hearts) · seed-hull · seed-oil · seed-cake/meal ·
   bast-fibre · hurd/shiv · leaf · flower/biomass · root · whole-plant`
2. **PROCESS** — what was done to it. Closed set, extensible by founder word:
   `mechanical(dehull/press/decorticate) · thermal · solvent-extraction ·
   CO2-extraction · fermentation · enzymatic · composite-forming · pyrolysis · none`
3. **CLASS** — the regulatory/market category, which is what actually governs what may
   be said and sold: `food · feed · supplement · cosmetic · textile · construction ·
   paper/pulp · bioplastic · biofuel · phytoremediation · pharmaceutical · other`
4. **PRODUCT** — the leaf node. Free-form name, but it inherits everything above it.

**Why the coordinates and not a flat list:** 27,000 leaf nodes are unmanageable; the
coordinate space that generates them is about **11 × 9 × 12 ≈ 1,200 cells**, most empty.
A surface renders the *space*, and the space stays legible no matter how many leaves
dock. This is the same reason the hexagon renders nutrients rather than foods.

## 2 · THE RECORD — fixed shape, honest absence

Every downstream carries the same envelope. Fields absent are **absent**, never zero,
never inferred:

```
{ id, name, fraction, process, class,
  yield_per_tonne_input: Measurement | NotMeasured,
  regulatory_status: { jurisdiction → status | NotAssessed },
  substitutes: [what it displaces],          // the arbitrage hook
  displaced_footprint: Measurement | NotMeasured,  // Sienna's arm plugs in here
  price: Measurement | NotMeasured,
  provenance: { source_url, date, contributor },
  consent: { … }                              // BRIEF-04's block, symmetric
}
```

**`substitutes` is the load-bearing field**, and it is what makes this more than a
catalogue: a downstream's value is not what it *is* but **what it displaces**. Hurd
displacing concrete carries the concrete's footprint as its avoided cost. That single
field is where the biomass river meets the environmental arm — Sienna's model consumes
`substitutes` + `displaced_footprint` and needs no new schema.

## 3 · AUTONOMOUS DOCKING — the four laws, inherited not invented

1. **Permissionless entry.** Anyone contributes a downstream. No gatekeeper decides which
   of the 27,000 is worthy — the same ruling that governs languages.
2. **Withdrawal honored, history kept.** A contributor may withdraw their own record;
   nobody may delete another's or the history. Surfaces stop rendering; the chain
   remembers.
3. **Honest absence is a first-class state.** A docked product with no yield figure
   renders as *docked, unmeasured* — which is **more useful than an estimate**, because
   it names exactly what the next contributor should measure. The empty cells are the
   recruitment (BRIEF-04's own finding).
4. **Every claim graded at its altitude.** Composition, yield, price, regulatory status =
   **Axis A**, carried in-tree with citations. What a product *does to a body* = Axis B,
   off-repo and GRADE-graded. The class `pharmaceutical` may exist as a coordinate while
   every claim inside it stays behind the wall.

## 4 · THE HONEST PROBLEM WITH "27,000" — our own favourite number needs its receipt

**The 25,000-products figure traces to a 1938 *Popular Mechanics* article, "New Billion
Dollar Crop."** It is repeated everywhere and sourced almost nowhere; the "27k" variant
is repeated even more loosely. If this project publishes it as a headline without its
provenance, we are doing precisely what we accuse the wellness industry of — **and a
reader who checks one number and finds it unsourced will discard the rest of the page,
exactly as they would be entitled to.**

**The design answer is better than the slogan:** the surface does not claim 27,000. It
**shows how many have actually docked** — a live count that starts small and grows, with
the coordinate space visible behind it showing how much room remains. *"1,247 docked of a
space that holds thousands"* is more persuasive than an unsourced 25,000, because it is
checkable and because it visibly recruits. **The number becomes a receipt instead of a
claim.**

**Gate BR-1:** commission the provenance check on the 25,000/27,000 figure — if a credible
enumeration exists, cite it; if it traces only to 1938, say so plainly on the surface and
let the live count carry the argument instead.

## 5 · WHAT EXISTS ALREADY, TO BE EXTENDED NOT REBUILT

`surfaces/blight/coop.html` already renders a ranked hemp-biomass downstream index (the
"criticality index", Core 10) with `dept`, `form`, `spec`, `unit`, `stable`, `clarity`
fields and three `dept:'food'` entries. **That is the river's first tributary and its
field names are close to the record above.** The build path is: generalise coop's row
shape into the SPEC record, keep its criticality ranking as a *view* over the dock, and
open contribution.

**Gates:** BR-1 (the provenance check) · BR-2 (ratify the four coordinate vocabularies —
they are closed sets and closing them is a founder act) · BR-3 (confirm coop.html is the
surface that grows into the river rather than a new page).

**Seat 3 (Opus 5), 2026-08-20.** 🐝
