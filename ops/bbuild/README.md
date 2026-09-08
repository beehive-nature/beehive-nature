# Supervised coding on the VPS and an optional laptop worker

The VPS keeps a reviewed job queue, asks its local model for a bounded edit, and
posts acknowledgments/results in the private owner/bClaude Buzz DM. A worker pulls
an expiring job lease, tests the edit in an isolated worktree, and returns a Git
bundle. The VPS independently reruns the checks. Codex reviews and publishes the
returned commit. Publication and production deployment are separate operations.

This first implementation supports one reviewed recipe,
`mail-attachment-boundary-v1`, editing only `extract` in
`scripts/buzz-mail/triage.py`. It is not a general free-form coding agent. Email,
ordinary Buzz messages, and model output cannot create jobs or expand that scope.

## What runs

| Component | Location / behavior |
|---|---|
| Broker | `/opt/bnr-build/broker.py`; `bnr-build-broker.timer`, 30 seconds after inactivity |
| VPS executor | `/opt/bnr-build/worker.py --worker vps --once`; `bnr-build-vps.timer` |
| Independent verifier | `/opt/bnr-build/verify_return.py`; `bnr-build-verify.timer` |
| Model | Existing local `qwen2.5-3b-instruct`, through meter gate `172.18.0.1:8091` |
| Build key | `bclaude-build-local-1`, existing free tier; no price/balance/settlement change |
| State | `/var/lib/bnr-build`, private JSON jobs, signed outbox, bare cache, bundles and verification worktrees |
| Credentials | `/etc/bnr-build/credentials/{model.key,buzz.nsec}`, 0600; never printed or passed to test code |
| Owner room | `/etc/bnr-build/config.json`; both private visibility and the exact two-member roster are checked before each send |
| Laptop | WSL user-systemd session, CPU quota 150% (1.5 cores), memory 2 GiB, 128 tasks, maximum 600 seconds, no automatic renewal |

`tools/bbuild/*.py` is installed verbatim under `/opt/bnr-build`. The six units and
AppArmor profile in this directory are the deployed text. `share.sh` / `share.ps1`
are laptop entry points; no laptop public mesh daemon or inbound listener starts.
The worker opens an outbound SSH control connection to the existing `oracle` alias;
an uncached Git base is fetched from the fixed public repository.

The existing Claude ACP service is unchanged and still lacks demonstrated provider
authentication. This build lane uses the same Buzz relay HTTP bridge, with NIP-98
authentication and kind-9 messages, rather than claiming that Claude now works.
Source contract: Buzz `RestClient::sign_nip98` / `submit_event`,
`buzz_sdk::build_message`, and this lane's `Buzz.request` / `deliver`.
Private-room access is relay-enforced; no new end-to-end encryption claim is made.

## Admission, retries and publication

On oracle, as the authenticated operator (ubuntu):

```sh
python3 /opt/bnr-build/broker.py status
python3 /opt/bnr-build/broker.py enqueue --id <job-id> --base <full-commit> --worker laptop
```

`enqueue` fixes the recipe, base commit, source-region hash and independent
validator hash. Reusing an ID with different scope is refused. Only this operator
CLI admits work in this version; a room mention is not an execution authorization.

The model gets two attempts, then the job needs attention. After a diagnosed
adapter repair, operator `retry --id <job-id>` grants two more attempts and records
the previous count/error. It does not erase history. `supervise --id <job-id>` accepts
a JSON `replacement` on stdin only for a failed job, preserves the failed proposal,
marks the author as **Codex supervisor**, and keeps the same source scope.

Lease tokens fence out expired/replaced workers. A tested commit created before
a delivery failure can be reused after repeating tests and checking its parent,
changed path and content. Signed Buzz events are saved before transmission; retries
reuse the same event and read back its ID. This is a scoped restart/retry protocol,
not a claim of exactly-once distributed execution or hardware attestation.

`finish` imports the worker bundle only when its parent, sole changed path, exact
replacement, required check names and validator hash match the admitted job. The
independent VPS verifier must then succeed. Operator `publish --id <job-id>
--commit <full-commit>` additionally fetches that exact commit from the fixed public
repository and compares its source with the worker result before posting publication.
No worker carries GitHub push credentials or deploys production code.

## Laptop controls

From this worktree on Windows:

```powershell
.\tools\bbuild\share.ps1 up
.\tools\bbuild\share.ps1 status
.\tools\bbuild\share.ps1 down
```

Or use `bash tools/bbuild/share.sh up|status|down` inside WSL. A session ends after
one job or its lease. The whole user-systemd cgroup is stopped on timeout/cancel,
including SSH. An old session cannot stop a replacement; each gets its own unit
and control socket. Source, test output and return bundles remain private under
`~/.local/share/bnr-build` for review. This is CPU/RAM contribution for actual
build/test work, not transparent pooled RAM, GPU sharing, or a native mesh-LLM offer.

## Execution boundary and Ubuntu provisioning

Test code runs under bubblewrap with a read-only worktree and runtime, fresh `/tmp`,
cleared environment, hidden home/credentials, separate network/PID/user namespaces,
and nested user namespaces disabled. Boundary probes check those properties; the
service supplies CPU, memory, task and wall-time limits. The controller runs as
ubuntu on the VPS and travi in WSL; generated code runs only inside that test sandbox.

On oracle, Ubuntu initially denied bubblewrap's namespace setup. The distro
`bubblewrap` package was installed; a root-owned copy at `/opt/bnr-build/bwrap`
has the dedicated `/etc/apparmor.d/bnr-build-bwrap` profile in this directory.
This uses Ubuntu's documented [per-application namespace admission](https://ubuntu.com/blog/ubuntu-23-10-restricted-unprivileged-user-namespaces),
with [AppArmor restrictions](https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/)
still enabled globally. The worker also passes `--disable-userns` for its children.
Refresh that root-owned copy when the distro package is updated, compare hashes,
and rerun the boundary checks. No host-wide sysctl was loosened and no reboot occurred.

The x0x daemon remains on the VPS. It was connected with 30 send-ready peers in
this lane's check; its remote-exec ACL remains closed. x0x is not this job's transport
or its authority. Buzz carries receipts; SSH carries the laptop lease/result. This
respects the existing [shared-network rule](../x0x/LAPTOP-NETWORK.md).

Pause the new VPS services without touching mail or x0x:

```sh
sudo systemctl disable --now bnr-build-broker.timer bnr-build-vps.timer bnr-build-verify.timer
sudo systemctl stop bnr-build-broker.service bnr-build-vps.service bnr-build-verify.service
```

The private job state remains available. Do not flush the mail queue or remove
worktrees/credentials as part of a pause.
