DIGEST: sha256(LF-normalized docket body, one trailing LF) = 329fa34e30ff8906cc9770ba68cd506953601268f17f07630ff9472302e9866a (13,484 bytes) — transport: FILE UPLOAD — MATCH

---

⟨GLM · T-3.1 v2 consumption audit · 2747b44..f337f13 · presentation-only + pre-notes⟩

---

## S-1 Consumption Faithfulness

**Ruling: CLEAN**

Four files touched. None of them import fixture data — they are pure presentation views receiving props from parent components, plus one CSS stylesheet.

**Import analysis:** The diff introduces zero `import` statements across all four files. The three JSX views already had React in scope (they are functional components returning JSX). The use of `React.Fragment` in Dispute.jsx:53, Profiles.jsx:110, and Reputation.jsx:49 accesses the already-imported React namespace — no new import module, no new pin, no new data literal.

**String audit — new inline labels:**

| File | Line (≈) | String | Classification |
|---|---|---|---|
| Dispute.jsx | 66 | `payload_hash` | §9.3 schema vocabulary — PAYLOAD_KEYS class |
| Profiles.jsx | 117 | `evidence_hash` | §9.3 schema vocabulary — PAYLOAD_KEYS class |
| Reputation.jsx | 55 | `evidence_hash` | §9.3 schema vocabulary — PAYLOAD_KEYS class |

These three strings are display labels moved from `<th>` headers to `<span className="k">` inline labels. They are schema field names — the same names that appeared in the pre-T-3.1 `<th>` elements. They identify which hash property is being rendered; they are not data values, not fixture pins, not derived literals. Classification: PAYLOAD_KEYS per §9.3, exempt from pin-grep.

**Data access audit — every property path unchanged:**

| View | Property paths in diff | Match pre-T-3.1? |
|---|---|---|
| Reputation.jsx | `c.source`, `c.contribution`, `c.weight`, `c.evidence_hash` | Identical |
| Profiles.jsx | `c.source`, `c.contribution`, `c.weight`, `c.evidence_hash` | Identical |
| Dispute.jsx | `ev.provenance`, `ev.favors`, `ev.confidence`, `ev.signed`, `ev.verified`, `ev.payload_hash` | Identical |

Zero datum changed. Zero new fixture literal. The two pins (FIXTURE_PIN, LISTINGS_PIN) are untouched — these files don't reference them.

---

## S-2 Chip Law — Two-State

**Ruling: CLEAN**

The diff rewrites the hash chip's break behavior. Verified both states from CSS:

**Collapsed state (`.hash`):**

```css
/* styles.css:172 */
white-space: nowrap;
```

Previously `word-break: break-all`. Now `white-space: nowrap` — the chip text cannot break mid-string. Combined with the structural change (hash moved to its own full-width `colSpan` row), the collapsed chip has unlimited horizontal space within its container. The full `head...tail` form (10-char head + ellipsis + 8-char tail) renders on a single line with no wrap and no clipping.

**Expanded state (`.hash-open`):**

```css
/* styles.css:176 */
white-space: normal;
word-break: break-all;
```

The expanded state restores `word-break: break-all` and sets `white-space: normal`. This allows the full 64-hex string to wrap at any character boundary, preventing layout overflow on narrow viewports. The `.hash-open` rule also retains its pre-T-3.1 properties (`background: var(--magenta-tint); border-color: var(--magenta)`).

**Header nowrap (ancillary but noted):**

```css
/* styles.css:155 */
th { ... white-space: nowrap; }
```

Column headers (source, contrib., weight, provenance, favors, conf., badges) preserve their full §9.3 names on a single line. This was a v1 gain retained in v2 per the scope declaration.

**Two-state summary:**

| State | `white-space` | `word-break` | Wraps? | Clips? |
|---|---|---|---|---|
| `.hash` (collapsed) | `nowrap` | (unset) | No | No (full-width row) |
| `.hash-open` (expanded) | `normal` | `break-all` | Yes | No (wraps instead) |

---

## S-3 Completeness Under Rearrangement

**Ruling: CLEAN — this is the audit's sharpest question, answered file by file.**

The structural change removes the hash COLUMN from three tables and repositions each hash onto its own full-width row beneath the value columns. The cardinal rule: **no datum may have changed** — every hash must still render, and every label must still be present.

### Reputation.jsx (T-1-audited view)

**Before:** 4-column table (source, contrib., weight, evidence_hash). Each component = one `<tr>` with 4 `<td>`.

**After:** 3-column table (source, contrib., weight). Each component = `<React.Fragment>` wrapping:
- `<tr className="comp-main">` — 3 `<td>` for source, contrib., weight (Reputation.jsx:50–54)
- `<tr className="comp-hash">` — `<td colSpan={3}>` containing `<div className="hash-row">` with `<span className="k">evidence_hash</span>` + `<HashChip hash={c.evidence_hash} />` (Reputation.jsx:56–62)

**Verification:**
- Hash access: `c.evidence_hash` — identical to pre-T-3.1. ✓
- Label: `evidence_hash` — verbatim §9.3 name, moved from `<th>` (removed at Reputation.jsx:43) to `<span className="k">`. The name moved; it did not vanish. ✓
- `colSpan={3}` covers all 3 remaining columns — full-width row achieved. ✓
- Every component entry in the `.map()` iteration still produces exactly one HashChip render. ✓

