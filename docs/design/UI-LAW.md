# UI-LAW — the confirmation laws

**Seat: zCode. Opened 2026-08-25, sprint S26-0825 (claims D1, D2).** Two laws about the
moment a user commits. They are siblings: both say **the interface may not change its
meaning out from under the person acting**, one across space (what is shown), one across
state (what a control does).

These are FLOOR laws for every surface in the estate — the Apiary, the explorer, the
LaunchPad when it ships, the wallet lanes. A surface that breaks one is broken whatever
its paint.

---

## D1 · No truncation at the point of confirmation

**At the moment a user confirms an irreversible or costly act — send, swap, list, sign,
burn — every identifying value is shown in full.** The full address, the full amount in
base units *and* in display units, the full item id, the full seed. Middle-collapse,
ellipses, `..`-suffixes and chip-truncation are browsing conveniences; **at the point of
confirmation they are banned.** A confirmation screen is the one place where reading is
the user's whole job, and truncation there converts a check into a decoration.

- Conversion is shown **beside** the raw value, never instead of it: `0.1 INJ
  (100000000000000000 inj)` — not one, not the other.
- Two different values may not truncate to the same glyph. If the renderer cannot
  guarantee distinction, it renders in full.
- A prefix is not an address — not in a confirmation, not in a spec, not in a link. (An
  earlier pass shipped a 37-hex "address" into `EXPLORER_SPEC.md`; the 2026-08-19 census
  caught it. Truncation defects are not hypothetical.)

**Third-party exhibit, read 2026-08:** a major chain's generic ledger confirmation
renders EIP-712 amounts as raw base-unit strings with no denom formatting, *and* its
layout helper truncates nested titles to the last 16 characters behind `..` — so
sibling fields collapse to visually identical titles on the one screen whose entire
purpose is to let a human notice the difference. We do not inherit that shape.

---

## D2 · The swap affordance may not be shared between empty and holder states

**A control that does one thing when the wallet holds nothing may not quietly do another
when the wallet holds something.** Concretely: the same button cannot be "swap" for an
empty wallet — safe, boring, fungible — and "swap, and this destroys your inscription"
for a holder. **Empty-state and holder-state affordances are separate controls, with
separate labels, or the same control with the destructive consequence named on its face
in the holder state.**

The origin is on-chain, not aesthetic — `SPEC-INSCRIPTION-COMPAT-1` §2.4, measured
2026-08-20: transferring an inscription toward a pool **destroys it** (burn reason
`TO_SOURCE`, 5,934 occurrences). In this family, **a swap button beside an inscription
is a delete button wearing a trade label.** The user learns the button's meaning in the
empty state, where it is honest, and carries that training into the holder state, where
it is lethal. That is the same defect class as the magic-amount trap (§2.2): one
control, two semantics, selection by hidden state.

**The rule, stated once for everything:** wherever a control's effect depends on state
the user cannot see from the control itself, the surface must make the state visible at
the control — and when the effect is destructive, D1 applies in full: the consequence is
spelled out, untruncated, at the point of confirmation.

---

*Amendments to this file are by ordinary commit with the incident that earned them. A
law without its origin story is a rule wearing a law's clothes.*
