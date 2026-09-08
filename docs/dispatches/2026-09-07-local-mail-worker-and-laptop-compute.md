# Local mail worker live; laptop compute path — 2026-09-07

Founder direction: a local VPS agent handles email, participates in Buzz/bMeshAsi,
and is managed toward autonomous coding; the laptop can contribute compute.

**Shipped:** the first private, draft-only mail worker, running on oracle with the
existing local Qwen model through the existing meter gate. **Not yet shipped:**
Buzz room acknowledgment/management for this worker, coding-job execution, outbound
replies, or laptop compute serving. This is a working first increment, not a claim
that the full coding loop is complete.

## Live receipt (September 8 UTC / September 7 Denver)

- Model discovery on the active backend returned `qwen2.5-3b-instruct`. The older
  `/etc/buzz-compute/api.key` received HTTP 401 from the current backend and gate;
  it was not changed. A dedicated free-tier identity, `bclaude-mail-local-1`, was
  issued through the existing meter CLI as its ledger-owning ubuntu user. The bearer
  was captured privately into `/etc/buzz-mail-triage/api.key`, root 0600, never printed.
- Synthetic meeting email → structured category/summary/draft in **21.5 seconds**,
  with API-reported usage **176 prompt + 41 completion = 217 tokens**. One fixture
  proves connectivity and output shape, not general classification or coding quality.
- The worker-key gate log recorded HTTP **200** for that probe and the first real
  inbox generation. Requests use port 8091 (meter gate), not direct inference port
  8090. No paid balance, price, wallet or settlement action was changed.
- First live bClaude inbox pass: **1 drafted, 2 sensitive_review, 0 failed**.
  Mail content and draft text were not printed in the operator transcript. The two
  holds are keyword-based credential-message flags, not a manual content assessment.
- Synthetic repeat: **0 model calls**. Subsequent live scans also performed **0 calls**
  for the same three messages. Database total attempts remained one for the real inbox.
- `buzz-mail-triage.timer`: enabled, active/waiting, next activation displayed by
  `systemctl list-timers`. Service is oneshot: inactive between successful runs is
  expected. `Result=success`, `ExecMainStatus=0` after deployment and the final update.
- State directory 0700; SQLite database 0600. Original Maildir messages stay untouched.
- **11 tests pass on WSL and oracle**, covering duplicates/Maildir moves, credential
  and HTML holds, attachment exclusion, schema/authority boundaries, symlinks/size,
  private error handling, retry cutoff, daily budget, crash recovery, missing inbox
  failure and private state permissions. No mail was sent and no code job was executed.
- `systemd-analyze verify` accepted both new units. It also emitted pre-existing
  executable-permission warnings for four OCI unified-monitoring-agent unit files;
  those unrelated files were not altered.

Source/deployment parity (SHA-256 prefixes, compared locally and remotely):

| Source | Deployed path | Prefix |
|---|---|---|
| `scripts/buzz-mail/triage.py` | `/opt/buzz-mail/triage.py` | `8c8b6a367f226d2d` |
| `ops/buzz-mail-triage/buzz-mail-triage.service` | `/etc/systemd/system/buzz-mail-triage.service` | `88ae28c894a4bff9` |
| `ops/buzz-mail-triage/buzz-mail-triage.timer` | `/etc/systemd/system/buzz-mail-triage.timer` | `dd1fb469738bc1f7` |

The [operator guide](../../ops/buzz-mail-triage/README.md) names private paths,
limits, credential provisioning, status commands and pause/rollback commands.

## Management and the coding boundary

The mail worker is a persistent data processor, **not** the current Claude ACP
process and not a newly authenticated Buzz identity. It does not repair Claude
login or change `buzz-bclaude`'s owner-only answer policy. It has no mail-send,
shell, attachment execution, browser or coding-dispatch tools. Its private root
access exists only because the existing inbox is root-owned; a coding executor
must use a separate unprivileged identity and isolated worktree.

Codex can inspect/control this service through the existing authenticated SSH
access during work here. The VPS timer continues between sessions. This does not
make this Codex conversation an always-running room listener or establish a new
delegation identity on the relay.

The next complete coding proof remains:

1. Admit an explicitly authorized job under a real owner/delegated identity and
   record its immutable ID, scope and allowed operations. Email From headers,
   email contents and model classifications cannot provide that authority.
2. Acknowledge in the intended private Buzz room; persist queued/running/result
   state. Use the existing ACP seam rather than adding another room transport.
3. Lease one isolated worktree to an unprivileged executor, with bounded CPU,
   memory and runtime. Start with a small real repository task and relevant checks.
4. Return its tested commit/PR and result receipt to the same job. Exercise a
   restart/retry without repeating external side effects.

The local Qwen model is proven for one draft fixture and one real draft, not for
reliable autonomous coding. The executor's model choice requires a coding result
and relevant tests; neither process liveness nor a plausible answer is acceptance.

## Laptop contribution: actual capacity and connection path

Windows CIM inspection of this laptop:

| Resource | Observed |
|---|---|
| CPU | Intel i7-1185G7, 4 physical cores / 8 logical processors |
| Installed usable RAM | 63.4 GiB |
| Available RAM at inspection | 21.5 GiB (changes with other work) |
| GPU | Intel Iris Xe integrated graphics; dedicated VRAM/performance not established |
| Tools | Node, Git, Cargo, WSL Ubuntu available |
| Inference runtime search | No `ollama` / `llama-server` on the searched Windows/WSL PATHs; the inspected node-llama-cpp model cache held an embedding model, not a generative model |

Yes, this hardware can contribute local build/test processes and host suitable
local inference. The room routes requests to a worker/service; it does not acquire
the laptop's RAM as a transparent extension of VPS memory.

Relevant existing source inspected under `C:\Users\travi\buzz-src`:

- `crates/buzz-agent/src/config.rs` and `llm.rs`: custom OpenAI-compatible endpoint
  lane, already used for the box's compute service.
- `crates/buzz-acp/README.md` and harness source: ACP transport to external agents.
- `desktop/src-tauri/Cargo.toml`: mesh-llm is an optional compile-time feature;
  `mesh_llm_stubs.rs` refuses mesh commands when it is absent. Presence of the source
  does not prove the installed Buzz desktop binary enables the feature.

Start the laptop contribution as an **explicit, bounded session**: one worker/job,
CPU/RAM ceiling, cancellation, expiry, and laptop-initiated authenticated transport
to oracle. Any local inference endpoint needs authentication and the existing meter
path before room use. Preserve the
[shared-network operating rule](../../ops/x0x/LAPTOP-NETWORK.md): public mesh daemons
stay on the box; no new laptop x0x/Autonomi node, router forwarding or cloud port is
needed for a narrow worker connection. No sharing daemon, model download, firewall
change or compute offer was activated in this lane.

The intended split is an always-on VPS coordinator/inbox, explicit optional laptop
capacity, and reviewed job/commit receipts. Email triage is now live; the room's
authorized coding loop and laptop worker are the next implementation increments.
