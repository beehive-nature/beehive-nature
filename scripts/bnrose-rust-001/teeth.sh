#!/bin/sh
# BNROSE-RUST-001 mutation controls (TEETH): planted implementation faults
# must be CONVICTED by the vectors going red. A battery that stays green
# under a mutated implementation proves nothing; this script is the control
# that keeps the battery honest (SPEC-BTUNGSTEN-1 §measurability: a
# property with no receipt is a hypothesis — including the property "the
# tests test anything").
#
# Method: a standalone build copy (bnrose-exec-core, the wasm shim,
# btungsten-wb001-core, and a generated teeth-vectors crate whose vectors
# mirror the battery's critical rows). Each mutation is applied with sed to
# a FRESH copy, verified to have LANDED (fixed-string grep on the
# replacement — pattern drift fails loudly, never silently), and the
# vectors must FAIL. A mutation whose vectors stay green is ESCAPED and
# fails the script.
#
# Runs on Git Bash and CI ubuntu alike.

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

stage() {
    rm -rf "$WORK/crates" "$WORK/Cargo.toml" "$WORK/target"
    mkdir -p "$WORK/crates"
    cp -r "$ROOT/crates/bnrose-exec-core" "$WORK/crates/"
    cp -r "$ROOT/crates/bnrose-exec-wasm" "$WORK/crates/"
    cp -r "$ROOT/crates/btungsten-wb001-core" "$WORK/crates/"
    mkdir -p "$WORK/crates/teeth-vectors/src"
    cat > "$WORK/crates/teeth-vectors/Cargo.toml" <<'TOML'
[package]
name = "teeth-vectors"
version = "0.1.0"
edition = "2021"
publish = false

[dependencies]
bnrose-exec-core = { path = "../bnrose-exec-core" }
bnrose-exec-wasm = { path = "../bnrose-exec-wasm" }
TOML
    cat > "$WORK/Cargo.toml" <<'TOML'
[workspace]
resolver = "2"
members = [
    "crates/bnrose-exec-core",
    "crates/bnrose-exec-wasm",
    "crates/btungsten-wb001-core",
    "crates/teeth-vectors",
]

[workspace.package]
edition = "2021"
license = "Apache-2.0"
TOML
    cat > "$WORK/crates/teeth-vectors/src/lib.rs" <<'RUST'
//! TEETH vectors: the battery's critical rows in miniature, so a mutated
//! implementation can be convicted in a standalone build copy.

#![cfg(test)]

use bnrose_exec_core::{
    op_id, transition, OpState, Policy, Refusal, E_RECOVERY_EVIDENCE, E_RESPONSE, S_RESERVED,
    S_UNKNOWN, MAX_VERDICT,
};

const ENV_HEX: &str = "62542d5742303101010000000b746573742f626e726f73650200000020fd3c0c6097074e5b551a93ac9b0858d11cc4e0ed61e37c1c5ac64f8365e959b60300000008000000006b49d200040000002025efc212f56722e0bd1ced9bb2c63117ad81421543b16bba89a6639150f4c1480500000017626e726f73653a746573742d64657374696e6174696f6e0600000009746573742f657865630700000008000000000000008d0800000008000000006b49e0100900000011626e726f73653a746573742d70617965720a0000002094d70a6c4223147916d04db81fc22cd5169bd186052597707c96757b028bc356"; // PUBLIC-CONSTANT (pinned WB001 test envelope, no secret)

fn env() -> Vec<u8> {
    (0..ENV_HEX.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&ENV_HEX[i..i + 2], 16).unwrap())
        .collect()
}

fn policy() -> Policy {
    let slot = |s: &str| {
        let mut a = [0u8; 64];
        a[..s.len()].copy_from_slice(s.as_bytes());
        (a, s.len() as u32)
    };
    Policy {
        domains: [slot("test/bnrose"), slot(""), slot(""), slot("")],
        capabilities: [slot("test/exec"), slot(""), slot(""), slot("")],
        max_amount: 1_000_000,
        min_lead: 10,
        max_payload: 4096,
    }
}

/// P1: a clock past expiry refuses with the named code (mutation:
/// expiry-check-off). Envelope: epoch 1800000000, expiry 1800003600.
#[test]
fn p1_expired_intents_refuse_with_the_named_code() {
    let mut out = [0u8; MAX_VERDICT];
    bnrose_exec_core::admit(&[7; 32], &env(), &policy(), 1_800_003_601, &mut out).unwrap();
    assert_eq!(&out[..5], &[2, 13, 0, 0, 0], "refused with PolicyExpired");
    // and the same envelope well inside its window is admitted
    bnrose_exec_core::admit(&[7; 32], &env(), &policy(), 1_800_000_500, &mut out).unwrap();
    assert_eq!(out[0], 1, "the control: admitted inside the window");
}

