# Astra audit brief — the full map (repos + VPS box), 2026-09-06

For the gpt-6 astra seat, starting a full audit. Read `AGENTS.md` first —
its laws bind the audit too (secrets never printed, dispatch per lane,
worktree discipline once repo access lands).

**Audit corrections (Astra, 2026-09-06):** see
[`2026-09-06-astra-stack-audit.md`](2026-09-06-astra-stack-audit.md) and the
[fresh inventory](2026-09-06-astra-repository-inventory.md).
`beehive-nature/buzz` is still an empty mirror stub; the original mirror
receipt explicitly deferred its full-code push. `skaists.dev` currently
resolves to GitHub Pages, while `skaists.buzz` and `relay.skaists.dev` resolve
to the box. The production Buzz relay container listens on 3000 internally;
the separate **wallet-relay** owns host port 8080. antd HTTP binds the Docker
bridge at `172.18.0.1:8082`, not loopback. The original briefing below is
retained as the audit input, with these corrections taking precedence.

## GitHub — three orgs + one personal account (auth: `loviswaternakamoto`)

### `beehive-nature` — the estate core (audit priority 1)
- **beehive-nature/beehive-nature** — THE monorepo: all web surfaces
  (`surfaces/`, 93 counted), Vaulta contracts (`contracts/` incl. vending +
  escrow), box runbooks (`ops/` = verbatim what runs), the dispatch/spec/raid
  canon (`docs/`), CI with 7 checks (estate-check + university-smoke are
  tree-following). Currently: main @201dbcf0, all green.
- **buzz** — pinned mirror of block/buzz @a2d8be5e (Apache-2.0); the relay
  the estate runs (forks live elsewhere; this is the mirror of record).
- **b-domain** — .b name service for Vaulta/EOSIO.
- **attestation-core**, **market-making-node** (Zano DEX fUSD peg bots),
- **bnri-cosmic** — COSMIC desktop client (AGPL — note the license fence).
- **bnr-design-system** — design lane of record.
- **PixelRefiner** — vendored mirror, pinned v0.11.1 (MIT, verified).
- **midi-blue** — midi.blue door.
- Front-door holdings (audit = DNS/parking only): bnature-buzz, bnr-baby,
  bnr-quest, bnr-lol, beehivenature-buzz, beehivebuds-buzz,
  hivehealth-analytics (+ its -e9a0f797 twin), Trezor-firmware-dApp,
  demo-repository.

### `beehive-biomass` — design/bio wing
- **bnr-design** — D-1 color law as CSS tokens + living styleguide.
- **bNATURE.bio**, **beehivebiomass-buzz** (holding).

### `skaists` — identity wing
- **LOVErnment-DAO** — governance + dApp tree (first out-of-tree kernel
  consumer), **beehive-WELLness**, **sovereignty-explorer** (concept,
  simulated), **buzz** (second mirror), + 11 front-door holdings
  (plur-asia/earth/lat/quest, skaists-art/com/lol/quest/store/xyz/buzz).

### `loviswaternakamoto` (personal) — 49 repos: 2 originals (profile,
PLUR.earth) + 47 third-party forks kept as study material. Audit priority:
low — treat as a library, not estate code.

## The VPS box (audit priority 1)

- **One Oracle Cloud instance**: host `bnr`, aarch64 (Ampere), Ubuntu 24.04.4,
  23 GiB RAM / 45 G disk, public `129.153.202.144` — this is what
  skaists.dev, skaists.buzz, and relay.skaists.dev resolve to.
- **Access:** `wsl -e ssh oracle` from the laptop (user `ubuntu`,
  passwordless sudo). The SSH key lives in WSL — never copy or print it.
- **Front door:** Caddy on 443 proxying estate doors — `/ant` → box antd
  (loopback 8082), `/voice` → voice-scribe (8093), buzz relay (8080) behind
  skaists.buzz + relay.skaists.dev, `/compute` → metered llama.cpp.
- **systemd:** `x0x` (v0.41.3 mesh node, capped 512M, own identity dir
  /var/lib/x0x — runbook `ops/x0x/`), `voice-scribe` (whisper door),
  invite-rotate timers (prod = DRY-RUN by design).
- **docker:** buzz-prod-relay stack (postgres/minio/redis — the live hive),
  rotate-test.local throwaway stack, livekit (7880-7882/3478).
- **Network posture (two layers — audit both):** host iptables INPUT
  default-REJECT with explicit per-port doors (netfilter-persistent; the door
  list IS the expected exposure), and OCI security rules: stateful egress
  UDP-all + an any/any stateful ingress needed by x0x's fragmented PQ
  handshake — its documented retire-trigger is in `ops/x0x/README.md`
  (ships when ant-quic ≥0.27.49 rides a release). VNIC MTU 1500 (netplan,
  was 9000 — jumbo broke bulk streams).
- **Secrets on the box:** `prod.env` files, relay owner key, api-tokens,
  session tokens — env-delivered, NEVER printed, committed, or pasted.
  An audit names where a secret lives and its rotation path; it does not
  reproduce the secret.

## Audit laws (binding)

1. `AGENTS.md` in the monorepo — worktree discipline, hex-law, surface
   ritual, dispatch channel.
2. Findings land as dispatches (`docs/dispatches/`), severity-named, each
   claim citing file/line or the live command that produced it.
3. Licenses: L-VERIFY at HEAD before calling anything adoptable; AGPL
   fences noted where they exist (bnri-cosmic, unicove history).
4. The box is production: read-first, no config edits without a receipted
   reason and a rollback line; `ops/` and the box change together.
5. Nothing long-lived on the building wifi (nodes on the box; everything
   else is a window into it).
