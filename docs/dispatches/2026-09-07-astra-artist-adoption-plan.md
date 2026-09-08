# Artist adoption: make one creative relationship work end to end

Strategic recommendation, 2026-09-07. Proposed priorities, not a campaign
launch, committed recruitment, demand forecast or new agent assignment.

## Diagnosis from inspected evidence

BNR has working components and a recognizable creative identity. The
largest adoption gap is a complete, repeatable artist-to-person journey:
discover a real work, enjoy it, keep or gift a reference, support its maker,
and return. Tests establish software behavior; demand requires people
choosing to use the result.

- PR #34 is open and passed all eight checks at `7adcbc02`; the artist
  showcase is a review build using a generated tone. Save/remove/export,
  cross-tab behavior and source identity have implementation evidence.
- `surfaces/profile.html` describes published records, not a profile editor.
  `surfaces/doors/bnature-social.html` routes cross-device conversation to
  Buzz; it is not itself a messaging application. `buzz-directory.html`
  presents a manually verified directory rather than live presence.
- The campaign branch's newcomer scorecard explicitly records no known
  human attempts. Its festival brief leaves demand, host commitment and
  willingness to pay unknown. These are limits of the inspected record,
  not a claim that nobody has ever used BNR.
- The kernel continuity audit records remaining recovery/replay and
  provider-independence proofs. This strategy does not re-audit the live
  production box or declare those gaps resolved.

