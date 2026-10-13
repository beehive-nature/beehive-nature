#!/usr/bin/env bash
# keys-edge lab: the edge kit (ops/keys-edge) end to end in throwaway docker on a CI runner.
# Every step prints its raw evidence; any mismatch exits non-zero. No real key, no secret, no
# network beyond image, package and crate pulls: the release is signed by a throwaway key made in the run,
# the certificate comes from Caddy's internal CA, and the ANT door is a mock on keys-door's own
# loopback.
#
#   bash ops/keys-edge/lab/lab.sh all      a. image  b. release chain  c. keys-door #1 (compose.yml)
#                                          d. caddy + Caddyfile.keys  e. TLS and HTTP probes
#                                          f. a fresh edge from a peer  g. rollback and tamper
#   bash ops/keys-edge/lab/lab.sh chain    b only (node, no docker): the chain, configs and mock
#                                          door files under KEYS_EDGE_LAB_DIR
#
# Never run it on the edge host: it owns the names keys-door and keys-net while it runs, and it
# refuses to start when either exists.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
EDGE="$ROOT/ops/keys-edge"
RELEASE="$ROOT/tools/keychain-release/release.mjs"

# compose.yml and Caddyfile.keys carry these addresses; preflight checks they still do
SUBNET=10.80.96.0/29
KD1_IP=10.80.96.2
CADDY_IP=10.80.96.3
KD2_IP=10.80.96.4
PROBE_IP=10.80.96.5
HOST=keys.skaists.dev
MOCK_DOOR=http://127.0.0.1:8098
PEER1=peer1.keys-lab.test

CADDY_IMAGE=caddy:2.11.4
ALPINE_IMAGE=alpine:3.22
DEBIAN_SUITE=bookworm
PROJECT=keys-edge-lab
IMAGE=keys-door:lab
TOOLS=keys-lab-tools:local
KD1=keys-door
KD2=keys-lab-kd2
CADDY=keys-lab-caddy
MOCK=keys-lab-antmock
PROBE=keys-lab-probe
KD2_VOLUME=keys-lab-kd2-state

LAB=${KEYS_EDGE_LAB_DIR:-}
OWNED=0
RESULTS=()

say() { printf '\n== %s\n' "$*"; }
run() { printf '+ %s\n' "$*"; "$@"; }
die() { printf '\nLAB FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS %s\n' "$*"; RESULTS+=("PASS  $*"); }
labjs() { node "$HERE/lab.mjs" "$@"; }
record_paths() { node -e 'for (const f of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).files) console.log(f.path)' "$1"; }
compose() { docker compose -p "$PROJECT" -f "$EDGE/compose.yml" "$@"; }

setup_dir() {
  if [[ -z $LAB ]]; then LAB=$(mktemp -d "${RUNNER_TEMP:-/tmp}/keys-edge-lab.XXXXXX"); fi
  mkdir -p "$LAB"
  [[ -z $(ls -A "$LAB") ]] || die "$LAB is not empty"
  echo "lab dir: $LAB"
}

cleanup() {
  local rc=$?
  if (( OWNED )); then
    if (( rc != 0 )); then
      say "failure evidence: container logs"
      for c in "$KD1" "$KD2" "$CADDY" "$MOCK"; do
        docker logs --tail 120 "$c" 2>&1 | sed "s/^/[$c] /" || true
      done
    fi
    if [[ -z ${KEYS_EDGE_LAB_KEEP:-} ]]; then
      docker rm -f "$PROBE" "$MOCK" "$CADDY" "$KD2" >/dev/null 2>&1 || true
      KEYS_DOOR_IMAGE=$IMAGE compose down -v >/dev/null 2>&1 || true
      docker volume rm "$KD2_VOLUME" >/dev/null 2>&1 || true
    fi
  fi
  exit "$rc"
}

preflight() {
  say "preflight"
  run docker version --format 'docker client {{.Client.Version}}, server {{.Server.Version}}'
  run docker compose version
  run node --version
  if docker container inspect keys-door >/dev/null 2>&1; then die "a container named keys-door exists here: the lab never runs beside a real edge"; fi
  if docker network inspect keys-net >/dev/null 2>&1; then die "a network named keys-net exists here: the lab never runs beside a real edge"; fi
  grep -Fq "subnet: $SUBNET" "$EDGE/compose.yml" || die "compose.yml no longer declares $SUBNET"
  grep -Fq "ipv4_address: $KD1_IP" "$EDGE/compose.yml" || die "compose.yml no longer pins keys-door at $KD1_IP"
  grep -Fq "reverse_proxy $KD1_IP:8096" "$EDGE/Caddyfile.keys" || die "Caddyfile.keys no longer proxies to $KD1_IP:8096"
  OWNED=1
}

