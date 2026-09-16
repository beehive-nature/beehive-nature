# MULTI-AGENT CONCURRENCY PROTOCOL — source-of-truth, seats, evidence

Founder ruling 2026-09-16 (emerged from the Buzz Box CSPU lane, retained as
project infrastructure now that four worker seats are active). Companion to
`docs/agents/BUZZ-BOX-SRE-SEAT.md` (seat charter + infrastructure autonomy
addendum). This file is GENERAL — it binds every seat, not just SRE.

## SOURCE-OF-TRUTH / CONCURRENCY RULE (founder text, verbatim)

At session start:

- fetch origin
- establish origin/main as the repository evidence baseline
- record its exact commit SHA before analysis
- expected synchronization point at handoff: d0bbda59

DO NOT assume the shared checkout HEAD is current.

The shared checkout at C:\Users\travi\beehive-nature may contain dirty,
concurrent work from other worker seats. Do not stash, reset, clean,
checkout over, rebase, amend, or otherwise modify that work.

If origin/main advances during archaeology:

- do not silently move the evidence baseline
- record the newer SHA
- classify relevant new commits as concurrent changes
- inspect them separately when materially relevant
- distinguish findings against BASELINE from findings against CONCURRENT HEAD

Repository evidence should remain reproducible against an explicit SHA.

*(The rule's wording is general; "archaeology" reads as "any long-running
evidence-producing session".)*

## The protocol inventory (what now exists, named)

1. **Explicit seats** with narrow charters (SRE, archaeology, protocol-reuse,
   LOW bounded workers; Astra = synthesis/review).
2. **Branch ownership** — every seat commits from its own `wt-<seat>`
   worktree; the shared checkout is never committed from, stashed, or reset
   by another seat.
3. **Immutable evidence baselines** — findings are reproducible against an
   explicit recorded SHA (the rule above).
4. **Sync commits** — cross-stream synchronization points named as commits
   (e.g. `1c34573b` operational evidence ↔ architecture, `21e69b21` seat
   record, `d0bbda59` the banking merge).
5. **Contamination fences** — a seat's mission stays closed to adjacent
   directions (archaeology = what Beehive IS today; the reuse seat = what to
   reuse tomorrow; Eddies/antenglement lives in
   `docs/agents/PROTOCOL-REUSE-QUEUE.md` until that seat opens).
6. **Compact shared-memory pointers** — the global memory index is an
   operational resource under capacity pressure (24.4KB load limit; hit and
   trimmed once); substantial analysis lives in repository artifacts, memory
   entries stay one-line pointers.
7. **Durable repo artifacts** over conversation state (dispatches, evidence
   dirs, runbooks, this file).
8. **Human/Astra review gates** — cross-boundary results pass a formal
   GLM → Astra review before spawning follow-on work; the FOUNDER converts
   discoveries into bounded missions; agents do not recursively invent work.

## The evidence bar for architecture work

The artifact standard any evidence-producing seat is held to — a future
worker must be able to say:

> "At SHA X, this claim is FACT because these files/tests/receipts
> demonstrate it; this other thing is only SPECIFIED; this is INFERENCE;
> and this remains UNKNOWN."

FACT / SPECIFIED / INFERENCE / UNKNOWN, pinned to an explicit SHA, with
receipts.

### The full epistemic ladder (founder amendment 2026-09-16)

Two families, never mixed — the ladder exists so evidence is never confused
with design intent:

**Evidence states** (what the repository/field demonstrably supports):
- **FACT** — files/tests/receipts at the pinned SHA demonstrate it.
- **SPECIFIED** — written as spec/law in-tree, whether or not implemented.
- **INFERENCE** — reasoned from evidence, not itself demonstrated; cite the
  evidence it rests on.
- **UNKNOWN** — no evidence either way; an open hole, stated as such.

**Design-intent states** (what agents/humans propose for the future):
- **PROPOSAL** — a design direction advanced by a seat; may cite evidence
  states, carries none of their authority by itself.
- **DECISION CANDIDATE** — a proposal that has survived its review gate and
  awaits founder/Astra ratification; on ratification it becomes SPECIFIED.

A finding may carry one evidence state AND be the subject of a PROPOSAL —
the states label different things (what is, vs what someone suggests), which
is exactly why both families exist.
