# VOCABULARY — the project's naming laws, in one place

**Status:** living document · **Owner:** founder rulings; Seat 3 maintains · **Last updated:** 2026-07-20

Every naming law the project has ratified lives here — the rule, why it exists, how it is enforced
(if it is), and the ruling that set it. Before this document the laws were scattered across five
separate relay files, which is exactly how naming drift starts.

## Why this document exists

Three naming collisions have each cost the project a reconciliation:

- **`BNRi`** meant both the OSe environment and the exSat EVM artifact.
- **PLUR's `Respect`** collided with the governance unit of the same name.
- **the bare activity-noun for "to farm"** meant both node/crypto work and crop work.

**All three were invisible in prose and obvious the moment someone wrote a type signature.** Prose
tolerates ambiguity; a compiler does not. That is the through-line of every law below, and the
reason several of them are *lints* rather than style notes: a lint moves the catch earlier than the
type does.

**The checkable home is the [`vocabulary`](../crates/vocabulary) crate.** Laws that can be scanned
for live there as a pure function plus a repo selftest whose allowlist is an explicit,
self-validating pending-migration worklist. Laws not yet mechanised are marked so, with a note on
whether a lint is even possible.

---

## Law 1 — `tithe`, never `tax`

**Rule.** The contribution levied by the reserve is a **tithe**, never a **tax** — in copy,
identifiers, and doc comments. Both directions: neither word substitutes for the other.

**Why.** The two words carry opposite social meanings — a tithe is given to a commons one belongs
to; a tax is extracted by an authority one is subject to. The distinction is the mechanism's whole
character, not decoration.

**Enforcement.** Ruling only — **no code lint yet.** A candidate to move into the `vocabulary`
crate as a second scan (same shape as Law 4), once someone writes the copy surfaces it would guard.

**Source.** RELAY_06 §1.

---

## Law 2 — no interpretive-worldview vocabulary reaches `reputation-engine` (NC-VII1)

**Rule.** No Human-Design / PLUR / Hawkins / physiocracy / "indigo" or similar interpretive-framework
vocabulary — nor any crate carrying it — may reach the `reputation-engine` input graph. Respect is
an emergent projection of settlement facts; it must never be computed from a subjective worldview.

**Why.** The reputation signal is load-bearing and must be defensible as arithmetic over facts. A
single interpretive term in its dependency path turns "earned standing" into "someone's cosmology,"
and that cannot be un-mixed later.

**Enforcement.** **Live**, in
[`crates/reputation-engine`](../crates/reputation-engine) as a `#[cfg(test)]` firewall: a vocabulary
scan (`no_subjective_worldview_reaches_the_reputation_input_graph`) and a dependency-graph scan
scoped to reputation-engine's own transitive closure
(`no_interpretive_framework_crate_in_the_reputation_dependency_graph`). Both carry positive controls.

**Source.** RELAY_09 §3a. Landed `ca797ba`, scoped to closure `40417e7`/`830391a`.

---

## Law 3 — `BNRi` is the artifact; `BNR OSe` is the environment; no vendor in the name

**Rule.** **`BNRi`** names the exSat EVM inscription artifact. **`BNR OSe`** names the operating
environment. They are different things and must not be used interchangeably. And **no vendor name**
(Pop, System76, and the like) belongs in the OSe's name or its distro-coupling — the shipped-image
base stays free to be decided later.

**Why.** `BNRi` collided with the OSe in exactly the Law-1d way — a reader could not tell which
thing a sentence meant. The vendor clause keeps the environment portable: a name that bakes in a
distro is a name that has chosen the base by accident.

**Enforcement.** The naming distinction is a **ruling** (lint candidate). The vendor/distro-coupling
half **is** enforced: [`crates/bnr-shell`](../crates/bnr-shell) `dependency::forbidden_findings`
flags `apt`/`dpkg`/System76/`pop-shell` coupling — while deliberately allowing `libcosmic` (the
base-agnostic toolkit is not distro coupling). Positive control included.

**Source.** RELAY_18.

---

## Law 4 — the bare activity-noun for "to farm" is banned; say which farm

**Rule.** The **unqualified** activity-noun (the gerund of "to farm") is banned across both products,
the kernel crates, and documentation — copy, identifiers, type names, doc comments. Use the term for
the domain you mean:

| Domain | Approved terms |
|---|---|
| **Crypto / infrastructure** | `node ops`, `mining` |
| **Agricultural** | `grow ops`, `cultivation` |

**And the bare noun `farm` resolves the same direction, asymmetrically (2026-07-20 extension).**
BNR genuinely has both senses — `NodeSnapshot` is Autonomi storage; a farm is a field in Michoacán
with a soil panel. **The word `farm` belongs to agriculture; the crypto side gives it up.** So an
Autonomi node type/path is `node …` (`NodeSnapshot`, `NodeHealth`, `node/read`), and **agricultural
uses keep `farm` — because that is what they are** (`farmer` stays untouched for the same reason).
Same asymmetry as the parent ruling: crypto took `node ops`/`mining`, agriculture took `grow
ops`/`cultivation`, and the noun follows.

