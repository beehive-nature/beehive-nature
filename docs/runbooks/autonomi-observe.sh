#!/usr/bin/env bash
# autonomi-observe.sh — FAIL-CLOSED, allowlisted, nonsecret, READ-ONLY
# fence observations (revision 3 per Astra review #10/5647673959).
#
# Laws of this script:
#   * Only explicitly approved fields are printed. Unknown fields NEVER
#     reach stdout/stderr, whatever the input contains.
#   * No argv, no environment, no raw source lines, no parser errors are
#     ever echoed. Any parse/schema failure => one generic diagnostic on
#     stderr and a nonzero exit.
#   * Input locations are env-overridable for LOCAL TESTS ONLY:
#       OBS_REG OBS_REL OBS_LOG OBS_PS_FILE OBS_HEALTH OBS_NODE_BIN
#       OBS_CLI_BIN OBS_CACHE_BIN OBS_GATEWAY_BIN OBS_DF_TARGETS
#     (OBS_HEALTH: http(s)://... => curl; anything else => local JSON file.)
set -uo pipefail

fail() { printf 'observe: %s\n' "$1" >&2; exit 1; }

JQ_BIN="${OBS_JQ:-jq}" # test override for the missing-tool path; default is plain jq
command -v "$JQ_BIN" >/dev/null 2>&1 || fail "required tool jq missing"
command -v awk >/dev/null 2>&1 || fail "required tool awk missing"

REG="${OBS_REG:-$HOME/.local/share/ant/node_registry.json}"
REL="${OBS_REL:-$HOME/.local/share/ant/upgrades/releases.json}"
LOG="${OBS_LOG:-/mnt/ant-store/logs/node-2/logs/ant-node.$(date +%F).log}"
PS_FILE="${OBS_PS_FILE:-}"
HEALTH_SRC="${OBS_HEALTH:-http://172.18.0.1:8082/health}"
NODE_BIN="${OBS_NODE_BIN:-/mnt/ant-store/data/node-2/ant-node}"
CLI_BIN="${OBS_CLI_BIN:-$HOME/.local/bin/ant}"
CACHE_BIN="${OBS_CACHE_BIN:-$HOME/.local/share/ant/bin/ant-node-0.18.1}"
GATEWAY_BIN="${OBS_GATEWAY_BIN:-$HOME/ant-lane/antd}"
DF_TARGETS="${OBS_DF_TARGETS:-/ /mnt/ant-store}"

# ---- processes: identity/status only. argv/env are never read into output.
echo "== processes (pid/comm/elapsed only; argv/env never printed) =="
if [ -n "$PS_FILE" ]; then
  [ -f "$PS_FILE" ] || fail "process fixture unreadable"
  ps_out=$(awk '$2=="ant-node"||$2=="antd"||$2=="ant" {printf "pid=%s comm=%s elapsed=%s\n",$1,$2,$3}' "$PS_FILE") \
    || fail "process listing unparseable"
else
  ps_out=$(ps -eo pid=,comm=,etime= 2>/dev/null \
    | awk '$2=="ant-node"||$2=="antd"||$2=="ant" {printf "pid=%s comm=%s elapsed=%s\n",$1,$2,$3}') \
    || fail "process listing unparseable"
fi
if [ -n "$ps_out" ]; then printf '%s\n' "$ps_out"; else echo "(no ant processes listed)"; fi

# ---- versions: only a semver-shaped token survives; anything else in the
# tool's output (including injected junk) is dropped by construction.
semver_of() { grep -oE '[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.]+)?' | head -n1; }
echo "== versions =="
if [ -x "$NODE_BIN" ] || [ -f "$NODE_BIN" ]; then
  v=$("$NODE_BIN" --version 2>/dev/null | semver_of); [ -n "$v" ] || fail "node version output unparseable"
  echo "ant_node_version=$v"
else echo "ant_node=absent"; fi
if [ -x "$CLI_BIN" ] || [ -f "$CLI_BIN" ]; then
  v=$("$CLI_BIN" --version 2>/dev/null | semver_of); [ -n "$v" ] || fail "cli version output unparseable"
  echo "ant_cli_version=$v"
else echo "ant_cli=absent"; fi

# ---- digests: fixed known paths, hash only (no untrusted content).
echo "== artifact digests =="
for f in "$NODE_BIN" "$CACHE_BIN" "$CLI_BIN" "$GATEWAY_BIN"; do
  if h=$(sha256sum "$f" 2>/dev/null | awk '{print $1}'); then
    printf '%s sha256=%s\n' "$f" "$h"
  else
    printf '%s unreadable\n' "$f"
  fi
