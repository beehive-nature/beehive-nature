#!/usr/bin/env bash
# keys-edge lab: the edge kit (ops/keys-edge) end to end in throwaway docker on a CI runner.
# Every step prints its raw evidence; any mismatch exits non-zero. No real key, no secret, no
# network beyond image, package and crate pulls: the release is signed by a throwaway key made in the run,
# the certificate comes from Caddy's internal CA, and the ANT door is a mock on keys-door's own
# loopback.
#
#   bash ops/keys-edge/lab/lab.sh all      a. image  b. release chain  c. keys-door #1 (compose.yml)
#                                          d. caddy + Caddyfile.keys  e. TLS and HTTP probes
#                                          f. a fresh edge from a peer (contract §7 A1)
#                                          g. tamper, rollback with the floor kept, a fork, and
#                                             a rotation to the bheart.signature/1 profile (seq 5)
#   bash ops/keys-edge/lab/lab.sh chain    b only (node, no docker): the chain, configs and mock
#                                          door files under KEYS_EDGE_LAB_DIR
#   bash ops/keys-edge/lab/lab.sh host ENVELOPE
#                                          e only, on the edge host before DNS moves (README,
#                                          cutover step 3): every probe of step e against this
#                                          host's Caddy at 127.0.0.1 (curl --resolve), trusting
#                                          only the root exported from that Caddy, expecting the
#                                          release ENVELOPE names. It needs docker and node, builds
#                                          the lab tools image, starts one probe container on the
#                                          host network and removes it; it never touches keys-door,
#                                          keys-net, Caddy or their volumes.
#
# all and chain never run on the edge host: they own the names keys-door and keys-net while they
# run, and all refuses to start when either exists.
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
PEER_FWD=http://127.0.0.1:8099

CADDY_IMAGE=caddy:2.11.4
ALPINE_IMAGE=alpine:3.22
DEBIAN_SUITE=bookworm
PROJECT=keys-edge-lab
IMAGE=keys-door:lab
BUILDER=keys-door-builder:lab
TOOLS=keys-lab-tools:local
KD1=keys-door
KD2=keys-lab-kd2
KD3=keys-lab-kd3
CADDY=keys-lab-caddy
MOCK=keys-lab-antmock
MOCK3=keys-lab-antmock3
FWD=keys-lab-peerfwd
PROBE=keys-lab-probe
HOST_PROBE=keys-edge-hostprobe
KD2_VOLUME=keys-lab-kd2-state
KD3_VOLUME=keys-lab-kd3-state

LAB=${KEYS_EDGE_LAB_DIR:-}
OWNED=0
RESULTS=()

# What the probes of step e (probe_edge) run against; set by step_e or host_mode.
PROBE_CTR=""   # the container every probe command runs in
CONNECT=""     # the address Caddy answers on from there
KD_DIRECT=""   # keys-door #1's own listener, no Caddy (the controls)
OUTDIR=""      # host dir mounted at /out in PROBE_CTR
EXP_ENV=""     # the envelope the edge must serve as current
EXP_RECORD=""  # its record.json bytes
EXP_SEQ=""     # its seq
EXP_PACK=""    # the pack bytes, when the lab made them (host mode checks the pack by digest only)
EXP_CHAIN=()   # "N:FILE": the envelope /.well-known/bnr-keychain/release/N must be (contract §7 A1)

say() { printf '\n== %s\n' "$*"; }
run() { printf '+ %s\n' "$*"; "$@"; }
die() { printf '\nLAB FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS %s\n' "$*"; RESULTS+=("PASS  $*"); }
labjs() { node "$HERE/lab.mjs" "$@"; }
# b64u_sha256 FILE: base64url (no padding) SHA-256 of FILE, the form of edge.toml bsigner_sha256
b64u_sha256() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("base64url"))' "$1"; }
BSIGNER_PIN=""
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
      for c in "$KD1" "$KD2" "$KD3" "$CADDY" "$MOCK" "$MOCK3" "$FWD"; do
        docker logs --tail 120 "$c" 2>&1 | sed "s/^/[$c] /" || true
      done
    fi
    if [[ -z ${KEYS_EDGE_LAB_KEEP:-} ]]; then
      docker rm -f "$PROBE" "$MOCK" "$MOCK3" "$FWD" "$CADDY" "$KD2" "$KD3" >/dev/null 2>&1 || true
      KEYS_DOOR_IMAGE=$IMAGE compose down -v >/dev/null 2>&1 || true
      docker volume rm "$KD2_VOLUME" "$KD3_VOLUME" >/dev/null 2>&1 || true
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

# wait_note CONTAINER NOTE SECONDS: health until its last_error is NOTE
wait_note() {
  local c=$1 want=$2 limit=$3 h="" i
  for (( i = 0; i < limit; i += 3 )); do
    h=$(health "$c")
    if [[ $(labjs get last_error <<<"$h" 2>/dev/null || true) == "$want" ]]; then printf '%s\n' "$h"; return 0; fi
    sleep 3
  done
  printf 'health of %s after %ss: %s\n' "$c" "$limit" "$h" >&2
  return 1
}

# start_mock DOOR NAME: the mock ANT door in DOOR's network namespace ($MOCK_DOOR to that door)
start_mock() {
  run docker run -d --name "$2" --network "container:$1" --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user 65534:65534 -v "$LAB/antmock:/srv:ro" \
    "$TOOLS" python3 -B -m http.server 8098 --bind 127.0.0.1 --directory /srv
}

# rail_up DOOR ADDRESS: the control that a refusal later is not a missing pack: the mock door
# answers ADDRESS on DOOR's own loopback
rail_up() {
  local code="" i
  for (( i = 0; i < 20; i++ )); do
    code=$(docker run --rm --network "container:$1" "$TOOLS" curl -sS --max-time 5 -o /dev/null -w '%{http_code}' \
      "$MOCK_DOOR/v1/data/public/$2" 2>/dev/null || true)
    if [[ $code == 200 ]]; then echo "GET $MOCK_DOOR/v1/data/public/$2 on $1's loopback -> 200"; return 0; fi
    sleep 1
  done
  die "the mock ANT door does not answer on $1's loopback (last status '$code')"
}

