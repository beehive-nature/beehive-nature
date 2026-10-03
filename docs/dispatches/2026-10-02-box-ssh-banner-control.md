# Box reachability: control probes before anyone calls it "resource contention"

Seat: Claude (Seat 3). Date: 2026-10-02, evening UTC. Follow-up to
`2026-10-02-three-collisions-to-full-function.md` (box inspection, pending).

## What was reported

Another seat ran the staged read-only inspection and a verbose WSL ssh to
`oracle` (`ubuntu@129.153.202.144`). TCP connected; the SSH banner never
arrived ("Connection timed out during banner exchange", exit 255). The seat
read this as severe resource contention on the box.

## Controls run from this laptop

The house rule applies: uniform failure across every parameter is evidence the
probe is broken until a control says otherwise.

| probe | github.com:22 | 129.153.202.144:22 | 2.25.245.161:22 |
|---|---|---|---|
| bash `/dev/tcp` banner read, 10 s | no banner | no banner | no banner |
| Windows OpenSSH `-v`, no key, 10 s | `Remote protocol version 2.0` | `timed out during banner exchange` | `Remote protocol version 2.0, OpenSSH_10.5` |

The bash probe is broken (it fails the known-good host too) and proves
nothing. The Windows OpenSSH probe is valid: the control answers, the OCI host
does not, and the second host does.

Two more facts from public endpoints:

- `skaists.buzz` resolves to **2.25.245.161**, not to the OCI host. Its NIP-11
  answers `HTTP 200` in 0.41 s (`{"name":"Buzz Relay", ... supported_nips:
  [1,2,10,11,16,17,23,25,29,33,38,42,50,56,43]}`).
- `https://skaists.buzz/` pinned to **129.153.202.144** does not connect at all
  in 12 s (`http=000`, no TCP connect on 443).

## What this does and does not establish

- **Established:** the OCI host's sshd is not completing banner exchange from
  this laptop over a validated client, and its port 443 does not accept
  connections. Its kernel still answers SYN on port 22. That is consistent
  with a wedged or overloaded host, and also with a host whose services moved
  and whose sshd is now rate-limiting or hung. It does not tell which.
- **Established:** the public Buzz relay is served from 2.25.245.161 and is
  healthy at the TLS, HTTP and sshd layers. `LANE_H_SHARED_COMPUTE_2026-08-28`
  placed "two buzz stacks behind dockerized Caddy" on the 4-core ARM Ampere
  host, which is the OCI box. Either the relay moved since 2026-08-28 or
  2.25.245.161 fronts it. Reverse DNS names it `srv2007286.hstgr.cloud`, a Hostinger server. No
  dispatch in `docs/` records a move, but the laptop key `buzz-hostinger-admin`
  dates from 2026-09-24, so the relay has most likely lived on Hostinger since
  about then, and the OCI host is now x0x, bClaude and compute only.
- **Not established:** disk usage on either host. The "87 to 89 percent"
  figure is from the 2026-09-18 Buzz feature map and names "the box" without
  an IP. Until the inspection runs, the relay upgrade plan has no host.

## For the founder's hand

One read-only control that probes both hosts over Windows OpenSSH with the
matching keys, prints disk, memory, containers and the biggest trees, and
refuses nothing but a missing key:

```
powershell -ExecutionPolicy Bypass -File C:\Users\travi\buzz-box-inspect.ps1
```

If the OCI host still gives no banner there, the next step is the OCI console
(serial console or instance metrics), which is RED under the SRE addendum and
founder-only. Nothing on either host was changed by this seat.
