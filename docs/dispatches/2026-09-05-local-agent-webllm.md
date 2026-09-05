# RECEIPT — Order B: WebLLM vendored into ONE surface, the local agent (z3.2, 2026-09-05)

SEND TO: z3.2 Order B — "VENDOR WebLLM into ONE surface: local-agent.html;
engine + wasm + tokenizer + a small Qwen model re-homed to Autonomi/Arweave
with SRI pins; zero HuggingFace/jsdelivr at render; WebGPU absent → honest
fallback to the P1 sidecar path, stated on-page."

## WHAT LANDED

**surfaces/local-agent/index.html** (registered: 92 counted · 101 listed) — a
Qwen2.5-0.5B-Instruct agent that runs IN THE TAB, with every model-shaped byte
gated by sha256 before it runs.

- **L-VERIFY FIRST, both links of the chain**: engine @mlc-ai/web-llm 0.2.84
  Apache-2.0 (W-1 @56d318cd, LICENSE byte-identical, sha256
  `d412ab9d5ac17e6931705aac01e5a0d323da5acd2e89a2c19aa8fc05becc59ad` <!-- PUBLIC-CONSTANT -->).
  TVMjs = the bundled @mlc-ai/web-runtime: npm license field Apache-2.0, repo
  apache/tvm main, root LICENSE read at source = stock Apache-2.0 (sha256
  `e62264b483aca7a9f8c1ac69388b476971b43975ced90ac11dbd9e9c530edb46` <!-- PUBLIC-CONSTANT -->,
  landed verbatim as surfaces/blight/tvmjs.LICENSE; its appendix lists
  native-only 3rdparty deps — cutlass/tensorrt/flash_attn are NOT compiled into
  the web wasm). Weights: Qwen/Qwen2.5-0.5B-Instruct card license
  **apache-2.0**, read at the card 2026-09-05.
- **THE RAILS (zero HF/jsdelivr at render, proven)**: engine + wasm + tokenizer
  + configs same-origin/in-tree (surfaces/local-agent/qwen05/, ~20.6 MB
  custody copies; the six shared files' sha256 agree laptop↔box); the eight
  weight shards (265 MB) + full model dir mirrored ONCE onto the estate door
  **relay.skaists.dev/model/** (Caddy, GET-only, per-IP rate limit — ant-door
  hardening law; public static weights so the read grant is `*`). The engine's
  HF-shaped `resolve/main/` URL prefix is answered by a symlink on the door.
- **SRI PINS, ENFORCED (not decorative)**: `<script integrity>` cannot reach
  fetch()-loaded artifacts, so **surfaces/local-agent/sw.js IS the pin** — 17
  sha256 pins (engine, wasm, 2 cache manifests, tokenizer set, 8 shards);
  every artifact is hashed by the service worker BEFORE a byte reaches the
  engine; mismatch → 410 refused loudly. The on-page custody panel draws each
  verdict as a comb cell (verified = capped ⬡ · refused = the flag hue).
- **THE HONEST FALLBACK**: no WebGPU → route B, stated on-page: the P1 sidecar
  behind relay.skaists.dev/compute (llama.cpp). The door's own bearer law is
  untouched — the panel takes the member key, names the b-meter law, and
  surfaces the door's every refusal verbatim. CORS preflight was measured 401
  with NO ACAO; a measured, additive OPTIONS/ACAO block landed on the relay
  compute door (auth unchanged — llama-server still refuses anonymous).
- **THE GATE (e2e/local-agent-shot.mjs)**: COLD — page answers a prompt with
  every host counted: test origin + relay.skaists.dev ONLY, zero
  hf/jsdelivr/githubusercontent; SRI census refused = 0. WARM — reload, wake,
  answer, the door NOT touched again (SW cache). OFFLINE — network off, the
  tab keeps answering. Shots at 390px in e2e/shots-local-agent/. Plus:
  design-acceptance 14/14 on the surface, no-page-errors walker covers it via
  the registry.

## THE FLAG — the permanent Arweave/Autonomi re-home is PRICED, not paid

The order's "re-homed to Autonomi/Arweave": the free-tier Arweave path
(AR.IO bundler) answered a 5 MB probe with an **x402 invoice** —
`241453` units of USDC-on-Base (asset
`0x833589fCD6eDb6e08f4c7C32D4f71b54bdA02913` <!-- PUBLIC-CONSTANT: native USDC on Base -->,
payTo `0x6A0A10FFD285c971B841bee8892878c0d583Bf67` <!-- PUBLIC-CONSTANT: the bundler's x402 payTo, from its 402 answer -->)
≈ 0.24 USDC per 5 MB → **≈ 13 USDC for the 277 MB mind**. Autonomi mainnet
write is the devnet-proven member-signed ceremony only (0.18 lane) and the
antd public-data read door is JSON-base64 — not a 265 MB shard road. Both are
founder-gesture-class spends no seat makes unruled (the Jungle4 ~5 A gesture
precedent). Until the word lands: **the estate door carries render, git
carries custody** (qwen05/ + this tree), and the price is receipted above.
The page states this in its footer, in the open.

## TRAPS BANKED

- **Chrome refuses module scripts reconstructed by a service worker** — the
  SW served web-llm.mjs at 200 with full verified body, and the dynamic
  import still failed with 'Failed to fetch dynamically imported module'
  (reproduced 30s, control without SW: import ok). The page therefore fetches
  the engine THROUGH the hash-enforcing worker and imports the VERIFIED bytes
  as a blob module — the pin is enforced, the quirk sidestepped. A blob:
  resource reports an EMPTY host in network censuses — same-origin by
  construction, folded in the gate as 'blob(same-origin)'.
- A module fetch dispatched exactly at the SW controller change aborts — the
  page waits for `navigator.serviceWorker.controller` before importing.
- The engine appends `/resolve/main/` (HF repo shape) to `model_url` — the
  door answers with a `resolve/main → ..` symlink and the SW strips the prefix
  before pin lookup.
- web-llm 0.2.84 fetches `tensor-cache.json` (not only `ndarray-cache.json` —
  the manifest ships under both names, byte-identical); a 404 there kills the
  load inside the engine's own `Cache.add`.
- Buffering 8 × 30–65 MB shard bodies inside ONE service worker kills it
  mid-flight (ERR_FAILED with no page-visible SW logs — SW console does not
  reach playwright's page console) → shards hash WHILE STREAMING through an
  in-worker incremental SHA-256 (self-tested 5/5 vs NIST + node), inference
  refuses on any final mismatch.
- Two concurrent WebGPU model loads on this iGPU = the second stalls — model
  receipts run strictly serial, and a probe that throws must still close its
  browser or the orphan eats the GPU for the next run.
- The W-1 receipt's web-llm.mjs hash (80cdd52b) was the pre-marker stock
  file; the committed vendored blob hashes
  `8b7a58eaf5a3722f822e4e4e6a4697af28182919cdad892ec7c50758bf7418c2` <!-- PUBLIC-CONSTANT: vendored engine, this tree --> —
  that is the pin.
- `/srv` on the box is root-owned; the door files live under
  /opt/buzz/deploy/compose/door/model/ (the container's /srv/door), and the
  Caddyfile edit rode `cat` back into the bind-mounted inode (the banked trap).
