# the wallet's three grammars: register-difference matrix (written before any code)

date 2026-09-26 · seat Claude Code · branch `claude-LoVis/wallet-three-grammars-2026-09-26` off `origin/main@8dfb68d81`

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

## 12 · fresh-eyes review, round 4: REQUEST CHANGES, and what changed

Round 4 re-ran on `79f9ff95` (main and #240 merged in, no conflicts). It confirmed the round-4 test on the real page: tapped with the dress stripped, all 18 sections read differently in bee and raver. The merge-delta check also passed on all five points: the wallet hunks, the corpus union (0 keys lost, 0 silent overwrites), the orb-seat test, bee's 16px `.law`, and #233's lower half. What it found, and what changed:

| # | finding | fix |
|---|---|---|
| 1 | blocker: in raver, `?compose=` and `#qr=` landed on a set of cards with the target hidden | Both open their card in raver. The QR sheet re-lands after the content above it renders, the same pattern as the composer (in cypherpunk that content first pushed it 825px out of view). Gated in all three registers. |
| 2 | blocker: "raver (controls first)" was printed and never measured. The forge, receipts and matrix cards opened with no controls | Raver folds words, never controls: a `[data-wl-tech]` block or a note that holds a control stays. The spend-cap label folds by id (`#cap-lbl`) and its controls stay. The gate now measures controls: every raver card whose section has controls opens with one showing. The receipts' note summary counts as that control, and the claim says so. |
| 3 | bee's receipts engineering was not folded | spend-audit's caption, CARE block and ledger note carry `data-wl-tech`. `receipts-sec` joins the gate's folded list. A new row checks that no `[data-wl-tech]` block without a control shows at rest in bee or raver. |
| 4 | the honey check read the top border only; text colour was unmeasured | All four borders are checked, plus a new row for text colour. The wallet feeds spend-audit its accents through `--sa-figure`, `--sa-care` and `--sa-care-line`; comb.html keeps its gold by fallback. Every gold text listed in the §4 inventory is ink, amber or cyan now, including states reached only after an action. The gate does not render those; the text-colour row says so. |
| 5 | "one tap in" never tapped; `/s+/` regex; "to the character" compared lengths | §4d drives the reader's own taps: bee's row, raver's glyph, then each card. The words exclude control labels and anything inside a closed note (this Chromium keeps layout boxes for a closed note's content). Bodies are compared as strings. |
| 6 | bee's "show the details" carried into raver, and pressing it counted as work | A register switch folds every section again, and the toggle is not work. Gated. |
| 7 | raver's "audit it" read at 12px | Raver sets it to its 14px button type. |

**A battery was red and the receipts had said green.** `e2e/wallet-arweave.mjs` failed from the #233 merge (`b63c00c1`) onward. It passed at `0eef8ce6` and on main. Its press on `#vault-sec` at (8, 8) landed under the sticky "real home" banner, which the page pins when served off the kit's home. The battery now scrolls the section clear of the banner before the same press. No assertion changed.

**Receipts (this round):** wallet-registers **GREEN 105/105**. Wallet batteries: fund 94, vault 35, matrix 11, arweave 22, signer 105, adapter 28, 0 failed. CI gates: estate-check PASS; estate-source 11/11; static suite 377/377; bPay A 18/18; bPay B 17/17; bData 100/100; no-page-errors 113 surfaces with 0 errors; i18n selftest and ru floors PASS; polish 25/25; profile 53/53; orb-seat 5/5; tour-bar 4/4; bpay-policy 2/2; comprehension 9/9; engineflow 30/30; comb-eternal 8/8.

