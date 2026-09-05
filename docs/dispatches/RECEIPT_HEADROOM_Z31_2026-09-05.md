# RECEIPT — headroom offline in banchor's snapshot path (z3.1 order B, 2026-09-05)

HEADROOM (chopratejas/headroom, HEAD `e59cf1012a2b277689555833fd221a92279f777d`,
Apache-2.0 L-VERIFY read at source) is home as `crates/headroom-textcrusher` —
the OFFLINE-ONLY cut: TextCrusher (deterministic extractive prose compressor,
recency + BM25-relevance + salience, one O(n) pass) + the BM25 relevance rung
it calls, VERBATIM with upstream tests riding along. **Beacon cut at source**:
upstream's anonymous telemetry beacon (on by default there) lives in the Python
layer, which is not vendored at all; upstream core's hf-hub model-downloader is
not vendored either. The vendored crate's dependency allowlist is
`regex` + `icu_segmenter` — enforced by tests that scan every source file for
network-capability markers and refuse any dependency outside the allowlist
(`cargo test -p headroom-textcrusher` → 36/36, proofs included).

## The wiring (crates/banchor/src/crush.rs)

`[ref=@eN]` lines and `#` provenance lines are SACRED (M3's every-target-
addressable law); the runs between them crush in place against the GOAL as
the BM25 query. It sits in the live path as the rung BELOW the cap ladder —
agentloop now crushes the leanest probe (0.6→0.4→0.25→0.15) only when every
ladder attempt has failed, refs intact, receipts carrying
`headroom.text-crusher/1` beside `qwen2.5`. `qwen-count --crush R --goal G`
counts any artifact before/after with both ids (the measurement instrument).

## THE NUMBERS (milestone-1 replay corpus, ruler = qwen2.5 via llama.cpp
/tokenize on the compute node, meter key `zagent-banchor-z31-b`, n_ctx 16384)

| page | qwen before | after @0.5 | after @0.25 | segments kept @0.5 |
|---|---|---|---|---|
| example.com (regenerated 2026-09-05 — the M2-era artifact was never committed) | 161 | 161 (passthrough: under `min_segments_for_crush` — correct) | 161 | 7/7 |
| iana.org/help/example-domains (committed 2026-09-04 artifact) | 1,552 | 1,439 | 1,407 | 97/110 |
| en.wikipedia.org/wiki/Chromium_(web_browser) (committed artifact) | 24,092 | 22,510 | 22,137 | 671/962 |

**The honest ceiling:** the protection law bounds the crushable pool — on the
lean-format article artifact 816 of ~1,772 lines carry refs and pass verbatim,
so extractive crushing can reach at most ~20% there; measured 8.1% at 0.25.
example.com honestly saves 0 (nothing to crush). Full data:
`crates/banchor/replays/headroom-z31-measurement.json` (+ per-run JSONs kept
out of the tree; the six raw qwen-count outputs are reproducible with the one
command above against the committed bytes).

Battery: banchor 58 + bsigner 35 + btrezor 13 + headroom-textcrusher 36 =
**142/142 green**, fmt clean. Trap banked: `banchor milestone1` overwrites
committed snapshot artifacts in place — restore-before-commit is now the law
(it bit this session; the clobbered file was restored byte-exact from git).
