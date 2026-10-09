# bDroP — the drop desk ships: a polished MVP surface that informs, never gates

**Date:** 2026-10-09 · **Seat:** zCode (GLM), the bDroP lane
**Order (founder, verbatim):** "i am only going to use a polished MVP surface UI
for that.. never gate me"

The bDroP 0001 publication route is now a surface the founder drives himself:
[the drop desk](../../surfaces/bdrop.html) (`surfaces/bdrop.html`, live at
skaists.dev/surfaces/bdrop.html once Pages deploys). One gesture, no agent in
the middle, no approval loops — the desk informs at the point of use and never
gates, which is the informed-consent operating rule with the polarity the
founder named: disclosure rides the run interface, and the reader's single
click is the consent.

## What the desk does

- **the drop**: paste the body or load the edition's `.md` file (file bytes
  hashed verbatim, paste hashed as UTF-8). The computed SHA-256 stands beside
  the reported expected digest — prefilled with the bDroP 0001 genesis body's
  reported `9fa6998d…5e9` (PUBLIC-CONSTANT in-source) — with a MATCH / DIFFERS
  verdict that **informs and never locks**: a mismatch is shown, the publish
  call stays the reader's.
- **the disclosure, at the point of use**: what the operation does, what data
  it uses and reveals and to whom, what the evidence establishes, what remains
  uncertain, cost and limits, reversibility — plus both approved RB01
  paragraphs verbatim, and the line that acceptance never converts UNVERIFIED
  into PROVEN. Item 6's security consequences stay UNVERIFIED.
- **sign & broadcast**: the posting-key WIF signs in-tab, is wiped the moment
  the signature exists, is never stored, logged or sent — only the signed
  transaction travels, to the RPC endpoint named on the page (default
  `api.hive.blog`). One primary button. The wire (operation, signed
  transaction) stands open in the cypherpunk register.
- **the receipt**: block lookup by permlink, published-body byte-compare
  against the signed bytes (both digests ride the receipt), a 40-hex
  transaction id computed client-side over the serialized bytes, and a JSON
  download carrying the disclosure version. Retry honesty: a lookup timeout is
  named a timeout, never a failure-or-success claim; after a landing, a retry
  edits the post — the eternal law (editions fork, never silent-mutate).

## The three wires, receipted

1. **Offline fixture proof — 17/17, nothing touched Hive.** A real browser
   against a mock JSON-RPC that echoes the broadcast body: register shell
   boots; live hash equals node's own digest of the same bytes; verdict MATCH;
   op shape correct (author `loviswater`, the genesis permlink, byte-identical
   body, `parent_permlink` from tags, disclosure version in `json_metadata`);
   receipt LANDED with byte-compare MATCH; the key field wiped after the
   gesture; zero page errors. (Worktree `scripts/tmp/bdrop-offline-test.mjs` +
   screenshot, held uncommitted per the tmp convention.)
2. **Live assert-rejection probe.** A comment under the real author signed by
   a throwaway key cannot pass authority — and `api.hive.blog` answered
   exactly that: `missing required posting authority … Missing Posting
   Authority loviswater`, having parsed hive-tx's 130-hex signature form and
   validated the transaction under both hf26 and legacy serialization first.
   The wire form is accepted, proven by live rejection. No publication was
   attempted or claimed.
3. **secret-scan selftest 4/4** after this lane's one file-scoped hex-path
   exemption (below) — the blocker still blocks.

## Honest disclosures in the same breath

- `hive-tx@6.1.0` vendored verbatim (MIT; noble MIT; bytebuffer Apache-2.0;
   license file beside it; BUILD-NOTES provenance with sha256
   `593e2348…1255`). Its dist has an init bug — a healthcheck calls `.unref()`
   on browser timer ids — worked around in-page with guarded no-op shims
   installed before the vendor tag; the vendor file stays verbatim.
- `scripts/secret-scan.sh` gained ONE file-scoped hex-path exemption for the
   vendored one-line bundle, on the wb002-specimen verbatim-preservation
   basis: its six 48+-hex runs are the Hive mainnet chain id and secp256k1's
   public P, N and generator coordinates, verified by inspection. The hex
   pattern stays armed everywhere else, including every other vendor file.
- The desk's runtime key handling: memory-only, wiped after the gesture and on
   tab unload, never persisted, never logged, never printed.

## Registration ritual — one commit `6119d104a`

The file, its root `estate.json` row (family `bnr`, 111 counted),
`build-atlas` output (hub regenerated, state-root `56b02318`),
`surfaces/review.html` SURFACES entry. Local gates green post-commit:
estate-source 11/11 (the hub byte-check — note the gate restores HEAD's hub
when it differs, so the atlas output must be committed, re-built, amended;
done), estate-check PASS, footer-audit PASS with zero bdrop findings.

## What remains

- The founder's single gesture, whenever he chooses: open the desk, paste or
   load the genesis body (the inbox/packet route stands unchanged but is no
   longer required — the desk builds the operation itself), read the verdict,
   key in, one click. The receipt JSON lands in-tree as the publication rider.
- Pages deploy of the new surface (post-push, estate queue).
- No Hive broadcast has occurred; the publication receipt remains empty until
   the founder's gesture. UNVERIFIED stays UNVERIFIED.

**Public code. Public evidence. Explicit uncertainty. Execution within informed consent — and never a gate.**
