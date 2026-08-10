# RAID — AXIS 3 (COWORK) · GOVERNANCE · DEAD-MAN · APPLICATION LAYER
**Seat:** Cowork · **Date:** 2026-08-10 · **Dispatch:** `DISPATCH_AR_ECOSYSTEM_RAID_DELEGATION_2026-08-09.md`
**Baseline every project is scored against:** arweave-js + arbundles + self-hosted gateway + native JWK.
**Verdicts: 0 TAKE · 3 PATTERN · 3 LEAVE.**

> **⭐ THE AXIS FINDING, which is worth more than any single verdict: every project on this
> axis re-inserts a token or an account between the user and Arweave — on top of a
> primitive that already needs neither.** Arweave's base layer is pay-once, store-forever,
> no intermediary. Sarcophagus adds SARCO + ETH gas + paid third parties; Load adds $LOAD +
> an EVM chain; 4EVERLAND adds $4EVER + a dashboard login; decent.land makes names into
> assets. **The capture is not at the storage layer — the storage layer is the one part
> that is already sovereign. The capture is the application layer selling access back.**
> That is the whole answer to "why does BNR build natively," and it is measured here, not
> asserted.

---

## 1. SARCOPHAGUS — **PATTERN** (founder's #1: "1st class value")

**L-VERIFY:** **MIT**, read from the tree — `sarcophagus-v2-contracts/main/LICENSE` is the
MIT body verbatim. **Not from the sidebar label**, which shows no license for that repo;
the org page shows `marketing_site` MIT and both `sarcophagus-v2-sdk` and `eaas` as
**Unlicense**. Mixed licensing across the org — check per repo, never per org.

**Status — the finding that decides this:** **the protocol is not shut down, and it is not
maintained.** Core repos last touched **2024-05-03** (`sarcophagus-v2-contracts`,
`sarcophagus-v2-archaeologist-service`, `quickstart-archaeologist`);
`sarcophagus-v2-app` **2025-02-09**; `base-token-incentives` **2025-02-18**. **~27 months
since the core contracts moved.** No sunset announcement found — which is worse than one,
because nothing tells a depending party to leave.

**Architecture:** contracts on **Ethereum**, encrypted payload on **Arweave**, and
third-party node operators ("archaeologists") **paid in SARCO** who hold key shards. The
creator ("embalmer") pushes the resurrection time forward by re-attesting; missing the
check-in triggers "resurrection" and the archaeologists release decryption to the named
recipient.

**⛔ WHY THIS CANNOT BE TAKEN — it fails the 1000-year test by construction.** The switch
only fires if, at trigger time, **paid third parties still exist and are still
economically motivated.** That is three live dependencies (Ethereum gas · SARCO price ·
an archaeologist quorum) on a mechanism whose entire job is to work **when the user is
gone and can no longer fix anything.** A dead-man's switch that needs a functioning token
economy is a dead-man's switch that dies with the token economy.

**✅ COMPARED TO OUR RULED SUCCESSION, ours is structurally stronger and it is worth
naming why:** `eosio.msig` + `delay_sec`, contract-based, **execution PERMISSIONLESS**
(45-day cap). **Nobody has to be paid for our switch to fire — anyone can execute it.**
Sarcophagus needs a motivated quorum; we need one indifferent stranger. Same problem,
opposite dependency direction.

**PATTERNS EXTRACTED (3):**
1. **The check-in cadence as an affirmative liveness signal** — the owner *pushes* the
   trigger date forward rather than a third party asserting death. No death oracle, no
   dispute. Maps directly onto our grace/lapse rhythm (28d/365d/28d): **our R5 lapse is
   already this shape** — absence of action, not proof of an event.
2. **Shard the key, not the payload** — payload goes once to permanent storage; only the
   decryption material is held in pieces by the quorum. Storage cost is paid once; the
   recurring cost is only on the small secret. **If we ever need a beneficiary release,
   this is the right split.**
3. **Re-attestation is a paid transaction** — which makes liveness *cost* something, so
   the switch cannot be kept alive by an abandoned automation forever. Worth keeping;
   worth **not** pricing in a volatile token.

**Four-axis:** code ⚠ stale-but-readable · community ⛔ dormant · compatibility ⚠
Ethereum-coupled · synergy ✅ high (succession is our lane). **Verdict: PATTERN. Do not
depend on the live protocol.**

---

## 2. DEAD-MAN'S SWITCH (permaweb app) — **NOT VERIFIED**

