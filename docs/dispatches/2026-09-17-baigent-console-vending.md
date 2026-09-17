# THE bAiGenT CONSOLE — vending.html rebuilt as "choose the bee that does my work" · 2026-09-17

**Seat:** zCode · **Branch:** `zcode/baigent-console-2026-09-17` (cut from origin/main ac4a783d, worktree wt-zcode-console) · **Commit:** c82e30e1 · **Founder order:** the relayed console blueprint ("use that kind of console as the reference for our bAiGenT vending experience, but make the primary action 'choose the bee that does my work,' not 'configure a model API'").

## What shipped — one surface, three areas, zero second architectures

`surfaces/vending.html` (796 → 1,096 lines, still one vanilla file, tokens.css only) is now the console:

1. **CHOOSE YOUR bAiGenT** — a five-bee catalog. Every card answers the four questions (what it does · what it needs access to · what it delivers · what it may cost) plus availability. **Capability-truth throughout:** only the genesis bee is selectable (chip `rehearsal-live today`, live-read); the genealogy / adversarial-review / archive-&-media / builder bees stay on the shelf saying **NOT CURRENTLY RUNNABLE**, each with its real estate status named (ceremony-proven in zBlood · practiced-in-estate red-first batteries · live on the wallet until bPay Phase C · rails exist, no work seat). Clicking one explains itself ("visible is not a promise") and never becomes the purchase.
2. **TAILOR IT** — the permitted data (the mint sends none of your data anywhere; memory = autonomi · your key · deletable; where its work may run *when work begins*: estate box rail Qwen3.5-4B / in-pocket W-1 / **hosted providers HELD** with the bFabLeAPi lesson named in the disclosure); **autonomy as a real control** — ask each time (default, no standing authority) · **automatic within limits** (ceiling b + expiry; "expanding it takes a new decision from you") · paused (pause-not-kill); resources itemized one-time vs running vs storage-never-$0; **who can get what** as per-layer truth (certificate public by construction · memory only you · selected people struck, not-yet-wired — the #114 visibly-unavailable law).
3. **MY BEES + WORK, USAGE & RECEIPTS** — the ledger's own rows with finality from the action walk ("sessions: none on record" — nothing invented), every landed mint as a receipt row, the held money-rail named as the actionable block, and the x402 meter receipt folded in as the usage evidence.

**Price in b:** the hero total is b-denominated and live-law-true (**0.82 b** = 0.60 mint + 0.16 room + 0.06 tithe, read live), $ as a labeled reference, settlement details disclosed (1 b = 1 A on this rail, CoinGecko source, contract + rate-row date). **Availability gate before launch:** route · access · tools · funding checked live; route dead renders the customer copy verbatim — *"This bee is temporarily unavailable. Your work and unused allowance are preserved."* — launch locked, the operator line stays in the cypherpunk view, the price rests on a dash, never a fake.

**Audience ⊥ view, proven mechanically:** the tour-bar register pills drive `details[data-reg-disclose]` (collapsed for new-bee/raver, open for cypherpunk — the comprehension law) and the battery now asserts that switching views **never touches the price or the audience rows**. Permissions are never behind a disclosure. The plan screen gains "the authority you grant" and "who can get what" beside the unchanged rails/door.

## Gates — receipts

- **e2e/vending-shot.mjs grown 44 → 75 checks, ALL PASS twice-stable LIVE**: law rows 0.6000 A + tithe 10% → kingbeelovis read live from jungle4; fnv1a-64 bit-exact; the full canonicalization rail test (mīlestība ir karalis survives whole); resurrection **11/0 against arweave.net**; the one-tap mock-wallet proof (ZERO requests while the plan is open → EXACTLY ONE `eth_sendTransaction`, calldata decoded); monitor deep-link render-verified. New: catalog honesty, autonomy limits, audience truths, availability 4/4, **orthogonality under register switch**, my-bees/receipts counts, and the **route-blocked preserved state** via RPC interception. One transient FAIL in a back-to-back triple run (live-network; did not recur in two subsequent full runs — named, not waved away).
- **design-acceptance 14/14 — the first time this surface sits under the design gate** (D1–D5 + M + X clean; I1 itemized 13 subresources; the two live-read hosts `jungle4.greymass.com` + `api.coingecko.com` added to the rider allowlist by exact host — the same founder-confirmed live-read class as market's RPCs; FCP 40ms file://).
- **estate-source 11/11** (corpus English matches the pages; all keys exist; 28 tongues cover 1,823 keys) · **coverage floors PASS** · **secret-scan clean** · **x402 engine parity agrees**.
- **Language:** 34 new `v2.*` keys + `v.h1a`/`v.h1b` re-authored for the console headline, every key ×28 tongues (machine-drafted ⚙ per corpus law, recorded in `_meta`; blind round-trip rendered live in ru/th/sa/tt; the hero caption split into keyed prefix + dynamic count so translations survive the live overwrite; lang-corpus cache-buster v25 → v26).
- **Shots:** `e2e/shots-vending/console-{1..4}*.png` + `console-fold-390.png` + `console-desktop-1440.png` (two-column storefront with sticky price column at desktop, single column at 390px; vision-passed both viewports).

## Two bugs the gates caught in my own first cut (the honest ledger)

1. **The body-hide:** my global `[data-reg="cypherpunk"]{display:none}` hid the ENTIRE page in cypherpunk view — register.js sets `data-reg` on `<body>` itself and its own CSS guards with `:not(body)`; mine now does too. Found by the orthogonality test's newline loss (hidden elements fall back to textContent).
2. **The stale checklist:** `renderPrice` never re-rendered the availability gate after the law rows landed — the gate showed boot-time "waiting" forever. Now wired.

## Boundaries held

No new surface (vending.html keeps its registration; no estate.json/atlas/review-deck ritual owed). No second invoice system — the plan screen remains the one commitment gesture; bPay's chooser vocabulary is reused, not forked. The VV-1 PricingCommitment lane is untouched (its builder order stands; the console's plan screen is where a commitment will render when that primitive lands). No Jungle4 mutation, no payment wiring, no founder ceremony crossed.
