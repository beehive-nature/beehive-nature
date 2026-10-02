# Research drawer identity correction — 2026-10-02

The founder saw Albert Perry Rockwood above Jack Benedum Sutphen's research card. The drawer heading was initialized by the legacy comb and never updated by the new person panel. It was a stale label, not a relationship assertion.

Update the drawer heading from the rendered person-panel heading on every navigation notification, before the synchronization guard. Compare Tree-of-Life selections with the atlas selection rather than panelAt so opening a card does not suppress selection synchronization. No genealogy records or edges changed.

Verification: served the working tree with Node on 127.0.0.1:8994 and clicked Jack, then Donna in the browser. For each, drawer-name and ppanel .pp-name matched the selected relative exactly. No page errors observed. Python server attempt failed because Python was unavailable; the Node server provided the preview. Broader suites were not rerun for this targeted identity correction.

## Founder clarification: Donna Ruth

The spouse row said "marriage — affinity, never blood", describing a pairwise marriage edge in language that could be mistaken for exclusion from the founder's ancestry. Replace that with the named spouse relationship and an independently computed founder ancestry label. Jack's card now reads: Donna Ruth Lawton — spouse of Jack Benedum Sutphen; also a direct blood ancestor of the founder. Shared ancestry between spouses remains attributed to the archive. Browser readback on the Node preview confirmed this exact row. No ancestry was added or removed.

## Don Ray navigation and person-view usability

A repeated click on the selected person returned without visible feedback; the drawer retained its prior scroll position. The person panel now uses the actual drawer scroll container, returns to the top on navigation (including selecting the same person), and puts branch walking/full research actions immediately after the name. Family links precede the long relationship explanation. Tree nodes now have a visible green-dot legend.

Browser verification on the served preview: opened Don Ray, clicked his own relationship-path endpoint, observed drawer scrollTop 0 and matching Don Ray heading; clicked walk this branch and observed climbing from Don Ray Remington; clicked open full research and observed his dedicated archive heading and record. Preview retained for founder testing. This is a focused interaction improvement, not a claim of completing the wider next-generation UX vision.

## Latvian skeleton and fan-chart toggle

Corrected the host SVG height override so the Tree-of-Life branch and hit layers fill the same stage as the relatives. Renamed the existing fractal toggle to fan chart and kept controls sticky. Switching back to Latvian tree now synchronizes the atlas root and selection; initial deep links and whole-line return synchronize roots too. View switching collapses the research drawer so the chart is visible.

Browser verified fan toggle selects atlas data-view fractal; Latvian-tree toggle restores the tree; measured branch SVG 558.67px inside the 560px bordered stage (previous height:auto mismatch removed). The prior preview tab's browser connection timed out, so a fresh preview was opened and preserved. Public deployment remains pending PR #305.
