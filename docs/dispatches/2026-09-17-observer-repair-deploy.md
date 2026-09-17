# Observer repair — RED/GREEN validation + deploy of the current fork buzz-acp (founder disposition executed)

Seat: zCode (GLM). Date: 2026-09-17. Disposition: founder EXECUTE order on PR #96's
proposal — validate and deploy the CURRENT EXISTING fork implementation, RED-first,
no new architecture. Companion dispatch: `2026-09-17-bkimi-observer-blackout-readback.md` (PR #96).

## STATE

Deployed-laptop `buzz-acp.exe` was replaced with a release build of the pinned fork
`skaists/buzz` `origin/main` @191a577d + the two canonical-auth commits cherry-picked
(branch `zcode/observer-green-2026-09-17`, commits 258a7c70 fix + 6505a441 test —
clean picks, identity preserved). Toolchain: rustc/cargo 1.96.1 MSVC, release build 7m31s.
bKiMi's harness restarted on the new binary against prod (faithful config, zero setting
changes); all other agents keep running supervisors on the old image until their next
natural restart (rename-swap semantics — running processes keep the old image).

## RED EVIDENCE (deployed binary, real paths)

Harness (banked in-tree at `ops/observer-redgreen/`): a dependency-free dummy relay
(hand-rolled RFC6455 WS + HTTP `/query` NIP-98 bridge) + scripted ACP agent driven
through the ACTUAL observer serialize → fit/pack → NIP-44 encrypt path. Agent key +
NIP-OA auth tag read in-process from the desktop's managed-agents.json (never printed).

Shape battery (78,848-byte tool_call, 96KB chunk bursts, escape-heavy 2×-serialized
leaf, ladder to ~160KB serialized, thinking-stream 20×5KB + 70KB giant):
- ALL PASSED on the deployed binary — elided/packed, shipped within the 87,472-char
  NIP-44 ciphertext ceiling (≡ 65,535-byte plaintext cap), zero warns, zero drops,
  turns `outcome=ok`, small events flowed. The 61 night-time `NIP-44 error: message
  too long` failures were NOT reproduced by any synthetic shape (live-failing metric
  observed instead: the OLD binary logged a fresh `message too long` at 09:16:56Z,
  minutes before the swap — real kimi traffic still triggers it; shape unknown).

Sustained-overload reproduction (50KB/200ms for 50s ≈ 4× the 1-frame/s drain):
- **Storm reproduced byte-true on the deployed binary**: `observer publish queue over
  byte budget … pending_bytes=4184231` pinned at the 4 MiB valve, 158 drop warnings —
  the exact incident signature.
- **Small-event starvation**: of ~50 small beacons emitted during the storm, **1 shipped**.
  The transcript mirror goes dark and stays dark under sustained load — the founder's
  "silence" experience, mechanically reproduced.

## GREEN EVIDENCE (new build, same harness, same shapes)

- Shape battery: identical PASS — all oversized content handled within the encryption
  bound, zero `message too long`, zero drops, `outcome=ok` turns, chat path independent.
- Source-level: observer test subset 35/35 pass; full buzz-acp suite 781/784 (2 failures
  are POSIX-shell-dependent steer tests — `spawn_steer_capture_script` runs `/bin/sh`
  scripts — Windows-environment artifacts, same pre-existing class the canonical lane
  documented as failing identically on pristine base; not observer-related, not from
  the cherry-picks).
- Reduction explicitness verified at source level: `fit_observer_event_to_budget`
  elides with `…[elided N bytes]…` markers and a stub carrying `originalBytes`
  (asserted by fork tests at lib.rs:8643). Payload-level verification is beyond this
  seat (frames are NIP-44-encrypted to the owner — key is founder custody; BOUNDARY).
- Sustained overload on the new build: **same valve behavior** (157 drops, same
  starvation). HONEST FINDING: the 4 MiB drop-oldest valve and 1-frame/s drain are
  the designed bound in BOTH generations; the current generation's hardening is in
  the fit/pack paths (serialized-byte measurement, enqueue pre-trim), not in overload
  fairness. Small-event starvation under sustained overload is a SHARED remaining
  defect — recorded as an upstream-worthy follow-up (starvation-fairness / interleave),
  NOT redesigned here per the disposition's no-new-architecture order.

## DEPLOYED SHA / BINARY HASH

- Source: `zcode/observer-green-2026-09-17` @6505a441 (= skaists/buzz origin/main 191a577d
  + canonical 258a7c70/6505a441), pushed to skaists/buzz.
- Installed `AppData\Local\Buzz\buzz-acp.exe` sha256 `777aa0a62a8c4adb8838b243df8eacd1c9f749126ab5ef6142dc770d6c92b7e7` PUBLIC-CONSTANT (binary hash of our own deployed build).
  Note: `cargo test --release` rebuilt the bin after the first hash
  5a2d1cc9… was recorded; the installed artifact is the post-test build — validated
  behaviorally by a fresh battery run against the installed path before swap).
- Version-skew correction (supersedes the string-fingerprint theory in PR #96's first
  correction pass): the deployed binary behaved CURRENT-GEN on every observable
  (87,472-ceiling packing, elision of all shapes). The `originalBytes` string's absence
  remains unexplained but is NOT behavioral evidence of the old generation. The
  reproducible correspondence is now behavioral: old binary live-fails `message too
  long` on real kimi traffic (09:16:56Z); new binary's fit provably measures serialized
  bytes. Provenance question (which source the Sep-13 exe was actually built from)
  remains OPEN — moot after this deploy.

## ROLLBACK ARTIFACT

