# 2026-10-15 — fs 8-gen order #25 authed vein: the 10-ark image queue extension executed; 401-shift found

The founder signed into the staged pane ("logged back in"). The oracle read
AUTHED on landing: the tab sat on the control ark URL with the account
banner ("Account: travis remington"); the control **binding wire 200**
(das/v2 3:1:33S7-9GY8-1XT → apid TH-1951-20621-26546-14) — the wire oracle
green. (The control ark's record PAGE rendered "Page Not Found" this wake —
page-render quirk only; the wire and the previously-downloaded image both
stand. Recorded as-is, not diagnosed further.)

This wake then worked vein 1 (the order-24/25 named immediate labor):
the **10-ark image queue extension**, under the writer lock, with the SAVED
FILE WALKER loaded from disk.

## Queue extension (schema-true, joined, backed up)

- `sweep-queue.json` 366 → **376**: the ten `binding-probe-10` arks appended
  as `unattempted` entries, each joined to its citing persons/records/depths
  from the PUBLIC index layer (all ten carry real citation joins; two arks
  cite depth 3, the deepest tail depth 9; one ark cites 3 persons).
  Backups: `sweep-queue.json.pre-ext10-2026-10-14` (pre-extension) and
  `.pre-ext10-reorder-2026-10-15` (pre-reorder).
- **Page-side access probe (with the founder session) split the ten**: six
  image.xml 200 (**viewable**: 3QS7-L99B-J9D5, 3QS7-L99B-J9DF,
  3Q9M-CSX1-C9GL, 3QS7-L9SM-W9MC, 3QS7-89CD-1988, 3Q9M-C9BT-84WG) and four
  **403 = authed-restricted for this account** (3Q9M-C911-X99L,
  3Q9M-C91F-29BP, 3Q9M-C9BR-C9MN, 3Q9M-CSH8-5SDN). The extension block was
  reordered viewable-first (this wake's own ten entries only — the frozen
  366 untouched) so the restricted tail cannot block the sweep head.
- The guard's own `nextPending()` returned exactly the ten, in the new
  order, before and after the reorder.

## THE FINDING: FamilySearch shifted the unauthenticated image.xml answer (403 → 401)

The guard's PR #296 verification law re-fetches every claimed denial
cookieless from Node and requires the same status. Probe receipts
(2026-10-15, both planes):

