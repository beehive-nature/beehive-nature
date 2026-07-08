DIGEST: sha256(LF-normalized docket body, one trailing LF) = e9d998005c3bcea47e41bf32ac60528ecca783665c1e0e7545c63551b78bc125 (19,451 bytes) — transport: FILE UPLOAD — MATCH

---

⟨GLM · T-4 consumption audit · 6fe0ff2..3f82cf7 · against composition law + pre-notes⟩

---

## S-1 Consumption Faithfulness

**Ruling: CLEAN**

**Imports — Orders.jsx:3-6:**

| Import | Source | Classification |
|---|---|---|
| `fixtures, { FIXTURE_PIN }` | `../fixture.js` | Pin 1 (R1-class, existing baseline) |
| `HashChip` | `../components/HashChip.jsx` | UI component, not fixture |
| `{ iso, pct, show, sum }` | `../format.js` | Utility, not fixture |

Zero new fixture import modules. LISTINGS_PIN is correctly absent — this view does not consume listings data.

**Subject scan — Orders.jsx:24-26 (DERIVED, not hardcoded):**

```js
const scenarios = Object.entries(fixtures).filter(
  ([, v]) => v && typeof v === 'object' && Array.isArray(v.steps)
)
```

This scans ALL entries of the fixtures object and filters for those carrying a `steps` array. No literal scenario keys (`'scenario_1_happy_path'`, etc.) appear in the scan logic. The composition is data-driven: whatever fixture entries have steps get included. Confirmed-pass on P2 (one-subject is fixture truth, not code assumption).

**Property access audit — every data path traces to the `fixtures` import:**

| Access chain | Origin |
|---|---|
| `step.event.payload.data.*` (order_id, buyer_did, seller_did, amount, asset_id, escrow_wallet_id, carrier, tracking) | `fixtures` → `scenarios` → `sc.steps[]` |
| `step.outcome.*` (refused, transition, escrow_state, ignored_by_engine) | same |
| `step.event.event_id, source_chain, source_ref, canonicalized_by, event_type.type, timestamp` | same |
| `sc.settlement.payouts[].to / .amount, signed_by` | `fixtures` → `scenarios` → `sc.settlement` |
| `sc.verdict.verdict / .confidence / .auto_enforce / .split_ratio` | `fixtures` → `scenarios` → `sc.verdict` |
| `sc.evidence[].provenance / .favors / .confidence / .signed / .verified / .payload_hash` | `fixtures` → `scenarios` → `sc.evidence` |
| `refusal.asset_provided / .asset_required / .zano_provided / .zano_required` | derived from `step.outcome.refused.InsufficientFunding` |

Zero hardcoded data literals. Zero new fixture modules. Workspace pin count remains two (FIXTURE_PIN + LISTINGS_PIN across all files).

**String classification — schema vocabulary, not fixture data:**

| String | Location | Classification |
|---|---|---|
| `Completed` | Orders.jsx:41 (TONE key) | Escrow-core state-enum name — schema vocabulary |
| `InsufficientFunding` | Orders.jsx:69, 157 | Guard variant name — schema vocabulary |
| `payload_hash` | Orders.jsx:276 | §9.3 field name — PAYLOAD_KEYS class |
| `event_id`, `source_chain`, `source_ref`, `canonicalized_by`, `payload.amount`, `payload.fee_buffer_zano` | Orders.jsx:156-160 | §9.3 field names — PAYLOAD_KEYS class |
| `order_id`, `buyer_did`, `seller_did`, `amount`, `asset_id`, `escrow_wallet_id`, `carrier`, `tracking` | Orders.jsx:108-132 | §9.3 field names — PAYLOAD_KEYS class |

All display labels are schema vocabulary. Confirmed-pass on P6 (zero new data — an access pattern).

---

## S-2 Hash Discipline

**Ruling: CLEAN**

**DIDs through HashChip:**

| DID | Location | Routing |
|---|---|---|
| `head.buyer_did` | Orders.jsx:108 | `<HashChip hash={head.buyer_did} />` ✓ |
| `head.seller_did` | Orders.jsx:113 | `<HashChip hash={head.seller_did} />` ✓ |

Full 64-hex values in component state; truncation display-only via HashChip (unchanged component, audited T-1/T-2/T-3).

**Evidence hash — T-3.1 v2 hash-row law:**

The dispute evidence table (Orders.jsx:263-280) implements the settled hash-row pattern:

```jsx
<React.Fragment key={i}>
  <tr className="comp-main">    {/* 4 value columns */}
    <td>{ev.provenance}</td>
    <td>...favors...</td>
    <td>...confidence...</td>
    <td>...badges...</td>
  </tr>
  <tr className="comp-hash">
    <td colSpan={4}>
      <div className="hash-row">
        <span className="k">payload_hash</span>    {/* verbatim §9.3 name */}
        <HashChip hash={ev.payload_hash} />        {/* full value in state */}
      </div>
    </td>
  </tr>
</React.Fragment>
```

