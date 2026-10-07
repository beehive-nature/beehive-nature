#!/bin/bash
# zkrrun.sh — the on-chain acceptance pass for zkrcount (SPEC-ZK-RECEIPT-
# AGGREGATES-1 v1, the m4run discipline): boot rehearsal chain → bootstrap
# ladder → deploy → two REAL proofs verify (dead-baseline, live-baseline) →
# every refusal: forged proof · mutated count · mutated root · mutated
# kind · re-verify (one proof per anchor) · bad kind at anchor time.
# Run from WSL after prove_count.sh. REPO= overrides the checkout seat.
set -e
U=http://127.0.0.1:8888
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature}/contracts/zkreceipts
W=~/plonkport
A=${A:-zkreceipts11}
ZKB=/mnt/c/Users/travi/zkbench
CLEOS="/usr/bin/cleos -u $U"

mkdir -p /tmp/nd/data /tmp/nd/config

# ── [0] boot the rehearsal chain if dead (Spring dev chain; state is /tmp —
#        every WSL restart is a fresh genesis, so the ladder reruns)
BOOTED=0
if ! curl -sS -m 2 $U/v1/chain/get_info >/dev/null 2>&1; then
  echo "[0] boot nodeos (Spring v1.2.2 rehearsal chain)"
  # TESTNET-ONLY: eosio documented dev key (Spring dev WIF)
  DEVKEY=5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3   # TESTNET-ONLY: eosio documented dev key
  nohup /usr/bin/nodeos -e -p eosio --plugin eosio::chain_api_plugin \
    --plugin eosio::producer_plugin --plugin eosio::producer_api_plugin \
    --plugin eosio::http_plugin --plugin eosio::trace_api_plugin --trace-no-abis \
    --access-control-allow-origin='*' --http-validate-host=false \
    --http-server-address=127.0.0.1:8888 \
    --signature-provider=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV=KEY:$DEVKEY \
    --data-dir /tmp/nd/data --config-dir /tmp/nd/config >/tmp/nd/nodeos.log 2>&1 &
  for i in $(seq 1 30); do curl -sS -m 2 $U/v1/chain/get_info >/dev/null 2>&1 && break; sleep 1; done
  BOOTED=1
fi
curl -sS -m 3 $U/v1/chain/get_info | head -c 120; echo

# ── [0b] wallet (always) + the activation ladder (fresh boots only)
# the wallet FILE lives in ~/eosio-wallet (survives WSL restarts) but its
# password lived in /tmp (does not) — a wallet without its password is
# unrecoverable and only ever held the public dev key + a fresh bench key:
# wipe and recreate (found live, 2026-10-06 — every later push unsigned)
PWFILE=/tmp/nd/bnrzk.pw
if [ -f /home/travi/eosio-wallet/bnrzk.wallet ] && ! $CLEOS wallet unlock --name bnrzk --password "$(cat $PWFILE 2>/dev/null)" >/dev/null 2>&1; then
  rm -f /home/travi/eosio-wallet/bnrzk.wallet
fi
if [ ! -f /home/travi/eosio-wallet/bnrzk.wallet ]; then
  PW=$(/usr/bin/cleos wallet create --name bnrzk --to-console | grep -o 'PW[0-9A-Za-z]*' | head -1)
  echo "$PW" > $PWFILE; chmod 600 $PWFILE
fi
$CLEOS wallet unlock --name bnrzk --password "$(cat $PWFILE)" >/dev/null 2>&1 || true
$CLEOS wallet import --name bnrzk --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 >/dev/null 2>&1 || true   # TESTNET-ONLY: eosio documented dev key
if [ ! -f /tmp/nd/bench.key ]; then
  /usr/bin/cleos create key --to-console | awk '/Private key:/{print $3} /Public key:/{print $3}' > /tmp/nd/bench.key
fi
BENCH_PRIV=$(awk 'NR==1{print $1}' /tmp/nd/bench.key); BENCH_PUB=$(awk 'NR==2{print $1}' /tmp/nd/bench.key)
$CLEOS wallet import --name bnrzk --private-key "$BENCH_PRIV" >/dev/null 2>&1 || true

