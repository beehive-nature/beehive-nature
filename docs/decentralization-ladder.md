# The decentralization ladder

**Status: RATIFIED 2026-07-18** (order L-1, proposal v6 plus the W-L4 clause). This is law.
Governance category — no health material, and it needs no disclaimer anywhere in it.
Other trees **reference** this document; no tree restates it.

Levels are **granted**, never assumed and never self-awarded. Absence of a grant means L0.

---

## Why this exists, and what it cost to write

`L1` appeared sixteen times across a downstream tree and was defined nowhere — no criteria,
no rubric, no judge. An audit ordered to stamp it declined, correctly.

Seven defects were found in this document before ratification. **Every one was found by
executing it, none by reading it.** Four were a single family — *a level nothing can reach* —
patched four separate times before the general fix was found. That history is kept in §7
rather than tidied away, because the defects are the argument for the laws.

---

## 1. The laws

### Law 1 · Witness

**Every universally quantified claim — in a test, in a grant, or in a check on the levels
themselves — requires an exhibited witness of the set it ranges over.**

A universal over an empty set passes. An existential over an empty set **fails, because you
have nothing to hand over.** The witness is *produced*, never asserted.

- **1a · In tests.** A test asserting a property over a collection MUST first assert the
  collection is non-empty and fail if it is not. *(Four vacuous passes occurred in one
  working session: a scanner over zero files printing `clean`; `[].every()` on a page that
  never loaded; a `diff` of two empty streams reporting IDENTICAL; a browser tab that
  silently loaded a different origin. Each was a true statement about nothing.)*
- **1b · In grants.** A requirement satisfied only vacuously is not satisfied. The grant
  MUST record the collection size — or the subsuming requirement that discharged it, itself
  demonstrated non-vacuously.
- **1c · In checks on the levels.** Satisfiability is shown by exhibiting a witness, never
  by failing to find a counterexample.

*Law 1 is itself a universal and subject to itself. Its witness set is the universally
quantified claims in this document — §2.2, §2.4, O4 and O5 populate it. **Non-empty. The law
survives its own test.***

### Law 2 · No level without a negative control

A level is granted on a passing test **plus a demonstration the same test fails when the
property is absent.** If nobody has watched a gate bite, it is a decoration.

### Law 3 · Fail closed

Indeterminate is not a level.

---

## 2. Three axes, granted conjunctively

- **Axis A · Artifact** — what the bytes depend on at render time.
- **Axis D · Delivery** — what the act of reading reveals, to whom, and who can stop it.
- **Axis O · Operations** — who may change the system, and what a single party can do alone.

**Grant rule:** level *N* is granted when every requirement at levels 1 through *N* is met,
subject to §2.1–§2.4.

**§2.1 · Saturation.** A saturated axis stops adding requirements; it does not cap the
composite. Axis A saturates at A2. An axis silent at a level does not block it.

**§2.2 · Reachability — one witness per level.** For each level *N*, **exhibit a concrete
system — real or hypothetical — satisfying that level's full cumulative conjunction across
all axes.** A single witness proves every pair, triple and n-way interaction at that level
simultaneously; pairwise checking never reaches triples at any count. **The witness must
state which clause satisfies which requirement**, so the mapping is checked rather than
invited. Where a requirement cannot be satisfied because a higher one strictly replaces it,
it discharges by **subsumption (§2.3)** and the witness records it as discharged, not met.

**§2.3 · Subsumption.** Where a level-*N+1* requirement strictly subsumes a level-*N* one,
the higher **discharges** the lower, and the higher's negative control discharges the
lower's — provided that control is itself non-vacuous (Law 1b).

**§2.4 · The witness set is mandatory before any amendment.** Every level gets a witness or
an explicit statement that it is unreachable. An amendment that adds a requirement
re-derives the witnesses at and above the level it touches.

---

## 3. The witness set

Each witness extends the previous, so the conjunction is visibly cumulative.

### W-L1 — {A1, D1}

*A single HTML file with all CSS and JS inlined, no external references of any kind; its
digest recorded before publication; served from one operator's static host; carrying a
paragraph stating that the operator can observe every reader and withdraw the file at will.*

| Requirement | Satisfying clause |
|---|---|
| A1 | assets inlined → zero external refs; renders with egress blocked; recorded digest equals bytes served over the wire |
| D1 | the disclosure paragraph — model stated as a limitation |

### W-L2 — {A1, D1, A2, D2}

*The same file published to a content-addressed store, its address derived from its bytes,
pinned by two unaffiliated gateways; disclosure paragraph updated to describe the new model.*

| Requirement | Satisfying clause |
|---|---|
| A1 | unchanged — still inlined, zero refs, digest recorded |
| D1 | updated disclosure paragraph — D1 is disclosure-of-model, so it composes with any model |
| A2 | address derived from bytes → changing bytes changes the address |
| D2 | two unaffiliated gateways; neither can withdraw the other's copy |

### W-L3 — {A1, D1, A2, D2, D3}

*The same artifact, the two pins held by separate legal entities with no shared ownership or
control, each serving independently.*

