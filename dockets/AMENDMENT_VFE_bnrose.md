# AMENDMENT — Vaulta-Native Hosting, Federation, and On-Chain Economics
### Proposed additions to DOCKET_BUZZ_SOVEREIGN_RELAY_1
**Author:** goose (bFUzZ seat), 2026-07-23
**Status:** proposed amendment. Does not supersede the docket — extends it.
**Relationship to docket:** Phase R (§1) is the immediate work; these amendments extend the architecture AFTER Phase R ships. The local relay stack (RELAY-LOCAL-RECEIPT.md) is a receipt Phase R's VERIFY item can cite: the relay demonstrably builds and runs from source outside Block's infra.

---

## Amendment V — Vaulta-Native Relay Hosting (extends Phase R)

### V-1. The relay as a Vaulta native service
Phase R deploys `buzz-relay` as a systemd unit on a VPS. The Vaulta-native path deploys the same Rust binary (or a WASM-compiled variant) as an on-chain service consuming RAM/CPU/NET resources — the same deployment pattern b-indexer already uses.

**Why this is different from VPS hosting:** the VPS is sovereign infra (no company in the path), but it's still one machine. A Vaulta-native service runs within the chain's resource model — staked RAM for hot event storage, CPU for WebSocket handling, NET for bandwidth. The service is resilient to single-machine failure because the chain's resource allocation survives individual node loss.

**What stays the same:** the relay speaks standard Nostr (NIP-01/42/29 + Buzz kinds). Clients cannot tell the difference between a VPS-hosted relay and a Vaulta-native one — same WebSocket, same events, same auth. The deployment target is an ops concern, not a protocol concern.

### V-2. RAM as hot event store
The relay's Postgres (required today per the VERIFY item) could be replaced or supplemented by Vaulta's RAM table model for the hot event cache. This is speculative — it depends on whether the relay crate's storage layer is abstract enough to swap backends. The VERIFY item in §6 covers this: "does the relay require the full backend, or can it run leaner?"

**Receipt needed before claiming:** a proof-of-concept showing the relay's event store interface with a Vaulta RAM backend, even for a subset of event kinds.

### V-3. Boundary
Vaulta-native hosting does not change the layer roles from §0. The relay is still hot/cache. Arweave is still truth. Autonomi is still content. Vaulta is the deployment substrate — it makes the relay more resilient, not architecturally different. Do not let "it runs on-chain" blur into "the chain is the source of truth" — that's Arweave's job.

---

## Amendment F — Relay Federation (extends Phase A)

### F-1. The docket already flags this as a VERIFY item
§6: "VERIFY whether Buzz relay federation exists (relay-to-relay). If so, the Arweave mirror could be modeled as a federation peer rather than a bespoke subscriber."

### F-2. Federation as the interoperability mechanism
Standard Nostr relays don't federate in the traditional sense — clients connect to multiple relays simultaneously, and events propagate via client-side multi-publish and gossip. A BNRoSE relay would:

- Accept any Nostr client connection (Buzz desktop, other Nostr clients)
- Receive events published by connected clients
- Serve events to subscribers via standard REQ filters
- Optionally forward events to peer relays (relay-to-relay, if the relay supports it)

The key insight from today's goose-in-Buzz work: **the relay is the source of truth for persona definitions, agent configs, and membership.** A BNRoSE relay running alongside `beehive-nature.communities.buzz.xyz` means:

- Users on beehive-nature can add BNRoSE as a second relay
- Events published on either relay propagate to clients connected to both
- Agent personas (kind 30175) published on BNRoSE are visible to any client that queries BNRoSE
- This is the funnel: users migrate their primary relay to BNRoSE as they see it's faster and permanent

### F-3. Arweave mirror as federation peer (the VERIFY resolution)
If relay-to-relay federation exists, the Arweave mirror worker (Phase A-1) could register as a federation peer rather than a bespoke subscriber. This simplifies the mirror: instead of a custom WebSocket subscriber, the mirror is a read-only federation endpoint that archives events as they flow.

**VERIFY resolution needed:** check block/buzz relay crate for federation support (relay-to-relay event forwarding). The local stack at `ws://localhost:3000` can be probed for this.

### F-4. Boundary
Federation does not replace the Arweave mirror. Federation is event propagation between live relays; the Arweave mirror is permanent archival. A relay that federates but doesn't mirror to Arweave can still lose history if all federated peers go down.

---

## Amendment E — On-Chain Economics (post-Phase I, speculative)

### E-1. Resource staking for relay operation
On Vaulta, running the relay consumes RAM/CPU/NET. An economic model where:
- The community stakes resources to keep the relay operational
- Resource usage is metered (events stored, WebSocket connections, bandwidth)
- Costs are transparent and on-chain

This is the furthest-out amendment and depends on Phases R + A + N + I being operational first. It's noted here so the architecture doesn't paint itself into a corner that prevents it later.

### E-2. Permanent storage economics
Arweave's one-time payment model for permanent storage aligns with the "interoperable/adaptable ~1000y" non-negotiable. Users (or the community treasury) pay once for permanent event archival. Autonomi's economics handle content storage separately.

### E-3. Boundary
On-chain economics is NOT required for the relay to function. The relay works identically whether deployed on a VPS (Phase R) or on Vaulta (Amendment V). Economics is a sustainability layer, not a functional one. Do not block any phase on this.

---

## Summary: what goose's original BNRoSE proposal maps to in the docket

| Goose proposed | Docket equivalent | Status |
|---------------|-------------------|--------|
| Phase 1: Fork & deploy relay | Phase R (§1) | **De-risked** — local receipt proves relay builds/runs from source |
| Phase 2: Arweave permanent archive | Phase A (§2) | Docketed, unverified |
| Phase 3: Autonomi private layer | Phase N (§3) | Docketd, unverified |
| Phase 4: Federation | **Amendment F** (new) | New — docket flagged as VERIFY item |
| Phase 5: On-chain economics | **Amendment E** (new) | New — speculative, post-Phase I |
| Vaulta-native hosting | **Amendment V** (new) | New — extends Phase R |

## Receipt that Phase R can cite
The local relay stack (docs/RELAY-LOCAL-RECEIPT.md) demonstrates:
- `buzz-relay` builds from source (block/buzz repo, Rust 1.88+)
- Runs standalone with Postgres + Redis + MinIO
- Responds to NIP-11 health probe (`curl -H 'Accept: application/nostr+json' http://localhost:3000/`)
- Accepts NIP-42 authenticated connections and signed events
- This is outside Block's hosted infra — on a machine BNR controls

This receipt de-risks Phase R's VERIFY item ("does buzz-relay build and run standalone?"). Answer: yes, demonstrated.
