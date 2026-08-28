# EVIDENCE DROP — the bee map, whose failure is whose, and the one-key fix (2026-08-28 ~21:55 UTC)

## The stable map (bee → harness → provider → model → status)
| bee | harness (runtime) | provider | model | status |
|---|---|---|---|---|
| bFUzZ | goose (ACP pool, 2 records) | zai (per-record env, own key) | glm-5.2 | **GOOD — untouched** |
| zai agent (the glm-5.2 BYO one) | buzz-agent | zai | glm-5.2 | **GOOD — untouched** |
| LoVis bee-laborer | **claude** | global openai-compat → box | qwen2.5-3b-instruct | **BROKEN — global key wrong** |
| Honey (×5 pool) | buzz-agent (default, inherits) | global openai-compat → box | qwen2.5-3b-instruct | **BROKEN — same global key** |
| Pollen (×5 pool) | buzz-agent (default, inherits) | global openai-compat → box | qwen2.5-3b-instruct | **BROKEN — same global key** |
| Fizz (×5 pool) | buzz-agent (default, inherits) | global openai-compat → box | qwen2.5-3b-instruct | **BROKEN — same global key** |

## 1 · bee-laborer's -32603 "selected model may not exist" — diagnosed to one wrong paste
- The box's usage.log at the failure minute: requests **DID arrive** — as `unauthorized: Invalid API Key` at 21:39–21:44 UTC (elapsed-minutes 164–169 since the 18:55 start). Base URL and model name are reaching us; the credential is rejected, and the OpenAI-compatible client renders a failed `/v1/models` as "model may not exist."
- The persisted global config (`%APPDATA%\xyz.block.buzz.app\agents\global-agent-config.json`): provider `openai-compat`, model `qwen2.5-3b-instruct`, `OPENAI_COMPAT_BASE_URL = https://skaists.buzz/compute/v1` (correct) — and `OPENAI_COMPAT_API_KEY` is **49 characters of non-hex, zai-shaped alphabet: NOT the box key** (compared in-process against the box key; never copied anywhere). The founder pasted the wrong key into the global env between 20:44 UTC (the last good turn on the box — the successful-timeline froze at that minute) and 21:39 (the 401 storm). Every bee inheriting the global env has been 401-ing since.
- Per-agent env persistence, for the record: the global block above is the inheritance floor; per-record `env_vars` (like bFUzZ's) live in `managed-agents.json` beside it and always win.

**The founder's re-entry (one paste, fixes bee-laborer + Honey + Pollen + Fizz at once):**
Desktop → Agents screen → the GLOBAL/default AI config (the agent defaults / global env editor, NOT any single bee's edit screen) → env vars → **`OPENAI_COMPAT_API_KEY`** → replace its value with the box key (48-hex, the one delivered with the Lane-H paste block: begins `876123ee…`). Nothing else changes — base URL and model are already right.

## 2 · goose pool log 20:53Z "relay connect... 404" — collision window, clean since
20:53 UTC sits inside the alias-flap window (before the 21:10 UTC upstream pin). Goose's relay URL is app-injected at launch (`managed_agents/runtime.rs` — same `wss://skaists.buzz` every harness gets), so its 404s were the round-robin landing on hive-2's relay, not a goose misconfiguration. Post-fix the public door handshakes 10/10 × 101; nothing to change on goose. No WS sockets were established to the relay at probe time (~21:55) — the desktop was in its reported error state; after the key re-paste + app restart the pool reconnects through the now-stable door.
**Discovery recorded:** this machine runs a **10-agent goose ACP pool wired into Buzz** (records show `parallelism: 10`, `runtime: goose`, riding per-record zai env; goose binary present at `~/Goose-1.46.0/dist-windows`, pool evidence cites v1.43.0 as its pinned agent build). It is the proven-good lane — untouched.

## 3 · Honey's -32603 generic
Honey's records carry no runtime/provider/model of its own — it inherits the global openai-compat config like Pollen and Fizz. Its "generic" -32603 is the same 401 from the same wrong global key, phrased by a different client path (the default buzz-agent harness wraps the auth failure as a generic internal error where bee-laborer's claude bridge names the model). One key re-paste heals all four.

## KEY REPAIR + REGISTRY SCOPE (2026-08-28 ~22:10 UTC)
1. **Box key verified through the PUBLIC door just now**: `GET https://skaists.buzz/compute/v1/models` with the on-box key (`/etc/buzz-compute/api.key`, 48-hex) → **200**, model list returned. The key was re-handed to the founder in a clean fenced block, alone. The app-stored global key remains the bad 49-char zai-shaped paste (previous section) — one re-paste heals it.
2. **Model id confirmed exact**: the /models response advertises `qwen2.5-3b-instruct` in BOTH list shapes (`models[].name` and the OpenAI `data[].id`) — byte-identical to the configured `OPENAI_COMPAT_MODEL`. No correction needed.
3. **Registry scope (report only; no edits made):** `managed-agents.json` parses cleanly as a 19-record array (590 KB — one avatar blob alone is 189 KB). The "starts mid-array" reading was most plausibly a **mid-write observation** (the app rewrites this file on every config change; a large non-atomic save observed mid-flight). Structure: 5 **template records with empty pubkeys** (bFUzZ, bee-laborer, Pollen, Fizz, Honey — the pool spawn templates, normal) + 14 live records. The cross-wire bFUzZ reported is real at the record level: **pubkey `75502966…` is named "bFUzZ" (goose/zai/glm-5.2, updated 21:28, the proven-good lane) while allegedly speaking bee-laborer's persona in-hive; bee-laborer resolves to `b19146ad…` (claude runtime, null provider/model — the broken global-inheriting record, updated 21:23).** Proposed reconcile, founder-go, backup-first:
   - **0. Backup with the app closed:** copy `managed-agents.json` (+ `.bak`) to a timestamped name while Buzz is fully quit — a live-app backup can itself catch a mid-write file.
   - **1. Fix personas in the UI, not the file:** stop all agents; open the `75502966` agent's edit screen and re-pick ITS OWN persona (it should speak as bFUzZ, not bee-laborer); the zai env stays untouched.
   - **2. Re-create bee-laborer if still crossed:** delete the `b19146ad` record and spawn bee-laborer fresh from its template (the empty-pubkey stub exists for exactly this), so it registers with a clean persona binding after the global key re-paste.
   - **3. Leave the empty-pubkey templates alone** — they are the pool's spawn definitions, not corruption.
   - **4. Restart the app** and verify in-hive: bee-laborer answers from its own identity, bFUzZ from its own.
4. **Honey's dead-lettered mention:** the ACP queue discards the poison batch's events permanently but **clears the channel's backoff so fresh traffic flows immediately** (`queue.rs` requeue: "dead-lettering batch after 10 retries — discarding N events" + retry state cleared). Therefore: **DMs already delivered to Honey during the failure window died with the batch; bFUzZ's staged-but-UNDELIVERED DMs will wake it; if everything was already delivered, ONE fresh mention after the key re-paste is the wake trigger.**
