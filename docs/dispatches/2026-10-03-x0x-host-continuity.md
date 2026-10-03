# x0x continuity inventory — Oracle unavailable, Hostinger reachable

Date: 2026-10-03. Read-only investigation requested by the founder after the mail TLS host check remained blocked.

## Current observations

- Oracle `129.153.202.144:22`: TCP connection established, but the SSH banner read timed out after five seconds. The earlier authenticated-route attempts also timed out during banner exchange. No remote commands ran. This does not identify freeze, reclamation, resource pressure, filtering or sshd failure.
- `srv2007286.hstgr.cloud` currently resolves to `2.25.245.161`. Port 22 returned `SSH-2.0-OpenSSH_10.5`. SSH service reachability is verified; authenticated access, resource capacity, Buzz deployment and x0x deployment remain UNVERIFIED.
- Windows process census found no `x0xd`/`x0x`. WSL `pgrep -x x0xd` and `pgrep -x antd` returned no pid. No x0x listeners found on 12700, 18080 or TCP 5483. This is a point-in-time inventory, not a census of every user device.
- WSL SSH configuration has `oracle` mapped to `ubuntu@129.153.202.144`. No Hostinger alias was found in the inspected WSL user/system host entries; Windows user SSH config is absent. Never infer a Hostinger username from its banner.
- Asked for the Hostinger SSH alias/username and desired device list; no passwords/private keys requested.

## Existing estate design

`ops/x0x/LAPTOP-NETWORK.md` and the local `C:/Users/travi/x0x-win/` helper inventory confirm that the current supported laptop path is a leased SSH tunnel to Oracle, with no local P2P daemon startup. Oracle supplies the public mesh participation. The tunnel can target another established alias using `BNR_SSH_HOST`, but its x0x/antd/media target ports must first be checked on that host.

The same guide records a prior router-wide outage when laptop mesh traffic ran on the shared building network; its exact cause remains unverified. No local mesh daemon was started during this investigation.

## Upstream facts and boundaries

Oracle's current official Always Free page lists A1 allowance equivalent to 2 OCPUs and 12 GB for Always Free tenancies, and says idle instances can be reclaimed. This makes the founder's resource/reclamation hypothesis plausible, but does not prove what happened to this instance. Confirm lifecycle, shape, metrics and console output in OCI before selecting recovery actions.

Source: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

The current x0x README describes partition tolerance: reachable peers can retain available group data without a global DHT, while data held only behind an unavailable partition stays unavailable. It documents bilateral device enrollment, explicit Home seating, limited owner-profile sync, and notes that DMs and other groups' history do not replicate through that sync. No automatic mail-service migration or universal device synchronization is established by installing x0x.

Source: https://github.com/saorsa-labs/x0x (Partition tolerance and Add a second device sections).

## Recommended next work

Inventory the authenticated Hostinger VPS before adding anything. If capacity and network access permit, use a distinct x0x identity there as a second always-on node; keep Oracle identity/state for recovery rather than assuming it has been backed up or cloning a live machine identity. Keep daemon APIs on loopback and enroll/trust each supported device deliberately. The laptop remains a client through the approved tunnel path until a controlled network profile is established.

Acceptance requires real VPS daemon health, reachable peers, a message sent and read back between enrolled devices, and an Oracle-offline continuity observation. SSH banner receipt alone satisfies none of these mesh gates. Mail sink files, mailboxes, certificates, DNS and service deployment are separate continuity work.

No deployment, credentials, keys, ports, firewall rules, service restarts or device enrollments changed. No runtime proof is claimed for Hostinger x0x.