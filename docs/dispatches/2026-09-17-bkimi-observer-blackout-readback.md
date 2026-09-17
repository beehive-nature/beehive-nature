# bKiMi night readback — replies PERSISTED on relay (readback-proven); the blackout was the observer (transcript mirror), not the chat path

> **CORRECTION PASS (same day, advisor-reviewed).** An advisor review of the first draft identified three
> over-broad wordings; all three are corrected in place below and itemized in the correction ledger at the
> end. Nothing else in the evidence base changed; the correction pass ADDED evidence (relay receipt clock,
> source-pinned size limits, binary generation fingerprint, corrected fixture totals).

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
tags. Includes a 5,006-char reply at created_at 04:39:28Z (publisher/laptop clock) with relay `received_at`
04:39:27.563 (relay clock) — the relay's OWN receipt clock places arrival inside the 04:38:14–04:44:28Z
drop window; the laptop clock runs ~0.5–1s behind the relay (uniform across all six replies checked:
received_at precedes created_at by 0.4–1.0s).
The two receipt events bKiMi's own final texts cited are real rows:
`7f6b9ea5df0123de400f12b518f2040f30aa7c09abd3a1f7509040fd2b4a80d2` PUBLIC-CONSTANT (relay event id, 06:38:54Z, 3,158 chars) and
`7ff62d5d3a373b1bb4ab28311f35861a3a1dc4460e1403949b10a4072117d65c` PUBLIC-CONSTANT (relay event id, 07:03:28Z, 3,543 chars).
BOUNDARY NOT CROSSED: this establishes **relay persistence and investigator readback for the identified
replies**. It does NOT establish founder-client rendering, on-screen timeliness, or push delivery —
"found in the database" is not "seen by the founder," and the founder's no-response experience remains a
valid UI symptom this dispatch does not explain. Nor does it prove every bee in every channel delivered
(checked: #general + #bGENEaLOGy; see claim 5). The record stands as:
**Identified replies: relay persistence confirmed by the investigator. Observer stream: degraded.
Founder-client rendering: not established.**

**CLAIM 2 — The observer queue carries NIP-44-encrypted transcript/telemetry events, NOT kind:9 chat replies. The drops were a visibility blackout, not a delivery failure.**
EVIDENCE: bKiMi's buzz-acp log (laptop, `agents/logs/7b94e29b…__25c0f559….log`): 61×
`WARN buzz_acp: failed to encrypt relay observer event: NIP-44 error: message too long` from 03:50:21Z onward, then 840×
`observer publish queue over byte budget` 04:38:14–04:44:28Z, pending pinned ≈ the 4 MiB byte budget, total_dropped
ending at **1,413** (the founder's 1,310 was a mid-window snapshot). Relay-side, bKiMi's Sep-17 event histogram is
kind 9×15, 7×50 (👀/💬), 5×50 (reaction cleanup), 30174×9 (observer/transcript kind — the small early ones landed;
the big late ones never left the laptop). As Kimi session contexts grew (session wire records reached
~78–80KB single-line JSON payloads, with 13 lines >64KB across the night's four sessions), individual
transcript events exceeded the DEPLOYED implementation's NIP-44 payload limit → encrypt fails client-side
→ whole event dropped at publish (`lib.rs` warn-and-return, no requeue) → enqueue rate outruns the 1/s
publish tick → queue saturates → oldest dropped.

**Size limit pinned to the deployed implementation, not the protocol.** In the buzz source (box mirror
`skaists/buzz` @ `088a677f`): `buzz-core/src/observer.rs` defines `OBSERVER_MAX_PLAINTEXT_LEN = 65_535`
and `NIP44_MAX_CONTENT_LEN = 87_472` (NIP-44 v2 constraints; the `nostr` crate appears at 0.44.7 and
0.45.1 in Cargo.lock). The NIP-44 spec itself now describes an extended-length format and delegates
payload limits to implementations — so the correct claim is "the deployed workspace's nip44 v2 path,"
not "a universal NIP-44 cap."
BOUNDARY NOT CROSSED: I did not decrypt observer payloads (no keys touched); the event-class attribution rests on
the log lines + the 30174 kind landing early and ceasing as contexts grew. The ~78–80KB wire lines are a
SIZE PROXY for failing payloads (wire records ≈ mirrored material), not a measurement of the exact
failing serialized event; and encrypt-fail → queue-drop ordering is inferred from the code path
(warn-and-return, then budget enforcement at enqueue), not from per-event tracing.

**CLAIM 3 — One turn WAS truly lost, and the mechanism is the steer cancel+merge path, exactly the advisor's "don't prod them" warning.**
EVIDENCE: Kimi Code CLI wire (`~/.kimi-code/sessions/wd_.buzz_*/`): session `a8a5ecb3` started 06:24:27Z on the
founder's "finish your last tasks please"; one `llm.request` fired (kimi-k3, maxTokens 1,048,576); at 06:24:49Z —
22 seconds in — `turn.cancel reason="user_cancelled"` → `outcome="aborted"`, thinking cut mid-sentence;
`token_counting.turn_recorded tokens=18132`. The aborted attempt's assistant message contained ONLY a
2,132-char think block — **no text block — so "no final delivered response from that attempt" is precise**;
billable output tokens are NOT confirmed zero (provider output-token field still unjoined). The same second, the merge re-prompt session `edb5dc58` was created
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

So, for bKiMi's identified replies that night: **relay persistence confirmed by investigator readback;
observer stream degraded; founder-client rendering not established.** What broke was the
**transcript mirror** — the founder's live window into the bees' thinking — which is precisely why it *looked* like
they went silent while tools ran and replies queued up 10–30 minutes later (long turns, ~100k contexts).

## bMeter/bPay consequences (recorded usage; monetary reconciliation pending)

- Provider billing dimensions must include cached vs uncached input, output, model, request ID, timestamp — kept
  separate from cost → charge → tithe → settled, per the standing rulings. "Input minus cached" is arithmetic;
  its billing interpretation still needs the provider's field semantics.
- **Aborted attempt, recorded usage:** turn a8a5ecb3 — 22-second cancellation, **18,132 CLI-recorded tokens**
  (`token_counting.turn_recorded`), no final delivered response from that attempt. Monetary charge NOT yet
  reconciled to provider evidence; label it *"aborted attempt with 18,132 CLI-recorded tokens; charge unreconciled."*
  The economic shape to preserve: **one mission → aborted attempt → recovery attempt → delivered result** — both
  attempts carry usage records; the customer charge depends on pricing commitment + failure/retry policy, not on
  eventual mission success. invoice ≠ settlement ≠ receipt ≠ reconciliation.
- First-party usage accounting EXISTS locally: wire.jsonl `token_counting.turn_recorded` per session — tonight's four
  sessions sum to 654,882 tokens (af958c3a 82,255 / a8a5ecb3 18,132 / edb5dc58 177,352 / 42bdeccc 377,143).
  Bankable as a supplier-side usage fixture with source=laptop wire.jsonl.
- **Advisor-derived fixture totals** (conversation-derived; the advisor holds the machine-readable rows, NOT pushed
  to this repo; unverified by this seat — no rows in-tree): across the ten pasted provider rows —
  input 1,034,214 · cached 945,408 · input-minus-cached 88,806 · output 8,771 · cached/input **91.41%**
  (corrects the first draft's rough "92%"; request IDs + original timestamp strings preserved by the advisor,
  timezone unknown, account/key identifiers omitted, cost + CLI-session matching marked unreconciled).
- **DO NOT SUM** the 654,882 CLI tokens with the provider-table totals: request/session correspondence, timezones,
  and counting semantics are unestablished — the same usage could be counted twice. The join is the open work.
- Wire-protocol note for the economics seat: buzz-core already defines `kind:44200` agent-turn-metric events
  (`encrypt_agent_turn_metric`, `cost_usd` fields validated per NIP-AM numeric-validity) — a ready-made
  per-turn cost carrier for the reconciliation layer.

## Repair disposition (advisor-routed; same seat; NOT executed tonight — no model swaps, no production config changes)

**Version-skew finding (correction-pass evidence): the observer repair ALREADY EXISTS in source; the deployed
laptop binary predates it.** Fingerprint of `AppData/Local/Buzz/buzz-acp.exe` (current, built/replaced Sep 13 —
a `.bak-zcode-canonical` sibling from Sep 7 records our canonical-auth swap): it CONTAINS the June-16
#1072-generation trim strings ("elided", "payload too large") but does NOT contain the current generation's
`originalBytes` stub key — while the box mirror (`skaists/buzz` @ `088a677f`) carries the full current machinery:
`fit_observer_event_to_budget` (leaf-elide loop + tiny-stub fallback, provably terminating), **pre-trim at enqueue**
(lib.rs `enqueue()`, "so one oversized leaf cannot force every frame it touches into whole-envelope elision
downstream"), the `ObserverChunkCoalescer` 60KB pre-flush, and the batch-envelope packer. The 61 whole-event
encrypt failures are the OLD generation's known gap class, addressed by exactly these changes.

**Proposed smallest RED-first observer repair (deploy, not new code):**
1. RED — on the deployed binary's generation, drive the ACTUAL serialization/encryption path
   (`publish_relay_observer_event` → `encrypt_observer_payload`, workspace nip44 v2) with an oversized
   observer payload (the ~78–80KB wire-record shape): assert the whole-frame drop (the 61× warn) and that
   follow-on small events still flow — reproducing the incident class as a test.
2. GREEN — build `buzz-acp.exe` from the current fork (canonical build+swap ritual, `.bak` preserved, agents
   restarted) and run the same test: oversized frame arrives elided-and-marked (`…[elided N bytes]…`, stub carries
   `originalBytes` — truncation is EXPLICIT, never silent), subsequent small events remain processable, and
   enqueue-time pre-trim keeps byte accounting honest so the 4 MiB budget measures what will ship.
3. UI lane (buzz-desktop, separate): distinguish **observer degraded** from **reply not delivered**; an oversized
   event must never cause an invisible backlog or obscure real work status. Chunked streams need ordering +
   completeness + bounded reassembly; previews must say they are truncated; audience/encryption posture unchanged.

**Kept separate (proposed behavior changes, not bundled with the observer patch):**
- Non-steerable runtimes (kimi.exe) under `meh=Steer`: preference is a **capability-aware queue/coalescing policy**
  for ordinary incoming work (not an arbitrary "protect turns younger than N seconds" rule); explicit user
  cancellation must still stop work immediately.
- Missing-reply warning: fire when **a reply was required and no publication evidence exists** — not on every
  kind:9-less turn (intentional silence, tool-only work, cancellation, and WAIT are legitimate outcomes).
- bSpark/bLuNa `-32603` loop: own diagnosis lane; cause not established.

**Routing / next owners:** observer rebuild+deploy+RED test → this seat (zCode); ten-row usage fixture →
economic seat (advisor holds rows; CLI/provider records stay unjoined until identity, timing, and meter
semantics support the match); steering policy + bSpark/bLuNa → separate lanes awaiting founder word.

## Ops notes

- Box reached via Windows OpenSSH (`ssh -i ~/.ssh/bnr_key ubuntu@<box>`); Git Bash ssh cannot parse that key
  (libcrypto: unsupported) — use the Windows binary on this seat.
- Relay readback via `sudo docker exec -i buzz-prod-postgres-1 psql -U buzz -d buzz` (events.id/pubkey are bytea;
  created_at timestamptz).
- Channels: `82f532d3…` = #general, `e4bb36e8…` = #bGENEaLOGy (opened ~06:50Z when the bees were redirected).
- bKiMi model was switched mid-night: kimi-k2.7-code (03:14Z start) → kimi-k3 (03:31Z restart).

## Correction ledger (advisor review, applied same day — the deltas, so the record shows the correction)

1. **Readback ≠ rendering.** First draft: "MODEL SUCCESS = MESSAGE PUBLISHED = MESSAGE OBSERVED held all night."
   Corrected to the three-line ledger (relay persistence confirmed / observer degraded / founder-client rendering
   not established). Added the clock discipline: created_at is the publisher clock, received_at the relay's own
   receipt clock — the mid-storm reply is inside the drop window on BOTH clocks (relay received 04:39:27.563).
2. **Recorded ≠ billed.** First draft: "18,132 tokens billed … aborted-but-billed is now a measured state."
   Corrected to CLI-recorded terminology with charge unreconciled; "zero output" narrowed to "no final delivered
   response from that attempt" (think-only assistant message; billable output tokens unconfirmed). Advisor's
   fixture totals (91.41% cached, not "92%") recorded with provenance and unjoined status.
3. **Deployed limit ≠ protocol cap.** First draft: "crossed NIP-44's plaintext size cap." Corrected to the
   deployed workspace implementation (nip44 v2 path, `OBSERVER_MAX_PLAINTEXT_LEN = 65_535`), the spec's
   extended-length note, the ~78–80KB payload PROXY (not a measurement of the failing event), and the
   binary-generation fingerprint that locates the failing code in the pre-current trim generation.

The earlier advisor read ("chat-delivery failure suspected") is itself superseded by this correction pass:
the identified replies persisted; the observer failed; one attempt was cancelled and recovered; UI rendering
and economic reconciliation remain open evidence questions, each with a named next owner.
