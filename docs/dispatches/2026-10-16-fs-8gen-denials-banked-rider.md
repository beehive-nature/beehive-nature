# 2026-10-16 — rider on the denials-banked dispatch: the walker await-fix was already applied

Correction to `2026-10-16-fs-8gen-denials-banked.md`'s standing-opens list:
the walker's unawaited-checkpoint fix is NOT open — the order-#27 sibling
seat applied it earlier on 2026-10-16 (sweep-walker.mjs now awaits both
checkpoint calls; backup `sweep-walker.mjs.pre-await-fix-2026-10-16` kept;
their main-direct commit 957b9e572 is an ancestor of this dispatch). This
wake's 20:39Z denial-banking run therefore loaded the FIXED walker from
disk — the settle-until-landed discipline this driver ran was redundant
belt-and-suspenders on top of an already-awaited checkpoint, not the
workaround carrying the run. The order-25 dispatch's account of the bug
(discovered under the unfixed walker) stands unchanged.

Remaining opens: the founder rulings (QG8Q-V3C5/V3CN/P964 title-vs-wire,
Christen Olsen cluster + birth-year, Daniel Briggs duplicate, Norway
parish, Don Ray records pass), the optional in-guard session-plane
verification option, and ANT behind codex #346/#347.
