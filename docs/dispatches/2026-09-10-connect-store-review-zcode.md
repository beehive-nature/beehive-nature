# zCode negative review: isolated channel recovery prototype (pin d85747cf)

Independent reviewer session (zCode seat). Reviewed exactly
`d85747cf6366612f804478b3ca4ea165ba3902b8` on `codex/connect-store-channel`
in a fresh worktree at the pin (`wt-zcode-cs-review`, removed after review).
The build worktree `wt-astra-connect-store` and the shared checkout were not
touched. Synthetic identities and loopback servers only; no production keys,
real channel content, paid uploads, mesh nodes, deployment, or service changes.

## Reproduction (all re-verified)

- Windows Node 24.18.0: `npm ci --ignore-scripts` → **0 vulnerabilities**;
  `npm test` → **23/23 pass**; `npm run prove` → receipt identical to
  `docs/receipts/connect-store-local-2026-09-10.json` on every measured field
  (2 clients, 2 signed events, 307200 file bytes, 403/403 outsider).
- Linux: CI on the branch push is green (both jobs; the static step runs the
  same three commands on Node 22, `tests.yml:84-90`).
- Builder's deliberate mutations re-run in the review worktree, then restored
  byte-exact (`git checkout -- core.mjs`, tree clean afterwards):
  - M1 — disable `verifyEvent` (`core.mjs:34`) → exactly one regression fails,
    the designed one (`core.test.mjs:59` 'signature verification cannot be
    bypassed'). The forged-checkpoint test still holds for a structural reason:
    `restore` pins the writer pubkey (`core.mjs:214`), independent of signature
    checking.
  - M2 — disable the membership check in `authorize` (`core.mjs:110`) → 4 test
    failures including the actual wire recovery test (`server.test.mjs:9`, the
    outsider 403 becomes 200) and the proof aborts before printing its receipt.

## Claims attacked, not falsified

1. **Provider authority.** Policy is pinned to the external owner key + exact
   event id at construction (`core.mjs:45-48`); checkpoints must carry the
   policy writer's signature and the client's exact id/sequence
   (`core.mjs:213-215`); snapshots are AES-256-GCM sealed with policy-bound AAD
   (`core.mjs:65-78`) and hash-verified on read (`core.mjs:80-86`); every
   restored event is re-verified and member-checked (`core.mjs:228` via
   `#message`); file digests re-hashed (`core.mjs:230-235`); cold restore needs
   the externally retained pin — the provider cannot nominate a tip
   (`core.mjs:206-222`). Probe: a snapshot sealed by a KEY-HOLDING writer
   containing a validly-signed non-member event is refused at restore
   (`unauthorized-author`) with zero partial state exposed.
2. **Authentication.** NIP-98 binds canonical origin + route + method + payload
   hash (`server.mjs:37-38`); replay map rejects reuse; alias/loopback-origin
   tokens 401 (`server.test.mjs:48-49`); bare `x-pubkey` header 401
   (`server.test.mjs:53`); cross-route token reuse 401 (probe). NIP-42 binds
   the per-session random challenge and relay tag (`server.mjs:95-101`);
   pre-auth REQ/EVENT → NOTICE authentication-required (`server.test.mjs:58`);
   10-second auth deadline (`server.mjs:84`). Blossom GET must name the
   canonical origin host — a token naming the actual loopback host is 401
   (probe); an outsider blossom token is 403 on membership (probe + tests).
3. **Restore honesty.** All verification precedes any state mutation
   (`core.mjs:204-244`); corrupt/truncated/missing objects leave the prior
   state intact (`core.test.mjs:83-94`); duplicates, skipped parents, rollback,
   competing tips and history removal all fail with named errors
   (`core.test.mjs:105-116`, `core.mjs:237-240`).
4. **Receipts and execution.** Read-back precedes acknowledgement
   (`core.mjs:87-92`); store/read-back/checkpoint failures preserve the
   previous tip and refuse the receipt (`core.test.mjs:117-127`);
   `notification_accepted` never claims remote receipt (`core.mjs:137-142`,
   `core.test.mjs:128-134`); no eval/exec/spawn exists in any runtime module
   (grep clean; kind 9 is the only admitted user event).
5. **The proof is real.** `prove.mjs` forks a genuine child process, SIGKILLs
   it and awaits exit (`prove.mjs:22,49`), renames the original store away
   (`prove.mjs:50`), and the replacement child restores from the copied object
   directory, owner-pinned config, channel key, and the client-held pin read
   from `x-bnr-checkpoint` (`prove.mjs:44,51`) — with no writer key
   (`prove.mjs:20`), so the replacement is read-only by construction.
6. **Bounds** — hold everywhere I could measure them, with two gaps named as
   findings below (F1, F2). Body caps, socket/frame/subscription limits,
   request concurrency (9th request → 429 with eight held bodies, probe),
   adapter redirect/timeout/byte budgets (`adapters.test.mjs:47-63`) all
   verified against real callers. No secret ever appears in an error or log
   surface (errors are code strings; the adapter bearer token is only set).
7. **Adapter contracts, verified at the pinned sources.** x0x 0.41.3
   `POST /groups/:id/send` with `{body, kind}` (`kind: 'announcement'`
   documented) and success predicate `ok: true` — matches the pinned API
   reference (fetched from the v0.41.3 tag; response also carries `fan_out`,
   which the adapter correctly does NOT treat as delivery). The notice itself
   is `exact()`-checked so no plaintext field can ride (`adapters.mjs:114-119`,
   `adapters.test.mjs:27-28`). Autonomi retrieval matches antd 0.12.0
   `dataGetPublic` exactly (`GET /v1/data/public/:address` → `{data: base64}`,
   rest-client.ts fetched at the v0.12.0 tag) with base64 round-trip, size and
   sha256 validation; `put()` throws before any request with zero network
   calls (`adapters.mjs:98`, `adapters.test.mjs:37`). README, dispatch and
   receipt all state plainly that no live network proof exists.

## Findings (severity-ranked; pinned SHA d85747cf)

**F1 — MEDIUM (contained by loopback-only scope; must fix before any network
canary): the documented 128 KiB slow-consumer close is not enforced on the
initial REQ burst.**
`server.mjs:110` sends the entire query result to a subscriber with no
`bufferedAmount` check; the check exists only in the post-commit notify loop
(`server.mjs:132`). README (`README.md:106-107`) documents "Slow socket queues
close at 128 KiB buffered output."
Repro (probe, pinned tree): publish 40 events of ~15 KiB, open one member
socket, authenticate, pause the underlying TCP socket, send
`["REQ","burst",{"#h":[channel],"limit":40}]`.
Observed: all 40 events (615 KiB) delivered in one burst after resuming; the
socket was never closed while stalled. Required: the documented bound — close
at 128 KiB buffered output. Practical consequence: each stalled-but-member
socket can pin roughly the full serialized history per subscription (up to the
12 MiB snapshot cap across 4 subscriptions, 8 sockets) in gateway memory — a
process-local amplification today, a remote memory-exhaustion vector the
moment the listener is not loopback. Fix: check `bufferedAmount` inside the
REQ send loop (same rule as notify).

**F2 — MEDIUM at canary (LOW today, same-laptop/loopback): non-members consume
the NIP-98 replay capacity before authorization is checked.**
`server.mjs:40-44` inserts into the `seen` map (and enforces its 1024 cap)
before `channel.authorize` runs at `server.mjs:45`. Any local process can
sign well-formed kind-27235 events with a throwaway key; each is correctly
rejected 403 on membership — but only after burning a replay slot.
Repro (probe, pinned tree): send 1024 fresh outsider NIP-98 requests to
`/query`, then a valid member request.
Observed: member receives `429 auth-capacity` (required: 200; the outsider
should not have been able to affect member admission at all). The wedge
self-heals as entries expire (~61 s), so sustained lockout costs the attacker
~17 requests/second. On a loopback prototype this is a nuisance; on a public
HTTPS canary it is an unauthenticated remote denial of the HTTP auth path.
Fix: perform the membership check before `seen.set` so non-members never
consume replay capacity.

**F3 — LOW (documentation): x0x group participants are an unnamed checkpoint
metadata audience.**
The README acknowledges that "checkpoint metadata remains visible to the
storage provider" (`README.md:54-55`), but every publish also sends
`{id, sequence, policy_id, ref{address, sha256, size}}` to the x0x group
(`core.mjs:139`, `adapters.mjs:120`). Group participants — a wider audience
than the storage provider — learn the channel's write cadence, sequence
numbers and snapshot sizes. Practical consequence: activity correlation and
size fingerprinting of a nominally private channel by everyone in the x0x
group. Doc fix now (one sentence); matters when a real group carries the
notices.

**F4 — LOW (documentation/implication): per-mutation cost scales with total
history size, unacknowledged.**
Every commit writes a complete encrypted snapshot of the whole channel
(`core.mjs:123-133`), so each message/file mutation re-stores ~history-sized
bytes. Within the prototype this is bounded (12 MiB snapshot, 32 MiB/process)
and honest (413/429 refusals). When the substrate becomes paid Autonomi
storage, the cost of one message grows linearly with channel history — the
README's canary section prices payment admission but not this O(history)
per-mutation write amplification. Name it before the canary so the spend
ceiling is designed against the real cost curve.

Informational, no action required: `restore` re-verifies signatures and
membership but not the publish-time `created_at` bound (`core.mjs:156` is
publish-only), so a trusted writer could seal future-dated events — cosmetic
within the trusted-writer scope the README already carves out
(`README.md:47-49`).

## Verdict

**Accepted for its stated scope** — a local, loopback, process-loss recovery
prototype behind a Buzz wire subset. All seven falsification targets held
under active attack except the two bound-enforcement gaps (F1, F2), which do
not touch the recovery, authority, signature or encryption invariants and are
contained by the loopback-only listener. The documentation is unusually
honest; F3/F4 are the only unacknowledged implications found.

**Must precede a network canary** (in order): F1 and F2 fixes with regression
tests; the README's own list — capped payment admission at the
signing/admission boundary, a second x0x participant actually receiving and
following a checkpoint, recovery through a genuinely separate provider with
the same refusals, and (per the dispatch) writer fencing and client-held
recovery-pin support before any replacement gateway accepts writes; plus the
F3/F4 doc lines so the canary's spend ceiling is set against the real cost
curve and audience.
