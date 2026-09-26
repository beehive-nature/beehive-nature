# z2.b BUILD RECEIPT — .b · .a · silent payments on both profile surfaces, all three registers · 2026-09-12

**Order:** z2.b — Medium / existing: integrate verified .b, .a, and Silent Payments capabilities into both profile surfaces and all three registers. **Seat:** zCode. **Branch:** `zcode/z2b-profile-capabilities-2026-09-12` (label note: "z2.b" as ordered collides with the z2b watchpay lane label — this lane is the profile-capabilities build; no relation to watchpay).

## what landed

**`surfaces/profile.html` (dynasty)** — was the only root profile with no fleet rail and no registers:
- fleet scripts added (`agent-dock.js` + `tour.js`, which injects `register.js`/`lang.js`/`rails-badge.js`) — the 🐝/🎛/⚗ toggle now rides this page.
- new **rails band**: `.b` (live) · `.a` (live) · **Private Bitcoin support — coming soon** (dashed non-value rim), each card's prose in all three registers; numbers identical across registers per the register law.
- new **live registry checker**: type any name (with or without `.b`/`.a`), get the chain's own verdict — HELD with owner · resolves-to · expiry, or not-on-registry-today, or couldn't-reach (honest degrade). Keyless, read-only, whole-walk.

**`surfaces/blight/profile.html` (holder)** — the toggle already rode via `tour.js`; the content arrives now:
- **address book resolves `.b` and `.a`**: same keyless `kingbeelovis/domains` read the .b desk uses, full-table + exact client-side match, cached per page-load; entries resolve to "Vaulta b/a name · resolves to \<account\>" or stay as-written with the honest note. `isName` regex, hint copy and placeholder extended.
- new **rails band** mirroring the dynasty's three cards in three registers; SP card dashed-rim unconfigured per the blueprint's acceptance contract (title says coming soon; no address, no QR, nothing interactive; the never-invents/never-scans line rides in every register).

**`e2e/profile-caps.mjs`** — 30 assertions, all green; 8 screenshots in `e2e/shots-profile-caps/` (both surfaces × three registers @390 + desktop).

## the verified finding this build surfaced (FLAG for the founder)

The live `kingbeelovis` registry read from this seat on 2026-09-12 carries **13 rows, all owner+account `kingbeelovis`, all expiring 2027-08-01**: oliver, loviswater, lacee, travisremington, remington, lovis, queen, isabella, travis, loviswaternakamoto, king, inga, amanda.
- **`skaists` is NOT among them** — the dynasty page's "registered the name on Vaulta" house claim is presentation until registered.
- **no `.a` name is registered** — `bclaude.a` is not a row; the .a rail is verified as a *capability* (same contract, suffix convention, SPEC-A-NAMES-1) but no agent name lives on it yet.
Per record law the dynasty prose was left untouched (records are never edited in a capability build); the checker gives anyone the live answer, and both surfaces' honest notes say what the chain says. Registering `skaists`/`bclaude` is one `registeracc` each, compose-only at the .b desk — founder keys, founder gesture.

## engineering receipts

- **bounded string queries lie**: `get_table_rows` with `lower_bound`/`upper_bound` on the string PK returns EMPTY even for `king` (measured on eos.api.eosnation.io) — an empty bounded answer must never read as "not registered". Both surfaces do the full-table walk (13 rows ≈ 2.2KB) + in-browser exact match, exactly the .b desk pattern.
- **host list mirrors the healed sweep**: `eos.api.eosnation.io` → `eos.greymass.com` (api.eosn.io NXDOMAIN-dead, dropped — matches wt-zcode-edu-recovery @61091bc4).
- **SP card law, asserted by test**: no address-shaped string, no QR/canvas/img, nothing interactive inside the card, title carries "coming soon", never-law line present — on both surfaces, in the register the page happens to be in.

## verification (all local, this seat)

- `node e2e/profile-caps.mjs` → **30 passed, 0 failed** (register swaps D2/H1d, checker verdicts D4/D5, book resolution H2–H4 incl. `bclaude.a` live-truth, storage purity H5, six 390px in-register renders).
- `node scripts/estate-check.mjs` → PASS (93 counted, unchanged — no new files, no ritual needed).
- `node e2e/estate-source.mjs` → PASS (no new i18n keys; corpus untouched).
- `node e2e/university-smoke.mjs` → **78 passed, 0 failed**.
- overflow probe: no horizontal overflow at 390px or 1440px on either surface.
- cargo/shell/static CI unaffected by content-only edits (no Rust, no new scripts in CI paths).

## open questions carried

1. founder gesture: register `skaists` (and a first `.a` name for bClaude) on kingbeelovis so the dynasty houses carry live rows.
2. the SP card goes live per-artist only when an artist supplies a real `sp1q…` address — the configured-state acceptance contract sits in [the blueprint dispatch](2026-09-12-bnr-sp-dana-profile-blueprint.md), ready for that day.
3. silentpayments.xyz remained unreachable from this seat — no change from the research lane.

## rider 2026-09-13 — the main-conflict resolution (recorded where it happened)

Main moved under this PR (#69 translation tranche, #71/#73 gallery work, and the house-profile
rework of surfaces/profile.html). Resolution shape: main's rewrite taken WHOLE as the base; this
lane's pieces re-applied on top — the rails band became a proper section OUTSIDE the beat-gated
#instrument wrapper (default-hidden until "Go deeper"; bee/raver intros failed until moved), the
checker and agent-dock restored, blight auto-merged clean. Two CI laws learned in the landing:
the no-dead-host sweep scans LITERALS in surfaces code, so even a comment naming the dead eosn
endpoint fails it — the comment now says "the dead eosn endpoint" and names nothing; and §7
computes its range from the push event's before-SHA, which a force-push abandons — the branch
history was reshaped (single commit on main) and re-pushed incrementally so the range resolves.
Gates at this state: e2e 30/30 · no-dead-host 11/11 · estate-check 94 · corpus 11/11 ·
university-smoke 87/87 · no 390px overflow.
