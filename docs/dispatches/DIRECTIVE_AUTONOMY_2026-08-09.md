# DIRECTIVE — AUTONOMOUS BUILDING (2026-08-09)
**Issued by:** Seat 1, under the 2026-08-09 AUTONOMY DIRECTIVE. **Applies to:** all seats.
**Landed in-tree by:** Cowork, on Seat 1's instruction — *so the operating law lives in the
tree, not only in chat.* **Transcription, not authorship** (LAW 8c): the ruling is Seat 1's;
this file is the record of it.

---

## THE LAW

**Autonomous building is in effect.** Seats build without a per-item founder gate.

**Authority questions resolve at Seat 1**, by the founder's algorithm:

1. **10 billion users**
2. **1000 years**
3. **No centralized bottleneck, gate, or man-in-the-middle**
4. **Performance improves with user count**

**Tiebreaker:** what would Dan Larimer do.

**The founder is interrupted ONLY for manual tasks** — credentials, accounts, hardware,
and values/names. Not for design questions, not for push approval, not for rulings that
the algorithm above can decide.

## WHAT CHANGED

**The per-push founder word RETIRES.** Pushes now clear on:

- **Seat-1 ruling**, plus
- **standing pre-flight**: secret scan · 48-hex accounting · **NEVER `--no-verify`**

**The founder retains veto.** Retirement of the per-push word is not removal of the
founder from the loop; it moves the founder from *gate* to *veto*.

## NOT DELEGATED — ABSOLUTE

These do not resolve at Seat 1 and are not reachable by any ruling, algorithm, or
tiebreaker:

- **MAINNET UNTOUCHED.**
- **NO MAINNET KEY IN ANY SEAT.**

Recorded as absolute rather than as a strong default, deliberately: a constraint that a
ruling can move is not an absolute, and the whole point of naming these two is that the
autonomy directive cannot reach them.

## UNCHANGED BY THIS DIRECTIVE

- **Post-op notes** — `docs/POST-OP-NOTE-TEMPLATE.md`, 8 fields, empty stated as empty.
- **8a receipts** — receipts or it didn't happen.
- **8c flag-don't-absorb** — provenance survives the relay; addressed-to ≠ originated-by.

Autonomy raises the rate of building. It does not lower the evidentiary bar, and the
three items above are that bar.

## POST-PUSH REVIEW — THE SECOND READER, INSTITUTIONALIZED

**Ruled by Seat 1, 2026-08-09, adopting Cowork's reading.** (8c: the reading is Cowork's,
the ruling is Seat 1's. Recorded that way on purpose.)

**Any push touching a consensus-critical or spec-ruled surface gets a NAMED second-seat
POST-PUSH REVIEW.**

- **Named**, not ambient. A review everyone could do is a review nobody does. The
  reviewing seat is identified when the push lands.
- **POST-push**, not pre. The work ships; the reader follows.
- **A REVIEW, NEVER A GATE.** This does not reinstate the per-push word in another costume.
  Nothing waits on the reviewer. The directive traded a gate for velocity and this must not
  quietly trade it back.

**Why it exists.** With a founder gate on every push, a weak result had a second reader *by
construction*. Retiring the gate removed that reader as a side effect — the gate was doing
evidentiary work nobody had assigned it. This restores the reader without restoring the
gate.

**What it does not replace.** The suite is still the first reader. 8r (the control lives in
the suite and fails if the attack stops reproducing), 8s (a caveat that lives only in a
dispatch expires), and 8t (the reason travels with the ruling) are **more** load-bearing
under autonomy, not less. A named human-seat reviewer is a backstop for what the suite
cannot express, not a substitute for expressing it.

**Reading the construction, not the note.** A post-op reports what its author believed. The
second read is of the **artifact** — the code, the bytes, the control — and returns
**VERIFIED** or **REFUTED** per claim. A reviewer who reads only the post-op has reviewed
the author's confidence.

## LINEAR-HISTORY DOCTRINE — ROOM LAW

**Ruled by Seat 1, 2026-08-09.** Earned the same day, when Cowork's INDEX commit sat on top
of Code's ruled-but-unpushed `021c013`.

**When two seats hold unpushed commits on the same branch, the later commit CANNOT be
published without publishing the earlier one.** Git history is linear; a push of `main`
carries every ancestor. There are exactly two lawful responses:

1. **HOLD** — let the earlier seat push first, then push.
2. **PUBLISH UNDER EXPLICIT ATTRIBUTION** — record the carried commit as
   *published-as-ancestor, executed by <pusher>, authored by <author>* (8c).

**There is no third option**, and in particular "push and say nothing" is not one — that
silently transfers another seat's execution and its remote sha.

**This is a constraint of the tool, not a policy choice**, which is why it is stated as
doctrine rather than left to judgment each time. It recurs whenever two seats build in
parallel.

## READING NOTE (Cowork, transcribing)

**This directive expands who may decide, not what counts as decided.** The standing laws
that make a result trustworthy — negative controls in the suite (8r), reasons attached to
rulings (8t), caveats that live in the artifact rather than the dispatch (8s) — are
untouched and become *more* load-bearing, not less, once the per-push word is gone. With a
founder gate on every push, a weak result had a second reader by construction. Without
one, the suite is the second reader.

Stated as a reading, not a ruling. If Seat 1 reads it differently, Seat 1 wins.