The dispatch cites "(permaweb link)" with no URL, and I could not identify a single
canonical app of that name with confidence. **Named, not claimed** — I am not going to
review a project I cannot pin to a source. **Give me the link and this is a short task.**
Sarcophagus above already covers the mechanism class.

---

## 3. DECENT.LAND — **PATTERN**

**What it actually is** (the dispatch asked: DAO framework? naming? identity? — the answer
is *naming plus identity*, not governance): **ANS (Arweave Name Service)** — human-readable
usernames over AR addresses, with bio/social metadata; **Ark** — multichain identity
attestation letting an AR user prove control of addresses on other chains; **ar.page** —
the profile surface. Not a DAO framework.

**⭐ MATERIAL FINDING THE DISPATCH TREATS AS TWO ITEMS: decent.land and load.network are
the same team.** load.network's own footer reads **"© Decent Land Labs 2026"**, and its
support link points at `calendly.com/decentlandlabs`. **Score them as one org's two bets,
not two independent data points** — that changes what their overlap tells us.

**Relevance to us:** goose's Axis 1 already ruled our anchor-based resolver architecturally
stronger than ANS. What survives is **Ark's cross-chain attestation shape** — proving "the
holder of this AR address also controls that address elsewhere" is the same problem as
binding a bDiD to adapter identities. **Pattern: attestation as a signed claim the
resolver verifies, not a registry the resolver trusts.**

