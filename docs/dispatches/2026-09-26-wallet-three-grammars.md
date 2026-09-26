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
| `have` | see what i have / ⚡ | balances · summary (+ connect, moved here in review round 1, §8) |
| `move` | pay or get paid / 💸 | pay · outbox |
| `add` | add money / 💳 | fund · fiat in (Peer) · voucher |
| `keep` | keep something forever / 📡 | bPay invoice · Arweave · inscriptions |
| `key` | my key and my safe / 🗝 | ~~connect~~ · keychain · vault · key forge · bridge · account forge |
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
- **Bee's paper adapter, measured:** a contrast audit of every visible text leaf in bee's "everything" view found **41 below AA**. Faint labels on the paper well sat at 4.05:1, and the sections' inline dark-ground chips (`background:#0e2d3a` buttons, `#E9F2EC` ladder labels) sat at 1.1–2.5:1. This defect predates this lane: #232 put the page on paper. Each hue now steps to its bee stop (DESIGN-CONSTRAINTS §13: a tool family migrates as a unit), leaving **0 below AA**. Raver and cypherpunk miss AA only through the sheet's one ruled exception (ink-dim on bg-card, 4.4:1, kept exact), 57 leaves each; the gate now holds both lines.
- **The ru coverage floor for wallet.html was reset 42 → 23**, on the plur.html precedent (`e24ca8195`: "a replacement page starts fresh"). That floor is an absolute count of keyed strings visible at arrival. Measured for the wallet alone: main shows **506 visible, 60 keyed (12%), 446 unkeyed**; this branch shows **29 visible, 23 keyed (79%), 6 unkeyed**. The matriarch's first screen went from 12% translatable to 79%, and every string behind a row is still keyed. The ratchet resumes rising from 23.
- **Heading casing:** the unkeyed authored capitals ("CONNECT —", "THE KEYCHAIN —", …) are lowercased per the casing law. The keyed ones (`wl.insc.h2`, `wl.vh2`, `wl.h.summary`) still carry capitals in all 29 tongues. Changing them is a corpus-wide edit, left open and named here.

## 7 · receipts (this branch, merged with main `fb8da542d`)