**Dashes as punctuation: closed in the next commit.** Measured by a probe that walks every visible text node in the three registers, once at rest and once with every fold and note open (raver taps every card): **159 distinct nodes carried — or – before, 2 after.** Those two are a service `name` inside the ledger receipts. The receipts are content-hashed, so the name is data, not copy, and it stays. The rules: a heading's dash becomes a colon; a status wrapped in dashes loses them; an explanatory dash becomes a colon, a comma or a full stop; a list's dashes become ·. 35 keys were redrafted in all 28 tongues, each in that tongue's own marks (zh and ja `：`, ar, fa and ur `،`, hi, bn and sa `।`, French's spaced ` : `, ru, uk and tt copula dashes rephrased), and the machine-drafted note was added to `_meta.drafted`. Two assertions follow copy, not data, and are just as strict: the matrix battery's family headers (`EVM family: 6 rails`) and one reviewed "below" entry whose capture window moved by one character. The matrix's `FIRMWARE GAP:` keeps its capitals, because in cypherpunk capitals are a signal. The dashes left in place on purpose are post-action states that tests pin (`CONFIRMED — read back…`, `vaulta — down`), attributes and placeholders, and a lone "—" that page logic uses to mean empty.

**Still open:** `wl.bpay.law` in 28 tongues still translates the older "Phase A…" wording. The English now says the chooser comes first, and this pass changed punctuation only. tt, sa and gd are the least certain drafts. Casing of the keyed headings is still the corpus-wide edit named in §6.

### 12b · round 4 was not closed by the first answer: F1 and F2

The founder's read of #242 at `bacc9b50`: round 4 was still open. Two findings remained.

- **F1: the voucher's and the fund's engineering showed in new bee.** The fund's unconfigured state printed `BNR_MELD_PUBLIC_KEY / data-meld-public-key` and the sandbox host into the matriarch's "add money", and raver's fund card did the same. The voucher's source host, its rate citation and "live from the hash-chained ledger" showed after a lookup. The length gate could not see any of this, because a long plain line and a short engineering line weigh the same to a character count.
  **Fix:** each of those strings is now `data-wl-tech`, so it folds in bee and raver and stays open in cypherpunk. The fund's plain state reads "⚠ funding not configured: card checkout is not switched on here yet" (the fund battery pins that honest state, unchanged). The memo warning ("no memo, no credit, money lost") is a safety instruction, not engineering: it carries an id so that raver's word fold never hides it.
- **F2: the technical footer was open in every register.** It held the core badge, the eosjs note, the crypto, the Rust core, the licence and the file path.
  **Fix:** the footer keeps its name and the hub link. Everything else sits behind `<details data-reg-disclose>` ("how this page is built", new key `wl.foot.how`, 29 cells ⚙). register.js's shared law opens it in cypherpunk only; in bee and raver it is one tap away.

