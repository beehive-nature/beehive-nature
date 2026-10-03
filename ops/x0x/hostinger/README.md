# Hostinger always-on x0x node

These files mirror `/etc/nixos/buzz-hostinger/` on `root@2.25.245.161`.
The baseline flake, network/SSH configuration, and Buzz services were retrieved
from the running host. `configuration.nix` adds only the `x0x-service.nix`
import. The existing approved UDP/5483 rule is retained. The service module
pins the official v0.46.0 static musl release for this x86_64 NixOS machine.

Before installing, the archive digest was compared with the official GitHub
release asset and its detached `.asc` signature verified using the release
key whose fingerprint matches the estate's earlier pinned signing key:
`CEB3 506E 7DCB 8A2D D2D6 79E8 EDDA 4827 D89C 0F29`.
This binds the artifact to that signing key; it is not independent identity
certification. Nix verifies the same archive digest on every build.

The daemon runs as the dedicated `x0x` system user. Identity and data are in
`/var/lib/x0x/identity` and `/var/lib/x0x/data`, with private directory/file
modes. Its API binds only to `127.0.0.1:12700`; mesh UDP binds to port 5483.
It is a default Leaf, not a relay. Self-update and remote exec are disabled.
Memory is bounded at 1 GiB, CPU at one core, and tasks at 128. Durable history
has the upstream default size limit; no stronger persistence or backup claim
is made by this service definition.

## Apply and inspect

Copy these source files to the matching remote directory, preserving the
host's flake lock. On Hostinger:

```sh
cd /etc/nixos/buzz-hostinger
nixos-rebuild build --flake .#buzz-hostinger
./result/bin/switch-to-configuration dry-activate
nixos-rebuild switch --flake .#buzz-hostinger
systemctl is-active x0x
systemctl is-enabled x0x
```

Use the daemon's existing authenticated CLI with its API token delivered via
environment from the private token file. Never print the token, copy it into
URLs, or commit the state/identity directories. Prefer scoped SSH forwarding
for device access. A healthy mesh node is not automatic Home enrollment,
room-service migration, or proof of message delivery to every device.

The pre-change source snapshot is
`/etc/nixos/buzz-hostinger.before-x0x-20261003`. The previous NixOS system
profile remains available for rollback. Rolling back source and rebuilding,
or switching the system profile back, does not restore messages or identity
files from a backup; preserve daemon state separately before recovery work.

## Acceptance boundary

Record the active version, enabled unit, peer connectivity and stable
resource footprint, then enroll the intended devices and test real send/read
receipt pairs. An Oracle-offline observation verifies independence only for
the functionality actually exercised. Existing Buzz relay, watch-room media,
Home memberships, account identity and device sync each need their own checks.

Upstream #505 is field-accepted for handshake fragmentation. #622's remaining
budget/measurement work now tracks under #504 (dirvine's September 30 ruling).
The `active_view_size` mitigation is deprecated and inert; it is not used here.
The v0.46.0 tag pins gossip 0.5.86 and ant-quic 0.27.54, meeting the estate's
recorded release capture requirement. The deployment does not claim completion
of #504's delivered/published acceptance matrix.