| Requirement | Satisfying clause |
|---|---|
| A1, D1, A2, D2 | as W-L2 |
| D3 | controllers enumerated and distinct; removing either leaves the artifact retrievable |

**On the cross-axis pair the old pairwise sweep could not form:** `A2 ∧ D3` is not merely
compatible — content-addressing *aids* D3, since any replica serving the address necessarily
serves identical bytes. Exhibited, not assumed.

### W-L4 — {A1, D1, A2, D2, D3, O4}

*The above, plus a mutable naming record pointing at the current address, whose update
requires 3-of-5 keys held by five independent parties. Privileged operations:
`update-pointer`, `rotate-key-set`.*

| Requirement | Satisfying clause |
|---|---|
| A1, A2, D2, D3 | as W-L3 — the pointer is a separate object; the artifact remains content-addressed and independently retrievable without it |
| **D1** | **the ratified W-L4 clause.** The witness MUST state which path readers resolve by. If readers resolve **by address only** and the pointer is operator-facing, W-L3's disclosure stands unchanged. If readers resolve **via the name**, then who may repoint them is part of the delivery model, and the disclosure MUST be updated to say so — D1 is disclosure of the model *as it actually is*, and adding a redirectable name changes the model |
| O4 | both privileged operations require 3-of-5; no single key acts; custody disclosed (5 holders, threshold 3) |
| Law 1b | privileged-operation set size = **2**, non-empty — recorded |

### W-L5 — {A1, D1, A2, D2, D3, O5}, O4 discharged

*W-L4 with the mutable pointer removed. Readers resolve by address only. No admin, no
upgrade key, no allowlist, no pause.*

| Requirement | Satisfying clause |
|---|---|
| A1, D1, A2, D2, D3 | as W-L3 |
| O5 | capability enumeration returns the empty set |
| O4 | **discharged by subsumption (§2.3)**, not evaluated — evaluating it here yields a vacuous true, forbidden by Law 1b |

**The L5 negative control has a named reference system: W-L4.** Running the same enumerator
against W-L4 must find its two privileged operations. That control is non-vacuous and
therefore discharges O4's — the witness set supplies its own reference system rather than
borrowing a hypothetical one.

**Every level L1–L5 has a producible witness. No unreachable rung remains, in any dimension.**

---

## 4. The levels

### L0 — Unqualified
The default; what you get for doing nothing. No claim has been tested. **Absence of a grant
means L0.** Never displayed, never granted.

### L1 — Self-contained artifact · delivery disclosed
- **A1** — renders with all network egress blocked; zero external references; digest
  recorded before publication and **matching the bytes a reader receives over the wire**,
  not merely the local tree.
- **D1** — the delivery model is disclosed in the artifact as a limitation, whatever that
  model is. *Illustration, not requirement:* a single named operator that logs readers and
  can unpublish satisfies D1 when it says so plainly.
- **O** — no requirement.
- **Test:** block egress → render → fetch served bytes → diff against recorded digest.
  Enumerate external references, exhibiting a non-empty file set (Law 1a).
- **Negative control:** insert one external reference; insert one byte; run over an empty
  set. Must yield fail, fail, **refuse**.

### L2 — Content-addressed · un-unpublishable
- **A2 (saturating)** — the content's address *is* its identity.
- **D2** — retrievable from two or more independently operated gateways; no single party can
  withdraw it.
- **Test:** resolve by address from each gateway independently; compare bytes.
- **Negative control:** take the primary gateway offline; it must still resolve.
- **Note:** L2 has no unpublish. Fix-forward does not exist. Per-artifact category clearance
  required; funded writes are key-holder-only.

### L3 — Independent data plane
- **D3** — no single operator holds data required to serve; replicas held by parties with
  **no common controller**.
- **Test:** remove any one provider; service continues.
- **Negative control:** enumerate the parties' controllers and show they differ. Two replicas
  under one company is L2 wearing L3.

### L4 — Quorum-governed operations
- **O4** — every privileged operation requires a quorum of independently held keys. **No
  single key can act.** Custody disclosed.
- **Test / negative control (same act):** attempt a privileged operation below quorum and
  watch it be refused.
- **Law 1b:** the grant MUST record the privileged-operation set was non-empty. A system with
  no privileged operations does not hold L4 — it may hold L5.

### L5 — No privileged operator
- **O5** — no operation any party can perform that another cannot.
- **O4 discharged by subsumption (§2.3), not evaluated.**
- **Test:** enumerate every privileged capability; the set must be **empty**.
- **Negative control:** run the same enumerator against a reference system holding an admin
  key — W-L4 serves — and show it finds it.

---

## 5. Granting

