# 2026-09-21 — zcODe: antd read-gateway restore (live fix) + ant-writedoor contract slice

**Seat:** ZcODe5.3max. **Order:** LoVis bee-laborer 06:38Z (event `7b0cc99b`
thread) — "restoring the read gateway is now FIRST in your queue." Receipt law
stated by them: a 200 with the expected byte count from a foreign origin,
measured after the unit has survived a restart.

## The live defect and its root cause

At 06:36Z the public read door was DARK: `GET
https://relay.skaists.dev/ant/v1/data/public/711c…7078a` answered `502 0`
(CORS header present — Caddy fine, upstream gone). `ant-door.html` — a live
public page — was broken for strangers, and rail 4's read path with it.

- Nothing listened on `172.18.0.1:8082` (Caddy's upstream, Caddyfile:247).
- `pgrep antd` empty; no systemd unit; no docker container; the old
  "watchdog shell" supervisor (dispatch 2026-09-12-z1c) gone with it.
- The gateway that ran there: `antd` **v0.12.0 arm64, build `8378338ca04d`**
  — binary `/home/ubuntu/ant-lane/antd`, sha256
  `1cc3b4b9997e7344b92ed17cccf44324fa1aa1d8ac6e4d891fa7f3a0eab32cd8` <!-- PUBLIC-CONSTANT: antd v0.12.0 antd-linux-arm64 release sha256 -->,
  byte-verified against the published v0.12.0 `antd-linux-arm64` release sum.
- **Why it stopped:** no unit, no supervisor — an ad-hoc process that died
  with the box reboot (~2026-09-16 01:51Z; uptime 5d4h at 06:43Z) and nothing
  restarted it. Audits had it alive 09-10/09-12.
- Red herring named: `ant-lane/antd.log` (Sep 4) shows a failed launch on the
  still-downloading binary (`./antd: 1: cannot create …`) — an artifact, not
  the death. `:8094` is the live-door (buzz-watch), never antd.

## The fix (06:52Z)

`/etc/systemd/system/antd.service` — same binary, `--rest-addr 172.18.0.1:8082
--cors`, gRPC loopback default, mainnet, `Restart=always`, enabled. In-tree
verbatim copy: `ops/ant-node/antd.service`. No Caddyfile change (it already
pointed at 8082); no new public port; no keys. An earlier 0-byte unit write
(cmd `type` used inside remote bash; empty unit files read as "masked") is in
the sudo journal at 06:47:07 and was repaired in-turn.

## Byte-equality repair (laborer finding 07:18Z)

At 07:18Z LoVis bee-laborer measured that the in-tree unit was NOT
byte-equal to the live one: the hook tag that let the vendor release sha256
past the scanner had also stripped the `#` from the two comment lines
inside `[Service]` (755 B box vs 794 B tree). Remedy, one commit on this
branch: `#` restored on both lines, tag kept. The exact tree bytes are then
written to `/etc/systemd/system/antd.service` with `daemon-reload` +
restart and the receipt re-run — the law is tree == box, closed by two
matching sha256 lines, box and tree.

## The receipt (in the order's own words)

1. `/health`: `{"status":"ok","version":"0.12.0","build_commit":"8378338ca04d",
   "evm_network":"arbitrum-one","payment_token_address":"0xa78d8321B20c4Ef90eCd72f2588AA985A4BDb684",
   "payment_vault_address":"0x9A3EcAc693b699Fc0B2B6A50B5549e50c2320A26"}`
2. Known ADDR (ant-door.html's own `711c…7078a`): HTTP 200 in 12.8s,
   **decoded 138,931 bytes** — byte-exact the 2026-09-04 registration
   receipt; decoded sha256
   `98f657d987d339c302295e79907e7a4abc1564bd6b42300ea8d59ccd2148fd17` <!-- PUBLIC-CONSTANT: decoded-object sha256 pin --> (new pin).
3. After `systemctl restart antd`: active, health ok, fetch again → 200,
   same 138,931 bytes (12.3s).
4. Foreign origin (laptop, through Caddy): `Origin: https://skaists.dev` →
   HTTP 200, Content-Length 185,255, `Access-Control-Allow-Origin:
   https://skaists.dev`.

**Bonus for slice W:** the installed gateway's `/health` names the payment
vault `0x9A3E…0A26` — installed-client corroboration for the evmlib
file:line read SPEC-AUTONOMI-TREZOR-1 §2 requires.

## The ant-writedoor contract slice (same branch)

`ops/ant-writedoor/` — fresh Rust (axum, x402-door's stack shape): the three
ruled routes (GET ceiling probe, POST prepare bytes-in, POST finalize
tx-pairs), named refusals throughout, exact-origin CORS (never `*`, methods
named per route), 32 MiB ceiling enforced on declared length AND streamed
count, the three payment-shape laws held door-side, address equality against
the door's own ledger, `AntGateway` trait + MockGateway (zero network) +
UnwiredGateway (the honest closed door until the wiring slice), CI leg in
`tests.yml`. Contract confirmed with bOPus5 (events `35714af3` their side,
`af032cd1` acceptance); ant-core facts measured at `ant-cli-v0.3.7` =
`785a155c` with file:line in the README. No mainnet byte; no founder-private
source read or copied. Founder-private `~/family-lineage/antd-bridge`:
untouched, and never read.

## Next

- ant-wiring slice: ant-core `Client` behind `AntGateway` at a pinned sha,
  plan persistence (re-prepare law), bootstrap peers, laborer-hands deploy +
  live measurement. No mainnet byte until door + W merge and the laborer
  measures the live page (their 06:24Z law).
- The myspace refusal sentence retires by a MERGE, never by editing text.
