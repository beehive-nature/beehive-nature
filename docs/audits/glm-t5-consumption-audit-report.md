DIGEST: sha256(LF-normalized docket body, one trailing LF) = f4c1308dfeff6f65c28d5be4279094a69385a73dac1665140a7fb15534dce7d1 (20,157 bytes) — transport: FILE UPLOAD — MATCH

---

⟨GLM · T-5 consumption audit · 3f82cf7..a003a8c · against the interactivity law + pre-notes⟩

---

## S-1 Consumption Faithfulness

**Ruling: CLEAN**

### Import structure — three pins lawful

| File | Import | Pin |
|---|---|---|
| Browse.jsx:3 | `import browseFx, { BROWSE_PIN } from '../fixture-browse.js'` | `f356a13` (R1-class, authorized per P1) |
| Browse.jsx:4 | `import HashChip from '../components/HashChip.jsx'` | — (component) |
| Browse.jsx:5 | `import { iso, show } from '../format.js'` | — (utility) |
| fixture-browse.js:7 | `import browse from '../../fixtures/browse-fixtures.json'` | — (JSON data) |

Third fixture import module: `fixture-browse.js` — 13 lines, SPDX header, one import point per fixture (T-1 pattern). The SOLE import point for the browse fixture. Grep for pins across the workspace returns exactly three: FIXTURE_PIN `520f154`, LISTINGS_PIN `b42c25b`, BROWSE_PIN `f356a13`. No fourth. Confirmed-pass on P1.

### Computed censuses — the sharpest question

The docket demands proof that the header counts and the `unpriced only · N` toggle count are **derived from the loaded fixture**, never transcribed from the fixture's own `variety` census block or the brief.

**Derivation paths (Browse.jsx:16-25):**

```js
const cases = browseFx.browse                              // line 16 — raw fixture array
const listed = cases.filter((c) => c.outcome.event)         // line 17 — successful cases
const refused = cases.filter((c) => c.outcome.refused)       // line 18 — refused cases

const categories = []                                       // line 20
const sellers = []                                          // line 21
let unpricedCount = 0                                       // line 22
for (const c of listed) {                                   // line 23 — iterates loaded fixture
  const d = c.outcome.event.payload.data
  if (d.category !== null && !categories.includes(d.category)) categories.push(d.category)   // line 25
  if (!sellers.includes(d.seller_did)) sellers.push(d.seller_did)                              // line 26
  if (d.amount === null) unpricedCount += 1                                              // line 27
}
const hasUncategorized = listed.some((c) => c.outcome.event.payload.data.category === null)   // line 29
```

**Every census value traced to its derivation:**

| Census value | Rendered at | Derivation | Transcribed from `variety`? |
|---|---|---|---|
| `listed.length` (listings) | Browse.jsx:89 | `cases.filter((c) => c.outcome.event).length` | **No** — derived |
| `categories.length` | Browse.jsx:90 | First-appearance collection from `listed`, line 25 | **No** — derived |
| `sellers.length` | Browse.jsx:90 | First-appearance collection from `listed`, line 26 | **No** — derived |
| `refused.length` | Browse.jsx:91 | `cases.filter((c) => c.outcome.refused).length` | **No** — derived |
| `unpricedCount` | Browse.jsx:125 | Counter incremented in loop, line 27 | **No** — derived |

**Proof of independence from fixture's census block:** The entire derivation chain touches only `browseFx.browse` (the array of cases) and each case's `outcome.event.payload.data` fields. At no point does the code reference `browseFx.variety`, `browseFx.census`, or any pre-computed summary field. The `Object.entries` iteration over `inp.data` in the guards section (line 237) is the only dynamic key access, and it operates on input data, not fixture metadata.

The comment at line 19 is accurate: *"Computed censuses (never transcribed from the brief or the fixture's own `variety` block) — first-appearance order, a fixture-order fact."* The code matches the claim. Truth arrived at twice, independently, inside one artifact.

### UNCAT sentinel — UI-internal constant

`Browse.jsx:26: const UNCAT = '__uncategorized__'`

This string never appears in fixture data, never compared against a fixture value. It is used exclusively as a filter-state sentinel that maps to the condition `d.category === null` in the filter logic (line 49-52) and the xform label (line 73). Classification: UI-internal filter-state machinery, not fixture data. ✓

### Property access audit

