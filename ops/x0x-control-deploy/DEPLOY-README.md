# x0x-control + x0xd deploy runbook — buzz-hostinger (srv2007286)

STAGING ONLY. Nothing here deploys itself. Each step is written so an
autonomous seat can execute it; every step that changes the box produces a
receipt (x0x-control ledger once live; shell transcripts before that).

## 0. Preconditions

- x0x-control crate builds: `cargo build --release -p x0x-control` on branch
  `spark/interchangeable-agent-phase1` (commit a15dd2fe2 verified; selftest
  PASS, clippy clean per the seat's dispatch).
- x0xd release: v0.46.0 musl tarball, hash recorded from the estate's
  `ops/x0x/hostinger/x0x-service.nix` — NOT independently re-verified.
  Re-verify with `nix-prefetch-url` before first deploy.
- A route to the box exists (first deploy only): the x0x bootstrap still
  needs one privileged session. Under singularity mode the seat decides the
  route; the standing SSH-sunset law means that session is the last of its
  kind — see §8.
- Target paths on the box:
  - binary: `/var/lib/x0x-control/bin/x0x-control`
  - seed: `/var/lib/x0x-control/seed.b64` (0600 root:root)
  - policy: `/var/lib/x0x-control/policy.json` (0600)
  - inbox/outbox/done/processing/ledger: `/var/lib/x0x-control/`
  - x0xd config: `/var/lib/x0x/x0xd.toml` (0600)

## 1. Build (laptop)

```
git fetch origin spark/interchangeable-agent-phase1
git checkout spark/interchangeable-agent-phase1   # or build from the worktree
cargo build --release -p x0x-control
./target/release/x0x-control selftest   # must print PASS
```
Receipt: selftest output.

## 2. Transfer

Copy to the box (route per the seat's decision):
- `target/release/x0x-control` → `/var/lib/x0x-control/bin/x0x-control` (0755)
- `policy.example.json` (this dir) → review, tighten, then → `/var/lib/x0x-control/policy.json` (0600)
- `x0x-control.nix`, `x0xd.nix` → `/etc/nixos/buzz-hostinger/` (or a subdir imported by configuration.nix)
- `x0xd.toml.example` → review, fill `[mesh]`, then → `/var/lib/x0x/x0xd.toml` (0600)

## 3. Keygen ceremony (ON THE BOX)

The KEM seed is born on the box and never leaves it:
```
umask 077
/var/lib/x0x-control/bin/x0x-control keygen \
  --seed-out /var/lib/x0x-control/seed.b64 \
  --pub-out /var/lib/x0x-control/agent.pub.json
chmod 600 /var/lib/x0x-control/seed.b64 /var/lib/x0x-control/policy.json
```
Bring `agent.pub.json` (encapsulation key, public) back to the operator seat.
The seed file is 64 bytes base64; `serve-once` refuses anything else. Verify:
`wc -c` shows the file exists and `stat -c %a` shows 600. Never cat it.

## 4. Wire the flake and switch

In `/etc/nixos/buzz-hostinger/configuration.nix` (or its imports):
```nix
imports = [ ./x0x-control.nix ./x0xd.nix ];
services.x0x-control.enable = true;
services.x0xd.enable = true;
# services.x0xd.binaryPath = "/var/lib/x0x/bin/x0xd";  # manual-install override
```
Then:
```
nixos-rebuild switch --flake /etc/nixos/buzz-hostinger#buzz-hostinger
systemctl status x0x-control x0x --no-pager
```
Receipts: rebuild output, both units active. If x0xd was already running
under another unit, reconcile first — one daemon per box.

## 5. Smoke test (read-only order, end to end)

On the operator seat (holds `agent.pub.json`), craft the order:
```json
{
  "id": "smoke-1",
  "scope": "diag.readonly",
  "argv": ["/run/current-system/sw/bin/curl", "-s", "-m", "5", "http://172.20.0.1:8091/health"],
  "issued_by": "operator",
  "nonce": "smoke-1-<unix-ts>",
  "expires_at": 1893456000,
  "pre": [], "post": []
}
```
Seal it: `x0x-control send --pub agent.pub.json --order smoke-1.json --out smoke-1.order.json`.
Deliver the envelope to the box inbox atomically:
`... > /var/lib/x0x-control/inbox/smoke-1.order.json.tmp && mv ... inbox/smoke-1.order.json`
(transport: x0xd messaging once bridged; scp for the bootstrap).
Within ~2 poll cycles, expect:
- `/var/lib/x0x-control/outbox/smoke-1.receipt.json` with `"verdict": "completed"`
  and the health JSON in `exec.stdout`
- `/var/lib/x0x-control/ledger` contains the nonce
- the envelope moved to `/var/lib/x0x-control/done/`

Then a negative test: same order with `"scope": "nope"` → verdict
`refused_scope`, nothing executed. Both receipts are the proof.

## 6. Policy tightening (before any privileged scope is used)

`policy.example.json` is a starting point, not a finished policy:
- Replace `/run/current-system/sw/bin/*` argv0s with the exact resolved
  paths from the target generation if you want generation-pinning
  (current-system symlinks are the pragmatic default).
- Narrow `arg_prefixes` per rule; remember `max_args: 0` means "no
  arguments at all".
- Policy is re-read on every order — no service restart needed to tighten.

## 7. SSH-retirement checklist (founder-scope; do not improvise)

Only after steps 1–6 are green AND the x0xd mesh carries orders reliably:
1. Confirm a full order round-trip (smoke + negative) through x0x messaging,
   not scp.
2. Confirm receipts land signed (if receipt signing enabled) and the ledger
   is append-only.
3. Close TCP 22 in the NixOS firewall config; keep ONE break-glass path
   documented (hPanel console credentials in the vault, or a second
   x0x-control scope) — removing all access paths is how boxes get bricked.
4. Remove the laptop's authorized root key only when the break-glass path is
   tested.
5. Record the retirement in a dispatch: date, what was closed, what remains.

## 8. Singularity-mode accounting

Under the standing order (no gating on the founder; 10^3 scoped autonomous
orders ceiling): every x0x-control order counts as one scoped autonomous
order. The crate's ledger + verbatim receipts ARE the accounting — do not
run orders you cannot receipt. Refusals also count as orders (they carry
receipts). Past the ceiling, or outside the policy's scopes: stop.

## Honest unknowns (re-verify on the box)

- x0xd v0.46.0 tarball hash: copied from the branch file, not re-verified.
- x0xd loopback API (127.0.0.1:12700) message shape: the inbox bridge
  (x0xd → inbox drop dir) is this spec's design, not a verified API.
- `/run/current-system/sw/bin/nft` path: assumed; confirm on the box
  (earlier diagnostics showed `nft` missing from non-login PATH).
- Whether x0xd already runs on buzz-hostinger under another unit.
- No long-running `serve` subcommand exists in the crate; the poll loop is
  the judged interim. A native serve mode is future crate work.
