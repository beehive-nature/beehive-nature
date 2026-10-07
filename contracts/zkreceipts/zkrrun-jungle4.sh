#!/bin/bash
# zkrrun-jungle4.sh — the count-v1 acceptance pass on VAULTA PUBLIC
# TESTNET (jungle4, Spring) — the §tungsten-3 COST beat. The spladder
# sponsor recipe: EVERY transaction is two actions — core.vaulta
# deposit(bnrapolltest, tiny) first, the real action second — signed by
# both; only_bill_first_authorizer makes the sponsor's rented CPU pay
# (self-stake on this chain buys ~28 µs: measured, not guessed). The
# deposit amount varies per tx (duplicate-tx law). Sponsor key read
# from zkbench's m3jungle.sh (TESTNET-ONLY — never printed, never
# committed). Billed µs comes from the push output itself.
set -e
U=https://jungle4.greymass.com
REPO=${REPO:-/mnt/c/Users/travi/beehive-nature}/contracts/zkreceipts
W=~/plonkport
A=${A:-zkrtst333333}
ZKB=/mnt/c/Users/travi/zkbench
CLEOS="/usr/bin/cleos -u $U"
mkdir -p /tmp/nd
N=0

echo "[0] wallet + sponsor key (TESTNET-ONLY, from zkbench — not printed)"
$CLEOS wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
SPONSOR_PRIV=$(grep -oE '5K[1-9A-HJ-NP-Za-km-z]{49}' $ZKB/m3jungle.sh | head -1)
[ -n "$SPONSOR_PRIV" ] || { echo "FATAL: sponsor key not found in m3jungle.sh"; exit 1; }
$CLEOS wallet import --name bnrzk --private-key "$SPONSOR_PRIV" >/dev/null 2>&1 || true
if [ ! -f /tmp/nd/zkrtst.key ]; then
  /usr/bin/cleos create key --to-console | awk '/Private key:/{print $3} /Public key:/{print $3}' > /tmp/nd/zkrtst.key
fi
PRIV=$(awk 'NR==1{print $1}' /tmp/nd/zkrtst.key); PUB=$(awk 'NR==2{print $1}' /tmp/nd/zkrtst.key)
$CLEOS wallet import --name bnrzk --private-key "$PRIV" >/dev/null 2>&1 || true

# the sponsored push: takes a BASE unsigned tx (from -s -d) or builds
# one from contract/action/args, prepends the deposit, pushes with both
# signatures, reports status + trx id + billed µs (or the refusal).
spon(){ # spon <label> [contract action args-json]  (or SPON_BASE=file)
  local LABEL=$1 CONTRACT=$2 ACTION=$3 ARGS=$4
  N=$((N+1))
  local AMT; AMT=$(printf '0.%04d A' $((N % 50 + 1)))   # valid 4-decimal amounts that vary per tx (duplicate-tx law; N≥10 must not grow decimals)
  local DH; DH=$($CLEOS convert pack_action_data core.vaulta deposit "{\"owner\":\"bnrapolltest\",\"amount\":\"$AMT\"}")
  if [ -n "$CONTRACT" ]; then
    local H; H=$($CLEOS convert pack_action_data "$CONTRACT" "$ACTION" "$ARGS")
    node -e "
const t={actions:[
 {account:'core.vaulta',name:'deposit',authorization:[{actor:'bnrapolltest',permission:'active'}],data:process.argv[1]},
 {account:process.argv[2],name:process.argv[3],authorization:[{actor:'$A',permission:'active'}],data:process.argv[4]}],
 expiration:new Date(Date.now()+3600e3).toISOString().slice(0,19),ref_block_num:null,ref_block_prefix:null,
 max_net_usage_words:0,max_cpu_usage_ms:0,delay_sec:0,context_free_actions:[],signatures:[],transaction_extensions:[]};
require('fs').writeFileSync('/tmp/sp-trx.json',JSON.stringify(t));
" "$DH" "$CONTRACT" "$ACTION" "$H"
  else
    node -e "
const t=JSON.parse(require('fs').readFileSync(process.env.SPON_BASE,'utf8'));
t.actions=[{account:'core.vaulta',name:'deposit',authorization:[{actor:'bnrapolltest',permission:'active'}],data:process.argv[1]}].concat(t.actions);
t.expiration=new Date(Date.now()+3600e3).toISOString().slice(0,19);
require('fs').writeFileSync('/tmp/sp-trx.json',JSON.stringify(t));
" "$DH"
  fi
  $CLEOS push transaction /tmp/sp-trx.json -p bnrapolltest -p $A >/tmp/sp-out.json 2>&1 || true
  node -e "
let j;try{j=JSON.parse(require('fs').readFileSync('/tmp/sp-out.json','utf8'))}catch(e){console.log('$LABEL PUSH-ERROR');process.exit(0)}
const p=j.processed||{};
if(p.receipt&&p.receipt.status==='executed') console.log('$LABEL OK trx='+(j.transaction_id||'').slice(0,16)+' billed='+(p.receipt.cpu_usage_us||'?')+'us');
else console.log('$LABEL REFUSED: '+(((p.except||{}).message)||'no-execution').slice(0,90));
"
}

