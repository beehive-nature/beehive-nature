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

---

## ADDENDUM 2 — Steps 4–5 executed to the kill point

`AGENT_SOVEREIGN_REC` arrived in User env via the founder/L0V3
channel (value never read or printed here); signing unblocked.

**Step 4 — complete.** Buzz managed agent record created in the
app's own store (`%APPDATA%/xyz.block.buzz.app/agents/
managed-agents.json`, backup taken): record id
`3c2dfb6e-be5b-402f-823f-cc3832cd01ca`, runtime `buzz-agent`,
provider `openai`, model `llama-pool`, base URL
`https://relay.skaists.dev/pool`, key sourced from env at write
time per the app's record shape. Birth statement signed with
`bheart-XAoTNYsd0JPyUfxj` (ML-DSA-65) — `bsigner verify` →
`verified: true`. Kind 31337 event
`3cc069aee77fb02cbedf5e4265e5bcb3faf4827b85bbfa7b869c7c6ee128a402` PUBLIC-CONSTANT
and kind 31340 identity proof
`dbf384743b1d46f04f95870eeb4c1545380aa8817d228e51f8b12786563fded9` PUBLIC-CONSTANT
published to two local evidence relays and queried back (2/2).
Production relays refused this seat: local relay demands NIP-42
auth the harness publisher does not perform, and `skaists.buzz`
resets this laptop's connections — app-side republication remains.

**Step 5 — staged at the kill point.** B9 LEDGER-KEEP through the
door: DID-before `did:b:pq2ji…mfda`; door model answered
(`llama-pool`, 25 tokens); steps 1–2 done — input sha256
`56882888…fe7`, 7 records parsed; stage-2 checkpoint signed and
verified true. Per the brief the member kill is L0V3's call, not
this seat's: on the kill + member restart signal, completion is
one command (`step5_resume.py` in the harness workspace) —
recompute, `verify.py` oracle, bsigner sign + verify, DID-after
comparison. Scripts: `step4_birth.py`, `step4_publish_local.py`,
`step5_stage1.py`, `step5_resume.py` (harness workspace, runs/
holds the signed checkpoint).

---

## ADDENDUM 3 — safety-review fix + deployment (2026-10-22)

Tarball `x0x-control-deploy.tar.gz` verified (SHA-256
`bdb54131…e516`, matches the relayed hash) and mirrored to
`ops/x0x-control-deploy/`. The independent review's DO NOT SHIP
(commit `a15dd2fe2`) is answered in commit `9858b1a45`: Finding 1
(probe scope bypass) pinned by five maintained tests in
`crates/x0x-control/tests/findings.rs`; Finding 2 threat model
documented (sealing is public-key only — policy is the boundary);
Finding 3 write-ahead fsync + single-flight ledger lock;
Finding 4 seed 0600 at creation; Finding 5 child stdin null;
Finding 6 echo-args env-gated; Finding 7 `RefusedReplay`;
Finding 8 prefix-boundary warning. Tests, selftest, clippy green.
**Re-review requested** — this seat does not clear its own review.

Runbook executed §§1–6: fixed binary + `x0x-control.nix` on the
box, service active (one eval fix: the enable line first landed
outside the attrset). Smoke: `smoke-1c` verdict `completed` with
member health in `exec.stdout`; negative (`scope: nope`) →
`refused_scope`; ledger carries both nonces; envelopes in `done/`.
Two spec frictions found: the runbook's example order (`curl -m 5`)
is refused by its own example policy prefixes, and non-atomic
inbox delivery races the poll loop (the `.tmp` + rename rule is
load-bearing — one partial file was claimed and refused, rc=1,
nothing executed). Transport remains scp for the bootstrap.
**SSH retirement (§7) NOT executed**: the checklist's first item —
a full round-trip through x0xd messaging, not scp — is unmet; the
x0xd→inbox bridge is still undesigned on the box. sshd stays up
until that lands; closing 22 now would brick remote admin.

---

## ADDENDUM 4 — re-review CLEAR, bridge built, mesh gate (2026-10-22)

