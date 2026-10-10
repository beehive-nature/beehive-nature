# 2026-10-10: the PQ proof batch landed on main — receipt

To: the PQ seat (batch owner), the bDroP seat, the Safe 7 firmware seat, the zCode seat.
From: the integration seat (one seat did the three roles' combine step, at the founder's word).

## What landed

main fast-forwarded `0108c334d` → `9f42d072f3e7a145849e41ce474e437eb544bd14`.

`9f42d072f` is a merge chain with no code change of its own:

| sha | what |
|---|---|
| `507fd3b76` | the frozen batch head on `btungsten-ci-scratch` (proof code `c631108ba`, closeout `7c0fcb9e8`, zCode review `3aef3820a`); its `tests` run 38004921911 failed on the bdrop footer audit and the bpq-device-xcheck formatting |
| `511a8cd31` | repair 1, on main: `cargo fmt -p bpq-device-xcheck`, formatting only (`2026-10-09-bpq-device-xcheck-fmt-note.md`) |
| `299c3f139` | repair 2, on main: bdrop.html wire panes `pre#opjson` / `pre#txjson` read at 12 px; footer-audit baseline unchanged |
| `936d6d7a0` | integration 1: `507fd3b76` merged onto main `def2941fe` (merge-tree clean; main's main.rs and bdrop.html kept) — all eight workflows `success` |
| `9f42d072f` | integration 2: main `0108c334d` (one added document, the zCode RB04 review dispatch) merged in, because main moved during run 1 — all eight workflows `success`, then landed |

No new proof scope. hkdf32, #371 and the bsigner CONTRACT freeze stay out, as the coordinator froze them. zCode's qualification stands: no reproducible defects; ZB-1 (ML-DSA debug-build overflow assertion) remains open.

## Pre-flight on the integration tree, before the push

| check | result |
|---|---|
| six PQ harness locks (pq02-sponge, pq02-sponge022, pq03-hkdf, pq05-field, pq05-ntt, pq06-ntt) pinned to the workspace `Cargo.lock` with the `lockset` comm from `pq05-ntt-check.sh` | PASS: 10 / 10 / 13 / 4 / 18 / 17 packages, each the workspace's version and checksum |
| `cargo fmt --all -- --check` (WSL, cargo 1.98.1, rustfmt 1.9.0) | exit 0 |
| `cargo metadata --locked --offline`: workspace, pq02-sponge, pq02-sponge022, pq03-hkdf, pq05-ntt, pq06-ntt | exit 0 |
| `cargo metadata --locked --offline`: pq05-field | not runnable offline here: its manifest path-depends on `target/saw-pq05-field/module-lattice-0.2.3`, which `pq05-field-check.sh` extracts; CI's PQ SAW workflow does that and passed |
| the nine `--check` generators in `tests.yml` (plur quality, stack inventory, stack surfaces, bpq / derive / nostr / intent vectors, skaists) | all exit 0 |
| `e2e/footer-audit.mjs --only bdrop.html --baseline footer-audit.baseline.json` | 3 page×register views, no findings, ratchet 0 worse / 0 better |
| `e2e/render-badges.mjs --check` | not run locally (`badge-maker` absent from the box's `e2e/node_modules`); the batch touches nothing under `e2e/`; CI's step passed |

## CI receipts (all eight push-triggered workflows; `pages-build-deployment` is not one of them)

Integration 1, `936d6d7a0`, branch `btungsten-ci-scratch`: tests 38017064445, secret-scan 38017064452, bTunGsTeN PQ 38017064449, bTunGsTeN PQ SAW 38017064464, bTunGsTeN RB 38017064427, WB001 SAW 38017064443, WB002 SAW 38017064435, WB002 WASM 38017064434 — all `success`. Not landed: main had moved to `0108c334d`.

Integration 2, `9f42d072f`, branch `btungsten-ci-scratch`: tests 38019782123, secret-scan 38019782150, bTunGsTeN PQ 38019782044, bTunGsTeN PQ SAW 38019782066, bTunGsTeN RB 38019782291, WB001 SAW 38019782207, WB002 SAW 38019782135, WB002 WASM 38019782132 — all `success`. `git merge-base --is-ancestor 0108c334d 9f42d072f` true; pushed `9f42d072f:refs/heads/main`; GitHub API `branches/main` = `9f42d072f3e7a145849e41ce474e437eb544bd14`.

Post-landing, `9f42d072f`, branch `main`: tests 38022348819, secret-scan 38022348905, bTunGsTeN PQ 38022348834, bTunGsTeN PQ SAW 38022348845, bTunGsTeN RB 38022348856, WB001 SAW 38022348901, WB002 SAW 38022348863, WB002 WASM 38022348835 — all `success`.

## Not in this batch, left where it belongs

The bDroP publisher findings from the isolated bdrop.js harness (ArrayBuffer `.length` vs `.byteLength`, the signed-body hash racing the edited body, a content lookup counted as landing, overlapping submissions, the key-clearing and wrong-key wording) are the bDroP lane's, through the BNR findings workflow. Nothing of them is in `9f42d072f`.

HUMAN INTERACTION: NONE. NEXT OWNER: PQ seat (ZB-1, hkdf32 landing in its own batch); bDroP seat (publisher findings).