# run_door NAME VOLUME INBOX CONFIG DOCKER-NETWORK-ARGS...: a keys-door from the lab image with
# compose.yml's hardening and its own state volume
run_door() {
  local name=$1 vol=$2 inbox=$3 cfg=$4
  shift 4
  run docker volume create "$vol"
  run docker run -d --name "$name" "$@" --read-only --tmpfs /tmp:size=16m,mode=1777,noexec,nosuid,nodev \
    --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 128 --memory 256m \
    -v "$vol:/var/lib/keys-door/state" -v "$inbox:/var/lib/keys-door/inbox:ro" \
    -v "$cfg:/etc/keys-door/edge.toml:ro" "$IMAGE"
}

# ── a. the image ────────────────────────────────────────────────────────────
build_tools() {
  say "lab tools image ($ALPINE_IMAGE: openssl, curl, python3, socat)"
  local alpine_d ver
  alpine_d=$(digest_of "$ALPINE_IMAGE")
  echo "tools base: $ALPINE_IMAGE@$alpine_d"
  printf 'FROM %s@%s\nRUN apk add --no-cache bash ca-certificates curl openssl python3 socat\n' "$ALPINE_IMAGE" "$alpine_d" | run docker build -q -t "$TOOLS" -
  ver=$(docker run --rm "$TOOLS" openssl version)
  run docker run --rm "$TOOLS" sh -c 'openssl version; curl -V | head -n 1; python3 -V; socat -V | grep "socat version"; apk info -v 2>/dev/null | grep -E "^(openssl|curl|libcurl)-"'
  [[ $ver =~ ^OpenSSL\ ([0-9]+)\.([0-9]+) ]] || die "openssl version is '$ver'"
  (( BASH_REMATCH[1] > 3 || (BASH_REMATCH[1] == 3 && BASH_REMATCH[2] >= 5) )) || die "$ver is older than 3.5: it cannot offer X25519MLKEM768"
  pass "probe OpenSSL is $ver (>= 3.5)"
}

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
  # the bsigner pin: build the builder stage, hash the bsigner it made, then build the image with
  # that value; the final stage refuses to build unless its copy hashes to it
  run docker build --progress=plain -f "$EDGE/Dockerfile" --target builder \
    --build-arg RUST_VERSION="$RUST_VERSION" --build-arg DEBIAN_SUITE="$DEBIAN_SUITE" \
    --build-arg RUST_IMAGE_DIGEST="$rust_d" --build-arg RUNTIME_IMAGE_DIGEST="$run_d" \
    -t "$BUILDER" "$ROOT"
  docker run --rm --entrypoint /bin/cat "$BUILDER" /src/target/release/bsigner > "$LAB/bsigner.builder"
  BSIGNER_PIN=$(b64u_sha256 "$LAB/bsigner.builder")
  echo "bsigner pin (base64url SHA-256 of the builder's bsigner): $BSIGNER_PIN"
  run docker build --progress=plain -f "$EDGE/Dockerfile" \
    --build-arg RUST_VERSION="$RUST_VERSION" --build-arg DEBIAN_SUITE="$DEBIAN_SUITE" \
    --build-arg RUST_IMAGE_DIGEST="$rust_d" --build-arg RUNTIME_IMAGE_DIGEST="$run_d" \
    --build-arg KEYS_DOOR_COMMIT="$COMMIT" --build-arg BSIGNER_SHA256="$BSIGNER_PIN" -t "$IMAGE" "$ROOT"
  local label recorded shipped
  label=$(docker image inspect --format '{{index .Config.Labels "org.beehive-nature.bsigner.sha256"}}' "$IMAGE")
  recorded=$(docker run --rm --entrypoint /bin/cat "$IMAGE" /usr/local/share/keys-door/bsigner.sha256)
  docker run --rm --entrypoint /bin/cat "$IMAGE" /usr/local/bin/bsigner > "$LAB/bsigner.image"
  shipped=$(b64u_sha256 "$LAB/bsigner.image")
  printf 'bsigner pin: label %s; file %s; sha256 of /usr/local/bin/bsigner %s\n' "$label" "$recorded" "$shipped"
  [[ -n $shipped && $label == "$recorded" && $recorded == "$shipped" && $shipped == "$BSIGNER_PIN" ]] \
    || die "the bsigner pin disagrees: label '$label', file '$recorded', binary '$shipped', builder '$BSIGNER_PIN'"
  rm -f "$LAB/bsigner.builder" "$LAB/bsigner.image"
  pass "a. bsigner pinned: image label = /usr/local/share/keys-door/bsigner.sha256 = SHA-256 of /usr/local/bin/bsigner ($shipped)"
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

  # a config whose pins are well formed but whose bsigner_sha256 is not this image's bsigner
  labjs render-toml "$EDGE/edge.toml.example" "$LAB/wrong-pin.toml" "genesis_sha3=\"$(printf 'A%.0s' {1..43})\"" \
    "genesis_signers=[\"mldsa65:$(printf 'A%.0s' {1..43})\"]" "bsigner_sha256=\"$(printf 'A%.0s' {1..43})\""
  chmod a+r "$LAB/wrong-pin.toml"
  out=$(docker run --rm -v "$LAB/wrong-pin.toml:/etc/keys-door/edge.toml:ro" "$IMAGE" 2>&1) && rc=0 || rc=$?
  printf '+ keys-door serve with a wrong bsigner_sha256 -> exit %s\n%s\n' "$rc" "$out"
  [[ $rc == 2 && $out == *bsigner_pin_mismatch* ]] || die "a wrong bsigner pin was not refused at startup"
  pass "a. keys-door refuses to start when bsigner_sha256 is not its bsigner (bsigner_pin_mismatch)"

  build_tools
}

# ── b. the release chain ────────────────────────────────────────────────────
SEED=""
LINK_SHA3=""
# link DIR PREV SIGNERS [bheart]: prepare DIR after PREV, sign it with the throwaway key (the §3b
# key; with bheart, the throwaway bheart.signature/1 key whose vk goes to $LAB/bheart.vk), verify,
# envelope
link() {
  local dir=$1 prev=$2 signers=$3 profile=${4:-bpq} p ant vk=()
  printf '+ release.mjs prepare --out %s --prev %s --signers %s\n' "${dir#"$LAB"/}" "${prev#"$LAB"/}" "$signers"
  p=$(node "$RELEASE" prepare --out "$dir" --prev "$prev" --signers "$signers")
  printf '%s\n' "$p"
  if [[ $profile == bheart ]]; then
    node "$RELEASE" sign-test --profile bheart --seed "$SEED-bheart" --record "$dir/record.json" --out "$dir/record.json.relsig.json" \
      --vk-out "$LAB/bheart.vk" --i-understand-this-is-a-test-key
    vk=(--vk "$LAB/bheart.vk")
  else
    node "$RELEASE" sign-test --seed "$SEED" --record "$dir/record.json" --out "$dir/record.json.relsig.json" --i-understand-this-is-a-test-key
  fi
  run node "$RELEASE" verify --record "$dir/record.json" --sig "$dir/record.json.relsig.json" "${vk[@]}" --prev "$prev"
  ant=$(sha256sum "$dir/pack.bin" | cut -c1-64)
  run node "$RELEASE" envelope --record "$dir/record.json" --sig "$dir/record.json.relsig.json" "${vk[@]}" --hint-ant "$ant" --out "$dir/envelope.json"
  LINK_SHA3=$(labjs get sha3 <<<"$p")
}

