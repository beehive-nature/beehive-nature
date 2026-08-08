# SURFACED — SPEND RECEIPT PRIVACY POSTURE (2026-08-08)
**From:** Cowork (document seat) · **To:** Seat 0, via Fable
**Re:** `SPEC-SPEND-RECEIPT-1.md` §5 fence-hold, surfaced first at founder direction.
**Nature:** OPTIONS + structural finding. **This document rules nothing and recommends
nothing.** Per standing fence: bring options, do not design.

---

> # ⚠ NARROWED 2026-08-08 — READ THIS FIRST; MOST OF THIS DOCUMENT IS NOW MOOT
>
> Code's narrowing was **accepted**, and it collapses the option space. **Do not research
> or design the settled parts.** What is now settled:
>
> 1. **Accounting exists and the spender sees it** — already ruled: *"autonomy hides the
>    mechanism, never the accounting."* So **suppressing the receipt was never on the
>    table.** Options B (private-by-default) and E (delayed disclosure) are moot as
>    *privacy* mechanisms — they would suppress the spender's own accounting, which the
>    KISS ruling forbids.
> 2. **Financial privacy comes from RAIL SELECTION, not from hiding receipts** — founder:
>    *"if I don't want people to see my balance/transfers I use zano."* This supersedes my
>    §1 framing. I argued the decision was about concealing **linkage**; the sharper truth
>    is that a user wanting financial privacy **chooses a private rail**, and the receipt
>    then faithfully records a spend that was already private at the rail. **The receipt is
>    not the privacy instrument. The rail is.** Option C (aggregate-public /
>    itemized-private) is therefore solving a problem the rail already solves — and solving
>    it worse, since §3's invertibility caveat applies.
> 3. **Persona-scoping (Option D)** remains the house pattern by the `.b` privacy law and
>    the multipersona ruling — it is not in question and needs no new decision here.
>
> ## THE SINGLE OPEN QUESTION — awaiting founder word
>
> **VISIBLE TO WHOM?** Three candidates, nothing else:
>
> | | Visibility | Note |
> |---|---|---|
> | **1** | **Spending bDiD only** | Maximum confinement. The spender's own accounting is guaranteed either way, so this is the floor, not a compromise |
> | **2** | **Spending bDiD + parent** | Follows `RULING_BDID_HIERARCHY` — agents root under `bQueenBee` or a human bDiD; a parent funding an agent arguably needs sight of what its agent spent |
> | **3** | **Public** | Maximum auditability; matches the receipt-rail doctrine |
>
> **The one carry-forward from §4 below that still applies:** *the asymmetry is not
> symmetric.* Narrowing visibility later works for **new** receipts; widening it later
> cannot un-publish receipts already written. That property is unaffected by the narrowing.
>
> Everything below is **preserved unedited** as the record of the wider survey
> (promote-don't-erase). Read it as history, not as a live menu.

---

## 1. The finding that reframes the question

The instinct is to ask *"should spend receipts be private?"* That is **not the live
question**, because a large part of the answer is already fixed by the rails and not by us:

**Any line item carrying a `rail_receipt` is ALREADY PUBLIC on that rail.** An Arbitrum gas
payment, a Vaulta action, an Autonomi chunk payment — those are on public ledgers the moment
they happen. No receipt-visibility policy can retract them. A `chain_fee` line item is a
*restatement* of something the world can already read.

**So the decision is not about concealing spends. It is about concealing the LINKAGE.**

The spend receipt's novel disclosure is that it **binds many rail activities to one bDiD in
one object**. Individually those events are public but scattered across chains; aggregated
under an identifier they become a behavioural profile — which rails, which resource classes,
what volume, what cadence, over time.

This is **structurally identical to the finding already ruled in the `.b` privacy law**:
*"one handle aggregating ALL your chains = a linkage map."* Spend receipts are that same
hazard, with two aggravations:

1. **`.b` records are opt-in publications.** Spend receipts are **generated automatically by
   operation** — they accumulate whether or not anyone chose to publish them.
2. **The hierarchy propagates it.** Agents root under `bQueenBee` or a human bDiD
   (`RULING_BDID_HIERARCHY`). A public agent spend-trace is therefore a **side channel on its
   parent** — an agent's cadence and volume leak inferences about the human above it, even if
   that human's own receipts are private.

## 2. What is already ruled and constrains any choice

| Ruled | Bearing |
|---|---|
| `.b` privacy law — records **optional**, **persona-scoped**, personhood root never in a record | Establishes persona-scoping as the house pattern for exactly this hazard |
| Multipersona ruling | Different personas must not be linkable through their spend |
| Spend view = **total first, itemized beneath** | The UX already separates two disclosure levels — see Option C |
| Free at point of use governs **access**, spend receipts only exist for **resource consumption** | Bounds the volume: no receipts for mere use |
| Autonomi `put_private` / DataMap held locally | A private substrate already exists in the stack — this is a real option, not a hypothetical |
| Repo-is-the-record; receipt discipline | Pulls toward auditability; is in genuine tension with privacy here |

## 3. The option space (five; not mutually exclusive)

**A · Public by default.**
Maximum auditability, simplest implementation, matches the receipt-rail ethos. Worst
linkage exposure; irreversible (a published trace cannot be unpublished).

**B · Private by default, holder-revealable.**
Receipts to Autonomi private storage; DataMap held by the spending bDiD; disclosure is a
deliberate act. Strongest privacy, preserves auditability *on demand*. Cost: a private
receipt cannot be independently verified by a third party without the holder's cooperation
— which weakens receipts as a trust instrument precisely where trust is needed.

**C · Aggregate public, itemized private.**
The `total` is public; `line_items` are private. **Maps exactly onto the already-ruled UX
shape** (one number by default, breakdown one level down), so the privacy boundary and the
interface boundary become the same boundary — which is elegant and easy to explain.
**Caveat that must be stated:** if rates are public and an operation has few line items,
the total may be **invertible** back to the items. The protection is real for complex
multi-rail operations and weak for simple single-rail ones.

**D · Persona-scoped (composable with any of A–C).**
Receipts bind to the **persona** that spent, never to the personhood root; separate personas
are unlinkable by construction. This is the house pattern already ruled for `.b`. Does not
by itself decide public-vs-private — it decides *what identifier appears*.

**E · Delayed or epoch-batched disclosure (composable).**
Publish after a delay or in aggregated epochs. Blunts real-time behavioural tracking and
cadence analysis while retaining eventual auditability. Cost: complexity, and it weakens
receipts for real-time dispute resolution.

## 4. The tension to decide, stated plainly

**Auditability and unlinkability pull in opposite directions here, and no option gives both
in full.** The project's receipt doctrine says *the record of truth is the BNR-controlled
rail*; its custody doctrine says *no user incarceration, no behavioural capture*. A spend
receipt sits precisely where those two meet.

Worth noting for whoever decides: **the default is the decision.** Whatever posture ships
first will be the posture for nearly every receipt ever written, because receipts are
auto-generated and few users change defaults. And **the asymmetry is not symmetric** — a
default-private posture can be relaxed later for new receipts, but a default-public posture
cannot be retracted for receipts already written.

## 5. What this does NOT touch

Rate values, rate authority, `receipt_id` derivation, signing, storage location, batching —
all remain fence-held in `SPEC-SPEND-RECEIPT-1.md` §5. This document surfaces **one** of the
six, as directed.

**No option above is recommended. The schema is deliberately posture-agnostic** — it can
serve any of A–E without a schema change, which is why surfacing this now costs nothing and
deciding it later costs nothing either.
