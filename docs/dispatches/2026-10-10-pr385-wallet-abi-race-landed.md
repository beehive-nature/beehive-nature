# 2026-10-10: PR #385 landed — the wallet adapter §12 flake, found and closed

To: the integration seat (whose 2026-10-10-pr379-pr380-landed dispatch recorded the flaky case and left it to the next owner), the wallet lane, the zCode seat.
From: Seat 3, at the founder's word ("find the race … make the case deterministic").

## The flake

`e2e/wallet-adapter.mjs` §12, third refusal (`… is not yours [eosio_assert_message_exception]`),
raver register. Tests run 38032431715 (pull_request, head `02d175eb7`, a docs-only PR), job
`wallet` 114155994769, step "Wallet batteries in raver": the two sibling refusals passed at
07:13:46, the third failed at 07:14:17 after the 30 s wait for the outbox phase `failed`. The page
said `it could not be prepared, so nothing was signed. try again build failed: missing
commit.committer (type=name)`. The push run on the same head passed the step.

## Root cause

In cypherpunk the composer boots prefilled with the estate's own action, `kingbeelovis:registeracc`
and its args (`bootProfile`, wallet.html). The battery's first step, `selectOption('#tx-net','j4')`,
fires `tx-net.onchange`, which sees a filled contract and action and calls `loadAbiUi()` for
`kingbeelovis`. That read is async. The battery then types `banchor22222:commit`, the test key
and `COMMIT_ARGS` into `#tx-data`.

When the `kingbeelovis` answer lands **after** that fill, `loadAbiUi` draws `registeracc`'s three
`.tx-f` fields, reads `#tx-data` as "prev" (`COMMIT_ARGS` carries none of
`registrant/domain_name/target`), and writes `buildArgsFromFields()` = `{}` back into `#tx-data`.
The press builds `commit` with `{}` and the serializer says `missing commit.committer`. Which side
of the fill the mocked route's answer lands on is scheduling, so the case went red on some runs only.

Cleared: the `get_abi` route, `COMMIT_ARGS` vs `COMMIT_ABI`, §11's `#tx-abi` + `.tx-f` fill path,
the j4 scaffold order. The same window exists in §2, §6, §7 and §17 (same first steps); the page
fix closes all of them.

## Reproduction (Windows node 24, `e2e/node_modules` junctioned)

§12's sequence replayed with the `kingbeelovis` `get_abi` answer held 1200 ms:

```
get_abi kingbeelovis asked at +57ms
get_abi kingbeelovis answered at +1266ms
tx-data before late ABI: {"committer":"banchor22222","epoch":"1000150","new_root":"00
tx-data after  late ABI: {}   fields: registrant,domain_name,target
tx-out after press: it could not be prepared, so nothing was signed. try again build failed: missing commit.committer (type=name)
```

Same hold after the fix: `tx-data` keeps `COMMIT_ARGS`, no fields drawn, `the contract refused
it. nothing changed.` reached, `window.__xss` undefined.

## The change (`3fb0b525a`, two files)

- `surfaces/wallet.html`, `loadAbiUi`: a read counter (`ABI_READ`). After its await the answer is
  dropped when a newer read went out or the composer's contract/action changed since the request:
  no stale parts drawn, no rewrite of args typed since, its own "reading …" line hidden when
  nothing newer is out. The same path is a person's: switch network, then type another action
  while the first read is out.
- `e2e/wallet-adapter.mjs`: `mockChain` gains `abiHold` (one account's parts answer only when the
  test lets them); new §12c replays the race deterministically (held answer released between the
  fill and the press) and asserts the typed args stay, no `.tx-f` of the old action is drawn, the
  reading line is gone, and the press reaches the chain's refusal. §12's three regexes and every
  existing assertion untouched.

## Receipts

Local adapter battery on `3fb0b525a`, all three registers: cypherpunk 80/0, bee 80/0, raver 80/0
(79 before + the new gate). Gate shown red first with the page reverted to `f84939bc6` and the
battery kept: `79 passed, 1 failed`, the one failure the new gate carrying the CI words
(`{"kept":{"d":"{}","f":3,"vis":"block"} … missing commit.committer`).

| step | sha / id | what |
|---|---|---|
| base | `f84939bc6` | main at branch time; HEAD equalled origin/main |
| fix commit | `3fb0b525a` | both hooks `§7: ok`; pushed, remote tip verified via API |
| PR | #385 | opened against main, merge commit (not squash) |
| CI on `3fb0b525a`, push | `tests` 38075638881 | success |
| CI on `3fb0b525a`, pull_request | `tests` 38075670025 | success; `wallet` pass in both |
| still running at merge time | `bTunGsTeN PQ SAW` 38075638935 / 38075670031 | SAW proofs, untouched by an HTML + e2e change; main unprotected |
| merge | `a28eb56d5` | 2026-10-10T18:58:24Z, main tip verified via API |
| post-merge main CI | `tests` 38077926895 | success, 7/7 jobs incl. `wallet`; every other workflow on the tip success except `bTunGsTeN PQ SAW` still in progress at writing |

## Post-merge main CI

`tests` 38077926895 on `a28eb56d5`: completed success — node, meter, formal, eternal, wallet, static, test all success.

HUMAN INTERACTION: NONE. NEXT OWNER: none for this case; the wallet lane for anything further on
the composer.
