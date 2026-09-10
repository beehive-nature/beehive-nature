# Isolated channel: retain signed history through gateway loss

Authorized by the founder's direction to keep the Buzz experience while making
the community independent of a particular relay server. Base: `182a51dc` from
`origin/main`. Worktree: `wt-astra-connect-store`, branch
`codex/connect-store-channel`. Shared and other seats' worktrees were not edited.

## Implemented and locally reproduced

[`tools/connect-store`](../../tools/connect-store/README.md) now contains a
loopback protocol prototype, owner-pinned policy, signed checkpoints, bounded
encrypted snapshots, verified restoration, opaque x0x notification adapter and
Autonomi read adapter. All keys in the proof are generated synthetic identities;
the founder's keyring and existing Buzz memberships were not accessed.

Two real WebSocket clients authenticated and exchanged a root/reply. A 300 KiB
file was stored and hash-verified. The proof copied only stored objects, killed
the gateway process, made the first store unavailable, and restored the exact
events/signatures and file through a fresh read-only gateway. Both outsider
history and file requests returned 403. The second copy is on the same laptop;
this is process-loss recovery, not independent-provider survival.

The test suite exercises actual HTTP/WebSocket and adapter callers, not only
resolvers. It covers authentication URL/payload/challenge boundaries, duplicate
events, expired/unauthorized access, malformed storage replies, missing/corrupt
objects, wrong owner/key/writer, stale/forked/skipped checkpoints, failed storage
and read-back, notification failure, resource bounds, redirects, body deadlines,
and concurrent mutation refusal. Exact current results live in the receipt and
CI; `npm test` and `npm run prove` reproduce them.

Local results: **23/23 tests and the process-loss proof pass on Windows Node
24.18.0 and WSL Linux Node 22.22.1**. Dependency audit reports zero known
vulnerabilities. CI shape check passes 40/40 steps. Removing signature
verification made its regression fail; removing the membership check made the
actual wire recovery test return 200 where it required 403. Both deliberate
mutations were restored byte-for-byte before the final green runs.

The machine-readable local proof is
[`connect-store-local-2026-09-10.json`](../receipts/connect-store-local-2026-09-10.json).
Its false flags deliberately name the unproven network/provider/app work.

## Runtime observation and limits

A read-only VPS health check during this lane observed x0x **0.41.3**, healthy,
28 send-ready peers, and antd **0.12.0**, status `ok`. This establishes daemon
reachability only. No service, ACL, firewall, database, production route, node
version or application profile was changed. No live group send or paid upload
was performed, and no local public P2P daemon was started.

The Autonomi write seam deliberately refuses before a request. The existing
auto-paying REST endpoint has no operator-supplied atomic spend ceiling; a quote
does not provide one. Capped payment admission, actual network object retrieval,
a second participant's x0x receive path, and independent-provider failover are
still required. This lane adds no settlement authority or b-meter billing claim.

Gateway plaintext trust, static expiring membership, retained recovery pins,
process-local replay/budget state, and lack of writer handover are explicit in
the README. Original Buzz apps have not been tested against this subset; full
channel metadata/onboarding/search/huddle/workflow support is absent. Existing
crash/channel/mobile attachment work is separate and is not claimed resolved
by this prototype.

## Next review / network acceptance

Review the exact branch pin against the README, break the restore/authentication
boundaries, and preserve repros. Then implement capped Autonomi payment admission
and an x0x receiver using isolated synthetic state. A fresh deployment must repeat
the same checks with a genuinely separate recovery provider before production
traffic moves. Writer fencing, policy/key rotation and client-held recovery-pin
support must pass before replacement gateways accept writes.

## Review corrections: F1–F4

zCode independently reviewed `d85747cf` and accepted the local prototype scope,
with two bound-enforcement fixes and two documentation corrections required
before a network canary. The review is on main at `0e4d6c44`:
[review dispatch](https://github.com/beehive-nature/beehive-nature/blob/0e4d6c44/docs/dispatches/2026-09-10-connect-store-review-zcode.md).
Corrections stay in the original build worktree and branch; no deployment or
payment was performed.

- **F1:** `server.mjs` now has one `sendFrame` path for initial REQ history,
  post-commit notifications, AUTH/OK/EOSE and NOTICE replies. It checks queued
  bytes **plus the next UTF-8 frame and framing allowance before enqueueing**.
  Overflow closes with 1008 `consumer-lag`; no EOSE is sent for an incomplete
  burst, and closing sockets admit no further frames. The close control frame
  has its own small protocol bound. The old live path could also overshoot by
  one frame because it checked only bytes already queued; the common path fixes
  that too.
- **F2:** validated HTTP identities must pass membership and policy expiry
  before replay-cache lookup, capacity enforcement or insertion. Outsiders
  cannot consume its slots. The map still protects member requests from replay;
  it remains process-local/shared by admitted members as previously scoped.
- **F3:** the README now names x0x group participants and other readers allowed
  by its policy as checkpoint-metadata recipients. Sequence, cadence, policy
  identifiers and sizes may reveal activity even when channel content is sealed.
- **F4:** the README now names complete-snapshot rewrite amplification, growing
  per-mutation cost and potentially quadratic cumulative bytes. Fresh encryption
  defeats reliance on cross-snapshot content deduplication. Payment admission
  must cover complete snapshots, checkpoints, chunk/payment overhead and any
  admitted retries. Incremental archival and paid writes remain unimplemented.

Three actual caller regressions were written before the correction. Against
the old source they failed with: `gateway did not close the stalled consumer`,
`data queue exceeded its ceiling plus bounded close frame`, and `429 !== 200`.

The F1 tests pause the client TCP reader and cork the real server writable
stream, retaining actual outgoing bytes in `ws.bufferedAmount`. Merely pausing
a reader can leave the entire burst in OS buffers and would not reliably test
an application-queue ceiling. No fake queue value or replacement sender is used.
The initial history case contains forty large mixed ASCII/Unicode events and
a healthy four-event/EOSE control. The second case restores a snapshot into a
subscribed gateway, exercising the live notification caller. Both require
bounded pending/delivered bytes, the actual 1008 close, and no false EOSE.
The mixed-language control also caught an intermediate correction that checked
UTF-8 length for the next frame but still passed queued strings to `ws`: its
underlying writable queue could count those strings in code units. `sendFrame`
now encodes a Buffer and sends it with `binary: false`, preserving Nostr text
frames while making queued and delivered byte counts agree. The regression
checks the text-frame opcode as well as the byte ceiling.

The F2 regression sends 1,024 distinct, correctly signed nonmember HTTP requests;
all are refused 403. A valid member request then receives 200, and reusing that
member's token receives 401 `auth-replay`. The original process-loss receipt's
claims and explicit false flags are unchanged.

Final correction verification: **26/26 tests pass** on Windows Node 24.18.0
and WSL Linux Node 22.22.1; the process-loss proof passes on both with the same
measured fields as the original receipt. `git diff --check` is clean. The same
CI step runs all three new regressions automatically. This is a corrected
candidate for re-review, not a claim of network-canary acceptance.
