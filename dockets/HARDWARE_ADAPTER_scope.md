# Docket · biometric / hardware adapters — scope, scouted-and-ruled (RELAY_17)

**Seat 3 log of RELAY_17's ruling on the 13-device survey + the Andronix/PRoot scout.** Records
what is decided, what is blocked and on what, and the one item that routes to the founder.
Governing law already in the tree: [`PROOF_OF_UNIQUE_LIFE_design_note.md`](PROOF_OF_UNIQUE_LIFE_design_note.md)
(signal families, "time is the un-buyable signal", "declining costs nothing"), Article II
(tiered attestation is *evidence, not status*; application policy gates, not the kernel), and
BIND-1 §10 / Article VI §3.3 G-1 (provenance weights are meta-tier rulings).

## Decided (RELAY_17)

- **FIDO2/CTAP2 adapter in Rust, first — Evidence-emitting only.** One protocol adapter covers
  Solo 2, Nitrokey 3, OpenSK, YubiKey Bio (and Token/Nymi through their certified FIDO2 faces)
  with no proprietary SDK.
- **Buy: one Solo 2 + one Nitrokey 3 (~$85).** Two vendors — the second brand is what proves the
  adapter is protocol-conformant, not vendor-shaped. **No devkit / debugger / Hacker variant**
  until a custom CTAP extension is actually specified (it is not). *A purchase — the founder's to
  execute; Seat 3 does not buy hardware.*
- **LEAVE** Token ring and Nymi as integration targets (gated enterprise SDK; Nymi exposes no raw
  ECG). Supporting their FIDO2 faces for free by refusing to integrate the proprietary side is the
  right shape.
- **LEAVE** Andronix / PRoot (Android). The `BNRi_OS` spec already rules the phone a **thin client**
  (view + wallet + companion; mobile out of day-1 scope), and the hardware research converged
  independently on "FIDO2 over NFC/BLE from the Android host, bypassing the Linux layer." The
  fake-procfs shim is clever and is **noted as recoverable cargo** if a rooted-SBC lane ever opens.
- **PARK** HealthyPi Move / Stage 3 R&D ($299) behind Stage 1 *and* behind the DAO's first lab-panel
  commissioning. Stage 3 before Stage 1 exists is out of order.

## Standing rules (recorded)

- **Hardware is a convenience for those who opt in, never the gate.** A FIDO2 key's *absence* is not
  a deficiency. "Access is a preference, never a credential" (PoUL §117).
- **A Hacker-flashed key is "running your own build," never "verified genuine"** — same discipline
  as `Attestor` having no `Verified` variant. Attestation scope must say so.

## Routes to the founder — do NOT land in a PR (§3, meta-tier)

**`Provenance::HardwareAttestation` and its base weight is an Epoch-0 meta-tier ruling** (Article VI
§3.3 clause (b): the attestation/evidence flows that feed reputation-engine), the same class as
G-1's `SignedSelfAttestation = 0.55`. Seat 3 will not set it in code first.

Compile-gate note for that ruling — the existing variants (measured):

| Provenance | weight | is_high | note |
|---|---|---|---|
| ChainProof | 0.95 | yes | |
| **DeviceAttestation** | **0.90** | **yes** | platform-integrity (TPM / secure enclave). **NOT** a FIDO2 key. |
| CarrierApi | 0.85 | yes | |
| AiInference | 0.60 | no | |
| SignedSelfAttestation | 0.55 | no | G-1 |
| UserClaim | 0.30 | no | |

A FIDO2 assertion proves **possession of a portable token**, never platform integrity and never
presence-of-a-person — so it must **not** reuse `DeviceAttestation` (0.90, high, auto-enforce
capable). RELAY_17's recommended band: **above `SignedSelfAttestation` (0.55), below the high /
settlement-carrying tier** (i.e. in `(0.55, 0.85)`), by the same discount logic G-1 applied to
self-attestation. The founder's ruling sets the exact value and confirms the semantic split from
`DeviceAttestation`.

## Blocked — and the prerequisite that is out of order

**The §2 protective controls cannot be built yet, and the blocker is worth naming.** They are:

1. *negative* — any path where the absence of hardware reduces what a person may do / hold / mint /
   draw → **FAIL**; and
2. *positive* — a thread with **zero** hardware signals reaches full PoUL standing through time +
   behavioural continuity alone.

Both are **PoUL-standing-level** properties. **PoUL is design-only — there is no standing model /
crate in the tree** (`grep`: no `proof-of-unique-life` crate; the note is a design note). So there
is nothing for "hardware never gates" to attach to. Ordering the adapter's protective controls
before the PoUL engine exists is the same out-of-order shape RELAY_17 §5 flags for Stage 3: the
control that protects the human needs the mechanism it protects to exist first.

**Therefore the FIDO2 adapter waits on three things, none of them Seat-3 code today:**
(a) the hardware (to test the happy path), (b) the founder's `HardwareAttestation` meta-tier weight,
and (c) a PoUL standing model to exhibit the §2 controls against. Seat 3 builds none of the adapter
until at least (b) and (c) land — controls-before-rails, and the rails have no ground yet.

*Hardware is a convenience for those who opt in, never the gate. Time is the un-buyable floor. The
phone was already ruled a thin client. Logged, not built — because the ground the controls stand on
is not in the tree yet.*
