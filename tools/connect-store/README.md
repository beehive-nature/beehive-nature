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
| Channel encryption key | v1: one key held outside the failed gateway, handed out of band only to authorized replacement gateways. With a keyring: numbered epoch keys, each delivered as an owner-signed PQ key grant (see Key distribution) |
| Owner PQ id (`bzpq1…`) | Supplied outside the gateway, like the owner key; the only signer whose key grants are accepted |
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
data or keys it already obtained. Key rotation on a roster change is the PQ re-key
below; changing who the gateway admits still needs a new signed policy, because v1
policies have a fixed expiring roster.

## Key distribution: PQ key grants

The v1 path, one channel key handed out of band, is unchanged. `keygrant.mjs` adds
numbered **epoch keys** carried in SPEC-BPQ-1 sealed objects
([`docs/specs/SPEC-BPQ-1.md`](../../docs/specs/SPEC-BPQ-1.md) §4), reusing
`surfaces/bpq.js`; no new cryptographic library.

- **Grant.** `newEpoch` / `issueGrant` verify every recipient card (`BPQ.verifyCard`),
  then `BPQ.seal` a fresh random 32-byte epoch key with one X-Wing (ML-KEM-768 +
  X25519) slot per card, signed by the owner's ML-DSA-65 key. The encrypted META binds
  type, policy ID, channel, epoch and the recipients' ids; the signature covers it and
  the slot list. The public head names no recipient and the signer record is inside
  the encryption, so a grant is ordinary bytes any store may hold.
- **Open.** `openGrant` returns the key only when the recipient's own keys open a slot,
  the signature verifies under the externally pinned owner PQ id, and the signed binding
  names this policy, channel and recipient. Altered bytes, a slot added by a member who
  unwrapped the key, another signer and another channel are all refused.
- **Re-key.** `rekey(current, { remove })` issues epoch n+1: a fresh random key, never
  derived from the old one, wrapped only to the cards that remain. A gateway adds the
  opened key to its `EpochKeyring`; its next mutation re-encrypts the whole snapshot
  under the newest epoch.
- **Snapshots record their epoch.** A `Channel` given a `keyring` writes checkpoint
  content `version: 2` with `epoch`, and binds the number into the AES-GCM AAD
  (`bnr-channel-snapshot-v2:<policy>:<epoch>`). Given only `key`, it writes v1 exactly
  as before; `key` plus `keyring` reads v1 history and continues at v2. Unknown versions
  are refused, a reader without the recorded epoch key refuses instead of guessing, and
  a follower refuses a successor sealed under an older epoch than it has already seen.

**Revocation is prospective.** A removed member keeps every epoch key they were granted
and can still decrypt every snapshot sealed under those epochs, including copies they
already fetched. Re-keying only stops them reading snapshots written after the gateway
moves to the new epoch.

Not covered: the epoch number is visible to the storage provider in the checkpoint, so
it shows how often the key changed. The grant roster is separate from the policy's Nostr
member list; removing a card does not stop gateway admission. Gateways hold epoch keys
and read plaintext. Grants travel out of band here, with no delivery receipt. Bounds:
32 recipients and 128 KiB per grant. PQ assurance is SPEC-BPQ-1 §6's (two implementations
cross-checked, not independently audited); signatures on events, policies and
checkpoints remain classical secp256k1 Schnorr.

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
  notice on another x0x participant and driving `follow` still needs a receiver.
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