Identical structure to Dispute.jsx post-T-3.1 v2. `colSpan={4}` correct for 4-column table (provenance, favors, conf., badges — hash header removed). Label `payload_hash` is verbatim §9.3 name moved from `<th>` to inline `<span className="k">`. The name moved; it did not vanish.

**TONE object (Orders.jsx:41):**

```js
const TONE = { Completed: 'green' }
```

Maps escrow-core state-enum names to CSS tones. Not a hash; not fixture data. The `??` fallback (line 154: `TONE[out.transition] ?? 'blue'`) defaults all non-Completed transitions to blue. Refusals short-circuit to violet. No-transitions default to gray. Tone law consistent with T-1.

---

## S-3 Completeness

**Ruling: CLEAN — each sub-check verified.**

### Seven steps render

The composition loop (Orders.jsx:28-36) collects all steps from all scenarios carrying `steps` arrays. Per P4 (seven-count correction), `scenario_1_happy_path` has `len(steps) = 7` with 2 refusals. The render loop (Orders.jsx:146: `o.steps.map(...)`) produces one `<li>` per step — no filtering, no skip logic. Every step renders with full event details. The seven-count is fixture truth; the code renders whatever steps exist. Confirmed-pass on P4.

### Both refusals — in-timeline, violet, four balance fields

**Detection (Orders.jsx:153):**
```js
const refusal = out.refused ? out.refused.InsufficientFunding : null
```

**Tone (Orders.jsx:154):**
```js
const tone = refusal ? 'violet' : out.transition ? (TONE[out.transition] ?? 'blue') : 'gray'
```

Refusal short-circuits to violet. The timeline item (Orders.jsx:168) receives class `tone-violet`. The refusal chip (Orders.jsx:156) renders `refused · InsufficientFunding` in `chip-violet`.

**RefusalBlock (Orders.jsx:61-87) — T-1 pattern, four balance fields:**

| Row | Fields |
|---|---|
| asset | `refusal.asset_provided` / `refusal.asset_required` |
| zano | `refusal.zano_provided` / `refusal.zano_required` |

Each row: label, provided value, required value, met/short chip. The `escrow_state remains {escrowState} — the dual-balance funding check held` note is present (Orders.jsx:85). Identical to T-1's RefusalBlock pattern.

**Identity-vs-order distinction (P1):** Refusals render in-timeline within the order (Orders.jsx:164-166: `{refusal && <RefusalBlock ... />}`). Q-D10's refusal exclusion governs IDENTITY surfaces; this is an ORDER surface. Refusals are order events, T-1 treatment. Source comment at Orders.jsx:18-22 states the distinction. Confirmed-pass on P1.

### Settlement reconciliation — computed at render

```js
// Orders.jsx:101-104
const payoutAmounts = sc.settlement ? sc.settlement.payouts.map((p) => p.amount) : []
const payoutTotal = sum(payoutAmounts)
const reconciles = payoutTotal === head.amount
```

The render produces:

- Each payout: `→ {p.to}` (green chip) + amount
- Reconciliation line: `sum(payouts.amount) = {payouts.join(' + ')} = {payoutTotal}` compared against `escrowed payload.amount = {head.amount}`, with `✓ reconciles` (green) or `✗ does not reconcile` (magenta)
- Split ratio check (when dispute exists): `split_ratio[i]` vs `payouts[i].amount`, `✓ equal` / `✗ unequal`
- `signed_by` rendered

The reconciliation is computed from fixture data at render time — not a hardcoded claim. Strict equality (`===`) between sum and escrowed amount.

### Conditional carrier/tracking — honest `'in'` presence checks

```jsx
// Orders.jsx:124-132
{'carrier' in head && (
  <div><div className="k">carrier</div><div className="v">{show(head.carrier)}</div></div>
)}
{'tracking' in head && (
  <div><div className="k">tracking</div><div className="v">{show(head.tracking)}</div></div>
)}
```

The `'in'` operator tests property existence on the payload object — distinct from `=== null` (which tests value absence when the property exists). This is the correct check for fields that may not be present in the JSON schema at all. If the property doesn't exist, nothing renders — no fake value, no empty string, no placeholder. Honest absence.

### Q-D8 — timestamp 0 as "—"

Local Timestamp component (Orders.jsx:47-56): `ts === 0` renders `—` with `title="no timestamp observed"`. Identical to Listings.jsx and Profiles.jsx treatments. Confirmed-pass.

### Q-D9 — null/absent optionals as labeled absence

