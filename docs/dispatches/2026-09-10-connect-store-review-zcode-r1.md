# zCode re-review (R1): F1–F4 corrections at f02f0f6e — ACCEPTED

Same reviewer role, bounded follow-up to the independent review at `0e4d6c44`
(`docs/dispatches/2026-09-10-connect-store-review-zcode.md`). Re-reviewed
exactly `f02f0f6e442efbdc1736571952bcb1748121e4a6` on
`codex/connect-store-channel` (one commit over the reviewed pin `d85747cf`)
in a fresh pin-locked worktree; the build worktree and the shared checkout
remain untouched. Synthetic identities and loopback only; no merges,
deployment, paid uploads, or external posting.

## Reproduction

Windows Node 24.18.0: `npm ci --ignore-scripts` → 0 vulnerabilities;
`npm test` → **26/26** (23 prior + 3 new regressions); `npm run prove` →
passes with every measured receipt field unchanged. Branch CI is green on the
fix commit (both jobs), which is the authoritative Linux result.

## F1 — corrected and independently verified

`server.mjs` now has one `sendFrame` boundary (`server.mjs:12-24`) for every
WebSocket application frame — initial REQ history, EOSE, live notifications,
AUTH challenge/reply, publish OK and NOTICE — checking
`bufferedAmount + frame bytes + 10` framing allowance against 128 KiB
**before** enqueueing, closing 1008 `consumer-lag` on overflow. Buffer
payloads make the count actual UTF-8 bytes (`binary: false` preserves Nostr
text frames; the regression asserts the opcode). No raw `ws.send` remains
outside the boundary (grep). `sent` marks advance only after an admitted
send, and EOSE is unreachable after an incomplete burst.

Independent probes (my own scripts, real server sockets, client reader paused
plus server stream corked — the same real-queue forcing the regressions use,
no fake counters):

- Stalled initial burst of 40 mixed ASCII/Unicode events: 8/40 delivered,
  119,360 bytes queued (≤ 128 KiB + close frame), close 1008
  `consumer-lag`, **zero EOSE**. A healthy 3-event REQ/EOSE control passes
  first on the same socket.
- Cross-path evasion attempt — four individually-small subscriptions
  accumulated on one stalled socket: the per-socket guard tripped
  cumulatively (123,342 bytes queued, closed 1008); only the subscription
  that actually completed received EOSE; none of the incomplete ones did.
- Live-notify caller on a writable gateway (12 HTTP publishes while the
  subscriber stalls): bounded at 123,384 bytes, closed 1008.

The builder also fixed a one-frame overshoot in the old notify path (it
checked only already-queued bytes) and an intermediate UTF-8 undercount
(string code units vs bytes) their own mixed-language regression caught —
both consistent with what the final code shows.

## F2 — corrected and independently verified

`server.mjs:52-61` now runs `channel.authorize` (membership + policy expiry)
before replay-cache inspection, capacity enforcement or insertion, and the
replay block is skipped for reusable Blossom GETs. Probe: 1024 correctly
signed outsider requests each refused 403; a member request then succeeds
(200), and replaying that member's own token still fails 401 `auth-replay`.
The map remains process-local and shared by admitted members — no fair
admission is claimed, matching the corrected README wording.

## F3/F4 — documentation corrected

The README now names the x0x group (and any additional readers its read
policy permits) as a checkpoint-metadata audience, and spells out the
full-snapshot rewrite amplification: per-mutation bytes grow with the
snapshot, cumulative writes can grow quadratically, fresh nonces defeat
cross-snapshot dedup, and payment admission must budget the complete cost.
Paid writes remain disabled; no live canary is claimed anywhere.

## New issues introduced by the correction

None found. The authorize/replay reordering only changes an outsider's
replayed-token answer from 401 to 403 (membership dominates; no state is
consumed either way). The notify loop's readyState break and the after-send
`sent` marking behave correctly under my probes, and all 23 prior tests pass
unmodified.

## Verdict

**F1–F4 accepted; the corrected candidate `f02f0f6e` is accepted for the
review's stated local scope.** All network-canary prerequisites from the
original review remain open and unchanged: capped payment admission at the
signing/admission boundary, a second x0x participant receiving and following
a checkpoint, recovery through a genuinely separate provider with the same
refusals, writer fencing, and client-held recovery-pin support before any
replacement gateway accepts writes.
