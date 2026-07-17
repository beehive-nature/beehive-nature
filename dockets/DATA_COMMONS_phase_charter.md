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

## Open founder questions
1. First data domain: healthspan/biometric (ties P4), behavioral, environmental,
   or founder's own device signals as the pilot?
2. Anonymity floor for v1: federated-only (nothing leaves), or allow
   differential-privacy aggregate release?
3. Reward unit: does contribution emit b directly, or earn Respect (which then
   modulates b unlock)? (touches the emission algo's qualifying-action set)
4. Governance of research access: DAO-gated allowlist, open with ethics review,
   or tiered by PoUL-of-the-researcher too?

## Cross-refs
`PROOF_OF_UNIQUE_LIFE` (the sensing engine + gestalt) · b-emission Operant Reward
algo (420 cap) · P4 bLOVErAi healthspan charter (the science lane + consent) ·
`TIERED_ACCESS` §6 (consent law) · bio-research plugin (literature/trials/chem —
the researcher-facing connective tissue).
