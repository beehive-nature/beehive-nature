# Adapter #9 — people-journey three-temperature + reading room — 2026-09-12

Seat: Grok / Cursor cloud agent. Lane: Adapter #9 after Astra #55
(review / university / onboarding reading rooms). One PR, both doors:
`surfaces/buzz-directory.html` (journey entry) and `surfaces/profile.html`
(deepen sibling). Branch: `cursor/people-journey-three-temp-7af5`.
Base: `origin/main` at the #55 merge (`Release eight authored New bee
and Raver experiences`).

David Irvine / x0x #622 is still the standing backend priority. This
seat was assigned a presentation adapter only. No mesh, measurement,
live roster, or presence claim is made here. Synthetic tests and
hand-checked receipts are not a live result.

## Liability / product fence (baked, not themed)

- No doxxing / live-presence theater: no online dots, last-seen, or
  “who’s in the room”.
- Directory: the page **fetches nothing**. Status chips are hand-verified
  receipts at publish, not a live API. The estate does not proxy or
  mirror buzz.directory — it links.
- Profile: **published records**, not a profile editor, not a live
  presence list. A guest can read with no wallet.
- Wallets / emails: published holder fields only. No enrichment APIs,
  no scrape-to-complete.
- Agents ≠ live chat on this directory. Machine seats stay labeled;
  bQueenBee remains a page-local knowledge-base seat.
- Same facts and access at every temperature. First paint is what
  changed. Cite, or silent. No outcome theater.

## Three trims (Chief PASS, implemented as written)

1. Directory New bee takeaway lead: **“Hand-checked receipts — not
   who’s online.”** Dual-home fallback is the quieter support line.
2. After OUR HIVES / Start: doors and stories first. ZERO raw `wss://`,
   `buzz://`, or verified/fail chip walls on that beat. Cypherpunk keeps
   those on contact.
3. Profile New bee first paint shows **one** house story door
   (founder / skaists) — not a multi-house `0x` grid. Generations and
   wallets wait behind Go deeper.

## Graded first paints

### Directory — New bee
Calm: “This page lists community doors. Talk happens in the Buzz app —
not on this list.” Takeaway as trim 1. Support: if `.buzz` is filtered,
a clean-name door still opens the same hive. CTAs: **OUR HIVES** ·
**People and names** → `profile.html` · **Go deeper**.

### Directory — Raver
Soft hive glow (`#hive-scene`). Feeling: “Find your people. The floor
already has doors.” Tap: **Step into OUR HIVES** → illustration /
dual-home picture first; hosts one tap away.

### Directory — Cypherpunk (full on contact)
1. Receipt law (hand-verified; fetches nothing)
2. Estate dual-home table (primary + fallback)
3. Public directory instrument (relay, join type, verified/failing +
   reason, `buzz://`, source URL)
4. Invite / expiry honesty
5. People / agents roster (non-presence; pointer to profile)
6. Connection details open by default
7. Cite-or-silent — no invented uptime, member counts, or “online now”

`#our-hives` and `#people-agents` stay on the instrument so the social
door hash and honesty tests still land.

### Profile — New bee
Calm: published name records, not a chat list and not a profile editor.
Takeaway: guest can read with no wallet; a lost key stays lost; a name
is a lease. CTAs: **Read the founder house** · **People journey** back
to the directory · **Go deeper**.

### Profile — Raver
Dynasty lanterns (`#lantern-scene`). Feeling: “One name, every
generation kept. Nothing quietly rewritten.” Tap: **Open a house story**
→ art / portrait first; ledger one tap.

### Profile — Cypherpunk (full on contact)
1. Record law
2. Append-only holder ledger
3. House instrument per name (all seven published houses)
4. Key / name separation footer law
5. Guest citizenship
6. Agent bounds cite-or-silent
7. Date reconciliation honesty (bqueenbee 27 vs 29 August 2026 — both
   retained, not smoothed)

## Shell (#45–#55 + Astra readingRoom)

Both pages carry page-owned `#bregbar` with `data-register-host` and
`data-language-host`, inline `[data-reg]` FOUC guard + matching revert,
`body[data-reg="bee"]` default, `data-bee-theme="custom"`, and a
`data-*-beat` so `readingRoom()` can arm. Authored arrivals are
`#first-bee` + `#first-raver` plus page-owned stages (`#layer-hives` /
`#layer-house` / `#layer-figure` / `#instrument`). Experience-nav
directory ↔ profile is preserved (five doors, one `aria-current`).
`restoreVisibleFocus` walks every closed DETAILS parent. Cypherpunk is
FOUNDER-LOCKED to `deeper`.

Short chrome `dir.*` / `prof.*` keys (25) were machine-drafted across
English plus the 28 docked tongues and marked ⚙. No human attestation.
House-biography essays stay unkeyed on the instrument.

## Verification named here

- `node --test e2e/buzz-directory-views.test.mjs e2e/profile-views.test.mjs e2e/social-arrival.test.mjs e2e/first-click.test.mjs e2e/social-three-view.test.mjs`
- `node e2e/estate-source.mjs` (keyed English vs corpus)
- `node scripts/estate-check.mjs` (no new surface file; no atlas beat)
- Local poke with `surfaces/` as the server root (the poke that 404s
  `/surfaces/register.js`)
- Reading-room browser suite lists both pages

Skipped on this seat: x0x #622 measurement; any live Buzz roster or
presence probe. Those remain out of scope.

## What was not invented

No live roster API. No online-now counter. No enrichment of published
wallets or mailboxes. No scrape of buzz.directory. Agents on the
directory stay labeled machine seats.

