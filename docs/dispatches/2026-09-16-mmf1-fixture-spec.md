# MMF-1 — THE MUTABLE-MINT ADVERSARIAL FIXTURE · final pre-build specification · 2026-09-16

**Order (founder, verbatim):** *"Design the mutable-mint adversarial fixture
in enough detail that a future builder can implement CA-1…CA-7 without
making architecture decisions. Specify the minimum fake-mint controls needed
to toggle NUT-06 claims, actual NUT-10/11 enforcement, keysets, signatory
identity, fees/limits, reachability, NUT-07 state, and contradictory
behavior independently. Map each control directly to CA-1…CA-7 and the
existing AV/D recovery machinery. Do not build the Cashu adapter or mint.
This is the final pre-build specification for the offline-bearer lane."*
**Status:** SPECIFICATION ONLY. Nothing built. **This document closes the
broad Cashu reconnaissance** (queue item #4) — it is the last artifact of
that lane; any further motion is a chartered builder's.

## 0 · What MMF-1 is (one sentence)

A single in-process test fixture that speaks the minimal Cashu wire subset
(NUT-01/02/04/05/06/07/10/11/12) with REAL e-cash cryptography and a
side-channel control plane that can lie, mutate, retire, swap signers,
re-price, and go dark — each control independently, at runtime, so every
CA-1…CA-7 RED setup is one preset away.

## 1 · Non-negotiable shape (the builder decides nothing here)

- **One binary, ephemeral ports, no network egress.** Standard `tokio` +
  `axum` test server per `cargo test` run; the adapter-under-test talks to
  `http://127.0.0.1:<ephemeral>/`. Zero real LN/chain backends — payments
  auto-succeed via the `cdk-fake-wallet` payment backend (its
  `with_keyset_rotation` scaffolding is the seed, per the recon).
- **Real e-cash math.** DHKE blinding, real blind signatures, real
  `Proof`/`Secret`/witness structures from the `cashu` crate. Only the
  MINT'S JUDGMENT is fake. If the crypto is stubbed, CA-1's probe tests
  nothing.
- **Two planes:** the CASHU plane (the wire) and the CONTROL plane (a
  second axum router bound to `127.0.0.1:<ephemeral+1>`, or an in-process
  `Arc<RwLock<MmfState>>` handle when the adapter runs in the same test).
  Control mutations take effect on the NEXT cashu request (no mid-request
  tearing except where a CA needs it — C6).
- **State model:** in-memory by default, plus explicit
  `dump()/load()` (serialize `MmfState` to bytes) so "upgrade" arms
  simulate a restart with a chosen mutated state — restarts are deliberate
  state transfers, never accidental persistence.
- **Repo placement is the chartering dispatch's call, not a fixture
  decision** (suggested: a test-support crate or `tests/fixtures/` in
  whatever lane is chartered — noted so the builder doesn't agonize).

## 2 · The control surface (C1–C8), each independent

```rust
struct MmfState {                       // all fields runtime-mutable via the control plane
    nut06_claims: Nut06Claims,          // C1
    enforcement: Enforcement,           // C2
    keysets: Vec<FakeKeyset>,           // C3
    signatory: SignatoryLineage,        // C4
    fees_limits: FeesLimits,            // C5
    reachability: Reachability,         // C6
    nut07_overrides: HashMap<Y, State>, // C7
}
```

**C1 `nut06_claims`** — exactly what NUT-06 serves, truth-independent:
`{nut10: bool, nut11: bool, nut12: bool, motd: String, version:
MintVersion}`. Default: all true, `"mmf/1.0"`. *This is the LIE dial: it
never changes behavior, only claims.*

**C2 `enforcement`** — the mint's actual judgment on swap/melt inputs,
regardless of C1: `enum Enforcement { Full, Lax(LaxHoles), None }` where
`LaxHoles` is a bitset: `ACCEPT_ZERO_SIG_REFUND` (the verified CDK
anyone-can-spend path), `SKIP_LOCKTIME`, `SKIP_WITNESS_KIND`,
`ACCEPT_DUPLICATE_SIG`. `Full` = delegate to the REAL
`cashu`-crate `verify_p2pk` — the fixture does not reimplement
verification, it CALLS it or bypasses it. *This is the BEHAVIOR dial.*

**C3 `keysets`** — `Vec<FakeKeyset{id, unit, keys: Vec<PublicKey>,
active: bool, input_fee_ppk: u64}>`. Operations: `retire(id)` (active→false
but still listed-with-keys unless `delist`), `delist(id)` (vanishes from
NUT-01/02), `mutate_keys(id, new_keys)` (**same id, different keys — the
byte-equality attack on the snapshot's keyset hashes**), `add(keyset)`
(signed per C4). Delisted keysets refuse swap with the mint's real
"unknown keyset" error shape.

**C4 `signatory`** — `enum SignatoryLineage { A, B }`: two independent
seeds fixed in the fixture (constants, not generated); NEW keysets are
signed by the current lineage; existing keysets keep their existing keys
(the realistic v0.17-migration shape: old proofs still verify, new lineage
appears). `switch_signatory(B)` + `add(keyset)` = the succession event.

**C5 `fees_limits`** — `{input_fee_ppk, max_inputs, max_outputs,
quote_ttl, min_mint, max_mint, min_melt, max_melt}`, served through NUT-06
info + keyset fee fields + enforced at swap time. Live-mutable — this is
the management-RPC-shape surface.

**C6 `reachability`** — `enum Reachability { Up, DropAfter(Duration),
HangAfter(Duration), GarbageAfter(Duration) }` per CONNECTION, armed before
the request the CA targets: `Drop` = TCP close mid-response; `Hang` =
accept + never respond (the adapter's timeout path); `Garbage` = HTTP 200
with non-JSON bytes. NUT-06/NUT-07 unaffected on other connections.

**C7 `nut07_overrides`** — per-`Y` forced states overriding the ledger:
`Unspent | Spent | Pending | Reserved | PendingSpent`, plus `Flaky` (alternate
Unspent/Pending across calls — the genuinely-unknown probe). The internal
ledger still tracks real swaps so non-overridden Ys answer truthfully.

**C8 presets** — named one-liners composing C1–C7 (§3's table is the
canonical list; these are `fn preset_<name>()` so CA tests read as
intent): `LyingSupport`, `SilentDowngrade`, `VersionBumpOnly`,
`EnforcementVanish`, `KeysetRetire`, `KeysetKeyMutation`, `SignerSwitch`,
`FeeSneak`, `MotdOnly`, `MidSwapDrop`, `MidSwapHang`, `FlakyState`,
`TornSnapshot` (delivers a corrupted snapshot artifact rather than wire
behavior — pairs with the snapshot store harness).

## 3 · Control → CA → machinery map (the contract's spine)

| preset (controls) | CA | RED-when recap | AV/D machinery exercised |
|---|---|---|---|
| `LyingSupport` (C1 ✓ true + C2 None) | CA-1 | probe gets NO typed refusal while claims say supported | CD-4/D-4 contradiction shape, live |
| `EnforcementVanish` (C2 Full→None, C1 untouched) | CA-2 | drift not classified SEMANTIC; issuance continues | flag-not-credit; AV-8 no-re-mint-over-drift |
| `SilentDowngrade` (C2 Full→Lax) | CA-2 | lax holes accepted unclassified | same |
| `VersionBumpOnly` (C1 version bump only) | CA-2 | version drift unclassified | drift-watch granularity |
| `KeysetRetire` (C3 retire+delist) | CA-3 | auto-reissue without explicit decision | terminal-state law, AV-8 |
| `SignerSwitch` (C4 B + new keyset) | CA-4 | carry proceeds ungated on new lineage | HumanGate D-7, RED-class succession |
| `KeysetKeyMutation` (C3 same-id new keys) | CA-4/7 | byte-equality not checked | snapshot keyset-hash law |
| `FeeSneak` (C5 fee ×2) | CA-5 | passes as BENIGN | A3/AV-6 fee-cap family |
| `MotdOnly` (C1 motd change) | CA-5 control arm | MUST pass as BENIGN (over-blocking = RED too) | classification precision |
| `MidSwapDrop` / `MidSwapHang` (C6) | CA-6 | blind re-spend under UNKNOWN state | **AV-8 verbatim (proofs), D-6** |
| `FlakyState` (C7) | CA-6 | unbounded retry instead of fail-closed | bounded-exposure |
| `TornSnapshot` (snapshot-store harness) | CA-7 | corrupted snapshot accepted | torn-journal four modes |

## 4 · Fixture self-tests (the fixture is chartered with its own battery)

F-1: every C1–C7 control toggles independently (toggle matrix — 2×2 for the
lie/behavior pair specifically: claims×enforcement). F-2: presets reproduce
each CA's setup exactly (golden NUT-06/keys responses snapshotted). F-3:
`Full` enforcement is indistinguishable from a reference mint on the
conformance vectors (borrow the `cashu` crate's own tests). F-4:
`dump()/load()` round-trips state byte-exactly. F-5: control-plane
mutations never touch the cashu plane's TLS/ports pairing. **A fixture
without F-1–F-5 green is not landable** — a lying test rig is worse than
none.

## 5 · Explicitly OUT of scope (so the builder doesn't drift)

No real LN/chain backends; no persistence; no production config surface;
no NUT-21/22 auth arms (add when a CA needs them); no multi-mint
orchestration (single fixture instance; a second is just a second port);
no adapter code — the adapter-under-test remains a future, separately
chartered build (the four gates G1–G4 of the deep-read dispatch).

## 6 · Closeout of the broad Cashu reconnaissance

Arc receipted in queue item #4: family recon (@c91c9051) → NUT-10/11/24
spec deep read + x402 crosswalk (@1aa2cc49) → CDK interfaces + smallest
adapter (@4523c0b8) → self-hosted-mint assault + snapshot/drift-watch
contract (@efbe56d9) → CA-1..7 adversarial contract (@4d199a23) → **MMF-1
(this dispatch — the final pre-build artifact)**. Standing conclusions:
Cashu adds a projection language and an adapter seam, needs zero new
recovery state machines, and its one law family (declared≠enforced;
drift = detectable-attributed, never silent-prevented) is now specified
to pre-build depth. Broad research in this lane is CLOSED by founder
order (diminishing value); further motion = a chartered builder + MMF-1.

## Landing receipt

Queue item #4 → CLOSED with this pointer. §7 seat shape, four pre-push
checks, pushed branch + main. Zero implementation.
