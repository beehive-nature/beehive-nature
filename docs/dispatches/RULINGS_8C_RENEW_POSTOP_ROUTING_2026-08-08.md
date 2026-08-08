# RULINGS — LAW 8c · `renew` BOUNDING · POST-OP NOTE · SPEC ROUTING (2026-08-08)
**Authority:** Seat 0 (King Bee). **Filed by:** Cowork (document seat).
**To:** all seats. **Status:** CANON.

## 1. LAW 8c — ADOPTED
**Provenance survives the relay.** A claim's author travels with the claim;
**addressed-to is never rewritten as originated-by.** Relaying another seat's work means
naming who made each claim; being credited with something you did not say means **flagging,
not absorbing.** Companion to 8a — **8a stamps WHERE a claim came from, 8c stamps WHO MADE
IT.** Full text in `FABLE_STANDING_LAWS_S2.md` §8c.

## 2. `renew` BOUNDING — CLOSED. Already ruled; the contract is the defect.

**The ruled design (founder, restated):**
> `.b` domain handles can be **changed once every 28 days** and **MUST BE RENEWED EVERY
> 365 DAYS.**

**The v3 contract contradicts this** — 3,650 days per call, unlimited, stacking, no config
read.

**Classification matters here and is stated deliberately: this is a DEFECT AGAINST THE
RULED DESIGN, not an open design question.** The bound was ruled; the code diverged. That
reframing is the whole finding — nobody needs to decide *whether* to bound `renew`, only to
make the contract obey a bound that already exists.

**It is also the exact leak** that would drain the per-bDiD name cap: a cap on names is
worthless if a single call can extend a held name by a decade, repeatedly, without reading
config. Same shape as the fee that would have been decorative against `registeracc`-only —
**a bound that one call can bypass is not a bound.**

### v4 spec items — Code's lane, open it
1. `renew` extends by **ONE 365-day term**.
2. `renew` **reads config** (so the term is not hardcoded against a future ruling).
3. `renew` **cannot stack**.
4. **Confirm** a renewed name does **not** consume a new cap slot.
5. **State the cooldown** for a lapsed name returning to the pool.

Items 4–5 are stated as *confirm* and *state* rather than *decide* — they may already
follow from the ruled design; if they do not, they surface as questions rather than being
silently invented.

## 3. POST-OP NOTE TEMPLATE — RATIFIED
Eight fields, standing for **every** operation on code, doc, or media:
**PRE-OP STATE · POST-OP STATE · PROCEDURE PERFORMED · SEATS PRESENT · FINDINGS ·
SPECIMENS · COMPLICATIONS · DISPOSITION.**

Full template, style layer, and forbidden failure modes:
**[`docs/POST-OP-NOTE-TEMPLATE.md`](../POST-OP-NOTE-TEMPLATE.md)**.

Governing line: *a changelog says what changed; a post-op note says what happened, what was
found, what went wrong, and what the next operator must know.* Written for **a later surgeon
who was not present.** SPECIMENS carry crate+ref (8a); SEATS PRESENT carries authorship (8c).

**Naming variance is not ambiguity** — the founder addresses seats by whatever name suits
the moment; **do not ask which seat is meant.** Recorded in the template so no seat burns a
turn on it. Not in tension with 8c: 8c governs provenance of *claims*, not modes of
*address*.

## 4. SPEC ROUTING — onboard/invite spec files under (a) KERNEL DOCS

The onboard/invite spec does **not** map cleanly onto BNRoSe's L1/L2/L3, so filing it under
BNRoSe-N would force a **leg-declaration that isn't true.** File under **kernel docs**;
point at it from BNRoSe later, once the legs are drawn.

> **Don't bend a taxonomy to fit a document.**

*Cowork note:* this directly constrains the BNRoSe-0 Charter's leg-citation rule, which
requires every downstream BNRoSe-N doc to declare which of L1/L2/L3 it serves. That rule
stands **for BNRoSe-N docs** — and this ruling is why a document that cannot honestly make
that declaration belongs **outside** the series rather than inside it with a false one. The
two are consistent: the citation rule has teeth precisely because documents that can't
satisfy it are routed elsewhere instead of fudging it.

## 5. STILL OPEN — `owner` succession (founder word outstanding)

**The problem, restated so it is not lost:** on Antelope the **`owner` permission sits ABOVE
any custom role and can always override it.** So a successor-able role under a
**non-successor-able `owner`** still dies with whoever holds that key.

**Succession phase one is FINAL IN SHAPE but MORTAL AT THE ROOT until this is answered.**
That phrasing is deliberate — the role mechanism is sound and receipted; the mortality is
not a flaw in it but a property of the layer above it. Code standing by; not Cowork's to
answer.

## SHELF
R7 COURSE_SYNC still owed.
