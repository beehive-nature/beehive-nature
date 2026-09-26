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

## PUBLICATION-CONTRACT INVESTIGATION (foundation laid, advisor-framed)

**The law (founder/advisor ruling, standing): an agent may REPORT that it published
something, but only relay/network evidence may promote the publication claim.**
`model says "sent"` ≠ `kind:9 constructed` ≠ `relay accepted` ≠ `relay persisted` ≠
`client rendered`. An event ID invented by a model has zero evidentiary weight until
the relay proves the event exists. (Same discipline as claim-evidence-boundary and the
bPay invoice≠settlement≠receipt ladder.)

**Causal-wording discipline (banked):** both observed hallucinated-receipt/no-publication
cases OCCURRED ON trivial reply-only prompts — triviality is NOT established as the cause;
candidate seams: tool availability, context/session state, kimi behavior, harness output
suppression, or an interaction.

**Trace foundation (from DEBUG harness logs + wires, no model prose accepted as evidence):**
- 1.3-second turn (19:18:12.07 claim → 19:18:13.36 return ok): ZERO publication-decision
  lines, ZERO observer-frames, ZERO NIP-AM metric warns between claim and return — the
  harness completed a turn with no publishable assistant output at all. Relay window
  confirms: ping + 👀/💬 + kind:5 cleanup, nothing else.
- 2-minute turn (18:56 claim → 18:58:27 return ok; kimi session 946f919c): kimi wire
  carries think+text final whose text NARRATES a self-post ("my reply: e40f6e76…") —
  that event does not exist on the relay. kimi's own `turn.ended outcome="failed"` while
  the harness logged `agent_returned outcome="ok"` — an ACP-level classification mismatch.
- Source structure (buzz-acp @c1e7df61): the harness owns publication —
  `buzz_sdk::build_message` → sign → `RestClient::submit_event` (POST /events) is the
  canonical reply path; there is no model-driven suppression of the final text in code
  found so far. Both failures look like "harness never received a publishable final"
  (instant empty return; errored ACP turn misclassified ok), not "decided not to publish".

**Contract answer (provisional, for the bounded claim):** single-owner —
`model returns text → harness publishes`. A model claiming "I posted via CLI" is merely
content (and in the observed case, false content). If self-publishing tools are ever
intended, the harness must require tool-evidenced publication before suppressing its own
final output. The open work for the claim: (a) why the ACP error was classified ok;
(b) why kimi short-circuited/errored (workspace/runtime lane — STOP rule: if
`runtime.not_found` recurs on the supervised instance, do not cycle processes; diagnose);
(c) rstan251's loud-silence ask applies verbatim: a turn ending with zero kind:9 and no
error should WARN.

**Supervised acceptance gate (restated, advisor form):** Desktop-supervised harness on
e7f4d1e2 → healthy kimi runtime → ONE normal substantive turn from an existing legitimate
bounded read-only obligation (not a synthetic ping) → harness obtains final text → exactly
one canonical kind:9 → relay event exists → no fabricated receipt accepted → observer
warn-free → client renders → THEN retire manual pid 1036. Key custody: env-only handoff is
INTERIM; durable target is keystore/capability custody with no raw key transport.

## FINAL-OUTPUT-1 — claim framed (advisor-closed; this seat stops here)

**Claim name:** FINAL-OUTPUT-1 — ACP terminal outcome and publication evidence.
Three independent questions for the builder:
1. **Outcome fidelity:** can `failed` ever become `ok` across the Kimi→ACP→Buzz boundary?
   (Observed: kimi wire `turn.ended outcome="failed"` vs harness `agent_returned
   outcome="ok"` — a concrete contract seam, stronger evidence than the hallucinated ID.)
2. **Output fidelity:** if a turn returns `ok`, what exact assistant output must exist
   before that classification is legitimate?
3. **Publication fidelity:** if a response is required, does Buzz hold relay evidence for
   the resulting kind:9 — or an explicit typed failure explaining why none exists?

**Invariant for the builder:** *Success requires evidence at every boundary it claims
crossed.* MODEL_COMPLETED (actual terminal model outcome) → ASSISTANT_OUTPUT_AVAILABLE
(actual returned content — not a think block, not prose claiming an external action) →
PUBLICATION_SUBMITTED (signed event submitted by the publishing owner) →
PUBLICATION_ACCEPTED (relay ACK) → PUBLICATION_PERSISTED (readback where persistence is
claimed) → CLIENT_RENDERED (client-side evidence where rendering is claimed). A lower
rung is never inferred from a higher-level story the model tells. **Never fix missing
replies by synthesizing publication from model narration.**

**Loud silence is CONDITIONAL, not blanket:** zero-kind:9 alone must not WARN (legitimate
non-publication ends exist: explicit WAIT, intentional tool-only work, cancellation,
no-reply contracts). The rule: *if the dispatch contract requires a user/agent reply and
the turn terminates with neither publication evidence nor an explicit typed
non-publication outcome → loud invariant violation.* Typed states for today's cases:
`TURN_TERMINATED_WITHOUT_REQUIRED_OUTPUT` (the 1.3-second case) and `UPSTREAM_AGENT_FAILED`
(the failed→ok mismatch).

**PID-provenance correction (supersedes this rider's earlier state-at-rest lines):**
bFUzZ's later process-level re-SYNC showed the supervised/manual topology had already
shifted again — no PID in these reports is current truth. Standing rule: *re-SYNC live
process state immediately before any supervision action; never act on a PID copied from an
earlier receipt* (same provenance law as everywhere else).

**bPay parallel (the general law):** `agent says "I posted event abc"` ≠ relay proves abc
exists; `agent says "payment settled"` ≠ settlement evidence exists. **prose → claim;
receipt/network/chain evidence → promotion.** Kept separate from observer/fairness/quota/
runtime-not-found lanes. Next supervision acceptance: legitimate substantive obligation,
runtime identity established EXTERNALLY (never by asking bKiMi which instance it is).
