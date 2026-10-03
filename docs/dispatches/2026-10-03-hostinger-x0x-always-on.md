# Hostinger x0x always-on deployment — 2026-10-03

## Result

Installed and activated official x0x v0.46.0 as an enabled NixOS system service on the existing Hostinger VPS. Authenticated using the already-installed laptop key; no SSH keys or permissions changed. A separate daemon restart preserved the new machine/agent identity and returned healthy with 19 peers / 19 send-ready peers. Existing Buzz relay container remained healthy throughout.

Hostinger's signed-in panel identifies the correct VPS as `2007286`, not the supplied `hotingervps.com/3245/` address, which could not be accessed. Dashboard: https://hpanel.hostinger.com/vps/2007286/overview . Panel and authenticated SSH agree on `root@2.25.245.161`, `srv2007286.hstgr.cloud`, NixOS 26.05, 8 cores / 32 GB RAM. SSH hostname is `buzz-hostinger`, architecture x86_64. Before deployment: about 29.5 GB RAM available; root filesystem 45 GB used of 394 GB. This replaces the earlier login-UNVERIFIED boundary with a real authenticated inventory.

The founder's supplied public key differs from the installed laptop public key. It was not needed to establish access and was not added to authorized_keys. No private-key contents or API/session tokens were printed, committed or pasted.

## Artifact verification and upstream priority

Official release tag `v0.46.0` published 2026-10-03T08:15:12Z. Its Cargo.toml pins gossip `=0.5.86` and ant-quic `=0.27.54`, meeting the estate's recorded requirement of the v0.46.0 tag plus gossip >=0.5.83.

Archive: https://github.com/saorsa-labs/x0x/releases/download/v0.46.0/x0x-linux-x64-musl.tar.gz

SHA-256: `79941941e9d72311055cf6ed62829c4a63abab86dc7460d204fdcb74d50ed0aa` PUBLIC-CONSTANT

Verified against the official release asset digest locally, verified the detached `.asc` signature with GPG, then rechecked the same archive digest on Hostinger after transfer. GPG reported Good signature from David Irvine (code signing), fingerprint `CEB3 506E 7DCB 8A2D D2D6 79E8 EDDA 4827 D89C 0F29`, matching the estate's historical pinned key. Trust remains bound to that key, not independently certified ownership. The first local signature attempt failed because the bundled GPG interpreted Windows paths incorrectly; it was rerun with explicit MSYS paths and passed. No signature bypass.

Read dirvine's current #622, #505 and #504 replies before deployment. #505 is field-accepted; #622's remaining slices/per-pair measurement moved to #504 on September 30. Old `active_view_size` mitigation is inert and not used. This deployment does not claim #504 delivered/published acceptance or a fleet-wide byte budget.

## Deployment shape

`ops/x0x/hostinger/` mirrors all six remote source files under `/etc/nixos/buzz-hostinger/`: flake.nix, flake.lock, configuration.nix, buzz-services.nix, x0x-service.nix and x0xd.toml. The first four were retrieved from the live host; the sole baseline change is the extra x0x-service import in configuration.nix. The existing approved UDP/5483 NixOS firewall rule was already active. No cloud rule or new firewall port changed.

The module fetches the official static musl archive with a fixed digest into the Nix store. Dedicated user/group `x0x`; identity `/var/lib/x0x/identity`; data `/var/lib/x0x/data`; state directories mode 0700 and API token mode 0600, owned by x0x. API `127.0.0.1:12700` only; mesh UDP/5483. Default Leaf participation, peer relay off, self-update off, remote exec disabled with `acl_missing`. No connect ACL floor added. Service caps: MemoryMax 1 GiB, MemoryHigh 768 MiB, CPUQuota 100%, TasksMax 128; sandbox includes ProtectSystem=strict, ProtectHome, PrivateTmp and empty capabilities. Display/machine labels: `hive-hostinger` / `buzz-hostinger`.

Build: `nixos-rebuild build --flake .#buzz-hostinger` exited 0. Dry activation predicted a dbus-broker reload. `nixos-rebuild switch --flake .#buzz-hostinger` exited 0 and started x0x.service; no Buzz containers restarted. The resulting system is `/nix/store/0jqfqzad7j2wyw2xcw1d2c2rvs861izg-nixos-system-buzz-hostinger-26.05.20260829.c5c4a43`. The pre-change source snapshot is `/etc/nixos/buzz-hostinger.before-x0x-20261003`; the prior system generation is retained.

