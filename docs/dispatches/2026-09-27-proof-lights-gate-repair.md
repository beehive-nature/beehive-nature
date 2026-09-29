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

1. **Schema.** The document must have exactly the `proof-lights/status/2` fields, and its name must match a known derivation. The fixed fields `renderer` and `law` must equal exactly what derive writes: the installed `badge-maker` version and the fixed statement (added 2026-09-29, Codex review).
2. **Revision.** A full SHA that is a commit object in this repository. The check fetches it at depth 1 when the clone is shallow.
3. **Manifest.** The meter's `--only` page list, read from `.github/workflows/tests.yml` *at the measured revision*, never from today's tree.
4. **Evidence.**
   - The file must exist; a missing file fails.
   - Its git blob id must equal `source_blob`, which serves as the repository locator.
   - Its sha3-256 must equal `source_digest`, which serves as the integrity commitment. It is computed by `sha3()` in `e2e/render-badges.mjs`, which uses Node's `createHash('sha3-256')`. The gate does not rely on the SHA-1 blob id for integrity. The reason is that SHA-1 is deprecated for security use; that is cited from NIST guidance and is UNVERIFIED by this seat.
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

## Codex review of #250 at `ba35019` (2026-09-29)

Codex raised two findings on this PR. Both were correct.

- **P2: the gate accepted forged fixed metadata.** `renderer` and `law` were only required to be present, so a document claiming "live, signed" passed.
  - The gate now compares both fields with the constants derive writes (`RENDERER`, `LAW` in `e2e/render-badges.mjs`).
  - A new probe, "forged fixed metadata fails", covers a forged renderer, a forged law string and a non-string law.
  - `node --test e2e/render-badges.test.mjs` → 14/14. The new probe fails against the previous gate (0 pass, 1 fail) and passes against this one.
  - `render-badges.mjs --check` → 1/1. `lint-ci-shape.mjs` → 92/92.
- **P1: the SHA-1 remark named NIST with no citation.** Step 4 now names the function that computes the digest, `sha3()` via Node's `createHash('sha3-256')`. The SHA-1 deprecation is marked as cited guidance, UNVERIFIED by this seat.

## Codex review of #250 at `802b973` (2026-09-29)

Three P2 findings, all correct. A sweep of the file found one more instance of the same kind.

- **Badge lookup followed inherited properties.** A document named `constructor` resolved to a built-in object and crashed the checker. Check mode now uses `Object.hasOwn(BADGES, …)`. The sweep found derive mode's `{ meter: … }[mode]` had the same flaw, and it now compares the mode string instead.
- **`measured_at` accepted `Date.parse` leniency.** `0` was accepted, and `2026-02-31` rolled into March. The gate now requires a canonical ISO-8601 UTC string that round-trips unchanged. Derive mode inherits this, because it verifies before it writes: `--measured-at 2026-02-31T00:00:00.000Z` is refused and nothing is written.
- **The probes' PASS assertion was global.** It would have failed every forgery probe once a second, legitimate badge existed. It is now scoped to `skaists-meter.json`, and each probe also requires that badge's FAIL line.

Receipts:
- `node --test e2e/render-badges.test.mjs` → 16/16. The two new probes fail against the previous gate (0 pass, 2 fail).
- `render-badges.mjs --check` → 1/1.

## Codex review of #250 at `8303dd7` (2026-09-29)

One P2 finding, which was correct. A shaped but invalid timestamp, `2026-99-01T00:00:00.000Z`, passed the regex, and `toISOString()` then threw, aborting the whole check. This was the second crash finding in a row, so the root cause is fixed as well:
- `canonicalTime` rejects an invalid date before calling `toISOString`.
- The sweep found that a status document of `null` skipped `verify` and crashed on the PASS line. A document that is not a JSON object is now its own FAIL.
- Any unexpected exception inside `verify` becomes that badge's FAIL (`checker error (fails closed)`), and the check moves on to the next document.
- A new probe writes a malformed document beside the real one and requires its FAIL, a PASS for `skaists-meter.json`, and `1/2 badges`.

Receipts:
- `node --test e2e/render-badges.test.mjs` → 17/17. The new probe and the extended timestamp probe fail against the previous gate (0 pass, 2 fail).
- `render-badges.mjs --check` → 1/1.

## Codex review of #250 at `048f98c` (2026-09-29)

Two P2 findings, both correct.
- **An all-clear row could hide a failed kind.** A row with `total: 100` and `bad: []` accepted a kind at 0, because 100 still sits between the kind extremes. With `kind_min` updated to match, the badge still passed. `skaists-conformance.mjs` records every failed check in `bad`, so no findings means every kind is 100; the row law now requires exactly that.
- **A renamed trio passed.** The derivation was chosen by `doc.name`, but the evidence and SVG were located by file name. `other.{json,source.json,svg}` passed and left the README link broken. The JSON file name must now equal `<doc.name>.json`.

