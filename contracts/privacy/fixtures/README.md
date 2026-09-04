# contracts/privacy/fixtures — the re-executable oracle run (z2.1 F3)

The M7 working set (vk + one valid proof + one forged proof + the oracle
inputs) so ANY seat can re-run the 25/25 scalar gate without the WSL lab.
All values are PUBLIC rehearsal constants — the hex-run law is satisfied
by same-line markers (`PUBLIC-CONSTANT` / `TESTNET-ONLY`); the three
snarkjs JSON files therefore ship as `*.json.txt` with a trailing
same-line comment each — strip with the one sed below to get clean JSON.

- `vk.json.txt` — the payment.circom verifying key (pot14 one-honest-seat
  ceremony, rehearsal-labeled; nPublic 5, power 14).
- `proof.json.txt` / `public.json.txt` — one VALID payment proof and its
  publics (root, nullifier, commitmentOut, fee, feeAsset).
- `proof.hex` / `pubs.hex` — the same pair flattened to the verifier wire
  format (24×32B BE words + 5 publics).
- `forged-proof.hex` — the same proof with eval_zw tampered +1 — the
  pairing must reject it (the receipt's FORGED row).
- `oraclescalars.txt` — the expected scalar values (β…u, L1–L5, PI, r0,
  d2, d3, e), one `KEY hex` per line.

## Re-run the gates (any seat, any box with g++)

```sh
cd contracts/privacy
g++ -O2 -Wall -o /tmp/test_field256 test_field256.cpp
python3 gen_field_vectors.py | /tmp/test_field256          # 3,217/3,217
g++ -O2 -DPLONK_NATIVE_TEST -I. -o /tmp/test_plonk test_plonk_native.cpp
/tmp/test_plonk fixtures/proof.hex fixtures/pubs.hex fixtures/oraclescalars.txt   # 26/26
# regenerate the oracle independently (needs circomlibjs + js-sha3):
sed "s| // PUBLIC-CONSTANT rehearsal fixture||" fixtures/vk.json.txt     > /tmp/vk.json
sed "s| // PUBLIC-CONSTANT rehearsal fixture||" fixtures/proof.json.txt  > /tmp/proof.json
sed "s| // PUBLIC-CONSTANT rehearsal fixture||" fixtures/public.json.txt > /tmp/public.json
NODE_PATH=<node_modules> node oracle_scalars.js /tmp/vk.json /tmp/proof.json /tmp/public.json > /tmp/oracle.txt
sed "s| TESTNET-ONLY rehearsal scalar||" fixtures/oraclescalars.txt | diff - /tmp/oracle.txt   # identical
```

Provenance: produced by the M7 lane (RECEIPT-SOUNDNESS-M6.md); the
ceremony stays one-participant, rehearsal-labeled, until a witnessed
multi-party sealing is ruled for mainnet.
