# fs 8-gen evidence preservation lane: opened 2026-10-17

Seat 3 (Claude Code). Lane order from the founder, chat 2026-10-17: "Start the
evidence preservation lane: identity rulings, Rockwood lock, image frontier."
Base: origin/main `0a7233678`. Zero FamilySearch mutations this turn.

## 1. Session oracle (receipt)

Browser pane reopened on `https://www.familysearch.org/robots.txt`; same-origin
`fetch('/service/tree/tree-data/v8/person/KWJ4-XBD/{summary,details}')` at
2026-10-17T23:08:50Z:

| state | verdict | receipt |
|---|---|---|
| AUTHENTICATED | **FALSE** | both wires 401, 449 B |
| API_READABLE | **FALSE** | same 401 |
| PAGE_RENDERABLE | not probed | unauthenticated; last authed reading FALSE (control ark 33S7-9GY8-1XT "Page Not Found", 2026-10-16) |
| PROVIDER_WRITABLE (KWJ4-XBD) | not probed | last reading `readOnly: true`, sixth confirmation 2026-10-16 |

The parked "image queue KEEP" tab did not survive (pane mortality). The
Rockwood lock recheck and the ~7,037-ark rendered-DOM frontier both need a
signed-in session; no agent enters the password. The frontier also needs
PAGE_RENDERABLE to come back TRUE: per-record rendered DOM is the only proven
mapping method, and the control ark did not render while authed.

## 2. Check before acting

The walker's unawaited-checkpoint fix is **already landed** (order-27
reconciliation, banked by the 2026-10-16 denials rider). Not redone.

## 3. Defect found: L1N9-SL2 carries the wrong person's label

`tools/genealogy/sources-sync.mjs:61` and the public artifact
`assets/profile-archive/lineage/sources/sources-sync-2026-10-13.json` label
**L1N9-SL2** as "Christen Olsen (census cluster) 1806–Deceased".

- `2026-10-03-fs-holes-nels-lars-censuses.md:32` and `:48` name L1N9-SL2 as
  **Lars** and the census-cluster father as **L1N9-S2L**, as two separate pids.
- The artifact's own only transcribed record for L1N9-SL2 is QG8Q-GRKK, whose
  principal reads "Lars Christensen", Male, Christening, Bakkendrup.
- `hint-census.mjs:22` carries L1N9-S2L as the census Christen and swept it
  (22 hints).

So the 2026-10-12 addendum-2 "transposed typo" fix (`2026-10-12-fs-8gen-order23-reconciliation.md:224`)
swapped two people. Correct entry: `"L1N9-SL2": Lars Christensen, 1839–`.
**Applied in this commit on the founder's word** (chat 2026-10-17: "Yes, land
the L1N9-SL2 correction: Lars Christensen, 1839, in sources-sync.mjs and the
10-13 artifact"). The first attempt was refused by this box's action
classifier ("Modify Shared Resources") and was not replayed until that word.
Exactly two lines change: the allowlist entry and the artifact's
`name`/`lifespan`/`allowlistBasis` for L1N9-SL2; the artifact's
citations are untouched. `node --test tools/genealogy/sources-sync.test.mjs`
→ 12 pass, 0 fail. The person is deceased by age (christened 1839), so the
correction names nobody new.

This matters for ruling 2: any merge reasoning that reads "L1N9-SL2 = the
census Christen" points at a son, not the father.

## 4. The five identity rulings: one choice each

Every one is a founder call. The recommended choice is first; the evidence is in
the dispatches cited.

**R1. QG8Q-V3C5 / V3CN / P964 titles.** The wire reads V3C5 + V3CN = mother and
father views of Ane Sophie's **1841 christening**, and P964 = her **1856
confirmation** (30 Mar 1856, age ~15). The titles call V3C5 "Maren's own birth"
and P964 "christening". *Recommended:* the wire wins. Retitle locally and keep
the attachments, because a christening is a valid source for its parents. Local only, no
FamilySearch edit. Side flag: a 1856 confirmation conflicts with LZDH-WB1's
"1841–1855" lifespan in `2026-10-07…:67`. Maren's real 1811 birth record is still
unfound.

**R2. Christen Olsen merge + birth year.** Candidates: MHRT-169 (1806–1875,
linker-canonical, carries every attach since 10-06), L1N9-S2L (census cluster
with its own duplicate wife and children), LW9Z-S11 (1780, fits nothing). Birth
evidence: marriage 17 Oct 1834 age 27 (≈1807), 1845 census ≈1806, 1850 census
age 46 (≈1804). *Recommended:* MHRT-169 survives and L1N9-S2L merges in
(plus its duplicate wife and children). Birth "about 1806", with LW9Z-S11
reviewed separately. Needs FamilySearch merges: founder hand.

**R3. Daniel Briggs.** LL4G-3FL (1937–, no death) and PNC5-R9G (1937–2025,
built from his own obituary + Find a Grave). Same parents, same year, middle
initial L = Lawton. Nothing recorded against. *Recommended:* the same man,
PNC5-R9G survives. One FamilySearch merge: founder hand.

**R4. PNCX-S8Q, the unnamed mother.** Martin Olaf Martinsen b. 26 Mar 1875
Norway. FamilySearch and US records have run dry. *Recommended:* authorize a
read-only Digitalarkivet search for Martin's 1875 baptism (it names his
mother); leave her UNKNOWN until it lands. No edit until a record is found.

