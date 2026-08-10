# PHASE 0 — AR/ANT FUNCTIONAL SETUP SPEC (for Code)

**Seat:** Goose Seat 1 to Code Seat 3
**Date:** 2026-08-10
**Authority:** Founder directive — AR/ANT first, then Vaulta, then HIVE
**Status:** READY TO BUILD (spec authored; deployment needs VPS)

---

## OBJECTIVE

Get Arweave and Autonomi functional as the storage substrate for all plugins/dApps. Users self-fund their own AR/ANT. No endowment, no subsidy.

## WHAT RUNS ON THE VPS

1. **ar-io-node** (Docker, AGPL-3.0, no-token mode, no staking). Gateway for all AR reads. GraphQL indexing + ANS-104 unbundling. Config: GRAPHQL_HOST + START_HEIGHT, no AR_IO_WALLET. Eliminates arweave.net dependency.

2. **Autonomi nodes x2-3** (antnode from ~/autonomi/). Storage farming (earn ANT), chunk hosting, >=256KiB bulk rail. Resolve SECRET_KEY custody (storage-substrate-split item 8). This is infrastructure cost, not user subsidy.

3. **Axum relay skeleton** (extend console-api or new wallet-relay crate). Serves GraphQL proxy + chunk reads. Never holds keys. Stateless. Multi-gateway fallback.

## BUILD ORDER

Step 1: NixOS config — systemd services for ar-io-node Docker + 2x antnode
Step 2: ar-io-node Docker Compose (no-token mode, standard config)
Step 3: Autonomi node setup (custody resolved, join-network)
Step 4: Axum relay skeleton (GraphQL proxy + chunk reads)
Step 5: User-signed DataItem upload endpoint (Ed25519 sig type 2 — Code already built 0515e06, conformance-proven)
Step 6: Storage routing rule (256 KiB crossover: <256KiB to AR Ed25519, >=256KiB to Autonomi)
Step 7: Multi-gateway fallback list (health-checked, never hard-code arweave.net)

## STORAGE ROUTING RULE (storage-substrate-split section 1)

Payloads under 256 KiB route to Arweave (ANS-104 Ed25519, ~$0.0000077/record).
Payloads 256 KiB and above route to Autonomi (~19x cheaper per GiB).
Identity/DID-log payloads always go to Arweave primary, Autonomi mirror.
Browser-HTTP-resolvable payloads always go to Arweave (ar-io-node serves them).

## WHAT PHASE 0 EXCLUDES

- No wallet UI (Phase 1 with Vaulta)
- No Vaulta integration (Phase 1)
- No HIVE (Phase 2)
- No endowment/fund mechanism (CANCELLED — users self-fund)
- No Turbo dependency (user-signed DataItems via Ed25519)

## VERIFICATION

- ar-io-node: GraphQL query returns data from our gateway, not arweave.net
- Autonomi: chunk upload + download round-trip on live network
- Ed25519 DataItem: conformance already proven (0515e06)
- Multi-gateway: take ar-io-node offline, reads still work via fallback

**Build this. The VPS is the only gate.**