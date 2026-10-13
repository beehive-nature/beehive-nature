#!/bin/bash
# deploy.sh — setup on the genesis-booted node: wallet, accounts, contracts.
# Features (PREACTIVATE + CRYPTO_PRIMITIVES + BLS_PRIMITIVES2 + GET_BLOCK_NUM)
# come from the GENESIS (boot.sh), not from a bios activate dance: fresh
# Spring v1.2.2 dev chains activate nothing by default, and even the
# v1.2.2-stock bios is refused with "env.bls_pairing unresolveable" until
# BLS_PRIMITIVES2 is active (receipted in the dispatch).
# WHERE it runs: WSL, after boot.sh.
set -uo pipefail
source "$(dirname "$0")/env.sh"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUT=$REC/deploy-$(cat $EOSVM_HOME/current-node 2>/dev/null | tr ' -' '__').log
{
echo "== deploy start $TS (genesis-preactivated features)"
PRIV=5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 TESTNET-ONLY PUBLIC-CONSTANT (the documented Spring dev producer key)
PUB=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV
rm -rf ~/eosio-wallet/default.wallet ~/eosio-wallet/default.wallet.lock 2>/dev/null
cleos wallet create --to-console --name default > /tmp/wallet.txt 2>&1 || true
# fresh keosd wallets start UNLOCKED (no unlock step — a wrong-password
# unlock locks the wallet; that was an rc=51 receipt earlier)
cleos wallet import --private-key $PRIV --name default >/dev/null 2>&1 || true

Z=$EOSVM_HOME/zkbench
for acct in bench verifymin note probe zkrcount; do
  cleos -u $U create account eosio $acct $PUB >/dev/null 2>&1 && echo "account $acct OK" || echo "account $acct EXISTS/FAIL"
done
for c in bench:bench verifymin:verifymin note:note; do
  n=${c%%:*}
  cleos -u $U set contract $n $Z $n.wasm $n.abi -p $n@active >/dev/null 2>&1 && echo "contract $n OK" || echo "contract $n FAIL"
done
# zkrcount: the CLOSED zkr lane's built artifact (in-tree source compiles
# cleanly with CDT but its old LTO linker spins on this box — receipted)
cleos -u $U set contract zkrcount /home/travi/plonkport zkrcount.wasm zkrcount.abi -p zkrcount@active >/dev/null 2>&1 && echo "contract zkrcount OK" || echo "contract zkrcount FAIL"
echo "== deploy done"
} 2>&1 | tee "$OUT"