if ! $CLEOS get account $A >/dev/null 2>&1; then
  echo "[1] account $A: $($CLEOS system newaccount bnrapolltest $A "$PUB" --stake-cpu "10.0000 EOS" --stake-net "2.0000 EOS" --buy-ram-kbytes 128 -p bnrapolltest 2>&1 | grep -m1 -oE 'executed transaction: [a-f0-9]+|assertion failure with message: [^"]*' | head -1)"
  sleep 2
  # the pot17-era vk makes the contract ≈498 KB of RAM (measured: needs
  # 510,526 bytes); the newaccount drip does not cover it — sponsor buys 1 MB
  echo "[1b] ram +1MB: $($CLEOS push action eosio buyrambytes "[\"bnrapolltest\",\"$A\",1048576]" -p bnrapolltest 2>&1 | grep -m1 -oE 'executed transaction: [a-f0-9]+|assertion failure with message: [^"]*' | head -1)"
  sleep 2
else
  echo "[1] account $A: already exists (reusing — RAM already bought)"
fi

echo "[2] deploy (sponsored setcode/setabi)"
skel(){ # skel <out-file> <set code|set abi args...> — retry: greymass throttles bursts
  local OUT=$1; shift
  for t in 1 2 3 4; do
    $CLEOS "$@" -s -d --expiration 3600 2>&1 | sed -n '/^{/,$p' > $OUT   # cleos prints the tx JSON on STDERR — the 2>&1 is load-bearing (spladder law)
    [ -s $OUT ] && return 0
    sleep 3
  done
  echo "FATAL: skeleton capture failed after retries: $*"; exit 1
}
skel /tmp/zkr-code.json set code $A $W/zkrcount.wasm -p $A
SPON_BASE=/tmp/zkr-code.json spon "  code"
sleep 2
skel /tmp/zkr-abi.json set abi $A $W/zkrcount.abi -p $A
SPON_BASE=/tmp/zkr-abi.json spon "  abi"
sleep 2
CH=$($CLEOS get code $A 2>&1 | head -1 | grep -oE '[a-f0-9]{64}')
[ -n "$CH" ] || { echo "FATAL: code hash is zero — actions would be codeless no-ops (found live: a no-op pass masquerading as green)"; exit 1; }
echo "  code hash: $CH"

ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('$W/expected.json')).root.replace(/^0x/,'')")
ROOTFLIP=$(node -pe "const r='$ROOT'.split(''); const c=r[63]; r[63]= c==='f'?'0':(parseInt(c,16)+1).toString(16); r.join('')")
P_DEAD=$(node -pe "require('$W/calldata_dead.json').proof_hex")
P_LIVE=$(node -pe "require('$W/calldata_live.json').proof_hex")
P_FORG=$(node -pe "require('$W/calldata_forged.json').proof_hex")
anchor_args(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],root:process.argv[2],kind:+process.argv[3],count:+process.argv[4]}))" "$1" "$2" "$3" "$4"; }
verify_args(){ node -e "console.log(JSON.stringify({seq:+process.argv[1],proof:process.argv[2]}))" "$1" "$2"; }

spon "[3] anchor1 dead" $A anchor "$(anchor_args 1 "$ROOT" 0 20)"
spon "[4] VERIFY dead-baseline REAL" $A verify "$(verify_args 1 "$P_DEAD")"
spon "[5] anchor2 live" $A anchor "$(anchor_args 2 "$ROOT" 1 20)"
spon "[6] VERIFY live-baseline REAL" $A verify "$(verify_args 2 "$P_LIVE")"
echo "[7] refusals (each must say REFUSED, never OK):"
spon "  forged (eval_zw+1) @3" $A anchor "$(anchor_args 3 "$ROOT" 0 20)"
spon "  forged proof @3" $A verify "$(verify_args 3 "$P_FORG")"
spon "  mutated-count anchor4" $A anchor "$(anchor_args 4 "$ROOT" 0 21)"
spon "  real proof vs count=21 @4" $A verify "$(verify_args 4 "$P_DEAD")"
spon "  mutated-root anchor5" $A anchor "$(anchor_args 5 "$ROOTFLIP" 0 20)"
spon "  real proof vs mutated root @5" $A verify "$(verify_args 5 "$P_DEAD")"
spon "  mutated-kind anchor6" $A anchor "$(anchor_args 6 "$ROOT" 1 20)"
spon "  real dead proof vs kind=1 @6" $A verify "$(verify_args 6 "$P_DEAD")"
spon "  re-verify @1" $A verify "$(verify_args 1 "$P_DEAD")"
spon "  bad kind @anchor" $A anchor "$(anchor_args 7 "$ROOT" 2 20)"
echo "[8] anchors table:"
$CLEOS get table $A $A anchors 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
if(!s.trim()){console.log('  (table read failed)');return;} const rows=JSON.parse(s).rows;
for(const r of rows){
  const hex=typeof r.root==='string' ? r.root.replace(/^0x/,'') : Buffer.from(r.root).toString('hex');
  console.log('  seq',r.seq,'kind',r.kind,'count',r.count,'alg',r.alg,'root',hex.slice(0,16)+'…','verified_at',r.verified_at);
}});"
echo "[9] code hash: $($CLEOS get code $A 2>&1 | head -1)"
