# the wallet's three grammars: register-difference matrix (written before any code)

date 2026-09-26 · seat Claude Code (Opus 5.5) · branch `claude-LoVis/wallet-three-grammars-2026-09-26` off `origin/main@8dfb68d81`

founder, 2026-09-26, on the #232 wallet: "made all three same exact UX with just changes in the color of the button. terrible."
mission as relayed: restore three genuinely distinct registers. Shared data, state and accessibility contract, with a different presentation grammar for each. The matrix comes before the code.

## 1 · audit: what #232 actually shipped (receipts, not recollection)

**production = main.** `sha256(https://skaists.dev/surfaces/wallet.html)` = `c968dec1b158cae5e47ae945ff9f4c7528ed7d949b10e41eaf905926574bcc24` = `sha256(git show origin/main:surfaces/wallet.html)`. The audit below is what a visitor gets today. <!-- PUBLIC-CONSTANT: sha256 of a public page, both sides -->

**what #232 removed from wallet.html:** 10 lines. They were the `color-scheme` meta, the bare `<body>` tag, six `text-transform:uppercase` rules and two `toUpperCase()` calls. **No content, cypherpunk or otherwise, was deleted.** Everything else in the diff is additive CSS (`<style id="register-dress">`).

**measured structure, the same probe on all three registers** (390px and 1280px, network aborted so data is identical):

| measure | new bee | raver | cypherpunk |
|---|---|---|---|
| sections in the DOM / visible | 19 / 18 | 19 / 18 | 19 / 18 |
| visible controls | 91 | 91 | 91 |
| first screen (390px) | balances | balances | balances |
| visible text nodes | 548 | 548 | 548 |
| technical notes open | 0 of 14 | 0 of 14 | 14 of 14 |
| visible text under 14px | **397** | 516 | 538 |
| balances rendered as a bare "—" | 5 | 5 | 5 |
| register-only blocks | 2 paragraphs | 2 paragraphs | 2 paragraphs |

The verdict follows from the numbers. The three registers are the same document at the same density, with the same navigation and the same first screen. They differ only in colour, font family and corner radius. `e2e/wallet-registers.mjs` measures exactly that dress vector, then prints "three totally different UX/UIs". **That line is a false signal (k001 class) and is deleted, not patched.**

**What "the cypherpunk info" is and where it went.** The whole wallet is cypherpunk material: it is the pipeline written out. Cypherpunk still opens all 14 technical notes, so nothing was lost there. What was lost is the other side. New bee and raver were never authored, so they got cypherpunk's wall recoloured. That breaks three ruled laws:

- the blueprint: *"never ship one reading and recolour it for the other two"*
- DESIGN-CONSTRAINTS §13: *"do not ship a new dark 9–13px reading surface"* under new bee, where 397 visible text nodes sit under 14px
- DESIGN-CONSTRAINTS §2 and the blueprint's honest-states law: *"never 0, never a dash"*, yet five balances render "—"

## 2 · the law this matrix is held to

- **Blueprint** (skaists design system, captured `docs/dispatches/2026-09-25-skaists-design-system-blueprint.md` on the zcode audit branch): a register changes voice, density and dress, never a number, a price, a limit, an address, or what a person may do. Move the detail, never delete it.
- **Register definitions:** new bee is "one question at a time". Raver is "everything expressed through art, graphics, animation". Cypherpunk: "the pipeline is the interface and every row is a fact a stranger can check".
- **DESIGN-CONSTRAINTS §5:** identical numbers across reading levels. The negative control is that reading level altering a displayed value is a fail.
- **DESIGN-CONSTRAINTS §11:** theme freely, gate never. No register or task view may lock a capability.
- **DESIGN-CONSTRAINTS §13:** the matriarch is the reference reader for new bee. That means familiar words, a few meaningful choices, reading text of 16px or more, and a clear way home.
- **Estate map 2026-09-12, "definition of completion":** a composed new-bee arrival and a raver made of imagery. The first task is tested in each view, and cypherpunk keeps the inspectable record.

## 3 · the matrix

