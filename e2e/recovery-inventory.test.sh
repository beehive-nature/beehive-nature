#!/usr/bin/env bash
# recovery-inventory fixture tests — G1 (issue #4). Exercises the real tool
# against a synthetic host: no production path, no box, no network. Requires
# python3 (CI runners and WSL carry it; the tool itself runs on the box).
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
tool="$here/scripts/ops/recovery-inventory.py"
command -v python3 >/dev/null || { echo 'FAIL python3 not found'; exit 1; }
T=$(mktemp -d /tmp/bnr-recovery-inventory-test.XXXXXXXX)
trap 'rm -rf -- "$T"' EXIT

# ---- the synthetic host -------------------------------------------------
mkdir -p "$T/host/devrelay/target/debug" "$T/host/secrets" "$T/host/state" "$T/proc/42"
printf 'dev relay binary bytes\n' > "$T/host/devrelay/target/debug/buzz-relay"
printf 'chainstate bytes\n' > "$T/host/state/chain.dat"
# SECRET CONTENT: must never reach the inventory output in any form.
# The marker is assembled from parts so this TEST FILE never itself
# contains a PEM-shaped literal (secret-scan bracket-trick precedent).
guard_marker="PRIVATE KE""Y"
printf -- "-----BEGIN RSA %s-----\nSENTINEL-SECRET-CONTENT\n" "$guard_marker" \
  > "$T/host/secrets/founding.key"
# A live process whose exe file was deleted, inside the declared build tree.
ln -s "$T/host/devrelay/target/debug/buzz-relay (deleted)" "$T/proc/42/exe"

cat > "$T/config-defects.json" <<JSON
{
  "filesystems": [{"mount": "$T/host", "reserve_bytes": 1000000000000}],
  "roots": [
    {"id": "dev-build", "path": "$T/host/devrelay",
     "classification": "reproducible-artifact",
     "artifacts": [{"path": "$T/host/devrelay/target/debug/buzz-relay", "kind": "binary"}],
     "restart": {"unit": null, "executable": "$T/host/devrelay/target/debug/gone",
                 "method": "manual"}},
    {"id": "lost-root", "path": "$T/host/does-not-exist",
     "classification": "rebuildable-index-cache"},
    {"id": "nonsense-class", "path": "$T/host/state",
     "classification": "authoritative-wishful-thinking"},
    {"id": "founding-keys", "path": "$T/host/secrets",
     "classification": "secret-reference", "recovery_owner": "founder"}
  ]
}
JSON

# ---- run 1: the defect census (PROC_DIR points the scan at fake /proc) ----
set +e
PROC_DIR="$T/proc" python3 "$tool" --config "$T/config-defects.json" \
  > "$T/out.json" 2> "$T/err.txt"
rc=$?
set -e
[[ $rc -eq 2 ]] || { echo "FAIL expected attention exit 2, got $rc"; cat "$T/err.txt"; exit 1; }
python3 - "$T/out.json" <<'PY' || exit 1
import json, sys
r = json.load(open(sys.argv[1], encoding="utf-8"))
roots = {x["id"]: x for x in r["roots"]}
assert roots["dev-build"]["status"] == "active-deleted-executable", roots["dev-build"]
assert roots["dev-build"]["prior_status"] == "missing-restart-dependency", roots["dev-build"]
assert roots["dev-build"]["artifacts"][0]["sha256"] == __import__("hashlib").sha256(
    open(roots["dev-build"]["artifacts"][0]["path"], "rb").read()).hexdigest()
assert roots["dev-build"]["restart"]["executable_status"] == "missing-restart-dependency"
assert roots["lost-root"]["status"] == "missing"
assert roots["nonsense-class"]["status"] == "unknown-classification"
sec = roots["founding-keys"]
assert sec["status"] == "secret-recorded"
assert sec["recovery_owner"] == "founder"
for forbidden in ("footprint_bytes", "artifacts", "sha256"):
    assert forbidden not in sec, (forbidden, sec)
assert r["deleted_executables"][0]["pid"] == 42
assert r["deleted_executables"][0]["inside_declared_roots"] == ["dev-build"], r["deleted_executables"]
fs = r["filesystems"][0]
assert fs["headroom_ok"] is False and fs["status"] == "reserve-breach"
print("fixture census assertions ok")
PY
if grep -q 'SENTINEL-SECRET-CONTENT' "$T/out.json"; then
  echo 'FAIL secret content leaked into inventory output'; exit 1
fi
if grep -q "$guard_marker" "$T/out.json"; then
  echo 'FAIL key material marker reached inventory output'; exit 1
fi
echo 'PASS missing/unknown dependencies, deleted-exe-under-build-tree, reserve breach, and secret-free output all detected'

# ---- run 2: the clean census exits 0 -------------------------------------
mkdir -p "$T/host/clean"
printf 'healthy binary\n' > "$T/host/clean/daemon"
mkdir -p "$T/units/etc/systemd/system"
touch "$T/units/etc/systemd/system/clean.service"
cat > "$T/config-clean.json" <<JSON
{
  "filesystems": [{"mount": "$T/host", "reserve_bytes": 1}],
  "roots": [
    {"id": "clean", "path": "$T/host/clean",
     "classification": "authoritative-state",
     "artifacts": [{"path": "$T/host/clean/daemon", "kind": "binary"}],
     "restart": {"unit": "clean.service", "executable": "$T/host/clean/daemon"}}
  ]
}
JSON
set +e
UNIT_DIR="$T/units/etc/systemd/system" python3 "$tool" --config "$T/config-clean.json" > "$T/out2.json" 2>/dev/null
rc2=$?
set -e
[[ $rc2 -eq 0 ]] || { echo "FAIL clean census should exit 0, got $rc2"; exit 1; }
grep -q '"status": "ok"' "$T/out2.json" || { echo 'FAIL clean root not ok'; exit 1; }
echo 'PASS clean census exits 0'

# ---- run 3: the guard refuses sensitive notes ----------------------------
sneaky_notes="rotate BEGIN OPENSSH $guard_marker soon"
cat > "$T/config-guard.json" <<JSON
{"roots": [{"id": "sneaky", "path": "$T/host/clean", "classification":
  "reproducible-artifact", "notes": "$sneaky_notes"}]}
JSON
set +e
python3 "$tool" --config "$T/config-guard.json" > "$T/out3.json" 2> "$T/err3.txt"
rc3=$?
set -e
[[ $rc3 -eq 3 ]] || { echo "FAIL guard should exit 3, got $rc3"; exit 1; }
[[ ! -s "$T/out3.json" ]] || { echo 'FAIL guard emitted output despite tripping'; exit 1; }
echo 'PASS sensitive-content guard withholds output (exit 3)'

echo 'ALL PASS recovery-inventory fixtures'
