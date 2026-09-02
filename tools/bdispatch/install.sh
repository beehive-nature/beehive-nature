#!/usr/bin/env bash
# install.sh — bDISPATCH on the Oracle VPS (the box already running buzz-acp as bClaude).
# Run as the login user that owns the repo checkout (default ~/beehive-nature); sudo used ONLY
# to make the existing key readable by that user via a root-owned 0600 copy path. Idempotent.
#
# KEY: REUSES the existing bClaude key — NOTHING IS MINTED. buzz-acp keeps it at
#   /opt/buzz-bclaude/bclaude.nsec  (600; cited: docs/dispatches/LANE_BCLAUDE_DEPLOY_2026-08-28.md)
# and also in /etc/buzz-bclaude/bclaude.env. If the first path is not readable by this user, the
# unit is pointed at a root-owned 0600 copy at /etc/bnr/bclaude.nsec (made here with sudo, never
# printed). Secret never enters this script's output, the repo, or a log.
#
# REPO SYNC PICK (logged here): `git pull --rebase --autostash` on a systemd user TIMER every
# 60 s. Reason: the canonical remote is GitHub, which offers no post-receive hook to this box;
# a webhook would need an inbound listener on the relay host (more surface). Autostash/rebase
# keeps the watcher's appended RELAYED lines across pulls; idempotency does not depend on them
# (watcher keeps a local ledger). If the checkout has a deploy key with push, RELAYED lines are
# pushed back in §7 shape (author founder, committer seat); otherwise they stay local — logged.
set -euo pipefail
REPO="${BDISPATCH_REPO:-$HOME/beehive-nature}"
KEY_SRC=/opt/buzz-bclaude/bclaude.nsec
KEY_ALT=/etc/bnr/bclaude.nsec
UNITDIR="$HOME/.config/systemd/user"
DISP="$REPO/docs/dispatches"
BCLAUDE_NPUB=npub14waeml8y8x0nn5vyrea4rka0gwqt0tdu38vzpuxzzlfyy538vwlsqe2696   # PUBLIC-CONSTANT: bClaude npub
BCLAUDE_HEX=abbb9dfce4399f39d1841e7b51dbaf4380b7adbc89d820f0c217d242522763bf  # PUBLIC-CONSTANT: bClaude nostr public key

echo "[1/6] deps"
python3 -m pip install --quiet --user "nostr-sdk==0.42.1"

echo "[2/6] key path (reuse bClaude; mint nothing)"
if [ -r "$KEY_SRC" ]; then
  KEY="$KEY_SRC"; echo "  using $KEY_SRC (readable by $USER)"
else
  echo "  $KEY_SRC not readable by $USER -> root-owned 0600 copy at $KEY_ALT (sudo; content never shown)"
  sudo install -d -m 0750 -o root -g "$USER" /etc/bnr
  sudo sh -c "umask 077; cp '$KEY_SRC' '$KEY_ALT' && chown root:$USER '$KEY_ALT' && chmod 0640 '$KEY_ALT'"
  # 0640 root:$USER — group-readable by exactly this user; watcher's mode check allows no world bits.
  KEY="$KEY_ALT"
fi
python3 - "$KEY" "$BCLAUDE_HEX" <<'PY'
import sys, pathlib
from nostr_sdk import Keys
nsec = pathlib.Path(sys.argv[1]).read_text().strip().split("=")[-1]
ok = Keys.parse(nsec).public_key().to_hex() == sys.argv[2]
del nsec
print("  key check:", "matches bClaude pubkey abbb9dfc…" if ok else "DOES NOT MATCH — stop"); sys.exit(0 if ok else 1)
PY

echo "[3/6] hand-off + NIP-05 (public material only)"
printf '%s\n%s\n%s\n' "$BCLAUDE_NPUB" "bclaude@skaists.dev" "Manage agent access → add this pubkey." > "$DISP/BDISPATCH-GRANT.md"
SITE_WK=""; for c in /var/www/skaists.dev/.well-known /srv/skaists.dev/.well-known "$HOME/skaists.dev/.well-known"; do [ -d "$c" ] && SITE_WK="$c" && break; done
if [ -n "$SITE_WK" ]; then
  python3 - "$SITE_WK/nostr.json" "$BCLAUDE_HEX" <<'PY'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1]); d = json.loads(p.read_text()) if p.exists() else {"names": {}}
d.setdefault("names", {})["bclaude"] = sys.argv[2]; p.write_text(json.dumps(d, separators=(",", ":")))
print("  NIP-05 written:", p)
PY
else
  printf '{"names":{"bclaude":"%s"}}' "$BCLAUDE_HEX" > "$DISP/nip05-bclaude.json"
  echo "  skaists.dev tree not on this box -> docs/dispatches/nip05-bclaude.json (serve it at https://skaists.dev/.well-known/nostr.json)"
fi

echo "[4/6] seat pubkeys from ~/.buzz (secrets skipped; MISSING rows are honest)"
python3 "$REPO/tools/bdispatch/seatscan.py" || true

echo "[5/6] systemd user units (watcher + pull timer), linger for reboot survival"
mkdir -p "$UNITDIR"
sed -e "s#^Environment=BDISPATCH_NSEC_FILE=.*#Environment=BDISPATCH_NSEC_FILE=$KEY#" -e "s#%h/beehive-nature#$REPO#g" \
  "$REPO/tools/bdispatch/bnr-bdispatch-watcher.service" > "$UNITDIR/bnr-bdispatch-watcher.service"
cat > "$UNITDIR/bnr-bdispatch-pull.service" <<EOF
[Unit]
Description=bnr bDISPATCH repo pull (autostash keeps RELAYED lines)
[Service]
Type=oneshot
WorkingDirectory=$REPO
ExecStart=/usr/bin/git pull --rebase --autostash --quiet
EOF
cat > "$UNITDIR/bnr-bdispatch-pull.timer" <<'EOF'
[Unit]
Description=bnr bDISPATCH pull every 60s
[Timer]
OnBootSec=30
OnUnitActiveSec=60
[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now bnr-bdispatch-pull.timer bnr-bdispatch-watcher.service
sudo loginctl enable-linger "$USER"
if git -C "$REPO" push --dry-run origin main >/dev/null 2>&1; then echo "  push rights present: RELAYED lines can be pushed back (§7 shape)"; else echo "  no push rights from this checkout: RELAYED lines stay local (ledger is the idempotency source)"; fi

echo "[6/6] test drop -> goose"
printf 'SEND TO: goose\nACK bDISPATCH — reply with your seat name and this event id\n' > "$DISP/TEST-BDISPATCH-$(date -u +%F).md"
echo "watch: journalctl --user -u bnr-bdispatch-watcher -f   (expect 'event <id>'; goose row must exist in SEAT-PUBKEYS.md)"
echo "verify on relay (nak, Unlicense — VERIFIED-FACTS A60): nak req -k 1059 -a $BCLAUDE_HEX wss://skaists.buzz"