done

# ---- daemon registry: schema-validated, explicit field selection.
# Unknown fields (however secret) are dropped by the projection itself.
echo "== daemon registry (approved fields only) =="
reg=$("$JQ_BIN" -e '
  if (type != "object") or (.nodes | type) != "object" then error("schema") else . end
  | .nodes | to_entries
  | map({id: .key,
         version:          (.value.version // null),
         upgrade_channel:  (.value.upgrade_channel // null),
         binary_path:      (.value.binary_path // null),
         data_dir:         (.value.data_dir // null),
         evm_network:      (.value.evm_network // null)})
' "$REG" 2>/dev/null) || fail "registry: approved-field extraction failed"
printf '%s\n' "$reg"

# ---- upgrade-monitor view: same law (schema check + projection).
echo "== upgrade-monitor view (approved fields only) =="
rel=$("$JQ_BIN" -e '
  if (type != "object") or (.releases | type) != "array" or (.releases[0] | type) != "object" then error("schema") else . end
  | {fetched_at_epoch_secs,
     newest:        {tag_name: .releases[0].tag_name, prerelease: .releases[0].prerelease},
     latest_stable: {tag_name: ([.releases[] | select(.prerelease | not)][0].tag_name)}}
' "$REL" 2>/dev/null) || fail "upgrade-monitor: approved-field extraction failed"
printf '%s\n' "$rel"

# ---- today's log: extracted named values only. Lines that do not match a
# known shape are OMITTED, never echoed.
echo "== today's upgrade + put-refusal signals (extracted values only) =="
if [ ! -f "$LOG" ]; then
  echo "log: absent for today"
else
  n_none=$(grep -c 'No upgrade available' "$LOG" 2>/dev/null || true)
  next_ts=$(grep 'Next upgrade check scheduled for' "$LOG" 2>/dev/null | tail -n1 \
            | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+(\.[0-9]+)?\+00:00' | tail -n1)
  n_rej=$(grep -c 'Rejecting PUT' "$LOG" 2>/dev/null || true)
  last_rej=$(grep 'Rejecting PUT' "$LOG" 2>/dev/null | tail -n1 \
             | sed -nE 's/.*Insufficient disk space: ([0-9.]+) GiB available, ([0-9.]+) GiB reserve.*/last_refusal: available_gib=\1 reserve_gib=\2/p')
  echo "no_upgrade_available_count=${n_none:-0}"
  [ -n "$next_ts" ] && echo "next_check_scheduled=$next_ts" || echo "next_check_scheduled=unparsed"
  echo "rejecting_put_count=${n_rej:-0}"
  [ -n "$last_rej" ] && echo "$last_rej" || echo "last_refusal=unparsed"
  ing=$(awk '/ingress_dropped=0 received=/ {
               for (i=1;i<=NF;i++) if ($i ~ /^received=/) {split($i,a,"="); s+=a[2]; n++}}
             END {if (n>0) printf "%d across %d summaries", s, n}' "$LOG" 2>/dev/null)
  [ -n "$ing" ] && echo "first_audit_ingress_received: $ing" || echo "first_audit_ingress_received=unparsed"
fi

# ---- gateway health: fetch (or read fixture), then projection only.
echo "== gateway health (approved fields only) =="
case "$HEALTH_SRC" in
  http://*|https://*) health=$(curl -s -m 5 "$HEALTH_SRC" 2>/dev/null) || fail "health: source unreachable" ;;
  *)                  [ -f "$HEALTH_SRC" ] || fail "health: source unreadable"
                      health=$(cat "$HEALTH_SRC" 2>/dev/null) || fail "health: source unreadable" ;;
esac
h=$(printf '%s' "$health" | "$JQ_BIN" -e '
  if (type != "object") or (.status | type) != "string" or (.version | type) != "string"
     then error("schema") else . end
  | {status, version, build_commit, evm_network, uptime_seconds}
' 2>/dev/null) || fail "health: approved-field extraction failed"
printf '%s\n' "$h"

# ---- disk floors: df's own fixed columns for known targets.
echo "== disk floors =="
# shellcheck disable=SC2086
df -h $DF_TARGETS 2>/dev/null || echo "df: unavailable"

echo "observe: ok"
