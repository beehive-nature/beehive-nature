# PQ-NET-001: bounded management responses before mesh tuning

Owner: Codex; isolated worktree `404d/wt-pq-net`, branch
`codex/pq-net-bounded-ingress`. Base fetched before edits:
`25258d564cdfb0ef0b5d460a0c8abb4c76f9b673`.

## Current-source reconciliation

Observed 2026-10-14, America/Denver, through GitHub API and fetched refs:

- Main at the base above: all ten listed workflows completed successfully,
  including tests run `38588127217` and Pages run `38588126086`.
- [#409](https://github.com/beehive-nature/beehive-nature/pull/409) is OPEN,
  head `de7c5d18b7448858b94a197faf490d09ae208702`; 58 successful checks,
  seven skips, no failing/pending checks at observation. It is not on main.
  Its release-key appointment and deployment remain explicitly unestablished.
- [#430](https://github.com/beehive-nature/beehive-nature/pull/430) is OPEN,
  head `ada2cb863cec871c57cd28033a84abcfb3b6572c`; 52 successful checks,
  nine skips, two failing static checks. Push run `38634628976` reports
  `FAIL §7 ada2cb863... — author is 'karalis von zutphen
  <loviswater44@gmail.com>', not the founder (seats are committers +
  trailers, never authors)`. Its first PR commit `e246b7954` already has
  that author; this is not a regression caused by this PQ-NET patch.
  The PR's conditional wrapper proof does not establish production
  authorization, constant-time behavior, or whole-system PQ qualification.

Neither unrelated PR is merged or rewritten by this lane. The new patch
depends on current main, not on either open PR.

## David Irvine's current acceptance terms

The old local September 10 handoff has been superseded by the discussion:

- [#622 closing comment](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5906763450):
  remaining slices and per-pair measurements moved BACK to #504 on
  September 30. #622 is closed as a duplicate, not as completed measurement.
- [#504 October 5 triage](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-5995680476):
  first slice is per-kind counters (#1170) and a same-workload
  delivered/published capture. Default changes and envelope collapse have
  separate design prerequisites. #504, #1170, and its dependency #869
  remain OPEN at observation.
- [#1170](https://github.com/saorsa-labs/x0x/issues/1170) asks for per-kind
  verify success/error and CPU time, bus dispatched/dropped, delivered and
  published counters, plus reset provenance (`since_ts`). Driver-side
  observations do not substitute for implementing those upstream counters.
- [#505 field acceptance](https://github.com/saorsa-labs/x0x/issues/505#issuecomment-5688498210):
  explicitly accepted September 15 after OCI ingress fragment-tail-drop
  evidence. The v0.45.0 trial had zero outbound fragments and connected;
  v0.41.3 control emitted 1,179 oversized handshake datagrams. This is
  attributed historical evidence, not a new run of today's build.
- [October 12 W@tch report](https://github.com/saorsa-labs/x0x/issues/504#issuecomment-6117979353):
  142 vs 52 MB/min combined OS-accounted traffic on v0.46.0. This is another
  embedder's evidence, not a measurement on BNR or x0x v0.48.0.

No upstream message, public mesh run, or production configuration change
was made. The existing mesh battery already landed in #412; reuse it.

## Implemented change and exact boundary

`crates/btungsten-meshdep/src/client.rs::NodeClient::request` previously
used unbounded `read_to_end`, with a per-read timeout renewed by incoming
bytes. Its parser silently accepted short Content-Length bodies and used
unchecked chunk-length addition. Those defects can corrupt or exhaust the
observer whose evidence decides whether a transport optimization is safe.

The new `http_response.rs::{read_response,read_bounded,parse_header,dechunk}`:

- Caps encoded response bytes at 8 MiB and headers at 16 KiB; refuses
  advertised oversized Content-Length before reading the body.
- Applies a 30-second monotonic total read deadline; trickled bytes cannot
  renew it. Connect and request-write time remain outside this deadline.
- Rejects truncated/trailing Content-Length, duplicate or conflicting
  framing, unsupported encodings/trailers, malformed chunk boundaries,
  overflowing chunk lengths, and invalid UTF-8 instead of repairing bytes.
- Preserves complete successful bodies and error statuses, including 504.
  The workload's existing UNKNOWN and identical-byte retry laws remain.

This improves bounded observation, not public-mesh bandwidth. Peak process
RSS, SSE buffering, daemon inbound limits, energy, and real peer delivery
are not established by these tests. No new dependency or altered lockfile.
The 8 MiB response cap includes framing; JSON/dechunk/string allocations
add memory, so it is not an 8 MiB process-memory claim.

## Whole-stack scope retained

These are the integration boundaries for subsequent PQ-NET measurements,
not claims that this HTTP-reader patch implements every component:

| Component requested | Current source seam and acceptance boundary |
|---|---|
| Vaulta | `crates/wallet-relay/src/vaulta.rs::{read_identity,build_envelope}` and `crates/bzdid/src/anchor.rs::Anchor::{verify,binds}`. Preserve identity/epoch binding; reading an anchor is not settlement. |
| bRUSTvmWALLET | Retained as the user's wallet/runtime scope. No literal component with that name was located in this checkout. Concrete local seams are `crates/wallet-relay` and the BNROSE execution crates; do not silently equate the label with an independently verified implementation. |
| bSigner | `crates/bsigner/CONTRACT.md` freezes its public contract. Transport optimization cannot sign, replace intent bytes, broaden authority, or treat a send response as final execution. No signing surface changed. |
| x0x | `btungsten-meshdep::{client,workload,ledger,battery}`. This patch changes only management-response collection. Same-workload message identities, timestamps, recipient delivery and OS wire counters remain necessary. |
| ANT / Autonomi | `crates/wallet-relay/src/upload.rs::validate_upload` and `crates/atmirror/src/route.rs::route` distinguish routing from publication. `adapter-autonomi` node telemetry is a derived view. Require durable retrieval/content verification independently of gossip delivery. |
| AR fractal anchors | `crates/adapter-arweave/src/lib.rs::{bundle,bundle_matches,ArweaveClient}` plus the signed DataItem upload path. A bundle root, routing decision, or mock anchor is not a funded live publication. |
| Hive fractal anchors | `surfaces/wallet-adapter-hive.js` and `crates/wallet-relay/src/adapters.rs::HiveAdapter` are current rail seams. This lane establishes no new Hive anchoring or confirmation result. |
| BCH fractal anchors | `crates/bindexer` is a read-only BCH schema/indexer seam; `docs/specs/SPEC-BTUNGSTEN-PQ-1.md` §5 explicitly names BCH as CLASSICAL AT DESTINATION. No new anchor broadcast or end-to-end PQ claim. |

Fractal relay redundancy is separately described as SPEC'd, not built, in
`docs/specs/SPEC-BUZZ-MULTIRELAY-1.md` §fractal. Preserve those distinctions:
PQ intent authorization, network delivery, durable storage, anchor
confirmation and external-chain security are separate evidence boundaries.

## Verification receipts

- Original main parser extracted verbatim into a standalone Rust test
  harness: both regression checks FAILED as intended. Truncated JSON:
  `assertion failed: parse_response(...).is_err()`. Oversized chunk:
  `attempt to add with overflow`, then the no-panic assertion failed.
  Result: `0 passed; 2 failed`, exit 1. These are defect reproductions.
- Repaired crate: `cargo test -p btungsten-meshdep --locked`:
  **26 passed, 0 failed, 0 ignored**. Includes exact header/response cap
  boundaries, fragmented and chunked valid responses, malicious framing,
  actual loopback NodeClient success/refusal, and a continuously writing
  peer that cannot renew the read deadline. No public mesh used.
- Formatting checked with `cargo fmt -p btungsten-meshdep --check`.
- Hooks: installer REFUSED the existing managed `.githooks/pre-commit`.
  Inspected it: it invokes secret scan and staged identity checks; its
  commit-msg companion checks the attribution trailer. Left it intact.
  `e2e/hooks-installed.test.sh` passed its absent/block/marker/clean controls.
- All-target Clippy initially found two new fixture reads that ignored byte
  counts; fixed by consuming complete request headers with `read_exact`.
  Standard Clippy remains blocked by inherited `while_immutable_condition`
  in the SSE reader. A diagnostic run allowing only that lint then exposed
  inherited `min_max` at `bin/btmd.rs:204` (`3.max(o.scale.min(3))`). Neither
  error is described as a green Clippy result or hidden in source allowances.

The existing CI workspace test gate discovers these tests automatically.
Hosted CI and merge receipts will identify the exact candidate independently
of these local results.

## Next measurement boundary

Bound the separate SSE collector without silent observation loss, then use
the existing rig for matched workload/cost runs and current upstream per-kind
instrumentation. Public-mesh tuning still requires a separately attributed
host/build capture with delivery and recovery evidence. No lower bandwidth
number is earned by dropping revocation, authority, or anchor observations.