| apid | page-side (session) | Node-side (cookieless) |
|---|---|---|
| TH-1951-20621-26546-14 (control; downloaded 10-03 = viewable) | **200** | **401** |
| TH-909-53984-951-62 (extension ark #1 = restricted) | **403** | **401** |

Unauthenticated image.xml now answers **401 for everything**, including
viewable images; the 58+6 banked xml-403 denials were verifiable in their
day because cookieless reads returned 403 then. Consequences, proven this
wake:

- **Downloads still verify** — checkpointDownload's authoritative check
  rides the das/v2 BINDING wire, which still answers 200 cookieless
  (curl receipt). The sweep of viewable arks is unblocked.
- **Denial banking is impossible as-built** — checkpointState's
  authoritativeDenial can never match a page-side 403/404 (cookieless reads
  401). The four restricted extension arks STAY PENDING by design:
  fail-closed, no silent reclassification, no outcome without verification.
  The fix (session-context verifier via opts.fetchImageXml routed through
  the page, or accepting 401 as the cookieless denial signature) is a
  **founder-gated guard change with red-first tests** — named, not done.

## The sweep (chunked driver; one latent walker bug found and worked around)

Driver shape: the per-call fresh kernel forced one writer lock per call
(in-process claim registry dies with the kernel; the exclusive-writer law
correctly refuses a second writer while the previous heartbeat is fresh —
takeover only after the 10-minute staleness window, by the guard's own
path; no manual lock surgery at any point).

- **3QS7-L99B-J9D5 downloaded** (2048×1367, 172,291 B on disk,
  deepzoom-stitched page-side). **Latent walker bug found**: `sweepOne`
  fires `checkpointDownload(...)` WITHOUT awaiting it — fire-and-forget. In
  the historical long-lived kernel the promise settled invisibly; under a
  chunked driver the kernel can be torn down before the manifest write
  lands (the image file and lock writes are synchronous and did persist;
  the manifest entry did not — no corruption, the ark simply stays pending
  and re-sweeps idempotently). Workaround: hold the kernel open until the
  entry verifiably lands (`loadState().states.has(ark)`). `checkpointState`
  has the same unawaited shape. **Named for the next guard/walker pass;
  not edited this wake** (the saved-file walker is a fixed artifact).
- A re-sweep attempt of the same ark hit the IAB evaluate command cap
  (BrowserCommandError, 92000 ms) on the tile-stitch eval — second full
  tile-set fetch for the same apid in 10 minutes, likely per-apid
  throttling. One walker-failure logged (retryable by design). Tab
  responsiveness itself proven clean after (binding probe 488 ms).

[SWEEP-RESULTS-PLACEHOLDER]

**Sweep results (all checkpoints verified landed in the manifest, in-kernel,
before each driver call returned):**

| ark | outcome | dimensions | bytes |
|---|---|---|---|
| 3QS7-L99B-J9D5 | downloaded | 2048×1367 | 172,291 |
| 3QS7-L99B-J9DF | downloaded | 428×512 | 12,796 |
| 3Q9M-CSX1-C9GL | downloaded | 1424×2048 | 124,713 |
| 3QS7-L9SM-W9MC | downloaded | 2048×1296 | 150,791 |
| 3QS7-89CD-1988 | downloaded | 1353×2048 | 137,106 |
| 3Q9M-C9BT-84WG | downloaded | 2048×1505 | 141,901 |
| 3Q9M-C911-X99L / C91F-29BP / C9BR-C9MN / CSH8-5SDN | **PENDING** — page-side 403, unbankable as-built | — | — |

All-state after: **378 = 314 downloaded (84,055,524 B; +739,598 B this wake)
+ 58 xml-403 + 6 xml-403-all**; every new entry sha256'd through
checkpointDownload's authoritative binding verification. The J9D5 throttle
theory confirmed: after ~25 min rest it re-downloaded byte-shape-identical
(2048×1367 / 0.16 MB). The writer lock (imgqueue-order25/zcode-r5) ages out
by its own staleness law; no manual release, no lock surgery at any point
in this wake. One queue-file corruption occurred and was repaired
assert-first: an inline `node -e` reorder nested one entry in an array
(this box's known inline-mangling class — the banked Write-tool pattern was
then followed); the repair script's duplicate-ark assert also correctly
REFUSED on first run because it mis-scoped the legacy documented twin
(3QSQ-G983-6VKX ×2 = the order-12 "365 unique of 366" standing state);
after scoping the assert to the extension block the repair landed and the
guard re-verified order + membership.

## Other authed-vein receipts

- **KWJ4-XBD lock — 4th confirmation** (10-10, 10-12, 10-13, today):
  v8 `person/KWJ4-XBD/details` = 200, 120,649 B, `readOnly: true`. The 5
  hints + NUMIDENT refusal candidate stay parked behind a founder call.
- Zero FamilySearch mutations (reads + image downloads only; nothing
  attached, created, or edited).

[REGEN-PLACEHOLDER]

**Public images-summary regenerated** (the regen-summary output contract —
one-liner entries, same-line `hexLawNote: PUBLIC-CONSTANT` markers,
counts+sha256+ark pointers only, bytes stay private-tier):
`assets/profile-archive/lineage/sources/images-summary.json` — harvested
378 attempted / **314 downloaded** / inQueueDownloaded 308 / inQueueNegatives
63 / **pending = the four restricted extension arks**; identity + openFrontier
prose carry the extension story, the 401-shift finding, and the named
guard-fix. Committed from this wake's worktree with the dispatch.

## Next owner

1. Finish the viewable tail of the extension sweep under the same
   chunked-settle discipline (writer lock per call, staleness-gated).
2. Founder-gated guard fix for the 401-shift (denial verification through
   the session plane or 401-signature), red-first; then the four restricted
   arks bank properly as xml-403.
3. The unawaited-checkpoint fix in the saved walker (one `await`), with a
   receipted edit of the fixed artifact — founder-named, not silent.
4. Standing rulings unchanged (QG8Q title-vs-wire class, Olsen cluster,
   Briggs duplicate, Norway parish, Don Ray pass); ANT rides codex
   #346/#347.