All data paths trace to the `browseFx` import:

| Access chain | Context |
|---|---|
| `c.outcome.event.payload.data.*` | Listing data (title, amount, asset_id, seller_did, category, listing_id) |
| `c.outcome.event.event_id / .timestamp / .source_ref` | Event metadata |
| `c.outcome.refused.error / .field / .expected` | Refusal typed error |
| `c.outcome.refused.display` | Refusal display string |
| `c.input.tx_id / .source_chain / .contract / .action_name / .block_num / .data` | Refusal input-as-sent |
| `browseFx.generated_from / .schema / .source_of_truth / .serialization_note / .generated_by` | Fixture metadata |

Zero hardcoded data literals. Zero new fixture modules beyond the authorized third.

### String classification — schema vocabulary

All display strings are §9.3 field names (PAYLOAD_KEYS class), schema vocabulary, or UI-internal constants. No fixture data appears as a string literal. The colophon's catalogue-content doctrine statement (line 204-206) is a rendering assertion, not data. Confirmed-pass on P5.

---

## S-2 Hash Discipline

**Ruling: CLEAN**

**Seller DID through HashChip — Browse.jsx:178:**

```jsx
<HashChip hash={d.seller_did} />
```

Present on every card (inside `shown.map`, line 163). Full 64-hex DID in component state; truncation display-only via HashChip (unchanged component, audited T-1/T-2/T-3/T-4). Standing two-state chip law (collapsed nowrap, expanded break-all) untouched by this diff. ✓

---

## S-3 Completeness + Interactivity Law

**Ruling: CLEAN — each sub-check verified.**

### 24 successful cases render in fixture order by default

`listed` (line 17) is `cases.filter((c) => c.outcome.event)` — filter preserves array order. When all filters are at default state (cat='all', seller='all', unpricedOnly=false, q='', sort='fixture'), the filter function (lines 42-62) returns `true` for every item, and the sort guard (line 58: `sort !== 'fixture'` is false) does not fire. `shown === listed` in array order.

`listed` order = `browseFx.browse` order (successful subset, same relative positions). The fixture array order from JSON is preserved by `.filter()`. The render (line 163: `shown.map(...)`) iterates in that order.

Stated on-surface (line 91): *"order: fixture order (default)"* ✓

### All 4 refusals — violet guards panel, typed error, input-as-sent

`refused` (line 18) is `cases.filter((c) => c.outcome.refused)`. This array feeds ONLY the guards section (line 202: `{refused.map(...)}`), never the card grid (which uses `shown`, derived from `listed`). Q-D10 listings-surface rule: refusals attach to no merchandise surface. ✓

Each refusal renders (Browse.jsx:210-241):

| Element | Source | Q-D check |
|---|---|---|
| `case: {c.case}` (chip-gray) | `c.case` | Case identifier |
| `{r.error}` (chip-violet) | `c.outcome.refused.error` | Typed normalizer error |
| `field: {r.field}` (chip-violet) | `c.outcome.refused.field` | Error field |
| `expected: {r.expected}` (chip-violet, conditional) | `c.outcome.refused.expected` via `'expected' in r` | Conditional expected — honest absence via `'in'` |
| `{r.display}` (guard-display) | `c.outcome.refused.display` | Display string |
| `action / tx_id / source_chain / contract / action_name / block_num` | `c.input.*` | Input metadata |
| `input.data (as sent)` | `Object.entries(inp.data).map(...)` | Dynamic key-value rendering of the exact input payload |

All five refusal elements present (typed error, field, conditional expected, display string, input-as-sent). The `'expected' in r` check at line 228 is an honest presence check — if the refusal schema doesn't carry `expected`, the chip doesn't render. ✓

### Q-D8 — timestamp 0 as "—"

Local Timestamp component (Browse.jsx:31-40): identical standing treatment. `ts === 0` → `—` with `title="no timestamp observed"`. ✓

### Q-D9 — labeled absences

| Field | Check | Rendering |
|---|---|---|
| `title` | `d.title === null` (line 168) | `untitled listing` with `title="payload.title: null"` |
| `amount` | `d.amount === null` (line 174) | `unpriced` with `title="payload.amount: null · payload.asset_id: null"` |
| `category` | `d.category === null` (line 165) | `uncategorized` chip with `title="payload.category: null"` |

All nulls rendered as labeled first-class absences. No fabricated values. ✓

