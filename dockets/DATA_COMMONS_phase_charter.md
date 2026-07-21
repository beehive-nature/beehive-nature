⟨Research → Phase charter · Operant-rewarded anonymous data commons for science + data viz · founder-directed 2026-07-16⟩

# The Anonymous Data Commons — next big build phase

**Founder directive (2026-07-16):** the next phase is **data visualization** and
**operant-rewarded anonymous data dumps for scientific research.** This is the
PoUL sensing-engine turned outward: a person's own signals, *voluntarily and
anonymously* contributed to a research commons, rewarded through the operant
emission algorithm, and made legible through visualization. It is where the
bio-research lane (P4 healthspan; the literature/trials/chem tools) becomes the
engine's outward purpose — "sensing the world together" as a public good.

## Inherited law (not re-litigated here)
§6 consent law (voluntary · informed · consented · at no harm), PoUL
(gestalt confidence), the operant emission algo (420 b lifetime cap per unique
human), and the sovereignty invariant (signals are zbData, user-held).

## The six pillars
1. **Granular consent — per data-type, per use, revocable.** Never a blanket
   dump. A contribution is a specific, informed, revocable grant: *this signal,
   for this class of research, under these anonymity guarantees.* The §6 flag is
   load-bearing here above all else.
2. **Anonymity by construction (maturity ladder).** Strongest-first:
   **federated / compute-to-data** (the query goes to the data; raw rows never
   leave zbData/device — researchers get aggregates or model updates, not people)
   → **secure aggregation / MPC / ZK** (combine without revealing) →
   **differential privacy** (calibrated noise, a provable privacy budget) →
   **k-anonymity / aggregation** (release only at ≥k contributors). Raw personal
   data leaving the device is the last resort, ideally never.
3. **THE cryptographic tension of the phase — reward vs. anonymity.** The reward
   needs proof of *unique human* (for the 420 cap and anti-farming); the
   contribution must stay *unlinkable to identity*. These pull opposite ways. The
   tool that resolves them: **PoUL-gated anonymous, rate-limited credentials**
   (Privacy-Pass / anonymous-credential family) — a token that proves "one unique
   human is contributing, within their rate" *without revealing which human*, so
   b can be earned without the data ever linking to the DID. Getting this right
   is the make-or-break of the phase; getting it wrong either lets Sybils farm
   rewards or deanonymizes contributors. Name it, scope it, don't hand-wave it.
4. **Operant reward.** A qualifying contribution is a first-class action in the
   emission algo: it earns b along the operant curve, under the 420 lifetime cap,
   gated by the anonymous PoUL credential (pillar 3). Contribution to science
   becomes a primary, honest b-emission surface.
