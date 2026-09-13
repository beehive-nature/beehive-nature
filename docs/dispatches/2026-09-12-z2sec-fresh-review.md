# z2.sec — fresh independent review: privacy, spoofing, storage, navigation, translation, mobile, unavailable-state

Order: lane assignment `z2.sec — Medium / fresh`. Executed 2026-09-12 by the
zCode seat as z2.sec, independently of z2.a–z2.d (no receipts reused; every
claim below re-derived this session). Target: the released SKAISTS companion
surface cluster — `surfaces/plur.html`, `surfaces/watch.html`,
`surfaces/jams.html`, `surfaces/blanguage.html` + shared assets
(`lang.js`, `register.js`, `rails-badge.js`, `tour.js`, `manifest-reader.js`,
`store-reader.js`, `lang-corpus.json`).

Scope base: `origin/main` at `8019be29` (worktree `wt-z2sec-review`, branch
`z2sec/fresh-review-2026-09-12`). The z2.d release SHA `622a2c5c` is an
ancestor; live byte-pins verified below.

## Verdict

**No rollback-class defect. Six fix-forward findings, one of them
substantive (T1).** The cluster's security posture is genuinely fail-closed:
strict-exact shape validation, textContent-only rendering of host data,
estate-only bare loads, in-memory chat history, honest unavailable states.
The findings are wiring and affordance gaps, not trust-boundary breaks.

## Findings

### T1 — plur's d.plur.* sections are corpus-translated but never wired (MEDIUM)

`plur.html` marks 19 elements with `data-key="d.plur.*"` — the rose gate, the
conversation floor, the cornerstone band. The corpus holds all 24 `d.plur.*`
keys × 28 tongues + en (`surfaces/lang-corpus.json`, verified: 24 keys, 29
cells each — the door-intro fold the page's own manifest comment demands
happened). But **nothing consumes `data-key`**: `lang.js apply()` renders
`[data-i18n]` only (`surfaces/lang.js:119`), and no script in plur.html,
tour.js or register.js reads it (grep-proven).

Runtime-proven (probe §4): with lv selected, the sections stay English —
`d.plur.talk.h` renders "now say it back" while the corpus lv cell is "tagad
saki to atpakaļ"; same for `d.plur.roses.h`, `d.plur.stone.h`,
`d.plur.talk.send` ("send ↑" vs "sūtīt ↑"). A Latvian/Thai/Arabic reader gets
the page's emotional core in English only, silently — the one shape the
corpus law forbids. The coverage counter stays honest (272 visible leaves,
16 keyed, 256 unkeyed — partial state disclosed), so no false claim is made;
the defect is the missing wiring, not a lie. Every gate passed because they
count `data-i18n` leaves, which these sections lack.

Fix: swap `data-key`→`data-i18n` on the 19 elements (or teach lang.js both
attributes), re-run `i18n-coverage --floors` + `plur-views.mjs`. The
translations already exist — this is a one-attribute change per element.

### N1 — plur's rose links 404 on the live estate (MEDIUM-LOW, live-verified)

`surfaces/plur.html` rose-gate links `qrroses.html` and `qrtree.html` resolve
relative to `/surfaces/` — both **404 on skaists.dev** (curl-proven this
session). The files live at `surfaces/blight/qrroses.html` and
`surfaces/blight/qrtree.html` (200). The sibling museum link got its `blight/`
prefix right; these two didn't. All other internal links on all four surfaces
resolve (probe §9). Fix: add the `blight/` prefix to both hrefs.

### S2 — jams accepts cross-origin `?manifest=` / `?store=` overrides (MEDIUM-LOW)

`surfaces/jams.html:181-182` builds the manifest URL and store endpoint from
query params with no origin restriction. Proven at runtime with a CORS-open
attacker origin (probe §5):

- a crafted link paints arbitrary channel/creator/source fields under SKAISTS
  branding ("PLUR · spoofed-room jam" rendered);
- an attacker controlling both manifest and store **passes the hash gate** —
  the "verified" chips light for attacker ciphertext (the attacker writes the
  hashes); a mismatched hash still refuses fail-closed (both directions
  proven);
- `?store=` drives a GET to the attacker origin on "verify encrypted refs" —
  a click-beacon (visitor IP/UA/timing to the attacker).

No script path exists: `display_name` payload markup rendered as literal
text, zero page errors (textContent everywhere — verified at
`jams.html paint()`). GET-only, CORS-gated, no user data transmitted. These
overrides read as test affordances that shipped in a live surface. Fix:
restrict both params to same-origin, or drop them from the shipped page.

### U1 — "Open chat" stays enabled where no room server exists (LOW-MEDIUM)

