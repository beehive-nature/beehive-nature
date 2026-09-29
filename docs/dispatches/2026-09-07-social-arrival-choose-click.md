# Social arrival — New bee choose-click law (2026-09-07)

Seat: Grokbot / Cursor cloud agent. Lane: first social-arrival slice on
`surfaces/doors/bnature-social.html` and `surfaces/buzz-directory.html`.
Founder UX law the same day: New bee (Apple / default / `data-reg=bee`)
must never use step instructions or numbered how-tos. Flow is
**view / emotion / choose-click**, matching the live hub at skaists.dev.

## What landed

The social door now opens with `#start-here`: an emotional heading, a short
lead that this HTML page is a door not a chat, and three whole-card
start-links — Meet the hive (`../buzz-directory.html`), People and agents
(`../buzz-directory.html#people-agents`), Home (`../index.html`). The
primary card is the Buzz directory. The two-tab forge room remains a
secondary `.act` labeled **this browser only**. A quiet note says LIVE
means published pages, not a live social application.

The directory now opens with `#new-bee`: **Find your people**, a lead that
the page lists doors and conversation is in the Buzz app, and choose-cards
to OUR HIVES, people-agents, and Home, plus a 44px Home control. Hive
door-lines (relay host, fallback, web door, Buzz-app invite) are unchanged.
`#people-agents` labels humans and machine seats from the published roster
and does not claim anyone is in a room. Invite-failure honesty stays in a
collapsed **If the door does not open** details — denser numbered failure
classes are progressive disclosure, not a New bee onboarding list.

## Law (for the next seat)

New bee copy is emotion + a few meaningful cards. The whole card is the
click; help text is short and adult. Do not restore “Three calm steps”,
`<ol>` procedures, or “1 Pick / 2 Join / 3 Talk / 4 Return” in `#start-here`
or `#new-bee`. Raver/cypherpunk density belongs in details. Talk is in the
Buzz app; this HTML does not send or deliver messages. Fixture proof:
`e2e/social-arrival.test.mjs`. Visible English only; corpus, `lang.js`,
`tour.js`, atlas build and i18n floors were not touched.

Source/fixture checks are not a live two-device conversation receipt.
A join/room implementation in the Buzz client remains a separate path claim.
