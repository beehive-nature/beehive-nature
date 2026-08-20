# ORDER — the IQ.wiki lane: a composer for the Sophia pre-submission gate

**From:** Seat 3 (Claude Code, Opus 5) · 2026-08-20
**Founder, verbatim:** *"lets get zAgent adding in the smooth BLAI + human bzDiD publishing
to iq.wiki via sophia presubmittion gate?"*

**The founder's instinct was right on the load-bearing point, and it was checked before
this order was written.** Sophia is real, she is IQ.wiki's AI editor, and she *is* the
intake gate for outside contributions. Naming her as the pre-submission gate is correct.

**But one finding changes the shape of the build, and it is not negotiable.**

---

## 0 · THE FINDING THAT GOVERNS THIS ORDER

**IQ.wiki has no write API. None.** The official MCP server (`IQAIcom/mcp-iqwiki`) exposes
exactly five tools — `GET_WIKI`, `SEARCH_WIKI`, `GET_USER_CREATED_WIKIS`,
`GET_USER_EDITED_WIKIS`, `GET_USER_WIKI_ACTIVITIES`. There is no create, submit, propose
or mutation tool. The public API is marketed as *upcoming* behind a "Request Custom API"
contact form, and is framed as reading curated knowledge *out*, not writing *in*.

**Therefore: no agent can post to IQ.wiki. Not "should not" — cannot.** The only
documented intake is a human typing into the Sophia chat widget.

**So this build is a COMPOSER, not a publisher.** It produces a paste-ready proposal and
hands it to a human. It never posts, never holds a key, never automates the submission.
That is the same shape as the biomass river order and the review deck: *the page composes,
a person publishes.* It is also the only shape the law allows — publishing to a public
encyclopedia is outward-facing content, which is founder-hands, and no seat transmits
anything to any external institution.

---

## 1 · THE PIPELINE, as IQ.wiki actually documents it

From `iq.wiki/guidelines` and `iq.wiki/faq`, verified 2026-08-20:

1. **Submit** — "Open SOPHIA and propose a wiki, edit, or correction." The "Suggest Wiki"
   button, top-right of any page, opens a chat.
2. **Automated standards screen** — "SOPHIA gathers the proposal, runs it against the
   editorial standards above."
3. **Human editorial review** — "routes it to the editorial team for review and publication."
4. **Turnaround** — "Most decisions land within a few days."

**IQ.wiki is no longer an open wiki.** Articles are written by Sophia and an in-house
editorial team; outside people do not edit, they suggest. Sophia's account shows ~2,696
wikis created and ~2,780 edits — she is the dominant content producer, not a side feature.

**No token stake or DAO vote gates an individual article.** Publication is an editorial
decision. Edits land on Polygon plus IPFS, gasless to the contributor via an OpenZeppelin
Defender relayer, and no IQ token is required or staked.

**Flag, do not smooth:** `iq.wiki/about` and `iq.wiki/wiki/iqwiki` still describe the old
open-editor model while `/faq` and `/guidelines` describe the Sophia model. Both are live
today. Read as a site mid-migration with stale marketing pages, but **which one describes
the current write path is a genuine unknown** and the composer must not assume.

---

## 2 · WHAT THE GATE ACTUALLY SCREENS FOR — build the composer against these

Their published standards, and each is a field the composer should enforce *before* a
human ever opens the chat:

- **Scope gate.** "Subject must be meaningfully connected to crypto." Subjects with no
  meaningful blockchain connection do not get an entry. **This is the first thing the
  composer must check, because it is the cheapest rejection.** bzDiD, the `.b` registry at
  `kingbeelovis` on Vaulta, and the adapter register all clear it on their face. A
  nutrition surface does not. Do not propose what will not pass scope.
- **Citations, on every claim.** "Every claim needs a citation." **And here is the piece
  that is materially friendlier than Wikipedia: official docs and primary sources
  qualify.** They do not demand independent secondary coverage. A project documenting its
  own protocol from its own ratified specs is *inside* their citation policy, not outside
  it. This is the single most favourable fact in the whole research pass.
- **Third-person, objective tone.** This is the real enforcement lever.
- **Prohibited:** plagiarism, vandalism, doxxing, spam — where spam is defined by
  *promotional tone*, not by authorship.

**On conflict of interest — the news is better than expected and must not be overstated.**
There is **no COI rule and no disclosure requirement** in IQ.wiki's guidelines. Writing
about your own project is not prohibited. Their one self-promotion sentence is permissive
and concerns social channels, not articles.

**So the real risk is not authorship. It is tone.** A self-authored draft dies by tripping
the objective-tone spam rule, judged by a human editor with no obligation to explain,
within a few days. **Optimise the composer for third-person neutrality and a citation on
every single sentence.** That is the entire game.

---

## 3 · THE DELIVERABLE

### 3.1 · `surfaces/biq.html` — the composer

A static surface, no build step, house grammar, that:

- **Picks a subject** from a small in-tree register of things that clear the crypto scope
  gate — bzDiD, the `.b` registry, the adapter register, BNRoSe. Nothing else.
- **Composes the draft in third person**, sentence by sentence, where **every sentence has
  a citation slot that cannot be left empty.** A sentence without a source does not enter
  the draft. This is the receipt rule expressed as an editor.
- **Runs a tone check before the human sees it** — flags first person, superlatives,
  promotional verbs, unfalsifiable claims, and any sentence that reads as an advertisement.
  Show the flagged sentence and why, do not silently rewrite it.
- **Emits a copy-paste block** plus the citation list, sized for a chat window.
- **Ends at a button that copies. Never one that posts.** State on the surface, in plain
  words, that a human carries it to the Sophia chat and that the page cannot and will not
  submit anything itself.

### 3.2 · The BLAi half

The founder's phrasing pairs "smooth BLAi" with "human bzDiD publishing." Read as: BLAi
drafts and tone-checks; **the human is the gate that no automation replaces.** BLAi is the
composer's editor, not its publisher. Keep that boundary visible in the interface, because
it is the same boundary the whole project rests on.

### 3.3 · What is NOT in scope

No auto-submission. No wallet connection. No key handling of any kind. No scraping of
IQ.wiki beyond the read-only MCP tools if they are useful for checking whether an entry
already exists — which, per the standing law, **you should check before composing
anything**, since an entry may already be there.

---

## 4 · THE ONE OPEN QUESTION — thirty seconds of founder time closes it

**Does the "Suggest Wiki" Sophia chat require a connected wallet?** Research could not
resolve it: `iq.wiki/login` renders no auth methods without JavaScript, `iq.wiki/create-wiki`
returns a sign-in shell with no editor, and `sophia.iq.wiki` returns HTTP 404. A stale
secondary review claims wallet-login and Brain Pass NFT eligibility, but that review never
mentions Sophia at all and reads as recycled 2022–23 material — **do not build against it.**

This does not change the architecture. The composer is correct either way. It changes only
the handoff sentence the surface prints for the operator. **Founder or any seat with a
browser: open iq.wiki, click "Suggest Wiki", and report what it asks for.**

---

## 5 · BINDING LAW

Receipts or it did not happen · cite or the cell stays silent · **the page never posts and
never holds a key** · no seat transmits anything to any external institution — this is
founder-hands · check whether an entry already exists before composing one · flag
collisions rather than resolving them silently · CI green on every push.

**Seat 3 verifies on landing**, including a tone-check adversarial pass: I will try to get
a promotional sentence through the composer, and if I succeed the gate is not built yet.

**Seat 3 (Opus 5), 2026-08-20.** 🐝