On the live pinned copy (skaists.dev = GitHub Pages), `/join/` and `/live/*`
are 404 (curl-proven). The health poll degrades honestly ("Connection
unavailable"), but the Open chat button remains enabled and mounts an iframe
that loads a GitHub Pages 404 — an affordance presenting a room that isn't
there, with no in-frame explanation. Fix: disable on unavailable health, or
catch the frame 404 with an honest in-frame line.

### S3 — rails badge interpolates `bnr_soul` into innerHTML unescaped (LOW, latent)

`surfaces/rails-badge.js:123` builds the badge HTML with the raw
`localStorage.bnr_soul` value. Proven executing: stored
`<img src=x onerror="window.__pwned=1">` runs on load (probe §7). Exploitable
only via a same-origin write (XSS elsewhere / devtools), consistent with the
file's documented same-origin trust basis — but this is the one place a
storage value becomes HTML. One-line escape closes it.

### P1 — referrer policy inconsistent across the cluster (LOW)

Only `watch.html` carries `<meta name="referrer" content="no-referrer">`.
blanguage carries ~50 external research links; `tour.js`'s click-time
external-link law adds `noopener` but not `noreferrer`
(`surfaces/tour.js:146-149`), so the page URL travels as Referer to unesco.org,
wikipedia, SIL, doi.org etc. No secrets ride these URLs (the room pass never
appears in a page URL), but the cluster should adopt watch's standard:
no-referrer meta cluster-wide or `noreferrer` in the delegation law.

### Nit — evidence links pin a working branch

watch.html's three "Page request code" privacy-sources links point at
`blob/codex/watch-jams-plur-2026-09-11/...`. The branch still exists on
origin (verified today) but is deletion-bait after PR merges; `main` or a tag
survives. No action required now.

## Dimension verdicts

| dimension | verdict |
|---|---|
| privacy | SOUND, disclosed — bare load estate-only 8/8 (desktop+390px); tutor POST only after gesture, destination+disclosure verified; history-in-transit disclosed on-page; gap P1 |
| spoofing | STRONG with two vectors — fail-closed exact-shape validation (manifest-reader.js `validateManifestEnvelope`, watch.html `watchManifest`); host data textContent-only, injection inert 3/3 probes; TOFU origin pin present; vectors S2, S3 |
| storage | CLEAN — only preference/receipt-class keys (`blang`, `btranslated_pref`, `plur.my`, `plur.learn`, `bvoice`, `bregister`, `bnr.motion.paused`, `watch.session`); conversation history in-memory only (proven); no cookies, no sessionStorage |
| navigation | CLEAN except N1 — internal links resolve (3/4 surfaces all-green; plur's two rose links dead live); external links noopener'd (static or delegation); aria-current used |
| translation | T1 — floors PASS fresh, machine-draft ⚙ labels honest, honest English fallback, corpus-failure honesty proven; but d.plur.* wiring missing (above); jams is English-only by design, makes no i18n claim |
| mobile | CLEAN — 390px zero horizontal overflow 4/4; watch media queries + 44px controls; tour bar drawer one tap |
| unavailable-state | STRONG — blocked tutor / absent /live / manifest 404 / corpus 404 / voice-absence all render honest states (proven); gap U1; watch's segment-gate backend item remains open and correctly disclosed on the page itself (not re-litigated; no box access claimed this lane) |

## Evidence (all fresh this session)

Existing batteries re-run from the review worktree: `plur-views.mjs` PASS ·
`zcode-jams-check.mjs` 17/17 · `zcode-jams-store-reader-check.mjs` 9/9 ·
`zcode-watch-manifest-check.mjs` 29/29 · `lang-coverage.test.mjs` 12/12 ·
`i18n-coverage --set --floors` PASS.

New probe committed with this dispatch: `e2e/z2sec-probe.mjs` — 42 checks,
37 pass / 5 fail, **where the 5 fails are exactly findings T1 (×4 cells) and
N1 (one check, two links)**; every other dimension's checks pass. The probe
serves the worktree statically plus a CORS-open attacker origin; no external
network touched (api.anthropic.com routed to abort — which is itself the
unavailable-state proof). Zero page errors across all probes.

Live verification (read-only): plur/watch/jams byte-pin MATCH release
`622a2c5c` AND current origin/main AND live skaists.dev (sha256 prefixes
f861e755 / a2334ca3 / 9edbb227 — the z2.d dispatch's own pins still hold).
blanguage differs from the release pin lawfully: changed by `39ce903b`
(education-i18n recovery, PR #43 lane, merged after z2.d); live ==
current main (58e1d9a7). The fixture envelope serves 200 live.

## Recommended order of repair (all fix-forward, none block)

1. T1 wiring swap + floors re-run (translations already exist)
2. N1 two href prefixes (live 404s today)
3. S2 same-origin restriction on jams query overrides
4. U1 chat-button unavailable handling
5. S3 escape `bnr_soul`; P1 referrer consistency
