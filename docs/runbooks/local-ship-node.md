# Runbook: local single-node Antelope chain with SHIP (WSL2)

Goal: a real `state_history_plugin` WebSocket on `ws://127.0.0.1:8080` so
`chain-eos` ingests real blocks — no testnet dependency, tear down and
rebuild at will. This is Option A from the STATUS §6 prereq-check entry.

## 0. Prereq (owner, one-time)

Elevated terminal → `wsl --install` → **reboot** → complete Ubuntu user
setup on first launch. Everything below runs inside that Ubuntu shell
unless marked WINDOWS.

## 1. Install Antelope Spring (nodeos)

```bash
# Check https://github.com/AntelopeIO/spring/releases for the latest .deb
# matching the Ubuntu version (`lsb_release -rs`), then e.g.:
wget https://github.com/AntelopeIO/spring/releases/download/v1.2.2/antelope-spring_1.2.2_amd64.deb
sudo apt update && sudo apt install -y ./antelope-spring_*_amd64.deb
nodeos --version   # verify
```

## 2. Run a single-producer dev chain with SHIP

```bash
mkdir -p ~/ship-node && cd ~/ship-node
nodeos \
  --data-dir ./data --config-dir ./config \
  --producer-name eosio --enable-stale-production \
  --plugin eosio::producer_plugin \
  --plugin eosio::producer_api_plugin \
  --plugin eosio::chain_api_plugin \
  --plugin eosio::http_plugin \
  --http-server-address 127.0.0.1:8888 \
  --plugin eosio::state_history_plugin \
  --state-history-endpoint 127.0.0.1:8080 \
  --trace-history --chain-state-history \
  --access-control-allow-origin='*' \
  >> nodeos.log 2>&1 &
tail -f nodeos.log   # expect "Produced block ..." lines every 500ms
```

First run may need `--delete-all-blocks` omitted; to reset the chain later:
stop nodeos, `rm -rf ./data`, start again.

Sanity check (WSL or WINDOWS — WSL2 forwards localhost to Windows):

```bash
curl -s http://127.0.0.1:8888/v1/chain/get_info   # head_block_num climbing
```

## 3. Point chain-eos at it (WINDOWS)

```powershell
$env:SHIP_WS_URL = "ws://127.0.0.1:8080"
cargo run -p chain-eos
# expect: "received SHIP ABI", "streaming from head block N", then
# "Block Number: N, Action Count: 0" every ~500ms (empty dev chain)
```

Delete `chain-eos.watermark` to restart from head instead of resuming.

**Smart App Control caveat:** if Windows blocks the freshly built exe
(os error 4551), run the client inside WSL instead:
`curl https://sh.rustup.rs -sSf | sh` → `cargo run -p chain-eos` from the
repo under `/mnt/c/Users/travi/beehive-nature` (or a WSL-side clone —
faster builds off the 9p mount).

## 4. Real action data (unlocks the ABI decoder on live bytes)

The empty dev chain produces empty blocks. To see extraction + ABI
decoding fire on real data, deploy any contract and push actions — e.g.
the stock `eosio.token`:

```bash
# contracts from the reference-contracts release, then:
cleos set contract eosio.token ./eosio.token
cleos push action eosio.token create '["eosio", "1000000.0000 TEST"]' -p eosio.token
cleos push action eosio.token issue '["eosio", "100.0000 TEST", "memo"]' -p eosio
```

chain-eos will print `eosio.token::create`, `eosio.token::issue` in its
action lines; feeding those through `chain_eos::abi` with the token ABI
(`cleos get abi eosio.token`) is the first real-data decode.

## 4b. Drive the escrow engine from the live chain (item 4 proof)

The dev chain can stand in for the future Zano watcher: a codeless
account named `zano` with the transfer ABI set produces real on-chain
actions the normalizer maps to `OrderFunded`.

```bash
cleos create account eosio zano <DEV_PUBKEY> <DEV_PUBKEY>
cleos set abi zano /root/zano-abi.json     # ABI in escrow-engine's example
SHIP_WS_URL=ws://127.0.0.1:8080 cargo run -p escrow-engine --example live_pipeline &
cleos push action zano transfer \
  '["order-live","did:plc:buyer","did:plc:seller",5000000,"fusd-asset-id",10000000,"msig-addr-1","2026-07-03T12:00:00"]' \
  -p zano@active
# expect: ESCROW order-live: Ok(Funded)  +  "LIVE PROOF" line, exit 0
```

First proven 2026-07-03: tx `8f8395be…` in block 2832 →
`ESCROW order-live: Ok(Funded)`.

## Verification checklist (all four = milestone done)

- [x] nodeos producing blocks — DONE 2026-07-03 (Spring v1.2.2, WSL Ubuntu 26.04)
- [x] `get_info` answers over localhost — DONE (client runs in WSL beside the node;
      Windows-side cargo is SAC-blocked, so the WSL fallback below is the live path)
- [x] chain-eos prints climbing block numbers from the real socket — DONE
      (real 35,704-byte SHIP ABI frame, head 586, consecutive blocks at
      production rate, zero decode errors)
- [x] a pushed action appears in chain-eos output by name — DONE:
      `cleos create account eosio bnaturetest1 …` →
      `Block Number: 682, Action Count: 1 / actions: eosio::newaccount`
