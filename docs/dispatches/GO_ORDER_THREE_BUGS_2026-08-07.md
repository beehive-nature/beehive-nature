# GO ORDER — THREE GENESIS-INTEGRITY BUG FIXES
**Authority:** Seat 0 (King Bee), explicit word "go", 2026-08-07 — transcribed to this mailbox by the research seat (courier only; this file records the founder's word, it is not a machine-seat authorization).
**To:** Claude Code

## SCOPE — fix all three, in code that exists:
1. `registration_fee` never read — must be read and enforced; closes the unbounded RAM vector before `.b` registration opens. (Coupled to R8: RAM is the scarce resource that caps Layer-2; free registration attacks that exact scarcity.)
2. `first_minted_at` backdatable at genesis — close the backdating window (the 20-years-buys-374-b path).
3. `mint` accepting the magnitude gate as a caller-supplied trait object — the gate must not be injectable by the caller.

## CONDITIONS (per prior founder ruling, on record):
- Fixes land with tests green **under their own names** — each bug gets its own named test that fails before and passes after. Receipt rule applies: pasted command + real unedited output.
- All three land **BEFORE any tokenomics constant is coded** (w, T0, 90/10 amendment, Design D params all wait behind this).
- Docs describing these bugs land **with or after** their fixes, never before (push carve-out).

## SCOPE FENCE
Only the three fixes above. Anything beyond: **That is out of scope. Execute the prompt as written.**
