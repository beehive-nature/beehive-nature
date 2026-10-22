# 2026-10-20 — spark: door diagnostics, x0x-control agent, metered-gate design

Seat: muse (Spark), worktree `wt-spark-phase1`, branch
`spark/interchangeable-agent-phase1`. Comprehensive autonomous order
executed under the founder's autonomy grant; the route ruling
(x0x bootstrap vs one last SSH) remains the founder's and was not
decided by this seat.

## Lane 1 — door diagnostics (delivered, read-only)

Six verbatim commands ran over `ssh root@2.25.245.161`
(buzz-hostinger-admin key) — outputs reported in full to L0V3.
Headline facts: member listening on `172.20.0.1:8091`
(`llama-server`, health + `/v1/models` answer host-locally);
container on `buzz-prod_buzz-net` times out to the same address;
network `Internal: false`; Caddy on `buzz-prod_buzz-net`.
**Correction:** `nft` is not on the non-login PATH, so the live
ruleset has never been read; the earlier "no 8091 rule" reading is
void, and both `.nix` greps used a literal-`|` pattern. The firewall
question is open until a working `nft` read lands.

Also landed this lane: `POOL_KEY` set (Process + User, value never
printed); agent keydir located and verified by content at
`C:\Users\travi\workspace\hackathon-harness\keys\agent-sovereign`
(`bsigner list` reads `bheart-XAoTNYsd0JPyUfxj`; DID
`did:b:pq2ji3mhmnf5yvjhpeksv6gmro4p7puq6sbrwg62fy7ksrhdmfda`).

## Lane 2 — X0X CONTROL AGENT (built on laptop, not deployed)

New crate `crates/x0x-control` (workspace member added). Design and
honest bounds in its README. In one line: orders sealed with
ML-KEM-768 (bsigner::pq, borrowed crypto) → HKDF-SHA-256 →
AES-256-GCM; scope policy default-deny with exact argv rules;
pre/post state probes gate execution and the Completed verdict;
full verbatim receipts with SHA3-256 state fingerprints; optional
receipt signing via the frozen bsigner CLI only; no shell anywhere.
Selftest covers: sealed roundtrip executes with state verified,
wrong key refused, replayed nonce refused, out-of-scope refused.
Deployment waits on the route ruling — nothing was deployed.

## Lane 3 — METERED GATE (design)

`ops/llama-pool/METERED-GATE.md`: per-key byte accounting into
bMeter (fail-closed, append before inference), settled in bPay,
402 on exhaustion, LOVERnment sub-key caps, door stays a replaceable
adapter. Flat `POOL_KEY` is test-only and capped; enforcement
checklist must clear before serving beyond test agents.

## Lanes held (not failures — gated)

- DOOR LANE fix: awaits founder route ruling. Fix sequence staged:
  working-`nft` ruleset read → accept rule if missing → rebuild →
  container re-probe → Caddy door block → keyed end-to-end verify →
  "door is live" + base URL to L0V3.
- STEPS 4–5: await door-live + URL. On signal: Buzz managed agent
  (provider openai, model `llama-pool`, key from env only), signed
  birth kinds 31337 + 31340 with the verified keydir, then
  Chain-of-Custody with the mid-task kill coordinated through L0V3.

## Lane 4 — quantum circuit adapters (continued from GitHub)

`crates/btungsten-qeval` (bTunGsTeN Quantum Circuit Evaluator &
Reversible GF(16) Synthesizer, from Antigravity/Chief-LoVis-Grok's
`antigravity/btungsten-repro-2026-10-17`, not on main) is now a
workspace member on this branch, adapted to workspace
edition/license. Its milestone tests dev-depend on
`btungsten_wb001::decode_reference`, which existed only on that
branch; the single additive function was ported into
`crates/btungsten-wb001` (direct `decode_core` wrapper, matching the
branch verbatim) rather than importing the branch's optimized
decoder wholesale. Context noted by the founder: the wallet is a
Vaulta/EOS VM in Rust with multiple ZK proving/validation paths —
qeval's GF(16) reversible-circuit work feeds the tower-field proof
side of that stack; no crypto claims beyond the cited sources.

## Receipts

- `cargo test -p x0x-control`: green (0 tests; coverage is the
  selftest below). `x0x-control selftest`: PASS — sealed order
  executed with pre/post state verified; wrong key, replayed nonce,
  and out-of-scope all refused.
- File roundtrip (keygen → send → serve-once): verdict `completed`,
  exec stdout `member-alive`, pre-state SHA3 fingerprint recorded.
- `cargo test -p btungsten-qeval -p btungsten-wb001`: green —
  qeval 16 + 4 + 2, wb001 21 passed, 0 failed.
- `cargo clippy -p x0x-control`: exit 0 (warnings shown are
  pre-existing bsigner KAT dead code, untouched).
- DNS (L0V3, logged not executed here): DNSSEC on `skaists.buzz` +
  `skaists.dev`; dead `relay2.skaists.dev` removed; mail stack left
  pending founder ruling.
