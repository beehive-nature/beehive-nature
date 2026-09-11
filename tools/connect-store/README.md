# Replaceable channel gateway experiment

Status: local protocol prototype with a reproduced process-loss recovery proof.
It is **not deployed**, and it is **not a complete Buzz relay replacement**.
Public x0x delivery, Autonomi upload/retrieval, independent operators, writer
handover, and the installed Buzz apps have not passed this experiment yet.

```sh
cd tools/connect-store
npm ci --ignore-scripts
npm test
npm run prove
```

The proof creates new synthetic identities, two real WebSocket clients, and a
loopback gateway in its own Node process. Both clients authenticate with NIP-42;
one receives the other's signed message live. They record a root, its reply, and
a 300 KiB file. The client retains a checkpoint pin. The proof copies only opaque
stored objects, kills the first process, makes its store path unavailable, and
starts a fresh read-only gateway from the copy, owner-pinned policy, channel key,
and client-held pin. Original event fields/signatures and exact file bytes must
match. An outsider must receive 403 for both history and file access.

No founder keys, real community messages, wallet, public mesh node, or external
message send is involved. Temporary proof files are removed from its own generated
directory; an exceptional process failure can leave only synthetic artifacts.

## What is authoritative

| Input | Authority / purpose |
|---|---|
| Owner public key and exact policy event ID | Supplied outside the gateway; neither DNS nor storage may choose them |
| Signed policy event | Experimental kind 30078 with domain tag; one channel, canonical origin, explicit member keys, one writer, expiry |
| Original kind-9 Nostr events | Verified again at publish and recovery; original authors and thread tags are retained |
| Checkpoint pin | Exact checkpoint event ID, sequence, policy ID and storage reference retained by the client |
| Channel encryption key | Held outside the failed gateway; provided only to authorized replacement gateways |
| Local query index and socket subscriptions | Disposable state rebuilt from the verified snapshot |

`Channel.restore` in `core.mjs` verifies the supplied checkpoint pin, authorized
writer signature, policy binding, referenced object hashes/sizes, AES-GCM tag,
snapshot structure, every original event signature and channel membership, file
digests, counts and bounds **before** exposing any restored state. Failure leaves
the prior visible state intact. An incremental follower rejects missing
predecessors, rollback, competing tips and history removal. A cold restore needs
the exact externally retained pin; the provider cannot nominate its own latest tip.

There is no claim of freshness when every client loses its pin. There is no
consensus or fork resolution, nor a claim that a malicious authorized writer
cannot equivocate. Those require witness/discovery and handover work.

## Storage, delivery and acknowledgement

Each mutation writes a complete bounded encrypted snapshot and a signed
checkpoint, and reads both back before acknowledging. Checkpoint metadata remains
visible to the storage provider; event/file content is encrypted. The x0x group
also receives checkpoint IDs, policy IDs, sequences and object references/sizes,
revealing write cadence and size changes to that group's participants (and any
additional readers its read policy permits). An encrypted channel's roster must
not be assumed to limit that metadata audience. Encryption uses
Node `createCipheriv('aes-256-gcm')` with a fresh random 96-bit nonce, 256-bit key,
128-bit tag and policy-bound AAD in `core.mjs` `seal` / `unseal`. Signature checking
uses pinned `nostr-tools/pure` `verifyEvent` in `checkedEvent`, with its verification
cache removed at the boundary. This is an experimental construction, not an
independent cryptographic audit or post-quantum application-signature claim.

Gateways can read channel plaintext. This is **not member-to-member end-to-end
encryption against the gateway**. A former gateway/member cannot be made to forget
data or keys it already obtained. Membership changes, key rotation and revocation
need an explicit versioned policy/key handover; v1 has a fixed expiring roster.

`DirectoryStore` is the offline fixture, with file fsync and Unix parent-directory
fsync. Windows creation durability and power-loss persistence are unproven.
Read-back proves availability at that moment, not permanent retention. Failed
writes can leave unreferenced objects; garbage collection is deliberately absent.
Every mutation re-encrypts and stores the entire history and file set: bytes
written per mutation grow with the current snapshot, and cumulative writes can
grow quadratically with a growing history. Fresh encryption also prevents relying
on content-address deduplication across snapshots. Paid Autonomi storage would
charge for this amplification, checkpoint storage, chunk/payment overhead and
any admitted retry, not merely the new message's bytes. Payment admission must
budget that complete cost before a canary; this prototype does not implement an
incremental archive or claim an economical per-message price.
Duplicate events are acknowledged without adding another event or notification.
Only the existing writer can publish. A restored gateway has no writer key in the
proof and refuses new writes, avoiding accidental concurrent writers.

`stored: true` means the store acknowledged and read-back matched.
`notification_accepted: true` means only the notification adapter accepted the
notice; it does **not** mean a remote peer received it. Notification failure does
not erase a valid storage acknowledgement. Live WebSocket delivery is independently
observed in the tests. The x0x adapter transmits only checkpoint references and
refuses extra fields; it never carries message plaintext, owner keys or the channel
key. An x0x notice is a hint, not authorization: `Channel.follow` verifies storage
and signatures before exposing its events.

