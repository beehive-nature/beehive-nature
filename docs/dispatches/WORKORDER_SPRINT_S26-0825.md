# WORKORDER — S26-0825 · carry, fold, and close on a receipt

**Founder's orders, 2026-08-25:** *"take anything undone from yesterday's sprint and fold
everything we are taking/using into preparing another sprint. we just need to improve our
closing/ending of the sprints."*

Two deliverables, and the second is the point. The carry-forward is bookkeeping. **The
closing protocol is the actual work of this sprint**, because the last close is the thing
that failed, not the last sprint.

---

## 0 · What actually failed at the last close

Read the repository's own account of it, from `tests.yml`, dated 2026-08-24:

> *"the four-suite gap — fleet-pixels, fleet-bus, dock-claims and university-smoke were
> built and mutation-proven but ran on NO push; every assertion this sprint gated nothing."*

And, two comments down, the general form of the same defect:

> *"a gate's success state is SILENCE — a passing hook and a broken hook look identical."*

**The work existed. Nothing surfaced it.** Four suites were built, proven, and invisible.
At close, a sprint that shipped and a sprint that stalled produce the same artifact — a
report — and a report cannot tell you which one you had. The review looked empty because
the closing ritual had no way to show what landed, not because nothing landed. The same
review conducted a day later, with the repository open, found the work.

That gap is a **process defect with an emotional cost**, and it is worth naming plainly:
a close that cannot show its evidence produces a verdict formed on absence, and a verdict
formed on absence is unfair to whoever did the work. The fix is structural. §7 already
solved this exact problem for hooks — it just was never pointed at the sprint.

> **RULING.** A sprint does not close on what the seats report. It closes on what can be
> re-derived from the repository. The method is `e2e/dock-claims.mjs`, which re-derives the
> Dock's hero numbers from source and compares them against what the page prints. Same
> trick, larger subject.

---

## 1 · THE CLOSING PROTOCOL

### 1.1 Three states, and "done" is not one of them

| state | means |
|---|---|
| **PROVEN** | re-derived from the repo, on the closing commit |
| **LANDED** | the artifact exists — and nothing proves it runs, or is read, or gates anything |
| **MISSING** | not present |

**LANDED is the state the four suites were in**, and the state a report would have called
"done". Naming it is the entire improvement. `STATUS.md` already distinguishes PROVEN from
asserted for the ledger; this extends the same vocabulary to the sprint.

### 1.2 The claim manifest is written at OPEN

`docs/dispatches/<sprint>.sprint.json` lists every claim the sprint will be judged on and
**how each is re-derived**. Written at open, never at close — a claim invented at close is
a report wearing a receipt's clothes.

Derivations: `file` · `receipt` (exists **and** is non-trivial — an empty receipt is a
report) · `contains` · `ciStep` · `commitSince` · `gate` · `manual`.

**`ciStep` is the four-suite check, and it is why `file` is not enough.** A test that
exists is LANDED. A test that a workflow invokes, in a job that runs on push, is PROVEN.
That distinction is the whole of the 2026-08-24 order, mechanised.

**`manual` exists so the receipt shows its own blind spots.** A claim nothing can derive is
recorded as LANDED with the reason, never quietly dropped. A receipt that hides what it
cannot prove is the defect it was built to fix.

### 1.3 It runs in CI, on push, or it is theatre

`scripts/sprint-close.mjs` joins `tests.yml` under `if: always()` like every other suite.
A closing gate that only runs when someone remembers to run it is `identity-check.sh`
before the selftest existed.

**First-run receipt, this file's own manifest: 4 PROVEN · 3 LANDED · 11 MISSING · 5 GATE.**
That is the honest opening position, and it is the number this sprint moves.

### 1.4 The needle rule, learned on the first run

Claim X4 asserted the spec says *"strictly FUNGI"*. The spec says exactly that. The check
reported **MISSING** — because the source hard-wraps between the two words.

> **A `contains` needle must survive a re-wrap.** Keep needles short and inside one line.
> A false negative here costs more than a missed claim: it sends someone to re-do finished
> work, which is precisely the failure this protocol exists to prevent, arriving from the
> opposite direction.

### 1.5 The cooling rule

**No sprint closes on the day its last gate lands.** The verdict is formed on a different
day than the work, against the receipt.

This is not sentiment. The evidence is direct: yesterday's close produced a verdict on
absence; today's review of the identical repository produced *"it actually looks pretty
good."* Same work, same repo, different day and better evidence. **Institutionalise the
thing that worked by accident.**

---

## 2 · CARRY — what came forward, and what changed about it

`E4` (NTNT row in museum FACTS) is **struck: PROVEN** at `museum.html:356`. It was done and
nobody knew.

| id | carried task | what changed today |
|---|---|---|
| **T1** | read-path receipt — `ant` CLI 0.3.3 + `antget` 0.1.1, fetch `711c7e20…78a`, receipt the hashes | unchanged; still the cheapest open item in the lane |
| **T2** | local-devnet write E2E, both directions receipted | unchanged |
| **T3** | AT-2 production probe via the external-signer ceremony | **amended — see T5.** The probe is a `--public` upload, and public now has a documented meaning |
| **T4** | mirror phase 3 — `ant file cost` vs Arweave, founder picks | unchanged, still blocked on T3 |
| **E1** | explorer + catalog + gallery sync | **larger than filed.** The catalog carries seven collections and is missing **PEPI eth, NTNT and MiDi** — all three present in the museum's SOURCES wing. Museum and catalog have drifted |
| **E2** | wing cards carry their SOURCES links | **no mechanical check exists.** Enters the receipt as `manual`/LANDED until someone writes one |
| **E3** | PL-1 — in-file SPDX-MIT as a grant | founder gate, open |