| gate | result |
|---|---|
| `node e2e/wallet-registers.mjs` (golden dress contract harness + the three grammars + whole-wallet contrast, size and dash audits, history, links, stale reads) | **GREEN 98/98** (69 before review round 1, 83 after it, 90 after round 2, 93 after round 3; every other row below re-run green on the task-depth build) |
| wallet batteries: fund · vault · matrix · arweave · signer · adapter | 94 · 35 · 11 · 22 · 105 · 28, **0 failed** |
| CI `node --test`: comprehension · orb-seat · bpay-policy-ownership · tour-bar-clearance | 9/9 · 4/4 · 2/2 · 4/4 (the first three were red on this branch before they were given the reader's real first step: a row tap or a deep link; no assertion loosened) |
| CI browser gates: bPay phase A · phase B · bData · polish-i18n · engineflow · no-page-errors | 18/18 · 17/17 (phase B deep-linked, same rule) · 100/100 · 25/25 · 30/30 · exit 0 |
| CI i18n: coverage selftest · ru floors | exit 0 · PASS (wallet floor reset 42 → 23 with the measurement above) |
| CI front-door static suite | 377/377 |
| `scripts/estate-check.mjs` · `e2e/estate-source.mjs` | PASS · 11/11 (45 new keys × 28 tongues, machine-drafted ⚙, casing-clean) |
| screenshots | `e2e/shots-wallet-registers/`: contract arrivals `wallet-390-{reg}.png` (unread), read arrivals `wallet-390-{reg}-read.png`, desktop `wallet-1280-{reg}.png`, a bee task, a raver deck |

## 8 · fresh-eyes review, round 1: REQUEST CHANGES, and what changed

An independent read-only reviewer (it did not write this code) confirmed that the three registers are now materially distinct. It also found the gate printing two claims it did not measure, the same false-signal class this lane was opened to delete. Every finding was fixed:

| # | finding | fix |
|---|---|---|
| 1 | **blocker:** the contrast audit read `color`, but SVG text paints with `fill`; the size check ran on one task only | The audit measures `fill` for SVG text. Size, contrast and the dash check now run over the **whole** wallet in every register. The keychain ring carries numerals only, with its words in a text key beneath (no words inside art). The last seven sub-14px leaves in bee (hero badge, the audit button, ladder numerals) and the 12.5px note summaries are lifted. |
| 2 | "above"/"below" messages pointed at sections a one-task view doesn't show | Every cross-section message names its target as a **link** (`#bridge-sec`, `#vault-sec`, `#kc-sec`, `#bal-sec`, `#pay-sec`), built as DOM via `wlSay`, never as HTML. The presenter routes it into its task in every register. A static gate check forbids the old directional phrases. |
| 3 | new bee's unread card said "waiting…" with no way in | **connect moved into "see what i have"** (you type your name to read your balances). The unread card says "not read yet" plus a link: "connect your name or account to read it". |
| 4 | a failed later read left a stale figure passing as current | Each balance's mirror reads its stat line: on `stat err` the figure stays, dimmed, with "the last read failed, so this figure may be out of date" (bee) or "last read failed" (raver), and the rail goes dark. Gated in all three registers. |
| 5 | bare "—" and caps in the summary and voucher | The summary labels are lowercase and keyed (same English as the console's keys). Unknowns are words ("not connected yet", "not known yet"); the voucher source and keypass meter show nothing rather than a dash. The gate's dash check now covers the whole wallet. |
| 6 | raver decks filled every `.gold` button | The sections' `.gold` buttons stand **outlined in every register** until pressed; gated in bee's and raver's "move". |
| 7 | fragment-link `popstate` (null state) reset the view; a depth counter broke after Forward | `popstate` without wallet state is ignored (the hash handler owns it). The stack index lives in `history.state.wlIdx`. Links are routed by the presenter and **replace** the task, so "‹ wallet" always means home. Back, Forward, then "‹ wallet" are gated. |
| 8 | inside a deck, raver was bee in raver dress | Every raver deck opens on **art**: its glyph lit large in a glowing orb before any section. The "have" deck opens on the constellation itself. Gated: the orb leads the deck. |
| 9 | `?compose=` landed above the composer | It lands **on** the composer, re-landing after the receipts above it render, unless the reader has already moved. Gated. |
| 10 | `o` pinned every note permanently | A bulk key no longer pins; bee still folds after `o`. Gated. |
| 11 | a dead index row for the hidden bridge | Index rows follow their section's own display (the bridge row appears when the page shows the bridge). Gated. |
| 12 | the raver dock hid its last glyphs at 390px | The lit glyph is scrolled into view. Gated. |
| 13 | `#section` links flashed home first | The first-paint script carries the section-to-task map. The gate proves the map equals the `data-wl-task` attributes, and that `#fund-sec` paints in "add" at **first** paint. |
| 14 | auto-connect fired on navigation | Bee rows, the raver dock, the console and its `j`/`k`/`g`/`o` keys no longer start the passkey ceremony; the first press on a real control still does (the founder's auto-connect law). A sideways swipe still counts as a press, since it can't be told apart at pointerdown. |
| 15 | three gate lines over-claimed | "structure vector" is replaced by **what kind of thing arrives** (bee rows, raver art area, cypherpunk index and tables). The cypherpunk console is checked to be in the first screen on desktop. The 44px floor covers summaries and link-buttons, and spend-audit's 20px receipt rows are lifted. |
| 16 | leftovers | The fixture writes the stat a real read writes ("✓ live"). The `?` key map was **not built**: the key map is always visible in the console, so a toggle for it would hide nothing. The ring's decorative gold is sovereign purple (honey is b's colour only). The ru floor reset stands as documented in §6. |

## 9 · fresh-eyes review, round 2: REQUEST CHANGES again, and what changed

Round 1's blocker was confirmed fixed and nine of the sixteen findings were closed. Round 2 found three **new** gate lines over-claiming (N1, the same class, smaller) and six small regressions from this lane's own round-1 changes. All are fixed:

| # | finding | fix |
|---|---|---|
| N1 | **blocker:** the "kinds" check counted what was rendered, not the first screen. The "no directions" check listed six phrases. "every deck opens on art" was gated for one deck only. | "kinds" counts only what is **in the first screen**, and states the phone truth: cypherpunk arrives on the pipeline itself, hero balance first by the fold law, with its console beside it on desktop. The directions check is **exhaustive**: every visible "above"/"below" (comments stripped) must sit on a **reviewed list** of within-task references, each with its reason, or the gate fails. The art check loops over **every** deck. |
| 2 | four cross-task directions were left (the key forge, the voucher panel, and two bridge messages naming the connect field) | All four are links now. The console caption drops "below", since on a phone the balances sit above it; its English and its 28 tongues were redrafted. |
| N2 | raver's "key" and "all" decks opened on sections at 390px | The deck orb takes the stage's flex order. The old universal fold order (balances, ring) now applies in cypherpunk only, where the pipeline is the page. |
| N3 | the orb ignored reduced motion | The orb and its rings join the reduced-motion block. Gated: orb, rings, orbit and soul all hold still. |
| N4 | Arweave paints `stat err` on a *successful* read that is short of the anchor fee | Each read marks its own stat line through `wlRead()` in its success and failure branches. The mirrors read that mark, never the colour. A gateway failure now says "read failed". Gated both ways. |
| N5 | a connected reader still saw "connect your name…" | The page marks a connected soul (`data-wl-soul`). The card then shows the read's own state ("reading…", "read failed"). Gated. |
| N6 | bridge links could land on a hidden bridge | With no keychain yet, the messages link to the keychain. A link whose target the page holds hidden lands on its task with focus on the title. Gated. |
| N7 | from home, the card link replaced the entry | Leaving bee's home is a push, so Back returns home. Gated. |
| N8 | a reload reset the stack index | The index is preserved. The same test exposed a deeper bug: a Back into an entry the pre-reload document pushed is a full load, and the hash overrode that entry's own view. Now an entry's own `history.state` outranks its hash, at first paint and at presenter boot, and a pushed link writes its hash to the **new** entry only. Gated end to end. |
| N9 | browsing the console counted as work | Focus landing on a section (j/k, index) is not work. Gated. |
| N10 | the audits' wording claimed more than they measure | They walk every visible **text node** (mixed-content parents included), and the claims say "at rest" and "CSS-generated content excluded". |
| N11 | doc drift | §3 annotated. The keychain's copy no longer says "anywhere" (navigation does not count). The receipts are restated in §7. The USDC coin is money blue, not honey. |

## 10 · fresh-eyes review, round 3: REQUEST CHANGES, and what changed

Round 3 confirmed that most of round 2 holds. It found one more gate line certifying a state the page never produces, and four should-fixes, three of them regressions from round 2:

| # | finding | fix |
|---|---|---|
| blocker | the "in flight" check **injected** `data-wl-soul` and "reading…"; the real page set neither until the round-trip ended | `readAll()`, the one entry point for every path (boot restore, the connect button, a soul switch), marks the soul and writes "reading…" **before** the reads start. The gate now drives the **real** path: a returning reader with every chain request left hanging. Nothing is injected. |
| S1 | since round 2, "‹ wallet" after a reload called `history.back()` into an entry of a dead document: a **full page load that drops the tab-memory keychain** | The presenter records the stack index at boot and pops only entries **this document** pushed. Below them "‹ wallet" replaces to home within the page and clears the hash. Gated with a marker on `window` that must survive. |
| S2 | on a same-document Back, `hashchange` (after `popstate`) re-routed the entry's own view | `hashchange` keeps any entry that carries its own view. The reviewer's exact path is gated: `#receipts-sec` → home → connect → home. |
| S3 | the raver orb could paint in bee or cypherpunk before `register.js` (or without it) | `#wl-deck` joins the first-paint hide rule. Gated with `register.js` blocked: no other register's block paints. |
| S4 | the contrast audit ignored ancestor opacity | The audit folds effective opacity (SVG `opacity` included) into the painted colour, skips fully transparent text, and measures the settled page. This exposed a pre-existing defect: bPay's captions double-dimmed to 2.75–4.2:1 in every register. They are fixed, and the ring's "4" moved out of its dimmed group. |
| nits | three allowlisted phrases were really cross-task; "hero first" checked membership, not order; the swap blamed the keychain for a missing name | The three phrases are reworded without a direction, and the allowlist must carry **no stale entry**. Hero-first is checked by visual order. The swap names the missing name. |

Left as they are, and said so: a `?compose=` URL re-lands on the composer on every reload of it (a deep link re-applies, by design). Switching to a different soul keeps the previous account's figures until the new reads land (the page's own pre-existing behaviour, now labelled "reading…").

## 11 · the contract audit (dress removed): PASS at arrival, FAIL one tap in, and what changed

A contract audit was posted on #237 at `4d3c108b2`. It applies the founder's pass/fail test: every colour, font, radius, shadow and animation forced to one value, then measured. It found the arrivals and the navigation genuinely different, and **inside every task, new bee and raver the same page with a different header** (same sections, same order, same controls, the same words to the character). The reviewer's round-1 finding #8 had said the same; this lane answered it then with an art lead-in, which changed the header and not the body. It is answered now at the body:

| register | one tap into a task |
|---|---|
| **new bee** | the task's sections stacked, one question at a time. Each section keeps its plain guidance and its controls, and its **engineering** (the keychain's derivation text and ring, the forge, the RAM line, pay's lane prose and spend cap, the inscription laws, the receipt ladder and adapter states, the outbox law, the matrix body; marked `data-wl-tech` in the markup) folds behind its own **"show the details"**. Moved one tap away, never deleted. |
| **raver** | the lit orb, the task's **PLUR line**, and the task's parts as **glyph cards** (a glyph, its word under it). **No section shows** until a card is picked. A card opens its **one** section, controls first: its heading, prose, notes and the ring's key fold behind **"the words"**. Another card swaps it. Deep links, cross-reference links and carried work open the right card. |
| **cypherpunk** | unchanged: every section, every note open. |

**Measured, the audit's own way, in the gate** (`e2e/wallet-registers.mjs` §4d, colour-independent):
- In every task, raver shows **0 sections and one card per part**, and bee shows the task's sections.
- For each section with engineering (keychain, forge, pay, inscriptions, composer, outbox, matrix), the three bodies strictly differ by visible text: cypherpunk > bee > raver. The per-section counts print in the gate line.
- **No section** renders the same body in bee and raver, to the character.

**The audit's smaller findings.**
- Bee's intro is lowercase with no dash, and raver's intro is a PLUR line ("one soul, every chain. the lights show what you hold."). Both were redrafted in 28 tongues.
- Raver hides the engineering kicker, and its chrome reads at 13px or more.
- The heading separators and the dash-wrapped statuses this lane owns lose their dashes, and the badge loses its dash (redrafted).
- Gold: sections' `var(--gold)` borders are overridden in all three registers (bee and raver since round 1, cypherpunk since round 3), and the fund coin is money blue since round 3. The audit read the source rule, which still exists underneath.
- Dashes elsewhere in the shared copy (for example "unset — no limit", keyed headings like `wl.bpay.h`) remain, and are named here as open.

**Not claimed:** no human (and no matriarch) has used these three grammars yet, and the gate proves only its named properties (DESIGN-CONSTRAINTS §13). No live chain was read. Balances in the receipts are injected fixtures (`12.3456 A`, `7.000 HIVE`), written into the sections' own nodes where a chain read would land.
