<!--
STATUS: REVIEWED & VERSIONED 2026-07-04 (one-door) — awaiting FOUNDER DECISIONS
1–4 below; this is draft amendment text, NOT ratified constitution. It retires
the Article VI §3 "[TO DEFINE ...]" placeholder only upon founder ratification.
Review fixes applied on adoption: OREC citation pinned to upstream commit; one
blocking-fraction arithmetic error corrected (K_meta=8 blocks at a NINTH of
turnout, not a quarter — consistent with the draft's own K=4→⅕ line).
Sources read (step zero): CONSTITUTION.md (Art. V Economics, Art. VI Amendment,
Art. VII Non-Goals), reputation-engine crate, docs/feature-backlog.md (fractal
consensus / PeerConsensus routing). External (cited, not vendored — GPL-3.0
text stays out of this CC-BY-4.0 tree): OREC spec, optimystics.io/orec and
github.com/sim31/ordao/blob/4a10ee55a413/docs/OREC.md (Tadas / sim31, GPL-3.0;
pinned to upstream main @ 4a10ee55a413, 2026-04-02).
LICENSING: copyright protects *expression*, not *mechanism* — adapting OREC's
mechanism in our own words, with citation, is clean by default. The clean-room
reimplementation (no OREC/ORDAO Solidity copied) is belt-and-suspenders, not the
load-bearing reason. (Not legal advice; the citation practice is correct regardless.)
-->

# Article VI §3 — Ratification (draft amendment text)

Fills the constitution's only open placeholder: *who ratifies a kernel
amendment.* It adapts the **Optimistic Respect-based Executive Contract (OREC)**
to the kernel's amendment process, and — per the placeholder's own instruction
("define while there is one author; legitimacy cannot be added retroactively") —
it defines a **staged transition** from founder ratification to community
ratification, fixed now rather than improvised later.

## Design principle
Amending the kernel is the highest-stakes action in the system, so ratification
must be **harder than ordinary governance and slower to capture** — the same
logic as the DID recovery window (recovery must be slower than theft). Two
consequences:
1. A kernel amendment is only *eligible* to be ratified after it clears the
   Article VI §3 **Proof** gate that already exists — a written RFC (invariant
   affected, motivation, migration path) **plus a working reference
   implementation and passing tests.** Ratification votes never begin on an
   idea; they begin on proven code. This is stricter than base OREC, where any
   respected member may propose any transaction.
2. Decentralization is reached by the **installer model** (Art. V §2: bootstrap
   is temporary, decentralization permanent) — founder authority sunsets on
   measurable triggers, not on a promise.

## The mechanism (OREC, adapted to kernel amendments)
Ratification of an eligible amendment runs an optimistic, **Respect-weighted**
vote with a veto delay. "Respect" is the **emergent, non-transferable reputation
computed by `reputation-engine`** (deterministically recomputed from evidence —
including fractal-consensus `PeerConsensus` attestations; never bought, never
Sybil-split). The kernel does not define Respect (Art. VII); the ratification
*process* lives above the kernel and reads reputation-engine output as Evidence.

Two stages, mirroring OREC:
1. **Voting period** — Respect-holders vote `YES` or `NO`, weighted by Respect at
   time of vote.
2. **Veto period** — only `NO` is accepted; no new `YES`. This makes blocking a
   contentious change easy ("this needs more deliberation"), which is the whole
   point: passive-but-aware members secure the kernel without needing a quorum.

An amendment **passes** iff, after `voting_period + veto_period` elapse:
- `YES` Respect ≥ `amendment_weight_threshold`, **and**
- `yes_weight > K · no_weight`.

For ordinary OREC `K = 2` (⅓ of turnout blocks). Because this is the
*constitution*, `K` is tuned **stricter** (see parameters) so a larger minority
can block. `max_live_votes` spam-prevention carries over unchanged.

## The staged transition (the placeholder's real question)
Authority moves in epochs gated by **measurable conditions, not dates**:

| Epoch | Trigger to enter | Who ratifies | Founder role |
|---|---|---|---|
| **0 — Sole author** (now) | genesis | **Founder alone** ratifies amendments that clear the Proof gate | full |
| **1 — Bootstrapped Respect** | Respect distributed to ≥ N active members across ≥ M fractal rounds (N, M below) | **OREC vote** ratifies; **founder retains a veto** during the veto period | veto only |
| **2 — Sovereign** | Respect-weighted participation clears a sustained floor over a defined window | **OREC vote alone**; founder veto **sunsets** | none |

Each trigger is checked against reputation-engine state, so entry into an epoch
is itself verifiable, not declared. Movement is **one-way** (no re-centralizing).
Founder *initiation* power is relinquished before founder *veto* power — you give
up steering before you give up the brake, exactly as recovery-key priority
outranks routine rotation in the DID spec.

## The meta-tier — the strongest brake in the building
There is a circularity one level *above* safety, and it is the steward coup
reborn: ratification power derives from Respect → Respect is computed by
`reputation-engine` → `reputation-engine` is itself amendable → by Respect-weighted
vote. **Whoever can amend the reputation engine can mint the electorate that
controls all future amendments.** Worse, its capture is **self-concealing**: a
tilted electorate ratifies its own tilt as legitimate, so nothing looks broken
from inside.

Therefore a distinct, strictly-highest **meta-tier** governs any amendment that
touches **(a)** `reputation-engine` (its code or parameters), **(b)** the
attestation/evidence flows that feed it (e.g. the `PeerConsensus` provenance,
adapter provenance weights), or **(c)** Article VI itself (this mechanism). The
meta-tier requires *all* of:
- a supermajority stricter than even the safety tier (`K_meta`, e.g. **8** — a
  **ninth** of turnout blocks, by the same `no ≥ turnout/(K+1)` arithmetic as
  the K=4→⅕ line below);
- an **affirmative** Respect quorum (approval, not mere absence of veto — see
  §Parameters and open decision 4); and
- through **Epoch 1 at minimum**, a founder/guardian co-sign that does *not*
  sunset on the ordinary Epoch-2 trigger — the governance-of-governance brake is
  the last one released, not among the first. But "last" is **not "never"**: its
  release is governed by its own named exit condition (open decision 5), because
  a brake with no exit condition has merely renamed the captor.

Rule of thumb: **the component whose capture hides itself gets the hardest
supermajority.**

## Parameters (founder to set; placeholders)
| Parameter | Meaning | Suggested starting point |
|---|---|---|
| `amendment_weight_threshold` | min `YES` Respect for eligibility | conservative (well above an ordinary-proposal threshold) |
| `voting_period` | stage-1 length | longer than ordinary governance (weeks, not days) |
| `veto_period` | stage-2 (block-only) length | ≥ `voting_period` — blocking must be easy |
| `K` (supermajority ratio) | `yes > K·no` | **4** for constitutional changes (⅕ of turnout blocks), vs OREC's 2 |
| `K_meta` | supermajority for the **meta-tier** (reputation-engine / attestation flows / Article VI itself) | **8** — the hardest brake in the building |
| `affirmative_quorum` | min `YES` Respect as a share of *total* Respect, required at the constitutional & meta tiers (approval, not mere non-veto) | set so silence cannot pass a change (see open decision 4) |
| `N`, `M` | Epoch-1 entry (members, rounds) | set to the point where Respect is real, not seeded |
| Epoch-2 floor + window | sustained participation to reach sovereignty | set so a quiet week can't accidentally trip it |

## Consistency with the frozen kernel
- **No kernel change.** This is Article VI §3 text; primitives and invariants are
  untouched. The ratification process is application/governance-layer.
- **Respect stays out of the kernel** (Art. VII): the kernel stores evidence;
  the amendment process *reads* reputation-engine output. If reputation-engine
  is itself amended, that amendment runs through this same process — the
  governance of governance is in-scope and self-referential by design.
- **Reference implementations are not the protocol** (Art. VI §4): an OREC-style
  Vaulta contract is one implementation of this rule and may be replaced without
  re-amending, provided the two-stage optimistic-veto semantics hold.

## Open founder decisions (the parts only you can set)
1. The parameter values above — especially `K`, the epoch triggers, and the
   **meta-tier blocking fraction**. On the last: review corrected a prose/value
   divergence (the draft said "K_meta=8 — a quarter of turnout blocks"; by the
   `no ≥ turnout/(K+1)` arithmetic, K=8 means a *ninth* blocks and "a quarter"
   would be K=3). The surviving value is K=8, but which was the *intent* is now
   unknowable from the text — and the strength of the hardest brake in the
   building must not be whichever side of a typo survived review. **Choose the
   blocking fraction first; derive K from it.**
2. Whether Epoch-1 founder veto is **absolute** or itself Respect-overridable by
   a supermajority (recommend overridable, so the brake isn't a permanent veto).
3. The tier structure. At minimum three tiers: **feature** (ordinary `K`),
   **safety** (weakening an invariant like the funding check or the auto-enforce
   gate → higher `K`), and **meta** (reputation-engine / attestation flows /
   Article VI → `K_meta`, the strictest). Confirm the ladder and its values.
   (Three-tier recommended.)
4. **Optimistic vs. affirmative at constitutional altitude.** OREC's
   pass-unless-vetoed design is the right cure for *operational* voter-apathy —
   but a veto-based constitution assumes enough live, attentive Respect to veto,
   **forever**. At century scale participation decays and Respect concentration
   drifts, so under quiet conditions a small active faction can pass
   constitutional changes through the *silence* of everyone else. Decision: does
   the constitutional **and meta** tier require an **affirmative Respect quorum**
   (approval, not mere absence of objection), while routine governance stays
   optimistic? **Recommended: yes** — friction is a bug in operations and a
   feature in constitutions.
5. **The last brake's own exit condition.** The meta-tier founder/guardian
   co-sign is a Ulysses pact — correct during bootstrap (a Ulysses pact requires
   a Ulysses), but a constitution whose anti-capture mechanism terminates in a
   *permanent* single-holder veto has only **named its captor**, and Article V
   forbids it ("bootstrap is temporary; decentralization is permanent"). So this
   document must name that brake's **own exit condition now**, however distant and
   demanding — a *measurable* state, never an unstated "someday." Candidate
   release gate: reputation-engine maturity thresholds sustained across **N
   incident-free years of meta-governance**, **plus** a `K_meta` supermajority,
   **plus** founder assent — culminating in **ceremonial destruction of the
   guardian keys**. This is the honest resolution of the tension between
   "legitimacy cannot be added retroactively" and "no permanent captor": settle
   it in writing while there is still one author to settle it. **This is the
   last structural gap in the amendment mechanism.**

---
_Governance design for founder decision and review; not legal advice._
