# DESIGN BRIEF 02 — the BIGEN library

**ROUTING** · **Destination:** `beehive-nature/docs/` — beside `DESIGN-BRIEF-01-dashboard.md`.
**Delivery:** Code commits. **Audience: the Claude Design session.**

**Read `DESIGN-CONSTRAINTS.md` and `DESIGN-BRIEF-01` first.** This extends them — it does not restart. Every constraint there still binds: two gauges, honest absence, colour never sole channel, reading levels, logical properties for RTL.

**The dashboard work stands. This is the second surface, not a revision of the first.**

---

## 0. WHAT THIS IS

**BIGEN** — **B**eehive **I**ntelli**GEN**ce Meta-anaLYSIS Public Library. A systematic-review library in the Cochrane tradition, with four properties Cochrane structurally cannot retrofit:

| | Cochrane | BIGEN |
|---|---|---|
| Searches | run by hand; reviews go stale for years | standing queries on a schedule |
| Access | paywalled across most of the world | public git repo |
| Data | forest plots are images inside PDFs | plots are YAML — anyone recomputes |
| Working | RoB judgments summarised; deliberation gone | git history: every judgment, when, why |
| Dissent | write a letter to the editor | fork, change the rating, show your work |

> **The line that should drive every layout decision: a Cochrane forest plot is an assertion you trust. A BIGEN forest plot is a computation you re-run.**

---

## 1. THE NEW THING — the integrity layer, and it is the hard design problem

Every study carries an `integrity:` block: funding source, manufacturer-funded flag, declared COI, retraction status, pre-registration and outcome-switching, and a **results-vs-conclusions gap** verdict.

**Why it exists, empirically:** Lundh et al. 2017 (Cochrane, 75 papers) found manufacturer-sponsored studies more often report favourable results (RR 1.27, 1.17–1.37) and favourable conclusions (RR 1.34, 1.19–1.51) — **while scoring *better* on standard risk-of-bias for blinding (RR 1.25, 1.05–1.50)**, with *less* agreement between their own results and conclusions (RR 0.83, 0.70–0.98).

**Translation for design: the bias is not in the method section. It is in the sentence after the table.**

### ⚠ The design tension, stated plainly

**An integrity layer can very easily make this library look like a conspiracy board.** Red flags, warning triangles, accusatory chips — and the whole thing reads as advocacy, which destroys the only asset it has.

**The design job is to make bias data read as *measurement*, not accusation.**

Three constraints that follow, all ruled:

1. **`manufacturer_funded` is symmetric and applies to us.** A cannabis producer funding a cannabis trial gets the identical flag as a pharma company. **A BNR- or SKAISTS-funded study gets it too.** So the chip cannot be styled as a taint — it will sit on our own work. Design it as a *provenance fact*, in the same family as a method stamp.
2. **Integrity never auto-downgrades the GRADE rating.** It renders *beside* the estimate, never folded into it. A fork may weight it; the library does not weight it for you. **Visually: adjacent, never overlapping the number.**
3. **Retraction records the dispute, not the verdict.** `retracted · stated cause: X · disputed: true` renders all three parts. **The surface must never editorialise intent** — it shows what happened and that the explanation is contested.

**Worth several variations.** This is the most distinctive surface in the system and the one with no precedent to borrow from.

---

## 2. THE THREE OBJECT TYPES — they must not look interchangeable

| Type | Contains | Output artifact |
|---|---|---|
| **Review** | RCTs, poolable | forest plot |
| **Evidence map** | in-vitro, animal, mechanistic — **not poolable** | tier-tagged claim table |
| **Register entry** | a study record from a standing query | metadata card |

**A review and an evidence map must be visually unmistakable.** Rendering a mechanistic corpus with forest-plot furniture would assert a poolability that does not exist — the exact category error these documents warn about. *Negative control: an evidence map that renders with a pooled estimate → fail.*

---

## 3. REAL DATA TO RENDER — all of it verified, none invented

### A forest plot (the review type)

```
comparison: high-cbd-combination-vs-placebo
outcome:    agitation (CMAI / global clinical improvement)
model:      random-effects
  NCT03328676  Avidekel 30:1   n=64    RR 2.00   NNT 3.3
  NCT05644262  LiBBY 50:1      n=120   RR 2.75 → 3.69
POOLED:      RR 3.08   95% CI 2.08–4.54   I² 50%   n=180
caveat: PRELIMINARY — pools two different response definitions
```

**Note what has to be visible: `I² 50%` and that caveat are not footnotes.** Moderate heterogeneity and a pooled-across-definitions warning are part of the estimate, not decoration on it.

### A tier table (the evidence-map type)

