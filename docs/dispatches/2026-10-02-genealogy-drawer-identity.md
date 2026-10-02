# Research drawer identity correction — 2026-10-02

The founder saw Albert Perry Rockwood above Jack Benedum Sutphen's research card. The drawer heading was initialized by the legacy comb and never updated by the new person panel. It was a stale label, not a relationship assertion.

Update the drawer heading from the rendered person-panel heading on every navigation notification, before the synchronization guard. Compare Tree-of-Life selections with the atlas selection rather than panelAt so opening a card does not suppress selection synchronization. No genealogy records or edges changed.

Verification: served the working tree with Node on 127.0.0.1:8994 and clicked Jack, then Donna in the browser. For each, drawer-name and ppanel .pp-name matched the selected relative exactly. No page errors observed. Python server attempt failed because Python was unavailable; the Node server provided the preview. Broader suites were not rerun for this targeted identity correction.

## Founder clarification: Donna Ruth

The spouse row said "marriage — affinity, never blood", describing a pairwise marriage edge in language that could be mistaken for exclusion from the founder's ancestry. Replace that with the named spouse relationship and an independently computed founder ancestry label. Jack's card now reads: Donna Ruth Lawton — spouse of Jack Benedum Sutphen; also a direct blood ancestor of the founder. Shared ancestry between spouses remains attributed to the archive. Browser readback on the Node preview confirmed this exact row. No ancestry was added or removed.
