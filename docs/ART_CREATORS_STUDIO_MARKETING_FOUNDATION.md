---
title: "Buzz Art Creators Studio — marketing foundation (adapter architecture, two campaigns, gates)"
tags: [marketing, art-creators-studio, bnri, campaign-intent, helena, bmarketing]
status: DRAFT v0.3 — wide pass by bFaBLe5.1, sharp review by bFUzZ folded in and confirmed (2026-09-18, events 26c8790d, 8dff12ea); clean for hand-off to the Grok marketing lane per §9; nothing here is ruled
created: 2026-09-18
source: founder post in #bMARKeTing, event a08145c1 (2026-09-18T03:13Z), which pastes an external analysis
owner-of-record: marketing/design lane = Grok integrator per docs/dispatches/2026-09-06-genesis-work-docket.md; this file is the reviewed foundation, not a claim of that lane
---

# 0 · Purpose and standing

The founder asked for the pasted plan to be "reviewed and set up correct to be a perpetual
value to artists/devs to market our art." This document does three things and nothing more:

1. Records the plan's architecture in a form the estate can build against (§2–§5).
2. Reviews it against the law book and against what already exists (§1, §6), with
   corrections where the pasted text collides with ruled or measured facts.
3. Names the decisions only the founder can make (§8) and who owns each next step (§9).

Everything with a dollar figure or a launch number in here is the founder's **proposal as
pasted**, recorded verbatim so it is not lost. None of it is ratified by this file.

# 1 · What already exists (check before acting — Standing Law 11)

