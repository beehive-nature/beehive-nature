#!/bin/sh
# bnrose-evolve mutation controls (TEETH): each planted fault must turn the
# battery row that owns it RED. A battery that stays green under a mutated
# controller proves nothing; a mutation whose row stays green is ESCAPED and
# fails this script.
#
# Method (the BNROSE-RUST-001 teeth pattern): a standalone workspace holding
# copies of adapter-store and bnrose-evolve, the estate's Cargo.lock and
# toolchain file. The UNMUTATED copy runs the whole battery first (the
# clean-green control). Then each mutation is applied with sed to a FRESH copy
# of the crate, verified to have LANDED (fixed-string grep for the
# replacement: pattern drift fails loudly), and its row must fail.
#
# Not toothed, named: the artifact-digest term of the verifier's binding rule
# is unreachable through the public API (a run on bytes other than the
# admitted ones is refused before any record exists), so no row can convict
# its removal; it is defense in depth, not a tested property.
#
# Usage: sh scripts/bnrose-evolve/teeth.sh   (from anywhere; cargo on PATH)

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export CARGO_TARGET_DIR="$WORK/target"

mkdir -p "$WORK/crates"
cp -r "$ROOT/crates/adapter-store" "$WORK/crates/"
cp "$ROOT/Cargo.lock" "$WORK/Cargo.lock"
cp "$ROOT/rust-toolchain.toml" "$WORK/rust-toolchain.toml"
cat > "$WORK/Cargo.toml" <<'TOML'
[workspace]
resolver = "2"
members = ["crates/adapter-store", "crates/bnrose-evolve"]

[workspace.package]
edition = "2021"
license = "AGPL-3.0-only"

[workspace.dependencies]
sha3 = "0.10"
TOML
# the estate's [profile.*] sections ride along: the root builds sha3/keccak at
# opt-level 3 even in dev, and the controller hashes its 70+ MB debug fixture
# for every pinned command — unoptimized, one digest takes minutes
awk '/^\[/{ keep = ($0 ~ /^\[profile/) } keep' "$ROOT/Cargo.toml" >> "$WORK/Cargo.toml"
grep -q '^\[profile.dev.package.sha3\]' "$WORK/Cargo.toml" || {
    echo "TEETH: the root's sha3 dev profile did not carry over"
    exit 1
}

fresh() {
    rm -rf "$WORK/crates/bnrose-evolve"
    cp -r "$ROOT/crates/bnrose-evolve" "$WORK/crates/"
}

battery() {
    (cd "$WORK" && cargo test -q -p bnrose-evolve --test battery -- "$@") >"$WORK/run.log" 2>&1
}

fresh
echo "control: the unmutated copy runs the whole battery"
if ! battery; then
    tail -40 "$WORK/run.log"
    echo "TEETH: control is RED — no mutation result would mean anything"
    exit 1
fi
echo "control: GREEN"

ESCAPED=0
CONVICTED=0

# tooth NAME FILE FROM TO ROW
tooth() {
    name=$1 file=$2 from=$3 to=$4 row=$5
    fresh
    f="$WORK/crates/bnrose-evolve/$file"
    if ! grep -qF -- "$from" "$f"; then
        echo "TEETH $name: pattern not found in $file — drift, failing loudly"
        ESCAPED=$((ESCAPED + 1))
        return
    fi
    # sed with | as the delimiter; patterns below contain no |
    from_re=$(printf '%s' "$from" | sed 's/[][\.*^$/]/\\&/g')
    to_re=$(printf '%s' "$to" | sed 's/[\&/]/\\&/g')
    sed -i "s/$from_re/$to_re/" "$f"
    if ! grep -qF -- "$to" "$f"; then
        echo "TEETH $name: mutation did not land"
        ESCAPED=$((ESCAPED + 1))
        return
    fi
    if battery --exact "$row"; then
        echo "TEETH $name: ESCAPED — $row stayed green under the fault"
        ESCAPED=$((ESCAPED + 1))
    else
        echo "TEETH $name: CONVICTED by $row"
        CONVICTED=$((CONVICTED + 1))
    fi
}

tooth missing-evidence-is-pass src/evidence.rs \
    'outcome: worst.unwrap_or(Outcome::NotRun),' \
    'outcome: worst.unwrap_or(Outcome::Pass),' \
    adversarial::forged_success_report_is_only_a_claim

tooth retry-erases-failure src/evidence.rs \
    'Outcome::Fail => 3,' \
    'Outcome::Fail => 0,' \
    adversarial::a_passing_retry_does_not_erase_a_failure

tooth protected-ignored src/policy.rs \
    'if let Some(p) = self.protected.iter().find(|p| under(path, p)) {' \
    'if let Some(p) = self.protected.iter().find(|_| false) {' \
    adversarial::removed_test_and_policy_edits_are_refused_at_admission

tooth role-unchecked src/attest.rs \
    'if key.role != role {' \
    'if false && key.role != role {' \
    adversarial::role_confusion_is_refused

tooth command-unpinned src/controller.rs \
    'if digest != spec.command {' \
    'if false && digest != spec.command {' \
    adversarial::swapped_verifier_and_moved_artifact_are_refused

tooth declaration-trusted src/controller.rs \
    'if computed != prop.touched {' \
    'if false && computed != prop.touched {' \
    adversarial::undeclared_changes_and_stale_bases_are_refused

tooth unknown-is-zero src/controller.rs \
    'Some(Usage::Unknown) | None => a.amount,' \
    'Some(Usage::Unknown) => 0, None => a.amount,' \
    recovery::the_state_matrix_settles_by_evidence

tooth no-rescue-record src/controller.rs \
    'if !rep.unresolved.is_empty() {' \
    'if false && !rep.unresolved.is_empty() {' \
    recovery::a_killed_controller_is_rescued_never_rerun_never_zeroed

# the head comparison is the journal's load-bearing check (truncation is
# caught there alone); the per-record link check only names the first bad
# record and is subsumed by the head — its removal escapes BY DESIGN, so it is
# not toothed (first teeth run, 2026-10-15)
tooth head-unchecked src/journal.rs \
    'if h != want {' \
    'if false && h != want {' \
    recovery::the_journal_fails_closed_on_tampering

tooth old-verdict-recloses src/controller.rs \
    'if Some(d.policy) != self.policy_digest() {' \
    'if false && Some(d.policy) != self.policy_digest() {' \
    lifecycle::an_old_promotion_cannot_close_what_a_stronger_verifier_reproduced

tooth repair-replayed src/controller.rs \
    'if l.repairs.contains(decision) {' \
    'if false && l.repairs.contains(decision) {' \
    lifecycle::a_recurrence_under_the_same_policy_needs_a_new_repair

tooth unbounded-worker src/executor.rs \
    'if started.elapsed() >= timeout {' \
    'if false && started.elapsed() >= timeout {' \
    adversarial::hung_scribbling_and_flooding_workers_are_degraded_never_pass

echo "TEETH: $CONVICTED convicted, $ESCAPED escaped"
[ "$ESCAPED" -eq 0 ]