# The registry digest a tag names now (pulled, then read from the image). Printed, never committed.
digest_of() {
  docker pull -q "$1" >/dev/null
  local d
  d=$(docker image inspect --format '{{index .RepoDigests 0}}' "$1")
  d=${d#*@}
  [[ $d =~ ^sha256:[0-9a-f]{64}$ ]] || die "no registry digest for $1 (got '$d')"
  printf '%s' "$d"
}

health() { docker run --rm --network "container:$1" "$TOOLS" curl -sS --max-time 5 "http://127.0.0.1:8097/health" 2>&1 || true; }

# wait_seq CONTAINER SEQ SECONDS: health until it serves SEQ
wait_seq() {
  local c=$1 want=$2 limit=$3 h="" i
  for (( i = 0; i < limit; i += 3 )); do
    h=$(health "$c")
    if [[ $(labjs get seq <<<"$h" 2>/dev/null || true) == "$want" ]]; then printf '%s\n' "$h"; return 0; fi
    sleep 3
  done
  printf 'health of %s after %ss: %s\n' "$c" "$limit" "$h" >&2
  return 1
}

# ── a. the image ────────────────────────────────────────────────────────────
step_a() {
  say "a. build the keys-door image (ops/keys-edge/Dockerfile)"
  RUST_VERSION=$(sed -n 's/^channel = "\([0-9.]*\)"$/\1/p' "$ROOT/rust-toolchain.toml")
  [[ $RUST_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "rust-toolchain.toml channel is not a version: '$RUST_VERSION'"
  local rust_ref="rust:$RUST_VERSION-slim-$DEBIAN_SUITE" run_ref="debian:$DEBIAN_SUITE-slim" rust_d run_d
  rust_d=$(digest_of "$rust_ref")
  run_d=$(digest_of "$run_ref")
  echo "builder image: $rust_ref@$rust_d"
  echo "runtime image: $run_ref@$run_d"
  COMMIT=$(git -C "$ROOT" rev-parse HEAD)
  run docker build --progress=plain -f "$EDGE/Dockerfile" \
    --build-arg RUST_VERSION="$RUST_VERSION" --build-arg DEBIAN_SUITE="$DEBIAN_SUITE" \
    --build-arg RUST_IMAGE_DIGEST="$rust_d" --build-arg RUNTIME_IMAGE_DIGEST="$run_d" \
    --build-arg KEYS_DOOR_COMMIT="$COMMIT" -t "$IMAGE" "$ROOT"
  local user rev bins
  user=$(docker image inspect --format '{{.Config.User}}' "$IMAGE")
  rev=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE")
  run docker image inspect --format 'id {{.Id}}; user {{.Config.User}}; entrypoint {{json .Config.Entrypoint}}; revision {{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE"
  [[ $user == 10096:10096 ]] || die "image user is '$user', want 10096:10096"
  [[ $rev == "$COMMIT" ]] || die "image revision label is '$rev', want $COMMIT"
  run docker run --rm --entrypoint /bin/ls "$IMAGE" -ln /usr/local/bin
  bins=$(docker run --rm --entrypoint /bin/ls "$IMAGE" /usr/local/bin | tr '\n' ' ')
  [[ $bins == "bsigner keys-door " ]] || die "/usr/local/bin holds '$bins', want exactly bsigner and keys-door"
  pass "a. image built on registry-pinned bases; user 10096; revision $COMMIT; /usr/local/bin = bsigner, keys-door"

  local out rc
  out=$(docker run --rm -v "$EDGE/edge.toml.example:/etc/keys-door/edge.toml:ro" "$IMAGE" 2>&1) && rc=0 || rc=$?
  printf '+ keys-door serve --config edge.toml.example -> exit %s\n%s\n' "$rc" "$out"
  [[ $rc == 2 && $out == *genesis_sha3* ]] || die "the unfilled example config was not refused at genesis_sha3"
  pass "a. edge.toml.example parses and keys-door refuses it until the genesis pins are filled"

  say "a. lab tools image ($ALPINE_IMAGE: openssl, curl, python3)"
  local alpine_d
  alpine_d=$(digest_of "$ALPINE_IMAGE")
  echo "tools base: $ALPINE_IMAGE@$alpine_d"
  printf 'FROM %s@%s\nRUN apk add --no-cache bash curl openssl python3\n' "$ALPINE_IMAGE" "$alpine_d" | run docker build -q -t "$TOOLS" -
  local ver
  ver=$(docker run --rm "$TOOLS" openssl version)
  run docker run --rm "$TOOLS" sh -c 'openssl version; curl -V | head -n 1; python3 -V; apk info -v 2>/dev/null | grep -E "^(openssl|curl|libcurl)-"'
  [[ $ver =~ ^OpenSSL\ ([0-9]+)\.([0-9]+) ]] || die "openssl version is '$ver'"
  (( BASH_REMATCH[1] > 3 || (BASH_REMATCH[1] == 3 && BASH_REMATCH[2] >= 5) )) || die "$ver is older than 3.5: it cannot offer X25519MLKEM768"
  pass "a. probe OpenSSL is $ver (>= 3.5)"
}

# ── b. the release chain ────────────────────────────────────────────────────
step_b() {
  say "b. a test release chain (tools/keychain-release; throwaway key made in this run)"
  local seed p1 p2 g
  seed="keys-edge-lab-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  ID=$(node "$RELEASE" sign-test --seed "$seed" --i-understand-this-is-a-test-key | labjs get id)
  echo "throwaway signer: $ID"
  printf '+ release.mjs prepare --out r1 --signers <throwaway>\n'
  p1=$(node "$RELEASE" prepare --out "$LAB/r1" --signers "$ID")
  printf '%s\n' "$p1"
  GENESIS=$(labjs get sha3 <<<"$p1")
  node "$RELEASE" sign-test --seed "$seed" --record "$LAB/r1/record.json" --out "$LAB/r1/record.json.relsig.json" --i-understand-this-is-a-test-key
  run node "$RELEASE" verify --record "$LAB/r1/record.json" --sig "$LAB/r1/record.json.relsig.json" --signers "$ID" --genesis-sha3 "$GENESIS"
  ANT1=$(sha256sum "$LAB/r1/pack.bin" | cut -c1-64)
  run node "$RELEASE" envelope --record "$LAB/r1/record.json" --sig "$LAB/r1/record.json.relsig.json" --hint-ant "$ANT1" --out "$LAB/r1/envelope.json"

  printf '+ release.mjs prepare --out r2 --prev r1/record.json --signers <throwaway>\n'
  p2=$(node "$RELEASE" prepare --out "$LAB/r2" --prev "$LAB/r1/record.json" --signers "$ID")
  printf '%s\n' "$p2"
  [[ $(labjs get seq <<<"$p2") == 2 && $(labjs get prev <<<"$p2") == "$GENESIS" ]] || die "r2 is not seq 2 after r1"
  SEQ2_SHA3=$(labjs get sha3 <<<"$p2")
  node "$RELEASE" sign-test --seed "$seed" --record "$LAB/r2/record.json" --out "$LAB/r2/record.json.relsig.json" --i-understand-this-is-a-test-key
  run node "$RELEASE" verify --record "$LAB/r2/record.json" --sig "$LAB/r2/record.json.relsig.json" --prev "$LAB/r1/record.json"
  ANT2=$(sha256sum "$LAB/r2/pack.bin" | cut -c1-64)
  run node "$RELEASE" envelope --record "$LAB/r2/record.json" --sig "$LAB/r2/record.json.relsig.json" --hint-ant "$ANT2" --out "$LAB/r2/envelope.json"
  echo "genesis (seq 1) sha3: $GENESIS; seq 2 sha3: $SEQ2_SHA3"
  pass "b. seq 1 and seq 2 prepared from this checkout, signed by one throwaway key, enveloped (noble verify accepts both)"

  # The mock ANT door answers GET /v1/data/public/<address> as antd does. The address is a lab
  # label (the pack's sha256 in hex, the 64-hex shape keys-door takes); bytes count only by hash.
  mkdir -p "$LAB/antmock/v1/data/public"
  for a in "1 $ANT1" "2 $ANT2"; do
    labjs ant-body "$LAB/r${a%% *}/pack.bin" "$LAB/antmock/v1/data/public/${a#* }"
  done
  ls -l "$LAB/antmock/v1/data/public"

  # keys-door #1: the example with only the lab's values changed, shown as a diff
  mkdir -p "$LAB/kd1/inbox" "$LAB/kd2/inbox" "$LAB/tamper" "$LAB/share" "$LAB/out"
  g="genesis_sha3=\"$GENESIS\""
  labjs render-toml "$EDGE/edge.toml.example" "$LAB/kd1/edge.toml" "$g" "genesis_signers=[\"$ID\"]" \
    'poll_secs=5' "ant_doors=[\"$MOCK_DOOR\"]"
  labjs render-toml "$EDGE/edge.toml.example" "$LAB/kd2/edge.toml" "$g" "genesis_signers=[\"$ID\"]" \
    'poll_secs=5' 'ant_doors=[]' "peers=[\"https://$PEER1\"]"
  for k in kd1 kd2; do
    printf '+ diff edge.toml.example %s/edge.toml\n' "$k"
    diff -u "$EDGE/edge.toml.example" "$LAB/$k/edge.toml" || true
  done
  cp "$LAB/r1/envelope.json" "$LAB/kd1/inbox/001-seq1.json"
  cp "$LAB/r2/envelope.json" "$LAB/kd1/inbox/002-seq2.json"
  labjs tamper "$LAB/r2/envelope.json" "$LAB/tamper/forged-seq2.json" forged
  labjs tamper "$LAB/r2/envelope.json" "$LAB/tamper/mismatched-seq2.json" mismatched
  # containers read these as other users: world-readable, nothing here is secret
  chmod -R a+rX "$LAB"
}

# ── c. keys-door #1 ─────────────────────────────────────────────────────────
step_c() {
  say "c. keys-door #1 from compose.yml, seeded through its inbox; the pack from a mock ANT door on its loopback"
  export KEYS_DOOR_IMAGE=$IMAGE KEYS_EDGE_CONFIG=$LAB/kd1/edge.toml KEYS_EDGE_INBOX=$LAB/kd1/inbox
  run compose config
  run compose up -d
  run docker inspect --format 'read_only={{.HostConfig.ReadonlyRootfs}} cap_drop={{.HostConfig.CapDrop}} security_opt={{.HostConfig.SecurityOpt}} pids={{.HostConfig.PidsLimit}} mem={{.HostConfig.Memory}} tmpfs={{json .HostConfig.Tmpfs}} ports={{json .HostConfig.PortBindings}} user={{.Config.User}}' "$KD1"
  local nets ip ports
  nets=$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$KD1")
  ip=$(docker inspect --format '{{(index .NetworkSettings.Networks "keys-net").IPAddress}}' "$KD1")
  ports=$(docker port "$KD1" || true)
  echo "networks: $nets; keys-net address: $ip; published ports: '${ports}'"
  [[ $nets == "keys-net " && $ip == "$KD1_IP" && -z $ports ]] || die "keys-door must be on keys-net only, at $KD1_IP, with no published port"
  pass "c. keys-door on keys-net only at $KD1_IP, no published port, read-only, caps dropped"

  # the mock door shares keys-door's network namespace, so it is http://127.0.0.1:8098 to keys-door
  run docker run -d --name "$MOCK" --network "container:$KD1" --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user 65534:65534 -v "$LAB/antmock:/srv:ro" \
    "$TOOLS" python3 -B -m http.server 8098 --bind 127.0.0.1 --directory /srv
  local h
  h=$(wait_seq "$KD1" 2 150) || die "keys-door #1 did not reach seq 2"
  printf 'health: %s\n' "$h"
  [[ $(labjs get record_sha3 <<<"$h") == "$SEQ2_SHA3" && $(labjs get state <<<"$h") == serving ]] || die "keys-door #1 serves another record"
  [[ $(labjs get equivocation <<<"$h") == null ]] || die "keys-door #1 reports an equivocation"
  pass "c. keys-door #1 walked the inbox from genesis to seq 2 ($SEQ2_SHA3) and fetched the pack from the ANT rail"
  run docker logs --tail 40 "$KD1"

  local s="" i
  for (( i = 0; i < 180; i += 5 )); do
    s=$(docker inspect --format '{{.State.Health.Status}}' "$KD1")
    [[ $s == healthy ]] && break
    sleep 5
  done
  run docker inspect --format '{{json .State.Health}}' "$KD1"
  [[ $s == healthy ]] || die "the compose healthcheck says '$s'"
  pass "c. the compose healthcheck reports healthy"
}

# ── d. caddy with the Caddyfile.keys block ──────────────────────────────────
step_d() {
  say "d. caddy ($CADDY_IMAGE) with Caddyfile.keys; the one change is the issuer"
  local caddy_d v
  caddy_d=$(digest_of "$CADDY_IMAGE")
  echo "caddy image: $CADDY_IMAGE@$caddy_d"
  v=$(docker run --rm "$CADDY_IMAGE" caddy version)
  echo "caddy version: $v"
  [[ $v == v2.11.4* ]] || die "caddy version is '$v', want v2.11.4"
  mkdir -p "$LAB/caddy"

  # the exact block appended to the Hostinger mirror, as the owner will apply it
  cat "$ROOT/ops/watch/hostinger/Caddyfile.hostinger" "$EDGE/Caddyfile.keys" > "$LAB/caddy/Caddyfile.hostinger+keys"
  run docker run --rm -v "$LAB/caddy:/cfg:ro" "$CADDY_IMAGE" caddy validate --config /cfg/Caddyfile.hostinger+keys --adapter caddyfile
  pass "d. the mirror Caddyfile.hostinger with Caddyfile.keys appended validates in caddy $v"

  # the lab block: Caddyfile.keys with `issuer internal` added inside its tls block, nothing else
  awk '{ print } /^    key_type p256$/ { print "    issuer internal" }' "$EDGE/Caddyfile.keys" > "$LAB/caddy/keys.lab"
  printf '+ diff Caddyfile.keys keys.lab\n'
  diff -u "$EDGE/Caddyfile.keys" "$LAB/caddy/keys.lab" || true
  local delta
  delta=$(diff "$EDGE/Caddyfile.keys" "$LAB/caddy/keys.lab" | grep -E '^[<>]' || true)
  [[ $delta == '>     issuer internal' ]] || die "the lab block differs from Caddyfile.keys by more than the issuer line"
  {
    printf '{\n  skip_install_trust\n}\n'
    cat "$LAB/caddy/keys.lab"
    # lab-only sites: relay.skaists.dev stands in for the Hostinger site whose SNI a misdirected
    # request presents; peer1 fronts keys-door #1 for step f
    printf 'relay.skaists.dev {\n  tls internal\n  respond "lab stand-in for relay.skaists.dev" 200\n}\n'
    printf '%s {\n  tls internal\n  reverse_proxy %s:8096\n}\n' "$PEER1" "$KD1_IP"
  } > "$LAB/caddy/Caddyfile"
  chmod -R a+rX "$LAB/caddy"
  run cat "$LAB/caddy/Caddyfile"
  run docker run --rm -v "$LAB/caddy:/cfg:ro" "$CADDY_IMAGE" caddy validate --config /cfg/Caddyfile --adapter caddyfile
  run docker run -d --name "$CADDY" --network keys-net --ip "$CADDY_IP" \
    -v "$LAB/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" "$CADDY_IMAGE"
  local i
  for (( i = 0; i < 60; i += 2 )); do
    docker exec "$CADDY" test -f /data/caddy/pki/authorities/local/root.crt && break
    sleep 2
  done
  run docker cp "$CADDY:/data/caddy/pki/authorities/local/root.crt" "$LAB/share/root.crt"
  chmod 0644 "$LAB/share/root.crt"
  run docker run --rm -v "$LAB/share:/lab:ro" "$TOOLS" openssl x509 -in /lab/root.crt -noout -subject -fingerprint -sha256
  pass "d. caddy $v running the block at $CADDY_IP on keys-net, its internal root exported"
}

# ── e. probes ───────────────────────────────────────────────────────────────
SC_OUT=""
SC_RC=0
sclient() {
  local label=$1
  shift
  SC_OUT=$(docker exec "$PROBE" timeout 20 openssl s_client -connect "$CADDY_IP:443" -servername "$HOST" \
    -verify_hostname "$HOST" -CAfile /lab/root.crt -no-CApath -no-CAstore "$@" 2>&1 </dev/null) && SC_RC=0 || SC_RC=$?
  printf -- '--- openssl s_client %s (%s)\n%s\n--- exit %s\n' "$*" "$label" "$SC_OUT" "$SC_RC"
}
# probe.mjs classify(): "New, X, Cipher is <not (NONE)>" is a session; "SSL alert number N" a refusal
accepted() { grep -Eq 'New, [^ ]+, Cipher is [^(]' <<<"$SC_OUT"; }
refused() { ! accepted && grep -Eq 'SSL alert number [0-9]+' <<<"$SC_OUT"; }

FETCH=""
# fetch NAME URL [curl args...]: body and headers into the lab out dir, the -w line printed
fetch() {
  local name=$1 url=$2
  shift 2
  mkdir -p "$(dirname "$LAB/out/$name")"
  FETCH=$(docker exec "$PROBE" curl -sS --max-time 20 --tlsv1.3 --curves X25519MLKEM768 --cacert /lab/root.crt \
    --resolve "$HOST:443:$CADDY_IP" --resolve "relay.skaists.dev:443:$CADDY_IP" \
    -o "/out/$name.body" -D "/out/$name.headers" -w '%{http_code} %{http_version} %{size_download}' "$@" "$url") \
    || die "curl $url failed"
  printf '%s %s -> %s\n' "$name" "$url" "$FETCH"
}

step_e() {
  say "e. probes from $ALPINE_IMAGE on keys-net ($PROBE_IP)"
  run docker run -d --name "$PROBE" --network keys-net --ip "$PROBE_IP" --user "$(id -u):$(id -g)" \
    -v "$LAB/share:/lab:ro" -v "$LAB/out:/out" "$TOOLS" sleep 3600
  run docker exec "$PROBE" openssl version
  run docker exec "$PROBE" sh -c 'curl -V | head -n 1'

  local i hs
  for (( i = 0; i < 30; i += 2 )); do
    hs=$(docker exec "$PROBE" timeout 10 openssl s_client -connect "$CADDY_IP:443" -servername "$HOST" -tls1_3 \
      -groups X25519MLKEM768 </dev/null 2>/dev/null || true)
    grep -Eq 'New, [^ ]+, Cipher is [^(]' <<<"$hs" && break
    sleep 2
  done

  sclient control -tls1_3 -groups X25519MLKEM768
  accepted || die "the control handshake (TLS 1.3, X25519MLKEM768) did not complete: a broken probe is not evidence"
  grep -q 'Negotiated TLS1.3 group: X25519MLKEM768' <<<"$SC_OUT" || die "the control did not negotiate X25519MLKEM768"
  grep -Eq '^ *Protocol *: TLSv1\.3' <<<"$SC_OUT" || die "the control is not TLS 1.3"
  grep -q 'Verify return code: 0 (ok)' <<<"$SC_OUT" || die "the certificate did not verify for $HOST against the lab root"
  pass "e. control: TLS 1.3, group X25519MLKEM768, certificate verifies for $HOST"

  local text
  text=$(sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' <<<"$SC_OUT" | docker exec -i "$PROBE" openssl x509 -noout -text)
  grep -E 'Issuer:|Subject:|Public Key Algorithm|ASN1 OID|NIST CURVE|DNS:' <<<"$text" || true
  grep -q 'Public Key Algorithm: id-ecPublicKey' <<<"$text" && grep -q 'ASN1 OID: prime256v1' <<<"$text" \
    || die "the leaf certificate key is not ECDSA P-256"
  pass "e. leaf certificate key: ECDSA P-256 (key_type p256)"

  local g
  for g in X25519 secp256r1 X448; do
    sclient "only $g" -tls1_3 -groups "$g"
    refused || die "-groups $g alone was not refused by a TLS alert"
    pass "e. -tls1_3 -groups $g alone: refused by alert"
  done
  sclient "TLS 1.2" -tls1_2
  refused || die "-tls1_2 was not refused by a TLS alert"
  pass "e. -tls1_2: refused by alert"

  # every file the seq-2 record names, and /, over TLS with only X25519MLKEM768 offered
  local path
  mapfile -t FILES < <(record_paths "$LAB/r2/record.json")
  for path in "${FILES[@]}"; do
    fetch "files/$path" "https://$HOST/$path"
    [[ ${FETCH%% *} == 200 ]] || die "/$path answered ${FETCH%% *}"
    printf -- '--- headers /%s\n' "$path"
    cat "$LAB/out/files/$path.headers"
    labjs check-headers "$LAB/out/files/$path.headers" || die "/$path headers"
  done
  labjs check-files "$LAB/r2/record.json" "$LAB/out/files" || die "a served file does not match the seq-2 record"
  pass "e. all ${#FILES[@]} files the seq-2 record names: HTTP 200, size + SHA-256 + SHA3-256 match the decoded record digests"
  fetch root "https://$HOST/"
  [[ ${FETCH%% *} == 200 ]] || die "/ answered ${FETCH%% *}"
  labjs same-bytes "$LAB/out/files/index.html.body" "$LAB/out/root.body" || die "/ is not index.html"

  fetch release "https://$HOST/.well-known/bnr-keychain/release"
  [[ ${FETCH%% *} == 200 ]] || die "/.well-known/bnr-keychain/release answered ${FETCH%% *}"
  labjs check-envelope "$LAB/r2/envelope.json" "$LAB/out/release.body" "$LAB/r2/record.json" || die "the served release is not the seq-2 envelope"
  labjs check-headers "$LAB/out/release.headers" || die "release headers"
  fetch pack "https://$HOST/.well-known/bnr-keychain/pack"
  labjs same-bytes "$LAB/r2/pack.bin" "$LAB/out/pack.body" || die "the served pack is not the seq-2 pack"
  pass "e. /.well-known/bnr-keychain/release is the seq-2 envelope byte for byte; /pack is the seq-2 pack"

  # SNI mismatch: a handshake for relay.skaists.dev carrying Host keys.skaists.dev
  fetch relay "https://relay.skaists.dev/"
  [[ ${FETCH%% *} == 200 ]] || die "the relay stand-in answered ${FETCH%% *}: the SNI probe below would prove nothing"
  local v
  for v in --http1.1 --http2; do
    fetch "misdirected$v" "https://relay.skaists.dev/" "$v" -H "Host: $HOST"
    cat "$LAB/out/misdirected$v.headers"
    [[ ${FETCH%% *} == 421 ]] || die "SNI relay.skaists.dev + Host $HOST ($v) answered ${FETCH%% *}, want 421"
  done
  pass "e. SNI relay.skaists.dev with Host $HOST: 421 over HTTP/1.1 and HTTP/2"

  fetch post "https://$HOST/" -X POST --data-binary ''
  cat "$LAB/out/post.headers"
  [[ ${FETCH%% *} == 405 ]] || die "POST / answered ${FETCH%% *}, want 405"
  pass "e. POST /: 405"
  echo "note: 421 and 405 are answered before the header step (the route order in Caddyfile.keys); their headers are printed above, not asserted"
}

# ── f. a fresh edge from a peer ─────────────────────────────────────────────
step_f() {
  say "f. a fresh edge: keys-door #2, empty state, peers = [keys-door #1] only"
  local code
  code=$(docker exec "$PROBE" curl -sS --max-time 10 -o /out/a1-seq1.body -w '%{http_code}' "http://$KD1_IP:8096/.well-known/bnr-keychain/release/1") \
    || die "keys-door #1 did not answer on $KD1_IP:8096"
  echo "GET http://$KD1_IP:8096/.well-known/bnr-keychain/release/1 -> $code"
  if [[ $code != 200 ]]; then
    echo "GATED: this keys-door serves no /.well-known/bnr-keychain/release/<seq> (contract §7 A1, a parallel lane)."
    echo "A peer then offers only its current envelope (seq 2), so a fresh edge with peers only cannot walk from genesis."
    echo "Step f did not run. It runs, and must pass, once keys-door #1 answers release/1."
    echo "::warning title=keys-edge lab step f gated::A1 (/.well-known/bnr-keychain/release/<seq>) is absent: the fresh-edge-from-peers check did not run"
    RESULTS+=("GATED f. fresh edge from peers: A1 endpoint absent (HTTP $code), not run")
    return 0
  fi
  labjs check-envelope "$LAB/r1/envelope.json" "$LAB/out/a1-seq1.body" "$LAB/r1/record.json" || die "release/1 is not the seq-1 envelope"
  # keys-door's peers are https only and it trusts the webpki roots compiled into it; the lab CA
  # behind $PEER1 is not one of them, so a refusal here names that and fails the lab
  run docker volume create "$KD2_VOLUME"
  run docker run -d --name "$KD2" --network keys-net --ip "$KD2_IP" --add-host "$PEER1:$CADDY_IP" \
    --read-only --tmpfs /tmp:size=16m,mode=1777,noexec,nosuid,nodev --cap-drop ALL \
    --security-opt no-new-privileges:true --pids-limit 128 --memory 256m \
    -v "$KD2_VOLUME:/var/lib/keys-door/state" -v "$LAB/kd2/inbox:/var/lib/keys-door/inbox:ro" \
    -v "$LAB/kd2/edge.toml:/etc/keys-door/edge.toml:ro" "$IMAGE"
  local h
  h=$(wait_seq "$KD2" 2 120) || { docker logs --tail 60 "$KD2"; die "keys-door #2 did not reach seq 2 from its peer"; }
  printf 'health: %s\n' "$h"
  [[ $(labjs get record_sha3 <<<"$h") == "$SEQ2_SHA3" ]] || die "keys-door #2 serves another record"
  local path
  for path in "${FILES[@]}"; do
    docker exec "$PROBE" curl -sS --max-time 10 --create-dirs -o "/out/kd2/$path" "http://$KD2_IP:8096/$path" || die "keys-door #2 /$path"
    labjs same-bytes "$LAB/out/files/$path.body" "$LAB/out/kd2/$path" || die "keys-door #2 serves other bytes at /$path"
  done
  pass "f. keys-door #2 resumed from genesis through its peer to seq 2 and serves identical bytes"
}

# ── g. rollback and tamper ──────────────────────────────────────────────────
# offline KIND FILE WANT: keys-door verify on keys-door #1 must refuse FILE with a reason starting WANT
offline() {
  local kind=$1 file=$2 want=$3 out rc
  out=$(docker exec "$KD1" keys-door verify --config /etc/keys-door/edge.toml --envelope "/var/lib/keys-door/inbox/$file" 2>&1) && rc=0 || rc=$?
  printf '+ keys-door verify %s -> exit %s\n%s\n' "$file" "$rc" "$out"
  [[ $rc == 1 && $(labjs get verdict <<<"$out") == refuse && $(labjs get reason <<<"$out") == "$want"* ]] \
    || die "$kind: keys-door verify did not refuse it with '$want'"
}

still_seq2() {
  local h
  sleep 12 # two polls at poll_secs = 5
  h=$(health "$KD1")
  printf 'health: %s\n' "$h"
  [[ $(labjs get seq <<<"$h") == 2 && $(labjs get record_sha3 <<<"$h") == "$SEQ2_SHA3" ]] || die "$1: keys-door #1 left seq 2"
  [[ $(labjs get equivocation <<<"$h") == null ]] || die "$1: keys-door #1 reports an equivocation"
  fetch "release-after-$1" "https://$HOST/.well-known/bnr-keychain/release"
  labjs same-bytes "$LAB/r2/envelope.json" "$LAB/out/release-after-$1.body" || die "$1: the served release changed"
}

step_g() {
  say "g. rollback and tamper on keys-door #1"
  # the serve state holds the chain now; the inbox is emptied so each drop below stands alone
  rm -f "$LAB/kd1/inbox/"*.json
  still_seq2 emptied
  cp "$LAB/r1/envelope.json" "$LAB/kd1/inbox/rollback-seq1.json"
  chmod 0644 "$LAB/kd1/inbox/rollback-seq1.json"
  still_seq2 rollback
  offline rollback rollback-seq1.json "seq 1 is below the floor 2"
  pass "g. the seq-1 envelope dropped into the inbox: still seq 2, refused below the floor"

  cp "$LAB/tamper/forged-seq2.json" "$LAB/tamper/mismatched-seq2.json" "$LAB/kd1/inbox/"
  chmod 0644 "$LAB/kd1/inbox/"*.json
  still_seq2 tamper
  offline forged forged-seq2.json "bad_signature"
  offline mismatched mismatched-seq2.json "file_mismatch"
  run docker logs --since 40s "$KD1"
  pass "g. tampered seq-2 envelopes: forged refused by both verifiers (bad_signature), mismatched refused (file_mismatch); still seq 2"
}

summary() {
  say "summary"
  printf '%s\n' "${RESULTS[@]}"
}

case "${1:-}" in
  all)
    setup_dir
    trap cleanup EXIT
    preflight
    step_a
    step_b
    step_c
    step_d
    step_e
    step_f
    step_g
    summary
    ;;
  chain)
    setup_dir
    step_b
    summary
    ;;
  *)
    echo "usage: lab.sh all|chain" >&2
    exit 2
    ;;
esac
