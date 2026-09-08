#!/usr/bin/env bash
# Explicit laptop session; no P2P daemon or inbound listener. No auto-renewal.
set -euo pipefail
umask 077
action=${1:-status}
state="$HOME/.local/state/bnr-laptop-share"
mkdir -p "$state"
chmod 700 "$state"
exec 9>"$state/lock"
flock -x 9
unit=''
if [[ -f $state/unit ]]; then IFS= read -r unit < "$state/unit"; fi
[[ -z $unit || $unit =~ ^bnr-laptop-build-[a-f0-9]{12}\.service$ ]] || exit 2
case "$action" in
  up)
    if [[ -n $unit ]] && systemctl --user is-active --quiet "$unit"; then
      echo "Laptop sharing already active: $unit (original expiry retained)."
      exit 0
    fi
    command -v bwrap >/dev/null
    here=$(cd -- "$(dirname -- "$0")" && pwd -P)
    unit="bnr-laptop-build-$(python3 -c 'import uuid; print(uuid.uuid4().hex[:12])').service"
    systemd-run --user --quiet --unit="$unit" --service-type=exec \
      -p RuntimeMaxSec=600 -p CPUQuota=150% -p MemoryMax=2G -p TasksMax=128 \
      -p KillMode=control-group -p TimeoutStopSec=5 -p UMask=0077 \
      /usr/bin/python3 "$here/worker.py" --lease 580
    echo "$unit" > "$state/unit"
    echo "Laptop sharing active for at most 10 minutes; CPU 150%, RAM 2 GiB, one job. Unit: $unit"
    ;;
  down)
    if [[ -n $unit ]]; then systemctl --user stop "$unit"; fi
    echo 'This laptop-sharing session is stopped.'
    ;;
  status)
    if [[ -n $unit ]]; then
      if systemctl --user is-active --quiet "$unit"; then
        systemctl --user show "$unit" -p ActiveState -p SubState -p Result -p CPUQuotaPerSecUSec -p MemoryMax -p RuntimeMaxUSec
      else
        echo 'Last sharing session ended. It was configured for CPU 150%, RAM 2 GiB, maximum 10 minutes.'
      fi
      journalctl --user -u "$unit" -n 8 --no-pager -o cat
    else echo 'Laptop sharing has not been started.'; fi
    ;;
  *) echo 'usage: share.sh up|down|status' >&2; exit 2 ;;
esac
