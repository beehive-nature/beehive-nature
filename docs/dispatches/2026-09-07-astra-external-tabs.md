# Keep BNR available when opening external websites

Founder reaffirmed that external destinations, including JAMS, open in a
new tab. Recorded the rule in `AGENTS.md` for every collaborating seat.

The showcase already used `target="_blank"` with `rel="noopener noreferrer"`
for JAMS, YouTube and generated collection links. Added a visible
"opens in a new tab" label to the JAMS link, with "Your BNR page stays here."
The estate's existing delegated external-link handler in
`surfaces/tour.js` remains in place. Internal links keep normal navigation.

Verified an actual JAMS click in the Codex in-app browser: a new tab opened
at `https://jams.community/`, while the original showcase tab remained at
`http://127.0.0.1:4189/docs/mvp-walk/artist-audio-showcase.html`.
This confirms the page is preserved; browser/user settings control whether
new browsing contexts are displayed as tabs or windows.

Scope: link wording and the standing authoring rule. No new navigation
interceptor or popup script. Existing showcase suites rerun for integration.
