#!/usr/bin/env bash
# autonomi-observe.test.sh — LOCAL synthetic secret-canary tests for
# autonomi-observe.sh's fail-closed allowlist (per Astra review #10/5647673959).
# No box contact, no network: every input is a fixture under a temp dir.
# Canary law: the string ZCANARY must NEVER appear in stdout or stderr.
# Overrides append AFTER the base env: GNU env lets the last assignment win.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/autonomi-observe.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0; failed=0
ok()  { pass=$((pass+1));  echo "PASS: $1"; }
bad() { failed=$((failed+1)); echo "FAIL: $1"; }

# run_case <label> -- <env assignments...>  => sets OUT, ERR, RC, BOTH
run_case() {
  local label="$1"; shift; shift # drop '--'
  OUT=$(env "$@" bash "$SCRIPT" 2>"$WORK/err.txt"); RC=$?
  ERR=$(cat "$WORK/err.txt")
  BOTH="$OUT"$'\n'"$ERR"
}
assert_rc0()     { [ "$RC" -eq 0 ] && ok "$1 (rc=0)" || bad "$1 (rc=$RC, want 0)"; }
assert_rc_non0() { [ "$RC" -ne 0 ] && ok "$1 (rc!=0)" || bad "$1 (rc=0, want nonzero)"; }
assert_has()     { printf '%s' "$BOTH" | grep -qF -- "$2" && ok "$1" || bad "$1 (missing: $2)"; }
assert_lacks()   { if printf '%s' "$BOTH" | grep -q 'ZCANARY'; then bad "$1 (CANARY LEAKED)"; else ok "$1"; fi; }

# ---------- fixtures ----------
# registry: approved fields + canaries in rewards_address AND an unknown field
cat > "$WORK/reg.json" <<'EOF'
{"schema_version":1,
 "nodes":{"2":{"id":2,"service_name":"node2",
   "rewards_address":"0xZCANARY_REG_REWARDS",
   "member_private_note":"ZCANARY_REG_UNKNOWN",
   "data_dir":"/mnt/ant-store/data/node-2",
   "log_dir":"/mnt/ant-store/logs/node-2/logs",
   "binary_path":"/mnt/ant-store/data/node-2/ant-node",
   "version":"0.18.1","env_variables":{},"bootstrap_peers":[],
   "upgrade_channel":null,"evm_network":"arbitrum-one","eviction":null}},
 "next_id":3}
EOF
printf '{"nodes": "ZCANARY_MALFORMED_TRUNCATED' > "$WORK/reg-bad.json"

cat > "$WORK/rel.json" <<'EOF'
{"repo":"WithAutonomi/ant-node","fetched_at_epoch_secs":1789232809,
 "internal_channel_note":"ZCANARY_REL_UNKNOWN",
 "releases":[
  {"tag_name":"v0.19.0-rc.2","prerelease":true,"uploader_key":"ZCANARY_REL_UPLOADER"},
  {"tag_name":"v0.18.1","prerelease":false}]}
EOF

cat > "$WORK/node.log" <<'EOF'
2026-09-12T17:06:49.590831Z  INFO ant_node::node: No upgrade available
2026-09-12T17:06:49.590854Z  INFO ant_node::node: Next upgrade check scheduled for 2026-09-12T18:09:26.590851319+00:00
2026-09-12T16:33:07.658368Z  INFO ant_node::storage::disk_precheck: Rejecting PUT before payment verification: storage error: Insufficient disk space: 0.40 GiB available, 0.49 GiB reserve required, and only 36864 B reusable inside the local store. addr=ZCANARY_LOG_ADDR
2026-09-12T17:00:00Z  WEIRD-CHANGED-FORMAT disk=full embedded_secret=ZCANARY_LOG_WEIRD_SHOULD_NEVER_PRINT
2026-09-12T17:21:12.892319Z  INFO ant_node::replication: First-audit scheduler summary: audit_trigger=first_monetized ingress_dropped=0 received=42 queued=0
EOF

# ps fixture: three columns + argv-like extra columns carrying canaries
cat > "$WORK/ps.txt" <<'EOF'
15409 ant-node 8-07:10:11 --rewards-address 0xZCANARY_PS_ARGV --env SECRET=ZCANARY_PS_ENV
42489 antd 8-07:10:11 --rest-addr 172.18.0.1:8082 --token ZCANARY_PS_TOKEN
99901 randomapp 1:00:00 --canary ZCANARY_PS_OTHER
EOF

