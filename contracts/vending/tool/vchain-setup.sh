#!/bin/bash
# vending lane — local Spring rehearsal chain bootstrap (runs INSIDE WSL)
# usage: bash /mnt/c/Users/travi/beehive-nature/contracts/vending/tool/vchain-setup.sh
# honest label: LOCAL REHEARSAL chain — estate-controlled; the Vaulta mainnet /
# Jungle4 landing is the founder-gated gesture (see SPEC-VENDING-2 §deploy-doors).
set -x
C=~/vchain

# 1. keosd (wallet daemon) — exactly one instance, HTTP on 8900
pkill -9 keosd 2>/dev/null; sleep 1
nohup keosd --unlock-timeout 999999 --http-server-address 127.0.0.1:8900 > $C/keosd.log 2>&1 &
sleep 3
WURL="--wallet-url http://127.0.0.1:8900"

# 2. fresh wallet
rm -f ~/eosio-wallet/vchain.wallet
cleos $WURL wallet create -n vchain --to-console 2>/dev/null | grep -oE "PW[1-9A-HJ-NP-Za-km-z]+" | head -1 > $C/wallet.pw
PW=$(cat $C/wallet.pw)
cleos $WURL wallet unlock -n vchain --password "$PW" >/dev/null

# 3. import keys (producer = eosio dev key; vending = contract; member = the minting member)
for k in producer vending member; do
  cleos $WURL wallet import -n vchain --private-key "$(cat $C/$k.key)" >/dev/null
done

# 4. nodeos (fresh dev chain, Spring 1.2.2 — Vaulta's consensus family)
pkill nodeos 2>/dev/null; sleep 1
rm -rf $C/data; mkdir -p $C/data
nohup nodeos -e -p eosio \
  --plugin eosio::chain_api_plugin --plugin eosio::net_api_plugin \
  --data-dir $C/data --config-dir $C/config \
  --signature-provider "$(cat $C/producer.pub)=KEY:$(cat $C/producer.key)" \
  --http-server-address 0.0.0.0:8888 --http-validate-host=false \
  --access-control-allow-origin=* --contracts-console --verbose-http-errors \
  > $C/nodeos.log 2>&1 &
sleep 8
curl -s -m 5 http://127.0.0.1:8888/v1/chain/get_info | head -c 80; echo

# 5. accounts: the contract, the member, the tithe destination
U="-u http://127.0.0.1:8888"
cleos $U create account eosio vending "$(cat $C/vending.pub)" "$(cat $C/vending.pub)" >/dev/null
cleos $U create account eosio bnrapolltest "$(cat $C/member.pub)" "$(cat $C/member.pub)" >/dev/null
cleos $U create account eosio kingbeelovis "$(cat $C/member.pub)" "$(cat $C/member.pub)" >/dev/null
for a in vending bnrapolltest kingbeelovis; do
  echo "account $a: $(cleos $U get account $a 2>/dev/null | grep -c created) ok"
done

# 6. deploy the vending contract
cd /mnt/c/Users/travi/beehive-nature/contracts/vending/src
cleos $U setcode vending -w ../tool/vending.wasm >/dev/null 2>&1 || cleos $U setcode vending -w vending.wasm >/dev/null
cleos $U setabi vending vending.abi >/dev/null
cleos $U get code vending | head -2
echo SETUP-DONE
