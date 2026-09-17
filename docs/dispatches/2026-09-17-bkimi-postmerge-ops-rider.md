# Post-merge ops rider — bKiMi supervision state + new kimi-side finding

Seat: zCode. Follows PR #96 (merged e4334e49). Advisory context: advisor's supervised-
instance gate ("supervised/new binary completes one attributable turn, then retire the
manual instance; if it cannot, diagnose before killing the working manual one").

## What was found and done (chronological, UTC relay clock)

1. Fleet inventory corrected the advisor's premise: Desktop-supervised bKiMi (14936,
   started 17:44:35Z) was running the INTERIM 777aa0a6 binary (predates the e7f4d1e2 swap
   at ~18:15Z) — and was live-emitting `message too long` (18:43:56) plus relay QUOTA
   NOTICES (`#5723` family observed live: "rate-limited: quota exceeded" — two duplicate
   bKiMi instances double-streaming observers).
2. Killed interim 14936 → Desktop respawned as 54660 at 18:46:36Z ON THE REPAIRED
   binary (clean startup, both channels, pool up). Gate stimulus sent.
3. Duplicate-race reality: with manual + supervised both alive, EITHER may claim a
   mention — the manual (55448) won the first gate ping (turn ok at 18:58:27 but NO
   kind:9 published — see finding below); after it completed, manual retired; second
   gate ping went unclaimed — 54660's kimi pool had broken (`AgentRuntimeService.acquire
   … code: 'runtime.not_found'` in the supervisor log; a 19:00:54 turn = claimed, died
   in 1s, no reply — consistent with the abrupt pool kills today).
4. Restarted 54660 (kill + clear its kimi children) — Desktop did NOT respawn within
   6 min this time (its respawn trigger appears founder-interaction-driven, not a
   watcher; the two earlier respawns likely followed founder desktop activity).
5. Service restored via the manual path (pid 1036, 19:17:37Z, repaired binary,
   **env-only key handoff** per the advisor's interim-custody ruling — argv length now
   332 chars, no key material on the command line). Registry repointed at 1036 as the
   interim record.

## NEW FINDING (separate lane; NOT the observer repair — that stands GREEN)

**Kimi-side hallucinated receipts on trivial prompts.** The 19:18 gate turn (session
`946f919c`, 69 wire lines, ~2s wall): final assistant text claims "message is posted in
#general … my reply: `e40f6e76…`" — **that event does not exist on the relay** (channel
window shows only Bumble's ping + bKiMi's 👀/💬 + kind:5 cleanup). Kimi narrated a
buzz-CLI post it never made (or that failed silently). Same shape as the 18:58 ok-no-reply
turn. Earlier tonight the same binary+path produced real 5-minute turns with real replies —
so this is a kimi behavioral regression surface (likely context/memory-driven shortcut on
one-liner "reply once" prompts), NOT the NIP-44 fix (observer frames flowed clean in both
turns) and NOT chat-path code. It compounds with the #5390-family question of when the
harness publishes final text vs. defers to a self-posting tool call.

## State at rest

- bKiMi @ skaists.buzz: manual pid 1036, repaired binary e7f4d1e2, env-only key, online;
  replies to trivial pings currently UNRELIABLE (finding above).
- bKiMi @ beehivenature.buzz: pid 40132, Desktop-supervised since yesterday — multi-relay
  placement policy = founder decision (advisor's split, unchanged).
- Desktop-supervised skaists.buzz instance: absent until the next founder desktop
  interaction respawns it; registry points at manual 1036 meanwhile.
- Orphaned kimi.exe family (parent 9296, from yesterday's crash) still on the box —
  hygiene item.

## FOUNDER ACTIONS (one desktop interaction resolves most)

1. Open/restart Buzz Desktop → supervisor respawns bKiMi on e7f4d1e2 → verify one real
   (non-trivial) turn replies → kill manual 1036 → supervised path canonical.
2. Kimi hallucinated-receipt lane: needs its own claim (likely: purge/rotate the poisoned
   session memory; test with a concrete work prompt, not "reply once").
