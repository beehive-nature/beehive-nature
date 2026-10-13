#!/bin/bash
# env.sh — EOSVM-WALLET-001 chain environment. Source this in WSL.
export EOSVM=$HOME/eosvm001
export SPRING_ROOT=$HOME/eosvm001/springroot
export PATH=$HOME/.local/bin:$SPRING_ROOT/usr/bin:$SPRING_ROOT/usr/opt/cdt/4.1.1/bin:$PATH
export LD_LIBRARY_PATH=$SPRING_ROOT/usr/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
export U=http://127.0.0.1:8888
export EOSVM_HOME=$HOME/eosvm001
export LANE=/mnt/c/Users/travi/wt-eosvm001/scripts/eosvm-wallet-001
export REC=$LANE/receipts
mkdir -p "$REC"
nodeos --version 2>/dev/null | head -1 || echo "nodeos NOT on PATH"
