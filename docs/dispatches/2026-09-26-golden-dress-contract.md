# THE GOLDEN DRESS CONTRACT — wallet.html is the register reference (founder ruling 2026-09-26)

date 2026-09-26 · seat zCode · founder ruling: "freeze wallet as the visual/register reference; roll outward by behavior contract, not by screenshots"

## the ruling

**wallet.html = the reference implementation for register behavior.** Every other
surface is EVALUATED AGAINST IT — never independently restyled. The rollout law:

```text
same register semantics      — bee / raver / cypherpunk mean the same thing everywhere
same persistence             — localStorage 'bregister', applied before first paint
same motion contract         — 140ms press, 260ms change, 520ms arrival, eased out
same theme tokens            — the ruled sheet, shipped ONCE (register.js), aliased by pages
surface-specific content only — information architecture stays the page's own
```

This prevents register drift while each surface keeps its own information
architecture. A register changes voice, density and dress — never a number, a
price, a limit, an address, or what a person may do.

## what makes it structural (not prose)

1. **The tokens ship once.** `surfaces/register.js` now carries the contract sets —
   `body[data-reg="…"][data-reg-dress="contract"]` — the full ruled sheet
   (grounds, inks, sovereign ramp, guard/verified/ai/info/biomass, honey
   b-value + b-chip, rose, chart cats, the three type roles, the three radii,
   glow-sovereign, motion timings). **The opt-in attribute is deliberate: the
   rollout is narrow** — a surface activates by setting `data-reg-dress="contract"`,
   never silently. (Five pages — blongevity, bsymposium, bigen, buzz-directory,
   bearth — already consume `var(--reg-*, fallback)`; they activate per-surface,
   each with its own gate, in rollout order.)
2. **The instrument, not screenshots.** `e2e/register-contract.mjs` parses
   register.js at import time (the contract is what actually SHIPS) and asserts on
   any adopting surface: opt-in declared · toggle present/44px · bee default ·
   token fidelity per register (page values == shipped values, drift = fail) ·
   composite dress vector pairwise-different · ruled ground pairings · 140ms press
   motion · voice-swaps-while-facts-stay-identical · persistence across reload ·
   zero text-transform · three screenshot receipts · zero page errors.
   `e2e/wallet-registers.mjs` is the reference consumer of the harness (24/24).
3. **The loader version pin moved consciously**: tour.js → `register.js?v=11`;
   register.test.mjs's pin assertion updated with it (the pin exists so cache-bust
   is never accidental).

## the governance pattern, banked from #228

```text
old decision          — 2026-09-21: do not promote the Bux video address
   ↓
new evidence          — the founder's own hand: paid + uploaded + round-trip-verified
   ↓
explicit reversal receipt — PR body flag + store receipt citing its sources
   ↓
production state changes — My Data renders "✓ Stored on Autonomi" + Watch link, live
```

Corrections are promoted with the reversal trace preserved, never quietly
overwritten. Every future evidence-state correction on a surface follows this
shape: the receipt names what changed, why, and on whose word.

## the next lane (chosen shape, not yet built)

A **dense data/evidence surface** — the primitives the wallet does not exercise:
tables, provenance rows, long-form evidence, status chips. The test: does the
three-register system survive them as ONE design read three ways, or does it
fracture into three unrelated designs? Candidate: or-board.html (status chips +
reachability tables + evidence rows) or record.html (RECORD-law provenance).
The lane adopts `data-reg-dress="contract"`, passes the harness, and adds only a
surface-specific battery for its own primitives.

## verification this landing

wallet-registers 24/24 (harness + fidelity) · register.test 15/15 (pin moved) ·
bdata 100/100 (register.js touched) · estate-source 11/11 · secret-scan clean ·
four-check pre-push battery clean · §7 identity ok.