step_b() {
  say "b. a test release chain (tools/keychain-release; throwaway keys made in this run)"
  local p1 g id2
  SEED="keys-edge-lab-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  ID=$(node "$RELEASE" sign-test --seed "$SEED" --i-understand-this-is-a-test-key | labjs get id)
  # a second throwaway id, named only in r3x's signers: it signs nothing
  id2=$(node "$RELEASE" sign-test --seed "$SEED-second" --i-understand-this-is-a-test-key | labjs get id)
  # a throwaway bheart.signature/1 key (the profile `bsigner sign` writes): seq 4 rotates to its
  # mldsa65: id and it signs seq 5
  HID=$(node "$RELEASE" sign-test --profile bheart --seed "$SEED-bheart" --i-understand-this-is-a-test-key | labjs get id)
  echo "throwaway signer: $ID; second id (named, never signing): $id2; bheart signer (seq 5): $HID"
  printf '+ release.mjs prepare --out r1 --signers <throwaway>\n'
  p1=$(node "$RELEASE" prepare --out "$LAB/r1" --signers "$ID")
  printf '%s\n' "$p1"
  GENESIS=$(labjs get sha3 <<<"$p1")
  node "$RELEASE" sign-test --seed "$SEED" --record "$LAB/r1/record.json" --out "$LAB/r1/record.json.relsig.json" --i-understand-this-is-a-test-key
  run node "$RELEASE" verify --record "$LAB/r1/record.json" --sig "$LAB/r1/record.json.relsig.json" --signers "$ID" --genesis-sha3 "$GENESIS"
  ANT1=$(sha256sum "$LAB/r1/pack.bin" | cut -c1-64)
  run node "$RELEASE" envelope --record "$LAB/r1/record.json" --sig "$LAB/r1/record.json.relsig.json" --hint-ant "$ANT1" --out "$LAB/r1/envelope.json"

  link "$LAB/r2" "$LAB/r1/record.json" "$ID"
  SEQ2_SHA3=$LINK_SHA3
  [[ $(labjs get seq "$LAB/r2/record.json") == 2 && $(labjs get prev "$LAB/r2/record.json") == "$GENESIS" ]] || die "r2 is not seq 2 after r1"
  # r3 and r3x: two valid seq-3 records after r2, both signed by the throwaway key r2 authorizes,
  # differing only in the signers they name (contract §4 rule 5: an equivocation). r4 follows r3,
  # so it resolves the fork to r3's branch.
  link "$LAB/r3" "$LAB/r2/record.json" "$ID"
  SEQ3_SHA3=$LINK_SHA3
  link "$LAB/r3x" "$LAB/r2/record.json" "$ID,$id2"
  SEQ3X_SHA3=$LINK_SHA3
  # r4 names only the bheart id as the next signer (a rotation between profiles); r5 is signed in
  # that profile
  link "$LAB/r4" "$LAB/r3/record.json" "$HID"
  SEQ4_SHA3=$LINK_SHA3
  link "$LAB/r5" "$LAB/r4/record.json" "$HID" bheart
  SEQ5_SHA3=$LINK_SHA3
  [[ $SEQ3_SHA3 != "$SEQ3X_SHA3" && $(labjs get seq "$LAB/r3x/record.json") == 3 && $(labjs get prev "$LAB/r3x/record.json") == "$SEQ2_SHA3" ]] \
    || die "r3x is not a second seq 3 after r2"
  [[ $(labjs get seq "$LAB/r5/record.json") == 5 && $(labjs get prev "$LAB/r5/record.json") == "$SEQ4_SHA3" ]] || die "r5 is not seq 5 after r4"
  echo "seq 1 (genesis) $GENESIS; seq 2 $SEQ2_SHA3; seq 3 $SEQ3_SHA3; seq 3 fork $SEQ3X_SHA3; seq 4 (after seq 3) $SEQ4_SHA3; seq 5 (bheart) $SEQ5_SHA3"
  pass "b. seq 1-4 and a second seq 3 prepared from this checkout and signed by one throwaway §3b key; seq 4 rotates to a throwaway bheart key, which signs seq 5; all enveloped (noble verify accepts each)"

  # The mock ANT door answers GET /v1/data/public/<address> as antd does. The address is a lab
  # label (the pack's sha256 in hex, the 64-hex shape keys-door takes); bytes count only by hash.
  # Every record here is one build of this checkout, so every pack is the same bytes and one
  # address serves them all.
  mkdir -p "$LAB/antmock/v1/data/public"
  for g in r1 r2 r3 r3x r4 r5; do
    labjs ant-body "$LAB/$g/pack.bin" "$LAB/antmock/v1/data/public/$(sha256sum "$LAB/$g/pack.bin" | cut -c1-64)"
  done
  ls -l "$LAB/antmock/v1/data/public"

  # keys-door #1: the example with only the lab's values changed, shown as a diff. keys-door #2
  # has no ANT door and an empty inbox: its only source is its peer, keys-door #1, reached by a
  # forwarder on its own loopback (step f says why).
  mkdir -p "$LAB/kd1/inbox" "$LAB/kd2/inbox" "$LAB/tamper" "$LAB/share" "$LAB/out"
  g="genesis_sha3=\"$GENESIS\""
  # the bsigner pin step a measured; chain mode builds no image, so its configs stay unfilled there
  local pin="bsigner_sha256=\"${BSIGNER_PIN:-UNFILLED-chain-mode-builds-no-image}\""
  labjs render-toml "$EDGE/edge.toml.example" "$LAB/kd1/edge.toml" "$g" "genesis_signers=[\"$ID\"]" \
    'poll_secs=5' "ant_doors=[\"$MOCK_DOOR\"]" "$pin"
  labjs render-toml "$EDGE/edge.toml.example" "$LAB/kd2/edge.toml" "$g" "genesis_signers=[\"$ID\"]" \
    'poll_secs=5' 'ant_doors=[]' "peers=[\"$PEER_FWD\"]" "$pin"
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
  local nets ip ports
  nets=$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$KD1")
  ip=$(docker inspect --format '{{(index .NetworkSettings.Networks "keys-net").IPAddress}}' "$KD1")
  ports=$(docker port "$KD1" || true)
  echo "networks: $nets; keys-net address: $ip; published ports: '${ports}'"
  [[ $nets == "keys-net " && $ip == "$KD1_IP" && -z $ports ]] || die "keys-door must be on keys-net only, at $KD1_IP, with no published port"
  pass "c. keys-door on keys-net only at $KD1_IP, no published port"

  # compose.yml's hardening, as docker holds it and as the running process has it
  docker inspect "$KD1" > "$LAB/out/kd1-inspect.json"
  run docker inspect --format 'read_only={{.HostConfig.ReadonlyRootfs}} cap_drop={{.HostConfig.CapDrop}} security_opt={{.HostConfig.SecurityOpt}} pids={{.HostConfig.PidsLimit}} mem={{.HostConfig.Memory}} tmpfs={{json .HostConfig.Tmpfs}} user={{.Config.User}}' "$KD1"
  labjs check-hardening "$LAB/out/kd1-inspect.json" || die "keys-door #1 does not carry compose.yml's hardening"
  local status mounts rootfs tmp out
  status=$(docker exec "$KD1" grep -E '^(CapPrm|CapEff|CapBnd|NoNewPrivs):' /proc/1/status | tr -s '\t ' ' ')
  printf '+ docker exec keys-door grep Cap*/NoNewPrivs /proc/1/status\n%s\n' "$status"
  [[ $status == $'CapPrm: 0000000000000000\nCapEff: 0000000000000000\nCapBnd: 0000000000000000\nNoNewPrivs: 1' ]] \
    || die "keys-door's process holds capabilities or may gain privileges"
  mounts=$(docker exec "$KD1" cat /proc/mounts)
  rootfs=$(awk '$2 == "/" { print $4 }' <<<"$mounts")
  tmp=$(awk '$2 == "/tmp" { print $3 " " $4 }' <<<"$mounts")
  echo "/ options: $rootfs; /tmp: $tmp"
  [[ ,$rootfs, == *,ro,* ]] || die "the root filesystem is not mounted read-only"
  [[ $tmp == "tmpfs "* && ,${tmp#tmpfs }, == *,nosuid,* && ,${tmp#tmpfs }, == *,nodev,* && ,${tmp#tmpfs }, == *,noexec,* ]] \
    || die "/tmp is not a tmpfs with nosuid,nodev,noexec"
  out=$(docker exec -u 0 "$KD1" touch /lab-rootfs-probe 2>&1) && die "uid 0 wrote /lab-rootfs-probe: the rootfs is writable"
  printf '+ docker exec -u 0 keys-door touch /lab-rootfs-probe -> %s\n' "$out"
  [[ $out == *"Read-only file system"* ]] || die "the write was refused, but not by a read-only rootfs: '$out'"
  pass "c. compose.yml's hardening holds: rootfs read-only even to uid 0, no capabilities, no_new_privs, /tmp tmpfs noexec,nosuid,nodev, pids 128, memory 256 MiB, inbox and config read-only"

  # the mock door shares keys-door's network namespace, so it is http://127.0.0.1:8098 to keys-door
  start_mock "$KD1" "$MOCK"
  local h
  h=$(wait_seq "$KD1" 2 150) || die "keys-door #1 did not reach seq 2"
  printf 'health: %s\n' "$h"
  [[ $(labjs get record_sha3 <<<"$h") == "$SEQ2_SHA3" && $(labjs get state <<<"$h") == serving ]] || die "keys-door #1 serves another record"
  labjs equivocation-is null <<<"$h" || die "keys-door #1 reports an equivocation"
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
    # lab-only site: relay.skaists.dev stands in for the Hostinger site whose SNI a misdirected
    # request presents
    printf 'relay.skaists.dev {\n  tls internal\n  respond "lab stand-in for relay.skaists.dev" 200\n}\n'
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
  # the relay stand-in is on the same internal CA here; on the host it is the ACME site (host_mode)
  cp "$LAB/share/root.crt" "$LAB/share/relay.crt"
  chmod 0644 "$LAB/share/root.crt" "$LAB/share/relay.crt"
  run docker run --rm -v "$LAB/share:/lab:ro" "$TOOLS" openssl x509 -in /lab/root.crt -noout -subject -fingerprint -sha256
  pass "d. caddy $v running the block at $CADDY_IP on keys-net, its internal root exported"
}

# ── e. probes ───────────────────────────────────────────────────────────────
SC_OUT=""
SC_RC=0
sclient() {
  local label=$1
  shift
  SC_OUT=$(docker exec "$PROBE_CTR" timeout 20 openssl s_client -connect "$CONNECT:443" -servername "$HOST" \
    -verify_hostname "$HOST" -CAfile /lab/root.crt -no-CApath -no-CAstore "$@" 2>&1 </dev/null) && SC_RC=0 || SC_RC=$?
  printf -- '--- openssl s_client %s (%s)\n%s\n--- exit %s\n' "$*" "$label" "$SC_OUT" "$SC_RC"
}
# probe.mjs classify(): "New, X, Cipher is <not (NONE)>" is a session; "SSL alert number N" a refusal
accepted() { grep -Eq 'New, [^ ]+, Cipher is [^(]' <<<"$SC_OUT"; }
refused() { ! accepted && grep -Eq 'SSL alert number [0-9]+' <<<"$SC_OUT"; }

FETCH=""
# fetch NAME URL [curl args...]: through Caddy over TLS 1.3 with only X25519MLKEM768 offered; body
# and headers into OUTDIR, the -w line printed. keys.skaists.dev is trusted on the exported Caddy
# root only; relay.skaists.dev on /lab/relay.crt.
fetch() {
  local name=$1 url=$2 ca=/lab/root.crt
  shift 2
  [[ $url == https://relay.skaists.dev/* ]] && ca=/lab/relay.crt
  mkdir -p "$(dirname "$OUTDIR/$name")"
  FETCH=$(docker exec "$PROBE_CTR" curl -sS --max-time 20 --tlsv1.3 --curves X25519MLKEM768 --cacert "$ca" \
    --resolve "$HOST:443:$CONNECT" --resolve "relay.skaists.dev:443:$CONNECT" \
    -o "/out/$name.body" -D "/out/$name.headers" -w '%{http_code} %{http_version} %{size_download}' "$@" "$url") \
    || die "curl $url failed"
  printf '%s %s -> %s\n' "$name" "$url" "$FETCH"
}
# fetch_direct NAME URL [curl args...]: keys-door #1's own listener, plain http, no Caddy
fetch_direct() {
  local name=$1 url=$2
  shift 2
  mkdir -p "$(dirname "$OUTDIR/$name")"
  FETCH=$(docker exec "$PROBE_CTR" curl -sS --max-time 20 \
    -o "/out/$name.body" -D "/out/$name.headers" -w '%{http_code} %{http_version} %{size_download}' "$@" "$url") \
    || die "curl $url failed"
  printf '%s %s -> %s\n' "$name" "$url" "$FETCH"
}

# probe_edge: every TLS and HTTP probe of the edge (step e, and lab.sh host)
probe_edge() {
  run docker exec "$PROBE_CTR" openssl version
  run docker exec "$PROBE_CTR" sh -c 'curl -V | head -n 1'

  local i hs
  for (( i = 0; i < 30; i += 2 )); do
    hs=$(docker exec "$PROBE_CTR" timeout 10 openssl s_client -connect "$CONNECT:443" -servername "$HOST" -tls1_3 \
      -groups X25519MLKEM768 </dev/null 2>/dev/null || true)
    grep -Eq 'New, [^ ]+, Cipher is [^(]' <<<"$hs" && break
    sleep 2
  done

  sclient control -tls1_3 -groups X25519MLKEM768
  accepted || die "the control handshake (TLS 1.3, X25519MLKEM768) did not complete: a broken probe is not evidence"
  grep -q 'Negotiated TLS1.3 group: X25519MLKEM768' <<<"$SC_OUT" || die "the control did not negotiate X25519MLKEM768"
  grep -Eq '^ *Protocol *: TLSv1\.3' <<<"$SC_OUT" || die "the control is not TLS 1.3"
  grep -q 'Verify return code: 0 (ok)' <<<"$SC_OUT" || die "the certificate did not verify for $HOST against the exported Caddy root"
  pass "e. control: TLS 1.3, group X25519MLKEM768, certificate verifies for $HOST"

  local text
  text=$(sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' <<<"$SC_OUT" | docker exec -i "$PROBE_CTR" openssl x509 -noout -text)
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

  # every file the expected record names, and /, over TLS with only X25519MLKEM768 offered
  local path
  mapfile -t FILES < <(record_paths "$EXP_RECORD")
  for path in "${FILES[@]}"; do
    fetch "files/$path" "https://$HOST/$path"
    [[ ${FETCH%% *} == 200 ]] || die "/$path answered ${FETCH%% *}"
    printf -- '--- headers /%s\n' "$path"
    cat "$OUTDIR/files/$path.headers"
    labjs check-headers "$OUTDIR/files/$path.headers" || die "/$path headers"
  done
  labjs check-files "$EXP_RECORD" "$OUTDIR/files" || die "a served file does not match the seq-$EXP_SEQ record"
  pass "e. all ${#FILES[@]} files the seq-$EXP_SEQ record names: HTTP 200, size + SHA-256 + SHA3-256 match the decoded record digests"
  fetch root "https://$HOST/"
  [[ ${FETCH%% *} == 200 ]] || die "/ answered ${FETCH%% *}"
  labjs same-bytes "$OUTDIR/files/index.html.body" "$OUTDIR/root.body" || die "/ is not index.html"

  # the control for the header step: keys-door's own answer, no Caddy in between
  fetch_direct direct-index "$KD_DIRECT/index.html"
  cat "$OUTDIR/direct-index.headers"
  labjs check-direct-headers "$OUTDIR/direct-index.headers" || die "keys-door's own headers"
  pass "e. through Caddy: no Server, no Alt-Svc, HSTS and Referrer-Policy, which keys-door alone does not send (Caddyfile.keys header step); nosniff is sent by both"

  fetch release "https://$HOST/.well-known/bnr-keychain/release"
  [[ ${FETCH%% *} == 200 ]] || die "/.well-known/bnr-keychain/release answered ${FETCH%% *}"
  labjs check-envelope "$EXP_ENV" "$OUTDIR/release.body" "$EXP_RECORD" || die "the served release is not the seq-$EXP_SEQ envelope"
  labjs check-headers "$OUTDIR/release.headers" || die "release headers"
  local entry n
  for entry in "${EXP_CHAIN[@]}"; do
    n=${entry%%:*}
    fetch "release-$n" "https://$HOST/.well-known/bnr-keychain/release/$n"
    [[ ${FETCH%% *} == 200 ]] || die "/.well-known/bnr-keychain/release/$n answered ${FETCH%% *} (contract §7 A1)"
    labjs same-bytes "${entry#*:}" "$OUTDIR/release-$n.body" || die "release/$n is not the seq-$n envelope"
  done
  n=$((EXP_SEQ + 1))
  fetch "release-$n" "https://$HOST/.well-known/bnr-keychain/release/$n"
  [[ ${FETCH%% *} == 404 ]] || die "/.well-known/bnr-keychain/release/$n (past the served seq) answered ${FETCH%% *}, want 404"
  fetch pack "https://$HOST/.well-known/bnr-keychain/pack"
  [[ ${FETCH%% *} == 200 ]] || die "/.well-known/bnr-keychain/pack answered ${FETCH%% *}"
  labjs check-pack "$EXP_RECORD" "$OUTDIR/pack.body" || die "the served pack is not the seq-$EXP_SEQ pack"
  if [[ -n $EXP_PACK ]]; then labjs same-bytes "$EXP_PACK" "$OUTDIR/pack.body" || die "the served pack is not $EXP_PACK"; fi
  pass "e. /.well-known/bnr-keychain/release is the seq-$EXP_SEQ envelope byte for byte; release/N is every envelope 1..$EXP_SEQ and 404 past it (A1); /pack hashes to the record's pack"

  # SNI mismatch: a handshake for relay.skaists.dev carrying Host keys.skaists.dev
  fetch relay "https://relay.skaists.dev/"
  [[ ${FETCH%% *} =~ ^[1-5][0-9][0-9]$ && ${FETCH%% *} != 421 ]] \
    || die "relay.skaists.dev itself answered ${FETCH%% *}: the SNI probe below would prove nothing"
  local v
  for v in --http1.1 --http2; do
    fetch "misdirected$v" "https://relay.skaists.dev/" "$v" -H "Host: $HOST"
    cat "$OUTDIR/misdirected$v.headers"
    [[ ${FETCH%% *} == 421 ]] || die "SNI relay.skaists.dev + Host $HOST ($v) answered ${FETCH%% *}, want 421"
  done
  pass "e. SNI relay.skaists.dev with Host $HOST: 421 over HTTP/1.1 and HTTP/2"

  # keys-door refuses a POST too, so a bare 405 cannot show Caddy's matcher works: Caddy's
  # respond sends no Allow and no body, keys-door's sends both (the control)
  fetch_direct direct-post "$KD_DIRECT/" -X POST --data-binary ''
  cat "$OUTDIR/direct-post.headers"
  labjs check-405 "$OUTDIR/direct-post.headers" "$OUTDIR/direct-post.body" keys-door || die "keys-door's own 405"
  fetch post "https://$HOST/" -X POST --data-binary ''
  cat "$OUTDIR/post.headers"
  labjs check-405 "$OUTDIR/post.headers" "$OUTDIR/post.body" caddy || die "POST / was not refused by Caddyfile.keys"
  pass "e. POST /: 405 from Caddy (no Allow, no body), never reaching keys-door (whose 405 carries Allow: GET, HEAD)"
  echo "note: 421 and 405 are answered before the header step (the route order in Caddyfile.keys); their headers are printed above"
}

step_e() {
  say "e. probes from $ALPINE_IMAGE on keys-net ($PROBE_IP)"
  run docker run -d --name "$PROBE" --network keys-net --ip "$PROBE_IP" --user "$(id -u):$(id -g)" \
    -v "$LAB/share:/lab:ro" -v "$LAB/out:/out" "$TOOLS" sleep 3600
  PROBE_CTR=$PROBE CONNECT=$CADDY_IP KD_DIRECT=http://$KD1_IP:8096 OUTDIR=$LAB/out
  EXP_ENV=$LAB/r2/envelope.json EXP_RECORD=$LAB/r2/record.json EXP_SEQ=2 EXP_PACK=$LAB/r2/pack.bin
  EXP_CHAIN=("1:$LAB/r1/envelope.json" "2:$LAB/r2/envelope.json")
  probe_edge
}

# ── f. a fresh edge from a peer ─────────────────────────────────────────────
step_f() {
  say "f. a fresh edge: keys-door #2, empty state, empty inbox, no ANT door, peers = [keys-door #1] only (contract §7 A1)"
  # keys-door trusts only the webpki roots compiled into it, so no lab CA can stand behind an https
  # peer. A configured peer may be plain http to loopback (as an ANT door may): keys-door #2's peer
  # is a socat forwarder on its own loopback ($PEER_FWD) to keys-door #1's listener on keys-net.
  # The peer leg's TLS is therefore not exercised here; the chain endpoint through Caddyfile.keys
  # was probed in step e.
  [[ -z $(ls -A "$LAB/kd2/inbox") ]] || die "keys-door #2's inbox is not empty"
  run_door "$KD2" "$KD2_VOLUME" "$LAB/kd2/inbox" "$LAB/kd2/edge.toml" --network keys-net --ip "$KD2_IP"
  run docker run -d --name "$FWD" --network "container:$KD2" --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --user 65534:65534 "$TOOLS" \
    socat "TCP-LISTEN:${PEER_FWD##*:},bind=127.0.0.1,fork,reuseaddr" "TCP:$KD1_IP:8096"
  local h
  h=$(wait_seq "$KD2" 2 120) || { docker logs --tail 60 "$KD2"; die "keys-door #2 did not reach seq 2 from its peer"; }
  printf 'health: %s\n' "$h"
  [[ $(labjs get record_sha3 <<<"$h") == "$SEQ2_SHA3" ]] || die "keys-door #2 serves another record"
  local path
  for path in "${FILES[@]}"; do
    docker exec "$PROBE" curl -sS --max-time 10 --create-dirs -o "/out/kd2/$path" "http://$KD2_IP:8096/$path" || die "keys-door #2 /$path"
    labjs same-bytes "$LAB/out/files/$path.body" "$LAB/out/kd2/$path" || die "keys-door #2 serves other bytes at /$path"
  done
  for n in 1 2; do
    docker exec "$PROBE" curl -sS --max-time 10 -o "/out/kd2/release-$n" "http://$KD2_IP:8096/.well-known/bnr-keychain/release/$n" || die "keys-door #2 release/$n"
    labjs same-bytes "$LAB/r$n/envelope.json" "$LAB/out/kd2/release-$n" || die "keys-door #2 release/$n is not the seq-$n envelope"
  done
  run docker logs --tail 20 "$KD2"
  pass "f. keys-door #2, with only its peer as a source, resumed from genesis to seq 2 and serves identical bytes and envelopes 1-2"
  run docker rm -f "$FWD" "$KD2"
}

# ── g. tamper, rollback, fork ───────────────────────────────────────────────
# offline LABEL FILE WANT: keys-door verify on keys-door #1 must refuse inbox FILE with a reason
# starting WANT
offline() {
  local label=$1 file=$2 want=$3 out rc
  out=$(docker exec "$KD1" keys-door verify --config /etc/keys-door/edge.toml --envelope "/var/lib/keys-door/inbox/$file" 2>&1) && rc=0 || rc=$?
  printf '+ keys-door verify %s -> exit %s\n%s\n' "$file" "$rc" "$out"
  [[ $rc == 1 && $(labjs get verdict <<<"$out") == refuse && $(labjs get reason <<<"$out") == "$want"* ]] \
    || die "$label: keys-door verify did not refuse it with '$want'"
}

HEALTH=""
# still_at LABEL SEQ SHA3 ENVELOPE: two polls later keys-door #1 still serves exactly that release
still_at() {
  local label=$1 seq=$2 sha=$3 env=$4
  sleep 12 # two polls at poll_secs = 5
  HEALTH=$(health "$KD1")
  printf 'health: %s\n' "$HEALTH"
  [[ $(labjs get state <<<"$HEALTH") == serving && $(labjs get seq <<<"$HEALTH") == "$seq" && $(labjs get record_sha3 <<<"$HEALTH") == "$sha" ]] \
    || die "$label: keys-door #1 is not serving seq $seq ($sha)"
  fetch "release-after-$label" "https://$HOST/.well-known/bnr-keychain/release"
  labjs same-bytes "$env" "$OUTDIR/release-after-$label.body" || die "$label: the served release is not $env"
}

# unverified_at LABEL NOTE: keys-door #1 serves nothing (503 through Caddy) and health says NOTE
unverified_at() {
  local label=$1 note=$2
  HEALTH=$(health "$KD1")
  printf 'health: %s\n' "$HEALTH"
  [[ $(labjs get state <<<"$HEALTH") == unverified && $(labjs get seq <<<"$HEALTH") == null && $(labjs get last_error <<<"$HEALTH") == "$note" ]] \
    || die "$label: keys-door #1 is not unverified with '$note'"
  fetch "$label-index" "https://$HOST/index.html"
  [[ ${FETCH%% *} == 503 ]] || die "$label: /index.html answered ${FETCH%% *}, want 503"
  fetch "$label-release" "https://$HOST/.well-known/bnr-keychain/release"
  [[ ${FETCH%% *} == 404 ]] || die "$label: /.well-known/bnr-keychain/release answered ${FETCH%% *}, want 404"
}

drop() { cp "$1" "$LAB/kd1/inbox/$2"; chmod 0644 "$LAB/kd1/inbox/$2"; }
kd1_stop() {
  docker rm -f "$MOCK" >/dev/null 2>&1 || true
  run docker stop -t 15 "$KD1"
}
kd1_start() {
  run docker start "$KD1"
  start_mock "$KD1" "$MOCK"
}
# kd1_state SCRIPT: sh SCRIPT in keys-door #1's state dir, as its user, while it is stopped
kd1_state() {
  printf '+ [keys-door #1 state, stopped] %s\n' "$1" >&2
  docker run --rm --volumes-from "$KD1" --network none --user 10096:10096 \
    --workdir /var/lib/keys-door/state --entrypoint /bin/sh "$IMAGE" -c "$1"
}

step_g() {
  say "g. tamper on keys-door #1"
  # the serve state holds the chain now; the inbox is emptied so each drop below stands alone
  rm -f "$LAB/kd1/inbox/"*.json
  still_at emptied 2 "$SEQ2_SHA3" "$LAB/r2/envelope.json"
  drop "$LAB/tamper/forged-seq2.json" forged-seq2.json
  drop "$LAB/tamper/mismatched-seq2.json" mismatched-seq2.json
  still_at tamper 2 "$SEQ2_SHA3" "$LAB/r2/envelope.json"
  # a record either verifier wrongly accepted would be a second valid seq 2: a fork on health
  labjs equivocation-is null <<<"$HEALTH" || die "tamper: an invalid seq-2 record made a fork"
  offline forged forged-seq2.json "bad_signature"
  offline mismatched mismatched-seq2.json "file_mismatch"
  run docker logs --since 40s "$KD1"
  pass "g. tampered seq-2 envelopes: forged refused by both verifiers (bad_signature), mismatched refused (file_mismatch); still seq 2, no fork"

  say "g. rule 4 live: the serve state lost, the floor kept, only seq 1 offered with its pack on the rail"
  rm -f "$LAB/kd1/inbox/"*.json
  drop "$LAB/r1/envelope.json" 001-seq1.json
  kd1_stop
  local floor note="seq 1 is below the floor 2 (rule 4)" t0
  floor=$(kd1_state 'cat floor')
  echo "floor file: '$floor'"
  [[ $floor == 2 ]] || die "keys-door #1's floor is '$floor', want 2"
  kd1_state 'ls -ln . && rm serve.json && ls -ln .'
  kd1_start
  rail_up "$KD1" "$ANT1"
  wait_note "$KD1" "$note" 60 >/dev/null || die "keys-door #1 did not refuse seq 1 at its floor"
  sleep 12 # two more polls with the rail up
  unverified_at rollback "$note"
  pass "g. serve state lost, floor 2 kept, seq 1 and its pack offered: 503, health '$note'"

  say "g. control: a fresh keys-door, same config, same inbox, same rail, no floor"
  run_door "$KD3" "$KD3_VOLUME" "$LAB/kd1/inbox" "$LAB/kd1/edge.toml" --network none
  start_mock "$KD3" "$MOCK3"
  HEALTH=$(wait_seq "$KD3" 1 120) || die "the control did not serve seq 1: keys-door #1's 503 above is not evidence of its floor"
  printf 'health: %s\n' "$HEALTH"
  [[ $(labjs get record_sha3 <<<"$HEALTH") == "$GENESIS" ]] || die "the control serves another seq 1"
  run docker rm -f "$MOCK3" "$KD3"
  run docker volume rm "$KD3_VOLUME"
  pass "g. control: with no floor the same seq 1 is served ($GENESIS); the floor alone kept keys-door #1 at 503"

  say "g. rule 7 live: a corrupt serve state, the floor kept, only seq 1 offered"
  kd1_stop
  kd1_state 'echo lab-corrupt-serve-state > serve.json && ls -ln .'
  t0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  kd1_start
  rail_up "$KD1" "$ANT1"
  wait_note "$KD1" "$note" 60 >/dev/null || die "keys-door #1 did not refuse seq 1 at its floor after a corrupt state"
  sleep 12
  unverified_at corrupt "$note"
  docker logs --since "$t0" "$KD1" 2>&1 | grep -F 'serve state discarded (rule 7)' || die "keys-door #1 did not report discarding the corrupt serve state"
  pass "g. corrupt serve state discarded (rule 7), floor 2 kept: 503 with seq 1 offered"
  drop "$LAB/r2/envelope.json" 002-seq2.json
  HEALTH=$(wait_seq "$KD1" 2 90) || die "keys-door #1 did not serve seq 2 (at the floor) again"
  printf 'health: %s\n' "$HEALTH"
  [[ $(labjs get record_sha3 <<<"$HEALTH") == "$SEQ2_SHA3" ]] || die "keys-door #1 serves another seq 2"
  pass "g. seq 2 offered again: served (503 lasts only until a release at or above the floor verifies)"

  say "g. rule 5 live: two valid seq-3 records after the served seq 2"
  drop "$LAB/r3/envelope.json" 003-seq3.json
  drop "$LAB/r3x/envelope.json" 003-seq3x.json
  still_at fork 2 "$SEQ2_SHA3" "$LAB/r2/envelope.json"
  labjs equivocation-is 3 "$SEQ3_SHA3" "$SEQ3X_SHA3" <<<"$HEALTH" || die "the fork at seq 3 is not reported"
  offline fork 003-seq3.json "not chained: equivocation at seq 3"
  pass "g. a fork at seq 3: keys-door #1 advances on neither, health names both, keys-door verify refuses r3"
  rm -f "$LAB/kd1/inbox/003-"*.json
  still_at fork-quiet 2 "$SEQ2_SHA3" "$LAB/r2/envelope.json"
  labjs equivocation-is 3 "$SEQ3_SHA3" "$SEQ3X_SHA3" <<<"$HEALTH" || die "the fork was forgotten once its sources went quiet"
  pass "g. the fork's envelopes gone from the inbox: still seq 2, still reported (kept evidence)"
  drop "$LAB/r4/envelope.json" 004-seq4.json
  HEALTH=$(wait_seq "$KD1" 4 60) || die "a seq 4 after r3 did not resolve the fork"
  printf 'health: %s\n' "$HEALTH"
  [[ $(labjs get record_sha3 <<<"$HEALTH") == "$SEQ4_SHA3" ]] || die "keys-door #1 serves another seq 4"
  labjs equivocation-is null <<<"$HEALTH" || die "the resolved fork is still reported"
  fetch release-resolved "https://$HOST/.well-known/bnr-keychain/release"
  labjs same-bytes "$LAB/r4/envelope.json" "$OUTDIR/release-resolved.body" || die "the served release is not r4"
  fetch release-3-resolved "https://$HOST/.well-known/bnr-keychain/release/3"
  labjs same-bytes "$LAB/r3/envelope.json" "$OUTDIR/release-3-resolved.body" || die "release/3 is not r3, the branch r4 selects"
  drop "$LAB/r3x/envelope.json" 003-seq3x.json
  offline loser 003-seq3x.json "not chained"
  offline rollback 001-seq1.json "seq 1 is below the floor 4 (rule 4)"
  pass "g. r4 (prev = r3) resolved the fork: seq 4 served, release/3 is r3, r3x refused as not chained, seq 1 refused below the floor 4"

  say "g. rotation live: seq 5 signed in the bheart.signature/1 profile by the id seq 4 names"
  drop "$LAB/r5/envelope.json" 005-seq5.json
  HEALTH=$(wait_seq "$KD1" 5 60) || { docker logs --tail 60 "$KD1"; die "keys-door #1 did not walk to the bheart-signed seq 5"; }
  printf 'health: %s\n' "$HEALTH"
  [[ $(labjs get record_sha3 <<<"$HEALTH") == "$SEQ5_SHA3" ]] || die "keys-door #1 serves another seq 5"
  labjs equivocation-is null <<<"$HEALTH" || die "seq 5 made a fork"
  fetch release-5 "https://$HOST/.well-known/bnr-keychain/release"
  labjs same-bytes "$LAB/r5/envelope.json" "$OUTDIR/release-5.body" || die "the served release is not r5"
  fetch release-5-n "https://$HOST/.well-known/bnr-keychain/release/5"
  labjs same-bytes "$LAB/r5/envelope.json" "$OUTDIR/release-5-n.body" || die "release/5 is not r5"
  fetch release-4-n "https://$HOST/.well-known/bnr-keychain/release/4"
  labjs same-bytes "$LAB/r4/envelope.json" "$OUTDIR/release-4-n.body" || die "release/4 is not r4"
  pass "g. seq 5, a bheart.signature/1 by the mldsa65: id seq 4 names, accepted by both verifiers (fips204 + bsigner verify): served; release/5 is r5, release/4 is r4"
}

summary() {
  say "summary"
  printf '%s\n' "${RESULTS[@]}"
}

# ── host: step e on the edge host ───────────────────────────────────────────
host_cleanup() {
  local rc=$?
  docker rm -f "$HOST_PROBE" >/dev/null 2>&1 || true
  exit "$rc"
}

host_mode() {
  local env=${1:-} caddy=${KEYS_EDGE_CADDY:-buzz-prod-caddy-1} e
  [[ -n $env && -f $env ]] || die "usage: lab.sh host ENVELOPE (the ruled envelope keys-door serves, from /opt/keys-edge/inbox)"
  command -v docker >/dev/null || die "host mode needs docker"
  command -v node >/dev/null || die "host mode needs node on PATH: lab.mjs reads the envelope and checks every byte"
  if docker container inspect "$HOST_PROBE" >/dev/null 2>&1; then die "a container named $HOST_PROBE exists: remove it first"; fi
  setup_dir
  trap host_cleanup EXIT
  OUTDIR=$LAB/out
  mkdir -p "$OUTDIR" "$LAB/share"
  say "host: step e against this host's Caddy at 127.0.0.1, before DNS names it"
  run docker version --format 'docker client {{.Client.Version}}, server {{.Server.Version}}'
  run node --version
  run docker inspect --format '{{.Name}}: {{.State.Status}}, image {{.Config.Image}}' "$KD1" "$caddy"
  build_tools
  run docker cp "$caddy:/data/caddy/pki/authorities/local/root.crt" "$LAB/share/root.crt"
  docker run --rm "$TOOLS" cat /etc/ssl/certs/ca-certificates.crt > "$LAB/share/relay.crt"
  run docker run --rm -v "$LAB/share:/lab:ro" "$TOOLS" openssl x509 -in /lab/root.crt -noout -subject -fingerprint -sha256
  e=$(labjs envelope-record "$env" "$LAB/expected-record.json")
  echo "expected release: $e (from $env)"
  chmod -R a+rX "$LAB"
  PROBE_CTR=$HOST_PROBE CONNECT=127.0.0.1 KD_DIRECT=http://$KD1_IP:8096
  EXP_ENV=$env EXP_RECORD=$LAB/expected-record.json EXP_SEQ=$(labjs get seq <<<"$e") EXP_PACK=""
  EXP_CHAIN=("$EXP_SEQ:$env")
  run docker run -d --name "$HOST_PROBE" --network host --user "$(id -u):$(id -g)" \
    -v "$LAB/share:/lab:ro" -v "$OUTDIR:/out" "$TOOLS" sleep 900
  probe_edge
  summary
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
  host)
    host_mode "${2:-}"
    ;;
  *)
    echo "usage: lab.sh all|chain|host ENVELOPE" >&2
    exit 2
    ;;
esac