A qualifier immediately preceding the word (`yield …`, `crop …`) passes, per the founder's
"unqualified" wording — but the four approved terms cover every real case, so a qualified use is a
smell, not a need.

**Why.** Grouped under a product literally named for nature, one bare word meant two opposite things
— running storage nodes for rewards, and growing hemp. A user and the code both had to guess. Third
collision of the set; same defect as `BNRi` and `Respect`.

**Enforcement.** **Live**, in [`crates/vocabulary`](../crates/vocabulary): `farming_findings(text)`
flags bare, unqualified, word-boundaried uses. Word boundaries mean glued identifiers
(`BnriFarmingLocked`, `cropfarming`) are **not** token-matches — those carry the ambiguity in a
different form and migrate under their own rename, not this `farming`-token lint (the bare-`farm`
noun above is a one-time migration, not a blanket lint, because agriculture legitimately keeps the
word). Two escape hatches: the
`yield`/`crop` qualifier carve-out, and an inline **`vocab-allow`** marker for a line that must
*name* the term definitionally (a doc quoting the rule, a test decoy). The repo selftest asserts the
kernel sources are clean except an explicit `PENDING` worklist — each entry must still match a real
finding, so the worklist cannot silently rot.

**Migrated (2026-07-20):**

- **Autonomi node-ops** — `adapter-autonomi` + `console-api` prose → `node ops`; and the noun
  extension: `FarmSnapshot`→`NodeSnapshot`, `FarmHealth`→`NodeHealth`, `set_farm`→`set_node`, the
  `farm/…` capability paths → `node/…` (all on `storage.sovereign`, i.e. Autonomi node — no
  agricultural `farm/` path existed to preserve).
- **`anti-farming` → `anti-gaming`** in `mastery-ledger` and the LTI spec. **Not** `anti-sybil`:
  sybil-resistance is PoUL's job (one human, one root, 420 cap), and the mechanism *delegates*
  uniqueness to PoUL-thread identity rather than re-implementing it — its own concern is a real
  unique human inflating their record via self-loops or alias rings, which is gaming. Verified the
  mechanism is not a PoUL duplicate.

**Pending migration (in the lint's `PENDING` list, tracked, not silent):**

- **BNRi / exSat yield sense** — `chain-exsat-evm::BnriFamily::Farming`, and the `BnriFarming*`
  event docs in `shared-types`. One coherent BNRi rename; migrates *with* the exSat scoping (no BNRi
  contract exists yet), so the vocabulary is not left half-renamed. **Likely landing word `Yield`** —
  it is EVM yield-farming, not node ops and not mining — chosen with full context when the crate is
  real.

**Open, not a code issue:** `dockets/DATA_COMMONS_phase_charter.md` uses "anti-farming" in the
*sybil* sense (coupled with "unique human" and the 420 cap) — where PoUL is the owner. Reword to
sybil-resistance / PoUL, or leave; a docket-wording call, not code.

**Source.** RELAY_22 §134–149; noun extension + `anti-gaming` ruled 2026-07-20. Lint + migration
landed 2026-07-20.

---

## Law 5 — PLUR's `Respect` must be renamed if that plugin is ever built

**Rule.** If a PLUR plugin is ever built, its `R` ("Respect") **must be renamed**. It shadows the
governance unit `Respect`, which is a settlement-grade concept in the kernel.

**Why.** Two `Respect`s — one an interpretive framework's value, one the governance unit — is the
`BNRi` collision waiting to happen in a plugin. Recording it now, while it is uncontroversial, is
cheaper than a migration after the plugin exists.

**Enforcement.** **Not a live lint — nothing to catch yet** (no PLUR plugin exists). It is a
*constraint on the future plugin*, recorded in NC-VII1's guard so a builder meets it before the
collision can occur. Related and live: Law 2 already keeps PLUR vocabulary out of `reputation-engine`
regardless.

**Source.** NC-VII1 doc (RELAY_09 lineage). Recorded alongside `40417e7`.

---

## Adding a law

1. Get the founder ruling. Naming laws are the founder's call.
2. Add a section here: rule, why, enforcement, source.
3. If it is checkable, add the scan to [`crates/vocabulary`](../crates/vocabulary) with a **positive
   control** (a decoy the lint is shown to catch — a lint never seen to fail is not a lint) and, if
   it guards existing code, a repo selftest with an explicit pending worklist.
4. If it is a ruling without a lint yet, say so plainly — do not imply enforcement that does not
   exist.
