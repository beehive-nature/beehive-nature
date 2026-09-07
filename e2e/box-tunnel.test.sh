#!/usr/bin/env bash
# Exercise the real lease/control logic with a fake SSH transport. No network,
# keys, daemon start, real control socket, or production cache is touched.
set -euo pipefail
helper=$(cd "$(dirname "$0")/../ops/x0x" && pwd)/box-tunnel.sh
test_root=$(mktemp -d /tmp/bnr-box-tunnel-test.XXXXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin"
export XDG_CACHE_HOME="$test_root/cache"
export PATH="$test_root/bin:$PATH"
export BNR_MOCK_FAIL="$test_root/refuse"
cat > "$test_root/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
set -eu
control='';operation=start
while (( $# )); do
  case "$1" in
    -S) control=$2; shift 2;;
    -O) operation=$2; shift 2;;
    *) shift;;
  esac
done
[[ -n $control ]] || exit 2
case "$operation" in
  start) [[ ! -e $BNR_MOCK_FAIL ]] || exit 1; touch "$control.live";;
  check) [[ -e $control.live ]];;
  exit) rm -f -- "$control.live";;
esac
MOCK
chmod +x "$test_root/bin/ssh"

touch "$test_root/unrelated-session"
bash "$helper" up 2 api >/dev/null
first=$(cat "$XDG_CACHE_HOME/bnr-box-tunnel/current")
bash "$helper" up 7 api >/dev/null
sleep 3
[[ -f $first/control.live ]] || { echo 'FAIL old deadline stopped renewed session'; exit 1; }
echo 'PASS renewal survives the old deadline'
sleep 6
[[ ! -f $first/control.live ]] || { echo 'FAIL lease did not expire'; exit 1; }
echo 'PASS automatic expiry closes its transport'

bash "$helper" up 2 api >/dev/null
old=$(cat "$XDG_CACHE_HOME/bnr-box-tunnel/current")
bash "$helper" down >/dev/null
bash "$helper" up 10 api >/dev/null
new=$(cat "$XDG_CACHE_HOME/bnr-box-tunnel/current")
[[ $old != "$new" ]]
sleep 3
[[ -f $new/control.live ]] || { echo 'FAIL previous watcher stopped replacement'; exit 1; }
bash "$helper" down >/dev/null
[[ ! -f $new/control.live && -f $test_root/unrelated-session ]]
echo 'PASS shutdown and stale watchers are scoped to their own sessions'

touch "$BNR_MOCK_FAIL"
if bash "$helper" up 5 api >/dev/null 2>&1; then echo 'FAIL bind failure reported success'; exit 1; fi
[[ -f $test_root/unrelated-session ]]
echo 'PASS transport/bind failure refuses without stopping another session'