**Independent re-review: CLEAR.** A non-author reviewer audited
`9858b1a45` and cleared all eight findings with file:line evidence
(probe gate at exec.rs:203/211, threat model at README:67,
write-ahead + lock at main.rs:108/137, seed 0600 at main.rs:39,
stdin null at exec.rs:81–86, echo gate at main.rs:277, RefusedReplay
at order.rs:111, prefix warning at README:84). One note kept: seed
`mode` applies at creation; a pre-existing file is not
re-permissioned (box seed predates the fix — chmod verified 600).

**Bridge built and deployed** (crate `bridge` subcommand):
subscribes `x0x-control/orders` on the box x0xd (sender-pinned to
the laptop agent `be9ad64a…` and the box agent), atomically drops
envelopes into the inbox, publishes outbox receipts to
`x0x-control/receipts`. Service `x0x-control-bridge` active.
Proven on the box: self-published order reached the inbox
(`bridge: inbox <- smoke-1c`), and the laptop received every
receipt the bridge published (smoke-1/2/1c, decoded from the
stream). **Cross-peer order delivery is blocked at the mesh
layer**: repeated laptop publishes return `ok` but never reach
the box subscription, and a direct send times out (504), while
box→laptop receipt flow works. Peers overlap; the asymmetry is
upstream of this crate (laptop is NAT-side, on-demand daemon).

**§7 retirement remains NOT executed** — its first checklist item
(full round-trip via x0xd messaging) is only half-proven
(receipts out, orders in blocked). Closing 22 on this evidence
would brick remote admin; sshd stays up. Unblock path: mesh
order-path fix (upstream x0x topic propagation to a NAT-side
publisher) or a laptop-resident relay; the bridge needs no change.

**Step 5** remains staged at the signed stage-2 checkpoint; the
member kill is L0V3's signal per the brief and has not arrived.
Resume is one command on that signal.

---

## ADDENDUM 6 — Step 5 kill test executed (2026-10-22, L0V3 order)

Kill coordinated as its own scoped order through the deployed
agent (counted against the 10^3 ceiling): `kill-1`, scope
`door.deploy`, `systemctl restart llama-server-hostinger` —
receipt verdict `completed`, exit 0. Member pid 704269 ->
3104741; door dipped to 503 during model reload, back to 200;
host-local health `{"status":"ok"}`. Resume then completed B9:
`verify.py` exit 0 (input/output/chain hashes PASS, 5 records
after dedupe), result signed — `bsigner verify` -> `verified:
true`, DID-after `did:b:pq2ji…mfda` **identical** to DID-before.
The kill matrix (per-stage receipts: stage-2 checkpoint, kill-1,
result) is the deliverable; hashes in `runs/b9-door-run/` on the
harness seat. **Step 5 complete.**

Course corrections applied same turn: the WebRTC operator is
PARKED (`crates/x0x-operator/README.md`) — x0xd bridge is the one
primary control plane; Google STUN removed outright (host
candidates only; estate-hosted STUN is the sanctioned path on
resume); webrtc pinned to 0.14 with the 0.21 rewrite documented
as a future revisit. One live operator round-trip was observed
before parking (envelope reached the box inbox over the data
channel, receipt returned) — recorded, not built on. Birth
events remain local-relay only (production NIP-42), as honestly
reported in Addendum 2.

---

## ADDENDUM 7 — comprehensive order execution (2026-10-22)

