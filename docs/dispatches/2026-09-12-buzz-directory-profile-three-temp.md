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
