# 2026-09-19 — CONTEXT BUG: selection-layer investigation + minimal fix (buzz-acp fork)

Seat: zCode. Brief: founder context-bug task (steered via reviewer packet).
Worktree `wt-zcode-ctxbug` on the installed lineage `codex/nip42-ws-query-fix`;
patch branch **`zcode/context-ancestor-pinning`** pushed to skaists/buzz
(commit **`35c538a8`**). READ-ONLY against all live state: no restarts, no
provider/model/pool/DNS/relay changes, founder seat untouched, tests isolated.

## Trace: BUZZ_ACP_CONTEXT_MESSAGE_LIMIT config → REST → selection

- Definition: `crates/buzz-acp/src/config.rs:385` — clap arg, env
  `BUZZ_ACP_CONTEXT_MESSAGE_LIMIT`, default 12, range 0..=100, "maximum number
  of context messages for thread replies and DMs; 0 disables". A message-count
  setting; nothing in its path touches token capacity.
- Gate: pool.rs prompt build — `context_message_limit > 0` (now the extracted
  `context_fetch_enabled`).
- Fetch: `fetch_conversation_context` → thread tags of the batch's last event →
  `fetch_thread_context(channel, root, limit, agent_pubkey, rest)`.
- Selection (`fetch_thread_context_with` + `parse_nostr_thread_response_with_meta`):
  1. **root by separate id filter** — the root cannot disappear past N;
  2. replies newest-N (relay limit newest-first + explicit sort), sentinel =
     limit+1 → `truncated`, best-effort `/count` improves the N-of-M total;
  3. **agent's newest reply pinned** (swaps in over the oldest displayed);
  4. after fetch, `conversation_context_delta` strips already-delivered and
     triggering ids for live sessions (no re-injection on steer).
- Prompt disclosure: `[Thread Context (N of M messages, truncated)]`.
- DM: bounding happens **REST-side** (`fetch_dm_context` asks the server for
  `limit`); the parser only flags `truncated` (conservative `>=` at-limit).

## Source comparison: installed fork vs current upstream

The fork lineage ALREADY carries nearly the whole contract the brief expected
to be missing: root pinning, newest-N + sentinel + N-of-M disclosure,
agent-reply pinning, delivery-delta. Two genuine gaps found:

1. **Ancestor chain (neither lineage has it)** — a deep parent outside the
   newest-N window is dropped (disclosed, but structure should outrank chatter).
2. **Delta re-flag (upstream has it, fork lacked it)** — removing prior-session
   messages did not set `truncated`, presenting the reduced window as complete.

## RED evidence (pre-patch, installed lineage)

- `c1_without_pin_deep_parent_is_dropped` — characterization test PASSES on
  unfixed code: REQUIRED_RULE_B (parent, ts 2000, outside newest-12 of a
  20-reply thread) is absent from the delivered messages.
- `c2_with_pin_parent_survives_cap` and the re-flag assertions **failed to
  compile** against the unfixed lineage (features absent).

## Minimal patch (35c538a8, pool.rs only)

1. **Ancestor pinning**: `fetch_thread_context_with` takes
   `pinned_event_ids` (caller = distinct parents of the batch's triggering
   events, root excluded); validated 64-hex, deduped, capped
   `MAX_PINNED_ANCESTORS = 3`; fetched by id filters; parser swaps each into
   the displayed window over the oldest reply — the bounded window never widens.
2. **Delta re-flag ported from upstream**: `omitted_from_prior_session` ORs
   into `truncated` for Thread and Dm.
3. `context_fetch_enabled(limit)` extracted as the single 0-disables gate.
4. Legacy delta test updated to the ported contract (asserts `truncated`).

## Tests + GREEN

Contract battery A–H (module `context_contract_tests`, pool.rs): **9/9 pass**
— A short-complete, B root+tail+N-of-M, C1 characterization, C2 pin-survives
(pin replaces chatter; window stays 13), D deterministic across rotation,
E delta removes delivered + re-flags, F DM bounded/flagged (REST boundary),
G limit-0 gate, H limit-100 upper bound. Full crate: **783 passed, 2 failed**
— both failures (`acp_steer_request_omits_expected_run_id…`,
`goose_transport_wins_when_both…`) proven pre-existing on the pristine branch
(git-stash check), in files this patch never touched. Side-finding for a
future lane: two steer-transport tests are red on the fork baseline.

## Remaining uncertainty

- Installed `buzz-acp.exe` is the hand-patched observer build; binary ↔ fork
  source equivalence not re-verified (no build receipt checked). The branch is
  the best available source proxy.
- The brief's live-relay RED (synthetic thread + captured ACP prompt) was
  satisfied at the unit boundary with injected query/count fakes instead —
  same selection code path, no live relay touched.
- DM truncation totals use the lineage's sentinel arithmetic (fetched+1);
  validated at the parser boundary only.
- The `12` itself was never changed, and no token-context setting was touched:
  `context_limit=12` (messages) and `GOOSE_CONTEXT_LIMIT=1000000` (tokens)
  remain separate knobs, per the founder's ruling.

## Disposition

Branch pushed, **no PR opened** (founder decides routing; note buzz DCO law
applies if this ever goes to block/buzz). Nothing deployed; the running
binary is untouched. This is repo work under the operational freeze — no
Buzz seat, pool, rail, or config was modified.
