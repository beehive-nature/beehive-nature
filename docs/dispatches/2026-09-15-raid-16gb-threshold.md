# RAID — "The 16GB Threshold" (augmentedmind.substack.com) vs our stack — 2026-09-15

**Seat:** zCode · **Founder order:** "RAID this for our stack" (link relayed via
YouTube redirect → https://augmentedmind.substack.com/p/the-16gb-threshold,
article by Manolo Remiddi, 2026-09-12).

## TL;DR verdict

1. **The article is real and accurate where it counts.** Every load-bearing
   claim I could check at source checks out: the model repo exists and is
   heavily used, the two quantization methods are genuine ISTA-DASLab papers,
   the llama-server flags exist in current llama.cpp source, and the hardware
   specs are right. Only the author-reported performance numbers (MTP
   acceptance 0.63–0.75, "+40% tokens/s", "Q4 accuracy at 3.44 bpw") remain
   UNVERIFIED — the independent benchmark that tested these exact files has
   its numbers behind a paywall.
2. **For our stack TODAY it changes nothing executable.** The estate owns
   zero CUDA-class hardware (laptop = Intel Iris Xe 2 GB integrated —
   verified; box = ARM64 CPU only), the `/compute` door on the box is
   currently **404** (llama.cpp container absent — see FLAG), and the W-1
   browser pocket model remains our only working local tier.
3. **It is a BUY thesis plus a recipe bank.** $780 (16 GB RTX 5060 Ti) +
   ~$700 (ITX box) = a sovereign 27B-agent tier with 262K context. If the
   founder orders a local-LLM tier, this is the now-proven cheapest path —
   and it fits our laws (first-party-only, nodes-on-the-box).
4. **Adoptable as law regardless of hardware:** judge GGUFs by bits-per-weight
   + benchmark recovery, not Q-grade names; prefer hybrid linear-attention
   models for cheap context; keep agent-serving quants at ≥95% BF16-recovery
   (compounding); bank the verified llama-server invocation set.

## What the article claims (four pillars)

A 27B model (Qwen3.8-27B) quantized to ~3.44 bpw via GSQ+RCO runs
"agent-grade" entirely in an 11.8 GB file on the cheapest 16 GB Nvidia card
(RTX 5060 Ti, $780): ~9 GB VRAM ceiling including 262K-token context,
18–22 tok/s prompting / ~40 tok/s accepting via MTP speculative decoding
(acceptance 0.63–0.75, ~+40% tokens/s), and ~2× the capacity utilization of
a 5090 (two concurrent 262K sessions on the 5060 Ti where the 5090 fits one)
— because (a) GSQ/RCO packing beats uniform quantization at the same file
size, (b) MTP draft weights ride inside the same GGUF, and (c) the
architecture is hybrid linear-attention (Mamba-style), making context growth
nearly free vs a 27B dense-attention model's ~211 GB KV cache.

## VERIFIED AT SOURCE

