# Three-view journeys — source alignment and next work, 2026-09-07

Founder relayed Grok's next direction: three viewer journeys, followed by dApp bundles, with a clickable flow board underway. Astra checked the current sources at `38b3fbcf`. This dispatch aligns that work; it does not claim a new flow board or new page adapters have shipped.

## Same organism, suggested starts

Keep the bundles as suggestions. Every view keeps the same capabilities, numbers, readiness disclosures and routes to the commons. A choice of New bee, Raver or Cypherpunk is a presentation preference, not a type of person or a progression requirement. A graphic artist may use the calm view for every tool, including engineering pages. This follows [DESIGN-CONSTRAINTS.md §§5, 11, 13](../DESIGN-CONSTRAINTS.md).

| View | A useful first outcome | Suggested destinations | Current source boundary |
| --- | --- | --- | --- |
| New bee | Find something to enjoy or someone to meet, then return comfortably | Home offers art, music and people; social door and Buzz directory support community discovery; profile is optional background about the people and agents | The hub and reading pages have reviewed light themes. Gallery and music studio still need complete tool adapters. Profile is a public dynasty record, not a create-profile screen. |
| Raver | Make a kandi piece and understand how to carry it to another person | PLUR, festival, kandi and bset; direct entry to any choice | Kandi uses local state and clipboard handoff. The board must distinguish copying from delivery or receipt by another person. bset is a playlist surface; its technical presentation describes external track links and no autoplay. |
| Cypherpunk | Follow a claim to its dated evidence and named limits | Dock, stack, fieldnotes and the hub's Explore section | The Dock carries reproducible commands and limits; fieldnotes link receipts; stack contains browser-relative probes. These sources do not establish a newly audited production status. |

These are choose-click destinations, not a numbered checklist. Keep Home and Explore everything reachable in each presentation. Switching the view should preserve the user's current work and the current page; it must not start a tour or require the user to finish a story.

## Findings that should shape the board

1. **Start New bee at Home.** `surfaces/index.html:39–41` already offers art, music and people; `#explore` provides the wider directory. `surfaces/profile.html:74–75` introduces the dynasty record and the current/prior holders. A button labeled “Create your profile” would promise a workflow that this source does not provide. Use a truthful optional label such as “People and agents” or “About the hive” when linking that record; final visitor copy remains Grok's lane.
2. **Give the first outward clicks priority.** The gallery and music-studio destinations are outside the eleven shared reading adapters in `surfaces/register.js:122–127`. For example, `surfaces/blight/gallery.html:19–52` retains a dark viewer with small labels and fixed-dark controls. Adapt its surrounding UI as a complete unit while preserving the artwork itself. The music studio needs the same paired review of its controls and display. An approved arrival page does not establish downstream usability.
3. **Show where conversation actually happens.** The social door's `#start-here` and Buzz directory's `#new-bee` sections disclose that conversation happens in the Buzz app. Their browser-only room is separately labeled. A bundle does not add message delivery to these HTML pages.
4. **Keep the gift boundary understandable.** `surfaces/kandi.html:118–125` names local storage, clipboard termination and the absent DM/relay/inbox transport. The board can illustrate the founder's physical canon—giver wrist to receiver wrist, fingers interlocked, giver ending bare—but must not imply that this illustration proves remote software delivery. Preserve the difference between “copied,” “shared by the person,” and “received.”
5. **Keep evidence close to the claim.** `surfaces/dock.html:118–139` includes verification commands, a dated measurement and named unbuilt work. `surfaces/fieldnotes.html` contains dated entries and source links. `surfaces/stack.html:117–121` explains that probes are observations from the visitor's browser. Preserve those meanings in every view; opening the page is not a fresh operational audit.

## Division of work

- **Grok, current session and existing cloud workers:** keep ownership of the clickable board, social arrival copy and additive translation keys, plus the Raver consumer journey. Please incorporate the Home-first correction and honest action outcomes. Return the board path, exact changed files, active cloud PRs, and actual worker model/effort/session settings. Do not launch a duplicate worker just to acknowledge this handoff.
- **Astra, existing lead session:** shared toolbar, theme contract and adapter routing. Highest-priority next adapter candidates are `surfaces/blight/gallery.html` and `surfaces/blight/studio-music.html`, since the approved Home links directly to them. Claim their implementation paths in #10 before editing so Grok's board and any art work can proceed independently. This dispatch identifies candidates; it does not mark their implementation as running or complete.
- **zCode, existing meaning-review lane #7:** review new wording and translations against the same actions and limits. Keep the founder's language priority and the reader's saved choice. Do not call key coverage human translation acceptance.

No extra agent fleet was spawned for this alignment. Astra used the existing lead session with no model/effort override. Grok's current fleet settings were not independently read and are requested in its receipt rather than inferred.

## Evidence and limits

Source review only: no browser walkthrough, screenshots, service probes, wallet actions, transport tests or human usability acceptance. The already-published theme remains eleven newly adapted reading pages plus the hub's existing custom skin. Its exact-head release checks, deployment and 106-file served-byte receipt remain in [the theme dispatch](2026-09-07-new-bee-page-theme.md) and PR #17. The automatic main CI rerun also completed successfully before this alignment was written.

Coordination channel: [issue #10](https://github.com/beehive-nature/beehive-nature/issues/10). This dispatch is a source-backed handoff, not a new product capability or an automatic future job.
