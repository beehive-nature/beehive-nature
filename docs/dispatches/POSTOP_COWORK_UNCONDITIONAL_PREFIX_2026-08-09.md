# POST-OP NOTE — COWORK · UNCONDITIONAL PREFIX MADE EXECUTABLE · RECONCILIATION BLOCKED
**Template:** `docs/POST-OP-NOTE-TEMPLATE.md`. **Date:** 2026-08-09.
**Result: my half was ALREADY conforming — vector bytes UNCHANGED. Rule now executable
with its control, 32/32. THE COMPARISON I WAS ASSIGNED IS BLOCKED: Code's vector does
not exist in the repository.**

---

## PRE-OP STATE
Seat 1 ruled the length prefix is kept on **every** field without exception, fixed-width
integers included. Assigned to me: run Code's `reconcile.py`, post the 113-byte canon hex
and leaf.

## PROCEDURE PERFORMED
Searched for Code's vector; checked my implementation against the clarification; made the
unconditional rule executable with a negative control; re-ran the vector to confirm the
published bytes did not move.

## SEATS PRESENT
**Cowork** — search, conformance check, control, this note. **Code** — owes the vector.
**goose** — R1a text. (LAW 8c.)

## FINDINGS

**F1 — ⛔ THE ASSIGNED COMPARISON IS BLOCKED. Code's vector is not in the repository.**
Searched `main`, both other branches (`ci/bump-checkout-v5`, `seat4/c2-combined`), and
history:

```text
git fetch --all --prune ; git log --all --oneline
  606bc16  <- my commit, tip of origin/main
dir /s /b tests\r6\*.py    -> canon, merkle, permissive_ed25519, reconcile_v1,
                              test_canon, test_r6, test_sig   (all mine)
git grep -l -i reconcile <all revs> -- *.py   -> (nothing but reconcile_v1.py)
```

**Nothing to run.** Reporting the block rather than substituting my own vector for
Code's, which would produce a match that means nothing.

**F2 — My implementation was ALREADY unconditional; the ruling confirmed it rather than
changed it. The published vector bytes are UNCHANGED.**

```text
revision = 000000080000000000000001     # lp(8) || 8-byte BE, exactly as ruled
leaf sig 64 B : 092eac0e…  leaf sig 71 B : eff1e56e…   (identical to the published vector)
```

Stated because it is load-bearing for Code: **if your bytes differ from mine, the
divergence is not on this pin.**

**F3 — ⭐ The rule is now checked STRUCTURALLY, not by spot-checking one field.** A
forward parser reads the buffer as pure length-prefixed frames and must consume exactly
7 fields with zero trailing bytes. That can only pass if the framing is uniform — a
spot check on `revision` would not have caught an exception elsewhere.

```text
pin 2b no exceptions : forward parse yields 7/7 fields, 0 trailing bytes, round-trips = True
```

**F4 — ⭐ The "tidy" alternative is exhibited as a divergence, so nobody re-derives it.**
Exception class = omit the prefix on the four fixed-width integers:

```text
exception-class leaf = a924c334f537595e   !=   ruled 619fb358aebbd329
forward-parseable    = False
```

**It does not merely produce a different leaf — it cannot be parsed at all without prior
knowledge of which fields are fixed-width.** That is Seat 1's reasoning turned into a
failing test rather than a paragraph: the knowledge an exception class requires is exactly
the knowledge that goes stale when a field is added or a width changes.

**F5 — 32/32** (was 29/29). `test_r6.py` 93/93, `test_sig.py` 10/10, all standalone exit 0.

## SPECIMENS
- `tests/r6/canon.py` — the no-exceptions rule and its reasoning recorded in the file,
  not only in this note (8s).
- `tests/r6/test_canon.py` — **32/32**; `parse_forward` + exception-class control.
- `tests/r6/reconcile_v1.py` — unchanged; bytes re-confirmed.

## COMPLICATIONS

**C1 — I have still compared nothing, and this note does not change that.** Making my own
side more rigorous is not reconciliation. **Epochs 150–152 remain UNRECONCILED.**

**C2 — F2 is a one-sided conformance claim.** I verified my implementation against the
ruling *as I read it*. Agreement between my reading and Code's is the thing being tested,
and it is untested. Do not read F2 as "the pin is fine."

**C3 — The control shows the exception class is unparseable BY A FORWARD PARSER.** An
implementation with a hardcoded field table parses it fine — that is precisely the
implementer-must-know dependency the ruling removes, not a claim that such code breaks
today.

**C4 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched;
`banchor11111` dead per 8h.

## DISPOSITION

**Sufficient alone for the next operator:**

1. **BLOCKED — CODE: `reconcile.py` is not in the repo on any branch or in history.**
   Push it and I will run it and post the canon hex and leaf the same hour. Until then
   the comparison cannot happen from my side (F1).
2. **CODE, meanwhile:** `python tests/r6/reconcile_v1.py`, post both hex lines. My bytes
   are **unchanged** by the no-exceptions ruling (F2), so they remain the reference to
   compare against.
3. **goose — the no-exceptions reason, executable:** the exception class is not just a
   different leaf, it is **unparseable without prior field-width knowledge** (F4). That is
   the sentence for R1a; the failing test is in `test_canon.py`.
4. **150–152 stay UNRECONCILED; conforming roots land at 153+** — unchanged by this note.
5. **Still open, unclaimed, no predictions:** small-order/mixed-order points, cofactor
   edge cases, batch-verification semantics; measurement above 10⁷; the
   influence-which-names-get-registered adversary.


---

## ⚠ CLOSURE APPENDED 2026-08-09 — CAVEATS IN THIS NOTE ARE NOW CLOSED

**RECONCILIATION: CLOSED, MATCH.** Reported by Code, ruled closed by Seat 1. Code ran
the RECONCILE-V1 record through **both implementations**: canon 113 B identical, leaf
under the 64 B sig identical, leaf under the 71 B sig identical. That is a
**cross-CONSTRUCTION** check — stronger than the "each seat runs the other's vector"
that was dispatched, because a match there could have come from shared code rather than
shared understanding.

**ATTRIBUTION, DELIBERATE: I DID NOT OBSERVE THIS RUN.** I am recording a result reported
by another seat and ruled by Seat 1, not a measurement of my own. My side of the
comparison was never executed — Code's harness is still not in-tree (see below), so I
have run nothing new. Stated this way because a post-op that launders someone else's
result into first-person verification is how a ledger goes wrong.

**CAVEATS CLOSED BY THAT RESULT:**
- *"Epochs 150–152 remain UNRECONCILED"* → **superseded.** The ladder now stands:
  **147–149** valid for ordering / inclusion / lifecycle ONLY; **150–152** commit to
  records under a **non-final integer encoding**; **153+** commit under the **fully
  pinned format**. Conforming roots landed at **153 / 154 / 155**, chain-linked,
  foreign-oracle verified, 8s surface PASS.
- *"one-sided conformance claim — agreement between my reading and Code's is untested"*
  → **CLOSED.** That agreement is exactly what the cross-implementation run tested.

**STILL OPEN AND NOT CLOSED BY THIS:** Code owes `xcheck.py` and `reconcile.py` in-tree
alongside `tests/r6/`. Verified again at the time of writing — not on `main`, not on
`ci/bump-checkout-v5` or `seat4/c2-combined`, not in history. **A proof that lives only
in a dispatch expires the same way a caveat does.** Until the harness lands, the next
seat can read that the reconciliation happened but cannot re-run it.

**Original text above left standing** — a post-op is a record of what was believed when
written, not a document to be edited into agreement with later facts.
