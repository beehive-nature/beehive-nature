# Connect + Store: bounded x0x receive-to-follow seam

Authorized by the founder's direction to proceed with the Buzz-compatible
Store + Connect backend. Base: integrated local prototype `7302cabf` from
`codex/connect-store-integration-2026-09-10`. Worktree:
`wt-zcode-connect-store-receiver`; the accepted build and integration worktrees,
the shared checkout, production relay, wallet and app profiles were untouched.

## Implemented

`tools/connect-store/adapters.mjs` now contains `X0xCheckpointReceiver`. It is
the bounded receive-side counterpart to `X0xNotifications`:

1. Opens the pinned x0x `/ws` protocol with a bearer token in the HTTP
   `Authorization` header. Tokens are never placed in the WebSocket URL.
2. Subscribes to exactly `x0x.groups.public.<group_id>` and requires the
   documented `connected` then `subscribed` control frames.
3. Accepts only a text `message` frame for that exact topic. The optional
   `origin` field is allowed, as in x0x 0.41.3; unknown frame fields, binary
   frames, malformed JSON/base64, wrong topics and budget overruns refuse.
4. Parses the pinned x0x `GroupPublicMessage` JSON shape and extracts only its
   announcement body as an opaque `bnr-channel-checkpoint-v1` hint.
5. Calls `Channel.follow` before returning. The channel re-fetches the
   checkpoint and encrypted snapshot, verifies hashes/signatures/policy,
   decrypts and validates all history and files, and changes visible state only
   after those checks succeed. A bad hint leaves the reader's previous state
   untouched.

The receive budget is bounded to 64 KiB checkpoint payloads, four times that
for a complete x0x text frame, 256 frames per call, and a 1–30 second deadline.
The receiver closes its socket after the first accepted checkpoint or any
failure. It does not claim remote delivery, provider independence, or Buzz app
compatibility.

## Caller verification

The new tests use a real `ws` WebSocket server rather than a fake sender. The
fixture speaks the pinned x0x 0.41.3 JSON protocol, records the bearer header
and subscription command, emits a base64-encoded `GroupPublicMessage`, and
supports the optional `origin` omission documented by x0x. One test follows a
real checkpoint into a read-only `Channel` and recovers the signed event. A
second sends a structurally valid but hash-invalid hint; `Channel.follow`
rejects it with `object-integrity` and the reader remains at a null pin with no
visible events.

Windows Node 24.18.0 verification: `npm ci --ignore-scripts` reports zero
vulnerabilities; **29/29 tests pass**; the pre-existing process-loss proof
remains unchanged. No network x0x participant, Autonomi upload, paid request,
or public mesh traffic was used.

## Acceptance boundary

This closes the local receive caller gap identified by the integration receipt.
It does not clear the network-canary gates: capped Autonomi payment admission,
a second x0x participant actually receiving and following a checkpoint, a
genuinely separate recovery provider, client-held recovery pins, writer
fencing, and policy/key rotation. Paid Autonomi writes remain disabled. The
next implementation slice is the payment/admission boundary in isolated
synthetic state, followed by a separate-provider canary only after review.

Source contract: x0x v0.41.3 API reference, `/ws` `subscribe` and `message`
frames, and `x0x.groups.public.<group_id>` topic convention.

## CI range receipt

The review branch was amended once before this receipt, so the first hosted
push supplied a prior tip that the workflow's shallow checkout could not
resolve. The §7 job therefore failed closed on range computation, while the
source and test jobs passed. This note is the ordinary descendant pushed after
that observation; the next push range begins at the visible parent and is
recheckable without force-updating the branch.
