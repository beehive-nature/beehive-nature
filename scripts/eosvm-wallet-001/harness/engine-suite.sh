#!/bin/bash
# engine-suite.sh — the EOSVM-WALLET-001 engine battery under interp + jit.
# WHERE it runs: WSL, after build.sh + component/build.sh.
# Outputs one JSON line per measurement; tee'd to receipts/engine-suite.log.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
COMP=$HERE/../component/zkr_component.wasm
MICRO=$HERE/micro.wasm
EV=$HERE/evb
RECD=$HERE/../receipts
mkdir -p "$RECD"

# fixtures: the FRESH count-lane proof (prove pipeline re-run 2026-10-12:
# zkrprep -> witness -> plonk prove -> snarkjs plonk verify OK -> flatten)
python3 - << 'PY'
import json, pathlib
d = json.load(open('/home/travi/plonkport/calldata_dead.json'))
out = pathlib.Path('/tmp/eosvm001')
out.mkdir(exist_ok=True)
(out/'proof.hex').write_text(d['proof_hex'])
(out/'pubs.hex').write_text(d['pubs_hex'])
# mutation battery — single-byte flips at spread offsets + pubs flips
for name, src, off in [
    ('proof_b0',  'proof_hex', 0), ('proof_b384','proof_hex', 384),
    ('proof_b767','proof_hex', 767), ('proof_b100','proof_hex', 100),
    ('proof_b543','proof_hex', 543),
    ('pubs_b0',   'pubs_hex', 0),   ('pubs_b95',  'pubs_hex', 95),
    ('pubs_b32',  'pubs_hex', 32),
]:
    b = bytearray(bytes.fromhex(d[src]))
    b[off] ^= 0x01
    (out/f'{name}.hex').write_text(b.hex())
print('fixtures ready')
PY

echo "── malformed battery"
for BE in interp jit; do $EV $MICRO $BE malformed; done

echo "── parse/instantiation (cold + repeat ctor)"
for BE in interp jit; do
  $EV $COMP $BE parse --parse 12
  $EV $MICRO $BE parse --parse 12
done

echo "── micro workloads (engine-only decomposition)"
for BE in interp jit; do
  $EV $MICRO $BE warm --entry loop    --warm 31 --args 20000000
  $EV $MICRO $BE warm --entry kecloop --warm 31 --args 2000,2048,1024,8192
  $EV $MICRO $BE warm --entry memtouch --warm 31 --args 8192,524288
  $EV $MICRO $BE warm --entry dbloop  --warm 31 --args 500,4096,8200
done

echo "── memory growth to cap"
for BE in interp jit; do $EV $MICRO $BE mem --pages 4096; done

echo "── component verify: the REAL count proof (oracle pairing)"
for BE in interp jit; do
  $EV $COMP $BE verify --proof /tmp/eosvm001/proof.hex --pubs /tmp/eosvm001/pubs.hex --expect 0 --warm 1 --pairing oracle
done

echo "── component mutation battery (every one must reject)"
for m in proof_b0 proof_b100 proof_b384 proof_b543 proof_b767 pubs_b0 pubs_b32 pubs_b95; do
  case "$m" in
    proof_*) PF=/tmp/eosvm001/$m.hex; UF=/tmp/eosvm001/pubs.hex ;;
    pubs_*)  PF=/tmp/eosvm001/proof.hex; UF=/tmp/eosvm001/$m.hex ;;
  esac
  for BE in interp jit; do
    LINE=$($EV $COMP $BE verify --proof "$PF" --pubs "$UF" --expect 1 --warm 1 --pairing oracle 2>&1 || true)
    echo "mutation $m [$BE]: $(echo "$LINE" | tail -1 | head -c 260)"
  done
done