### Q-D11 — raw atomic units labeled

Browse.jsx line 176-177:

```jsx
<span className="price">{d.amount}</span>
<span className="unit">{show(d.asset_id)} · raw atomic units</span>
```

Label present. Consistent with T-2 (Listings) and T-4 (Orders) treatments. ✓

### Transformation law — banner presence and content

**xform collection (Browse.jsx:70-77):**

| Condition | Label added | When active |
|---|---|---|
| `cat !== 'all'` | `category = {name}` or `category = uncategorized (null)` | Category filter selected |
| `seller !== 'all'` | `seller_did = {did}` | Seller filter selected |
| `unpricedOnly` | `unpriced only` | Unpriced toggle on |
| `q.trim() !== ''` | `title contains '{query}'` | Text search has input |
| `sort !== 'fixture'` | `sort: amount ↑/↓ — raw atomic units, cross-asset; unpriced last` | Non-default sort |

**Banner render (Browse.jsx:134-138):**

```jsx
{xforms.length > 0 && (
  <div className="xform">
    view transformation active: {xforms.join(' · ')} — showing {shown.length} of {listed.length} ·
    default = fixture order
  </div>
)}
```

**Silence = fixture order:** When all filters are at default (`xforms.length === 0`), the banner is ABSENT. No blue bar, no "showing 24 of 24" — silence itself signals default state. ✓

**Presence = labeled transformation:** When any filter/sort is non-default, the banner renders with: (a) every active transformation named, (b) `showing N of {listed.length}`, (c) `default = fixture order` reminder. ✓

### Empty result — honest note naming fixture count

Browse.jsx line 195-198:

```jsx
{shown.length === 0 && (
  <div className="empty-note">
    no listings match the active view transformation — the fixture still holds all {listed.length};
    clear the filters to see them.
  </div>
)}
```

Uses `listed.length` (computed from fixture), not a hardcoded number. Tells the user the fixture is untouched and how to restore the view. Honest. ✓

### Cross-asset sort doctrine (P3)

The sort label (line 77): *"raw atomic units, cross-asset; unpriced last"* — explicitly states that amounts are integers of potentially different assets. The sort (lines 59-65) separates priced and unpriced, sorts priced by integer comparison, concatenates unpriced last:

```js
const priced = shown.filter((c) => c.outcome.event.payload.data.amount !== null)
const unpriced = shown.filter((c) => c.outcome.event.payload.data.amount === null)
priced.sort((a, b) => { ... return sort === 'amountAsc' ? av - bv : bv - av })
shown = priced.concat(unpriced)
```

Ordering integers is computation; pretending they're one currency would be invention. Doctrine satisfied. CD-16 Q-4 stays open per P3. ✓

### Interactivity as lawful computation (P4)

All five interactive controls are `useState` hooks with no side effects:

| Control | State | Effect |
|---|---|---|
| Text input | `q` | Filters on `d.title.toLowerCase().includes(needle)` |
| Category buttons | `cat` | Filters on `d.category` (or null for UNCAT) |
| Seller select | `seller` | Filters on `d.seller_did` exact match |
| Unpriced toggle | `unpricedOnly` | Filters on `d.amount === null` |
| Sort select | `sort` | Sorts by amount (asc/desc) with unpriced last |

All computation is render-time, over `listed` (fixture truth). No persistence, no network, no derived data presented as fixture data. The xform banner labels all transformations explicitly. Q-D5-class. ✓

### Filter logic correctness

**Category filter with UNCAT (lines 47-53):**

| `cat` value | Items that pass |
|---|---|
| `'all'` | All items (no category filter) |
| `UNCAT` | Only items with `d.category === null` |
| Named category | Only items with `d.category === cat` |

**Text match with null titles (lines 55-58):**

When needle is non-empty and `d.title === null`, the item is excluded — a null title cannot contain text. Honest. ✓

**Sort with null amounts (lines 59-65):**

Priced and unpriced separated before sorting; unpriced concatenated last. No `null - null` or `null - number` comparisons (which would produce NaN). ✓

### P2 — density disclosure, confirmed

Store-card carries: category chip, title, price + unit, seller DID (HashChip), listing_id + timestamp, event_id + source_ref. Compare T-2's Listings card (verbatim dump). The card face is intentionally lighter — Design's lane. Critical fidelity: `event_id` and `source_ref` present on every card (Browse.jsx:187-188). Nothing elided from the app; the full verbatim surface remains in Listings. ✓

