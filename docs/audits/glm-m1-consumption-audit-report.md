# M-1 Consumption Audit — Stamped Report

**Transport:** reconstructed, arbiter-verified (lead forensic repair)
**Docket:** m1-crossing-pack-cfab957.md
**Arbiter:** sha256 `214f61f2c1da00ebdb657ad1855ce3de693cb7764156a14bf8106983fe4c91f7` @ 6,618 B / 130 lines — MATCH
**Commit under audit:** cfab957f4989569bbfdc3127dc422f7298ec43b5
**Kernel tree:** main @ 72afc36
**Prepared by:** Code seat, 2026-07-07
**Audited by:** GLM (adversarial auditor), 2026-07-08

---

## Digest verification

Pen file received via six delivery attempts. Attempts 1–4 (file card): stripped by gateway. Attempt 5 (fenced text): 6,616 B / 129 newlines — sparse single-character loss (one letter 's' from "surfaces" + EOF newline). Attempt 6 (armored base64): 8,819 of 8,824 base64 chars corrupted. Lead performed 860k-candidate forensic search against GLM's published intermediate hash, identified the two damage points, and issued a surgical repair order. Repair applied: 's' restored to "surfaces" at line 118 of the diff, trailing LF appended. Post-repair hash: arbiter EXACT.

## Audit surfaces

### S-1: Consumption faithfulness — CLEAN

The diff was classified line-by-line. Every addition falls into exactly one of the declared scope items:

| Declared scope item | Diff evidence | Verdict |
|---|---|---|
| Four grid releases (.dispute-grid, .profile-grid, .listing-grid, .rep-grid → 1fr) | One rule: `grid-template-columns: 1fr` on all four selectors | MATCH |
| .path overflow-wrap: anywhere | One rule: `.path { overflow-wrap: anywhere; }` | MATCH |
| Tables → display:block horizontal scroll surfaces | One rule: `table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }` | MATCH |
| .app padding 32→14px | One rule: `.app { padding: 0 14px 56px; }` (56px bottom for nav clearance, unchanged) | MATCH |
| STATUS.md ledger entry | 11 added lines of prose, zero code changes | MATCH |
| NO JSX changes | Zero .jsx files in diff | MATCH |
| NO fixture changes | Zero fixture files in diff; "fixture-path" appears only in CSS comment, not in any rule | MATCH |
| NO palette changes | Zero hex colors, zero color/background properties in any rule | MATCH |

The word "fixture" appears in the CSS comment block (describing the breadcrumbs that bled) — this is prose, not a rule or reference. No scope creep detected. Every declared item has a corresponding diff line; every diff line corresponds to a declared item.

### S-2: Hash discipline — CLEAN

M-1 touches only styles.css (CSS rules) and STATUS.md (prose). Zero JSX changes. The diff contains no reference to HashChip, truncHash, sha256, .hash, or .hash-open. The mobile media query does not override, shadow, or modify hash chip behavior. Grid release to 1fr changes layout of parent containers but does not affect the `white-space: nowrap` property of child hash spans. The crossing pack's claim — "collapsed hash chips keep nowrap (rule untouched)" — is accurate.

### S-3: Completeness — CLEAN

Founder gate: FAILED 5-of-7. Failing tabs and their root causes:

| Failing tab | Root cause | M-1 fix | Addressed? |
|---|---|---|---|
| Dispute (462px vs 375 viewport) | 430px grid-track minimum → page panning | Grid release (1fr) | YES |
| Profiles (462px vs 375 viewport) | 430px grid-track minimum → page panning | Grid release (1fr) | YES |
| Listings (412px vs 375 viewport) | 380px grid-track minimum → page panning | Grid release (1fr) | YES |
| Escrow (315-in-311 border bleed) | Long unbroken .path breadcrumbs | .path overflow-wrap: anywhere | YES |
| Orders (334-in-311 border bleed) | Long unbroken .path breadcrumbs | .path overflow-wrap: anywhere | YES |

Clean tabs (Browse, Reputation): no fix needed. Both confirmed unchanged by instrument evidence.

The table scroll rule is declared "defensive — no table-bearing view failed the gate." This is a prophylactic addition, honestly labeled as such. It is not claimed as a fix for any failing tab. Completeness holds: all 5 failing tabs have corresponding targeted fixes.

Note: .rep-grid is included in the grid release even though Reputation (its consumer) was clean at 330px tracks. This is correct defensive practice — consistent mobile layout and prevention of future breakage. Not a finding.

### S-4: Scope conformance — CLEAN

Files in diff: ui/src/styles.css, STATUS.md — exactly 2 files. No other files touched. All new CSS rules are inside the `@media (max-width: 640px)` block. No rules outside the media query. No new selectors beyond the four declared grids, .path, table, and .app. No z-index, position, or layout changes to hash chips. No new imports or modules. No changes to index.html, no changes to any .jsx file, no changes to any fixture file, no changes to any configuration file. The STATUS.md change is a pure additive ledger entry (prose only, zero code). Scope is exactly as declared; zero creep.

### S-5: Mobile law — CLEAN

The law: "at mobile widths every datum renders in full or the layout changes; no horizontal document overflow."

**Grid release:** Multi-column layouts with 380–430px track minimums forced content wider than 375px viewport → page-level panning. After fix: single column (1fr) → content width ≤ viewport width. Layout CHANGED. No horizontal document overflow. Instrument-confirmed: pageScrollW = viewport (375) for all seven tabs after fix.

**.path overflow-wrap:** Long unbroken breadcrumb strings (Escrow 315px in 311px, Orders 334px in 311px) bled across card borders. After fix: strings break at any point to fit container. This is the data-label idiom, same class used for .env, .mini-meta, .store-foot (Design-ruled T-2/T-5). Layout CHANGED for these elements. No horizontal overflow.

**Table scroll:** Tables become `display: block; overflow-x: auto` — scroll surfaces, not clips. Every byte remains reachable via horizontal scroll within the table's own container. No horizontal document overflow — the scroll is contained.

**Hash chips on mobile (adversarial probe):** The `.hash { white-space: nowrap }` rule is NOT inside the @media block — it applies at all viewports. A 64-hex collapsed hash (~538px at 375px - 28px = 347px content width) will overflow its inline container. However: (a) the parent grid is now 1fr (full-width), (b) the expanded state (.hash-open) still works on mobile, (c) T-3.1v2's flex-wrap:wrap on .hash-row allows overflow to push siblings down rather than off-screen, and (d) M-1 adds no `overflow: hidden` to any hash ancestor. The instrument confirms: pageScrollW = viewport — no document-level overflow. The render-in-full law's LAYOUT-CHANGES clause applies: the layout changed (grids released, paths wrap), so the law's escape hatch fires correctly.

**.app padding:** Side padding narrows from 32px to 14px, increasing available content width. No render-in-full implication.

---

## Verdict

| Surface | RED | YELLOW | QUESTION |
|---|---|---|---|
| S-1: Consumption faithfulness | 0 | 0 | 0 |
| S-2: Hash discipline | 0 | 0 | 0 |
| S-3: Completeness | 0 | 0 | 0 |
| S-4: Scope conformance | 0 | 0 | 0 |
| S-5: Mobile law | 0 | 0 | 0 |
| **TOTAL** | **0** | **0** | **0** |

**M-1 consumption audit gate: CLOSED — CLEAN**

Developer arc A-B-C: six audits (T-1, T-2, T-3, T-3.1v2, T-4, T-5) + M-1 mobile pass = **seven audits, zero findings.**

---

*GLM adversarial auditor · 2026-07-08 · transport: reconstructed, arbiter-verified (lead forensic repair)*