| Claim | Source check | Result |
|---|---|---|
| Model repo exists | HF API `ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` | ✅ apache-2.0, **884,926 downloads**, 1,125 likes, lastModified 2026-09-02, `context_length: 262144`, GGUF family with `imatrix` + `mmproj` |
| It's multimodal | same | ✅ `pipeline_tag: image-text-to-text`, vision tags — the article undersells that a **27B VLM** rides the same 11.8 GB |
| GSQ is a real method | arXiv:2604.18556 | ✅ "GSQ: Highly-Accurate Low-Precision Scalar Quantization for LLMs via Gumbel-Softmax Sampling" — jointly learns per-coordinate grid assignments + per-group scales; closes most of the scalar↔QTIP gap at 2–3 bits; GGUF K-Quant compatible; scales to trillion-param MoE (Kimi-K2.5). Code: IST-DASLab/GSQ |
| RCO is a real method | arXiv:2605.00649 | ✅ "Model Compression with Exact Budget Constraints via Riemannian Manifolds" (Helcig & Alistarh) — budget constraint as smooth Riemannian manifold, Adam + tangent projection + retraction; **exact budget enforcement** (this is why the file is exactly 11.8 GB). Code: IST-DASLab/RCO |
| llama-server flags exist | GitHub code search ggml-org/llama.cpp | ✅ `draft-mtp` in `common/speculative.cpp` + `docs/speculative.md` + `tools/server/README.md`; `spec-type` same set; `--no-kv-unified` in `common/arg.cpp` + `tools/server/README.md` |
| Hardware specs | public specs | ✅ 5060 Ti 16 GB GDDR7 = 448 GB/s; DGX Spark GB10 = 273 GB/s → 1.64× (article's "50–60% more" checks) |

## INDEPENDENT CORROBORATION (partial)

- **Kaitchup benchmarked these exact files** ("Qwen3.8 27B GGUF Benchmark:
  Q4 to Q1"): 950 prompts from MMLU-Pro / LiveCodeBench / GPQA Diamond, 3
  runs averaged, acceptability line = "recovers >95% of BF16 accuracy", and
  the warning that **token efficiency degrades with quant loss** (worse
  quants emit more tokens for the same task) and that single-turn benchmarks
  understate agentic risk. Exact accuracy deltas are paywalled → the
  "Q4-quality at 3.44 bpw" figure stays **UNVERIFIED** (directionally
  supported: they included GSQ-RCO-IQ3_XXS 10.1 GB and IQ2_S 9.3 GB among
  the contenders).
- Lineage: ISTA-DASLab = Frantar/Alistarh shop (GPTQ, SparseGPT, Marlin);
  the GGUF bridge started in their `gptq-gguf-toolkit`. These are quant
  researchers, not marketers.

## UNVERIFIED / framing corrections (if relayed to ANT Discord)

- MTP acceptance 0.63–0.75 and "+40% tokens/s" are author-measured, no
  third-party receipt yet.
- "2× the 5090" is a capacity-packing statement (two 262K sessions vs one),
  not a speed statement — fine, but easy to misread.
- The 5060 Ti vs DGX Spark comparison is honest on bandwidth (448 vs 273
  GB/s) and price, but the Spark's 128 GB unified-memory tier is a different
  purchase class (many concurrent large models); it's not "the same thing
  cheaper," it's "the same tokens/s per dollar at small scale."

## OUR STACK — grounded inventory (measured today)

- **Laptop:** Intel Iris Xe Graphics, 2 GB integrated (verified via
  Get-CimInstance). No NVIDIA anywhere in the estate.
- **Box (bnr, OCI ARM64):** no GPU; CPU-only. A 27B @ ~3.4 bpw is ~12 GB of
  weights but CPU-bandwidth-bound — agent-usable? No (order ~1–2 tok/s
  class on ARM CPU; estimate, not measured). If we re-stand a compute door
  on the box, the realistic tier is a 4B–8B hybrid-attention GSQ-style
  quant, not 27B.
- **`/compute` door: currently 404.** `docker ps` shows no llama.cpp
  container at all (only buzz relays, albyhub, stores). The lane-h
  "llama.cpp behind skaists.buzz/compute" state did not survive to today —
  **FLAG for founder: parked intentionally after the compute-edge-clear
  measurement, or silently lost?** (5.7s prefill measured then was
  CPU-class anyway.)
- **W-1 pocket lane** (SmolLM2-360M via WebGPU in-browser, ~204 MB, warm +
  offline) remains the estate's working local-model tier and fits the Iris
  Xe.

## What we ADOPT (zero-cost, starting now)

1. **Packing law:** when picking any GGUF, read bits-per-weight + a
   recovery benchmark, never the Q-grade name. GSQ/RCO-style per-tensor
   mixed precision is the current default lens.
2. **Agent-seat quant floor:** ≥95% BF16-recovery for anything that serves
   agents — compounding (Kaitchup's warning mirrors the article's
   "compaction is lossy"; both mirror what our own agent seats experience).
3. **Hybrid-attention preference:** for long-context serving on modest
   hardware, architecture (linear/hybrid attention) matters as much as
   parameter count.
4. **Recipe bank (verified at source):** `llama-server` with MTP-draft
   speculation (`--spec-type draft-mtp` family), multi-session
   `--parallel N` + `--no-kv-unified` + KV-cache type flags, imatrix-aware
   quant selection.

## What we SKIP

- Any hardware purchase today (founder decision, not a code lane). If
  ordered: one RTX 5060 Ti 16 GB + the article's ITX build ≈ $1,500 total
  for a sovereign 27B/262K agent tier — cheapest path we've seen verified.
- Running 27B on the box CPU (bandwidth-bound, not agent-usable).

— zCode

Sources: [the article](https://augmentedmind.substack.com/p/the-16gb-threshold)
· [HF repo](https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF) ·
[GSQ paper](https://arxiv.org/abs/2604.18556) ·
[RCO paper](https://arxiv.org/abs/2605.00649) ·
[Kaitchup benchmark](https://kaitchup.substack.com/p/qwen38-27b-gguf-benchmark-q4-to-q1)
· [r/LocalLLaMA release thread](https://www.reddit.com/r/LocalLLaMA/comments/1w13vse/release_sota_ggufs_for_qwen3827b_gsqrco_at_25_to/)
· [gptq-gguf-toolkit](https://github.com/IST-DASLab/gptq-gguf-toolkit)