# ── the activation ladder — run on EVERY invocation (idempotent: bios
#    re-set costs one tx; an already-active feature asserts, tolerated)
echo "[0b] activation ladder"
curl -sS -m 5 -X POST $U/v1/producer/schedule_protocol_feature_activations -d '{"protocol_features_to_activate": ["0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd"]}' ; echo   # PUBLIC-CONSTANT: PREACTIVATE_FEATURE digest (Spring shipped genesis, zkbench ladder)
sleep 3
[ -f $ZKB/minibios.wasm ] || { echo "FATAL: $ZKB/minibios.wasm absent (zkbench)"; exit 1; }
echo "  minibios: $($CLEOS set contract eosio $ZKB minibios.wasm minibios.abi 2>&1 | grep -cE "executed") tx"
sleep 1
echo "  crypto_primitives: $($CLEOS push action eosio activate '["5185eb6a3b51600a6dc2494ea240cb6bdcce473bfb5a7aa3816b307f71e464d2"]' -p eosio 2>&1 | grep -m1 -oE 'executed transaction|assertion failure with message: [^"]*|has already been activated')"   # PUBLIC-CONSTANT: T-of the CRYPTO_PRIMITIVES digest (the alt_bn128 host functions)
sleep 1

echo "[0c] account $A: $($CLEOS create account eosio $A "$BENCH_PUB" 2>&1 | grep -oE 'executed transaction|already exists' | head -1)"

# ── [1] compile + deploy
echo "[1] compile (cdt-cpp 4.1.1)"
(cd $REPO && /usr/bin/cdt-cpp -O3 -I. -o $W/zkrcount.wasm -abigen zkrcount.cpp)
echo "[2] deploy: code $($CLEOS set code $A $W/zkrcount.wasm 2>&1 | grep -c 'executed transaction')  abi $($CLEOS set abi $A $W/zkrcount.abi 2>&1 | grep -c 'executed transaction')"
sleep 1

ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")
ROOTFLIP=$(node -pe "const r='$ROOT'.split(''); const c=r[63]; r[63]= c==='f'?'0':(parseInt(c,16)+1).toString(16); r.join('')")
P_DEAD=$(node -pe "require('$W/calldata_dead.json').proof_hex")
P_LIVE=$(node -pe "require('$W/calldata_live.json').proof_hex")
P_FORG=$(node -pe "require('$W/calldata_forged.json').proof_hex")
say(){ local act=$1; shift; $CLEOS push action $A $act "$1" -p $A 2>&1 | grep -m1 -oE 'executed transaction: [a-f0-9]+|assertion failure with message: [^"]*' | head -1; }
bill(){ case "$1" in "executed transaction:"*) if [ -f $ZKB/find2.sh ]; then bash $ZKB/find2.sh "${1:22:16}" 40 2>/dev/null | head -1; else echo "  (billing probe skipped: find2.sh absent)"; fi ;; *) echo "  (no billing: not an executed tx)" ;; esac; }

echo "[3] anchor 1 (root, kind=0 dead, count=20): $(say anchor "[1,\"$ROOT\",0,20]")"
echo "[4] REAL PROOF — dead-baseline count:"
R=$(say verify "[1,\"$P_DEAD\"]"); echo "  $R"; bill "$R"
echo "[5] anchor 2 (root, kind=1 live, count=20): $(say anchor "[2,\"$ROOT\",1,20]")"
echo "[6] REAL PROOF #2 — live-baseline count:"
R=$(say verify "[2,\"$P_LIVE\"]"); echo "  $R"; bill "$R"
echo "[7] refusals (each must be an assertion failure, never executed):"
echo "  forged proof (eval_zw+1) on fresh anchor 3: anchor $(say anchor "[3,\"$ROOT\",0,20]") → $(say verify "[3,\"$P_FORG\"]")"
echo "  mutated COUNT  (anchor 4 says 21):          anchor $(say anchor "[4,\"$ROOT\",0,21]") → $(say verify "[4,\"$P_DEAD\"]")"
echo "  mutated ROOT   (anchor 5, last byte):       anchor $(say anchor "[5,\"$ROOTFLIP\",0,20]") → $(say verify "[5,\"$P_DEAD\"]")"
echo "  mutated KIND   (anchor 6 says live):        anchor $(say anchor "[6,\"$ROOT\",1,20]") → $(say verify "[6,\"$P_DEAD\"]")"
echo "  re-verify anchor 1 (one proof per anchor):  $(say verify "[1,\"$P_DEAD\"]")"
echo "  bad kind at anchor time (kind=2):           $(say anchor "[7,\"$ROOT\",2,20]")"
echo "[8] anchors table:"
$CLEOS get table $A $A anchors 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
if(!s.trim()){console.log('  (table read failed)');return;} const rows=JSON.parse(s).rows;
for(const r of rows){
  const hex=typeof r.root==='string' ? r.root.replace(/^0x/,'') : Buffer.from(r.root).toString('hex');
  console.log('  seq',r.seq,'kind',r.kind,'count',r.count,'alg',r.alg,'root',hex.slice(0,16)+'…','verified_at',r.verified_at);
}});"
echo "[9] code hash: $($CLEOS get code $A 2>&1 | head -1)"
