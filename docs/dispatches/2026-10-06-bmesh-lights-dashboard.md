# bMESH/x0x capability lights — the founder's rule, code-enforced; four lights lit by receipts, one dark on purpose

Seat: zCode (GLM). Date: 2026-10-06. Founder order: build the
bMESHasi/x0x capability dashboard (identity, authority, route, proof,
meter lights) as a SEPARATE surface, banked as an idea with ONE RULE:
"a light only turns on when something real was measured. That rules out a
timer like doxx's '39s' key timer, since nothing tells us what it counts."

## What landed (branch zcode/bmesh-lights-2026-10-06, one commit, lands on main for Pages)

- **surfaces/bmesh-lights.json** — the hand-kept source of truth: five
  lights, each with state/what/source/measuredAt. States are legal kinds:
  measured · not-measured · probe-on-visit (route only — a privilege no
  other light may claim without a receipts-backed reason).
- **surfaces/bmesh.html** — the board. Renders ONLY from an embedded copy
  of the receipts (sync proven in CI); not-measured renders as the words
  themselves, dashed rim, no fill (the estate's first-class non-value
  states); zero timers of any kind; rub law held (no request on load);
  the route probe is opt-in, no-cors, 4.5s timeout, refusals render
  verbatim and are called measurements; a visit probe is EPHEMERAL and
  never writes back to the receipts.
- **e2e/bmesh-lights.test.mjs (CI-wired)** — the rule as a gate: every
  measured light MUST carry measurement + source + dated receipt; no
  setInterval/setTimeout/rAF anywhere on the page; the doxx anti-pattern
  must be NAMED in the law text and never instantiated; page-embedded
  copy identical to the JSON; render built from the receipts, not
  opinions; shell/tokens/register/noopener laws.

## The five lights and their receipts (CLAIM → EVIDENCE → BOUNDARY)

1. **identity — LIT.** Box prod node x0x v0.45.0 (upgraded from 0.41.3
   2026-09-15, sha256 + GPG-verified at swap; systemd shape in-tree).
   Source: 2026-09-15-x0x-505-504-field-evidence.md §box-upgrade,
   ops/x0x/x0x.service. BOUNDARY: instrumented 0.41.4 measurement
   binaries are a DIFFERENT identity (staged, never deployed) — stated
   on the light, not conflated.
2. **authority — LIT.** connect-acl.toml verbatim-what-runs (default
   DENY, exactly one tailnet path); laptop public-mesh forbidden;
   ObserveOnly stands, #1170 = flip gate; #622 host needs founder
   approval. Sources: ops/x0x/{connect-acl.toml,LAPTOP-NETWORK.md},
   622-packet §blocker.
3. **route — PROBE-ON-VISIT (the only live lane).** Last receipt:
   2026-10-05/06 box SSH banner-timeout from this seat while both HTTPS
   doors answered 200 — dated, sourced, real. This visit: unmeasured
   until the founder presses probe; ephemeral by design.
4. **proof — LIT, with a deliberate dark row.** #505 re-run posted AND
   accepted (fragment-drop reproduced on OCI ARM64; v0.45.0 clean —
   comment 5684603878); #504 per-topic capture posted AND accepted
   (comment 5684632472). DARK: #622 per-peer control — packet staged,
   binaries pinned, ZERO captures run, none claimed; blocker = approved
   isolated measurement host. The dark row says NOT MEASURED in words.
5. **meter — LIT.** crates/bmesh-meter in-tree (zero-dep, CI cargo test
   every push): 17 tests, mutation-proven (2 mutants killed), vectors
   derived independently before the assertions. BOUNDARY: it meters the
   fee-curve MATH; live mesh traffic metering is NOT among these
   measurements and stays unlit.

## Receipts of this build

- e2e/bmesh-lights.test.mjs 7/7 · combined run 49/49 (with bchat-core +
  register suites) · estate-check PASS (111 counted · 120 listed) ·
  door-counts 9/0 · r5 holds · lint-ci-shape 121/121 · **tests.yml YAML
  parsed before push** (the banked bChat lesson, now standing practice) ·
  footer-audit --only bmesh.html: zero findings ×3 registers · Playwright
  390px smoke: zero errors, zero external requests on load, 5 lights
  (4 receipt-lit + route awaiting probe), 1 dark row, cypherpunk raw
  receipts stand open. Shots: scripts/tmp/bchat-shots/bmesh-0{1,2}.png.

## Next owners

- Route light's receipts grow as roads are measured (box SSH door is the
  current open question — it timed out all week from this seat).
- The #622 dark row flips ONLY when a capture actually runs (founder
  gesture: approved host; packet ready at ops/x0x/MEASUREMENT-622.md).
- Meter light can gain a LIVE lane when real mesh traffic is metered —
  until then it states exactly what it meters.