### T5 — new, and it amends T3

Watch-It (`aautonomicc/Watch-It`, MIT) dropped public XOR addresses as an entry type in
alpha.40, and `docs/ARCHITECTURE.md` gives the reason: **a public Autonomi upload stores its
root data map as a plaintext chunk on the network**, so any node operator can trawl chunks
for valid maps and read the whole file. A private upload writes the same encrypted chunks
and keeps the map local, where the chunks are unlinkable noise.

Our read-path receipt is unaffected — antget's address is a public file by design. **The
write path is not.** For a project whose thesis is private commerce between strangers,
*"we uploaded it to Autonomi"* is not privacy, and the mirror must say so in writing before
anything is written.

> **T5.** `SPEC-MIRROR-COMMONS-1` states the public/private disclosure explicitly, and every
> `--public` act names itself as a deliberate publication rather than a default.

---

## 3 · FOLD — what today added

| id | item | state at open |
|---|---|---|
| **X1** | `selector_census.py` + `deployments.json` — probes bytecode on two RPCs, discovers each dispatcher's real surface instead of testing it against FUNGI's checklist, and aborts on two known-receipt controls before printing a row | delivered, **not yet in the repo** |
| **X2** | 13 deployment addresses | **9 filled** from `compare.html` and the museum. MiDi-2, MiDi-3, Souli, PEPi-item outstanding |
| **X3** | the §2.1 census run and receipted | not started — the cheapest way to close the oldest open question in the spec |
| **X4** | §2.1 relabelled `Base` → `FUNGI`, §1.2 `decimals()` amendment, §1.2b vocabulary, §0.1 the teaching-contract trap, §2.2 escrow amendment | **in the working tree**, needs committing |
| **A1–A3** | SourceHat audit: receipt filed, museum FUNGI row carries it with both caveats, §2.2 gains the corroboration | **PROVEN** |
| **M1** | the tier-3 **metadata surface**, specified and frozen | not started — **and it is the highest-leverage item in this sprint** |
| **D1** | no truncation at the point of confirmation | not started |
| **D2** | the swap affordance may not be shared between empty and holder states | not started |
| **G1** | C-2 gains a third door — and is now **chain-gated before it is design-gated** | founder |

### Why M1 outranks the rest

Falazen, on what he needs to use a token in his game: *he takes care of sprites; what he
wants is trait metadata.* Artistic unity means he will not use foreign art. That is the
general case, not his preference.

**This family is uncomposable because everyone shipped art and nobody shipped an
interface** — four `getSvg` shapes (§1.1), enumeration diverging per deployment (§2.1),
JELLI naming its traits Medusa and Polyp (§1.2b). Every viewer is hand-fitted to one
collection and dies with its author's attention. That is why there has never been more than
one working gallery at a time.

A stable, documented metadata surface is the thing the LaunchPad can emit that no
predecessor did. Whatever **C-2** decides about settlement, **M1 decides whether anyone else
can build on us** — and the plural-venue ecosystem we said we wanted is gated on it.

### A1–A3, since they are already PROVEN

The SourceHat audit is real (April 2024), **covers the token and not the marketplace**, and
its remediations are in GitHub and not at the address: FUNGI deployed 2024-03-31, eight days
before the audit began, and the live bytecode matches pre-remediation `4581acb`. Its
**Finding #1, severity HIGH, is our §2.2 collision** — found from source by a professional
reviewer in April 2024, found by us from 8,162 burn events, and unfixed on chain either way.

> **New catalog law:** an audit badge names a *report*, not a *deployment*. Any badge we
> display or repeat carries its scope and its commit, or it does not go up.

---

## 4 · GATES — no seat may close these

| gate | question | note |
|---|---|---|
| **C-1** | trait taxonomy — layers × variants × colour axis | founder |
| **C-2** | the settlement primitive | **three doors now, and chain-gated.** A v4 hook needs EIP-1153 transient storage; §3.5 records exSat as Shanghai. If exSat is settled, door 3 closes for a reason external to its merits and should be *recorded* closed. If exSat is not settled, C-2 is a chain question and should be re-scoped and re-numbered as one |
| **C-3** | `pixelsCount` — 48 vs 96 | founder, frozen at deploy |
| **PL-1** | in-file SPDX-MIT as a grant | founder |
| **AT-1…AT-3** | the Trezor external-signer ceremony | standing |
| **BS-1** | standing | standing |

---

## 5 · CADENCE

- `mirror-harvest.mjs` weekly, append-only — a changed government PDF is a catch, not an error.
- `ant update` only after release notes are read (AT-5).
- **`sprint-close.mjs` on every push**, not only at close. A closing receipt that first runs
  at close is a claim about a sprint nobody watched.

---

*Opening position, re-derived rather than asserted: **4 PROVEN · 3 LANDED · 11 MISSING ·
5 GATE**. That is what this sprint moves, and the same command prints the number at the end.*
🐝