/// P2: a response cannot complete what was never dispatched (mutation:
/// skip-dispatch).
#[test]
fn p2_no_completing_an_undispatched_operation() {
    let st = OpState { state: S_RESERVED, recovered: 0, fail: 0, bound_effect: [7; 32], seq: 2 };
    assert_eq!(
        transition(&st, E_RESPONSE, &[1], 0, u64::MAX),
        Err(Refusal::IllegalTransition)
    );
}

/// P3: recovery evidence must be the digest dispatch bound (mutation:
/// recovery-evidence-unchecked).
#[test]
fn p3_recovery_evidence_is_digest_bound() {
    let st = OpState { state: S_UNKNOWN, recovered: 0, fail: 0, bound_effect: [7; 32], seq: 4 };
    assert_eq!(
        transition(&st, E_RECOVERY_EVIDENCE, &[8; 32], 0, u64::MAX),
        Err(Refusal::DigestMismatch)
    );
}

/// P4: the operation identity binds the authority (mutation:
/// op-id-unbound).
#[test]
fn p4_the_op_id_binds_the_authority() {
    assert_ne!(op_id(&[1; 32], &env()), op_id(&[2; 32], &env()));
}

/// P5: the shim's native face returns the core's full verdict (mutation:
/// native-face-truncates).
#[test]
fn p5_the_native_face_never_truncates() {
    let mut req = vec![1u8, 1];
    req.extend_from_slice(&1_800_000_500u64.to_le_bytes());
    req.extend_from_slice(&[7u8; 32]);
    req.extend_from_slice(&policy().wire());
    req.extend_from_slice(&(env().len() as u16).to_le_bytes());
    req.extend_from_slice(&env());
    let face = bnrose_exec_wasm::native_admit(&req);
    let mut out = [0u8; MAX_VERDICT];
    let n = bnrose_exec_core::handle_admit(&req, &mut out).unwrap();
    assert_eq!(face.len(), n, "the face and the core agree on length");
    assert_eq!(&face[..], &out[..n], "the face and the core agree on bytes");
    assert_eq!(face[0], 1, "the pinned envelope is admitted");
}
RUST
}

run_vectors() {
    (cd "$WORK" && cargo test -p teeth-vectors -q --color never >/dev/null 2>&1)
}

echo "== teeth: clean control (the vectors must be green on a clean copy) =="
stage
if ! run_vectors; then
    echo "TEETH BROKEN: the vectors are red on a clean copy"
    exit 2
fi
echo "clean control: GREEN"

FAILED=0

mutate() {
    # name file sed-expr verify-fixed-string
    name=$1
    file=$2
    expr=$3
    must=$4
    stage
    target="$WORK/$file"
    sed -i "$expr" "$target"
    if ! grep -qF "$must" "$target"; then
        echo "PATTERN DRIFT: $name: the mutation did not land in $file — update the teeth"
        FAILED=3
        return
    fi
    if run_vectors; then
        echo "ESCAPED: $name — the vectors stayed green under the mutation"
        FAILED=1
        return
    fi
    echo "CONVICTED: $name"
}

mutate "expiry-check-off" \
    "crates/bnrose-exec-core/src/lib.rs" \
    's/if clock > intent.expiry {/if clock > intent.expiry \&\& clock == 0 {/' \
    'clock == 0'

mutate "skip-dispatch" \
    "crates/bnrose-exec-core/src/lib.rs" \
    's/Some(1) => Err(Refusal::IllegalTransition)/Some(1) => { next.state = 4; Ok(next) }/' \
    'next.state = 4'

mutate "op-id-unbound" \
    "crates/bnrose-exec-core/src/lib.rs" \
    's/b"bnrose-exec\/op-id\/1", \&\[authority, env\]/b"bnrose-exec\/op-id\/1", \&[env]/' \
    '&[env])'

mutate "recovery-evidence-unchecked" \
    "crates/bnrose-exec-core/src/lib.rs" \
    's/if payload.len() != 32 || payload != st.bound_effect {/if payload.len() != 32 {/' \
    'if payload.len() != 32 {'

mutate "native-face-truncates" \
    "crates/bnrose-exec-wasm/src/lib.rs" \
    's/out\[\.\.written\]\.to_vec()/out[..written - 1].to_vec()/' \
    'out[..written - 1]'

if [ "$FAILED" -ne 0 ]; then
    echo "teeth: FAILED (status $FAILED)"
    exit "$FAILED"
fi
echo "teeth: 5 of 5 planted faults convicted; the battery has teeth"