| Claim | Tier |
|---|---|
| Cannabinoids down-regulate telomerase in cancer | **SUPPORTED** |
| Cannabinoids up-regulate telomerase in normal cells | **UNTESTED** |
| A single mechanism drives both directions | **UNTESTED** |
| Endocannabinoid tone declines with age | **SUPPORTED** |
| Boosting CB2 tone uniformly slows senescence | **REFUTED as universal** |

**Five tiers to design: SUPPORTED · MIXED · UNTESTED · REFUTED · REFUTED-AS-UNIVERSAL.**

> **`UNTESTED` is the important one and it belongs to the honest-absence family from BRIEF-01.** It does not mean "we don't know" — it means *no study has asked this question*, which is a finding. It must not look like a gap in our work, and it must not look like a negative result. **Same problem as `Absent { reason }`, different room.**

### A gap map (the highest-value single artifact)

```
                    plant-derived    synthetic
broad spectrum      Avidekel·LiBBY      —
isolate                  —          dronabinol·nabilone
```

**Every trial sits on one diagonal. None crosses it.** The empty cells are the finding — this is the clearest case in the whole system of *absence rendered as information*.

### Two integrity blocks — and they must be two, not one

> **⚠ CORRECTED 2026-07-21.** The first version of this section was a **chimera**: it paired LiBBY's registration (`NCT05644262`) with a results-vs-conclusions quote-pair taken from **Hussein 2014**. Two different studies in one block. The design session implemented it faithfully, which put a **false `conclusion_overstates` flag on a real registered trial.** *That is the symmetry law failing in the other direction, and falsely flagging someone is worse than missing one.* Corrected below — the defect was mine.

**Block 1 — a registered trial, manufacturer-funded, NO gap.** This is the more important specimen:

```
study:        LiBBY · NCT05644262
funding:      manufacturer_funded: true
retraction:   none              last_checked: 2026-07-21
registration: registered_before_enrollment: true   outcome_switching: no
results_vs_conclusions: aligned
```

> **A manufacturer-funded trial whose conclusions match its results is the whole argument.** It proves `manufacturer_funded` is a **provenance stamp, not a verdict** — the flag is present, the study is sound, and both facts render without contradiction. **Design this one first**; if it reads as an accusation here, the tone is wrong everywhere.

**Block 2 — an unregistered mechanistic study, WITH a gap.** Lives on the evidence-map side, where Hussein actually sits:

```
study:        Hussein 2014 · in vivo · mouse · UNREGISTERED
funding:      manufacturer_funded: false
indirectness: HIGH — ~2:1 THC-dominant (67.9/32.1), inverse of the CBD-dominant corpus
results_vs_conclusions: conclusion_overstates
  MEASURED: "TERT mRNA 116.13 → 2.29 copies"
  CLAIMED:  "leads to down regulation of telomerase activity"
  NOTE:     no telomerase activity assay (TRAP) was run
```

**The MEASURED/CLAIMED/NOTE triple is the substance, not a tooltip** — it quotes both sides so a stranger can check us without special access.

**Hard rule that falls out of the correction: an integrity block belongs to exactly one study.** Registration, funding, and the conclusions-gap must all describe the same record. *Negative control: an integrity field sourced from a different study than the one it renders on → fail.*

---

## 4. WHAT MAKES THIS SURFACE DIFFERENT FROM EVERY REVIEW SITE

**The recompute affordance.** The pooled estimate is derived from study rows that are all on screen. **A reader should be able to see that the number came from the rows above it** — and ideally that they could change a row and watch it move.

**Do not design a "trust us" number.** Design a number that visibly has parents.

**Freshness is a first-class datum.** `last_run` and `new_since_last` on every standing query. A living review advertises when it last looked; a stale one cannot hide.

---

## 5. THE DELIVERABLE I'D ASK FOR

**One comparison page, in three states:**

1. **Clean review** — pooled estimate, study rows, all integrity blocks unremarkable.
2. **Contested** — one study `manufacturer_funded`, one `conclusion_overstates`, `I²` moderate, a PRELIMINARY caveat live. **This is the real deliverable** — it is the state most pages will actually be in.
3. **Evidence map** — the tier table with `UNTESTED` rows and the gap map. **No pooled estimate anywhere on the page.**

**Plus one small thing worth getting right early:** the `manufacturer_funded` chip rendered on a study *we* funded. If it looks like an accusation there, it is wrong everywhere.

---

## 6. NOT YET

**Don't design:** author profiles, discussion threads, submission flows, the fork/PR interface, or search. **Colour tokens are settled** (BRIEF-01 §0) — re-run the contrast check against this surface's own backgrounds before trusting AA.

---

*Cochrane's rigour, in a repo anyone can clone, with plots anyone recomputes and ratings anyone forks — and a bias layer that points at its own authors first. The rigour is the weapon; it just has to point outward and inward with equal willingness.*
