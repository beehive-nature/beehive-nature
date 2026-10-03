# bData P1 shelf and pay — 2026-10-02

Lane `chief/bdata-p1-shelf-pay`. Codex findings on merged #289, fixed on current main (not a reopen of #289).

A file is "kept on this device" only after IndexedDB read-back of the blob. If IndexedDB is missing or the write fails, localStorage keeps the name and hash under shelf `meta` and the page says the file itself was not saved. Reload rebuilds the newest blob from IndexedDB. Pay stays closed while that kept file is not the priced invoice object (`try_autonomi.mp4`); "Clear this kept file" drops the binding so the registered object can be paid. The selected bytes are not uploaded by the pay call — pay is refused until the kept file is the priced object.

Key-custody lines cite `connectWallet` (`eth_requestAccounts`) and `surfaces/ant-pay.js` `injectedSigner` (`eth_sendTransaction`). They no longer say this page never holds a key. HTTP bridge errors use the browser shelf. The chain line no longer promises a wallet switch prompt, because `ant-pay.js` only reads `eth_chainId`.

`node e2e/bdata-phase-e.mjs`: 31 pass, 0 fail. The unreachable-shelf case resets `liveBridgeTouches` before the zero-touch check. On this laptop `navigator.webdriver` skips the live `:8807` fetch, so the probe count was 0.

Not done: `surfaces/lang-corpus.json` has no `bd.wal` / `bd.add` entries, so no corpus row was added. `wallet_switchEthereumChain` was not added.

Verify after Pages: https://skaists.dev/surfaces/bdata.html