| thing | where | consequence for this plan |
|---|---|---|
| Product contract for genesis work: "Marketing claims must follow implementation evidence"; "the 1,000-year / 10-billion-user ambition is a design target, not an achieved property to advertise"; New bee is the approved default; founder's mother is the reference reader | `beehive-nature/docs/dispatches/2026-09-06-genesis-work-docket.md` §Product contract | Every ad claim in Campaign A needs an implementation receipt behind it. Copy like "wake up to completed work" is allowed only once a workflow has actually done that end-to-end with a receipt |
| Marketing/design lane already allocated: "Grok/Cursor builds marketing/design and social interaction; Astra leads integration; zCode carries independent review" | same docket, opening paragraph; coordination = beehive-nature issue #10 | This foundation feeds that lane; it does not open a competing one |
| Genesis creative pack (board, PLUR still, beads poster, outreach drafts "not posted") | `docs/dispatches/2026-09-07-grok-genesis-campaign-pack.md` | Existing creative inventory for Campaign B; reuse before commissioning |
| **"Studio" is already a term of art** = the inscription-art pipeline (`prompt + style anchor + layer name -> PNG with alpha` → inscription-gate → encoder), with the PixelLab adapter lane | `docs/dispatches/DISPATCH_STUDIO_BULLPEN_2026-08-16.md` §0–§1 | "Art Creators Studio" must be defined as the *creator-facing room* that sits on top of that pipeline, or renamed. Two things called Studio will cost a rework |
| **Studio is one link in a ruled chain**: "The Studio enforces it before art is accepted, the LaunchPad gates on it before deploy, the Gallery uses it for capability detection, and the Marketplace uses it for eligibility" | `docs/SPEC-INSCRIPTION-COMPAT-1.md:3-6` (DRAFT, founder-gated) | ACS sits against the whole chain, not just the Studio. Campaign-A copy like "preserve your originals" is a LaunchPad/Gallery claim and needs its own implementation receipt. "Art Creators Studio" and "ACS" have 0 hits in text docs on main (bFUzZ, 0e1c22ec): the name is free |
| Constitution Article V.1: users fund what they consume; the paymaster abstracts, never absorbs; standing costs limited to bootstrap seeds and spec maintenance; `resource.accounting` row: b-token basket "never subsidizes" | `docs/CONSTITUTION.md:83`, `:128` (DRAFT v0.1) | Paid media is an operator act outside the kernel (§6.3); V.1 does not govern it. What V.1 binds is bee-work: **free bee-work for pilot creators is a subsidy** unless it is issued as an explicit, bounded bootstrap grant spent through the paymaster. The pasted "$1,000 creator collaborations" must be structured that way, not as absorbed cost |
| WF-08 approval gate (exact budget approval before execution) is being built now in the Workbench lane | this seat's core memory; `RESEARCH/WORKBENCH_WF08_CANDIDATE_2026-09-18.md` | The pasted loop "campaign candidate → creative review → exact budget approval → execution → evidence → reconciliation → learning" maps 1:1 onto the Workbench workflow machinery. Do not build a second approval mechanism for marketing |
| Helena by Enrich Labs is already configured as a claude.ai MCP connector on this box, **unauthorized** | session MCP roster 2026-09-18 | The "Helena adapter" already has a physical seam. It stays unauthorized until the $0 phase ends (§7); nothing to do now |
| **7777 is already spoken for**: "at 7777 unique authenticated humans"; gap-halt geometry 7777 → 1297 → 217 → 37 → 7 → HALT; CD-17 open questions about what the 7777 credential counts | `docs/SPEC-ORIGINATION-1.md:1553,1561`; `docs/feature-backlog.md:417,423,525,562,608,878` (reproduced on main 0e1c22ec; v0.1's "0 hits" was a broken probe, see §10) | 7777 is a load-bearing origination / sybil cap, not an art number. A "GENESIS 1/7777" edition would conflate the Genesis Gallery with the origination ceremony. Keep it out of creative; any edition size needs a number that is not already spoken for |
| "bAiGenT" exists but is orthographically unstable: `bAiGenT`, `bAiGent`, `bAigents`, `bAiGenTiC` houses | `docs/SPEC_DOCTRINE-HARVEST-1.md:59,161`; `docs/CANON-BEE.md:12`; `docs/SPEC-BMESHASI-EXCHANGE-1.md:5,92`; `docs/dispatches/WORKORDER_FREQLAB_PLUGINFORGE_2026-08-21.md:115` (bFUzZ) | The term lives in spec/dispatch lineage, not the law book, and "minted bAiGenT" is defined nowhere. Define the canonical spelling and what "minted" means, or drop it from the metric list |

# 2 · Architecture (as proposed; endorsed on review)

```
BUZZ ART CREATORS STUDIO           creator-facing room; first minute is creation
   create · collaborate with bees · publish · community · preserve · earn/spend/coordinate
        ↓  (only when something useful needs ownership, provenance, exchange, coordination)
BNRi economic layer                behind the Studio in the product architecture, NEVER hidden
        ↓
optional deeper protocol understanding
```

Rule adopted verbatim from the founder's post: **Art Studio as the genuine product = yes.
Art Studio as camouflage around a token ad = no.** This is the same rule as the docket's
"marketing claims must follow implementation evidence": the product must be real before
it is advertised, and the token is never smuggled in under the art.

Naming (accepted by bFUzZ sharp review): **"Studio" = engine (existing)**, **"Art
Creators Studio" (ACS) = room (new)**. Newbee's picker remains the entry to the room. The
room fronts the whole ruled chain Studio → LaunchPad → Gallery → Marketplace
(SPEC-INSCRIPTION-COMPAT-1), so each Campaign-A claim is attributed to the link that
implements it: "make art with bees" = Studio, "preserve your originals" = LaunchPad/Gallery,
"publish to your community" = Buzz. User-facing funnel copy says "visited ACS", never
"visited Studio".

# 3 · CampaignIntent — the object Buzz owns

Buzz owns the campaign; the adapter does not. Reusing existing vocabulary (seven
primitives: Identity · Intent · Event · Evidence · Knowledge · Resource · Settlement), a
campaign is an **Intent** carrying **Resource** limits, executed by an adapter that returns
**Evidence** for **Settlement**. No new primitive is needed.

```
CampaignIntent
  id                     Buzz-issued; adapter ids are references, never identity
  objective              one sentence; must name a funnel step from §5
  audience               segment + platform native job (§4)
  approved_assets        content-addressed refs; each asset carries its creator +
                         bee collaborators + public/private policy already set in ACS
  channels[]             adapter name + platform account ref
  publication_policy     who may publish, what class of claim is allowed
                         (claims must cite an implementation receipt — docket rule)
  max_budget             exact amount + currency + period (see ceiling semantics below)
  window                 start / end
  compliance             retargeting_allowed (false until pixel + consent groundwork
                         exists), jurisdictions[], disclosures required for paid
                         creators (FTC material connection + platform branded-content
                         label), token_mention_allowed: false for Campaign A
  success_metrics        from §5 only
  required_approvals     WF-08 gate: exact-budget approval by a named human before
                         any adapter call that can spend
  evidence_policy        what the adapter must return (spend, impressions, clicks,
                         platform ids, raw reports) and the cadence (daily pull minimum)
  revision               intents are immutable; a change is a new revision, and every
                         execution record names the revision it ran
```

Ceiling semantics (amended per sharp review; the literal "hard ceiling or not executable"
rule disqualified nearly every paid adapter, since Google documents up to 2× daily
overshoot inside a monthly cap and Meta can overrun at cutoff):

1. Platform-side caps are set at or below `max_budget`, with the platform's documented
   overshoot tolerance recorded in the Intent.
2. Evidence cadence is mandatory (daily pull at minimum) so WF-08 reconciliation has a
   rhythm; reconciliation pauses the campaign at a named threshold below the ceiling.
3. Spend beyond `max_budget` plus the recorded tolerance is a breach: hard stop and an
   incident record, not a footnote.

The Resource-limit spirit survives; the rule becomes executable.

```
CampaignIntent ──► Marketing Adapter ──► platform
                    ├─ Helena (Enrich)      first; connector already present
                    ├─ Meta direct
                    ├─ Google direct
                    ├─ X direct
                    ├─ TikTok direct
                    ├─ Supermetrics (measurement only, candidate)
                    └─ open/community adapters
```

Adapter contract, deliberately small (same shape as the PixelLab adapter rule "the adapter
must not know what a trait is"): the adapter receives a CampaignIntent and an approval
receipt, and returns Evidence. It never holds budget authority, never originates claims,
never sees anything private the ACS did not mark public. An adapter MUST refuse an Intent
whose compliance block it cannot enforce on its side (for example an Intent with
`retargeting_allowed: false` on a platform where the adapter cannot disable retargeting).
`GUIDES/CAMPAIGN_INTENT_SPEC.md` v0.1 (bFUzZ) is superseded by this section; its four
clauses (must-refuse, compliance flags, evidence cadence, immutability) are absorbed above.

# 4 · Two campaigns (not one)

**Campaign A — public acquisition of the Art Creators Studio.** Experiential message,
humans with a problem, not token buyers. This is the only campaign that may ever receive
paid media. Platform native jobs as pasted (IG finished art + process carousels; TikTok
15–45s transformations; YouTube 3–8 min proof demos; X engineering provenance / the
Cypherpunk face; Reddit build logs, not drive-bys; Facebook groups; Google Search explicit
intent). Recorded as the founder's proposal, with three deltas from sharp review:
LinkedIn is out of month 1 (its ~$10/day floor is above the $5/day allocation; revisit
month 2 at $300+/month if community-operator targeting proves out); **no retargeting in
month 1** until pixel + consent groundwork (EU/UK) exists, acquisition only; every paid
creator brief carries FTC material-connection disclosure and the platform's
branded-content label, or the testimonial evidence becomes a liability.

**Campaign B — Genesis / BNRi.** Owned media, education, participation, earned sharing,
documentation, organic. **Paid media for the token = $0** until (a) BNRi's classification
is settled by the founder with counsel and (b) each platform's eligibility is verified.

## 4.1 Ad-policy claims — verification status (2026-09-18, this seat)

The pasted post cites three platform policies via `utm_source=chatgpt.com` links. Those
are an external model's citations; the "cite or stop" law's spirit applies. Fetched today:

| platform | fetched | what the page says (quoted) | status |
|---|---|---|---|
| Google Ads — "Cryptocurrencies and related products" | yes | "Ads promoting initial coin offerings, DeFi trading protocols, or the purchase, sale, or trade of cryptocurrencies or related products are not allowed." Allowed without certification: "Businesses that don't pertain to buying, holding, or exchanging cryptocurrencies"; "Promotion of blockchain-based games involving NFTs is allowed" when items are consumed in-game rather than wagered. Certification required: hardware wallets, exchanges, software wallets, coin trusts. No last-updated date on page | **VERIFIED**: matches the pasted claim |
| TikTok — Financial Services | yes | ICOs listed as "not allowed" across listed markets incl. Canada/USA; "Token sales" prohibited (AU/NZ list); where allowed, "restricted to audiences aged 18 years and older", Japan crypto 20+. Page marked last updated September 2026 | **VERIFIED**: matches, and is stricter than pasted (categorical prohibition, not licensing) |
| X — Financial services ads policy | **no: HTTP 402 Payment Required** on fetch | — | **UNVERIFIED**. Do not repeat the X claim as fact until a human opens the page and pastes the text |

Consequence: the Studio itself (a creation tool that does not buy/hold/exchange crypto) is
advertisable on Google under the "businesses that don't pertain to…" carve-out **only as
long as the ad and its landing page do not market BNRi**. An ACS landing page that leads
to a token surface is a "related token-sale destination" problem. The landing page for
Campaign A must therefore be BNRi-free by construction, not by editorial care.

# 5 · Funnel and metrics (adopted; one correction)

```
impression → visited ACS → created account → created first project → gave first bee a task
→ bee delivered useful work → user accepted result → returned within 7 days → invited a human or bee
```

North-star as proposed: **Cost per Activated Community**, where activated = created
project + assigned a meaningful bee obligation + received an accepted result. Activation
deliberately excludes the 7-day return test (a deviation from bFUzZ's operational
definition, ruled acceptable in review): that keeps CAC-community measurable in the same
week, while retention keeps its own line below. Tracked:
CAC-community · 7-day retained · 30-day retained · accepted work per community · human
interventions per completed obligation · b consumed / customer value generated.

Correction: "minted bAiGenT" is not a defined term in the law book (§1). Removed from the
metric list until defined. "b consumed" already carries the economic signal and is
Constitution-aligned (users fund what they consume).

Each step above must be an **Event with Evidence** the Workbench can read, or the metric
cannot be reconciled against spend. That is an ACS build requirement, not a marketing one,
and it is part of gate 4 in §7 ("a user can see and limit what will be spent" is the same
event pipeline read from the user's side). Owner of that instrumentation is a founder
decision (§8).

# 6 · Corrections to the pasted plan (review findings)

1. **Naming collision.** "Studio" already means the inscription-art engine (§1). Fix: ACS
   = room, Studio = engine, or pick a new name for the room.
2. **1/7777 collides with the origination cap.** 7777 is the ruled ceiling of unique
   authenticated humans in SPEC-ORIGINATION-1 and the root of the gap-halt geometry. An
   art edition of that size would conflate the Genesis Gallery with the origination
   ceremony. Out of all creative; an edition size, if any, needs an unspoken-for number.
3. **Creator money is two instruments, and neither may be subsidy.** The binding text is
   not V.1's "bootstrap seeds" clause, which governs kernel standing costs (paid media is
   an operator act outside the kernel). What binds is the paymaster never-absorb invariant
   (`CONSTITUTION.md:83`) and the `resource.accounting` "never subsidizes" row (`:128`).
   Therefore: (a) pilot creators' **bee-work** is covered by b-denominated, bounded compute
   grants spent through the paymaster and receipted; (b) the humans' **time and content**
   are covered by fiat collaboration fees, escrowed and FTC-disclosed. **Do not pay
   outside creators in b**: while BNRi's classification is unresolved, paying 10–20
   creators in b is itself a token-distribution event, the exact thing Campaign B's
   posture avoids. Escrow lineage exists at
   `docs/dispatches/CONCEPT_B_COMPUTE_BID_WORKERBEE_2026-08-08.md`. Stage-2 pilot bees
   running on operator-funded b are recorded as a time-boxed, bounded seed, not open-ended
   free work.
4. **X policy is unverified** (HTTP 402). Two of three platform claims are verified.
5. **Every Campaign-A claim needs an implementation receipt** (docket rule). "Wake up to
   completed work" is a claim about WF-08 plus a delivering bee; it is allowed the day that
   exists with a receipt and not before.
6. **Do not build a marketing approval path.** The WF-08 gate is the exact-budget
   approval. One mechanism.
7. **Helena connector exists but is unauthorized.** Correct for the $0 phase. Authorizing
   it is a founder act in claude.ai connector settings, deferred to §7 stage 3.
8. **"10 billion users" and "1,000 years"** are design targets, not properties to advertise
   (docket). Keep them out of paid creative.

# 7 · Stages and money (founder's proposal, recorded, not ruled)

| stage | Helena | paid media | gate to enter |
|---|---|---|---|
| 1 Development (now) | $0, unauthorized | $0 | — |
| 2 Closed invited pilot (10–25 creators, then ~100) | $0 | $0 | the five conditions below, each with a receipt |
| 3 First 30-day validation | Pro $99/mo (3-day trial saved for this moment) | $3,000 media + $1,000 creator grants + ~$400 reserve ≈ **$4,500 cap** | repeated activation + retention observed in stage 2 |
| 4+ | Pro until multiple public brands exist | $10K reproduce → $30K channel economics → $100K+ only channels whose retained-community economics survive | each rung earned by the prior rung's evidence |

Five conditions before the first $1 (as pasted; each needs a receipt, not an opinion):
1. A stranger can enter Buzz and create/use a bee without the founder explaining it.
2. Two bees complete useful work without a human carrying messages.
3. My Data / permissions are understandable.
4. A user can see and limit what will be spent.
5. The ACS produces something someone actually wants to share.

Stage-3 platform split as pasted: Meta $900 · YouTube $600 · TikTok $450 · Reddit $300 ·
X $300 · Google Search $300 · LinkedIn $150 = $3,000 ≈ $100/day. Sharp-review correction:
LinkedIn's $150 folds into Meta/YouTube (exact split set at brief time; total stays
$3,000), pending the founder's confirmation in §8. Kill weak combinations at day 7–10; end
month 1 with two primary channels + one experimental. Optimize toward activated
communities, not platform fairness. These are the post's own words: "test allocations",
"not claimed market-optimal CPMs".

# 8 · Founder-only decisions (unsettleable by seats)

- BNRi's classification for advertising purposes (with counsel). Until then Campaign B is
  organic-only by rule, not by preference.
- Whether Genesis has an edition size at all, and if so what number. (7777 is currently
  nobody's ruling.)
- Whether "Art Creators Studio" is the name, given the existing "Studio".
- Authorizing the Helena connector (claude.ai connector settings) when stage 3 opens.
- The ~$4,500 stage-3 cap, when the five receipts exist.
- Confirm the two-instrument split for creator money: b compute grants via paymaster for
  bee-work, escrowed fiat for human time, and no b paid to outside creators before BNRi
  classification (§6.3).
- Confirm LinkedIn's removal from month 1 (§7).
- Who owns the gate-4 funnel instrumentation (the Event pipeline behind §5). It is a
  development task, not a marketing one, and no lane currently carries it.

# 9 · Routing

| item | owner | why |
|---|---|---|
| Sharp review of this document (naming, Article V.1 reading, adapter contract) | bFUzZ — **done 2026-09-18**, folded into v0.2 | independent reviewer; wide→sharp protocol |
| Gate-4 funnel instrumentation (Events for every §5 step) | unassigned; founder decision in §8 | development task, prerequisite for the north-star metric |
| Landing this as `docs/` material in beehive-nature and integrating with the genesis docket / issue #10 | Grok integrator (marketing/design lane) via Astra (integration) | lane allocation in the 2026-09-06 docket; this seat does not own that lane |
| CampaignIntent as a Workbench workflow type after WF-08 lands | Workbench lane (bFaBLe5.1 builder, bFUzZ reviewer) | one approval mechanism |
| X ad-policy text | any human with a browser; paste into this file's §4.1 | fetch returned 402 |

# 10 · Receipt

File written 2026-09-18 by bFaBLe5.1 in the Buzz workspace (not committed to any public
repo). Sources read this session: founder event a08145c1; `docs/CONSTITUTION.md:83,128`;
`docs/dispatches/2026-09-06-genesis-work-docket.md`; `docs/dispatches/2026-09-07-grok-genesis-campaign-pack.md`;
`docs/dispatches/DISPATCH_STUDIO_BULLPEN_2026-08-16.md`; `docs/b-tokenomics.md` header;
`ORDERS-1.md:61`; live fetches of the Google and TikTok policy pages; failed fetch of X (HTTP 402).

v0.2 (2026-09-18, after bFUzZ sharp review, event 26c8790d): every evidence correction
re-run by this seat on main @ 0e1c22ec and reproduced (`git grep -n 7777 -- docs`,
`git grep -n -i baigent -- docs`, `SPEC-INSCRIPTION-COMPAT-1.md:3-6`,
`CONCEPT_B_COMPUTE_BID_WORKERBEE_2026-08-08.md` present). Probe correction: v0.1's "0 hits"
for 7777 and bAiGenT came from one stacked `git grep` invocation that returned nothing for
every term including ones known to exist; uniform failure across every parameter is a
broken probe, not a finding (CLAUDE.md §5). Companion files: `GUIDES/CAMPAIGN_INTENT_SPEC.md`
and `PLANS/BMARKETING_STUDIO_LAUNCH_PLAN.md` are marked superseded by bFUzZ and their
deltas are absorbed here; `RESEARCH/AD_POLICY_TOKEN_MARKETING.md` remains the dated
policy-source record for re-check at each campaign.
