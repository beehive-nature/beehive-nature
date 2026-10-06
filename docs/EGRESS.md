# EGRESS — every outbound URL in the BNR stack, and the switch that kills it

**Why this file exists:** sovereignty claims are only auditable if the egress surface
is written down (RAID_AUTHENTIK_IDP_PATTERNS §14 — authentik's air-gapped.mdx is the
model: one page, every outbound URL, the exact flag for each). This is that page for
BNR. **Rule: a PR that adds an outbound URL adds a row here, or it is incomplete.**

Verified by tree sweep 2026-08-14 (`grep -rE 'https?://' crates/*/src ops/`). No
telemetry, analytics, or phone-home endpoints exist anywhere in the stack — every
row below is a data-plane call the user's operation asked for.

## wallet-relay (serves users — strictest surface)

| endpoint | purpose | default host(s) | override / kill |
|---|---|---|---|
| gateway pool | AR GraphQL + raw reads | `127.0.0.1:3000` (self-hosted primary), `arweave.net`, `permagate.io` (fallbacks) | `RELAY_GATEWAYS` (refuses <2 distinct); self-host-only = list your own ×2 |
| upload forward | validated Ed25519 DataItems → bundler | none (validate-only) | `RELAY_FORWARD_TO` unset = no egress |
| Stellar adapter | balance read | `horizon.stellar.org` | `StellarAdapter::with_url` (env wiring TODO — flagged below) |
| Solana adapter | balance read | `api.mainnet-beta.solana.com` | `SolanaAdapter::with_url` |
| Hive adapter | balance + RC read | `api.hive.blog` | `HiveAdapter::with_url` |
| Vaulta adapter | balance + identity read | `eos.greymass.com` (**corrected 2026-08-14** — was `wax.eosrio.io`, the WAX chain, chain_id `1064487b…` ≠ Vaulta `aca376f2…`) | `VaultaAdapter::with_url` |

## surfaces/onboarding (served pages)

| endpoint | purpose | when it fires | override / kill |
|---|---|---|---|
| `connect.trezor.io` | Trezor Connect (the pinned `/9.7.3/trezor-connect.js` with SRI, the same build the wallet loads) — official device rail. On the Connect press only: one local check for the Trezor Suite desktop app at `ws://127.0.0.1:21335/connect-ws` (Bluetooth and USB through Suite), otherwise hosted Suite web in a window (`suite.trezor.io`, browser USB); never the legacy in-page iframe | **On the user ENTERING the Trezor step** (they clicked the Trezor card — explicit rail choice; preloading there keeps the connect popup inside the click's gesture window, or browsers silently block it) | Never enter the Trezor step, or use the device-less walkthrough (custody stays Declared). bSAFE 7 lane replaces this with native transport in our own dashboard |

## surfaces/wallet.html (served page)

| endpoint | purpose | when it fires | override / kill |
|---|---|---|---|
| `relay.damus.io`, `nos.lol`, `relay.snort.social` (wss) | QR bridge v2: ephemeral kind-20107 events carrying the desktop's X-Wing key and the phone's sealed grant (ciphertext only) | only while a QR bridge is open (desktop shows a code, or the phone presses allow) | `QR_RELAYS` in wallet.html; close the bridge |
| `a.pool.opentimestamps.org`, `b.pool.opentimestamps.org`, `a.pool.eternitywall.com` | OpenTimestamps: POST /digest with the SHA-256 of a PQ binding (32 bytes, nothing else) | only when the person presses "timestamp it on Bitcoin" after making a binding | `PQ_OTS_CALENDARS` in wallet.html; do not press |
| `eos.hyperion.eosrio.io`, then `eos.eosusa.io` | Hyperion history: GET `/v2/history/get_transaction?id=` with the one-paste transaction's id (a public id, nothing else), to tell whether a block holds it | only while a one-paste send is read for its outcome, and only when no Vaulta host answers `get_transaction_status` for it | `HYPERION` in wallet.html |

## atmirror (mirror pipeline)

| endpoint | purpose | default host(s) | override / kill |
|---|---|---|---|
| bundler | ANS-104 DataItem upload | `upload.ardrive.io` | constructor `bundler` arg |
| gateways | reads/probes | `arweave.net`, `permagate.io` | constructor `gateways` arg |
| DID directory | identity truth (never the PDS) | `plc.directory` | CLI arg |
| PDS / AppView | repo fetch (`getRepo` is public) | per-DID (e.g. `*.host.bsky.network`), `public.api.bsky.app` | derived from the DID doc; AppView via CLI arg |

## adapter-arweave

| endpoint | purpose | default host(s) | override / kill |
|---|---|---|---|
| gateway list | AR reads | `ar-io.bnature.social` (BNR-hosted), `arweave.net`, `ar-io.dev` | constructor list |

## ops/phase0 (VPS, deploy-time)

| endpoint | purpose | default host(s) | override / kill |
|---|---|---|---|
| ar-io-node trusted node/gateway | sync + proxy while our index backfills | `arweave.net` | `TRUSTED_NODE_URL` / `TRUSTED_GATEWAY_URL` in `ops/phase0/ar-io-node.env`; full air-gap = point at another self-hosted node |
| antnode | Autonomi network join | Autonomi P2P bootstrap (protocol-defined) | network choice at deploy |

## Other crates

| crate | endpoint | note |
|---|---|---|
| bsigner | `evm-tst3.exsat.network` | exSat TESTNET registry entry — testnet-only by construction |
| price-feed | `ams.usda.gov/mnreports/fvhemp` | hemp-seed price series (documented source, not an oracle) |
| ceremony scripts (`docs/dispatches/ceremony/`) | npm registry, Turbo (`upload.ardrive.io` family), Stripe checkout | founder-run, one-time, by design |

## tools/net-doxx (tungsten test harness, founder-run only)

| endpoint | purpose | when it fires | override / kill |
|---|---|---|---|
| `config.doxx.net/v1/` | doxx NETWORK adapter: read state, create and delete three test tunnels, add and remove firewall rules, mint one role=device credential | only when the founder runs `tools/net-doxx/live.sh`; never in CI (tests use a fake) | do not run the script; the token is typed per run and never stored |
| doxx WireGuard servers (`wireguard.*.doxx.net:51820`) | the test tunnels, inside network namespaces bnrtt-A/B/C | same run | the namespaces are deleted on exit |

## Flagged, not yet uniform

1. **Adapter overrides are code-level (`with_url`), not env-level.** The relay binary
   wires defaults; only the gateway pool reads env (`RELAY_GATEWAYS`). To make this
   page's "override" column honest at the ops layer, adapters need `RELAY_<RAIL>_URL`
   env wiring in `main.rs`. Small change; belongs to whoever next touches the relay
   (the adapter ring's own doc says "every external endpoint sits behind a swappable
   adapter" — the swap just isn't exposed to config yet).
2. **Single-host adapters have no fallback pool.** The AR path refuses a pool that
   cannot fail over; the four chain adapters are single-URL. Symmetry with
   `GatewayPool` is the eventual shape (per-rail pools).
3. **`adapter-lti` `canvas.test` / atmirror `pds.example.org`** — test fixtures,
   never dialed in production paths; listed so the sweep is reproducibly complete.
