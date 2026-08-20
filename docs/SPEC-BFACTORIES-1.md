# SPEC-BFACTORIES-1 — the bio-factory: the river's source, programmed by its demand

**Status:** DESIGN, founder-directed 2026-08-20 · sibling to `SPEC-BIOMASS-RIVER-1`

Founder, verbatim: *"our fully automated robotic autonomous bio-factory bFactories will
program the cannabis plant for the planned harvest downstreams and it grows it harvests
it and delivers it fully autonomously. the bootstrap is human farming"*

---

## 1 · The inversion that makes this more than a greenhouse

An ordinary farm grows a crop and then asks what can be made from it. **A bFactory reads
the downstream dock and grows to it.** The river spec's four coordinates
(`FRACTION → PROCESS → CLASS → PRODUCT`) are not just a catalogue — they are a **demand
signal**, and the bFactory's cultivation plan is a function of that signal:

```
docked demand (river)  →  cultivar + environment + harvest timing  →  fraction yields
        ↑                                                                    │
        └──────────────── delivered, measured, re-docked ────────────────────┘
```

**"Program the plant"** reads precisely, and honestly, as: **select cultivar and control
the growth environment and harvest stage to bias the fraction split** toward what the
dock is asking for. Bast fibre wants a different plant, density and harvest date than
seed; flower wants a third. That is agronomy with a closed loop, and it is achievable.
It is *not* a claim about genetic engineering — if the founder intends that, it is a
separate spec with an entirely separate regulatory surface, and this document does not
assert it.

## 2 · The bootstrap is human farming — and that is ruled law, not a phase

The founder names the bootstrap himself, and the tree already governs it:
**`surfaces/blight/farmers.html` ratified house rule: "the farmer eats first."** The Coop
is *"the hemp farmer's floor."*

**The collision, named and not resolved (§1 of the law book):** a fully autonomous
factory is, read carelessly, a machine that removes the farmer whose priority claim is
ratified. This spec therefore records the constraint rather than assuming it away:

> **Gate BF-1 — the farmer's standing under automation.** Does "the farmer eats first"
> mean (a) farmers hold settlement priority over bFactory output on the same rails,
> (b) bFactories serve only where human farming does not reach — off-season, controlled
> environment, land unsuited to field crops, scale beyond available labour — or (c) some
> ruled combination? **A seat may not decide this.** Until it is ruled, every bFactory
> design document carries the farmer-first law verbatim on its first page.

The honest engineering note that argues for (b) on its own merits: the bootstrap is not a
temporary embarrassment to be automated away. **Human farming supplies the measured
ground truth** — real yields, real fraction splits, real failures — that any autonomous
system needs before it can be trusted to plan a season. A factory built on modelled
agronomy rather than measured agronomy is the "version after version of half built
software" failure the architecture decision already rejected in another domain.

## 3 · Autonomy, stated inside this project's ceiling

The security-language ceiling binds here as everywhere: **never stronger than "sound by
construction / isolated by design."** So:

- **"Fully autonomous"** describes the *operating loop* — plan, grow, harvest, deliver,
  measure, re-plan — not an absence of accountability. Every cycle emits receipts into
  the same escrow/market rails the Coop and Farmers Market already use.
- **Failure is a first-class state.** A crop fails, a robot stops, a sensor lies. The
  design's honesty requirement is that a bFactory reports *what it did not achieve* with
  the same fidelity as what it did — the `NotMeasured` law applied to a season.
- **No hive-operated subsidy** (Article V.1): a bFactory funds its own inputs and is paid
  for its output like any other participant. A factory the hive must underwrite fails the
  ten-billionth-user test in a different costume.

## 4 · What plugs in, already built

| layer | already in tree |
|---|---|
| demand signal | `SPEC-BIOMASS-RIVER-1` — the dock's four coordinates |
| composition truth | `crates/coa` — `Measurement`/`Absence`, `<LOQ ≠ 0` |
| market settlement | `crates/normalizer` — `ProductListed → OrderFunded → OrderShipped`, typed end to end |
| the agreement | bAccords, bQueenBee-refereed (farmers.html) |
| environmental accounting | Sienna's arm — a bFactory's inputs/outputs are exactly its parameters |
| provenance | the eternal ring (Arweave/Autonomi) + Vaulta anchor, per the adapter register |

**The bFactory adds one genuinely new thing: a control loop.** Everything else it needs,
this organism has already built — which is the strongest argument that the sequencing is
right.

## 5 · Gates

| | question |
|---|---|
| **BF-1** | the farmer's standing under automation (§2) — the one a seat may not decide |
| **BF-2** | does "program the plant" mean cultivar + environment + harvest-stage selection (this spec's reading), or does it extend to genetic modification (a separate spec, separate regulatory surface, separate ruling) |
| **BF-3** | first physical scope — a controlled-environment module, or an instrumented partnership with a human farm that supplies the ground truth §2 argues for |

**Seat 3 (Opus 5), 2026-08-20.** 🐝
