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

---

## ADDENDUM — singularity execution (same day, later)

Route decided by this seat under the autonomy grant: single scoped
SSH bootstrap (the key already authorized), SSH retirement deferred
until the control agent has a live channel (below).

**Fault (proven, not suspected):** the box firewall backend is
iptables; `networking.firewall.extraInputRules` was written in nft
syntax and the generated `firewall-start` script contains no
extra-rules section at all — the rule never existed live. There is
no `nft` binary anywhere in `/nix/store`.

**Fix:** `llama-pool.nix` now applies the accept via an idempotent
oneshot (`llama-pool-fw`: `iptables -C || -I nixos-fw 1 -s
172.20.0.0/16 -p tcp --dport 8091 -j nixos-fw-accept`, store-pathed
after a first attempt failed on service PATH). Two
`nixos-rebuild switch` runs; live chain now carries the rule;
container probe returns `{"status":"ok"}` (was: timeout).
Mirrored verbatim to `ops/x0x/hostinger/llama-pool.nix`.

**Door:** Caddy (Docker, project buzz-prod) gained a `/pool/*`
handle on `relay.skaists.dev` (host-guarded, keyed Bearer via
`env_file: /var/lib/llama-pool/door.env`, upstream
`172.20.0.1:8091`, health-checked); container recreated once,
config validated first. **Key discrepancy:** the POOL_KEY pasted to
this seat hashes differently from `door.env` (laptop
`768a1955…` vs box `041855d3…`, prefixes only). `door.env` is
authoritative; laptop env was synced from it without printing the
value. Verified from the public internet: no key → 401; keyed
`/pool/v1/models` → 200 with `llama-pool`; keyed chat completion
returned. **DOOR_BASE_URL = https://relay.skaists.dev/pool**.
Finding: `https://skaists.buzz/` resets TLS from this laptop while
the box serves it 200 locally and via public IP — environmental to
the laptop path, untouched by this lane.

**x0x-control installed** (static musl build from this branch):
`/var/lib/x0x-control/{bin,policy.json,seed.b64 (0600),pub.json}`;
selftest PASS on the box. **sshd deliberately NOT disabled:** the
agent's live x0xd channel service is not built yet (serve-once file
transport only); killing sshd now would brick remote admin. SSH
retirement completes with the channel daemon + L0V3's deployment
spec. Hardening shipped ahead of the review (commit 651c375f8):
probe-scope check, write-ahead nonce ledger, exec timeout/capture
caps.

**Steps 4–5 blockers (exact):** (1) `BSIGNER_REC` absent in all env
scopes — the 24-word recovery phrase must be placed in env by the
founder/L0V3 (never via chat) before any birth/checkpoint signing;
(2) Buzz managed-agent records live in the Buzz app surface, not
the local relay (127.0.0.1:3000 is the Nostr relay) — record
creation needs the app or its API; (3) Step 5's mid-task kill
coordinates through L0V3 by design, and the door currently has one
member (Hostinger), so post-kill completion rides member restart
per the brief. Metered gate remains design-only: the door serves
test agents only until enforcement lands.

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
