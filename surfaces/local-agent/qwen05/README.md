# qwen05/ — the custody copies (Order B, z3.2, 2026-09-05)

The LOCAL AGENT's small Qwen mind: **Qwen2.5-0.5B-Instruct-q4f16_1-MLC** and its
model-lib wasm. What lives here is the estate's own custody copy of every
SMALL artifact; the eight weight shards (265 MB) are too heavy for the git tree
and live on the estate door (below) with their sha256s enforced by
`../sw.js` — the SRI gate that hashes every artifact against its pin before a
byte reaches the engine.

## sources, read and hashed 2026-09-05

- model dir `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` @ huggingface.co
  (repo sha `32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad` <!-- PUBLIC-CONSTANT: HF repo commit, provenance pin -->)
  — base model card `Qwen/Qwen2.5-0.5B-Instruct` license **apache-2.0**, read
  at the card 2026-09-05. Files here are byte-identical to the custody copy on
  the box (cross-hashed; the six shared files' sha256 agree laptop↔box).
- model-lib wasm `Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` from
  `mlc-ai/binary-mlc-llm-libs` @ `web-llm-models/v0_2_84/base` — the exact
  build the vendored web-llm 0.2.84 pins.
- engine: `../../blight/web-llm.mjs` (W-1 vendoring, Apache-2.0; its bundled
  TVMjs runtime L-VERIFY'd 2026-09-05 → `../../blight/tvmjs.LICENSE`).

## render-time rail

`https://relay.skaists.dev/model/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/` — the
estate door on the box (GET-only, per-IP rate-limited, CORS read grant for
public static weights). The page's `model_url` points there; the wasm rides
same-origin from THIS directory. Zero HuggingFace, zero jsdelivr at render.

## the permanent re-home — priced, pending the founder's word

Arweave via the AR.IO bundler answered the free-tier probe with an **x402
invoice**: `241453` units of USDC-on-Base per 5 MB data item (payTo
`0x6A0A10FFD285c971B841bee8892878c0d583Bf67` <!-- PUBLIC-CONSTANT: the bundler's own x402 payTo address, from its 402 answer -->),
≈ **13 USDC** for the mind. A founder-gesture-class spend no seat makes
unruled; until the word lands, the estate door carries render and this
directory carries custody.