| axis | new bee: the matriarch's wallet | raver: the wallet as a light show | cypherpunk: the wallet as a console |
|---|---|---|---|
| **grammar** | navigation stack (iOS): a home list, push into one task, then "‹ wallet" back | a stage and a dock: a lit constellation, with a glyph dock that swaps the deck | the pipeline, all at once: an index rail, every section, every note open |
| **arrival (first screen)** | greeting, the home-chain figure in words ("not read yet" when unread), then "what would you like to do?" as five big rows | the constellation: the soul at the centre, five rails orbiting. Read rails are lit, unread ones are dashed rings, and a word sits under every glyph | a live state table (rail · state · value · read path), session facts, a section index and a key map |
| **information density** | lowest: one task's sections, notes folded | low to medium: one deck at a time, art first, notes folded | highest: 19 sections and 14 notes open, nothing folded |
| **typography** | serif titles over sans; reading text 16px or more, labels 14px or more. Inline 9–13px text is lifted to 14px | heavy display titles; glyphs large; body 15px | mono top to bottom, 12–13px, tabular numerals |
| **spacing** | generous: 24px gaps, 18px padding, single narrow column (≤ 720px) | airy stage: full-bleed art, 28px-radius cards, centred (≤ 860px) | tight: 12px sections; two-pane wide console (≤ 1320px) on desktop |
| **hierarchy** | question, then choice, then one task | image, then glyph, then deck | index, then section, then row |
| **interaction grammar** | tap a row; back returns home, and the browser back button works too (history entries) | tap a glyph; arrow keys move along the dock; a touch swipe on the deck moves to the next or previous glyph | links jump sections; keys `j`/`k` next and previous section, `g` index, `o` fold or unfold all notes, `?` key map |
| **component shape** | rounded list rows of 60px or more with a chevron, 20px cards | round glyph buttons (64px) with a word underneath, pills, 28px cards, one glow | tables, `§nn` index rows, 4px corners, no glow |
| **navigation treatment** | sticky "‹ wallet" bar naming the task; crumbs at wallet home | sticky glyph dock, with the current glyph lit | sticky left index rail (desktop), index first (phone) |
| **motion** | 260ms state changes, no ambient motion | orbit drift (holds still under reduced motion), 520ms deck arrival | none except the press; instant jumps |
| **disclosure level** | notes folded; "show me everything" is one row, always there | notes folded; the "all" glyph is always in the dock | every note open; `o` folds them |
| **voice** | plain adult sentences, matriarch-first | PLUR, short, literal | exact nouns: contexts, keys, rails, endpoints |
| **honest states** | "not read yet" with the reason, never "—" | a dashed dim ring and the word "waiting", never "—" | the stat line verbatim; a missing value is printed as `not read`, never "—" |

**Shared by all three, invariant:**