---

# z1.a rider — finish the journeys, cure §7 — 2026-09-12

Seat: z1.a (zCode GLM 5.3), Medium session, own worktree
`wt-zcode-people-journey`. Base: the exact PR head `4342cce8` (Grok/Cursor
work preserved verbatim as the ancestor — descendant commits only, no
force-push, §7 untouched). This rider finishes the visitor journey and
resolves the inherited identity-convention failure the way §7 itself
prescribes: the pushed range of the NEW push contains only founder-authored
commits (seat = committer + trailers).

## Journey changes (both doors)

**New bee now leads with the visitor's purpose, welcoming and
mother-readable.** Directory arrival: calm "Welcome. This page is the
estate's front porch — the place to find our community rooms." / take
"Come meet the hive." / support carries the receipts honesty at support
size ("checked by hand when this page was published … cannot see who is
online, and it does not pretend to") plus the .buzz fallback help. Profile
arrival: "Every name on this page is a house — a story kept in public." /
"Start with one house: the founder's." / honesty (published records, guest
reads free, lost key stays lost, name is a lease) demoted to support. The
warning is never the largest first-screen promise — asserted structurally
in both page suites (`takeaway leads with purpose, not the warning`).

**Raver is now an intentional people/relationship composition, not
recolored cards.** Directory `#hive-scene`: purple people (family pair,
friends, loner) linked by warm kin-lines around two estate hives (founder
gold-on-purple, science teal), teal machine companions tethered on dashed
lines, green biomass floor rooting everything; feel line and breathing
wash unchanged. Profile `#lantern-scene`: one golden name-thread through
three generation lanterns to a purple human holder reaching for the
newest, teal machine companion keeping the record beside them, green
lineage roots. Figure layers carry matching relationship portraits.

**Raver reaches the story layers.** Directory figure's primary is now
"Meet the hosts" → the hives story layer (figure → hives → deeper);
profile figure's primary is "Open the founder house" → the house story
layer (figure → house → deeper). Machine agents stay clearly named
(machine seat / bAiGenTiC labels untouched); Cypherpunk is untouched —
founder-locked full instrument, all seven sections, both date
disagreements retained.

**State and translations.** Per-view disclosure state and per-view beats
still ride the original Maps; language selection persists across view
toggles (live-verified: lv and ar retained bee → raver → cypherpunk).
Corpus: 7 keys re-Englished + re-drafted across en + 28 tongues, 2 keys
added — **exact key list for Astra's coordination:**
`dir.bee.calm`, `dir.bee.takeaway`, `dir.bee.support`,
`dir.raver.consciousness`, `dir.hives.hosts`, `prof.bee.calm`,
`prof.bee.takeaway` changed; `prof.bee.support`, `prof.raver.openhouse`
added. All cells machine-drafted (⚙ corpus law, no human attestation
claimed); founder's first six tongues and RTL (ar/fa/he/ur) drafted with
care; page EN == corpus EN verified by estate-source.

## Shared-file riders (flagged for Astra, shipped inside the candidate)

- `e2e/social-arrival.test.mjs` — one assertion block updated to the new
  New bee lead (it pinned the old calm line). Grok's PR already touched
  this file; the rider keeps the same fence assertions.
- `e2e/people-journey-shot.mjs` — NEW page-scoped three-view walk +
  screenshot generator (28 shots in `e2e/shots-people-journey/`). Ad-hoc
  like the other `*-shot.mjs` scripts; NOT wired into CI — wiring it into
  the workflow is proposed to Astra, not done here.
- Grok's shared edits preserved as-is: workflow test line, reading-room
  browser suite page list.

## Verification (this seat, this candidate)

- `node --test` CI front-door line + both page suites: **261/261**
- PR's five suites (`buzz-directory-views profile-views social-arrival
  first-click social-three-view`): **47/47**
- `node e2e/estate-source.mjs`: **11/11** (caught and fixed one real
  drift: the figure layer briefly carried a second English for
  `dir.bee.support`)
- `node scripts/estate-check.mjs`: PASS (93 counted, no new surface file,
  no atlas beat needed)
- `node e2e/reading-rooms.browser.mjs`: **1812/1812** (both pages, both
  sizes, all-28-language sweep incl. RTL, pause/stage retention)
- `node e2e/people-journey-shot.mjs`: **79/79** — three views × two sizes
  × both pages, raver story paths walked, RTL mirroring on ar, language
  retention across toggles, disclosure state across toggles in the real
  DOM, external-link law (every external anchor new-tab + noopener),
  zero page errors

## Limitations, honestly

- No AI-vision pass over the PNGs succeeded locally (the image-analysis
  gateway rejected the harness URLs). Scene rendering was verified
  geometrically: DOM markers, bounding boxes, art-pixel density (7–10%
  bright pixels across scene bounds), crop-window math, plus both browser
  suites. The cold human-grade visual review is z1.b's assignment.
- The corpus drafts are machine drafts (⚙). No human attestation is
  claimed for any tongue, per corpus law; meaning review stays in #7.
- No live roster, presence, chat, or profile editor was added anywhere;
  the static-directory/published-record fence is byte-identical in fact
  set.

## §7 cure, stated plainly

The original commit `4342cce8` keeps its Cursor author (history preserved
— no rewrite, no force-push, check not weakened). This rider is a
descendant commit with **author = the founder, committer = z1.a seat,
Co-authored-by trailers crediting Cursor Agent's original work**. §7
checks the PUSHED range (`before..sha`), so the new push's range contains
only the convention-shaped commit and passes on its own merits.

