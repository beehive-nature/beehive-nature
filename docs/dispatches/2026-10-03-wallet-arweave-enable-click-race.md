# Wallet check: the Arweave enable-then-click race, repaired and guarded

2026-10-03. Seat 3 (Claude Code). PR #339, branched from main `fd423f3fa`.

The `wallet` check went red on unrelated commits (run 37108235973 attempt 1 on PR #320 head `a2f12898c`, while run 37108240704 on the same head passed). `e2e/wallet-arweave.mjs` enabled the intentionally unfunded publish control `#arw-go` in one Playwright step and clicked it in the next, at two sites. The page's own balance refresh re-disabled the button between the two, and Playwright waited 30 s for an enabled element.

Both sites now enable and click inside one `evaluate`. Production wallet code is unchanged. The other wallet batteries carry no enable-then-click shape.

The 2026-10-02 zblood dispatch said this repair had landed. It had not on main; that dispatch carries a forward correction.

A static check, `scripts/lint-e2e-enable-click.mjs`, now runs in the `static` job. It fails the run if any e2e file enables a control inside an `evaluate` call and clicks it after that call closes, on the same line or within the next three code lines. The boundary is the browser task, not the physical line (review correction on `7b84a52c7`: the first cut keyed on line co-location). It tests itself first: the two-step shape must be caught on two lines and on one, and the one-task shape must pass on one line and across several. Control: the pre-repair `wallet-arweave.mjs` from `fd423f3fa` is flagged at lines 183 and 284; the tree as repaired reads clean.

Local receipt for the repair: `WALLET_REG=<reg> node e2e/wallet-arweave.mjs`, three runs in each of cypherpunk, bee and raver, 40 passed and 0 failed every time. Nine green runs do not prove an intermittent race is gone; the one-task shape leaves no gap for the refresh to land in, and the static check keeps the shape from returning.

Second review correction, on `7b6edcd83`: the check now blanks comments, strings and regular-expression literals before it reads, accepts whitespace before the call paren, walks nested e2e directories (285 files), and counts only a click on the control that was enabled. A click on something else inside the task no longer clears the enable; a later click on a differently named control is no longer flagged; anything it cannot tell apart is flagged. Twelve self-test shapes. It still reads source text and not a syntax tree: an enable inside a string passed to `evaluate`, or in a helper the callback calls, is not seen.

Third review correction, on `efb34ec92`: a slash after the paren closing an `if`, `while`, `for` or `with` condition is now read as opening a regular expression, where after any other closing paren it divides. Fourteen self-test shapes. Telling a regex from a division stays a rule of thumb, not a grammar.