**The gate now checks content, not length (§4e).** The dress is stripped, using the contract audit's own CSS. The gate makes one real tap into "add money" in each register, and in raver it opens each card. It performs a real voucher lookup against a fixture oracle. It then looks for the actual strings (source host, rate citation, ledger internals, key names, sandbox host, crypto and build notes) and requires all of these:
- they are absent at rest in bee and raver
- they are present with no tap in cypherpunk
- they are reached by exactly one tap in bee and raver
- the plain facts (balance, memo warning, buy button, checkout state, the footer's name and its way in) show in every register

§4d (all six tasks, real taps) now runs with the dress stripped too. The QR row's first-screen bound became "its top and title inside the first screen": collapsing the footer shortens the page, so raver can no longer scroll the sheet to y=0, and the old `< 200` was a number, not the claim.

**Also corrected:** the corpus's `_meta.drafted` note from the dash commit named a model. It no longer does.

wallet-registers **GREEN 109/109**, dress stripped. Batteries: fund 94 · vault 35 · matrix 11 · arweave 22 · signer 105 · adapter 28. CI gates: estate-check · estate-source 11/11 · static 377/377 · i18n selftest + ru floors · footer-audit 0 worse · no-page-errors 113/0 · polish 25/25 · bPay A 18/18 · B 17/17 · bData 100/100 · orb-seat 5/5 · tour-bar 4/4 · comprehension 9/9 · bpay-policy 2/2 · engineflow 30/30 · comb-eternal 8/8 · skaists-conformance · build-skaists check.

### 12c · the closeout gates as the founder wrote them (comment on #242)

The founder's bar: `F1 PASS · F2 PASS · color-free audit PASS · wallet gates GREEN`. F1 was wider than 12b answered. Bee's "add money" still opened on "THE VOUCHER: prepay compute, metered fair" and "fund: buy USDC, land it on an address you hold". A gate that counts characters cannot see that. So F1 now covers **every opening a bee task makes**, and the gate reads it as words.

- **§4f, new bee's opening copy.** It runs at 390 and 1280 with the dress stripped, with one real row tap per task. For each visible section, it reads the visible heading and the intro under it. It fails on:
  - a capital-as-shout, meaning any all-caps word that is not a ticker. The ticker list is stated in the gate: USDC, ETH, ANT, HIVE, HBD, HP, AR, BTC, BCH, ZEC, XMR, BNR, EVM, QR.
  - any dash
  - any machine word from a stated list: rpc, keyless, vram, spec-, bytes, persist, contract surface, unicove, abi, prf, jwk, wasm, oracle, hash-chained, derivation, endpoint, eosjs, sandbox, escrow, orchestrator, metadata, masterprk, funnel

  Its first run failed on eight sections: balances, summary, outbox, voucher, fund, peer, inscriptions and composer. It also failed on the balance cards' descriptions (RAM, JWK, "public metadata", keyless) and on the outbox's empty line ("persists … BEFORE it is submitted").
- **The fix is one pattern, moved and never deleted.** Each of those engineering headings carries `data-wl-tech`, and new bee gets its own plain heading in its place (`data-reg="bee"`, 8 keys `wl.bee.h.*` × 29 cells ⚙):
  - what you hold, on every chain
  - at a glance
  - waiting to be sent
  - prepay for compute
  - buy USDC with a card
  - money in, person to person
  - your garden, drawn on the chain
  - write an action and see it before you sign

  Also folded in bee: the balances intro ("Read from public RPCs…"), bee's voucher paragraph (vRAM), and the balance cards' descriptions (`.chain .cd`). They sit behind the section's own "show the details". The outbox says "nothing is waiting to be sent" in bee (`wl.bee.outbox.empty`), and the precise line stays for cypherpunk. Raver and cypherpunk are unchanged: raver already folds every h2, and cypherpunk shows everything.
- **§4e now runs at 390 and 1280.** Each width must hold on its own (a string found at one width does not excuse its absence at the other). It also banks colour and stripped receipts of the add task per register per width: `wallet-{390,1280}-{reg}-add-{colour,stripped}.png`. Read side by side, they show no overlap in either.

**Receipts (this closeout):** wallet-registers **GREEN 110/110**. Batteries: fund 94 · vault 35 · matrix 11 · arweave 22 · signer 105 · adapter 28. CI gates: estate-check · estate-source 11/11 · static 377/377 · i18n selftest + ru floors · footer-audit 0 worse · no-page-errors 113/0 · polish 25/25 · profile 53/53 · bPay A 18/18 · B 17/17 · bData 100/100 · orb-seat 5/5 · tour-bar 4/4 · comprehension 9/9 · bpay-policy 2/2 · engineflow 30/30 · comb-eternal 8/8 · skaists-conformance · build-skaists check.

**Still open and named, as the review allows:**
- Dashes and capitals in keyed runtime copy reached only after an action: the voucher panel's `wl.vc.*` ("the memo IS the binding —", "A · Vaulta — gasless").
- The keyed headings' casing in the corpus. Bee no longer shows those headings at rest; cypherpunk still does.
- The stale "Phase A" label in 28 tongues.

## 13 · follow-up 1: the wallet's suites run in CI, in all three registers (2026-09-27)

**The finding was larger than the follow-up said.** The merge review of #237 noted that the six pipeline batteries were pinned to cypherpunk, so CI "no longer" exercised the vault, signer and fund flows in bee or raver. In fact CI had never run any of them. `tests.yml` named none of the six batteries, nor `e2e/wallet-registers.mjs`, and no glob picked them up. Every wallet receipt in this dispatch was a hand run, and so was the "CI 12/12" on #237's merge head: that covered the other suites, not these. Nothing in the wallet was ever gated remotely.

**What changed:**
- **The pin.** `e2e/wallet-register-pin.mjs` is one shared pin, replacing five copies (and adding the matrix battery, which had no pin and silently ran in bee). `WALLET_REG` selects the register, and cypherpunk is the default, so a plain run behaves as before. `bee` and `raver` open the reader's own "everything" view: the bee row or raver glyph that the page remembers in `sessionStorage['wl.view']`. Notes stay folded, as a reader has them.
- **The fund battery, two register-aware fixes.** Neither is loosened.
  - "banner names environment": in bee and raver the environment is engineering, folded one tap away (§12b). The check now taps the section's toggle, then requires the same text.
  - Section F's dress and fold laws are about one register each (bee's home fold, cypherpunk's pipeline fold). Their contexts now open through `newContextOwnRegister` and set that register explicitly, so the pin no longer overrides them.
- **CI.** A new `wallet` job (30-minute cap, beside `node`, which already runs close to its 20-minute cap) runs the six batteries once per register, then the three-grammars gate. Each step runs all six and fails at the end.

**Receipts (local, each read on its own line):**

| battery | cypherpunk | new bee | raver |
|---|---|---|---|
| fund | 94/94 | 94/94 | 94/94 |
| vault | 35/35 | 35/35 | 35/35 |
| matrix | 11/11 | 11/11 | 11/11 |
| arweave | 22/22 | 22/22 | 22/22 |
| signer | 105/105 | 105/105 | 105/105 |
| adapter | 28/28 | 28/28 | 28/28 |

`lint-ci-shape`: 95/95 suite steps guarded.

## 14 · follow-up 2: the voucher panel reads as words (2026-09-27)

This is the copy a voucher lookup opens: the `wl.vc.*` keys and the runtime strings the voucher panel writes. It had dashes used as punctuation and capitals used as shouting ("with this EXACT memo (the memo IS the binding —", "A · Vaulta — gasless", "itemized — every receipt, every line", "no metered charges yet — top up…", "the oracle is unreachable — try again").

- **Keys, 5 × 29 cells.** `memo1`, `usdc.nomemo`, `itemized`, `label.a` and `label.usdc`.
  - A dash becomes a colon (`：` in zh and ja, French's spaced ` : `), or `·` in the two rail labels.
  - A shouted word is lowercased in every tongue: ЭТОЙ ТОЧНОЙ, GENAUEN, IST, EXACTE, EKSAKTE, ÄR and so on.
  - The memo warning keeps its weight through the bold "no memo, no credit, money lost", not through capitals.
  - Four cells were rewritten by hand: tt (its "is" dash, rephrased), cs and fi (their grammar was broken), and hu (a typo, "memóMaga").
  - Cells that were untranslated English follow the new English.
- **Runtime strings in `wallet.html`.** The rate line, the empty receipts line, both "unreachable" messages, and the meter-key placeholder.
- **Left as data:** a lone "—" that page logic sets for an empty value, and the "—" number placeholder in `wl.vc.usdc.rate`, which the oracle's rate replaces before the panel is ever shown.
- **The gate (§4e).** After a real lookup against the fixture oracle, the panel's visible text must carry no dash and no capital-as-shout, in all three registers at 390 and 1280. A lone "—" empty value and the oracle's own values (addresses, memo, rate reference, source) are excepted.
  - Run against main's old copy, the check fails on exactly the strings above, so it is not vacuous.
  - On this branch it passes: wallet-registers 111/111.

**Still open and named:**
- The voucher's heading and cypherpunk intro (`wl.vh2` "THE VOUCHER", "DERIVED") belong to the next follow-up, heading capitals.
- These cells are still untranslated English: `wl.vc.memo1` in fr, zh, th, lv, hi and tr; `wl.vc.itemized` in gd, tt and sa; `wl.vc.label.a` in gd, tt and sa; `wl.vc.usdc.nomemo` in gd, lv, tt and sa.
- Translation defects outside punctuation remain: th nomemo "เคครดิต", tr "balı adresiniz", fi nomemo "tällää", hu nomemo "jóváírást jóváír".

## 15 · follow-up 3: the keyed headings read as words (2026-09-27)

The four keyed wallet headings still shouted in capitals, in English and in almost every tongue: `wl.vh2` ("THE VOUCHER: …"), `wl.insc.h2` ("INSCRIPTIONS: …"), `wl.h.summary` ("SUMMARY") and `wl.h.outbox` ("…persist here BEFORE they submit"). New bee has read its own plain headings since §12c. These keyed ones are what cypherpunk, and bee's engineering one tap deep, still show.

- **4 keys, 73 cells changed.** Every shouted word is lowercased. Scripts without letter case needed nothing.
  - German keeps its noun capitals: der Gutschein, Inschriften, Zusammenfassung, Bytes.
  - Turkish gets its dotless ı (yazıtlar).
  - The HTML fallbacks follow the English.
- **Gate §4g (new).** No visible section heading shouts, in cypherpunk (every keyed heading open) or in bee's "everything" view. Tickers are excepted, and so are `SPEC-…` identifiers, which are the canonical names of spec documents (peer's `SPEC-PEER-FUNNEL-1`).
  - Run against main, it fails on all four headings (`INSCRIPTIONS`, `THE VOUCHER`, `BEFORE`, `SUMMARY`), so it is not vacuous. (Corrected in §16: this line first said "exactly `INSCRIPTIONS` and `THE VOUCHER`".)
  - On this branch: wallet-registers 112/112.
- **Left as they are, and why:** the receipt ladder's stage labels (`wl.ld.*`: BUILD, SIGN, PERSIST, SUBMIT, CONFIRM, SUBMITTED, CONFIRMED) and cypherpunk's own intro paragraphs (`wl.reg.voucher.cypher` "DERIVED", `wl.reg.connect.cypher` "AND"). In cypherpunk, capitals are a signal channel (a state, a verb of the pipeline). They are not decoration and not headings, so this follow-up does not touch them.

**Carried from the #252 review (non-blocking, open and named):**
- Three more translation defects in voucher copy: he "הממוא"/"הממואר" (memo misspelt, inconsistently), nb "denne eksakte memoet" (should be "dette"), de "auf dieser Rails".
- §14's untranslated list should also name `wl.vc.label.usdc` in gd, tt and sa.
- §4e's "fails on exactly those strings" holds for the strings visible in the panel. The empty-receipts line (inside a closed note), both "unreachable" messages and the placeholder are correct by inspection, not measured.
- fr uses a plain space before ":", not a narrow no-break space. This is cosmetic.

## 16 · follow-up 4: the bPay law line follows its English (2026-09-27)

The English of `wl.bpay.law` changed to "the chooser comes first: every figure is carried from a live, keyless network quote; this panel renders, it cannot spend". All 28 other tongues still opened with "Phase A:" (Фаза A, Fase A, 阶段 A, A fázis …), a label the page no longer shows. A reader in any tongue but English was told about a phase, not about the chooser.

- **28 cells redrafted** to follow the current English: the choice (who can get this) comes first, the figures come from a live keyless quote, and the panel cannot spend.
- **Defects fixed in the same cells:**
  - fi had a stray underscore ("verkko_tarjouksesta").
  - nb had the wrong gender ("en … nettverkstilbud") and the spelling "nøkkeløs".
  - tt rendered "live" as a word that does not mean live, and put "only" in the wrong place.
  - gd used "panuel"; it now uses "panail", the corpus's most common form.
  - th rendered "live" as จริง ("real"); it now says เรียลไทม์.
  - Smaller improvements in the same cells: ur spelling (لائیو), ru/uk now name the price quote (цены/ціни), zh 显示 instead of 渲染 ("render" in the graphics sense), de "zeigt nur an".
- **Gate §4h (new).** It is a corpus check in `wallet-registers`. No `wl.bpay.law` cell may carry a standalone capital A, Latin or Cyrillic (the phase letter, in every script), and no cell may fall back to the English. Run against main it fails in all 28 tongues, so it is not vacuous.
- **Corpus cache key** `lang-corpus.json?v=28 → v=29` in `surfaces/lang.js`. #252 and #254 changed the corpus without bumping it, so this bump also carries their cells to returning readers.

**Carried from the #254 review (non-blocking, open and named):**
- §15 misreported the main run as failing on "exactly" two headings. Measured, it fails on all four; §15 is corrected above. #254's commit message carries the same understatement and stays as history.
- §4g only sees ASCII capitals, and only in English. A Cyrillic or accented shout in another tongue would pass it; the reviewer's corpus scan covers that gap for now.
- lv `wl.h.summary` "kopsavējums" may be a mistranslation. The usual Latvian word is "kopsavilkums". It was unchanged apart from casing, and it wants a native check.
- fr still uses a plain space before ":" (cosmetic, already named in §15).

**Named by the #255 review (non-blocking, open):**
- An unrelated cs cell elsewhere reads "Pole z živého ABI registru"; Czech wants "ze živého". This follow-up does not touch it.
- da "levende" and fi "elävä" read as "living" rather than "live". The same choice runs through the rest of the corpus.
- hi चुनाव, fa انتخاب, tr seçim, tt сайлау and hu választás can also mean "election". In context they are fine.
- §4h catches a Latin or Cyrillic capital A and an exact English fallback. It would miss a phase label written another way (阶段一, a bare "Phase").

## 17 · follow-up 5: three ETERNAL fixes from the #248 review (2026-09-27)

The Codex review of #248 found three defects in ETERNAL code that #241 shipped. They were outside #248's scope and were queued here. Each fix comes with a test that fails on main and passes on this branch.

- **`surfaces/blight/profile.html`: a failed second scan no longer shows the first address's holdings.** `visit()` set the new shorthand and then returned early when every RPC host refused. That left the previous address's chips, wall, picture and counters under the new name, and the three fronts read all of these. The page now resets them to its first-paint state before every scan.
  - Test: `blight-profile-eternal`, "a second address whose scan fails never inherits…".
- **`surfaces/bqueenbee-live.html`: each reply is paired with its own question.** A non-ASCII question answers asynchronously, once the tongue corpus is read. If a newer question was asked before that answer landed, the fronts took "the last reply after the last question", which was the late one, and showed it as the newer question's answer.
  - Every reply now carries its question's id (`data-qid`), and the fronts look it up by that id.
  - Test: `bqueenbee-live-eternal`, "a reply is paired with its own question…". On main the card showed the Russian hemp answer under "Who are you?".
  - Left as is: the chat itself still appends a late reply at the bottom. Only the fronts' pairing was wrong.
- **`surfaces/bset.html`: every cypherpunk record link announces its new tab.** These are the YouTube links. They now use the same screen-reader notice (`et.bset.newtab`) as the rest of the page's external links.
  - Test: `bset-eternal`, cypherpunk.

**Carried from the #255 review (non-blocking, open and named):**
- The `_meta.drafted` note for the bPay law line says "four cells had their own defects fixed". With the th sense fix, it is five.
- §16 does not name nb "kun" → "bare" among the smaller improvements.
