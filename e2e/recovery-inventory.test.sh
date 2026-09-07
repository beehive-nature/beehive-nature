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
mkdir -p "$T/host/devrelay/target/debug" "$T/host/secrets" "$T/host/state" \
         "$T/host/probe" "$T/host/nodeps" "$T/host/badexe" "$T/host/badart" \
         "$T/host/norestart" "$T/host/nullrestart" "$T/host/static" \
         "$T/host/locked/CUSTOMER-OBJECT-SENTINEL" "$T/proc/42" "$T/proc/77"
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
# A pid directory the scanner CANNOT read (non-root): a partial scan that
# must be recorded, never silently dropped.
chmod 000 "$T/proc/77"
# A DISCOVERED subdirectory the walker CANNOT read (non-root): its NAME is
# exactly the class of object name the inventory must never emit — the
# permission failure is reported as root/op/code, without the path.
chmod 000 "$T/host/locked/CUSTOMER-OBJECT-SENTINEL"

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
     "classification": "secret-reference", "recovery_owner": "founder",
     "notes": "SENTINEL-SECRET-NOTES-NEVER-EMIT"},
    {"id": "probe-unknown", "path": "$T/host/probe",
     "classification": "reproducible-artifact",
     "restart": {"unit": null, "executable": null, "method": "unknown"}},
    {"id": "no-deps-at-all", "path": "$T/host/nodeps",
     "classification": "reproducible-artifact", "restart": {}},
    {"id": "no-restart-key", "path": "$T/host/norestart",
     "classification": "reproducible-artifact"},
    {"id": "null-restart", "path": "$T/host/nullrestart",
     "classification": "reproducible-artifact", "restart": null},
    {"id": "unreadable-exe", "path": "$T/host/badexe",
     "classification": "reproducible-artifact",
     "restart": {"executable": "$T/host/state", "method": "manual"}},
    {"id": "dir-as-artifact", "path": "$T/host/badart",
     "classification": "reproducible-artifact",
     "artifacts": [{"path": "$T/host/state", "kind": "artifact"}],
     "restart": {"method": "not-applicable"}},
    {"id": "locked-tree", "path": "$T/host/locked",
     "classification": "rebuildable-index-cache",
     "restart": {"method": "not-applicable"}}
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
for forbidden in ("footprint_bytes", "artifacts", "sha256", "notes"):
    assert forbidden not in sec, (forbidden, sec)
# Unknown/unreadable restart dependencies must surface, never pass as ok —
# including the shapes that carry NO restart information at all (key absent,
# explicit null); only the explicit "not-applicable" designation exempts a
# root, and that is asserted in the clean run below.
assert roots["probe-unknown"]["status"] == "unknown-restart-dependency", roots["probe-unknown"]
assert roots["no-deps-at-all"]["status"] == "unknown-restart-dependency", roots["no-deps-at-all"]
assert roots["no-restart-key"]["status"] == "unknown-restart-dependency", roots["no-restart-key"]
assert roots["no-restart-key"]["restart"]["method"] == "undeclared"
assert roots["null-restart"]["status"] == "unknown-restart-dependency", roots["null-restart"]
assert roots["null-restart"]["restart"]["method"] == "undeclared"
assert roots["unreadable-exe"]["status"] == "unreadable-restart-dependency", roots["unreadable-exe"]
exstat = roots["unreadable-exe"]["restart"].get("executable_status", "")
assert exstat.startswith("unreadable:") and "/" not in exstat, exstat
assert roots["dir-as-artifact"]["status"] == "unreadable-artifact", roots["dir-as-artifact"]
# Error reports are code-shaped: root id + operation + errno code, and
# NOTHING that could carry a discovered path or object name.
for e in r["measurement_errors"]:
    assert set(e) <= {"root", "op", "code", "errno"}, e
    assert "/" not in json.dumps(e), e
assert r["measurement_errors"] == [] or all(
    e["code"].startswith("E") for e in r["measurement_errors"]), r["measurement_errors"]
assert r["deleted_executables"][0]["pid"] == 42
assert r["deleted_executables"][0]["inside_declared_roots"] == ["dev-build"], r["deleted_executables"]
fs = r["filesystems"][0]
assert fs["headroom_ok"] is False and fs["status"] == "reserve-breach"
print("fixture census assertions ok")
PY
if grep -q 'SENTINEL-SECRET-CONTENT' "$T/out.json"; then
  echo 'FAIL secret content leaked into inventory output'; exit 1
fi
if grep -q 'SENTINEL-SECRET-NOTES-NEVER-EMIT' "$T/out.json"; then
  echo 'FAIL secret-reference notes passed through into output'; exit 1
fi
if grep -q 'CUSTOMER-OBJECT-SENTINEL' "$T/out.json"; then
  echo 'FAIL discovered object name reached inventory output'; exit 1
fi
if grep -q "$guard_marker" "$T/out.json"; then
  echo 'FAIL key material marker reached inventory output'; exit 1
fi
# Permission failures must become recorded errors, never silence. As root
# these fixtures stay readable, so the assertions run only for unprivileged
# invocations (CI and the WSL dev seat are non-root; root runs degrade to
# the structural checks above).
if [[ $(id -u) -eq 0 ]]; then
  echo 'NOTE root-run: permission-denied fixtures are readable to root; skipping EACCES assertions (CI runs non-root)'
else
  python3 - "$T/out.json" <<'PY' || exit 1
import json, sys
r = json.load(open(sys.argv[1], encoding="utf-8"))
roots = {x["id"]: x for x in r["roots"]}
assert roots["locked-tree"]["status"] == "partially-unreadable", roots["locked-tree"]
assert any(e.get("root") == "locked-tree" for e in r["measurement_errors"]), r["measurement_errors"]
assert any(e.get("code") == "EACCES" and e.get("pid") for e in r["scan_errors"]), r["scan_errors"]
print("permission-failure assertions ok")
PY
fi
echo 'PASS missing/unknown/unreadable dependencies, deleted-exe-under-build-tree, reserve breach, permission failures recorded, and secret-free output (content AND notes) all detected'

# ---- run 2: the clean census exits 0 -------------------------------------
# PROC_DIR is pinned to an EMPTY fixture: scanning the real /proc as an
# unprivileged user is (correctly) a partial scan — permission-denied pids
# are recorded and force exit 2 — so a clean run needs a fully readable
# proc by construction. The static root proves the ONE designation that
# exempts a root from restart-declaration ("not-applicable") stays healthy.
mkdir -p "$T/host/clean" "$T/proc-clean" "$T/host/static"
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
     "restart": {"unit": "clean.service", "executable": "$T/host/clean/daemon"}},
    {"id": "no-restart-needed", "path": "$T/host/static",
     "classification": "reproducible-artifact",
     "restart": {"method": "not-applicable"}}
  ]
}
JSON
set +e
UNIT_DIR="$T/units/etc/systemd/system" PROC_DIR="$T/proc-clean" \
  python3 "$tool" --config "$T/config-clean.json" > "$T/out2.json" 2>/dev/null
rc2=$?
set -e
[[ $rc2 -eq 0 ]] || { echo "FAIL clean census should exit 0, got $rc2"; exit 1; }
grep -q '"status": "ok"' "$T/out2.json" || { echo 'FAIL clean root not ok'; exit 1; }
grep -q '"method": "not-applicable"' "$T/out2.json" || { echo 'FAIL not-applicable designation missing from output'; exit 1; }
echo 'PASS clean census exits 0; explicit not-applicable designation is the only restart exemption'

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