- the 19 sections and every control inside them exist exactly once in the DOM, so there is one state and no duplicate ids
- every fetch, key, signer, outbox and receipt, untouched
- the toggle, the early-paint register script and the `register-dress` token block (the golden-dress contract's token fidelity still holds)
- deep links: `?compose=`, `#qr=` and `#<section>` each route the reader to the task that holds the target, in every register
- a 44px floor for every press, the focus ring, and no `text-transform`

**Mapping sections to tasks** (every section belongs to exactly one task, so bee and raver can reach all 19):

| task | bee row / raver glyph | sections |
|---|---|---|
| `have` | see what i have / ⚡ | balances · summary |
| `move` | pay or get paid / 💸 | pay · outbox |
| `add` | add money / 💳 | fund · fiat in (Peer) · voucher |
| `keep` | keep something forever / 📡 | bPay invoice · Arweave · inscriptions |
| `key` | my key and my safe / 🗝 | connect · keychain · vault · key forge · bridge · account forge |
| `proof` | see how it works / 🗺 | receipts · composer · chain matrix |

## 4 · what the new gate must prove (it replaces the dress-only gate)

1. **The grammar differs.** The measured structure vector (visible sections at arrival, open notes, register-owned components, first-screen composition, reading size) differs on every pair of registers, and each register's own component is present and working.
2. **Bee's first task works.** Tap a row, and only that task's sections show; back and browser-back both return home.
3. **Raver's first task works.** Tap a glyph and its deck shows; the arrow key lights the next glyph.
4. **Cypherpunk's first task works.** `j` moves focus to the next section; an index link lands on its section; every note is open.
5. **Facts are invariant** (§5 negative control). The same injected balance renders identically in the shared card, the bee figure, the raver caption and the cypherpunk table. An unread balance is never "—" in any register's own component.
6. **Nothing is orphaned.** Every section is reachable from a bee row and a raver glyph, and "everything" shows all 19.
7. **Work survives a switch.** A value typed in one register is still there in the other two, and the task choice travels between bee and raver.
8. **Deep links land.** `?compose=` opens the composer's task and `#fund-sec` opens `add`, in bee.
9. **Still true:** dress per the ruled sheet, the toggle is 44px or more, bee is the default, the choice persists, there is no `text-transform` and no page errors.
10. **Receipts:** six screenshots (three registers × 390px and 1280px) at identical data.

The functional batteries (fund, vault, arweave, signer, adapter, matrix) test the pipeline, so their pipeline contexts pin `bregister=cypherpunk`. Bee-dress assertions stay in bee. Nothing in a battery is loosened to pass.

## 5 · interaction with the golden-dress contract (zcode, `zcode/register-contract-2026-09-26@d13646c27`)

That branch freezes wallet.html as the register reference and ships the token sets from `register.js`. **This work keeps every token value, so contract token fidelity is unaffected.** But the founder has now rejected the reference's grammar, and the contract's harness proves dress only. The contract's rollout ("roll outward by behavior contract") should carry the grammar axes in §4, not just token fidelity. Otherwise it rolls the recolour estate-wide. **This is escalated by name to zcode here rather than resolved; this lane does not touch that branch.**

*Update, same day:* the contract landed on main as **#235 (`fb8da542d`)** while this lane was building, and this branch merged it. The contract runs **first** inside `e2e/wallet-registers.mjs`, through its own instrument, and passes whole. One generic fix went into the instrument itself. `collectDress` sampled the first `main button` as a register's action colour, and on a surface with register-owned navigation that is the bee home row, which is deliberately not a filled action. It now samples **shared content only** (`!el.closest('[data-reg]:not(body)')`), because a register's own blocks differ per register by design. The escalation above stands: the rollout should adopt the grammar axes of §4 alongside the dress.

## 6 · as built: where the code departed from the matrix, and why

- **Cypherpunk on a phone:** the console comes *after* the hero balance and the ring, not first. The ruled phone fold law ("form-kill", master design pass) puts the balance and the ring above everything; in cypherpunk, where the pipeline *is* the page, that law stands. On desktop the console is the sticky rail beside the pipeline, as the matrix said.
- **Work survives a switch:** it carries by **the field the reader last worked in** (focus or input), not by scroll position. The toggle sits at the top of the page, so every reader scrolls up to reach it; scroll position could never say what they were doing. Where they typed can.
- **Raver hint:** "tap a light below" was wrong, because the dock sits *above* the stage. It now reads "the glyphs above open each part of the wallet".
- **New bee's reading:** beyond the matrix, bee also got (a) the black-ground inline colours (amber, cyan, honey, leaf, violet) stepped darker inside their own ramps for paper, since a semantic colour is never repainted to another hue; (b) the sections' 38 filled "gold" buttons outlined until pressed, so a task never opens on a wall of primaries; (c) the engineering kicker kept out of the matriarch's first screen (it stays in raver and cypherpunk).
- **44px floor:** enforced in **every** register, not just bee. 33 inline controls were cut to 26–34px.
- **Honest states on the shared cards too:** the five balance placeholders and the Arweave refresh path wrote a bare "—". They now write nothing (the card hides its figure), and the stat line under each card already says why.
- **Heading casing:** the unkeyed authored capitals ("CONNECT —", "THE KEYCHAIN —", …) are lowercased per the casing law. The keyed ones (`wl.insc.h2`, `wl.vh2`, `wl.h.summary`) still carry capitals in all 29 tongues. Changing them is a corpus-wide edit, left open and named here.

## 7 · receipts (this branch, merged with main `fb8da542d`)

| gate | result |
|---|---|
| `node e2e/wallet-registers.mjs` (golden dress contract harness + the three grammars) | **GREEN 66/66** |
| wallet batteries: fund · vault · matrix · arweave · signer · adapter | 94 · 35 · 11 · 22 · 105 · 28, **0 failed** |
| CI `node --test`: comprehension · orb-seat · bpay-policy-ownership | 9/9 · 4/4 · 2/2 (each was red on this branch before the tests were given the reader's real first step: a row tap or a deep link; no assertion loosened) |
| CI front-door static suite | 377/377 |
| `scripts/estate-check.mjs` · `e2e/estate-source.mjs` | PASS · 11/11 (45 new keys × 28 tongues, machine-drafted ⚙, casing-clean) |
| screenshots | `e2e/shots-wallet-registers/`: contract arrivals `wallet-390-{reg}.png` (unread), read arrivals `wallet-390-{reg}-read.png`, desktop `wallet-1280-{reg}.png`, a bee task, a raver deck |

**Not claimed:** no human (and no matriarch) has used these three grammars yet, and the gate proves only its named properties (DESIGN-CONSTRAINTS §13). No live chain was read. Balances in the receipts are injected fixtures (`12.3456 A`, `7.000 HIVE`), written into the sections' own nodes where a chain read would land.