**Verdict: PATTERN (Ark's attestation shape). LEAVE ANS** — superseded by our own resolver.

---

## 4. LOAD.NETWORK — **LEAVE** (founder: "post cloud like us")

**Honest answer to the founder's framing: it is not post-cloud like us. It is a new cloud
with a token in front of it.** Self-described "first high performance EVM storage chain"
and "the onchain data center" — an **EVM chain** with a **$LOAD fair launch**, explorer,
faucet, and an S3-compatible layer (`Load S3`) that resells into Arweave underneath.

**Fails the baseline test directly:** the baseline is arweave-js + arbundles + our own
gateway + our own JWK. Load asks us to add **an entire L1/L2 and its token** between us and
the storage we can already reach. **That is more dependency, not less** — and 8d applies:
a chain whose economics we do not control sits on the path of every user.

**Worth extracting, though — two real items:**
- **`xANS-104`** — their extension of the ANS-104 bundle standard. **Read it before we
  finalise our own bundle conventions**, purely to know what a superset looks like and to
  avoid colliding with it. (Handoff to Axis 1 — that is bundling territory.)
- **The hot-cache-then-permanence staging model** — data lands in a cache "with the same ID
  and provenance as Arweave, ready to be made permanent." **That is a genuinely good shape
  for our epoch pipeline**: the ID is stable before permanence is purchased, so nothing
  downstream has to re-key when settlement happens. **Pattern worth keeping even though the
  product is a LEAVE.**

**Verdict: LEAVE the network. PATTERN the staged-ID model. Read xANS-104 as reference.**

---

## 5. GLACIER — **LEAVE** (founder: "vaporware vibes but great vision")

**The founder's read is confirmed, and the pivot is the evidence.** glacier.io today
describes **"Verifiable and Trustless AI Network"** — GlacierAI / GlacierDA / GlacierDB, a
"programmable, modular, scalable blockchain for storing, indexing, and querying data...
supercharging AI, DePIN and large-scale DApps." **The Arweave-storage story is gone; the
positioning is now whatever is currently fundable.** A project that changes what it is
faster than it ships is not a dependency, at any horizon.

**⭐ ONE CONCRETE TELL, verifiable in ten seconds and worth more than the copy:** their own
marketing image is served from
`ob-public-bkt.s3.ap-northeast-1.amazonaws.com` — **a decentralized-storage company hosting
its own assets on Amazon S3.** Not fatal on its own; entirely consistent with the vaporware
read. **Cheap test, general application: check whether a decentralization project uses its
own product.**

**Is anything patternable?** The stated vision — *query and index permanent data, not just
store it* — is the real unsolved problem in this space and it is one we will hit. **But the
vision is not theirs to own, and there is no implementation here to learn from.**

**Verdict: LEAVE. Nothing to mirror. Recheck only if they ship.**

---

## 6. 4EVERLAND — **LEAVE** (founder: "sounds very similar to us")

**Similar surface, opposite structure — and this is the sharpest contrast on the axis.**
4EVERLAND is a **hosted Web3 cloud**: entry is `dashboard.4everland.org/login`, with
`$4EVER` token, staking, airdrop, and a product line (Hosting · Storage · Gateway · RPC ·
RaaS · AI) that **resells IPFS, Arweave, Dfinity and BNB Greenfield** behind an S3-compatible
API. 300k+ developers claimed.

**They are the reseller BNR exists to remove.** The user's relationship is with 4EVERLAND's
account system; the decentralized backends are an implementation detail the company can
swap, price, or gate. **Apply 8d — does the cost of the ten-billionth user land on a party
that can gate them? Here it lands on a company with a login page. Disqualified by
construction, before merit.**

**Pattern worth noting, honestly:** their onboarding is genuinely good — one dashboard,
S3-compatible so existing code migrates unchanged, no wallet required to start. **That
ease is exactly what the custodial shape buys, and it is what we have to match without
buying it the same way.** Naming that plainly is more useful than pretending the tradeoff
does not exist: **our sovereign path must be nearly this easy or users will choose the
reseller, and be right to.**

**Verdict: LEAVE. PATTERN the S3-compatible migration surface** — "your existing code works
unchanged" is a real adoption lever we can offer without a login.

---

## CAPTURE SYNTHESIS

| project | what it inserts between user and Arweave | recurring? | survives 1000 yr? |
|---|---|---|---|
| Sarcophagus | SARCO token · ETH gas · paid archaeologist quorum | yes | ⛔ no |
| load.network | $LOAD · an EVM chain | yes | ⛔ no |
| 4EVERLAND | $4EVER · a dashboard account | yes | ⛔ no |
| decent.land | names-as-assets · registry trust | partial | ⚠ unclear |
| Glacier | (nothing shipped) | — | ⛔ n/a |
| **baseline** | **nothing — JWK + arbundles + own gateway** | **no** | **✅ yes** |

**The pattern is uniform and it is the deliverable:** Arweave solved permanence *without*
an intermediary, and every application layer above it **re-introduces the intermediary it
was built to avoid** — because permanence is hard to monetise and access is easy to
monetise. **The base layer is the sovereign part. The apps are where the rent comes back.**

**Consequence for BNR, stated as a constraint rather than a slogan:** we are not competing
with these projects on features. We are competing on **whether there is anyone to pay in
year 50.** That is winnable — but only if our onboarding is close to 4EVERLAND-easy, which
is the one thing on this axis they genuinely do better than us today.

---

## HANDOFFS

- **→ Axis 1 (goose):** `xANS-104` before our bundle conventions freeze; **load's staged-ID
  model** (stable ID before permanence is purchased) for the epoch pipeline.
- **→ Axis 1 (goose), C6 as dispatched:** Sarcophagus informs our multisig/recovery — the
  three patterns above. **Its dependency direction is the lesson, not its implementation.**
- **→ Seat 1:** the founder's "sounds very similar to us" (4EVERLAND) deserves a direct
  answer: **same surface, inverted structure.** Worth a ruling on how close our onboarding
  must get before the sovereign path is genuinely choosable.

## COMPLICATIONS

**C1 — Item 2 is unverified and I did not substitute for it.** No URL in the dispatch, no
confident identification. **Give me the link.**

**C2 — Licenses verified from the tree for Sarcophagus only.** decent.land, load.network,
4EVERLAND and Glacier were assessed from their own sites and org pages; **their repo-tree
licenses are NOT L-VERIFIED here.** All four are LEAVE or PATTERN, so nothing depends on it
— **but do not cite this note as a license receipt for them.**

**C3 — "Not shut down" is not "alive."** Sarcophagus has no sunset notice and no
commits. I checked for a shutdown announcement and found none; **absence of a notice is not
evidence of operation**, and I am recording it that way rather than either direction.

**C4 — No chain interaction, nothing signed, nothing spent.** Mainnet untouched.

## SOURCES

- [sarcophagus-org (GitHub org, repo dates + license labels)](https://github.com/sarcophagus-org)
- [sarcophagus-v2-contracts LICENSE (MIT, read from tree)](https://raw.githubusercontent.com/sarcophagus-org/sarcophagus-v2-contracts/main/LICENSE)
- [Sarcophagus mechanism analysis — Perma DAO](https://medium.com/@perma_dao/in-depth-analysis-of-sarcophagus-the-eternal-dead-mans-switch-e8979b81208c)
- [Sarcophagus VC raise via DAO — Decrypt](https://decrypt.co/90032/crypto-dead-mans-switch-sarcophagus-raises-5-47m-from-vcs-via-dao)
- [decent.land / ANS docs](https://docs.decent.land/readme)
- [load.network (footer: © Decent Land Labs 2026)](https://load.network/)
- [Glacier Network](https://glacier.io/)
- [4EVERLAND](https://www.4everland.org/)
