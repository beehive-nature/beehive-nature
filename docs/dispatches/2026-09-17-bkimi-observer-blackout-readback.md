# bKiMi night readback — replies DELIVERED; the blackout was the observer (transcript mirror), not the chat path

Seat: zCode (GLM). Date: 2026-09-17. Trigger: founder relayed an advisor's analysis of
(1) a Kimi usage table (~1.03M input tokens, ~92% cached, tiny 59–113-token outputs) and
(2) the log line `observer publish queue over byte budget; dropped oldest events … total_dropped=1310 pending_bytes=4194210`,
reading it as the likely cause of "bees visibly thinking, tools running, no final response."
Mission: trace one missing reply end-to-end by identity — provider → ACP → outbound → relay → readback —
and do NOT assume the observer queue dropped chat replies just because timestamps correlate.

## VERDICT (claim → evidence → boundary)

**CLAIM 1 — The final replies were NOT lost. bKiMi's kind:9 messages landed on the relay all night, correctly threaded.**
EVIDENCE: prod relay Postgres (`buzz-prod-postgres-1`, skaists.buzz): 15 kind:9 events by bKiMi
(pubkey `7b94e29b…`) between 03:16:02Z and 07:21:04Z, every one carrying `["h",<channel>]` + `["e",<thread-root>]`
tags. Includes a 5,006-char reply at 04:39:28Z — published MID-STORM, inside the 04:38–04:44Z byte-budget drop window.
The two receipt events bKiMi's own final texts cited are real rows:
`7f6b9ea5df0123de400f12b518f2040f30aa7c09abd3a1f7509040fd2b4a80d2` PUBLIC-CONSTANT (relay event id, 06:38:54Z, 3,158 chars) and
`7ff62d5d3a373b1bb4ab28311f35861a3a1dc4460e1403949b10a4072117d65c` PUBLIC-CONSTANT (relay event id, 07:03:28Z, 3,543 chars).
BOUNDARY NOT CROSSED: this proves relay-side existence + correct threading for bKiMi on the night of 09-17 03:00–07:35Z.
It does not prove every bee in every channel delivered (checked: #general + #bGENEaLOGy; see claim 5), and it cannot
speak to what the founder's client rendered on screen.

**CLAIM 2 — The observer queue carries NIP-44-encrypted transcript/telemetry events, NOT kind:9 chat replies. The drops were a visibility blackout, not a delivery failure.**
EVIDENCE: bKiMi's buzz-acp log (laptop, `agents/logs/7b94e29b…__25c0f559….log`): 61×
`WARN buzz_acp: failed to encrypt relay observer event: NIP-44 error: message too long` from 03:50:21Z onward, then 840×
`observer publish queue over byte budget` 04:38:14–04:44:28Z, pending pinned ≈ the 4 MiB byte budget, total_dropped
ending at **1,413** (the founder's 1,310 was a mid-window snapshot). Relay-side, bKiMi's Sep-17 event histogram is
kind 9×15, 7×50 (👀/💬), 5×50 (reaction cleanup), 30174×9 (observer/transcript kind — the small early ones landed;
the big late ones never left the laptop). As Kimi session contexts grew toward ~100k tokens, individual transcript
events crossed NIP-44's plaintext size cap → encrypt fails client-side → queue saturates → oldest dropped.
BOUNDARY NOT CROSSED: I did not decrypt observer payloads (no keys touched); the event-class attribution rests on
the log lines + the 30174 kind landing early and ceasing as contexts grew.

**CLAIM 3 — One turn WAS truly lost, and the mechanism is the steer cancel+merge path, exactly the advisor's "don't prod them" warning.**
EVIDENCE: Kimi Code CLI wire (`~/.kimi-code/sessions/wd_.buzz_*/`): session `a8a5ecb3` started 06:24:27Z on the
founder's "finish your last tasks please"; one `llm.request` fired (kimi-k3, maxTokens 1,048,576); at 06:24:49Z —
22 seconds in — `turn.cancel reason="user_cancelled"` → `outcome="aborted"`, thinking cut mid-sentence;
`token_counting.turn_recorded tokens=18132`. The same second, the merge re-prompt session `edb5dc58` was created
(steer fallback: Kimi CLI advertises `steering_supported=false`, harness runs `meh=Steer` → cancel+merge on any
inbound mid-turn). The merged session ran 24 llm requests and delivered the 06:38:54Z receipt above
("Both requests handled…"). Earlier prods show the same signature in buzz-acp log: 05:05:03Z and 05:22:27Z
`steer: no active_run_id … falling back to cancel+merge`, `ack=Ok(Err(ExpectedRunIdMissing)) release_withheld=true`.
BOUNDARY NOT CROSSED: one proven aborted-billed turn tonight; I did not audit every historical session for aborts.

**CLAIM 4 — The advisor's two linked citations are real and open; the other four cited reports are unverifiable (no URLs).**
EVIDENCE: `gh api` live: block/buzz #5390 "buzz-acp: claude-agent-acp turns complete successfully but the reply is
never published (only typing reactions, then deleted)" (open, 2026-08-09, 2 comments) and #5723 "Hosted communities:
raising the publish quota for a multi-agent fleet?" (open, 2026-08-13). #5390's commenters independently confirmed
via Postgres that the publish step can drop final text (zero kind:9 inserted) and that `outcome="ok"` + silence is the
worst-of-both-worlds shape. BOUNDARY NOT CROSSED: our night does NOT reproduce #5390 — our kind:9s exist — so #5390
remains a live upstream risk, not our incident.

**CLAIM 5 — Adjacent finding, different bee: bSpark (gpt-5.3-codex-spark) sat in a -32603 crash-loop.**
EVIDENCE: bSpark's buzz-acp log: `agent_returned (application error — pipe intact) outcome="error" … Agent reported
error (code -32603): Internal error` every ~1–5 min, 07:10:30Z→07:35:48Z (one kind:9 did land 07:35Z). bLuNa
(gpt-5.6-luna) shows the same -32603 pattern on 09-13. BOUNDARY NOT CROSSED: cause not diagnosed (provider-side?

## The lifecycle, layer by layer (the advisor's table, filled)

| Layer | Night's evidence | State |
|---|---|---|
| INBOUND EVENT | 👀/💬 reactions on relay at 05:05:03, 05:22:27, 06:04:15, 06:20:08, 06:24:26 | received |
| DISPATCH | wire sessions af958c3a/edb5dc58/42bdeccc created per prod | started |
| PROVIDER | llm.request per turn; founder's table has Moonshot request IDs | called |
| TOOLS | tasks/, file-history/, PR #92 opened, commits pushed, wt-bkimi-* worktrees | ran |
| MODEL FINAL | done turns ended with 1.4–2.4KB final texts | exists |
| ACP EXTRACTION | agent.turn.ended outcome=done (×7) + 1 aborted | ok |
| OUTBOUND EVENT | kind:9 constructed + published | ok |
| PUBLISH QUEUE | chat path unaffected; observer queue dropped 1,413 telemetry events | split verdict |
| RELAY | rows in events table, threaded | accepted |
| READBACK | this dispatch | verified |

So: **MODEL SUCCESS = MESSAGE PUBLISHED = MESSAGE OBSERVED** held for bKiMi all night. What broke was the
**transcript mirror** — the founder's live window into the bees' thinking — which is precisely why it *looked* like
they went silent while tools ran and replies queued up 10–30 minutes later (long turns, ~100k contexts).

## bMeter/bPay consequences (banked as direction, not yet as rows)

- Provider billing dimensions must include cached vs uncached input (the 92% cache-reuse shape is the real economics
  of orchestration-heavy agents), output, model, request ID, timestamp — kept separate from cost → charge → tithe →
  settled, per the standing rulings.
- **Aborted-but-billed is now a measured state**: turn a8a5ecb3 consumed 18,132 tokens and delivered nothing
  (recovered by the merged follow-up, but the expense event stands). invoice ≠ settlement ≠ receipt ≠ reconciliation.
- First-party usage accounting EXISTS locally: wire.jsonl `token_counting.turn_recorded` per session — tonight's four
  sessions sum to 654,882 tokens (af958c3a 82,255 / a8a5ecb3 18,132 / edb5dc58 177,352 / 42bdeccc 377,143).
  Bankable as a supplier-side usage fixture with source=laptop wire.jsonl.
- PENDING (founder custody): the 10-row provider export with request IDs + cache split, to join against wire.jsonl.
  Not cost evidence until rate fields exist.

## Recommended next missions (NOT executed — founder's call; no model/orchestration changes made tonight)

1. buzz-acp observer vs NIP-44 cap: chunk or truncate transcript mirror events under the size cap (or cap what is
   mirrored) so the observer degrades loudly and gracefully instead of dark. Upstream-worthy.
2. Non-steerable agents (kimi.exe) under `meh=Steer`: consider `queue` for that seat, or bound cancel+merge so a
   fresh inbound cannot abort a turn younger than N seconds — the 22-second kill is the exact shape to prevent.
3. rstan251's ask on #5390 (loud WARN when a turn ends with zero kind:9) is the right observability floor for us too.
4. bSpark/bLuNa -32603 loop: separate diagnosis lane.

## Ops notes

- Box reached via Windows OpenSSH (`ssh -i ~/.ssh/bnr_key ubuntu@<box>`); Git Bash ssh cannot parse that key
  (libcrypto: unsupported) — use the Windows binary on this seat.
- Relay readback via `sudo docker exec -i buzz-prod-postgres-1 psql -U buzz -d buzz` (events.id/pubkey are bytea;
  created_at timestamptz).
- Channels: `82f532d3…` = #general, `e4bb36e8…` = #bGENEaLOGy (opened ~06:50Z when the bees were redirected).
- bKiMi model was switched mid-night: kimi-k2.7-code (03:14Z start) → kimi-k3 (03:31Z restart).