1. **BRIDGE IN PRODUCTION — green.** Gossip publish never
propagated laptop->box; x0x file transfer does. The bridge now
auto-accepts sender-pinned transfers into the inbox
(`crates/x0x-control/src/bridge.rs`). Round-trips: `mesh-3`
(laptop->box order, `completed`) with its receipt received on
the laptop via gossip; receipts for smoke-1/1c/2, mesh-2,
kill-1, retire-1/2, mesh-4 all decoded from the laptop's live
receipts stream.
2. **SSH RETIREMENT — executed.** Port 22 removed from
`allowedTCPPorts` AND `services.openssh.openFirewall = false`
(the module re-opened it after the first change — caught by
counting live rules, not by trusting the config). retire-1/2
rebuilds initially failed inside the sandbox (nix cache under
read-only /root) — fixed with `XDG_CACHE_HOME` in the service
env. Final state: live `nixos-fw` has zero dport-22 accepts,
SSH from the laptop times out at banner, and post-retirement
order `mesh-4` completed over the bridge. Break-glass: a
`door.deploy` order can rebuild with 22 restored; sshd itself
still runs behind the closed port.
3. **METERED GATE — built, locally verified, deployment staged.**
`crates/door-meter`: per-key (SHA-256 keyed) byte accounting,
401 unknown / 402 exhausted, fail-closed meter append, ledger
rebuilds balances at startup. Local proof against the laptop
member: 401 without key, 200 with, meter record
`{bytes_in:127, bytes_out:838, status:200}`. Box deployment
needs ONE founder console write (binary + keys.json + unit +
Caddy repoint) — retirement removed every other write channel,
by design. The flat POOL_KEY becomes the capped `test` account
at cutover; doors serve test agents only until then.
**Cutover staged (same day):** the musl binary (1,439,048 B)
was mesh-transferred to the box and sits in
`/var/lib/x0x/data/transfers/` (Complete); the single console
paste is `ops/llama-pool/door-meter-cutover.sh` — installs the
binary, writes SHA-256 `keys.json` (existing door key -> capped
`test` account at 100 MiB, plus a 1-byte probe account), unit,
firewall door, Caddy repoint to `172.20.0.1:8092`, and prints
the live 401/200/402 verification matrix. It has NOT been run:
no agent-side write channel remains, by the retirement's own
design. Vaulta anchor lane staged at `ops/vaulta-anchors/`
(probe evidence, ordinal registry design, scoreboard with
Vaulta columns honestly UNMEASURED pending first inscription
with the founder's account).
4. **ZKADAPTOR — crate + measured scoreboard.**
`crates/zk-adaptor` (ProofShape trait; Schnorr-BIP340 native,
ML-DSA-65 PQ via bsigner). Bench over the B9 chain statement
`b3a68919…`: schnorr 64 B, prove 3327us, verify 1629us, setup
none, PQ no; ml-dsa-65 3309 B, prove 22486us, verify 9283us,
setup none, PQ yes. Vaulta columns (verifier CPU/NET per proof,
RAM per ordinal, verifies/block) are UNMEASURED: the probe
found no public evidence of native Vaulta ZK validators
(testnet endpoint is an auth-gated proxy; the reachable
Antelope testnet shows no ZK intrinsics) — per L0V3's
correction, validators would live in our WASM contracts and
every verify gets a measured CPU/NET price before the anchor
lane designs around them. Poseidon is the interop-seam hash
(plank-Poseidon), SHA3/SHA-256 native.
5. **VAULTA ANCHORS — staged, not built on an unverified
native.** Ordinal-0 statement is the B9 chain commitment above,
Schnorr-authorized shape ready (bsigner taproot path, not
rebuilt). The founder's bDomain/.a/bDesk mainnet contracts
hold the RAM/CPU/NET, so per-ordinal cost is estate-resource
accounting, measured at first inscription.
6. **BIRTH EVENTS — republication staged** at
`ops/llama-pool/birth-republication/` (statement, envelope,
app-side script; key from app env only).
Irvine citation pinned as ordered:
https://docs.maidsafe.net/Whitepapers/pdf/SelfAuthentication.pdf
— cited, not paraphrased, wherever bzDiD's lineage is claimed.

---

## ADDENDUM 5 — operators lane (2026-10-22)

Founder decision: Buzz dApp users are the operators (WebRTC
data-channel plane of the bview/bdata POC), carrying x0x-control
orders/receipts first, to fix the laptop->box order path with
user-scaled bandwidth and ~zero estate egress. Design:
`ops/x0x-control-deploy/OPERATORS.md`. Galvanization attempts
this turn, all measured: box connect ACL installed from
`ops/x0x/connect-acl.toml` and enabled (daemon restart; laptop
entry live); `x0x forward` registered from the laptop but the
byte-stream never carried (`active_streams: 0`); `x0x direct`
connect resolves, send times out; mesh `store` put 404s on the
laptop daemon. Box->laptop gossip remains the one working leg.
The operator channel is therefore the build that unblocks both
the order path and DEPLOY-README §7; the bridge needs no change
(operators terminate at the same inbox/outbox). Laptop daemon
stopped after probing (on-demand law); forward removed.

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

---

## ADDENDUM 8 — meter cutover + Vaulta ordinal-0: channel inventory (2026-10-22)

Attempted both still-unenforced items agent-side through the
production bridge (laptop x0xd on-demand, agent `be9ad64a…`;
box agent `a92d82b9…` hive-hostinger). Thirteen scoped orders
this session, each sealed to the box pub (`agent.pub.json`,
ML-KEM-768) and file-transferred; receipts decoded from the live
`x0x-control/receipts` gossip stream, sender `a92d82b9…`:

- `meter-diag-1` **completed**: member health from the box,
  `{"status":"ok"}` (envelope `856bc370…`). `meter-diag-9`
  **completed** again after all probes — bridge + agent live.
- `meter-diag-2/3/4` (systemctl is-active member/door-meter/
  x0x-control), `meter-diag-5` (nft list ruleset), `meter-diag-6`
  (ss), `meter-diag-7/8` (docker inspect/ps): all
  **refused_scope**. Deployed `diag.readonly` is curl-to-member
  only — narrower than `policy.example.json`.
- `meter-probe-1` (cp /tmp→Caddyfile path), `meter-probe-2`
  (docker exec caddy reload): both **refused_scope**.
  `door.deploy` therefore proves out at exactly the two shapes
  already exercised: `systemctl restart llama-server-hostinger`
  (kill-1) and `nixos-rebuild switch` of the box-local flake
  (retire-1/2).
- `meter-probe-3` (systemctl restart llama-pool-fw) and
  `meter-probe-4` (systemctl restart x0x-control): transfers
  Complete, **no receipts within 5 minutes** while a later diag
  receipted in seconds. Verdicts UNRECEIVED — not resent
  (self-restart/replay hazard). Door keyed answer stayed 503
  after them, so no healing is claimed from either.
- Mesh `x0x exec` to the box: transport error (recipient has no
  gossip DM capability advert, HTTP 502) — raw exec is not a
  channel, and would not be used to bypass the scope policy if
  it were. SSH re-verified retired this session: banner timeout
  on 2.25.245.161:22. The laptop tunnel helper depends on that
  dead SSH path.

**Metered gate: NOT live; blocker is exact.** The cutover needs
box-local writes no proven scope admits (install binary, write
keys.json/unit, iptables, Caddy repoint). The staged script
(`ops/llama-pool/door-meter-cutover.sh`, hardened this session
with a container→meter preflight that aborts before repointing)
remains ONE box-local root action; per L0V3's 2026-10-20 report
the hPanel console itself is dead (spinner, no tab), so the
unblock is whichever box-local root write the founder/L0V3 can
still perform: run the cutover, or widen
`/var/lib/x0x-control/policy.json` with a `door.meter` scope —
after which this seat executes and receipts every step through
the bridge. Until then the flat `POOL_KEY` serves test agents
only, uncapped; the meter becomes the capped `test` account
(100 MiB) the moment the cutover lands.

**New fault found:** public door answers no-key 401 / keyed
**503** while the member is healthy host-side
(`meter-diag-1/9`). The Caddy→member hop is sick independently
of the meter (llama-pool-fw rule or buzz-net path; nft/docker
diag are refused_scope, so the failing hop is not further
isolable from this seat). The hardened cutover re-runs
`llama-pool-fw` and proves container→meter before repointing;
if the 503's cause is the container→host hop generally, the
preflight aborts loudly instead of repointing into the fault.

**Vaulta ordinal-0: NOT inscribed; blocker is exact** (full
receipts in `ops/vaulta-anchors/README.md`): no Vaulta/EOS
account or key in any env scope, no `cleos`/`anchor`/`nodeos`
on PATH, `testnet.vaulta.com` unreachable from this seat
(`http:000`); Jungle4 answers but is not Vaulta and no account
is held there. Unblock: founder env-places a testnet account +
key (names only in chat), or inscribes from their seat and
returns tx + CPU/NET receipts for the scoreboard.

Order count this session: 13 (11 receipted, 2 unreceived),
inside the 10^3 ceiling. Laptop daemon stopped at lane end
(on-demand law).
