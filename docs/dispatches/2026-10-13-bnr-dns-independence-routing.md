# 2026-10-13 · ROUTING — DNS-independent resolution and verified launch (order block delivered intact)

**ROUTING** · **From:** the founder's 2026-10-12/13 directive (pasted block,
verbatim below) · **To:** the integration lead for DNS-independent
resolution and verified launch, coordinating with `kc/integrate`, the
naming owner, and the mesh-dependability lane · **BNROSE-RUST-001
owner's role:** coordination + the Rust execution-core connection the
block names ("This belongs inside the Rust-first BNRoSe work, connected
to the existing keychain, naming, mesh, and settlement components").
This lane does NOT open a second session for it (the block's own session
decision) and does not claim its scope.

The block, verbatim, as received:

---

> **Make naming, application loading, and recovery independent of the
> original DNS and hosting stack.**
>
> Start from current main and reconcile active ownership. Read the bzDiD
> naming decision, BZDID-002, KEYCHAIN-CONTINUITY-002, `kc/integrate`'s
> release/TRUST records, and SPEC-BTUNGSTEN-1. Preserve working Rust
> components and existing identity roots.
>
> Specify one end-to-end trust path: direct bzDiD or verified `.b`
> binding → authenticated service/release record → independently
> retrieved package → verification before execution → isolated
> application → recoverable receipt. Extend existing schemas
> deliberately; do not create incompatible parallel formats.
>
> First deliver a DNS-independent **direct-bzDiD** path, while the naming
> owner supplies the `.b` proof interface. Do not let unfinished global
> name allocation prevent verification of an already known identity.
>
> Implement the resolver and pre-execution verification in the existing
> Rust core. Sources may supply records and bytes, never their own
> authority. Preserve full-key binding, canonical encoding, signed
> policy/version fields, anti-rollback state, equivocation evidence, and
> explicit freshness outcomes.
>
> Preserve keychain isolation and existing account bindings. A
> replacement origin must be authenticated before it receives recovery
> material. No master key in a web page, no silent identity rotation, and
> no bypass of WebAuthn origin protections.
>
> Coordinate release-governance succession with `kc/integrate`. Keep
> current bootstrap authority explicitly scoped; design and test
> replacement of the original release custodian without wallet-master
> reuse or manual per-edge trust resets as the permanent recovery
> mechanism.
>
> **Run the decisive test:** block the original DNS names, remove the
> original hosting edge and GitHub retrieval route, delete the original
> client profile, and start a clean replacement from independently
> authenticated bootstrap material. It must recover the same authorized
> identity/service, retrieve and verify the exact release, and run a
> harmless bounded operation.
>
> Then supply a malicious mirror with substituted code, a stale valid
> release, a forged name proof, conflicting successors, and withheld
> history. Wrong code must be rejected **before execution**, and
> insufficient evidence must remain unresolved—not silently downgraded.
>
> Exercise release-key rotation, replacement-origin enrollment,
> unavailable chain anchors, and restoration after a partition. Use
> disposable identities and private test infrastructure. Separate
> historical reads from actions requiring fresh authority.
>
> Demonstrate that preserved operations retain their identity and
> reservations across replacement. Missing responses must not generate
> new signatures, proposals, or duplicate payments.
>
> Measure lookup bytes, verification cost, cold bootstrap, update cost,
> repair traffic, and hardware requirements as the test population
> grows. State actual evidence, scaling bounds, and remaining assumptions
> separately.
>
> Deliver executable code, permanent adversarial tests, exact
> build/source hashes, independently retrievable receipts, and a
> scope-specific bTunGsTeN verdict. Do not stop at a Caddy deployment, a
> DNS record, or a signed manifest that only the server verifies.
>
> Keep real DNS cutover, account-permission changes, spending, and
> production-key provisioning within their existing authorized
> workflows. This order does not authorize a tool-policy bypass or moving
> production assets.

---

**The governing rule (verbatim):** names help people find the system;
cryptographic authority determines what the system accepts. Losing the
name must not mean losing the sovereign.

## What BNROSE-RUST-001 already provides this effort

- The bounded, untrusted worker pattern (zero-import wasm under pinned
  Wasmtime; keys host-side; paranoid dual-run) — the "isolated wallet /
  bounded execution" box in the block's trust path.
- The durable-state discipline the block's recovery paragraph asks for:
  fsync-before-effect, UNKNOWN preserved, no replacement on missing
  responses, chain-verified recovery material.
- The receipt statement format (`bnrose-exec/receipt/1`) as one
  candidate schema to EXTEND (not fork) when the launcher binds release
  manifests.

## Boundary law both orders state and this lane honors

The EOS VM evaluation stays closed — comparison evidence only. Nothing
named `rustEOSvm` (specified separately, see
`docs/specs/SPEC-RUSTEOSVM-1.md`) and nothing in this lane imports the
archived experimental backend or reopens its three investigations.
