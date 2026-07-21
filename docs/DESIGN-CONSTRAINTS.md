# DESIGN CONSTRAINTS — what is already ruled, and why

**Read this before designing any BNR surface.** It is not a style guide — visual language, layout and delight are open. **These are the decisions already made, each with the reason, so a new session builds *on* them rather than *into* them.**

**Everything not listed here is yours.**

---

## 1. Two gauges, everywhere — D-14

**Every surface that touches function or value shows both:**

| Gauge | Answers | Denominated in |
|---|---|---|
| **`b`** | *can I do this?* — b available, this function's cost | **function** ("enough for three deployments") |
| **money** | *what does this mean in my money?* | the user's chosen currency |

**And exactly one place shows a rate between them:** the protocol draw facility, on its own surface. **No ambient b/USD ticker anywhere else.**

**Why:** a price that appears on every screen is a market being wished into existence, and `b` is deliberately not in markets. *Two gauges everywhere; one ratio in one room.*

---

## 2. A gauge that cannot vouch for its number says so — never shows one

**If a balance is stale, unfetched, or failed — render that state.** Never a number, never `0`.

**Why:** an empty gauge reading `0` is worse than no gauge. This generalises across every surface: `NotMeasured` carries its reason, `<LOQ` is not zero, a missing lab test is not a clean result. **A violation and a boundary must never look alike.**

---

## 3. Colour is never the only channel

**Every colour-encoded distinction also carries a label, a value, and where useful a pattern.** Remove all colour and the surface must still read.

**Why:** ratified accessibility law — *access is a preference, never a credential.* Colour-blindness, low vision, and monochrome rendering are not edge cases.

**Note for a colour-as-function system:** encoding meaning in colour is welcome and consistent with D-1. **It just cannot be the sole carrier of that meaning.**

---

## 4. Semantic colours may not be repainted to fix contrast

**Tokens like `--b-value` (honey), `--guard`, `--biomass` *mean* something.** If text on them fails AA:

- **change the text**, or
- **step the token darker within its own ramp** (same hue, deeper stop), or
- **invert to a chip** — the token becomes the background with dark text on it.

**Never repaint the token to a different hue.** `--b-value` honey is the colour of `b` across the entire OSe; changing it is recolouring a currency to fit one room.

**Already fixed and not up for re-litigation:** `--ink-dim`, `--guard`, `--biomass`, `--ai`, `--info` were raised to clear AA. **`--guard` especially — a warning nobody can read is not a warning.**

---

## 5. Reading level is a preference, not a tier

**The same content renders at plain / standard / technical. Identical numbers, identical method stamps — only prose changes.**

**Nobody proves anything to get the plain version, and technical is not a reward.** *Negative control: reading level altering a displayed value → fail.*

---

## 6. Claims arrive graded, or they do not arrive

**Any assertion about what something *does* — health, benefit, effect — renders with a GRADE badge and a source, or with `Ungraded · No source attached` shown plainly.**

**Nothing is hidden and nothing is equal.** A claim with no evidence is displayed wearing exactly what it has: nothing.

**Composition (what is in a thing) and effect (what it does) never share a visual layer.** The composition bar is measured; the claims drawer is graded. **The drawer never changes the bar.**

---

## 7. Show the ceiling before someone hits it

**If an action requires a standing the user does not have, their current standing and what raises it must already have been visible — not revealed at the moment of refusal.**

**Enforced in code:** `gate_on_settlement` takes a `GradeDisclosure` witness that only the render path can mint. **A gate without a prior disclosure fails to compile.** The surface obligation is to actually show it.

---

## 8. Consent surfaces show the numbers, not a link to them

**Where a person consents to anything — a data release, a persona binding, a regulated purchase — the relevant figures are rendered on the consent surface itself.**

**A link, a log entry, or "available on request" fails.** Available is not the same as shown. **The number has to be in the room when the choice is made.**

---

## 9. Read-only comes first, and needs no identity

**The commons — composition data, published COAs, price feeds, the DAO dashboard — is readable by a stranger with no account.**

**Why:** someone deciding whether to trust this must be able to read it first. *Negative control: a commons surface requiring authentication to read → fail.*

---

## 10. Hardware and biometrics are preferences, never doors

**No entry path may require a purchase.** Platform passkeys are free and built into every modern OS; that is the floor.

**Why:** fingerprints fail on field-worn hands, ECG fails with arrhythmias, in-ear fails on anatomy. **A biometric door excludes specific people permanently, and they are the people this exists for.**

---

## 11. Interpretive frameworks are presentation, never mechanism

**Narrative framing — a journey, an initiation, an energetic language — is welcome as *presentation*.**

**It may never feed governance, reputation, emission, or eligibility.** Article VII §1 names Human Design explicitly: *"Subjective worldviews never become consensus mechanisms."* NC-VII1 enforces it in code at meta-tier.

**In practice: theme freely, gate never.** If progression through a narrative unlocks capability, that is a mechanism and it is out of bounds.

---

## 12. RTL is a first-class layout, not a mirror

**D-13.** Right-to-left is a supported reading direction from layout onward, not a CSS afterthought.

---

## The one-sentence version

> **Show what is true, show what is missing and why, never let colour carry meaning alone, never let a purchase or a credential stand between a person and the commons — and everything else is yours.**

---

## Where the reasoning lives

These derive from D-1 (colour), D-13 (RTL), D-14 (denomination), the F-4 contrast rulings, NC-VII1, PoUL, the Article II Evidence invariant, and Article VII §1/§5. **Each has a fuller argument behind it; ask before overriding one, because most were paid for.**
