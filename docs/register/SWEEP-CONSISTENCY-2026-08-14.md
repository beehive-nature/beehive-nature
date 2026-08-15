# CONSISTENCY SWEEP — five live items (Cowork, 2026-08-14)
**Lane owned end-to-end.** Method as ruled: **verify programmatically · fix what is
arithmetic · flag what is a ruling · record superseded forms.**
**Result: 2 FIXED · 3 FLAGGED FOR RULING · 1 earlier flag WITHDRAWN.**

> **The dividing line I applied, stated once:** if a claim contradicts **its own inputs**, it
> is arithmetic and I fixed it. If it contradicts **another ruled text**, choosing a winner
> is a ruling and I flagged it. **Superseding tokenomics by tidying a document is how a
> ruling gets made by whoever edits last.**

---

## ✅ 1. FIXED — `docs/bdomain-scaling.md:109`, the RAM ceiling

**The stated figure was impossible against its own premise, not merely stale.**

```
76,128,906,582 / 5,983  =  12,724,203.0055   →  12,724,203
document stated                                 12,724,536   (+333)
12,724,536 × 5,983      =  76,130,898,888   →  1,992,306 bytes MORE than the free pool
```

**Corrected to 12,724,203**, with the live-chain figure **12,693,415** recorded beside it —
**attributed to Seat 1, not measured by Cowork.** Also noted in the doc: **the ceiling moves
with the pool, so any number here is a snapshot, not a constant** — which is the reason it
went stale in the first place and will again.

## ✅ 5. FIXED (by supersession, not edit) — the `~420 b/sec` rate

**Measured rate is `84 bits × 7 Hz = 588 b/sec`** since the frame grew to 84 bits.
`docs/UX-OPTICAL-PAIRING-1.md:114` **already carries 588** and calls ~420 the old brand; the
three code comments already explain ~420 as a v1 floor. **Two documents were stale:**

| file | action | why this action |
|---|---|---|
| `RECEIPT_BLIGHT_NAMING_2026-08-14.md` | **supersession note APPENDED; ruled line untouched** | Founder-ratified naming receipt. **A brand is superseded by a later ruling, never by a transcriber.** |
| `DISPATCH_DESIGN_BLIGHT_BCOMB_2026-08-14.md` | banner added, body left | Another seat's dispatch — same pattern as the Leptos supersession |

**⚠ THE UNIT COLLISION GOT SHARPER, NOT WEAKER.** `~420 b/sec` sits beside `418.5 KB/s`
— **~1000× apart in units** — and the b/sec figure is now **also 40% low**. **One line, two
independent ways to misread it.**

## ↩️ WITHDRAWN — `bComb` vs `bcomb` was never a contradiction

**`bComb` is the frame format; `bcomb` is the crate, lowercase because Cargo requires it.
Both correct.** My earlier INDEX flag is withdrawn and the withdrawal is recorded in the
receipt itself, so the flag does not outlive its own correction.

---

## ⚠ 2. FLAGGED — the 216 cap and rank-rationed invites contradict ratified text

| claim | in-tree anchor |
|---|---|
| `b-tokenomics.md:222-224` — *"reject 7776 globally… use **6³ = 216** as the venue-local shard target"* | — |
| **CONTRADICTED BY** `SPEC-ORIGINATION-1.md:341` — *"≤ **7776** humans per DAO … `cascade.rs` `FULL_HOUSE`/`CAP` … **exact**"*, and §4e:1502-1509 quoting the founder: genesis *"max's at 7776 members + queen.b"* | ✅ verified |
| `b-tokenomics.md:161-165` — *"invites are rationed by rank… **Adopt.**"* | — |
| **CONTRADICTED BY** `SPEC-ORIGINATION-1.md:1756` — *"the ratified text permits **no invitation, sponsor, or fee at any size**"* | ✅ verified |

**⛔ CITATION NOTE, and it is the CD-13 shape again:** `PERSON-1` and `cascade.rs` are **not
in this repository** — `git ls-files` returns **zero** matches for either. `PERSON-1:129` is
quoted *inside* `SPEC-ORIGINATION-1.md:3016`, and `cascade.rs` is cited there as the code
anchor, so **the ruling is verifiable in-tree while its two primary sources are not.** A seat
told to "check `PERSON-1:129`" finds nothing and may conclude there is no anchor. **There is
one; it is `SPEC-ORIGINATION-1`.**

**NOT FIXED.** Marking b-tokenomics as superseded is a tokenomics ruling. **Flagged before
someone builds from it**, which was the ask.

## ⚠ 3. FLAGGED — the dormancy conflict is head-on, and one side is load-bearing

| side | text |
|---|---|
| `b-tokenomics.md:362` | after **3 consecutive epochs (84 days)** with no attestation, **burn 5% of the dormant reserve per epoch** — *"the one deflationary sink that needs no external demand"* |
| `b-collateral-lending.md:18` | **"Settled inputs assumed: … dormancy defers and never forfeits"** |

**These cannot both hold.** And the asymmetry matters: **the collateral spec does not merely
disagree — it BUILDS ON the opposite assumption as a settled input**, so if the burn stands,
that spec's foundation moves. Meanwhile the burn clause is, by its own text, **the only
holding-side concentration brake in either document.**

**Ruling needed, and it is not a wording choice.** Whichever way it goes, the loser's
dependents need re-checking — the collateral spec's derivations if the burn stands, the
concentration analysis if it does not.

## ⚠ 4. FLAGGED, AND THIS ONE IS PUBLIC — the corpus promise is unbacked

| surface | text |
|---|---|
| `surfaces/onboarding/index.html:218` **(user-facing)** | *"**BNR is building a voluntary language corpus** — including tribal and uncommon languages the big platforms skip … Ask us how to contribute yours."* |
| `crates/language-authority/src/lib.rs:1` **(ratified law, order C-4)** | *"`language-authority` — **BNR holds an interface, never a corpus.**"* |

**The live page promises exactly the thing a ratified law forbids.** The crate's own header
says it *"is the enforcement of a law that was previously enforced by nothing, which made it
a promise rather than a guarantee"* — **and the onboarding page is that promise, still being
made, to users, today.**

**NOT EDITED — user-facing copy is Design's lane** (and the copy sweep is already dispatched
to them). **But this is the highest-urgency item in the sweep**: the other four are internal
inconsistencies; **this one is a public commitment contradicting our own ratified law**, and
it is being shown to people right now.

---

## DISPOSITION

1. **Two fixes landed** — the RAM arithmetic (impossible against its own inputs) and the rate
   supersession (by note, never by editing ruled text).
2. **Three need rulings, none of them mine:** the 7776/216 and invite conflicts (tokenomics),
   the dormancy conflict (and its dependents), the corpus promise (Design + a ruling on which
   side is true).
3. **`PERSON-1` and `cascade.rs` are not in this repo.** Anyone citing them should cite
   `SPEC-ORIGINATION-1.md` instead, which is in-tree and carries both.
4. **Nothing in this sweep was normalized, tidied, or quietly harmonised.**