## Runtime receipts

- `systemctl is-enabled x0x`: enabled. ActiveState=active, SubState=running, NRestarts=0.
- `ss`: API listens only on 127.0.0.1:12700; x0xd owns UDP/5483.
- Before daemon restart: health version 0.46.0, healthy, 19 peers / 19 send-ready peers at uptime 80 s.
- After daemon-only restart: same IDs below; healthy, 19 peers / 19 send-ready peers at uptime 10 s; RSS accounted by systemd about 70 MB; Buzz relay still healthy.
- Public agent ID: `a92d82b91fb9741fa4846064efce063b2e86019bdf4883a71d7e4bc958d55bb4` PUBLIC-CONSTANT
- Public machine ID: `30018ca4296ebdd7a6330468e0ce57ae2c09d084f42830ab8a4f0ec7187a1e71` PUBLIC-CONSTANT
- Transport diagnostics report FullCone NAT and connected peers. Peer count is connectivity evidence; it is not a send/read receipt from a user device.

Initial check using `/etc/x0x/x0xd.toml` failed before deployment because that new path did not yet exist. The staged source path check passed before the rebuild. Both failure and correction are recorded; no running service depended on the failed pre-install check.

## Remaining boundaries

The Hostinger daemon operates independently of Oracle. Oracle is still inaccessible through SSH; no Oracle data, identity or mail service was recovered. Device/Home enrollment and real room message send/read receipts remain pending the desired device inventory and enrollment authority; no claim that every device is connected.

Buzz production relay/Postgres/Redis/MinIO/antd/Caddy were already running on Hostinger. x0x transport availability does not automatically change Buzz's room routing. The watch-room POC also needs RTMP, ffmpeg, Caddy routes and its session gate; these were not migrated in this lane. Existing Oracle-specific antd tunnel target `172.18.0.1:8082` failed on Hostinger, so the laptop's current helper was not silently retargeted. No laptop mesh daemon was started and no SSH key was copied into WSL.

Always-on means enabled at boot with restart policy, not a completed VPS reboot test or uptime SLA. This lane restarted only x0x, preserving the production Buzz containers. Short startup traffic/resource measurements are not a long-term bandwidth guarantee.
First 30-second systemd IP-accounting sample during early reconvergence: 256,740,849 egress bytes. At its end the daemon had 23 peers, uptime 51 s, MemoryCurrent 92,753,920 bytes and zero automatic restarts. This is substantial startup traffic, not an idle bandwidth guarantee. A settled sample follows before final acceptance.

Live source SHA-256 pins:
- configuration.nix: `621b7fdd03f2082da7aab58703f6610d40207d9a9f84c3851d9ee0938f441b56` PUBLIC-CONSTANT
- x0x-service.nix: `596dbdf661c0ef7660739f7cf8adc5c62805c8f3347a709ce51b9f779179075d` PUBLIC-CONSTANT
- x0xd.toml: `76025d82fc1e66b4ba50b389afe0a16ea85c6950d3bac1c960d49abbdd94a9c0` PUBLIC-CONSTANT
Later 30-second sample (uptime 107→137 s): 37,597,296 egress bytes and 42,620,378 ingress bytes; 23 peers / 23 send-ready peers, healthy, NRestarts=0, MemoryCurrent 79,237,120 bytes. Egress declined from the earlier startup burst to about 1.25 MB/s in this sample. This measured window supports leaving the node running within the VPS's observed 32 TB monthly allowance, but does not establish a future traffic ceiling or #504 acceptance. No sustained-traffic test was run on the shared laptop network.

Local source hashes match the three live deployment source pins. `git diff --check` and staged secret scan passed. Actual Nix build, dry activation, switch, API/UDP binding checks, authenticated mesh health, remote-exec-disabled inspection, daemon-only identity persistence, and unchanged healthy Buzz relay checks were completed on the deployed host. Broad repository CI is deferred to the PR; these runtime results are not a claim that every repository check passes.