Receipts:
- `node --test e2e/render-badges.test.mjs` → 19/19. The two new probes fail against the previous gate (0 pass, 2 fail).
- `render-badges.mjs --check` → 1/1.

## Independent review at `048f98c` (2026-09-29): REQUEST_CHANGES, fixed

A fresh agent that wrote none of this reviewed #250 at `048f98c`. It runs under the authoring session's attribution, so its independence is recorded here as a caveat, not claimed outright.

**Blocking finding: evidence that parses to `null` skipped every derivation check.**
- `rows = JSON.parse('null')` left `rows === null`, so `rowErrors`, coverage and derivation all silently skipped.
- The reviewer resealed `null` evidence with 9999/9999 counts and a re-rendered SVG, and got a PASS.
- **Root fix:**
  - Every parsed value now goes through the row law, `null` included.
  - A PASS now requires that coverage and derivation actually ran. Any path that skips them fails with "not re-derived from its evidence (fails closed)".
  - Because a PASS now implies the derivation compared `fronts`, the PASS line's row count equals the derived count.

**Non-blocking findings taken:**
- An SVG or evidence file with no status document beside it is now a FAIL. Before, a stray `telemetry.svg` went unchecked.
- The header comment no longer says surfaces load the SVG. Today only the README shows it; `docs/dispatches/2026-09-27-proof-lights.md` law 3 is corrected the same way.
- The limits below now state that fabricated evidence for a real revision still passes.

**Receipts:**
- `node --test e2e/render-badges.test.mjs` → 21/21. The two new probes, `null` evidence and an orphan SVG, fail against the previous gate (0 pass, 2 fail).
- `render-badges.mjs --check` → 1/1. `lint-ci-shape.mjs` → 92/92.

## What it still does not prove

- **A local measurement's revision is asserted, not attested.** If a forger relabels evidence from an older revision as a newer commit, and rewrites the message and SVG to match, the check still passes whenever the page list did not change in between. The check prints "revision asserted by the measurer, not attested" on every PASS. Closing this gap needs origin `ci`, with the run id and attempt bound to the revision, signed by the CI attestation key.
- **The evidence content is the measurer's assertion.** Nothing re-measures it. Fully fabricated but well-formed evidence for a real revision, with the document derived from it, passes. The gate proves only that the badge follows from the committed evidence.
- **Not live status.** The badge is a historical measurement at its revision. A static SVG cannot turn grey on its own; a badge that claims current health needs a freshness evaluator.
- **No signature yet.** Dedicated CI signing is the next card. It uses a CI-attestation key (never a wallet or personal key), and its public key is pinned by reviewed trust configuration. The signing step never runs untrusted PR content with the key available.

## The CI-signing card

Recorded 2026-09-29 at the founder's request, so the signing work has a named owner and is not lost between sessions.

- **Owner:** the Claude Code seat in session `session_015NgLKhQoUyK4kxFMpWKbaz` (titled "Badge verification — finish PRs — KEEP"), until the founder reassigns it.
- **State:** not started.
- **Starts when:** #250, with this repair folded in, is on main after independent review. Signing an unrepaired gate would authenticate an unchecked derivation.
- **Needs from the founder:**
  - generating the CI-attestation key pair (`ml-dsa-65`, from the `bsigner` registry);
  - storing the private key in a protected GitHub environment.
  
  The seat never handles private key material.
- **Scope:**
  1. **Canonical bytes.** Define the exact signed byte string for a status document, with the `signature` field excluded.
  2. **Trust configuration.** A reviewed file pins the trusted public key or keys, each with:
     - a versioned key id;
     - a validity period;
     - a revocation list.
     
     The gate never trusts a key carried inside a document.
  3. **Signing job.** Runs only on pushes to main in the protected environment, never on untrusted PR content. It signs documents whose measurement is `origin: ci` and binds the run id and attempt to the revision via the run's `head_sha`.
  4. **Gate.** `--check` verifies the signature, key id, validity and revocation. It moves `origin: ci` from fail-closed to verified, and a supplied signature from UNVERIFIED to checked.
  5. **Negative probes**, in the style of `render-badges.test.mjs`:
     - wrong key;
     - unknown key id;
     - expired key;
     - revoked key;
     - a signature over altered bytes;
     - a CI run whose `head_sha` differs from the document's revision.
  6. **Rotation procedure,** written down: how a key is replaced, how old signatures are treated, and who approves.
- **Done when:** a CI-produced, signed status document passes the gate, and every negative probe fails it.

