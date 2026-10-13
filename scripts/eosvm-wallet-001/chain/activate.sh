#!/bin/bash
# activate.sh — bootstrap feature activation on a FRESH Spring v1.2.2 dev
# chain via the bootfree.wasm privileged wrapper (see bootfree.c).
# Order: PREACTIVATE_FEATURE first, then the rest; each activates next block.
set -uo pipefail
source "$(dirname "$0")/env.sh"
OUT=$REC/activate.log
{
U2=$U
cleos -u $U2 set code eosio -p eosio@active "$LANE/chain/bootfree.wasm" 2>&1 | tail -1
cat > /tmp/pf_abi.json << 'EOF'
{"version":"eosio::abi/1.1","types":[],"structs":[{"name":"pfake","base":"","fields":[{"name":"digest","type":"bytes"}]}],"actions":[{"name":"pfake","type":"pfake","ricardian_contract":""}],"tables":[],"variants":[],"abi_extensions":[]}
EOF
cleos -u $U2 set abi eosio -p eosio@active /tmp/pf_abi.json 2>&1 | tail -1

for feat in \
  PREACTIVATE_FEATURE:64fe7df32e9b86be2b296b3f81dfd527f84e82b98e363bc97e40bc7a83733310 PUBLIC-CONSTANT \
  CRYPTO_PRIMITIVES:68d6405cb8df3de95bd834ebb408196578500a9f818ff62ccc68f60b932f7d82 PUBLIC-CONSTANT \
  BLS_PRIMITIVES2:c0cce5bcd8ea19a28d9e12eafda65ebe6d0e0177e280d4f20c7ad66dcd9e011b PUBLIC-CONSTANT \
  GET_BLOCK_NUM:e5d7992006e628a38c5e6c28dd55ff5e57ea682079bf41fef9b3cced0f46b491 PUBLIC-CONSTANT ; do
  n=${feat%%:*}; d=${feat##*:}
  sleep 2
  ARGS=$(python3 -c "d=bytes.fromhex('$d');print('[' + ','.join(str(b) for b in d) + ']')")
  R=$(cleos -u $U2 push action eosio pfake "$ARGS" -p eosio@active --json 2>&1 \
      | grep -oE '"status":"[a-z_]+"' | head -1)
  echo "pfake $n -> ${R:-FAILED}"
done
sleep 3
echo "── verification: deploy bench.wasm (needs CRYPTO_PRIMITIVES intrinsics)"
cleos -u $U2 create account eosio bench EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV >/dev/null 2>&1
cleos -u $U2 set contract bench $EOSVM_HOME/zkbench bench.wasm bench.abi -p bench@active 2>&1 | grep -oE "executed|unresolveable" | head -1
} 2>&1 | tee "$OUT"
