# 2026-09-27 — Proof lights: badges rendered at build time from a status document a check already produced

Seat: Fable 5.1. Founder go: "land the build-time renderer and one derived badge". Branch `claude-lovis/funny-pascal-bpv6vu-badges` from main 7d6808d8.

## The rule

A badge is a projection of machine-verifiable state, not a typed claim. Four laws, each enforced by a file in this commit:

1. **Derived, not typed.** Every value in the SVG comes from `docs/status/<name>.json`, and every value there is derived by `e2e/render-badges.mjs` from one instrument's `--json` output. The derivation is code in the renderer, per badge; nothing is hand-written.
2. **Bound to a revision.** The message carries the short SHA the measurement was taken at. A badge is a measurement at a revision, never a permanent property of the repository, and it never renders as a bare tick.
3. **Rendered at build time, never fetched at view time.** Shields' own renderer, the `badge-maker` package (5.0.2, the code behind img.shields.io), runs offline and writes a static SVG next to the status document. Surfaces and the README load it same-origin, so the estate's rider law holds (`e2e/design-acceptance.mjs` I1: a cross-origin load at page-open is a FAIL), and a page that says TELEMETRY NONE does not phone a badge CDN to say so. The README's existing license badge is the one Shields URL left in the tree; GitHub proxies README images through its own host, so no viewer request reaches Shields from there either.
4. **Checked in CI, evidence in git.** The chain is repo revision → instrument output (`<name>.source.json`) → status document → SVG, every link a file in the tree, the output bound by git blob id and the SVG by byte-equality with `render(json)`.

    `node e2e/render-badges.mjs --check` re-renders every status document and fails if the committed SVG differs, and fails closed if there are no documents to check. It runs in the meter job, directly after the skaists meter step (`.github/workflows/tests.yml`, "Proof lights — every badge is exactly what its status document renders", `if: always()`; `scripts/lint-ci-shape.mjs` 91/91).

Not signed yet: the status document carries a `signature` slot that stays null until the founder's key signs the canonical bytes. Unsigned is stated in the document and printed by the check, never implied away.

## The first badge — the skaists standards meter

Source: `e2e/skaists-conformance.mjs` over the CI page list (the exact `--only` list of the "Skaists — the standards meter" step), run here in four shards at 390×844, three registers per page. Merged output: 321 rows over 107 surfaces. Result at main `7d6808d87c6b78343e2471aa38581146f5aa6c03`:

| measure | value |
|---|---|
| fronts measured (page × register) | 321 over 107 surfaces |
| fronts at 100% | 321 |
| minimum per kind (COLOUR, TYPE, RADIUS, TARGET, CONTRAST, CASE) | 100 each |
| badge | `skaists meter \| 321/321 fronts 100% @7d6808d` |

Files: `docs/status/skaists-meter.source.json` (the 321-row instrument output, byte-exact; its git blob id `d9b3b654109cfb8e69b6b42893cccca90f8f4e23` is the document's `source_blob`, and the check verifies that equality), `docs/status/skaists-meter.json` (the document: instrument, CI step, revision, counts, the git blob id of the instrument output as parsed, renderer version, signature slot) and `docs/status/skaists-meter.svg` (1216 bytes, `render(json)` byte-for-byte). The README carries it beside the license badge, linked to the document.

## What it is not

- Not a live endpoint. No self-hosted Shields exists and none is needed until something wants a live value; if that day comes, the dynamic and endpoint fetchers stay off and it serves only signed documents.
- Not a claim badge. SELF-CUSTODY, TELEMETRY, KEYS and the rest get a badge only when a gate proves the value; the standards audit's cross-origin count is the honest TELEMETRY source once that instrument (PR #246) is on main.
- Not a trend. The next measurement at the next revision replaces this document; the old value lives in git history at its revision.

## Next

- Second badge after #246 merges: `registers | 48/49 pass @<sha>` from `register-divergence.mjs --json`, same law.
- Founder signature over the document's canonical bytes; the check then verifies the signature too.
- Per-register voice: badge text is the cypherpunk reading. On a new-bee front the same fact becomes a sentence, or the trust layer itself breaks the three-readings ruling.