cat > "$WORK/health.json" <<'EOF'
{"status":"ok","version":"0.12.0","build_commit":"8378338ca04d",
 "evm_network":"arbitrum-one","uptime_seconds":696499,
 "payment_token_address":"ZCANARY_HEALTH_ADDR","future_field":"ZCANARY_HEALTH_UNKNOWN"}
EOF
printf '{"status":"ok","version":"ZCANARY_HEALTH_MALFORMED' > "$WORK/health-bad.json"

# fake binaries whose --version output carries junk beyond the semver
printf '#!/bin/sh\necho "ant-node 0.18.1 ZCANARY_VERSION_JUNK"\n' > "$WORK/fake-node"
printf '#!/bin/sh\necho "ant 0.3.6 ZCANARY_VERSION_JUNK"\n'      > "$WORK/fake-ant"
chmod +x "$WORK/fake-node" "$WORK/fake-ant"

ENVOK=(OBS_REG="$WORK/reg.json" OBS_REL="$WORK/rel.json" OBS_LOG="$WORK/node.log"
       OBS_PS_FILE="$WORK/ps.txt" OBS_HEALTH="$WORK/health.json"
       OBS_NODE_BIN="$WORK/fake-node" OBS_CLI_BIN="$WORK/fake-ant"
       OBS_CACHE_BIN="$WORK/absent-a" OBS_GATEWAY_BIN="$WORK/absent-b"
       OBS_DF_TARGETS="/")

echo "== T1 happy path: approved fields survive, every canary suppressed =="
run_case T1 -- "${ENVOK[@]}"
assert_rc0      "T1 exit status"
assert_has      "T1 registry version"        '"version": "0.18.1"'
assert_has      "T1 registry channel"        '"upgrade_channel": null'
assert_has      "T1 monitor newest"          '"tag_name": "v0.19.0-rc.2"'
assert_has      "T1 monitor latest stable"   '"tag_name": "v0.18.1"'
assert_has      "T1 health version"          '"version": "0.12.0"'
assert_has      "T1 node version extracted"  'ant_node_version=0.18.1'
assert_has      "T1 cli version extracted"   'ant_cli_version=0.3.6'
assert_has      "T1 no-upgrade count"        'no_upgrade_available_count=1'
assert_has      "T1 next check ts"           'next_check_scheduled=2026-09-12T18:09:26'
assert_has      "T1 refusal numbers"         'last_refusal: available_gib=0.40 reserve_gib=0.49'
assert_has      "T1 ingress total"           'first_audit_ingress_received: 42 across 1 summaries'
assert_has      "T1 process identity"        'pid=15409 comm=ant-node'
assert_has      "T1 gateway identity"        'pid=42489 comm=antd'
assert_lacks    "T1 zero canaries (registry/rewards/rel/health/log/ps/version)"

echo "== T2 malformed registry JSON: fail closed, no source echo =="
run_case T2 -- "${ENVOK[@]}" "OBS_REG=$WORK/reg-bad.json"
assert_rc_non0  "T2 nonzero exit"
assert_has      "T2 generic diagnostic"      'registry: approved-field extraction failed'
assert_lacks    "T2 malformed source not echoed"

echo "== T3 missing jq: generic failure, nonzero =="
# OBS_JQ is the script's test override for the jq lookup (default: plain jq).
# Pointing it at a nonexistent path exercises the missing-tool fail-closed path
# without PATH games.
run_case T3 -- "${ENVOK[@]}" "OBS_JQ=$WORK/definitely-missing-jq"
assert_rc_non0  "T3 nonzero exit"
assert_has      "T3 generic diagnostic"      'required tool jq missing'
assert_lacks    "T3 no canary"

echo "== T4 malformed health JSON: fail closed =="
run_case T4 -- "${ENVOK[@]}" "OBS_HEALTH=$WORK/health-bad.json"
assert_rc_non0  "T4 nonzero exit"
assert_has      "T4 generic diagnostic"      'health: approved-field extraction failed'
assert_lacks    "T4 malformed source not echoed"

echo "== T5 changed log shape: unparseable line omitted, approved survive =="
run_case T5 -- "${ENVOK[@]}"
assert_has      "T5 refusal count"           'rejecting_put_count=1'
assert_has      "T5 approved refusal values" 'last_refusal: available_gib=0.40 reserve_gib=0.49'
if printf '%s' "$BOTH" | grep -q 'WEIRD-CHANGED-FORMAT'; then
  bad "T5 unparseable line was echoed verbatim"
else
  ok "T5 unparseable line omitted"
fi
assert_lacks    "T5 zero canaries incl. changed-shape line"

echo
echo "RESULT: $pass passed, $failed failed"
[ "$failed" -eq 0 ]