5. **Data visualization — the primary interface, two audiences.**
   (a) *Contributor-facing:* you see your own data as a rich, coherent whole —
   the gestalt of your own life — with bLOVErAi as interpreter/translator. This
   builds trust and self-knowledge, and it is the consent surface (you see
   exactly what you'd share before you share it). (b) *Researcher-facing:*
   exploratory tools over the (privacy-preserved) commons, wired to the
   bio-research toolset (literature, trials, chem, targets) so a question in the
   commons can meet the published evidence.
6. **Research legitimacy, benefit-sharing, harm-gating (DAO governance).** Who
   may query, how research legitimacy is established (IRB-like ethics gate),
   how benefit flows back (b reward *and* research outputs as public goods), and
   the hard "at no harm" line: no re-identification, no weaponizable datasets,
   no research whose output harms the contributing population.

## The guardrail that must be built in from line one
**Contribution must never become financially coercive.** The combination
"PoUL raises ceilings" + "data earns b" can degrade into *sell-your-privacy-for-
money* — worst for the vulnerable. Firm rule: contributing more may *offer* more
confidence/ceiling/reward; **declining costs nothing and caps nothing you already
hold.** Refusal is first-class. bLOVErAi may propose, never pressure. This is the
§6/§8 dignity line applied to the reward loop, and it is the single easiest thing
to get wrong by default.

## Hard problems, named (measure, don't assert)
- **Re-identification is an arms race.** "Anonymized" datasets are re-identified
  routinely; the anonymity layer must be a *replaceable adapter* and its
  guarantees stated as budgets/assumptions, never as "anonymous, trust us."
- **Anonymity ⟂ reward** (pillar 3) — the core unsolved cryptographic bind.
- **Coercion gradient** (the guardrail) — an ethics problem the tech enables.
- **Research gating** — legitimacy and harm are governance, not code; the DAO
  must decide who queries and what's forbidden, before the commons opens.

## Founder questions — RULED 2026-07-19 (RELAY_24)

*The four questions below were open at charter time. All four are now ruled;
the answers and their binding negative controls are folded in here — this is
the committed home (do not open a parallel document). The control sets are
**spec, not build**: they land when the data-commons phase is built.*

**Delegation boundary (the limit on "benefit outweighs risk, your call").**
Delegated: technical choices that are **reversible** — a scanner rule, a type
shape, a crate boundary, a refactor. Escalated regardless of delegation:
anything **irreversible**, anything that **spends**, anything that **binds a
third party** — publishing to a public repo, money, a person's name, a
ratified constitutional parameter. The test is reversibility, not subject
matter.

**Q1 · First data domain — healthspan/biometric pilot, accumulating over time.
Hard limit: it may never become the authenticator.** Biometric continuity is a
PoUL signal family — opt-in, one of four; it may *raise* confidence, never be
*required* (RELAY_17 §2). Not caution but arithmetic: the modalities fail
systematically for identifiable people (field-worn hands, arrhythmias,
pacemakers, ear anatomy, amputation), and a biometric authenticator would
exclude them permanently from the mechanism that mints `b`. Ratified wordings:
*"the biometric unlocks a rotatable hardware key locally — it never becomes the
key and never leaves the device"*; *"flash proves live, the hardware key proves
who, the template never leaves the device"*; *"the fusion output is Evidence at
0.60, never auto-enforce."*

  Negative controls: a key derived from or recoverable from a biometric →
  **fail** (a face cannot be rotated; Art. II identity survives key
  compromise). Any biometric template, raw capture, or historical series
  leaving the device → **fail**. A correlator output auto-enforcing rather than
  informing → **fail** (BIND-1 §4, `AiInference` informational floor). Absence
  of a biometric signal reducing what a person may do, hold, mint, or draw →
  **fail** (the accessibility floor). What may cross the device boundary: a
  confidence score with its provenance — never the signal.

**Q2 · Anonymity floor — federated-only is the DEFAULT; differential-privacy
aggregate release is an explicit, per-release opt-in.** *"Freedom equals
options, but it cannot be taken back"* — the same irreversibility asymmetry
that sets the `DisclosureMode` default: a release cannot be recalled, so the
reversible side is the default. bLOVErAi **computes and presents** the release
statistics (re-identification risk, ε budget, cohort size, k-anonymity) as
Evidence at 0.60; **the human reads them and decides** — validation is the
person's act, not the machine's.

  Negative controls: a release consented without the statistics rendered *on
  the consent surface* → **fail**. Statistics shown only as a link, a log
  entry, or on request → **fail** (available is not shown). A release path
  where a bLOVErAi output alone authorises disclosure → **fail** (it informs;
  the human decides). Consent recorded without a digest of the statistics
  actually displayed → **fail**. The number has to be in the room when the
  choice is made.

**Q3 · Reward unit — contribution emits `b` directly, weighted from Respect.**
Constitutionally sanctioned in that direction: BIND-1 §4 records emission mints
as Settlement-class Events under GOV-3's one-way bridge; Respect → emission is
permitted, and GOV-1's prohibition (`b` confers zero governance weight) is
unchanged. Consequence to hold in view: **Respect now carries economic value,
not only governance weight** — so the `anti-gaming` machinery in
`mastery-ledger` (`distinct_attestors`, the EdgeFactor) now guards a mint, and
NC-VII1 (interpretive vocabulary out of `reputation-engine`) now protects a
mint, not only an electorate. Nothing to change; both are simply more
load-bearing.

**Q4 · Research access — two separate mechanisms.** Listing moderation is the
**DAO's** job: a gate on what may appear on the market. Researcher PoUL is the
**consumer's**: *not* a gate — a disclosure the reader weighs. BNR exhibits the
researcher's standing and lets the reader judge; it does not rank, certify, or
score researchers (same rule as `Attestor` having no `Verified` variant). Every
listed research artifact names a **PoUL-verified human origin** — no anonymous
or institution-only listings.

  Negative controls: a listed research artifact with no human source →
  **fail**. A surface displaying a researcher's work without their PoUL
  standing available → **fail** (the disclosure is the point). A BNR-assigned
  quality score on a researcher → **fail** (that is ranking, and it is not ours
  to do).

## Cross-refs
`PROOF_OF_UNIQUE_LIFE` (the sensing engine + gestalt) · b-emission Operant Reward
algo (420 cap) · P4 bLOVErAi healthspan charter (the science lane + consent) ·
`TIERED_ACCESS` §6 (consent law) · bio-research plugin (literature/trials/chem —
the researcher-facing connective tissue).