`AppData\Local\Buzz\buzz-acp.exe.bak-20260917-observerfix` (the Sep-13 image,
sha256 2e46b7c1…, 12,776,960 bytes). Rollback = stop harnesses + rename back.
Prior artifacts (`*.bak-zcode-canonical`) untouched.

## BOUNDED LIVE SMOKE (prod, new binary)

bKiMi restarted at 09:19:24Z on the new binary (desktop supervisor does not auto-restart
killed agents, so the instance was spawned manually with the production config — config
faithful: mentions/owner-only/10 agents/bypass/relay-observer, model kimi-k3; the
agent-pids registry now points at it):
- AUTH succeeded on the canonical road wss://skaists.buzz (NIP-42 line + /info probe
  in debug log — the Sep-13 canonical fix is in the new binary and working).
- `relay observer enabled`, discovered 2 channels (#general + #bGENEaLOGy), subscribed,
  presence online, publishes accepted by prod (OK accepted=true).
- ZERO `message too long` / byte-budget warns since restart (idle — no turn has run:
  respond_to=owner-only means the founder's next mention drives the first real turn).
- PENDING ACCEPTANCE (founder-triggered): one prod mention to bKiMi → observer kind-24200
  frames should land on the relay during the turn with zero encrypt warns (was failing
  live on the old binary at 09:16:56Z). If the new binary warns on real kimi traffic →
  current source FAILS GREEN on the real payload → STOP + report per disposition.

## BOUNDARY NOT CROSSED

- Observer frames are owner-encrypted; contents not inspected (founder custody).
- The night's exact failing payload shape was never captured — the 61 failures were
  not synthetically reproduced; the deploy's justification is generation alignment +
  the serialized-length fit class fix, with the live metric as final arbiter.
- No model, steering, genealogy-agent, bSpark/bLuNa, or bMeter changes. Upstream
  block/buzz untouched (branch pushed only to skaists/buzz).

## CHANGED

1. `AppData\Local\Buzz\buzz-acp.exe` → fork build (rollback .bak kept).
2. bKiMi harness restarted (was killed for the swap; its in-flight turn at kill time
   was lost — kimi's session resume machinery carries context forward on next turn).
3. Agent-pids registry for bKiMi repointed at the manual instance (24192).
4. Repo: this dispatch + `ops/observer-redgreen/` harness (relay/agent/run, dependency-free).
5. skaists/buzz: branch `zcode/observer-green-2026-09-17` pushed.

## NEXT OWNER

- Founder: one prod mention to bKiMi completes the live acceptance metric.
- Observer starvation-fairness follow-up → upstream block/buzz proposal lane (new claim
  required; NOT part of this disposition).
- Economics seat (unchanged from PR #96): ten-row provider fixture + CLI 654,882-token
  fixture + kind:44200/NIP-AM carrier, unjoined until identity/timing/meter semantics
  reconcile.

## FOUNDER ACTION

(1) Prod bKiMi once in #general or #bGENEaLOGy; if its reply lands and the harness log
stays warn-free, the repair is fully accepted. (2) At the next natural desktop restart,
expect the desktop to re-supervise bKiMi (kill pid 24192 then, or any time — the
registry note is cosmetic). (3) Rollback if needed: rename
`buzz-acp.exe.bak-20260917-observerfix` back over `buzz-acp.exe` and restart.

## LIVE ACCEPTANCE ADDENDUM (same day, ~17:38–17:44Z relay clock)

Controlled stimulus per advisor: ONE mention of bKiMi in #general (Bumble bee, event
`b6cfc170…` PUBLIC-CONSTANT relay event id, sibling-mention path; the advisor's exact text,
"do not start new work solely for this test"). Ladder results:

- Harness received + dispatched: `agent_claimed` + `dispatch_pending dispatched=1` (17:39:01).
- Kimi turn ran (session `e4e5c752`), `agent_returned outcome="ok"` (17:44:01).
- Observer traffic: **410 frames published and relay-accepted** during the ~5-minute turn
  (~1/s cadence) — where the OLD binary was live-failing `message too long` pre-swap.
- kind:9 reply ON RELAY: 1,185 chars, created 17:43:32 / **relay received 17:43:31.225**
  (~1s publisher-behind skew, same as the night's). Content opens "Bumble — state report
  (observer repair acceptance). No new work started for this test."
- Queue: ZERO byte-budget/drop warnings; no pathological growth.
- **DEFECT: ONE `failed to encrypt relay observer event: NIP-44 error: message too long`
  at 17:43:10 — through the fitted publish path (lib.rs:1033 fit runs before the 1034 encrypt),
  21s before the reply.** Per the founder disposition's STOP rule: **GREEN FAILS on the real
  payload.** 410-of-411 frames shipped; the failing payload's shape was not captured (max wire
  line this session 77,980 bytes — same ~78KB class as the night; synthetic single-leaf and
  batch shapes of that size PASS on both binaries, so the escaping shape is structural).
- Clock note: the laptop's clock jumped +8h mid-run (stale-at-boot → NTP sync); pre-sync
  timestamps in this lane's logs read ~09:xxZ and should not be joined against relay time.
- UI datum (reply visible in Buzz: YES/NO) is the founder's observation — infra seat cannot
  infer client rendering from Postgres.

**Verdict per the advisor's outcome matrix:** chat publication healthy; observer repair
LIVE-PENDING → **GREEN FAILED on the message-too-long criterion**; defect returns to this
repair seat. NEXT CLAIM REQUIRED (not executed): instrument the encrypt-failure path to log
serialized_len + payload shape (debug build), reproduce one real failure, and fix the escape
in `fit_observer_event_to_budget`'s assumptions (candidate: a serialization mismatch between
`serialized_len`'s measurement and the bytes handed to nip44, or a non-string-leaf structure).
No redesign without that claim.
