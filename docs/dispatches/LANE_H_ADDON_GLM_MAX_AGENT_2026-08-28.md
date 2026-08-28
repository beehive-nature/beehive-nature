# LANE H ADD-ON — ONE AGENT ON THE FOUNDER'S GLM MAX (BYO tier), beside the box-powered bees
**Date:** 2026-08-28 PM. Follows the receipt check (verdict: **wired and thinking** — hive turns hitting the box every few minutes, last log write 4 min before the check, zero errors).

## 1 · Per-agent provider binding — YES (truth-first, read in-tree)
The desktop resolves each agent's provider per agent record, not globally-only:
- Each agent record carries its own `env_vars`, edited on the agent's own config screen (`EnvVarsEditor.tsx`).
- Precedence (read from `managed_agents/agent_env.rs` + `config_bridge`): baked build defaults → global config → persona/record metadata → **user-supplied `record.env_vars`, written last — always win.**
So one agent can run provider "Anthropic" against GLM while the default harness (and every other bee) stays on the box's OpenAI-compatible endpoint. No second harness profile needed.

## 2 · This machine's own working GLM surface (read, key NEVER copied)
`C:\Users\travi\.zcode\v2\config.json` carries a provider entry `builtin:bigmodel`:
- **baseURL `https://open.bigmodel.cn/api/anthropic`** — Bigmodel's **Anthropic-compatible** surface (kind: anthropic)
- **models `GLM-5.3` and `GLM-5.3-Flash`** (context 1,000,000 / output 128,000, reasoning low/max/high)
- an `apiKey` field is present under `options` — **the founder copies it himself from that file; it was read only to confirm existence and is reproduced nowhere**
- note: the zCode *subscription* itself authenticates via OAuth tokens (`credentials.json`: `oauth:zai:*`) — those cannot be pasted into Buzz; the static key in the config above is the pasteable credential (its billing tier — subscription vs API credits — is the founder's account question)

## 3 · The paste-in (ONE agent, exact fields)
On the agent's own edit screen: set provider to **Anthropic**, then add these three env vars in that agent's EnvVarsEditor:

```
Provider:            Anthropic
ANTHROPIC_BASE_URL:  https://open.bigmodel.cn/api/anthropic
ANTHROPIC_API_KEY:   <copy yourself from C:\Users\travi\.zcode\v2\config.json → provider."builtin:bigmodel".options.apiKey>
ANTHROPIC_MODEL:     GLM-5.3
```

(If he prefers the OpenAI-compatible wire instead: provider **OpenAI-compatible**, `OPENAI_COMPAT_BASE_URL=https://open.bigmodel.cn/api/paas/v4`, same key, `OPENAI_COMPAT_MODEL=GLM-5.3` — the Anthropic surface is the one this machine actually exercises daily, so it is the recommended lane.)

Nothing else changes: every other agent keeps the box (https://skaists.buzz/compute/v1) as its default.
