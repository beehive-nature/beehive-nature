# bKiMi — BUG-002: bring surfaces/bmeshasi.html to the design battery — 2026-09-16

Claim: YELLOW, self-selected after frontier sync, announced in #general
(thread 48202e61). Branch `bkimi/bug-002-bmeshasi-design` off main
`0e1c22ec`. bugs/BUG-002.md was SCHEDULED with the operating seat
unassigned — same class as BUG-001 (closed by z2.1 with the documented
pattern). Non-goals named at claim: no chain-read semantics, no
gate/economics changes, `FOUNDER_VALUES` untouched — presentation
structure only. Collision check at claim: no active branch touches the
file; the three stale PR-less branches carrying 0–12 diff-lines rode the
Grok remodel that already landed on main as `dd95c4d0`.

## RED baseline (design-acceptance @ main 0e1c22ec, before any edit)

7 passed / 7 failed — D1 no inset step · D2 no `--sem-*` tokens + no
meanings comment · D3 headline not gradient-clipped · D4 no hero marked ·
M no ≤600px media query · I1 cross-origin reads at page-open
(`eos.api.eosnation.io`, `api.hive.blog`). Peer precedent
`surfaces/museum.html` passes 14/14 today.

## The operation (presentation structure only)

| check | before | after |
|-------|--------|-------|
| D2 | raw palette vars only | `--sem-harm/solution/value/system/science` aliased to the page's OWN palette, meanings-picked-first comment (harm=amber gates/guards · solution=leaf what-exists · value=gold iron-first money · system=cyan road out · science=violet meter math) |
| D3 | h1 flat gold + text-shadow | h1 gradient-clipped (ink→value→system), background-clip:text, color transparent |
| D1/D4 | no inset, no hero | `.pstat` inset (`#0a0f0b`, distinct from body `#0d1410` and panel `#111a14`) + hero figure: live Vaulta head-block number at 38px with 10px uppercase caption, `data-hero-number`/`data-hero-caption` markers |
| M | no media query | ≤600px query: padding steps down, hero 30px, waterfall steps go full-width, arrows hide; h1 still shrinks (clamp) |
| I1 | chain reads fired AT page-open | page-open issues ZERO chain reads — first read deferred to a beat after first paint (`requestAnimationFrame` → 1200ms), then the 15s cadence owns the lane |

The hero is not decoration: it is bound to the same live Vaulta head-block
read as the ⚓ dial — honest empty state `—` at paint, hydrates with the
first successful read, goes amber with the dead-read law when the chain is
unreachable ("the gap is real, the dial does not invent").

## The I1 decision — deferred first read, NOT an allowlist entry

The cheap fix was adding the chain hosts to the battery's
`RIDER_ALLOWLIST`. Every entry there rides a founder order — that file is
out of lane bounds, and waving cross-origin chain reads through the
INSTANT gate would have weakened the battery to fit the surface
(acceptance clarification 3 forbids exactly that). The in-lane honest fix
is the deferred first read: the page paints its skeleton instantly and
never invents a number — the live reads stay live, just not at page-open.

Founder/Astra acceptance clarifications and how each is met:

1. **No fabricated live state at initial render** — the hero and both
   chain dials paint `—` with honest captions ("first read a beat after
   first paint"); no cached or invented chain value anywhere.
2. **"After first paint" behaviorally proven, not a timer claim** — the
   battery's I1 probe is the proof: real Chromium, request listener,
   reload + settle window, and it counts ZERO cross-origin requests while
   the initial meaningful DOM is already up (FCP 48ms file://; 6
   subresources, all same-origin allowlisted riders). Hydration begins
   afterward; 15s cadence, failover walk, visibility-pause and amber
   dead-read code paths are byte-for-byte the pre-existing semantics.
3. **Battery not weakened** — `e2e/design-acceptance.mjs` untouched; the
   surface changed, not the gate. Museum was precedent, not template:
   bmeshasi keeps its own palette, copy and dial layout.
4. **Tokens carry meaning** — the meanings-first comment explains WHY each
   token exists; every accent on the page carries its meaning.
5. **Boundary held** — meter math, failover host lists and walk order,
   waterfall, gate copy, economics and `FOUNDER_VALUES` all untouched. One
   stale comment corrected as a finding: "three-host failover" → two, the
   dead-host sweep's actual count (same correction class as zCode's
   bantfarm comment fix in the 2026-09-13 dead-host sweep).

## Receipts (this tree, this run — worktree wt-bkimi-bug002 @ 0e1c22ec + this diff)

- `node e2e/design-acceptance.mjs surfaces/bmeshasi.html` — **14 passed, 0
  failed** (was 7/7 at baseline). I1: zero cross-origin, zero outside the
  rider allowlist; INSTANT · 6 subresource request(s) · 131.0 KB · riders
  tokens.css, agent-dock.js, tour.js, register.js, rails-badge.js,
  lang.js — COUNTED, not waved. FCP 48ms (file:// number).
- `node scripts/estate-check.mjs` — **PASS** (95 counted · 104 listed ·
  counts computed, not written).
- `node --test` over CI's exact front-door list (29 files, tests.yml
  static job) — **330 passed, 0 failed** (no-dead-host, atlas, agent-dock
  included).
- `cd e2e && node university-smoke.mjs` — **87 passed, 0 failed**.
- `cd e2e && node no-page-errors.mjs` — **104 surfaces walked · 0 with
  page errors**.

## Boundary not crossed

No chain-read semantic changes (hosts, walk order, cadence, pause and
amber laws preserved); no economics/gate changes; `FOUNDER_VALUES`
untouched; no RIDER_ALLOWLIST edit; no opportunistic cleanup. If 14/14
had required any of those, the lane's order was to stop and report the
contradiction — it did not.

## Closure

bugs/BUG-002.md rewritten SCHEDULED → CLOSED with the operative report.
Dispatch per house law. Lane routes to zCode/lane-owner review → merge;
no self-merge.