**R5. Don Ray Remington.** FamilySearch living-flags him (410), so nothing
attaches; the search-evidence layer already holds 7 records. *Recommended:*
accept the search-evidence layer as his record set; fixing the provider flag
is optional and only the founder can do it in his private space. The 15 vs 19
Aug 1955 marriage date stays recorded, not resolved.

## 5. What is next

- On a signed-in session: run the four-state oracle, then the KWJ4-XBD
  `readOnly` recheck, then probe PAGE_RENDERABLE on the control ark. The frontier
  starts only if that page renders.
- On the founder's word: land the §3 correction; act on R1–R5.

## 6. Addendum, same day: signed-in wake (founder signed in, chat 2026-10-17)

Four-state oracle, re-run 2026-10-17T23:23:21Z (tab parked on `/en/`):

| state | verdict | receipt |
|---|---|---|
| AUTHENTICATED | **TRUE** | v8 wires answer 200 |
| API_READABLE | **TRUE** | v8 `person/KWJ4-XBD/details` = 200 / 120,644 B / "Albert Perry Rockwood" / sourceCount 108 / living false; `summary` = 200 / 1,186 B |
| PAGE_RENDERABLE | **TRUE** | control ark `33S7-9GY8-1XT` now renders the image viewer (Film # 004811600, image 852 of 1,895), after the three authed "Page Not Found" readings ending 10-16 |
| PROVIDER_WRITABLE (KWJ4-XBD) | **FALSE** | `readOnly: true` on both summary and details. Seventh confirmation; the Rockwood lock stands |

### Frontier method, probed read-only on one record

- **Rendered DOM works:** `1:1:Q29L-TFNZ` (a Massachusetts town birth
  record, colonial era) rendered in about 16 s and links exactly one image ark,
  `3:1:33S7-9RSP-NG1`.
- **The SPA's own data wire carries the mapping:** the record page calls
  `/ark:/61903/1:1:{id}?useSLS=true&useRolesOverride=false` (200). Its JSON
  holds `EXT_DATA_ORIG.IMAGE_ARK` = `3:1:33S7-9RSP-NG1` plus
  `FS_UNSUPPORTED.FS_IMAGE_APID` = `TH-1951-22583-15089-78`. This revises the
  09-28/09-29 receipt: `?useSLS=true` **alone** 404s, but with
  `&useRolesOverride=false` the wire is live. The apid in this payload is a
  lead only. The BINDING LAW still takes the apid from das/v2, never from here.
- **Raw HTML fetch is dead authed too:** `fetch('/ark:/61903/1:1:Q29L-TFNZ')`
  signed in = 200 / 20,057 B shell, zero 3:1 arks. The fast-path question from
  09-28 is now answered for HTML.
- **Direct replay of the data wire is header-gated:** a cookie-only `fetch` of
  the same wire gave 401 on 3 of 4 records and 200 on 1 (`6XV1-BMMZ` →
  `3:1:3QHK-SQH7-TSGP`). The SPA itself got 200 on a record that 401'd for the
  bare fetch (`6KWG-ZBHL`, a NUMIDENT entry with no image link). So the gap is
  a header the SPA adds, not record restriction. No seat copied a session
  token into a header to close it. That stays unproven and unattempted.

**What this means for the frontier:** the run is possible again. The proven
method costs one SPA navigation per record (≈16 s), with the mapping read
from the SPA's own data response rather than DOM links. At 7,037 arks that is
about 31 hours of navigation. That needs the writer lock
(`skaists.writer-lock/1`; the current claim from 10-16 is stale), the walker
guard, and a queue extension, as its own run. A public-layer recount by a
broader ark regex reads 7,114 distinct 1:1 arks against the 10-13 measured
7,037; not reconciled here.

Zero FamilySearch mutations; zero private-tier writes; no image fetched.

## 7. Frontier mapping run: started on the founder's word, stopped at 40 records

Founder order, chat 2026-10-17: "Start the full image frontier run under the
writer lock and walker guard, mapping only, no image downloads yet."

**Set-up (private tier, `images-harvest/frontier-map/`):**
- The queue is built by code from the public `records.json`: 7,114 distinct
  `1:1` arks, first-appearance order, source sha256 recorded in the queue
  header. The queue refuses to be rebuilt once a run starts.
- One writer process (`frontier-map-writer.mjs`) held `skaists.writer-lock/1`
  for the run. It took over the stale 10-16 claim through the guard's own
  takeover path, and admitted every result through `walker-guard.mjs`
  (`ae35da500`) queue membership. Outcomes are final, and each batch is one
  atomic write.
- The in-page runner (signed-in tab) never writes. It renders each record in a
  hidden same-origin frame (4 to 8 s each) and hands results back.
- **Outcome law for mapping:** a single unique rendered `3:1` link is
  `mapped`. The page's own "No Image Available" is `no-image-available`
  (site-stated, record-specific). No link seen, several links, or "Page Not
  Found" are retryable observations. Render timeouts are walker failures.

**Banked:** 40 of 7,114 records, from two admitted batches with 0 rejects:
18 mapped, 10 site-stated no-image, 11 retryable observations, 1 walker
failure. 7,075 pending.

**Stopped:** feeding the next 1,500 arks to the page was refused by this
box's action classifier ("Auto-Mode Bypass"). Under the refused-stays-refused
rule, no seat replays it or routes around it. The runner was paused, the
remaining results banked, and the lock released (`lock-released`, STOP file).
`.writer-lock.json` is absent, so the lock is free.

Zero FamilySearch mutations; zero image bytes fetched.
