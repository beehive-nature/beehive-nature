# OCI box is dark from the whole internet; x0x v0.46.0 verified off-box

Seat: Claude (Seat 3). Date: 2026-10-03, about 21:30 UTC. Follow-up to
`2026-10-02-box-ssh-banner-control.md`, and a correction to it.

## Result

1. The OCI host `129.153.202.144` does not answer anything from anywhere:
   TCP 22, 80 and 443, ICMP, and UDP 5483 all time out from independent
   vantage points on three continents. This is not an sshd fault and not
   "port 22 filtered while the box is alive". The instance is stopped,
   detached from its public address, or cut off at the OCI network layer.
2. x0x `v0.46.0` is published and its linux-arm64 archive verifies off the
   box, so the verify step of the provenance run is already done and does
   not wait on the host.

## Correction to the 2026-10-02 dispatch

That dispatch said "its kernel still answers SYN on port 22". That was a
false signal. This laptop's current network completes a TCP handshake for
every destination and port, including an address that cannot exist:

| target (from this laptop) | result |
|---|---|
| `192.0.2.1:22` (TEST-NET-1, unroutable) | connects in 5 ms |
| `github.com:54321` (closed port) | connects in 18 ms |
| `129.153.202.144:12700` (loopback-only on the box) | connects |
| `129.153.202.144:22` | connects, then no SSH banner |

A middlebox on the local path accepts the connection and only then tries
the real host. A TCP connect from this laptop therefore proves nothing about
any remote host. The valid local probes are ones that need bytes back from
the far end: the SSH banner, an HTTP status. Those say the same as the
outside view (`ssh -v`: banner timeout; `curl` to 80 and 443: `http=000`).

## Outside view (check-host.net, 3 to 4 nodes per probe)

| probe | 129.153.202.144 (OCI) | 2.25.245.161 (Hostinger, control) |
|---|---|---|
| TCP 22 | timed out on all nodes (IN, IN, RU, US) | connects, 0.09 to 0.20 s (AU, IT, UA) |
| TCP 80 | timed out on all nodes (ES, IR, IR, IT) | not probed |
| TCP 443 | timed out on all nodes (AT, CA, IR, SE) | not probed |
| ICMP | 4 of 4 timeouts on all nodes (DE, ES, US) | not probed |
| UDP 5483 | timeout on all nodes (BR, ES, JP) | not probed |

The control passes, so the probe is sound. Any statement that "the box is
alive, relay HTTPS 200, all doors up" was reading the Hostinger relay, which
is a different machine.

## What restores it

The OCI console, instance page. Three cases, in the order to check them:

- **State is Stopped:** press Start. Oracle stops Always Free instances it
  judges idle and after some maintenance events; nothing else is needed.
- **State is Running:** check that the public IP is still attached to the
  VNIC and that the subnet security list still carries the any/any stateful
  ingress rule; if both hold, Reboot.
- **Instance is gone or terminated:** stop and say so. The box holds the
  x0x identity under `/var/lib/x0x/identity`, the Autonomi store and
  `~/x0x-evidence-20260915/`; recovery then starts from the boot volume.

Start and Reboot are RED under `docs/agents/BUZZ-BOX-SRE-SEAT.md` and this
seat holds no OCI credentials. The console sign-in page is open in the
founder's Chrome at the instances view.

After the host answers, before the 300 s capture: confirm the docker fleet
and `x0x.service` are back and the mesh has re-converged (26 to 27 peers was
the steady state on 2026-09-15), or the comparison against the source-build
receipt is not like for like.

## v0.46.0 verification receipt (linux-arm64-gnu, run in WSL on the laptop)

- Release: published 2026-10-03T08:15:12Z, not draft, not prerelease, 31
  assets (archive, `.sha256`, `.asc`, `.sig` for six platforms, plus
  manifest, custody and skill files).
- Archive digest, computed locally with `sha256sum`:
  `45c11204e61a532c845975705765a8c2ba441ee39822f7ccea789714390decf2` PUBLIC-CONSTANT
  It equals the release `.sha256` file, the `release-manifest.json` entry
  for `aarch64-unknown-linux-gnu`, and the `release-custody.json` entry.
- GPG: `Good signature from "David Irvine (code signing)
  <david@saorsalabs.com>"`, primary key fingerprint
  `CEB3 506E 7DCB 8A2D D2D6 79E8 EDDA 4827 D89C 0F29`. That is the same
  fingerprint recorded in `ops/x0x/README.md` for the 0.41.2, 0.41.3 and
  0.45.0 installs, so this is continuity across four releases, not
  first-use trust in this release's own key file.
- Custody: `source_head` `cea64f20eddc3d8c71cfe4fba7464d3f137eb5c4`, the
  commit the `v0.46.0` tag was recorded at on 2026-10-02.
- `Cargo.toml` at the tag: `version = "0.46.0"`, `ant-quic = "=0.27.54"`,
  every `saorsa-gossip-*` crate pinned `=0.5.86`.
- Archive contents: `x0xd`, `x0x`, `build-provenance.json`, `Cargo.lock`,
  both licences, README. Nothing else.

Not verified: the ML-DSA `.sig` files. The release ships them, but the
verifier is the x0x binary itself and this seat did not execute it; running
it belongs on the box as part of the install.

## Not done

No binary from the archive was executed. Nothing on either host was changed.
No comment was posted upstream. The install, the 300 s capture and the #504
provenance note stay with the seat that staged them.
