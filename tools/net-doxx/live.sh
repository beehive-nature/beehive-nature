#!/bin/sh
# doxx tungsten test, live run. The founder's one line (WSL as root, nothing else):
#
#   wsl -u root -e sh /mnt/c/Users/travi/doxx-tungsten.sh
#
# Preconditions only the founder can meet: a doxx account on the 30-day Pro
# trial, and a token he mints in the portal (Account > Auth Tokens) with role
# net-admin, never admin, and an expiry of 1 to 2 days. The token is typed
# into a hidden prompt, held in a 0600 file under /run for the run, and
# removed on exit. All mutations happen inside three network namespaces
# named bnrtt-A/B/C; the host's own routes are never touched.
set -eu
refuse() { echo "REFUSE: $*" >&2; exit 2; }

HERE=$(cd "$(dirname "$0")" && pwd)
DIR="$HERE/doxx-tungsten"
[ -f "$DIR/tools/net-doxx/tungsten.mjs" ] || DIR=$(cd "$HERE/../.." && pwd)
[ -f "$DIR/tools/net-doxx/tungsten.mjs" ] || refuse "harness not found next to this script"

[ "$(id -u)" = 0 ] || refuse "needs root for network namespaces: wsl -u root -e sh $0"
command -v node >/dev/null 2>&1 || refuse "node is not installed in this Linux"
command -v ip >/dev/null 2>&1 || refuse "iproute2 is not installed"
if [ -f "$DIR/MANIFEST.sha256" ]; then
  (cd "$DIR" && sha256sum -c --quiet MANIFEST.sha256) || refuse "harness files differ from the reviewed copy"
fi
modprobe wireguard 2>/dev/null || [ -d /sys/module/wireguard ] || refuse "wireguard kernel module unavailable"
if ! command -v wg >/dev/null 2>&1; then
  echo "installing wireguard-tools (distribution package, userland tool only)"
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y wireguard-tools >/dev/null 2>&1 || refuse "could not install wireguard-tools"
fi

# Our own leftovers from an interrupted run, by name only.
for n in A B C; do ip netns del "bnrtt-$n" 2>/dev/null || true; done

umask 077
TOK=$(mktemp /run/doxx-tt.XXXXXX)
cleanup() { stty echo 2>/dev/null || true; rm -f "$TOK"; for n in A B C; do ip netns del "bnrtt-$n" 2>/dev/null || true; done; rm -rf /run/bnr-tt; }
trap cleanup EXIT INT TERM

# Up to three tries. Each code is checked with doxx (one read-only call)
# before anything is created.
tries=0
while :; do
  tries=$((tries + 1))
  echo "Paste the NEW Network Admin token (not Primary), then Enter. Nothing will show."
  stty -echo 2>/dev/null || true
  IFS= read -r T || true
  stty echo 2>/dev/null || true
  echo
  [ -n "$T" ] || refuse "no token given"
  # A messy paste is fine: a selection that caught the label, role, date or
  # bracketed-paste markers still contains the token, a 43-character run of
  # letters, digits, - and _. Try each such run; doxx says which one is right.
  CANDS=$(printf '%s' "$T" | sed 's/\x1b\[20[01]~/ /g' | tr -c 'A-Za-z0-9_-' '\n' | awk 'length($0)==43')
  [ -n "$CANDS" ] || CANDS=$(printf '%s' "$T" | tr -d '\033\r\t ')
  T=
  ok=0
  for C in $CANDS; do
    printf '%s\n' "$C" > "$TOK"
    if node "$DIR/tools/net-doxx/tungsten.mjs" --check --token-file "$TOK"; then ok=1; break; fi
  done
  CANDS=
  C=
  [ "$ok" = 1 ] && break
  [ "$tries" -lt 3 ] || refuse "three codes were not accepted; nothing was changed at doxx"
  echo "Try again: on doxx, Account > Auth Tokens, copy the token you just made."
done

echo "running: about 10 minutes, most of it waiting for a short-lived credential to expire"
node "$DIR/tools/net-doxx/tungsten.mjs" --token-file "$TOK" --seat bFUzZ --out "$DIR/out"
