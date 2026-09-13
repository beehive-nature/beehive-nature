# z2.review — PR #74 ACCEPTANCE: PASS (S2 S3 P1 T1 N1, all five verified cold) — 2026-09-13

SEAT: z2.review, independent acceptance reviewer, read-only. ORDER: "Have z2.review review #74 read-only for S2, S3, P1, T1, and N1. Merge #74 only after that receipt passes." This is that receipt. **VERDICT: PASS.** No file in the PR edited, nothing merged, nothing deployed, no review/label submitted on the PR.

## SUBJECT

PR #74 "z2.sec — companion-surface security branch: review findings + hardened fixes (S2 S3 P1 T1 N1)", branch `z2sec/fresh-review-2026-09-12`, base `main`, **tip `2a8813ed94971ed6d2a99d25fea6ff49fdeae259`** ("z2.sec ADDENDUM"), MERGEABLE, 4 commits (review `a564b55f` → fixes `f4ec7739` → clean merge of origin/main `a1b340a1` `cd1f3f4e` → addendum `2a8813ed`). Diff vs merge-base = 5 surfaces + 2 dispatches + 1 new probe, nothing else: `jams.html` +28, `plur.html` 41, `rails-badge.js` +9, `tour.js` +10, `blanguage.html` +1, `e2e/z2sec-probe.mjs` +328, docs +282. **ISOLATION HOLDS: zero UX/redesign files ride the branch** — the founder's "UX builds on the reviewed merged result only" ruling is respected by the tree itself. CI on the EXACT tip SHA: 4/4 runs success (2× tests workflow = node/scan/static/test all pass, 2× secret-scan).

## METHOD

Gate-pairing law: throwaway DETACHED worktree `wt-z2review-74` at the tip (builder's `wt-z2sec-review` untouched), never accepting the builder's receipts — every battery re-run cold; every claim tried for disproof with my own harness and my own attacker origin (`z2review-claim-disproof.mjs`, scratch, died with the gate worktree).

## THE FIVE FINDINGS — VERIFIED

**S2 — jams ?manifest=/?store= same-origin-only: VERIFIED.** Source: `sameOriginOverride()` in jams.html — try/parse, origin equality test, catch → undefined (fail-closed); refused params render a DOM-built (createElement/textContent, no innerHTML) REFUSED row; store refused → endpoint '' → verify stays disabled. Cold behavior (probe §5 + my four independent variants — manifest-only, store-only, THROWING-URL catch branch, `javascript:` scheme with origin "null"): committed fixture renders, `cross-origin manifest/store override ignored` row visible, **zero requests to my attacker origin in every variant**, no script execution. Same-origin affordance preserved (probe §5b: same-origin manifest override loads + mismatched sha256 still refuses). BONUS PROOF (found by accident): a same-origin RELATIVE override that 404s is honored then refused through jams' pre-existing vocabulary (`event('REFUSED','no room state changed')`, jams.html:256) — honest degrade, no state change.

**S3 — rails-badge bnr_soul escape: VERIFIED.** `esc()` covers `& < > " '`; `soulSafe` used at all three soul interpolation points (bold text + title attribute). TOFU identifier stability confirmed at source: `rails-badge.js:101` hashes the RAW soul (`sha256hex('bnr.b/evm/' + soul + '@' + location.origin)`), pin keys raw too — escape is display-only. Cold: probe §7 (`<img onerror>` payload) AND my quote-breakout payload `"><svg onload=window.__pwned=1>x` shaped against the title="..." attribute — no execution, zero injected elements, badge renders the payload as text.

**P1 — referrer/noopener cluster law: VERIFIED.** Static: `<meta name="referrer" content="no-referrer">` present on plur + jams + blanguage, matching watch (4/4 by grep). tour.js: token-split rel, deduped add of BOTH noopener and noreferrer for external http(s) clicks. Cold click-time proof (the probe does NOT assert this — see observation O1): dispatching a click on a bare external link (unesco.org on blanguage) mutates it to `rel="noopener noreferrer" target="_blank"`; a link already carrying `noopener` gains `noreferrer` with ZERO duplicate tokens.

**T1 — plur i18n wiring: VERIFIED.** 15 `data-key`→`data-i18n` renames (roses 5, talk 4, stone 6), talk h2 head wrapped leaf-first in its own keyed span, three bare section markers dropped, **zero `data-key` remnants in plur.html**, stone.dock deliberately unwired (its two live links preserved — confirmed no data-i18n on `.dock`). Cold: ALL 15 keys render their corpus lv cells when lv selected (probe checked 4, mine checked 15/15); coverage counter counts the unwired as unkeyed (honest partial, keyed 16→25).

**N1 — rose hrefs: VERIFIED.** `qrroses.html`→`blight/qrroses.html`, `qrtree.html`→`blight/qrtree.html` (museum already prefixed); both targets exist in tree (`surfaces/blight/qrroses.html` 65,190 B, `surfaces/blight/qrtree.html` 58,718 B); probe §9 request-checks plur's internal links all resolve. LIVE PIN: skaists.dev/surfaces/plur.html still serves the OLD unprefixed hrefs — the fix is tree-true and heals live only on merge + Pages build (matches z2.sec's "not live until merge").

## COLD BATTERIES AT THE TIP (every count matches the builder's receipt)

z2sec-probe **44/44** · plur-views **PASS** · jams **17/17** · store-reader **9/9** · watch-manifest **29/29** · estate-source **11/11** · estate-check **94 counted / 103 listed PASS** · i18n-coverage floors **PASS** · my independent claim-disproof **20/20** · zero page errors throughout. CI full suite green on the tip SHA.

## OBSERVATIONS (non-blocking, no action taken by this seat)

- **O1 — the probe's §9 external-link check is hardcoded `true`** (informational counts, asserts nothing) — the click-time law is proven by MY test instead. Suggest a real assertion when the probe is next touched; not wired into CI's `node --test` list either (standalone lane/gate runner today).
- **O2 — my first disproof run had 2 false fails** (`::::not-a-url::::` resolves SAME-ORIGIN as a relative path, not a throw — honored as the fixture affordance, 404s, refuses honestly). Probe defect was mine; recorded here because the class matters: relative override values are by-design same-origin.
- **U1 stays OPEN by z2.sec's own scoping** (watch-owner product call) — outside this order's five, untouched.

## VERDICT

**PASS — PR #74 is cleared for merge on S2, S3, P1, T1, N1.** The merge itself is the founder's/gate's move per the order sequence; next steps after merge: rebase #70 against the new main (its conflict remains the profile blocker), then rebase + review #72, then the Raver/music redesign from the reviewed merged base.

z2.review — 2026-09-13T03:2xZ