### Profiles.jsx (T-3-audited view)

**Before:** 4-column table (source, contrib., weight, evidence_hash). Each component = one `<tr>` with 4 `<td>`.

**After:** Identical pattern to Reputation.
- `<tr className="comp-main">` — 3 `<td>` (Profiles.jsx:111–116)
- `<tr className="comp-hash">` — `<td colSpan={3}>` with `evidence_hash` label + HashChip (Profiles.jsx:118–124)

**Verification:**
- Hash access: `c.evidence_hash` — identical. ✓
- Label: `evidence_hash` — verbatim, moved from `<th>` (removed at Profiles.jsx:103) to inline `<span className="k">`. ✓
- `colSpan={3}` — correct for 3-column table. ✓
- Every component entry still produces exactly one HashChip. ✓

### Dispute.jsx (T-1-audited view)

**Before:** 5-column table (provenance, favors, conf., badges, payload_hash). Each evidence = one `<tr>` with 5 `<td>`.

**After:** 4-column table (provenance, favors, conf., badges). Each evidence = `<React.Fragment>` wrapping:
- `<tr className="comp-main">` — 4 `<td>` for provenance, favors, conf., badges (Dispute.jsx:54–68)
- `<tr className="comp-hash">` — `<td colSpan={4}>` containing `<div className="hash-row">` with `<span className="k">payload_hash</span>` + `<HashChip hash={ev.payload_hash} />` (Dispute.jsx:70–76)

**Verification:**
- Hash access: `ev.payload_hash` — identical to pre-T-3.1. ✓
- Label: `payload_hash` — verbatim §9.3 name, moved from `<th>` (removed at Dispute.jsx:48) to `<span className="k">`. ✓
- `colSpan={4}` — correct for 4-column table (was 5, removed 1, now 4). ✓
- Every evidence entry in the `.map()` iteration still produces exactly one HashChip render. ✓
- All other property accesses preserved: `ev.provenance`, `ev.favors`, `ev.confidence`, `ev.signed`, `ev.verified` — identical. ✓

### S-3 Summary Table

| View | Hash property | Label | colSpan | Hashes lost? | Labels lost? |
|---|---|---|---|---|---|
| Reputation | `c.evidence_hash` | `evidence_hash` | 3 | 0 | 0 |
| Profiles | `c.evidence_hash` | `evidence_hash` | 3 | 0 | 0 |
| Dispute | `ev.payload_hash` | `payload_hash` | 4 | 0 | 0 |

**Zero hashes lost. Zero labels lost. Zero datum changed.** The names moved; they did not vanish.

---

## S-4 Scope

**Ruling: CLEAN**

**File count:** Four files exactly — styles.css, Dispute.jsx, Profiles.jsx, Reputation.jsx. Matches scope declaration §1. ✓

**Workspace boundary:** All paths are under `ui/src/`. No files outside the UI workspace touched. ✓

**v1 gains retained:**

| v1 Gain | Present in v2? | Evidence |
|---|---|---|
| `th` nowrap | ✓ | styles.css:155 — `white-space: nowrap` on `th` rule |
| Two-state chip law | ✓ | styles.css:172 (collapsed nowrap) + styles.css:176 (expanded break-all) |

**Structural soundness:** The three JSX views use `React.Fragment` with `key={i}` to wrap paired `<tr>` elements — correct React pattern for `.map()` returning multiple sibling rows. No extra DOM nodes introduced. The CSS classes `comp-main`, `comp-hash`, `hash-row`, `.hash-row .k` are new and scoped to this feature; they do not conflict with any existing selectors.

**Stated diff class: +88/−48.** Not independently re-counted — the figure is consistent with the structural change (4 files, each gaining Fragment wrapper + comment + class attributes while losing one `<td>` + `<th>` per table row). No inconsistency detected.

---

## Pre-notes Disposition

| Pre-note | Assessment |
|---|---|
| **P1** (v1 lie-by-clipping) | Consistent with the diff. v1's `nowrap` in a column-grid cell would clip the tail on narrow cards. v2's full-width `colSpan` row eliminates the column-width constraint entirely. The law — "the collapsed form renders in full or the layout changes" — is satisfied by the layout changing. ✓ |
| **P2** (pre-authorized scope clause) | Consistent. Four files, not one. The JSX changes are minimal restructure — Fragment wrappers, row splitting, class additions. No logic, no data access, no imports changed. ✓ |
| **P3** (derivation-gating boundary) | Banked for records. The distinction between one-shot deterministic derivation (sound) and iterative repair-until-pass (forgery) is noted. ✓ |
| **P4** (eyes-gate record) | "Digests catch wrong bytes; eyes catch true bytes rendering a lie." — Consistent with P1: v1's bytes were correct (passed digest) but rendered a clipped hash (failed eyes). v2 passes both gates. ✓ |

---

## Findings

| Severity | Count | Detail |
|---|---|---|
| RED | 0 | — |
| YELLOW | 0 | — |
| QUESTION | 0 | — |

**T-3.1 v2 consumption gate: CLOSED — 0/0/0**

The machine's first presentation-only micro-lap, refused once by eyes (v1 clipping), restructured under pre-authorized scope clause, landed clean. All four surfaces pass. No datum changed; all hashes render on full-width rows with verbatim §9.3 labels; the chip law's two-state break behavior is correct in both collapsed and expanded states.