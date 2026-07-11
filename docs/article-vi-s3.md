# Article VI §3 — Ratification

Status: **RATIFIED — v1.0, 2026-07-11. Epoch-0 founder ratification.** This text retires the constitution's Article VI §3 placeholder — its only open sentence — and is frozen at its landed sha: any change to these bytes is itself a **meta-tier amendment** under §3(c) below. It supersedes `docs/article-vi-ratification-draft.md`, whose five open decisions were closed by founder ruling on 2026-07-11.

Mechanism adapted from the **Optimistic Respect-based Executive Contract (OREC)** — Tadas / sim31, `optimystics.io/orec`, pinned at `github.com/sim31/ordao` @ `4a10ee55a413` (GPL-3.0, cited, not vendored). Copyright protects expression, not mechanism; this text is its own expression, with gratitude.

---

## §3.0 — What this section settles

Who ratifies a kernel amendment, and how that authority moves from one author to the governed — defined now, while there is one author, because *legitimacy cannot be added retroactively.* Authority moves in **epochs** on measurable triggers, never dates and never promises. Movement is one-way. Founder *initiation* is relinquished before founder *veto*: steering is surrendered before the brake.

## §3.1 — Eligibility: the Proof gate

Ratification votes never begin on an idea. An amendment is eligible only after it clears the existing Proof gate: a written RFC (invariant affected, motivation, migration path) **plus a working reference implementation and passing tests.** Proven code, then politics — stricter than base OREC by design.

## §3.2 — The mechanism

Ratification of an eligible amendment runs an optimistic, **Respect-weighted** vote in two stages:

1. **Voting period (21 days)** — Respect-holders vote `YES` or `NO`, weighted by Respect at time of vote.
2. **Veto period (21 days)** — only `NO` is accepted; no new `YES`. Blocking a contentious change must be easy; that is the point, and it is what lets passive-but-aware members secure the kernel without a standing quorum.

An amendment **passes** iff, when both periods elapse: `YES` clears its tier's floor (§3.4), **and** `yes_weight > K · no_weight` at its tier's `K` (§3.3).

**Weight is denominated in Respect. Only.** Per **GOV-1** (PERSON-1, ratified 2026-07-11): b confers zero governance weight in any form — held, staked, locked, delegated, lent, or wrapped — at every tier, forever. Respect is the emergent, non-transferable reputation deterministically recomputed by `reputation-engine` from ledgered Evidence — including fractal-consensus `PeerConsensus` attestations crossing the seam under **BIND-1** — never bought, never Sybil-split, never traded (GOV-2). The kernel does not define Respect (Art. VII); this process reads reputation-engine output as Evidence.

**Every denominator reads live Respect.** Per **P-12**, Respect is memorial: attestations stand forever, accrual ends at the end of a mortal experience. Quorums and floors are computed over the Respect of the living, never the ledgered total — *the ledger remembers; the electorate is the living.* Without this line, every threshold hardens toward unreachable as the honored dead accumulate.

## §3.3 — The tier ladder

*Each altitude of danger halves the minority needed to say stop.*

| Tier | Governs | K | Blocking minority |
|---|---|---|---|
| **Feature** | ordinary amendments | **2** | one-third of turnout |
| **Safety** | weakening any invariant (e.g. the funding check, the auto-enforce gate) | **4** | one-fifth of turnout |
| **Meta** | (a) `reputation-engine` — code or parameters; (b) the attestation and evidence flows that feed it, including adapter provenance weights; (c) Article VI itself, this text included | **8** | one-ninth of turnout |

The rule that sets the ladder: **the component whose capture hides itself gets the hardest supermajority.** Whoever can amend the reputation engine can mint the electorate that controls all future amendments, and a tilted electorate ratifies its own tilt — nothing looks broken from inside. Hence the meta-tier: the strongest brake in the building.

*Of record:* **G-1** — the `SignedSelfAttestation` base provenance weight, set at 0.55 in BIND-1 — is an **Epoch-0 meta-tier ruling** under clause (b), made and exercised while the founder held that authority alone. All future changes to reputation-feeding provenance weights route through this tier.

## §3.4 — Presence: floors and quorums

Optimistic ratification assumes enough live, attentive Respect to veto — *forever*. At century scale, participation decays, and a small active faction could pass constitutional changes through the silence of everyone else. Therefore silence cannot consent where consent matters most: **friction is a bug in operations and a feature in constitutions.**

