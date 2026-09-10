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
