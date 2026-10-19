#!/bin/sh
# bnrose-anchor-vaulta mutation controls (TEETH): each guard of the Vaulta
# carrier is disabled in a fresh copy and its test must turn RED. Same method
# as teeth.sh: a standalone workspace (the three crates, the estate's
# Cargo.lock, toolchain and profiles), the unmutated copy green first, each
# mutation verified to have landed.
#
# Usage: sh scripts/bnrose-evolve/anchor-vaulta-teeth.sh   (cargo on PATH)

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export CARGO_TARGET_DIR="$WORK/target"

mkdir -p "$WORK/crates"
cp -r "$ROOT/crates/adapter-store" "$ROOT/crates/bnrose-evolve" "$WORK/crates/"
cp "$ROOT/Cargo.lock" "$WORK/Cargo.lock"
cp "$ROOT/rust-toolchain.toml" "$WORK/rust-toolchain.toml"
cat > "$WORK/Cargo.toml" <<'TOML'
[workspace]
resolver = "2"
members = ["crates/adapter-store", "crates/bnrose-evolve", "crates/bnrose-anchor-vaulta"]

[workspace.package]
edition = "2021"
license = "AGPL-3.0-only"

[workspace.dependencies]
sha3 = "0.10"
TOML
awk '/^\[/{ keep = ($0 ~ /^\[profile/) } keep' "$ROOT/Cargo.toml" >> "$WORK/Cargo.toml"

fresh() {
    rm -rf "$WORK/crates/bnrose-anchor-vaulta"
    cp -r "$ROOT/crates/bnrose-anchor-vaulta" "$WORK/crates/"
}

suite() {
    (cd "$WORK" && cargo test -q -p bnrose-anchor-vaulta --test carrier -- "$@") >"$WORK/run.log" 2>&1
}

fresh
echo "control: the unmutated copy runs the carrier suite"
if ! suite; then
    tail -40 "$WORK/run.log"
    echo "TEETH: control is RED — no mutation result would mean anything"
    exit 1
fi
echo "control: GREEN"

ESCAPED=0
CONVICTED=0

# tooth NAME FROM TO TEST   (all in src/lib.rs)
tooth() {
    name=$1 from=$2 to=$3 row=$4
    fresh
    f="$WORK/crates/bnrose-anchor-vaulta/src/lib.rs"
    if ! grep -qF -- "$from" "$f"; then
        echo "TEETH $name: pattern not found — drift, failing loudly"
        ESCAPED=$((ESCAPED + 1))
        return
    fi
    from_re=$(printf '%s' "$from" | sed 's/[][\.*^$/]/\\&/g')
    to_re=$(printf '%s' "$to" | sed 's/[\&/]/\\&/g')
    sed -i "s/$from_re/$to_re/" "$f"
    if ! grep -qF -- "$to" "$f"; then
        echo "TEETH $name: mutation did not land"
        ESCAPED=$((ESCAPED + 1))
        return
    fi
    if suite --exact "$row"; then
        echo "TEETH $name: ESCAPED — $row stayed green under the fault"
        ESCAPED=$((ESCAPED + 1))
    else
        echo "TEETH $name: CONVICTED by $row"
        CONVICTED=$((CONVICTED + 1))
    fi
}

tooth wrong-chain-read 'Some(id) if id == chain_id => Ok(()),' \
    'Some(_) => Ok(()),' \
    only_a_wrong_chain_is_refused_by_the_chain_check

tooth split-answers-merge 'Some(f) if *f == a => {}' \
    'Some(_) => {}' \
    endpoints_must_all_answer_and_all_agree

tooth row-trusted-over-statement 'if s.subject != subject || s.count != count {' \
    'if false && (s.subject != subject || s.count != count) {' \
    a_row_that_does_not_carry_its_statement_is_refused

tooth failed-endpoint-skipped 'Err(e) => return AnchorLookup::Unreachable(format!("endpoint {i}: {e}")),' \
    'Err(_) => continue,' \
    endpoints_must_all_answer_and_all_agree

echo "TEETH: $CONVICTED convicted, $ESCAPED escaped"
[ "$ESCAPED" -eq 0 ]