| Field | Check | Treatment |
|---|---|---|
| `carrier` | `'carrier' in head` | Property-absent: not rendered |
| `tracking` | `'tracking' in head` | Property-absent: not rendered |
| `settlement` | `sc.settlement &&` | Falsy: entire section absent |
| `dispute` | `hasDispute ? ... : <div className="empty-note">...` | Absent: labeled note with scenario key |

All absences are honest — no fabricated values, no empty displays.

### Q-D11 — raw atomic units labeled

```jsx
// Orders.jsx:119-120
{show(head.amount)} <span className="unit">{show(head.asset_id)} · raw atomic units</span>
```

The label "raw atomic units" is present on the order's primary amount. Consistent with T-2 Listings.jsx treatment. Confirmed-pass.

### P3 — Unexercised dispute branches

The dispute section (Orders.jsx:215-247) contains verdict display, evidence table with T-3.1 v2 hash-row pattern, and split_ratio reconciliation. For the current fixture (scenario_1_happy_path, no dispute), `hasDispute` is false and the else branch renders: `no dispute recorded in this order's scenario — {scenarioKey} carries no evidence or verdict.`

The code paths for verdict, evidence, and split_ratio are correctly structured against the schema. They are unexercised by this data but will fire when a dispute-carrying fixture enters. Confirmed-pass on P3 disclosure — observation noted, not a finding. The branches are schema-correct, not dead code.

### P2 — One-subject composition

The derived scan (Orders.jsx:24-26) finds only `scenario_1_happy_path` carrying steps. `scenario_2_dispute_cases` has no `steps` array and no `order_id`, so it joins to nothing. The render shows `1 order` (Orders.jsx:97: `{orders.length === 1 ? '' : 's'}`). The code renders the data truth — one subject is what the fixture holds. Attaching scenario_2's dispute cases would be mechanism invention (correctly avoided). Confirmed-pass on P2.

---

## S-4 Scope

**Ruling: CLEAN**

**File count — three files exactly:**

| File | Change | Verified |
|---|---|---|
| `ui/src/App.jsx` | +2 lines | ✓ |
| `ui/src/styles.css` | +4 lines (2-rule append) | ✓ |
| `ui/src/views/Orders.jsx` | New, 346 lines | ✓ |

**App.jsx delta — exactly two lines:**
- Line 10: `import Orders from './views/Orders.jsx'`
- Line 18: `['orders', 'Orders', Orders],`
Verified ✓

**styles.css delta — pure append, order-scoped:**

```css
/* orders (T-4) */
.order { display: grid; gap: 14px; margin-top: 16px; }
.order .timeline { margin-top: 0; }
```

Two rules, both prefixed `.order` — no collision with existing selectors. The `.order .timeline` rule resets the timeline margin (defined in T-1 for EscrowLifecycle) within the order context. Pure append at end of file. Verified ✓

**Workspace untouched:** All paths under `ui/src/`. No files outside the UI workspace. Verified ✓

---

## Pre-notes Disposition

| Pre-note | Assessment |
|---|---|
| **P1** (identity-vs-order distinction) | Confirmed. Refusals render in-timeline within the order article. Q-D10 governs identity surfaces; this is an order surface. Source comment (Orders.jsx:18-22) states the ruling. ✓ |
| **P2** (one-subject composition) | Confirmed. Derived scan finds one scenario with steps. Code renders data truth. No mechanism invention. ✓ |
| **P3** (unexercised dispute branches) | Confirmed-pass. Dispute section code is schema-correct; unexercised by current data; will fire when dispute fixture enters. Noted in S-3, not a finding. ✓ |
| **P4** (seven-count correction) | Confirmed. Code renders `o.steps.map(...)` — whatever steps exist. Seven is fixture truth. Prose error corrected in commit message. ✓ |
| **P5** (duplication tick) | Noted. Timestamp ×3 views, RefusalBlock ×2 — lead-ruled local copies. Polish-track item (shared-util extraction). ✓ |
| **P6** (pivot, not data) | Confirmed. Zero new fixture data. Orders is an access-pattern view on existing fixture. ✓ |

---

## Findings

| Severity | Count | Detail |
|---|---|---|
| RED | 0 | — |
| YELLOW | 0 | — |
| QUESTION | 0 | — |

**T-4 consumption gate: CLOSED — 0/0/0**

The Orders view — order-granularity recomposition of the demo fixture. Derived subject scan, no hardcoded scenario keys. All seven steps render with both refusals in-timeline violet and four balance fields. Settlement reconciliation computed at render. Carrier/tracking via honest `'in'` presence checks. Q-D8/Q-D9/Q-D11 standing. Dispute evidence table carries the T-3.1 v2 hash-row law. Three files, scope exact, workspace untouched.