| Tier | Requirement | Value |
|---|---|---|
| Feature | `YES` eligibility floor (optimistic otherwise) | **8%** of live Respect |
| Safety | **affirmative quorum** — approval, not absence of objection | **13%** of live Respect |
| Meta | **affirmative quorum** | **21%** of live Respect |

## §3.5 — The epochs

| Epoch | Entry trigger (verified against reputation-engine state) | Who ratifies | Founder role |
|---|---|---|---|
| **0 — Sole author** (now) | genesis | founder alone, after the Proof gate | full |
| **1 — Bootstrapped Respect** | Respect held by **≥ 144 members across ≥ 8 fractal rounds** — twelve twelves; real, not seeded | OREC vote | veto (§3.6) |
| **2 — Sovereign** | **≥ 34% of live Respect participating, averaged over 13 rounds** — a quiet week cannot trip it, a dying decade cannot fake it | OREC vote alone | none — the veto sunsets |

Entry into an epoch is itself verifiable, not declared. Movement is one-way; there is no re-centralizing path.

## §3.6 — The Epoch-1 veto: promotion, never execution

The founder's Epoch-1 veto **does not kill an amendment; it promotes it.** A vetoed feature- or safety-tier amendment may re-run as a fresh, full voting-and-veto cycle at **meta-tier difficulty** — `K = 8` plus the 21% affirmative quorum. The governed may overrule the founder only at the hardest bar in the building, with the deliberation time built in — a veto that can be tested is advice with teeth; a veto that cannot is an invitation to fork. This promotion path applies to the feature and safety tiers only; the meta-tier's co-sign is governed by §3.7 and is never subject to override.

## §3.7 — The last brake, and its named exit

Through **Epoch 1 at minimum**, every meta-tier amendment additionally requires a **founder/guardian co-sign**. The governance-of-governance brake is the last one released — but *last is not never*: a brake with no exit condition has merely named the captor, and Article V forbids it. The co-sign releases when **all three** hold:

**(i) Auditability, sustained.** Independent recomputation of all Respect from ledgered Evidence matches the live `reputation-engine`, continuously, across **seven consecutive incident-free post-genesis years.** An *incident* is: a meta-tier amendment reverted for cause; a demonstrated divergence between ledger-recomputed and live Respect; or a successful electorate-mint exploit. This is a real operation, not a vibe — BIND-1's Events and Evidence are the audit trail, and any stranger can run the replay.

**(ii) The governed ask.** A meta-tier passage — `K = 8`, 21% affirmative quorum — formally requesting release. Presence retires the brake; silence cannot.

**(iii) Founder assent — or the two-passage backstop.** Assent releases immediately. Absent assent, a **second identical meta-tier passage, no sooner than one full year after the first, releases without it.** The founder may ask the governed to wait; he may not make them wait forever. *(This clause also resolves founder absence without any death oracle: an absent founder simply never assents, and the backstop carries the exit on schedule.)*

Upon release: **the guardian keys are destroyed, publicly, and the destruction is ledgered as an Event** — sovereignty as a replayable fact on the bus, forever.

## §3.8 — The meta queue at birth

This mechanism is born with work on its desk. Pre-filed: the **remote-presence parameter** of the personhood cascade (**P-13**), to be adjudicated at this tier **no later than the close of the first post-genesis year.**

## §3.9 — Parameters, and who may touch them

All parameters in this section — periods, K values, floors, epoch triggers — are Article VI content and therefore **meta-locked by §3.3(c)**: changing any of them is a meta-tier amendment. `max_live_votes` spam prevention carries over from OREC unchanged. The parameter values follow one law — **the constitution counts the way the cascade counts**: 8, 13, 21, 34, 144, the same sequence as the Respect emission schedule. Numbers a community can recite are numbers a community can audit by heart.

## §3.10 — Consistency with the frozen kernel

No kernel change: primitives and invariants are untouched; this process lives above the kernel and reads reputation-engine output as Evidence. Respect stays out of the kernel (Art. VII). Reference implementations are not the protocol (Art. VI §4): an OREC-style Vaulta contract is one implementation and may be replaced without re-amending, provided the two-stage optimistic-veto semantics hold. If `reputation-engine` is itself amended, that amendment runs through this same process — the governance of governance is in-scope and self-referential by design.

---

*Ratified while there was one author, so that there need never be one again.*
