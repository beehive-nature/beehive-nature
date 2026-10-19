# local working edition: the native local-reader host, repaired per review (2026-10-19)

zCode seat. First of the three follow-ons named at the #467 closure —
**connect the reader to the local evidence store** — as the delivery
dispatch's sanctioned narrow local reader. This is the REPAIRED descendant
of `4ec2bc1eb`, answering every finding in the PR #471 review. The
Rust-scale items (bounded store iteration, streaming archive writer)
remain with their crates.

## Review finding 1 — served bytes are now bound to the verified package

The original host verified at startup, closed the files, then REOPENED
PATH NAMES at request time — a TOCTOU the review reproduced four ways.
The repaired `tools/genealogy/serve-local.mjs` **serves from a verified
immutable snapshot**: every declared file is lstat-checked (regular file,
dev/ino identity, no symlinks — pre-planted outside symlinks are
refused), streamed ONCE while hashed into a private mode-0700 snapshot
directory under the OS temp dir, and every response is served from that
snapshot only. Post-startup tampering with the package — same-length
changes, symlink swaps, deletion — cannot alter or crash what is served;
per-request filesystem errors are contained (500, host stays up); the
snapshot is removed on close. Regression cases cover all four review
rows: **11/11 under WSL Linux**, 9 pass + 2 symlink rows skipped on this
Windows box (no unprivileged symlink creation; CI runs Linux).

## Review finding 2 — the visible reader journey, ordinary gestures

- `e2e/local-evidence-host.mjs` rebuilt: **14/14 on real Chromium.** It
  now composes the person-panel's own `mountLocalEvidence` organ in a
  visible page, drives it with ORDINARY actionable clicks (row summary →
  nested transcription summary → Verify), asserts VISIBLE
  transcription/conflict/citation/receipt text, and proves the browser
  DECODES the image (`img.decode()` + natural pixels) with a VALID PNG
  built in-test through real zlib + CRC-32 (the old fixture was
  malformed, as the review found). A corrupted-artifact control shows
  the digest gate refusing visibly ("Page unavailable", no image).
- `e2e/local-evidence-real-edition.mjs` (env-gated on
  `SKAISTS_LOCAL_EDITION`; CI skips) repeats the journey on the real
  363 MB private edition: **7/7** — keyboard open on the tree (the orbit
  buttons genuinely overlap each other's pointer paths at both 1280×900
  and 1920×1080; sibling buttons intercept the centre click), then
  ordinary clicks through to "Saved bytes match the receipt" and a
  decoded census page, zero outside-origin attempts, zero page errors.
- **The hidden-state cause is PROVEN, not guessed:** the person view
  wraps its sections in collapsible `<details class="pp-sec">` elements
  that start closed. Chrome still LAYS OUT closed-details content
  (non-zero boxes, `checkVisibility()` true on every ancestor), which is
  why every indirect probe read "visible" while the browser painted and
  hit-tested nothing — Playwright was right and the probes were wrong.
  The user gesture is the section's own summary header; after that
  opening click everything downstream is ordinarily clickable. This is a
  panel-composition fact, not a defect of the evidence organ.

## Review finding 3 — the network guard lives in the browser

A browser-context `route` guard is installed BEFORE navigation: every
non-package-origin request is recorded and aborted (requestfailed
attempts included). The journey asserts zero outside-origin attempts;
a deliberate probe to a closed loopback port (no external service
contacted) is blocked AND detected, proving the gate can go red. The
server-side counters remain as secondary evidence only.

## Scope

The prior receipt's "full product path" claim — earned by evaluate-
driven gestures — is superseded by the ordinary-gesture pass above, and
the receipt says so. The private edition stays private; no Autonomi, no
wallet, no spend, no FamilySearch requests; the automation stop and ANT
publication holds stand.

NEXT OWNER: authorized merger (this PR).