References: PRs [34](https://github.com/beehive-nature/beehive-nature/pull/34),
[28](https://github.com/beehive-nature/beehive-nature/pull/28);
[kernel continuity](2026-09-06-astra-kernel-continuity.md);
[gift integration](2026-09-07-astra-kandi-integration.md).
Campaign evidence inspected at
`origin/grok/genesis-campaign-pack-2026-09-07`, files
`docs/mvp-walk/newcomer-observation-scorecard.md` and
`docs/mvp-walk/festival-pilot-brief.md`.

## Proposed first offer

Make a beautiful piece someone can keep, share and connect back to its maker.

Start with the founder and matriarch's original bloom and a small number of
invited artists' supplied pieces. A proposed discovery cohort is five artists
and roughly twenty willing friends/listeners in one existing creative
circle. This is an inexpensive learning sample, not a market-size estimate
or statistical proof. Nobody has been recruited by this dispatch.

Publishing may initially be assisted behind the scenes. The receiving
journey must be usable without coaching. A recording is not required for
the first visual-art journey; supplied music can follow its own permission
and source checks.

## Missing capabilities, in priority order

1. **A finished work page.** Real artwork, maker credit, a stable public URL,
   a useful social preview, optional supported media, and a maker-supplied
   support/shop/commission destination. Offer one obvious first action.
   Browsing and keeping a public reference need no wallet or node setup.
2. **A complete sharing journey.** Connect the existing kandi/share/receive
   machinery to a credited work reference. Test the actual link/QR handoff
   on two independent phones; recipient preview precedes Keep. Preserve
   credit through sharing/remix, and distinguish a reference from ownership
   or a licensed media copy. Sharing privately does not make dedications or
   private collection contents public.
3. **A reason to return.** A useful My collection, optional artist following
   or subscriptions, chosen notifications and a recurring small artist drop.
   Validate collection import/recovery and eventually fresh-device recovery;
   this-browser storage and a download are not automatic account sync.
4. **A benefit for the artist.** Useful discovery, qualified commission or
   shop interest, collaborations and eventual confirmed income. Start with
   artist-selected existing destinations. A support-link click is not a
   payment receipt. BNR monetization should fund useful creator services and
   actual resource use; token settlement must have a real service behind it.
5. **Trust and operating readiness.** Clear person/agent labels alongside
   color, creator attribution, consent, public-content reporting/blocking,
   moderation responsibility, recoverable state, measured service costs,
   and graceful behavior on weak phones/networks. Budget AI and media work;
   do not assume continuous founder subsidy as adoption grows.

The three views remain presentations of the same capabilities. New bee is
the calm default; Raver carries chosen emotional expression; Cypherpunk
exposes deeper controls/evidence. Shared identity, credits and state prevent
the views becoming three products. Home still starts with art/music/people.

## Distribution and network effect

Proposed cycle:

Artist shares a work -> a person enjoys/keeps it -> gives or curates it for
someone else -> the recipient discovers the maker -> a return, collaboration
or support action gives the maker a reason to contribute again.

A shared link supplies distribution. A network effect requires more
participants to increase usefulness for existing participants: better
collections, relevant collaborators, credited remixes and more meaningful
discovery. Measure that separately from link traffic or account totals.

Launch into one connected creative circle before widening to unrelated
audiences. Every featured artist should get a usable work link, preview and
share card. Learn which destinations their people actually use. Preserve
BNR when opening external destinations, and earn return visits with the
collection, relationships and new work. Portable collections remain a user
benefit. Paid reach and referral rewards are later experiments, after a
returning cohort exists; agent activity does not substitute for human demand.

JAMS is a candidate listening/distribution partner. Start with credited
links, then a controlled interoperability demonstration; a shared Autonomi
name does not prove compatible import or playback. LOVErnment DAO belongs
in community stewardship, transparent project decisions and collaboration
policy. Routine creation/listening should not require governance ceremony.

Useful primary-source comparisons: [Bandcamp](https://bandcamp.com/about)
connects discovery to direct artist support;
[Are.na](https://www.are.na/about) offers personal/shared collections,
collaboration and exports. My inference is that usefulness alone and
relationships together are both important; neither source proves BNR demand
or promises BNR their results. No upstream code adoption is proposed.

## Proposed next sprint and ownership

First finish the releasable user journey across existing PRs, then observe it
with the small willing cohort and repair its largest friction. A two-week
timebox is a planning proposal, subject to artist participation and findings.

| Owner | Bounded result | Acceptance |
| --- | --- | --- |
| Astra integration | One release containing the work page, portable collection and working receive path; public preview/version and CI together | Two independent devices, weak-network attempt, reload/recovery and all three views; distinguish tested failures from absent evidence |
| Grok / existing Cursor seat | Artist presentation and sharing materials around that shared contract; own the complete artist/fan journey | An invited artist has a credited work page and usable share card; receiving person can act without reading technical instructions |
| zCode / existing seat | Recovery, metering and one controlled storage/retrieval example that supports the journey | Full retrieved bytes match; unavailable provider is handled honestly; cost and recovery behavior recorded |
| Founder and willing people | Supply real work and observe actual use; the matriarch is a valuable New bee reviewer alongside other newcomers | Record confusion, declines, completions and voluntary return separately |

These are proposed allocations. No new fleet, public posting, messages to
artists, paid acquisition, purchases or storage uploads were triggered.
Set work limits around completed outcomes: one worker per owned slice and
an independent reviewer for consequential state changes. Track time from
usable change to deployed journey, not commits or agent counts.

## Measurement that can change our decision

Use volunteered pilot observations and minimal aggregate data; no hidden
cross-site tracking or private gift payload collection.

- Invited people who start and complete a first useful action unassisted;
  retain the full invited count and distinguish decline from technical failure.
- Offered gifts/shares that reach an independently observed recipient Keep.
- Participants who choose another useful action seven days later, with a
  defined cohort denominator; separate reminders from unsolicited return.
- Artists who contribute again or introduce another artist voluntarily.
- Confirmed artist benefit and cost per completed journey. Log commission
  inquiries/support clicks separately from completed payments.

Do not call an invitation click, copied payload, wallet address or agent
interaction a retained human. Small pilot results are directional. Expand
when repeat use and maker benefit survive another cohort; if people admire
the art but do not return, improve enduring usefulness before widening reach.

Documentation-only strategy lane. Source/PR inspection and primary web
references informed it; no software, production or demand test is claimed.