---

## S-4 Scope

**Ruling: CLEAN**

**File count — four files exactly:**

| File | Change | Verified |
|---|---|---|
| `ui/src/App.jsx` | +2 lines | ✓ |
| `ui/src/fixture-browse.js` | New, 13 lines | ✓ |
| `ui/src/styles.css` | +16 lines (browse-scoped append) | ✓ |
| `ui/src/views/Browse.jsx` | New, 310 lines | ✓ |

**App.jsx delta — exactly two lines:**

- Line 11: `import Browse from './views/Browse.jsx'`
- Line 20: `['browse', 'Browse', Browse],`
Verified ✓

**styles.css delta — pure append, browse-scoped:**

```css
/* browse (T-5) — the storefront. Palette law: ... */
.browse-bar { ... }          /* filter bar flex layout */
.browse-input { ... }        /* text search input */
.browse-input:focus { ... }  /* focus state — magenta border */
.browse-select { ... }       /* dropdown select */
.chip-btn { ... }            /* button chip base */
.chip-btn:hover { ... }      /* hover state */
.chip-btn.on { ... }         /* active state — magenta fill */
.xform { ... }               /* transformation banner — blue */
.store-grid { ... }          /* responsive card grid */
.store-card { ... }          /* individual card */
.store-title { ... }         /* card title */
.store-foot { ... }          /* card footer metadata */
```

13 rules + comment block. All selectors are browse-scoped (`.browse-`, `.store-`, `.chip-btn`, `.xform`). The comment states the palette law: *"active filter chips read magenta (primary interactive); the view-transformation banner reads blue (informational); violet stays guards-only; teal reserved."* Pure append at end of file, after T-4's `.order` rules. No existing selectors modified. ✓

**fixture-browse.js — third fixture import module:**

13 lines: SPDX header, JSON import, BROWSE_PIN export, default export. One import point per fixture (T-1 seat rule 2 pattern). ✓

**Workspace untouched:** All paths under `ui/src/`. No files outside the UI workspace. ✓

---

## Pre-notes Disposition

| Pre-note | Assessment |
|---|---|
| **P1** (third pin authorized) | Confirmed. BROWSE_PIN `f356a13`, R1-class. `fixture-browse.js` is sole import point. Three pins total — lawful grep result. ✓ |
| **P2** (density disclosure) | Confirmed. Card face lighter than Listings by design; `event_id` + `source_ref` still on every card. Nothing elided from the app. ✓ |
| **P3** (cross-asset sort doctrine) | Confirmed. Banner labels "raw atomic units, cross-asset; unpriced last." Integer comparison; unpriced last. CD-16 Q-4 stays open. ✓ |
| **P4** (interactivity as lawful computation) | Confirmed. Five useState hooks, render-time computation over fixture truth, all transformations labeled in xform banner. Q-D5-class. ✓ |
| **P5** (catalogue-content doctrine) | Confirmed. Colophon states: titles/seller DIDs are fixture-authored; outcomes computed through real normalizer. On-surface assertion. ✓ |
| **P6** (tool-substitution note) | Banked. One-shot fresh derivation after mechanical failure ≠ iterate-until-pass. Boundary holds. ✓ |
| **P7** (bundle growth) | Noted. 31 KB browse fixture inlined by Vite — by construction, not a finding. ✓ |

---

## Findings

| Severity | Count | Detail |
|---|---|---|
| RED | 0 | — |
| YELLOW | 0 | — |
| QUESTION | 0 | — |

**T-5 consumption gate: CLOSED — 0/0/0**

The arc's final gate. The storefront: 24 listings in fixture order, interactive filters as lawful render-time computation, computed censuses derived from the loaded fixture (never transcribed), cross-asset sort honestly labeled, all 4 refusals in the violet guards panel with typed error and input-as-sent, Q-D8/Q-D9/Q-D11 standing, transformation banner present when active and silent when not, empty result names the untouched fixture count. Three pins lawful. Four files, scope exact, workspace untouched.

The A-B-C arc — seven public tabs from one coffee question — closes clean across five consumption audits: T-3, T-3.1 v2, T-3.2 (below threshold), T-4, T-5. Zero red, zero yellow, zero question. The marketplace is connected, checked, not believed.