1. A level is granted by a **read-only auditor**, never by the author of what it grades.
   **This applies to the negative control as well as the test** — an author's execution
   demonstrates well-formedness only.

   **§5.1a · Provisional grants.** A read-only auditor spawned **inside the author's own
   session** — same host, same principal — satisfies §5.1 on the letter and issues a
   **provisional** grant only.

   A provisional grant is a *real* grant: it records a level, it is keyed by digest, and a
   byte change voids it. It is **not third-party verification and may never be described as
   such.** The distinction is institutional, not technical: such an auditor holds no write
   tools and cannot silently edit what it grades, but its isolation is a matter of its own
   configuration rather than of separation between parties. It is a structured self-check.

   **Any grant may be superseded — never amended — by one issued from outside the issuing
   session.** Superseding replaces the record and leaves the original legible; amending
   would let a weak grant quietly acquire a strength it was never given, which is the
   failure §5.4 and §5.5 exist to prevent one level down.

   This clause exists because the first grant issued under this ladder was provisional, and
   *"file it as-is"* would otherwise have drifted into the working definition of what a
   read-only auditor is. Bounding it at the moment it was set costs one paragraph; bounding
   it later costs an argument about what everyone had assumed.

   **§5.1b · Independence tiers.** Named so they cannot be fudged. The ordering is the
   argument.

   | Tier | Grader | Strength | Honest description |
   |---|---|---|---|
   | **P** | read-only auditor inside the author's own session | provisional | real, digest-keyed, never third-party verification |
   | **I** | separate session, **same principal and host** | **weak** | feels independent, largely is not — same operator, same machine, same failure modes |
   | **X** | different principal, different host | independent | a genuine third party. Rests on that party's care and continued existence |
   | **R** | **reproducible by any reader from published inputs** | **strongest** | needs no trust in any grader, including us |

   **R dominates X, and the intuition that says otherwise is wrong.** An X grant nobody can
   reproduce is weaker than an R grant nobody has yet re-run: the R grant is *checkable on
   demand*, and the X grant never becomes so. X rests on a party being careful, honest, and
   still present in ten years. R survives every grader being wrong, compromised, bored, or
   gone. For a project measuring its horizon in centuries, that difference is the whole
   argument.

   This is also the honest reading of §5.1. The clause exists so a grant does not rest on
   the grader's word. **Reproducibility satisfies its purpose more completely than any
   choice of grader satisfies its letter.**

   **Tier I carries a warning label**, because it is the tier most likely to be quietly
   overclaimed — it is the easiest to reach and it *feels* like independence. A separate
   session under the same principal on the same host shares every operator-level failure
   mode with the author. Record it as weak; do not inflate it.

   **An R-tier grant must publish the procedure**: the exact command, the expected output,
   and the verifier pinned by commit so the tool is as fixed as the artifacts. A grant that
   says "reproducible" without shipping the means is a P-tier grant wearing an R label.
2. The grant records: level, all three axis values, commit, **digest of the graded bytes**,
   date, negative-control result, granting party, **and per Law 1b, for each
   collection-ranging requirement: the collection size, or the subsuming requirement that
   discharged it.**
3. **A byte change voids the grant.**
4. **An artifact never carries a level.** It may carry ungraded testable *facts* — "zero
   external references", "renders with egress blocked" — which need no grant because anyone
   can check them. **Facts may live in bytes; grants may not.**
5. **Grants live outside the artifacts they grade, keyed by digest.** Graded bytes never
   change as a consequence of being graded, so §5.3 and §5.4 stop contradicting. Where a
   level must be shown, it is shown by the grant record or an index reading it — never by the
   artifact asserting its own grade.

---

## 6. Why §5.4 and §5.5 exist — the sixteen badges

Two clauses, each correct alone: *a byte change voids the grant*, and *an artifact displays
only what it was granted*. Follow the sequence. Grant L1 for digest X → add the badge →
bytes are now Y → the grant is void → the artifact displays a level it does not hold. Grant Y
instead, and the auditor is asked to bless bytes that already assert the grant exists, made
true retroactively by the act of granting.

**Either order, the artifact claims its own grant before the grant is real.**

So sixteen undisciplined badges were not carelessness. **No correct order was available**,
because the claim lived inside the bytes it was a claim about. That is a structural
impossibility wearing the costume of an oversight, and it is why grants live outside.

---

## 7. Defect history

Kept because the defects are the argument for the laws.

| # | Defect | Fixed in |
|---|---|---|
| 1 | `min(A, D)` had no operands above L2; A saturates at A2, so L3–L5 were unclimbable | v2 |
| 2 | Wrong reason given for L0 — the failing clause was missing *disclosure*, not architecture | v2 |
| 3 | `D1 ∧ D2` contradictory — L2 unreachable | v3 |
| 4 | A displayed level is self-invalidating — the mechanism behind sixteen badges | v3 |
| 5 | `O4 ∧ O5` — L5 ungrantable; O4 satisfied only vacuously, L4's control unrunnable | v4 |
| 6 | The composition check was universally quantified, so it passed *precisely when* a rung was unreachable | v5 |
| 7 | The sweep checked within-axis adjacent pairs while the grant rule conjoins across all axes — at L3, 3 of 10 co-occurring pairs checked, 7 never formed | v6 |

**Four of seven were one family: *a level nothing can reach*** — patched four times, each
patch scoped to the pair that had just embarrassed the author, before per-level witnesses
closed the family rather than the instance. **5 witnesses growing linearly replaced 21
pairwise checks growing quadratically, and cover n-way interactions pairwise never reaches.**

The defect behind the defects: a checkable rule written and left unexecuted, inside the
document whose thesis is that rules must be watched biting.