## Compatibility surface and bounds

`server.mjs` exposes a deliberately small subset of Buzz's wire protocol:

- NIP-42 challenge authentication; `EVENT`, `REQ`, `CLOSE`, `OK`, `EVENT`, `EOSE`.
- NIP-98 authenticated `POST /events`, `POST /query`; signed URL is the configured
  canonical origin, independent of the loopback connection address.
- Exact-channel kind-9 queries with kinds, full IDs/authors, since, until, limit.
  Unsupported filters and event kinds are refused, not silently ignored.
- Experimental NIP-98 `PUT /media/upload` and authenticated file GET. GET also
  accepts the scoped Blossom token shape used by Buzz; APK launching is unrelated.
- An authenticated query response carries `x-bnr-checkpoint`; existing Buzz clients
  do not yet persist that header, so client recovery-pin support still needs work.

`X0xCheckpointReceiver` is the first receive-side seam for a replacement gateway.
It opens the pinned x0x `/ws` protocol with a bearer token in the HTTP header,
subscribes to exactly `x0x.groups.public.<group_id>`, accepts only the documented
JSON `message` frame and base64 payload, and extracts the announcement body's
opaque checkpoint hint. The hint is passed directly to `Channel.follow`; the
receiver never treats an x0x delivery acknowledgement as storage or recovery
evidence. Socket frames, payload bytes, and message count are bounded, and a
malformed or out-of-order frame fails closed. The caller tests use a real
WebSocket server fixture matching the pinned x0x 0.41.3 frame shape, including
the optional `origin` field.

This does not implement Buzz onboarding, channel metadata/membership events,
moderation, search, presence, huddle, workflows, agent execution or full Blossom
upload semantics. The installed apps cannot yet use it as a complete workspace.
No historical event can run code: kind 9 is the only admitted user event.

Hard prototype bounds are 128 events, 16 KiB/event, 8 files, 1 MiB/file, 12 MiB
snapshot, 16 members, 32 MiB attempted writes per gateway process, 8 concurrent HTTP
requests, 8 WebSockets and 4 subscriptions/socket. Slow socket queues close at
128 KiB of pending output: one pre-enqueue guard counts UTF-8 bytes plus framing
for initial REQ history, live notifications, authentication and other replies.
Overflow closes with `consumer-lag`, without an EOSE for an incomplete burst;
the fixed close control frame is additional. This bounds the application's
pending socket queue, not bytes already accepted into operating-system buffers.
Only loopback listeners are available. The process-loss
proof's child lifetime is 60 seconds. Adapter calls, bytes and body-read deadlines
are bounded with no redirects, retry loops or implicit daemon startup.

These are application/process limits, not a persistent b-meter spend ledger or a
household bandwidth cap. Repeated process restarts can reset process budgets.
NIP-98 replay tracking is bounded and process-local, not distributed/persistent;
membership and policy expiry are checked before replay-cache inspection/insertion,
so rejected outsiders cannot consume its 1024 slots. Authorized members still
share that capacity; per-member fair admission is not implemented.
Idempotent event and file identities provide separate duplicate protection here.

## Network seams and next acceptance boundary

- `X0xNotifications` implements the 0.41.3 SignedPublic group send contract;
  production method is exercised against a capturing HTTP server. Receiving a
  notice on another x0x participant and driving `follow` is covered locally by
  `X0xCheckpointReceiver`; public participant delivery is still unproven.
- `AutonomiReadStore` implements antd 0.12.0 public data retrieval and independent
  hash verification. Tests exercise its actual HTTP caller. **Writes fail before
  any request**: auto-paying uploads do not accept an atomic operator cost ceiling.
  A quote is only an estimate; a capped payment/admission adapter must precede
  funded uploads. No funds were spent and no network objects uploaded.
- Autonomi is the proposed bulk snapshot/file substrate in this experiment.
  Existing estate identity anchoring and the Arweave/Autonomi routing law are
  unchanged; these experimental policy events are not a new canonical DID system.

The next network canary must bound payment at the signing/admission boundary,
store synthetic encrypted objects, have a different x0x participant receive the
checkpoint, recover through a different provider, and retain the same refusals.
Two directories or two processes on one laptop are not independent providers.
Public mesh traffic stays off the shared apartment laptop network, per
[`LAPTOP-NETWORK.md`](../../ops/x0x/LAPTOP-NETWORK.md). Existing relay traffic and
user data remain on their current paths until compatibility and recovery pass.

Source contracts consulted:

- Buzz local pin `579103f7`: `crates/buzz-relay/src/api/bridge.rs`
  `query_events` / `submit_event_authed` and `verify_bridge_auth_with_options`;
  `ARCHITECTURE.md` HTTP bridge and event model.
- [x0x 0.41.3 API reference](https://github.com/saorsa-labs/x0x/blob/v0.41.3/docs/api-reference.md),
  Phase E group send and its distinction from MLS groups.
- [antd 0.12.0 REST client](https://github.com/WithAutonomi/ant-sdk/blob/v0.12.0/antd-js/src/rest-client.ts),
  `dataGetPublic`, `dataPutPublic`, `dataCost` and `prepareDataUpload`.
