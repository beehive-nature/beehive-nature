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
| `connect.trezor.io` | Trezor Connect v10 — official device rail (consent popup; Bridge/WebUSB) | **ONLY on the user clicking "Connect my Trezor — for real"** — the wizard performs zero egress until that click | Don't click, or use the device-less walkthrough (custody stays Declared). bSAFE 7 lane replaces this with native transport in our own dashboard |

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
