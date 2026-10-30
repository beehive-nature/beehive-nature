# REPLAY RESULTS — published archive → fresh extraction → pinned verifier

Date: 2026-10-29. Only public verification material exported.

## Provenance digests

- Harness source: PR #492 `a4e017144edc98b00ccdadb34f6ab2cb748e093b`
  (detached `../wt-b9-verify`, no commits there).
- Binary: `target/debug/harness-sovereign.exe`, SHA-256
  `2D83F1843A425B397E99AE6ADE40A0DFD743158CD54FD2C009FB1F04F3801395` <!-- PUBLIC-CONSTANT -->.
- Packages: `PACKAGES.SHA256` (split halves; reassembled below with markers):
  baseline `d84865bb80851cc6792c68c70fd6246d320d2fe91696abb4ee3008f7131a5ea1` <!-- PUBLIC-CONSTANT -->,
  failover `ac8941f2c07f08c039f2d3f7bd5c85ffdf0ab78e45a28cb7a1d78a3fca735d12` <!-- PUBLIC-CONSTANT -->.
- Fixture inside both extractions: `frozen-manifest.bin` hashes to
  `acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->
  (golden digest, both sessions).

## Replay commands (env: test recovery phrase + throwaway key, as before)

1. `tar -xzf replayable/baseline-pass-sessB.tar.gz -C <fresh>/base`
   then `<binary> --verify-only --workdir <fresh>/base --session sess-B --order-id demo-task`
2. `tar -xzf replayable/failover-pass-sessF1.tar.gz -C <fresh>/fo`
   then `<binary> --verify-only --workdir <fresh>/fo --session sess-f1 --order-id demo-task`

Original sessions used as extracted (`sessions/sess-B.*`,
`sessions/sess-f1.*`); no keys leave the package (none inside).

## Results

- Baseline control: exit 0.
  `saved-run evidence: checkpoints_verified=0 same_actor=false`
  `transcript_sha256=291ac103aeedc56ca714533aed1e65ca1d5298ee85fb9f6d9f733d453b55d6c5` <!-- PUBLIC-CONSTANT -->
  `B9 ACCEPTANCE PASS (verify-only): order=demo-task`
  `input_sha256=acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->
  `item_count=40 did=did:b:4fjmeq6xiy3c7dx5ulj63niuc33zsruya2z4fqhklmot3uid4fcq`.
- Failover control: exit 0.
  `saved-run evidence: checkpoints_verified=2 same_actor=true`
  `transcript_sha256=573d9516c4c180181b7c6e76f551741e0092bae5555aa72bdb60cc9e449f031f` <!-- PUBLIC-CONSTANT -->
  `B9 ACCEPTANCE PASS (verify-only): order=demo-task`
  `input_sha256=acc9cb10289dc7a409be1004aec779ff07bf654b5b3415913373354f7b8c569c` <!-- PUBLIC-CONSTANT -->
  `item_count=40 did=did:b:3ihp4ahgr7khp6govobblri3opsounf54xgea23k6umwpfpj6vsq`.

Both successful controls verify end-to-end from the published
archives through fresh extraction with the pinned verifier. stdout of
both replay invocations was empty; all verifier output above came via
stderr; exit codes recorded per invocation.
