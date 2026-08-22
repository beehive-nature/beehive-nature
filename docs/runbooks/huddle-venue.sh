#!/usr/bin/env bash
# huddle-venue.sh — ONE-LINE deployment act for the forge huddle's local venue.
# The founder's line:   bash docs/runbooks/huddle-venue.sh
# (or from Windows:     wsl -e bash -lc 'cd /mnt/c/Users/travi/beehive-nature && bash docs/runbooks/huddle-venue.sh')
#
# TESTNET-ONLY: --dev uses livekit-server's well-known public dev keys (devkey/secret).
# Never expose this venue to the internet. Production venues stay founder-held (key law).
set -euo pipefail
VDIR="$HOME/.huddle-venue"; mkdir -p "$VDIR"; cd "$VDIR"
BIN="./livekit-server"
if [ ! -x "$BIN" ]; then
  echo ">> downloading livekit-server (once)…"
  URL=$(curl -sL https://api.github.com/repos/livekit/livekit/releases/latest \
        | grep -o 'https://[^"]*livekit_[^"]*linux_amd64.tar.gz' | head -1)
  curl -sL -o lk.tar.gz "$URL" && tar xzf lk.tar.gz
fi
if curl -s -o /dev/null --max-time 2 http://localhost:7880; then
  echo ">> venue already running on :7880"
else
  echo ">> starting dev venue on ws://localhost:7880 …"
  nohup "$BIN" --dev --bind 0.0.0.0 > venue.log 2>&1 &
  sleep 3
  curl -s -o /dev/null --max-time 3 http://localhost:7880 || { echo "!! venue did not come up — see $VDIR/venue.log"; exit 1; }
fi
# mint a 12h join token with the public dev secret (testnet-grade)
if command -v python3 >/dev/null 2>&1; then
  python3 <<'PY'
import base64, hmac, hashlib, json, time
def b64(d): return base64.urlsafe_b64encode(d if isinstance(d, bytes) else d.encode()).rstrip(b'=')
head = b64(json.dumps({"alg":"HS256","typ":"JWT"}))
body = b64(json.dumps({"iss":"devkey","sub":"founder","name":"founder",
                       "exp":int(time.time())+43200,
                       "video":{"roomJoin":True,"room":"forge"}}))
sig = b64(hmac.new(b"secret", head + b"." + body, hashlib.sha256).digest())
print("OPEN_IN_BROWSER:")
print("https://beehive-nature.github.io/beehive-nature/surfaces/forge/huddle.html?url=ws%3A%2F%2Flocalhost%3A7880&token="+(head+b"."+body+b"."+sig).decode()+"&room=forge&name=founder&autostart=1")
PY
else
  node <<'JS'
const crypto=require('crypto');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const head=b64({alg:'HS256',typ:'JWT'});
const body=b64({iss:'devkey',sub:'founder',name:'founder',exp:Math.floor(Date.now()/1000)+43200,video:{roomJoin:true,room:'forge'}});
const sig=crypto.createHmac('sha256','secret').update(head+'.'+body).digest('base64url');
console.log('OPEN_IN_BROWSER:');
console.log('https://beehive-nature.github.io/beehive-nature/surfaces/forge/huddle.html?url=ws%3A%2F%2Flocalhost%3A7880&token='+head+'.'+body+'.'+sig+'&room=forge&name=founder&autostart=1');
JS
fi
echo
echo ">> friends on other machines: they need the venue reachable — for a real room use a"
echo ">> founder-held venue (key law) and paste its wss:// URL + a token into the huddle page."
