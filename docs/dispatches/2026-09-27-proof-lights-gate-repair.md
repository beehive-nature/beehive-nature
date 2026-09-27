# 2026-09-27 — Proof lights: the gate re-derives the badge from its evidence

Seat: Claude Code. Founder review of #250 at `4ad06132`: keep the offline renderer, repair the verification gate, add dedicated CI signing afterward. "A signature can authenticate an attestation; it cannot make an unchecked derivation correct." Branch `claude/proof-lights-gate-repair`, stacked on #250's head.

## The finding

The founder ran an exact, byte-matched copy of `e2e/render-badges.mjs` against five forgeries, with a deterministic stub in place of the SVG library. Each forgery passed the old gate (`--check` exited 0):

| Forgery | Old gate |
|---|---|
| Meter evidence file deleted | PASS, printed beside "no source file committed" |
| Document counts and message set to 999/999, SVG re-rendered to match, evidence untouched | PASS |
| Revision replaced by forty zeros | PASS |
| A bogus signature object with an unknown algorithm | PASS, and the "unsigned" notice was suppressed |
| Evidence replaced by non-JSON text, blob id updated to match | PASS |

The code explains all five:
- a failed evidence read was swallowed;
- check mode never called the derivation;
- the revision was checked only against a regular expression;
- the signature slot was tested for presence, not verified.

A source-hash mismatch did exit nonzero, but its per-badge line still printed PASS.

## The repair

`e2e/render-badges.mjs --check` runs nine steps per document. It collects every failure, and prints PASS only when there are none.

1. **Schema.** The document must have exactly the `proof-lights/status/2` fields, and its name must match a known derivation.
2. **Revision.** A full SHA that is a commit object in this repository. The check fetches it at depth 1 when the clone is shallow.
3. **Manifest.** The meter's `--only` page list, read from `.github/workflows/tests.yml` *at the measured revision*, never from today's tree.
4. **Evidence.**
   - The file must exist; a missing file fails.
   - Its git blob id must equal `source_blob`, which serves as the repository locator.
   - Its sha3-256 must equal `source_digest`, which serves as the integrity commitment. NIST advises against using SHA-1 for security purposes.
   - It must parse, and every row must pass the schema: six kinds, each 0..100; `total` between the extremes of its kinds; no findings exactly when the row is at 100.
5. **Coverage.** Rows must cover manifest pages × {bee, raver, cypherpunk} exactly once each. A duplicated row cannot stand in for a missing one.
6. **Derivation.** Every derived field (counts, minima, message, colour) is recomputed from the evidence and compared with the document.
7. **Provenance.** `origin: local` must carry null run fields; it states that the revision is the measurer's assertion. `origin: ci` fails until something binds the run id and attempt to the revision.
8. **Signature.** The unsigned representation is exactly `null`. Any supplied value fails as UNVERIFIED.
9. **SVG.** The committed SVG must be byte-identical to `render(document)`.

Derive mode runs the same verification before it writes anything.

The digest is public data, and the secret scan blocks unmarked runs of 48 or more hex characters. The digest is therefore written on one line that carries the repository's `PUBLIC-CONSTANT` marker. This is the existing reviewed treatment for public data. It adds no path exemption and leaves the scan fully armed on `docs/status/`.

## Receipts

- `node e2e/render-badges.mjs --check` passes 1/1. The badge re-derives from its 321 evidence rows at `7d6808d`. `skaists-meter.svg` is byte-unchanged; only the document moved to v2, with the same values, the same evidence and the original `measured_at`.
- `node --test e2e/render-badges.test.mjs` passes 13/13: 1 control, 10 forgery probes and 2 retained controls (an SVG-only edit and zero documents).
  - Run against the old gate, with only a `--dir` override added, all 10 forgery probes fail. The probes can therefore catch the gap they name.
  - CI runs them in a new step in the meter job, "Proof lights — the gate refuses every known forgery" (`if: always()`). `scripts/lint-ci-shape.mjs` passes 92/92.
- `sh scripts/secret-scan.sh tree` is clean.

## What it still does not prove

- **A local measurement's revision is asserted, not attested.** If a forger relabels evidence from an older revision as a newer commit, and rewrites the message and SVG to match, the check still passes whenever the page list did not change in between. The check prints "revision asserted by the measurer, not attested" on every PASS. Closing this gap needs origin `ci`, with the run id and attempt bound to the revision, signed by the CI attestation key.
- **Not live status.** The badge is a historical measurement at its revision. A static SVG cannot turn grey on its own; a badge that claims current health needs a freshness evaluator.
- **No signature yet.** Dedicated CI signing is the next card. It uses a CI-attestation key (never a wallet or personal key), and its public key is pinned by reviewed trust configuration. The signing step never runs untrusted PR content with the key available.
